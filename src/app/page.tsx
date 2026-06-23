'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AllocationResponse, SkyNetParcelData } from '@/types';
import BarcodeScanner from './components/BarcodeScanner';
import { Html5Qrcode } from 'html5-qrcode';

export default function WorkstationDashboard() {
    const [activeTab, setActiveTab] = useState<'scan' | 'verify' | 'config' | 'reports'>('scan');
    const [scannedToday, setScannedToday] = useState<number>(1);
    const [timeString, setTimeString] = useState<string>('17:00:41');

    // Camera scanner visibility
    const [scanCameraOpen, setScanCameraOpen] = useState(false);
    const [verifyCameraOpen, setVerifyCameraOpen] = useState(false);

    // Image decoder dashboard states
    const dashboardFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadImageSrc, setUploadImageSrc] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadScanError, setUploadScanError] = useState<string | null>(null);
    const [uploadScannedCode, setUploadScannedCode] = useState<string | null>(null);
    const [uploadScannedPartner, setUploadScannedPartner] = useState<string | null>(null);
    const [uploadScanningVisual, setUploadScanningVisual] = useState(false);

    // Tab 1: Scan & Allocate
    const [barcodeInput, setBarcodeInput] = useState('');
    const [currentScan, setCurrentScan] = useState<AllocationResponse | null>({
        success: true,
        parcel: {
            trackingNumber: '710251521582',
            recipientName: 'A.L.M Fahim Fahim',
            province: 'Eastern',
            district: 'Eastern',
            city: 'Kattankudy',
            weight: 0.65,
            value: 'USD 19.15',
            account: 'HK24018',
            apiSync: 'Synced'
        },
        assignedZone: 'Zone C',
        assignedPartner: 'PickMe'
    });
    const [status, setStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('SUCCESS');
    const [errorMessage, setErrorMessage] = useState('');
    const [history, setHistory] = useState<AllocationResponse[]>([
        {
            success: true,
            parcel: {
                trackingNumber: '710251521582',
                recipientName: 'A.L.M Fahim Fahim',
                province: 'Eastern',
                district: 'Eastern',
                city: 'Kattankudy',
                weight: 0.65,
                value: 'USD 19.15',
                account: 'HK24018',
                apiSync: 'Synced'
            },
            assignedZone: 'Zone C',
            assignedPartner: 'PickMe'
        }
    ]);

    // Tab 2: Dispatch Verify
    const [selectedBin, setSelectedBin] = useState<'PickMe' | 'Domex' | 'Pronto' | null>(null);
    const [verifyBarcodeInput, setVerifyBarcodeInput] = useState('');
    const [verifyScan, setVerifyScan] = useState<AllocationResponse | null>(null);
    const [verifyStatus, setVerifyStatus] = useState<'READY' | 'FETCHING' | 'MATCH' | 'MISMATCH' | 'ERROR'>('READY');
    const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
    const [binCounts, setBinCounts] = useState({ PickMe: 7, Domex: 3, Pronto: 2 });
    const [verifiedCount, setVerifiedCount] = useState(0);
    const [mismatchCount, setMismatchCount] = useState(0);
    const [pendingDispatch, setPendingDispatch] = useState(12);
    const [verifyHistory, setVerifyHistory] = useState<Array<{
        trackingNumber: string;
        bin: string;
        assignedPartner: string;
        isMatch: boolean;
        timestamp: string;
        recipientName?: string;
        city?: string;
    }>>([]);

    // Tab 3: Config
    const [config, setConfig] = useState({
        zoneMappings: [
            { province: 'Eastern', district: 'Batticaloa', city: 'Kattankudy', zoneName: 'Zone C' },
            { province: 'Western', district: 'Colombo', city: 'Colombo 03', zoneName: 'Zone A' },
            { province: 'Southern', district: 'Galle', city: 'Hikkaduwa', zoneName: 'Zone B' },
            { province: 'Central', district: 'Kandy', city: 'Peradeniya', zoneName: 'Zone D' }
        ],
        allocationRules: {
            'Zone C': [
                { partnerCode: 'PickMe', weightPercentage: 50 },
                { partnerCode: 'Domex', weightPercentage: 30 },
                { partnerCode: 'Pronto', weightPercentage: 20 }
            ],
            'Zone A': [
                { partnerCode: 'PickMe', weightPercentage: 40 },
                { partnerCode: 'Domex', weightPercentage: 40 },
                { partnerCode: 'Pronto', weightPercentage: 20 }
            ],
            'Default-Zone': [
                { partnerCode: 'Domex', weightPercentage: 100 }
            ]
        }
    });
    const [newProvince, setNewProvince] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newZone, setNewZone] = useState('');

    const scanInputRef = useRef<HTMLInputElement>(null);
    const verifyInputRef = useRef<HTMLInputElement>(null);

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const secs = String(now.getSeconds()).padStart(2, '0');
            setTimeString(`${hrs}:${mins}:${secs}`);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Focus input
    useEffect(() => {
        if (activeTab === 'scan') scanInputRef.current?.focus();
        else if (activeTab === 'verify') verifyInputRef.current?.focus();
    }, [activeTab, status, verifyStatus]);

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = barcodeInput.trim();
        if (!barcode) return;
        setStatus('FETCHING');
        setBarcodeInput('');
        setErrorMessage('');
        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber: barcode }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success) {
                setCurrentScan(data);
                setHistory((prev) => [data, ...prev].slice(0, 10));
                setScannedToday((prev) => prev + 1);
                setStatus('SUCCESS');
            } else {
                throw new Error(data.error || 'Unknown allocation failure');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'API connection failure');
            setStatus('ERROR');
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = verifyBarcodeInput.trim();
        if (!barcode || !selectedBin) return;
        setVerifyStatus('FETCHING');
        setVerifyBarcodeInput('');
        setVerifyErrorMessage('');
        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber: barcode }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success) {
                setVerifyScan(data);
                const assigned = data.assignedPartner || 'Unknown';
                const isMatch = assigned.toLowerCase() === selectedBin.toLowerCase();
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                if (isMatch) {
                    setVerifyStatus('MATCH');
                    setVerifiedCount((prev) => prev + 1);
                    setPendingDispatch((prev) => Math.max(0, prev - 1));
                    setBinCounts((prev) => ({ ...prev, [selectedBin]: Math.max(0, prev[selectedBin] - 1) }));
                } else {
                    setVerifyStatus('MISMATCH');
                    setMismatchCount((prev) => prev + 1);
                }
                setVerifyHistory((prev) => [{
                    trackingNumber: barcode, bin: selectedBin, assignedPartner: assigned,
                    isMatch, timestamp: timeStr, recipientName: data.parcel?.recipientName, city: data.parcel?.city
                }, ...prev]);
            } else {
                throw new Error(data.error || 'Invalid parcel tracking number');
            }
        } catch (err: any) {
            setVerifyErrorMessage(err.message || 'Verification search exception');
            setVerifyStatus('ERROR');
        }
    };

    const triggerDemoScan = () => {
        const barcodes = ['710251521582', '502194821034', '301982741982', '804918274912'];
        const randomBarcode = barcodes[Math.floor(Math.random() * barcodes.length)];
        setBarcodeInput(randomBarcode);
        setTimeout(() => {
            const form = scanInputRef.current?.closest('form');
            form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 100);
    };

    const triggerVerifyDemoScan = () => {
        if (!selectedBin) return;
        let targetBarcode = '710251521582';
        if (selectedBin === 'Domex') targetBarcode = '502194821034';
        else if (selectedBin === 'Pronto') {
            const choices = ['301982741982', '710251521582'];
            targetBarcode = choices[Math.floor(Math.random() * choices.length)];
        } else {
            const choices = ['710251521582', '502194821034'];
            targetBarcode = choices[Math.floor(Math.random() * choices.length)];
        }
        setVerifyBarcodeInput(targetBarcode);
    };

    const handleAddZoneMapping = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProvince || !newCity || !newZone) return;
        setConfig((prev) => ({
            ...prev,
            zoneMappings: [...prev.zoneMappings, { province: newProvince, district: newProvince, city: newCity, zoneName: newZone }]
        }));
        setNewProvince(''); setNewCity(''); setNewZone('');
    };

    const handleConfirmDispatch = () => {
        alert(`Parcel ${currentScan?.parcel?.trackingNumber} confirmed & dispatched!`);
        setCurrentScan(null);
        setStatus('READY');
    };

    const handleClearScan = () => { setCurrentScan(null); setStatus('READY'); };

    const handleChangeLMD = () => {
        if (!currentScan) return;
        const cur = currentScan.assignedPartner;
        const next = cur === 'PickMe' ? 'Domex' : cur === 'Domex' ? 'Pronto' : 'PickMe';
        setCurrentScan({ ...currentScan, assignedPartner: next });
    };

    const handleClearUploadScanner = () => {
        setUploadImageSrc(null);
        setUploadScannedCode(null);
        setUploadScannedPartner(null);
        setUploadScanError(null);
    };

    const handleDashboardFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadScanError(null);
        setUploadScannedCode(null);
        setUploadScannedPartner(null);
        setUploadScanningVisual(true);
        setIsUploadingImage(true);

        const previewUrl = URL.createObjectURL(file);
        setUploadImageSrc(previewUrl);

        try {
            const scanner = new Html5Qrcode('dashboard-dummy-decoder');
            const decodedText = await scanner.scanFile(file, false);

            const isControlCode = decodedText.includes('^') || decodedText.includes('!') || decodedText.length < 6;
            if (isControlCode) {
                throw new Error("Secondary warehouse barcode detected. Please upload an image with only the primary tracking number.");
            }

            setUploadScannedCode(decodedText);

            // Wait 1.2s to show scanning animation
            await new Promise(r => setTimeout(r, 1200));

            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber: decodedText.trim() }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success) {
                setUploadScannedPartner(data.assignedPartner || 'Unknown');
                setCurrentScan(data);
                setHistory((prev) => [data, ...prev].slice(0, 10));
                setScannedToday((prev) => prev + 1);
            } else {
                throw new Error(data.error || 'Allocation failed');
            }

        } catch (err: any) {
            console.error('Dashboard file scan error:', err);
            let msg = 'No barcode detected. Please ensure the image is flat, well-lit, and clear.';
            if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === 'string') {
                msg = err;
            }
            setUploadScanError(msg);
        } finally {
            setIsUploadingImage(false);
            setUploadScanningVisual(false);
            if (e.target) {
                e.target.value = '';
            }
        }
    };

    // ── SHARED STYLES ────────────────────────────────────────────────────────
    const card: React.CSSProperties = {
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    };

    const label: React.CSSProperties = {
        fontSize: '11px',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: '600',
        marginBottom: '14px'
    };

    const inputStyle: React.CSSProperties = {
        backgroundColor: '#f9fafb',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        padding: '9px 12px',
        color: '#111827',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
    };

    const btnPrimary: React.CSSProperties = {
        backgroundColor: '#16a34a',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
    };

    const btnSecondary: React.CSSProperties = {
        backgroundColor: '#ffffff',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
    };

    const btnDanger: React.CSSProperties = {
        backgroundColor: '#ffffff',
        color: '#dc2626',
        border: '1px solid #fca5a5',
        borderRadius: '6px',
        padding: '9px 18px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
    };

    const rowItem = (label2: string, value: React.ReactNode, last = false): React.ReactNode => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: last ? '0' : '10px', marginBottom: last ? '0' : '10px', borderBottom: last ? 'none' : '1px solid #f3f4f6', fontSize: '14px' }}>
            <span style={{ color: '#6b7280' }}>{label2}</span>
            <span style={{ fontWeight: '600', color: '#111827' }}>{value}</span>
        </div>
    );

    const parcelDetailsGrid = (parcel: SkyNetParcelData) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 20px', fontSize: '14px' }}>
            {[
                { icon: '🔍', lbl: 'Tracking no.', val: parcel.trackingNumber },
                { icon: '👤', lbl: 'Recipient', val: parcel.recipientName },
                { icon: '📍', lbl: 'City', val: parcel.city },
                { icon: '🗺', lbl: 'District', val: parcel.district },
                { icon: '⚖', lbl: 'Weight', val: `${parcel.weight} kg` },
                { icon: '💲', lbl: 'Value', val: parcel.value || 'USD 10.00' },
                { icon: '🏢', lbl: 'Account', val: parcel.account || 'HK24001' },
                { icon: '🔄', lbl: 'API sync', val: <span style={{ color: '#16a34a' }}>✓ {parcel.apiSync || 'Synced'}</span> },
            ].map(({ icon, lbl, val }) => (
                <div key={lbl}>
                    <div style={{ color: '#6b7280', marginBottom: '4px', fontSize: '13px' }}>{icon} {lbl}</div>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{val}</div>
                </div>
            ))}
        </div>
    );

    return (
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: '1080px', margin: '0 auto' }}>

                {/* ── HEADER ── */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', fontSize: '16px', color: '#111827' }}>
                            {activeTab === 'verify' ? 'SKYNET — Dispatch Verification' : 'SKYNET — Parcel Allocation System'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                            {activeTab === 'verify' ? 'Scanner ready' : 'Scanner connected'}
                        </span>
                        <span style={{ color: '#374151', fontWeight: '600', borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>{timeString}</span>
                    </div>
                </header>

                {/* ── TABS ── */}
                <nav style={{ display: 'flex', gap: '4px', marginBottom: '20px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    {(['scan', 'verify', 'config', 'reports'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                padding: '9px 14px',
                                backgroundColor: activeTab === tab ? '#f3f4f6' : 'transparent',
                                color: activeTab === tab ? '#111827' : '#6b7280',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: activeTab === tab ? '600' : '500',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {tab === 'scan' ? 'Scan & allocate' : tab === 'verify' ? 'Dispatch verify' : tab === 'config' ? 'Zone config' : 'Reports'}
                        </button>
                    ))}
                </nav>

                {/* ═══════════════════════════════════════════════════════
                    TAB 1 — SCAN & ALLOCATE
                ═══════════════════════════════════════════════════════ */}
                {activeTab === 'scan' && (
                    <div>
                        {/* Alert Banner */}
                        {status === 'SUCCESS' && currentScan?.assignedPartner && (
                            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
                                ✓ Allocated to {currentScan.assignedPartner} — {currentScan.assignedZone}
                            </div>
                        )}
                        {status === 'ERROR' && (
                            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
                                ❌ Scan Failed: {errorMessage}
                            </div>
                        )}

                        {/* Top Row: Input + Partner */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            {/* Left Column: Input and Image Scanner */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Barcode Input Card */}
                            <div style={card}>
                                <div style={label}>Barcode Input</div>
                                <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        placeholder="Scan or type barcode..."
                                        disabled={status === 'FETCHING'}
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setScanCameraOpen(true)}
                                        title="Open camera scanner"
                                        style={{ ...btnSecondary, paddingLeft: '12px', paddingRight: '12px' }}
                                    >
                                        📷
                                    </button>
                                    <button type="button" onClick={triggerDemoScan} style={btnSecondary}>
                                        ▷ Demo scan
                                    </button>
                                </form>
                                {rowItem('Manifest', 'MF-2026-06-22')}
                                {rowItem('Operator', 'Operator 02')}
                                {rowItem('Scanned today', <span style={{ color: '#16a34a', fontWeight: '700' }}>{scannedToday}</span>, true)}
                            </div>

                            {/* Barcode Image Scanner Card */}
                            <div style={card}>
                                <div style={label}>🖼 Image Barcode Scanner</div>

                                {!uploadImageSrc ? (
                                    <div
                                        onClick={() => dashboardFileInputRef.current?.click()}
                                        style={{
                                            border: '2px dashed #d1d5db',
                                            borderRadius: '8px',
                                            padding: '24px 16px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            backgroundColor: '#f9fafb',
                                            transition: 'border-color 0.15s ease',
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.borderColor = '#16a34a')}
                                        onMouseOut={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                                    >
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                            Upload package photo
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                            PNG, JPG, JPEG (Scans Code 128 / QR)
                                        </div>
                                        <input
                                            ref={dashboardFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleDashboardFileChange}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* Preview Area with Scanning animation */}
                                        <div style={{
                                            position: 'relative',
                                            width: '100%',
                                            height: '160px',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: '1px solid #e5e7eb',
                                            backgroundColor: '#f3f4f6'
                                        }}>
                                            <img
                                                src={uploadImageSrc}
                                                alt="Barcode label preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />

                                            {/* Sweeping laser line for scanning effect */}
                                            {uploadScanningVisual && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    right: 0,
                                                    height: '3px',
                                                    backgroundColor: '#16a34a',
                                                    boxShadow: '0 0 8px #16a34a',
                                                    animation: 'dashscan 1.6s ease-in-out infinite'
                                                }} />
                                            )}

                                            {/* Analyzing overlay loader */}
                                            {isUploadingImage && (
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                }}>
                                                    <div style={{
                                                        width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.2)',
                                                        borderTopColor: '#ffffff', borderRadius: '50%',
                                                        animation: 'spin 0.8s linear infinite'
                                                    }} />
                                                    <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: '500' }}>Decoding...</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Results area */}
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '12px',
                                            backgroundColor: '#f9fafb',
                                            borderRadius: '8px',
                                            border: '1px solid #f3f4f6'
                                        }}>
                                            {uploadScanError && (
                                                <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: '500' }}>
                                                    ❌ {uploadScanError}
                                                </div>
                                            )}

                                            {uploadScannedCode && (
                                                <div>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: '600' }}>
                                                        Scanned Tracking Number
                                                    </div>
                                                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827', margin: '4px 0 12px 0', letterSpacing: '0.5px' }}>
                                                        {uploadScannedCode}
                                                    </div>

                                                    {uploadScannedPartner && (
                                                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
                                                            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: '600', marginBottom: '4px' }}>
                                                                Assigned LMD Partner
                                                            </div>
                                                            <div style={{
                                                                fontSize: '42px',
                                                                fontWeight: '900',
                                                                color: uploadScannedPartner.toLowerCase() === 'pickme' ? '#16a34a' : '#2563eb',
                                                                letterSpacing: '1.5px',
                                                                textShadow: '1px 1px 1px rgba(0,0,0,0.05)'
                                                            }}>
                                                                {uploadScannedPartner.toUpperCase()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action button to reset */}
                                        <button
                                            type="button"
                                            onClick={handleClearUploadScanner}
                                            style={{ ...btnSecondary, justifyContent: 'center' }}
                                        >
                                            Scan another image
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assigned Partner Card */}
                        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
                            <div style={label}>Assigned Partner</div>
                            {currentScan?.assignedPartner ? (
                                <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '8px' }}>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: '#f0fdf4',
                                        border: '1px solid #86efac',
                                        borderRadius: '8px',
                                        padding: '10px 24px',
                                        color: '#15803d',
                                        fontWeight: '700',
                                        fontSize: '18px',
                                        margin: '0 auto 8px'
                                    }}>
                                        🚚 {currentScan.assignedPartner}
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0' }}>Based on 50% allocation rule</p>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px' }}>
                                    Awaiting barcode scan...
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '8px' }}>
                                {rowItem('Zone', currentScan?.assignedZone || '—')}
                                {rowItem('Zone allocation', <span style={{ fontSize: '12px', textAlign: 'right' }}>PickMe 50% / Domex 30% / Pronto 20%</span>, true)}
                            </div>
                        </div>
                    </div>

                        {/* Parcel Details Card */}
                {currentScan?.parcel && (
                    <div style={{ ...card, marginBottom: '16px' }}>
                        <div style={label}>Parcel Details</div>
                        {parcelDetailsGrid(currentScan.parcel)}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                            <button onClick={handleConfirmDispatch} style={btnPrimary}>✓ Confirm & dispatch</button>
                            <button onClick={handleChangeLMD} style={btnSecondary}>🔄 Change LMD partner</button>
                            <button onClick={handleClearScan} style={{ ...btnDanger, marginLeft: 'auto' }}>✕ Clear</button>
                        </div>
                    </div>
                )}

                {/* Recent Scans Table */}
                <div style={card}>
                    <div style={label}>Recent Scans</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                {['Tracking no.', 'Consignee', 'LMD Partner', 'Zone', 'City'].map(h => (
                                    <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.parcel?.trackingNumber}</td>
                                    <td style={{ padding: '10px 8px', color: '#374151' }}>{item.parcel?.recipientName}</td>
                                    <td style={{ padding: '10px 8px' }}>
                                        <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '12px' }}>
                                            {item.assignedPartner}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 8px', color: '#374151' }}>{item.assignedZone}</td>
                                    <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.parcel?.city}</td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>No scans in this session.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
                )}

            {/* ═══════════════════════════════════════════════════════
                    TAB 2 — DISPATCH VERIFY
                ═══════════════════════════════════════════════════════ */}
            {activeTab === 'verify' && (
                <div>
                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                        {[
                            { count: verifiedCount, label: 'Verified', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                            { count: mismatchCount, label: 'Mismatches', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
                            { count: pendingDispatch, label: 'Pending dispatch', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' }
                        ].map(({ count, label: lbl, color, bg, border }) => (
                            <div key={lbl} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '18px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontSize: '32px', fontWeight: '700', color, marginBottom: '4px' }}>{count}</div>
                                <div style={{ fontSize: '12px', color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{lbl}</div>
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Select Bin */}
                    <div style={{ ...card, marginBottom: '16px' }}>
                        <div style={label}>Step 1 — Select Active Dispatch Bin</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            {(['PickMe', 'Domex', 'Pronto'] as const).map((bin) => (
                                <button
                                    key={bin}
                                    onClick={() => setSelectedBin(bin)}
                                    style={{
                                        backgroundColor: selectedBin === bin ? '#f0fdf4' : '#f9fafb',
                                        border: selectedBin === bin ? '2px solid #16a34a' : '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ fontSize: '22px', marginBottom: '4px' }}>{bin === 'Pronto' ? '🏍' : '🚚'}</div>
                                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{bin}</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                        {binCounts[bin]} parcels
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notice Banner */}
                    <div style={{ border: '1px dashed #d1d5db', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: selectedBin ? '#15803d' : '#b45309', backgroundColor: selectedBin ? '#f0fdf4' : '#fffbeb', fontWeight: '500' }}>
                        {selectedBin ? `🔍 Active bin: ${selectedBin} — Scan barcodes below to verify routing.` : '⚠ Select a dispatch bin first, then scan parcels'}
                    </div>

                    {/* Step 2: Scan + Log */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        {/* Scan Card */}
                        <div style={card}>
                            <div style={label}>Step 2 — Scan Parcel Barcode</div>
                            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                                <input
                                    ref={verifyInputRef}
                                    type="text"
                                    value={verifyBarcodeInput}
                                    onChange={(e) => setVerifyBarcodeInput(e.target.value)}
                                    placeholder={selectedBin ? 'Scan barcode...' : 'Select a bin first...'}
                                    disabled={!selectedBin || verifyStatus === 'FETCHING'}
                                    style={{ ...inputStyle, flex: 1, backgroundColor: selectedBin ? '#f9fafb' : '#f3f4f6', cursor: selectedBin ? 'text' : 'not-allowed' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => selectedBin && setVerifyCameraOpen(true)}
                                    disabled={!selectedBin}
                                    title={selectedBin ? 'Open camera scanner' : 'Select a bin first'}
                                    style={{ ...btnSecondary, paddingLeft: '12px', paddingRight: '12px', opacity: selectedBin ? 1 : 0.5, cursor: selectedBin ? 'pointer' : 'not-allowed' }}
                                >
                                    📷
                                </button>
                                <button type="button" onClick={triggerVerifyDemoScan} disabled={!selectedBin} style={{ ...btnSecondary, opacity: selectedBin ? 1 : 0.5, cursor: selectedBin ? 'pointer' : 'not-allowed' }}>
                                    ▷ Demo
                                </button>
                            </form>
                            {rowItem('Active bin', <span style={{ color: selectedBin ? '#15803d' : '#b45309', fontWeight: '700' }}>{selectedBin || 'None selected'}</span>)}
                            {rowItem('Last scanned', verifyScan?.parcel?.trackingNumber || '—')}
                            {rowItem('Assigned to', verifyScan?.assignedPartner || '—')}
                            {rowItem('Destination', verifyScan?.parcel?.city || '—')}
                            {rowItem('Result',
                                <span style={{ color: verifyStatus === 'MATCH' ? '#15803d' : verifyStatus === 'MISMATCH' ? '#dc2626' : '#374151', fontWeight: '700' }}>
                                    {verifyStatus === 'MATCH' ? '✓ MATCH' : verifyStatus === 'MISMATCH' ? '✕ MISMATCH' : '—'}
                                </span>, true)}
                        </div>

                        {/* Scan Log Card */}
                        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
                            <div style={label}>Scan Log — This Session</div>
                            <div style={{ flex: 1, maxHeight: '230px', overflowY: 'auto' }}>
                                {verifyHistory.length === 0 ? (
                                    <p style={{ margin: '0', color: '#9ca3af', fontSize: '13px' }}>No scans yet</p>
                                ) : (
                                    <ul style={{ listStyleType: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {verifyHistory.map((item, idx) => (
                                            <li key={idx} style={{ backgroundColor: '#f9fafb', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${item.isMatch ? '#16a34a' : '#dc2626'}` }}>
                                                <div>
                                                    <span style={{ fontWeight: '600', color: '#111827', marginRight: '6px' }}>{item.trackingNumber}</span>
                                                    <span style={{ color: '#6b7280' }}>{item.assignedPartner}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ color: item.isMatch ? '#16a34a' : '#dc2626', fontWeight: '700', fontSize: '11px' }}>{item.isMatch ? 'OK' : 'MISMATCH'}</span>
                                                    <span style={{ color: '#9ca3af', fontSize: '11px' }}>{item.timestamp}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Parcel Details (after scan in verify tab) */}
                    {verifyScan?.parcel && (
                        <div style={{ ...card, marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div style={label}>Scanned Parcel Details</div>
                                <span style={{
                                    backgroundColor: verifyStatus === 'MATCH' ? '#f0fdf4' : '#fef2f2',
                                    color: verifyStatus === 'MATCH' ? '#15803d' : '#dc2626',
                                    border: `1px solid ${verifyStatus === 'MATCH' ? '#86efac' : '#fca5a5'}`,
                                    padding: '3px 10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {verifyStatus === 'MATCH' ? '✓ Match Approved' : '✕ Mismatch Warning'}
                                </span>
                            </div>
                            {parcelDetailsGrid(verifyScan.parcel)}
                        </div>
                    )}

                    {/* Step 3: Confirm Dispatch */}
                    <div style={card}>
                        <div style={label}>Step 3 — Confirm Dispatch Batch</div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#374151' }}>
                            Confirm all verified parcels in the active bin are ready to dispatch.
                        </p>
                        {verifiedCount === 0 && (
                            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#b45309', fontWeight: '500' }}>
                                Select a bin and scan parcels before confirming dispatch.
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                            <button onClick={() => alert('Printing Batch Manifest PDF...')} style={btnSecondary}>
                                🖨 Print manifest
                            </button>
                            <button
                                onClick={() => {
                                    alert(`Dispatch confirmed for ${verifiedCount} parcels!`);
                                    setVerifiedCount(0); setVerifyScan(null); setVerifyStatus('READY'); setVerifyHistory([]);
                                }}
                                disabled={verifiedCount === 0}
                                style={{ ...btnPrimary, opacity: verifiedCount > 0 ? 1 : 0.5, cursor: verifiedCount > 0 ? 'pointer' : 'not-allowed' }}
                            >
                                ✓ Confirm dispatch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                    TAB 3 — ZONE CONFIG
                ═══════════════════════════════════════════════════════ */}
            {activeTab === 'config' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                    {/* Zone Mappings */}
                    <div style={card}>
                        <div style={label}>Zone Mappings Configuration</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                    {['Province', 'City', 'Zone Name'].map(h => (
                                        <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {config.zoneMappings.map((m, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{m.province}</td>
                                        <td style={{ padding: '10px 8px', fontWeight: '500', color: '#111827' }}>{m.city}</td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '12px' }}>{m.zoneName}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <form onSubmit={handleAddZoneMapping} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                            <input type="text" placeholder="Province" value={newProvince} onChange={(e) => setNewProvince(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '100px' }} />
                            <input type="text" placeholder="City" value={newCity} onChange={(e) => setNewCity(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '100px' }} />
                            <input type="text" placeholder="Zone" value={newZone} onChange={(e) => setNewZone(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '80px' }} />
                            <button type="submit" style={btnPrimary}>Add</button>
                        </form>
                    </div>

                    {/* Allocation Rules */}
                    <div style={card}>
                        <div style={label}>Courier Split Rules %</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {Object.entries(config.allocationRules).map(([zoneName, rules]) => (
                                <div key={zoneName} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '16px' }}>
                                    <div style={{ fontWeight: '700', color: '#15803d', marginBottom: '10px', fontSize: '13px' }}>{zoneName}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {rules.map((rule, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                                <span style={{ color: '#374151', width: '60px' }}>🚚 {rule.partnerCode}</span>
                                                <div style={{ flex: 1, height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${rule.weightPercentage}%`,
                                                        height: '100%',
                                                        backgroundColor: rule.partnerCode === 'PickMe' ? '#16a34a' : rule.partnerCode === 'Domex' ? '#2563eb' : '#f59e0b',
                                                        borderRadius: '3px'
                                                    }} />
                                                </div>
                                                <span style={{ fontWeight: '700', color: '#111827', width: '36px', textAlign: 'right' }}>{rule.weightPercentage}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                    TAB 4 — REPORTS
                ═══════════════════════════════════════════════════════ */}
            {activeTab === 'reports' && (
                <div>
                    {/* Summary Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                        {[
                            { count: history.length + verifyHistory.length, lbl: 'Total Operations', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                            { count: history.filter(h => h.assignedPartner === 'PickMe').length, lbl: 'PickMe Allocated', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                            { count: history.filter(h => h.assignedPartner === 'Domex').length, lbl: 'Domex Allocated', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
                            { count: history.filter(h => h.assignedPartner === 'Pronto').length, lbl: 'Pronto Allocated', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' }
                        ].map(({ count, lbl, color, bg, border }) => (
                            <div key={lbl} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontSize: '28px', fontWeight: '700', color, marginBottom: '4px' }}>{count}</div>
                                <div style={{ fontSize: '11px', color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{lbl}</div>
                            </div>
                        ))}
                    </div>

                    {/* Audit Table */}
                    <div style={card}>
                        <div style={label}>Full Operational Audit Trail</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                    {['Type', 'Tracking no.', 'Consignee', 'LMD', 'Destination', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item, idx) => (
                                    <tr key={`scan-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 8px' }}><span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Allocation</span></td>
                                        <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.parcel?.trackingNumber}</td>
                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{item.parcel?.recipientName}</td>
                                        <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.assignedPartner}</td>
                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.parcel?.city}</td>
                                        <td style={{ padding: '10px 8px', color: '#15803d', fontWeight: '500' }}>✓ Allocated</td>
                                    </tr>
                                ))}
                                {verifyHistory.map((item, idx) => (
                                    <tr key={`verify-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 8px' }}><span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Verification</span></td>
                                        <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.trackingNumber}</td>
                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{item.recipientName || '—'}</td>
                                        <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.assignedPartner}</td>
                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.city || '—'}</td>
                                        <td style={{ padding: '10px 8px', color: item.isMatch ? '#15803d' : '#dc2626', fontWeight: '600' }}>
                                            {item.isMatch ? '✓ Matched' : '✕ Mismatch'}
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && verifyHistory.length === 0 && (
                                    <tr><td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>No operation data logged yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>

            {/* ── CAMERA SCANNER MODALS ── */ }
            <BarcodeScanner
                active={scanCameraOpen}
                onClose={() => setScanCameraOpen(false)}
                onDetected={(value) => {
                    setScanCameraOpen(false);
                    setBarcodeInput(value);
                    // Auto-submit after the modal closes
                    setTimeout(async () => {
                        if (!value.trim()) return;
                        setStatus('FETCHING');
                        setErrorMessage('');
                        try {
                            const response = await fetch('/api/allocate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ trackingNumber: value.trim() }),
                            });
                            const data: AllocationResponse = await response.json();
                            if (data.success) {
                                setCurrentScan(data);
                                setHistory((prev) => [data, ...prev].slice(0, 10));
                                setScannedToday((prev) => prev + 1);
                                setStatus('SUCCESS');
                            } else {
                                throw new Error(data.error || 'Allocation failure');
                            }
                        } catch (err: any) {
                            setErrorMessage(err.message || 'API error');
                            setStatus('ERROR');
                        }
                        setBarcodeInput('');
                    }, 200);
                }}
            />

            <BarcodeScanner
                active={verifyCameraOpen}
                onClose={() => setVerifyCameraOpen(false)}
                onDetected={(value) => {
                    setVerifyCameraOpen(false);
                    setVerifyBarcodeInput(value);
                    // Auto-submit verify scan after modal closes
                    setTimeout(async () => {
                        if (!value.trim() || !selectedBin) return;
                        setVerifyStatus('FETCHING');
                        setVerifyErrorMessage('');
                        try {
                            const response = await fetch('/api/allocate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ trackingNumber: value.trim() }),
                            });
                            const data: AllocationResponse = await response.json();
                            if (data.success) {
                                setVerifyScan(data);
                                const assigned = data.assignedPartner || 'Unknown';
                                const isMatch = assigned.toLowerCase() === selectedBin.toLowerCase();
                                const now = new Date();
                                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                if (isMatch) {
                                    setVerifyStatus('MATCH');
                                    setVerifiedCount((prev) => prev + 1);
                                    setPendingDispatch((prev) => Math.max(0, prev - 1));
                                    setBinCounts((prev) => ({ ...prev, [selectedBin]: Math.max(0, prev[selectedBin] - 1) }));
                                } else {
                                    setVerifyStatus('MISMATCH');
                                    setMismatchCount((prev) => prev + 1);
                                }
                                setVerifyHistory((prev) => [{
                                    trackingNumber: value.trim(), bin: selectedBin!, assignedPartner: assigned,
                                    isMatch, timestamp: timeStr, recipientName: data.parcel?.recipientName, city: data.parcel?.city
                                }, ...prev]);
                            } else {
                                throw new Error(data.error || 'Invalid tracking number');
                            }
                        } catch (err: any) {
                            setVerifyErrorMessage(err.message || 'Verification error');
                            setVerifyStatus('ERROR');
                        }
                        setVerifyBarcodeInput('');
                    }, 200);
                }}
            />

    {/* Hidden dummy element for dashboard file decoder */ }
    <div id="dashboard-dummy-decoder" style={{ display: 'none' }} />

    {/* Custom animations for dashboard image scanner */ }
    <style>{`
                @keyframes dashscan {
                    0%   { top: 0%; }
                    50%  { top: 100%; }
                    100% { top: 0%; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    );
}