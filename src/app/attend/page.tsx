
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

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'success' | 'failure' | null>(null);

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
    // This effect handles the entire lifecycle: auth -> session -> camera
    setStatusMessage('Authenticating...');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setErrorMessage('You must be logged in to mark attendance.');
        setIsLoading(false);
        return;
      }
      
      try {
        // Step 1: Fetch user data
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists() || !userDoc.data().faceDataUri) {
          setErrorMessage('You must be logged in and have an enrolled face to mark attendance.');
          setIsLoading(false);
          return;
        }
        const authenticatedUser = { uid: firebaseUser.uid, ...userDoc.data() } as AppUser;
        setCurrentUser(authenticatedUser);

        // Step 2: Validate the session
        setStatusMessage('Validating Session...');
        if (!sessionId || !token) {
          setErrorMessage('Invalid session link. Please scan a valid QR code.');
          setIsLoading(false);
          return;
        }
        
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await getDoc(sessionDocRef);
        if (!sessionDoc.exists()) {
          setErrorMessage('Session not found.');
        } else {
          const sessionData = sessionDoc.data();
          if (!sessionData.active) {
            setErrorMessage('This session has already ended.');
          } else if (sessionData.qrToken !== token) {
            setErrorMessage('The QR code has expired. Please scan the new code.');
          } else {
            // Session is valid, now start the camera
            setStatusMessage('Initializing Camera...');
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              streamRef.current = stream;
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
              }
            } catch (error) {
              console.error('Error accessing camera:', error);
              setErrorMessage('Camera access was denied. Please enable permissions in your browser settings.');
            }
          }
        }
      } catch (e: any) {
        console.error("Error during setup:", e);
        setErrorMessage('An error occurred during initialization.');
      } finally {
        setIsLoading(false); // All checks are done
      }
    });

    return () => {
        unsubscribe();
        stopCamera();
    };
  }, [sessionId, token, stopCamera]);


  const takePictureAndVerify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !currentUser || !sessionId) return;

    setIsVerifying(true);
    setStatusMessage('Verifying Identity...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setErrorMessage('Could not process video frame.');
      setIsVerifying(false);
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
          setVerificationResult('success');
          toast({ title: 'Attendance Marked!', description: `Confidence: ${(result.confidence * 100).toFixed(2)}%` });
        } catch (dbError: any) {
            console.error("Database update failed:", dbError);
            setErrorMessage('Could not save attendance record. Please contact your professor.');
            setVerificationResult('failure');
        }
      } else {
        setErrorMessage(result.reason || 'Verification failed. The faces did not match.');
        setVerificationResult('failure');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'An unexpected error occurred during verification.');
      setVerificationResult('failure');
    } finally {
        setIsVerifying(false);
    }
  }, [currentUser, sessionId, stopCamera, toast]);
  
  const renderContent = () => {
    if (isLoading) {
        return <div className="text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4">{statusMessage}</p></div>;
    }
    
    if (errorMessage) {
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold mt-4">Attendance Failed</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Try Again</Button>
          </div>
        );
    }

    if (verificationResult === 'success') {
       return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold mt-4">Attendance Marked!</h2>
            <p className="text-muted-foreground">You have been successfully marked present.</p>
          </div>
        );
    }
    
    if (verificationResult === 'failure') {
         return (
          <div className="text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold mt-4">Attendance Failed</h2>
            <p className="text-muted-foreground">{errorMessage || "An unknown error occurred."}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Try Again</Button>
          </div>
        );
    }
    
    // Default camera view
    return (
        <div className="w-full text-center">
            <div className={`w-full max-w-sm aspect-square rounded-full bg-secondary mx-auto flex items-center justify-center overflow-hidden border-4 border-primary`}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            </div>
            <p className="mt-4 mb-4 text-muted-foreground text-sm">Position your face in the frame and take a picture to verify.</p>
            <Button onClick={takePictureAndVerify} size="lg" disabled={isVerifying}>
                {isVerifying ? <Loader2 className="mr-2 animate-spin"/> : <Camera className="mr-2"/>}
                {isVerifying ? 'Verifying...' : 'Verify My Face'}
            </Button>
        </div>
    );
  };
  
  const progressValue = verificationResult === 'success' ? 100 : (isVerifying ? 75 : (!isLoading && !errorMessage ? 50 : 25));

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
          <Progress value={progressValue} className="w-full h-2 rounded-b-lg" />
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
