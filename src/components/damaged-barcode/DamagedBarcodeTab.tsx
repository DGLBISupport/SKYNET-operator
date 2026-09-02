'use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function DamagedBarcodeTab({
    btnDanger,
    btnPrimary,
    btnSecondary,
    card,
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
    damagedStatus,
    damagedSubTab,
    damagedSubmitError,
    damagedSubmitSuccess,
    damagedSubmitting,
    fetchDamagedParcels,
    handleChangeLMDDamaged,
    handleClearDamagedScan,
    handleConfirmDispatchDamaged,
    handleDamagedImageUpload,
    handleDamagedScanSubmit,
    handleSubmitDamagedParcelReport,
    inputStyle,
    label,
    parcelDetailsGrid,
    rowItem,
    scannedToday,
    setDamagedBarcodeInput,
    setDamagedImage1,
    setDamagedImage2,
    setDamagedLastScanned,
    setDamagedManualTracking,
    setDamagedReportCategory,
    setDamagedReportFormOpen,
    setDamagedReportRemarks,
    setDamagedReportSeverity,
    setDamagedSelectedPhotosModal,
    setDamagedSubTab,
    setDamagedSubmitError,
    setDamagedSubmitSuccess,
    setPrintLabelModal,
    status
}: any) {
    return (
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
                                                        : damagedCurrentScan.assignedPartner === 'SITREK' || damagedCurrentScan.assignedPartner === 'Sitrek'
                                                            ? '3px solid #0f2b6e'
                                                            : '3px solid #ea580c'
                                                : '1px solid #e5e7eb',
                                            backgroundColor: damagedCurrentScan?.assignedPartner
                                                ? damagedCurrentScan.assignedPartner === 'PickMe'
                                                    ? '#ffcc00'
                                                    : damagedCurrentScan.assignedPartner === 'Domex'
                                                        ? '#7b0f1a'
                                                        : damagedCurrentScan.assignedPartner === 'SITREK' || damagedCurrentScan.assignedPartner === 'Sitrek'
                                                            ? '#0f2b6e'
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
                                                            <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                                <source srcSet="/pick_me_logo.webp" type="image/webp" />
                                                                <img src="/pick_me_logo.png" alt="PickMe" decoding="async" fetchPriority="high" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                            </picture>
                                                        ) : damagedCurrentScan.assignedPartner === 'Domex' ? (
                                                            <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                                <source srcSet="/domex_logo.webp" type="image/webp" />
                                                                <img src="/domex_logo.png" alt="Domex" decoding="async" fetchPriority="high" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                            </picture>
                                                        ) : damagedCurrentScan.assignedPartner === 'SITREK' || damagedCurrentScan.assignedPartner === 'Sitrek' ? (
                                                            <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                                <source srcSet="/sitrek_logo.webp" type="image/webp" />
                                                                <img src="/sitrek_logo.png" alt="SITREK" decoding="async" fetchPriority="high" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                                            </picture>
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
                                                            <span>⚠️ 1ST SCAN NOT DONE YET</span>
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
                                                                    trackingNumber: (damagedCurrentScan.parcel.trackingNumber || '').toString().replace(/^skyt-?/i, '').trim(),
                                                                    senderReference: damagedCurrentScan.parcel.senderReference,
                                                                    recipientName: damagedCurrentScan.parcel.recipientName,
                                                                    recipientPhone: damagedCurrentScan.parcel.recipientPhone,
                                                                    recipientAddress: damagedCurrentScan.parcel.recipientAddress,
                                                                    city: damagedCurrentScan.parcel.city,
                                                                    province: damagedCurrentScan.parcel.province,
                                                                    district: damagedCurrentScan.parcel.district,
                                                                    country: damagedCurrentScan.parcel.country,
                                                                    senderName: damagedCurrentScan.parcel.senderName,
                                                                    senderAddress: damagedCurrentScan.parcel.senderAddress,
                                                                    goodsDesc: damagedCurrentScan.parcel.goodsDesc,
                                                                    deliveryInstructions: damagedCurrentScan.parcel.deliveryInstructions || damagedCurrentScan.parcel.goodsDesc,
                                                                    numOfItems: damagedCurrentScan.parcel.numOfItems,
                                                                    value: damagedCurrentScan.parcel.value,
                                                                    account: damagedCurrentScan.parcel.account,
                                                                    destLocationCode: damagedCurrentScan.parcel.destLocationCode,
                                                                    serviceType: damagedCurrentScan.parcel.serviceType,
                                                                    weight: damagedCurrentScan.parcel.weight,
                                                                    weightMeasure: damagedCurrentScan.parcel.weightMeasure,
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
                                                                            : item.assignedPartner === 'SITREK' || item.assignedPartner === 'Sitrek'
                                                                                ? '#0f2b6e'
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
    );
}
