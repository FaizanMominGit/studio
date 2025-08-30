
'use client';

import { useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useRouter } from 'next/navigation';

const qrcodeRegionId = "html5qr-code-full-region";

export function QrScanner() {
    const router = useRouter();

    useEffect(() => {
        const html5QrCode = new Html5Qrcode(qrcodeRegionId);
        
        const qrCodeSuccessCallback = (decodedText: string) => {
            if (html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) {
                html5QrCode.stop().then(() => {
                    if (decodedText.includes('/attend?sessionId=')) {
                        router.push(decodedText);
                    } else {
                        console.warn("Scanned QR code is not a valid attendance link:", decodedText);
                    }
                }).catch(err => console.error("Failed to stop scanner:", err));
            }
        };

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            // Important: this is required to disable the file-based scanning
            // that is part of the default UI.
            supportedScanTypes: [] 
        };

        html5QrCode.start(
            { facingMode: "environment" }, // prefer back camera
            config,
            qrCodeSuccessCallback,
            undefined // Optional error callback
        ).catch(err => {
            console.error("Unable to start scanning.", err);
            // Fallback to any camera if environment isn't available
             html5QrCode.start(
                {}, // an empty constraint will pick any camera
                config,
                qrCodeSuccessCallback,
                undefined
             ).catch(err => console.error("Failed to start scanner with any camera", err));
        });

        // Cleanup function to stop the scanner on component unmount
        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(error => {
                    console.error("Failed to clear scanner on unmount:", error);
                });
            }
        };
    }, [router]);

    return <div id={qrcodeRegionId} className="w-full" />;
}
