
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

type AttendanceStatus = 'authenticating' | 'validating' | 'ready' | 'verifying' | 'success' | 'failure' | 'error';
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

  const [status, setStatus] = useState<AttendanceStatus>('authenticating');
  const [progress, setProgress] = useState(0);
  const [user, setUser] = useState<AppUser | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().faceDataUri) {
          setUser({ uid: firebaseUser.uid, ...userDoc.data() } as AppUser);
        } else {
          setErrorMessage('You must be logged in and have an enrolled face to mark attendance.');
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
    const validateSession = async () => {
      if (!user) return;

      setStatus('validating');
      setProgress(25);

      if (!sessionId || !token) {
        setErrorMessage('Invalid session link. Please scan a valid QR code.');
        setStatus('error');
        return;
      }

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
          setStatus('ready');
          setProgress(50);
        }
      }
    };

    validateSession();
  }, [user, sessionId, token]);

  useEffect(() => {
    const getCameraPermission = async () => {
      if (status !== 'ready') return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setErrorMessage('Camera access was denied. Please enable permissions in your browser settings.');
        setStatus('error');
      }
    };

    getCameraPermission();

    return () => {
      stopCamera();
    };
  }, [status, stopCamera]);

  const takePictureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !user) return;

    setStatus('verifying');
    setProgress(75);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setStatus('error');
      setErrorMessage('Could not process video frame.');
      return;
    }
    
    context.translate(video.videoWidth, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    stopCamera();

    try {
      const result = await verifyFace({
        livePhotoDataUri: dataUrl,
        enrolledFaceDataUri: user.faceDataUri,
        studentName: user.name || user.email,
      });

      if (result.isMatch && result.confidence > 0.8) {
        setStatus('success');
        setProgress(100);
        toast({ title: 'Attendance Marked!', description: `Confidence: ${(result.confidence * 100).toFixed(2)}%` });

        try {
            if (sessionId) {
              const sessionDocRef = doc(db, 'sessions', sessionId);
              const studentData = {
                uid: user.uid,
                email: user.email,
                name: user.name || user.email.split('@')[0],
                rollNo: user.rollNo || 'N/A',
                checkInTime: new Date().toISOString(),
                verificationPhoto: dataUrl,
              };

              const sessionDoc = await getDoc(sessionDocRef);
              if (sessionDoc.exists()) {
                const attendedStudents = sessionDoc.data()?.attendedStudents || [];
                if (!attendedStudents.some((s: any) => s.uid === user.uid)) {
                  await updateDoc(sessionDocRef, { attendedStudents: arrayUnion(studentData) });
                }

                const userDocRef = doc(db, 'users', user.uid);
                const sessionDetails = sessionDoc.data();
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                  const userAttendanceHistory = userDoc.data()?.attendanceHistory || [];
                  if (!userAttendanceHistory.some((h: any) => h.sessionId === sessionId)) {
                    await updateDoc(userDocRef, {
                      attendanceHistory: arrayUnion({
                        sessionId,
                        subject: sessionDetails?.subject || 'Unknown Subject',
                        date: sessionDetails?.lectureDate || new Date().toISOString(),
                        status: 'Present',
                      }),
                    });
                  }
                }
              }
            }
        } catch (dbError: any) {
            console.error("Database update failed:", dbError);
            setStatus('error');
            setErrorMessage('Could not save attendance record to the database. Please contact your professor.');
        }

      } else {
        setStatus('failure');
        setErrorMessage(result.reason || 'Verification failed. The faces did not match.');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(e.message || 'An unexpected error occurred during verification.');
    }
  }, [user, sessionId, stopCamera, toast]);
  
  const renderStatusInfo = () => {
    switch (status) {
      case 'authenticating':
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Authenticating...</p></div>;
      case 'validating':
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Validating Session...</p></div>;
      case 'ready':
        return (
          <div className="text-center">
            <p className="mb-4 text-muted-foreground text-sm">Position your face in the frame and take a picture to verify.</p>
            <Button onClick={takePictureAndVerify} size="lg" disabled={!hasCameraPermission}><Camera className="mr-2"/> Verify My Face</Button>
          </div>
        );
      case 'verifying':
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">Verifying Identity...</p></div>;
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold mt-4">Attendance Marked!</h2>
            <p className="text-muted-foreground">You have been successfully marked present.</p>
          </div>
        );
      case 'failure':
      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold mt-4">Attendance Failed</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Try Again</Button>
          </div>
        );
    }
  };
  
  const showVideo = status === 'ready';

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck /> Attendance Verification</CardTitle>
          <CardDescription>Session ID: {sessionId || 'Loading...'}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
            <div className={`w-full max-w-sm aspect-square rounded-full bg-secondary mx-auto flex items-center justify-center overflow-hidden border-4 ${showVideo ? 'border-primary' : 'border-transparent'}`}>
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${!showVideo ? 'hidden' : ''}`} />
                {!showVideo && renderStatusInfo()}
            </div>

            {hasCameraPermission === false && status === 'ready' && (
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
