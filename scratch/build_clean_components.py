import os

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/backup.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def get_clean_inner(start_line, end_line):
    block_lines = lines[start_line-1:end_line]
    content = ''.join(block_lines).strip()
    if content.startswith('{'):
        first_paren = content.find('(')
        if first_paren != -1:
            content = content[first_paren+1:].strip()
    if content.endswith(')}'):
        content = content[:-2].strip()
    elif content.endswith(')'):
        content = content[:-1].strip()
    return content

base_dir = 'c:/Shashini/Skynet_Projects/parcel_allocation_web/src/components'

# 1. FirstScanTab.tsx
with open(os.path.join(base_dir, 'first-scan/FirstScanTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function FirstScanTab(props: any) {
    const {
        firstScanMawb, setFirstScanMawb, mawbsList, isBagsLoading, firstScanBags, firstScanSelectedBag, setFirstScanSelectedBag, firstScanExpected, setFirstScanExpected,
        firstScanError, setFirstScanError, setFirstScanLastScanned, setFirstScanStatus, setFirstScanHistory, bagBarcodeInput, setBagBarcodeInput, bagBarcodeInputRef, inputStyle,
        handleBagBarcodeInputSubmit, handleFirstScanSubmit, firstScanInputRef, firstScanInput, setFirstScanInput, firstScanStatus, firstScanLastScanned, firstScanCurrentScan,
        resolvePartnerName, generateCode128SVG, lastTemuSticker, setPrintLabelModal, setUnsealedBoxes, unsealedBoxes, firstScanHistory, firstScanHistoryPage, setFirstScanHistoryPage,
        firstScanHistoryRowsPerPage, setFirstScanHistoryRowsPerPage, firstScanBagsPage, setFirstScanBagsPage, firstScanBagsRowsPerPage, setFirstScanBagsRowsPerPage, getSortedBags,
        getBagScannedCount, getBagStatus, setViewingUnsealedParcelsModal, btnSecondary, autoFinishBag
    } = props;

    return (
''' + get_clean_inner(3693, 4508) + '''
    );
}
''')

# 2. SecondScanTab.tsx
with open(os.path.join(base_dir, 'second-scan/SecondScanTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';

export default function SecondScanTab(props: any) {
    const {
        selectedSecondScanMawb, setSelectedSecondScanMawb, mawbsList, secondScanManifestStatus, setSecondScanManifestStatus, outboundManifestsList, setCreateBagModalOpen,
        setCreateManifestModalOpen, outboundBags, activeOutboundBag, setActiveOutboundBag, scanInputRef, barcodeInput, setBarcodeInput, handleAllocateSubmit, status,
        lastScanned, errorMessage, currentScan, missedFirstScanModal, setMissedFirstScanModal, validationCard, setValidationCard, setPrintOutboundBagLabelModal, btnSecondary,
        setPrintLabelModal, resolvePartnerName, generateCode128SVG, lastTemuSticker
    } = props;

    return (
''' + get_clean_inner(4510, 5268) + '''
    );
}
''')

# 3. DamagedBarcodeTab.tsx
with open(os.path.join(base_dir, 'damaged-barcode/DamagedBarcodeTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function DamagedBarcodeTab(props: any) {
    const {
        damagedSubTab, setDamagedSubTab, damagedInputRef, damagedInput, setDamagedInput, handleDamagedBarcodeSubmit, damagedStatus, damagedErrorMessage, damagedCurrentScan,
        setPrintLabelModal, generateCode128SVG, damagedSearchQuery, setDamagedSearchQuery, damagedStatusFilter, setDamagedStatusFilter, damagedParcelsList, setDamagedParcelsList,
        isLoadingDamagedParcels, damagedParcelsPage, setDamagedParcelsPage, damagedParcelsRowsPerPage, setDamagedParcelsRowsPerPage, setDamagedSelectedPhotosModal
    } = props;

    return (
''' + get_clean_inner(5270, 5963) + '''
    );
}
''')

# 4. DispatchVerifyTab.tsx
with open(os.path.join(base_dir, 'verify/DispatchVerifyTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';

export default function DispatchVerifyTab(props: any) {
    const {
        selectedBin, setSelectedBin, binCounts, verifyInputRef, verifyBarcodeInput, setVerifyBarcodeInput, handleVerifySubmit, verifyStatus, lastVerifyScanned,
        verifyErrorMessage, verifyScan
    } = props;

    return (
''' + get_clean_inner(5965, 6411) + '''
    );
}
''')

