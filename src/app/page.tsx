'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AllocationResponse, SkyNetParcelData } from '@/types';

export default function WorkstationDashboard() {
    const [activeTab, setActiveTab] = useState<'first-scan' | 'second-scan' | 'damaged-barcode' | 'verify' | 'config' | 'reports'>('first-scan');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
    const [scannedToday, setScannedToday] = useState<number>(0);
    const [timeString, setTimeString] = useState<string>('');
    const [scannerConnected, setScannerConnected] = useState<boolean | null>(null); // null = unknown, true = connected, false = no scanner

    // Device Manager states
    const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
    const [testScannerInput, setTestScannerInput] = useState('');
    const [testScannerSpeed, setTestScannerSpeed] = useState<string>('');
    const [testKeyTimes, setTestKeyTimes] = useState<number[]>([]);

    // Tab 1: Box Unsealing (First Scan)
    const [mawbsList, setMawbsList] = useState<any[]>([]);
    const [firstScanMawb, setFirstScanMawb] = useState('');
    const [firstScanBags, setFirstScanBags] = useState<{ bagNumber: string; expectedCount: number }[]>([]);
    const [firstScanSelectedBag, setFirstScanSelectedBag] = useState('');
    const [bagBarcodeInput, setBagBarcodeInput] = useState('');
    const [firstScanExpected, setFirstScanExpected] = useState<number | ''>('');
    const [firstScanInput, setFirstScanInput] = useState('');
    const [firstScanLastScanned, setFirstScanLastScanned] = useState('');
    const [firstScanHistory, setFirstScanHistory] = useState<Array<{ trackingNumber: string; recipientName: string; city: string; timestamp: string; assignedPartner?: string; assignedZone?: string }>>([]);
    const [firstScanCurrentScan, setFirstScanCurrentScan] = useState<{ assignedPartner?: string; assignedZone?: string } | null>(null);
    const [firstScanStatus, setFirstScanStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [firstScanError, setFirstScanError] = useState('');
    const [unsealedBoxes, setUnsealedBoxes] = useState<Array<{ mawb: string; bagNumber?: string; expected: number; scanned: number; timestamp: string }>>([]);

    // Tab 2: Scan & Allocate (Second Scan)
    const [barcodeInput, setBarcodeInput] = useState('');
    const [lastScanned, setLastScanned] = useState('');
    const [currentScan, setCurrentScan] = useState<AllocationResponse | null>(null);
    const [status, setStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [errorMessage, setErrorMessage] = useState('');
    const [history, setHistory] = useState<AllocationResponse[]>([]);

    // Tab 2: Dispatch Verify
    const [selectedBin, setSelectedBin] = useState<'PickMe' | 'Domex' | 'Pronto' | null>(null);
    const [verifyBarcodeInput, setVerifyBarcodeInput] = useState('');
    const [lastVerifyScanned, setLastVerifyScanned] = useState('');
    const [verifyScan, setVerifyScan] = useState<AllocationResponse | null>(null);
    const [verifyStatus, setVerifyStatus] = useState<'READY' | 'FETCHING' | 'MATCH' | 'MISMATCH' | 'ERROR'>('READY');
    const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
    const [binCounts, setBinCounts] = useState({ PickMe: 0, Domex: 0, Pronto: 0 });
    const [duplicateModal, setDuplicateModal] = useState<{ barcode: string; type: 'allocate' | 'verify' } | null>(null);
    const [confirmFinishModal, setConfirmFinishModal] = useState(false);
    const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);
    const [verifiedCount, setVerifiedCount] = useState(0);
    const [mismatchCount, setMismatchCount] = useState(0);
    const [pendingDispatch, setPendingDispatch] = useState(0);
    const [verifyHistory, setVerifyHistory] = useState<Array<{
        trackingNumber: string;
        bin: string;
        assignedPartner: string;
        isMatch: boolean;
        timestamp: string;
        recipientName?: string;
        city?: string;
    }>>([]);

    // Tab: Damaged Barcode (Temu Scan)
    const [damagedBarcodeInput, setDamagedBarcodeInput] = useState('');
    const [damagedLastScanned, setDamagedLastScanned] = useState('');
    const [damagedCurrentScan, setDamagedCurrentScan] = useState<AllocationResponse | null>(null);
    const [damagedStatus, setDamagedStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [damagedErrorMessage, setDamagedErrorMessage] = useState('');
    const [damagedHistory, setDamagedHistory] = useState<AllocationResponse[]>([]);

    // Tab 3: Config
    const [config, setConfig] = useState({
        zoneMappings: [] as { province: string; district: string; city: string; zoneName: string }[],
        allocationRules: {} as Record<string, { partnerCode: string; weightPercentage: number }[]>
    });
    const [newProvince, setNewProvince] = useState('');
    const [newCity, setNewCity] = useState('');
    const [newZone, setNewZone] = useState('');

    const firstScanInputRef = useRef<HTMLInputElement>(null);
    const bagBarcodeInputRef = useRef<HTMLInputElement>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const verifyInputRef = useRef<HTMLInputElement>(null);
    const damagedInputRef = useRef<HTMLInputElement>(null);

    // Live clock
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const secs = String(now.getSeconds()).padStart(2, '0');
            setTimeString(`${hrs}:${mins}:${secs}`);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    // USB/Bluetooth barcode scanner detection:
    // Real scanners send characters in rapid bursts (< 50ms between chars) ending with Enter.
    // Regular keyboard typing is slower. We detect this pattern to set scanner status.
    useEffect(() => {
        let lastKeyTime = 0;
        let rapidKeyCount = 0;
        const RAPID_THRESHOLD_MS = 50;
        const MIN_RAPID_KEYS = 5;

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const delta = now - lastKeyTime;
            lastKeyTime = now;

            if (delta < RAPID_THRESHOLD_MS) {
                rapidKeyCount++;
                if (rapidKeyCount >= MIN_RAPID_KEYS) {
                    setScannerConnected(true);
                }
            } else {
                rapidKeyCount = 0;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Fetch MAWBs list and existing unsealed bags on mount
    useEffect(() => {
        fetch('/api/allocate?mawbs=true')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.mawbs) {
                    setMawbsList(data.mawbs);
                }
            }).catch(console.error);

        fetch('/api/allocate?getUnsealedBags=true')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.unsealedBags) {
                    const mapped = data.unsealedBags.map((ub: any) => ({
                        mawb: ub.mawb_ref,
                        bagNumber: ub.bag_number,
                        expected: ub.expected_count,
                        scanned: ub.scanned_count,
                        timestamp: new Date(ub.created_at).toLocaleTimeString()
                    }));
                    setUnsealedBoxes(mapped);
                }
            }).catch(console.error);
    }, []);

    // Fetch bags for selected MAWB
    useEffect(() => {
        if (!firstScanMawb) {
            setFirstScanBags([]);
            setFirstScanSelectedBag('');
            setFirstScanExpected('');
            return;
        }

        const fetchBags = async () => {
            try {
                const res = await fetch(`/api/allocate?getBags=true&mawbRef=${firstScanMawb}`);
                const data = await res.json();
                if (data.success) {
                    setFirstScanBags(data.bags || []);
                } else {
                    console.error("Failed to load bags:", data.error);
                }
            } catch (err) {
                console.error("Error fetching bags:", err);
            }
        };

        fetchBags();
        setFirstScanSelectedBag('');
        setFirstScanExpected('');
        setFirstScanHistory([]);
        setFirstScanCurrentScan(null);
    }, [firstScanMawb]);

    // Update expected count when bag is selected
    useEffect(() => {
        if (!firstScanSelectedBag) {
            setFirstScanExpected('');
            return;
        }
        const selected = firstScanBags.find(b => b.bagNumber === firstScanSelectedBag);
        if (selected) {
            setFirstScanExpected(selected.expectedCount);
        } else {
            setFirstScanExpected('');
        }
        setFirstScanHistory([]);
        setFirstScanCurrentScan(null);
    }, [firstScanSelectedBag, firstScanBags]);

    // Focus input
    useEffect(() => {
        if (duplicateModal) return; // Prevent focus stealing when duplicate warning is open
        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
        else if (activeTab === 'verify') verifyInputRef.current?.focus();
        else if (activeTab === 'damaged-barcode') damagedInputRef.current?.focus();
    }, [activeTab, status, verifyStatus, duplicateModal, firstScanStatus, damagedStatus]);

    // Handle keypresses (Enter, Space, Escape) to dismiss duplicate warning modal and refocus
    useEffect(() => {
        if (!duplicateModal) return;
        const handleModalKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                e.preventDefault();
                setDuplicateModal(null);
                setTimeout(() => {
                    if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                    else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                    else if (activeTab === 'verify') verifyInputRef.current?.focus();
                    else if (activeTab === 'damaged-barcode') damagedInputRef.current?.focus();
                }, 50);
            }
        };
        window.addEventListener('keydown', handleModalKey);
        return () => window.removeEventListener('keydown', handleModalKey);
    }, [duplicateModal, activeTab]);

    const handleConfirmFinish = async () => {
        if (!firstScanMawb || !firstScanSelectedBag || firstScanExpected === '') return;

        const isMatch = firstScanHistory.length === Number(firstScanExpected);
        if (!isMatch) {
            setFirstScanError("Cannot close session: Scanned count does not match expected database count.");
            setConfirmFinishModal(false);
            return;
        }

        try {
            setFirstScanStatus('FETCHING');
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stage: 'finish-bag',
                    mawbRef: firstScanMawb,
                    bagNumber: firstScanSelectedBag,
                    expectedCount: Number(firstScanExpected),
                    scannedCount: firstScanHistory.length,
                    status: 'COUNTED'
                }),
            });
            const data = await response.json();
            if (data.success) {
                setUnsealedBoxes(prev => [
                    {
                        mawb: firstScanMawb,
                        bagNumber: firstScanSelectedBag,
                        expected: Number(firstScanExpected),
                        scanned: firstScanHistory.length,
                        timestamp: new Date().toLocaleTimeString()
                    },
                    ...prev
                ]);

                setSuccessModal({
                    title: "Bag Counted & Saved",
                    message: `Bag "${firstScanSelectedBag}" has been successfully unsealed and stored in database. Count: ${firstScanHistory.length} parcels.`
                });

                handleClearFirstScan();
            } else {
                setFirstScanError(data.error || "Failed to save unsealing log to database.");
            }
        } catch (err: any) {
            setFirstScanError(err.message || "Failed to connect to server.");
        } finally {
            setFirstScanStatus('READY');
            setConfirmFinishModal(false);
        }
    };

    // Keyboard wedge support for confirmFinishModal and successModal
    useEffect(() => {
        if (!confirmFinishModal && !successModal) return;
        const handleModalKey = (e: KeyboardEvent) => {
            if (successModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    setSuccessModal(null);
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                        else if (activeTab === 'verify') verifyInputRef.current?.focus();
                        else if (activeTab === 'damaged-barcode') damagedInputRef.current?.focus();
                    }, 50);
                }
            } else if (confirmFinishModal) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmFinish();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setConfirmFinishModal(false);
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                    }, 50);
                }
            }
        };
        window.addEventListener('keydown', handleModalKey);
        return () => window.removeEventListener('keydown', handleModalKey);
    }, [confirmFinishModal, successModal, activeTab, firstScanMawb, firstScanExpected, firstScanHistory]);



    const handleTestScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const now = Date.now();
        setTestKeyTimes(prev => {
            const next = [...prev, now];
            if (next.length > 15) next.shift();

            if (next.length >= 2) {
                const deltas = [];
                for (let i = 1; i < next.length; i++) {
                    deltas.push(next[i] - next[i - 1]);
                }
                const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
                if (avg < 50) {
                    setTestScannerSpeed(`Verified RTD/Hardware Scanner (average keystroke: ${avg.toFixed(0)}ms)`);
                    setScannerConnected(true);
                } else {
                    setTestScannerSpeed(`Manual typing speed (average keystroke: ${avg.toFixed(0)}ms)`);
                }
            }
            return next;
        });
    };

    const handleClearTestInput = () => {
        setTestScannerInput('');
        setTestScannerSpeed('');
        setTestKeyTimes([]);
    };

    const getBagScannedCount = (bagNumber: string) => {
        if (firstScanSelectedBag === bagNumber) {
            return firstScanHistory.length;
        }
        const unsealed = unsealedBoxes.find(ub => ub.mawb === firstScanMawb && ub.bagNumber === bagNumber);
        if (unsealed) {
            return unsealed.scanned;
        }
        return 0;
    };

    const getBagStatus = (bagNumber: string, expected: number) => {
        const unsealed = unsealedBoxes.find(ub => ub.mawb === firstScanMawb && ub.bagNumber === bagNumber);
        if (unsealed) {
            return 'COMPLETED';
        }
        if (firstScanSelectedBag === bagNumber) {
            if (firstScanHistory.length === expected) {
                return 'COMPLETED';
            }
            return 'ONGOING';
        }
        return 'PENDING';
    };

    const handleFirstScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = firstScanInput.trim();
        if (!barcode || !firstScanMawb) return;

        // Auto select input text so next scan overwrites it
        setTimeout(() => {
            firstScanInputRef.current?.select();
        }, 50);

        // 1. Smart Bag Barcode Scan Detection
        const matchedBag = firstScanBags.find(b => b.bagNumber.toLowerCase() === barcode.toLowerCase());
        if (matchedBag) {
            if (firstScanSelectedBag === matchedBag.bagNumber) {
                setFirstScanInput('');
                return;
            }
            // Check if there is already an active bag session with scans
            if (firstScanSelectedBag && firstScanHistory.length > 0) {
                const confirmSwitch = window.confirm(`You are currently scanning Bag "${firstScanSelectedBag}" with ${firstScanHistory.length} scanned parcels. Are you sure you want to switch to Bag "${matchedBag.bagNumber}"? Current progress in the active box will be cleared.`);
                if (!confirmSwitch) {
                    setFirstScanInput('');
                    return;
                }
            }
            setFirstScanSelectedBag(matchedBag.bagNumber);
            setFirstScanExpected(matchedBag.expectedCount);
            setFirstScanError('');
            setFirstScanInput('');
            setFirstScanLastScanned('');
            setFirstScanStatus('READY');
            setFirstScanHistory([]);
            return;
        }

        // 2. Regular Parcel Barcode Scan
        if (!firstScanSelectedBag) {
            setFirstScanError(`Please select a bag or scan a valid Bag Barcode first.`);
            setFirstScanStatus('ERROR');
            setFirstScanInput('');
            return;
        }

        // Check for duplicates in the current history session
        const isDuplicate = firstScanHistory.some(item => item.trackingNumber === barcode);
        if (isDuplicate) {
            setFirstScanError(`Duplicate scan: Barcode "${barcode}" has already been scanned in this box.`);
            setFirstScanStatus('ERROR');
            setDuplicateModal({ barcode, type: 'allocate' });
            return;
        }

        setFirstScanStatus('FETCHING');
        setFirstScanError('');
        setFirstScanLastScanned(barcode);

        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackingNumber: barcode,
                    stage: 'first',
                    mawbRef: firstScanMawb
                }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success && data.parcel) {
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                setFirstScanHistory(prev => [
                    {
                        trackingNumber: barcode,
                        recipientName: data.parcel?.recipientName || 'Unknown Recipient',
                        city: data.parcel?.city || 'Unknown City',
                        timestamp: timeStr,
                        assignedPartner: data.assignedPartner,
                        assignedZone: data.assignedZone
                    },
                    ...prev
                ]);
                setFirstScanCurrentScan({
                    assignedPartner: data.assignedPartner,
                    assignedZone: data.assignedZone
                });
                setScannedToday((prev) => prev + 1);
                setFirstScanStatus('SUCCESS');
            } else {
                throw new Error(data.error || 'Unknown scan error');
            }
        } catch (err: any) {
            setFirstScanError(err.message || 'API connection failure');
            setFirstScanStatus('ERROR');
        }
    };

    const handleClearFirstScan = () => {
        setFirstScanSelectedBag('');
        setFirstScanExpected('');
        setFirstScanInput('');
        setFirstScanLastScanned('');
        setFirstScanHistory([]);
        setFirstScanStatus('READY');
        setFirstScanError('');
        setFirstScanCurrentScan(null);
    };

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = barcodeInput.trim();
        if (!barcode) return;

        // Auto select input text so next scan overwrites it
        setTimeout(() => {
            scanInputRef.current?.select();
        }, 50);

        // Duplicate scan check
        const isDuplicate = history.some(item => item.parcel?.trackingNumber === barcode);
        if (isDuplicate) {
            setErrorMessage(`Duplicate scan: Barcode "${barcode}" has already been scanned today.`);
            setStatus('ERROR');
            setDuplicateModal({ barcode, type: 'allocate' });
            return;
        }

        setStatus('FETCHING');
        setErrorMessage('');
        setLastScanned(barcode);
        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber: barcode, stage: 'second' }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success) {
                setCurrentScan(data);
                setHistory((prev) => [data, ...prev].slice(0, 10));
                setScannedToday((prev) => prev + 1);
                setStatus('SUCCESS');
                // Increment real bin count for this partner so Dispatch Verify shows accurate numbers
                const partner = data.assignedPartner as 'PickMe' | 'Domex' | 'Pronto';
                if (partner === 'PickMe' || partner === 'Domex' || partner === 'Pronto') {
                    setBinCounts((prev) => ({ ...prev, [partner]: prev[partner] + 1 }));
                    setPendingDispatch((prev) => prev + 1);
                }
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

        // Auto select input text so next scan overwrites it
        setTimeout(() => {
            verifyInputRef.current?.select();
        }, 50);

        // Duplicate verification check
        const isDuplicate = verifyHistory.some(item => item.trackingNumber === barcode);
        if (isDuplicate) {
            setVerifyErrorMessage(`Duplicate scan: Barcode "${barcode}" has already been verified.`);
            setVerifyStatus('ERROR');
            setDuplicateModal({ barcode, type: 'verify' });
            return;
        }

        setVerifyStatus('FETCHING');
        setVerifyErrorMessage('');
        setLastVerifyScanned(barcode);
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
        setBarcodeInput('');
        setLastScanned('');
    };

    const handleClearScan = () => {
        setCurrentScan(null);
        setStatus('READY');
        setBarcodeInput('');
        setLastScanned('');
    };

    const handleChangeLMD = () => {
        if (!currentScan) return;
        const cur = currentScan.assignedPartner;
        const next = cur === 'PickMe' ? 'Domex' : cur === 'Domex' ? 'Pronto' : 'PickMe';
        setCurrentScan({ ...currentScan, assignedPartner: next });
    };

    const handleDamagedScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = damagedBarcodeInput.trim();
        if (!barcode) return;

        // Auto select input text so next scan overwrites it
        setTimeout(() => {
            damagedInputRef.current?.select();
        }, 50);

        // Duplicate scan check
        const isDuplicate = damagedHistory.some(item => item.parcel?.senderReference === barcode || item.parcel?.trackingNumber === barcode);
        if (isDuplicate) {
            setDamagedErrorMessage(`Duplicate scan: Barcode "${barcode}" has already been resolved in this session.`);
            setDamagedStatus('ERROR');
            setDuplicateModal({ barcode, type: 'allocate' });
            return;
        }

        setDamagedStatus('FETCHING');
        setDamagedErrorMessage('');
        setDamagedLastScanned(barcode);
        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber: barcode, stage: 'second' }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success) {
                setDamagedCurrentScan(data);
                setDamagedHistory((prev) => [data, ...prev].slice(0, 10));
                setScannedToday((prev) => prev + 1);
                setDamagedStatus('SUCCESS');

                // Increment real bin count for this partner so Dispatch Verify shows accurate numbers
                const partner = data.assignedPartner as 'PickMe' | 'Domex' | 'Pronto';
                if (partner === 'PickMe' || partner === 'Domex' || partner === 'Pronto') {
                    setBinCounts((prev) => ({ ...prev, [partner]: prev[partner] + 1 }));
                    setPendingDispatch((prev) => prev + 1);
                }
            } else {
                throw new Error(data.error || 'Unknown allocation failure');
            }
        } catch (err: any) {
            setDamagedErrorMessage(err.message || 'API connection failure');
            setDamagedStatus('ERROR');
        }
    };

    const handleConfirmDispatchDamaged = () => {
        alert(`Parcel ${damagedCurrentScan?.parcel?.trackingNumber} confirmed & dispatched!`);
        setDamagedCurrentScan(null);
        setDamagedStatus('READY');
        setDamagedBarcodeInput('');
        setDamagedLastScanned('');
    };

    const handleClearDamagedScan = () => {
        setDamagedCurrentScan(null);
        setDamagedStatus('READY');
        setDamagedBarcodeInput('');
        setDamagedLastScanned('');
    };

    const handleChangeLMDDamaged = () => {
        if (!damagedCurrentScan) return;
        const cur = damagedCurrentScan.assignedPartner;
        const next = cur === 'PickMe' ? 'Domex' : cur === 'Domex' ? 'Pronto' : 'PickMe';
        setDamagedCurrentScan({ ...damagedCurrentScan, assignedPartner: next });
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
        backgroundColor: '#e21b22',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Main Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 20px', fontSize: '14px' }}>
                {[
                    { lbl: 'Tracking no.', val: parcel.trackingNumber },
                    { lbl: 'Recipient', val: parcel.recipientName },
                    { lbl: 'City', val: parcel.city },
                    { lbl: 'District', val: parcel.district },
                    { lbl: 'Weight', val: `${parcel.weight.toFixed(3)} kg` },
                    { lbl: 'Value', val: parcel.value || 'LKR 0.00' },
                    { lbl: 'Account', val: parcel.account || '—' },
                    { lbl: 'API sync', val: <span style={{ color: '#16a34a', fontWeight: '600' }}>✓ {parcel.apiSync || 'Synced'}</span> },
                ].map(({ lbl, val }) => (
                    <div key={lbl}>
                        <div style={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>{lbl}</div>
                        <div style={{ fontWeight: '600', color: '#111827' }}>{val}</div>
                    </div>
                ))}
            </div>

            {/* Dynamic Detailed Data (Consignee, Consignor, MAWB) */}
            {(parcel.recipientAddress || parcel.senderName || parcel.mawbRef) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                    {/* Consignee & Consignor Address Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {parcel.recipientAddress && (
                            <div>
                                <div style={{ color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Recipient & Delivery Details</div>
                                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ marginBottom: '4px' }}><strong>Phone:</strong> {parcel.recipientPhone || '—'}</div>
                                    <div style={{ marginBottom: '4px' }}><strong>Address:</strong> {parcel.recipientAddress}</div>
                                    <div><strong>Province/State:</strong> {parcel.province}</div>
                                </div>
                            </div>
                        )}
                        {parcel.senderName && (
                            <div>
                                <div style={{ color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Sender (Consignor) Details</div>
                                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ marginBottom: '4px' }}><strong>Shipper Name:</strong> {parcel.senderName}</div>
                                    {parcel.senderAddress && <div><strong>Address:</strong> {parcel.senderAddress}</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MAWB & Shipment Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {parcel.mawbRef && (
                            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '6px' }}>Master Air Waybill (MAWB)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '6px 12px', fontSize: '13px', color: '#1e3a8a' }}>
                                    <span style={{ color: '#60a5fa', fontWeight: '500' }}>Reference:</span>
                                    <span style={{ fontWeight: '700' }}>{parcel.mawbRef}</span>

                                    <span style={{ color: '#60a5fa', fontWeight: '500' }}>Carrier:</span>
                                    <span style={{ fontWeight: '600' }}>{parcel.mawbCarrier || '—'}</span>

                                    <span style={{ color: '#60a5fa', fontWeight: '500' }}>Flight ID:</span>
                                    <span style={{ fontWeight: '600' }}>{parcel.mawbFlight || '—'}</span>

                                    <span style={{ color: '#60a5fa', fontWeight: '500' }}>Total Bags:</span>
                                    <span style={{ fontWeight: '600' }}>{parcel.mawbBags !== undefined ? parcel.mawbBags : '—'}</span>
                                </div>
                            </div>
                        )}

                        {(parcel.goodsDesc || parcel.serviceType) && (
                            <div>
                                <div style={{ color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Shipment Specifications</div>
                                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                                    {parcel.goodsDesc && <div style={{ marginBottom: '4px', wordBreak: 'break-word' }}><strong>Goods Description:</strong> {parcel.goodsDesc}</div>}
                                    {parcel.serviceType && <div><strong>Service Type:</strong> {parcel.serviceType} {parcel.businessType ? `(${parcel.businessType})` : ''}</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div style={{
            fontFamily: "'Inter', sans-serif",
            backgroundColor: '#f9fafb',
            minHeight: '100vh',
            display: 'flex',
            margin: 0,
            padding: 0,
            boxSizing: 'border-box'
        }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                .scan-input-blink {
                    border: 2px solid #fca5a5 !important;
                    box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15) !important;
                }
                .sidebar-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    color: #4b5563;
                    background-color: transparent;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    width: calc(100% - 16px);
                    margin: 0 8px;
                    text-align: left;
                    transition: all 0.15s ease;
                    box-sizing: border-box;
                    position: relative;
                }
                .sidebar-item:hover {
                    background-color: #f3f4f6;
                    color: #111827;
                }
                .sidebar-item svg {
                    color: #6b7280;
                    transition: color 0.15s ease;
                    flex-shrink: 0;
                }
                .sidebar-item:hover svg {
                    color: #374151;
                }
                .sidebar-item.active {
                    background-color: #e21b22;
                    color: #ffffff;
                    font-weight: 600;
                }
                .sidebar-item.active svg {
                    color: #ffffff;
                }
                .sidebar-item-collapsed {
                    justify-content: center;
                    padding: 10px 0;
                }
            `}} />
            <aside style={{
                width: isSidebarExpanded ? '230px' : '64px',
                minWidth: isSidebarExpanded ? '230px' : '64px',
                backgroundColor: '#ffffff',
                borderRight: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                position: 'sticky',
                top: 0,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxSizing: 'border-box',
                overflowX: 'hidden',
                zIndex: 100
            }}>
                {/* Sidebar Header with Toggle */}
                <div style={{
                    display: 'flex',
                    justifyContent: isSidebarExpanded ? 'space-between' : 'center',
                    alignItems: 'center',
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    height: '64px',
                    minHeight: '64px',
                    boxSizing: 'border-box'
                }}>
                    {isSidebarExpanded && (
                        <img src="/logo.png" alt="SKYNET logo" style={{ height: '24px', width: 'auto' }} />
                    )}
                    <button
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px',
                            borderRadius: '6px',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title={isSidebarExpanded ? "Collapse Menu" : "Expand Menu"}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                    </button>
                </div>

                {/* Sidebar Menu Items */}
                {isSidebarExpanded ? (
                    <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#8c98a5',
                        letterSpacing: '0.8px',
                        padding: '20px 16px 8px 16px',
                        textTransform: 'uppercase'
                    }}>
                        Parcel Allocation
                    </div>
                ) : (
                    <div style={{ height: '16px' }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {([
                        {
                            id: 'first-scan',
                            label: 'Box Unsealing',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                    <path d="M12 22V12" />
                                    <path d="m12 12 8.73-5M12 12 3.27 7" />
                                    <path d="M3.27 7 12 12l8.73-5" />
                                </svg>
                            )
                        },
                        {
                            id: 'second-scan',
                            label: 'LMD Verification',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>
                            )
                        },
                        {
                            id: 'damaged-barcode',
                            label: 'Damaged Lables',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            )
                        },
                        {
                            id: 'verify',
                            label: 'Dispatch verify',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
                                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                    <circle cx="5.5" cy="18.5" r="2.5" />
                                    <circle cx="18.5" cy="18.5" r="2.5" />
                                </svg>
                            )
                        }
                    ] as const).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`sidebar-item ${activeTab === item.id ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                            title={!isSidebarExpanded ? item.label : ''}
                        >
                            {item.icon}
                            {isSidebarExpanded && (
                                <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                            )}
                        </button>
                    ))}
                </div>

                {isSidebarExpanded ? (
                    <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#8c98a5',
                        letterSpacing: '0.8px',
                        padding: '24px 16px 8px 16px',
                        textTransform: 'uppercase'
                    }}>
                        Reports
                    </div>
                ) : (
                    <div style={{ borderTop: '1px solid #e5e7eb', margin: '16px 12px 0 12px', paddingTop: '16px' }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {([
                        {
                            id: 'reports',
                            label: 'Reports',
                            icon: (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <line x1="10" y1="9" x2="8" y2="9" />
                                </svg>
                            )
                        }
                    ] as const).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`sidebar-item ${activeTab === item.id ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                            title={!isSidebarExpanded ? item.label : ''}
                        >
                            {item.icon}
                            {isSidebarExpanded && (
                                <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                            )}
                        </button>
                    ))}
                </div>
            </aside>

            {/* Right Column Layout Wrapper */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: '100vh',
                boxSizing: 'border-box'
            }}>
                {/* ── HEADER ── */}
                <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '0 24px',
                    height: '64px',
                    minHeight: '64px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontWeight: '700', fontSize: '18px', color: '#111827' }}>
                            {activeTab === 'verify' ? 'Dispatch Verification' : 'Parcel Allocation System'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                        <button
                            onClick={() => setIsDeviceManagerOpen(true)}
                            title="Open Scanner & Device Manager"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#374151',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                        >
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                                backgroundColor: scannerConnected === true ? '#16a34a' : scannerConnected === null ? '#f59e0b' : '#dc2626'
                            }}></span>
                            {scannerConnected === true
                                ? 'Scanner Connected'
                                : scannerConnected === null
                                    ? 'Awaiting Scanner'
                                    : 'No Scanner'}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px' }}>
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>
                        <span style={{ color: '#374151', fontWeight: '600', borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>{timeString}</span>
                    </div>
                </header>

                <main style={{
                    flex: 1,
                    padding: '24px',
                    boxSizing: 'border-box',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>

                    {/* ═══════════════════════════════════════════════════════
                    TAB 1 — BOX UNSEALING (FIRST SCAN)
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'first-scan' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {firstScanError && (
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Scan Error: {firstScanError}
                                </div>
                            )}

                            {/* Two Column Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 1fr',
                                gap: '20px',
                                alignItems: 'flex-start'
                            }}>
                                {/* Left Column: Setup & Scanning + History */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Setup & Scan Box Card */}
                                    <div style={card}>
                                        <div style={label}>Box Setup & Unsealing</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                            <div>
                                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                    Select MAWB (Master Air Waybill) *
                                                </label>
                                                <select
                                                    value={firstScanMawb}
                                                    onChange={(e) => setFirstScanMawb(e.target.value)}
                                                    style={{ ...inputStyle, width: '100%' }}
                                                >
                                                    <option value="">-- Choose active MAWB reference --</option>
                                                    {mawbsList.map((m: any) => (
                                                        <option key={m.mawb_reference} value={m.mawb_reference}>
                                                            {m.mawb_reference} ({m.carrier || 'Unknown Carrier'} - Declared Bags: {m.declared_bags || 0})
                                                        </option>
                                                    ))}
                                                    {mawbsList.length === 0 && (
                                                        <option value="603-70659761">603-70659761 (Fallback default)</option>
                                                    )}
                                                </select>
                                            </div>
                                            
                                            {/* Scanning Tip */}
                                            {firstScanMawb && (
                                                <div style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#f9fafb', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e21b22', flexShrink: 0 }}>
                                                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                                                    </svg>
                                                    <span><strong>Tip:</strong> You can select the bag by scanning its barcode directly in the input box below.</span>
                                                </div>
                                            )}

                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '12px' }}>
                                                <div>
                                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                        Scan Bag Barcode
                                                    </label>
                                                    <form onSubmit={(e) => {
                                                        e.preventDefault();
                                                        if (!bagBarcodeInput) return;
                                                        const matchedBag = firstScanBags.find(b => b.bagNumber.toLowerCase() === bagBarcodeInput.trim().toLowerCase());
                                                        if (matchedBag) {
                                                            if (firstScanSelectedBag && firstScanHistory.length > 0 && firstScanSelectedBag !== matchedBag.bagNumber) {
                                                                const confirmSwitch = window.confirm(`You are currently scanning Bag "${firstScanSelectedBag}". Are you sure you want to switch to Bag "${matchedBag.bagNumber}"? Current progress in the active box will be cleared.`);
                                                                if (!confirmSwitch) {
                                                                    setBagBarcodeInput('');
                                                                    return;
                                                                }
                                                            }
                                                            setFirstScanSelectedBag(matchedBag.bagNumber);
                                                            setFirstScanExpected(matchedBag.expectedCount);
                                                            setFirstScanError('');
                                                            setFirstScanHistory([]);
                                                            setBagBarcodeInput(matchedBag.bagNumber);
                                                            setTimeout(() => bagBarcodeInputRef.current?.select(), 50);
                                                        } else {
                                                            setFirstScanError(`Bag barcode "${bagBarcodeInput}" not found in this MAWB.`);
                                                            setTimeout(() => bagBarcodeInputRef.current?.select(), 50);
                                                        }
                                                    }}>
                                                        <input
                                                            ref={bagBarcodeInputRef}
                                                            type="text"
                                                            value={bagBarcodeInput}
                                                            onChange={(e) => setBagBarcodeInput(e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                            disabled={!firstScanMawb}
                                                            placeholder="Scan bag barcode..."
                                                            style={{ ...inputStyle, width: '100%', backgroundColor: !firstScanMawb ? '#f3f4f6' : '#ffffff' }}
                                                        />
                                                    </form>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                        Select Bag Number *
                                                    </label>
                                                    <select
                                                        value={firstScanSelectedBag}
                                                        onChange={(e) => setFirstScanSelectedBag(e.target.value)}
                                                        disabled={!firstScanMawb}
                                                        style={{ ...inputStyle, width: '100%', backgroundColor: !firstScanMawb ? '#f3f4f6' : '#ffffff' }}
                                                    >
                                                        <option value="">-- Choose bag --</option>
                                                        {firstScanBags.map((b) => (
                                                            <option key={b.bagNumber} value={b.bagNumber}>
                                                                {b.bagNumber} ({b.expectedCount} expected)
                                                            </option>
                                                        ))}
                                                        {firstScanMawb && firstScanBags.length === 0 && (
                                                            <option value="" disabled>No bags found</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                        Expected Count
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={firstScanExpected === '' ? '' : `${firstScanExpected} parcels`}
                                                        disabled
                                                        placeholder="Pending..."
                                                        style={{ ...inputStyle, width: '100%', backgroundColor: '#f3f4f6', fontWeight: '700' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ borderTop: '1px solid #f6f5f3ff', paddingTop: '16px' }}>
                                            <div style={label}> Scan Barcode</div>
                                            <form onSubmit={handleFirstScanSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                                <input
                                                    ref={firstScanInputRef}
                                                    type="text"
                                                    value={firstScanInput}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (firstScanLastScanned && val.startsWith(firstScanLastScanned) && val.length > firstScanLastScanned.length) {
                                                            setFirstScanInput(val.slice(firstScanLastScanned.length));
                                                            setFirstScanLastScanned('');
                                                        } else {
                                                            setFirstScanInput(val);
                                                        }
                                                    }}
                                                    disabled={!firstScanMawb}
                                                    placeholder={firstScanMawb 
                                                        ? (firstScanSelectedBag 
                                                            ? `Scan parcel inside Bag ${firstScanSelectedBag}...` 
                                                            : "Scan Bag Barcode or select a bag first...") 
                                                        : "Select MAWB first"}
                                                    className={!firstScanMawb ? '' : 'scan-input-blink'}
                                                    style={{ ...inputStyle, flex: 1, backgroundColor: !firstScanMawb ? '#f3f4f6' : '#ffffff' }}
                                                />
                                            </form>
                                            {firstScanLastScanned && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <span>Last scanned:</span>
                                                        <span style={{ fontWeight: '700', backgroundColor: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>
                                                            {firstScanLastScanned}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scanned History for this Box */}
                                    <div style={card}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={label}>Scanned Parcels in current box ({firstScanHistory.length})</div>
                                            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>
                                                <span>Active MAWB: {firstScanMawb || '—'}</span>
                                                {firstScanSelectedBag && <span>Bag: {firstScanSelectedBag}</span>}
                                            </div>
                                        </div>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                                        {['Timestamp', 'Tracking Number', 'Consignee', 'LMD Partner', 'Destination City', 'Status'].map(h => (
                                                            <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {firstScanHistory.map((item, idx) => (
                                                        <tr key={`first-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                            <td style={{ padding: '8px', color: '#6b7280' }}>{item.timestamp}</td>
                                                            <td style={{ padding: '8px', fontWeight: '600', color: '#111827' }}>{item.trackingNumber}</td>
                                                            <td style={{ padding: '8px', color: '#374151' }}>{item.recipientName}</td>
                                                            <td style={{ padding: '8px' }}>
                                                                {item.assignedPartner ? (
                                                                    <span style={{
                                                                        backgroundColor: item.assignedPartner === 'PickMe'
                                                                            ? '#ffcc00'
                                                                            : item.assignedPartner === 'Domex'
                                                                                ? '#7b0f1a'
                                                                                : '#ea580c',
                                                                        color: item.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '4px',
                                                                        fontWeight: '700',
                                                                        fontSize: '11px',
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        {item.assignedPartner}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: '#9ca3af' }}>—</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '8px', color: '#4b5563' }}>{item.city}</td>
                                                            <td style={{ padding: '8px' }}><span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>First Scanned</span></td>
                                                        </tr>
                                                    ))}
                                                    {firstScanHistory.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
                                                                Pull scanner trigger to start counting parcels.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Bags Progress & Partner Allocation Stats */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    
                                    {/* Bags Progress overview Card */}
                                    {firstScanMawb && (
                                        <div style={card}>
                                            <div style={{ ...label, marginBottom: '16px' }}>
                                                MAWB Bags Progress Overview
                                            </div>

                                            {/* Mawb summary metrics */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Total Bags</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827', marginTop: '2px' }}>{firstScanBags.length}</div>
                                                </div>
                                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#166534', textTransform: 'uppercase', fontWeight: '700' }}>Completed</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#166534', marginTop: '2px' }}>
                                                        {firstScanBags.filter(b => getBagStatus(b.bagNumber, b.expectedCount) === 'COMPLETED').length}
                                                    </div>
                                                </div>
                                                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#92400e', textTransform: 'uppercase', fontWeight: '700' }}>Remaining</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#92400e', marginTop: '2px' }}>
                                                        {firstScanBags.filter(b => getBagStatus(b.bagNumber, b.expectedCount) !== 'COMPLETED').length}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Completed Alert when all bags are finished */}
                                            {firstScanBags.length > 0 && firstScanBags.filter(b => getBagStatus(b.bagNumber, b.expectedCount) !== 'COMPLETED').length === 0 && (
                                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#16a34a' }}>
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                                    </svg>
                                                    <span>All bags for this MAWB have been unsealed successfully!</span>
                                                </div>
                                            )}

                                            {/* Bags list */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                                                {firstScanBags.map((bag) => {
                                                    const expected = bag.expectedCount;
                                                    const scanned = getBagScannedCount(bag.bagNumber);
                                                    const status = getBagStatus(bag.bagNumber, expected);
                                                    const remaining = expected - scanned;
                                                    
                                                    let bgColor = '#ffffff';
                                                    let borderColor = '#e5e7eb';
                                                    let textColor = '#374151';
                                                    let descColor = '#6b7280';
                                                    let statusText = 'Pending';
                                                    let statusColor = '#6b7280';
                                                    let statusBg = '#f3f4f6';

                                                    if (status === 'COMPLETED') {
                                                        bgColor = '#f0fdf4';
                                                        borderColor = '#bbf7d0';
                                                        textColor = '#166534';
                                                        descColor = '#15803d';
                                                        statusText = 'Completed';
                                                        statusColor = '#15803d';
                                                        statusBg = '#dcfce7';
                                                    } else if (status === 'ONGOING') {
                                                        bgColor = '#eff6ff';
                                                        borderColor = '#bfdbfe';
                                                        textColor = '#1e40af';
                                                        descColor = '#2563eb';
                                                        statusText = 'Scanning';
                                                        statusColor = '#2563eb';
                                                        statusBg = '#dbeafe';
                                                    }

                                                    return (
                                                        <div
                                                            key={bag.bagNumber}
                                                            onClick={() => {
                                                                if (status !== 'COMPLETED') {
                                                                    setFirstScanSelectedBag(bag.bagNumber);
                                                                    // Refocus scan input
                                                                    setTimeout(() => firstScanInputRef.current?.focus(), 50);
                                                                }
                                                            }}
                                                            style={{
                                                                backgroundColor: bgColor,
                                                                border: `1px solid ${borderColor}`,
                                                                borderRadius: '8px',
                                                                padding: '12px 14px',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                boxShadow: status === 'ONGOING' ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none',
                                                                cursor: status === 'COMPLETED' ? 'default' : 'pointer',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <span style={{ fontWeight: '700', fontSize: '13px', color: textColor }}>
                                                                    Bag: {bag.bagNumber}
                                                                </span>
                                                                <span style={{ fontSize: '11px', color: descColor }}>
                                                                    {status === 'COMPLETED' 
                                                                        ? 'Unsealed successfully'
                                                                        : status === 'ONGOING'
                                                                            ? `${remaining} parcels remaining`
                                                                            : `Awaiting unsealing (${expected} expected)`
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontWeight: '700', fontSize: '12px', color: textColor }}>
                                                                    {scanned} / {expected}
                                                                </span>
                                                                <span style={{
                                                                    backgroundColor: statusBg,
                                                                    color: statusColor,
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '9px',
                                                                    fontWeight: '700',
                                                                    textTransform: 'uppercase'
                                                                }}>
                                                                    {statusText}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Live Discrepancy & Verification Dashboard Card */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Assigned Partner Card */}
                                        <div style={{
                                            ...card,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '36px 20px',
                                            minHeight: '220px',
                                            border: firstScanCurrentScan?.assignedPartner
                                                ? firstScanCurrentScan.assignedPartner === 'PickMe'
                                                    ? '3px solid #ffcc00'
                                                    : firstScanCurrentScan.assignedPartner === 'Domex'
                                                        ? '3px solid #7b0f1a'
                                                        : '3px solid #ea580c'
                                                : '1px solid #e5e7eb',
                                            backgroundColor: firstScanCurrentScan?.assignedPartner
                                                ? firstScanCurrentScan.assignedPartner === 'PickMe'
                                                    ? '#ffcc00'
                                                    : firstScanCurrentScan.assignedPartner === 'Domex'
                                                        ? '#7b0f1a'
                                                        : '#ea580c'
                                                : '#ffffff',
                                            color: firstScanCurrentScan?.assignedPartner
                                                ? firstScanCurrentScan.assignedPartner === 'PickMe'
                                                    ? '#000000'
                                                    : '#ffffff'
                                                : '#111827',
                                            transition: 'all 0.2s ease-in-out'
                                        }}>
                                            <div style={{
                                                ...label,
                                                marginBottom: '20px',
                                                fontSize: '13px',
                                                color: firstScanCurrentScan?.assignedPartner
                                                    ? firstScanCurrentScan.assignedPartner === 'PickMe' ? '#000000' : '#ffffff'
                                                    : '#6b7280'
                                            }}>
                                                Assigned Partner
                                            </div>
                                            {firstScanCurrentScan?.assignedPartner ? (
                                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                                    {/* Logo Container */}
                                                    <div style={{
                                                        backgroundColor: '#ffffff',
                                                        padding: '12px 24px',
                                                        borderRadius: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        height: '110px',
                                                        width: '280px',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                                    }}>
                                                        {firstScanCurrentScan.assignedPartner === 'PickMe' ? (
                                                            <img src="/pick_me_logo.png" alt="PickMe" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                        ) : firstScanCurrentScan.assignedPartner === 'Domex' ? (
                                                            <img src="/domex_logo.png" alt="Domex" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                        ) : (
                                                            <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '28px', letterSpacing: '1px' }}>PRONTO</span>
                                                        )}
                                                    </div>

                                                    {/* Zone Badge */}
                                                    <div style={{
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        color: firstScanCurrentScan.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                        backgroundColor: firstScanCurrentScan.assignedPartner === 'PickMe' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)',
                                                        padding: '6px 20px',
                                                        borderRadius: '20px',
                                                        border: firstScanCurrentScan.assignedPartner === 'PickMe' ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
                                                        display: 'inline-block'
                                                    }}>
                                                        Zone: <span style={{ fontWeight: '800' }}>{firstScanCurrentScan.assignedZone || '—'}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                        <line x1="12" y1="22.08" x2="12" y2="12" />
                                                    </svg>
                                                    <span style={{ fontSize: '15px', fontWeight: '500', marginTop: '4px' }}>
                                                        Awaiting barcode scan...
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={card}>
                                            <div style={{ ...label, marginBottom: '16px' }}>
                                                COUNT VERIFICATION
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                                                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Expected</div>
                                                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
                                                        {firstScanExpected === '' ? '—' : firstScanExpected}
                                                    </div>
                                                </div>
                                                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Scanned</div>
                                                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
                                                        {firstScanHistory.length}
                                                    </div>
                                                </div>
                                            </div>

                                            {firstScanExpected !== '' && (
                                                <div style={{
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: firstScanHistory.length === firstScanExpected
                                                        ? '#047857'
                                                        : firstScanHistory.length < firstScanExpected
                                                            ? '#1d4ed8'
                                                            : '#dc2626',
                                                    marginTop: '8px',
                                                    textAlign: 'center'
                                                }}>
                                                    {firstScanHistory.length === firstScanExpected
                                                        ? '✓ Counts Match!'
                                                        : firstScanHistory.length < firstScanExpected
                                                            ? `Remaining: ${Number(firstScanExpected) - firstScanHistory.length} left`
                                                            : `Surplus: ${firstScanHistory.length - Number(firstScanExpected)} extra`}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                                <button
                                                    onClick={() => {
                                                        setConfirmFinishModal(true);
                                                    }}
                                                    disabled={firstScanHistory.length === 0 || firstScanExpected === '' || firstScanHistory.length !== firstScanExpected}
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: '#1f2937',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '10px',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        cursor: (firstScanHistory.length === 0 || firstScanExpected === '' || firstScanHistory.length !== firstScanExpected) ? 'not-allowed' : 'pointer',
                                                        opacity: (firstScanHistory.length === 0 || firstScanExpected === '' || firstScanHistory.length !== firstScanExpected) ? 0.5 : 1,
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    Finish Box (Save & Close)
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm("Clear all scanned records for this box?")) {
                                                            handleClearFirstScan();
                                                        }
                                                    }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #d1d5db',
                                                        color: '#374151',
                                                        borderRadius: '6px',
                                                        padding: '10px 14px',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                    TAB 2 — LMD ALLOCATION (SECOND SCAN)
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'second-scan' && (
                        <div>

                            {status === 'ERROR' && (
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Scan Failed: {errorMessage}
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                                {/* Barcode Input Card */}
                                <div style={card}>
                                    <div style={label}>Barcode Input</div>
                                    <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                                        <input
                                            ref={scanInputRef}
                                            type="text"
                                            value={barcodeInput}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (lastScanned && val.startsWith(lastScanned) && val.length > lastScanned.length) {
                                                    setBarcodeInput(val.slice(lastScanned.length));
                                                    setLastScanned('');
                                                } else {
                                                    setBarcodeInput(val);
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="Scan or type barcode..."
                                            className="scan-input-blink"
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                    </form>
                                    {rowItem('Manifest', currentScan?.parcel?.mawbRef || '—')}
                                    {rowItem('Scanned today', <span style={{ color: '#e21b22', fontWeight: '700' }}>{scannedToday}</span>, true)}
                                </div>

                                {/* Assigned Partner Card */}
                                <div style={{
                                    ...card,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '36px 20px',
                                    minHeight: '220px',
                                    border: currentScan?.assignedPartner
                                        ? currentScan.assignedPartner === 'PickMe'
                                            ? '3px solid #ffcc00'
                                            : currentScan.assignedPartner === 'Domex'
                                                ? '3px solid #7b0f1a'
                                                : '3px solid #ea580c'
                                        : '1px solid #e5e7eb',
                                    backgroundColor: currentScan?.assignedPartner
                                        ? currentScan.assignedPartner === 'PickMe'
                                            ? '#ffcc00'
                                            : currentScan.assignedPartner === 'Domex'
                                                ? '#7b0f1a'
                                                : '#ea580c'
                                        : '#ffffff',
                                    color: currentScan?.assignedPartner
                                        ? currentScan.assignedPartner === 'PickMe'
                                            ? '#000000'
                                            : '#ffffff'
                                        : '#111827',
                                    transition: 'all 0.2s ease-in-out'
                                }}>
                                    <div style={{
                                        ...label,
                                        marginBottom: '20px',
                                        fontSize: '13px',
                                        color: currentScan?.assignedPartner
                                            ? currentScan.assignedPartner === 'PickMe' ? '#000000' : '#ffffff'
                                            : '#6b7280'
                                    }}>
                                        Assigned Partner
                                    </div>
                                    {currentScan?.assignedPartner ? (
                                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                            {/* Logo Container */}
                                            <div style={{
                                                backgroundColor: '#ffffff',
                                                padding: '12px 24px',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '110px',
                                                width: '280px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                            }}>
                                                {currentScan.assignedPartner === 'PickMe' ? (
                                                    <img src="/pick_me_logo.png" alt="PickMe" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                ) : currentScan.assignedPartner === 'Domex' ? (
                                                    <img src="/domex_logo.png" alt="Domex" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '28px', letterSpacing: '1px' }}>PRONTO</span>
                                                )}
                                            </div>

                                            {/* Zone Badge */}
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: '600',
                                                color: currentScan.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                backgroundColor: currentScan.assignedPartner === 'PickMe' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)',
                                                padding: '6px 20px',
                                                borderRadius: '20px',
                                                border: currentScan.assignedPartner === 'PickMe' ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
                                                display: 'inline-block'
                                            }}>
                                                Zone: <span style={{ fontWeight: '800' }}>{currentScan.assignedZone || '—'}</span>
                                            </div>

                                            {/* Missed First Scan Alert Badge */}
                                            {currentScan.missedFirstScan && (
                                                <div style={{
                                                    fontSize: '13px',
                                                    fontWeight: '800',
                                                    color: '#ffffff',
                                                    backgroundColor: '#dc2626',
                                                    border: '1px solid #ffffff',
                                                    padding: '6px 16px',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}>
                                                    <span>⚠️ MISSED 1ST SCAN (AUTO RECORDED)</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                <line x1="12" y1="22.08" x2="12" y2="12" />
                                            </svg>
                                            <span style={{ fontSize: '15px', fontWeight: '500', marginTop: '4px' }}>
                                                Awaiting barcode scan...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recent Scans Table */}
                            <div style={card}>
                                <div style={label}>Recent Scans & History</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            {['Status', 'Tracking no.', 'Consignee', 'LMD Partner', 'Zone', 'City'].map(h => (
                                                <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item, idx) => {
                                            const isLatest = idx === 0;
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: isLatest ? '#fff1f2' : 'transparent' }}>
                                                    <td style={{ padding: '10px 8px' }}>
                                                        {isLatest ? (
                                                            <span style={{ backgroundColor: '#e21b22', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                                                Current
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                                                                Scanned
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.parcel?.trackingNumber}</td>
                                                    <td style={{ padding: '10px 8px', color: '#374151' }}>{item.parcel?.recipientName}</td>
                                                    <td style={{ padding: '10px 8px' }}>
                                                        <span style={{
                                                            backgroundColor: item.assignedPartner === 'PickMe'
                                                                ? '#ffcc00'
                                                                : item.assignedPartner === 'Domex'
                                                                    ? '#7b0f1a'
                                                                    : '#ea580c',
                                                            color: item.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                            padding: '3px 8px',
                                                            borderRadius: '4px',
                                                            fontWeight: '700',
                                                            fontSize: '11px',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {item.assignedPartner}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', color: '#374151' }}>{item.assignedZone}</td>
                                                    <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.parcel?.city}</td>
                                                </tr>
                                            );
                                        })}
                                        {history.length === 0 && (
                                            <tr><td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>No scans in this session.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                    TAB: DAMAGED SKYNET (TEMU SCAN)
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'damaged-barcode' && (
                        <div>

                            {damagedStatus === 'ERROR' && (
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Scan Failed: {damagedErrorMessage}
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                                {/* Barcode Input Card */}
                                <div style={card}>
                                    <div style={label}>Damaged Label (Temu Barcode) Input</div>
                                    <form onSubmit={handleDamagedScanSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                                        <input
                                            ref={damagedInputRef}
                                            type="text"
                                            value={damagedBarcodeInput}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (damagedLastScanned && val.startsWith(damagedLastScanned) && val.length > damagedLastScanned.length) {
                                                    setDamagedBarcodeInput(val.slice(damagedLastScanned.length));
                                                    setDamagedLastScanned('');
                                                } else {
                                                    setDamagedBarcodeInput(val);
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="Scan Temu barcode (e.g. BG-...)..."
                                            className="scan-input-blink"
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                    </form>
                                    {rowItem('Manifest', damagedCurrentScan?.parcel?.mawbRef || '—')}
                                    {rowItem('Scanned today', <span style={{ color: '#e21b22', fontWeight: '700' }}>{scannedToday}</span>, true)}

                                </div>

                                {/* Assigned Partner & Resolved Skynet tracking Card */}
                                <div style={{
                                    ...card,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '36px 20px',
                                    minHeight: '260px',
                                    border: damagedCurrentScan?.assignedPartner
                                        ? damagedCurrentScan.assignedPartner === 'PickMe'
                                            ? '3px solid #ffcc00'
                                            : damagedCurrentScan.assignedPartner === 'Domex'
                                                ? '3px solid #7b0f1a'
                                                : '3px solid #ea580c'
                                        : '1px solid #e5e7eb',
                                    backgroundColor: damagedCurrentScan?.assignedPartner
                                        ? damagedCurrentScan.assignedPartner === 'PickMe'
                                            ? '#ffcc00'
                                            : damagedCurrentScan.assignedPartner === 'Domex'
                                                ? '#7b0f1a'
                                                : '#ea580c'
                                        : '#ffffff',
                                    color: damagedCurrentScan?.assignedPartner
                                        ? damagedCurrentScan.assignedPartner === 'PickMe'
                                            ? '#000000'
                                            : '#ffffff'
                                        : '#111827',
                                    transition: 'all 0.2s ease-in-out'
                                }}>
                                    <div style={{
                                        ...label,
                                        marginBottom: '20px',
                                        fontSize: '13px',
                                        color: damagedCurrentScan?.assignedPartner
                                            ? damagedCurrentScan.assignedPartner === 'PickMe' ? '#000000' : '#ffffff'
                                            : '#6b7280'
                                    }}>
                                        Assigned Partner
                                    </div>
                                    {damagedCurrentScan?.assignedPartner ? (
                                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                            {/* Resolved Skynet ID Alert Banner */}
                                            <div style={{
                                                backgroundColor: '#ffffff',
                                                color: '#111827',
                                                padding: '10px 20px',
                                                borderRadius: '8px',
                                                border: '1px solid #d1d5db',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>Skynet Tracking Number</span>
                                                <span style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '1px', color: '#dc2626' }}>
                                                    {damagedCurrentScan.parcel?.trackingNumber}
                                                </span>
                                            </div>

                                            {/* Logo Container */}
                                            <div style={{
                                                backgroundColor: '#ffffff',
                                                padding: '12px 24px',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '100px',
                                                width: '280px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                            }}>
                                                {damagedCurrentScan.assignedPartner === 'PickMe' ? (
                                                    <img src="/pick_me_logo.png" alt="PickMe" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                ) : damagedCurrentScan.assignedPartner === 'Domex' ? (
                                                    <img src="/domex_logo.png" alt="Domex" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '28px', letterSpacing: '1px' }}>PRONTO</span>
                                                )}
                                            </div>

                                            {/* Zone Badge */}
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: '600',
                                                color: damagedCurrentScan.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                backgroundColor: damagedCurrentScan.assignedPartner === 'PickMe' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)',
                                                padding: '6px 20px',
                                                borderRadius: '20px',
                                                border: damagedCurrentScan.assignedPartner === 'PickMe' ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
                                                display: 'inline-block'
                                            }}>
                                                Zone: <span style={{ fontWeight: '800' }}>{damagedCurrentScan.assignedZone || '—'}</span>
                                            </div>

                                            {/* Missed First Scan Alert Badge */}
                                            {damagedCurrentScan.missedFirstScan && (
                                                <div style={{
                                                    fontSize: '13px',
                                                    fontWeight: '800',
                                                    color: '#ffffff',
                                                    backgroundColor: '#dc2626',
                                                    border: '1px solid #ffffff',
                                                    padding: '6px 16px',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}>
                                                    <span>⚠️ MISSED 1ST SCAN (AUTO RECORDED)</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                <line x1="12" y1="22.08" x2="12" y2="12" />
                                            </svg>
                                            <span style={{ fontSize: '15px', fontWeight: '500', marginTop: '4px' }}>
                                                Awaiting Temu barcode scan...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Display Detailed Info Card when resolved */}
                            {damagedCurrentScan && damagedCurrentScan.parcel && (
                                <div style={{ ...card, marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '14px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: '700' }}>Resolved Parcel Details</h3>
                                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Temu barcode: {damagedCurrentScan.parcel.senderReference || '—'}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={handleChangeLMDDamaged} style={btnSecondary}>
                                                Change LMD Partner
                                            </button>
                                            <button onClick={handleConfirmDispatchDamaged} style={btnPrimary}>
                                                Confirm Dispatch
                                            </button>
                                            <button onClick={handleClearDamagedScan} style={btnDanger}>
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    {parcelDetailsGrid(damagedCurrentScan.parcel)}
                                </div>
                            )}

                            {/* Recent Scans Table */}
                            <div style={card}>
                                <div style={label}>Recent Damaged Scans History</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            {['Status', 'Skynet Tracking no.', 'Temu Barcode', 'Consignee', 'LMD Partner', 'Zone', 'City'].map(h => (
                                                <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {damagedHistory.map((item, idx) => {
                                            const isLatest = idx === 0;
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: isLatest ? '#fff1f2' : 'transparent' }}>
                                                    <td style={{ padding: '10px 8px' }}>
                                                        {isLatest ? (
                                                            <span style={{ backgroundColor: '#e21b22', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                                                Current
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                                                                Scanned
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px 8px', fontWeight: '600', color: '#dc2626' }}>{item.parcel?.trackingNumber}</td>
                                                    <td style={{ padding: '10px 8px', fontWeight: '500', color: '#111827' }}>{item.parcel?.senderReference}</td>
                                                    <td style={{ padding: '10px 8px', color: '#374151' }}>{item.parcel?.recipientName}</td>
                                                    <td style={{ padding: '10px 8px' }}>
                                                        <span style={{
                                                            backgroundColor: item.assignedPartner === 'PickMe'
                                                                ? '#ffcc00'
                                                                : item.assignedPartner === 'Domex'
                                                                    ? '#7b0f1a'
                                                                    : '#ea580c',
                                                            color: item.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                            padding: '3px 8px',
                                                            borderRadius: '4px',
                                                            fontWeight: '700',
                                                            fontSize: '11px',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {item.assignedPartner}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 8px', color: '#374151' }}>{item.assignedZone}</td>
                                                    <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.parcel?.city}</td>
                                                </tr>
                                            );
                                        })}
                                        {damagedHistory.length === 0 && (
                                            <tr><td colSpan={7} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>No scans in this session.</td></tr>
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
                                    { count: verifiedCount, label: 'Verified', color: '#111827', bg: '#ffffff', border: '#e5e7eb', success: true },
                                    { count: mismatchCount, label: 'Mismatches', color: '#e21b22', bg: '#fff1f2', border: '#fca5a5' },
                                    { count: pendingDispatch, label: 'Pending dispatch', color: '#111827', bg: '#ffffff', border: '#e5e7eb' }
                                ].map(({ count, label: lbl, color, bg, border, success }) => (
                                    <div key={lbl} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '18px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', position: 'relative' }}>
                                        {success && (
                                            <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                                        )}
                                        <div style={{ fontSize: '32px', fontWeight: '700', color, marginBottom: '4px' }}>{count}</div>
                                        <div style={{ fontSize: '12px', color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{lbl}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Step 1: Select Bin */}
                            <div style={{ ...card, marginBottom: '16px' }}>
                                <div style={label}>Select Active Dispatch Bin</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                    {(['PickMe', 'Domex'] as const).map((bin) => (
                                        <button
                                            key={bin}
                                            onClick={() => setSelectedBin(bin)}
                                            style={{
                                                backgroundColor: selectedBin === bin
                                                    ? bin === 'PickMe'
                                                        ? '#ffcc00'
                                                        : bin === 'Domex'
                                                            ? '#7b0f1a'
                                                            : '#ea580c'
                                                    : '#f9fafb',
                                                color: selectedBin === bin
                                                    ? bin === 'PickMe' ? '#000000' : '#ffffff'
                                                    : '#111827',
                                                border: selectedBin === bin
                                                    ? bin === 'PickMe'
                                                        ? '2px solid #ffcc00'
                                                        : bin === 'Domex'
                                                            ? '2px solid #7b0f1a'
                                                            : '2px solid #ea580c'
                                                    : '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                padding: '16px',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                {bin === 'PickMe' && (
                                                    <div style={{
                                                        backgroundColor: '#ffffff',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        height: '24px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '80px'
                                                    }}>
                                                        <img src="/pick_me_logo.png" alt="PickMe" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                    </div>
                                                )}
                                                {bin === 'Domex' && (
                                                    <div style={{
                                                        backgroundColor: '#ffffff',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        height: '24px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '80px'
                                                    }}>
                                                        <img src="/domex_logo.png" alt="Domex" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                                                    {binCounts[bin] === 0 ? 'Empty' : `${binCounts[bin]} parcels`}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notice Banner */}
                            <div style={{
                                border: '1px dashed #d1d5db',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                marginBottom: '16px',
                                fontSize: '13px',
                                color: selectedBin
                                    ? selectedBin === 'PickMe'
                                        ? '#854d0e' // dark yellow
                                        : selectedBin === 'Domex'
                                            ? '#1e40af' // dark blue
                                            : '#c2410c' // dark orange
                                    : '#b45309',
                                backgroundColor: selectedBin
                                    ? selectedBin === 'PickMe'
                                        ? '#fef9c3' // light yellow
                                        : selectedBin === 'Domex'
                                            ? '#dbeafe' // light blue
                                            : '#ffedd5' // light orange
                                    : '#fffbeb',
                                fontWeight: '500'
                            }}>
                                {selectedBin ? `Active bin: ${selectedBin} — Scan barcodes below to verify routing.` : 'Select a dispatch bin first, then scan parcels'}
                            </div>

                            {/* Step 2: Scan + Log */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                {/* Scan Card */}
                                <div style={card}>
                                    <div style={label}> Scan Parcel Barcode</div>
                                    <form onSubmit={handleVerifySubmit} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                                        <input
                                            ref={verifyInputRef}
                                            type="text"
                                            value={verifyBarcodeInput}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (lastVerifyScanned && val.startsWith(lastVerifyScanned) && val.length > lastVerifyScanned.length) {
                                                    setVerifyBarcodeInput(val.slice(lastVerifyScanned.length));
                                                    setLastVerifyScanned('');
                                                } else {
                                                    setVerifyBarcodeInput(val);
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            placeholder={selectedBin ? 'Scan barcode...' : 'Select a bin first...'}
                                            disabled={!selectedBin}
                                            className={!selectedBin ? '' : 'scan-input-blink'}
                                            style={{ ...inputStyle, flex: 1, backgroundColor: selectedBin ? '#f9fafb' : '#f3f4f6', cursor: selectedBin ? 'text' : 'not-allowed' }}
                                        />
                                    </form>
                                    {rowItem('Active bin', <span style={{ color: selectedBin ? '#15803d' : '#b45309', fontWeight: '700' }}>{selectedBin || 'None selected'}</span>)}
                                    {rowItem('Last scanned', verifyScan?.parcel?.trackingNumber || '—')}
                                    {rowItem('Assigned to', verifyScan?.assignedPartner || '—')}
                                    {rowItem('Destination', verifyScan?.parcel?.city || '—')}
                                    {rowItem('Result',
                                        <span style={{ color: verifyStatus === 'MATCH' ? '#15803d' : verifyStatus === 'MISMATCH' ? '#dc2626' : '#374151', fontWeight: '700' }}>
                                            {verifyStatus === 'MATCH' ? 'MATCH' : verifyStatus === 'MISMATCH' ? 'MISMATCH' : '—'}
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
                                            {verifyStatus === 'MATCH' ? 'Match Approved' : 'Mismatch Warning'}
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
                                        Print manifest
                                    </button>
                                    <button
                                        onClick={() => {
                                            alert(`Dispatch confirmed for ${verifiedCount} parcels!`);
                                            setVerifiedCount(0); setVerifyScan(null); setVerifyStatus('READY'); setVerifyHistory([]);
                                        }}
                                        disabled={verifiedCount === 0}
                                        style={{ ...btnPrimary, opacity: verifiedCount > 0 ? 1 : 0.5, cursor: verifiedCount > 0 ? 'pointer' : 'not-allowed' }}
                                    >
                                        Confirm dispatch
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                    TAB 3 — ZONE CONFIG (Disabled)
                ═══════════════════════════════════════════════════════ */}
                    {false && activeTab === 'config' && (
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
                                        {config.zoneMappings.length === 0 && (
                                            <tr>
                                                <td colSpan={3} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                                    No zone mappings configured yet. Add your first zone below.
                                                </td>
                                            </tr>
                                        )}
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
                                                        <span style={{ color: '#374151', width: '60px' }}>{rule.partnerCode}</span>
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
                                    {Object.keys(config.allocationRules).length === 0 && (
                                        <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px' }}>
                                            No allocation rules configured yet. Add zone mappings first, then rules will appear here.
                                        </p>
                                    )}
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                {[
                                    { count: history.length + verifyHistory.length, lbl: 'Total Operations', color: '#e21b22', bg: '#ffffff', border: '#e21b22' },
                                    { count: history.filter(h => h.assignedPartner === 'PickMe').length, lbl: 'PickMe Allocated', color: '#000000', bg: '#ffcc00', border: '#ffcc00' },
                                    { count: history.filter(h => h.assignedPartner === 'Domex').length, lbl: 'Domex Allocated', color: '#ffffff', bg: '#7b0f1a', border: '#7b0f1a' }
                                ].map(({ count, lbl, color, bg, border }) => (
                                    <div key={lbl} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ fontSize: '28px', fontWeight: '700', color, marginBottom: '4px' }}>{count}</div>
                                        <div style={{ fontSize: '11px', color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', opacity: 0.9 }}>{lbl}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Unsealed Boxes Summary */}
                            <div style={{ ...card, marginBottom: '20px' }}>
                                <div style={label}>Box Unsealing Session Summary (1st Scan)</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            {['Timestamp', 'MAWB Ref', 'Bag Number', 'Expected Count', 'Actual Scanned', 'Discrepancy', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unsealedBoxes.map((box, idx) => {
                                            const diff = box.scanned - box.expected;
                                            return (
                                                <tr key={`box-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '8px', color: '#6b7280' }}>{box.timestamp}</td>
                                                    <td style={{ padding: '8px', fontWeight: '600', color: '#111827' }}>{box.mawb}</td>
                                                    <td style={{ padding: '8px', fontWeight: '700', color: '#4b5563' }}>{box.bagNumber || '—'}</td>
                                                    <td style={{ padding: '8px', color: '#374151' }}>{box.expected}</td>
                                                    <td style={{ padding: '8px', color: '#374151' }}>{box.scanned}</td>
                                                    <td style={{ padding: '8px', fontWeight: '700', color: diff === 0 ? '#10b981' : '#dc2626' }}>
                                                        {diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`}
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span style={{
                                                            backgroundColor: diff === 0 ? '#ecfdf5' : '#fef2f2',
                                                            color: diff === 0 ? '#047857' : '#dc2626',
                                                            border: diff === 0 ? '1px solid #a7f3d0' : '1px solid #fca5a5',
                                                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600'
                                                        }}>
                                                            {diff === 0 ? 'Counted' : 'Discrepancy'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {unsealedBoxes.length === 0 && (
                                            <tr>
                                                <td colSpan={7} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
                                                    No finished unsealing sessions yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
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
                                                <td style={{ padding: '10px 8px' }}><span style={{ backgroundColor: '#e21b22', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Allocation</span></td>
                                                <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.parcel?.trackingNumber}</td>
                                                <td style={{ padding: '10px 8px', color: '#374151' }}>{item.parcel?.recipientName}</td>
                                                <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.assignedPartner}</td>
                                                <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.parcel?.city}</td>
                                                <td style={{ padding: '10px 8px' }}>
                                                    {item.missedFirstScan ? (
                                                        <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>
                                                            Missed 1st Scan
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#e21b22', fontWeight: '500' }}>Allocated</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {verifyHistory.map((item, idx) => (
                                            <tr key={`verify-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '10px 8px' }}><span style={{ backgroundColor: '#111827', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Verification</span></td>
                                                <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.trackingNumber}</td>
                                                <td style={{ padding: '10px 8px', color: '#374151' }}>{item.recipientName || '—'}</td>
                                                <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.assignedPartner}</td>
                                                <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.city || '—'}</td>
                                                <td style={{ padding: '10px 8px', color: item.isMatch ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                                                    {item.isMatch ? 'Matched' : 'Mismatch'}
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
                </main>
            </div>





            {/* ── DEVICE MANAGER MODAL ── */}
            {isDeviceManagerOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1100,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%', maxWidth: '580px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px 20px', borderBottom: '1px solid #e5e7eb'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: '#111827' }}>
                                    Workstation Device Manager
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                                    Manage barcode readers and hardware scanner wedge connection
                                </p>
                            </div>
                            <button
                                onClick={() => { setIsDeviceManagerOpen(false); handleClearTestInput(); }}
                                style={{
                                    backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px',
                                    width: '32px', height: '32px', cursor: 'pointer',
                                    fontSize: '16px', color: '#6b7280',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >✕</button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '24px 20px', minHeight: '260px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: '#4b5563' }}>
                                    Rugged Handheld Terminals (RTD / PDT) and standard USB/Bluetooth barcode readers operate in <strong>Keyboard Wedge</strong> mode. They intercept scans and type them directly into the focused field, followed by an <code>Enter</code> code.
                                </p>

                                <div style={{
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    border: '1px solid #e5e7eb'
                                }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Scanner Hardware Connection Tester
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <input
                                            type="text"
                                            value={testScannerInput}
                                            onChange={(e) => setTestScannerInput(e.target.value)}
                                            onKeyDown={handleTestScannerKeyDown}
                                            placeholder="Pull trigger to scan a barcode here..."
                                            style={{ ...inputStyle, flex: 1, backgroundColor: '#ffffff' }}
                                        />
                                        <button
                                            onClick={handleClearTestInput}
                                            style={{ ...btnSecondary, padding: '9px 14px' }}
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {testScannerSpeed && (
                                        <div style={{
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            backgroundColor: testScannerSpeed.includes('Verified') ? '#ecfdf5' : '#fffbeb',
                                            color: testScannerSpeed.includes('Verified') ? '#047857' : '#b45309',
                                            border: testScannerSpeed.includes('Verified') ? '1px solid #a7f3d0' : '1px solid #fde68a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span style={{
                                                width: '6px', height: '6px', borderRadius: '50%',
                                                backgroundColor: testScannerSpeed.includes('Verified') ? '#10b981' : '#f59e0b'
                                            }}></span>
                                            {testScannerSpeed}
                                        </div>
                                    )}
                                </div>

                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Setup Instructions:</div>
                                    <ol style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <li>Ensure the RTD machine is powered on and connected to the network or workstation.</li>
                                        <li>Open the scanner tool on the RTD (e.g. Zebra DataWedge, Honeywell Scanner) and verify that <strong>Keystroke Output / Keyboard Wedge</strong> is enabled.</li>
                                        <li>Keep the main dashboard window active. Scan any package to allocate or verify instantly.</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '14px 20px',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex', justifyContent: 'flex-end',
                            backgroundColor: '#f9fafb'
                        }}>
                            <button
                                onClick={() => { setIsDeviceManagerOpen(false); handleClearTestInput(); }}
                                style={{ ...btnPrimary }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DUPLICATE SCAN MODAL ── */}
            {duplicateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 3000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22', // Light border around the popup box in red
                        //borderTop: '6px solid #e21b22', // SkyNet Red top accent
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '450px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center'
                    }}>
                        {/* Warning Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#e21b22',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>
                            Duplicate Scan Detected
                        </h3>

                        {/* Content Message */}
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                            Barcode <strong style={{ color: '#111827', fontSize: '15px', backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                {duplicateModal.barcode}
                            </strong> has already been {duplicateModal.type === 'allocate' ? 'scanned and allocated' : 'verified'} today!
                        </p>

                        {/* Dismiss Action Button */}
                        <button
                            onClick={() => {
                                setDuplicateModal(null);
                                setTimeout(() => {
                                    if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                                    else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                                    else if (activeTab === 'verify') verifyInputRef.current?.focus();
                                }, 50);
                            }}
                            style={{
                                backgroundColor: '#e21b22', // Red button background instead of black
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 24px',
                                fontSize: '14px',
                                fontWeight: '600',
                                width: '100%',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }} // Darker red on hover
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e21b22'; }}
                        >
                            Acknowledge (Press Enter)
                        </button>
                    </div>
                </div>
            )}

            {/* ── CONFIRM FINISH MODAL ── */}
            {confirmFinishModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 3000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '450px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center'
                    }}>
                        {/* Question Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#e21b22',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>
                            Finish Box Session?
                        </h3>

                        {/* Content Message */}
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                            Are you sure you want to finish and close this box session? This will lock the current count of <strong style={{ color: '#111827' }}>{firstScanHistory.length}</strong> scanned parcels for MAWB <strong style={{ color: '#111827' }}>{firstScanMawb}</strong>.
                        </p>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleConfirmFinish}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px 18px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e21b22'; }}
                            >
                                Yes, Finish Box (Enter)
                            </button>
                            <button
                                onClick={() => {
                                    setConfirmFinishModal(false);
                                    setTimeout(() => {
                                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                                    }, 50);
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '12px 18px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                            >
                                Cancel (Esc)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SUCCESS MODAL ── */}
            {successModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 3000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #16a34a', // Green theme border
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '450px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center'
                    }}>
                        {/* Checkmark Icon */}
                        <div style={{
                            backgroundColor: '#d1fae5',
                            color: '#16a34a',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>
                            {successModal.title}
                        </h3>

                        {/* Content Message */}
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                            {successModal.message}
                        </p>

                        {/* Action button */}
                        <button
                            onClick={() => {
                                setSuccessModal(null);
                                setTimeout(() => {
                                    if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                                    else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                                    else if (activeTab === 'verify') verifyInputRef.current?.focus();
                                }, 50);
                            }}
                            style={{
                                backgroundColor: '#16a34a', // Green primary button
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 24px',
                                fontSize: '14px',
                                fontWeight: '600',
                                width: '100%',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#15803d'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#16a34a'; }}
                        >
                            Acknowledge (Press Enter)
                        </button>
                    </div>
                </div>
            )}

            {/* Custom animations for dashboard image scanner */}
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