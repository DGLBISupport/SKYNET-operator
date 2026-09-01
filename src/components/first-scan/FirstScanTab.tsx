'use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function FirstScanTab({
    bagBarcodeInput,
    bagBarcodeInputRef,
    card,
    extractLatestBarcode,
    firstScanBags,
    firstScanBagsPage,
    firstScanBagsRowsPerPage,
    firstScanCurrentScan,
    firstScanExpected,
    firstScanHistory,
    firstScanHistoryPage,
    firstScanHistoryRowsPerPage,
    firstScanInput,
    firstScanInputRef,
    firstScanLastScanned,
    firstScanMawb,
    firstScanSelectedBag,
    generateCode128SVG,
    getBagScannedCount,
    getBagStatus,
    getSortedBags,
    handleClearFirstScan,
    handleFirstScanSubmit,
    inputStyle,
    isBagsLoading,
    label,
    lastTemuSticker,
    mawbDateFilter,
    mawbsList,
    setBagBarcodeInput,
    setConfirmFinishModal,
    setCustomConfirmModal,
    setCustomDiscrepancyNote,
    setDiscrepancyReason,
    setFirstScanBagsPage,
    setFirstScanBagsRowsPerPage,
    setFirstScanError,
    setFirstScanExpected,
    setFirstScanHistory,
    setFirstScanHistoryPage,
    setFirstScanHistoryRowsPerPage,
    setFirstScanInput,
    setFirstScanLastScanned,
    setFirstScanMawb,
    setFirstScanSelectedBag,
    setInvalidBagParcelModal,
    setLastTemuSticker,
    setMawbDateFilter,
    status,
    unsealedBoxes
}: any) {
    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* ── DATE FILTER BAR ── */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '10px 16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151', whiteSpace: 'nowrap' }}>
                                    📅 Showing MAWBs for:
                                </span>
                                <input
                                    type="date"
                                    value={mawbDateFilter || ''}
                                    onChange={(e) => {
                                        setMawbDateFilter(e.target.value);
                                        setFirstScanMawb('');
                                    }}
                                    style={{
                                        ...inputStyle,
                                        width: '160px',
                                        fontWeight: '600',
                                        fontSize: '13px',
                                        padding: '6px 10px'
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const today = new Date().toISOString().slice(0, 10);
                                        setMawbDateFilter(today);
                                        setFirstScanMawb('');
                                    }}
                                    style={{
                                        backgroundColor: '#f3f4f6',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Today
                                </button>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {mawbsList.length} MAWB{mawbsList.length !== 1 ? 's' : ''} found
                                </span>
                            </div>

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
                                                {firstScanBags.map((b: any) => {
                                                    const bagStatus = getBagStatus(b.bagNumber, b.expectedCount);
                                                    const scanned = getBagScannedCount(b.bagNumber);
                                                    let statusLabel = `${b.expectedCount} expected`;
                                                    if (bagStatus === 'COMPLETED') {
                                                        statusLabel = `Completed (${scanned}/${b.expectedCount})`;
                                                    } else if (scanned > 0 || bagStatus === 'IN_PROGRESS' || bagStatus === 'ONGOING') {
                                                        statusLabel = `In Progress (${scanned}/${b.expectedCount} unsealed)`;
                                                    }
                                                    return (
                                                        <option key={b.bagNumber} value={b.bagNumber}>
                                                            {b.bagNumber} — {statusLabel}
                                                        </option>
                                                    );
                                                })}
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
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#000000', backgroundColor: '#ffffff', border: '1px solid #dc2626', padding: '3px 8px', borderRadius: '4px' }}>
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
                            {firstScanCurrentScan && firstScanCurrentScan.assignedPartner && firstScanCurrentScan.assignedPartner !== 'Unknown' && (() => {
                                const isDarkPartner = firstScanCurrentScan.assignedPartner === 'Domex' ||
                                    firstScanCurrentScan.assignedPartner === 'SITREK' ||
                                    firstScanCurrentScan.assignedPartner === 'Sitrek' ||
                                    firstScanCurrentScan.assignedPartner === 'Pronto';

                                const shipmentNumber = firstScanCurrentScan.parcel?.trackingNumber ||
                                    firstScanCurrentScan.parcel?.skynetTrackingNumber ||
                                    firstScanCurrentScan.parcel?.reference_number ||
                                    firstScanCurrentScan.parcel?.tracking_number ||
                                    firstScanCurrentScan.trackingNumber ||
                                    (firstScanHistory && firstScanHistory.length > 0 ? (firstScanHistory[0].skynetTrackingNumber || firstScanHistory[0].trackingNumber) : '');

                                return (
                                    <div style={{
                                        backgroundColor: firstScanCurrentScan.assignedPartner === 'Domex'
                                            ? '#7b0f1a'
                                            : firstScanCurrentScan.assignedPartner === 'SITREK' || firstScanCurrentScan.assignedPartner === 'Sitrek'
                                                ? '#0f2b6e'
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
                                            color: isDarkPartner ? '#ffffff' : '#000000',
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
                                            marginBottom: '14px',
                                            boxSizing: 'border-box'
                                        }}>
                                            {firstScanCurrentScan.assignedPartner === 'Domex' ? (
                                                <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                    <source srcSet="/domex_logo.webp" type="image/webp" />
                                                    <img src="/domex_logo.png" alt="Domex" decoding="async" fetchPriority="high" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                </picture>
                                            ) : firstScanCurrentScan.assignedPartner === 'SITREK' || firstScanCurrentScan.assignedPartner === 'Sitrek' ? (
                                                <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                    <source srcSet="/sitrek_logo.webp" type="image/webp" />
                                                    <img src="/sitrek_logo.png" alt="SITREK" decoding="async" fetchPriority="high" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                </picture>
                                            ) : firstScanCurrentScan.assignedPartner === 'Pronto' ? (
                                                <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '34px', letterSpacing: '1px' }}>PRONTO</span>
                                            ) : (
                                                <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                    <source srcSet="/pick_me_logo.webp" type="image/webp" />
                                                    <img src="/pick_me_logo.png" alt="PickMe" decoding="async" fetchPriority="high" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                </picture>
                                            )}
                                        </div>

                                        {/* Large Shipment Number (no background) */}
                                        {shipmentNumber && (
                                            <div style={{
                                                fontSize: '30px',
                                                fontWeight: '900',
                                                letterSpacing: '1.5px',
                                                color: isDarkPartner ? '#ffffff' : '#000000',
                                                fontFamily: 'monospace, sans-serif',
                                                textAlign: 'center',
                                                wordBreak: 'break-all',
                                                marginBottom: '14px',
                                                marginTop: '2px',
                                                textShadow: isDarkPartner ? '0 2px 4px rgba(0,0,0,0.35)' : 'none'
                                            }}>
                                                {shipmentNumber}
                                            </div>
                                        )}

                                        {/* Zone Pill Badge */}
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: isDarkPartner ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                                            border: isDarkPartner ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)',
                                            borderRadius: '20px',
                                            padding: '6px 20px',
                                            fontSize: '14px',
                                            color: isDarkPartner ? '#ffffff' : '#000000'
                                        }}>
                                            Zone: <span style={{ fontWeight: '800', marginLeft: '6px', fontSize: '16px' }}>{firstScanCurrentScan.assignedZone || 'Default-Zone'}</span>
                                        </div>
                                    </div>
                                );
                            })()}

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
                                    <div style={{ minHeight: '250px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                                    {['Timestamp', 'Tracking Number', 'LMD Partner', 'Status'].map(h => (
                                                        <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {firstScanHistory.slice((firstScanHistoryPage - 1) * firstScanHistoryRowsPerPage, firstScanHistoryPage * firstScanHistoryRowsPerPage).map((item, idx) => (
                                                    <tr key={`first-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <td style={{ padding: '8px', color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.timestamp || '—'}</td>
                                                        <td style={{ padding: '8px', fontWeight: '600', color: '#111827' }}>
                                                            {(() => {
                                                                const skynet = (item.skynetTrackingNumber || item.trackingNumber || '').toString().replace(/SKYT-?/gi, '').trim();
                                                                const senderRef = (item.senderReference || '').toString().replace(/SKYT-?/gi, '').trim();
                                                                // Only show senderRef / skynet when the scan was done via Temu barcode
                                                                if (item.isTemuScan && senderRef && senderRef.toLowerCase() !== skynet.toLowerCase()) {
                                                                    return `${senderRef} / ${skynet}`;
                                                                }
                                                                return skynet || '-';
                                                            })()}
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            {item.assignedPartner ? (
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
                                                            ) : (
                                                                <span style={{ color: '#9ca3af' }}>—</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '8px' }}><span style={{ backgroundColor: '#ffffffff', color: '#4c5262ff', border: '1px solid #b6acacff', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>First Scanned</span></td>
                                                    </tr>
                                                ))}
                                                {firstScanHistory.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
                                                            Pull scanner trigger to start counting parcels.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <PaginationControl
                                        currentPage={firstScanHistoryPage}
                                        totalItems={firstScanHistory.length}
                                        rowsPerPage={firstScanHistoryRowsPerPage}
                                        onPageChange={(page) => setFirstScanHistoryPage(page)}
                                        onRowsPerPageChange={(rows) => setFirstScanHistoryRowsPerPage(rows)}
                                    />
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
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '9.5px', color: '#991b1b', textTransform: 'uppercase', fontWeight: '700' }}>Declared Bags</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
                                                        {mawbsList.find((m: any) => m.mawb_reference === firstScanMawb)?.declared_bags ?? 0}
                                                    </div>
                                                </div>
                                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '9.5px', color: '#166534', textTransform: 'uppercase', fontWeight: '700' }}>Completed</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#166534', marginTop: '2px' }}>
                                                        {firstScanBags.filter(b => getBagStatus(b.bagNumber, b.expectedCount) === 'COMPLETED').length}
                                                    </div>
                                                </div>
                                                <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 6px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '9.5px', color: '#374151', textTransform: 'uppercase', fontWeight: '700' }}>Remaining</div>
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
                                            {(() => {
                                                const sortedBags = getSortedBags();
                                                const paginatedSortedBags = sortedBags.slice(
                                                    (firstScanBagsPage - 1) * firstScanBagsRowsPerPage,
                                                    firstScanBagsPage * firstScanBagsRowsPerPage
                                                );
                                                return (
                                                    <>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px' }}>
                                                            {paginatedSortedBags.map((bag) => {
                                                                const expected = bag.expectedCount;
                                                                const scanned = getBagScannedCount(bag.bagNumber);
                                                                const status = getBagStatus(bag.bagNumber, expected);
                                                                const remaining = Math.max(0, expected - scanned);
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
                                                                } else if (status === 'IN_PROGRESS') {
                                                                    bgColor = '#fffbeb';
                                                                    borderColor = '#fde68a';
                                                                    textColor = '#92400e';
                                                                    descColor = '#b45309';
                                                                    statusText = 'In Progress';
                                                                    statusColor = '#b45309';
                                                                    statusBg = '#fef3c7';
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
                                                                                        ? `${remaining} parcels remaining (${scanned} unsealed)`
                                                                                        : status === 'IN_PROGRESS'
                                                                                            ? `${scanned} unsealed, ${remaining} pending`
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
                                                        <PaginationControl
                                                            currentPage={firstScanBagsPage}
                                                            totalItems={sortedBags.length}
                                                            rowsPerPage={firstScanBagsRowsPerPage}
                                                            onPageChange={(page) => setFirstScanBagsPage(page)}
                                                            onRowsPerPageChange={(rows) => setFirstScanBagsRowsPerPage(rows)}
                                                        />
                                                    </>
                                                );
                                            })()}
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
    );
}
