'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AllocationResponse, SkyNetParcelData } from '@/types';
import { toast } from 'sonner';
import TrackingTab from '@/app/components/TrackingTab';
import PaginationControl from '@/app/components/PaginationControl';

import FirstScanTab from '@/components/first-scan/FirstScanTab';
import SecondScanTab from '@/components/second-scan/SecondScanTab';
import DamagedBarcodeTab from '@/components/damaged-barcode/DamagedBarcodeTab';
import DispatchVerifyTab from '@/components/verify/DispatchVerifyTab';
import ReportsTab from '@/components/reports/ReportsTab';
import ManifestTrackingTab from '@/components/manifest-tracking/ManifestTrackingTab';
import DashboardTab from '@/components/dashboard/DashboardTab';
import UnknownParcelsTab from '@/components/unknown-parcels/UnknownParcelsTab';
import AllModals from '@/components/modals/AllModals';

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

    // Preload partner logos into browser cache for instant rendering upon barcode scan
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const logoAssets = ['/domex_logo.webp', '/pick_me_logo.webp', '/domex_logo.png', '/pick_me_logo.png', '/logo.webp', '/logo.png'];
            logoAssets.forEach(src => {
                const img = new Image();
                img.src = src;
            });
        }
    }, []);

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

    const [activeTab, setActiveTab] = useState<'first-scan' | 'second-scan' | 'damaged-barcode' | 'unknown-parcels' | 'verify' | 'config' | 'reports' | 'search' | 'dashboard' | 'tracking' | 'manifest-tracking'>('first-scan');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
    const [scannedToday, setScannedToday] = useState<number>(0);
    const [timeString, setTimeString] = useState<string>('');
    const [scannerConnected, setScannerConnected] = useState<boolean | null>(null); // null = unknown, true = connected, false = no scanner
    const [operatorMenuOpen, setOperatorMenuOpen] = useState<boolean>(false);

    // Tab: Manifest & Bag Tracking State
    const [manifestTrackingMawb, setManifestTrackingMawb] = useState<string>('');
    const [manifestTrackingData, setManifestTrackingData] = useState<{
        stats: any;
        manifests: any[];
        unassignedBags: any[];
    } | null>(null);
    const [isLoadingManifestTracking, setIsLoadingManifestTracking] = useState<boolean>(false);
    const [manifestTrackingSearchQuery, setManifestTrackingSearchQuery] = useState<string>('');
    const [manifestTrackingStatusFilter, setManifestTrackingStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
    const [manifestTrackingPartnerFilter, setManifestTrackingPartnerFilter] = useState<string>('ALL');
    const [expandedManifests, setExpandedManifests] = useState<Record<string, boolean>>({});
    const [expandedBags, setExpandedBags] = useState<Record<string, boolean>>({});
    const [lastRefreshedManifestTracking, setLastRefreshedManifestTracking] = useState<string>('');



    // Device Manager states
    const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
    const [testScannerInput, setTestScannerInput] = useState('');
    const [testScannerSpeed, setTestScannerSpeed] = useState<string>('');
    const [testKeyTimes, setTestKeyTimes] = useState<number[]>([]);

    // Tab 1: Box Unsealing (First Scan)
    const [mawbsList, setMawbsList] = useState<any[]>([]);
    const [firstScanMawb, setFirstScanMawb] = useState('');
    const [firstScanBags, setFirstScanBags] = useState<{
        bagNumber: string;
        expectedCount: number;
        scannedCount?: number;
        pendingCount?: number;
        status?: string;
    }[]>([]);
    const [isBagsLoading, setIsBagsLoading] = useState(false);
    const [firstScanSelectedBag, setFirstScanSelectedBag] = useState('');
    const [bagBarcodeInput, setBagBarcodeInput] = useState('');
    const [firstScanExpected, setFirstScanExpected] = useState<number | ''>('');
    const [firstScanInput, setFirstScanInput] = useState('');
    const [firstScanLastScanned, setFirstScanLastScanned] = useState('');
    const [firstScanHistory, setFirstScanHistory] = useState<Array<{ trackingNumber: string; skynetTrackingNumber?: string; senderReference?: string; isTemuScan?: boolean; recipientName: string; city: string; timestamp: string; assignedPartner?: string; assignedZone?: string }>>([]);
    const [firstScanCurrentScan, setFirstScanCurrentScan] = useState<{ assignedPartner?: string; assignedZone?: string; parcel?: any } | null>(null);
    const [firstScanBagParcels, setFirstScanBagParcels] = useState<any[]>([]);
    const [missingParcelReasons, setMissingParcelReasons] = useState<Record<string, string>>({});
    const [firstScanStatus, setFirstScanStatus] = useState<'READY' | 'FETCHING' | 'SUCCESS' | 'ERROR'>('READY');
    const [firstScanError, setFirstScanError] = useState('');
    const [firstScanHistoryPage, setFirstScanHistoryPage] = useState<number>(1);
    const [firstScanBagsPage, setFirstScanBagsPage] = useState<number>(1);
    const [firstScanHistoryRowsPerPage, setFirstScanHistoryRowsPerPage] = useState<number>(5);
    const [firstScanBagsRowsPerPage, setFirstScanBagsRowsPerPage] = useState<number>(5);
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
    const [outboundManifestsList, setOutboundManifestsList] = useState<Array<{
        id?: number;
        manifest_reference: string;
        bag_numbers: string[];
        total_bags: number;
        service_provider: number | null;
        service_provider_name?: string;
        total_parcels: number;
        status?: 'OPEN' | 'CLOSED';
        created_at?: string;
    }>>([]);
    const [createManifestModalOpen, setCreateManifestModalOpen] = useState(false);
    const [selectedProviderForManifest, setSelectedProviderForManifest] = useState<'PickMe' | 'Domex' | 'Pronto'>('PickMe');
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
    const [newBagPartner, setNewBagPartner] = useState<'PickMe' | 'Domex' | 'Pronto'>('PickMe');
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
        initialManifest?: string;
        targetMawb?: string;
        allocationLog?: string;
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
        provider?: string;
        totalBags: number;
        pickmeBags?: number;
        pickmeParcels?: number;
        domexBags?: number;
        domexParcels?: number;
        prontoBags?: number;
        prontoParcels?: number;
        generalBags?: number;
        generalParcels?: number;
        totalParcels: number;
        totalWeight: number;
    } | null>(null);
    const [manifestProgressModal, setManifestProgressModal] = useState<{
        mawbRef: string;
        closedBy: string;
        closedAt: string;
        provider: string;
        totalBags: number;
        totalParcels: number;
        processedParcels: number;
        status: 'initializing' | 'enriching' | 'ffdx_uploading' | 'completed' | 'error';
        currentBagNumber?: string;
        currentParcelRef?: string;
        bags: Array<{
            bagNumber: string;
            parcelCount: number;
            status: 'pending' | 'processing' | 'done';
            parcels: Array<{ trackingNumber: string; status: 'pending' | 'enriching' | 'ok' | 'skipped' | 'error'; message?: string }>;
        }>;
        expandedBags: Record<string, boolean>;
        error?: string;
        summary?: { totalBags: number; totalParcels: number; uploaded: number; errors: number; ffdxError?: string };
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
    const [partnerMismatchModal, setPartnerMismatchModal] = useState<{
        barcode?: string;
        manifestRef: string;
        manifestProvider: string;
        parcelProvider?: string;
        bagProvider?: string;
        message: string;
    } | null>(null);
    const [openBagsErrorModal, setOpenBagsErrorModal] = useState<{
        manifestRef: string;
        openBags: string[];
    } | null>(null);
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

    // Dispatch Verification Daily Progress & Calendar States
    const [verifySelectedDate, setVerifySelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [verifyDailyStats, setVerifyDailyStats] = useState({
        totalScannedAll: 0,
        unsealed1stScanDone: 0,
        verified2ndScanDone: 0,
        pickMeScanned: 0,
        domexScanned: 0,
        prontoScanned: 0,
        otherScanned: 0
    });
    const [verifyOutboundBags, setVerifyOutboundBags] = useState<any[]>([]);
    const [verifyManifestTable, setVerifyManifestTable] = useState<Array<{
        inboundMawb: string;
        outboundManifest: string;
        dailyScanned: number;
        unsealedCount: number;
        verifiedCount: number;
        pickMeScanned: number;
        domexScanned: number;
        prontoScanned: number;
    }>>([]);
    const [verifyScannedParcels, setVerifyScannedParcels] = useState<Array<{
        id: string | number;
        trackingNumber: string;
        senderReference?: string;
        temuBarcode?: string;
        inboundMawb: string;
        outboundBag: string;
        outboundManifest: string;
        unsealed: boolean;
        verified: boolean;
        scanStatus: string;
        serviceProvider: string;
        scannedAt: string;
    }>>([]);
    const [verifyFilterTab, setVerifyFilterTab] = useState<'ALL' | 'UNSEALED' | 'VERIFIED' | 'PICKME' | 'DOMEX'>('ALL');
    const [verifyParcelSearchQuery, setVerifyParcelSearchQuery] = useState('');
    const [verifyParcelsPage, setVerifyParcelsPage] = useState<number>(1);
    const [verifyParcelsRowsPerPage, setVerifyParcelsRowsPerPage] = useState<number>(15);
    const [verifyLoadingStats, setVerifyLoadingStats] = useState(false);

    const fetchVerifyDailyStats = useCallback(async (dateStr: string) => {
        setVerifyLoadingStats(true);
        try {
            const res = await fetch(`/api/dispatch-verify-stats?date=${encodeURIComponent(dateStr)}&_t=${Date.now()}`);
            const result = await res.json();
            if (result.success && result.stats) {
                setVerifyDailyStats(result.stats);
            }
            if (result.success && Array.isArray(result.outboundBags)) {
                setVerifyOutboundBags(result.outboundBags);
            }
            if (result.success && Array.isArray(result.manifestTable)) {
                setVerifyManifestTable(result.manifestTable);
            }
            if (result.success && Array.isArray(result.scannedParcels)) {
                setVerifyScannedParcels(result.scannedParcels);
            }
        } catch (err) {
            console.error("Failed to fetch dispatch verify daily stats:", err);
        } finally {
            setVerifyLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'verify') {
            fetchVerifyDailyStats(verifySelectedDate);
        }
    }, [activeTab, verifySelectedDate, fetchVerifyDailyStats]);

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
    const [dashTablePage, setDashTablePage] = useState<number>(1);
    const [dashTableRowsPerPage, setDashTableRowsPerPage] = useState<number>(10);
    const [manifestSessionsPage, setManifestSessionsPage] = useState<number>(1);
    const [manifestBagsPage, setManifestBagsPage] = useState<number>(1);
    const [manifestUnsealsPage, setManifestUnsealsPage] = useState<number>(1);
    const [manifestParcelsPage, setManifestParcelsPage] = useState<number>(1);

    useEffect(() => {
        setDashTablePage(1);
        setManifestSessionsPage(1);
        setManifestBagsPage(1);
        setManifestUnsealsPage(1);
        setManifestParcelsPage(1);
    }, [dashboardSubTab, dashSearchQuery, dashPartnerFilter, dashMawbFilter]);

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

    const fetchManifestTrackingData = async () => {
        setIsLoadingManifestTracking(true);
        try {
            const res = await fetch('/api/manifest-tracking', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setManifestTrackingData({
                    stats: data.stats,
                    manifests: data.manifests || [],
                    unassignedBags: data.unassignedBags || []
                });
                setLastRefreshedManifestTracking(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            }
        } catch (e) {
            console.error("Failed to fetch manifest tracking data:", e);
        } finally {
            setIsLoadingManifestTracking(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'manifest-tracking') {
            fetchManifestTrackingData();
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
            setFirstScanBagParcels([]);
            setMissingParcelReasons({});
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
        setFirstScanBagParcels([]);
        setMissingParcelReasons({});
        setFirstScanBagsPage(1);
        setFirstScanHistoryPage(1);
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
        setFirstScanHistoryPage(1);
        if (!firstScanSelectedBag) {
            setFirstScanExpected('');
            setFirstScanHistory([]);
            setFirstScanCurrentScan(null);
            setFirstScanBagParcels([]);
            setMissingParcelReasons({});
            return;
        }

        // Always reset scanned history so operator scans each parcel manually
        setFirstScanHistory([]);
        setFirstScanCurrentScan(null);
        setFirstScanBagParcels([]);
        setMissingParcelReasons({});

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
                    const scannedCount = data.scannedCount !== undefined ? data.scannedCount : (data.scannedParcels ? data.scannedParcels.length : 0);
                    const pendingCount = data.pendingCount !== undefined ? data.pendingCount : Math.max(0, actualCount - scannedCount);

                    setFirstScanBags(prev => prev.map(b => b.bagNumber === firstScanSelectedBag ? {
                        ...b,
                        expectedCount: actualCount,
                        scannedCount: scannedCount,
                        pendingCount: pendingCount,
                        status: b.status === 'COMPLETED' ? 'COMPLETED' : (scannedCount > 0 ? 'IN_PROGRESS' : 'PENDING')
                    } : b));

                    setFirstScanBagParcels(data.parcels);

                    if (Array.isArray(data.scannedParcels) && data.scannedParcels.length > 0) {
                        setFirstScanHistory(data.scannedParcels);
                        const last = data.scannedParcels[0];
                        setFirstScanCurrentScan({
                            assignedPartner: last.assignedPartner,
                            assignedZone: last.assignedZone,
                            parcel: {
                                trackingNumber: last.skynetTrackingNumber || last.trackingNumber,
                                recipientName: last.recipientName,
                                city: last.city,
                                province: '',
                                district: '',
                                weight: last.weight || 0.1,
                                mawbRef: firstScanMawb,
                                senderReference: last.senderReference,
                                _scannedVia: last.isTemuScan ? 'TEMU' : 'SKYNET',
                                isTemuScan: last.isTemuScan,
                                scannedMethod: last.isTemuScan ? 'TEMU' : 'SKYNET'
                            }
                        });
                        setFirstScanStatus('READY');
                    } else {
                        setFirstScanHistory([]);
                        setFirstScanCurrentScan(null);
                        setFirstScanStatus('READY');
                    }
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
                    setPartnerMismatchModal(null);
                    return; // Allow form submit event to proceed cleanly
                }
            }
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
                e.preventDefault();
                setDuplicateModal(null);
                setPartnerMismatchModal(null);
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

        // Compute missing parcels list & statuses for database sync
        const scannedRefs = new Set(firstScanHistory.map(p => (p.skynetTrackingNumber || p.trackingNumber || '').trim().toUpperCase()));
        const missingList = (firstScanBagParcels || []).filter(p => !scannedRefs.has((p.skynetTrackingNumber || p.trackingNumber || '').trim().toUpperCase()));
        const missingParcelsPayload = missingList.map(p => {
            const ref = p.skynetTrackingNumber || p.trackingNumber;
            const specificReason = missingParcelReasons[ref] || (discrepancyReason === 'Other (Custom Note)' ? customDiscrepancyNote.trim() : discrepancyReason) || 'Missing Parcels';
            return {
                trackingNumber: ref,
                reason: specificReason,
                status: `SHORTAGE: ${specificReason}`
            };
        });

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
                    scannedParcels: firstScanHistory,
                    missingParcels: missingParcelsPayload
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

        // Compute missing parcels list & statuses for database sync
        const scannedRefs = new Set(firstScanHistory.map(p => (p.skynetTrackingNumber || p.trackingNumber || '').trim().toUpperCase()));
        const missingList = (firstScanBagParcels || []).filter(p => !scannedRefs.has((p.skynetTrackingNumber || p.trackingNumber || '').trim().toUpperCase()));
        const missingParcelsPayload = missingList.map(p => {
            const ref = p.skynetTrackingNumber || p.trackingNumber;
            const specificReason = missingParcelReasons[ref] || (discrepancyReason === 'Other (Custom Note)' ? customDiscrepancyNote.trim() : discrepancyReason) || 'Missing Parcels';
            return {
                trackingNumber: ref,
                reason: specificReason,
                status: `SHORTAGE: ${specificReason}`
            };
        });

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
                    scannedParcels: firstScanHistory,
                    missingParcels: missingParcelsPayload
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
        const foundBag = firstScanBags.find(b => b.bagNumber === bagNumber);
        if (foundBag && foundBag.scannedCount !== undefined) {
            return foundBag.scannedCount;
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
        const foundBag = firstScanBags.find(b => b.bagNumber === bagNumber);
        if (foundBag) {
            if (foundBag.status === 'COMPLETED') return 'COMPLETED';
            if ((foundBag.scannedCount || 0) > 0 || foundBag.status === 'IN_PROGRESS') return 'IN_PROGRESS';
        }
        return 'PENDING';
    };

    const getSortedBags = () => {
        return [...firstScanBags].sort((a, b) => {
            const aIsActive = a.bagNumber === firstScanSelectedBag;
            const bIsActive = b.bagNumber === firstScanSelectedBag;
            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;

            const aStatus = getBagStatus(a.bagNumber, a.expectedCount);
            const bStatus = getBagStatus(b.bagNumber, b.expectedCount);

            const statusOrder: Record<string, number> = {
                'ONGOING': 0,
                'IN_PROGRESS': 1,
                'PENDING': 2,
                'COMPLETED': 3
            };

            const aOrder = statusOrder[aStatus] ?? 2;
            const bOrder = statusOrder[bStatus] ?? 2;

            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }

            if (aStatus === 'COMPLETED' && bStatus === 'COMPLETED') {
                const aUnsealedIndex = unsealedBoxes.findIndex(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === a.bagNumber?.toLowerCase());
                const bUnsealedIndex = unsealedBoxes.findIndex(ub => ub.mawb?.toLowerCase() === firstScanMawb?.toLowerCase() && ub.bagNumber?.toLowerCase() === b.bagNumber?.toLowerCase());
                if (aUnsealedIndex !== -1 && bUnsealedIndex !== -1) {
                    return aUnsealedIndex - bUnsealedIndex;
                }
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
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

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

                // Update firstScanBags in real-time
                setFirstScanBags(prev => prev.map(b => {
                    if (b.bagNumber === firstScanSelectedBag) {
                        const scn = newHistory.length;
                        const exp = b.expectedCount;
                        return {
                            ...b,
                            scannedCount: scn,
                            pendingCount: Math.max(0, exp - scn),
                            status: scn >= exp && exp > 0 ? 'COMPLETED' : 'IN_PROGRESS'
                        };
                    }
                    return b;
                }));

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
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

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

                // Update firstScanBags in real-time
                setFirstScanBags(prev => prev.map(b => {
                    if (b.bagNumber === firstScanSelectedBag) {
                        const scn = newHistory.length;
                        const exp = b.expectedCount;
                        return {
                            ...b,
                            scannedCount: scn,
                            pendingCount: Math.max(0, exp - scn),
                            status: scn >= exp && exp > 0 ? 'COMPLETED' : 'IN_PROGRESS'
                        };
                    }
                    return b;
                }));

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
        setFirstScanBagParcels([]);
        setMissingParcelReasons({});
        setFirstScanStatus('READY');
        setFirstScanError('');
        setFirstScanCurrentScan(null);
    };

    const fetchOutboundManifests = async () => {
        try {
            const res = await fetch('/api/lmd-bags?getOutboundManifests=true', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && Array.isArray(data.manifests)) {
                setOutboundManifestsList(data.manifests);
                const isValidSelection = selectedSecondScanMawb && data.manifests.some((m: any) => m.manifest_reference === selectedSecondScanMawb);
                if (!isValidSelection) {
                    const openManifest = data.manifests.find((m: any) => m.status === 'OPEN') || data.manifests[0];
                    setSelectedSecondScanMawb(openManifest ? openManifest.manifest_reference : '');
                }
            }
        } catch (err) {
            console.error("Failed to fetch outbound manifests:", err);
        }
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
        if (activeTab === 'second-scan' || createManifestModalOpen) {
            fetchOutboundManifests();
        }
    }, [activeTab, createManifestModalOpen]);

    useEffect(() => {
        if (selectedSecondScanMawb) {
            fetchOutboundBags(selectedSecondScanMawb);
        }
    }, [selectedSecondScanMawb]);

    const getNextManifestPreviewCode = (provider: string) => {
        const providerCode = provider.toUpperCase().replace(/\s+/g, '');
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const prefixPattern = `LK-${providerCode}-${dd}${mm}${yyyy}-`;

        const seqs = outboundManifestsList
            .map(m => m.manifest_reference || '')
            .filter(ref => ref.toUpperCase().startsWith(prefixPattern.toUpperCase()))
            .map(ref => {
                const parts = ref.split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                return isNaN(num) ? 0 : num;
            });

        const nextSeq = seqs.length > 0 ? Math.max(...seqs, 0) + 1 : 1;
        return `${prefixPattern}${String(nextSeq).padStart(2, '0')}`;
    };

    const handleCreateOutboundManifest = async () => {
        try {
            const activeOperator = currentUser
                ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username || currentUser.email
                : 'Staff';

            const res = await fetch('/api/lmd-bags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-manifest',
                    providerName: selectedProviderForManifest,
                    operator: activeOperator,
                    openedBy: currentUser?.id
                })
            });
            const data = await res.json();
            if (data.success && data.manifest) {
                const newRef = data.manifest.manifest_reference;
                setCreateManifestModalOpen(false);
                setSelectedSecondScanMawb(newRef);
                await fetchOutboundManifests();
                await fetchOutboundBags(newRef);
                setSuccessModal({
                    title: "Outbound Manifest Created",
                    message: `New Outbound Manifest "${newRef}" created successfully!`
                });
            } else {
                setErrorMessage(data.error || 'Failed to create outbound manifest.');
                setStatus('ERROR');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Server error creating outbound manifest.');
            setStatus('ERROR');
        }
    };

    const getManifestProviderName = (manifestRef: string): string => {
        if (!manifestRef) return 'ALL';
        const found = outboundManifestsList.find(m => m.manifest_reference === manifestRef);
        if (found && found.service_provider_name) {
            const spName = found.service_provider_name;
            if (spName.toLowerCase().includes('pickme')) return 'PickMe';
            if (spName.toLowerCase().includes('domex')) return 'Domex';
            if (spName.toLowerCase().includes('pronto')) return 'Pronto';
            return spName;
        }
        const upper = manifestRef.toUpperCase();
        if (upper.includes('PICKME')) return 'PickMe';
        if (upper.includes('DOMEX')) return 'Domex';
        if (upper.includes('PRONTO')) return 'Pronto';
        return 'ALL';
    };

    const handleCreateOutboundBag = async () => {
        if (secondScanManifestStatus === 'CLOSED') {
            setErrorMessage(`Manifest "${selectedSecondScanMawb}" is CLOSED. No additional bags can be created.`);
            setStatus('ERROR');
            setCreateBagModalOpen(false);
            return;
        }

        const manifestProvider = getManifestProviderName(selectedSecondScanMawb);
        if (manifestProvider !== 'ALL' && newBagPartner.toLowerCase() !== manifestProvider.toLowerCase()) {
            setPartnerMismatchModal({
                manifestRef: selectedSecondScanMawb,
                manifestProvider,
                bagProvider: newBagPartner,
                message: `Active Manifest "${selectedSecondScanMawb}" is created for ${manifestProvider.toUpperCase()}. You cannot create a ${newBagPartner.toUpperCase()} bag inside a ${manifestProvider.toUpperCase()} manifest!`
            });
            setCreateBagModalOpen(false);
            return;
        }

        const defaultCalculatedBagNumber = `${selectedSecondScanMawb}-${newBagPartner.toUpperCase()}-BAG-${String((outboundBags?.length || 0) + 1).padStart(2, '0')}`;
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
                    destinationHub: newBagHub || `${newBagPartner}`,
                    operator: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Staff',
                    openedBy: currentUser?.id
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

    const handleCloseManifest = async (targetMawb?: string) => {
        const mawbToClose = targetMawb || selectedSecondScanMawb || manifestTrackingMawb;
        if (!mawbToClose) return;

        const activeOperator = currentUser
            ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username || currentUser.email
            : 'Staff';

        const relevantBags = (outboundBags || []).filter(b => !mawbToClose || (b.mawbRef || '').toLowerCase() === mawbToClose.toLowerCase());

        const openBags = relevantBags.filter(b => b.status === 'OPEN' || b.status !== 'SEALED');
        if (openBags.length > 0) {
            setOpenBagsErrorModal({
                manifestRef: mawbToClose,
                openBags: openBags.map(b => b.bagNumber)
            });
            return;
        }

        const providerCode = getManifestProviderName(mawbToClose);
        const providerDisplay = providerCode === 'PickMe' ? 'PickMe Express'
            : providerCode === 'Domex' ? 'Domex Express'
                : providerCode === 'Pronto' ? 'Pronto Lanka'
                    : providerCode === 'ALL' ? 'General (All Partners)'
                        : providerCode;

        // Initialize progress modal state
        setManifestProgressModal({
            mawbRef: mawbToClose,
            closedBy: activeOperator,
            closedAt: new Date().toLocaleTimeString(),
            provider: providerDisplay,
            totalBags: relevantBags.length,
            totalParcels: relevantBags.reduce((s, b) => s + (b.parcelCount || (b.parcels?.length || 0)), 0),
            processedParcels: 0,
            status: 'initializing',
            bags: relevantBags.map(b => ({
                bagNumber: b.bagNumber,
                parcelCount: b.parcelCount || (b.parcels?.length || 0),
                status: 'pending',
                parcels: (b.parcels || []).map((p: any) => ({
                    trackingNumber: String(p.trackingNumber || p.shipment_ref || '').replace(/^skyt-?/i, '').trim(),
                    status: 'pending'
                }))
            })),
            expandedBags: relevantBags.reduce((acc, b) => { acc[b.bagNumber] = true; return acc; }, {} as Record<string, boolean>)
        });

        // Open SSE Connection
        const sseUrl = `/api/manifest-close-stream?mawbRef=${encodeURIComponent(mawbToClose)}&operator=${encodeURIComponent(activeOperator)}&serviceProviderName=${encodeURIComponent(providerCode)}&closedBy=${encodeURIComponent(currentUser?.id || '')}`;
        const es = new EventSource(sseUrl);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'start') {
                    setManifestProgressModal(prev => prev ? ({
                        ...prev,
                        totalBags: data.totalBags || prev.totalBags,
                        totalParcels: data.totalParcels || prev.totalParcels,
                        closedAt: new Date(data.closedAt).toLocaleTimeString(),
                        status: 'enriching'
                    }) : null);
                } else if (data.type === 'bag') {
                    setManifestProgressModal(prev => {
                        if (!prev) return null;
                        const existingBags = [...prev.bags];
                        const idx = existingBags.findIndex(b => b.bagNumber === data.bagNumber);
                        if (idx >= 0) {
                            existingBags[idx] = {
                                ...existingBags[idx],
                                parcelCount: data.parcelCount !== undefined ? data.parcelCount : existingBags[idx].parcelCount,
                                status: data.status === 'processing' ? 'processing' : data.status === 'done' ? 'done' : 'pending'
                            };
                        } else {
                            existingBags.push({
                                bagNumber: data.bagNumber,
                                parcelCount: data.parcelCount || 0,
                                status: data.status === 'processing' ? 'processing' : data.status === 'done' ? 'done' : 'pending',
                                parcels: []
                            });
                        }
                        return {
                            ...prev,
                            currentBagNumber: data.bagNumber,
                            bags: existingBags,
                            expandedBags: { ...prev.expandedBags, [data.bagNumber]: true }
                        };
                    });
                } else if (data.type === 'parcel') {
                    setManifestProgressModal(prev => {
                        if (!prev) return null;
                        const bags = prev.bags.map(b => {
                            if (b.bagNumber !== data.bagNumber) return b;
                            const parcels = [...b.parcels];
                            const pIdx = parcels.findIndex(p => p.trackingNumber === data.trackingNumber);
                            const newStatus = data.status === 'ok' ? 'ok' : data.status === 'skipped' ? 'skipped' : data.status === 'enriching' ? 'enriching' : 'error';
                            if (pIdx >= 0) {
                                parcels[pIdx] = { ...parcels[pIdx], status: newStatus, message: data.message };
                            } else {
                                parcels.push({ trackingNumber: data.trackingNumber, status: newStatus, message: data.message });
                            }
                            return { ...b, parcels };
                        });
                        const processedCount = (data.status === 'ok' || data.status === 'skipped') ? prev.processedParcels + 1 : prev.processedParcels;
                        return {
                            ...prev,
                            bags,
                            currentParcelRef: data.trackingNumber,
                            processedParcels: data.status !== 'enriching' ? Math.min(processedCount, prev.totalParcels) : prev.processedParcels
                        };
                    });
                } else if (data.type === 'ffdx_start') {
                    setManifestProgressModal(prev => prev ? ({ ...prev, status: 'ffdx_uploading' }) : null);
                } else if (data.type === 'ffdx_done') {
                    if (!data.success && data.error) {
                        setManifestProgressModal(prev => prev ? ({ ...prev, error: data.error }) : null);
                    }
                } else if (data.type === 'done') {
                    es.close();
                    setSecondScanManifestStatus('CLOSED');
                    setManifestProgressModal(prev => prev ? ({
                        ...prev,
                        status: 'completed',
                        processedParcels: prev.totalParcels,
                        summary: data.summary
                    }) : null);
                } else if (data.type === 'error') {
                    es.close();
                    setManifestProgressModal(prev => prev ? ({
                        ...prev,
                        status: 'error',
                        error: data.message || 'Manifest close failed'
                    }) : null);
                }
            } catch (e) {
                console.error('[manifest-close-stream] Event parse error:', e);
            }
        };

        es.onerror = (err) => {
            console.error('[manifest-close-stream] SSE error:', err);
            es.close();
            setManifestProgressModal(prev => {
                if (!prev) return null;
                // If it's already finished or nearing finish, just complete it
                if (prev.status === 'ffdx_uploading' || prev.status === 'completed') {
                    setSecondScanManifestStatus('CLOSED');
                    return { ...prev, status: 'completed' };
                }
                return { ...prev, status: 'error', error: 'Connection to server interrupted.' };
            });
        };
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
                    closedBy: currentUser?.id,
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

    const handleDeleteOutboundBag = async (bagNumber: string) => {
        if (!bagNumber) return;
        const targetBag = (outboundBags || []).find(b => b.bagNumber === bagNumber);
        if (targetBag && targetBag.status === 'SEALED') {
            setErrorMessage(`Cannot delete sealed bag. Outbound Bag "${bagNumber}" is SEALED & CLOSED.`);
            setStatus('ERROR');
            return;
        }
        try {
            const res = await fetch('/api/lmd-bags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete-bag',
                    bagNumber: bagNumber,
                    mawbRef: selectedSecondScanMawb
                })
            });
            const data = await res.json();
            if (data.success) {
                const updatedBags = (outboundBags || []).filter(b => b.bagNumber !== bagNumber);
                setOutboundBags(updatedBags);
                if (activeOutboundBag?.bagNumber === bagNumber) {
                    const nextActive = updatedBags.find(b => b.status === 'OPEN') || updatedBags[0] || null;
                    setActiveOutboundBag(nextActive);
                }
                setSuccessModal({
                    title: "Outbound Bag Removed",
                    message: `Outbound Bag "${bagNumber}" has been removed successfully.`
                });
            } else {
                setErrorMessage(data.error || 'Failed to remove outbound bag.');
                setStatus('ERROR');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Server error removing outbound bag.');
            setStatus('ERROR');
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
        setPartnerMismatchModal(null);

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
                const manifestProvider = getManifestProviderName(selectedSecondScanMawb);
                const parcelPartner = data.assignedPartner || data.parcel.assignedPartner;

                if (manifestProvider !== 'ALL' && parcelPartner && parcelPartner !== 'ALL' && parcelPartner.toLowerCase() !== manifestProvider.toLowerCase()) {
                    setStatus('ERROR');
                    const errMsg = `MANIFEST & PARTNER MISMATCH EXCEPTION! Parcel "${barcode}" is assigned to ${parcelPartner.toUpperCase()}, but active Manifest is "${selectedSecondScanMawb}" (${manifestProvider.toUpperCase()}). You cannot allocate a ${parcelPartner.toUpperCase()} parcel into a ${manifestProvider.toUpperCase()} manifest!`;
                    setErrorMessage(errMsg);
                    setValidationCard({
                        status: 'INCORRECT',
                        reason: 'PARTNER_MISMATCH',
                        error: errMsg,
                        bagNumber: activeOutboundBag.bagNumber
                    });
                    setPartnerMismatchModal({
                        barcode,
                        manifestRef: selectedSecondScanMawb,
                        manifestProvider,
                        parcelProvider: parcelPartner,
                        message: errMsg
                    });
                    return;
                }

                // Validation: CORRECT!
                setCurrentScan(data);
                setStatus('SUCCESS');
                setScannedToday((prev) => prev + 1);

                const initialManifest = data.initialManifest || data.parcel?.initialManifest || data.parcel?.mawbRef || 'Initial Manifest';
                const initialBag = data.parcel?.inboundBag || data.parcel?.initialBag || data.parcel?.bagNumber || data.parcel?.bag_number || '';
                const cleanTracking = (data.parcel?.trackingNumber || barcode || '').toString().replace(/SKYT-?/gi, '').trim();
                const parcelToStore = {
                    ...data.parcel,
                    initialManifest,
                    inboundManifest: initialManifest,
                    inboundBag: initialBag,
                    initialBag,
                    mawbRef: initialManifest,
                    scannedBarcode: barcode,
                    displayTrackingNumber: data.parcel?.senderReference && data.parcel.senderReference.trim().toLowerCase() === barcode.trim().toLowerCase()
                        ? `${barcode} / ${cleanTracking}`
                        : cleanTracking
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
                    parcel: parcelToStore,
                    assignedPartner: data.assignedPartner,
                    assignedZone: data.assignedZone,
                    bagNumber: activeOutboundBag.bagNumber,
                    initialManifest,
                    targetMawb: selectedSecondScanMawb,
                    allocationLog: data.allocationLog || `Parcel "${data.parcel?.trackingNumber || barcode}" (Initial Manifest: "${initialManifest}") allocated to Bag "${activeOutboundBag.bagNumber}" under LMD Manifest "${selectedSecondScanMawb}"`
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
                } else if (isPartnerMismatch && !isCombined) {
                    const manifestProvider = getManifestProviderName(selectedSecondScanMawb);
                    setPartnerMismatchModal({
                        barcode,
                        manifestRef: selectedSecondScanMawb,
                        manifestProvider,
                        parcelProvider: data.assignedPartner || 'Another Partner',
                        message: data.error || `Partner Allocation Mismatch: Parcel is allocated to ${data.assignedPartner || 'another partner'}, but active Manifest is ${selectedSecondScanMawb} (${manifestProvider}).`
                    });
                } else if ((isManifestMismatch || isDuplicate) && !isCombined) {
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
                body: JSON.stringify({ trackingNumber: barcode, stage: 'damaged-lookup' }),
            });
            const data: AllocationResponse = await response.json();
            if (data.success) {
                setDamagedCurrentScan(data);
                setDamagedHistory((prev) => [data, ...prev].slice(0, 10));
                setDamagedStatus('SUCCESS');
            } else {
                throw new Error(data.error || 'Unknown lookup failure');
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
                    //{ lbl: 'API sync', val: <span style={{ color: '#16a34a', fontWeight: '600' }}>✓ {parcel.apiSync || 'Synced'}</span> },
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
            case 'manifest-tracking':
                return {
                    title: 'Manifest & Outbound Bag Tracking',
                    description: 'Select a manifest to view all created outbound bags, inspect parcels inside each bag, and track allocation breakdowns.'
                };
            case 'damaged-barcode':
                return {
                    title: 'Damaged Labels Exception Management',
                    description: 'Process damaged or unreadable barcode labels and print canonical replacement stickers.'
                };
            case 'unknown-parcels':
                return {
                    title: 'Unknown & Unregistered Parcels Scanning',
                    description: 'Scan extra parcels not found in the system, generate Excel sheets, and email lists to Superadmin.'
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

    // ── appState: all state/handlers passed to task components ──
    const appState = {
        activeOutboundBag,
        activeTab,
        autoFinishBag,
        bagBarcodeInput,
        bagBarcodeInputRef,
        barcodeInput,
        binCounts,
        btnDanger,
        btnPrimary,
        btnSecondary,
        card,
        config,
        confirmFinishModal,
        createBagModalOpen,
        createManifestModalOpen,
        currentScan,
        currentUser,
        customBagNumber,
        customConfirmModal,
        customDiscrepancyNote,
        damagedBarcodeInput,
        damagedCurrentScan,
        damagedErrorMessage,
        damagedHistory,
        damagedImage1,
        damagedImage2,
        damagedInputRef,
        damagedLastScanned,
        damagedManualTracking,
        damagedReportCategory,
        damagedReportFormOpen,
        damagedReportRemarks,
        damagedReportSeverity,
        damagedReportsList,
        damagedSelectedPhotosModal,
        damagedStatus,
        damagedSubTab,
        damagedSubmitError,
        damagedSubmitSuccess,
        damagedSubmitting,
        dashMawbFilter,
        dashPartnerFilter,
        dashSearchQuery,
        dashStatusFilter,
        dashTablePage,
        dashTableRowsPerPage,
        dashboardData,
        dashboardSubTab,
        discrepancyReason,
        duplicateModal,
        errorMessage,
        expandedBags,
        expandedManifests,
        extraParcelModal,
        extraParcelNote,
        extractLatestBarcode,
        fetchDamagedParcels,
        fetchDashboard,
        fetchManifestTrackingData,
        fetchOutboundBags,
        fetchOutboundManifests,
        fetchVerifyDailyStats,
        firstScanBagParcels,
        firstScanBags,
        firstScanBagsPage,
        firstScanBagsRowsPerPage,
        firstScanCurrentScan,
        firstScanError,
        firstScanExpected,
        firstScanHistory,
        firstScanHistoryPage,
        firstScanHistoryRowsPerPage,
        firstScanInput,
        firstScanInputRef,
        firstScanLastScanned,
        firstScanMawb,
        firstScanSelectedBag,
        firstScanStatus,
        generateCode128SVG,
        getBagScannedCount,
        getBagStatus,
        getManifestProviderName,
        getNextManifestPreviewCode,
        getPageHeaderInfo,
        getSortedBags,
        handleAddZoneMapping,
        handleChangeLMD,
        handleChangeLMDDamaged,
        handleClearDamagedScan,
        handleClearFirstScan,
        handleClearScan,
        handleClearTestInput,
        handleCloseManifest,
        handleConfirmDispatch,
        handleConfirmDispatchDamaged,
        handleConfirmFinish,
        handleCreateOutboundBag,
        handleCreateOutboundManifest,
        handleDamagedImageUpload,
        handleDamagedScanSubmit,
        handleDeleteOutboundBag,
        handleFirstScanSubmit,
        handleFirstScanSubmitOverride,
        handleForceUnsealWithNote,
        handleLogout,
        handleRenewPinSubmit,
        handleScanSubmit,
        handleSealOutboundBag,
        handleSearchSubmit,
        handleSubmitDamagedParcelReport,
        handleSwitchUserSubmit,
        handleTestScannerKeyDown,
        handleVerifySubmit,
        history,
        inputStyle,
        invalidBagParcelModal,
        invalidBarcodeModal,
        isBagsLoading,
        isDeviceManagerOpen,
        isLoadingDashboard,
        isLoadingManifestTracking,
        isSearching,
        isSidebarExpanded,
        label,
        lastRefreshedManifestTracking,
        lastScanned,
        lastTemuSticker,
        lastVerifyScanned,
        manifestBagsPage,
        manifestClosedModal,
        manifestParcelsPage,
        manifestProgressModal,
        manifestSessionsPage,
        manifestTrackingData,
        manifestTrackingMawb,
        manifestTrackingPartnerFilter,
        manifestTrackingSearchQuery,
        manifestTrackingStatusFilter,
        manifestUnsealsPage,
        mawbsList,
        mismatchCount,
        missedFirstScanModal,
        missingParcelReasons,
        newBagHub,
        newBagPartner,
        newCity,
        newProvince,
        newZone,
        openBagsErrorModal,
        operatorMenuOpen,
        outboundBags,
        outboundManifestsList,
        overageCheckModal,
        parcelDetailsGrid,
        partnerMismatchModal,
        pendingDispatch,
        printLabelModal,
        printOutboundBagLabelModal,
        renewForm,
        renewPinModal,
        resolvePartnerName,
        router,
        rowItem,
        scanInputRef,
        scannedToday,
        scannerConnected,
        searchFilter,
        searchQuery,
        searchResults,
        secondScanManifestStatus,
        selectedBin,
        selectedProviderForManifest,
        selectedSecondScanMawb,
        setActiveOutboundBag,
        setActiveTab,
        setBagBarcodeInput,
        setBarcodeInput,
        setBinCounts,
        setConfig,
        setConfirmFinishModal,
        setCreateBagModalOpen,
        setCreateManifestModalOpen,
        setCurrentScan,
        setCurrentUser,
        setCustomBagNumber,
        setCustomConfirmModal,
        setCustomDiscrepancyNote,
        setDamagedBarcodeInput,
        setDamagedCurrentScan,
        setDamagedErrorMessage,
        setDamagedHistory,
        setDamagedImage1,
        setDamagedImage2,
        setDamagedLastScanned,
        setDamagedManualTracking,
        setDamagedReportCategory,
        setDamagedReportFormOpen,
        setDamagedReportRemarks,
        setDamagedReportSeverity,
        setDamagedReportsList,
        setDamagedSelectedPhotosModal,
        setDamagedStatus,
        setDamagedSubTab,
        setDamagedSubmitError,
        setDamagedSubmitSuccess,
        setDamagedSubmitting,
        setDashMawbFilter,
        setDashPartnerFilter,
        setDashSearchQuery,
        setDashStatusFilter,
        setDashTablePage,
        setDashTableRowsPerPage,
        setDashboardData,
        setDashboardSubTab,
        setDiscrepancyReason,
        setDuplicateModal,
        setErrorMessage,
        setExpandedBags,
        setExpandedManifests,
        setExtraParcelModal,
        setExtraParcelNote,
        setFirstScanBagParcels,
        setFirstScanBags,
        setFirstScanBagsPage,
        setFirstScanBagsRowsPerPage,
        setFirstScanCurrentScan,
        setFirstScanError,
        setFirstScanExpected,
        setFirstScanHistory,
        setFirstScanHistoryPage,
        setFirstScanHistoryRowsPerPage,
        setFirstScanInput,
        setFirstScanLastScanned,
        setFirstScanMawb,
        setFirstScanSelectedBag,
        setFirstScanStatus,
        setHistory,
        setInvalidBagParcelModal,
        setInvalidBarcodeModal,
        setIsBagsLoading,
        setIsDeviceManagerOpen,
        setIsLoadingDashboard,
        setIsLoadingManifestTracking,
        setIsSearching,
        setIsSidebarExpanded,
        setLastRefreshedManifestTracking,
        setLastScanned,
        setLastTemuSticker,
        setLastVerifyScanned,
        setManifestBagsPage,
        setManifestClosedModal,
        setManifestParcelsPage,
        setManifestProgressModal,
        setManifestSessionsPage,
        setManifestTrackingData,
        setManifestTrackingMawb,
        setManifestTrackingPartnerFilter,
        setManifestTrackingSearchQuery,
        setManifestTrackingStatusFilter,
        setManifestUnsealsPage,
        setMawbsList,
        setMismatchCount,
        setMissedFirstScanModal,
        setMissingParcelReasons,
        setNewBagHub,
        setNewBagPartner,
        setNewCity,
        setNewProvince,
        setNewZone,
        setOpenBagsErrorModal,
        setOperatorMenuOpen,
        setOutboundBags,
        setOutboundManifestsList,
        setOverageCheckModal,
        setPartnerMismatchModal,
        setPendingDispatch,
        setPrintLabelModal,
        setPrintOutboundBagLabelModal,
        setRenewForm,
        setRenewPinModal,
        setScannedToday,
        setScannerConnected,
        setSearchFilter,
        setSearchQuery,
        setSearchResults,
        setSecondScanManifestStatus,
        setSelectedBin,
        setSelectedProviderForManifest,
        setSelectedSecondScanMawb,
        setStatus,
        setSuccessModal,
        setSwitchUserFirstName,
        setSwitchUserModal,
        setSwitchUserPassword,
        setTestKeyTimes,
        setTestScannerInput,
        setTestScannerSpeed,
        setTimeString,
        setUnallocatedBagNote,
        setUnallocatedBagUnsealModal,
        setUnallocatedPartnerModal,
        setUnsealedBoxes,
        setUsersList,
        setValidationCard,
        setVerifiedCount,
        setVerifyBarcodeInput,
        setVerifyDailyStats,
        setVerifyErrorMessage,
        setVerifyFilterTab,
        setVerifyHistory,
        setVerifyLoadingStats,
        setVerifyManifestTable,
        setVerifyOutboundBags,
        setVerifyParcelSearchQuery,
        setVerifyParcelsPage,
        setVerifyParcelsRowsPerPage,
        setVerifyScan,
        setVerifyScannedParcels,
        setVerifySelectedDate,
        setVerifyStatus,
        setViewingUnsealedParcelsModal,
        status,
        successModal,
        switchUserFirstName,
        switchUserModal,
        switchUserPassword,
        testKeyTimes,
        testScannerInput,
        testScannerSpeed,
        timeString,
        unallocatedBagNote,
        unallocatedBagUnsealModal,
        unallocatedPartnerModal,
        unsealedBoxes,
        usersList,
        validationCard,
        verifiedCount,
        verifyBarcodeInput,
        verifyDailyStats,
        verifyErrorMessage,
        verifyFilterTab,
        verifyHistory,
        verifyInputRef,
        verifyLoadingStats,
        verifyManifestTable,
        verifyOutboundBags,
        verifyParcelSearchQuery,
        verifyParcelsPage,
        verifyParcelsRowsPerPage,
        verifyScan,
        verifyScannedParcels,
        verifySelectedDate,
        verifyStatus,
        viewingUnsealedParcelsModal,
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
                                id: 'manifest-tracking',
                                label: 'Outbound Manifest Tracking',
                                icon: (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <line x1="10" y1="9" x2="8" y2="9" />
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
                                id: 'unknown-parcels',
                                label: 'Unknown Parcels',
                                icon: (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                                        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                                        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                                        <path d="M3 17v2a2 2 0 0 1 2 2h2" />
                                        <circle cx="12" cy="12" r="2" />
                                        <path d="M12 8v2" />
                                        <path d="M12 16h.01" />
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

                    {/* ═══ PARCEL TRACKING ═══ */}
                    {activeTab === 'tracking' && (
                        <TrackingTab />
                    )}

                    {/* ═══ FirstScanTab ═══ */}
                    {activeTab === 'first-scan' && (
                        <FirstScanTab {...appState} />
                    )}

                    {/* ═══ SecondScanTab ═══ */}
                    {activeTab === 'second-scan' && (
                        <SecondScanTab {...appState} />
                    )}

                    {/* ═══ DamagedBarcodeTab ═══ */}
                    {activeTab === 'damaged-barcode' && (
                        <DamagedBarcodeTab {...appState} />
                    )}

                    {/* ═══ UnknownParcelsTab ═══ */}
                    {activeTab === 'unknown-parcels' && (
                        <UnknownParcelsTab {...appState} />
                    )}

                    {/* ═══ DispatchVerifyTab ═══ */}
                    {activeTab === 'verify' && (
                        <DispatchVerifyTab {...appState} />
                    )}

                    {/* ═══ ReportsTab ═══ */}
                    {activeTab === 'reports' && (
                        <ReportsTab {...appState} />
                    )}

                    {/* ═══ ManifestTrackingTab ═══ */}
                    {activeTab === 'manifest-tracking' && (
                        <ManifestTrackingTab {...appState} />
                    )}

                    {/* ═══ DashboardTab ═══ */}
                    {activeTab === 'dashboard' && (
                        <DashboardTab {...appState} />
                    )}

                </main>

                {/* ═══ ALL MODALS ═══ */}
                <AllModals {...appState} />
            </div >


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