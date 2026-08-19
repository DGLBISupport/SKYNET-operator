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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '20px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
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
                                        PickMe Allocated
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.pickMeScanned}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        Scanned Partner
                                    </div>
                                </div>

                                {/* 5. Domex Allocated (Scanned) */}
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
                                        Domex Allocated
                                    </div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#991b1b', marginTop: '4px', fontFamily: 'var(--font-sans, "Inter", "Inter Fallback", sans-serif)' }}>
                                        {verifyLoadingStats ? '...' : verifyDailyStats.domexScanned}
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
                                            List of each scanned parcel record for {verifySelectedDate} with Inbound & Outbound Manifest details
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            placeholder="Search Tracking No, MAWB, Outbound Manifest..."
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
                                                width: '280px',
                                                outline: 'none'
                                            }}
                                        />
                                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                                            {(['ALL', 'UNSEALED', 'VERIFIED', 'PICKME', 'DOMEX'] as const).map(tabKey => {
                                                const active = verifyFilterTab === tabKey;
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
                                                            backgroundColor: active ? '#ffffff' : 'transparent',
                                                            color: active ? '#b91c1c' : '#475569',
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
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Parcel Tracking No.</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Inbound Manifest (MAWB Ref)</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Outbound Bag</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Outbound Manifest</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>1st Scan (Unsealed)</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>2nd Scan (Verified)</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Allocated Courier</th>
                                                <th style={{ padding: '10px 10px', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Scan Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const filtered = verifyScannedParcels.filter(p => {
                                                    // Search filter
                                                    if (verifyParcelSearchQuery.trim()) {
                                                        const q = verifyParcelSearchQuery.toLowerCase();
                                                        const matches = (p.trackingNumber || '').toLowerCase().includes(q) ||
                                                            (p.senderReference || p.temuBarcode || '').toLowerCase().includes(q) ||
                                                            (p.inboundMawb || '').toLowerCase().includes(q) ||
                                                            (p.outboundBag || '').toLowerCase().includes(q) ||
                                                            (p.outboundManifest || '').toLowerCase().includes(q) ||
                                                            (p.serviceProvider || '').toLowerCase().includes(q);
                                                        if (!matches) return false;
                                                    }
                                                    // Tab filter
                                                    if (verifyFilterTab === 'UNSEALED') return p.unsealed;
                                                    if (verifyFilterTab === 'VERIFIED') return p.verified;
                                                    if (verifyFilterTab === 'PICKME') return (p.serviceProvider || '').toLowerCase() === 'pickme';
                                                    if (verifyFilterTab === 'DOMEX') return (p.serviceProvider || '').toLowerCase() === 'domex';
                                                    return true;
                                                });

                                                if (verifyLoadingStats) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                                                Loading scanned parcel details...
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                if (filtered.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                                No scanned parcel records found for {verifySelectedDate}.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                const totalPages = Math.ceil(filtered.length / verifyParcelsRowsPerPage);
                                                const page = Math.min(verifyParcelsPage, totalPages || 1);
                                                const startIndex = (page - 1) * verifyParcelsRowsPerPage;
                                                const visibleRows = filtered.slice(startIndex, startIndex + verifyParcelsRowsPerPage);

                                                return (
                                                    <>
                                                        {visibleRows.map((parcel, idx) => {
                                                            const rowNo = startIndex + idx + 1;
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
                                                                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                                                                        {parcel.unsealed ? 'Unsealed' : '-'}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#0f172a', fontWeight: '600' }}>
                                                                        {parcel.verified ? 'Verified (2nd)' : 'Pending'}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', fontWeight: '700', color: '#0f172a' }}>
                                                                        {parcel.serviceProvider}
                                                                    </td>
                                                                    <td style={{ padding: '9px 10px', color: '#0f172a', fontSize: '12px' }}>
                                                                        {parcel.scannedAt ? new Date(parcel.scannedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}

                                                        {/* Pagination Footer */}
                                                        <tr>
                                                            <td colSpan={9} style={{ padding: '12px 10px', borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                                    <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '600' }}>
                                                                        Showing {startIndex + 1} - {Math.min(startIndex + verifyParcelsRowsPerPage, filtered.length)} of {filtered.length} scanned parcels
                                                                    </span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <button
                                                                            onClick={() => setVerifyParcelsPage(prev => Math.max(prev - 1, 1))}
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
                                                                            onClick={() => setVerifyParcelsPage(prev => Math.min(prev + 1, totalPages))}
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
