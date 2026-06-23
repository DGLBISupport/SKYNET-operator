'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
    onDetected: (value: string) => void;
    onClose: () => void;
    active: boolean;
}

export default function BarcodeScanner({ onDetected, onClose, active }: BarcodeScannerProps) {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastDetectedRef = useRef<string>('');
    const lastDetectedTimeRef = useRef<number>(0);

    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detected, setDetected] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [fileError, setFileError] = useState<string | null>(null);
    const [decodingFile, setDecodingFile] = useState(false);

    const onDetectedRef = useRef<((value: string) => void) | null>(null);

    useEffect(() => {
        onDetectedRef.current = onDetected;
    }, [onDetected]);

    useEffect(() => {
        let isCurrent = true;
        let scannerInstance: Html5Qrcode | null = null;

        const initAndStart = async () => {
            setError(null);
            setDetected(null);
            setReady(false);
            setFileError(null);

            try {
                // Wait for the container to render in DOM
                let container = document.getElementById('scanner-reader-container');
                let attempts = 0;
                while (!container && attempts < 20) {
                    if (!isCurrent) return;
                    await new Promise(r => setTimeout(r, 50));
                    container = document.getElementById('scanner-reader-container');
                    attempts++;
                }

                if (!container || !isCurrent) return;

                const scanner = new Html5Qrcode('scanner-reader-container', {
                    verbose: false,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.QR_CODE
                    ],
                    useBarCodeDetectorIfSupported: true
                });

                scannerInstance = scanner;
                html5QrCodeRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 15,
                        qrbox: (width, height) => {
                            // Use full width of viewfinder to prevent clipping barcode quiet zones
                            const finalHeight = Math.max(50, Math.min(height - 40, 140));
                            return { width: width, height: finalHeight };
                        },
                        aspectRatio: 1.777778,
                        disableFlip: true,
                        videoConstraints: {
                            facingMode: 'environment',
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                            // Request continuous autofocus for barcodes
                            ...({ focusMode: { ideal: 'continuous' } } as any)
                        }
                    },
                    (decodedText) => {
                        // Filter out printer control codes or small warehouse barcodes (like ^!Z^V)
                        const isControlCode = decodedText.includes('^') || decodedText.includes('!') || decodedText.length < 6;
                        if (isControlCode) {
                            return; // ignore and keep scanning for the real tracking number
                        }

                        const now = Date.now();
                        // Debounce same barcode within 2 seconds
                        if (decodedText !== lastDetectedRef.current || now - lastDetectedTimeRef.current > 2000) {
                            lastDetectedRef.current = decodedText;
                            lastDetectedTimeRef.current = now;
                            setDetected(decodedText);

                            // Stop scanner asynchronously
                            if (scanner.isScanning) {
                                scanner.stop().then(() => {
                                    scanner.clear();
                                }).catch(e => console.error("Stop error on scan:", e));
                            }

                            // Auto-submit after short delay
                            setTimeout(() => {
                                if (onDetectedRef.current) {
                                    onDetectedRef.current(decodedText);
                                }
                            }, 600);
                        }
                    },
                    () => {
                        // ignore frame-by-frame scan failures (normal behavior when no code in view)
                    }
                );

                if (!isCurrent) {
                    if (scanner.isScanning) {
                        await scanner.stop();
                        scanner.clear();
                    }
                    return;
                }

                setReady(true);
            } catch (err: any) {
                if (!isCurrent) return;
                console.error('Camera scan start failed:', err);
                
                let userFriendlyError = 'Could not start camera. Please verify permission or use a different browser.';
                if (typeof err === 'string') {
                    if (err.includes('NotAllowedError') || err.includes('permission')) {
                        userFriendlyError = 'Camera access denied. Please allow camera permission and try again.';
                    } else if (err.includes('NotFoundError')) {
                        userFriendlyError = 'No camera found on this device.';
                    } else {
                        userFriendlyError = err;
                    }
                } else if (err instanceof Error) {
                    if (err.name === 'NotAllowedError') {
                        userFriendlyError = 'Camera access denied. Please allow camera permission and try again.';
                    } else if (err.name === 'NotFoundError') {
                        userFriendlyError = 'No camera found on this device.';
                    } else {
                        userFriendlyError = err.message;
                    }
                }
                
                setError(userFriendlyError);
            }
        };

        if (active) {
            initAndStart();
        }

        return () => {
            isCurrent = false;
            if (scannerInstance) {
                const scanner = scannerInstance;
                if (scanner.isScanning) {
                    scanner.stop().then(() => {
                        scanner.clear();
                    }).catch(err => {
                        console.error('Cleanup stop error:', err);
                    });
                }
            }
        };
    }, [active, retryCount]);

    const handleRetry = () => {
        lastDetectedRef.current = '';
        setDetected(null);
        setFileError(null);
        setRetryCount(prev => prev + 1);
    };

    const handleTriggerFileUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileError(null);
        setDecodingFile(true);

        try {
            // Stop active camera scan
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            }
            setReady(false);

            const scanner = html5QrCodeRef.current || new Html5Qrcode('scanner-reader-container');
            const decodedText = await scanner.scanFile(file, false);

            const isControlCode = decodedText.includes('^') || decodedText.includes('!') || decodedText.length < 6;
            if (isControlCode) {
                throw new Error("Secondary warehouse barcode detected. Please upload an image containing only the primary tracking number.");
            }

            setDetected(decodedText);
            setTimeout(() => {
                if (onDetectedRef.current) {
                    onDetectedRef.current(decodedText);
                }
            }, 600);

        } catch (err: any) {
            console.error('File scan failed:', err);
            let msg = 'No barcode detected in the selected image. Please make sure the barcode is clear and flat.';
            if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === 'string') {
                msg = err;
            }
            setFileError(msg);
            
            // Restart camera
            setRetryCount(prev => prev + 1);
        } finally {
            setDecodingFile(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset input
            }
        }
    };

    if (!active) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                width: '100%', maxWidth: '520px',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid #e5e7eb'
                }}>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>
                            Camera Barcode Scanner
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            Powered by HTML5 Barcode Reader (Cross-Browser)
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px',
                            width: '32px', height: '32px', cursor: 'pointer',
                            fontSize: '18px', color: '#6b7280',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >✕</button>
                </div>

                {/* Video / Error area */}
                <div style={{ position: 'relative', backgroundColor: '#000', aspectRatio: '4/3' }}>
                    {error ? (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            padding: '24px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '40px', color: '#ef4444', fontWeight: 'bold', marginBottom: '12px' }}>!</div>
                            <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                                {error}
                            </p>
                            <button
                                onClick={onClose}
                                style={{
                                    marginTop: '16px', backgroundColor: '#16a34a', color: '#fff',
                                    border: 'none', borderRadius: '6px', padding: '10px 20px',
                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                }}
                            >
                                Close & type manually
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* html5-qrcode reader element */}
                            <div
                                id="scanner-reader-container"
                                style={{ width: '100%', height: '100%', overflow: 'hidden' }}
                            />

                            {/* Scanning frame overlay */}
                            {!detected && ready && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none', zIndex: 5
                                }}>
                                    <div style={{
                                        width: '90%',
                                        maxWidth: '460px',
                                        height: '140px',
                                        border: '2px solid rgba(255,255,255,0.8)',
                                        borderRadius: '8px',
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                                        position: 'relative'
                                    }}>
                                        {/* Corner markers */}
                                        {[
                                            { top: -2, left: -2, borderTop: '3px solid #16a34a', borderLeft: '3px solid #16a34a' },
                                            { top: -2, right: -2, borderTop: '3px solid #16a34a', borderRight: '3px solid #16a34a' },
                                            { bottom: -2, left: -2, borderBottom: '3px solid #16a34a', borderLeft: '3px solid #16a34a' },
                                            { bottom: -2, right: -2, borderBottom: '3px solid #16a34a', borderRight: '3px solid #16a34a' }
                                        ].map((style, i) => (
                                            <div key={i} style={{
                                                position: 'absolute', width: '18px', height: '18px',
                                                borderRadius: '2px', ...style
                                            }} />
                                        ))}

                                        {/* Animated scan line */}
                                        <div style={{
                                            position: 'absolute', left: '4px', right: '4px', height: '2px',
                                            backgroundColor: '#16a34a',
                                            animation: 'scanline 1.8s ease-in-out infinite',
                                            boxShadow: '0 0 6px #16a34a'
                                        }} />
                                    </div>
                                </div>
                            )}

                            {/* Loading overlay */}
                            {!ready && !error && (
                                <div style={{
                                    position: 'absolute', inset: 0, backgroundColor: '#000',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    zIndex: 6
                                }}>
                                    <div style={{
                                        width: '36px', height: '36px', border: '3px solid #374151',
                                        borderTopColor: '#16a34a', borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    <p style={{ color: '#9ca3af', fontSize: '13px' }}>Starting camera...</p>
                                </div>
                            )}

                            {/* Detected overlay */}
                            {detected && (
                                <div style={{
                                    position: 'absolute', inset: 0, backgroundColor: 'rgba(22,163,74,0.15)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    zIndex: 7
                                }}>
                                    <div style={{
                                        backgroundColor: '#16a34a', borderRadius: '50%',
                                        width: '56px', height: '56px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 16px rgba(22,163,74,0.5)'
                                    }}>
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </div>
                                    <p style={{ color: '#ffffff', fontWeight: '700', fontSize: '15px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                        Barcode detected!
                                    </p>
                                    <p style={{ color: '#d1fae5', fontSize: '13px', fontWeight: '600', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                        {detected}
                                    </p>
                                </div>
                            )}

                            {/* File decoding or error overlay */}
                            {(decodingFile || fileError) && (
                                <div style={{
                                    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', padding: '24px',
                                    textAlign: 'center', zIndex: 8
                                }}>
                                    {decodingFile ? (
                                        <>
                                            <div style={{
                                                width: '36px', height: '36px', border: '3px solid #374151',
                                                borderTopColor: '#16a34a', borderRadius: '50%',
                                                animation: 'spin 0.8s linear infinite', marginBottom: '12px'
                                            }} />
                                            <p style={{ color: '#ffffff', fontSize: '13px', margin: 0 }}>Analyzing barcode image...</p>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>Error</div>
                                            <p style={{ color: '#ffffff', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                                                {fileError}
                                            </p>
                                            <button
                                                onClick={() => setFileError(null)}
                                                style={{
                                                    backgroundColor: '#16a34a', color: '#fff',
                                                    border: 'none', borderRadius: '6px', padding: '8px 16px',
                                                    fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                                                }}
                                            >
                                                Try scanning again
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 20px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                        {detected
                            ? 'Processing barcode...'
                            : ready
                                ? 'Point camera at barcode — auto-detects instantly'
                                : error ? 'Camera unavailable' : 'Initialising...'}
                    </p>
                    
                    {!detected && (
                        <div>
                            <button
                                onClick={handleTriggerFileUpload}
                                style={{
                                    backgroundColor: '#ffffff', border: '1px solid #d1d5db',
                                    borderRadius: '6px', padding: '6px 14px',
                                    fontSize: '12px', fontWeight: '500', cursor: 'pointer', color: '#374151',
                                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                Upload Image
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    )}

                    {detected && (
                        <button onClick={handleRetry} style={{
                            backgroundColor: '#f3f4f6', border: '1px solid #d1d5db',
                            borderRadius: '6px', padding: '6px 14px',
                            fontSize: '12px', fontWeight: '500', cursor: 'pointer', color: '#374151'
                        }}>
                            Scan again
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes scanline {
                    0%   { top: 8px; }
                    50%  { top: calc(100% - 10px); }
                    100% { top: 8px; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                #scanner-reader-container video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                }
                #qr-shaded-region {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}
