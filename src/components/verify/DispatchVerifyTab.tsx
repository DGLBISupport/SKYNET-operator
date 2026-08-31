'use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function DispatchVerifyTab({
    card,
    fetchVerifyDailyStats,
    label,
    setVerifyFilterTab,
    setVerifyParcelSearchQuery,
    setVerifyParcelsPage,
    setVerifySelectedDate,
    verifyDailyStats,
    verifyFilterTab,
    verifyLoadingStats,
    verifyParcelSearchQuery,
    verifyParcelsPage,
    verifyParcelsRowsPerPage,
    verifyScannedParcels,
    verifySelectedDate
}: any) {
    const [verifySortColumn, setVerifySortColumn] = React.useState<string>('secondScanTime');
    const [verifySortDirection, setVerifySortDirection] = React.useState<'asc' | 'desc'>('desc');

    const handleSort = (col: string) => {
        if (verifySortColumn === col) {
            setVerifySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setVerifySortColumn(col);
            if (col === 'firstScanTime' || col === 'secondScanTime') {
                setVerifySortDirection('desc');
            } else {
                setVerifySortDirection('asc');
            }
        }
        setVerifyParcelsPage(1);
    };

    const parseTimeToMs = (timeVal?: string | null): number => {
        if (!timeVal) return 0;
        const str = String(timeVal).trim();
        if (!str || str === '-') return 0;

        if (/^\d{10,}$/.test(str)) {
            return Number(str);
        }

        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.getTime();
        }

        const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?$/i);
        if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10) || 0;
            const s = parseInt(match[3], 10) || 0;
            const ampm = (match[4] || '').toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return h * 3600000 + m * 60000 + s * 1000;
        }

        return 0;
    };

    const renderSortableHeader = (colKey: string, title: string, width?: string) => {
        const isSorted = verifySortColumn === colKey;
        const arrow = isSorted ? (verifySortDirection === 'asc' ? '▲' : '▼') : '↕';
        return (
            <th
                onClick={() => handleSort(colKey)}
                title={`Click to sort by ${title}`}
                style={{
                    padding: '10px 10px',
                    color: isSorted ? '#b91c1c' : '#475569',
                    fontWeight: '800',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isSorted ? '#fef2f2' : 'transparent',
                    transition: 'all 0.15s ease',
                    width: width || 'auto'
                }}
            >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span>{title}</span>
                    <span style={{
                        fontSize: isSorted ? '10px' : '11px',
                        color: isSorted ? '#b91c1c' : '#94a3b8',
                        fontWeight: '900'
                    }}>
                        {arrow}
                    </span>
                </div>
            </th>
        );
    };
    return (
                        <div style={{ fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                            {/* Page Title & Subtitle Matching Screenshot Style */}
                            {/* <div style={{ marginBottom: '20px' }}>
                                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#09090b', letterSpacing: '-0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                    Dispatch Verification
                                </h1>
                                <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500', color: '#71717a', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                    View daily progress counts, unsealed 1st scan, verified 2nd scan, and partner allocations.
                                </p>
                            </div> */}

                            {/* Date Parameter Calendar Header Card */}
                            <div style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e4e4e7',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                marginBottom: '20px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '12px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)'
                            }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#09090b', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Daily Dispatch & Scan Progress Overview
                                    </h3>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#71717a', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Select date parameter below to view progress report for selected day.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#27272a', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Select Date:
                                        <input
                                            type="date"
                                            value={verifySelectedDate}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val) setVerifySelectedDate(val);
                                            }}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #e4e4e7',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                color: '#09090b',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)'
                                            }}
                                        />
                                    </label>
                                    <button
                                        onClick={() => setVerifySelectedDate(new Date().toISOString().split('T')[0])}
                                        style={{
                                            backgroundColor: verifySelectedDate === new Date().toISOString().split('T')[0] ? '#b91c1c' : '#f4f4f5',
                                            color: verifySelectedDate === new Date().toISOString().split('T')[0] ? '#ffffff' : '#27272a',
                                            border: '1px solid #e4e4e7',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            fontSize: '12.5px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)'
                                        }}
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => fetchVerifyDailyStats(verifySelectedDate)}
                                        disabled={verifyLoadingStats}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            color: '#b91c1c',
                                            border: '1px solid #b91c1c',
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            fontSize: '12.5px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)'
                                        }}
                                    >
                                        {verifyLoadingStats ? 'Loading...' : 'Refresh'}
                                    </button>
                                </div>
                            </div>

                            {/* Daily Progress Stats Cards Grid — Styled matching Parcel Operations Dashboard */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px', marginBottom: '20px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                {/* 1. Daily Total Scanned All */}
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
                                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Total Scanned (All)
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.totalScannedAll}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        For {verifySelectedDate}
                                    </div>
                                </div>

                                {/* 2. Unsealed Parcels (1st Scan Done) */}
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
                                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Unsealed (1st Scan)
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.unsealed1stScanDone}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Unsealing Floor
                                    </div>
                                </div>

                                {/* 3. Verified Parcels (2nd Scan Done) */}
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
                                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Verified (2nd Scan)
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.verified2ndScanDone}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        LMD Station
                                    </div>
                                </div>

                                {/* 4. PickMe Allocated (Scanned) */}
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
                                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        PickMe Allocated
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#ca8a04', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.pickMeScanned}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Scanned Partner
                                    </div>
                                </div>

                                {/* 5. Domex Allocated (Scanned) */}
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
                                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Domex Allocated
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#7b0f1a', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.domexScanned}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Scanned Partner
                                    </div>
                                </div>

                                {/* 6. SITREK Allocated (Scanned) */}
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
                                    <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        SITREK Allocated
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f2b6e', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : (verifyDailyStats as any).sitrekScanned || 0}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Scanned Partner
                                    </div>
                                </div>
                            </div>

                            {/* Individual Scanned Parcels Verification Table */}
                            <div style={{ ...card, marginBottom: '20px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                {/* Top Controls & Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <div style={{ ...label, marginBottom: '2px' }}>Scanned Parcels Verification Log Table</div>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                                            List of each scanned parcel record for {verifySelectedDate} with Inbound & Outbound Manifest details, scan timestamps, and operator logs
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            placeholder="Search Tracking No, MAWB, Operator, Manifest..."
                                            value={verifyParcelSearchQuery}
                                            onChange={(e) => {
                                                setVerifyParcelSearchQuery(e.target.value);
                                                setVerifyParcelsPage(1);
                                            }}
                                            style={{
                                                padding: '7px 12px',
                                                fontSize: '12px',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                width: '270px',
                                                outline: 'none'
                                            }}
                                        />

                                        {/* Sort By Dropdown */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>Sort:</span>
                                            <select
                                                value={`${verifySortColumn}-${verifySortDirection}`}
                                                onChange={(e) => {
                                                    const [col, dir] = e.target.value.split('-');
                                                    setVerifySortColumn(col);
                                                    setVerifySortDirection(dir as 'asc' | 'desc');
                                                    setVerifyParcelsPage(1);
                                                }}
                                                style={{
                                                    padding: '6px 10px',
                                                    fontSize: '11.5px',
                                                    fontWeight: '600',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#ffffff',
                                                    color: '#0f172a',
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="secondScanTime-desc">2nd Scan Time (Latest First ⬇)</option>
                                                <option value="secondScanTime-asc">2nd Scan Time (Oldest First ⬆)</option>
                                                <option value="firstScanTime-desc">1st Scan Time (Latest First ⬇)</option>
                                                <option value="firstScanTime-asc">1st Scan Time (Oldest First ⬆)</option>
                                                <option value="trackingNumber-asc">Tracking No. (A - Z)</option>
                                                <option value="trackingNumber-desc">Tracking No. (Z - A)</option>
                                                <option value="serviceProvider-asc">Allocated Courier (A - Z)</option>
                                                <option value="inboundMawb-asc">Inbound MAWB (A - Z)</option>
                                            </select>
                                        </div>

                                        {/* Partner & Scan Filter Tabs */}
                                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                                            {(['ALL', 'UNSEALED', 'VERIFIED', 'PICKME', 'DOMEX', 'SITREK'] as const).map(tabKey => {
                                                const active = verifyFilterTab === tabKey;
                                                let activeBg = '#ffffff';
                                                let activeColor = '#b91c1c';
                                                if (active) {
                                                    if (tabKey === 'PICKME') {
                                                        activeBg = '#ffcc00';
                                                        activeColor = '#000000';
                                                    } else if (tabKey === 'DOMEX') {
                                                        activeBg = '#7b0f1a';
                                                        activeColor = '#ffffff';
                                                    } else if (tabKey === 'SITREK') {
                                                        activeBg = '#0f2b6e';
                                                        activeColor = '#ffffff';
                                                    } else if (tabKey === 'UNSEALED') {
                                                        activeBg = '#0284c7';
                                                        activeColor = '#ffffff';
                                                    } else if (tabKey === 'VERIFIED') {
                                                        activeBg = '#16a34a';
                                                        activeColor = '#ffffff';
                                                    }
                                                }
                                                return (
                                                    <button
                                                        key={tabKey}
                                                        onClick={() => { setVerifyFilterTab(tabKey); setVerifyParcelsPage(1); }}
                                                        style={{
                                                            padding: '5px 10px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            backgroundColor: active ? activeBg : 'transparent',
                                                            color: active ? activeColor : '#475569',
                                                            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {tabKey === 'ALL' ? 'ALL' : tabKey === 'UNSEALED' ? 'Unsealed' : tabKey === 'VERIFIED' ? 'Verified' : tabKey}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', width: '45px' }}>#</th>
                                                {renderSortableHeader('trackingNumber', 'Parcel Tracking No.')}
                                                {renderSortableHeader('inboundMawb', 'Inbound MAWB Ref')}
                                                {renderSortableHeader('outboundBag', 'Outbound Bag')}
                                                {renderSortableHeader('outboundManifest', 'Outbound Manifest')}
                                                {renderSortableHeader('firstScanTime', '1st Scan Time')}
                                                {renderSortableHeader('firstScannedBy', '1st Scanned By')}
                                                {renderSortableHeader('secondScanTime', '2nd Scan Time')}
                                                {renderSortableHeader('secondScannedBy', '2nd Scanned By')}
                                                {renderSortableHeader('serviceProvider', 'Allocated Courier')}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const formatScanTime = (isoString?: string | null) => {
                                                    if (!isoString) return '-';
                                                    try {
                                                        const str = String(isoString).trim();
                                                        if (!str || str === '-') return '-';
                                                        if (/^\d{1,2}:\d{2}(:\d{2})?\s?[AP]M$/i.test(str)) {
                                                            return str.toUpperCase();
                                                        }
                                                        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
                                                            const parts = str.split(':');
                                                            let h = parseInt(parts[0], 10);
                                                            const m = parts[1] || '00';
                                                            const s = parts[2] ? `:${parts[2]}` : ':00';
                                                            const ampm = h >= 12 ? 'PM' : 'AM';
                                                            h = h % 12;
                                                            h = h ? h : 12;
                                                            const hh = h < 10 ? `0${h}` : `${h}`;
                                                            return `${hh}:${m}${s} ${ampm}`;
                                                        }
                                                        if (/^\d{10,}$/.test(str)) {
                                                            const d = new Date(Number(str));
                                                            if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                                                        }
                                                        const d = new Date(str);
                                                        if (isNaN(d.getTime())) return str;
                                                        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                                                    } catch {
                                                        return String(isoString);
                                                    }
                                                };

                                                const getCourierBadgeStyle = (partnerStr?: string | null) => {
                                                    const p = (partnerStr || '').toLowerCase().trim();
                                                    if (p.includes('pickme') || p === '1') {
                                                        return { bg: '#ffcc00', color: '#000000', label: 'PickMe' };
                                                    }
                                                    if (p.includes('domex') || p === '2') {
                                                        return { bg: '#7b0f1a', color: '#ffffff', label: 'Domex' };
                                                    }
                                                    if (p.includes('sitrek') || p === '3') {
                                                        return { bg: '#0f2b6e', color: '#ffffff', label: 'SITREK' };
                                                    }
                                                    if (p.includes('pronto') || p === '4') {
                                                        return { bg: '#ea580c', color: '#ffffff', label: 'Pronto' };
                                                    }
                                                    return { bg: '#6b7280', color: '#ffffff', label: partnerStr || 'Unassigned' };
                                                };

                                                const filtered = verifyScannedParcels.filter((p: any) => {
                                                    // Search filter
                                                    if (verifyParcelSearchQuery.trim()) {
                                                        const q = verifyParcelSearchQuery.toLowerCase();
                                                        const matches = (p.trackingNumber || '').toLowerCase().includes(q) ||
                                                            (p.senderReference || p.temuBarcode || '').toLowerCase().includes(q) ||
                                                            (p.inboundMawb || '').toLowerCase().includes(q) ||
                                                            (p.outboundBag || '').toLowerCase().includes(q) ||
                                                            (p.outboundManifest || '').toLowerCase().includes(q) ||
                                                            (p.serviceProvider || '').toLowerCase().includes(q) ||
                                                            (p.firstScannedBy || '').toLowerCase().includes(q) ||
                                                            (p.secondScannedBy || '').toLowerCase().includes(q) ||
                                                            (p.scannedBy || '').toLowerCase().includes(q);
                                                        if (!matches) return false;
                                                    }
                                                    // Tab filter
                                                    if (verifyFilterTab === 'UNSEALED') return p.unsealed;
                                                    if (verifyFilterTab === 'VERIFIED') return p.verified;
                                                    if (verifyFilterTab === 'PICKME') return (p.serviceProvider || '').toLowerCase() === 'pickme';
                                                    if (verifyFilterTab === 'DOMEX') return (p.serviceProvider || '').toLowerCase() === 'domex';
                                                    if (verifyFilterTab === 'SITREK') return (p.serviceProvider || '').toLowerCase() === 'sitrek';
                                                    return true;
                                                });

                                                // Sort the filtered results
                                                const sorted = [...filtered].sort((a: any, b: any) => {
                                                    if (verifySortColumn === 'firstScanTime') {
                                                        const tA = parseTimeToMs(a.firstScanTime);
                                                        const tB = parseTimeToMs(b.firstScanTime);
                                                        if (!tA && !tB) return 0;
                                                        if (!tA) return 1;
                                                        if (!tB) return -1;
                                                        return verifySortDirection === 'asc' ? tA - tB : tB - tA;
                                                    }
                                                    if (verifySortColumn === 'secondScanTime') {
                                                        const tA = parseTimeToMs(a.secondScanTime);
                                                        const tB = parseTimeToMs(b.secondScanTime);
                                                        if (!tA && !tB) return 0;
                                                        if (!tA) return 1;
                                                        if (!tB) return -1;
                                                        return verifySortDirection === 'asc' ? tA - tB : tB - tA;
                                                    }
                                                    if (verifySortColumn === 'trackingNumber') {
                                                        const valA = (a.trackingNumber || '').toLowerCase();
                                                        const valB = (b.trackingNumber || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    if (verifySortColumn === 'inboundMawb') {
                                                        const valA = (a.inboundMawb || '').toLowerCase();
                                                        const valB = (b.inboundMawb || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    if (verifySortColumn === 'outboundBag') {
                                                        const valA = (a.outboundBag || '').toLowerCase();
                                                        const valB = (b.outboundBag || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    if (verifySortColumn === 'outboundManifest') {
                                                        const valA = (a.outboundManifest || '').toLowerCase();
                                                        const valB = (b.outboundManifest || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    if (verifySortColumn === 'firstScannedBy') {
                                                        const valA = (a.firstScannedBy || '').toLowerCase();
                                                        const valB = (b.firstScannedBy || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    if (verifySortColumn === 'secondScannedBy') {
                                                        const valA = (a.secondScannedBy || '').toLowerCase();
                                                        const valB = (b.secondScannedBy || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    if (verifySortColumn === 'serviceProvider') {
                                                        const valA = (a.serviceProvider || '').toLowerCase();
                                                        const valB = (b.serviceProvider || '').toLowerCase();
                                                        return verifySortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                                    }
                                                    return 0;
                                                });

                                                if (verifyLoadingStats) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                                                Loading scanned parcel details...
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                if (sorted.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                                No scanned parcel records found for {verifySelectedDate}.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                const totalPages = Math.ceil(sorted.length / verifyParcelsRowsPerPage);
                                                const page = Math.min(verifyParcelsPage, totalPages || 1);
                                                const startIndex = (page - 1) * verifyParcelsRowsPerPage;
                                                const visibleRows = sorted.slice(startIndex, startIndex + verifyParcelsRowsPerPage);

                                                return (
                                                    <>
                                                        {visibleRows.map((parcel: any, idx: number) => {
                                                            const rowNo = startIndex + idx + 1;
                                                            const courierBadge = getCourierBadgeStyle(parcel.serviceProvider);
                                                            return (
                                                                <tr key={parcel.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                                    <td style={{ padding: '9px 10px', color: '#1e293b', fontSize: '12px', fontWeight: '600' }}>{rowNo}</td>
                                                                    <td style={{ padding: '9px 10px', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', fontSize: '12.5px' }}>
                                                                        <div>{parcel.trackingNumber}</div>
                                                                        {(parcel.senderReference || parcel.temuBarcode) && (parcel.senderReference || parcel.temuBarcode)!.trim().toLowerCase() !== parcel.trackingNumber.trim().toLowerCase() && (
                                                                            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '500', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                                                                Temu: {parcel.senderReference || parcel.temuBarcode}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', fontWeight: '600', color: '#0f172a' }}>
                                                                        {parcel.inboundMawb}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', fontWeight: '600', color: '#0f172a' }}>
                                                                        {parcel.outboundBag || 'Pending Bag'}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', fontWeight: '600', color: '#0f172a' }}>
                                                                        {parcel.outboundManifest || 'Pending Manifest'}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', color: '#0f172a', fontSize: '12px' }}>
                                                                        {parcel.firstScanTime ? (
                                                                            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
                                                                                {formatScanTime(parcel.firstScanTime)}
                                                                            </span>
                                                                        ) : parcel.unsealed ? (
                                                                            <span style={{ color: '#0369a1', fontWeight: '600', fontSize: '11.5px' }}>Unsealed</span>
                                                                        ) : (
                                                                            <span style={{ color: '#94a3b8' }}>-</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', color: '#334155', fontSize: '12px', fontWeight: '600' }}>
                                                                        {parcel.firstScannedBy ? (
                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>👤</span> {parcel.firstScannedBy}
                                                                            </span>
                                                                        ) : parcel.unsealed ? (
                                                                            <span style={{ color: '#64748b' }}>Staff</span>
                                                                        ) : (
                                                                            <span style={{ color: '#94a3b8' }}>-</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', color: '#0f172a', fontSize: '12px' }}>
                                                                        {parcel.secondScanTime ? (
                                                                            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
                                                                                {formatScanTime(parcel.secondScanTime)}
                                                                            </span>
                                                                        ) : parcel.verified ? (
                                                                            <span style={{ color: '#15803d', fontWeight: '600', fontSize: '11.5px' }}>Verified</span>
                                                                        ) : (
                                                                            <span style={{ color: '#d97706', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>Pending</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', color: '#334155', fontSize: '12px', fontWeight: '600' }}>
                                                                        {parcel.secondScannedBy ? (
                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>👤</span> {parcel.secondScannedBy}
                                                                            </span>
                                                                        ) : parcel.verified ? (
                                                                            <span style={{ color: '#64748b' }}>Staff</span>
                                                                        ) : (
                                                                            <span style={{ color: '#94a3b8' }}>-</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px' }}>
                                                                        <span style={{
                                                                            backgroundColor: courierBadge.bg,
                                                                            color: courierBadge.color,
                                                                            padding: '4px 9px',
                                                                            borderRadius: '4px',
                                                                            fontSize: '11px',
                                                                            fontWeight: '700',
                                                                            textTransform: 'uppercase',
                                                                            display: 'inline-block',
                                                                            letterSpacing: '0.4px',
                                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                                                                        }}>
                                                                            {courierBadge.label}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}

                                                        {/* Pagination Footer */}
                                                        <tr>
                                                            <td colSpan={10} style={{ padding: '12px 10px', borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '600' }}>
                                                                        Showing {startIndex + 1} - {Math.min(startIndex + verifyParcelsRowsPerPage, sorted.length)} of {sorted.length} scanned parcels
                                                                    </span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <button
                                                                            onClick={() => setVerifyParcelsPage((prev: number) => Math.max(prev - 1, 1))}
                                                                            disabled={page <= 1}
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                fontSize: '11.5px',
                                                                                fontWeight: '700',
                                                                                border: '1px solid #cbd5e1',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: page <= 1 ? '#f1f5f9' : '#ffffff',
                                                                                color: page <= 1 ? '#94a3b8' : '#1e293b',
                                                                                cursor: page <= 1 ? 'not-allowed' : 'pointer'
                                                                            }}
                                                                        >
                                                                            Previous
                                                                        </button>
                                                                        <span style={{ fontSize: '11.5px', color: '#334155', fontWeight: '700' }}>
                                                                            Page {page} of {totalPages || 1}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => setVerifyParcelsPage((prev: number) => Math.min(prev + 1, totalPages))}
                                                                            disabled={page >= totalPages}
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                fontSize: '11.5px',
                                                                                fontWeight: '700',
                                                                                border: '1px solid #cbd5e1',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: page >= totalPages ? '#f1f5f9' : '#ffffff',
                                                                                color: page >= totalPages ? '#94a3b8' : '#1e293b',
                                                                                cursor: page >= totalPages ? 'not-allowed' : 'pointer'
                                                                            }}
                                                                        >
                                                                            Next
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
    );
}
