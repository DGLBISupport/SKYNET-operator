
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
    onDetected: (value: string) => void;
    onClose: () => void;
    active: boolean;
    selectedDeviceId?: string | null;
    embedded?: boolean;
    containerId?: string;
}

export default function BarcodeScanner({ onDetected, onClose, active, selectedDeviceId, embedded = false, containerId = 'scanner-reader-container' }: BarcodeScannerProps) {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const lastDetectedRef = useRef<string>('');
    const lastDetectedTimeRef = useRef<number>(0);

    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanMode, setScanMode] = useState<'linear' | 'square' | 'full'>('linear');
    const [detected, setDetected] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [btDevices, setBtDevices] = useState<any[]>([]);
    const [hidDevices, setHidDevices] = useState<any[]>([]);
    const [scannerActivity, setScannerActivity] = useState(false);
    const [btSupported, setBtSupported] = useState(false);
    const [hidSupported, setHidSupported] = useState(false);
    const onDetectedRef = useRef<((value: string) => void) | null>(null);

    useEffect(() => {
        onDetectedRef.current = onDetected;
    }, [onDetected]);

    useEffect(() => {
        setBtSupported(typeof (navigator as any).bluetooth !== 'undefined');
        setHidSupported(typeof (navigator as any).hid !== 'undefined');
    }, []);

    const detectBluetoothDevices = async () => {
        try {
            if ((navigator as any).bluetooth && (navigator as any).bluetooth.getDevices) {
                const devices = await (navigator as any).bluetooth.getDevices();
                setBtDevices(devices.map((d: any) => ({ id: d.id, name: d.name || 'Unknown', connected: !!(d.gatt && d.gatt.connected) })));
            } else if ((navigator as any).bluetooth && (navigator as any).bluetooth.requestDevice) {
                // Fallback: ask user to pick a device (prompts a chooser)
                const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true });
                setBtDevices(prev => [{ id: device.id, name: device.name || 'Unknown', connected: !!(device.gatt && device.gatt.connected) }, ...prev]);
            } else {
                setError('Web Bluetooth is not available in this browser.');
            }
        } catch (err: any) {
            console.error('Bluetooth detect error:', err);
            setError('Bluetooth detection failed. ' + (err?.message || ''));
        }
    };

    const detectHidDevices = async () => {
        try {
            if ((navigator as any).hid && (navigator as any).hid.getDevices) {
                const devices = await (navigator as any).hid.getDevices();
                setHidDevices(devices.map((d: any) => ({ productName: d.productName, vendorId: d.vendorId, productId: d.productId })));
            } else {
                setError('WebHID is not available in this browser.');
            }
        } catch (err: any) {
            console.error('HID detect error:', err);
            setError('HID detection failed. ' + (err?.message || ''));
        }
    };

    // Simple keyboard-based scanner activity detector: many Bluetooth scanners emulate a keyboard
    useEffect(() => {
        let buffer = '';
        let lastTs = 0;

        const onKey = (e: KeyboardEvent) => {
            const now = Date.now();
            if (now - lastTs > 120) buffer = '';
            lastTs = now;
            // Ignore modifier keys
            if (e.key.length !== 1) return;
            buffer += e.key;
            // If a rapid sequence of >5 chars seen, treat as scanner activity
            if (buffer.length >= 6) {
                setScannerActivity(true);
                setTimeout(() => setScannerActivity(false), 2500);
                buffer = '';
            }
        };

        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    useEffect(() => {
        let isCurrent = true;
        let scannerInstance: Html5Qrcode | null = null;

        const initAndStart = async () => {
            setError(null);
            setDetected(null);
            setReady(false);

            try {
                // Wait for the container to render in DOM
                let container = document.getElementById(containerId);
                let attempts = 0;
                while (!container && attempts < 20) {
                    if (!isCurrent) return;
                    await new Promise(r => setTimeout(r, 50));
                    container = document.getElementById(containerId);
                    attempts++;
                }

                if (!container || !isCurrent) return;

                const scanner = new Html5Qrcode(containerId, {
                    verbose: false,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.ITF,
                        Html5QrcodeSupportedFormats.CODE_93,
                        Html5QrcodeSupportedFormats.CODABAR
                    ],
                    useBarCodeDetectorIfSupported: true
                });

                scannerInstance = scanner;
                html5QrCodeRef.current = scanner;

                const cameraConfig = selectedDeviceId
                    ? selectedDeviceId
                    : { facingMode: 'environment' };

                // Determine active scan area (margins) based on scanMode
                let configQrbox: any = undefined;
                if (scanMode === 'linear') {
                    configQrbox = (width: number, height: number) => {
                        const finalWidth = Math.min(width - 20, 460);
                        return { width: finalWidth, height: 120 };
                    };
                } else if (scanMode === 'square') {
                    configQrbox = (width: number, height: number) => {
                        const size = Math.min(width - 20, height - 20, 260);
                        return { width: size, height: size };
                    };
                }

                await scanner.start(
                    cameraConfig,
                    {
                        fps: 15,
                        qrbox: configQrbox,
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
    }, [active, retryCount, selectedDeviceId, scanMode]);

    const handleRetry = () => {
        lastDetectedRef.current = '';
        setDetected(null);
        setRetryCount(prev => prev + 1);
    };

    if (!active) return null;

    if (embedded) {
        return (
            <div style={{
                position: 'relative',
                width: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                backgroundColor: '#ffffff'
            }}>
                {/* Visual Scanner Area */}
                <div style={{ position: 'relative', backgroundColor: '#000', aspectRatio: '4/3' }}>
                    {error ? (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            padding: '16px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '32px', color: '#ef4444', fontWeight: 'bold', marginBottom: '8px' }}>!</div>
                            <p style={{ color: '#ffffff', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-line', margin: 0 }}>
                                {error}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div
                                id={containerId}
                                style={{ width: '100%', height: '100%', overflow: 'hidden' }}
                            />
                            {!detected && ready && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none', zIndex: 5
                                }}>
                                    <div style={{
                                        width: '90%',
                                        height: '100px',
                                        border: '2px solid rgba(255,255,255,0.8)',
                                        borderRadius: '6px',
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            position: 'absolute', left: '4px', right: '4px', height: '2px',
                                            backgroundColor: '#16a34a',
                                            animation: 'scanline 1.8s ease-in-out infinite',
                                            boxShadow: '0 0 6px #16a34a'
                                        }} />
                                    </div>
                                </div>
                            )}
                            {!ready && !error && (
                                <div style={{
                                    position: 'absolute', inset: 0, backgroundColor: '#000',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    zIndex: 6
                                }}>
                                    <div style={{
                                        width: '28px', height: '28px', border: '3px solid #374151',
                                        borderTopColor: '#16a34a', borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>Starting camera...</p>
                                </div>
                            )}
                            {detected && (
                                <div style={{
                                    position: 'absolute', inset: 0, backgroundColor: 'rgba(22,163,74,0.15)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    zIndex: 7
                                }}>
                                    <div style={{
                                        backgroundColor: '#16a34a', borderRadius: '50%',
                                        width: '44px', height: '44px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(22,163,74,0.4)'
                                    }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </div>
                                    <p style={{ color: '#ffffff', fontWeight: '700', fontSize: '13px', margin: 0 }}>
                                        Detected: {detected}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
                {/* Embedded controls footer */}
                <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                        {detected ? 'Scan complete' : 'Align barcode in frame'}
                    </span>
                    {detected && (
                        <button onClick={handleRetry} style={{
                            backgroundColor: '#ffffff', border: '1px solid #d1d5db',
                            borderRadius: '4px', padding: '4px 10px',
                            fontSize: '11px', fontWeight: '500', cursor: 'pointer', color: '#374151'
                        }}>
                            Rescan
                        </button>
                    )}
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
                    #${containerId} video {
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
                    padding: '16px 20px', borderBottom: '1px solid #e5e7eb', marginBottom: '8px'
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

                {/* Scan Mode Switcher */}
                <div style={{
                    display: 'flex',
                    backgroundColor: '#f3f4f6',
                    padding: '4px',
                    margin: '0 20px 12px 20px',
                    borderRadius: '8px',
                    gap: '2px'
                }}>
                    {([
                        { id: 'linear', label: '1D Barcode' },
                        { id: 'square', label: 'QR Code' },
                        { id: 'full', label: 'Full Feed' }
                    ] as const).map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setScanMode(mode.id)}
                            style={{
                                flex: 1,
                                padding: '6px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                backgroundColor: scanMode === mode.id ? '#ffffff' : 'transparent',
                                color: scanMode === mode.id ? '#16a34a' : '#6b7280',
                                boxShadow: scanMode === mode.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {mode.label}
                        </button>
                    ))}
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
                                id={containerId}
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
                                        width: scanMode === 'linear' ? '90%' : scanMode === 'square' ? '250px' : '96%',
                                        maxWidth: scanMode === 'linear' ? '460px' : scanMode === 'square' ? '250px' : '96%',
                                        height: scanMode === 'linear' ? '120px' : scanMode === 'square' ? '250px' : '86%',
                                        border: '2px solid rgba(255,255,255,0.8)',
                                        borderRadius: '8px',
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                                        position: 'relative',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
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


                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 20px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                            {detected
                                ? 'Processing barcode...'
                                : ready
                                    ? 'Point camera at barcode — auto-detects instantly'
                                    : error ? 'Camera unavailable' : 'Initialising...'}
                        </p>

                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '12px', color: scannerActivity ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
                                {scannerActivity ? 'Scanner activity detected' : (btDevices.length > 0 || hidDevices.length > 0) ? 'Scanner connected' : 'No scanner detected'}
                            </div>

                            <button onClick={detectBluetoothDevices} style={{
                                backgroundColor: '#ffffff', border: '1px solid #d1d5db',
                                borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer'
                            }}>
                                Detect Bluetooth
                            </button>

                            <button onClick={detectHidDevices} style={{
                                backgroundColor: '#ffffff', border: '1px solid #d1d5db',
                                borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer'
                            }}>
                                Detect HID
                            </button>
                        </div>

                        {(btDevices.length > 0 || hidDevices.length > 0) && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#4b5563' }}>
                                {btDevices.length > 0 && (
                                    <div>Bluetooth: {btDevices.map(d => d.name).join(', ')}</div>
                                )}
                                {hidDevices.length > 0 && (
                                    <div>HID: {hidDevices.map(d => d.productName || `${d.vendorId}:${d.productId}`).join(', ')}</div>
                                )}
                            </div>
                        )}
                    </div>



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
                #${containerId} video {
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
