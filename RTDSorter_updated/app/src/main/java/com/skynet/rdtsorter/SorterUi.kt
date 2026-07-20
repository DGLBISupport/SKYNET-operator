package com.skynet.rdtsorter

import android.net.Uri
import java.util.Locale
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SorterDashboard(
    activeTab: String,
    scannedToday: Int,
    apiBaseUrl: String,
    dbCount: Int,
    scannerConnected: Boolean?,
    timeString: String,
    
    // Tab 1: 1st Scan
    mawbsList: List<MawbData>,
    selectedMawb: String,
    bagsList: List<BagData>,
    selectedBag: String,
    expectedCount: Int?,
    firstScanInput: String,
    firstScanLastScanned: String,
    firstScanHistory: List<FirstScanHistoryItem>,
    firstScanCurrentScan: AllocationResponse?,
    firstScanStatus: String,
    firstScanError: String,
    unsealedBoxes: List<UnsealedBoxData>,

    // Tab 2: 2nd Scan
    barcodeInput: String,
    lastScanned: String,
    currentScan: AllocationResponse?,
    status: String,
    errorMessage: String,
    history: List<AllocationResponse>,

    // Tab 3: Damaged Scan
    damagedBarcodeInput: String,
    damagedLastScanned: String,
    damagedCurrentScan: AllocationResponse?,
    damagedStatus: String,
    damagedErrorMessage: String,
    damagedHistory: List<AllocationResponse>,

    // Tab 4: Dispatch Verify
    selectedBin: String?,
    verifyBarcodeInput: String,
    lastVerifyScanned: String,
    verifyScan: AllocationResponse?,
    verifyStatus: String,
    verifyErrorMessage: String,
    binCounts: Map<String, Int>,
    verifiedCount: Int,
    mismatchCount: Int,
    pendingDispatch: Int,
    verifyHistory: List<VerifyHistoryItem>,

    // Device Manager Dialog states
    isScannerManagerOpen: Boolean,
    testScannerInput: String,
    testScannerSpeed: String,
    onOpenScannerManager: () -> Unit,
    onCloseScannerManager: () -> Unit,
    onTestScannerInputChange: (String) -> Unit,

    // Dialog states
    duplicateBarcode: String?,
    duplicateType: String?,
    confirmFinishModalOpen: Boolean,
    successModalTitle: String,
    successModalMessage: String,

    onCloseDuplicateModal: () -> Unit,
    onCloseConfirmFinishModal: () -> Unit,
    onCloseSuccessModal: () -> Unit,
    onTriggerConfirmFinishBox: () -> Unit,

    // Handlers
    onTabSelected: (String) -> Unit,
    onMawbSelected: (String) -> Unit,
    onBagSelected: (String) -> Unit,
    onFirstScanSubmit: (String) -> Unit,
    onFinishBox: () -> Unit,
    onResetFirstScan: () -> Unit,
    onFirstScanInputChange: (String) -> Unit,

    onAllocationSubmit: (String) -> Unit,
    onClearAllocation: () -> Unit,
    onChangeLMDAllocation: () -> Unit,
    onAllocationInputChange: (String) -> Unit,

    onDamagedScanSubmit: (String) -> Unit,
    onConfirmDispatchDamaged: () -> Unit,
    onClearDamagedScan: () -> Unit,
    onChangeLMDDamaged: () -> Unit,
    onDamagedInputChange: (String) -> Unit,

    onVerifyBinSelected: (String?) -> Unit,
    onVerifySubmit: (String) -> Unit,
    onConfirmDispatchVerify: () -> Unit,
    onVerifyInputChange: (String) -> Unit,

    onImportCsv: (Uri) -> Unit,
    onApiBaseUrlChange: (String) -> Unit,
    onClearAllStates: () -> Unit
) {
    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { onImportCsv(it) }
    }

    if (isScannerManagerOpen) {
        AlertDialog(
            onDismissRequest = onCloseScannerManager,
            confirmButton = {
                Button(
                    onClick = onCloseScannerManager,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("Close", color = Color.White)
                }
            },
            title = {
                Text("Scanner & Device Manager", color = Color(0xFF1E293B), fontWeight = FontWeight.Bold)
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "In-built Hardware Scan Wedge",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = Color(0xFF1E293B)
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(RoundedCornerShape(50))
                                            .background(Color(0xFF16A34A))
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Active & Connected",
                                        color = Color(0xFF16A34A),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Receives hardware wedge scan broadcasts automatically via 'com.skynet.ACTION_BARCODE_SCAN'. Ready to scan at any time.",
                                color = Color(0xFF64748B),
                                fontSize = 11.sp
                            )
                        }
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "USB / Bluetooth Wedge Scanner",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = Color(0xFF1E293B)
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(RoundedCornerShape(50))
                                            .background(
                                                if (scannerConnected == true) Color(0xFF16A34A) else Color(0xFFD97706)
                                            )
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = if (scannerConnected == true) "Connected" else "Awaiting Scan...",
                                        color = if (scannerConnected == true) Color(0xFF16A34A) else Color(0xFFD97706),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Acts as keyboard emulation. Scan the test barcode below to auto-calibrate and register the connected scanner.",
                                color = Color(0xFF64748B),
                                fontSize = 11.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))

                            OutlinedTextField(
                                value = testScannerInput,
                                onValueChange = onTestScannerInputChange,
                                label = { Text("Scan test barcode here", fontSize = 11.sp) },
                                placeholder = { Text("Barcode scanner input field...", color = Color.Gray, fontSize = 11.sp) },
                                singleLine = true,
                                textStyle = LocalTextStyle.current.copy(fontSize = 12.sp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFFE21B22),
                                    unfocusedBorderColor = Color(0xFFCBD5E1)
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )

                            if (testScannerSpeed.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = testScannerSpeed,
                                    color = if (testScannerSpeed.contains("Verified")) Color(0xFF16A34A) else Color(0xFFDC2626),
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            },
            containerColor = Color.White
        )
    }

    if (!duplicateBarcode.isNullOrEmpty()) {
        AlertDialog(
            onDismissRequest = onCloseDuplicateModal,
            confirmButton = {
                Button(
                    onClick = onCloseDuplicateModal,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("Acknowledge", color = Color.White)
                }
            },
            title = {
                Text("Duplicate Scan Detected", color = Color(0xFF1E293B), fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    text = "Barcode \"$duplicateBarcode\" has already been ${if (duplicateType == "first") "scanned in this box" else "scanned/allocated"} today!",
                    color = Color(0xFF64748B)
                )
            },
            containerColor = Color.White
        )
    }

    if (confirmFinishModalOpen) {
        AlertDialog(
            onDismissRequest = onCloseConfirmFinishModal,
            confirmButton = {
                Button(
                    onClick = onFinishBox,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("Yes, Finish Box", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = onCloseConfirmFinishModal) {
                    Text("Cancel", color = Color(0xFF64748B))
                }
            },
            title = {
                Text("Finish Box Session?", color = Color(0xFF1E293B), fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    text = "Are you sure you want to finish and close this box session? This will lock the current count.",
                    color = Color(0xFF64748B)
                )
            },
            containerColor = Color.White
        )
    }

    if (successModalTitle.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = onCloseSuccessModal,
            confirmButton = {
                Button(
                    onClick = onCloseSuccessModal,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
                ) {
                    Text("Acknowledge", color = Color.White)
                }
            },
            title = {
                Text(successModalTitle, color = Color(0xFF1E293B), fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    text = successModalMessage,
                    color = Color(0xFF64748B)
                )
            },
            containerColor = Color.White
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF1F5F9))
    ) {
        // --- HEADER (Red Accent) ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFE21B22))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = if (activeTab == "verify") "SKYNET DISPATCH VERIFY" else "SKYNET PARCEL SYSTEM",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.1f), shape = RoundedCornerShape(4.dp))
                        .clickable { onOpenScannerManager() }
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(RoundedCornerShape(50))
                            .background(
                                when (scannerConnected) {
                                    true -> Color(0xFF4ADE80)
                                    false -> Color(0xFFFCA5A5)
                                    else -> Color(0xFFFCD34D)
                                }
                            )
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = when (scannerConnected) {
                            true -> "Scanner Connected"
                            false -> "No Scanner"
                            else -> "Awaiting Scanner"
                        },
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 11.sp
                    )
                    Text(
                        text = " ⚙",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Text(
                text = timeString,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        // --- NAVIGATION TABS ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .border(width = (0.5).dp, color = Color(0xFFE2E8F0))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            val tabs = listOf(
                "first-scan" to "1st Scan",
                "second-scan" to "2nd Scan",
                "damaged-barcode" to "Damaged",
                "verify" to "Verify",
                "settings" to "Settings"
            )
            tabs.forEach { (tabId, tabName) ->
                val isSelected = activeTab == tabId
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isSelected) Color(0xFFE21B22) else Color.Transparent)
                        .clickable { onTabSelected(tabId) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = tabName,
                        color = if (isSelected) Color.White else Color(0xFF64748B),
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }

        // --- TAB CONTENT ---
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when (activeTab) {
                "first-scan" -> {
                    FirstScanTab(
                        mawbsList = mawbsList,
                        selectedMawb = selectedMawb,
                        bagsList = bagsList,
                        selectedBag = selectedBag,
                        expectedCount = expectedCount,
                        firstScanInput = firstScanInput,
                        firstScanLastScanned = firstScanLastScanned,
                        firstScanHistory = firstScanHistory,
                        firstScanCurrentScan = firstScanCurrentScan,
                        firstScanStatus = firstScanStatus,
                        firstScanError = firstScanError,
                        unsealedBoxes = unsealedBoxes,
                        onMawbSelected = onMawbSelected,
                        onBagSelected = onBagSelected,
                        onFirstScanInputChange = onFirstScanInputChange,
                        onFirstScanSubmit = onFirstScanSubmit,
                        onFinishBox = onTriggerConfirmFinishBox,
                        onResetFirstScan = onResetFirstScan
                    )
                }
                "second-scan" -> {
                    AllocationTab(
                        barcodeInput = barcodeInput,
                        lastScanned = lastScanned,
                        currentScan = currentScan,
                        status = status,
                        errorMessage = errorMessage,
                        scannedToday = scannedToday,
                        history = history,
                        onAllocationInputChange = onAllocationInputChange,
                        onAllocationSubmit = onAllocationSubmit,
                        onClearAllocation = onClearAllocation,
                        onChangeLMDAllocation = onChangeLMDAllocation
                    )
                }
                "damaged-barcode" -> {
                    DamagedScanTab(
                        damagedBarcodeInput = damagedBarcodeInput,
                        damagedLastScanned = damagedLastScanned,
                        damagedCurrentScan = damagedCurrentScan,
                        damagedStatus = damagedStatus,
                        damagedErrorMessage = damagedErrorMessage,
                        scannedToday = scannedToday,
                        damagedHistory = damagedHistory,
                        onDamagedInputChange = onDamagedInputChange,
                        onDamagedScanSubmit = onDamagedScanSubmit,
                        onConfirmDispatchDamaged = onConfirmDispatchDamaged,
                        onClearDamagedScan = onClearDamagedScan,
                        onChangeLMDDamaged = onChangeLMDDamaged
                    )
                }
                "verify" -> {
                    VerifyTab(
                        selectedBin = selectedBin,
                        verifyBarcodeInput = verifyBarcodeInput,
                        lastVerifyScanned = lastVerifyScanned,
                        verifyScan = verifyScan,
                        verifyStatus = verifyStatus,
                        verifyErrorMessage = verifyErrorMessage,
                        binCounts = binCounts,
                        verifiedCount = verifiedCount,
                        mismatchCount = mismatchCount,
                        pendingDispatch = pendingDispatch,
                        verifyHistory = verifyHistory,
                        onVerifyBinSelected = onVerifyBinSelected,
                        onVerifyInputChange = onVerifyInputChange,
                        onVerifySubmit = onVerifySubmit,
                        onConfirmDispatchVerify = onConfirmDispatchVerify
                    )
                }
                "settings" -> {
                    SettingsTab(
                        apiBaseUrl = apiBaseUrl,
                        dbCount = dbCount,
                        onImportCsvClick = { filePicker.launch("text/*") },
                        onApiBaseUrlChange = onApiBaseUrlChange,
                        onClearAllStates = onClearAllStates
                    )
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════

@Composable
fun CardWrapper(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = title.uppercase(),
                color = Color(0xFF64748B),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp
            )
            content()
        }
    }
}

