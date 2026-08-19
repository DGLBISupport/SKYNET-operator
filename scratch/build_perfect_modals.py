import os, re

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/backup.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

modals_lines = lines[8209:11357]

# We will construct a clean JSX block for ModalsContainer
formatted_modals = []
in_modal = False
for line in modals_lines:
    s = line.strip()
    if s == '{' or s == '}':
        continue
    formatted_modals.append(line)

modals_content = ''.join(formatted_modals)

# Wrap each modal condition cleanly with { and }
modal_conditions = [
    'isDeviceManagerOpen',
    'duplicateModal',
    'invalidBarcodeModal',
    'manifestProgressModal',
    'manifestClosedModal',
    'confirmFinishModal',
    'overageCheckModal',
    'invalidBagParcelModal',
    'extraParcelModal',
    'switchUserModal',
    'renewPinModal',
    'customConfirmModal',
    'unallocatedBagUnsealModal',
    'unallocatedPartnerModal',
    'successModal',
    'printLabelModal',
    'partnerMismatchModal',
    'openBagsErrorModal',
    'createManifestModalOpen',
    'createBagModalOpen',
    'printOutboundBagLabelModal',
    'viewingUnsealedParcelsModal',
    'missedFirstScanModal',
    'damagedSelectedPhotosModal'
]

# For each key, replace `key && (` with `{ key && (` and closing `)` with `)}`
for key in modal_conditions:
    # Pattern: optional whitespace, optional comment, then key && (
    pattern = re.compile(rf'(\n\s*)({key}\s*&&|\({key}\)|\{key}\s*&&)')
    
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
        <>
''' + modals_content + '''
        </>
    );
}
''')

print('Written ModalsContainer cleanly.')
