import os

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/backup.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract lines 1 to 3135 (imports, helpers, functions, hooks, state)
core_logic = ''.join(lines[:3135])

# Additional component imports needed at top of page.tsx
imports_header = """import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import FirstScanTab from '@/components/first-scan/FirstScanTab';
import SecondScanTab from '@/components/second-scan/SecondScanTab';
import DamagedBarcodeTab from '@/components/damaged-barcode/DamagedBarcodeTab';
import DispatchVerifyTab from '@/components/verify/DispatchVerifyTab';
import ReportsTab from '@/components/reports/ReportsTab';
import ManifestTrackingTab from '@/components/manifest-tracking/ManifestTrackingTab';
import DashboardTab from '@/components/dashboard-tab/DashboardTab';
import SettingsTab from '@/components/settings/SettingsTab';
import UntrackedParcelsTab from '@/components/untracked-parcels/UntrackedParcelsTab';
import ModalsContainer from '@/components/modals/ModalsContainer';
"""

# Insert component imports after line 9 (standard imports)
core_lines = core_logic.splitlines()
core_with_imports = '\n'.join(core_lines[:9]) + '\n' + imports_header + '\n' + '\n'.join(core_lines[9:])

jsx_body = """
    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#f4f5f7', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Custom Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; color: #4b5563; background-color: transparent; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; width: calc(100% - 16px); margin: 0 8px; text-align: left; transition: all 0.15s ease; box-sizing: border-box; position: relative; }
                .sidebar-item:hover { background-color: #f3f4f6; color: #111827; }
                .sidebar-item.active { background-color: #e21b22; color: #ffffff; font-weight: 600; }
                .sidebar-item.active svg { color: #ffffff; }
                .sidebar-item-collapsed { justify-content: center; padding: 10px 0; }
            ` }} />

            {/* Modular Sidebar */}
            <Sidebar
                isSidebarExpanded={isSidebarExpanded}
                setIsSidebarExpanded={setIsSidebarExpanded}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                dashboardSubTab={dashboardSubTab}
                setDashboardSubTab={setDashboardSubTab}
                currentUser={currentUser}
                usersList={usersList}
                setSwitchUserModal={setSwitchUserModal}
                setRenewPinModal={setRenewPinModal}
                handleLogout={handleLogout}
                operatorMenuOpen={operatorMenuOpen}
                setOperatorMenuOpen={setOperatorMenuOpen}
            />

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh', boxSizing: 'border-box' }}>
                
                {/* Modular Header */}
                <Header
                    getPageHeaderInfo={getPageHeaderInfo}
                    setIsDeviceManagerOpen={setIsDeviceManagerOpen}
                    scannerConnected={scannerConnected}
                    timeString={timeString}
                />

                <main style={{ flex: 1, padding: '24px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Tab 1: Box Unsealing */}
                    {activeTab === 'first-scan' && (
                        <FirstScanTab
                            firstScanMawb={firstScanMawb} setFirstScanMawb={setFirstScanMawb} mawbsList={mawbsList} isBagsLoading={isBagsLoading}
                            firstScanBags={firstScanBags} firstScanSelectedBag={firstScanSelectedBag} setFirstScanSelectedBag={setFirstScanSelectedBag}
                            firstScanExpected={firstScanExpected} setFirstScanExpected={setFirstScanExpected} firstScanError={firstScanError}
                            setFirstScanError={setFirstScanError} setFirstScanLastScanned={setFirstScanLastScanned} setFirstScanStatus={setFirstScanStatus}
                            setFirstScanHistory={setFirstScanHistory} bagBarcodeInput={bagBarcodeInput} setBagBarcodeInput={setBagBarcodeInput}
                            bagBarcodeInputRef={bagBarcodeInputRef} inputStyle={inputStyle} handleBagBarcodeInputSubmit={handleBagBarcodeInputSubmit}
                            handleFirstScanSubmit={handleFirstScanSubmit} firstScanInputRef={firstScanInputRef} firstScanInput={firstScanInput}
                            setFirstScanInput={setFirstScanInput} firstScanStatus={firstScanStatus} firstScanLastScanned={firstScanLastScanned}
                            firstScanCurrentScan={firstScanCurrentScan} resolvePartnerName={resolvePartnerName} generateCode128SVG={generateCode128SVG}
                            lastTemuSticker={lastTemuSticker} setPrintLabelModal={setPrintLabelModal} setUnsealedBoxes={setUnsealedBoxes}
                            unsealedBoxes={unsealedBoxes} firstScanHistory={firstScanHistory} firstScanHistoryPage={firstScanHistoryPage}
                            setFirstScanHistoryPage={setFirstScanHistoryPage} firstScanHistoryRowsPerPage={firstScanHistoryRowsPerPage}
                            setFirstScanHistoryRowsPerPage={setFirstScanHistoryRowsPerPage} firstScanBagsPage={firstScanBagsPage}
                            setFirstScanBagsPage={setFirstScanBagsPage} firstScanBagsRowsPerPage={firstScanBagsRowsPerPage}
                            setFirstScanBagsRowsPerPage={setFirstScanBagsRowsPerPage} getSortedBags={getSortedBags} getBagScannedCount={getBagScannedCount}
                            getBagStatus={getBagStatus} setViewingUnsealedParcelsModal={setViewingUnsealedParcelsModal} btnSecondary={btnSecondary} autoFinishBag={autoFinishBag}
                        />
                    )}

                    {/* Tab 2: LMD Verification */}
                    {activeTab === 'second-scan' && (
                        <SecondScanTab
                            selectedSecondScanMawb={selectedSecondScanMawb} setSelectedSecondScanMawb={setSelectedSecondScanMawb} mawbsList={mawbsList}
                            secondScanManifestStatus={secondScanManifestStatus} setSecondScanManifestStatus={setSecondScanManifestStatus}
                            outboundManifestsList={outboundManifestsList} setCreateBagModalOpen={setCreateBagModalOpen} setCreateManifestModalOpen={setCreateManifestModalOpen}
                            outboundBags={outboundBags} activeOutboundBag={activeOutboundBag} setActiveOutboundBag={setActiveOutboundBag} scanInputRef={scanInputRef}
                            barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput} handleAllocateSubmit={handleAllocateSubmit} status={status} lastScanned={lastScanned}
                            errorMessage={errorMessage} currentScan={currentScan} missedFirstScanModal={missedFirstScanModal} setMissedFirstScanModal={setMissedFirstScanModal}
                            validationCard={validationCard} setValidationCard={setValidationCard} setPrintOutboundBagLabelModal={setPrintOutboundBagLabelModal}
                            btnSecondary={btnSecondary} setPrintLabelModal={setPrintLabelModal} resolvePartnerName={resolvePartnerName} generateCode128SVG={generateCode128SVG}
                            lastTemuSticker={lastTemuSticker}
                        />
                    )}

                    {/* Tab 3: Damaged Labels */}
                    {activeTab === 'damaged-barcode' && (
                        <DamagedBarcodeTab
                            damagedSubTab={damagedSubTab} setDamagedSubTab={setDamagedSubTab} damagedInputRef={damagedInputRef} damagedInput={damagedInput}
                            setDamagedInput={setDamagedInput} handleDamagedBarcodeSubmit={handleDamagedBarcodeSubmit} damagedStatus={damagedStatus}
                            damagedErrorMessage={damagedErrorMessage} damagedCurrentScan={damagedCurrentScan} setPrintLabelModal={setPrintLabelModal}
                            generateCode128SVG={generateCode128SVG} damagedSearchQuery={damagedSearchQuery} setDamagedSearchQuery={setDamagedSearchQuery}
                            damagedStatusFilter={damagedStatusFilter} setDamagedStatusFilter={setDamagedStatusFilter} damagedParcelsList={damagedParcelsList}
                            setDamagedParcelsList={setDamagedParcelsList} isLoadingDamagedParcels={isLoadingDamagedParcels} damagedParcelsPage={damagedParcelsPage}
                            setDamagedParcelsPage={setDamagedParcelsPage} damagedParcelsRowsPerPage={damagedParcelsRowsPerPage} setDamagedParcelsRowsPerPage={setDamagedParcelsRowsPerPage}
                            setDamagedSelectedPhotosModal={setDamagedSelectedPhotosModal}
                        />
                    )}

                    {/* Tab 4: Dispatch Verify */}
                    {activeTab === 'verify' && (
                        <DispatchVerifyTab
                            selectedBin={selectedBin} setSelectedBin={setSelectedBin} binCounts={binCounts} verifyInputRef={verifyInputRef}
                            verifyBarcodeInput={verifyBarcodeInput} setVerifyBarcodeInput={setVerifyBarcodeInput} handleVerifySubmit={handleVerifySubmit}
                            verifyStatus={verifyStatus} lastVerifyScanned={lastVerifyScanned} verifyErrorMessage={verifyErrorMessage} verifyScan={verifyScan}
                        />
                    )}

                    {/* Tab 5: Parcel Tracking */}
                    {activeTab === 'tracking' && (
                        <TrackingTab />
                    )}

                    {/* Tab 6: Operations Summary */}
                    {activeTab === 'reports' && (
                        <ReportsTab history={history} scannedToday={scannedToday} verifiedCount={verifiedCount} binCounts={binCounts} />
                    )}

                    {/* Tab 7: Outbound Manifest Tracking */}
                    {activeTab === 'manifest-tracking' && (
                        <ManifestTrackingTab
                            manifestTrackingMawb={manifestTrackingMawb} setManifestTrackingMawb={setManifestTrackingMawb} mawbsList={mawbsList}
                            handleFetchManifestTrackingData={handleFetchManifestTrackingData} lastRefreshedManifestTracking={lastRefreshedManifestTracking}
                            isLoadingManifestTracking={isLoadingManifestTracking} manifestTrackingData={manifestTrackingData}
                            manifestTrackingSearchQuery={manifestTrackingSearchQuery} setManifestTrackingSearchQuery={setManifestTrackingSearchQuery}
                            manifestTrackingStatusFilter={manifestTrackingStatusFilter} setManifestTrackingStatusFilter={setManifestTrackingStatusFilter}
                            manifestTrackingPartnerFilter={manifestTrackingPartnerFilter} setManifestTrackingPartnerFilter={setManifestTrackingPartnerFilter}
                            expandedManifests={expandedManifests} setExpandedManifests={setExpandedManifests} expandedBags={expandedBags} setExpandedBags={setExpandedBags}
                            resolvePartnerName={resolvePartnerName} generateCode128SVG={generateCode128SVG} setViewingUnsealedParcelsModal={setViewingUnsealedParcelsModal}
                        />
                    )}

                    {/* Tab 8: Analytics Dashboard */}
                    {activeTab === 'dashboard' && (
                        <DashboardTab
                            dashboardSubTab={dashboardSubTab} setDashboardSubTab={setDashboardSubTab} dashboardDateFilter={dashboardDateFilter}
                            setDashboardDateFilter={setDashboardDateFilter} dashboardMawbFilter={dashboardMawbFilter} setDashboardMawbFilter={setDashboardMawbFilter}
                            dashboardSearchQuery={dashboardSearchQuery} setDashboardSearchQuery={setDashboardSearchQuery} scannedToday={scannedToday}
                            unsealedBoxes={unsealedBoxes} usersList={usersList} history={history}
                        />
                    )}

                    {/* Tab 9: Settings & Admin Panel */}
                    {activeTab === 'config' && (
                        <SettingsTab currentUser={currentUser} onOpenDeviceManager={() => setIsDeviceManagerOpen(true)} />
                    )}

                    {/* Tab 10: Untracked Parcels Registry (Super Admin Export) */}
                    {activeTab === 'untracked' && (
                        <UntrackedParcelsTab />
                    )}

                </main>
            </div>

            {/* Modular Modals Container */}
            <ModalsContainer
                isDeviceManagerOpen={isDeviceManagerOpen} setIsDeviceManagerOpen={setIsDeviceManagerOpen} testScannerInput={testScannerInput} setTestScannerInput={setTestScannerInput}
                testScannerSpeed={testScannerSpeed} setTestScannerSpeed={setTestScannerSpeed} handleTestScannerKeyDown={handleTestScannerKeyDown} handleClearTestInput={handleClearTestInput}
                duplicateModal={duplicateModal} setDuplicateModal={setDuplicateModal} setBarcodeInput={setBarcodeInput} setLastScanned={setLastScanned} scanInputRef={scanInputRef}
                activeTab={activeTab} firstScanInputRef={firstScanInputRef} verifyInputRef={verifyInputRef} invalidBarcodeModal={invalidBarcodeModal} setInvalidBarcodeModal={setInvalidBarcodeModal}
                manifestProgressModal={manifestProgressModal} setManifestProgressModal={setManifestProgressModal} setExpandedBags={setExpandedBags} manifestClosedModal={manifestClosedModal}
                setManifestClosedModal={setManifestClosedModal} confirmFinishModal={confirmFinishModal} setConfirmFinishModal={setConfirmFinishModal} handleConfirmFinish={handleConfirmFinish}
                discrepancyReason={discrepancyReason} setDiscrepancyReason={setDiscrepancyReason} customDiscrepancyNote={customDiscrepancyNote} setCustomDiscrepancyNote={setCustomDiscrepancyNote}
                setFirstScanInput={setFirstScanInput} overageCheckModal={overageCheckModal} setOverageCheckModal={setOverageCheckModal} autoFinishBag={autoFinishBag}
                invalidBagParcelModal={invalidBagParcelModal} setInvalidBagParcelModal={setInvalidBagParcelModal} setBagBarcodeInput={setBagBarcodeInput} extraParcelModal={extraParcelModal}
                setExtraParcelModal={setExtraParcelModal} extraParcelNote={extraParcelNote} setExtraParcelNote={setExtraParcelNote} handleFirstScanSubmitOverride={handleFirstScanSubmitOverride}
                switchUserModal={switchUserModal} setSwitchUserModal={setSwitchUserModal} switchUserFirstName={switchUserFirstName} setSwitchUserFirstName={setSwitchUserFirstName}
                switchUserPassword={switchUserPassword} setSwitchUserPassword={setSwitchUserPassword} handleSwitchUserSubmit={handleSwitchUserSubmit} renewPinModal={renewPinModal}
                setRenewPinModal={setRenewPinModal} renewForm={renewForm} setRenewForm={setRenewForm} handleRenewPinSubmit={handleRenewPinSubmit} customConfirmModal={customConfirmModal}
                setCustomConfirmModal={setCustomConfirmModal} unallocatedBagUnsealModal={unallocatedBagUnsealModal} setUnallocatedBagUnsealModal={setUnallocatedBagUnsealModal}
                unallocatedBagNote={unallocatedBagNote} setUnallocatedBagNote={setUnallocatedBagNote} unallocatedPartnerModal={unallocatedPartnerModal} setUnallocatedPartnerModal={setUnallocatedPartnerModal}
                successModal={successModal} setSuccessModal={setSuccessModal} printLabelModal={printLabelModal} setPrintLabelModal={setPrintLabelModal} partnerMismatchModal={partnerMismatchModal}
                setPartnerMismatchModal={setPartnerMismatchModal} openBagsErrorModal={openBagsErrorModal} setOpenBagsErrorModal={setOpenBagsErrorModal} createManifestModalOpen={createManifestModalOpen}
                setCreateManifestModalOpen={setCreateManifestModalOpen} selectedProviderForManifest={selectedProviderForManifest} setSelectedProviderForManifest={setSelectedProviderForManifest}
                getNextManifestPreviewCode={getNextManifestPreviewCode} handleCreateOutboundManifest={handleCreateOutboundManifest} inputStyle={inputStyle} createBagModalOpen={createBagModalOpen}
                setCreateBagModalOpen={setCreateBagModalOpen} selectedSecondScanMawb={selectedSecondScanMawb} newBagPartner={newBagPartner} setNewBagPartner={setNewBagPartner}
                customBagNumber={customBagNumber} setCustomBagNumber={setCustomBagNumber} outboundBags={outboundBags} newBagHub={newBagHub} setNewBagHub={setNewBagHub}
                handleCreateOutboundBag={handleCreateOutboundBag} printOutboundBagLabelModal={printOutboundBagLabelModal} setPrintOutboundBagLabelModal={setPrintOutboundBagLabelModal}
                btnSecondary={btnSecondary} btnPrimary={btnPrimary} viewingUnsealedParcelsModal={viewingUnsealedParcelsModal} setViewingUnsealedParcelsModal={setViewingUnsealedParcelsModal}
                missedFirstScanModal={missedFirstScanModal} setMissedFirstScanModal={setMissedFirstScanModal} damagedSelectedPhotosModal={damagedSelectedPhotosModal}
                setDamagedSelectedPhotosModal={setDamagedSelectedPhotosModal}
            />

            {/* Custom Animations */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes dashscan { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
                @keyframes spin { to { transform: rotate(360deg); } }
            ` }} />
        </div>
    );
}
"""

final_page = core_with_imports + jsx_body

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(final_page)

print('Assembled modular page.tsx successfully!')