@Composable
fun KeyValueRow(label: String, value: String, isLast: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color(0xFF64748B), fontSize = 13.sp)
        Text(value, color = Color(0xFF1E293B), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    }
    if (!isLast) {
        HorizontalDivider(color = Color(0xFFE2E8F0), thickness = 1.dp)
    }
}

@Composable
fun CustomDropdown(
    label: String,
    placeholder: String,
    options: List<String>,
    selectedOption: String,
    onOptionSelected: (String) -> Unit,
    enabled: Boolean = true
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            color = Color(0xFF64748B),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (enabled) Color(0xFFF8FAFC) else Color(0xFFF1F5F9).copy(alpha = 0.5f),
                    shape = RoundedCornerShape(8.dp)
                )
                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                .clickable(enabled = enabled) { expanded = true }
                .padding(horizontal = 14.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = selectedOption.ifEmpty { placeholder },
                    color = if (selectedOption.isNotEmpty()) Color(0xFF1E293B) else Color(0xFF94A3B8),
                    fontSize = 13.sp
                )
                Text("▼", color = Color(0xFF64748B), fontSize = 10.sp)
            }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .background(Color.White)
            ) {
                options.forEach { opt ->
                    DropdownMenuItem(
                        text = { Text(opt, color = Color(0xFF1E293B), fontSize = 13.sp) },
                        onClick = {
                            onOptionSelected(opt)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun VisualLmdCard(partner: String?, zone: String?, missedFirstScan: Boolean? = false) {
    val bg = when (partner) {
        "PickMe" -> Color(0xFFFFCC00)
        "Domex" -> Color(0xFF7B0F1A)
        "Pronto" -> Color(0xFFEA580C)
        else -> Color(0xFFF1F5F9)
    }
    val fg = when (partner) {
        "PickMe" -> Color.Black
        "Domex", "Pronto" -> Color.White
        else -> Color(0xFF1E293B)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(bg, shape = RoundedCornerShape(12.dp))
            .border(
                width = 2.dp,
                color = when (partner) {
                    "PickMe" -> Color(0xFFFFCC00)
                    "Domex" -> Color(0xFF7B0F1A)
                    "Pronto" -> Color(0xFFEA580C)
                    else -> Color(0xFFE2E8F0)
                },
                shape = RoundedCornerShape(12.dp)
            )
            .padding(vertical = 24.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "ASSIGNED COURIER",
            color = fg.copy(alpha = 0.7f),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = partner?.uppercase() ?: "AWAITING SCAN",
            color = fg,
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center
        )
        if (!zone.isNullOrEmpty()) {
            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .background(fg.copy(alpha = 0.15f), shape = RoundedCornerShape(20.dp))
                    .padding(horizontal = 14.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "Zone: $zone",
                    color = fg,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        if (missedFirstScan == true) {
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .background(Color(0xFFDC2626), shape = RoundedCornerShape(6.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "⚠️ MISSED 1ST SCAN (AUTO RECORDED)",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun DetailedParcelCard(parcel: ParcelData, headerSlot: (@Composable RowScope.() -> Unit)? = null) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "PARCEL DETAILS",
                    color = Color(0xFF64748B),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
                headerSlot?.invoke(this)
            }
            KeyValueRow("Tracking no.", parcel.trackingNumber)
            KeyValueRow("Recipient", parcel.recipientName)
            KeyValueRow("City", parcel.city)
            KeyValueRow("District", parcel.district)
            KeyValueRow("Weight", "${String.format(Locale.US, "%.3f", parcel.weight)} kg")
            KeyValueRow("Value", parcel.value ?: "LKR 0.00")
            KeyValueRow("Account", parcel.account ?: "—")
            KeyValueRow("API Sync", "✓ ${parcel.apiSync ?: "Synced"}", isLast = true)
            
            if (parcel.recipientAddress != null || parcel.senderName != null || parcel.mawbRef != null) {
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = Color(0xFFE2E8F0), thickness = 2.dp)
                Spacer(modifier = Modifier.height(12.dp))

                if (!parcel.recipientAddress.isNullOrEmpty()) {
                    Text(
                        "DELIVERY ADDRESS",
                        color = Color(0xFF64748B),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        parcel.recipientAddress,
                        color = Color(0xFF1E293B),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
                    )
                }
                if (!parcel.senderName.isNullOrEmpty()) {
                    Text(
                        "SENDER DETAILS",
                        color = Color(0xFF64748B),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        parcel.senderName,
                        color = Color(0xFF1E293B),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
                    )
                }
                if (!parcel.mawbRef.isNullOrEmpty()) {
                    Text(
                        "MAWB REFERENCE",
                        color = Color(0xFF64748B),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "${parcel.mawbRef} (${parcel.mawbCarrier ?: "Unknown"} / Flight: ${parcel.mawbFlight ?: "—"})",
                        color = Color(0xFF1E293B),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// TAB 1: 1ST SCAN (BOX UNSEALING) VIEW
// ═══════════════════════════════════════════════════════
@Composable
fun FirstScanTab(
    mawbsList: List<MawbData>,
    selectedMawb: String,
    bagsList: List<BagData>,
    selectedBag: String,
    expectedCount: Int?,
    firstScanInput: String,
    firstScanLastScanned: String,
    firstScanHistory: List<FirstScanHistoryItem>,
    firstScanCurrentScan: AllocationResponse?,
    firstScanStatus: String,
    firstScanError: String,
    unsealedBoxes: List<UnsealedBoxData>,
    onMawbSelected: (String) -> Unit,
    onBagSelected: (String) -> Unit,
    onFirstScanInputChange: (String) -> Unit,
    onFirstScanSubmit: (String) -> Unit,
    onFinishBox: () -> Unit,
    onResetFirstScan: () -> Unit
) {
    if (firstScanError.isNotEmpty()) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFFFCA5A5), RoundedCornerShape(8.dp))
        ) {
            Text(
                text = "Scan Error: $firstScanError",
                color = Color(0xFFDC2626),
                modifier = Modifier.padding(12.dp),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }

    CardWrapper(title = "Box Setup & Unsealing") {
        CustomDropdown(
            label = "Select MAWB Reference *",
            placeholder = "-- Choose active MAWB reference --",
            options = mawbsList.map { it.mawb_reference },
            selectedOption = selectedMawb,
            onOptionSelected = onMawbSelected
        )
        Spacer(modifier = Modifier.height(4.dp))
        CustomDropdown(
            label = "Select Bag Number *",
            placeholder = "-- Choose bag to unseal --",
            options = bagsList.map { it.bagNumber },
            selectedOption = selectedBag,
            onOptionSelected = onBagSelected,
            enabled = selectedMawb.isNotEmpty()
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Expected Parcel Count",
            color = Color(0xFF64748B),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
        OutlinedTextField(
            value = expectedCount?.let { "$it parcels" } ?: "Manifest Expected Count",
            onValueChange = {},
            enabled = false,
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = Color(0xFF1E293B),
                disabledBorderColor = Color(0xFFE2E8F0),
                disabledContainerColor = Color(0xFFF8FAFC)
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Scan Box Barcode",
            color = Color(0xFF64748B),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
        OutlinedTextField(
            value = firstScanInput,
            onValueChange = onFirstScanInputChange,
            placeholder = { Text("Scan or enter barcode...", color = Color.Gray) },
            singleLine = true,
            enabled = selectedBag.isNotEmpty(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color(0xFF1E293B),
                unfocusedTextColor = Color(0xFF1E293B),
                focusedBorderColor = Color(0xFFE21B22),
                unfocusedBorderColor = Color(0xFFCBD5E1)
            ),
            modifier = Modifier.fillMaxWidth(),
            trailingIcon = {
                Button(
                    onClick = { onFirstScanSubmit(firstScanInput) },
                    enabled = selectedBag.isNotEmpty() && firstScanInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("OK", color = Color.White)
                }
            }
        )
        if (firstScanLastScanned.isNotEmpty()) {
            Text(
                text = "Last Scanned: $firstScanLastScanned",
                color = Color(0xFF10B981),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }

    VisualLmdCard(
        partner = firstScanCurrentScan?.assignedPartner,
        zone = firstScanCurrentScan?.assignedZone
    )

    CardWrapper(title = "Count Verification") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(8.dp))
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Expected", color = Color(0xFF64748B), fontSize = 11.sp)
                Text(
                    text = expectedCount?.toString() ?: "—",
                    color = Color(0xFF1E293B),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black
                )
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(8.dp))
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Scanned", color = Color(0xFF64748B), fontSize = 11.sp)
                Text(
                    text = firstScanHistory.size.toString(),
                    color = Color(0xFF1E293B),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }

        if (expectedCount != null) {
            val discrepancy = firstScanHistory.size - expectedCount
            val statusColor = when {
                discrepancy == 0 -> Color(0xFF10B981)
                discrepancy < 0 -> Color(0xFF2563EB)
                else -> Color(0xFFDC2626)
            }
            Text(
                text = when {
                    discrepancy == 0 -> "✓ Counts Match!"
                    discrepancy < 0 -> "Remaining: ${-discrepancy} left"
                    else -> "Surplus: $discrepancy extra"
                },
                color = statusColor,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = onFinishBox,
                enabled = selectedBag.isNotEmpty() && firstScanHistory.size > 0 && firstScanHistory.size == expectedCount,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22)),
                modifier = Modifier.weight(1.5f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Finish Box", color = Color.White, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = onResetFirstScan,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1F5F9)),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Reset", color = Color(0xFF1E293B))
            }
        }
    }

    CardWrapper(title = "Scanned In current bag (${firstScanHistory.size})") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            firstScanHistory.take(5).forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(6.dp))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(item.trackingNumber, color = Color(0xFF1E293B), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(item.recipientName, color = Color(0xFF64748B), fontSize = 11.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(item.city, color = Color(0xFF64748B), fontSize = 12.sp)
                        if (!item.assignedPartner.isNullOrEmpty()) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = item.assignedPartner,
                                color = when (item.assignedPartner) {
                                    "PickMe" -> Color(0xFFD97706)
                                    "Domex" -> Color(0xFFDC2626)
                                    "Pronto" -> Color(0xFFEA580C)
                                    else -> Color(0xFF1E293B)
                                },
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
            if (firstScanHistory.isEmpty()) {
                Text(
                    "No items scanned in this session.",
                    color = Color.Gray,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        }
    }

    CardWrapper(title = "Unsealed Bags History") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            unsealedBoxes.take(5).forEach { box ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(6.dp))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(box.mawb, color = Color(0xFF1E293B), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("Bag: ${box.bagNumber ?: "—"}", color = Color(0xFF64748B), fontSize = 11.sp)
                    }
                    Text(
                        text = "${box.scanned}/${box.expected}",
                        color = if (box.scanned == box.expected) Color(0xFF10B981) else Color(0xFFDC2626),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            if (unsealedBoxes.isEmpty()) {
                Text(
                    "No unsealed bags in history.",
                    color = Color.Gray,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// TAB 2: LMD ALLOCATION VIEW
// ═══════════════════════════════════════════════════════
@Composable
fun AllocationTab(
    barcodeInput: String,
    lastScanned: String,
    currentScan: AllocationResponse?,
    status: String,
    errorMessage: String,
    scannedToday: Int,
    history: List<AllocationResponse>,
    onAllocationInputChange: (String) -> Unit,
    onAllocationSubmit: (String) -> Unit,
    onClearAllocation: () -> Unit,
    onChangeLMDAllocation: () -> Unit
) {
    if (status == "ERROR" && errorMessage.isNotEmpty()) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFFFCA5A5), RoundedCornerShape(8.dp))
        ) {
            Text(
                text = "Allocation Failed: $errorMessage",
                color = Color(0xFFDC2626),
                modifier = Modifier.padding(12.dp),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }

    CardWrapper(title = "Barcode Input") {
        OutlinedTextField(
            value = barcodeInput,
            onValueChange = onAllocationInputChange,
            placeholder = { Text("Scan or enter barcode...", color = Color.Gray) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color(0xFF1E293B),
                unfocusedTextColor = Color(0xFF1E293B),
                focusedBorderColor = Color(0xFFE21B22),
                unfocusedBorderColor = Color(0xFFCBD5E1)
            ),
            modifier = Modifier.fillMaxWidth(),
            trailingIcon = {
                Button(
                    onClick = { onAllocationSubmit(barcodeInput) },
                    enabled = barcodeInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("Check", color = Color.White)
                }
            }
        )
        KeyValueRow("Manifest", currentScan?.parcel?.mawbRef ?: "—")
        KeyValueRow("Scanned Today", scannedToday.toString(), isLast = true)
    }

    VisualLmdCard(
        partner = currentScan?.assignedPartner,
        zone = currentScan?.assignedZone,
        missedFirstScan = currentScan?.missedFirstScan
    )

    if (currentScan?.parcel != null) {
        DetailedParcelCard(parcel = currentScan.parcel) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Button(
                    onClick = onChangeLMDAllocation,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1F5F9)),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Change LMD", fontSize = 10.sp, color = Color(0xFF1E293B))
                }
                Button(
                    onClick = onClearAllocation,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Confirm", fontSize = 10.sp, color = Color.White)
                }
                Button(
                    onClick = onClearAllocation,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Clear", fontSize = 10.sp, color = Color.White)
                }
            }
        }
    }

    CardWrapper(title = "Recent Scans History") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            history.take(5).forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(6.dp))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(item.parcel?.trackingNumber ?: "—", color = Color(0xFF1E293B), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(item.parcel?.recipientName ?: "—", color = Color(0xFF64748B), fontSize = 11.sp)
                    }
                    Text(
                        text = item.assignedPartner ?: "—",
                        color = when (item.assignedPartner) {
                            "PickMe" -> Color(0xFFD97706)
                            "Domex" -> Color(0xFFDC2626)
                            "Pronto" -> Color(0xFFEA580C)
                            else -> Color(0xFF1E293B)
                        },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            if (history.isEmpty()) {
                Text(
                    "No operations logged in this session.",
                    color = Color.Gray,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// TAB 3: DAMAGED SCAN VIEW
// ═══════════════════════════════════════════════════════
@Composable
fun DamagedScanTab(
    damagedBarcodeInput: String,
    damagedLastScanned: String,
    damagedCurrentScan: AllocationResponse?,
    damagedStatus: String,
    damagedErrorMessage: String,
    scannedToday: Int,
    damagedHistory: List<AllocationResponse>,
    onDamagedInputChange: (String) -> Unit,
    onDamagedScanSubmit: (String) -> Unit,
    onConfirmDispatchDamaged: () -> Unit,
    onClearDamagedScan: () -> Unit,
    onChangeLMDDamaged: () -> Unit
) {
    if (damagedStatus == "ERROR" && damagedErrorMessage.isNotEmpty()) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFFFCA5A5), RoundedCornerShape(8.dp))
        ) {
            Text(
                text = "Lookup Failed: $damagedErrorMessage",
                color = Color(0xFFDC2626),
                modifier = Modifier.padding(12.dp),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }

    CardWrapper(title = "Damaged Label (Temu Barcode) Input") {
        OutlinedTextField(
            value = damagedBarcodeInput,
            onValueChange = onDamagedInputChange,
            placeholder = { Text("Scan Temu Barcode (e.g. BG-...)", color = Color.Gray) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color(0xFF1E293B),
                unfocusedTextColor = Color(0xFF1E293B),
                focusedBorderColor = Color(0xFFE21B22),
                unfocusedBorderColor = Color(0xFFCBD5E1)
            ),
            modifier = Modifier.fillMaxWidth(),
            trailingIcon = {
                Button(
                    onClick = { onDamagedScanSubmit(damagedBarcodeInput) },
                    enabled = damagedBarcodeInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("Resolve", color = Color.White)
                }
            }
        )
        KeyValueRow("Manifest", damagedCurrentScan?.parcel?.mawbRef ?: "—")
        KeyValueRow("Scanned Today", scannedToday.toString(), isLast = true)
    }

    if (damagedCurrentScan?.parcel != null) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
            shape = RoundedCornerShape(10.dp)
        ) {
            Column(
                modifier = Modifier.padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "RESOLVED SKYNET ID",
                    color = Color(0xFFDC2626),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = damagedCurrentScan.parcel.trackingNumber,
                    color = Color(0xFFDC2626),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
    }

    VisualLmdCard(
        partner = damagedCurrentScan?.assignedPartner,
        zone = damagedCurrentScan?.assignedZone,
        missedFirstScan = damagedCurrentScan?.missedFirstScan
    )

    if (damagedCurrentScan?.parcel != null) {
        DetailedParcelCard(parcel = damagedCurrentScan.parcel) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Button(
                    onClick = onChangeLMDDamaged,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1F5F9)),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Change Partner", fontSize = 10.sp, color = Color(0xFF1E293B))
                }
                Button(
                    onClick = onConfirmDispatchDamaged,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Confirm", fontSize = 10.sp, color = Color.White)
                }
                Button(
                    onClick = onClearDamagedScan,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Clear", fontSize = 10.sp, color = Color.White)
                }
            }
        }
    }

    CardWrapper(title = "Recent Damaged Scans") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            damagedHistory.take(5).forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(6.dp))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(item.parcel?.trackingNumber ?: "—", color = Color(0xFF1E293B), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("Temu: ${item.parcel?.senderReference ?: "—"}", color = Color(0xFF64748B), fontSize = 11.sp)
                    }
                    Text(
                        text = item.assignedPartner ?: "—",
                        color = Color(0xFF16A34A),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            if (damagedHistory.isEmpty()) {
                Text(
                    "No resolved scans in this session.",
                    color = Color.Gray,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
// TAB 4: DISPATCH VERIFY VIEW
// ═══════════════════════════════════════════════════════
@Composable
fun VerifyTab(
    selectedBin: String?,
    verifyBarcodeInput: String,
    lastVerifyScanned: String,
    verifyScan: AllocationResponse?,
    verifyStatus: String,
    verifyErrorMessage: String,
    binCounts: Map<String, Int>,
    verifiedCount: Int,
    mismatchCount: Int,
    pendingDispatch: Int,
    verifyHistory: List<VerifyHistoryItem>,
    onVerifyBinSelected: (String?) -> Unit,
    onVerifyInputChange: (String) -> Unit,
    onVerifySubmit: (String) -> Unit,
    onConfirmDispatchVerify: () -> Unit
) {
    if (verifyStatus == "ERROR" && verifyErrorMessage.isNotEmpty()) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFFFCA5A5), RoundedCornerShape(8.dp))
        ) {
            Text(
                text = "Verification Error: $verifyErrorMessage",
                color = Color(0xFFDC2626),
                modifier = Modifier.padding(12.dp),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }

    // Stats Grid
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val stats = listOf(
            Triple("Verified", verifiedCount, Color(0xFF16A34A)),
            Triple("Mismatches", mismatchCount, Color(0xFFDC2626)),
            Triple("Pending", pendingDispatch, Color(0xFF1E293B))
        )
        stats.forEach { (lbl, cnt, color) ->
            Card(
                modifier = Modifier
                    .weight(1f)
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp)),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(cnt.toString(), color = color, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text(lbl, color = Color(0xFF64748B), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    CardWrapper(title = "Select Dispatch Bin") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            val bins = listOf("PickMe", "Domex")
            bins.forEach { bin ->
                val isSelected = selectedBin == bin
                val count = binCounts[bin] ?: 0
                val accentColor = if (bin == "PickMe") Color(0xFFFFCC00) else Color(0xFF7B0F1A)
                
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(
                            if (isSelected) accentColor else Color(0xFFF1F5F9),
                            shape = RoundedCornerShape(8.dp)
                        )
                        .border(
                            1.dp,
                            if (isSelected) accentColor else Color(0xFFE2E8F0),
                            RoundedCornerShape(8.dp)
                        )
                        .clickable { onVerifyBinSelected(bin) }
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = bin.uppercase(),
                            color = if (isSelected) {
                                if (bin == "PickMe") Color.Black else Color.White
                            } else Color(0xFF1E293B),
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (count == 0) "Empty" else "$count parcels",
                            color = if (isSelected) {
                                if (bin == "PickMe") Color.Black.copy(alpha = 0.8f) else Color.White.copy(alpha = 0.8f)
                            } else Color(0xFF64748B),
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }

    CardWrapper(title = "Verify Scan Input") {
        OutlinedTextField(
            value = verifyBarcodeInput,
            onValueChange = onVerifyInputChange,
            placeholder = { Text(if (selectedBin != null) "Scan parcel to verify bin..." else "Select a dispatch bin first...", color = Color.Gray) },
            singleLine = true,
            enabled = selectedBin != null,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color(0xFF1E293B),
                unfocusedTextColor = Color(0xFF1E293B),
                focusedBorderColor = Color(0xFFE21B22),
                unfocusedBorderColor = Color(0xFFCBD5E1)
            ),
            modifier = Modifier.fillMaxWidth(),
            trailingIcon = {
                Button(
                    onClick = { onVerifySubmit(verifyBarcodeInput) },
                    enabled = selectedBin != null && verifyBarcodeInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE21B22))
                ) {
                    Text("OK", color = Color.White)
                }
            }
        )
        KeyValueRow("Active Bin", selectedBin ?: "None selected")
        KeyValueRow("Last Scanned ID", lastVerifyScanned.ifEmpty { "—" })
        KeyValueRow("Allocated Partner", verifyScan?.assignedPartner ?: "—")
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Result", color = Color(0xFF64748B), fontSize = 13.sp)
            Text(
                text = verifyStatus,
                color = when (verifyStatus) {
                    "MATCH" -> Color(0xFF10B981)
                    "MISMATCH" -> Color(0xFFDC2626)
                    else -> Color(0xFF1E293B)
                },
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp
            )
        }
    }

    if (verifyScan?.parcel != null) {
        DetailedParcelCard(parcel = verifyScan.parcel)
    }

    CardWrapper(title = "Session Scan Logs") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            verifyHistory.take(5).forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(6.dp))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(item.trackingNumber, color = Color(0xFF1E293B), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("Bin: ${item.bin} (Partner: ${item.assignedPartner})", color = Color(0xFF64748B), fontSize = 11.sp)
                    }
                    Text(
                        text = if (item.isMatch) "MATCH" else "MISMATCH",
                        color = if (item.isMatch) Color(0xFF16A34A) else Color(0xFFDC2626),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            if (verifyHistory.isEmpty()) {
                Text(
                    "No scans verified in this session.",
                    color = Color.Gray,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))
        Button(
            onClick = onConfirmDispatchVerify,
            enabled = verifiedCount > 0,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Confirm Dispatch Batch (${verifiedCount})", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

// ═══════════════════════════════════════════════════════
// TAB 5: SETTINGS & OFFLINE CONFIG VIEW
// ═══════════════════════════════════════════════════════
@Composable
fun SettingsTab(
    apiBaseUrl: String,
    dbCount: Int,
    onImportCsvClick: () -> Unit,
    onApiBaseUrlChange: (String) -> Unit,
    onClearAllStates: () -> Unit
) {
    CardWrapper(title = "Local Manifest Database") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Manifest count: $dbCount entries", color = Color(0xFF1E293B), fontSize = 13.sp)
                Text("Use CSV to sync database offline", color = Color(0xFF64748B), fontSize = 11.sp)
            }
            Button(
                onClick = onImportCsvClick,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Import CSV", color = Color.White)
            }
        }
    }

    CardWrapper(title = "Server Connection settings") {
        OutlinedTextField(
            value = apiBaseUrl,
            onValueChange = onApiBaseUrlChange,
            label = { Text("API Backend URL Endpoint") },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color(0xFF1E293B),
                unfocusedTextColor = Color(0xFF1E293B),
                focusedLabelColor = Color(0xFFE21B22),
                focusedBorderColor = Color(0xFFE21B22),
                unfocusedBorderColor = Color(0xFFCBD5E1)
            ),
            modifier = Modifier.fillMaxWidth()
        )
        Text(
            text = "Specify http://[server-ip]:3000/api/allocate to point this terminal at your local workstation server.",
            color = Color(0xFF64748B),
            fontSize = 11.sp
        )
    }

    CardWrapper(title = "Application operations control") {
        Button(
            onClick = onClearAllStates,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7F1D1D)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Clear Session Counters & Cache", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@androidx.compose.ui.tooling.preview.Preview(showBackground = true, showSystemUi = true)
@Composable
fun SorterDashboardPreview() {
    SorterDashboard(
        activeTab = "first-scan",
        scannedToday = 12,
        apiBaseUrl = "http://10.0.2.2:3000/api/allocate",
        dbCount = 145,
        scannerConnected = true,
        timeString = "14:25:09",
        mawbsList = listOf(MawbData("MAWB-7102833", "EK", 10)),
        selectedMawb = "MAWB-7102833",
        bagsList = listOf(BagData("BAG-01", 5)),
        selectedBag = "BAG-01",
        expectedCount = 5,
        firstScanInput = "",
        firstScanLastScanned = "710283328775",
        firstScanHistory = listOf(
            FirstScanHistoryItem("710283328775", "John Doe", "Colombo", "14:24:10")
        ),
        firstScanCurrentScan = null,
        firstScanStatus = "READY",
        firstScanError = "",
        unsealedBoxes = listOf(
            UnsealedBoxData("MAWB-7102833", "BAG-02", 10, 10, "14:15")
        ),
        barcodeInput = "",
        lastScanned = "",
        currentScan = null,
        status = "READY",
        errorMessage = "",
        history = emptyList(),
        damagedBarcodeInput = "",
        damagedLastScanned = "",
        damagedCurrentScan = null,
        damagedStatus = "READY",
        damagedErrorMessage = "",
        damagedHistory = emptyList(),
        selectedBin = null,
        verifyBarcodeInput = "",
        lastVerifyScanned = "",
        verifyScan = null,
        verifyStatus = "READY",
        verifyErrorMessage = "",
        binCounts = mapOf("PickMe" to 3, "Domex" to 1, "Pronto" to 0),
        verifiedCount = 0,
        mismatchCount = 0,
        pendingDispatch = 4,
        verifyHistory = emptyList(),

        // Device Manager Dialog states
        isScannerManagerOpen = false,
        testScannerInput = "",
        testScannerSpeed = "",
        onOpenScannerManager = {},
        onCloseScannerManager = {},
        onTestScannerInputChange = {},

        // Dialog states
        duplicateBarcode = null,
        duplicateType = null,
        confirmFinishModalOpen = false,
        successModalTitle = "",
        successModalMessage = "",
        onCloseDuplicateModal = {},
        onCloseConfirmFinishModal = {},
        onCloseSuccessModal = {},
        onTriggerConfirmFinishBox = {},

        onTabSelected = {},
        onMawbSelected = {},
        onBagSelected = {},
        onFirstScanSubmit = {},
        onFinishBox = {},
        onResetFirstScan = {},
        onFirstScanInputChange = {},
        onAllocationSubmit = {},
        onClearAllocation = {},
        onChangeLMDAllocation = {},
        onAllocationInputChange = {},
        onDamagedScanSubmit = {},
        onConfirmDispatchDamaged = {},
        onClearDamagedScan = {},
        onChangeLMDDamaged = {},
        onDamagedInputChange = {},
        onVerifyBinSelected = {},
        onVerifySubmit = {},
        onConfirmDispatchVerify = {},
        onVerifyInputChange = {},
        onImportCsv = {},
        onApiBaseUrlChange = {},
        onClearAllStates = {}
    )
}
