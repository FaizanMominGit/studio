
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CheckCircle, Loader2, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { enrollFace } from '@/ai/flows/enroll-face';

type EnrollmentStatus = 'idle' | 'checking_status' | 'needs_enrollment' | 'camera_loading' | 'camera_on' | 'picture_taken' | 'enrolling' | 'enrolled' | 'enrollment_failed' | 'no_camera';

type FaceEnrollmentProps = {
  onEnrollmentComplete?: (faceDataUri: string) => void;
  isPartOfRegistration?: boolean;
};

export function FaceEnrollment({ onEnrollmentComplete, isPartOfRegistration = false }: FaceEnrollmentProps) {
  const [status, setStatus] = useState<EnrollmentStatus>(isPartOfRegistration ? 'needs_enrollment' : 'checking_status');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const [enrollmentMessage, setEnrollmentMessage] = useState('');
  const [hasEnrolledFace, setHasEnrolledFace] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setStatus('camera_loading');
    setImageSrc(null);
    setEnrollmentMessage('');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus('camera_on');
      } catch (error) {
        console.error("Error accessing camera: ", error);
        setHasCameraPermission(false);
        setStatus('no_camera');
        toast({
          variant: "destructive",
          title: "Camera Error",
          description: "Could not access your camera. Please check your browser permissions.",
        });
      }
    } else {
      setHasCameraPermission(false);
      setStatus('no_camera');
    }
  }, [toast]);

  useEffect(() => {
    if (isPartOfRegistration) {
      if(status === 'needs_enrollment'){
         startCamera();
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUser({ uid: user.uid, ...userData });
          if (userData.faceDataUri) {
            setHasEnrolledFace(true);
            setStatus('enrolled');
            setImageSrc(userData.faceDataUri);
          } else {
            setStatus('needs_enrollment');
            startCamera();
          }
        } else {
          setStatus('enrollment_failed');
          setEnrollmentMessage('Could not find user profile.');
        }
      } else {
        setStatus('idle');
        setHasEnrolledFace(false);
      }
    });

    return () => {
        unsubscribe();
        stopCamera();
    }
  }, [isPartOfRegistration, startCamera, stopCamera, status]);


  const takePicture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(video.videoWidth, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/png');
        setImageSrc(dataUrl);
        setStatus('picture_taken');
        stopCamera();
      }
    }
  }, [stopCamera]);

  const handleEnrollment = async () => {
    if (!imageSrc) return;
    setStatus('enrolling');

    if (isPartOfRegistration && onEnrollmentComplete) {
        onEnrollmentComplete(imageSrc);
        return;
    }

    if (currentUser?.uid) {
        try {
            const result = await enrollFace({
                studentPhotoDataUri: imageSrc,
                studentId: currentUser.rollNo || currentUser.uid,
            });

            if (!result.success) {
                throw new Error(result.message || "AI verification failed. Please try again with a clear photo.");
            }

            await updateDoc(doc(db, 'users', currentUser.uid), {
              faceDataUri: imageSrc
            });
            toast({
                title: "Re-enrollment Successful!",
                description: "Your new face data has been saved.",
            });
            setStatus('enrolled');
            setHasEnrolledFace(true);

        } catch (error: any) {
            console.error("Re-enrollment failed:", error);
            setStatus('enrollment_failed');
            setEnrollmentMessage(error.message || "Could not save your new face data.");
            toast({
                variant: "destructive",
                title: "Re-enrollment Failed",
                description: error.message || "Could not save your new face data.",
            });
        }
    }
  };

  const resetForReEnrollment = () => {
    setImageSrc(null);
    setHasEnrolledFace(false);
    setStatus('needs_enrollment');
    setEnrollmentMessage('');
    startCamera();
  };

  if (status === 'checking_status') {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Face Biometric Enrollment</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Checking enrollment status...</p>
            </CardContent>
        </Card>
    )
  }

  if (status === 'enrolled' && !isPartOfRegistration) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-6 w-6 text-green-500" />
                    Biometric Enrollment Complete
                </CardTitle>
                <CardDescription>Your face is registered for attendance verification.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="default" className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 !text-green-600" />
                    <AlertTitle className="text-green-800">You're all set!</AlertTitle>
                    <AlertDescription className="text-green-700">
                        You can now use face verification to mark your attendance.
                    </AlertDescription>
                </Alert>
                {imageSrc && (
                    <div className="mt-4 text-center">
                        <img src={imageSrc} alt="Enrolled face" className="rounded-lg mx-auto border w-40 h-40 object-cover" />
                        <p className="text-xs text-muted-foreground mt-2">Your registered image.</p>
                    </div>
                )}
            </CardContent>
             <CardFooter>
                <Button variant="outline" onClick={resetForReEnrollment}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-enroll
                </Button>
            </CardFooter>
        </Card>
    );
  }

  const Wrapper = isPartOfRegistration ? 'div' : Card;
  const wrapperProps = isPartOfRegistration ? {} : { className: "w-full" };

  return (
    <Wrapper {...wrapperProps}>
      {!isPartOfRegistration && (
        <CardHeader>
          <CardTitle>Face Biometric Enrollment</CardTitle>
          <CardDescription>
            Register your face to use our secure attendance system.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex flex-col items-center justify-center">
        <div className="w-64 h-64 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border">
           <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${imageSrc || status !== 'camera_on' ? 'hidden' : 'block'}`} />
           {imageSrc && <img src={imageSrc} alt="Student snapshot" className="w-full h-full object-cover" />}
           {(status === 'camera_loading' || status === 'enrolling' || status === 'idle' || status === 'checking_status') && <Loader2 className="w-16 h-16 text-muted-foreground animate-spin" />}
           {(status === 'no_camera' || status === 'enrollment_failed') && <AlertTriangle className="w-16 h-16 text-destructive" />}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {hasCameraPermission === false && status === 'no_camera' && (
             <Alert variant={'destructive'} className="mt-4">
                <AlertTitle>{'Camera Not Available'}</AlertTitle>
                <AlertDescription>Please check your camera permissions and try again.</AlertDescription>
            </Alert>
        )}
        {enrollmentMessage && (status === 'enrollment_failed') && (
             <Alert variant={'destructive'} className="mt-4">
                <AlertTitle>{'Enrollment Failed'}</AlertTitle>
                <AlertDescription>{enrollmentMessage}</AlertDescription>
            </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center gap-2">
        {status === 'camera_on' && <Button onClick={takePicture}>Take Picture</Button>}
        {(status === 'picture_taken' || status === 'enrollment_failed') && (
          <div className="flex justify-center gap-2">
            <Button onClick={handleEnrollment} disabled={status === 'enrolling'}>
             {status === 'enrolling' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
             Enroll This Picture
            </Button>
            <Button variant="outline" onClick={startCamera} disabled={status === 'enrolling'}>Retake</Button>
          </div>
        )}
         {status === 'enrolling' && (
          <Button disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enrolling...
          </Button>
        )}
      </CardFooter>
    </Wrapper>
  );
}
