'use client';
import React from 'react';

// ── Excel Export Helper ──────────────────────────────────────────────────────
interface ExportMeta { reportTitle: string; mawb: string; partner: string; totalRecords: number; }
function exportToExcel(headers: string[], rows: (string | number)[][], filename: string, meta: ExportMeta) {
    const escape = (val: any) => {
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
    };
    // ── Filter summary block prepended to the top of the sheet ──
    const metaRows = [
        [`SKYNET PARCEL OPERATIONS — ${meta.reportTitle.toUpperCase()}`],
        [`Generated At:,${new Date().toLocaleString('en-GB')}`],
        [`MAWB / Manifest Filter:,${meta.mawb}`],
        [`Courier Partner Filter:,${meta.partner}`],
        [`Total Records Exported:,${meta.totalRecords}`],
        [],   // blank spacer row
    ];
    const csvContent = [
        ...metaRows.map(r => r.map(escape).join(',')),
        headers.map(escape).join(','),
        ...rows.map(row => row.map(escape).join(','))
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
import PaginationControl from '@/app/components/PaginationControl';

export default function DashboardTab({
    btnPrimary,
    card,
    dashMawbFilter,
    dashPartnerFilter,
    dashSearchQuery,
    dashTablePage,
    dashTableRowsPerPage,
    dashboardData,
    dashboardSubTab,
    fetchDashboard,
    isLoadingDashboard,
    label,
    setDashMawbFilter,
    setDashPartnerFilter,
    setDashSearchQuery,
    setDashTablePage,
    setDashTableRowsPerPage,
    setDashboardSubTab,
    status,
    usersList
}: any) {
    const todayStr = React.useMemo(() => {
        try {
            return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
        } catch {
            return new Date().toISOString().split('T')[0];
        }
    }, []);

    const [prodDateFilter, setProdDateFilter] = React.useState<string>(todayStr);
    const [prodSearchQuery, setProdSearchQuery] = React.useState<string>('');
    const [prodActiveOnly, setProdActiveOnly] = React.useState<boolean>(false);
    const [prodSortColumn, setProdSortColumn] = React.useState<string>('totalScans');
    const [prodSortDirection, setProdSortDirection] = React.useState<'asc' | 'desc'>('desc');
    const [prodPage, setProdPage] = React.useState<number>(1);
    const [prodRowsPerPage, setProdRowsPerPage] = React.useState<number>(10);

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr || dateStr === 'ALL') return 'All Time Performance (Lifetime)';
        try {
            const d = new Date(`${dateStr}T00:00:00`);
            if (isNaN(d.getTime())) return dateStr;
            const options: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
            const isToday = dateStr === todayStr;
            return `${isToday ? 'Today, ' : ''}${d.toLocaleDateString('en-GB', options)}`;
        } catch {
            return dateStr;
        }
    };

    return (
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

                const mawbMetaMap: Record<string, { carrier: string; declaredBags: number }> = {};
                const availableMawbsSet = new Set<string>();
                (dashboardData.mawbTableList || []).forEach((m: any) => {
                    if (isValidMawbRef(m.mawbReference)) {
                        const ref = m.mawbReference.trim();
                        availableMawbsSet.add(ref);
                        mawbMetaMap[ref] = {
                            carrier: m.carrier || 'Unknown Carrier',
                            declaredBags: m.declaredBags || 0
                        };
                    }
                });
                const availableMawbsList = Array.from(availableMawbsSet).sort();

                // 2. Filter datasets based on dashMawbFilter
                const activeMawb = dashMawbFilter || (availableMawbsList.length > 0 ? availableMawbsList[0] : 'ALL');

                const filteredParcels = (dashboardData.receivedParcels || []).filter((p: any) => {
                    if (activeMawb && activeMawb !== 'ALL' && String(p.mawbReference || '').toUpperCase() !== activeMawb.toUpperCase()) return false;
                    return true;
                });
                const totalRec = filteredParcels.length;
                const totalSort = filteredParcels.filter((p: any) => p.isSorted).length;
                const pendingParc = totalRec - totalSort;

                const filteredBags = (dashboardData.bagsList || []).filter((b: any) => {
                    if (activeMawb && activeMawb !== 'ALL' && String(b.mawbRef || '').toUpperCase() !== activeMawb.toUpperCase()) return false;
                    return true;
                });
                const totalBags = filteredBags.length;
                const openBags = filteredBags.filter((b: any) => b.status !== 'SEALED' && b.status !== 'CLOSED').length;
                const sealedBags = filteredBags.filter((b: any) => b.status === 'SEALED' || b.status === 'CLOSED').length;

                const filteredManifests = (dashboardData.manifestsList || []).filter((m: any) => {
                    if (activeMawb && activeMawb !== 'ALL' && String(m.mawbRef || m.manifestId || '').toUpperCase() !== activeMawb.toUpperCase()) return false;
                    return true;
                });
                const totalMan = filteredManifests.length;
                const openMan = filteredManifests.filter((m: any) => String(m.status).toUpperCase() !== 'CLOSED').length;
                const closedMan = filteredManifests.filter((m: any) => String(m.status).toUpperCase() === 'CLOSED').length;

                const filteredExceptions = (dashboardData.exceptionsList || []).filter((e: any) => {
                    if (activeMawb && activeMawb !== 'ALL') {
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
                                        Available Manifest :
                                    </div>
                                    <select
                                        value={activeMawb}
                                        onChange={e => setDashMawbFilter(e.target.value)}
                                        style={{
                                            padding: '8px 14px',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            borderRadius: '6px',
                                            border: '1px solid #cacccf',
                                            color: '#111827',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            minWidth: '280px'
                                        }}
                                    >
                                        <option value="ALL">All Inbound Manifests ({availableMawbsList.length})</option>
                                        {availableMawbsList.map(mawb => (
                                            <option key={mawb} value={mawb}>
                                                {mawb} ({mawbMetaMap[mawb]?.carrier || 'Unknown Carrier'} - Declared Bags: {mawbMetaMap[mawb]?.declaredBags || 0})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* KPI Cards — only for Parcel Operations view */}
                        {dashboardSubTab !== 'productivity' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
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

                                {/* Card 4: Exceptions */}
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
                        {['total_received', 'parcels_sorted', 'pending_parcels', 'exceptions'].includes(dashboardSubTab) && (
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
                                    value={dashMawbFilter || 'ALL'}
                                    onChange={e => setDashMawbFilter(e.target.value)}
                                    style={{
                                        flexShrink: 0,
                                        boxSizing: 'border-box',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        borderRadius: '6px',
                                        border: '1px solid #cacccf',
                                        color: '#111827',
                                        minWidth: '220px'
                                    }}
                                >
                                    <option value="ALL">All Manifests (MAWBs)</option>
                                    {availableMawbsList.map(mawb => (
                                        <option key={mawb} value={mawb}>
                                            {mawb} ({mawbMetaMap[mawb]?.carrier || 'Unknown Carrier'} - Declared Bags: {mawbMetaMap[mawb]?.declaredBags || 0})
                                        </option>
                                    ))}
                                </select>

                                {['total_received', 'parcels_sorted', 'pending_parcels'].includes(dashboardSubTab) && (
                                    <select
                                        value={dashPartnerFilter}
                                        onChange={e => setDashPartnerFilter(e.target.value)}
                                        style={{ flexShrink: 0, boxSizing: 'border-box', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', minWidth: '140px' }}
                                    >
                                        <option value="ALL">All Partners</option>
                                        <option value="PickMe">PickMe</option>
                                        <option value="Domex">Domex</option>
                                        <option value="SITREK">SITREK</option>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={label}>Total Received Inbound Parcels</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            Total Received: <strong>{totalRec} parcels</strong>
                                        </div>
                                        {(() => {
                                            const exportList = filteredParcels.filter((p: any) => {
                                                const q = dashSearchQuery.toLowerCase();
                                                const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.mawbReference && p.mawbReference.toLowerCase().includes(q));
                                                const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                return matchQ && matchP;
                                            });
                                            const partnerSuffix = dashPartnerFilter !== 'ALL' ? `_${dashPartnerFilter}` : '_AllPartners';
                                            const searchSuffix = dashSearchQuery ? `_Search-${dashSearchQuery.replace(/[^a-zA-Z0-9]/g, '')}` : '';
                                            return (
                                                <button
                                                     onClick={() => {
                                                        // Force Excel to treat long numeric strings as text (prevents scientific notation)
                                                        const txt = (v: any) => v != null && v !== '' ? `="${String(v)}"` : '-';
                                                        // Only append 'g' if weight has no existing unit (e.g. keep '10270 kg' as-is, convert bare '499' to '499g')
                                                        const fmtW = (v: any) => {
                                                            if (v == null || v === '') return '-';
                                                            const s = String(v).trim();
                                                            if (/[a-zA-Z]/.test(s)) return s; // already has a unit — keep as-is
                                                            const n = s.replace(/[^0-9.]/g, '').trim();
                                                            return n ? `${n}g` : '-';
                                                        };
                                                        exportToExcel(
                                                        ['#', 'Parcel Reference', 'Temu Barcode', 'Courier Partner', 'Weight (g)', 'Allocation Status', 'Received Date'],
                                                        exportList.map((p: any, i: number) => [
                                                            i + 1,
                                                            txt(p.referenceNumber),
                                                            txt(p.senderReference),
                                                            p.deliveryAgentCode,
                                                            fmtW(p.weight),
                                                            p.allocationStage === '2ND_SCAN_DONE' ? '2nd Scan Done' : p.allocationStage === '1ST_SCAN_DONE' ? '1st Scan Done' : 'Pending 1st Scan',
                                                            p.createdAt && !isNaN(new Date(p.createdAt).getTime()) ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'
                                                        ]),
                                                        `Total_Received${partnerSuffix}${searchSuffix}_${activeMawb}_${new Date().toISOString().slice(0, 10)}.csv`,
                                                        {
                                                            reportTitle: 'Total Received Inbound Parcels',
                                                            mawb: activeMawb,
                                                            partner: dashPartnerFilter === 'ALL' ? 'All Partners' : dashPartnerFilter,
                                                            totalRecords: exportList.length
                                                        }
                                                        );
                                                    }}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        backgroundColor: '#16a34a', color: '#ffffff',
                                                        border: 'none', borderRadius: '6px',
                                                        padding: '7px 14px', fontSize: '12px', fontWeight: '700',
                                                        cursor: 'pointer', whiteSpace: 'nowrap',
                                                        boxShadow: '0 1px 4px rgba(22,163,74,0.25)',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#15803d')}
                                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                                    title={`Export ${exportList.length} records — Partner: ${dashPartnerFilter}, MAWB: ${activeMawb}`}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                        <polyline points="7 10 12 15 17 10"/>
                                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                                    </svg>
                                                    Export Excel ({exportList.length})
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {(() => {
                                    const list = filteredParcels.filter((p: any) => {
                                        const q = dashSearchQuery.toLowerCase();
                                        const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.mawbReference && p.mawbReference.toLowerCase().includes(q));
                                        const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                        return matchQ && matchP;
                                    });
                                    const paginatedList = list.slice((dashTablePage - 1) * dashTableRowsPerPage, dashTablePage * dashTableRowsPerPage);
                                    return (
                                        <>
                                            {list.length > 0 ? (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                {['#', 'Parcel Reference', 'Temu Barcode', 'Courier Partner', 'Weight', 'Allocation Status', 'Received Date'].map(h => (
                                                                    <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {paginatedList.map((p: any, idx: number) => {
                                                                const globalIdx = (dashTablePage - 1) * dashTableRowsPerPage + idx + 1;
                                                                return (
                                                                    <tr key={`rec-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{globalIdx}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>{p.senderReference}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', backgroundColor: p.deliveryAgentCode === 'PickMe' ? '#facc15' : p.deliveryAgentCode === 'Domex' ? '#7b0f1a' : p.deliveryAgentCode === 'Pronto' ? '#ea580c' : '#6b7280', color: p.deliveryAgentCode === 'PickMe' ? '#000000' : '#ffffff' }}>
                                                                                {p.deliveryAgentCode}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.weight}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            {p.allocationStage === '2ND_SCAN_DONE' ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#b91c1c', border: '1px solid #b91c1c' }}>
                                                                                    2nd Scan Done
                                                                                </span>
                                                                            ) : p.allocationStage === '1ST_SCAN_DONE' ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#b91c1c', border: '1px solid #b91c1c' }}>
                                                                                    1st Scan Done
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#6b7280', border: '1px solid #9ca3af' }}>
                                                                                    Pending 1st Scan
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>
                                                                            {p.createdAt && !isNaN(new Date(p.createdAt).getTime()) ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No received parcels found matching your criteria.</div>
                                            )}
                                            <PaginationControl
                                                currentPage={dashTablePage}
                                                totalItems={list.length}
                                                rowsPerPage={dashTableRowsPerPage}
                                                onPageChange={(page) => setDashTablePage(page)}
                                                onRowsPerPageChange={(rows) => setDashTableRowsPerPage(rows)}
                                            />
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 2: PARCELS SORTED (ALLOCATED IN BAGS)
                                    ═══════════════════════════════════════════════════════ */}
                        {dashboardSubTab === 'parcels_sorted' && (
                            <div style={card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={label}>Parcels Sorted & Allocated in Outbound Bags</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            Total Allocated: <strong>{totalSort} parcels</strong>
                                        </div>
                                        {(() => {
                                            const exportList = filteredParcels.filter((p: any) => p.isSorted).filter((p: any) => {
                                                const q = dashSearchQuery.toLowerCase();
                                                const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.bagNumber && p.bagNumber.toLowerCase().includes(q));
                                                const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                return matchQ && matchP;
                                            });
                                            const partnerSuffix = dashPartnerFilter !== 'ALL' ? `_${dashPartnerFilter}` : '_AllPartners';
                                            const searchSuffix = dashSearchQuery ? `_Search-${dashSearchQuery.replace(/[^a-zA-Z0-9]/g, '')}` : '';
                                            return (
                                                <button
                                                    onClick={() => {
                                                        const txt = (v: any) => v != null && v !== '' ? `="${String(v)}"` : '-';
                                                        const fmtW = (v: any) => {
                                                            if (v == null || v === '') return '-';
                                                            const s = String(v).trim();
                                                            if (/[a-zA-Z]/.test(s)) return s;
                                                            const n = s.replace(/[^0-9.]/g, '').trim();
                                                            return n ? `${n}g` : '-';
                                                        };
                                                        exportToExcel(
                                                        ['#', 'Parcel Reference', 'Temu Barcode', 'Assigned Bag #', 'Courier Partner', 'Weight (g)', 'Allocation Status', 'Received Date'],
                                                        exportList.map((p: any, i: number) => [
                                                            i + 1,
                                                            txt(p.referenceNumber),
                                                            txt(p.senderReference),
                                                            txt(p.bagNumber || 'Allocated'),
                                                            p.deliveryAgentCode,
                                                            fmtW(p.weight),
                                                            p.allocationStage === '2ND_SCAN_DONE' ? '2nd Scan Done' : '1st Scan Done',
                                                            p.createdAt && !isNaN(new Date(p.createdAt).getTime()) ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'
                                                        ]),
                                                        `Parcels_Sorted${partnerSuffix}${searchSuffix}_${activeMawb}_${new Date().toISOString().slice(0, 10)}.csv`,
                                                        {
                                                            reportTitle: 'Parcels Sorted & Allocated in Outbound Bags',
                                                            mawb: activeMawb,
                                                            partner: dashPartnerFilter === 'ALL' ? 'All Partners' : dashPartnerFilter,
                                                            totalRecords: exportList.length
                                                        }
                                                        );
                                                    }}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        backgroundColor: '#16a34a', color: '#ffffff',
                                                        border: 'none', borderRadius: '6px',
                                                        padding: '7px 14px', fontSize: '12px', fontWeight: '700',
                                                        cursor: 'pointer', whiteSpace: 'nowrap',
                                                        boxShadow: '0 1px 4px rgba(22,163,74,0.25)',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#15803d')}
                                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                                    title={`Export ${exportList.length} records — Partner: ${dashPartnerFilter}, MAWB: ${activeMawb}`}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                        <polyline points="7 10 12 15 17 10"/>
                                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                                    </svg>
                                                    Export Excel ({exportList.length})
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {(() => {
                                    const list = filteredParcels.filter((p: any) => p.isSorted).filter((p: any) => {
                                        const q = dashSearchQuery.toLowerCase();
                                        const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q) || (p.bagNumber && p.bagNumber.toLowerCase().includes(q));
                                        const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                        return matchQ && matchP;
                                    });
                                    const paginatedList = list.slice((dashTablePage - 1) * dashTableRowsPerPage, dashTablePage * dashTableRowsPerPage);
                                    return (
                                        <>
                                            {list.length > 0 ? (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                {['#', 'Parcel Reference', 'Temu Barcode', 'Assigned Bag #', 'Courier Partner', 'Weight', 'Allocation Status', 'Received Date'].map(h => (
                                                                    <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {paginatedList.map((p: any, idx: number) => {
                                                                const globalIdx = (dashTablePage - 1) * dashTableRowsPerPage + idx + 1;
                                                                return (
                                                                    <tr key={`sorted-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{globalIdx}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>{p.senderReference}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>
                                                                            {p.bagNumber || 'Allocated'}
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', backgroundColor: p.deliveryAgentCode === 'PickMe' ? '#facc15' : p.deliveryAgentCode === 'Domex' ? '#7b0f1a' : p.deliveryAgentCode === 'Pronto' ? '#ea580c' : '#6b7280', color: p.deliveryAgentCode === 'PickMe' ? '#000000' : '#ffffff' }}>
                                                                                {p.deliveryAgentCode}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.weight}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            {p.allocationStage === '2ND_SCAN_DONE' ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#b91c1c', border: '1px solid #b91c1c' }}>
                                                                                    2nd Scan Done
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#b91c1c', border: '1px solid #b91c1c' }}>
                                                                                    1st Scan Done
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>
                                                                            {p.createdAt && !isNaN(new Date(p.createdAt).getTime()) ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No sorted parcels found matching criteria.</div>
                                            )}
                                            <PaginationControl
                                                currentPage={dashTablePage}
                                                totalItems={list.length}
                                                rowsPerPage={dashTableRowsPerPage}
                                                onPageChange={(page) => setDashTablePage(page)}
                                                onRowsPerPageChange={(rows) => setDashTableRowsPerPage(rows)}
                                            />
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 3: PENDING PARCELS (AWAITING SORTING)
                                    ═══════════════════════════════════════════════════════ */}
                        {dashboardSubTab === 'pending_parcels' && (
                            <div style={card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={label}>Pending Parcels Awaiting Sorting</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            Total Pending: <strong>{pendingParc} parcels</strong>
                                        </div>
                                        {(() => {
                                            const exportList = filteredParcels.filter((p: any) => !p.isSorted).filter((p: any) => {
                                                const q = dashSearchQuery.toLowerCase();
                                                const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q);
                                                const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                                return matchQ && matchP;
                                            });
                                            const partnerSuffix = dashPartnerFilter !== 'ALL' ? `_${dashPartnerFilter}` : '_AllPartners';
                                            const searchSuffix = dashSearchQuery ? `_Search-${dashSearchQuery.replace(/[^a-zA-Z0-9]/g, '')}` : '';
                                            return (
                                                <button
                                                    onClick={() => {
                                                        const txt = (v: any) => v != null && v !== '' ? `="${String(v)}"` : '-';
                                                        const fmtW = (v: any) => {
                                                            if (v == null || v === '') return '-';
                                                            const s = String(v).trim();
                                                            if (/[a-zA-Z]/.test(s)) return s; // already has a unit — keep as-is
                                                            const n = s.replace(/[^0-9.]/g, '').trim();
                                                            return n ? `${n}g` : '-';
                                                        };
                                                        exportToExcel(
                                                        ['#', 'Parcel Reference', 'Temu Barcode', 'Target Partner', 'Weight (g)', 'Allocation Status', 'Received Date'],
                                                        exportList.map((p: any, i: number) => [
                                                            i + 1,
                                                            txt(p.referenceNumber),
                                                            txt(p.senderReference),
                                                            p.deliveryAgentCode,
                                                            fmtW(p.weight),
                                                            'Pending 1st Scan',
                                                            p.createdAt && !isNaN(new Date(p.createdAt).getTime()) ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'
                                                        ]),
                                                        `Pending_Parcels${partnerSuffix}${searchSuffix}_${activeMawb}_${new Date().toISOString().slice(0, 10)}.csv`,
                                                        {
                                                            reportTitle: 'Pending Parcels Awaiting Sorting',
                                                            mawb: activeMawb,
                                                            partner: dashPartnerFilter === 'ALL' ? 'All Partners' : dashPartnerFilter,
                                                            totalRecords: exportList.length
                                                        }
                                                        );
                                                    }}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        backgroundColor: '#16a34a', color: '#ffffff',
                                                        border: 'none', borderRadius: '6px',
                                                        padding: '7px 14px', fontSize: '12px', fontWeight: '700',
                                                        cursor: 'pointer', whiteSpace: 'nowrap',
                                                        boxShadow: '0 1px 4px rgba(22,163,74,0.25)',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#15803d')}
                                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                                    title={`Export ${exportList.length} records — Partner: ${dashPartnerFilter}, MAWB: ${activeMawb}`}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                        <polyline points="7 10 12 15 17 10"/>
                                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                                    </svg>
                                                    Export Excel ({exportList.length})
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {(() => {
                                    const list = filteredParcels.filter((p: any) => !p.isSorted).filter((p: any) => {
                                        const q = dashSearchQuery.toLowerCase();
                                        const matchQ = !q || p.referenceNumber.toLowerCase().includes(q) || p.senderReference.toLowerCase().includes(q);
                                        const matchP = dashPartnerFilter === 'ALL' || p.deliveryAgentCode === dashPartnerFilter;
                                        return matchQ && matchP;
                                    });
                                    const paginatedList = list.slice((dashTablePage - 1) * dashTableRowsPerPage, dashTablePage * dashTableRowsPerPage);
                                    return (
                                        <>
                                            {list.length > 0 ? (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                                {['#', 'Parcel Reference', 'Temu Barcode', 'Target Partner', 'Weight', 'Allocation Status', 'Received Date'].map(h => (
                                                                    <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {paginatedList.map((p: any, idx: number) => {
                                                                const globalIdx = (dashTablePage - 1) * dashTableRowsPerPage + idx + 1;
                                                                return (
                                                                    <tr key={`pend-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{globalIdx}</td>
                                                                        <td style={{ padding: '10px 8px', fontWeight: '700', color: '#111827' }}>{p.referenceNumber}</td>
                                                                        <td style={{ padding: '10px 8px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>{p.senderReference}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', backgroundColor: p.deliveryAgentCode === 'PickMe' ? '#facc15' : p.deliveryAgentCode === 'Domex' ? '#7b0f1a' : p.deliveryAgentCode === 'Pronto' ? '#ea580c' : '#6b7280', color: p.deliveryAgentCode === 'PickMe' ? '#000000' : '#ffffff' }}>
                                                                                {p.deliveryAgentCode}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.weight}</td>
                                                                        <td style={{ padding: '10px 8px' }}>
                                                                            <span style={{ padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: '#ffffff', color: '#6b7280', border: '1px solid #9ca3af' }}>
                                                                                Pending 1st Scan
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: '11px' }}>
                                                                            {p.createdAt && !isNaN(new Date(p.createdAt).getTime()) ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No pending parcels awaiting sorting.</div>
                                            )}
                                            <PaginationControl
                                                currentPage={dashTablePage}
                                                totalItems={list.length}
                                                rowsPerPage={dashTableRowsPerPage}
                                                onPageChange={(page) => setDashTablePage(page)}
                                                onRowsPerPageChange={(rows) => setDashTableRowsPerPage(rows)}
                                            />
                                        </>
                                    );
                                })()}
                            </div>
                        )}



                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 6: EXCEPTIONS & DISCREPANCIES
                                    ═══════════════════════════════════════════════════════ */}
                        {dashboardSubTab === 'exceptions' && (
                            <div style={card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={label}>Operational Exceptions & Discrepancies Log</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            Total Exceptions: <strong>{totalExc}</strong>
                                        </div>
                                        {(() => {
                                            const exportList = filteredExceptions.filter((ex: any) => {
                                                const q = dashSearchQuery.toLowerCase();
                                                return !q || ex.type.toLowerCase().includes(q) || ex.refNumber.toLowerCase().includes(q) || ex.details.toLowerCase().includes(q);
                                            });
                                            const searchSuffix = dashSearchQuery ? `_Search-${dashSearchQuery.replace(/[^a-zA-Z0-9]/g, '')}` : '';
                                            return (
                                                <button
                                                    onClick={() => exportToExcel(
                                                        ['#', 'Exception Type', 'Ref / Barcode / Bag #', 'Details', 'Scanned / Expected', 'Reported By', 'Timestamp'],
                                                        exportList.map((ex: any, i: number) => [
                                                            i + 1,
                                                            ex.type,
                                                            ex.refNumber,
                                                            ex.details,
                                                            ex.scannedVsExpected,
                                                            ex.reportedBy,
                                                            ex.createdAt ? new Date(ex.createdAt).toLocaleString() : '-'
                                                        ]),
                                                        `Exceptions${searchSuffix}_${activeMawb}_${new Date().toISOString().slice(0, 10)}.csv`,
                                                        {
                                                            reportTitle: 'Operational Exceptions & Discrepancies Log',
                                                            mawb: activeMawb,
                                                            partner: 'N/A (Exceptions)',
                                                            totalRecords: exportList.length
                                                        }
                                                    )}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                        backgroundColor: '#16a34a', color: '#ffffff',
                                                        border: 'none', borderRadius: '6px',
                                                        padding: '7px 14px', fontSize: '12px', fontWeight: '700',
                                                        cursor: 'pointer', whiteSpace: 'nowrap',
                                                        boxShadow: '0 1px 4px rgba(22,163,74,0.25)',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#15803d')}
                                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                                    title={`Export ${exportList.length} exceptions — MAWB: ${activeMawb}${dashSearchQuery ? ', Search: ' + dashSearchQuery : ''}`}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                        <polyline points="7 10 12 15 17 10"/>
                                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                                    </svg>
                                                    Export Excel ({exportList.length})
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {(() => {
                                    const list = filteredExceptions.filter((ex: any) => {
                                        const q = dashSearchQuery.toLowerCase();
                                        return !q || ex.type.toLowerCase().includes(q) || ex.refNumber.toLowerCase().includes(q) || ex.details.toLowerCase().includes(q);
                                    });
                                    const paginatedList = list.slice((dashTablePage - 1) * dashTableRowsPerPage, dashTablePage * dashTableRowsPerPage);
                                    return (
                                        <>
                                            {list.length > 0 ? (
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
                                                            {paginatedList.map((ex: any, idx: number) => {
                                                                const globalIdx = (dashTablePage - 1) * dashTableRowsPerPage + idx + 1;
                                                                return (
                                                                    <tr key={`ex-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                        <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '11px' }}>{globalIdx}</td>
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
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>No exception logs found.</div>
                                            )}
                                            <PaginationControl
                                                currentPage={dashTablePage}
                                                totalItems={list.length}
                                                rowsPerPage={dashTableRowsPerPage}
                                                onPageChange={(page) => setDashTablePage(page)}
                                                onRowsPerPageChange={(rows) => setDashTableRowsPerPage(rows)}
                                            />
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 7: USER PRODUCTIVITY PERFORMANCE
                                    ═══════════════════════════════════════════════════════ */}
                        {dashboardSubTab === 'productivity' && (() => {
                            const rawListForDate: any[] = (dashboardData.userProductivityByDate && dashboardData.userProductivityByDate[prodDateFilter])
                                || (prodDateFilter === 'ALL' ? (dashboardData.userProductivity || []) : []);

                            // Normalize operator list
                            const prodListForDate: any[] = rawListForDate.length > 0
                                ? rawListForDate
                                : (dashboardData.userProductivity || []).map((p: any) => ({
                                    userId: p.userId || p.operator,
                                    operator: p.operator || 'Operator',
                                    username: p.username || '',
                                    firstName: p.firstName || p.operator || 'Operator',
                                    lastName: p.lastName || '',
                                    email: p.email || `${(p.operator || 'operator').toLowerCase().replace(/\s+/g, '.')}@skynet.lk`,
                                    role: p.role || 'Operator',
                                    isActive: p.isActive !== false,
                                    firstScanCount: p.firstScanCount || 0,
                                    secondScanCount: p.secondScanCount || 0,
                                    inboundBagsUnsealed: p.inboundBagsUnsealed || 0,
                                    outboundBagsOpened: p.outboundBagsOpened || 0,
                                    outboundBagsClosed: p.outboundBagsClosed || p.bagsSealed || 0,
                                    manifestsClosed: p.manifestsClosed || 0,
                                    totalScans: p.totalScans || (p.firstScanCount || 0) + (p.secondScanCount || 0) || p.scanned || 0,
                                    totalActions: p.totalActions || (p.scanned || 0) + (p.bagsSealed || 0)
                                }));

                            const kpiStats = (dashboardData.userProductivityKPIs && dashboardData.userProductivityKPIs[prodDateFilter]) || {
                                totalFirstScans: prodListForDate.reduce((acc, p) => acc + (p.firstScanCount || 0), 0),
                                totalSecondScans: prodListForDate.reduce((acc, p) => acc + (p.secondScanCount || 0), 0),
                                totalInboundBagsUnsealed: prodListForDate.reduce((acc, p) => acc + (p.inboundBagsUnsealed || 0), 0),
                                totalOutboundBagsOpened: prodListForDate.reduce((acc, p) => acc + (p.outboundBagsOpened || 0), 0),
                                totalOutboundBagsClosed: prodListForDate.reduce((acc, p) => acc + (p.outboundBagsClosed || p.bagsSealed || 0), 0),
                                totalManifestsClosed: prodListForDate.reduce((acc, p) => acc + (p.manifestsClosed || 0), 0),
                                activeOperatorsCount: prodListForDate.filter(p => (p.totalActions || 0) > 0).length,
                                totalOperators: prodListForDate.length
                            };

                            let filteredProdList = [...prodListForDate];

                            // Filter by search query
                            if (prodSearchQuery.trim()) {
                                const q = prodSearchQuery.toLowerCase().trim();
                                filteredProdList = filteredProdList.filter(item =>
                                    (item.operator && item.operator.toLowerCase().includes(q)) ||
                                    (item.email && item.email.toLowerCase().includes(q)) ||
                                    (item.username && item.username.toLowerCase().includes(q)) ||
                                    (item.role && item.role.toLowerCase().includes(q))
                                );
                            }

                            // Filter active only
                            if (prodActiveOnly) {
                                filteredProdList = filteredProdList.filter(item => (item.totalActions || 0) > 0);
                            }

                            // Sorting
                            filteredProdList.sort((a, b) => {
                                let valA = a[prodSortColumn] ?? 0;
                                let valB = b[prodSortColumn] ?? 0;

                                if (typeof valA === 'string') {
                                    valA = valA.toLowerCase();
                                    valB = (valB || '').toString().toLowerCase();
                                    return prodSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                }

                                return prodSortDirection === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
                            });

                            const paginatedProdList = filteredProdList.slice(
                                (prodPage - 1) * prodRowsPerPage,
                                prodPage * prodRowsPerPage
                            );

                            const handleSort = (column: string) => {
                                if (prodSortColumn === column) {
                                    setProdSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                    setProdSortColumn(column);
                                    setProdSortDirection('desc');
                                }
                            };

                            const getSortIndicator = (column: string) => {
                                if (prodSortColumn !== column) return <span style={{ color: '#d1d5db', marginLeft: '4px' }}>↕</span>;
                                return <span style={{ color: '#b91c1c', marginLeft: '4px' }}>{prodSortDirection === 'asc' ? '▲' : '▼'}</span>;
                            };

                            const handleExportProductivityExcel = () => {
                                const headers = [
                                    '#',
                                    'Operator Name',
                                    'Username',
                                    'Email Address',
                                    'Role',
                                    '1st Scan Count (Inbound Parcels)',
                                    '2nd Scan Count (Outbound Parcels)',
                                    'Inbound Bags Unsealed',
                                    'Outbound Bags Opened',
                                    'Outbound Bags Sealed & Closed',
                                    'Manifest Sessions Closed',
                                    'Total Scans (1st + 2nd)',
                                    'Total Operational Actions',
                                    'Daily Duty Status',
                                    'Active Date'
                                ];

                                const rows = filteredProdList.map((op, idx) => [
                                    idx + 1,
                                    op.operator || 'Unknown',
                                    op.username || '—',
                                    op.email || '—',
                                    op.role || 'Operator',
                                    op.firstScanCount || 0,
                                    op.secondScanCount || 0,
                                    op.inboundBagsUnsealed || 0,
                                    op.outboundBagsOpened || 0,
                                    op.outboundBagsClosed || 0,
                                    op.manifestsClosed || 0,
                                    op.totalScans || 0,
                                    op.totalActions || 0,
                                    (op.totalActions || 0) > 0 ? 'Active On-Duty' : 'Idle',
                                    prodDateFilter === 'ALL' ? 'All Time' : prodDateFilter
                                ]);

                                const dateTag = prodDateFilter === 'ALL' ? 'All_Time' : prodDateFilter;
                                const filename = `Skynet_User_Productivity_${dateTag}_${new Date().toISOString().split('T')[0]}.csv`;

                                exportToExcel(headers, rows, filename, {
                                    reportTitle: `USER PRODUCTIVITY PERFORMANCE REPORT (${dateTag})`,
                                    mawb: 'All Manifests',
                                    partner: 'All Courier Partners',
                                    totalRecords: filteredProdList.length
                                });
                            };

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                    {/* ── 1. Top Date Filter & Action Control Banner ── */}
                                    <div style={{
                                        backgroundColor: '#ffffff',
                                        padding: '16px 20px',
                                        borderRadius: '10px',
                                        border: '1px solid #cacccf',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '14px'
                                    }}>
                                        {/* Row 1: Active Date Status Chip + Quick Date Buttons + Datepicker + Refresh */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '8px',
                                                    backgroundColor: prodDateFilter === todayStr ? '#fef2f2' : '#f3f4f6',
                                                    color: prodDateFilter === todayStr ? '#b91c1c' : '#374151',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                        <line x1="16" y1="2" x2="16" y2="6" />
                                                        <line x1="8" y1="2" x2="8" y2="6" />
                                                        <line x1="3" y1="10" x2="21" y2="10" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Operational Date View
                                                    </div>
                                                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#111827' }}>
                                                        {formatDisplayDate(prodDateFilter)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Date Pills + Date Input + Refresh */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setProdDateFilter(todayStr)}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '6px',
                                                        border: '1px solid',
                                                        borderColor: prodDateFilter === todayStr ? '#b91c1c' : '#d1d5db',
                                                        backgroundColor: prodDateFilter === todayStr ? '#b91c1c' : '#ffffff',
                                                        color: prodDateFilter === todayStr ? '#ffffff' : '#374151',
                                                        fontSize: '12px',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    Today
                                                </button>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Pick Date:</span>
                                                    <input
                                                        type="date"
                                                        value={prodDateFilter === 'ALL' ? '' : prodDateFilter}
                                                        onChange={(e) => {
                                                            if (e.target.value) setProdDateFilter(e.target.value);
                                                        }}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #d1d5db',
                                                            fontSize: '12px',
                                                            fontWeight: '700',
                                                            color: '#111827',
                                                            backgroundColor: '#ffffff',
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => fetchDashboard && fetchDashboard()}
                                                    disabled={isLoadingDashboard}
                                                    title="Refresh Productivity Data"
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #d1d5db',
                                                        backgroundColor: '#ffffff',
                                                        color: '#374151',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isLoadingDashboard ? 'spin 1s linear infinite' : 'none' }}>
                                                        <path d="M23 4v6h-6" />
                                                        <path d="M1 20v-6h6" />
                                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                    </svg>
                                                    <span>Refresh</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Row 2: Search Input + Active Only Toggle + Export Excel */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 300px', flexWrap: 'wrap' }}>
                                                <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
                                                    <input
                                                        type="text"
                                                        value={prodSearchQuery}
                                                        onChange={e => setProdSearchQuery(e.target.value)}
                                                        placeholder="Search operator by name, email, or role..."
                                                        style={{
                                                            width: '100%',
                                                            padding: '7px 12px 7px 32px',
                                                            fontSize: '13px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #d1d5db',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '10px' }}>
                                                        <circle cx="11" cy="11" r="8" />
                                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                    </svg>
                                                    {prodSearchQuery && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setProdSearchQuery('')}
                                                            style={{ position: 'absolute', right: '8px', top: '7px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', fontSize: '14px' }}
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>

                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={prodActiveOnly}
                                                        onChange={e => setProdActiveOnly(e.target.checked)}
                                                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#b91c1c' }}
                                                    />
                                                    <span style={{ fontWeight: '600' }}>Active Operators Only</span>
                                                    <span style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '10px' }}>
                                                        {kpiStats.activeOperatorsCount} / {kpiStats.totalOperators}
                                                    </span>
                                                </label>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleExportProductivityExcel}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '7px 14px',
                                                    backgroundColor: '#166534',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                <span>Export Excel Report</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── 2. Top 6 Summary KPI Cards Grid ── */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: '12px'
                                    }}>
                                        {/* Card 1: 1st Scan */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '4px solid #16a34a',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1st Scan (Inbound)</span>
                                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: '#dcfce7', color: '#166534' }}>PARCELS</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                                                {kpiStats.totalFirstScans.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                Inbound parcels unsealed
                                            </div>
                                        </div>

                                        {/* Card 2: 2nd Scan */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '4px solid #2563eb',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2nd Scan (Outbound)</span>
                                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: '#dbeafe', color: '#1e40af' }}>SORTED</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                                                {kpiStats.totalSecondScans.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                Parcels sorted into LMD bags
                                            </div>
                                        </div>

                                        {/* Card 3: Inbound Bags Unsealed */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '4px solid #9333ea',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bags Unsealed</span>
                                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: '#f3e8ff', color: '#7e22ce' }}>INBOUND</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                                                {kpiStats.totalInboundBagsUnsealed.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                Inbound master bags unsealed
                                            </div>
                                        </div>

                                        {/* Card 4: Outbound Bags Opened */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '4px solid #d97706',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bags Opened</span>
                                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: '#fef3c7', color: '#b45309' }}>CREATED</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                                                {kpiStats.totalOutboundBagsOpened.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                Outbound LMD bags created
                                            </div>
                                        </div>

                                        {/* Card 5: Outbound Bags Sealed */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '4px solid #059669',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bags Sealed</span>
                                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: '#d1fae5', color: '#047857' }}>CLOSED</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                                                {kpiStats.totalOutboundBagsClosed.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                Outbound LMD bags sealed
                                            </div>
                                        </div>

                                        {/* Card 6: Active Operators */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '4px solid #b91c1c',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>On-Duty Staff</span>
                                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: '#fee2e2', color: '#b91c1c' }}>ACTIVE</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                                                {kpiStats.activeOperatorsCount} <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>/ {kpiStats.totalOperators}</span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                Operators active on date
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── 3. User Productivity Detailed Performance Table ── */}
                                    <div style={card}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div>
                                                <div style={label}>User Productivity Performance Overview</div>
                                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                                                    Showing <strong>{filteredProdList.length}</strong> operator{filteredProdList.length !== 1 ? 's' : ''} for <strong>{formatDisplayDate(prodDateFilter)}</strong>.
                                                </p>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>Active Staff: <strong style={{ color: '#166534' }}>{kpiStats.activeOperatorsCount}</strong></span>
                                                <span>•</span>
                                                <span>Total Registered: <strong>{kpiStats.totalOperators}</strong></span>
                                            </div>
                                        </div>

                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '980px' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                        <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', width: '40px' }}>#</th>
                                                        <th onClick={() => handleSort('operator')} style={{ padding: '10px 12px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>
                                                            Operator / User Name {getSortIndicator('operator')}
                                                        </th>
                                                        <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Email Address</th>
                                                        <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Role</th>
                                                        <th onClick={() => handleSort('firstScanCount')} style={{ padding: '10px 12px', color: '#166534', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            1st Scan (Inbound) {getSortIndicator('firstScanCount')}
                                                        </th>
                                                        <th onClick={() => handleSort('secondScanCount')} style={{ padding: '10px 12px', color: '#1d4ed8', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            2nd Scan (Outbound) {getSortIndicator('secondScanCount')}
                                                        </th>
                                                        <th onClick={() => handleSort('inboundBagsUnsealed')} style={{ padding: '10px 12px', color: '#7e22ce', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            Inbound Unsealed {getSortIndicator('inboundBagsUnsealed')}
                                                        </th>
                                                        <th onClick={() => handleSort('outboundBagsOpened')} style={{ padding: '10px 12px', color: '#b45309', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            Bags Opened {getSortIndicator('outboundBagsOpened')}
                                                        </th>
                                                        <th onClick={() => handleSort('outboundBagsClosed')} style={{ padding: '10px 12px', color: '#047857', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            Bags Sealed {getSortIndicator('outboundBagsClosed')}
                                                        </th>
                                                        <th onClick={() => handleSort('manifestsClosed')} style={{ padding: '10px 12px', color: '#374151', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            Manifests Closed {getSortIndicator('manifestsClosed')}
                                                        </th>
                                                        <th onClick={() => handleSort('totalScans')} style={{ padding: '10px 12px', color: '#111827', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'right' }}>
                                                            Total Scans {getSortIndicator('totalScans')}
                                                        </th>
                                                        <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>Duty Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedProdList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={12} style={{ textAlign: 'center', padding: '36px 20px', color: '#6b7280' }}>
                                                                <div style={{ fontSize: '14px', fontWeight: '600' }}>No operator records found for {formatDisplayDate(prodDateFilter)}</div>
                                                                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>Try choosing another date or clearing your search filters.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        paginatedProdList.map((user: any, idx: number) => {
                                                            const globalIdx = (prodPage - 1) * prodRowsPerPage + idx + 1;
                                                            const displayName = user.operator || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.email || 'Operator';
                                                            const firstScan = user.firstScanCount || 0;
                                                            const secondScan = user.secondScanCount || 0;
                                                            const inboundUnsealed = user.inboundBagsUnsealed || 0;
                                                            const bagsOpened = user.outboundBagsOpened || 0;
                                                            const bagsClosed = user.outboundBagsClosed || user.bagsSealed || 0;
                                                            const manifestsClosed = user.manifestsClosed || 0;
                                                            const totalScans = user.totalScans || (firstScan + secondScan);
                                                            const totalActions = user.totalActions || (totalScans + inboundUnsealed + bagsOpened + bagsClosed + manifestsClosed);
                                                            const hasActivity = totalActions > 0;

                                                            return (
                                                                <tr
                                                                    key={`u-prod-${user.userId || user.id || displayName || idx}`}
                                                                    style={{
                                                                        borderBottom: '1px solid #f3f4f6',
                                                                        backgroundColor: hasActivity ? 'transparent' : '#fbfcfd'
                                                                    }}
                                                                >
                                                                    <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: '11px' }}>{globalIdx}</td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#111827' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <div style={{
                                                                                width: '28px',
                                                                                height: '28px',
                                                                                borderRadius: '50%',
                                                                                backgroundColor: hasActivity ? '#fee2e2' : '#f3f4f6',
                                                                                border: '1px solid',
                                                                                borderColor: hasActivity ? '#fca5a5' : '#d1d5db',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                fontWeight: '700',
                                                                                fontSize: '11px',
                                                                                color: hasActivity ? '#b91c1c' : '#374151'
                                                                            }}>
                                                                                {(displayName || 'O')[0].toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <div>{displayName}</div>
                                                                                {user.username && user.username !== displayName && (
                                                                                    <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '400' }}>@{user.username}</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', color: '#4b5563', fontSize: '12px', fontFamily: 'monospace' }}>{user.email || '—'}</td>
                                                                    <td style={{ padding: '10px 12px' }}>
                                                                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                                                                            {user.role || 'Operator'}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: firstScan > 0 ? '#166534' : '#9ca3af', textAlign: 'right' }}>
                                                                        {firstScan > 0 ? `${firstScan} pcs` : '0'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: secondScan > 0 ? '#1d4ed8' : '#9ca3af', textAlign: 'right' }}>
                                                                        {secondScan > 0 ? `${secondScan} pcs` : '0'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: inboundUnsealed > 0 ? '#7e22ce' : '#9ca3af', textAlign: 'right' }}>
                                                                        {inboundUnsealed > 0 ? `${inboundUnsealed} bags` : '0'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: bagsOpened > 0 ? '#b45309' : '#9ca3af', textAlign: 'right' }}>
                                                                        {bagsOpened > 0 ? `${bagsOpened} bags` : '0'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: bagsClosed > 0 ? '#047857' : '#9ca3af', textAlign: 'right' }}>
                                                                        {bagsClosed > 0 ? `${bagsClosed} bags` : '0'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: manifestsClosed > 0 ? '#374151' : '#9ca3af', textAlign: 'right' }}>
                                                                        {manifestsClosed > 0 ? `${manifestsClosed} mnf` : '0'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                                        <span style={{
                                                                            padding: '2px 8px',
                                                                            borderRadius: '4px',
                                                                            fontSize: '12px',
                                                                            fontWeight: '800',
                                                                            backgroundColor: totalScans > 0 ? '#f3f4f6' : 'transparent',
                                                                            color: totalScans > 0 ? '#111827' : '#9ca3af'
                                                                        }}>
                                                                            {totalScans}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                        {hasActivity ? (
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                                                                ● Active
                                                                            </span>
                                                                        ) : (
                                                                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
                                                                                ○ Idle
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <PaginationControl
                                            currentPage={prodPage}
                                            totalItems={filteredProdList.length}
                                            rowsPerPage={prodRowsPerPage}
                                            onPageChange={(page) => setProdPage(page)}
                                            onRowsPerPageChange={(rows) => setProdRowsPerPage(rows)}
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ═══════════════════════════════════════════════════════
                                        DETAIL TAB 8: COURIER PARTNER DISTRIBUTION
                                    ═══════════════════════════════════════════════════════ */}
                        {dashboardSubTab === 'partner' && (() => {
                            // ── Build per-partner stats from manifest-filtered parcel & bag lists ──
                            const partnerColors: Record<string, string> = {
                                PickMe: '#facc15',
                                Domex: '#7b0f1a',
                                SITREK: '#0f2b6e',
                                Pronto: '#ea580c',
                                Other: '#6b7280'
                            };
                            const partnerTextColors: Record<string, string> = {
                                PickMe: '#000000',
                                Domex: '#ffffff',
                                SITREK: '#ffffff',
                                Pronto: '#ffffff',
                                Other: '#ffffff'
                            };
                            const knownPartners = ['PickMe', 'Domex', 'SITREK', 'Pronto', 'Other'];
                            const filteredPartnerMap: Record<string, { partnerName: string; totalParcels: number; allocatedParcels: number; pendingParcels: number; totalBags: number }> = {};
                            knownPartners.forEach(p => {
                                filteredPartnerMap[p] = { partnerName: p, totalParcels: 0, allocatedParcels: 0, pendingParcels: 0, totalBags: 0 };
                            });

                            // Count parcels per partner from manifest-filtered parcels
                            filteredParcels.forEach((p: any) => {
                                let pName = 'Other';
                                const agent = (p.deliveryAgentCode || '').toLowerCase();
                                if (agent.includes('pickme')) pName = 'PickMe';
                                else if (agent.includes('domex')) pName = 'Domex';
                                else if (agent.includes('sitrek')) pName = 'SITREK';
                                else if (agent.includes('pronto')) pName = 'Pronto';
                                else if (knownPartners.includes(p.deliveryAgentCode)) pName = p.deliveryAgentCode;

                                filteredPartnerMap[pName].totalParcels++;
                                if (p.isSorted) {
                                    filteredPartnerMap[pName].allocatedParcels++;
                                } else {
                                    filteredPartnerMap[pName].pendingParcels++;
                                }
                            });

                            // Count bags per partner from manifest-filtered bags
                            filteredBags.forEach((b: any) => {
                                let pName = 'Other';
                                const tp = (b.targetPartner || '').toLowerCase();
                                if (tp.includes('pickme')) pName = 'PickMe';
                                else if (tp.includes('domex')) pName = 'Domex';
                                else if (tp.includes('sitrek')) pName = 'SITREK';
                                else if (tp.includes('pronto')) pName = 'Pronto';
                                else if (knownPartners.includes(b.targetPartner)) pName = b.targetPartner;
                                filteredPartnerMap[pName].totalBags++;
                            });

                            const list = Object.values(filteredPartnerMap).filter(p => p.totalParcels > 0 || p.totalBags > 0);
                            // Show all partners even with 0 if no data (so table isn't empty)
                            const displayList = list.length > 0 ? list : Object.values(filteredPartnerMap);
                            const paginatedList = displayList.slice((dashTablePage - 1) * dashTableRowsPerPage, dashTablePage * dashTableRowsPerPage);

                            return (
                                <div style={card}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={label}>Courier Partner Allocation Distribution</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            Manifest: <strong style={{ color: '#e21b22' }}>{activeMawb !== 'ALL' ? activeMawb : 'All Manifests'}</strong>
                                            {' · '}Total Inbound: <strong>{totalRec} parcels</strong>
                                        </div>
                                    </div>

                                    {/* Summary bar chart */}
                                    {totalRec > 0 && (
                                        <div style={{ display: 'flex', height: '28px', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
                                            {displayList.filter(p => p.totalParcels > 0).map(p => {
                                                const w = totalRec > 0 ? (p.totalParcels / totalRec) * 100 : 0;
                                                return (
                                                    <div key={p.partnerName} title={`${p.partnerName}: ${p.totalParcels} parcels (${Math.round(w)}%)`}
                                                        style={{ width: `${w}%`, backgroundColor: partnerColors[p.partnerName] || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: partnerTextColors[p.partnerName] || '#ffffff', overflow: 'hidden', whiteSpace: 'nowrap', minWidth: w > 5 ? undefined : '0px' }}>
                                                        {w > 8 ? `${p.partnerName} ${Math.round(w)}%` : ''}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Partner Name</th>
                                                <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>No. of Parcels</th>
                                                <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Allocated (Sorted)</th>
                                                <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>Pending / Unscanned</th>
                                                <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>No. of Bags</th>
                                                <th style={{ padding: '12px 10px', color: '#6b7280', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', width: '180px' }}>Distribution %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedList.map((partner: any) => {
                                                const pct = totalRec > 0 ? Math.round((partner.totalParcels / totalRec) * 100) : 0;
                                                const barColor = partnerColors[partner.partnerName] || '#6b7280';
                                                return (
                                                    <tr key={partner.partnerName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <td style={{ padding: '12px 10px', fontWeight: '700', color: '#111827', fontSize: '13px' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '3px 10px',
                                                                borderRadius: '5px',
                                                                fontSize: '12px',
                                                                fontWeight: '800',
                                                                backgroundColor: partnerColors[partner.partnerName] || '#6b7280',
                                                                color: partnerTextColors[partner.partnerName] || '#ffffff',
                                                                letterSpacing: '0.02em'
                                                            }}>
                                                                {partner.partnerName}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px 10px', fontWeight: '700', color: '#111827' }}>
                                                            {partner.totalParcels} parcels
                                                        </td>
                                                        <td style={{ padding: '12px 10px', fontWeight: '700', color: '#166534' }}>
                                                            {partner.allocatedParcels} sorted
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
                                                                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                                                </div>
                                                                <span style={{ fontWeight: '700', color: '#374151', fontSize: '12px', minWidth: '35px' }}>{pct}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <PaginationControl
                                        currentPage={dashTablePage}
                                        totalItems={displayList.length}
                                        rowsPerPage={dashTableRowsPerPage}
                                        onPageChange={(page) => setDashTablePage(page)}
                                        onRowsPerPageChange={(rows) => setDashTableRowsPerPage(rows)}
                                    />
                                </div>
                            );
                        })()}
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
    );
}
