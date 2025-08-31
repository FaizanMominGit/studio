
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

type ManualQrScannerProps = {
  onScanSuccess: (decodedText: string) => void;
};

export function ManualQrScanner({ onScanSuccess }: ManualQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Stop camera and animation frame loop
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  // Function to process video frames for QR codes
  const tick = useCallback(() => {
    if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;

      const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
      if (!canvas) return;

      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code?.data) {
        try {
          const url = new URL(code.data);
          if (url.origin === window.location.origin && url.pathname.includes('/attend') && url.searchParams.has('sessionId')) {
            // Forcefully stop the camera BEFORE navigating away.
            stopCamera();
            onScanSuccess(code.data);
            return; // Stop scanning
          }
        } catch (e) {
          // Scanned data is not a valid URL, ignore and continue scanning.
        }
      }
    }
    // Continue scanning
    requestRef.current = requestAnimationFrame(tick);
  }, [onScanSuccess, stopCamera]);


  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
        setIsLoading(true);
        setCameraError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        setIsLoading(false);
                        requestRef.current = requestAnimationFrame(tick);
                    };
                }
            } catch (error: any) {
                console.error("Camera Error:", error);
                if(error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                    setCameraError("Camera access denied. Please enable camera permissions in your browser settings.");
                } else {
                    setCameraError("Could not access the camera. It might be in use by another application.");
                }
                setIsLoading(false);
            }
        } else {
            setCameraError("Your browser does not support camera access. Please use a modern browser like Chrome or Firefox.");
            setIsLoading(false);
        }
    };
    
    startCamera();

    // Cleanup function to stop the camera when the component unmounts
    return () => {
      stopCamera();
    };
  }, [tick, stopCamera]);

  return (
    <div className="relative w-full aspect-square bg-secondary rounded-lg flex items-center justify-center overflow-hidden">
      {isLoading && <Loader2 className="w-12 h-12 text-primary animate-spin" />}
      
      {cameraError && !isLoading && (
        <Alert variant="destructive" className="m-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Camera Error</AlertTitle>
          <AlertDescription>{cameraError}</AlertDescription>
        </Alert>
      )}
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isLoading || cameraError ? 'hidden' : 'block'}`}
      />
      
      {/* Hidden canvas for processing video frames */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Visual scanning overlay */}
      {!isLoading && !cameraError && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-60 h-60 border-4 border-dashed border-primary/50 rounded-lg animate-pulse" />
        </div>
      )}
    </div>
  );
}
