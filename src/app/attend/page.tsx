
'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, CheckCircle, XCircle, UserCheck, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { verifyFace } from '@/ai/flows/verify-face';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type AppUser = {
    uid: string;
    email: string;
    faceDataUri: string;
    rollNo: string;
    name: string;
};

type AttendanceStatus = 'initializing' | 'authenticating' | 'validating_session' | 'camera_loading' | 'ready_to_verify' | 'verifying' | 'success' | 'error';

function AttendanceProcessor() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [status, setStatus] = useState<AttendanceStatus>('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    setStatus('authenticating');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().faceDataUri) {
          setCurrentUser({ uid: firebaseUser.uid, ...userDoc.data() } as AppUser);
        } else {
          setErrorMessage('You must have an enrolled face to mark attendance. Please complete enrollment on your dashboard.');
          setStatus('error');
        }
      } else {
        setErrorMessage('You must be logged in to mark attendance.');
        setStatus('error');
      }
    });

    return () => {
      unsubscribe();
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!currentUser) return;

    async function validateSession() {
      setStatus('validating_session');
      if (!sessionId || !token) {
        setErrorMessage('Invalid session link. Please scan a valid QR code.');
        setStatus('error');
        return;
      }

      try {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await getDoc(sessionDocRef);

        if (!sessionDoc.exists()) {
          setErrorMessage('Session not found.');
          setStatus('error');
        } else {
          const sessionData = sessionDoc.data();
          if (!sessionData.active) {
            setErrorMessage('This session has already ended.');
            setStatus('error');
          } else if (sessionData.qrToken !== token) {
            setErrorMessage('The QR code has expired. Please scan the new code.');
            setStatus('error');
          } else {
            // All good, move to camera stage
            setStatus('camera_loading');
          }
        }
      } catch (e: any) {
        setErrorMessage('An error occurred during session validation.');
        setStatus('error');
      }
    }

    validateSession();
  }, [currentUser, sessionId, token]);
  
   useEffect(() => {
    const startCamera = async () => {
      if (status !== 'camera_loading') return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setHasCameraPermission(true);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus('ready_to_verify');
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setErrorMessage('Camera access was denied. Please enable permissions in your browser settings.');
        setStatus('error');
      }
    };

    startCamera();

    return () => {
        // Ensure camera stops if component unmounts during this phase
        stopCamera();
    };
    
  }, [status, stopCamera]);


  const takePictureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !currentUser || !sessionId) return;

    setStatus('verifying');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setErrorMessage('Could not process video frame.');
      setStatus('error');
      return;
    }

    context.translate(video.videoWidth, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    stopCamera();

    try {
      const result = await verifyFace({
        livePhotoDataUri: dataUrl,
        enrolledFaceDataUri: currentUser.faceDataUri,
        studentName: currentUser.name || currentUser.email,
      });

      if (result.isMatch && result.confidence > 0.8) {
         try {
          const sessionDocRef = doc(db, 'sessions', sessionId);
          const studentData = {
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentUser.name || currentUser.email.split('@')[0],
            rollNo: currentUser.rollNo || 'N/A',
            checkInTime: new Date().toISOString(),
            verificationPhoto: dataUrl,
          };

          await updateDoc(sessionDocRef, { attendedStudents: arrayUnion(studentData) });

          const userDocRef = doc(db, 'users', currentUser.uid);
          const sessionDoc = await getDoc(sessionDocRef);
          if (sessionDoc.exists()) {
              const sessionDetails = sessionDoc.data();
              await updateDoc(userDocRef, {
                attendanceHistory: arrayUnion({
                  sessionId,
                  subject: sessionDetails?.subject || 'Unknown Subject',
                  date: sessionDetails?.lectureDate || new Date().toISOString(),
                  status: 'Present',
                }),
              });
          }
          setStatus('success');
          toast({ title: 'Attendance Marked!', description: `Confidence: ${(result.confidence * 100).toFixed(2)}%` });
        } catch (dbError: any) {
            console.error("Database update failed:", dbError);
            setErrorMessage('Could not save attendance record. Please contact your professor.');
            setStatus('error');
        }
      } else {
        setErrorMessage(result.reason || 'Verification failed. The faces did not match.');
        setStatus('error');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'An unexpected error occurred during verification.');
      setStatus('error');
    }
  }, [currentUser, sessionId, stopCamera, toast]);
  
  const renderContent = () => {
    if (status === 'initializing' || status === 'authenticating' || status === 'validating_session' || status === 'camera_loading') {
        const messages = {
            initializing: 'Initializing...',
            authenticating: 'Authenticating user...',
            validating_session: 'Validating session...',
            camera_loading: 'Starting camera...',
        };
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">{messages[status]}</p></div>;
    }

    if (status === 'error') {
      return (
          <div className="text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold mt-4">Attendance Failed</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Try Again</Button>
          </div>
      );
    }
    
    if (status === 'success') {
       return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold mt-4">Attendance Marked!</h2>
            <p className="text-muted-foreground">You have been successfully marked present.</p>
          </div>
        );
    }

    // Default camera view
    return (
        <div className="w-full text-center">
            <div className={`w-full max-w-sm aspect-square rounded-full bg-secondary mx-auto flex items-center justify-center overflow-hidden border-4 ${hasCameraPermission === false ? 'border-destructive' : 'border-primary'}`}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            </div>
            
            {hasCameraPermission === false ? (
                 <Alert variant="destructive" className="mt-4 text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>
                        Please enable camera permissions in your browser settings to verify your identity.
                    </AlertDescription>
                </Alert>
            ) : (
                <>
                 <p className="mt-4 mb-4 text-muted-foreground text-sm">Position your face in the frame and take a picture to verify.</p>
                <Button onClick={takePictureAndVerify} size="lg" disabled={status === 'verifying'}>
                    {status === 'verifying' ? <Loader2 className="mr-2 animate-spin"/> : <Camera className="mr-2"/>}
                    {status === 'verifying' ? 'Verifying...' : 'Verify My Face'}
                </Button>
                </>
            )}
        </div>
    );
  };
  
  const getProgressValue = () => {
    switch (status) {
      case 'initializing': return 0;
      case 'authenticating': return 20;
      case 'validating_session': return 40;
      case 'camera_loading': return 60;
      case 'ready_to_verify': return 80;
      case 'verifying': return 90;
      case 'success': return 100;
      case 'error': return 100;
      default: return 0;
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck /> Attendance Verification</CardTitle>
          <CardDescription>Session ID: {sessionId || 'Loading...'}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[450px] flex flex-col items-center justify-center space-y-4">
            {renderContent()}
        </CardContent>
        <CardFooter className="flex flex-col">
          <Progress value={getProgressValue()} className={`w-full h-2 rounded-b-lg ${status === 'error' ? '[&>div]:bg-destructive' : ''}`} />
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
