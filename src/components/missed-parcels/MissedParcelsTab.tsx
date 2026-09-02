'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import PaginationControl from '@/app/components/PaginationControl';

export interface MissedParcelItem {
    id: number | string;
    trackingNumber: string;
    senderReference?: string | null;
    mawbReference: string;
    bagNumber: string;
    consigneeName: string;
    city: string;
    district?: string;
    province?: string;
    weight?: number;
    assignedPartner: string;
    assignedZone: string;
    shortageReason: string;
    status: 'SHORTAGE' | 'SHORTLANDED' | 'RECOVERED';
    rawScanStatus?: string;
    unsealed: boolean;
    trackStatus?: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function MissedParcelsTab({
    currentUser,
    user,
    operator,
    setActiveTab
}: any) {
    const activeUser = currentUser || user;
    const activeOperator = activeUser
        ? (`${activeUser.firstName || ''} ${activeUser.lastName || ''}`.trim() || activeUser.name || activeUser.username || activeUser.email || operator || 'Operator')
        : (operator || 'Operator');

    const [parcels, setParcels] = useState<MissedParcelItem[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        shortlanded: 0,
        recovered: 0,
        pickme: 0,
        domex: 0,
        sitrek: 0,
        pronto: 0,
        other: 0
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Filters (Manifest-wise, Partner, Status, Search)
    const [selectedMawb, setSelectedMawb] = useState<string>('ALL');
    const [mawbList, setMawbList] = useState<string[]>([]);
    const [selectedPartner, setSelectedPartner] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PENDING_RECOVERY' | 'SHORTLANDED' | 'RECOVERED'>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Recovery Modal / Banner
    const [recoveredModal, setRecoveredModal] = useState<{
        parcel: any;
        assignedPartner: string;
        assignedZone: string;
        trackingNumber: string;
        temuBarcode?: string;
        recoveredAt: string;
    } | null>(null);

    // Confirm Shortlanded Modal
    const [confirmShortlandedModal, setConfirmShortlandedModal] = useState<MissedParcelItem | null>(null);
    const [isShortlanding, setIsShortlanding] = useState<boolean>(false);

    const [recoveringIds, setRecoveringIds] = useState<Set<string | number>>(new Set());

    // Pagination
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    // Track whether we've already done the initial auto-select
    const hasAutoSelected = useRef(false);

    // Fetch Missed Parcels from API (Manifest-wise)
    const fetchMissedParcels = async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            if (selectedMawb && selectedMawb !== 'ALL') {
                params.append('mawb', selectedMawb);
            }
            if (selectedPartner && selectedPartner !== 'ALL') {
                params.append('partner', selectedPartner);
            }
            if (selectedStatus) {
                params.append('status', selectedStatus);
            }
            if (searchQuery) {
                params.append('search', searchQuery);
            }

            const res = await fetch(`/api/missed-parcels?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();

            if (data.success) {
                setParcels(data.parcels || []);
                if (data.stats) setStats(data.stats);
                if (Array.isArray(data.mawbList)) setMawbList(data.mawbList);

                // Auto-select the first today's MAWB only on the very first load
                if (!hasAutoSelected.current && Array.isArray(data.todayMawbs) && data.todayMawbs.length > 0) {
                    hasAutoSelected.current = true;
                    setSelectedMawb(data.todayMawbs[0]);
                    return; // state change will re-trigger fetchMissedParcels via useEffect
                }
            } else {
                toast.error(data.error || 'Failed to fetch missed parcels.');
            }
        } catch (err: any) {
            console.error('Failed to load missed parcels:', err);
            toast.error('Network error while loading missed parcels.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMissedParcels();
        setCurrentPage(1);
    }, [selectedMawb, selectedPartner, selectedStatus]);

    // Handle single row "Mark Found" button click
    const handleRecoverSingleRow = async (item: MissedParcelItem) => {
        const idKey = item.id || item.trackingNumber;
        setRecoveringIds(prev => new Set(prev).add(idKey));

        try {
            const res = await fetch('/api/missed-parcels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'recover',
                    barcode: item.trackingNumber,
                    trackingNumber: item.trackingNumber,
                    operator: activeOperator
                })
            });

            const data = await res.json();
            if (data.success && data.parcel) {
                toast.success(`Parcel ${item.trackingNumber} marked as 1st Scan Done!`);
                setRecoveredModal({
                    parcel: data.parcel,
                    assignedPartner: data.assignedPartner || item.assignedPartner,
                    assignedZone: data.assignedZone || item.assignedZone,
                    trackingNumber: item.trackingNumber,
                    temuBarcode: item.senderReference || undefined,
                    recoveredAt: new Date().toLocaleTimeString()
                });
                // Update item in place immediately
                setParcels(prev => prev.map(p => {
                    if (p.id === item.id || p.trackingNumber === item.trackingNumber) {
                        return {
                            ...p,
                            status: 'RECOVERED',
                            rawScanStatus: '1ST_SCAN_DONE',
                            unsealed: true,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return p;
                }));
                setStats(prev => ({
                    ...prev,
                    pending: Math.max(0, prev.pending - 1),
                    recovered: prev.recovered + 1
                }));
            } else {
                toast.error(data.message || data.error || 'Failed to recover parcel.');
            }
        } catch (err: any) {
            toast.error('Network error during recovery.');
        } finally {
            setRecoveringIds(prev => {
                const next = new Set(prev);
                next.delete(idKey);
                return next;
            });
        }
    };

    // Handle Confirm Shortlanded (Missing in Inbound Bag - Code 24)
    const handleConfirmShortlanded = async () => {
        if (!confirmShortlandedModal) return;
        const item = confirmShortlandedModal;
        const idKey = item.id || item.trackingNumber;
        setIsShortlanding(true);

        try {
            const res = await fetch('/api/missed-parcels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'shortlanded',
                    barcode: item.trackingNumber,
                    trackingNumber: item.trackingNumber,
                    operator: activeOperator
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(`Parcel ${item.trackingNumber} confirmed as Shortlanded (Event 24 sent to GetonLine).`);
                setParcels(prev => prev.map(p => {
                    if (p.id === item.id || p.trackingNumber === item.trackingNumber) {
                        return {
                            ...p,
                            status: 'SHORTLANDED',
                            rawScanStatus: 'SHORTLANDED_CONFIRMED',
                            unsealed: false,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return p;
                }));
                setStats(prev => ({
                    ...prev,
                    pending: Math.max(0, prev.pending - 1),
                    shortlanded: prev.shortlanded + 1
                }));
                setConfirmShortlandedModal(null);
            } else {
                toast.error(data.message || data.error || 'Failed to confirm shortlanded parcel.');
            }
        } catch (err: any) {
            toast.error('Network error during shortlanded confirmation.');
        } finally {
            setIsShortlanding(false);
        }
    };

    // Client-side search filtering
    const filteredParcels = useMemo(() => {
        if (!searchQuery.trim()) return parcels;
        const q = searchQuery.trim().toLowerCase();
        return parcels.filter(p =>
            p.trackingNumber.toLowerCase().includes(q) ||
            p.bagNumber.toLowerCase().includes(q) ||
            p.assignedPartner.toLowerCase().includes(q) ||
            p.consigneeName.toLowerCase().includes(q)
        );
    }, [parcels, searchQuery]);

    // Pagination calculations
    const paginatedParcels = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredParcels.slice(start, start + rowsPerPage);
    }, [filteredParcels, currentPage, rowsPerPage]);

    const getPartnerLogo = (partner: string) => {
        const p = partner.toUpperCase();
        if (p.includes('PICKME')) return '/pick_me_logo.webp';
        if (p.includes('DOMEX')) return '/domex_logo.webp';
        if (p.includes('SITREK')) return '/sitrek_logo.webp';
        return '/logo.png';
    };

    return (
        <div style={{ fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── FILTERS BAR (STYLED AS IN DAILY DISPATCH & SCAN PROGRESS OVERVIEW) ── */}
            <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#09090b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Inbound Manifest Missed & Shortage Parcels
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#71717a' }}>
                        Select manifest below to view shortage records from service provider allocation.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Select Manifest Dropdown */}
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#27272a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Select Manifest:
                        <select
                            value={selectedMawb}
                            onChange={(e) => setSelectedMawb(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e4e4e7',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#09090b',
                                outline: 'none',
                                cursor: 'pointer',
                                backgroundColor: '#ffffff',
                                minWidth: '180px'
                            }}
                        >
                            <option value="ALL">-- All Manifests --</option>
                            {mawbList.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </label>

                    {/* Status Filter */}
                    <select
                        value={selectedStatus}
                        onChange={(e: any) => setSelectedStatus(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e4e4e7',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#09090b',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <option value="ALL">All Statuses ({stats.total})</option>
                        <option value="PENDING_RECOVERY">Pending Shortage ({stats.pending})</option>
                        <option value="SHORTLANDED">Shortlanded Confirmed ({stats.shortlanded})</option>
                        <option value="RECOVERED">Recovered (1st Scan Done) ({stats.recovered})</option>
                    </select>

                    {/* Partner Filter */}
                    <select
                        value={selectedPartner}
                        onChange={(e) => setSelectedPartner(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e4e4e7',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#09090b',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <option value="ALL">All Partners</option>
                        <option value="PickMe">PickMe ({stats.pickme})</option>
                        <option value="Domex">Domex ({stats.domex})</option>
                        <option value="SITREK">SITREK ({stats.sitrek})</option>
                        <option value="Pronto">Pronto ({stats.pronto})</option>
                    </select>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchMissedParcels}
                        disabled={isLoading}
                        style={{
                            backgroundColor: '#ffffff',
                            color: '#b91c1c',
                            border: '1px solid #b91c1c',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLoading ? 'Loading...' : 'Refresh'}
                    </button>

                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search tracking, bag, name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e4e4e7',
                            fontSize: '13px',
                            outline: 'none',
                            width: '180px',
                            backgroundColor: '#ffffff',
                            color: '#09090b'
                        }}
                    />
                </div>
            </div>

            {/* ── SUMMARY STATS CARDS (APPEARANCE MATCHING DISPATCH VERIFICATION) ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '14px',
                fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)'
            }}>
                {/* 1. Total Missed Parcels */}
                <div
                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #e21b22'; e.currentTarget.style.outlineOffset = '-2px'; }}
                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out'
                    }}
                >
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px' }}>
                        Total Missed Parcels
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px' }}>
                        {isLoading ? '...' : stats.total}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedMawb && selectedMawb !== 'ALL' ? selectedMawb : 'All Manifests'}
                    </div>
                </div>

                {/* 2. Pending Shortage */}
                <div
                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #dc2626'; e.currentTarget.style.outlineOffset = '-2px'; }}
                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out'
                    }}
                >
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#dc2626', letterSpacing: '0.5px' }}>
                        Pending Shortage
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>
                        {isLoading ? '...' : stats.pending}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Awaiting 1st Scan
                    </div>
                </div>

                {/* 3. Shortlanded Confirmed */}
                <div
                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #d97706'; e.currentTarget.style.outlineOffset = '-2px'; }}
                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out'
                    }}
                >
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#b45309', letterSpacing: '0.5px' }}>
                        Shortlanded Confirmed
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#b45309', marginTop: '4px' }}>
                        {isLoading ? '...' : stats.shortlanded}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Missing Confirmed
                    </div>
                </div>

                {/* 4. PickMe Missed */}
                <div
                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #ffcc00'; e.currentTarget.style.outlineOffset = '-2px'; }}
                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out'
                    }}
                >
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px' }}>
                        PickMe Missed
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px' }}>
                        {isLoading ? '...' : stats.pickme}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        PickMe Shortage
                    </div>
                </div>

                {/* 5. Domex Missed */}
                <div
                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #7b0f1a'; e.currentTarget.style.outlineOffset = '-2px'; }}
                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out'
                    }}
                >
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px' }}>
                        Domex Missed
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px' }}>
                        {isLoading ? '...' : stats.domex}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Domex Shortage
                    </div>
                </div>

                {/* 6. SITREK Missed */}
                <div
                    onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #0f2b6e'; e.currentTarget.style.outlineOffset = '-2px'; }}
                    onMouseOut={(e) => { e.currentTarget.style.outline = 'none'; }}
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out'
                    }}
                >
                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px' }}>
                        SITREK Missed
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px' }}>
                        {isLoading ? '...' : stats.sitrek}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        SITREK Shortage
                    </div>
                </div>
            </div>

            {/* ── RECOVERED RESULT BANNER (GREEN CONFIRMATION) ── */}
            {recoveredModal && (
                <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #bbf7d0',
                    borderLeft: '4px solid #16a34a',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    position: 'relative'
                }}>
                    <button
                        onClick={() => setRecoveredModal(null)}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        ✕
                    </button>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '8px',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6 9 17l-5-5" />
                                </svg>
                            </div>

                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#16a34a' }}>
                                        Parcel Recovered & 1st Scan Registered!
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#374151' }}>
                                        {recoveredModal.recoveredAt}
                                    </span>
                                </div>
                                <div style={{ fontSize: '12.5px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <span><strong>Tracking Number:</strong> {recoveredModal.trackingNumber}</span>
                                    {recoveredModal.parcel.bagNumber && (
                                        <span><strong>Bag:</strong> {recoveredModal.parcel.bagNumber}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Courier Partner & Zone Routing Badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            padding: '8px 14px'
                        }}>
                            <img
                                src={getPartnerLogo(recoveredModal.assignedPartner)}
                                alt={recoveredModal.assignedPartner}
                                style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                                    Courier & Zone
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                        {recoveredModal.assignedPartner}
                                    </span>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: '#fee2e2',
                                        color: '#e21b22'
                                    }}>
                                        {recoveredModal.assignedZone}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}>
                        <span>
                            ✅ <strong>Ready for 2nd Scan:</strong> Database scan status updated to <code>1ST_SCAN_DONE</code> (unsealed: true). You can now scan this parcel in <strong>LMD Verification</strong>.
                        </span>
                        {setActiveTab && (
                            <button
                                onClick={() => setActiveTab('second-scan')}
                                style={{
                                    backgroundColor: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Go to 2nd Scan →
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── MISSED PARCELS TABLE ── */}
            <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Tracking Number</th>
                                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Bag Number</th>
                                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Assigned Courier Partner</th>
                                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Status</th>
                                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Date / Time</th>
                                <th style={{ padding: '11px 16px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #d1d5db', borderTopColor: '#e21b22', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                                            <span>Loading missed parcels...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedParcels.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                                <path d="m9 12 2 2 4-4" />
                                            </svg>
                                            <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#374151' }}>
                                                No missed parcels found for this manifest / filter.
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                Select a different manifest or choose &quot;-- All Manifests --&quot;.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedParcels.map((item, idx) => {
                                    const isRecovering = recoveringIds.has(item.id || item.trackingNumber);
                                    const isRecovered = item.status === 'RECOVERED' || item.rawScanStatus === '1ST_SCAN_DONE' || item.rawScanStatus === '2ND_SCAN_DONE';
                                    const isShortlanded = item.status === 'SHORTLANDED' || item.rawScanStatus?.includes('SHORTLANDED');

                                    const displayDate = (item.updatedAt || item.createdAt)
                                        ? new Date(item.updatedAt || item.createdAt || '').toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
                                        })
                                        : '-';

                                    return (
                                        <tr
                                            key={item.id || item.trackingNumber || idx}
                                            style={{
                                                borderBottom: '1px solid #f3f4f6',
                                                backgroundColor: '#ffffff',
                                                transition: 'background-color 0.15s ease'
                                            }}
                                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                        >
                                            {/* Tracking Number */}
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontWeight: '700', color: '#111827', fontFamily: 'monospace', fontSize: '13px' }}>
                                                        {item.trackingNumber}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(item.trackingNumber);
                                                            toast.success(`Copied ${item.trackingNumber}`);
                                                        }}
                                                        title="Copy tracking number"
                                                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px' }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Bag Number */}
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    fontWeight: '600',
                                                    color: item.bagNumber && item.bagNumber !== '-' ? '#111827' : '#9ca3af',
                                                    backgroundColor: '#f3f4f6',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px'
                                                }}>
                                                    {item.bagNumber || '-'}
                                                </span>
                                            </td>

                                            {/* Assigned Partner & Zone */}
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        fontSize: '12px',
                                                        fontWeight: '700',
                                                        color: '#111827'
                                                    }}>
                                                        {item.assignedPartner}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        backgroundColor: '#fee2e2',
                                                        color: '#e21b22'
                                                    }}>
                                                        {item.assignedZone}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td style={{ padding: '12px 16px' }}>
                                                {isShortlanded ? (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        color: '#b45309',
                                                        backgroundColor: '#fef3c7',
                                                        border: '1px solid #fde68a',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#b45309' }} />
                                                        Shortlanded Confirmed
                                                    </span>
                                                ) : isRecovered ? (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        color: '#15803d',
                                                        backgroundColor: '#dcfce7',
                                                        border: '1px solid #bbf7d0',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <path d="M20 6 9 17l-5-5" />
                                                        </svg>
                                                        1st Scan Done
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: '700',
                                                        color: '#dc2626',
                                                        backgroundColor: '#fee2e2',
                                                        border: '1px solid #fecaca',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                                                        Shortage
                                                    </span>
                                                )}
                                            </td>

                                            {/* Date / Time */}
                                            <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '12px' }}>
                                                {displayDate}
                                            </td>

                                            {/* Action Buttons */}
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                {isShortlanded ? (
                                                    <span style={{ fontSize: '12px', color: '#b45309', fontWeight: '700' }}>
                                                        ✓ Shortlanded Confirmed
                                                    </span>
                                                ) : isRecovered ? (
                                                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>
                                                        ✓ Recovered
                                                    </span>
                                                ) : (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                                        {/* Mark Found & 1st Scan Button */}
                                                        <button
                                                            onClick={() => handleRecoverSingleRow(item)}
                                                            disabled={isRecovering}
                                                            title="Physically found parcel? Mark as 1st Scan Done"
                                                            style={{
                                                                backgroundColor: isRecovering ? '#9ca3af' : '#16a34a',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                padding: '5px 10px',
                                                                fontSize: '11.5px',
                                                                fontWeight: '700',
                                                                cursor: isRecovering ? 'not-allowed' : 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            {isRecovering ? (
                                                                <>
                                                                    <span style={{ display: 'inline-block', width: '9px', height: '9px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                                                                    Updating...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <path d="M20 6 9 17l-5-5" />
                                                                    </svg>
                                                                    Found Parcel (1st Scan)
                                                                </>
                                                            )}
                                                        </button>

                                                        {/* Confirm Shortlanded Button */}
                                                        <button
                                                            onClick={() => setConfirmShortlandedModal(item)}
                                                            title="Not found physically in warehouse? Confirm Shortlanded"
                                                            style={{
                                                                backgroundColor: '#fffbeb',
                                                                color: '#b45309',
                                                                border: '1px solid #fde68a',
                                                                borderRadius: '6px',
                                                                padding: '5px 10px',
                                                                fontSize: '11.5px',
                                                                fontWeight: '700',
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '5px',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <span>⚠️</span>
                                                            Confirm Shortlanded
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredParcels.length > 0 && (
                    <div style={{ padding: '8px 16px' }}>
                        <PaginationControl
                            currentPage={currentPage}
                            totalItems={filteredParcels.length}
                            rowsPerPage={rowsPerPage}
                            onPageChange={(p) => setCurrentPage(p)}
                            onRowsPerPageChange={(r) => {
                                setRowsPerPage(r);
                                setCurrentPage(1);
                            }}
                            rowsPerPageOptions={[10, 20, 50, 100]}
                        />
                    </div>
                )}
            </div>

            {/* ── CONFIRM SHORTLANDED MODAL (RED THEME) ── */}
            {confirmShortlandedModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3000,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '2px solid #e21b22',
                        borderRadius: '12px',
                        padding: '28px 24px',
                        width: '440px',
                        maxWidth: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center'
                    }}>
                        {/* Red Warning Icon */}
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#e21b22',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px'
                        }}>
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
                            Confirm Shortlanded Missing Parcel
                        </h3>

                        {/* Concise Question */}
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                            Are you sure you want to mark barcode <strong style={{ color: '#111827', fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>{confirmShortlandedModal.trackingNumber}</strong> as Shortlanded Confirmed?
                        </p>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => !isShortlanding && setConfirmShortlandedModal(null)}
                                disabled={isShortlanding}
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    color: '#374151',
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    fontSize: '13.5px',
                                    fontWeight: '600',
                                    cursor: isShortlanding ? 'not-allowed' : 'pointer',
                                    flex: 1
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleConfirmShortlanded}
                                disabled={isShortlanding}
                                style={{
                                    backgroundColor: isShortlanding ? '#9ca3af' : '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '10px 20px',
                                    fontSize: '13.5px',
                                    fontWeight: '700',
                                    cursor: isShortlanding ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    flex: 1,
                                    boxShadow: '0 2px 4px rgba(226, 27, 34, 0.25)',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { if (!isShortlanding) e.currentTarget.style.backgroundColor = '#b91c1c'; }}
                                onMouseOut={(e) => { if (!isShortlanding) e.currentTarget.style.backgroundColor = '#e21b22'; }}
                            >
                                {isShortlanding ? (
                                    <>
                                        <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                                        Updating...
                                    </>
                                ) : (
                                    'Confirm Shortlanded'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
