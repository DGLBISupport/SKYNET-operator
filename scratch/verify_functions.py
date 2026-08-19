import os
import re

with open('backup.md', 'r', encoding='utf-8') as f:
    backup_code = f.read()

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    page_code = f.read()

# Let's find all function bodies in backup.md
func_names = [
    'generateCode128SVG', 'extractLatestBarcode', 'resolvePartnerName',
    'getPageHeaderInfo', 'handleLogout', 'handleSwitchUserSubmit',
    'handleRenewPinSubmit', 'fetchOutboundManifests', 'fetchOutboundBags',
    'handleCreateOutboundBag', 'handleCreateOutboundManifest',
    'handleFirstScanSubmit', 'handleFirstScanSubmitOverride',
    'handleConfirmFinish', 'autoFinishBag', 'handleForceUnsealWithNote',
    'handleAllocateSubmit', 'handleDamagedBarcodeSubmit',
    'handleVerifySubmit', 'handleFetchManifestTrackingData',
    'handleTestScannerKeyDown', 'handleClearTestInput',
    'getBagScannedCount', 'getBagStatus', 'getSortedBags',
    'getNextManifestPreviewCode', 'getManifestProviderName'
]

results = []
for name in func_names:
    in_backup = name in backup_code
    in_page = name in page_code
    results.append((name, in_backup, in_page))

print('Function availability verification:')
for name, b, p in results:
    status = 'OK' if (b and p) else ('MISSING IN PAGE' if b and not p else 'OTHER')
    print(f'  {name:32}: backup={b}, page.tsx={p} -> {status}')
