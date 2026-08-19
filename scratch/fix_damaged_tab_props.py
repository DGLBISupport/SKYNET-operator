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

# 3. DamagedBarcodeTab.tsx
with open(os.path.join(base_dir, 'damaged-barcode/DamagedBarcodeTab.tsx'), 'w', encoding='utf-8') as f:
    f.write(''''use client';
import React, { useState } from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function DamagedBarcodeTab(props: any) {
    const {
        damagedSubTab, setDamagedSubTab, damagedInputRef, damagedBarcodeInput, setDamagedBarcodeInput, handleDamagedScanSubmit, damagedStatus, damagedErrorMessage, damagedCurrentScan,
        setPrintLabelModal, generateCode128SVG, damagedReportsList, setDamagedSelectedPhotosModal, damagedReportFormOpen, setDamagedReportFormOpen, damagedManualTracking,
        setDamagedManualTracking, damagedReportCategory, setDamagedReportCategory, damagedReportSeverity, setDamagedReportSeverity, damagedReportRemarks, setDamagedReportRemarks,
        damagedImage1, setDamagedImage1, damagedImage2, setDamagedImage2, damagedSubmitting, damagedSubmitError, damagedSubmitSuccess, handleDamagedReportSubmit, inputStyle, btnPrimary, btnSecondary
    } = props;

    // Local pagination / search state for damaged reports table
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    return (
''' + get_tab_jsx(5270, 5963) + '''
    );
}
''')

# Update page.tsx tab invocation for DamagedBarcodeTab
with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/src/app/page.tsx', 'r', encoding='utf-8') as f:
    page_text = f.read()

old_invocation_start = page_text.find('<DamagedBarcodeTab')
old_invocation_end = page_text.find('/>', old_invocation_start) + 2

new_invocation = '''<DamagedBarcodeTab
                            damagedSubTab={damagedSubTab} setDamagedSubTab={setDamagedSubTab} damagedInputRef={damagedInputRef} damagedBarcodeInput={damagedBarcodeInput}
                            setDamagedBarcodeInput={setDamagedBarcodeInput} handleDamagedScanSubmit={handleDamagedScanSubmit} damagedStatus={damagedStatus}
                            damagedErrorMessage={damagedErrorMessage} damagedCurrentScan={damagedCurrentScan} setPrintLabelModal={setPrintLabelModal}
                            generateCode128SVG={generateCode128SVG} damagedReportsList={damagedReportsList} setDamagedSelectedPhotosModal={setDamagedSelectedPhotosModal}
                            damagedReportFormOpen={damagedReportFormOpen} setDamagedReportFormOpen={setDamagedReportFormOpen} damagedManualTracking={damagedManualTracking}
                            setDamagedManualTracking={setDamagedManualTracking} damagedReportCategory={damagedReportCategory} setDamagedReportCategory={setDamagedReportCategory}
                            damagedReportSeverity={damagedReportSeverity} setDamagedReportSeverity={setDamagedReportSeverity} damagedReportRemarks={damagedReportRemarks}
                            setDamagedReportRemarks={setDamagedReportRemarks} damagedImage1={damagedImage1} setDamagedImage1={setDamagedImage1} damagedImage2={damagedImage2}
                            setDamagedImage2={setDamagedImage2} damagedSubmitting={damagedSubmitting} damagedSubmitError={damagedSubmitError} damagedSubmitSuccess={damagedSubmitSuccess}
                            handleDamagedReportSubmit={handleDamagedReportSubmit} inputStyle={inputStyle} btnPrimary={btnPrimary} btnSecondary={btnSecondary}
                        />'''

page_text = page_text[:old_invocation_start] + new_invocation + page_text[old_invocation_end:]

with open('c:/Shashini/Skynet_Projects/parcel_allocation_web/src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_text)

print('Updated DamagedBarcodeTab component and page.tsx invocation successfully.')
