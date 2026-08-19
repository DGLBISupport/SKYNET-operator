import os

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/backup.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract lines 8210 to 11356 of backup.md
# Line 8210: comment
# Line 8211: {
# Line 8212..11356: modal conditionals
# Line 11357: )
# Line 11358: }

inner_modals = ''.join(lines[8211:11357])

base_dir = 'c:/Shashini/Skynet_Projects/parcel_allocation_web/src/components'

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
        <div style={{ display: 'contents' }}>
            {/* ── DEVICE MANAGER MODAL ── */}
            {
''' + inner_modals + '''
            }
        </div>
    );
}
''')

print('ModalsContainer generated cleanly.')
