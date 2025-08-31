
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { verifyFace } from '@/ai/flows/verify-face';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type AttendanceStatus = 'idle' | 'authenticating' | 'validating_token' | 'ready_to_verify' | 'verifying' | 'verified_ok' | 'verified_fail' | 'error';
type AppUser = {
    uid: string;
    email: string;
    faceDataUri: string;
    rollNo: string;
    name: string;
};


function AttendancePageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [status, setStatus] = useState<AttendanceStatus>('idle');
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // Effect for authenticating the user
  useEffect(() => {
    setStatus('authenticating');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists() || !userDoc.data().faceDataUri) {
                setErrorMessage('You have not enrolled your face. Please enroll from your dashboard.');
                setStatus('error');
            } else {
                const appUser = { uid: user.uid, ...userDoc.data() } as AppUser;
                setCurrentUser(appUser);
            }
        } else {
            setErrorMessage('You must be logged in to mark attendance.');
            setStatus('error');
            setCurrentUser(null);
        }
    });
    return () => {
      unsubscribe();
      stopCamera();
    };
  }, [stopCamera]);

  // Effect for validating the session token *after* user is authenticated
  useEffect(() => {
    const handleSessionValidation = async () => {
      if (!currentUser) {
        if(status !== 'authenticating' && status !== 'idle'){
           setErrorMessage('You must be logged in to mark attendance.');
           setStatus('error');
        }
        return;
      };

      setStatus('validating_token');
      setProgress(25);
      if (!sessionId || !token) {
          setErrorMessage('Invalid session or QR code. Please scan a valid, live QR code.');
          setStatus('error');
          return;
      }

      const sessionDocRef = doc(db, 'sessions', sessionId);
      const sessionDoc = await getDoc(sessionDocRef);

      if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data();
          if (!sessionData.active) {
              setErrorMessage('This session has already ended.');
              setStatus('error');
          } else if (sessionData.qrToken !== token) {
              setErrorMessage('The QR code has expired. Please scan the new code from the screen.');
              setStatus('error');
          } else {
              setStatus('ready_to_verify');
              setProgress(50);
          }
      } else {
          setErrorMessage('Session not found.');
          setStatus('error');
      }
    };
    
    handleSessionValidation();
    
  }, [currentUser, sessionId, token, status]);


  // Effect for managing the camera based on permissions
  useEffect(() => {
    let stream: MediaStream;

    const enableCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setErrorMessage('Camera access was denied. Please enable permissions in your browser settings.');
        setStatus('error');
        toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera. Please enable permissions.' });
      }
    };

    if (status === 'ready_to_verify') {
        enableCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast, status]);


  const takePictureAndVerify = useCallback(async () => {
    if (videoRef.current && canvasRef.current && currentUser) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.translate(video.videoWidth, 0);
            context.scale(-1, 1);
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            stopCamera();
            setStatus('verifying');
            setProgress(75);

            try {
                const result = await verifyFace({
                    livePhotoDataUri: dataUrl,
                    enrolledFaceDataUri: currentUser.faceDataUri,
                    studentName: currentUser.name || currentUser.email
                });

                if (result.isMatch && result.confidence > 0.8) {
                    setStatus('verified_ok');
                    setProgress(100);
                    toast({ title: 'Attendance Marked!', description: `Confidence: ${(result.confidence * 100).toFixed(2)}%` });
                    
                    if (sessionId) {
                        const sessionDocRef = doc(db, 'sessions', sessionId);
                        const studentData = {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            name: currentUser.name || currentUser.email.split('@')[0],
                            rollNo: currentUser.rollNo || 'N/A',
                            checkInTime: new Date().toISOString(),
                            verificationPhoto: dataUrl,
                        };
                        
                        const sessionDoc = await getDoc(sessionDocRef);
                        if(sessionDoc.exists()) {
                            const attendedStudents = sessionDoc.data()?.attendedStudents || [];
                            if (!attendedStudents.some((s: any) => s.uid === currentUser.uid)) {
                               await updateDoc(sessionDocRef, { attendedStudents: arrayUnion(studentData) });
                            }

                            const userDocRef = doc(db, 'users', currentUser.uid);
                            const sessionDetails = sessionDoc.data();
                             const userDoc = await getDoc(userDocRef);
                             if (userDoc.exists()) {
                                const userAttendanceHistory = userDoc.data()?.attendanceHistory || [];
                                if(!userAttendanceHistory.some((h: any) => h.sessionId === sessionId)) {
                                    await updateDoc(userDocRef, {
                                    attendanceHistory: arrayUnion({
                                        sessionId,
                                        subject: sessionDetails?.subject || 'Unknown Subject',
                                        date: sessionDetails?.lectureDate || new Date().toISOString(),
                                        status: 'Present'
                                    })
                                    });
                                }
                             }
                        }
                    }

                } else {
                    setStatus('verified_fail');
                    setErrorMessage(result.reason);
                    toast({ variant: 'destructive', title: 'Verification Failed', description: result.reason });
                }
            } catch (error) {
                setStatus('verified_fail');
                setErrorMessage('An error occurred during verification.');
                toast({ variant: 'destructive', title: 'Error', description: 'An error occurred during verification.' });
            }
        }
    }
  }, [stopCamera, toast, currentUser, sessionId]);

  const renderStatusInfo = () => {
    if (status === 'authenticating' || status === 'idle') {
         return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Authenticating...</p></div>;
    }
    switch (status) {
      case 'validating_token':
         return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Validating QR Code...</p></div>;
      case 'ready_to_verify':
        return (
          <div className="text-center">
            <p className="mb-4 text-muted-foreground text-sm">Position your face in the frame and take a picture to verify.</p>
            <Button onClick={takePictureAndVerify} size="lg" disabled={hasCameraPermission === false}><Camera className="mr-2"/> Verify My Face</Button>
          </div>
        );
      case 'verifying':
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Verifying your identity...</p></div>;
      case 'verified_ok':
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold mt-4">Attendance Marked!</h2>
            <p className="text-muted-foreground">You have been successfully marked present for this lecture.</p>
          </div>
        );
      case 'verified_fail':
      case 'error':
         return (
          <div className="text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold mt-4">Attendance Failed</h2>
            <p className="text-muted-foreground">{errorMessage || "An unknown error occurred."}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Try Again</Button>
          </div>
        );
      default:
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /></div>;
    }
  };
  
  const showVideo = hasCameraPermission && (status === 'ready_to_verify' || status === 'verifying');

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck /> Attendance Verification</CardTitle>
          <CardDescription>Session ID: {sessionId || 'Loading...'}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
            <div className={`w-full max-w-sm aspect-square rounded-full bg-secondary mx-auto flex items-center justify-center overflow-hidden border-4 border-primary ${!showVideo ? 'p-4' : ''}`}>
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${!showVideo ? 'hidden' : ''}`} />
                {!showVideo && renderStatusInfo()}
            </div>

            {hasCameraPermission === false && status === 'ready_to_verify' && (
                 <Alert variant="destructive">
                     <AlertTitle>Camera Access Denied</AlertTitle>
                     <AlertDescription>
                         Please enable camera permissions in your browser settings to continue.
                     </AlertDescription>
                 </Alert>
            )}

            {showVideo && <div className="pt-4">{renderStatusInfo()}</div>}

        </CardContent>
        <CardFooter className="flex flex-col">
            <Progress value={progress} className="w-full h-2 rounded-b-lg" />
            <canvas ref={canvasRef} className="hidden" />
        </CardFooter>
      </Card>
    </main>
  );
}

export default function AttendPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin"/></div>}>
            <AttendancePageContent />
        </Suspense>
    )
}
 