# 5. ReportsTab.tsx
with open(os.path.join(base_dir, 'reports/ReportsTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';

export default function ReportsTab(props: any) {
    const {
        history, scannedToday, verifiedCount, binCounts
    } = props;

    return (
''' + get_clean_inner(6492, 6610) + '''
    );
}
''')

# 6. ManifestTrackingTab.tsx
with open(os.path.join(base_dir, 'manifest-tracking/ManifestTrackingTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function ManifestTrackingTab(props: any) {
    const {
        manifestTrackingMawb, setManifestTrackingMawb, mawbsList, handleFetchManifestTrackingData, lastRefreshedManifestTracking, isLoadingManifestTracking,
        manifestTrackingData, manifestTrackingSearchQuery, setManifestTrackingSearchQuery, manifestTrackingStatusFilter, setManifestTrackingStatusFilter,
        manifestTrackingPartnerFilter, setManifestTrackingPartnerFilter, expandedManifests, setExpandedManifests, expandedBags, setExpandedBags, resolvePartnerName,
        generateCode128SVG, setViewingUnsealedParcelsModal
    } = props;

    return (
''' + get_clean_inner(6612, 7295) + '''
    );
}
''')

# 7. DashboardTab.tsx
with open(os.path.join(base_dir, 'dashboard-tab/DashboardTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function DashboardTab(props: any) {
    const {
        dashboardSubTab, setDashboardSubTab, dashboardDateFilter, setDashboardDateFilter, dashboardMawbFilter, setDashboardMawbFilter, dashboardSearchQuery, setDashboardSearchQuery,
        scannedToday, unsealedBoxes, usersList, history
    } = props;

    return (
''' + get_clean_inner(7296, 8208) + '''
    );
}
''')

# 8. ModalsContainer.tsx
with open(os.path.join(base_dir, 'modals/ModalsContainer.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';

export default function ModalsContainer(props: any) {
    const {
        isDeviceManagerOpen, setIsDeviceManagerOpen, testScannerInput, setTestScannerInput, testScannerSpeed, setTestScannerSpeed, handleTestScannerKeyDown, handleClearTestInput,
        duplicateModal, setDuplicateModal, setBarcodeInput, setLastScanned, scanInputRef, activeTab, firstScanInputRef, verifyInputRef, invalidBarcodeModal, setInvalidBarcodeModal,
        manifestProgressModal, setManifestProgressModal, setExpandedBags, manifestClosedModal, setManifestClosedModal, confirmFinishModal, setConfirmFinishModal, handleConfirmFinish,
        discrepancyReason, setDiscrepancyReason, customDiscrepancyNote, setCustomDiscrepancyNote, setFirstScanInput, overageCheckModal, setOverageCheckModal, autoFinishBag,
        invalidBagParcelModal, setInvalidBagParcelModal, setBagBarcodeInput, extraParcelModal, setExtraParcelModal, extraParcelNote, setExtraParcelNote,
        handleFirstScanSubmitOverride, switchUserModal, setSwitchUserModal, switchUserFirstName, setSwitchUserFirstName, switchUserPassword, setSwitchUserPassword, handleSwitchUserSubmit,
        renewPinModal, setRenewPinModal, renewForm, setRenewForm, handleRenewPinSubmit, customConfirmModal, setCustomConfirmModal, unallocatedBagUnsealModal, setUnallocatedBagUnsealModal,
        unallocatedBagNote, setUnallocatedBagNote, unallocatedPartnerModal, setUnallocatedPartnerModal, successModal, setSuccessModal, printLabelModal, setPrintLabelModal,
        partnerMismatchModal, setPartnerMismatchModal, openBagsErrorModal, setOpenBagsErrorModal, createManifestModalOpen, setCreateManifestModalOpen, selectedProviderForManifest,
        setSelectedProviderForManifest, getNextManifestPreviewCode, handleCreateOutboundManifest, inputStyle, createBagModalOpen, setCreateBagModalOpen, selectedSecondScanMawb,
        newBagPartner, setNewBagPartner, customBagNumber, setCustomBagNumber, outboundBags, newBagHub, setNewBagHub, handleCreateOutboundBag, printOutboundBagLabelModal,
        setPrintOutboundBagLabelModal, btnSecondary, btnPrimary, viewingUnsealedParcelsModal, setViewingUnsealedParcelsModal, missedFirstScanModal, setMissedFirstScanModal, damagedSelectedPhotosModal, setDamagedSelectedPhotosModal
    } = props;

    return (
        <>
''' + get_clean_inner(8210, 11357) + '''
        </>
    );
}
''')

# 9. Header.tsx
with open(os.path.join(base_dir, 'layout/Header.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';

export default function Header(props: any) {
    const {
        getPageHeaderInfo, setIsDeviceManagerOpen, scannerConnected, timeString
    } = props;

    const pageInfo = getPageHeaderInfo();

    return (
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
                </button>
                <span style={{ color: '#374151', fontWeight: '600', borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>{timeString}</span>
            </div>
        </header>
    );
}
''')

# 10. Sidebar.tsx
with open(os.path.join(base_dir, 'layout/Sidebar.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React from 'react';

export default function Sidebar(props: any) {
    const {
        isSidebarExpanded, setIsSidebarExpanded, activeTab, setActiveTab, dashboardSubTab, setDashboardSubTab, currentUser, usersList, setSwitchUserModal, setRenewPinModal, handleLogout, operatorMenuOpen, setOperatorMenuOpen
    } = props;

    return (
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
                        <img src="/skynet_logi_logo.png" alt="LOGICENTRIX logo" style={{ height: '20px', width: 'auto' }} />
                    </div>
                )}
                <button
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                    style={{
                        background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px'
                    }}
                    title={isSidebarExpanded ? "Collapse Menu" : "Expand Menu"}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#8c98a5', letterSpacing: '0.8px', padding: '20px 16px 8px 16px', textTransform: 'uppercase' }}>
                    {isSidebarExpanded ? 'Parcel Logistics' : ''}
                </div>

                {([
                    { id: 'first-scan', label: 'Box Unsealing' },
                    { id: 'second-scan', label: 'LMD Verification' },
                    { id: 'manifest-tracking', label: 'Outbound Manifest Tracking' },
                    { id: 'damaged-barcode', label: 'Damaged Labels' },
                    { id: 'verify', label: 'Dispatch Verify' },
                    { id: 'tracking', label: 'Parcel Tracking' }
                ]).map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`sidebar-item ${activeTab === item.id ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                        title={!isSidebarExpanded ? item.label : ''}
                    >
                        {isSidebarExpanded && <span>{item.label}</span>}
                    </button>
                ))}

                <div style={{ fontSize: '11px', fontWeight: '700', color: '#8c98a5', letterSpacing: '0.8px', padding: '20px 16px 8px 16px', textTransform: 'uppercase' }}>
                    {isSidebarExpanded ? 'Management' : ''}
                </div>

                <button
                    onClick={() => setActiveTab('config')}
                    className={`sidebar-item ${activeTab === 'config' ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                >
                    {isSidebarExpanded && <span>Settings & Admin Panel</span>}
                </button>

                <button
                    onClick={() => setActiveTab('untracked')}
                    className={`sidebar-item ${activeTab === 'untracked' ? 'active' : ''} ${!isSidebarExpanded ? 'sidebar-item-collapsed' : ''}`}
                >
                    {isSidebarExpanded && <span>Untracked Parcels (Excel)</span>}
                </button>
            </div>

            <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>
                    {currentUser?.firstName || 'Operator'}
                </div>
            </div>
        </aside>
    );
}
''')

print('All clean modular component files written successfully!')
