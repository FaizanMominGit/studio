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

type AttendanceStatus = 'idle' | 'loading_user' | 'validating_token' | 'camera_loading' | 'camera_on' | 'verifying' | 'verified_ok' | 'verified_fail' | 'error';
type AppUser = {
    uid: string;
    email: string;
    faceDataUri: string;
    rollNo: string;
    name: string;
};

function AttendanceProcessor() {
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

  const handleUserCheck = useCallback(async (user: User | null) => {
    if (user) {
        setStatus('loading_user');
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (!userData.faceDataUri) {
                setErrorMessage('You have not enrolled your face. Please enroll from your dashboard.');
                setStatus('error');
                return;
            }
            setCurrentUser({ uid: user.uid, ...userData } as AppUser);
            setStatus('validating_token');
            setProgress(15);
        } else {
            setErrorMessage('Could not find your user profile.');
            setStatus('error');
        }
    } else {
        setErrorMessage('You must be logged in to mark attendance.');
        setStatus('error');
    }
  }, []);
  
  const validateToken = useCallback(async () => {
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
            setStatus('camera_loading');
            setProgress(25);
        }
    } else {
        setErrorMessage('Session not found.');
        setStatus('error');
    }
  }, [sessionId, token]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, handleUserCheck);
    return () => {
      unsubscribe();
      stopCamera();
    };
  }, [handleUserCheck, stopCamera]);

  useEffect(() => {
      if (status === 'validating_token') {
          validateToken();
      }
  }, [status, validateToken]);


  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      if (status !== 'camera_loading') return;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setStatus('camera_on');
            setProgress(50);
        } else {
            // This case might happen if the component unmounts quickly
             stream.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setErrorMessage('Camera access was denied. Please enable permissions in your browser settings.');
        setStatus('error');
        toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera. Please enable permissions.' });
      }
    };

    getCameraPermission();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [status, toast]);


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

  const renderContent = () => {
    switch (status) {
      case 'idle':
      case 'loading_user':
         return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Loading your profile...</p></div>;
      case 'validating_token':
         return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Validating QR Code...</p></div>;
      case 'camera_loading':
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Starting camera...</p></div>;
      case 'camera_on':
        return (
          <div className="text-center">
            <p className="mb-4 text-muted-foreground text-sm">Position your face in the frame and take a picture to verify.</p>
            <Button onClick={takePictureAndVerify} size="lg" disabled={!hasCameraPermission}><Camera className="mr-2"/> Verify My Face</Button>
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
  
  const showVideo = status === 'camera_on' || status === 'verifying' || status === 'camera_loading';

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck /> Attendance Verification</CardTitle>
          <CardDescription>Session ID: {sessionId || 'Loading...'}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
            <div className={`w-full max-w-sm aspect-square rounded-full bg-secondary mx-auto flex items-center justify-center overflow-hidden border-4 border-primary ${!showVideo && 'p-4'}`}>
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${!showVideo && 'hidden'}`} />
                {!showVideo && renderContent()}
            </div>
            {hasCameraPermission === false && (
                 <Alert variant="destructive">
                     <AlertTitle>Camera Access Denied</AlertTitle>
                     <AlertDescription>
                         Please enable camera permissions in your browser settings to continue.
                     </AlertDescription>
                 </Alert>
            )}
             {showVideo && <div className="pt-4">{renderContent()}</div>}

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
            <AttendanceProcessor />
        </Suspense>
    )
}
