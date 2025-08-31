
'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useRouter } from 'next/navigation';

const qrcodeRegionId = "html5qr-code-full-region";

type QrScannerProps = {
  onScanSuccess: () => void;
};

export function QrScanner({ onScanSuccess }: QrScannerProps) {
    const router = useRouter();
    // Use a ref to hold the Html5Qrcode instance to prevent re-initialization
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // Initialize the scanner only once
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(qrcodeRegionId);
        }
        const html5QrCode = html5QrCodeRef.current;
        
        const qrCodeSuccessCallback = (decodedText: string) => {
            // Ensure we don't process multiple scans
            if (html5QrCode.getState() !== Html5QrcodeScannerState.SCANNING) {
                return;
            }

            // Stop the scanner first
            html5QrCode.stop().then(() => {
                // Validate and navigate
                try {
                    const url = new URL(decodedText);
                    if (url.pathname.includes('/attend') && url.searchParams.has('sessionId')) {
                        onScanSuccess();
                        router.push(decodedText);
                    } else {
                        console.warn("Scanned QR code is not a valid attendance link:", decodedText);
                        // Optionally restart scanning or show an error
                    }
                } catch (e) {
                     console.warn("Scanned content is not a valid URL:", decodedText);
                }
            }).catch(err => {
                console.error("Failed to stop scanner:", err);
            });
        };

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [] // Disable file-based scanning
        };

        // Start scanning
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            undefined // Optional error callback
        ).catch(err => {
            console.error("Unable to start scanning with environment camera.", err);
            // Fallback to any camera if the back camera fails
            html5QrCode.start({}, config, qrCodeSuccessCallback, undefined)
                .catch(err => console.error("Failed to start scanner with any camera", err));
        });

        // Cleanup function to stop the scanner on component unmount
        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(error => {
                    // This can sometimes fail if the component unmounts too quickly, so we log instead of throwing
                    console.log("Cleanup failed to stop scanner, it might have already been stopped.", error);
                });
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, onScanSuccess]);

    return <div id={qrcodeRegionId} className="w-full" />;
}
