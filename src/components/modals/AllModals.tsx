'use client';
import React, { useState } from 'react';
import PaginationControl from '@/app/components/PaginationControl';
import { formatGramsToKg, normalizeWeightToGrams } from '@/lib/weightUtils';

export default function AllModals({
    activeTab,
    autoFinishBag,
    bagBarcodeInputRef,
    btnPrimary,
    btnSecondary,
    confirmFinishModal,
    createBagModalOpen,
    createManifestModalOpen,
    currentUser,
    customBagNumber,
    customManifestName,
    customConfirmModal,
    customDiscrepancyNote,
    damagedSelectedPhotosModal,
    discrepancyReason,
    duplicateBagError,
    duplicateManifestError,
    duplicateModal,
    expandedBags,
    extraParcelModal,
    extraParcelNote,
    firstScanBagParcels,
    firstScanExpected,
    firstScanHistory,
    firstScanInputRef,
    firstScanMawb,
    firstScanSelectedBag,
    generateCode128SVG,
    getManifestProviderName,
    getNextManifestPreviewCode,
    handleClearTestInput,
    handleConfirmFinish,
    handleCreateOutboundBag,
    handleCreateOutboundManifest,
    handleFirstScanSubmitOverride,
    handleForceUnsealWithNote,
    handleRenewPinSubmit,
    handleSwitchUserSubmit,
    handleTestScannerKeyDown,
    history,
    inputStyle,
    invalidBagParcelModal,
    invalidBarcodeModal,
    isCreatingBag,
    isCreatingManifest,
    isSealingBag,
    isClosingManifest,
    isDeviceManagerOpen,
    label,
    manifestClosedModal,
    manifestProgressModal,
    missedFirstScanModal,
    missingParcelReasons,
    newBagPartner,
    openBagsErrorModal,
    outboundBags,
    overageCheckModal,
    partnerMismatchModal,
    printLabelModal,
    printOutboundBagLabelModal,
    renewForm,
    renewPinModal,
    resolvePartnerName,
    scanInputRef,
    selectedProviderForManifest,
    selectedSecondScanMawb,
    setBagBarcodeInput,
    setBarcodeInput,
    setConfirmFinishModal,
    setCreateBagModalOpen,
    setCreateManifestModalOpen,
    setCustomBagNumber,
    setCustomManifestName,
    setCustomConfirmModal,
    setCustomDiscrepancyNote,
    setDamagedSelectedPhotosModal,
    setDiscrepancyReason,
    setDuplicateBagError,
    setDuplicateManifestError,
    setDuplicateModal,
    setExtraParcelModal,
    setExtraParcelNote,
    setFirstScanInput,
    setInvalidBagParcelModal,
    setInvalidBarcodeModal,
    setIsClosingManifest,
    setIsDeviceManagerOpen,
    setLastScanned,
    setManifestClosedModal,
    setManifestProgressModal,
    setMissedFirstScanModal,
    setMissingParcelReasons,
    setNewBagPartner,
    setOpenBagsErrorModal,
    setOverageCheckModal,
    setPartnerMismatchModal,
    setPrintLabelModal,
    setPrintOutboundBagLabelModal,
    setRenewForm,
    setRenewPinModal,
    setSelectedProviderForManifest,
    setSuccessModal,
    setSwitchUserFirstName,
    setSwitchUserModal,
    setSwitchUserPassword,
    setTestScannerInput,
    setUnallocatedBagNote,
    setUnallocatedBagUnsealModal,
    setUnallocatedPartnerModal,
    setVerifyBarcodeInput,
    setViewingUnsealedParcelsModal,
    status,
    successModal,
    switchUserFirstName,
    switchUserModal,
    switchUserPassword,
    testScannerInput,
    testScannerSpeed,
    unallocatedBagNote,
    unallocatedBagUnsealModal,
    unallocatedPartnerModal,
    verifyInputRef,
    viewingUnsealedParcelsModal
}: any) {
    const [isRetryingFfdx, setIsRetryingFfdx] = useState(false);

    const handleRetryFfdxUpload = async (targetMawb: string, providerName?: string) => {
        if (isRetryingFfdx || !targetMawb) return;
        setIsRetryingFfdx(true);
        if (setManifestProgressModal) {
            setManifestProgressModal((prev: any) => prev ? ({ ...prev, status: 'ffdx_uploading', error: undefined }) : null);
        }
        try {
            const res = await fetch('/api/ffdx-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manifestReference: targetMawb,
                    serviceProviderName: providerName || 'All Partners'
                })
            });
            const data = await res.json();
            if (data.success) {
                if (setManifestProgressModal) {
                    setManifestProgressModal((prev: any) => prev ? ({
                        ...prev,
                        status: 'completed',
                        error: undefined,
                        summary: { ...prev.summary, ffdxSuccess: true, ffdxError: undefined }
                    }) : null);
                }
            } else {
                if (setManifestProgressModal) {
                    setManifestProgressModal((prev: any) => prev ? ({
                        ...prev,
                        status: 'error',
                        error: data.error || 'Retry upload failed.'
                    }) : null);
                }
            }
        } catch (e: any) {
            if (setManifestProgressModal) {
                setManifestProgressModal((prev: any) => prev ? ({
                    ...prev,
                    status: 'error',
                    error: e?.message || 'Network error during retry.'
                }) : null);
            }
        } finally {
            setIsRetryingFfdx(false);
        }
    };

    return (
        <>
            {/* ── DEVICE MANAGER MODAL ── */}
            {
                isDeviceManagerOpen && (
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
                )
            }

            {/* ── DUPLICATE / MISMATCH WARNING MODAL ── */}
            {
                duplicateModal && (() => {
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
                })()
            }

            {/* ── INVALID / COMBINED BARCODE ERROR MODAL ── */}
            {
                invalidBarcodeModal && (() => {
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
                })()
            }

            {/* ── REAL-TIME MANIFEST CLOSE & GETONLINE UPLOAD PROGRESS MODAL ── */}
            {
                manifestProgressModal && (() => {
                    const { mawbRef, closedBy, closedAt, provider, totalBags, totalParcels, processedParcels, status, bags, expandedBags, error, summary } = manifestProgressModal;
                    const percent = totalParcels > 0 ? Math.min(100, Math.round((processedParcels / totalParcels) * 100)) : 100;
                    const isFinished = status === 'completed' || status === 'error';
                    const isUploading = status === 'ffdx_uploading' || isRetryingFfdx;

                    const toggleBag = (bagNumber: string) => {
                        setManifestProgressModal((prev: any) => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                expandedBags: { ...prev.expandedBags, [bagNumber]: !prev.expandedBags[bagNumber] }
                            };
                        });
                    };

                    return (
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.70)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 4500,
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            <style>{`
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                                @keyframes pulseGlow {
                                    0%, 100% { box-shadow: 0 0 15px rgba(37, 99, 235, 0.25); }
                                    50% { box-shadow: 0 0 25px rgba(37, 99, 235, 0.50); }
                                }
                            `}</style>
                            <div style={{
                                backgroundColor: '#ffffff',
                                border: isUploading ? '2px solid #2563eb' : status === 'completed' ? '2px solid #16a34a' : status === 'error' ? '2px solid #dc2626' : '2px solid #111827',
                                borderRadius: '14px',
                                padding: '24px',
                                width: '600px',
                                maxWidth: '95%',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                boxShadow: isUploading ? '0 25px 50px -12px rgba(37, 99, 235, 0.35)' : '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                                overflow: 'hidden',
                                transition: 'border-color 0.3s ease'
                            }}>
                                {/* Modal Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>Closing Outbound Manifest</span>
                                        </h3>
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', fontWeight: '600' }}>
                                            Operator: <strong>{closedBy}</strong> | Time: {closedAt}
                                        </div>
                                    </div>
                                    <span style={{
                                        backgroundColor: isUploading ? '#dbeafe' : isFinished ? (status === 'completed' && !error && !summary?.ffdxError ? '#dcfce7' : '#fee2e2') : '#fef3c7',
                                        color: isUploading ? '#1e40af' : isFinished ? (status === 'completed' && !error && !summary?.ffdxError ? '#166534' : '#991b1b') : '#92400e',
                                        border: isUploading ? '1px solid #93c5fd' : 'none',
                                        fontSize: '11px', fontWeight: '800', padding: '5px 12px', borderRadius: '12px', textTransform: 'uppercase',
                                        display: 'inline-flex', alignItems: 'center', gap: '5px'
                                    }}>
                                        {isUploading && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block', animation: 'spin 1s linear infinite' }} />}
                                        {status === 'initializing' ? 'Initializing...' : status === 'enriching' ? 'Updating Parcels...' : isUploading ? '📡 Transmitting to GETonline...' : status === 'completed' && !error && !summary?.ffdxError ? 'Completed ✅' : 'Notice / Error ⚠️'}
                                    </span>
                                </div>

                                {/* Manifest & Provider Banner */}
                                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Outbound MAWB Reference
                                        </div>
                                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                                            {mawbRef}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>LMD Partner</div>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>{provider}</div>
                                    </div>
                                </div>

                                {/* ── DEDICATED MANIFEST UPLOADING POPUP / BANNER ── */}
                                {isUploading && (
                                    <div style={{
                                        backgroundColor: '#eff6ff',
                                        border: '2px solid #2563eb',
                                        borderRadius: '10px',
                                        padding: '16px 18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.18)',
                                        animation: 'pulseGlow 2s infinite'
                                    }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '50%',
                                            border: '4px solid #bfdbfe',
                                            borderTopColor: '#2563eb',
                                            animation: 'spin 0.85s linear infinite',
                                            flexShrink: 0
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>Transmitting Manifest XML to SkyNet GETonline...</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '4px', lineHeight: '1.4' }}>
                                                Bundling and transmitting all {totalBags} bags ({totalParcels} parcels) to SkyNet GETonline web service. <strong>Please wait, do not close or reload this window.</strong>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Main Progress Bar */}
                                <div style={{ backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', fontWeight: '700' }}>
                                        <span style={{ color: '#334155' }}>
                                            {isUploading ? 'Transmitting XML to GETonline API...' : status === 'completed' ? ' All Parcels & Bags Successfully Processed' : status === 'error' ? '❌ Error Occurred' : '📦 Processing Bags & Parcels...'}
                                        </span>
                                        <span style={{ color: '#0f172a', fontWeight: '900', fontSize: '14px' }}>
                                            {processedParcels} / {totalParcels} ({percent}%)
                                        </span>
                                    </div>
                                    <div style={{ height: '14px', backgroundColor: '#cbd5e1', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{
                                            width: `${percent}%`,
                                            height: '100%',
                                            backgroundColor: status === 'error' ? '#ef4444' : percent === 100 ? '#10b981' : '#2563eb',
                                            transition: 'width 0.3s ease-in-out',
                                            backgroundImage: status !== 'completed' && status !== 'error' ? 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)' : 'none',
                                            backgroundSize: '20px 20px',
                                            animation: status !== 'completed' && status !== 'error' ? 'moveStripes 1s linear infinite' : 'none'
                                        }} />
                                    </div>
                                </div>

                                {/* Success Confirmation Banner */}
                                {status === 'completed' && !error && !summary?.ffdxError && (
                                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '22px' }}>✅</div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>
                                                Manifest Closed & Synced Successfully
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                                                All {totalBags} bags and {totalParcels} parcels have been sealed, recorded, and confirmed on GETonline (FFDX).
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error / Notice Banner with Instant Retry Option */}
                                {(error || summary?.ffdxError) && (
                                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b' }}>
                                                    GETonline Upload Notice
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '3px', lineHeight: '1.4' }}>
                                                    {error || summary?.ffdxError}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #fecaca',
                                            borderRadius: '8px',
                                            padding: '10px 14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '10px'
                                        }}>
                                            <div style={{ fontSize: '11px', color: '#6b7280', flex: 1, minWidth: '220px' }}>
                                                The manifest is safely closed and saved in the database. You can retry the GETonline upload directly:
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isRetryingFfdx}
                                                onClick={() => handleRetryFfdxUpload(mawbRef, provider)}
                                                style={{
                                                    backgroundColor: isRetryingFfdx ? '#9ca3af' : '#dc2626',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '8px 16px',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    cursor: isRetryingFfdx ? 'not-allowed' : 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                {isRetryingFfdx ? '🔄 Retrying Upload...' : '🔄 Retry Upload to GETonline'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Dropdown Lists for Each Bag & Each Parcel */}
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', paddingRight: '4px' }}>
                                    {bags.map((bag: any, bIdx: number) => {
                                        const isExpanded = !!expandedBags[bag.bagNumber];
                                        const bagOkCount = (bag.parcels || []).filter((p: any) => p.status === 'ok').length;

                                        return (
                                            <div key={bag.bagNumber || bIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                                                {/* Bag Accordion Header */}
                                                <div
                                                    onClick={() => toggleBag(bag.bagNumber)}
                                                    style={{
                                                        backgroundColor: '#f8fafc',
                                                        padding: '10px 14px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '12px', color: '#64748b', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
                                                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontFamily: 'monospace' }}>💼 {bag.bagNumber}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                                                            {bagOkCount} / {bag.parcelCount} parcels updated
                                                        </span>
                                                        <span style={{ fontSize: '13px' }}>
                                                            {bag.status === 'done' ? '✅' : bag.status === 'processing' ? '🔄' : '⏳'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Bag Accordion Dropdown Content — Each Parcel List */}
                                                {isExpanded && (
                                                    <div style={{ backgroundColor: '#fafafa', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {bag.parcels.length === 0 ? (
                                                             <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '4px' }}>Reading parcel items...</div>
                                                        ) : (
                                                            bag.parcels.map((p: any, pIdx: number) => (
                                                                <div key={p.trackingNumber || pIdx} style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '6px 10px',
                                                                    backgroundColor: p.status === 'ok' ? '#f0fdf4' : p.status === 'enriching' ? '#eff6ff' : p.status === 'error' ? '#fef2f2' : '#ffffff',
                                                                    border: `1px solid ${p.status === 'ok' ? '#bbf7d0' : p.status === 'enriching' ? '#bfdbfe' : p.status === 'error' ? '#fecdd3' : '#e2e8f0'}`,
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>#{pIdx + 1}</span>
                                                                        <strong style={{ fontFamily: 'monospace', color: '#1e293b' }}>{p.trackingNumber}</strong>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {p.status === 'enriching' && <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '11px' }}>🔄 Enriching & Syncing...</span>}
                                                                        {p.status === 'ok' && <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '11px' }}>✅ GETonline Updated</span>}
                                                                        {p.status === 'skipped' && <span style={{ color: '#d97706', fontWeight: '700', fontSize: '11px' }}>⚠️ Skipped</span>}
                                                                        {p.status === 'pending' && <span style={{ color: '#94a3b8', fontSize: '11px' }}>⏳ Pending</span>}
                                                                        {p.status === 'error' && <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '11px' }}>❌ {p.message || 'Error'}</span>}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Footer Action Button — Appears when operation completed or error */}
                                {isFinished && (
                                    <button
                                        autoFocus
                                        onClick={() => {
                                            if (setIsClosingManifest) setIsClosingManifest(false);
                                            setManifestProgressModal(null);
                                        }}
                                        style={{
                                            backgroundColor: status === 'completed' ? '#10b981' : '#e21b22',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '12px 24px',
                                            fontSize: '14px',
                                            fontWeight: '700',
                                            width: '100%',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        Acknowledge & Finish Session (Press Enter)
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })()
            }

            {/* ── MANIFEST CLOSED SUMMARY MODAL ── */}
            {
                manifestClosedModal && (() => {
                    const rawProvider = manifestClosedModal.provider || getManifestProviderName(manifestClosedModal.mawbRef);
                    const providerDisplay = rawProvider === 'PickMe' ? 'PickMe Express'
                        : rawProvider === 'Domex' ? 'Domex Express'
                            : rawProvider === 'SITREK' || rawProvider === 'Sitrek' ? 'SITREK Courier'
                                : rawProvider === 'Pronto' ? 'Pronto Lanka'
                                    : rawProvider === 'ALL' ? 'General (All Partners)'
                                        : rawProvider;

                    return (
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
                                border: '2px solid #111827',
                                borderRadius: '12px',
                                padding: '24px',
                                width: '460px',
                                maxWidth: '92%',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }}>
                                {/* Modal Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>🔒</span>
                                        <span>Manifest Session Closed</span>
                                    </h3>
                                    <button onClick={() => setManifestClosedModal(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}>✕</button>
                                </div>

                                {/* MAWB Reference Banner */}
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            OUTBOUND MANIFEST MAWB
                                        </div>
                                        <div style={{ fontSize: '15px', fontWeight: '900', color: '#e21b22', fontFamily: 'monospace', marginTop: '2px' }}>
                                            {manifestClosedModal.mawbRef}
                                        </div>
                                    </div>
                                    <span style={{ backgroundColor: '#e21b22', color: '#ffffff', fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                        CLOSED
                                    </span>
                                </div>

                                {/* Main Details Body */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {/* Dedicated Service Provider Card */}
                                    <div style={{
                                        backgroundColor: providerDisplay.includes('PickMe') ? '#fefce8' : providerDisplay.includes('Domex') ? '#fff1f2' : providerDisplay.includes('SITREK') || providerDisplay.includes('Sitrek') ? '#eff6ff' : providerDisplay.includes('Pronto') ? '#fff7ed' : '#f3f4f6',
                                        border: `1px solid ${providerDisplay.includes('PickMe') ? '#fef08a' : providerDisplay.includes('Domex') ? '#fecdd3' : providerDisplay.includes('SITREK') || providerDisplay.includes('Sitrek') ? '#bfdbfe' : providerDisplay.includes('Pronto') ? '#fed7aa' : '#e5e7eb'}`,
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Service Provider / LMD Partner
                                            </div>
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: '900',
                                                color: providerDisplay.includes('PickMe') ? '#713f12' : providerDisplay.includes('Domex') ? '#881337' : providerDisplay.includes('SITREK') || providerDisplay.includes('Sitrek') ? '#1e3a8a' : providerDisplay.includes('Pronto') ? '#9a3412' : '#111827',
                                                marginTop: '2px'
                                            }}>
                                                {providerDisplay}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '24px' }}>
                                            {providerDisplay.includes('PickMe') ? '🚕' : providerDisplay.includes('Domex') ? '🚚' : providerDisplay.includes('SITREK') || providerDisplay.includes('Sitrek') ? '🚛' : providerDisplay.includes('Pronto') ? '📦' : '🏢'}
                                        </div>
                                    </div>

                                    {/* Session Operator & Timestamp Info Card */}
                                    <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '600' }}>Closed By Operator:</span>
                                            <strong style={{ color: '#111827' }}>{manifestClosedModal.closedBy}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontWeight: '600' }}>Closed Timestamp:</span>
                                            <strong style={{ color: '#374151' }}>{manifestClosedModal.closedAt}</strong>
                                        </div>
                                    </div>

                                    {/* Volume Stats Grid */}
                                    <div style={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 1fr',
                                        gap: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Total Bags</div>
                                            <div style={{ fontSize: '17px', fontWeight: '900', color: '#111827', marginTop: '2px' }}>
                                                {manifestClosedModal.totalBags}
                                            </div>
                                        </div>
                                        <div style={{ borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Total Parcels</div>
                                            <div style={{ fontSize: '17px', fontWeight: '900', color: '#047857', marginTop: '2px' }}>
                                                {manifestClosedModal.totalParcels}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Total Weight</div>
                                            <div style={{ fontSize: '17px', fontWeight: '900', color: '#e21b22', marginTop: '2px' }}>
                                                {formatGramsToKg(manifestClosedModal.totalWeight)} <span style={{ fontSize: '11px', fontWeight: '700' }}>kg</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <button
                                    autoFocus
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
                    );
                })()
            }

            {/* ── CONFIRM FINISH MODAL ── */}
            {
                confirmFinishModal && (() => {
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

                    // Filter missing parcels for this bag
                    const scannedRefs = new Set(firstScanHistory.map(p => (p.skynetTrackingNumber || p.trackingNumber || '').trim().toUpperCase()));
                    const missingParcels = isShortage ? (firstScanBagParcels || []).filter(p => !scannedRefs.has((p.skynetTrackingNumber || p.trackingNumber || '').trim().toUpperCase())) : [];

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
                                padding: '24px 24px',
                                width: isShortage && missingParcels.length > 0 ? '660px' : '500px',
                                maxWidth: '92%',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                textAlign: 'center'
                            }}>
                                {/* Icon */}
                                <div style={{
                                    backgroundColor: iconBg,
                                    color: accentColor,
                                    width: '52px', height: '52px',
                                    borderRadius: '50%',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '12px'
                                }}>
                                    {isExact ? (
                                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    ) : (
                                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
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
                                    borderRadius: '8px', padding: '8px 18px', margin: '0 0 14px 0', fontSize: '13px'
                                }}>
                                    <span>Expected: <strong style={{ color: '#111827' }}>{firstScanExpected}</strong></span>
                                    <span style={{ color: '#9ca3af' }}>|</span>
                                    <span>Scanned: <strong style={{ color: accentColor }}>{firstScanHistory.length}</strong></span>
                                    {!isExact && (
                                        <>
                                            <span style={{ color: '#9ca3af' }}>|</span>
                                            <span style={{ fontWeight: '700', color: accentColor }}>
                                                {isShortage ? `${Math.abs(diff)} Missing` : `+${diff} Extra`}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Message */}
                                <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                                    {isExact
                                        ? `All ${firstScanHistory.length} parcels verified. Bag "${firstScanSelectedBag}" will be marked as COUNTED.`
                                        : isShortage
                                            ? `Bag "${firstScanSelectedBag}" has ${Math.abs(diff)} fewer parcel${Math.abs(diff) !== 1 ? 's' : ''} than expected. Please specify shortage reasons below before closing.`
                                            : `Bag "${firstScanSelectedBag}" has ${diff} extra parcel${diff !== 1 ? 's' : ''} beyond the expected count. Please select an overage reason before closing.`
                                    }
                                </p>

                                {/* Discrepancy Reason Form */}
                                {!isExact && (
                                    <div style={{ textAlign: 'left', marginBottom: '18px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                            {isShortage ? 'Default Shortage Reason' : 'Overage Reason'} <span style={{ color: '#e21b22' }}>*</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: isShortage ? '1fr 1fr' : '1fr', gap: '6px' }}>
                                            {options.map((opt) => (
                                                <label key={opt} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '8px 10px',
                                                    backgroundColor: discrepancyReason === opt ? (isShortage ? '#eff6ff' : '#fffbeb') : '#f9fafb',
                                                    border: `1px solid ${discrepancyReason === opt ? accentColor : '#e5e7eb'}`,
                                                    borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
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
                                                rows={2}
                                                style={{
                                                    width: '100%', marginTop: '8px', padding: '8px 10px',
                                                    border: `1px solid ${accentColor}`, borderRadius: '8px',
                                                    fontSize: '12px', color: '#111827', resize: 'vertical',
                                                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                                                }}
                                            />
                                        )}

                                        {/* Missing Parcels List & Per-Parcel Reason Dropdown */}
                                        {isShortage && missingParcels.length > 0 && (
                                            <div style={{ marginTop: '16px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>Missing Parcels Breakdown ({missingParcels.length})</span>
                                                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500', transform: 'none', textTransform: 'none' }}>Set individual status per parcel</span>
                                                </div>
                                                <div style={{
                                                    maxHeight: '210px',
                                                    overflowY: 'auto',
                                                    border: '1px solid #fca5a5',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#fef2f2',
                                                    padding: '8px'
                                                }}>
                                                    {missingParcels.map((mp: any, idx: number) => {
                                                        const ref = mp.skynetTrackingNumber || mp.trackingNumber;
                                                        const partner = mp.assignedPartner || 'Unknown';
                                                        const currentReason = missingParcelReasons[ref] || discrepancyReason || 'Missing Parcels';
                                                        return (
                                                            <div key={ref || idx} style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '8px 10px',
                                                                backgroundColor: '#ffffff',
                                                                borderRadius: '6px',
                                                                border: '1px solid #fee2e2',
                                                                marginBottom: idx < missingParcels.length - 1 ? '6px' : 0
                                                            }}>
                                                                <div style={{ textAlign: 'left', flex: 1, paddingRight: '10px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: '#111827' }}>{ref}</span>
                                                                        {partner !== 'Unknown' && (() => {
                                                                            const pLower = partner.toLowerCase();
                                                                            const isPickMe = pLower.includes('pickme');
                                                                            const isDomex = pLower.includes('domex');
                                                                            const isSitrek = pLower.includes('sitrek');
                                                                            const isPronto = pLower.includes('pronto');
                                                                            const bgColor = isPickMe ? '#facc15' : isDomex ? '#e21b22' : isSitrek ? '#0f2b6e' : isPronto ? '#ea580c' : '#6b7280';
                                                                            const textColor = isPickMe ? '#000000' : '#ffffff';
                                                                            return (
                                                                                <span style={{
                                                                                    fontSize: '10px',
                                                                                    fontWeight: '800',
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '4px',
                                                                                    backgroundColor: bgColor,
                                                                                    color: textColor,
                                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                                                }}>
                                                                                    {partner}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                                        {mp.recipientName || 'Unknown Recipient'} &bull; {mp.city || 'Unknown City'}
                                                                    </div>
                                                                </div>
                                                                <div style={{ minWidth: '170px' }}>
                                                                    <select
                                                                        value={currentReason}
                                                                        onChange={(e) => setMissingParcelReasons(prev => ({ ...prev, [ref]: e.target.value }))}
                                                                        style={{
                                                                            width: '100%',
                                                                            fontSize: '11px',
                                                                            padding: '5px 8px',
                                                                            borderRadius: '6px',
                                                                            border: '1px solid #d1d5db',
                                                                            backgroundColor: '#ffffff',
                                                                            color: '#1f2937',
                                                                            fontWeight: '600',
                                                                            outline: 'none',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <option value="Missing Parcels">Missing Parcels</option>
                                                                        <option value="Stolen or Lost in Transit">Stolen or Lost in Transit</option>
                                                                        <option value="Damaged & Discarded">Damaged & Discarded</option>
                                                                        <option value="Other (Custom Note)">Other Reason</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
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
                })()
            }

            {/* ── OVERAGE CHECK MODAL (fires when count hits expected) ── */}
            {
                overageCheckModal && (
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
                )
            }

            {/* ── INVALID PARCEL / SCAN ERROR MODAL ── */}
            {
                invalidBagParcelModal && (
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
                )
            }

            {/* ── INTERACTIVE EXTRA PARCEL RESOLUTION MODAL ── */}
            {
                extraParcelModal && (() => {
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
                })()
            }

            {/* ── SWITCH OPERATOR MODAL ── */}
            {
                switchUserModal && (
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
                )
            }

            {/* ── RENEW PASSWORD/PIN MODAL ── */}
            {
                renewPinModal && (
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
                )
            }

            {/* ── CUSTOM CONFIRM MODAL ── */}
            {
                customConfirmModal && (
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
                                    disabled={isClosingManifest}
                                    onClick={() => {
                                        if (isClosingManifest) return;
                                        const action = customConfirmModal.onConfirm;
                                        setCustomConfirmModal(null);
                                        action();
                                    }}
                                    style={{
                                        flex: 1,
                                        backgroundColor: isClosingManifest ? '#9ca3af' : '#e21b22',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '12px 18px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: isClosingManifest ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {isClosingManifest ? 'Processing...' : 'Yes, Confirm (Enter/Space)'}
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
                )
            }

            {/* ── UNALLOCATED PARCELS IN BAG WARNING MODAL ── */}
            {
                unallocatedBagUnsealModal && (
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
                )
            }

            {/* ── UNALLOCATED PARTNER MODAL ── */}
            {
                unallocatedPartnerModal && (
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
                )
            }

            {/* ── SUCCESS MODAL ── */}
            {
                successModal && (
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
                )
            }

            {/* ── PRINT REPLACEMENT LABEL MODAL ── */}
            {
                printLabelModal && (
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

                            {/* Printable Thermal Shipping Label Card Area — Exact GETonline Format */}
                            <div
                                id="thermal-label-print-area"
                                style={{
                                    border: '2px solid #000000',
                                    borderRadius: '2px',
                                    padding: '14px 16px',
                                    backgroundColor: '#ffffff',
                                    color: '#000000',
                                    fontFamily: "'Arial', 'Helvetica', sans-serif"
                                }}
                            >
                                {/* Top Header: SkyNet Logo + Web URL */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div>
                                        <img
                                            src="/logo.png"
                                            alt="SKYNET WORLDWIDE EXPRESS"
                                            style={{ height: '36px', maxWidth: '170px', objectFit: 'contain', display: 'block' }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#000000', letterSpacing: '-0.2px' }}>
                                        www.skynetexpress.com/
                                    </div>
                                </div>

                                {/* Section 1: DELIVER TO + ACCOUNT & Destination Code */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    {/* Deliver To Details */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '0.5px', color: '#000000', marginBottom: '2px' }}>
                                            DELIVER TO
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            {printLabelModal.recipientName || '—'}
                                        </div>
                                        <div style={{ fontSize: '10.5px', lineHeight: '1.3', color: '#000000', textTransform: 'uppercase' }}>
                                            {(() => {
                                                let rawLines: string[] = [];
                                                const cityUpper = (printLabelModal.city || '').trim().toUpperCase();
                                                const distUpper = (printLabelModal.district || '').trim().toUpperCase();
                                                const provUpper = (printLabelModal.province || '').trim().toUpperCase();
                                                const countryUpper = (printLabelModal.country || 'SRI LANKA').trim().toUpperCase();

                                                if (printLabelModal.recipientAddress) {
                                                    const splitNewlines = printLabelModal.recipientAddress
                                                        .split(/[\r\n]+/)
                                                        .map(l => l.trim())
                                                        .filter(Boolean);

                                                    if (splitNewlines.length === 1 && splitNewlines[0].includes(',')) {
                                                        const parts = splitNewlines[0].split(',').map(p => p.trim()).filter(Boolean);
                                                        const cleanParts = parts.filter(p => {
                                                            const up = p.toUpperCase();
                                                            return up !== 'SRI LANKA' && up !== 'SRILANKA' && up !== countryUpper && up !== provUpper;
                                                        });
                                                        if (cleanParts.length >= 2) {
                                                            const line1 = cleanParts.slice(0, cleanParts.length - 1).join(', ');
                                                            const line2 = cleanParts[cleanParts.length - 1];
                                                            rawLines = [line1, line2];
                                                        } else if (cleanParts.length === 1) {
                                                            rawLines = cleanParts;
                                                        } else {
                                                            rawLines = splitNewlines;
                                                        }
                                                    } else {
                                                        rawLines = splitNewlines;
                                                    }
                                                }

                                                const cleanLines = rawLines.filter(line => {
                                                    const up = line.trim().toUpperCase();
                                                    if (!up) return false;
                                                    if (up === 'SRI LANKA' || up === 'SRILANKA' || up === countryUpper) return false;
                                                    if (provUpper && up === provUpper) return false;
                                                    return true;
                                                });

                                                return (
                                                    <>
                                                        {cleanLines.map((line, idx) => (
                                                            <div key={idx}>{line}</div>
                                                        ))}
                                                    </>
                                                );
                                            })()}
                                            <div style={{ marginTop: '1px' }}>
                                                {printLabelModal.province ? `${printLabelModal.province.toUpperCase()} ` : ''}
                                                <strong style={{ fontWeight: '900' }}>
                                                    {printLabelModal.city ? printLabelModal.city.toUpperCase() : (printLabelModal.district ? printLabelModal.district.toUpperCase() : '')}
                                                </strong>
                                            </div>
                                            <div>{printLabelModal.country ? printLabelModal.country.toUpperCase() : 'SRI LANKA'}</div>
                                        </div>
                                    </div>

                                    {/* Account + Destination Zone (LK1 / CMB from shipments.dest_location_code) */}
                                    <div style={{ width: '150px', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: '85px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', color: '#000000' }}>
                                            ACCOUNT : <span style={{ fontWeight: '800' }}>{printLabelModal.account || '—'}</span>
                                        </div>

                                        <div style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '1px', lineHeight: '1', color: '#000000', marginTop: 'auto' }}>
                                            {printLabelModal.destLocationCode ? printLabelModal.destLocationCode.toUpperCase() : (printLabelModal.assignedZone ? printLabelModal.assignedZone.toUpperCase() : '—')}
                                        </div>
                                    </div>
                                </div>

                                {/* Dividing Line */}
                                <div style={{ borderTop: '2px solid #000000', margin: '6px 0' }} />

                                {/* Section 2: DELIVERY INSTRUCTIONS / Piece Count / Weight & Value & Service */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '9.5px' }}>
                                    {/* Left: Delivery Instructions */}
                                    <div style={{ flex: 1.2, minWidth: 0 }}>
                                        <div style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.3px', textTransform: 'uppercase', color: '#000000' }}>
                                            DELIVERY INSTRUCTIONS
                                        </div>
                                        <div style={{ fontSize: '9.5px', marginTop: '2px', color: '#000000', wordBreak: 'break-word', lineHeight: '1.25' }}>
                                            {printLabelModal.deliveryInstructions || printLabelModal.goodsDesc || '—'}
                                        </div>
                                    </div>

                                    {/* Center: Piece Count */}
                                    <div style={{ flex: 0.8, textAlign: 'center', fontSize: '15px', fontWeight: '900', color: '#000000', paddingTop: '1px' }}>
                                        {printLabelModal.numOfItems ? `${printLabelModal.numOfItems} Pc` : '1 Pc'}
                                    </div>

                                    {/* Right: Weight, Customs Value, Service EN from shipments */}
                                    <div style={{ flex: 1.2, textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#000000' }}>
                                            ({printLabelModal.numOfItems || 1}) {(() => {
                                                const raw = Number(printLabelModal.weight) || 0;
                                                const kg = raw >= 10 ? raw / 1000 : raw;
                                                return `${kg.toFixed(2)} KG`;
                                            })()}
                                        </div>
                                        <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#000000', marginTop: '1px' }}>
                                            {(() => {
                                                const valStr = (printLabelModal.value || '').toString().trim();
                                                if (!valStr) return '—';
                                                const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
                                                return isNaN(num) ? valStr : `${num.toFixed(2)} LKR`;
                                            })()}
                                        </div>
                                        <div style={{ fontSize: '24px', fontWeight: '900', lineHeight: '1', marginTop: '2px', color: '#000000' }}>
                                            {printLabelModal.serviceType || 'EN'}
                                        </div>
                                    </div>
                                </div>

                                {/* Dividing Line */}
                                <div style={{ borderTop: '2px solid #000000', margin: '6px 0' }} />

                                {/* Section 3: Barcode + Customs Notice */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                                    {/* Barcode SVG + Barcode Number */}
                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                                        <div
                                            style={{ width: '100%', overflow: 'hidden' }}
                                            dangerouslySetInnerHTML={{ __html: generateCode128SVG((printLabelModal.trackingNumber || '').toString().replace(/^skyt-?/i, '').trim()) }}
                                        />
                                        <div style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '1.2px', marginTop: '2px', color: '#000000' }}>
                                            {(printLabelModal.trackingNumber || '').toString().replace(/^skyt-?/i, '').trim()}
                                        </div>
                                    </div>

                                    {/* Customs Duties Notice Box */}
                                    <div style={{ width: '100px', textAlign: 'left', fontSize: '8.5px', fontWeight: '800', lineHeight: '1.2', color: '#000000' }}>
                                        <div>****************</div>
                                        <div style={{ margin: '1px 0' }}>
                                            Customs<br />
                                            Duties/Taxes<br />
                                            Paid by<br />
                                            Consignor
                                        </div>
                                        <div>****************</div>
                                    </div>
                                </div>

                                {/* Section 4: SENDER + Legal Clause */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
                                    {/* Sender Details from shipments consignor fields */}
                                    <div style={{ flex: 1.3, minWidth: 0, fontSize: '9px', lineHeight: '1.3', color: '#000000' }}>
                                        <div style={{ fontSize: '9.5px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '1px' }}>
                                            SENDER
                                        </div>
                                        <div>{printLabelModal.senderName || '—'}</div>
                                        {(() => {
                                            if (printLabelModal.senderAddress) {
                                                const lines = printLabelModal.senderAddress
                                                    .split(/[\r\n]+/)
                                                    .map(l => l.trim())
                                                    .filter(Boolean);
                                                return (
                                                    <>
                                                        {lines.map((line, idx) => (
                                                            <div key={idx}>{line}</div>
                                                        ))}
                                                    </>
                                                );
                                            }
                                            return (
                                                <>
                                                    <div>Machong Logistics Park</div>
                                                    <div>Dongguan Guangdong</div>
                                                    <div>523040 CHINA</div>
                                                </>
                                            );
                                        })()}
                                        <div style={{ marginTop: '2px', fontSize: '9.5px' }}>
                                            Sender Ref: {printLabelModal.senderReference || '—'}
                                        </div>
                                    </div>

                                    {/* Disclaimer */}
                                    <div style={{ flex: 0.9, textAlign: 'left', fontSize: '7.5px', fontWeight: '700', lineHeight: '1.25', color: '#000000', textTransform: 'uppercase', paddingTop: '2px' }}>
                                        I/WE AGREE THAT<br />
                                        CARRIER'S STD. T&C APPLY TO<br />
                                        THIS SHIPMENT & LIMIT THE<br />
                                        CARRIER'S LIABILITY
                                    </div>
                                </div>
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
                                                    <title>Print Skynet Label - ${(printLabelModal.trackingNumber || '').toString().replace(/^skyt-?/i, '').trim()}</title>
                                                    <style>
                                                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
                                                        body { font-family: 'Inter', 'Arial', system-ui, -apple-system, sans-serif; margin: 0; padding: 10px; display: flex; justify-content: center; background-color: #fff; }
                                                        @media print {
                                                            body { padding: 0; margin: 0; }
                                                            @page { size: auto; margin: 2mm; }
                                                        }
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
                )
            }

            {/* ── MANIFEST & PARTNER MISMATCH EXCEPTION MODAL (EXACT MATCHING DESIGN) ── */}
            {
                partnerMismatchModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999,
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
                                Partner Mismatch !
                            </h3>

                            {/* Content Message */}
                            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                                {partnerMismatchModal.message}
                            </p>

                            {/* Action Button */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => {
                                        setPartnerMismatchModal(null);
                                        setTimeout(() => {
                                            scanInputRef.current?.focus();
                                        }, 50);
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
                                    OK (Enter/Space)
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── OPEN BAGS CANNOT CLOSE MANIFEST POPUP MODAL ── */}
            {
                openBagsErrorModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999,
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            border: '2px solid #e21b22',
                            borderRadius: '12px',
                            padding: '28px 24px',
                            width: '480px',
                            maxWidth: '92%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                            textAlign: 'center'
                        }}>
                            {/* Warning Icon */}
                            <div style={{
                                backgroundColor: '#fee2e2',
                                color: '#e21b22',
                                width: '56px', height: '56px',
                                borderRadius: '50%',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px auto'
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>

                            {/* Title */}
                            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#111827', margin: '0 0 6px 0' }}>
                                Cannot Close Outbound Manifest!
                            </h3>

                            {/* Subtitle */}
                            <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '16px', fontWeight: '600' }}>
                                Manifest: <span style={{ color: '#e21b22', fontWeight: '800' }}>{openBagsErrorModal.manifestRef}</span>
                            </div>

                            {/* Warning Box with Bag Numbers */}
                            <div style={{
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fca5a5',
                                borderRadius: '8px',
                                padding: '14px',
                                marginBottom: '20px',
                                textAlign: 'left'
                            }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', marginBottom: '8px' }}>
                                    The following bag(s) under this manifest are still OPEN:
                                </div>
                                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {openBagsErrorModal.openBags.map((bagNum, idx) => (
                                        <div key={idx} style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #f87171',
                                            borderRadius: '6px',
                                            padding: '7px 10px',
                                            fontSize: '12px',
                                            fontWeight: '800',
                                            color: '#dc2626',
                                            fontFamily: 'monospace',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>{bagNum}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '10px', backgroundColor: '#ffffff', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>OPEN</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '10px', fontWeight: '600' }}>
                                    Please seal and close all open bags under this manifest before closing the manifest.
                                </div>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={() => setOpenBagsErrorModal(null)}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#e21b22',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                OK, Got It
                            </button>
                        </div>
                    </div>
                )
            }

            {/* ── CREATE OUTBOUND MANIFEST MODAL ── */}
            {
                createManifestModalOpen && (
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
                            width: '440px',
                            maxWidth: '92%',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>Create New Outbound Manifest</span>
                                </h3>
                                <button onClick={() => { setCreateManifestModalOpen(false); setDuplicateManifestError(''); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}>✕</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                        Select Service Provider / LMD Partner:
                                    </label>
                                    <select
                                        value={selectedProviderForManifest}
                                        onChange={(e: any) => {
                                            const p = e.target.value;
                                            setSelectedProviderForManifest(p);
                                            if (setCustomManifestName && getNextManifestPreviewCode) {
                                                setCustomManifestName(getNextManifestPreviewCode(p));
                                            }
                                        }}
                                        style={{ ...inputStyle, width: '100%', fontWeight: '700', padding: '10px' }}
                                    >
                                        <option value="PickMe">PickMe Express</option>
                                        <option value="Domex">Domex Express</option>
                                        <option value="SITREK">SITREK Courier</option>
                                        <option value="Pronto">Pronto Lanka</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#374151', display: 'block', marginBottom: '6px' }}>
                                        Manifest Name / Reference:
                                    </label>
                                    <input
                                        disabled={Boolean(isCreatingManifest)}
                                        type="text"
                                        value={customManifestName !== undefined && customManifestName !== '' ? customManifestName : getNextManifestPreviewCode(selectedProviderForManifest)}
                                        onChange={(e) => {
                                            setCustomManifestName && setCustomManifestName(e.target.value);
                                            if (duplicateManifestError) setDuplicateManifestError('');
                                        }}
                                        style={{
                                            ...inputStyle,
                                            width: '100%',
                                            fontWeight: '800',
                                            fontFamily: 'monospace',
                                            fontSize: '14px',
                                            color: '#e21b22',
                                            padding: '10px 12px',
                                            backgroundColor: isCreatingManifest ? '#f3f4f6' : '#ffffff',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            opacity: isCreatingManifest ? 0.7 : 1
                                        }}
                                        placeholder="Enter or edit Manifest Name / Reference"
                                    />
                                    <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                                        Auto-generated format. You can edit or customize the manifest name if needed.
                                    </span>
                                </div>
                            </div>

                            {/* ── Duplicate Manifest Error Banner ── */}
                            {duplicateManifestError && (
                                <div style={{
                                    backgroundColor: '#fef2f2',
                                    border: '1.5px solid #f87171',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#b91c1c',
                                    lineHeight: '1.5'
                                }}>
                                    <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>🚫</span>
                                    <div>
                                        <div style={{ fontWeight: '800', marginBottom: '2px' }}>Duplicate Manifest — Already Exists</div>
                                        <div style={{ fontWeight: '500', color: '#dc2626' }}>{duplicateManifestError}</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    onClick={handleCreateOutboundManifest}
                                    disabled={Boolean(isCreatingManifest)}
                                    style={{
                                        flex: 1,
                                        backgroundColor: isCreatingManifest ? '#4b5563' : '#111827',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        cursor: isCreatingManifest ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isCreatingManifest ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
                                    }}
                                >
                                    {isCreatingManifest ? (
                                        <>
                                            <svg style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" />
                                            </svg>
                                            <span>Generating Manifest...</span>
                                        </>
                                    ) : (
                                        <span>Generate &amp; Open Manifest</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => { setCreateManifestModalOpen(false); setDuplicateManifestError(''); }}
                                    disabled={Boolean(isCreatingManifest)}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                        color: isCreatingManifest ? '#9ca3af' : '#374151',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: isCreatingManifest ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── CREATE OUTBOUND LMD BAG MODAL ── */}
            {
                createBagModalOpen && (
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
                                <button 
                                    disabled={Boolean(isCreatingBag)}
                                    onClick={() => { if (!isCreatingBag) { setCreateBagModalOpen(false); setDuplicateBagError(''); } }} 
                                    style={{ background: 'none', border: 'none', fontSize: '18px', cursor: isCreatingBag ? 'not-allowed' : 'pointer', color: '#6b7280', fontWeight: 'bold' }}
                                >
                                    ✕
                                </button>
                            </div>

                            <div style={{ fontSize: '13px', color: '#111827', marginBottom: '-4px' }}>
                                Manifest: <strong style={{ color: '#e21b22' }}>{selectedSecondScanMawb || 'Multi-Manifest / General'}</strong>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#374151', display: 'block', marginBottom: '4px' }}>
                                        Destination Hub Name:
                                    </label>
                                    <select
                                        disabled={Boolean(isCreatingBag)}
                                        value={newBagPartner}
                                        onChange={(e: any) => {
                                            const p = e.target.value as 'PickMe' | 'Domex' | 'SITREK' | 'Pronto';
                                            setNewBagPartner(p);
                                            const mawbPrefix = selectedSecondScanMawb ? selectedSecondScanMawb : `LMD-${p.toUpperCase()}`;
                                            const nextSeq = String((outboundBags?.length || 0) + 1).padStart(2, '0');
                                            const defaultBag = mawbPrefix.toUpperCase().includes(p.toUpperCase())
                                                ? `${mawbPrefix}-BAG-${nextSeq}`
                                                : `${mawbPrefix}-${p.toUpperCase()}-BAG-${nextSeq}`;
                                            setCustomBagNumber(defaultBag);
                                            if (duplicateBagError) setDuplicateBagError('');
                                        }}
                                        style={{ ...inputStyle, width: '100%', fontWeight: '700', padding: '10px', opacity: isCreatingBag ? 0.7 : 1 }}
                                    >
                                        <option value="PickMe">PickMe Courier</option>
                                        <option value="Domex">Domex Express</option>
                                        <option value="SITREK">SITREK Courier</option>
                                        <option value="Pronto">Pronto Lanka</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#374151', display: 'block', marginBottom: '4px' }}>
                                        Assigning Bag Number:
                                    </label>
                                    <input
                                        disabled={Boolean(isCreatingBag)}
                                        type="text"
                                        value={customBagNumber !== '' ? customBagNumber : (() => {
                                            const mawbPrefix = selectedSecondScanMawb ? selectedSecondScanMawb : `LMD-${newBagPartner.toUpperCase()}`;
                                            const nextSeq = String((outboundBags?.length || 0) + 1).padStart(2, '0');
                                            return mawbPrefix.toUpperCase().includes(newBagPartner.toUpperCase())
                                                ? `${mawbPrefix}-BAG-${nextSeq}`
                                                : `${mawbPrefix}-${newBagPartner.toUpperCase()}-BAG-${nextSeq}`;
                                        })()}
                                        onChange={(e) => {
                                            setCustomBagNumber(e.target.value);
                                            if (duplicateBagError) setDuplicateBagError('');
                                        }}
                                        style={{ ...inputStyle, width: '100%', fontWeight: '700', fontFamily: "'Inter', sans-serif", padding: '10px', backgroundColor: isCreatingBag ? '#f3f4f6' : '#ffffff', border: '1px solid #d1d5db', opacity: isCreatingBag ? 0.7 : 1 }}
                                        placeholder="Enter or edit Bag Number"
                                    />
                                    <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                                        Auto-generated format. You can edit or customize the bag number if needed.
                                    </span>
                                </div>
                            </div>

                            {/* ── Duplicate Bag Error Banner ── */}
                            {duplicateBagError && (
                                <div style={{
                                    backgroundColor: '#fef2f2',
                                    border: '1.5px solid #f87171',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#b91c1c',
                                    lineHeight: '1.5'
                                }}>
                                    <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>🚫</span>
                                    <div>
                                        <div style={{ fontWeight: '800', marginBottom: '2px' }}>Duplicate Bag — Already Exists</div>
                                        <div style={{ fontWeight: '500', color: '#dc2626' }}>{duplicateBagError}</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    onClick={handleCreateOutboundBag}
                                    disabled={Boolean(isCreatingBag)}
                                    style={{
                                        flex: 1,
                                        backgroundColor: isCreatingBag ? '#9ca3af' : '#e21b22',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        cursor: isCreatingBag ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isCreatingBag ? 'none' : '0 2px 6px rgba(226, 27, 34, 0.35)'
                                    }}
                                >
                                    {isCreatingBag ? (
                                        <>
                                            <svg style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" />
                                            </svg>
                                            <span>Creating Outbound Bag...</span>
                                        </>
                                    ) : (
                                        <span>Create Outbound LMD Bag</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => { setCreateBagModalOpen(false); setDuplicateBagError(''); }}
                                    disabled={Boolean(isCreatingBag)}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                        color: isCreatingBag ? '#9ca3af' : '#374151',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: isCreatingBag ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── PRINT OUTBOUND LMD BAG LABEL MODAL ── */}
            {
                printOutboundBagLabelModal && (
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
                                        <strong style={{ fontSize: '12px' }}>{formatGramsToKg(printOutboundBagLabelModal.totalWeight)} kg</strong>
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
                )
            }

            {/* ── MODAL: VIEW SCANNED PARCELS IN UNSEALED BAG ── */}
            {
                viewingUnsealedParcelsModal && (
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
                                                            backgroundColor: p.assignedPartner === 'PickMe' ? '#ffcc00' : p.assignedPartner === 'Domex' ? '#7b0f1a' : p.assignedPartner === 'SITREK' || p.assignedPartner === 'Sitrek' ? '#0f2b6e' : '#ea580c',
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
                )
            }

            {/* ── MODAL: MISSED FIRST SCAN WARNING & RECONCILIATION ── */}
            {
                missedFirstScanModal && (
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
                )
            }

            {/* DAMAGED PARCEL PHOTOS FULL VIEW MODAL */}
            {
                damagedSelectedPhotosModal && (
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
                )
            }
        </>
    );
}
