
'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useRouter } from 'next/navigation';

const qrcodeRegionId = "html5qr-code-full-region";

type QrScannerProps = {
  onScanSuccess: () => void;
};

export function QrScanner({ onScanSuccess }: QrScannerProps) {
    const router = useRouter();
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // Initialize the scanner
        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode(qrcodeRegionId);
        }
        const html5QrCode = scannerRef.current;
        let isScanning = true;

        const qrCodeSuccessCallback = (decodedText: string) => {
            if (!isScanning) return;
            isScanning = false; // Prevent multiple triggers

            html5QrCode.stop().then(() => {
                try {
                    const url = new URL(decodedText);
                    // Basic validation for the URL
                    if (url.pathname.includes('/attend') && url.searchParams.has('sessionId')) {
                        onScanSuccess(); // Close the dialog
                        router.push(decodedText); // Navigate
                    } else {
                        console.warn("Scanned QR code is not a valid attendance link:", decodedText);
                        // Optionally restart or show an error
                    }
                } catch (e) {
                     console.error("Scanned content is not a valid URL:", decodedText, e);
                }
            }).catch(err => {
                console.error("Failed to stop scanner after success:", err);
            });
        };

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [] // Disable file-based scanning
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            undefined // Optional error callback
        ).catch(err => {
            console.error("Unable to start scanning.", err);
        });

        // Cleanup function to stop the scanner on component unmount
        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(error => {
                    console.log("Cleanup failed to stop scanner.", error);
                });
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, onScanSuccess]);

    return <div id={qrcodeRegionId} className="w-full" />;
}
