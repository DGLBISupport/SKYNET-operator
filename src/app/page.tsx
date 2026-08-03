'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AllocationResponse, SkyNetParcelData } from '@/types';
import { toast } from 'sonner';
import TrackingTab from '@/app/components/TrackingTab';

// SVG Code 128 Barcode Generator
function generateCode128SVG(text: string): string {
    const code128Patterns: { [key: number]: string } = {
        0: "212222", 1: "222122", 2: "222221", 3: "121223", 4: "121322", 5: "131222", 6: "122213", 7: "122312", 8: "132212", 9: "221213",
        10: "221312", 11: "231212", 12: "112232", 13: "122132", 14: "122231", 15: "113222", 16: "123122", 17: "123221", 18: "223211", 19: "221132",
        20: "221231", 21: "213212", 22: "223112", 23: "312131", 24: "311222", 25: "321122", 26: "321221", 27: "312212", 28: "322112", 29: "322211",
        30: "212123", 31: "212321", 32: "232121", 33: "111323", 34: "131123", 35: "131321", 36: "112313", 37: "132113", 38: "132311", 39: "211313",
        40: "231113", 41: "231311", 42: "112133", 43: "112331", 44: "132131", 45: "113123", 46: "113321", 47: "133121", 48: "313121", 49: "211331",
        50: "231131", 51: "213113", 52: "213311", 53: "213131", 54: "311123", 55: "311321", 56: "331121", 57: "312113", 58: "312311", 59: "332111",
        60: "314111", 61: "221411", 62: "431111", 63: "111224", 64: "111422", 65: "121124", 66: "121421", 67: "141122", 68: "141221", 69: "112214",
        70: "112412", 71: "122114", 72: "122411", 73: "142112", 74: "142411", 75: "241211", 76: "221114", 77: "413111", 78: "241112", 79: "134111",
        80: "111242", 81: "121142", 82: "121241", 83: "114212", 84: "124112", 85: "124211", 86: "411212", 87: "421112", 88: "421211", 89: "212141",
        90: "214121", 91: "412121", 92: "111143", 93: "111341", 94: "131141", 95: "114113", 96: "114311", 97: "411113", 98: "411311", 99: "113141",
        100: "114131", 101: "311141", 102: "411131", 103: "211412", 104: "211214", 105: "211232"
    };

    let checksum = 104;
    let patternStr = code128Patterns[104];
    const cleanText = (text || '000000').trim();
    for (let i = 0; i < cleanText.length; i++) {
        const code = cleanText.charCodeAt(i) - 32;
        const validCode = (code >= 0 && code <= 95) ? code : 0;
        checksum += validCode * (i + 1);
        patternStr += code128Patterns[validCode] || code128Patterns[0];
    }
    const checkValue = checksum % 103;
    patternStr += code128Patterns[checkValue];
    patternStr += "2331112";

    let x = 10;
    const rects: string[] = [];
    let isBar = true;
    for (let i = 0; i < patternStr.length; i++) {
        const width = parseInt(patternStr[i], 10) * 2;
        if (isBar) {
            rects.push(`<rect x="${x}" y="0" width="${width}" height="60" fill="black" />`);
        }
        x += width;
        isBar = !isBar;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} 60" width="100%" height="60" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

function extractLatestBarcode(rawInput: string): string {
    if (!rawInput) return '';
    let clean = rawInput.trim();
    // If input contains concatenated tracking numbers (e.g. 710283381872710283381883...)
    if (clean.length >= 24 && /^\d+$/.test(clean)) {
        if (clean.length % 12 === 0) {
            clean = clean.slice(-12);
        } else if (clean.length % 15 === 0) {
            clean = clean.slice(-15);
        } else {
            clean = clean.slice(-12);
        }
    }
    return clean;
}

function resolvePartnerName(bag: any): string {
    if (!bag) return 'LMD Delivery Partner';
    let p = bag.targetPartner || bag.partner;
    if (!p || p === 'ALL') {
        const bn = (bag.bagNumber || '').toUpperCase();
        if (bn.includes('PICKME')) p = 'PickMe';
        else if (bn.includes('DOMEX')) p = 'Domex';
        else if (bn.includes('PRONTO')) p = 'Pronto';
        else if (bag.parcels && bag.parcels.length > 0) {
            const firstP = bag.parcels[0];
            p = firstP.assignedPartner || firstP.partner || firstP.service_provider;
        }
    }
    if (!p || p === 'ALL') return 'ALL PARTNERS';
    if (p === 'PickMe') return 'PickMe Courier';
    if (p === 'Domex') return 'Domex Express';
    if (p === 'Pronto') return 'Pronto Lanka';
    return p;
}

export default function WorkstationDashboard() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const userStr = localStorage.getItem('skynet_user');
        if (!userStr) {
            router.push('/login');
        } else {
            try {
                setCurrentUser(JSON.parse(userStr));
            } catch (e) {
                router.push('/login');
            }
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('skynet_user');
        router.push('/login');
    };

    // Fetch active users list for user-switch dropdown
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/auth/users');
                const data = await res.json();
                if (data.success && data.users) {
                    setUsersList(data.users);
                }
            } catch (e) {
                console.error("Failed to load users:", e);
            }
        };
        fetchUsers();
    }, [currentUser]);

    const handleSwitchUserSubmit = async () => {
        if (!switchUserModal || !switchUserFirstName || !switchUserPassword) {
            toast.error("Both First name and 4-digit PIN are required.");
            return;
        }
        try {
            const res = await fetch("/api/auth/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: switchUserModal.email,
                    firstName: switchUserFirstName,
                    pin: switchUserPassword
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                localStorage.setItem("skynet_user", JSON.stringify(data.user));
                setCurrentUser(data.user);
                setSwitchUserModal(null);
                setSwitchUserFirstName('');
                setSwitchUserPassword('');
                toast.success(`Successfully switched operator to ${data.user.firstName}`);
            } else {
                toast.error(data.error || "Switching failed.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Connection error during switch user.");
        }
    };

    const handleRenewPinSubmit = async () => {
        const { email, currentPassword, newPassword, confirmNewPassword } = renewForm;
        if (!email || !currentPassword || !newPassword || !confirmNewPassword) {
            toast.error("All fields are required.");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            toast.error("New passwords do not match.");
            return;
        }
        try {
            const res = await fetch("/api/auth/renew", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    currentPassword,
                    newPassword
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRenewPinModal(false);
                setRenewForm({ email: '', currentPassword: '', newPassword: '', confirmNewPassword: '' });
                setSuccessModal({
                    title: "Credentials Renewed!",
                    message: "Your Password/PIN has been updated and renewed successfully."
                });
            } else {
                toast.error(data.error || "Renewal failed.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Connection error during renewal.");
        }
    };

    const [activeTab, setActiveTab] = useState<'first-scan' | 'second-scan' | 'damaged-barcode' | 'verify' | 'config' | 'reports' | 'search' | 'dashboard' | 'tracking'>('first-scan');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
    const [scannedToday, setScannedToday] = useState<number>(0);
    const [timeString, setTimeString] = useState<string>('');
    const [scannerConnected, setScannerConnected] = useState<boolean | null>(null); // null = unknown, true = connected, false = no scanner
    const [operatorMenuOpen, setOperatorMenuOpen] = useState<boolean>(false);

    // Device Manager states
    const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
    const [testScannerInput, setTestScannerInput] = useState('');
    const [testScannerSpeed, setTestScannerSpeed] = useState<string>('');
    const [testKeyTimes, setTestKeyTimes] = useState<number[]>([]);

    // Tab 1: Box Unsealing (First Scan)
    const [mawbsList, setMawbsList] = useState<any[]>([]);
    const [firstScanMawb, setFirstScanMawb] = useState('');
    const [firstScanBags, setFirstScanBags] = useState<{ bagNumber: string; expectedCount: number }[]>([]);
    const [isBagsLoading, setIsBagsLoading] = useState(false);
    const [firstScanSelectedBag, setFirstScanSelectedBag] = useState('');
    const [bagBarcodeInput, setBagBarcodeInput] = useState('');
    const [firstScanExpected, setFirstScanExpected] = useState<number | ''>('');
    const [firstScanInput, setFirstScanInput] = useState('');
    const [firstScanLastScanned, setFirstScanLastScanned] = useState('');
    const [firstScanHistory, setFirstScanHistory] = useState<Array<{ trackingNumber: string; skynetTrackingNumber?: string; senderReference?: string; isTemuScan?: boolean; recipientName: string; city: string; timestamp: string; assignedPartner?: string; assignedZone?: string }>>([]);
    const [firstScanCurrentScan, setFirstScanCurrentScan] = useState<{ assignedPartner?: string; assignedZone?: string; parcel?: any } | null>(null);
    const [firstScanStatus, setFirstScanStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [firstScanError, setFirstScanError] = useState('');
    const [unsealedBoxes, setUnsealedBoxes] = useState<Array<{
        mawb: string;
        bagNumber?: string;
        expected: number;
        scanned: number;
        timestamp: string;
        status?: string;
        discrepancy?: number;
        unsealedBy?: string;
        scannedParcels?: any[];
    }>>([]);
    const [viewingUnsealedParcelsModal, setViewingUnsealedParcelsModal] = useState<{ bagNumber: string; mawb: string; parcels: any[] } | null>(null);
    const [missedFirstScanModal, setMissedFirstScanModal] = useState<{
        barcode: string;
        parcel: any;
        bagNumber?: string;
        mawbRef?: string;
        assignedPartner?: string;
        assignedZone?: string;
        message?: string;
    } | null>(null);

    const [discrepancyReason, setDiscrepancyReason] = useState('');
    const [customDiscrepancyNote, setCustomDiscrepancyNote] = useState('');

    // Tab 2: Scan & Allocate (Second Scan) & Outbound LMD Bagging
    const [barcodeInput, setBarcodeInput] = useState('');
    const [lastScanned, setLastScanned] = useState('');
    const [currentScan, setCurrentScan] = useState<AllocationResponse | null>(null);
    const [status, setStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [errorMessage, setErrorMessage] = useState('');
    const [history, setHistory] = useState<AllocationResponse[]>([]);

    // Tab 2: Outbound LMD Bagging & Manifest Management State
    const [selectedSecondScanMawb, setSelectedSecondScanMawb] = useState('');
    const [secondScanManifestStatus, setSecondScanManifestStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
    const [outboundBags, setOutboundBags] = useState<Array<{
        bagNumber: string;
        mawbRef: string;
        targetPartner?: 'PickMe' | 'Domex' | 'Pronto' | 'ALL';
        destinationHub?: string;
        status: 'OPEN' | 'SEALED';
        parcelCount: number;
        totalWeight: number;
        createdAt: string;
        sealedAt?: string;
        operator?: string;
        parcels: any[];
    }>>([]);
    const [activeOutboundBag, setActiveOutboundBag] = useState<any | null>(null);
    const [createBagModalOpen, setCreateBagModalOpen] = useState(false);
    const [newBagPartner, setNewBagPartner] = useState<'PickMe' | 'Domex' | 'Pronto' | 'ALL'>('ALL');
    const [newBagHub, setNewBagHub] = useState('');
    const [customBagNumber, setCustomBagNumber] = useState('');
    const [validationCard, setValidationCard] = useState<{
        status: 'CORRECT' | 'INCORRECT';
        reason?: string;
        error?: string;
        parcel?: any;
        assignedPartner?: string;
        assignedZone?: string;
        bagNumber?: string;
    } | null>(null);
    const [printOutboundBagLabelModal, setPrintOutboundBagLabelModal] = useState<any | null>(null);

    // Tab 2: Dispatch Verify
    const [selectedBin, setSelectedBin] = useState<'PickMe' | 'Domex' | 'Pronto' | null>(null);
    const [verifyBarcodeInput, setVerifyBarcodeInput] = useState('');
    const [lastVerifyScanned, setLastVerifyScanned] = useState('');
    const [verifyScan, setVerifyScan] = useState<AllocationResponse | null>(null);
    const [verifyStatus, setVerifyStatus] = useState<'READY' | 'FETCHING' | 'MATCH' | 'MISMATCH' | 'ERROR'>('READY');
    const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
    const [binCounts, setBinCounts] = useState({ PickMe: 0, Domex: 0, Pronto: 0 });
    const [duplicateModal, setDuplicateModal] = useState<{
        barcode: string;
        skynetTrackingNumber?: string;
        senderReference?: string;
        scannedMethod?: string;
        originalMethod?: string;
        isTemuScanDuplicate?: boolean;
        bagNumber?: string;
        message?: string;
        type: 'allocate' | 'verify';
    } | null>(null);
    const [invalidBarcodeModal, setInvalidBarcodeModal] = useState<{
        barcode: string;
        message: string;
        isCombined?: boolean;
    } | null>(null);
    const [manifestClosedModal, setManifestClosedModal] = useState<{
        mawbRef: string;
        closedBy: string;
        closedAt: string;
        totalBags: number;
        pickmeBags: number;
        pickmeParcels: number;
        domexBags: number;
        domexParcels: number;
        prontoBags: number;
        prontoParcels: number;
        generalBags: number;
        generalParcels: number;
        totalParcels: number;
        totalWeight: number;
    } | null>(null);
    const [confirmFinishModal, setConfirmFinishModal] = useState(false);
    const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);
    const [unallocatedPartnerModal, setUnallocatedPartnerModal] = useState<{ trackingNumber: string } | null>(null);
    const [unallocatedBagUnsealModal, setUnallocatedBagUnsealModal] = useState<{ bagNumber: string; unallocatedCount: number; unallocatedParcels: any[] } | null>(null);
    const [unallocatedBagNote, setUnallocatedBagNote] = useState<string>('');
    const [invalidBagParcelModal, setInvalidBagParcelModal] = useState<{ barcode: string; expectedBag: string; actualBag: string | null; reason: 'WRONG_BAG' | 'NOT_FOUND' | 'BAG_ALREADY_COMPLETED' | 'INVALID_BAG' | 'NO_BAG_SELECTED' } | null>(null);
    const [customConfirmModal, setCustomConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [overageCheckModal, setOverageCheckModal] = useState<{ bagNumber: string; expected: number; history: any[] } | null>(null);
    const [extraParcelModal, setExtraParcelModal] = useState<{ barcode: string; reason: 'WRONG_BAG' | 'UNASSIGNED' | 'NOT_FOUND'; actualBag: string | null; actualMawb?: string | null; expectedBag: string; } | null>(null);
    const [extraParcelNote, setExtraParcelNote] = useState('');
    const [printLabelModal, setPrintLabelModal] = useState<{
        trackingNumber: string;
        senderReference?: string;
        recipientName?: string;
        city?: string;
        province?: string;
        district?: string;
        weight?: number;
        mawbRef?: string;
        bagNumber?: string;
        assignedPartner?: string;
        assignedZone?: string;
    } | null>(null);
    const [lastTemuSticker, setLastTemuSticker] = useState<{
        skynetTrackingNumber: string;
        temuBarcode: string;
        recipientName?: string;
        city?: string;
        mawbRef?: string;
        bagNumber?: string;
        assignedPartner?: string;
        assignedZone?: string;
    } | null>(null);
    const [verifiedCount, setVerifiedCount] = useState(0);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [switchUserModal, setSwitchUserModal] = useState<any | null>(null);
    const [switchUserFirstName, setSwitchUserFirstName] = useState('');
    const [switchUserPassword, setSwitchUserPassword] = useState('');
    const [renewPinModal, setRenewPinModal] = useState(false);
    const [renewForm, setRenewForm] = useState({
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    });
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

    // Tab: Damaged Barcode (Temu Scan) & Photo Upload Reporting
    const [damagedBarcodeInput, setDamagedBarcodeInput] = useState('');
    const [damagedLastScanned, setDamagedLastScanned] = useState('');
    const [damagedCurrentScan, setDamagedCurrentScan] = useState<AllocationResponse | null>(null);
    const [damagedStatus, setDamagedStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [damagedErrorMessage, setDamagedErrorMessage] = useState('');
    const [damagedHistory, setDamagedHistory] = useState<AllocationResponse[]>([]);

    // Damaged Parcel Reporting & Photo States
    const [damagedReportCategory, setDamagedReportCategory] = useState('Packaging Crushed / Torn');
    const [damagedReportSeverity, setDamagedReportSeverity] = useState('Moderate');
    const [damagedImage1, setDamagedImage1] = useState<string | null>(null);
    const [damagedImage2, setDamagedImage2] = useState<string | null>(null);
    const [damagedReportRemarks, setDamagedReportRemarks] = useState('');
    const [damagedSubmitting, setDamagedSubmitting] = useState(false);
    const [damagedSubmitSuccess, setDamagedSubmitSuccess] = useState<string | null>(null);
    const [damagedSubmitError, setDamagedSubmitError] = useState<string | null>(null);
    const [damagedReportsList, setDamagedReportsList] = useState<any[]>([]);
    const [damagedSelectedPhotosModal, setDamagedSelectedPhotosModal] = useState<{
        trackingNumber: string;
        temuBarcode?: string;
        damageType: string;
        severity: string;
        imageUrl1: string;
        imageUrl2: string;
        remarks?: string;
        createdAt?: string;
        status?: string;
    } | null>(null);
    const [damagedReportFormOpen, setDamagedReportFormOpen] = useState(false);
    const [damagedManualTracking, setDamagedManualTracking] = useState('');
    const [damagedSubTab, setDamagedSubTab] = useState<'label' | 'parcels'>('label');

    // Tab 3: Config
    const [config, setConfig] = useState({
        zoneMappings: [] as { province: string; district: string; city: string; zoneName: string }[],
        allocationRules: {} as Record<string, { partnerCode: string; weightPercentage: number }[]>
    });

    // Search Center States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFilter, setSearchFilter] = useState<'ALL' | 'tracking' | 'bag' | 'manifest' | 'box'>('ALL');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<{
        query?: string;
        parcels: any[];
        bags: any[];
        manifests: any[];
        unsealedBoxes: any[];
    } | null>(null);

    // Operational Dashboard States
    const [dashboardData, setDashboardData] = useState<any | null>(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
    const [dashboardSubTab, setDashboardSubTab] = useState<'total_received' | 'parcels_sorted' | 'pending_parcels' | 'total_bags' | 'manifests' | 'exceptions' | 'productivity' | 'partner'>('total_received');
    const [dashSearchQuery, setDashSearchQuery] = useState('');
    const [dashPartnerFilter, setDashPartnerFilter] = useState('ALL');
    const [dashMawbFilter, setDashMawbFilter] = useState('');
    const [dashStatusFilter, setDashStatusFilter] = useState('ALL');

    const fetchDashboard = async () => {
        setIsLoadingDashboard(true);
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();
            if (data.success && data.dashboard) {
                setDashboardData(data.dashboard);
                const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
                const isValidMawbRef = (ref: any) => {
                    if (!ref || typeof ref !== 'string') return false;
                    const clean = ref.trim();
                    if (clean === '' || clean === '-' || clean.toUpperCase() === 'N/A' || clean.startsWith('MNF-')) return false;
                    if (isUuid(clean)) return false;
                    return true;
                };
                const availableMawbsSet = new Set<string>();
                (data.dashboard.mawbTableList || []).forEach((m: any) => { if (isValidMawbRef(m.mawbReference)) availableMawbsSet.add(m.mawbReference.trim()); });
                (data.dashboard.receivedParcels || []).forEach((p: any) => { if (isValidMawbRef(p.mawbReference)) availableMawbsSet.add(p.mawbReference.trim()); });
                const mList = Array.from(availableMawbsSet).sort();
                if (mList.length > 0) {
                    setDashMawbFilter(prev => (!prev || prev === 'ALL' || !mList.includes(prev)) ? mList[0] : prev);
                }
            }
        } catch (e) {
            console.error("Failed to load dashboard data:", e);
        } finally {
            setIsLoadingDashboard(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchDashboard();
        }
    }, [activeTab]);

    const handleSearchSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}&type=${searchFilter}`);
            const data = await res.json();
            if (data.success && data.results) {
                setSearchResults({ ...data.results, query: searchQuery.trim() });
            }
        } catch (e) {
            console.error("Search failed:", e);
        } finally {
            setIsSearching(false);
        }
    };
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
                    if (data.mawbs.length > 0) {
                        setFirstScanMawb(prev => prev || data.mawbs[0].mawb_reference);
                        setSelectedSecondScanMawb(prev => prev || data.mawbs[0].mawb_reference);
                    }
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
                        timestamp: new Date(ub.created_at).toLocaleTimeString(),
                        status: ub.status,
                        discrepancy: ub.discrepancy,
                        unsealedBy: ub.unsealed_by,
                        scannedParcels: ub.scanned_parcels || []
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
            setBagBarcodeInput('');
            setFirstScanHistory([]);
            setFirstScanCurrentScan(null);
            setIsBagsLoading(false);
            return;
        }

        // Reset bag state immediately so UI updates instantly in real-time
        setFirstScanBags([]);
        setFirstScanSelectedBag('');
        setFirstScanExpected('');
        setBagBarcodeInput('');
        setFirstScanHistory([]);
        setFirstScanCurrentScan(null);
        setIsBagsLoading(true);

        const fetchBags = async () => {
            try {
                const res = await fetch(`/api/allocate?getBags=true&mawbRef=${encodeURIComponent(firstScanMawb)}`);
                const data = await res.json();
                if (data.success) {
                    setFirstScanBags(data.bags || []);
                } else {
                    console.error("Failed to load bags:", data.error);
                }
            } catch (err) {
                console.error("Error fetching bags:", err);
            } finally {
                setIsBagsLoading(false);
            }
        };

        fetchBags();
    }, [firstScanMawb]);

    // Update expected count when bag is selected
    useEffect(() => {
        if (!firstScanSelectedBag) {
            setFirstScanExpected('');
            setFirstScanHistory([]);
            setFirstScanCurrentScan(null);
            return;
        }

        // Always reset scanned history so operator scans each parcel manually
        setFirstScanHistory([]);
        setFirstScanCurrentScan(null);

        const selected = firstScanBags.find(b => b.bagNumber === firstScanSelectedBag);
        if (selected && selected.expectedCount > 0) {
            setFirstScanExpected(selected.expectedCount);
        } else {
            setFirstScanExpected('');
        }

        const fetchBagParcels = async () => {
            try {
                const res = await fetch(`/api/allocate?getBagParcels=true&bagNumber=${encodeURIComponent(firstScanSelectedBag)}&mawbRef=${encodeURIComponent(firstScanMawb)}`);
                const data = await res.json();
                if (data.success && Array.isArray(data.parcels)) {
                    const actualCount = data.count !== undefined ? data.count : data.parcels.length;
                    setFirstScanExpected(actualCount);
                    setFirstScanBags(prev => prev.map(b => b.bagNumber === firstScanSelectedBag ? { ...b, expectedCount: actualCount } : b));
                }
            } catch (err) {
                console.error("Failed to fetch bag parcel count:", err);
            }
        };

        fetchBagParcels();
    }, [firstScanSelectedBag, firstScanMawb]);

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
            // If Enter key pressed and active scan input contains text, a barcode scan just occurred!
            // Dismiss active notification modal and allow form submission to process the new barcode cleanly.
            if (e.key === 'Enter') {
                const firstScanVal = (firstScanInputRef.current?.value || firstScanInput).trim();
                const secondScanVal = (scanInputRef.current?.value || barcodeInput).trim();
                const hasScanInput = activeTab === 'first-scan' ? Boolean(firstScanVal) : activeTab === 'second-scan' ? Boolean(secondScanVal) : false;

                if (hasScanInput) {
                    setMissedFirstScanModal(null);
                    setDuplicateModal(null);
                    setInvalidBarcodeModal(null);
                    setManifestClosedModal(null);
                    setUnallocatedPartnerModal(null);
                    setSuccessModal(null);
                    setInvalidBagParcelModal(null);
                    setUnallocatedBagUnsealModal(null);
                    return; // Allow form submit event to proceed cleanly
                }
            }
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

    const handleForceUnsealWithNote = async () => {
        if (!firstScanMawb || !firstScanSelectedBag || firstScanExpected === '' || !unallocatedBagUnsealModal) return;

        const isMatch = firstScanHistory.length === Number(firstScanExpected);
        const diff = firstScanHistory.length - Number(firstScanExpected);
        let baseStatus = 'COUNTED';
        if (!isMatch) {
            const prefix = diff < 0 ? 'Shortage' : 'Overage';
            if (discrepancyReason === 'Other (Custom Note)' && customDiscrepancyNote.trim()) {
                baseStatus = `${prefix}: ${customDiscrepancyNote.trim()}`;
            } else {
                baseStatus = `${prefix}: ${discrepancyReason || 'Discrepancy'}`;
            }
        }

        const noteText = unallocatedBagNote.trim() || `Unsealed with ${unallocatedBagUnsealModal.unallocatedCount} unallocated parcel(s)`;
        const finalStatus = `${baseStatus} | UNALLOCATED NOTE: ${noteText}`;

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
                    status: finalStatus,
                    operator: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                    scannedParcels: firstScanHistory
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
                        timestamp: new Date().toLocaleTimeString(),
                        status: finalStatus,
                        discrepancy: firstScanHistory.length - Number(firstScanExpected),
                        unsealedBy: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                        scannedParcels: firstScanHistory
                    },
                    ...prev
                ]);

                setSuccessModal({
                    title: "Bag Unsealed with Note",
                    message: `Bag "${firstScanSelectedBag}" has been unsealed with note: ${noteText}`
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
            setUnallocatedBagUnsealModal(null);
            setDiscrepancyReason('');
            setCustomDiscrepancyNote('');
            setUnallocatedBagNote('');
        }
    };

    const handleConfirmFinish = async () => {
        if (!firstScanMawb || !firstScanSelectedBag || firstScanExpected === '') return;

        // Intercept if any parcel in bag is unallocated
        const unallocatedList = firstScanHistory.filter(p => !p.assignedPartner || p.assignedPartner === 'Unknown');
        if (unallocatedList.length > 0 && !unallocatedBagUnsealModal) {
            setConfirmFinishModal(false);
            setUnallocatedBagNote(`Unsealed with ${unallocatedList.length} unallocated parcel(s): ${unallocatedList.map(p => p.trackingNumber).join(', ')}`);
            setUnallocatedBagUnsealModal({
                bagNumber: firstScanSelectedBag,
                unallocatedCount: unallocatedList.length,
                unallocatedParcels: unallocatedList
            });
            return;
        }

        const isMatch = firstScanHistory.length === Number(firstScanExpected);

        // Determine status and discrepancy
        const diff = firstScanHistory.length - Number(firstScanExpected);
        let finalStatus = 'COUNTED';
        if (!isMatch) {
            const prefix = diff < 0 ? 'Shortage' : 'Overage';
            if (discrepancyReason === 'Other (Custom Note)' && customDiscrepancyNote.trim()) {
                finalStatus = `${prefix}: ${customDiscrepancyNote.trim()}`;
            } else {
                finalStatus = `${prefix}: ${discrepancyReason || 'Discrepancy'}`;
            }
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
                    status: finalStatus,
                    operator: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                    scannedParcels: firstScanHistory
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
                        timestamp: new Date().toLocaleTimeString(),
                        status: finalStatus,
                        discrepancy: firstScanHistory.length - Number(firstScanExpected),
                        unsealedBy: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                        scannedParcels: firstScanHistory
                    },
                    ...prev
                ]);

                setSuccessModal({
                    title: "Bag Session Finished",
                    message: `Bag "${firstScanSelectedBag}" has been finished and saved. Status: ${finalStatus}.`
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
            setDiscrepancyReason('');
            setCustomDiscrepancyNote('');
        }
    };

    // Keyboard wedge support for all modal dialogs
    useEffect(() => {
        if (!confirmFinishModal && !successModal && !unallocatedPartnerModal && !invalidBagParcelModal && !customConfirmModal && !overageCheckModal && !extraParcelModal && !duplicateModal && !invalidBarcodeModal && !manifestClosedModal && !printLabelModal && !missedFirstScanModal && !unallocatedBagUnsealModal) return;
        const handleModalKey = (e: KeyboardEvent) => {
            if (missedFirstScanModal) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    setMissedFirstScanModal(null);
                    setTimeout(() => {
                        if (scanInputRef.current) scanInputRef.current.focus();
                    }, 50);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setMissedFirstScanModal(null);
                    setConfirmFinishModal(true);
                    setDiscrepancyReason('');
                    setCustomDiscrepancyNote('');
                }
                return;
            }

            if (e.key === 'Enter') {
                const firstScanVal = (firstScanInputRef.current?.value || firstScanInput).trim();
                const secondScanVal = (scanInputRef.current?.value || barcodeInput).trim();
                const hasScanInput = activeTab === 'first-scan' ? Boolean(firstScanVal) : activeTab === 'second-scan' ? Boolean(secondScanVal) : false;

                if (hasScanInput) {
                    setMissedFirstScanModal(null);
                    setDuplicateModal(null);
                    setInvalidBarcodeModal(null);
                    setManifestClosedModal(null);
                    setUnallocatedPartnerModal(null);
                    setSuccessModal(null);
                    setInvalidBagParcelModal(null);
                    return; // Allow form submit event to proceed cleanly
                }
            }
            if (duplicateModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setDuplicateModal(null);
                    setBarcodeInput('');
                    setLastScanned('');
                    if (scanInputRef.current) scanInputRef.current.value = '';
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                        else if (activeTab === 'verify') verifyInputRef.current?.focus();
                    }, 50);
                }
            } else if (invalidBarcodeModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setInvalidBarcodeModal(null);
                    setBarcodeInput('');
                    setLastScanned('');
                    if (scanInputRef.current) scanInputRef.current.value = '';
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                        else if (activeTab === 'verify') verifyInputRef.current?.focus();
                    }, 50);
                }
            } else if (manifestClosedModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setManifestClosedModal(null);
                    setTimeout(() => {
                        if (activeTab === 'second-scan') scanInputRef.current?.focus();
                    }, 50);
                }
            } else if (unallocatedPartnerModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setUnallocatedPartnerModal(null);
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                    }, 50);
                }
            } else if (successModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setSuccessModal(null);
                    setFirstScanInput('');
                    setBarcodeInput('');
                    setVerifyBarcodeInput('');
                    if (firstScanInputRef.current) firstScanInputRef.current.value = '';
                    if (scanInputRef.current) scanInputRef.current.value = '';
                    if (verifyInputRef.current) verifyInputRef.current.value = '';
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
                    e.stopPropagation();
                    handleConfirmFinish();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmFinishModal(false);
                    setDiscrepancyReason('');
                    setCustomDiscrepancyNote('');
                    setFirstScanInput('');
                    if (firstScanInputRef.current) firstScanInputRef.current.value = '';
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                    }, 50);
                }
            } else if (invalidBagParcelModal) {
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setInvalidBagParcelModal(null);
                    setFirstScanInput('');
                    setBagBarcodeInput('');
                    setBarcodeInput('');
                    setVerifyBarcodeInput('');
                    if (firstScanInputRef.current) firstScanInputRef.current.value = '';
                    if (bagBarcodeInputRef.current) bagBarcodeInputRef.current.value = '';
                    if (scanInputRef.current) scanInputRef.current.value = '';
                    if (verifyInputRef.current) verifyInputRef.current.value = '';
                    setTimeout(() => {
                        if (activeTab === 'first-scan') {
                            if (!firstScanSelectedBag && bagBarcodeInputRef.current) {
                                bagBarcodeInputRef.current.focus();
                            } else {
                                firstScanInputRef.current?.focus();
                            }
                        }
                    }, 50);
                }
            } else if (customConfirmModal) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    customConfirmModal.onConfirm();
                    setCustomConfirmModal(null);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setCustomConfirmModal(null);
                    setFirstScanInput('');
                    setBarcodeInput('');
                    setVerifyBarcodeInput('');
                    if (firstScanInputRef.current) firstScanInputRef.current.value = '';
                    if (scanInputRef.current) scanInputRef.current.value = '';
                    if (verifyInputRef.current) verifyInputRef.current.value = '';
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                    }, 50);
                }
            } else if (overageCheckModal) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Enter = "No extra parcels, close bag"
                    const { bagNumber, expected, history } = overageCheckModal;
                    setOverageCheckModal(null);
                    autoFinishBag(bagNumber, expected, history);
                } else if (e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Space = "Yes, there are more parcels — continue scanning"
                    setOverageCheckModal(null);
                    setTimeout(() => firstScanInputRef.current?.focus(), 50);
                }
            } else if (extraParcelModal) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const isNotFound = extraParcelModal.reason === 'NOT_FOUND';
                    const canSubmit = !isNotFound || extraParcelNote.trim() !== '';
                    if (canSubmit) {
                        handleFirstScanSubmitOverride(extraParcelModal.barcode, {
                            overrideBag: extraParcelModal.reason === 'WRONG_BAG' || extraParcelModal.reason === 'UNASSIGNED',
                            registerExtra: isNotFound,
                            note: extraParcelNote
                        });
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setExtraParcelModal(null);
                    setExtraParcelNote('');
                    setTimeout(() => {
                        if (firstScanInputRef.current) {
                            firstScanInputRef.current.value = '';
                            setFirstScanInput('');
                            firstScanInputRef.current.focus();
                        }
                    }, 50);
                }
            } else if (printLabelModal) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setPrintLabelModal(null);
                    setTimeout(() => {
                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                    }, 50);
                }
            }
        };
        window.addEventListener('keydown', handleModalKey, true);
        return () => window.removeEventListener('keydown', handleModalKey, true);
    }, [confirmFinishModal, successModal, invalidBagParcelModal, customConfirmModal, overageCheckModal, extraParcelModal, extraParcelNote, printLabelModal, duplicateModal, invalidBarcodeModal, manifestClosedModal, missedFirstScanModal, activeTab, firstScanMawb, firstScanExpected, firstScanHistory]);

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
        const unsealed = unsealedBoxes.find(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === bagNumber?.toLowerCase());
        if (unsealed) {
            return unsealed.scanned;
        }
        return 0;
    };

    const getBagStatus = (bagNumber: string, expected: number) => {
        const unsealed = unsealedBoxes.find(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === bagNumber?.toLowerCase());
        if (unsealed) {
            return 'COMPLETED';
        }
        if (firstScanSelectedBag === bagNumber) {
            if (expected > 0 && firstScanHistory.length >= expected) {
                return 'COMPLETED';
            }
            return 'ONGOING';
        }
        return 'PENDING';
    };

    const getSortedBags = () => {
        return [...firstScanBags].sort((a, b) => {
            const aIsActive = a.bagNumber === firstScanSelectedBag;
            const bIsActive = b.bagNumber === firstScanSelectedBag;
            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;

            const aUnsealedIndex = unsealedBoxes.findIndex(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === a.bagNumber?.toLowerCase());
            const bUnsealedIndex = unsealedBoxes.findIndex(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === b.bagNumber?.toLowerCase());

            const aIsCompleted = aUnsealedIndex !== -1;
            const bIsCompleted = bUnsealedIndex !== -1;

            if (aIsCompleted && !bIsCompleted) return -1;
            if (!aIsCompleted && bIsCompleted) return 1;

            if (aIsCompleted && bIsCompleted) {
                return aUnsealedIndex - bUnsealedIndex;
            }

            return a.bagNumber.localeCompare(b.bagNumber);
        });
    };

    const autoFinishBag = async (bagNumber: string, expected: number, history: any[]) => {
        try {
            setFirstScanStatus('FETCHING');
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stage: 'finish-bag',
                    mawbRef: firstScanMawb,
                    bagNumber: bagNumber,
                    expectedCount: expected,
                    scannedCount: history.length,
                    status: 'COUNTED',
                    operator: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                    scannedParcels: history
                }),
            });
            const data = await response.json();
            if (data.success) {
                setUnsealedBoxes(prev => [
                    {
                        mawb: firstScanMawb,
                        bagNumber: bagNumber,
                        expected: expected,
                        scanned: history.length,
                        timestamp: new Date().toLocaleTimeString(),
                        status: 'COUNTED',
                        discrepancy: 0,
                        unsealedBy: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                        scannedParcels: history
                    },
                    ...prev
                ]);

                setSuccessModal({
                    title: "Bag Completed!",
                    message: `All parcels are checked. Bag "${bagNumber}" is finished and saved to database. Count: ${history.length} parcels.`
                });

                handleClearFirstScan();
            } else {
                setFirstScanError(data.error || "Failed to save unsealing log to database.");
            }
        } catch (err: any) {
            setFirstScanError(err.message || "Failed to connect to server.");
        } finally {
            setFirstScanStatus('READY');
        }
    };

    const handleFirstScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rawBarcode = firstScanInput.trim();
        const barcode = extractLatestBarcode(rawBarcode);
        if (!barcode || !firstScanMawb) return;

        // Reset previous scan output and modals for clean new scan evaluation
        setFirstScanCurrentScan(null);
        setUnallocatedPartnerModal(null);
        setDuplicateModal(null);
        setInvalidBagParcelModal(null);

        // Clear input instantly and store last scanned to prevent concatenation
        setFirstScanLastScanned(barcode);
        setFirstScanInput('');
        if (firstScanInputRef.current) firstScanInputRef.current.value = '';

        // Auto select input text so next scan overwrites it
        setTimeout(() => {
            firstScanInputRef.current?.select();
        }, 50);

        // 1. Smart Bag Barcode Scan Detection
        const matchedBag = firstScanBags.find(b => b.bagNumber.toLowerCase() === barcode.toLowerCase());
        const alreadyUnsealedBag = unsealedBoxes.find(ub => ub.mawb?.toLowerCase() === firstScanMawb.toLowerCase() && ub.bagNumber?.toLowerCase() === barcode.toLowerCase());

        if (alreadyUnsealedBag) {
            setInvalidBagParcelModal({
                barcode: alreadyUnsealedBag.bagNumber,
                expectedBag: alreadyUnsealedBag.bagNumber,
                actualBag: null,
                reason: 'BAG_ALREADY_COMPLETED'
            });
            return;
        }

        // 1.b Parcel-level check: block parcel scans if their bag is already unsealed
        try {
            const barcodeNorm = barcode.trim().toLowerCase();
            for (const ub of unsealedBoxes) {
                if (!ub.mawb || ub.mawb.toLowerCase() !== firstScanMawb.toLowerCase()) continue;
                const scanned = ub.scannedParcels || [];
                for (const sp of scanned) {
                    const candidates = [
                        sp.trackingNumber,
                        sp.skynetTrackingNumber,
                        sp.senderReference,
                        sp.displayTrackingNumber
                    ].filter(Boolean) as string[];
                    for (const c of candidates) {
                        const cNorm = String(c).trim().toLowerCase();
                        if (!cNorm) continue;
                        if (cNorm === barcodeNorm ||
                            `skyt${cNorm}` === barcodeNorm ||
                            `skyt-${cNorm}` === barcodeNorm ||
                            barcodeNorm.endsWith(cNorm)) {
                            setInvalidBagParcelModal({
                                barcode: ub.bagNumber || '',
                                expectedBag: ub.bagNumber || '',
                                actualBag: null,
                                reason: 'BAG_ALREADY_COMPLETED'
                            });
                            return;
                        }
                    }
                }
            }
        } catch (err) {
            // non-fatal: if anything goes wrong here, fall back to normal flow
            console.warn('Parcel-level unsealed check failed', err);
        }

        if (matchedBag) {
            // Check if this bag is already completed
            const isCompleted = getBagStatus(matchedBag.bagNumber, matchedBag.expectedCount) === 'COMPLETED';
            if (isCompleted) {
                setInvalidBagParcelModal({
                    barcode: matchedBag.bagNumber,
                    expectedBag: matchedBag.bagNumber,
                    actualBag: null,
                    reason: 'BAG_ALREADY_COMPLETED'
                });
                return;
            }

            if (firstScanSelectedBag === matchedBag.bagNumber) {
                return;
            }

            // Check if there is already an active bag session (any selected bag, even without scans)
            if (firstScanSelectedBag) {
                const historyNote = firstScanHistory.length > 0
                    ? ` with ${firstScanHistory.length} scanned parcel${firstScanHistory.length !== 1 ? 's' : ''}`
                    : '';
                const progressNote = firstScanHistory.length > 0
                    ? ' Current progress in the active box will be cleared.'
                    : '';
                setCustomConfirmModal({
                    title: "Switch Bag Session?",
                    message: `You are currently scanning Bag "${firstScanSelectedBag}"${historyNote}. Are you sure you want to switch to Bag "${matchedBag.bagNumber}"?${progressNote}`,
                    onConfirm: () => {
                        setFirstScanSelectedBag(matchedBag.bagNumber);
                        setFirstScanExpected(matchedBag.expectedCount);
                        setFirstScanError('');
                        setFirstScanLastScanned('');
                        setFirstScanStatus('READY');
                        setFirstScanHistory([]);
                    }
                });
                return;
            }
            setFirstScanSelectedBag(matchedBag.bagNumber);
            setFirstScanExpected(matchedBag.expectedCount);
            setFirstScanError('');
            setFirstScanLastScanned('');
            setFirstScanStatus('READY');
            setFirstScanHistory([]);
            return;
        } else if (barcode.toUpperCase().startsWith('SKYT')) {
            setInvalidBagParcelModal({
                barcode: barcode,
                expectedBag: '',
                actualBag: null,
                reason: 'INVALID_BAG'
            });
            setFirstScanError(`Bag barcode "${barcode}" not found in this MAWB.`);
            setFirstScanStatus('ERROR');
            return;
        }

        // 2. Regular Parcel Barcode Scan
        if (!firstScanSelectedBag) {
            setInvalidBagParcelModal({
                barcode: barcode,
                expectedBag: '',
                actualBag: null,
                reason: 'NO_BAG_SELECTED'
            });
            setFirstScanError(`Bag barcode "${barcode}" not found in this MAWB.`);
            setFirstScanStatus('ERROR');
            return;
        }

        // Enhanced Pre-Check for duplicates in current session (checking against trackingNumber, skynetTrackingNumber & senderReference)
        const cleanInput = barcode.trim().toLowerCase();
        const existingItemPre = firstScanHistory.find(item =>
            item.trackingNumber.trim().toLowerCase() === cleanInput ||
            (item.skynetTrackingNumber && item.skynetTrackingNumber.trim().toLowerCase() === cleanInput) ||
            (item.senderReference && item.senderReference.trim().toLowerCase() === cleanInput)
        );

        if (existingItemPre) {
            const isTemu = existingItemPre.isTemuScan;
            const temuCode = existingItemPre.senderReference || existingItemPre.trackingNumber;
            const skynetCode = existingItemPre.skynetTrackingNumber || existingItemPre.trackingNumber;

            const dupMsg = isTemu
                ? `Already Unsealed!! Parcel (${skynetCode}) was ALREADY unsealed via Temu Barcode (${temuCode}).`
                : `Already Unsealed!! Parcel (${skynetCode}) has ALREADY been unsealed in this box session.`;

            setFirstScanError(dupMsg);
            setFirstScanStatus('ERROR');
            setDuplicateModal({
                barcode: barcode,
                skynetTrackingNumber: skynetCode,
                senderReference: temuCode,
                originalMethod: isTemu ? `Temu Barcode (${temuCode})` : `Skynet Barcode (${skynetCode})`,
                message: dupMsg,
                type: 'allocate'
            });
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
                    mawbRef: firstScanMawb,
                    bagNumber: firstScanSelectedBag
                }),
            });
            const data: any = await response.json();
            if (data.success && data.parcel) {
                const returnedSkynetNo = data.parcel.trackingNumber;
                const returnedTemuNo = data.parcel.senderReference;

                // Post-check duplicate against returned canonical parcel details
                const existingParcelItem = firstScanHistory.find(item =>
                    (item.skynetTrackingNumber && item.skynetTrackingNumber.trim().toLowerCase() === returnedSkynetNo.trim().toLowerCase()) ||
                    item.trackingNumber.trim().toLowerCase() === returnedSkynetNo.trim().toLowerCase() ||
                    (returnedTemuNo && (
                        (item.senderReference && item.senderReference.trim().toLowerCase() === returnedTemuNo.trim().toLowerCase()) ||
                        item.trackingNumber.trim().toLowerCase() === returnedTemuNo.trim().toLowerCase()
                    ))
                );

                if (existingParcelItem) {
                    const isTemu = existingParcelItem.isTemuScan;
                    const temuCode = existingParcelItem.senderReference || existingParcelItem.trackingNumber;
                    const skynetCode = existingParcelItem.skynetTrackingNumber || returnedSkynetNo;

                    const dupMsg = isTemu
                        ? `Already Unsealed!! Parcel (${returnedSkynetNo}) was ALREADY unsealed via Temu Barcode (${temuCode}).`
                        : `Already Unsealed!! Parcel (${returnedSkynetNo}) has ALREADY been unsealed in this box session.`;

                    setFirstScanError(dupMsg);
                    setFirstScanStatus('ERROR');
                    setDuplicateModal({
                        barcode: barcode,
                        skynetTrackingNumber: returnedSkynetNo,
                        senderReference: returnedTemuNo,
                        originalMethod: isTemu ? `Temu Barcode (${temuCode})` : `Skynet Barcode (${skynetCode})`,
                        message: dupMsg,
                        type: 'allocate'
                    });
                    return;
                }
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                const isTemuScan = Boolean(
                    data.parcel?.senderReference && (
                        data.parcel.senderReference.trim().toLowerCase() === barcode.trim().toLowerCase() ||
                        barcode.trim() !== data.parcel.trackingNumber.trim()
                    )
                );
                const displayTrackingNumber = isTemuScan ? (data.parcel.senderReference || barcode) : data.parcel.trackingNumber;

                const newHistory = [
                    {
                        trackingNumber: displayTrackingNumber,
                        skynetTrackingNumber: data.parcel.trackingNumber,
                        senderReference: data.parcel.senderReference,
                        isTemuScan: isTemuScan,
                        recipientName: data.parcel?.recipientName || 'Unknown Recipient',
                        city: data.parcel?.city || 'Unknown City',
                        timestamp: timeStr,
                        assignedPartner: data.assignedPartner,
                        assignedZone: data.assignedZone
                    },
                    ...firstScanHistory
                ];

                setFirstScanHistory(newHistory);
                setFirstScanCurrentScan({
                    assignedPartner: data.assignedPartner,
                    assignedZone: data.assignedZone,
                    parcel: data.parcel
                });
                setScannedToday((prev) => prev + 1);
                setFirstScanStatus('SUCCESS');

                // Show warning popup modal if no LMD partner is assigned
                if (!data.assignedPartner || data.assignedPartner === 'Unknown') {
                    setUnallocatedPartnerModal({ trackingNumber: displayTrackingNumber });
                }


                if (isTemuScan) {
                    setLastTemuSticker({
                        skynetTrackingNumber: data.parcel.trackingNumber,
                        temuBarcode: data.parcel.senderReference || barcode,
                        recipientName: data.parcel?.recipientName,
                        city: data.parcel?.city,
                        mawbRef: firstScanMawb,
                        bagNumber: firstScanSelectedBag,
                        assignedPartner: data.assignedPartner,
                        assignedZone: data.assignedZone
                    });
                } else {
                    setLastTemuSticker(null);
                }

                // Check if bag count has reached expected — show "extra parcels?" check first
                if (newHistory.length === Number(firstScanExpected)) {
                    setOverageCheckModal({
                        bagNumber: firstScanSelectedBag,
                        expected: Number(firstScanExpected),
                        history: newHistory
                    });
                }
            } else {
                if (data.error === 'NOT_IN_BAG') {
                    if (data.actualBag || data.actualMawb) {
                        setExtraParcelModal({
                            barcode: barcode,
                            reason: 'WRONG_BAG',
                            actualBag: data.actualBag,
                            actualMawb: data.actualMawb,
                            expectedBag: firstScanSelectedBag
                        });
                    } else {
                        setExtraParcelModal({
                            barcode: barcode,
                            reason: 'UNASSIGNED',
                            actualBag: null,
                            actualMawb: null,
                            expectedBag: firstScanSelectedBag
                        });
                    }
                    setFirstScanError(data.message || 'Parcel belongs to a different bag/MAWB or is unassigned.');
                    setFirstScanStatus('ERROR');
                } else if (data.error === 'NOT_FOUND') {
                    setExtraParcelModal({
                        barcode: barcode,
                        reason: 'NOT_FOUND',
                        actualBag: null,
                        expectedBag: firstScanSelectedBag
                    });
                    setFirstScanError(`Parcel "${barcode}" not found in database.`);
                    setFirstScanStatus('ERROR');
                } else {
                    setInvalidBagParcelModal({
                        barcode: barcode,
                        expectedBag: firstScanSelectedBag,
                        actualBag: null,
                        reason: 'NOT_FOUND'
                    });
                    setFirstScanError(data.error || 'Unknown scan error');
                    setFirstScanStatus('ERROR');
                }
            }
        } catch (err: any) {
            setInvalidBagParcelModal({
                barcode: barcode,
                expectedBag: firstScanSelectedBag,
                actualBag: null,
                reason: 'NOT_FOUND'
            });
            setFirstScanError(err.message || 'API connection failure');
            setFirstScanStatus('ERROR');
        }
    };

    const handleFirstScanSubmitOverride = async (
        barcode: string,
        opts: { overrideBag?: boolean; registerExtra?: boolean; note?: string }
    ) => {
        setFirstScanCurrentScan(null);
        setUnallocatedPartnerModal(null);
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
                    mawbRef: firstScanMawb,
                    bagNumber: firstScanSelectedBag,
                    overrideBag: opts.overrideBag,
                    registerExtra: opts.registerExtra,
                    extraNote: opts.note
                }),
            });
            const data: any = await response.json();
            if (data.success && data.parcel) {
                const returnedSkynetNo = data.parcel.trackingNumber;
                const returnedTemuNo = data.parcel.senderReference;

                // Post-check duplicate against returned canonical parcel details
                const existingParcelItem = firstScanHistory.find(item =>
                    (item.skynetTrackingNumber && item.skynetTrackingNumber.trim().toLowerCase() === returnedSkynetNo.trim().toLowerCase()) ||
                    item.trackingNumber.trim().toLowerCase() === returnedSkynetNo.trim().toLowerCase() ||
                    (returnedTemuNo && (
                        (item.senderReference && item.senderReference.trim().toLowerCase() === returnedTemuNo.trim().toLowerCase()) ||
                        item.trackingNumber.trim().toLowerCase() === returnedTemuNo.trim().toLowerCase()
                    ))
                );

                if (existingParcelItem) {
                    const isTemu = existingParcelItem.isTemuScan;
                    const temuCode = existingParcelItem.senderReference || existingParcelItem.trackingNumber;
                    const skynetCode = existingParcelItem.skynetTrackingNumber || returnedSkynetNo;

                    const dupMsg = isTemu
                        ? `Already Unsealed!! Parcel (${returnedSkynetNo}) was ALREADY unsealed via Temu Barcode (${temuCode}).`
                        : `Already Unsealed!! Parcel (${returnedSkynetNo}) has ALREADY been unsealed in this box session.`;

                    setFirstScanError(dupMsg);
                    setFirstScanStatus('ERROR');
                    setDuplicateModal({
                        barcode: barcode,
                        skynetTrackingNumber: returnedSkynetNo,
                        senderReference: returnedTemuNo,
                        originalMethod: isTemu ? `Temu Barcode (${temuCode})` : `Skynet Barcode (${skynetCode})`,
                        message: dupMsg,
                        type: 'allocate'
                    });
                    return;
                }
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                const isTemuScan = Boolean(
                    data.parcel?.senderReference && (
                        data.parcel.senderReference.trim().toLowerCase() === barcode.trim().toLowerCase() ||
                        barcode.trim() !== data.parcel.trackingNumber.trim()
                    )
                );
                const displayTrackingNumber = isTemuScan ? (data.parcel.senderReference || barcode) : data.parcel.trackingNumber;

                const newHistory = [
                    {
                        trackingNumber: displayTrackingNumber,
                        skynetTrackingNumber: data.parcel.trackingNumber,
                        senderReference: data.parcel.senderReference,
                        isTemuScan: isTemuScan,
                        recipientName: data.parcel?.recipientName || 'Unknown Recipient',
                        city: data.parcel?.city || 'Unknown City',
                        timestamp: timeStr,
                        assignedPartner: data.assignedPartner,
                        assignedZone: data.assignedZone
                    },
                    ...firstScanHistory
                ];

                setFirstScanHistory(newHistory);
                setFirstScanCurrentScan({
                    assignedPartner: data.assignedPartner,
                    assignedZone: data.assignedZone,
                    parcel: data.parcel
                });
                setScannedToday((prev) => prev + 1);
                setFirstScanStatus('SUCCESS');

                // Show warning popup modal if no LMD partner is assigned
                if (!data.assignedPartner || data.assignedPartner === 'Unknown') {
                    setUnallocatedPartnerModal({ trackingNumber: displayTrackingNumber });
                }


                if (isTemuScan) {
                    setLastTemuSticker({
                        skynetTrackingNumber: data.parcel.trackingNumber,
                        temuBarcode: data.parcel.senderReference || barcode,
                        recipientName: data.parcel?.recipientName,
                        city: data.parcel?.city,
                        mawbRef: firstScanMawb,
                        bagNumber: firstScanSelectedBag,
                        assignedPartner: data.assignedPartner,
                        assignedZone: data.assignedZone
                    });
                } else {
                    setLastTemuSticker(null);
                }

                // Check if bag count has reached expected — show "extra parcels?" check first
                if (newHistory.length === Number(firstScanExpected)) {
                    setOverageCheckModal({
                        bagNumber: firstScanSelectedBag,
                        expected: Number(firstScanExpected),
                        history: newHistory
                    });
                }

                setSuccessModal({
                    title: opts.registerExtra ? "Extra Parcel Registered" : "Parcel Re-assigned",
                    message: opts.registerExtra
                        ? `Untracked parcel "${barcode}" has been registered in Bag "${firstScanSelectedBag}" with note: "${opts.note || 'None'}".`
                        : `Parcel "${barcode}" has been re-assigned to Bag "${firstScanSelectedBag}".`
                });
            } else {
                setInvalidBagParcelModal({
                    barcode: barcode,
                    expectedBag: firstScanSelectedBag,
                    actualBag: null,
                    reason: 'NOT_FOUND'
                });
                setFirstScanError(data.error || 'Failed to update database.');
                setFirstScanStatus('ERROR');
            }
        } catch (err: any) {
            setInvalidBagParcelModal({
                barcode: barcode,
                expectedBag: firstScanSelectedBag,
                actualBag: null,
                reason: 'NOT_FOUND'
            });
            setFirstScanError(err.message || 'API connection failure');
            setFirstScanStatus('ERROR');
        } finally {
            setExtraParcelModal(null);
            setExtraParcelNote('');
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

    const fetchOutboundBags = async (mawbRef: string) => {
        try {
            const res = await fetch(`/api/lmd-bags?mawbRef=${encodeURIComponent(mawbRef)}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                const bags = Array.isArray(data.bags) ? data.bags : [];
                setSecondScanManifestStatus(data.manifestStatus || 'OPEN');
                setOutboundBags(bags);

                if (bags.length === 0) {
                    setActiveOutboundBag(null);
                } else if (!activeOutboundBag || !bags.some((b: any) => b.bagNumber === activeOutboundBag.bagNumber)) {
                    const openBag = bags.find((b: any) => b.status === 'OPEN') || bags[0];
                    setActiveOutboundBag(openBag);
                }
            }
        } catch (err) {
            console.error("Failed to fetch outbound bags:", err);
        }
    };

    useEffect(() => {
        if (selectedSecondScanMawb) {
            fetchOutboundBags(selectedSecondScanMawb);
        }
    }, [selectedSecondScanMawb]);

    const handleCreateOutboundBag = async () => {
        if (secondScanManifestStatus === 'CLOSED') {
            setErrorMessage(`Manifest "${selectedSecondScanMawb}" is CLOSED. No additional bags can be created.`);
            setStatus('ERROR');
            setCreateBagModalOpen(false);
            return;
        }

        const defaultCalculatedBagNumber = `${selectedSecondScanMawb}${newBagPartner && newBagPartner !== 'ALL' ? `-${newBagPartner.toUpperCase()}` : ''}-BAG-${String((outboundBags?.length || 0) + 1).padStart(2, '0')}`;
        const finalBagNumber = customBagNumber.trim() || defaultCalculatedBagNumber;

        try {
            const res = await fetch('/api/lmd-bags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    mawbRef: selectedSecondScanMawb,
                    partner: newBagPartner,
                    customBagNumber: finalBagNumber,
                    destinationHub: newBagHub || (newBagPartner !== 'ALL' ? `${newBagPartner}` : 'Main Sorting Hub'),
                    operator: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Staff'
                })
            });
            const data = await res.json();
            if (data.success && data.bag) {
                setOutboundBags(prev => [data.bag, ...prev]);
                setActiveOutboundBag(data.bag);
                setCreateBagModalOpen(false);
                setCustomBagNumber('');
                setSuccessModal({
                    title: "LMD Outbound Bag Created",
                    message: `New Outbound Bag "${data.bag.bagNumber}" created and set as active for this workstation.`
                });
            } else {
                setErrorMessage(data.error || 'Failed to create outbound bag.');
                setStatus('ERROR');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Server error creating bag.');
            setStatus('ERROR');
        }
    };

    const handleCloseManifest = async () => {
        const activeOperator = currentUser
            ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username || currentUser.email
            : 'Staff';

        let pickmeBags = 0, pickmeParcels = 0;
        let domexBags = 0, domexParcels = 0;
        let prontoBags = 0, prontoParcels = 0;
        let generalBags = 0, generalParcels = 0;
        let totalParcels = 0, totalWeight = 0;

        (outboundBags || []).forEach((b) => {
            const bn = (b.bagNumber || '').toUpperCase();
            const p = b.targetPartner || (bn.includes('PICKME') ? 'PickMe' : bn.includes('DOMEX') ? 'Domex' : bn.includes('PRONTO') ? 'Pronto' : 'ALL');
            const count = b.parcelCount || (b.parcels ? b.parcels.length : 0);
            const w = b.totalWeight || 0;

            totalParcels += count;
            totalWeight += w;

            if (p === 'PickMe' || bn.includes('PICKME')) {
                pickmeBags += 1;
                pickmeParcels += count;
            } else if (p === 'Domex' || bn.includes('DOMEX')) {
                domexBags += 1;
                domexParcels += count;
            } else if (p === 'Pronto' || bn.includes('PRONTO')) {
                prontoBags += 1;
                prontoParcels += count;
            } else {
                generalBags += 1;
                generalParcels += count;
            }
        });

        try {
            const res = await fetch('/api/lmd-bags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'close-manifest',
                    mawbRef: selectedSecondScanMawb,
                    operator: activeOperator
                })
            });
            const data = await res.json();
            if (data.success) {
                setSecondScanManifestStatus('CLOSED');
                setManifestClosedModal({
                    mawbRef: selectedSecondScanMawb,
                    closedBy: activeOperator,
                    closedAt: new Date().toLocaleString(),
                    totalBags: (outboundBags || []).length,
                    pickmeBags,
                    pickmeParcels,
                    domexBags,
                    domexParcels,
                    prontoBags,
                    prontoParcels,
                    generalBags,
                    generalParcels,
                    totalParcels,
                    totalWeight: Number(totalWeight.toFixed(2))
                });
            } else {
                setErrorMessage(data.error || 'Failed to close manifest.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to close manifest.');
        }
    };

    const handleSealOutboundBag = async (bagNumber: string) => {
        if (!activeOutboundBag) return;
        const activeOperator = currentUser
            ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username || currentUser.email
            : 'Staff';
        try {
            const res = await fetch('/api/lmd-bags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'seal',
                    mawbRef: selectedSecondScanMawb,
                    bagNumber: bagNumber,
                    targetPartner: activeOutboundBag.targetPartner || 'ALL',
                    destinationHub: activeOutboundBag.destinationHub || (activeOutboundBag.targetPartner && activeOutboundBag.targetPartner !== 'ALL' ? `${activeOutboundBag.targetPartner}` : 'Main Sort Hub'),
                    operator: activeOperator,
                    parcelCount: activeOutboundBag.parcelCount,
                    totalWeight: activeOutboundBag.totalWeight,
                    parcels: activeOutboundBag.parcels
                })
            });
            const data = await res.json();
            if (data.success && data.bag) {
                const sealedBag = data.bag;
                setActiveOutboundBag(sealedBag);
                setOutboundBags(prev => prev.map(b => b.bagNumber === bagNumber ? sealedBag : b));
                setPrintOutboundBagLabelModal(sealedBag);
                setSuccessModal({
                    title: "Bag Sealed & Closed",
                    message: `Outbound Bag "${bagNumber}" has been SEALED & CLOSED. Printable Thermal Label generated!`
                });
            } else {
                setErrorMessage(data.error || 'Failed to seal bag.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Server error sealing bag.');
        }
    };

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rawBarcode = barcodeInput.trim();
        const barcode = extractLatestBarcode(rawBarcode);
        if (!barcode) return;

        // Reset previous scan output and modals for clean new scan evaluation
        setUnallocatedPartnerModal(null);
        setValidationCard(null);

        // Clear input instantly and store last scanned to prevent concatenation
        setLastScanned(barcode);
        setBarcodeInput('');
        if (scanInputRef.current) scanInputRef.current.value = '';

        // Auto select input text so next scan overwrites or strips it
        setTimeout(() => {
            scanInputRef.current?.select();
        }, 50);

        if (!activeOutboundBag) {
            setErrorMessage('Please select or create an Outbound LMD Bag first before scanning.');
            setStatus('ERROR');
            return;
        }

        if (activeOutboundBag.status === 'SEALED') {
            setErrorMessage(`Outbound Bag "${activeOutboundBag.bagNumber}" is SEALED & CLOSED. No additional parcels can be added.`);
            setStatus('ERROR');
            setValidationCard({
                status: 'INCORRECT',
                reason: 'BAG_CLOSED',
                error: `Outbound Bag "${activeOutboundBag.bagNumber}" is SEALED & CLOSED. No additional parcels can be added.`,
                bagNumber: activeOutboundBag.bagNumber
            });
            return;
        }

        if (secondScanManifestStatus === 'CLOSED') {
            setErrorMessage(`Manifest "${selectedSecondScanMawb}" is CLOSED. Cannot allocate parcels.`);
            setStatus('ERROR');
            return;
        }

        // ── PRE-CHECK DUPLICATE across ALL outbound bags in current manifest ──
        const cleanBarcodeLMD = barcode.trim().toLowerCase();
        let foundBag: any = null;
        let preExistingLMD: any = null;

        for (const b of (outboundBags || [])) {
            const p = (b.parcels || []).find((item: any) =>
                item.trackingNumber?.trim().toLowerCase() === cleanBarcodeLMD ||
                item.senderReference?.trim().toLowerCase() === cleanBarcodeLMD
            );
            if (p) {
                foundBag = b;
                preExistingLMD = p;
                break;
            }
        }

        if (preExistingLMD && foundBag) {
            const skynetCode = preExistingLMD.trackingNumber || barcode;
            const temuCode = preExistingLMD.senderReference;
            const isDifferentBag = foundBag.bagNumber !== activeOutboundBag.bagNumber;
            const isSealed = foundBag.status === 'SEALED';
            const wasScannedViaTemu = Boolean(
                preExistingLMD._scannedVia === 'TEMU' ||
                preExistingLMD.isTemuScan === true ||
                preExistingLMD.scannedMethod === 'TEMU'
            );
            const isTemuSameBag = !isDifferentBag && !isSealed && wasScannedViaTemu;

            const dupMsg = (isDifferentBag || isSealed)
                ? `Already scanned!! Parcel (${skynetCode}) is ALREADY assigned to Bag "${foundBag.bagNumber}".`
                : isTemuSameBag
                    ? `Already scanned via Temu Barcode (${temuCode}) in Bag "${foundBag.bagNumber}".`
                    : `Already scanned!! This barcode is already assigned to Bag "${activeOutboundBag.bagNumber}".`;

            setStatus('ERROR');
            setErrorMessage(dupMsg);
            setValidationCard({
                status: 'INCORRECT',
                reason: 'DUPLICATE',
                error: dupMsg,
                bagNumber: activeOutboundBag.bagNumber
            });
            setDuplicateModal({
                barcode,
                skynetTrackingNumber: skynetCode,
                senderReference: temuCode,
                originalMethod: isTemuSameBag ? `Temu Barcode (${temuCode})` : `Skynet Barcode (${skynetCode})`,
                isTemuScanDuplicate: isTemuSameBag,
                bagNumber: foundBag.bagNumber,
                message: dupMsg,
                type: 'allocate'
            });
            return;
        }

        setStatus('FETCHING');
        setErrorMessage('');
        setLastScanned(barcode);

        try {
            const response = await fetch('/api/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackingNumber: barcode,
                    stage: 'second',
                    targetMawb: selectedSecondScanMawb,
                    targetPartner: activeOutboundBag.targetPartner || 'ALL',
                    outboundBagNumber: activeOutboundBag.bagNumber
                }),
            });
            const data: any = await response.json();

            if (data.success && data.validation !== 'INCORRECT' && data.parcel) {
                // Validation: CORRECT!
                setCurrentScan(data);
                setStatus('SUCCESS');
                setScannedToday((prev) => prev + 1);

                const parcelToStore = {
                    ...data.parcel,
                    scannedBarcode: barcode,
                    displayTrackingNumber: data.parcel?.senderReference && data.parcel.senderReference.trim().toLowerCase() === barcode.trim().toLowerCase()
                        ? `${barcode} / SKYT-${data.parcel.trackingNumber}`
                        : `SKYT-${data.parcel.trackingNumber}`
                };

                // Ensure assigned partner/zone are stored with the parcel for UI rendering
                parcelToStore.assignedPartner = data.assignedPartner || parcelToStore.assignedPartner || null;
                parcelToStore.assignedZone = data.assignedZone || parcelToStore.assignedZone || null;

                if (!data.missedFirstScan) {
                    // Add to active outbound bag only when first scan was already completed.
                    const updatedBag = {
                        ...activeOutboundBag,
                        parcelCount: (activeOutboundBag.parcelCount || 0) + 1,
                        totalWeight: Number(((activeOutboundBag.totalWeight || 0) + (data.parcel?.weight || 0.1)).toFixed(2)),
                        parcels: [parcelToStore, ...(activeOutboundBag.parcels || [])]
                    };
                    setActiveOutboundBag(updatedBag);
                    setOutboundBags(prev => prev.map(b => b.bagNumber === updatedBag.bagNumber ? updatedBag : b));

                    // Save to lmd-bags API
                    fetch('/api/lmd-bags', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'add-parcel',
                            mawbRef: selectedSecondScanMawb,
                            bagNumber: activeOutboundBag.bagNumber,
                            parcel: parcelToStore,
                            operator: currentUser
                                ? (`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username || currentUser.email)
                                : undefined
                        })
                    });
                }

                setHistory((prev) => [data, ...prev].slice(0, 10));

                setValidationCard({
                    status: 'CORRECT',
                    parcel: data.parcel,
                    assignedPartner: data.assignedPartner,
                    assignedZone: data.assignedZone,
                    bagNumber: activeOutboundBag.bagNumber
                });

                const partner = data.assignedPartner as 'PickMe' | 'Domex' | 'Pronto';
                if (partner === 'PickMe' || partner === 'Domex' || partner === 'Pronto') {
                    setBinCounts((prev) => ({ ...prev, [partner]: prev[partner] + 1 }));
                    setPendingDispatch((prev) => prev + 1);
                }


            } else {
                // Validation: INCORRECT — categorize error for exact modal window
                setStatus('ERROR');
                const errMsg = data.error || `Parcel validation failed for "${barcode}".`;
                setErrorMessage(errMsg);

                const lowerErr = errMsg.toLowerCase();
                const isCombined = barcode.length > 20 || barcode.toLowerCase().includes('e+') || (barcode.match(/\d/g) || []).length > 18 || lowerErr.includes('e+');
                const isMissedFirstScan = data.reason === 'MISSED_FIRST_SCAN' || data.missedFirstScan === true;
                const isPartnerMismatch = lowerErr.includes('partner mismatch');
                const isUnallocated = lowerErr.includes('unallocated') || data.reason === 'UNALLOCATED_PARTNER';
                const isManifestMismatch = lowerErr.includes('manifest mismatch');
                const isDuplicate = data.reason === 'DUPLICATE' || lowerErr.includes('already') || lowerErr.includes('duplicate');

                if (isMissedFirstScan) {
                    // Parcel skipped 1st scan — show clear warning, do NOT add to bag
                    setMissedFirstScanModal({
                        barcode,
                        parcel: data.parcel,
                        bagNumber: activeOutboundBag.bagNumber,
                        mawbRef: selectedSecondScanMawb,
                        assignedPartner: data.assignedPartner,
                        assignedZone: data.assignedZone,
                        message: data.error || 'This parcel has not completed the 1st scan (Box Unsealing). Please perform the 1st scan first before proceeding to LMD Verification.'
                    });
                } else if (isUnallocated && !isCombined) {
                    setUnallocatedPartnerModal({
                        trackingNumber: data.parcel?.trackingNumber || barcode
                    });
                } else if ((isPartnerMismatch || isManifestMismatch || isDuplicate) && !isCombined) {
                    setDuplicateModal({
                        barcode,
                        skynetTrackingNumber: data.parcel?.trackingNumber || barcode,
                        senderReference: data.parcel?.senderReference,
                        originalMethod: `Scan`,
                        message: errMsg,
                        type: 'allocate'
                    });
                } else {
                    setInvalidBarcodeModal({
                        barcode,
                        message: errMsg,
                        isCombined
                    });
                }
            }

        } catch (err: any) {
            setErrorMessage(err.message || 'API connection failure');
            setStatus('ERROR');
            const isCombined = barcode.length > 20 || barcode.toLowerCase().includes('e+');
            setInvalidBarcodeModal({
                barcode,
                message: err.message || 'API connection failure',
                isCombined
            });
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = verifyBarcodeInput.trim();
        if (!barcode || !selectedBin) return;

        // Clear input instantly to prevent barcode concatenation
        setVerifyBarcodeInput('');
        if (verifyInputRef.current) verifyInputRef.current.value = '';

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

    // Fetch damaged parcel reports from database
    const fetchDamagedParcels = async () => {
        try {
            const res = await fetch('/api/damaged-parcels');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setDamagedReportsList(data.data);
            }
        } catch (e) {
            console.error('Failed to fetch damaged parcels list:', e);
        }
    };

    // Load damaged parcel reports when Damaged Labels tab becomes active
    useEffect(() => {
        if (activeTab === 'damaged-barcode') {
            fetchDamagedParcels();
        }
    }, [activeTab]);

    // Handle image file upload to Base64 data URL
    const handleDamagedImageUpload = (e: React.ChangeEvent<HTMLInputElement>, imageNum: 1 | 2) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('File size exceeds 10MB limit. Please choose a smaller image.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            if (imageNum === 1) {
                setDamagedImage1(result);
            } else {
                setDamagedImage2(result);
            }
        };
        reader.readAsDataURL(file);
    };

    // Submit Damaged Parcel Report (2 required images)
    const handleSubmitDamagedParcelReport = async (e: React.FormEvent) => {
        e.preventDefault();
        setDamagedSubmitError(null);
        setDamagedSubmitSuccess(null);

        const tracking = (damagedCurrentScan?.parcel?.trackingNumber || damagedManualTracking || damagedBarcodeInput).trim();
        if (!tracking) {
            setDamagedSubmitError('Please scan or enter a parcel tracking number first.');
            return;
        }

        if (!damagedImage1) {
            setDamagedSubmitError('Photo 1 (Parcel Box Condition) is required. Please upload or capture Image 1.');
            return;
        }

        if (!damagedImage2) {
            setDamagedSubmitError('Photo 2 (Label / Barcode Condition) is required. Please upload or capture Image 2.');
            return;
        }

        setDamagedSubmitting(true);
        try {
            const res = await fetch('/api/damaged-parcels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackingNumber: tracking,
                    temuBarcode: damagedCurrentScan?.parcel?.senderReference || damagedBarcodeInput || '',
                    mawbReference: damagedCurrentScan?.parcel?.mawbRef || '',
                    consigneeName: damagedCurrentScan?.parcel?.recipientName || '',
                    assignedPartner: damagedCurrentScan?.assignedPartner || '',
                    assignedZone: damagedCurrentScan?.assignedZone || '',
                    damageType: damagedReportCategory,
                    severity: damagedReportSeverity,
                    imageUrl1: damagedImage1,
                    imageUrl2: damagedImage2,
                    remarks: damagedReportRemarks,
                    reportedBy: 'Warehouse Operator'
                })
            });

            const data = await res.json();
            if (data.success) {
                setDamagedSubmitSuccess(`Damaged parcel report for "${tracking}" submitted successfully with 2 images!`);
                // Clear photo fields
                setDamagedImage1(null);
                setDamagedImage2(null);
                setDamagedReportRemarks('');
                setDamagedManualTracking('');
                setDamagedReportFormOpen(false);
                // Refresh list
                fetchDamagedParcels();
            } else {
                setDamagedSubmitError(data.error || 'Failed to submit damaged parcel report.');
            }
        } catch (err: any) {
            setDamagedSubmitError(err.message || 'Server connection error.');
        } finally {
            setDamagedSubmitting(false);
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
                            <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ color: '#374151', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>Master Air Waybill (MAWB)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '6px 12px', fontSize: '13px', color: '#111827' }}>
                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Reference:</span>
                                    <span style={{ fontWeight: '700' }}>{parcel.mawbRef}</span>

                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Carrier:</span>
                                    <span style={{ fontWeight: '600' }}>{parcel.mawbCarrier || '—'}</span>

                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Flight ID:</span>
                                    <span style={{ fontWeight: '600' }}>{parcel.mawbFlight || '—'}</span>

                                    <span style={{ color: '#6b7280', fontWeight: '500' }}>Total Bags:</span>
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

    const getPageHeaderInfo = () => {
        switch (activeTab) {
            case 'tracking':
                return {
                    title: 'Parcel Tracking & Audit Log',
                    description: 'Track shipment status through the 6-step parcel allocation lifecycle and view complete tracking history.'
                };
            case 'first-scan':
                return {
                    title: 'Box Unsealing (1st Scan)',
                    description: 'Receive incoming MAWBs, unseal bags, and perform initial 1st scan parcel verification.'
                };
            case 'second-scan':
                return {
                    title: 'LMD Verification & Allocation (2nd Scan)',
                    description: 'Verify 2nd scan status, assign LMD courier partners & zones, and manage outbound bagging.'
                };
            case 'damaged-barcode':
                return {
                    title: 'Damaged Labels Exception Management',
                    description: 'Process damaged or unreadable barcode labels and print canonical replacement stickers.'
                };
            case 'verify':
                return {
                    title: 'Dispatch Verification',
                    description: 'Verify final outbound parcel dispatches and confirm handover before courier release.'
                };
            case 'dashboard':
                if (dashboardSubTab === 'productivity') {
                    return {
                        title: 'User Productivity Dashboard',
                        description: 'Track staff scan activity, operator hourly performance, and individual throughput metrics.'
                    };
                }
                return {
                    title: 'Parcel Operations Dashboard',
                    description: 'Real-time metrics, status breakdowns, and operational throughput tracking across all shipments.'
                };
            case 'reports':
                return {
                    title: 'Reports & Analytics',
                    description: 'Export operational data, review unsealing logs, and generate summary activity reports.'
                };
            default:
                return {
                    title: 'Operational Real-Time Dashboard',
                    description: 'Real-time parcel allocation and warehouse operations management.'
                };
        }
    };

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src="/logo.png" alt="SKYNET logo" style={{ height: '24px', width: 'auto' }} />
                            <img src="/skynet_logi_logo.png" alt="LOGICENTRIX logo" style={{ height: '25px', width: 'auto' }} />
                        </div>
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

                {/* Sidebar Navigation Items Container — flex 1 to push operator card to absolute bottom */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {/* Sidebar Menu Items Category 1: Parcel Logistics */}
                    {isSidebarExpanded ? (
                        <div style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#8c98a5',
                            letterSpacing: '0.8px',
                            padding: '20px 16px 8px 16px',
                            textTransform: 'uppercase'
                        }}>
                            Parcel Logistics
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
                                label: 'Damaged Labels',
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
                                label: 'Dispatch Verify',
                                icon: (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
                                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                        <circle cx="5.5" cy="18.5" r="2.5" />
                                        <circle cx="18.5" cy="18.5" r="2.5" />
                                    </svg>
                                )
                            },
                            {
                                id: 'tracking',
                                label: 'Parcel Tracking',
                                icon: (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        <path d="M11 8v6l4 2" />
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {/* Parent label: Operational Real-Time Dashboard */}
                        {isSidebarExpanded && (
                            <div style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: '#8c98a5',
                                letterSpacing: '0.8px',
                                padding: '24px 16px 6px 16px',
                                textTransform: 'uppercase'
                            }}>
                                Operational Dashboard
                            </div>
                        )}
                        {!isSidebarExpanded && (
                            <div style={{ borderTop: '1px solid #e5e7eb', margin: '16px 12px 0 12px', paddingTop: '16px' }} />
                        )}

                        {/* Sub-item: Parcel Operations */}
                        <button
                            onClick={() => {
                                setActiveTab('dashboard');
                                setDashboardSubTab('total_received');
                            }}
                            className={`sidebar-item ${activeTab === 'dashboard' && dashboardSubTab !== 'productivity' ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                            title={!isSidebarExpanded ? 'Parcel Operations' : ''}
                            style={{ marginLeft: isSidebarExpanded ? '8px' : '0' }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                <path d="M12 22V12" />
                                <path d="m12 12 8.73-5M12 12 3.27 7" />
                            </svg>
                            {isSidebarExpanded && (
                                <span style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>Parcel Operations</span>
                            )}
                        </button>

                        {/* Sub-item: User Productivity */}
                        <button
                            onClick={() => {
                                setActiveTab('dashboard');
                                setDashboardSubTab('productivity');
                            }}
                            className={`sidebar-item ${activeTab === 'dashboard' && dashboardSubTab === 'productivity' ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                            title={!isSidebarExpanded ? 'User Productivity' : ''}
                            style={{ marginLeft: isSidebarExpanded ? '8px' : '0' }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            {isSidebarExpanded && (
                                <span style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>User Productivity</span>
                            )}
                        </button>

                        {/* Reports */}
                        <button
                            onClick={() => setActiveTab('reports' as any)}
                            className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                            title={!isSidebarExpanded ? 'Reports' : ''}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <line x1="10" y1="9" x2="8" y2="9" />
                            </svg>
                            {isSidebarExpanded && (
                                <span style={{ whiteSpace: 'nowrap' }}>Reports</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Sidebar Footer — Logged-In Operator Card matching reference design */}
                {currentUser && (
                    <div
                        onClick={() => setOperatorMenuOpen(!operatorMenuOpen)}
                        title={!isSidebarExpanded ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}` : ''}
                        style={{
                            marginTop: 'auto',
                            borderTop: '1px solid #e5e7eb',
                            padding: '12px 14px',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isSidebarExpanded ? 'space-between' : 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            {/* Initials Circle Badge */}
                            <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: '#fee2e2',
                                color: '#e21b22',
                                fontWeight: '700',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {((currentUser.firstName?.[0] || 'S') + (currentUser.lastName?.[0] || 'L')).toUpperCase()}
                            </div>
                            {isSidebarExpanded && (
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {currentUser.firstName} {currentUser.lastName}
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: '500' }}>
                                        {currentUser.role || 'Operator'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {isSidebarExpanded && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9ca3af', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        )}

                        {/* Operator Quick Switch & Logout Menu */}
                        {operatorMenuOpen && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'absolute',
                                    bottom: '56px',
                                    left: '10px',
                                    right: '10px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.12)',
                                    zIndex: 1000,
                                    padding: '8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}
                            >
                                <div style={{ padding: '4px 6px', fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6' }}>
                                    Switch Operator
                                </div>
                                <select
                                    value={currentUser.email}
                                    onChange={(e) => {
                                        const selectedEmail = e.target.value;
                                        if (selectedEmail === currentUser.email) return;
                                        const targetUser = usersList.find(u => u.email === selectedEmail);
                                        if (targetUser) {
                                            setOperatorMenuOpen(false);
                                            setSwitchUserModal(targetUser);
                                            setSwitchUserPassword('');
                                        }
                                    }}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#111827',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: '#f9fafb'
                                    }}
                                >
                                    <option value={currentUser.email}>
                                        {currentUser.firstName} {currentUser.lastName} ({currentUser.role})
                                    </option>
                                    {usersList
                                        .filter(u => u.email !== currentUser.email)
                                        .map(u => (
                                            <option key={u.id} value={u.email}>
                                                {u.first_name} {u.last_name} ({u.role})
                                            </option>
                                        ))
                                    }
                                </select>
                                <button
                                    onClick={() => {
                                        setOperatorMenuOpen(false);
                                        setRenewPinModal(true);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 8px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        backgroundColor: '#f9fafb',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🔑 Change PIN / Password
                                </button>
                                <button
                                    onClick={() => {
                                        setOperatorMenuOpen(false);
                                        handleLogout();
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '7px 8px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#ffffff',
                                        backgroundColor: '#dc2626',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Sign Out / Exit
                                </button>
                            </div>
                        )}
                    </div>
                )}
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
                    padding: '12px 24px',
                    minHeight: '68px',
                    boxSizing: 'border-box'
                }}>
                    {(() => {
                        const pageInfo = getPageHeaderInfo();
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <h1 style={{ fontWeight: '700', fontSize: '18px', color: '#111827', margin: 0, lineHeight: '1.2' }}>
                                        {pageInfo.title}
                                    </h1>
                                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400' }}>
                                        {pageInfo.description}
                                    </span>
                                </div>
                                {activeTab === 'dashboard' && (
                                    <button
                                        onClick={fetchDashboard}
                                        disabled={isLoadingDashboard}
                                        title="Refresh Dashboard Metrics"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: '#ffffff',
                                            color: '#374151',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease-in-out'
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isLoadingDashboard ? 'spin 1s linear infinite' : 'none' }}>
                                            <polyline points="23 4 23 10 17 10" />
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        );
                    })()}
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
                    PARCEL TRACKING TAB
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'tracking' && (
                        <TrackingTab />
                    )}

                    {/* ═══════════════════════════════════════════════════════
                    TAB 1 — BOX UNSEALING (FIRST SCAN)
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'first-scan' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Setup & Scan Box Card */}
                            <div style={card}>
                                <div style={label}>Box Setup & Unsealing</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
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
                                        </select>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                Scan Bag Barcode
                                            </label>
                                            <form onSubmit={(e) => {
                                                e.preventDefault();
                                                const scannedVal = bagBarcodeInput.trim();
                                                if (!scannedVal) return;
                                                const matchedBag = firstScanBags.find(b => b.bagNumber.toLowerCase() === scannedVal.toLowerCase());
                                                // Block if this bag has already been unsealed
                                                const alreadyUnsealed = unsealedBoxes.find(ub => ub.mawb === firstScanMawb && ub.bagNumber && ub.bagNumber.toLowerCase() === scannedVal.toLowerCase());
                                                if (alreadyUnsealed) {
                                                    setInvalidBagParcelModal({
                                                        barcode: alreadyUnsealed.bagNumber,
                                                        expectedBag: alreadyUnsealed.bagNumber,
                                                        actualBag: null,
                                                        reason: 'BAG_ALREADY_COMPLETED'
                                                    });
                                                    setFirstScanError(`Bag barcode "${scannedVal}" has already been unsealed.`);
                                                    setTimeout(() => bagBarcodeInputRef.current?.select(), 50);
                                                    return;
                                                }

                                                if (matchedBag) {
                                                    if (firstScanSelectedBag && firstScanSelectedBag !== matchedBag.bagNumber) {
                                                        setCustomConfirmModal({
                                                            title: "Switch Bag Session?",
                                                            message: `You are currently scanning Bag "${firstScanSelectedBag}". Are you sure you want to switch to Bag "${matchedBag.bagNumber}"? Current progress in the active box will be cleared.`,
                                                            onConfirm: () => {
                                                                setFirstScanSelectedBag(matchedBag.bagNumber);
                                                                setFirstScanExpected(matchedBag.expectedCount);
                                                                setFirstScanError('');
                                                                setFirstScanHistory([]);
                                                                setBagBarcodeInput(matchedBag.bagNumber);
                                                                setTimeout(() => {
                                                                    if (firstScanInputRef.current) {
                                                                        firstScanInputRef.current.focus();
                                                                        firstScanInputRef.current.select();
                                                                    }
                                                                }, 50);
                                                            }
                                                        });
                                                        return;
                                                    }
                                                    setFirstScanSelectedBag(matchedBag.bagNumber);
                                                    setFirstScanExpected(matchedBag.expectedCount);
                                                    setFirstScanError('');
                                                    setFirstScanHistory([]);
                                                    setBagBarcodeInput(matchedBag.bagNumber);
                                                    setTimeout(() => {
                                                        if (firstScanInputRef.current) {
                                                            firstScanInputRef.current.focus();
                                                            firstScanInputRef.current.select();
                                                        }
                                                    }, 50);
                                                } else {
                                                    setInvalidBagParcelModal({
                                                        barcode: scannedVal,
                                                        expectedBag: '',
                                                        actualBag: null,
                                                        reason: 'INVALID_BAG'
                                                    });
                                                    setFirstScanError(`Bag barcode "${scannedVal}" not found in this MAWB.`);
                                                    setTimeout(() => bagBarcodeInputRef.current?.select(), 50);
                                                }
                                            }}>
                                                <input
                                                    ref={bagBarcodeInputRef}
                                                    type="text"
                                                    value={bagBarcodeInput}
                                                    onChange={(e) => setBagBarcodeInput(e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    disabled={!firstScanMawb || isBagsLoading}
                                                    placeholder={isBagsLoading ? "Loading bags..." : "Scan bag barcode..."}
                                                    style={{ ...inputStyle, width: '100%', backgroundColor: (!firstScanMawb || isBagsLoading) ? '#f3f4f6' : '#ffffff' }}
                                                />
                                            </form>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                Select Bag Number *
                                            </label>
                                            <select
                                                value={firstScanSelectedBag}
                                                onChange={(e) => {
                                                    const selectedBagNum = e.target.value;
                                                    const matchedBag = firstScanBags.find(b => b.bagNumber === selectedBagNum);
                                                    if (matchedBag) {
                                                        const alreadyUnsealed = unsealedBoxes.find(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === matchedBag.bagNumber?.toLowerCase());
                                                        if (alreadyUnsealed) {
                                                            setInvalidBagParcelModal({
                                                                barcode: alreadyUnsealed.bagNumber,
                                                                expectedBag: alreadyUnsealed.bagNumber,
                                                                actualBag: null,
                                                                reason: 'BAG_ALREADY_COMPLETED'
                                                            });
                                                            setFirstScanError(`Bag "${matchedBag.bagNumber}" has already been unsealed.`);
                                                            return;
                                                        }
                                                        setFirstScanSelectedBag(matchedBag.bagNumber);
                                                        setFirstScanExpected(matchedBag.expectedCount);
                                                        setFirstScanError('');
                                                        setFirstScanHistory([]);
                                                        setBagBarcodeInput(matchedBag.bagNumber);
                                                        setTimeout(() => {
                                                            if (firstScanInputRef.current) {
                                                                firstScanInputRef.current.focus();
                                                                firstScanInputRef.current.select();
                                                            }
                                                        }, 50);
                                                    } else {
                                                        setFirstScanSelectedBag('');
                                                        setFirstScanExpected('');
                                                    }
                                                }}
                                                disabled={!firstScanMawb || isBagsLoading}
                                                style={{ ...inputStyle, width: '100%', backgroundColor: (!firstScanMawb || isBagsLoading) ? '#f3f4f6' : '#ffffff' }}
                                            >
                                                <option value="">{isBagsLoading ? "-- Loading bags... --" : "-- Choose bag --"}</option>
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

                                    {/* COUNT VERIFICATION (Theme-Matched Horizontal Bar - No Blue) */}
                                    <div style={{
                                        backgroundColor: '#f9fafb',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '10px 16px',
                                        marginTop: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block' }}>
                                                Count Verification
                                            </span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 12px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block' }}>Expected</span>
                                                <span style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>{firstScanExpected === '' ? '0' : firstScanExpected}</span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 12px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block' }}>Scanned</span>
                                                <span style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>{firstScanHistory.length}</span>
                                            </div>

                                            {/* Dynamic Status Tag (Theme Colors - No Blue) */}
                                            {(() => {
                                                const exp = Number(firstScanExpected);
                                                const scn = firstScanHistory.length;
                                                if (firstScanExpected === '') {
                                                    return <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block' }}>Remaining: 0 left</span>;
                                                }
                                                if (scn === exp) {
                                                    return (
                                                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            Counts Match!
                                                        </span>
                                                    );
                                                }
                                                if (scn < exp) {
                                                    return (
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#oooooo', backgroundColor: '#ffffff', border: '1px solid #dc2626', padding: '3px 8px', borderRadius: '4px' }}>
                                                            Remaining: {exp - scn} left
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '6px' }}>
                                                        Surplus: {scn - exp} extra
                                                    </span>
                                                );
                                            })()}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => {
                                                    setDiscrepancyReason('');
                                                    setCustomDiscrepancyNote('');
                                                    setConfirmFinishModal(true);
                                                }}
                                                disabled={firstScanHistory.length === 0 || firstScanExpected === ''}
                                                style={{
                                                    backgroundColor: firstScanHistory.length === Number(firstScanExpected)
                                                        ? '#16a34a'
                                                        : '#e21b22',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '7px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    cursor: (firstScanHistory.length === 0 || firstScanExpected === '') ? 'not-allowed' : 'pointer',
                                                    opacity: (firstScanHistory.length === 0 || firstScanExpected === '') ? 0.5 : 1,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {firstScanHistory.length === Number(firstScanExpected)
                                                    ? ' Finish Box (Save & Close)'
                                                    : firstScanHistory.length < Number(firstScanExpected)
                                                        ? `Finish with Shortage (${Number(firstScanExpected) - firstScanHistory.length} Missing)`
                                                        : `Finish with Overage (+${firstScanHistory.length - Number(firstScanExpected)} Extra)`
                                                }
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setCustomConfirmModal({
                                                        title: 'Clear Scanned Records?',
                                                        message: 'Are you sure you want to clear all scanned records for this box? This action will reset your current scanning progress.',
                                                        onConfirm: () => handleClearFirstScan()
                                                    });
                                                }}
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #d1d5db',
                                                    color: '#374151',
                                                    borderRadius: '6px',
                                                    padding: '7px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Reset
                                            </button>
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
                                                const rawVal = e.target.value;
                                                let val = rawVal;
                                                if (firstScanLastScanned && val.startsWith(firstScanLastScanned) && val.length > firstScanLastScanned.length) {
                                                    val = val.slice(firstScanLastScanned.length);
                                                    setFirstScanLastScanned('');
                                                }
                                                const cleanVal = extractLatestBarcode(val);
                                                setFirstScanInput(cleanVal);
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

                            {/* ASSIGNED PARTNER Card (only shown after a barcode scan if allocated to a valid partner) */}
                            {firstScanCurrentScan && firstScanCurrentScan.assignedPartner && firstScanCurrentScan.assignedPartner !== 'Unknown' && (
                                <div style={{
                                    backgroundColor: firstScanCurrentScan.assignedPartner === 'Domex'
                                        ? '#7b0f1a'
                                        : firstScanCurrentScan.assignedPartner === 'Pronto'
                                            ? '#ea580c'
                                            : '#ffcc00',
                                    borderRadius: '16px',
                                    padding: '24px 20px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease-in-out'
                                }}>
                                    <div style={{
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        color: firstScanCurrentScan.assignedPartner === 'Domex' || firstScanCurrentScan.assignedPartner === 'Pronto' ? '#ffffff' : '#000000',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.8px',
                                        marginBottom: '16px',
                                        textAlign: 'center'
                                    }}>
                                        ASSIGNED PARTNER
                                    </div>

                                    {/* Center White Card for Partner Logo */}
                                    <div style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '16px',
                                        padding: '16px 28px',
                                        width: '100%',
                                        maxWidth: '300px',
                                        height: '130px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                        marginBottom: '16px',
                                        boxSizing: 'border-box'
                                    }}>
                                        {firstScanCurrentScan.assignedPartner === 'Domex' ? (
                                            <img src="/domex_logo.png" alt="Domex" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                        ) : firstScanCurrentScan.assignedPartner === 'Pronto' ? (
                                            <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '34px', letterSpacing: '1px' }}>PRONTO</span>
                                        ) : (
                                            <img src="/pick_me_logo.png" alt="PickMe" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                        )}
                                    </div>

                                    {/* Zone Pill Badge */}
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                        border: '1px solid rgba(0, 0, 0, 0.2)',
                                        borderRadius: '20px',
                                        padding: '6px 20px',
                                        fontSize: '13.5px',
                                        color: firstScanCurrentScan.assignedPartner === 'Domex' || firstScanCurrentScan.assignedPartner === 'Pronto' ? '#ffffff' : '#000000'
                                    }}>
                                        Zone: <span style={{ fontWeight: '800', marginLeft: '4px' }}>{firstScanCurrentScan.assignedZone || 'Default-Zone'}</span>
                                    </div>
                                </div>
                            )}

                            {/* 2 Column Grid: Scanned Parcels Table (Left) and MAWB Bags Progress Overview (Right) */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 1fr',
                                gap: '20px',
                                alignItems: 'flex-start'
                            }}>
                                {/* Left Side: Scanned History for this Box */}
                                <div style={card}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div style={label}>Scanned Parcels in current box ({firstScanHistory.length})</div>
                                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>
                                            <span>Active MAWB: {firstScanMawb || '—'}</span>
                                            {firstScanSelectedBag && <span>Bag: {firstScanSelectedBag}</span>}
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
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
                                                        <td style={{ padding: '8px' }}><span style={{ backgroundColor: '#ffffffff', color: '#4c5262ff', border: '1px solid #b6acacff', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>First Scanned</span></td>
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

                                {/* Right Side: Bags Progress Overview & Replacement Sticker Preview */}
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
                                                <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#374151', textTransform: 'uppercase', fontWeight: '700' }}>Remaining</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#374151', marginTop: '2px' }}>
                                                        {firstScanBags.filter(b => getBagStatus(b.bagNumber, b.expectedCount) !== 'COMPLETED').length}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Completed Alert when all bags are finished */}
                                            {firstScanBags.length > 0 && firstScanBags.filter(b => getBagStatus(b.bagNumber, b.expectedCount) !== 'COMPLETED').length === 0 && (
                                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#16a34a' }}>
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    <span>All bags for this MAWB have been unsealed successfully!</span>
                                                </div>
                                            )}

                                            {/* Bags list */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                                                {getSortedBags().map((bag) => {
                                                    const expected = bag.expectedCount;
                                                    const scanned = getBagScannedCount(bag.bagNumber);
                                                    const status = getBagStatus(bag.bagNumber, expected);
                                                    const remaining = expected - scanned;
                                                    const unsealed = unsealedBoxes.find(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === bag.bagNumber?.toLowerCase());

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
                                                        bgColor = '#ffffff';
                                                        borderColor = '#111827';
                                                        textColor = '#111827';
                                                        descColor = '#374151';
                                                        statusText = 'Scanning';
                                                        statusColor = '#111827';
                                                        statusBg = '#e5e7eb';
                                                    }

                                                    return (
                                                        <div
                                                            key={bag.bagNumber}
                                                            onClick={() => {
                                                                if (status === 'COMPLETED') {
                                                                    setInvalidBagParcelModal({
                                                                        barcode: bag.bagNumber,
                                                                        expectedBag: bag.bagNumber,
                                                                        actualBag: null,
                                                                        reason: 'BAG_ALREADY_COMPLETED'
                                                                    });
                                                                } else {
                                                                    setFirstScanSelectedBag(bag.bagNumber);
                                                                    // Refocus scan input
                                                                    setTimeout(() => firstScanInputRef.current?.focus(), 50);
                                                                }
                                                            }}
                                                            style={{
                                                                backgroundColor: bgColor,
                                                                border: status === 'ONGOING' ? '2.5px solid #111827' : `1px solid ${borderColor}`,
                                                                borderRadius: '8px',
                                                                padding: '12px 14px',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                boxShadow: status === 'ONGOING' ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
                                                                cursor: status === 'COMPLETED' ? 'default' : 'pointer',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '65%' }}>
                                                                <span style={{ fontWeight: '700', fontSize: '13px', color: textColor }}>
                                                                    Bag: {bag.bagNumber}
                                                                </span>
                                                                <span style={{ fontSize: '11px', color: descColor, wordBreak: 'break-word' }}>
                                                                    {status === 'COMPLETED'
                                                                        ? (unsealed && unsealed.status && unsealed.status !== 'COUNTED'
                                                                            ? `Unsealed with note: ${unsealed.status}`
                                                                            : 'Unsealed successfully')
                                                                        : status === 'ONGOING'
                                                                            ? `${remaining} parcels remaining`
                                                                            : `Awaiting unsealing (${expected} expected)`
                                                                    }
                                                                </span>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {scanned !== expected && status === 'COMPLETED' && (
                                                                    <span style={{
                                                                        fontSize: '10px',
                                                                        fontWeight: '700',
                                                                        color: scanned < expected ? '#dc2626' : '#ea580c',
                                                                        backgroundColor: scanned < expected ? '#fee2e2' : '#ffedd5',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {scanned < expected ? `-${expected - scanned} Missing` : `+${scanned - expected} Extra`}
                                                                    </span>
                                                                )}
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

                                    {/* ── INLINE TEMU REPLACEMENT STICKER PREVIEW ── */}
                                    {lastTemuSticker && (
                                        <div style={{
                                            ...card,
                                            border: '2px solid #e21b22',
                                            backgroundColor: '#fffafb',
                                            padding: '16px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>🖨 Replacement Thermal Sticker Preview</span>
                                                </div>
                                                <button
                                                    onClick={() => setLastTemuSticker(null)}
                                                    style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}
                                                >
                                                    ✕ Dismiss
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                                                {/* Scanned & Resolved Info */}
                                                <div style={{ width: '100%', fontSize: '11px', color: '#374151', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '8px 10px', lineHeight: '1.4', boxSizing: 'border-box' }}>
                                                    <strong>Damaged Barcode Scanned!</strong><br />
                                                    Temu Ref: <span style={{ color: '#dc2626', fontWeight: '700' }}>{lastTemuSticker.temuBarcode}</span><br />
                                                    Skynet ID: <span style={{ fontWeight: '700' }}>{lastTemuSticker.skynetTrackingNumber}</span>
                                                </div>

                                                {/* Thermal Label Graphic Card */}
                                                <div
                                                    id="inline-thermal-label-print-area"
                                                    style={{
                                                        border: '2px solid #111827',
                                                        borderRadius: '8px',
                                                        padding: '12px',
                                                        backgroundColor: '#ffffff',
                                                        color: '#000000',
                                                        width: '100%',
                                                        boxSizing: 'border-box',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                                        fontFamily: "'Inter', sans-serif"
                                                    }}
                                                >
                                                    {/* Brand Header */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '6px', marginBottom: '8px' }}>
                                                        <div>
                                                            <img src="/logo.png" alt="Skynet Worldwide Express" style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', display: 'block' }} />
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ backgroundColor: '#111827', color: '#ffffff', fontSize: '8px', fontWeight: '800', padding: '2px 5px', borderRadius: '3px', textTransform: 'uppercase' }}>
                                                                REPLACEMENT STICKER
                                                            </span>
                                                            {lastTemuSticker.assignedPartner && (
                                                                <div style={{ fontSize: '9px', fontWeight: '800', color: '#111827', marginTop: '2px' }}>
                                                                    {lastTemuSticker.assignedPartner}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* SVG Barcode */}
                                                    <div
                                                        style={{ margin: '6px 0', textAlign: 'center' }}
                                                        dangerouslySetInnerHTML={{ __html: generateCode128SVG(lastTemuSticker.skynetTrackingNumber) }}
                                                    />

                                                    {/* Tracking Number */}
                                                    <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: '900', letterSpacing: '1.5px', color: '#000000', marginBottom: '6px' }}>
                                                        SKYT-{lastTemuSticker.skynetTrackingNumber}
                                                    </div>

                                                    {/* Temu Sender Reference */}
                                                    <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: '700', textAlign: 'center', marginBottom: '8px' }}>
                                                        TEMU REF: {lastTemuSticker.temuBarcode}
                                                    </div>

                                                    {/* Label Information Grid */}
                                                    <div style={{ borderTop: '1px dashed #000000', paddingTop: '6px', fontSize: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                                        <div>
                                                            <span style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', display: 'block' }}>CONSIGNEE</span>
                                                            <strong style={{ fontSize: '10px' }}>{lastTemuSticker.recipientName || 'Consignee'}</strong>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', display: 'block' }}>DESTINATION</span>
                                                            <strong style={{ fontSize: '10px' }}>{lastTemuSticker.city || '—'}</strong>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', display: 'block' }}>MAWB REF</span>
                                                            <strong>{lastTemuSticker.mawbRef || '—'}</strong>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', display: 'block' }}>BAG NUMBER</span>
                                                            <strong>{lastTemuSticker.bagNumber || '—'}</strong>
                                                        </div>
                                                    </div>

                                                    {/* Zone Footer Badge */}
                                                    {lastTemuSticker.assignedZone && (
                                                        <div style={{ marginTop: '8px', borderTop: '1px solid #000000', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '9px', fontWeight: '700' }}>DESTINATION ZONE:</span>
                                                            <span style={{ fontSize: '12px', fontWeight: '900', backgroundColor: '#111827', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                                                                {lastTemuSticker.assignedZone}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Print Action Button */}
                                                <button
                                                    onClick={() => {
                                                        const printArea = document.getElementById('inline-thermal-label-print-area');
                                                        if (!printArea) return;
                                                        const win = window.open('', '', 'width=600,height=600');
                                                        if (win) {
                                                            win.document.write(`
                                                                    <html>
                                                                        <head>
                                                                            <title>Print Skynet Label - ${lastTemuSticker.skynetTrackingNumber}</title>
                                                                            <style>
                                                                                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                                                                                body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
                                                                                @media print { body { padding: 0; } }
                                                                            </style>
                                                                        </head>
                                                                        <body>
                                                                            ${printArea.outerHTML}
                                                                        </body>
                                                                    </html>
                                                                `);
                                                            win.document.close();
                                                            win.focus();
                                                            setTimeout(() => {
                                                                win.print();
                                                                win.close();
                                                            }, 250);
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        backgroundColor: '#e21b22',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '10px 14px',
                                                        fontSize: '12px',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        boxShadow: '0 2px 4px rgba(226, 27, 34, 0.2)'
                                                    }}
                                                >
                                                    🖨 Print Thermal Sticker Now
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════
                    TAB 2 — LMD ALLOCATION & OUTBOUND BAGGING (SECOND SCAN)
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'second-scan' && (
                        <div>
                            {status === 'ERROR' && (
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    Scan Error: {errorMessage}
                                </div>
                            )}

                            {/* ── BOX SETUP & OUTBOUND BAGGING (TOOLBAR) ── */}
                            <div style={card}>
                                <div style={label}>Box Setup & Outbound Bagging</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ flex: 1, minWidth: '280px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                                Select Active MAWB (Master Air Waybill) *
                                            </label>
                                            <select
                                                value={selectedSecondScanMawb}
                                                onChange={(e) => setSelectedSecondScanMawb(e.target.value)}
                                                style={{ ...inputStyle, width: '100%', backgroundColor: '#ffffff', color: '#111827', fontWeight: '600' }}
                                            >
                                                <option value="">-- Choose active MAWB --</option>
                                                {mawbsList.map(m => (
                                                    <option key={m.mawb_reference} value={m.mawb_reference}>
                                                        {m.mawb_reference} ({m.carrier || 'MAWB'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', paddingTop: '18px' }}>
                                            <button
                                                onClick={() => {
                                                    const partnerCode = newBagPartner && newBagPartner !== 'ALL' ? `-${newBagPartner.toUpperCase()}` : '';
                                                    setCustomBagNumber(`${selectedSecondScanMawb}${partnerCode}-BAG-${String((outboundBags?.length || 0) + 1).padStart(2, '0')}`);
                                                    setCreateBagModalOpen(true);
                                                }}
                                                disabled={secondScanManifestStatus === 'CLOSED'}
                                                style={{
                                                    backgroundColor: secondScanManifestStatus === 'CLOSED' ? '#9ca3af' : '#ffffff',
                                                    color: secondScanManifestStatus === 'CLOSED' ? '#ffffff' : '#374151',
                                                    border: secondScanManifestStatus === 'CLOSED' ? '1px solid #9ca3af' : '1px solid #d1d5db',
                                                    borderRadius: '8px',
                                                    padding: '10px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: secondScanManifestStatus === 'CLOSED' ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                + Create New Outbound Bag
                                            </button>

                                            {secondScanManifestStatus === 'OPEN' && (
                                                <button
                                                    onClick={() => {
                                                        setCustomConfirmModal({
                                                            title: "Close Manifest?",
                                                            message: `Are you sure you want to CLOSE Manifest "${selectedSecondScanMawb}"? Once closed, no additional bags can be created under this manifest.`,
                                                            onConfirm: () => handleCloseManifest()
                                                        });
                                                    }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #d1d5db',
                                                        color: '#374151',
                                                        borderRadius: '8px',
                                                        padding: '10px 14px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    🔒 Close Manifest
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Outbound Bags Selector Pills */}
                                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '4px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            Outbound LMD Bags for Manifest ({outboundBags.length} Bags):
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {outboundBags.map((bag) => {
                                                const isActive = activeOutboundBag?.bagNumber === bag.bagNumber;
                                                const isSealed = bag.status === 'SEALED';
                                                const partner = bag.targetPartner || 'ALL';

                                                const partnerBgColor =
                                                    partner === 'PickMe' ? '#facc15' :
                                                        partner === 'Domex' ? '#800020' :
                                                            partner === 'Pronto' ? '#d97706' : '#4b5563';

                                                const partnerTextColor =
                                                    partner === 'PickMe' ? '#111827' : '#ffffff';

                                                const partnerBorderColor =
                                                    partner === 'PickMe' ? '#eab308' :
                                                        partner === 'Domex' ? '#800020' :
                                                            partner === 'Pronto' ? '#d97706' : '#e21b22';

                                                return (
                                                    <button
                                                        key={bag.bagNumber}
                                                        onClick={() => setActiveOutboundBag(bag)}
                                                        style={{
                                                            backgroundColor: '#ffffff',
                                                            color: '#374151',
                                                            border: isActive
                                                                ? `2px solid ${partnerBorderColor}`
                                                                : '1px solid #d1d5db',
                                                            borderRadius: '8px',
                                                            padding: '10px 14px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        <span>{bag.bagNumber}</span>
                                                        <span style={{
                                                            backgroundColor: partnerBgColor,
                                                            color: partnerTextColor,
                                                            padding: '2px 7px',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: '800',
                                                            letterSpacing: '0.3px'
                                                        }}>
                                                            {partner}
                                                        </span>
                                                        <span style={{
                                                            backgroundColor: isSealed ? '#dc2626' : '#f3f4f6',
                                                            color: isSealed ? '#ffffff' : '#374151',
                                                            border: isSealed ? 'none' : '1px solid #e5e7eb',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: '700'
                                                        }}>
                                                            {isSealed ? 'SEALED' : `${bag.parcelCount} Pcs`}
                                                        </span>
                                                    </button>
                                                );
                                            })}

                                            {outboundBags.length === 0 && (
                                                <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                    No outbound bags created yet for this manifest. Click <strong>"+ Create New Outbound Bag"</strong> to start bagging.
                                                </span>
                                            )}
                                        </div>

                                        {/* Horizontal Active Outbound Bag Box (Box Unsealing Theme) */}
                                        {activeOutboundBag && (
                                            <div style={{
                                                backgroundColor: '#ffffff',
                                                border: activeOutboundBag.status === 'SEALED' ? '2px solid #ef4444' : '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                padding: '12px 18px',
                                                marginTop: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '14px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                            }}>
                                                {/* Left Info */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>
                                                            Active Outbound Bag
                                                        </div>
                                                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span>{activeOutboundBag.bagNumber}</span>
                                                            <span style={{
                                                                backgroundColor: activeOutboundBag.targetPartner === 'PickMe' ? '#facc15' : activeOutboundBag.targetPartner === 'Domex' ? '#800020' : activeOutboundBag.targetPartner === 'Pronto' ? '#d97706' : '#4b5563',
                                                                color: activeOutboundBag.targetPartner === 'PickMe' ? '#111827' : '#ffffff',
                                                                fontSize: '10px',
                                                                fontWeight: '800',
                                                                padding: '2px 7px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                {activeOutboundBag.targetPartner || 'ALL'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '16px', display: 'flex', gap: '16px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>Parcels Inside</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0b0c0cff' }}>{activeOutboundBag.parcelCount || 0} Pcs</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>Total Weight</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>{activeOutboundBag.totalWeight || '0.00'} kg</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Status badge & Seal & Close Bag Now button */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #d1d5db',
                                                        color: '#374151',
                                                        borderRadius: '8px',
                                                        padding: '0 14px',
                                                        height: '38px',
                                                        boxSizing: 'border-box',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}>
                                                        <span>Status:</span>
                                                        <span style={{
                                                            backgroundColor: activeOutboundBag.status === 'SEALED' ? '#fee2e2' : '#f3f4f6',
                                                            color: activeOutboundBag.status === 'SEALED' ? '#dc2626' : '#374151',
                                                            border: activeOutboundBag.status === 'SEALED' ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontWeight: '700',
                                                            fontSize: '11px'
                                                        }}>
                                                            {activeOutboundBag.status || 'OPEN'}
                                                        </span>
                                                    </div>

                                                    {activeOutboundBag.status === 'OPEN' ? (
                                                        <button
                                                            onClick={() => {
                                                                setCustomConfirmModal({
                                                                    title: "Seal & Close Outbound Bag?",
                                                                    message: `Are you sure you want to SEAL and CLOSE Outbound Bag "${activeOutboundBag.bagNumber}"? Once sealed, no additional parcels can be added to this bag.`,
                                                                    onConfirm: () => handleSealOutboundBag(activeOutboundBag.bagNumber)
                                                                });
                                                            }}
                                                            disabled={activeOutboundBag.parcelCount === 0}
                                                            style={{
                                                                backgroundColor: '#ffffff',
                                                                border: '1px solid #d1d5db',
                                                                color: '#374151',
                                                                borderRadius: '8px',
                                                                padding: '0 14px',
                                                                height: '38px',
                                                                boxSizing: 'border-box',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '12px',
                                                                fontWeight: '600',
                                                                cursor: activeOutboundBag.parcelCount === 0 ? 'not-allowed' : 'pointer',
                                                                opacity: activeOutboundBag.parcelCount === 0 ? 0.5 : 1
                                                            }}
                                                        >
                                                            🔒 Seal &amp; Close Bag Now
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setPrintOutboundBagLabelModal(activeOutboundBag)}
                                                            style={{
                                                                backgroundColor: '#ffffff',
                                                                border: '1px solid #d1d5db',
                                                                color: '#374151',
                                                                borderRadius: '8px',
                                                                padding: '0 14px',
                                                                height: '38px',
                                                                boxSizing: 'border-box',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '12px',
                                                                fontWeight: '600',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            🖨 Print Bag Label
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── MAIN SCANNING & VALIDATION GRID ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px' }}>

                                {/* LEFT COLUMN: BARCODE INPUT & REAL-TIME VALIDATION CARD */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Barcode Input Card */}
                                    <div style={card}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={label}>Parcel Barcode Input</div>
                                            {activeOutboundBag && (
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: activeOutboundBag.status === 'SEALED' ? '#dc2626' : '#151817ff' }}>
                                                    Allocating to: <strong>{activeOutboundBag.bagNumber}</strong> ({activeOutboundBag.targetPartner || 'ALL'})
                                                </span>
                                            )}
                                        </div>
                                        <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                            <input
                                                ref={scanInputRef}
                                                type="text"
                                                value={barcodeInput}
                                                onKeyDown={(e) => {
                                                    if (lastScanned && e.key !== 'Enter' && e.key !== 'Tab') {
                                                        const currentVal = e.currentTarget.value.trim();
                                                        if (currentVal === lastScanned.trim() || currentVal.startsWith(lastScanned.trim())) {
                                                            setBarcodeInput('');
                                                            setLastScanned('');
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const rawVal = e.target.value;
                                                    let val = rawVal;
                                                    if (lastScanned && val.startsWith(lastScanned) && val.length > lastScanned.length) {
                                                        val = val.slice(lastScanned.length);
                                                        setLastScanned('');
                                                    } else if (lastScanned && val !== lastScanned) {
                                                        setLastScanned('');
                                                    }
                                                    setBarcodeInput(extractLatestBarcode(val));
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                disabled={!activeOutboundBag || activeOutboundBag.status === 'SEALED'}
                                                placeholder={
                                                    !activeOutboundBag
                                                        ? "Please select or create an Outbound Bag first..."
                                                        : activeOutboundBag.status === 'SEALED'
                                                            ? "Bag is SEALED & CLOSED. No more scans allowed."
                                                            : "Scan parcel barcode into active bag..."
                                                }
                                                className="scan-input-blink"
                                                style={{
                                                    ...inputStyle,
                                                    flex: 1,
                                                    opacity: (!activeOutboundBag || activeOutboundBag.status === 'SEALED') ? 0.6 : 1
                                                }}
                                            />
                                        </form>
                                        {rowItem('Manifest', selectedSecondScanMawb)}
                                        {rowItem('Workstation Scanned Today', <span style={{ color: '#e21b22', fontWeight: '700' }}>{scannedToday}</span>, true)}
                                    </div>

                                    {/* REAL-TIME VALIDATION CARD — Only shown on CORRECT scan */}
                                    <div style={{
                                        ...card,
                                        padding: '0',
                                        overflow: 'hidden',
                                        border: '1px solid #e5e7eb',
                                        transition: 'all 0.2s ease-in-out'
                                    }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '14px 18px 10px' }}>
                                            Parcel Validation Result
                                        </div>

                                        {validationCard && validationCard.status === 'CORRECT' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                {/* FULL-WIDTH PARTNER BANNER */}
                                                <div style={{
                                                    backgroundColor: validationCard.assignedPartner === 'Domex'
                                                        ? '#7b0f1a'
                                                        : validationCard.assignedPartner === 'Pronto'
                                                            ? '#ea580c'
                                                            : '#ffcc00',
                                                    padding: '24px 20px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s ease-in-out',
                                                    gap: '14px'
                                                }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: '800',
                                                        color: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'Pronto' ? '#ffffff' : '#000000',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.8px',
                                                        textAlign: 'center'
                                                    }}>
                                                        ASSIGNED PARTNER
                                                    </div>

                                                    {/* White Logo Card */}
                                                    <div style={{
                                                        backgroundColor: '#ffffff',
                                                        borderRadius: '16px',
                                                        padding: '16px 28px',
                                                        width: '100%',
                                                        maxWidth: '300px',
                                                        height: '120px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                                        boxSizing: 'border-box'
                                                    }}>
                                                        {validationCard.assignedPartner === 'Domex' ? (
                                                            <img src="/domex_logo.png" alt="Domex" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                        ) : validationCard.assignedPartner === 'Pronto' ? (
                                                            <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '34px', letterSpacing: '1px' }}>PRONTO</span>
                                                        ) : (
                                                            <img src="/pick_me_logo.png" alt="PickMe" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                        )}
                                                    </div>

                                                    {/* Zone Pill Badge
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: 'rgba(0,0,0,0.04)',
                                                        border: '1px solid rgba(0,0,0,0.2)',
                                                        borderRadius: '20px',
                                                        padding: '6px 20px',
                                                        fontSize: '13.5px',
                                                        color: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'Pronto' ? '#ffffff' : '#000000'
                                                    }}>
                                                        Zone: <span style={{ fontWeight: '800', marginLeft: '4px' }}>{validationCard.assignedZone || 'Default-Zone'}</span>
                                                    </div> */}

                                                    {/* Validation Result Badge */}
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        // backgroundColor: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'Pronto'
                                                        //     ? 'rgba(255, 255, 255, 0.15)'
                                                        //     : 'rgba(0, 0, 0, 0.06)',
                                                        // border: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'Pronto'
                                                        //     ? '1px solid rgba(255, 255, 255, 0.3)'
                                                        //     : '1px solid rgba(0, 0, 0, 0.2)',
                                                        // borderRadius: '20px',
                                                        // padding: '7px 20px',
                                                        fontSize: '10px',
                                                        fontWeight: '800',
                                                        color: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'Pronto' ? '#ffffff' : '#000000',
                                                        textAlign: 'center'
                                                    }}>
                                                        <span style={{
                                                            color: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'Pronto'
                                                                ? '#222523ff'
                                                                : '#121414ff'
                                                        }}></span>
                                                        <span>✓ CORRECT Assigned to Bag <strong>{validationCard.bagNumber}</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#9ca3af' }}>
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 10px auto', display: 'block' }}>
                                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                </svg>
                                                <span style={{ fontSize: '14px', fontWeight: '600' }}>Awaiting parcel barcode scan...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* ── TABLE: SCANNED PARCELS IN ACTIVE OUTBOUND BAG ── */}
                            <div style={card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={label}>
                                        Allocated Parcels in Active Bag ({activeOutboundBag?.parcels?.length || 0} Parcels)
                                    </div>
                                    {activeOutboundBag && (
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#090a0aff' }}>
                                            Bag: {activeOutboundBag.bagNumber}
                                        </span>
                                    )}
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            {['Tracking no.', 'Consignee', 'LMD Partner', 'Zone', 'Weight (kg)', 'City', 'Validation Status'].map(h => (
                                                <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeOutboundBag?.parcels?.map((parcel: any, idx: number) => {
                                            const partner = (parcel.assignedPartner && parcel.assignedPartner !== 'Unknown') ? parcel.assignedPartner : '-';
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '8px', fontWeight: '600', color: '#111827' }}>
                                                        {parcel.displayTrackingNumber || (parcel.senderReference ? `${parcel.senderReference} / SKYT-${parcel.trackingNumber}` : `SKYT-${parcel.trackingNumber}`)}
                                                    </td>
                                                    <td style={{ padding: '8px', color: '#374151' }}>{parcel.recipientName}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        {partner !== '-' ? (
                                                            <span style={{
                                                                backgroundColor: partner === 'PickMe' ? '#ffcc00' : partner === 'Pronto' ? '#ea580c' : partner === 'Domex' ? '#7b0f1a' : '#4b5563',
                                                                color: partner === 'PickMe' ? '#000000' : '#ffffff',
                                                                padding: '3px 8px',
                                                                borderRadius: '4px',
                                                                fontWeight: '700',
                                                                fontSize: '11px',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {partner}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#9ca3af' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px', color: '#4b5563' }}>{parcel.province || parcel.assignedZone || 'Zone'}</td>
                                                    <td style={{ padding: '8px', fontWeight: '600' }}>{parcel.weight || '0.1'} kg</td>
                                                    <td style={{ padding: '8px', color: '#6b7280' }}>{parcel.city}</td>
                                                    <td style={{ padding: '8px', color: '#6b7280' }}>
                                                        <span style={{
                                                            backgroundColor: '#ffffff',
                                                            color: '#4c5262',
                                                            border: '1px solid #b6acac',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: '600'
                                                        }}>
                                                            ✓ Correct
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!activeOutboundBag?.parcels || activeOutboundBag.parcels.length === 0) && (
                                            <tr>
                                                <td colSpan={7} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
                                                    No parcels allocated to this outbound bag yet. Scan parcels above to fill bag.
                                                </td>
                                            </tr>
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
                            {/* SUB-TABS NAVIGATION FOR DAMAGED LABELS EXCEPTION MANAGEMENT */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
                                <button
                                    onClick={() => setDamagedSubTab('label')}
                                    style={{
                                        backgroundColor: damagedSubTab === 'label' ? '#dc2626' : '#ffffff',
                                        color: damagedSubTab === 'label' ? '#ffffff' : '#374151',
                                        border: damagedSubTab === 'label' ? '1px solid #dc2626' : '1px solid #d1d5db',
                                        padding: '10px 22px',
                                        borderRadius: '8px',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: damagedSubTab === 'label' ? '0 2px 4px rgba(220, 38, 38, 0.2)' : '0 1px 2px rgba(0,0,0,0.04)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Damaged Label
                                </button>
                                <button
                                    onClick={() => setDamagedSubTab('parcels')}
                                    style={{
                                        backgroundColor: damagedSubTab === 'parcels' ? '#dc2626' : '#ffffff',
                                        color: damagedSubTab === 'parcels' ? '#ffffff' : '#374151',
                                        border: damagedSubTab === 'parcels' ? '1px solid #dc2626' : '1px solid #d1d5db',
                                        padding: '10px 22px',
                                        borderRadius: '8px',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: damagedSubTab === 'parcels' ? '0 2px 4px rgba(220, 38, 38, 0.2)' : '0 1px 2px rgba(0,0,0,0.04)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Damaged Parcels ({damagedReportsList.length})
                                </button>
                            </div>

                            {/* ── SUB-TAB 1: DAMAGED LABEL ── */}
                            {damagedSubTab === 'label' && (
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
                                                    <button
                                                        onClick={() => {
                                                            if (damagedCurrentScan?.parcel) {
                                                                setPrintLabelModal({
                                                                    trackingNumber: damagedCurrentScan.parcel.trackingNumber,
                                                                    senderReference: damagedCurrentScan.parcel.senderReference,
                                                                    recipientName: damagedCurrentScan.parcel.recipientName,
                                                                    city: damagedCurrentScan.parcel.city,
                                                                    province: damagedCurrentScan.parcel.province,
                                                                    district: damagedCurrentScan.parcel.district,
                                                                    weight: damagedCurrentScan.parcel.weight,
                                                                    mawbRef: damagedCurrentScan.parcel.mawbRef,
                                                                    assignedPartner: damagedCurrentScan.assignedPartner,
                                                                    assignedZone: damagedCurrentScan.assignedZone
                                                                });
                                                            }
                                                        }}
                                                        style={{
                                                            ...btnSecondary,
                                                            backgroundColor: '#eff6ff',
                                                            color: '#2563eb',
                                                            border: '1px solid #bfdbfe',
                                                            fontWeight: '700'
                                                        }}
                                                    >
                                                        🖨 Print Replacement Label
                                                    </button>
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

                            {/* ── SUB-TAB 2: DAMAGED PARCELS (WHITE THEME) ── */}
                            {damagedSubTab === 'parcels' && (
                                <div>
                                    <div style={{ ...card, border: '1px solid #e5e7eb', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f3f4f6', paddingBottom: '16px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: '800' }}>
                                                        Damaged Parcels Photo Submission Section
                                                    </h3>

                                                </div>
                                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                                                    Record damaged parcel details and attach 2 required images (Parcel condition & Label condition) for claim verification and system database storage.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setDamagedReportFormOpen(!damagedReportFormOpen);
                                                    setDamagedSubmitError(null);
                                                    setDamagedSubmitSuccess(null);
                                                }}
                                                style={{
                                                    ...btnPrimary,
                                                    backgroundColor: damagedReportFormOpen ? '#4b5563' : '#dc2626',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontWeight: '700',
                                                    padding: '10px 20px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                {damagedReportFormOpen ? '✖ Close Form' : 'Submit Damaged Parcel'}
                                            </button>
                                        </div>

                                        {damagedSubmitSuccess && (
                                            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                ✅ {damagedSubmitSuccess}
                                            </div>
                                        )}

                                        {/* DAMAGED PARCEL REPORT FORM CARD (WHITE THEME) */}
                                        {damagedReportFormOpen && (
                                            <form onSubmit={handleSubmitDamagedParcelReport} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>

                                                {damagedSubmitError && (
                                                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: '600' }}>
                                                        ⚠️ {damagedSubmitError}
                                                    </div>
                                                )}

                                                {/* Target Parcel Info Banner (White / Gray theme) */}
                                                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#374151', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                        Selected Parcel to Report:
                                                    </div>
                                                    {damagedCurrentScan?.parcel ? (
                                                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#111827' }}>
                                                            <div><strong>Tracking:</strong> <span style={{ color: '#dc2626', fontWeight: '800' }}>{damagedCurrentScan.parcel.trackingNumber}</span></div>
                                                            {damagedCurrentScan.parcel.senderReference && <div><strong>Temu Barcode:</strong> {damagedCurrentScan.parcel.senderReference}</div>}
                                                            {damagedCurrentScan.parcel.mawbRef && <div><strong>MAWB:</strong> {damagedCurrentScan.parcel.mawbRef}</div>}
                                                            {damagedCurrentScan.assignedPartner && <div><strong>Partner:</strong> <span style={{ fontWeight: '700' }}>{damagedCurrentScan.assignedPartner}</span></div>}
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>No barcode currently active in scanner. Enter tracking number manually below:</div>
                                                            <input
                                                                type="text"
                                                                value={damagedManualTracking}
                                                                onChange={(e) => setDamagedManualTracking(e.target.value)}
                                                                placeholder="Enter Skynet Tracking Number (e.g. SKY-998822)..."
                                                                style={{ ...inputStyle, maxWidth: '400px' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Damage Category & Severity Selection */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>
                                                    <div>
                                                        <label style={{ ...label, marginBottom: '6px' }}>Damage Category *</label>
                                                        <select
                                                            value={damagedReportCategory}
                                                            onChange={(e) => setDamagedReportCategory(e.target.value)}
                                                            style={{ ...inputStyle, width: '100%', cursor: 'pointer', backgroundColor: '#ffffff' }}
                                                        >
                                                            <option value="Packaging Crushed / Torn">Packaging Crushed / Torn</option>
                                                            <option value="Water / Liquid Damage">Water / Liquid Damage</option>
                                                            <option value="Barcode / Label Unreadable">Barcode / Label Unreadable</option>
                                                            <option value="Contents Exposed / Damaged">Contents Exposed / Damaged</option>
                                                            <option value="Tampered Tape / Open">Tampered Tape / Open Package</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label style={{ ...label, marginBottom: '6px' }}>Severity Level *</label>
                                                        <select
                                                            value={damagedReportSeverity}
                                                            onChange={(e) => setDamagedReportSeverity(e.target.value)}
                                                            style={{ ...inputStyle, width: '100%', cursor: 'pointer', backgroundColor: '#ffffff' }}
                                                        >
                                                            <option value="Minor">Minor (Packaging Scratched / Light Dent)</option>
                                                            <option value="Moderate">Moderate (Box Crushed / Partial Label Damage)</option>
                                                            <option value="Severe / Total Loss">Severe / Total Loss (Contents Destroyed)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* DUAL IMAGE UPLOADS CONTAINER (WHITE THEME) */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>

                                                    {/* IMAGE 1: PARCEL CONDITION */}
                                                    <div style={{ border: damagedImage1 ? '2px solid #22c55e' : '2px dashed #cbd5e1', borderRadius: '12px', padding: '18px', backgroundColor: damagedImage1 ? '#f0fdf4' : '#f8fafc', textAlign: 'center', transition: 'all 0.2s' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '800', color: damagedImage1 ? '#15803d' : '#111827' }}>
                                                                Photo 1: Parcel Box Condition *
                                                            </span>
                                                            {damagedImage1 ? (
                                                                <span style={{ backgroundColor: '#22c55e', color: '#ffffff', fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                                                                    Uploaded
                                                                </span>
                                                            ) : (
                                                                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                                                                    Required
                                                                </span>
                                                            )}
                                                        </div>

                                                        {damagedImage1 ? (
                                                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                                                <img
                                                                    src={damagedImage1}
                                                                    alt="Parcel Condition"
                                                                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #bbf7d0', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDamagedImage1(null)}
                                                                    style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                                                                    title="Remove image"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#ffffff', transition: 'background-color 0.2s' }}>

                                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>Upload / Take Photo 1</span>
                                                                <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Front / Box Damage Condition</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    onChange={(e) => handleDamagedImageUpload(e, 1)}
                                                                    style={{ display: 'none' }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                    {/* IMAGE 2: LABEL / BARCODE CONDITION */}
                                                    <div style={{ border: damagedImage2 ? '2px solid #22c55e' : '2px dashed #cbd5e1', borderRadius: '12px', padding: '18px', backgroundColor: damagedImage2 ? '#f0fdf4' : '#f8fafc', textAlign: 'center', transition: 'all 0.2s' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '800', color: damagedImage2 ? '#15803d' : '#111827' }}>
                                                                Photo 2: Shipping Label / Barcode *
                                                            </span>
                                                            {damagedImage2 ? (
                                                                <span style={{ backgroundColor: '#22c55e', color: '#ffffff', fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                                                                    Uploaded
                                                                </span>
                                                            ) : (
                                                                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                                                                    Required
                                                                </span>
                                                            )}
                                                        </div>

                                                        {damagedImage2 ? (
                                                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                                                <img
                                                                    src={damagedImage2}
                                                                    alt="Label Condition"
                                                                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #bbf7d0', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDamagedImage2(null)}
                                                                    style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                                                                    title="Remove image"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#ffffff', transition: 'background-color 0.2s' }}>

                                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>Upload / Take Photo 2</span>
                                                                <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Label / Barcode Condition</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    onChange={(e) => handleDamagedImageUpload(e, 2)}
                                                                    style={{ display: 'none' }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                </div>

                                                {/* Remarks Textarea */}
                                                <div style={{ marginBottom: '20px' }}>
                                                    <label style={{ ...label, marginBottom: '6px' }}>Damage Remarks & Notes</label>
                                                    <textarea
                                                        value={damagedReportRemarks}
                                                        onChange={(e) => setDamagedReportRemarks(e.target.value)}
                                                        rows={2}
                                                        placeholder="Provide extra details on damage condition, missing contents, or warehouse notes..."
                                                        style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
                                                    />
                                                </div>

                                                {/* Form Actions */}
                                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDamagedReportFormOpen(false)}
                                                        style={btnSecondary}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={damagedSubmitting}
                                                        style={{
                                                            ...btnPrimary,
                                                            backgroundColor: '#dc2626',
                                                            fontWeight: '700',
                                                            padding: '10px 24px',
                                                            opacity: damagedSubmitting ? 0.7 : 1
                                                        }}
                                                    >
                                                        {damagedSubmitting ? 'Saving Report & Photos...' : 'Submit Damaged Parcel Report'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}

                                        {/* SUBMITTED DAMAGED PARCELS LOG & GALLERY TABLE (WHITE THEME) */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                                    Submitted Damaged Parcels Registry ({damagedReportsList.length})
                                                </div>
                                                <button
                                                    onClick={fetchDamagedParcels}
                                                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    Refresh
                                                </button>
                                            </div>

                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                        {['Date / Time', 'Tracking Number', 'Damage Category', 'Severity', 'Attached Photos', 'LMD Partner / Zone', 'Status', 'Action'].map(h => (
                                                            <th key={h} style={{ padding: '12px 10px', color: '#374151', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {damagedReportsList.map((item, idx) => {
                                                        const d = new Date(item.createdAt);
                                                        const dateStr = !isNaN(d.getTime()) ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : item.createdAt;

                                                        return (
                                                            <tr key={item.id || idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                                                <td style={{ padding: '12px 10px', color: '#6b7280', fontSize: '12px' }}>{dateStr}</td>
                                                                <td style={{ padding: '12px 10px' }}>
                                                                    <div style={{ fontWeight: '700', color: '#dc2626' }}>{item.trackingNumber}</div>
                                                                    {item.temuBarcode && <div style={{ fontSize: '11px', color: '#6b7280' }}>Temu: {item.temuBarcode}</div>}
                                                                </td>
                                                                <td style={{ padding: '12px 10px', fontWeight: '600', color: '#111827' }}>
                                                                    {item.damageType}
                                                                    {item.remarks && <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>"{item.remarks}"</div>}
                                                                </td>
                                                                <td style={{ padding: '12px 10px' }}>
                                                                    <span style={{
                                                                        backgroundColor: '#ffffff',
                                                                        color: '#000000',
                                                                        border: '1px solid #dc2626',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '4px',
                                                                        fontWeight: '700',
                                                                        fontSize: '11px'
                                                                    }}>
                                                                        {item.severity}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '12px 10px' }}>
                                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                                        {item.imageUrl1 && (
                                                                            <img
                                                                                src={item.imageUrl1}
                                                                                alt="Photo 1"
                                                                                onClick={() => setDamagedSelectedPhotosModal(item)}
                                                                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
                                                                                title="Click to expand Photo 1"
                                                                            />
                                                                        )}
                                                                        {item.imageUrl2 && (
                                                                            <img
                                                                                src={item.imageUrl2}
                                                                                alt="Photo 2"
                                                                                onClick={() => setDamagedSelectedPhotosModal(item)}
                                                                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
                                                                                title="Click to expand Photo 2"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 10px', fontSize: '12px', color: '#374151' }}>
                                                                    {item.assignedPartner || '—'} {item.assignedZone ? `(${item.assignedZone})` : ''}
                                                                </td>
                                                                <td style={{ padding: '12px 10px' }}>
                                                                    <span style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #dc2626', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                                                        {item.status || 'REPORTED'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '12px 10px' }}>
                                                                    <button
                                                                        onClick={() => setDamagedSelectedPhotosModal(item)}
                                                                        style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                                                                    >
                                                                        View Photos
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {damagedReportsList.length === 0 && (
                                                        <tr>
                                                            <td colSpan={8} style={{ padding: '28px 8px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                                                No damaged parcel reports submitted yet. Click "+ Submit Damaged Parcel" above to record one.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                            ? '#991b1b' // dark red
                                            : '#c2410c' // dark orange
                                    : '#b45309',
                                backgroundColor: selectedBin
                                    ? selectedBin === 'PickMe'
                                        ? '#fef9c3' // light yellow
                                        : selectedBin === 'Domex'
                                            ? '#fee2e2' // light red
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
                                                                backgroundColor: rule.partnerCode === 'PickMe' ? '#16a34a' : rule.partnerCode === 'Domex' ? '#e53935' : '#f59e0b',
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
                                            {['Timestamp', 'MAWB Ref', 'Bag Number', 'Expected Count', 'Actual Scanned', 'Discrepancy', 'Status', 'Unsealed By', 'Scanned Parcels'].map(h => (
                                                <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unsealedBoxes.map((box, idx) => {
                                            const diff = box.scanned - box.expected;
                                            const parcelList = box.scannedParcels || [];
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
                                                            {diff === 0 ? 'Counted' : (box.status || 'Discrepancy')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '8px', color: '#4b5563', fontWeight: '500' }}>{box.unsealedBy || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                        {unsealedBoxes.length === 0 && (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
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



                    {/* ═══════════════════════════════════════════════════════
                    TAB 6 — OPERATIONAL DASHBOARD
                ═══════════════════════════════════════════════════════ */}
                    {/* ═══════════════════════════════════════════════════════
                    TAB 6 — OPERATIONAL DASHBOARD
                ═══════════════════════════════════════════════════════ */}
                    {activeTab === 'dashboard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* 6 Top KPI Metrics Cards Grid — shown only for Parcel Operations */}
                            {isLoadingDashboard && !dashboardData ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
                                    <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
                                    <div>Loading Real-Time Operational Metrics...</div>
                                </div>
                            ) : dashboardData ? (() => {
                                // 1. Calculate unique MAWBs list across mawb table, manifests, shipments, and bags
                                const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
                                const isValidMawbRef = (ref: any) => {
                                    if (!ref || typeof ref !== 'string') return false;
                                    const clean = ref.trim();
                                    if (clean === '' || clean === '-' || clean.toUpperCase() === 'N/A' || clean.startsWith('MNF-')) return false;
                                    if (isUuid(clean)) return false;
                                    return true;
                                };

                                const availableMawbsSet = new Set<string>();
                                (dashboardData.mawbTableList || []).forEach((m: any) => {
                                    if (isValidMawbRef(m.mawbReference)) availableMawbsSet.add(m.mawbReference.trim());
                                });
                                (dashboardData.receivedParcels || []).forEach((p: any) => {
                                    if (isValidMawbRef(p.mawbReference)) availableMawbsSet.add(p.mawbReference.trim());
                                });
                                (dashboardData.manifestsList || []).forEach((m: any) => {
                                    if (isValidMawbRef(m.mawbRef)) availableMawbsSet.add(m.mawbRef.trim());
                                });
                                (dashboardData.bagsList || []).forEach((b: any) => {
                                    if (isValidMawbRef(b.mawbRef)) availableMawbsSet.add(b.mawbRef.trim());
                                });
                                const availableMawbsList = Array.from(availableMawbsSet).sort();

                                // 2. Filter datasets based on dashMawbFilter
                                const activeMawb = dashMawbFilter;

                                const filteredParcels = (dashboardData.receivedParcels || []).filter((p: any) => {
                                    if (activeMawb !== 'ALL' && String(p.mawbReference || '').toUpperCase() !== activeMawb.toUpperCase()) return false;
                                    return true;
                                });
                                const totalRec = filteredParcels.length;
                                const totalSort = filteredParcels.filter((p: any) => p.isSorted).length;
                                const pendingParc = totalRec - totalSort;

                                const filteredBags = (dashboardData.bagsList || []).filter((b: any) => {
                                    if (activeMawb !== 'ALL' && String(b.mawbRef || '').toUpperCase() !== activeMawb.toUpperCase()) return false;
                                    return true;
                                });
                                const totalBags = filteredBags.length;
                                const openBags = filteredBags.filter((b: any) => b.status !== 'SEALED' && b.status !== 'CLOSED').length;
                                const sealedBags = filteredBags.filter((b: any) => b.status === 'SEALED' || b.status === 'CLOSED').length;

                                const filteredManifests = (dashboardData.manifestsList || []).filter((m: any) => {
                                    if (activeMawb !== 'ALL' && String(m.mawbRef || m.manifestId || '').toUpperCase() !== activeMawb.toUpperCase()) return false;
                                    return true;
                                });
                                const totalMan = filteredManifests.length;
                                const openMan = filteredManifests.filter((m: any) => String(m.status).toUpperCase() !== 'CLOSED').length;
                                const closedMan = filteredManifests.filter((m: any) => String(m.status).toUpperCase() === 'CLOSED').length;

                                const filteredExceptions = (dashboardData.exceptionsList || []).filter((e: any) => {
                                    if (activeMawb !== 'ALL') {
                                        const det = (e.details || '').toUpperCase();
                                        const ref = (e.refNumber || '').toUpperCase();
                                        if (!det.includes(activeMawb.toUpperCase()) && !ref.includes(activeMawb.toUpperCase())) return false;
                                    }
                                    return true;
                                });
                                const totalExc = filteredExceptions.length;

                                const mawbParcelCounts: Record<string, number> = {};
                                (dashboardData.receivedParcels || []).forEach((p: any) => {
                                    if (isValidMawbRef(p.mawbReference)) {
                                        const ref = p.mawbReference.trim();
                                        mawbParcelCounts[ref] = (mawbParcelCounts[ref] || 0) + 1;
                                    }
                                });

                                return (
                                    <>
                                        {/* Manifest (MAWB) View Selector Control Banner */}
                                        {dashboardSubTab !== 'productivity' && (
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: '#ffffff',
                                                padding: '12px 18px',
                                                borderRadius: '10px',
                                                border: '1px solid #cacccf',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                                flexWrap: 'wrap',
                                                gap: '12px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#111827' }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e21b22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                            <line x1="16" y1="13" x2="8" y2="13" />
                                                            <line x1="16" y1="17" x2="8" y2="17" />
                                                        </svg>
                                                        Available Manifest (MAWB View):
                                                    </div>
                                                    <select
                                                        value={dashMawbFilter}
                                                        onChange={e => setDashMawbFilter(e.target.value)}
                                                        style={{
                                                            padding: '8px 14px',
                                                            fontSize: '13px',
                                                            fontWeight: '700',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cacccf',
                                                            //backgroundColor: '#fef2f2',
                                                            color: '#111827',
                                                            outline: 'none',
                                                            cursor: 'pointer',
                                                            minWidth: '260px'
                                                        }}
                                                    >
                                                        {availableMawbsList.map(mawb => (
                                                            <option key={mawb} value={mawb}>
                                                                Manifest: {mawb} ({mawbParcelCounts[mawb] || 0} Parcels)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* KPI Cards — only for Parcel Operations view */}
                                        {dashboardSubTab !== 'productivity' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
                                                {/* Card 1: Total Received */}
                                                <div
                                                    onClick={() => setDashboardSubTab('total_received')}
                                                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: dashboardSubTab === 'total_received' ? '2px solid #e21b22' : '1px solid #e5e7eb',
                                                        borderRadius: '10px',
                                                        padding: '14px 10px',
                                                        textAlign: 'center',
                                                        boxShadow: dashboardSubTab === 'total_received' ? '0 4px 12px rgba(226, 27, 34, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out',
                                                        transform: dashboardSubTab === 'total_received' ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: dashboardSubTab === 'total_received' ? '#e21b22' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Received</div>
                                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{totalRec}</div>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Parcels Inbound</div>
                                                </div>

                                                {/* Card 2: Parcels Sorted */}
                                                <div
                                                    onClick={() => setDashboardSubTab('parcels_sorted')}
                                                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: dashboardSubTab === 'parcels_sorted' ? '2px solid #e21b22' : '1px solid #e5e7eb',
                                                        borderRadius: '10px',
                                                        padding: '14px 10px',
                                                        textAlign: 'center',
                                                        boxShadow: dashboardSubTab === 'parcels_sorted' ? '0 4px 12px rgba(226, 27, 34, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out',
                                                        transform: dashboardSubTab === 'parcels_sorted' ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: dashboardSubTab === 'parcels_sorted' ? '#e21b22' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parcels Sorted</div>
                                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{totalSort}</div>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Allocated in Bags</div>
                                                </div>

                                                {/* Card 3: Pending Parcels */}
                                                <div
                                                    onClick={() => setDashboardSubTab('pending_parcels')}
                                                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: dashboardSubTab === 'pending_parcels' ? '2px solid #e21b22' : '1px solid #e5e7eb',
                                                        borderRadius: '10px',
                                                        padding: '14px 10px',
                                                        textAlign: 'center',
                                                        boxShadow: dashboardSubTab === 'pending_parcels' ? '0 4px 12px rgba(226, 27, 34, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out',
                                                        transform: dashboardSubTab === 'pending_parcels' ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: dashboardSubTab === 'pending_parcels' ? '#e21b22' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Parcels</div>
                                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{pendingParc}</div>
                                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Awaiting Sorting</div>
                                                </div>

                                                {/* Card 4: Total Bags */}
                                                <div
                                                    onClick={() => setDashboardSubTab('total_bags')}
                                                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: dashboardSubTab === 'total_bags' ? '2px solid #e21b22' : '1px solid #e5e7eb',
                                                        borderRadius: '10px',
                                                        padding: '14px 10px',
                                                        textAlign: 'center',
                                                        boxShadow: dashboardSubTab === 'total_bags' ? '0 4px 12px rgba(226, 27, 34, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out',
                                                        transform: dashboardSubTab === 'total_bags' ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: dashboardSubTab === 'total_bags' ? '#e21b22' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Bags</div>
                                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{totalBags}</div>
                                                    <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#166534', fontWeight: '700' }}>{openBags} Open</span> •
                                                        <span style={{ color: '#dc2626', fontWeight: '700' }}>{sealedBags} Sealed</span>
                                                    </div>
                                                </div>

                                                {/* Card 5: Manifests */}
                                                <div
                                                    onClick={() => setDashboardSubTab('manifests')}
                                                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: dashboardSubTab === 'manifests' ? '2px solid #e21b22' : '1px solid #e5e7eb',
                                                        borderRadius: '10px',
                                                        padding: '14px 10px',
                                                        textAlign: 'center',
                                                        boxShadow: dashboardSubTab === 'manifests' ? '0 4px 12px rgba(226, 27, 34, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out',
                                                        transform: dashboardSubTab === 'manifests' ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: dashboardSubTab === 'manifests' ? '#e21b22' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manifests</div>
                                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>{totalMan}</div>
                                                    <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#166534', fontWeight: '700' }}>{openMan} Open</span> •
                                                        <span style={{ color: '#dc2626', fontWeight: '700' }}>{closedMan} Closed</span>
                                                    </div>
                                                </div>

                                                {/* Card 6: Exceptions */}
                                                <div
                                                    onClick={() => setDashboardSubTab('exceptions')}
                                                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: dashboardSubTab === 'exceptions' ? '2px solid #e21b22' : '1px solid #e5e7eb',
                                                        borderRadius: '10px',
                                                        padding: '14px 10px',
                                                        textAlign: 'center',
                                                        boxShadow: dashboardSubTab === 'exceptions' ? '0 4px 12px rgba(226, 27, 34, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out',
                                                        transform: dashboardSubTab === 'exceptions' ? 'translateY(-2px)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: dashboardSubTab === 'exceptions' ? '#e21b22' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exceptions</div>
                                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827', marginTop: '4px' }}>
                                                        {totalExc}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                                                        {filteredExceptions.filter((e: any) => e.type === 'Damaged Barcode').length} Damaged / {filteredExceptions.filter((e: any) => e.type !== 'Damaged Barcode').length} Discrepancy
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Parcel Operations Sub-Tabs Navigation Bar — hidden on User Productivity */}
                                        {dashboardSubTab !== 'productivity' && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', marginTop: '8px', gap: '12px' }}>
                                                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
                                                    {[
                                                        { id: 'total_received', label: 'Total Received' },
                                                        { id: 'parcels_sorted', label: 'Parcels Sorted' },
                                                        { id: 'pending_parcels', label: 'Pending Parcels' },
                                                        { id: 'total_bags', label: 'Bags & Sealed' },
                                                        { id: 'manifests', label: 'Manifests' },
                                                        { id: 'exceptions', label: 'Exceptions' },
                                                        { id: 'partner', label: 'Courier Distribution' }
                                                    ].map(tab => (
                                                        <button
                                                            key={tab.id}
                                                            onClick={() => setDashboardSubTab(tab.id as any)}
                                                            style={{
                                                                padding: '10px 12px',
                                                                fontSize: '12px',
                                                                fontWeight: '700',
                                                                border: 'none',
                                                                borderBottom: dashboardSubTab === tab.id ? '3px solid #e21b22' : '3px solid transparent',
                                                                marginBottom: '-2px',
                                                                cursor: 'pointer',
                                                                backgroundColor: 'transparent',
                                                                color: dashboardSubTab === tab.id ? '#e21b22' : '#4b5563',
                                                                whiteSpace: 'nowrap',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={fetchDashboard}
                                                    disabled={isLoadingDashboard}
                                                    title="Refresh Metrics"
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
                                                        whiteSpace: 'nowrap',
                                                        marginBottom: '4px',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isLoadingDashboard ? 'spin 1s linear infinite' : 'none' }}>
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                    </svg>
                                                    {isLoadingDashboard ? 'Refreshing...' : 'Refresh'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Universal Search & Filter Control Bar for Detail Views */}
                                        {['total_received', 'parcels_sorted', 'pending_parcels', 'total_bags', 'exceptions'].includes(dashboardSubTab) && (
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                                                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Search by tracking number, barcode, bag #, MAWB, or location..."
                                                        value={dashSearchQuery}
                                                        onChange={e => setDashSearchQuery(e.target.value)}
                                                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }}
                                                    />
                                                </div>

                                                {/* Manifest Filter Dropdown */}
                                                <select
                                                    value={dashMawbFilter}
                                                    onChange={e => setDashMawbFilter(e.target.value)}
                                                    style={{
                                                        flexShrink: 0,
                                                        boxSizing: 'border-box',
                                                        padding: '8px 12px',
                                                        fontSize: '13px',
                                                        fontWeight: '700',
                                                        borderRadius: '6px',
                                                        border: '1px solid #cacccf',
                                                        //backgroundColor: '#fef2f2',
                                                        color: '#111827',
                                                        minWidth: '180px'
                                                    }}
                                                >
                                                    <option value="ALL">All Manifests (MAWBs)</option>
                                                    {availableMawbsList.map(mawb => (
                                                        <option key={mawb} value={mawb}>Manifest: {mawb}</option>
                                                    ))}
                                                </select>

                                                {['total_received', 'parcels_sorted', 'pending_parcels', 'total_bags'].includes(dashboardSubTab) && (
                                                    <select
                                                        value={dashPartnerFilter}
                                                        onChange={e => setDashPartnerFilter(e.target.value)}
                                                        style={{ flexShrink: 0, boxSizing: 'border-box', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', minWidth: '140px' }}
                                                    >
                                                        <option value="ALL">All Partners</option>
                                                        <option value="PickMe">PickMe</option>
                                                        <option value="Domex">Domex</option>
                                                        <option value="Pronto">Pronto</option>
                                                        <option value="Other">Other / General</option>
                                                    </select>
                                                )}
                                                {dashSearchQuery || dashPartnerFilter !== 'ALL' || dashMawbFilter !== 'ALL' ? (
                                                    <button
                                                        onClick={() => { setDashSearchQuery(''); setDashPartnerFilter('ALL'); setDashMawbFilter('ALL'); }}
                                                        style={{ flexShrink: 0, fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}
                                                    >
                                                        Clear All Filters
                                                    </button>
                                                ) : null}
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 1: TOTAL RECEIVED (INBOUND PARCELS)
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'total_received' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={label}>Total Received Inbound Parcels</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Showing <strong>{filteredParcels.filter((p: any) => {
                                                            const q = dashSearchQuery.toLowerCase();
                                                            const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.mawbReference && p.mawbReference.toLowerCase().includes(q)) || (p.consigneeLocation && p.consigneeLocation.toLowerCase().includes(q));
                                                            const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                            return matchQ && matchP;
                                                        }).length}</strong> of {totalRec} parcels
                                                    </div>
                                                </div>

                                                {filteredParcels.length > 0 ? (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['#', 'Parcel Reference', 'Temu Barcode', 'Courier Partner', 'Destination City', 'Weight', 'Allocation Status', 'Received Date'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredParcels.filter((p: any) => {
                                                                    const q = dashSearchQuery.toLowerCase();
                                                                    const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.mawbReference && p.mawbReference.toLowerCase().includes(q)) || (p.consigneeLocation && p.consigneeLocation.toLowerCase().includes(q));
                                                                    const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                                    return matchQ && matchP;
                                                                }).slice(0, 100).map((p: any, idx: number) => (
                                                                    <tr key={`rec-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>{p.senderReference}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: p.deliveryAgentCode === 'PickMe' ? '#fef3c7' : p.deliveryAgentCode === 'Domex' ? '#dbeafe' : p.deliveryAgentCode === 'Pronto' ? '#e0e7ff' : '#f3f4f6', color: p.deliveryAgentCode === 'PickMe' ? '#b45309' : p.deliveryAgentCode === 'Domex' ? '#1d4ed8' : p.deliveryAgentCode === 'Pronto' ? '#4338ca' : '#374151' }}>
                                                                                {p.deliveryAgentCode}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{p.consigneeLocation || 'N/A'}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.weight}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            {p.allocationStage === '2ND_SCAN_DONE' || p.bagNumber ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                                                                    2nd Scan Done {/* {p.bagNumber ? `(${p.bagNumber})` : ''} */}
                                                                                </span>
                                                                            ) : p.allocationStage === '1ST_SCAN_DONE' || p.isSorted ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                                                                    1st Scan Done
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#b45309' }}>
                                                                                    Pending 1st Scan
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No received parcels found matching your criteria.</div>
                                                )}
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 2: PARCELS SORTED (ALLOCATED IN BAGS)
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'parcels_sorted' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={label}>Parcels Sorted & Allocated in Outbound Bags</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Total Allocated: <strong>{totalSort} parcels</strong>
                                                    </div>
                                                </div>

                                                {filteredParcels.filter((p: any) => p.isSorted).length > 0 ? (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['#', 'Parcel Reference', 'Assigned Bag #', 'Courier Partner', 'Destination City', 'Weight', 'Status'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredParcels.filter((p: any) => p.isSorted).filter((p: any) => {
                                                                    const q = dashSearchQuery.toLowerCase();
                                                                    const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || (p.bagNumber && p.bagNumber.toLowerCase().includes(q)) || (p.consigneeLocation && p.consigneeLocation.toLowerCase().includes(q));
                                                                    const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                                    return matchQ && matchP;
                                                                }).slice(0, 100).map((p: any, idx: number) => (
                                                                    <tr key={`sorted-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', fontFamily: 'monospace' }}>
                                                                                {p.bagNumber || 'Allocated'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>{p.deliveryAgentCode}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{p.consigneeLocation || 'N/A'}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.weight}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            {p.allocationStage === '2ND_SCAN_DONE' || p.bagNumber ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                                                                    2nd Scan Done
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                                                                    1st Scan Done
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No sorted parcels found matching criteria.</div>
                                                )}
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 3: PENDING PARCELS (AWAITING SORTING)
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'pending_parcels' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={label}>Pending Parcels Awaiting Sorting</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Total Pending: <strong>{pendingParc} parcels</strong>
                                                    </div>
                                                </div>

                                                {filteredParcels.filter((p: any) => !p.isSorted).length > 0 ? (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['#', 'Parcel Reference', 'Temu Barcode', 'Target Partner', 'Destination City', 'Allocation Status', 'Received Date'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredParcels.filter((p: any) => !p.isSorted).filter((p: any) => {
                                                                    const q = dashSearchQuery.toLowerCase();
                                                                    const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.consigneeLocation && p.consigneeLocation.toLowerCase().includes(q));
                                                                    const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                                    return matchQ && matchP;
                                                                }).slice(0, 100).map((p: any, idx: number) => (
                                                                    <tr key={`pend-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>{p.senderReference}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>{p.deliveryAgentCode}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{p.consigneeLocation || 'N/A'}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#b45309' }}>
                                                                                Pending 1st Scan
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No pending parcels awaiting sorting.</div>
                                                )}
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 4: TOTAL BAGS & SEALED BAGS
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'total_bags' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={label}>Outbound LMD Bags Overview</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Total Bags: <strong>{totalBags}</strong> ({openBags} Open / {sealedBags} Sealed)
                                                    </div>
                                                </div>

                                                {filteredBags.length > 0 ? (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['#', 'Bag Number', 'Target Partner', 'Status', 'Parcels Inside', 'Created By', 'Sealed By', 'Created Date'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredBags.filter((b: any) => {
                                                                    const q = dashSearchQuery.toLowerCase();
                                                                    const matchQ = !q || b.bagNumber.toLowerCase().includes(q) || (b.createdBy && b.createdBy.toLowerCase().includes(q));
                                                                    const matchP = dashPartnerFilter === 'ALL' || b.targetPartner === dashPartnerFilter;
                                                                    return matchQ && matchP;
                                                                }).map((b: any, idx: number) => (
                                                                    <tr key={`bag-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>{b.bagNumber}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>{b.targetPartner}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', color: b.status === 'SEALED' ? '#dc2626' : '#15803d' }}>
                                                                                {b.status === 'SEALED' ? 'SEALED' : 'OPEN'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{b.parcelCount} parcels</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{b.createdBy}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{b.sealedBy}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No bags created yet today.</div>
                                                )}
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 5: MANIFESTS & MAWB SESSIONS
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'manifests' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                {/* Manifest Header & Select Bar */}
                                                <div style={card}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div>
                                                            <div style={label}>Manifest & MAWB Session Inspector</div>
                                                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Comprehensive breakdown of Manifest Sessions, LMD Bags, Box Unsealings, and Allocated Parcels by MAWB Ref.</p>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                            Total Manifests: <strong>{dashboardData.totalManifests}</strong> ({dashboardData.openManifests} Open / {dashboardData.closedManifests} Closed)
                                                        </div>
                                                    </div>

                                                    {/* MAWB Selector & Search Input */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '16px' }}>
                                                        <div style={{ flex: '1 1 360px', maxWidth: '480px', minWidth: 0, position: 'relative' }}>
                                                            <input
                                                                type="text"
                                                                placeholder="Type MAWB Ref (e.g. 603-70659761)..."
                                                                value={dashSearchQuery}
                                                                onChange={(e) => setDashSearchQuery(e.target.value)}
                                                                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', fontSize: '13px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                                                            />
                                                            {dashSearchQuery && (
                                                                <button
                                                                    onClick={() => setDashSearchQuery('')}
                                                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontWeight: 'bold' }}
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                        {(mawbsList && mawbsList.length > 0) && (
                                                            <select
                                                                value={dashSearchQuery}
                                                                onChange={(e) => setDashSearchQuery(e.target.value)}
                                                                style={{ padding: '9px 14px', fontSize: '13px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', width: '220px', flexShrink: 0, boxSizing: 'border-box' }}
                                                            >
                                                                <option value="">Select MAWB Ref...</option>
                                                                {mawbsList.map((m: any) => (
                                                                    <option key={m.mawb_reference} value={m.mawb_reference}>{m.mawb_reference}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 1. MATCHED MANIFEST SESSIONS */}
                                                <div style={card}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={label}>Matched Manifest Sessions ({
                                                            (dashboardData.manifestsList || []).filter((m: any) => {
                                                                const q = dashSearchQuery.trim().toLowerCase();
                                                                return !q || (m.mawbRef && m.mawbRef.toLowerCase().includes(q)) || (m.manifestId && m.manifestId.toLowerCase().includes(q));
                                                            }).length
                                                        })</div>
                                                    </div>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['MAWB / Manifest Ref', 'Status', 'Closed By', 'Total Bags', 'Total Parcels', 'Date'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(dashboardData.manifestsList || []).filter((m: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (m.mawbRef && m.mawbRef.toLowerCase().includes(q)) || (m.manifestId && m.manifestId.toLowerCase().includes(q));
                                                                }).map((m: any, idx: number) => (
                                                                    <tr key={`m-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>{m.mawbRef || m.manifestId}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: m.status === 'CLOSED' ? '#e0e7ff' : '#dcfce7', color: m.status === 'CLOSED' ? '#4338ca' : '#15803d' }}>
                                                                                {m.status === 'CLOSED' ? '✔ CLOSED' : '⚡ OPEN'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{m.closedBy || '—'}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700' }}>{m.totalBags} bags</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#166534' }}>{m.totalParcels} parcels</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                                {(dashboardData.manifestsList || []).filter((m: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (m.mawbRef && m.mawbRef.toLowerCase().includes(q)) || (m.manifestId && m.manifestId.toLowerCase().includes(q));
                                                                }).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                                                                No manifest sessions matched query "{dashSearchQuery}"
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* 2. MATCHED LMD BAGS */}
                                                <div style={card}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={label}>Matched LMD Bags ({
                                                            (dashboardData.bagsList || []).filter((b: any) => {
                                                                const q = dashSearchQuery.trim().toLowerCase();
                                                                return !q || (b.mawbRef && b.mawbRef.toLowerCase().includes(q)) || (b.bagNumber && b.bagNumber.toLowerCase().includes(q));
                                                            }).length
                                                        })</div>
                                                    </div>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['Bag Number', 'MAWB Ref', 'Target Partner', 'Destination Hub', 'Parcels', 'Total Weight', 'Status', 'Created / Sealed By & Timestamp'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(dashboardData.bagsList || []).filter((b: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (b.mawbRef && b.mawbRef.toLowerCase().includes(q)) || (b.bagNumber && b.bagNumber.toLowerCase().includes(q));
                                                                }).map((b: any, idx: number) => (
                                                                    <tr key={`b-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>{b.bagNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151', fontSize: '12px' }}>{b.mawbRef || '—'}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: b.targetPartner === 'PickMe' ? '#fef3c7' : b.targetPartner === 'Domex' ? '#dbeafe' : b.targetPartner === 'Pronto' ? '#e0e7ff' : '#f3f4f6', color: b.targetPartner === 'PickMe' ? '#b45309' : b.targetPartner === 'Domex' ? '#1d4ed8' : b.targetPartner === 'Pronto' ? '#4338ca' : '#374151' }}>
                                                                                {b.targetPartner}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{b.destinationHub || b.targetPartner}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700' }}>{b.parcelCount} items</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563' }}>{b.totalWeight ? `${b.totalWeight} kg` : '-'}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: b.status === 'SEALED' ? '#fee2e2' : '#dcfce7', color: b.status === 'SEALED' ? '#dc2626' : '#15803d' }}>
                                                                                {b.status === 'SEALED' ? 'SEALED' : 'OPEN'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontSize: '11px' }}>
                                                                            <div style={{ fontWeight: '600', color: '#111827' }}>{b.sealedBy && b.sealedBy !== '-' ? b.sealedBy : b.createdBy}</div>
                                                                            <div style={{ color: '#6b7280', fontSize: '10px' }}>{b.sealedAt && b.sealedAt !== '-' ? new Date(b.sealedAt).toLocaleString() : b.createdAt ? new Date(b.createdAt).toLocaleString() : '-'}</div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {(dashboardData.bagsList || []).filter((b: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (b.mawbRef && b.mawbRef.toLowerCase().includes(q)) || (b.bagNumber && b.bagNumber.toLowerCase().includes(q));
                                                                }).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                                                                No LMD bags matched query "{dashSearchQuery}"
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* 3. MATCHED BOX UNSEALINGS */}
                                                <div style={card}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={label}>Matched Box Unsealings ({
                                                            (dashboardData.unsealedBoxesList || []).filter((u: any) => {
                                                                const q = dashSearchQuery.trim().toLowerCase();
                                                                return !q || (u.mawbRef && u.mawbRef.toLowerCase().includes(q)) || (u.bagNumber && u.bagNumber.toLowerCase().includes(q));
                                                            }).length
                                                        })</div>
                                                    </div>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['Box Bag No', 'MAWB Ref', 'Scanned / Expected Count', 'Unsealed By', 'Timestamp'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(dashboardData.unsealedBoxesList || []).filter((u: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (u.mawbRef && u.mawbRef.toLowerCase().includes(q)) || (u.bagNumber && u.bagNumber.toLowerCase().includes(q));
                                                                }).map((u: any, idx: number) => (
                                                                    <tr key={`ub-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>{u.bagNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{u.mawbRef || '—'}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: u.scannedCount === u.expectedCount ? '#166534' : '#dc2626' }}>
                                                                            {u.scannedCount} / {u.expectedCount}
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563' }}>{u.unsealedBy}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                                {(dashboardData.unsealedBoxesList || []).filter((u: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (u.mawbRef && u.mawbRef.toLowerCase().includes(q)) || (u.bagNumber && u.bagNumber.toLowerCase().includes(q));
                                                                }).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                                                                No box unsealings matched query "{dashSearchQuery}"
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* 4. MATCHED PARCELS */}
                                                <div style={card}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={label}>Matched Parcels ({
                                                            (dashboardData.receivedParcels || []).filter((p: any) => {
                                                                const q = dashSearchQuery.trim().toLowerCase();
                                                                return !q || (p.mawbReference && p.mawbReference.toLowerCase().includes(q)) || (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) || (p.bagNumber && p.bagNumber.toLowerCase().includes(q));
                                                            }).length
                                                        })</div>
                                                    </div>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['Waybill / Ref', 'Temu Barcode', 'MAWB Ref', 'Assigned Bag #', 'Courier Partner', 'Destination City', 'Status'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(dashboardData.receivedParcels || []).filter((p: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (p.mawbReference && p.mawbReference.toLowerCase().includes(q)) || (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) || (p.bagNumber && p.bagNumber.toLowerCase().includes(q));
                                                                }).slice(0, 100).map((p: any, idx: number) => (
                                                                    <tr key={`mp-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>{p.senderReference}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151', fontSize: '12px' }}>{p.mawbReference}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            {p.bagNumber ? (
                                                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', fontFamily: 'monospace' }}>
                                                                                    {p.bagNumber}
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ color: '#9ca3af', fontSize: '12px' }}>Unassigned</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>{p.deliveryAgentCode}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{p.consigneeLocation || 'N/A'}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: p.isSorted ? '#dcfce7' : '#fef3c7', color: p.isSorted ? '#15803d' : '#b45309' }}>
                                                                                {p.isSorted ? 'LMD ALLOCATED' : 'RECEIVED'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {(dashboardData.receivedParcels || []).filter((p: any) => {
                                                                    const q = dashSearchQuery.trim().toLowerCase();
                                                                    return !q || (p.mawbReference && p.mawbReference.toLowerCase().includes(q)) || (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) || (p.bagNumber && p.bagNumber.toLowerCase().includes(q));
                                                                }).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                                                                No parcels matched query "{dashSearchQuery}"
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 6: EXCEPTIONS & DISCREPANCIES
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'exceptions' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={label}>Operational Exceptions & Discrepancies Log</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Total Exceptions: <strong>{totalExc}</strong>
                                                    </div>
                                                </div>

                                                {filteredExceptions.length > 0 ? (
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                    {['#', 'Exception Type', 'Ref / Barcode / Bag #', 'Details', 'Scanned / Expected', 'Reported By', 'Timestamp'].map(h => (
                                                                        <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredExceptions.filter((ex: any) => {
                                                                    const q = dashSearchQuery.toLowerCase();
                                                                    return !q || ex.type.toLowerCase().includes(q) || ex.refNumber.toLowerCase().includes(q) || ex.details.toLowerCase().includes(q);
                                                                }).map((ex: any, idx: number) => (
                                                                    <tr key={`ex-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: ex.type.includes('Damaged') ? '#fee2e2' : '#fef3c7', color: ex.type.includes('Damaged') ? '#dc2626' : '#b45309' }}>
                                                                                {ex.type}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{ex.refNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#374151' }}>{ex.details}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{ex.scannedVsExpected}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563' }}>{ex.reportedBy}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>{ex.createdAt ? new Date(ex.createdAt).toLocaleString() : '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No exception logs found.</div>
                                                )}
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 7: USER PRODUCTIVITY PERFORMANCE
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'productivity' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div>
                                                        <div style={label}>User Productivity Performance Overview</div>
                                                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Real-time parcel sorting, bag sealing, and operational activity across all system operators.</p>
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Total System Operators: <strong>{(usersList || []).length || (dashboardData.userProductivity || []).length}</strong>
                                                    </div>
                                                </div>

                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                {['#', 'Operator / User Name', 'Email Address', 'Role', 'Inbound Parcels Scanned', 'Outbound Bags Sealed', 'Manifest Sessions Closed', 'System Duty Status'].map(h => (
                                                                    <th key={h} style={{ padding: '10px 12px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(usersList && usersList.length > 0
                                                                ? usersList
                                                                : (dashboardData.userProductivity || []).map((p: any) => ({ first_name: p.operator, last_name: '', email: `${p.operator.toLowerCase().replace(/\s+/g, '.')}@skynet.lk`, role: 'Operator', is_active: true }))
                                                            ).map((user: any, idx: number) => {
                                                                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.email || 'Operator';
                                                                const prod = (dashboardData.userProductivity || []).find((p: any) =>
                                                                    p.operator?.toLowerCase().includes(fullName.toLowerCase()) ||
                                                                    p.operator?.toLowerCase().includes((user.first_name || '').toLowerCase())
                                                                );

                                                                const scanned = prod ? prod.scanned : 0;
                                                                const bagsSealed = prod ? prod.bagsSealed : 0;
                                                                const manifestsClosed = prod ? prod.manifestsClosed : 0;

                                                                return (
                                                                    <tr key={`u-prod-${user.id || idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: '11px' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#111827' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', color: '#374151' }}>
                                                                                    {(user.first_name || user.name || user.email || 'O')[0].toUpperCase()}
                                                                                </div>
                                                                                <span>{fullName}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '10px 12px', color: '#4b5563', fontSize: '12px', fontFamily: 'monospace' }}>{user.email || '—'}</td>
                                                                        <td style={{ padding: '10px 12px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                                                                                {user.role || 'Operator'}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#166534' }}>{scanned} parcels</td>
                                                                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#111827' }}>{bagsSealed} bags</td>
                                                                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#374151' }}>{manifestsClosed} manifests</td>
                                                                        <td style={{ padding: '10px 12px' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                                                                ● Active On-Duty
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 8: COURIER PARTNER DISTRIBUTION
                                    ═══════════════════════════════════════════════════════ */}
                                        {dashboardSubTab === 'partner' && (
                                            <div style={card}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={label}>Courier Partner Allocation Distribution</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Inbound: <strong>{dashboardData.totalReceived} parcels</strong></div>
                                                </div>

                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                            <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Partner Name</th>
                                                            <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>No. of Parcels</th>
                                                            <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Allocated Parcels</th>
                                                            <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Pending / Search Parcels</th>
                                                            <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>No. of Bags</th>
                                                            <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', width: '180px' }}>Allocation %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(dashboardData.partnerDetails || [
                                                            { partnerName: 'PickMe', totalParcels: dashboardData.partnerDistribution?.PickMe || 0, allocatedParcels: dashboardData.partnerDistribution?.PickMe || 0, pendingParcels: 0, totalBags: dashboardData.bagPartnerCounts?.PickMe || 0 },
                                                            { partnerName: 'Domex', totalParcels: dashboardData.partnerDistribution?.Domex || 0, allocatedParcels: dashboardData.partnerDistribution?.Domex || 0, pendingParcels: 0, totalBags: dashboardData.bagPartnerCounts?.Domex || 0 },
                                                            { partnerName: 'Pronto', totalParcels: dashboardData.partnerDistribution?.Pronto || 0, allocatedParcels: dashboardData.partnerDistribution?.Pronto || 0, pendingParcels: 0, totalBags: dashboardData.bagPartnerCounts?.Pronto || 0 },
                                                            { partnerName: 'Other', totalParcels: dashboardData.partnerDistribution?.Other || 0, allocatedParcels: dashboardData.partnerDistribution?.Other || 0, pendingParcels: 0, totalBags: dashboardData.bagPartnerCounts?.General || 0 }
                                                        ]).map((partner: any) => {
                                                            const pct = dashboardData.totalReceived > 0 ? Math.round((partner.totalParcels / dashboardData.totalReceived) * 100) : 0;
                                                            return (
                                                                <tr key={partner.partnerName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                    <td style={{ padding: '12px 10px', fontWeight: '700', color: '#111827', fontSize: '13px' }}>
                                                                        {partner.partnerName}
                                                                    </td>
                                                                    <td style={{ padding: '12px 10px', fontWeight: '700', color: '#111827' }}>
                                                                        {partner.totalParcels} parcels
                                                                    </td>
                                                                    <td style={{ padding: '12px 10px', fontWeight: '700', color: '#166534' }}>
                                                                        {partner.allocatedParcels} allocated
                                                                    </td>
                                                                    <td style={{ padding: '12px 10px', fontWeight: '700', color: '#b45309' }}>
                                                                        {partner.pendingParcels} pending
                                                                    </td>
                                                                    <td style={{ padding: '12px 10px', fontWeight: '700', color: '#111827' }}>
                                                                        {partner.totalBags} bags
                                                                    </td>
                                                                    <td style={{ padding: '12px 10px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <div style={{ flex: 1, height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                                                                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#111827', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                                            </div>
                                                                            <span style={{ fontWeight: '700', color: '#374151', fontSize: '12px', minWidth: '35px' }}>{pct}%</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                );
                            })() : (
                                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                                    <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px 0' }}>Metrics have not loaded yet.</p>
                                    <button onClick={fetchDashboard} style={{ ...btnPrimary, backgroundColor: '#111827', color: '#ffffff' }}>
                                        Load Operational Real-Time Dashboard
                                    </button>
                                </div>
                            )}
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

            {/* ── DUPLICATE / MISMATCH WARNING MODAL ── */}
            {duplicateModal && (() => {
                const isPartnerMismatch = duplicateModal.message?.toLowerCase().includes('partner mismatch');
                const isManifestMismatch = duplicateModal.message?.toLowerCase().includes('manifest mismatch');
                const isAlreadyUnsealed = duplicateModal.message?.toLowerCase().includes('already unsealed');
                const isAlreadyAssigned = duplicateModal.message?.toLowerCase().includes('already assigned') || duplicateModal.message?.toLowerCase().includes('already sealed');

                const titleText = isPartnerMismatch
                    ? 'Courier Partner Mismatch'
                    : isManifestMismatch
                        ? 'Manifest Mismatch'
                        : isAlreadyUnsealed
                            ? 'Parcel Already Unsealed'
                            : isAlreadyAssigned
                                ? 'Parcel Already Assigned'
                                : 'Duplicate Scan Detected';

                const warningText = isPartnerMismatch
                    ? 'Courier Partner Mismatch'
                    : isManifestMismatch
                        ? 'Manifest Mismatch'
                        : isAlreadyUnsealed
                            ? 'Already Unsealed Warning'
                            : isAlreadyAssigned
                                ? 'Already Assigned Warning'
                                : 'Duplicate Scan Warning';

                return (
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
                                {titleText}
                            </h3>

                            {/* Content Message */}
                            {duplicateModal.message ? (
                                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: '0 0 20px 0', textAlign: 'left', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '14px 16px' }}>
                                    <div style={{ fontWeight: '800', color: '#dc2626', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{warningText}</span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#111827', fontWeight: '600', lineHeight: '1.4' }}>
                                        {duplicateModal.message}
                                    </div>
                                    {duplicateModal.isTemuScanDuplicate && duplicateModal.senderReference && (
                                        <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #fca5a5' }}>
                                            • <strong>Scanned via Temu Barcode:</strong> {duplicateModal.senderReference}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                                    Barcode <strong style={{ color: '#111827', fontSize: '15px', backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                        {duplicateModal.barcode}
                                    </strong> has already been {duplicateModal.type === 'allocate' ? 'scanned and allocated' : 'verified'} today!
                                </p>
                            )}

                            {/* Dismiss Action Button */}
                            <button
                                autoFocus
                                onClick={() => {
                                    setDuplicateModal(null);
                                    setTimeout(() => {
                                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                                        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                                        else if (activeTab === 'verify') verifyInputRef.current?.focus();
                                    }, 50);
                                }}
                                style={{
                                    backgroundColor: '#e21b22',
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
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e21b22'; }}
                            >
                                Acknowledge (Press Enter)
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* ── INVALID / COMBINED BARCODE ERROR MODAL ── */}
            {invalidBarcodeModal && (() => {
                const isCombined = invalidBarcodeModal.isCombined;
                const isNotFound = invalidBarcodeModal.message?.toLowerCase().includes('not found') || invalidBarcodeModal.message?.toLowerCase().includes('database');

                const titleText = isCombined
                    ? 'Multiple Barcodes Combined'
                    : isNotFound
                        ? 'Parcel Not Found'
                        : 'Barcode Scan Error';

                const warningText = isCombined
                    ? '⚠ Barcode Entry Mixed'
                    : isNotFound
                        ? '⚠ Shipment Not in Database'
                        : '⚠ Scan Verification Error';

                return (
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
                                {titleText}
                            </h3>

                            {/* Content Message */}
                            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: '0 0 20px 0', textAlign: 'left', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '14px 16px' }}>
                                <div style={{ fontWeight: '800', color: '#dc2626', marginBottom: '6px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{warningText}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: '#111827', fontWeight: '600', lineHeight: '1.4' }}>
                                    {isCombined
                                        ? `Multiple barcodes were detected in a single scan ("${invalidBarcodeModal.barcode}"). The previous barcode entry was not cleared before scanning the next item.`
                                        : invalidBarcodeModal.message}
                                </div>
                                {isCombined && (
                                    <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #fca5a5', fontWeight: '600' }}>
                                        ℹ️ Please scan the single parcel barcode again cleanly.
                                    </div>
                                )}
                            </div>

                            {/* Dismiss Action Button */}
                            <button
                                autoFocus
                                onClick={() => {
                                    setInvalidBarcodeModal(null);
                                    setBarcodeInput('');
                                    setLastScanned('');
                                    if (scanInputRef.current) scanInputRef.current.value = '';
                                    setTimeout(() => {
                                        if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                                        else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                                        else if (activeTab === 'verify') verifyInputRef.current?.focus();
                                    }, 50);
                                }}
                                style={{
                                    backgroundColor: '#e21b22',
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
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e21b22'; }}
                            >
                                Acknowledge & Rescan (Press Enter)
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* ── MANIFEST CLOSED SUMMARY MODAL ── */}
            {manifestClosedModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 3500,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #111827',
                        borderRadius: '14px',
                        padding: '28px 24px',
                        width: '480px',
                        maxWidth: '92%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        textAlign: 'center'
                    }}>
                        {/* Lock / Summary Icon */}
                        <div style={{
                            backgroundColor: '#111827',
                            color: '#ffffff',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '16px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}>
                            <span style={{ fontSize: '26px' }}>🔒</span>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#111827', margin: '0 0 4px 0' }}>
                            Manifest Session Closed
                        </h3>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#e21b22', marginBottom: '18px' }}>
                            MAWB: {manifestClosedModal.mawbRef}
                        </div>

                        {/* Operator & Closure Details Card */}
                        <div style={{
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            marginBottom: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                                <span style={{ color: '#6b7280', fontWeight: '600' }}>Closed By Operator:</span>
                                <strong style={{ color: '#111827' }}>{manifestClosedModal.closedBy}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                                <span style={{ color: '#6b7280', fontWeight: '600' }}>Closed Timestamp:</span>
                                <strong style={{ color: '#374151' }}>{manifestClosedModal.closedAt}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280', fontWeight: '600' }}>Total Manifest Volume:</span>
                                <strong style={{ color: '#111827' }}>
                                    {manifestClosedModal.totalBags} Bags | {manifestClosedModal.totalParcels} Parcels ({manifestClosedModal.totalWeight} kg)
                                </strong>
                            </div>
                        </div>

                        {/* Courier Partner Bag Breakdown Header */}
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', textAlign: 'left' }}>
                            Outbound LMD Bags Summary Breakdown:
                        </div>

                        {/* Partner Grid Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                            {/* PickMe Card */}
                            <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', padding: '10px 12px', textAlign: 'left' }}>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#854d0e', textTransform: 'uppercase' }}>PickMe</div>
                                <div style={{ fontSize: '14px', fontWeight: '900', color: '#713f12', marginTop: '2px' }}>
                                    {manifestClosedModal.pickmeBags} <span style={{ fontSize: '11px', fontWeight: '700' }}>Bags</span>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#a16207' }}>
                                    {manifestClosedModal.pickmeParcels} Parcels
                                </div>
                            </div>

                            {/* Domex Card */}
                            <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '10px 12px', textAlign: 'left' }}>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#881337', textTransform: 'uppercase' }}>Domex</div>
                                <div style={{ fontSize: '14px', fontWeight: '900', color: '#881337', marginTop: '2px' }}>
                                    {manifestClosedModal.domexBags} <span style={{ fontSize: '11px', fontWeight: '700' }}>Bags</span>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#9f1239' }}>
                                    {manifestClosedModal.domexParcels} Parcels
                                </div>
                            </div>

                            {/* Pronto Card */}
                            <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px', textAlign: 'left' }}>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#9a3412', textTransform: 'uppercase' }}>Pronto</div>
                                <div style={{ fontSize: '14px', fontWeight: '900', color: '#9a3412', marginTop: '2px' }}>
                                    {manifestClosedModal.prontoBags} <span style={{ fontSize: '11px', fontWeight: '700' }}>Bags</span>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#c2410c' }}>
                                    {manifestClosedModal.prontoParcels} Parcels
                                </div>
                            </div>

                            {/* General / ALL Card */}
                            <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', textAlign: 'left' }}>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#374151', textTransform: 'uppercase' }}>General (ALL)</div>
                                <div style={{ fontSize: '14px', fontWeight: '900', color: '#111827', marginTop: '2px' }}>
                                    {manifestClosedModal.generalBags} <span style={{ fontSize: '11px', fontWeight: '700' }}>Bags</span>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563' }}>
                                    {manifestClosedModal.generalParcels} Parcels
                                </div>
                            </div>
                        </div>
                        {/* Dismiss Action Button */}
                        <button
                            onClick={() => setManifestClosedModal(null)}
                            style={{
                                backgroundColor: '#e21b22',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 24px',
                                fontSize: '14px',
                                fontWeight: '700',
                                width: '100%',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e21b22'; }}
                        >
                            Acknowledge &amp; Finish Session (Press Enter)
                        </button>
                    </div>
                </div>
            )}

            {/* ── CONFIRM FINISH MODAL ── */}
            {confirmFinishModal && (() => {
                const isExact = firstScanHistory.length === Number(firstScanExpected);
                const diff = firstScanHistory.length - Number(firstScanExpected);
                const isShortage = diff < 0;
                const isOverage = diff > 0;
                const accentColor = isExact ? '#16a34a' : isShortage ? '#e21b22' : '#b45309';
                const surfaceColor = isExact ? '#f0fdf4' : isShortage ? '#fef2f2' : '#fffbeb';
                const borderColor = isExact ? '#bbf7d0' : isShortage ? '#fca5a5' : '#fcd34d';
                const iconBg = isExact ? '#d1fae5' : isShortage ? '#fee2e2' : '#fef3c7';
                const shortageOptions = ['Missing Parcels', 'Stolen or Lost in Transit', 'Damaged & Discarded', 'Other (Custom Note)'];
                const overageOptions = ['Extra Parcels Scanned', 'Wrongly Routed to Bag', 'Other (Custom Note)'];
                const options = isShortage ? shortageOptions : overageOptions;
                const canConfirm = isExact || (discrepancyReason !== '' && (discrepancyReason !== 'Other (Custom Note)' || customDiscrepancyNote.trim() !== ''));
                return (
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
                            border: `2px solid ${accentColor}`,
                            borderRadius: '12px',
                            padding: '28px 24px',
                            width: '500px',
                            maxWidth: '92%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            textAlign: 'center'
                        }}>
                            {/* Icon */}
                            <div style={{
                                backgroundColor: iconBg,
                                color: accentColor,
                                width: '56px', height: '56px',
                                borderRadius: '50%',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '16px'
                            }}>
                                {isExact ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                )}
                            </div>

                            {/* Title */}
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: accentColor, margin: '0 0 8px 0' }}>
                                {isExact ? 'Finish Box Session?' : isShortage ? 'Shortage Detected' : 'Overage Detected'}
                            </h3>

                            {/* Count Summary */}
                            <div style={{
                                display: 'inline-flex', gap: '20px', alignItems: 'center',
                                backgroundColor: surfaceColor, border: `1px solid ${borderColor}`,
                                borderRadius: '8px', padding: '10px 20px', margin: '0 0 16px 0', fontSize: '14px'
                            }}>
                                <span>Expected: <strong style={{ color: '#111827' }}>{firstScanExpected}</strong></span>
                                <span style={{ color: '#9ca3af' }}>|</span>
                                <span>Scanned: <strong style={{ color: accentColor }}>{firstScanHistory.length}</strong></span>
                                {!isExact && (
                                    <>
                                        <span style={{ color: '#9ca3af' }}>|</span>
                                        <span style={{ fontWeight: '700', color: accentColor }}>
                                            {isShortage ? `${diff} Missing` : `+${diff} Extra`}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Message */}
                            <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                                {isExact
                                    ? `All ${firstScanHistory.length} parcels verified. Bag "${firstScanSelectedBag}" will be marked as COUNTED.`
                                    : isShortage
                                        ? `Bag "${firstScanSelectedBag}" has ${Math.abs(diff)} fewer parcel${Math.abs(diff) !== 1 ? 's' : ''} than expected. Please select a shortage reason before closing.`
                                        : `Bag "${firstScanSelectedBag}" has ${diff} extra parcel${diff !== 1 ? 's' : ''} beyond the expected count. Please select an overage reason before closing.`
                                }
                            </p>

                            {/* Discrepancy Reason Form (only when mismatch) */}
                            {!isExact && (
                                <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                        {isShortage ? 'Shortage Reason' : 'Overage Reason'} <span style={{ color: '#e21b22' }}>*</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {options.map((opt) => (
                                            <label key={opt} style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '9px 12px',
                                                backgroundColor: discrepancyReason === opt ? (isShortage ? '#eff6ff' : '#fffbeb') : '#f9fafb',
                                                border: `1px solid ${discrepancyReason === opt ? accentColor : '#e5e7eb'}`,
                                                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                                                color: discrepancyReason === opt ? accentColor : '#374151',
                                                transition: 'all 0.15s ease'
                                            }}>
                                                <input
                                                    type="radio"
                                                    name="discrepancyReason"
                                                    value={opt}
                                                    checked={discrepancyReason === opt}
                                                    onChange={() => {
                                                        setDiscrepancyReason(opt);
                                                        if (opt !== 'Other (Custom Note)') setCustomDiscrepancyNote('');
                                                    }}
                                                    style={{ accentColor: accentColor }}
                                                />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                    {discrepancyReason === 'Other (Custom Note)' && (
                                        <textarea
                                            value={customDiscrepancyNote}
                                            onChange={(e) => setCustomDiscrepancyNote(e.target.value)}
                                            placeholder="Describe the reason for the discrepancy..."
                                            rows={3}
                                            style={{
                                                width: '100%', marginTop: '10px', padding: '10px 12px',
                                                border: `1px solid ${accentColor}`, borderRadius: '8px',
                                                fontSize: '13px', color: '#111827', resize: 'vertical',
                                                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                            }}
                                        />
                                    )}
                                    {!discrepancyReason && (
                                        <p style={{ fontSize: '12px', color: '#e21b22', marginTop: '8px', fontWeight: '500' }}>
                                            ⚠ You must select a reason to close this bag.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={handleConfirmFinish}
                                    disabled={!canConfirm}
                                    style={{
                                        flex: 1,
                                        backgroundColor: canConfirm ? accentColor : '#9ca3af',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '12px 18px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: canConfirm ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={(e) => { if (canConfirm) e.currentTarget.style.opacity = '0.85'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
                                >
                                    {isExact ? 'Yes, Confirm (Enter/Space)' : 'Submit & Close Bag (Enter)'}
                                </button>
                                <button
                                    onClick={() => {
                                        setConfirmFinishModal(false);
                                        setDiscrepancyReason('');
                                        setCustomDiscrepancyNote('');
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
                );
            })()}

            {/* ── OVERAGE CHECK MODAL (fires when count hits expected) ── */}
            {overageCheckModal && (
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
                        border: '2px solid #16a34a',
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '480px',
                        maxWidth: '92%',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
                        textAlign: 'center'
                    }}>
                        {/* Icon */}
                        <div style={{
                            backgroundColor: '#d1fae5', color: '#16a34a',
                            width: '56px', height: '56px', borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '16px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>

                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
                            All {overageCheckModal.expected} Parcels Scanned!
                        </h3>

                        {/* Count pill */}
                        <div style={{
                            display: 'inline-flex', gap: '16px', alignItems: 'center',
                            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                            borderRadius: '8px', padding: '8px 18px', margin: '0 0 16px 0', fontSize: '14px'
                        }}>
                            <span>Expected: <strong style={{ color: '#111827' }}>{overageCheckModal.expected}</strong></span>
                            <span style={{ color: '#9ca3af' }}>|</span>
                            <span>Scanned: <strong style={{ color: '#16a34a' }}>{overageCheckModal.history.length}</strong></span>
                        </div>

                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                            Bag <strong style={{ color: '#111827' }}>&quot;{overageCheckModal.bagNumber}&quot;</strong> has reached its expected count.
                            Are there any <strong style={{ color: '#111827' }}>additional (extra) parcels</strong> still in this bag?
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* No extra parcels → auto-close bag as COUNTED */}
                            <button
                                onClick={async () => {
                                    const { bagNumber, expected, history } = overageCheckModal;
                                    setOverageCheckModal(null);
                                    await autoFinishBag(bagNumber, expected, history);
                                }}
                                style={{
                                    backgroundColor: '#16a34a', color: '#ffffff',
                                    border: 'none', borderRadius: '8px',
                                    padding: '12px 18px', fontSize: '14px', fontWeight: '600',
                                    cursor: 'pointer', width: '100%', transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#15803d'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#16a34a'; }}
                            >
                                No Extra Parcels — Close Bag (Enter)
                            </button>

                            {/* Yes, extra parcels → keep scanning, overage will be shown on Finish */}
                            <button
                                onClick={() => {
                                    setOverageCheckModal(null);
                                    setTimeout(() => firstScanInputRef.current?.focus(), 50);
                                }}
                                style={{
                                    color: '#111827',
                                    border: '2px solid #fcd34d', borderRadius: '8px',
                                    padding: '12px 18px', fontSize: '14px', fontWeight: '600',
                                    cursor: 'pointer', width: '100%', transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef3c7'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fffbeb'; }}
                            >
                                Yes, There Are More Parcels — Continue Scanning (Space)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── INVALID PARCEL / SCAN ERROR MODAL ── */}
            {invalidBagParcelModal && (
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
                        border: '2px solid #dc2626',
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '450px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                        textAlign: 'center'
                    }}>
                        {/* Red Warning Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 12px 0' }}>
                            {invalidBagParcelModal.reason === 'BAG_ALREADY_COMPLETED' ? 'Bag Already Completed' : 'Scan Error'}
                        </h3>

                        {/* Content Message */}
                        <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px 0', fontWeight: '500' }}>
                            {invalidBagParcelModal.reason === 'WRONG_BAG'
                                ? `This parcel belongs to Bag "${invalidBagParcelModal.actualBag || 'Unknown'}", not "${invalidBagParcelModal.expectedBag}".`
                                : invalidBagParcelModal.reason === 'NOT_FOUND'
                                    ? `Parcel "${invalidBagParcelModal.barcode}" was not found in the database.`
                                    : invalidBagParcelModal.reason === 'BAG_ALREADY_COMPLETED'
                                        ? `Bag "${invalidBagParcelModal.expectedBag}" has already been completed and unsealed!`
                                        : `Bag barcode "${invalidBagParcelModal.barcode}" not found in this MAWB.`}
                        </p>

                        {/* Format notice popup alert */}
                        {(invalidBagParcelModal.reason === 'INVALID_BAG' || invalidBagParcelModal.reason === 'NO_BAG_SELECTED') && (
                            <div style={{
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fca5a5',
                                borderRadius: '8px',
                                padding: '12px 14px',
                                fontSize: '13px',
                                color: '#991b1b',
                                marginBottom: '20px',
                                textAlign: 'left',
                                lineHeight: '1.5'
                            }}>
                                <strong style={{ display: 'block', marginBottom: '4px' }}>💡 Barcode Format Notice:</strong>
                                <span>
                                    {invalidBagParcelModal.barcode.match(/^\d+$/) ? `"${invalidBagParcelModal.barcode}" appears to be a parcel tracking number, not a Bag Barcode. ` : ''}
                                    Bag Barcodes follow the format <strong>SKYTxxxxxxxxxxxx</strong> (e.g., <code>SKYT260704960688</code>). Please scan or select a valid Bag Barcode first.
                                </span>
                            </div>
                        )}

                        {/* Action Button */}
                        <button
                            onClick={() => {
                                setInvalidBagParcelModal(null);
                                setFirstScanInput('');
                                setBagBarcodeInput('');
                                setBarcodeInput('');
                                setVerifyBarcodeInput('');
                                if (firstScanInputRef.current) firstScanInputRef.current.value = '';
                                if (bagBarcodeInputRef.current) bagBarcodeInputRef.current.value = '';
                                if (scanInputRef.current) scanInputRef.current.value = '';
                                if (verifyInputRef.current) verifyInputRef.current.value = '';
                                setTimeout(() => {
                                    if (activeTab === 'first-scan') {
                                        if (!firstScanSelectedBag && bagBarcodeInputRef.current) {
                                            bagBarcodeInputRef.current.focus();
                                        } else {
                                            firstScanInputRef.current?.focus();
                                        }
                                    }
                                }, 50);
                            }}
                            style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 24px',
                                fontSize: '14px',
                                fontWeight: '600',
                                width: '100%',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Dismiss (Press Enter / Space)
                        </button>
                    </div>
                </div>
            )}

            {/* ── INTERACTIVE EXTRA PARCEL RESOLUTION MODAL ── */}
            {extraParcelModal && (() => {
                const isWrongBag = extraParcelModal.reason === 'WRONG_BAG';
                const isUnassigned = extraParcelModal.reason === 'UNASSIGNED';
                const isNotFound = extraParcelModal.reason === 'NOT_FOUND';

                const themeColor = isWrongBag ? '#e21b22' : isUnassigned ? '#374151' : '#e21b22';
                const bgLight = isWrongBag ? '#fef2f2' : isUnassigned ? '#f3f4f6' : '#fef2f2';

                let modalTitle = 'Scan Exception';
                let message = '';
                let actionText = 'Proceed';

                if (isWrongBag) {
                    const isMawbDiff = extraParcelModal.actualMawb && extraParcelModal.actualMawb.toLowerCase() !== firstScanMawb.toLowerCase();
                    modalTitle = isMawbDiff ? 'MAWB / Bag Mismatch Detected' : 'Wrong Bag Detected';
                    message = isMawbDiff
                        ? `Parcel "${extraParcelModal.barcode}" belongs to MAWB "${extraParcelModal.actualMawb}" (Bag "${extraParcelModal.actualBag || 'Unknown'}"), not selected MAWB "${firstScanMawb}".`
                        : `Parcel "${extraParcelModal.barcode}" belongs to Bag "${extraParcelModal.actualBag || 'Unknown'}", not "${extraParcelModal.expectedBag}".`;
                    actionText = `Move to Bag "${extraParcelModal.expectedBag}"`;
                } else if (isUnassigned) {
                    modalTitle = 'ℹ Unassigned Parcel';
                    message = `Parcel "${extraParcelModal.barcode}" is in the database but not assigned to any bag.`;
                    actionText = `Assign to Bag "${extraParcelModal.expectedBag}"`;
                } else if (isNotFound) {
                    modalTitle = '🚨 Parcel Not in Manifest';
                    message = `Parcel "${extraParcelModal.barcode}" was not found in the manifest/database.`;
                    actionText = `Register & Add to Bag "${extraParcelModal.expectedBag}"`;
                }

                const canSubmit = !isNotFound || extraParcelNote.trim() !== '';

                return (
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
                            border: `2px solid ${themeColor}`,
                            borderRadius: '12px',
                            padding: '30px 24px',
                            width: '480px',
                            maxWidth: '92%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                            textAlign: 'center'
                        }}>
                            {/* Icon */}
                            <div style={{
                                backgroundColor: bgLight,
                                color: themeColor,
                                width: '56px', height: '56px',
                                borderRadius: '50%',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '16px'
                            }}>
                                {isNotFound ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                )}
                            </div>

                            {/* Title */}
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>
                                {modalTitle}
                            </h3>

                            {/* Main Message */}
                            <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0 0 16px 0', fontWeight: '500' }}>
                                {message}
                            </p>

                            {/* Subtitle instructions */}
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px 0', lineHeight: '1.4' }}>
                                {isWrongBag
                                    ? `Do you want to keep the parcel in Bag "${extraParcelModal.actualBag}" or move/override it to your active Bag "${extraParcelModal.expectedBag}"?`
                                    : isUnassigned
                                        ? `Do you want to assign this untracked parcel to the currently unsealing Bag "${extraParcelModal.expectedBag}"?`
                                        : `This untracked parcel will be added. Admin will be notified of this discrepancy. Please provide a brief note/reason below.`}
                            </p>

                            {/* Note field */}
                            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                                    Discrepancy Note {isNotFound && <span style={{ color: '#dc2626' }}>*</span>}
                                </label>
                                <textarea
                                    value={extraParcelNote}
                                    onChange={(e) => setExtraParcelNote(e.target.value)}
                                    placeholder={isNotFound ? "Enter a reason (e.g. Received extra without manifest item)..." : "Optional comments..."}
                                    rows={2}
                                    style={{
                                        width: '100%', padding: '10px 12px',
                                        border: '1px solid #d1d5db', borderRadius: '8px',
                                        fontSize: '13px', color: '#111827', resize: 'vertical',
                                        outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                    }}
                                />
                                {isNotFound && !canSubmit && (
                                    <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '6px', fontWeight: '500' }}>
                                        ⚠ Note/Reason is required to register a parcel not in manifest.
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => {
                                        handleFirstScanSubmitOverride(extraParcelModal.barcode, {
                                            overrideBag: isWrongBag || isUnassigned,
                                            registerExtra: isNotFound,
                                            note: extraParcelNote
                                        });
                                    }}
                                    disabled={!canSubmit}
                                    style={{
                                        flex: 1,
                                        backgroundColor: canSubmit ? themeColor : '#9ca3af',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: canSubmit ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {actionText}
                                </button>
                                <button
                                    onClick={() => {
                                        setExtraParcelModal(null);
                                        setExtraParcelNote('');
                                        setTimeout(() => {
                                            if (firstScanInputRef.current) {
                                                firstScanInputRef.current.value = '';
                                                setFirstScanInput('');
                                                firstScanInputRef.current.focus();
                                            }
                                        }, 50);
                                    }}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                        color: '#374151',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Cancel (Esc)
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── SWITCH OPERATOR MODAL ── */}
            {switchUserModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 3500,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '400px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>
                            Switch Operator
                        </h3>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px 0' }}>
                            Verify identity for <strong>{switchUserModal.first_name} {switchUserModal.last_name}</strong> to switch profile.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                                    First Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter First Name (e.g. Shashini)"
                                    value={switchUserFirstName}
                                    onChange={(e) => setSwitchUserFirstName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSwitchUserSubmit();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                                    4-Digit Quick-Switch PIN
                                </label>
                                <input
                                    type="password"
                                    maxLength={4}
                                    placeholder="••••"
                                    value={switchUserPassword}
                                    onChange={(e) => setSwitchUserPassword(e.target.value.replace(/\D/g, ''))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSwitchUserSubmit();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        textAlign: 'center',
                                        fontWeight: '700',
                                        letterSpacing: '6px'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSwitchUserSubmit}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Confirm Switch
                            </button>
                            <button
                                onClick={() => {
                                    setSwitchUserModal(null);
                                    setSwitchUserFirstName('');
                                    setSwitchUserPassword('');
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Cancel
                            </button>
                        </div>

                        <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center' }}>
                            <button
                                onClick={() => {
                                    const email = switchUserModal.email;
                                    setSwitchUserModal(null);
                                    setSwitchUserFirstName('');
                                    setSwitchUserPassword('');
                                    setRenewForm({
                                        email: email,
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmNewPassword: ''
                                    });
                                    setRenewPinModal(true);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#e21b22',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: '4px 8px'
                                }}
                            >
                                🔑 Renew Password / PIN
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── RENEW PASSWORD/PIN MODAL ── */}
            {renewPinModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 3500,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #bf222d',
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '420px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#bf222d', margin: '0 0 10px 0', textAlign: 'center' }}>
                            Renew Password or PIN
                        </h3>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px 0', textAlign: 'center' }}>
                            Update your access credentials. PINs or passwords can be renewed instantly here.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Email Address</label>
                                <input
                                    type="email"
                                    disabled
                                    value={renewForm.email}
                                    style={{
                                        width: '100%', padding: '8px 12px',
                                        border: '1px solid #d1d5db', borderRadius: '6px',
                                        fontSize: '13px', backgroundColor: '#f3f4f6', color: '#6b7280',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Current Password / PIN</label>
                                <input
                                    type="password"
                                    placeholder="Enter current password or PIN"
                                    value={renewForm.currentPassword}
                                    onChange={(e) => setRenewForm({ ...renewForm, currentPassword: e.target.value })}
                                    style={{
                                        width: '100%', padding: '8px 12px',
                                        border: '1px solid #d1d5db', borderRadius: '6px',
                                        fontSize: '13px', color: '#111827', boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>New Password / PIN</label>
                                <input
                                    type="password"
                                    placeholder="Enter new password or PIN"
                                    value={renewForm.newPassword}
                                    onChange={(e) => setRenewForm({ ...renewForm, newPassword: e.target.value })}
                                    style={{
                                        width: '100%', padding: '8px 12px',
                                        border: '1px solid #d1d5db', borderRadius: '6px',
                                        fontSize: '13px', color: '#111827', boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Confirm New Password / PIN</label>
                                <input
                                    type="password"
                                    placeholder="Retype new password or PIN"
                                    value={renewForm.confirmNewPassword}
                                    onChange={(e) => setRenewForm({ ...renewForm, confirmNewPassword: e.target.value })}
                                    style={{
                                        width: '100%', padding: '8px 12px',
                                        border: '1px solid #d1d5db', borderRadius: '6px',
                                        fontSize: '13px', color: '#111827', boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleRenewPinSubmit}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#bf222d',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Renew Credentials
                            </button>
                            <button
                                onClick={() => {
                                    setRenewPinModal(false);
                                    setRenewForm({ email: '', currentPassword: '', newPassword: '', confirmNewPassword: '' });
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CUSTOM CONFIRM MODAL ── */}
            {customConfirmModal && (
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
                        width: '460px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
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
                            {customConfirmModal.title}
                        </h3>

                        {/* Content Message */}
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                            {customConfirmModal.message}
                        </p>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    const action = customConfirmModal.onConfirm;
                                    setCustomConfirmModal(null);
                                    action();
                                }}
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
                            >
                                Yes, Confirm (Enter/Space)
                            </button>
                            <button
                                onClick={() => {
                                    setCustomConfirmModal(null);
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
                            >
                                Cancel (Esc)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── UNALLOCATED PARCELS IN BAG WARNING MODAL ── */}
            {unallocatedBagUnsealModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4000
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '2px solid #dc2626',
                        padding: '24px',
                        maxWidth: '560px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fee2e2', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⚠️ Cannot Unseal Bag Normally</span>
                            </h3>
                            <button
                                onClick={() => setUnallocatedBagUnsealModal(null)}
                                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '14px', fontSize: '13px', color: '#991b1b', lineHeight: '1.5' }}>
                            <strong>Bag "{unallocatedBagUnsealModal.bagNumber}" cannot be unsealed with normal status!</strong><br />
                            There {unallocatedBagUnsealModal.unallocatedCount === 1 ? 'is' : 'are'} <strong>{unallocatedBagUnsealModal.unallocatedCount} parcel(s)</strong> inside this bag that {unallocatedBagUnsealModal.unallocatedCount === 1 ? 'has' : 'have'} no LMD Delivery Partner assigned.
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                                Unallocated Parcels in Bag ({unallocatedBagUnsealModal.unallocatedCount}):
                            </label>
                            <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {unallocatedBagUnsealModal.unallocatedParcels.map((p: any, idx: number) => (
                                    <div key={idx} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #f3f4f6', padding: '6px 10px', borderRadius: '6px' }}>
                                        <span style={{ fontWeight: '700', color: '#111827' }}>{p.trackingNumber}</span>
                                        <span style={{ color: '#6b7280', fontSize: '11px' }}>{p.recipientName || 'Unknown'} ({p.city || 'Unknown'})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                                Unsealing Note (Required to Force Unseal) <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <textarea
                                value={unallocatedBagNote}
                                onChange={(e) => setUnallocatedBagNote(e.target.value)}
                                placeholder="Enter reason or note for unsealing bag with unallocated parcels..."
                                rows={3}
                                style={{
                                    width: '100%', padding: '10px 12px',
                                    border: '1px solid #d1d5db', borderRadius: '8px',
                                    fontSize: '13px', color: '#111827', resize: 'vertical',
                                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                            <button
                                onClick={handleForceUnsealWithNote}
                                disabled={!unallocatedBagNote.trim()}
                                style={{
                                    flex: 1,
                                    backgroundColor: unallocatedBagNote.trim() ? '#dc2626' : '#9ca3af',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '11px 16px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: unallocatedBagNote.trim() ? 'pointer' : 'not-allowed',
                                    boxShadow: unallocatedBagNote.trim() ? '0 2px 4px rgba(220, 38, 38, 0.25)' : 'none'
                                }}
                            >
                                ⚠️ Proceed & Unseal with Note
                            </button>
                            <button
                                onClick={() => setUnallocatedBagUnsealModal(null)}
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '11px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel & Resolve Parcels
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── UNALLOCATED PARTNER MODAL ── */}
            {unallocatedPartnerModal && (
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
                        border: '2px solid #dc2626', // Red warning theme border
                        borderRadius: '12px',
                        padding: '30px 24px',
                        width: '450px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                        textAlign: 'center'
                    }}>
                        {/* Red/Amber Alert Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>
                            Parcel Not Allocated to a Partner
                        </h3>

                        {/* Content Message */}
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                            Parcel <strong>{unallocatedPartnerModal.trackingNumber}</strong> is not allocated to an LMD partner.
                        </p>

                        {/* Action button */}
                        <button
                            onClick={() => {
                                setUnallocatedPartnerModal(null);
                                setTimeout(() => {
                                    if (activeTab === 'first-scan') firstScanInputRef.current?.focus();
                                    else if (activeTab === 'second-scan') scanInputRef.current?.focus();
                                }, 50);
                            }}
                            style={{
                                backgroundColor: '#dc2626',
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
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
                        >
                            Acknowledge (Press Enter)
                        </button>
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

            {/* ── PRINT REPLACEMENT LABEL MODAL ── */}
            {printLabelModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '420px',
                        maxWidth: '92%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>🖨 Print Replacement Label</span>
                            </h3>
                            <button
                                onClick={() => setPrintLabelModal(null)}
                                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Printable Thermal Shipping Label Card Area */}
                        <div
                            id="thermal-label-print-area"
                            style={{
                                border: '2px solid #111827',
                                borderRadius: '8px',
                                padding: '16px',
                                backgroundColor: '#ffffff',
                                color: '#000000',
                                fontFamily: "'Inter', sans-serif"
                            }}
                        >
                            {/* Brand Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '10px' }}>
                                <div>
                                    <img src="/logo.png" alt="Skynet Worldwide Express" style={{ height: '38px', maxWidth: '170px', objectFit: 'contain', display: 'block' }} />
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ backgroundColor: '#111827', color: '#ffffff', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase' }}>
                                        REPLACEMENT STICKER
                                    </span>
                                    {printLabelModal.assignedPartner && (
                                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#111827', marginTop: '2px' }}>
                                            {printLabelModal.assignedPartner}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SVG Barcode */}
                            <div
                                style={{ margin: '8px 0', textAlign: 'center' }}
                                dangerouslySetInnerHTML={{ __html: generateCode128SVG(printLabelModal.trackingNumber) }}
                            />

                            {/* Tracking Number */}
                            <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: '900', letterSpacing: '2px', color: '#000000', marginBottom: '8px' }}>
                                {printLabelModal.trackingNumber}
                            </div>

                            {/* Temu Sender Reference if present */}
                            {printLabelModal.senderReference && (
                                <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '700', textAlign: 'center', marginBottom: '10px' }}>
                                    TEMU REF: {printLabelModal.senderReference}
                                </div>
                            )}

                            {/* Label Information Grid */}
                            <div style={{ borderTop: '1px dashed #000000', paddingTop: '8px', fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>CONSIGNEE</span>
                                    <strong style={{ fontSize: '12px' }}>{printLabelModal.recipientName || 'Consignee'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>DESTINATION</span>
                                    <strong style={{ fontSize: '12px' }}>{printLabelModal.city || '—'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>MAWB REF</span>
                                    <strong>{printLabelModal.mawbRef || '—'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>BAG NUMBER</span>
                                    <strong>{printLabelModal.bagNumber || '—'}</strong>
                                </div>
                            </div>

                            {/* Zone Footer Badge */}
                            {printLabelModal.assignedZone && (
                                <div style={{ marginTop: '10px', borderTop: '1px solid #000000', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', fontWeight: '700' }}>DESTINATION ZONE:</span>
                                    <span style={{ fontSize: '14px', fontWeight: '900', backgroundColor: '#111827', color: '#ffffff', padding: '2px 8px', borderRadius: '4px' }}>
                                        {printLabelModal.assignedZone}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Modal Actions */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    const printArea = document.getElementById('thermal-label-print-area');
                                    if (!printArea) return;
                                    const win = window.open('', '', 'width=600,height=600');
                                    if (win) {
                                        win.document.write(`
                                            <html>
                                                <head>
                                                    <title>Print Skynet Label - ${printLabelModal.trackingNumber}</title>
                                                    <style>
                                                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                                                        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
                                                        @media print { body { padding: 0; } }
                                                    </style>
                                                </head>
                                                <body>
                                                    ${printArea.outerHTML}
                                                </body>
                                            </html>
                                        `);
                                        win.document.close();
                                        win.focus();
                                        setTimeout(() => {
                                            win.print();
                                            win.close();
                                        }, 250);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                🖨 Print Sticker
                            </button>
                            <button
                                onClick={() => setPrintLabelModal(null)}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Close (Esc)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CREATE OUTBOUND LMD BAG MODAL ── */}
            {createBagModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4000
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #111827',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '420px',
                        maxWidth: '92%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Create Outbound LMD Bag</span>
                            </h3>
                            <button onClick={() => setCreateBagModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}>✕</button>
                        </div>

                        <div style={{ fontSize: '13px', color: '#111827', marginBottom: '-4px' }}>
                            Manifest: <strong style={{ color: '#e21b22' }}>{selectedSecondScanMawb}</strong>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#374151', display: 'block', marginBottom: '4px' }}>
                                    Destination Hub Name:
                                </label>
                                <select
                                    value={newBagPartner}
                                    onChange={(e: any) => {
                                        const p = e.target.value;
                                        setNewBagPartner(p);
                                        const partnerCode = p && p !== 'ALL' ? `-${p.toUpperCase()}` : '';
                                        setCustomBagNumber(`${selectedSecondScanMawb}${partnerCode}-BAG-${String((outboundBags?.length || 0) + 1).padStart(2, '0')}`);
                                    }}
                                    style={{ ...inputStyle, width: '100%', fontWeight: '700', padding: '10px' }}
                                >
                                    <option value="PickMe">PickMe Courier</option>
                                    <option value="Domex">Domex Express</option>
                                    <option value="Pronto">Pronto Lanka</option>
                                    <option value="ALL">All Partners (General Sorting Bag)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#374151', display: 'block', marginBottom: '4px' }}>
                                    Assigning Bag Number:
                                </label>
                                <input
                                    type="text"
                                    value={customBagNumber !== '' ? customBagNumber : `${selectedSecondScanMawb}${newBagPartner && newBagPartner !== 'ALL' ? `-${newBagPartner.toUpperCase()}` : ''}-BAG-${String((outboundBags?.length || 0) + 1).padStart(2, '0')}`}
                                    onChange={(e) => setCustomBagNumber(e.target.value)}
                                    style={{ ...inputStyle, width: '100%', fontWeight: '700', fontFamily: "'Inter', sans-serif", padding: '10px', backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}
                                    placeholder="Enter or edit Bag Number"
                                />
                                <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                                    Auto-generated format. You can edit or customize the bag number if needed.
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button
                                onClick={handleCreateOutboundBag}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '800',
                                    cursor: 'pointer'
                                }}
                            >
                                Create Outbound LMD Bag
                            </button>
                            <button
                                onClick={() => setCreateBagModalOpen(false)}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PRINT OUTBOUND LMD BAG LABEL MODAL ── */}
            {printOutboundBagLabelModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4000
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #111827',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '450px',
                        maxWidth: '92%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>🖨 Printable LMD Bag Thermal Label</span>
                            </h3>
                            <button onClick={() => setPrintOutboundBagLabelModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}>✕</button>
                        </div>

                        {/* Thermal Bag Label Container */}
                        <div id="lmd-bag-label-print-area" style={{ border: '2px solid #111827', borderRadius: '8px', padding: '16px', backgroundColor: '#ffffff', color: '#000000', fontFamily: "'Inter', sans-serif" }}>
                            {/* Brand Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '10px' }}>
                                <div>
                                    <img src="/logo.png" alt="Skynet Express" style={{ height: '36px', maxWidth: '160px', objectFit: 'contain', display: 'block' }} />
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ backgroundColor: '#111827', color: '#ffffff', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase' }}>
                                        OUTBOUND LMD BAG
                                    </span>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#e21b22', marginTop: '2px', textTransform: 'uppercase' }}>
                                        {resolvePartnerName(printOutboundBagLabelModal)}
                                    </div>
                                </div>
                            </div>

                            {/* SVG Code 128 Barcode */}
                            <div style={{ margin: '10px 0', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: generateCode128SVG(printOutboundBagLabelModal.bagNumber) }} />

                            {/* Bag Number Text */}
                            <div style={{ textAlign: 'center', fontSize: '17px', fontWeight: '900', letterSpacing: '1.5px', color: '#000000', marginBottom: '10px' }}>
                                {printOutboundBagLabelModal.bagNumber}
                            </div>

                            {/* Grid Details */}
                            <div style={{ borderTop: '1px dashed #000000', paddingTop: '8px', fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>MANIFEST NO</span>
                                    <strong>{printOutboundBagLabelModal.mawbRef}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>TOTAL PARCELS</span>
                                    <strong style={{ fontSize: '13px', color: '#047857' }}>{printOutboundBagLabelModal.parcelCount} Parcels</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>TOTAL WEIGHT</span>
                                    <strong style={{ fontSize: '12px' }}>{printOutboundBagLabelModal.totalWeight || '0.00'} kg</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>DESTINATION HUB</span>
                                    <strong style={{ fontSize: '11px', color: '#e21b22', fontWeight: '800' }}>
                                        {(() => {
                                            const resolvedPartner = resolvePartnerName(printOutboundBagLabelModal);
                                            const hub = printOutboundBagLabelModal.destinationHub;
                                            if (hub && hub !== 'Main Sort Hub' && !hub.toLowerCase().includes('main sort')) {
                                                return hub;
                                            }
                                            return resolvedPartner !== 'ALL PARTNERS' ? `${resolvedPartner} Hub` : 'Main Sort Hub';
                                        })()}
                                    </strong>
                                </div>
                            </div>

                            {/* Footer Status */}
                            <div style={{ borderTop: '1px solid #000000', paddingTop: '6px', fontSize: '9px', display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                                <span>SEALED: {new Date(printOutboundBagLabelModal.sealedAt || Date.now()).toLocaleTimeString()}</span>
                                <span>OPERATOR: {
                                    (currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username : '') ||
                                    printOutboundBagLabelModal.operator ||
                                    'Staff'
                                }</span>
                            </div>
                        </div>

                        {/* Print Action Button */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    const printArea = document.getElementById('lmd-bag-label-print-area');
                                    if (!printArea) return;
                                    const win = window.open('', '', 'width=650,height=650');
                                    if (win) {
                                        win.document.write(`
                                            <html>
                                                <head>
                                                    <title>Print LMD Bag Thermal Label - ${printOutboundBagLabelModal.bagNumber}</title>
                                                    <style>
                                                        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
                                                        @media print { body { padding: 0; } }
                                                    </style>
                                                </head>
                                                <body>
                                                    ${printArea.outerHTML}
                                                </body>
                                            </html>
                                        `);
                                        win.document.close();
                                        win.focus();
                                        setTimeout(() => {
                                            win.print();
                                            win.close();
                                        }, 250);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '800',
                                    cursor: 'pointer'
                                }}
                            >
                                🖨 Print Bag Thermal Label
                            </button>
                            <button
                                onClick={() => setPrintOutboundBagLabelModal(null)}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: VIEW SCANNED PARCELS IN UNSEALED BAG ── */}
            {viewingUnsealedParcelsModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4000
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '750px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#111827' }}>
                                    Scanned Parcels in Bag: {viewingUnsealedParcelsModal.bagNumber}
                                </h3>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    MAWB Ref: {viewingUnsealedParcelsModal.mawb} • Total Stored: {viewingUnsealedParcelsModal.parcels.length} Parcels
                                </span>
                            </div>
                            <button
                                onClick={() => setViewingUnsealedParcelsModal(null)}
                                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>#</th>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>Tracking Number / Barcode</th>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>Sender Ref / Temu</th>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>Consignee</th>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>City</th>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>Partner</th>
                                        <th style={{ padding: '8px 10px', color: '#6b7280', fontWeight: '700' }}>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewingUnsealedParcelsModal.parcels.map((p: any, idx: number) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px 10px', color: '#9ca3af' }}>{idx + 1}</td>
                                            <td style={{ padding: '8px 10px', fontWeight: '700', color: '#111827' }}>
                                                {p.skynetTrackingNumber || p.trackingNumber || p.tracking_number || '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#4b5563', fontFamily: 'monospace' }}>
                                                {p.senderReference || p.sender_reference || (p.isTemuScan ? p.trackingNumber : '—')}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#374151' }}>
                                                {p.recipientName || p.recipient_name || '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#374151' }}>
                                                {p.city || '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                {p.assignedPartner ? (
                                                    <span style={{
                                                        backgroundColor: p.assignedPartner === 'PickMe' ? '#ffcc00' : p.assignedPartner === 'Domex' ? '#7b0f1a' : '#ea580c',
                                                        color: p.assignedPartner === 'PickMe' ? '#000000' : '#ffffff',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: '700',
                                                        fontSize: '10px'
                                                    }}>
                                                        {p.assignedPartner}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: '#6b7280' }}>
                                                {p.timestamp || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {viewingUnsealedParcelsModal.parcels.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                                                No parcel details recorded for this bag unsealing session.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                            <button
                                onClick={() => setViewingUnsealedParcelsModal(null)}
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    borderRadius: '6px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: MISSED FIRST SCAN WARNING & RECONCILIATION ── */}
            {missedFirstScanModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 4000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '24px 20px',
                        maxWidth: '420px',
                        width: '92%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#e21b22',
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 6px auto'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#111827' }}>
                            {missedFirstScanModal.message?.includes('service provider') ? 'Service Provider Not Assigned' : 'Missed First Scan'}
                        </h3>

                        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#991b1b', lineHeight: '1.45', textAlign: 'left' }}>
                            {missedFirstScanModal.message || 'This parcel was not scanned during Box Unsealing (1st scan), but it was reconciled during LMD Verification.'}
                        </div>

                        <div style={{ fontSize: '13px', color: '#374151', fontWeight: '600' }}>
                            Are there any other parcels to scan for this bag?
                        </div>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                            <button
                                onClick={() => {
                                    setMissedFirstScanModal(null);
                                    setTimeout(() => {
                                        if (scanInputRef.current) scanInputRef.current.focus();
                                    }, 50);
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#ffffff',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Yes, more parcels
                            </button>
                            <button
                                onClick={() => {
                                    setMissedFirstScanModal(null);
                                    setConfirmFinishModal(true);
                                    setDiscrepancyReason('');
                                    setCustomDiscrepancyNote('');
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                }}
                            >
                                No, close this bag
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DAMAGED PARCEL PHOTOS FULL VIEW MODAL */}
            {damagedSelectedPhotosModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        maxWidth: '900px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '14px', marginBottom: '18px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: '800' }}>
                                        Damaged Parcel Photos Inspection
                                    </h3>
                                </div>
                                <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px' }}>
                                    Tracking No: <strong style={{ color: '#dc2626' }}>{damagedSelectedPhotosModal.trackingNumber}</strong>
                                    {damagedSelectedPhotosModal.temuBarcode && <span> | Temu: <strong>{damagedSelectedPhotosModal.temuBarcode}</strong></span>}
                                </div>
                            </div>
                            <button
                                onClick={() => setDamagedSelectedPhotosModal(null)}
                                style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Category & Severity Badges */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                            <span style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #dc2626', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                                Category: {damagedSelectedPhotosModal.damageType}
                            </span>
                            <span style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #dc2626', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                                Severity: {damagedSelectedPhotosModal.severity}
                            </span>
                            {damagedSelectedPhotosModal.status && (
                                <span style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #dc2626', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                                    Status: {damagedSelectedPhotosModal.status}
                                </span>
                            )}
                        </div>

                        {damagedSelectedPhotosModal.remarks && (
                            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#334155' }}>
                                <strong>Remarks:</strong> "{damagedSelectedPhotosModal.remarks}"
                            </div>
                        )}

                        {/* Dual Photos Side-by-Side View */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', backgroundColor: '#f9fafb', textAlign: 'center' }}>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#374151', marginBottom: '8px' }}>
                                    Photo 1: Parcel Outer Box Condition
                                </div>
                                {damagedSelectedPhotosModal.imageUrl1 ? (
                                    <img
                                        src={damagedSelectedPhotosModal.imageUrl1}
                                        alt="Photo 1"
                                        style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#000000' }}
                                    />
                                ) : (
                                    <div style={{ padding: '40px', color: '#9ca3af' }}>No Photo 1 provided</div>
                                )}
                            </div>

                            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', backgroundColor: '#f9fafb', textAlign: 'center' }}>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#374151', marginBottom: '8px' }}>
                                    Photo 2: Shipping Label / Barcode Condition
                                </div>
                                {damagedSelectedPhotosModal.imageUrl2 ? (
                                    <img
                                        src={damagedSelectedPhotosModal.imageUrl2}
                                        alt="Photo 2"
                                        style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#000000' }}
                                    />
                                ) : (
                                    <div style={{ padding: '40px', color: '#9ca3af' }}>No Photo 2 provided</div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setDamagedSelectedPhotosModal(null)}
                                style={btnPrimary}
                            >
                                Close Inspection View
                            </button>
                        </div>
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