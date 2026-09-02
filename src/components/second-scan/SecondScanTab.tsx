'use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';
import { normalizeWeightToGrams, formatGramsToKg } from '@/lib/weightUtils';

export default function SecondScanTab({
    activeOutboundBag,
    barcodeInput,
    card,
    errorMessage,
    extractLatestBarcode,
    getManifestProviderName,
    getNextManifestPreviewCode,
    handleCloseManifest,
    handleDeleteOutboundBag,
    handleScanSubmit,
    handleSealOutboundBag,
    inputStyle,
    isCreatingBag,
    isCreatingManifest,
    isSealingBag,
    isClosingManifest,
    label,
    lastScanned,
    outboundBags,
    outboundManifestsList,
    rowItem,
    scanInputRef,
    scannedToday,
    secondScanManifestStatus,
    selectedProviderForManifest,
    selectedSecondScanMawb,
    setActiveOutboundBag,
    setBarcodeInput,
    setCreateBagModalOpen,
    setCreateManifestModalOpen,
    setCustomBagNumber,
    setCustomManifestName,
    setCustomConfirmModal,
    setErrorMessage,
    setLastScanned,
    setNewBagPartner,
    setOpenBagsErrorModal,
    setPrintOutboundBagLabelModal,
    setSelectedSecondScanMawb,
    setStatus,
    status,
    validationCard
}: any) {
    return (
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
                                                Select Active Outbound Manifest (First Step)
                                            </label>
                                            <select
                                                value={selectedSecondScanMawb}
                                                onChange={(e) => setSelectedSecondScanMawb(e.target.value)}
                                                style={{ ...inputStyle, width: '100%', backgroundColor: '#ffffff', color: '#111827', fontWeight: '600' }}
                                            >
                                                <option value="">-- Select an Outbound Manifest --</option>
                                                {outboundManifestsList
                                                    .filter((m: any) => (m.status || 'OPEN').toUpperCase() !== 'CLOSED')
                                                    .map((m: any) => (
                                                    <option key={m.manifest_reference} value={m.manifest_reference}>
                                                        {m.manifest_reference} ({m.service_provider_name || 'Partner'} - {m.total_bags || 0} Bags, {m.total_parcels || 0} Pcs)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', paddingTop: '18px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => {
                                                    if (setCustomManifestName && getNextManifestPreviewCode) {
                                                        setCustomManifestName(getNextManifestPreviewCode(selectedProviderForManifest || 'PickMe'));
                                                    }
                                                    setCreateManifestModalOpen(true);
                                                }}
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                    color: '#374151',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '8px',
                                                    padding: '10px 18px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    boxShadow: '1px 1px 2px 1px rgba(226, 27, 34, 0.3)'
                                                }}
                                            >
                                                + Create New Outbound Manifest
                                            </button>
                                        </div>
                                    </div>

                                    {/* Horizontal Active Outbound Manifest Box (Box Theme) */}
                                    {selectedSecondScanMawb && (
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: secondScanManifestStatus === 'CLOSED' ? '2px solid #ef4444' : '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '12px 18px',
                                            marginTop: '12px',
                                            marginBottom: '16px',
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
                                                        Active Outbound Manifest
                                                    </div>
                                                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span>{selectedSecondScanMawb}</span>
                                                        {(() => {
                                                            const mObj = outboundManifestsList.find(m => m.manifest_reference === selectedSecondScanMawb);
                                                            const rawName = mObj?.service_provider_name || (selectedSecondScanMawb.includes('PICKME') ? 'PickMe' : selectedSecondScanMawb.includes('DOMEX') ? 'Domex' : selectedSecondScanMawb.includes('SITREK') ? 'SITREK' : selectedSecondScanMawb.includes('PRONTO') ? 'Pronto' : 'Partner');
                                                            const isPickMe = rawName.toLowerCase().includes('pickme');
                                                            const isDomex = rawName.toLowerCase().includes('domex');
                                                            const isSitrek = rawName.toLowerCase().includes('sitrek');
                                                            const isPronto = rawName.toLowerCase().includes('pronto');
                                                            const displayLabel = isPickMe ? 'PickMe' : isDomex ? 'Domex' : isSitrek ? 'SITREK' : isPronto ? 'Pronto' : rawName;
                                                            return (
                                                                <span style={{
                                                                    backgroundColor: isPickMe ? '#facc15' : isDomex ? '#7b0f1a' : isSitrek ? '#0f2b6e' : isPronto ? '#d97706' : '#4b5563',
                                                                    color: isPickMe ? '#111827' : '#ffffff',
                                                                    fontSize: '10px',
                                                                    fontWeight: '800',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '4px'
                                                                }}>
                                                                    {displayLabel}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '16px', display: 'flex', gap: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>Total Bags</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>{outboundBags.length} Bags</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>Total Parcels</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>{outboundBags.reduce((acc, b) => acc + (b.parcelCount || 0), 0)} Pcs</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Status badge & Close Manifest button */}
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
                                                        backgroundColor: secondScanManifestStatus === 'CLOSED' ? '#fee2e2' : '#f3f4f6',
                                                        color: secondScanManifestStatus === 'CLOSED' ? '#dc2626' : '#374151',
                                                        border: secondScanManifestStatus === 'CLOSED' ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontWeight: '700',
                                                        fontSize: '11px'
                                                    }}>
                                                        {secondScanManifestStatus || 'OPEN'}
                                                    </span>
                                                </div>

                                                {secondScanManifestStatus === 'OPEN' && (
                                                    <button
                                                        disabled={isClosingManifest}
                                                        onClick={() => {
                                                            if (isClosingManifest) return;
                                                            const relevantBags = (outboundBags || []).filter(b => !selectedSecondScanMawb || (b.mawbRef || '').toLowerCase() === selectedSecondScanMawb.toLowerCase());
                                                            const openBags = relevantBags.filter(b => b.status === 'OPEN' || b.status !== 'SEALED');
                                                            if (openBags.length > 0) {
                                                                setOpenBagsErrorModal({
                                                                    manifestRef: selectedSecondScanMawb,
                                                                    openBags: openBags.map(b => b.bagNumber)
                                                                });
                                                                return;
                                                            }
                                                            setCustomConfirmModal({
                                                                title: "Close Manifest?",
                                                                message: `Are you sure you want to CLOSE Manifest "${selectedSecondScanMawb}"? Once closed, no additional bags can be created under this manifest.`,
                                                                onConfirm: () => handleCloseManifest()
                                                            });
                                                        }}
                                                        style={{
                                                            backgroundColor: isClosingManifest ? '#f3f4f6' : '#ffffff',
                                                            border: isClosingManifest ? '1px solid #e5e7eb' : '1px solid #d1d5db',
                                                            color: isClosingManifest ? '#9ca3af' : '#374151',
                                                            borderRadius: '8px',
                                                            padding: '0 14px',
                                                            height: '38px',
                                                            boxSizing: 'border-box',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            cursor: isClosingManifest ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        {isClosingManifest ? '⏳ Closing Manifest...' : '🔒 Close Manifest'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Outbound Bags Selector Pills */}
                                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '14px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>
                                                Outbound LMD Bags for Manifest ({outboundBags.length} Bags):
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (!selectedSecondScanMawb) {
                                                        setErrorMessage("Please select or create an Outbound Manifest first.");
                                                        setStatus('ERROR');
                                                        return;
                                                    }
                                                    const prov = getManifestProviderName(selectedSecondScanMawb);
                                                    const initialPartner: 'PickMe' | 'Domex' | 'SITREK' | 'Pronto' = (prov === 'Domex' || prov === 'SITREK' || prov === 'Pronto' || prov === 'PickMe') ? prov : 'PickMe';
                                                    setNewBagPartner(initialPartner);
                                                    const mawbPrefix = selectedSecondScanMawb || `LMD-${initialPartner.toUpperCase()}`;
                                                    const nextSeq = String((outboundBags?.length || 0) + 1).padStart(2, '0');
                                                    const defaultBag = mawbPrefix.toUpperCase().includes(initialPartner.toUpperCase())
                                                        ? `${mawbPrefix}-BAG-${nextSeq}`
                                                        : `${mawbPrefix}-${initialPartner.toUpperCase()}-BAG-${nextSeq}`;
                                                    setCustomBagNumber(defaultBag);
                                                    setCreateBagModalOpen(true);
                                                }}
                                                disabled={Boolean(!selectedSecondScanMawb || secondScanManifestStatus === 'CLOSED' || isCreatingBag)}
                                                style={{
                                                    backgroundColor: (!selectedSecondScanMawb || secondScanManifestStatus === 'CLOSED' || isCreatingBag) ? '#9ca3af' : '#ffffff',
                                                    color: '#374151',
                                                    border: (!selectedSecondScanMawb || secondScanManifestStatus === 'CLOSED' || isCreatingBag) ? '1px solid #9ca3af' : '1px solid #d1d5db',
                                                    borderRadius: '8px',
                                                    padding: '10px 18px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: (!selectedSecondScanMawb || secondScanManifestStatus === 'CLOSED' || isCreatingBag) ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    boxShadow: '1px 1px 2px 1px rgba(226, 27, 34, 0.3)'
                                                }}
                                            >
                                                + Create New Outbound Bag
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {(() => {
                                                const uniqueOutboundBags: any[] = Array.from(new Map((outboundBags || []).map((b: any) => [b.bagNumber, b])).values());
                                                return uniqueOutboundBags.map((bag) => {
                                                    const isActive = activeOutboundBag?.bagNumber === bag.bagNumber;
                                                    const isSealed = bag.status === 'SEALED';
                                                    const partner = bag.targetPartner || 'ALL';
                                                    const pLower = partner.toLowerCase();

                                                    const partnerBgColor =
                                                        pLower.includes('pickme') ? '#facc15' :
                                                            pLower.includes('domex') ? '#7b0f1a' :
                                                                pLower.includes('sitrek') ? '#0f2b6e' :
                                                                    pLower.includes('pronto') ? '#d97706' : '#4b5563';

                                                    const partnerTextColor =
                                                        pLower.includes('pickme') ? '#111827' : '#ffffff';

                                                    const partnerBorderColor =
                                                        pLower.includes('pickme') ? '#eab308' :
                                                            pLower.includes('domex') ? '#7b0f1a' :
                                                                pLower.includes('sitrek') ? '#0f2b6e' :
                                                                    pLower.includes('pronto') ? '#d97706' : '#e21b22';

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
                                                                {(() => {
                                                                    const bagGrams = (bag.parcels && bag.parcels.length > 0)
                                                                        ? bag.parcels.reduce((acc: number, p: any) => acc + normalizeWeightToGrams(p.weight), 0)
                                                                        : normalizeWeightToGrams(bag.totalWeight);
                                                                    const pcs = bag.parcelCount || (bag.parcels || []).length || 0;
                                                                    return isSealed ? `SEALED (${formatGramsToKg(bagGrams)} kg)` : `${pcs} Pcs (${formatGramsToKg(bagGrams)} kg)`;
                                                                })()}
                                                            </span>
                                                        </button>
                                                    );
                                                });
                                            })()}

                                            {(outboundBags || []).length === 0 && (
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
                                                                backgroundColor: activeOutboundBag.targetPartner === 'PickMe' ? '#facc15' : activeOutboundBag.targetPartner === 'Domex' ? '#7b0f1a' : (activeOutboundBag.targetPartner === 'SITREK' || activeOutboundBag.targetPartner === 'Sitrek') ? '#0f2b6e' : activeOutboundBag.targetPartner === 'Pronto' ? '#d97706' : '#4b5563',
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
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0b0c0cff' }}>{activeOutboundBag.parcelCount || (activeOutboundBag.parcels || []).length || 0} Pcs</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>Total Weight</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                                                                {(() => {
                                                                    const totalGrams = (activeOutboundBag.parcels && activeOutboundBag.parcels.length > 0)
                                                                        ? activeOutboundBag.parcels.reduce((acc: number, p: any) => acc + normalizeWeightToGrams(p.weight), 0)
                                                                        : normalizeWeightToGrams(activeOutboundBag.totalWeight);
                                                                    return `${formatGramsToKg(totalGrams)} kg`;
                                                                })()}
                                                            </div>
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

                                                    {/* <button
                                                        onClick={() => {
                                                            if (activeOutboundBag.status === 'SEALED') {
                                                                setErrorMessage(`Cannot delete sealed bag. Outbound Bag "${activeOutboundBag.bagNumber}" is SEALED & CLOSED.`);
                                                                setStatus('ERROR');
                                                                return;
                                                            }
                                                            setCustomConfirmModal({
                                                                title: "Remove Outbound Bag?",
                                                                message: `Are you sure you want to REMOVE Outbound Bag "${activeOutboundBag.bagNumber}"? This bag will be permanently deleted from this manifest.`,
                                                                onConfirm: () => handleDeleteOutboundBag(activeOutboundBag.bagNumber)
                                                            });
                                                        }}
                                                        disabled={secondScanManifestStatus === 'CLOSED' || activeOutboundBag.status === 'SEALED'}
                                                        title={activeOutboundBag.status === 'SEALED' ? 'Sealed bags cannot be deleted or edited' : secondScanManifestStatus === 'CLOSED' ? 'Manifest is closed' : 'Remove Outbound Bag'}
                                                        style={{
                                                            backgroundColor: (secondScanManifestStatus === 'CLOSED' || activeOutboundBag.status === 'SEALED') ? '#f3f4f6' : '#ffffff',
                                                            border: (secondScanManifestStatus === 'CLOSED' || activeOutboundBag.status === 'SEALED') ? '1px solid #e5e7eb' : '1px solid #fca5a5',
                                                            color: (secondScanManifestStatus === 'CLOSED' || activeOutboundBag.status === 'SEALED') ? '#9ca3af' : '#dc2626',
                                                            borderRadius: '8px',
                                                            padding: '0 14px',
                                                            height: '38px',
                                                            boxSizing: 'border-box',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            cursor: (secondScanManifestStatus === 'CLOSED' || activeOutboundBag.status === 'SEALED') ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        🗑 Remove Bag
                                                    </button> */}
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
                                                        : validationCard.assignedPartner === 'SITREK' || validationCard.assignedPartner === 'Sitrek'
                                                            ? '#0f2b6e'
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
                                                        color: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'SITREK' || validationCard.assignedPartner === 'Sitrek' || validationCard.assignedPartner === 'Pronto' ? '#ffffff' : '#000000',
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
                                                            <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                                <source srcSet="/domex_logo.webp" type="image/webp" />
                                                                <img src="/domex_logo.png" alt="Domex" decoding="async" fetchPriority="high" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                            </picture>
                                                        ) : validationCard.assignedPartner === 'SITREK' || validationCard.assignedPartner === 'Sitrek' ? (
                                                            <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                                <source srcSet="/sitrek_logo.webp" type="image/webp" />
                                                                <img src="/sitrek_logo.png" alt="SITREK" decoding="async" fetchPriority="high" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                            </picture>
                                                        ) : validationCard.assignedPartner === 'Pronto' ? (
                                                            <span style={{ color: '#ea580c', fontWeight: '900', fontSize: '34px', letterSpacing: '1px' }}>PRONTO</span>
                                                        ) : (
                                                            <picture style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                                <source srcSet="/pick_me_logo.webp" type="image/webp" />
                                                                <img src="/pick_me_logo.png" alt="PickMe" decoding="async" fetchPriority="high" style={{ maxHeight: '95px', maxWidth: '90%', objectFit: 'contain' }} />
                                                            </picture>
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
                                                        color: validationCard.assignedPartner === 'Domex' || validationCard.assignedPartner === 'SITREK' || validationCard.assignedPartner === 'Sitrek' || validationCard.assignedPartner === 'Pronto' ? '#ffffff' : '#000000'
                                                    }}>
                                                        Zone: <span style={{ fontWeight: '800', marginLeft: '4px' }}>{validationCard.assignedZone || 'Default-Zone'}</span>
                                                    </div> */}

                                                    {/* Large Shipment Number (no background) */}
                                                    {(() => {
                                                        const isDarkPartner = validationCard.assignedPartner === 'Domex' ||
                                                            validationCard.assignedPartner === 'SITREK' ||
                                                            validationCard.assignedPartner === 'Sitrek' ||
                                                            validationCard.assignedPartner === 'Pronto';

                                                        const shipmentNumber = validationCard.trackingNumber ||
                                                            validationCard.parcel?.trackingNumber ||
                                                            validationCard.parcel?.skynetTrackingNumber ||
                                                            validationCard.parcel?.reference_number ||
                                                            validationCard.parcel?.senderReference || '';

                                                        if (!shipmentNumber) return null;

                                                        return (
                                                            <div style={{
                                                                fontSize: '30px',
                                                                fontWeight: '900',
                                                                letterSpacing: '1.5px',
                                                                color: isDarkPartner ? '#ffffff' : '#000000',
                                                                fontFamily: 'monospace, sans-serif',
                                                                textAlign: 'center',
                                                                wordBreak: 'break-all',
                                                                marginTop: '4px',
                                                                textShadow: isDarkPartner ? '0 2px 4px rgba(0,0,0,0.35)' : 'none'
                                                            }}>
                                                                {shipmentNumber}
                                                            </div>
                                                        );
                                                    })()}
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
                                            {['Tracking no.', 'Initial Manifest', 'LMD Partner', 'Zone', 'Weight (g)', 'Validation Status'].map(h => (
                                                <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeOutboundBag?.parcels?.map((parcel: any, idx: number) => {
                                            const partner = (parcel.assignedPartner && parcel.assignedPartner !== 'Unknown') ? parcel.assignedPartner : '-';
                                            const initManifest = parcel.initialManifest || parcel.mawbRef || '-';
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '8px', fontWeight: '600', color: '#111827' }}>
                                                        {(() => {
                                                            const refNum = (parcel.reference_number || parcel.shipment_ref || '').toString().trim();
                                                            if (refNum) return refNum;
                                                            if (parcel.displayTrackingNumber) {
                                                                return parcel.displayTrackingNumber.replace(/SKYT-?/gi, '').replace(/\/\s*$/, '').trim();
                                                            }
                                                            const tracking = (parcel.trackingNumber || parcel.tracking_number || '').toString().replace(/SKYT-?/gi, '').trim();
                                                            const senderRef = (parcel.senderReference || parcel.sender_reference || '').toString().replace(/SKYT-?/gi, '').trim();
                                                            if (senderRef && senderRef.toLowerCase() !== tracking.toLowerCase()) {
                                                                return `${senderRef} / ${tracking}`;
                                                            }
                                                            return tracking || '-';
                                                        })()}
                                                    </td>
                                                    <td style={{ padding: '8px', color: '#4b5563', fontSize: '11px', fontWeight: '600' }}>
                                                        <span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                                            {initManifest}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        {partner !== '-' ? (
                                                            <span style={{
                                                                backgroundColor: partner === 'PickMe' ? '#ffcc00' : partner === 'Domex' ? '#7b0f1a' : partner === 'SITREK' || partner === 'Sitrek' ? '#0f2b6e' : partner === 'Pronto' ? '#ea580c' : '#4b5563',
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
                                                    <td style={{ padding: '8px', fontWeight: '600' }}>{normalizeWeightToGrams(parcel.weight)} g</td>
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
                                                <td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
                                                    No parcels allocated to this outbound bag yet. Scan parcels above to fill bag.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
    );
}
