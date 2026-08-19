import os

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/backup.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def get_tab_jsx(start_line, end_line):
    sub = lines[start_line-1:end_line]
    s = 0
    for idx, l in enumerate(sub):
        if '<div' in l:
            s = idx
            break
    e = len(sub) - 1
    for idx in range(len(sub)-1, -1, -1):
        if '</div>' in sub[idx]:
            e = idx
            break
    return ''.join(sub[s:e+1])

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
''' + get_tab_jsx(3693, 4508) + '''
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
''' + get_tab_jsx(4510, 5268) + '''
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
''' + get_tab_jsx(5270, 5963) + '''
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
''' + get_tab_jsx(5965, 6411) + '''
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
''' + get_tab_jsx(6492, 6610) + '''
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
''' + get_tab_jsx(6612, 7295) + '''
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
''' + get_tab_jsx(7296, 8208) + '''
    );
}
''')

# 8. ModalsContainer.tsx
modals_sub = lines[8209:11357]
cleaned_modals = []
for idx, l in enumerate(modals_sub):
    s = l.strip()
    if s == '{' and idx > 0 and ('/*' in modals_sub[idx-1] or modals_sub[idx-1].strip() == ''):
        continue
    cleaned_modals.append(l)

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
        <React.Fragment>
''' + ''.join(cleaned_modals) + '''
        </React.Fragment>
    );
}
''')

print('Cleaned modals and tab components generated successfully.')
