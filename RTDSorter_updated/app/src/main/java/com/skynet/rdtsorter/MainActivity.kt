package com.skynet.rdtsorter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    private val RDT_SCAN_ACTION = "com.skynet.ACTION_BARCODE_SCAN"
    private lateinit var db: AppDatabase

    // Navigation state
    private val activeTab = mutableStateOf("first-scan")

    // Global / Settings states
    private val scannedToday = mutableStateOf(0)
    private val apiBaseUrl = mutableStateOf(AllocationUtils.DEFAULT_API_URL)
    private val dbCount = mutableStateOf(0)
    private val scannerConnected = mutableStateOf<Boolean?>(null) // null = unknown, true = connected
    private val timeString = mutableStateOf("")

    // Tab 1: 1st Scan (Box Unsealing)
    private val mawbsList = mutableStateOf<List<MawbData>>(emptyList())
    private val selectedMawb = mutableStateOf("")
    private val bagsList = mutableStateOf<List<BagData>>(emptyList())
    private val selectedBag = mutableStateOf("")
    private val expectedCount = mutableStateOf<Int?>(null)
    private val firstScanInput = mutableStateOf("")
    private val firstScanLastScanned = mutableStateOf("")
    private val firstScanHistory = mutableStateListOf<FirstScanHistoryItem>()
    private val firstScanCurrentScan = mutableStateOf<AllocationResponse?>(null)
    private val firstScanStatus = mutableStateOf("READY")
    private val firstScanError = mutableStateOf("")
    private val unsealedBoxes = mutableStateListOf<UnsealedBoxData>()

    // Tab 2: 2nd Scan (LMD Allocation)
    private val barcodeInput = mutableStateOf("")
    private val lastScanned = mutableStateOf("")
    private val currentScan = mutableStateOf<AllocationResponse?>(null)
    private val status = mutableStateOf("READY")
    private val errorMessage = mutableStateOf("")
    private val history = mutableStateListOf<AllocationResponse>()

    // Tab 3: Damaged Scan (Temu Scan)
    private val damagedBarcodeInput = mutableStateOf("")
    private val damagedLastScanned = mutableStateOf("")
    private val damagedCurrentScan = mutableStateOf<AllocationResponse?>(null)
    private val damagedStatus = mutableStateOf("READY")
    private val damagedErrorMessage = mutableStateOf("")
    private val damagedHistory = mutableStateListOf<AllocationResponse>()

    // Tab 4: Dispatch Verify
    private val selectedBin = mutableStateOf<String?>(null)
    private val verifyBarcodeInput = mutableStateOf("")
    private val lastVerifyScanned = mutableStateOf("")
    private val verifyScan = mutableStateOf<AllocationResponse?>(null)
    private val verifyStatus = mutableStateOf("READY")
    private val verifyErrorMessage = mutableStateOf("")
    private val binCounts = mutableStateMapOf("PickMe" to 0, "Domex" to 0, "Pronto" to 0)
    private val verifiedCount = mutableStateOf(0)
    private val mismatchCount = mutableStateOf(0)
    private val pendingDispatch = mutableStateOf(0)
    private val verifyHistory = mutableStateListOf<VerifyHistoryItem>()

    // Device Manager states
    private val isScannerManagerOpen = mutableStateOf(false)
    private val testScannerInput = mutableStateOf("")
    private val testScannerSpeed = mutableStateOf("")
    private val testKeyTimes = mutableStateListOf<Long>()

    // Dialog modals states
    private val duplicateBarcode = mutableStateOf<String?>(null)
    private val duplicateType = mutableStateOf<String?>(null)
    private val confirmFinishModalOpen = mutableStateOf(false)
    private val successModalTitle = mutableStateOf("")
    private val successModalMessage = mutableStateOf("")

    // Hardware Scanner Wedge Broadcast Receiver
    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == RDT_SCAN_ACTION) {
                val barcode = intent.getStringExtra("com.symbol.datawedge.data_string")
                    ?: intent.getStringExtra("barcode_data")

                if (!barcode.isNullOrBlank()) {
                    routeHardwareScan(barcode.trim())
                }
            }
        }
    }

    private val inputDeviceListener = object : android.hardware.input.InputManager.InputDeviceListener {
        override fun onInputDeviceAdded(deviceId: Int) {
            if (isPhysicalKeyboardConnected()) {
                scannerConnected.value = true
            }
        }
        override fun onInputDeviceRemoved(deviceId: Int) {
            scannerConnected.value = isPhysicalKeyboardConnected()
        }
        override fun onInputDeviceChanged(deviceId: Int) {
            if (isPhysicalKeyboardConnected()) {
                scannerConnected.value = true
            }
        }
    }

    private fun isPhysicalKeyboardConnected(): Boolean {
        val config = resources.configuration
        if (config.keyboard == android.content.res.Configuration.KEYBOARD_QWERTY) {
            return true
        }
        val deviceIds = android.view.InputDevice.getDeviceIds()
        for (id in deviceIds) {
            val device = android.view.InputDevice.getDevice(id) ?: continue
            if (!device.isVirtual && 
                (device.sources and android.view.InputDevice.SOURCE_KEYBOARD) == android.view.InputDevice.SOURCE_KEYBOARD &&
                device.keyboardType == android.view.InputDevice.KEYBOARD_TYPE_ALPHABETIC) {
                return true
            }
        }
        return false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        db = AppDatabase.getDatabase(this)
        updateLocalCount()
        startClock()

        val inputManager = getSystemService(Context.INPUT_SERVICE) as android.hardware.input.InputManager
        inputManager.registerInputDeviceListener(inputDeviceListener, null)

        if (isPhysicalKeyboardConnected()) {
            scannerConnected.value = true
        }

        // Fetch initial Mawb and unsealed bags on mount
        refreshMawbsAndUnsealed()

        setContent {
            SorterDashboard(
                activeTab = activeTab.value,
                scannedToday = scannedToday.value,
                apiBaseUrl = apiBaseUrl.value,
                dbCount = dbCount.value,
                scannerConnected = scannerConnected.value,
                timeString = timeString.value,
                
                // Tab 1: 1st Scan
                mawbsList = mawbsList.value,
                selectedMawb = selectedMawb.value,
                bagsList = bagsList.value,
                selectedBag = selectedBag.value,
                expectedCount = expectedCount.value,
                firstScanInput = firstScanInput.value,
                firstScanLastScanned = firstScanLastScanned.value,
                firstScanHistory = firstScanHistory,
                firstScanCurrentScan = firstScanCurrentScan.value,
                firstScanStatus = firstScanStatus.value,
                firstScanError = firstScanError.value,
                unsealedBoxes = unsealedBoxes,

                // Tab 2: 2nd Scan
                barcodeInput = barcodeInput.value,
                lastScanned = lastScanned.value,
                currentScan = currentScan.value,
                status = status.value,
                errorMessage = errorMessage.value,
                history = history,

                // Tab 3: Damaged Scan
                damagedBarcodeInput = damagedBarcodeInput.value,
                damagedLastScanned = damagedLastScanned.value,
                damagedCurrentScan = damagedCurrentScan.value,
                damagedStatus = damagedStatus.value,
                damagedErrorMessage = damagedErrorMessage.value,
                damagedHistory = damagedHistory,

                // Tab 4: Dispatch Verify
                selectedBin = selectedBin.value,
                verifyBarcodeInput = verifyBarcodeInput.value,
                lastVerifyScanned = lastVerifyScanned.value,
                verifyScan = verifyScan.value,
                verifyStatus = verifyStatus.value,
                verifyErrorMessage = verifyErrorMessage.value,
                binCounts = binCounts,
                verifiedCount = verifiedCount.value,
                mismatchCount = mismatchCount.value,
                pendingDispatch = pendingDispatch.value,
                verifyHistory = verifyHistory,

                // Device Manager Dialog states
                isScannerManagerOpen = isScannerManagerOpen.value,
                testScannerInput = testScannerInput.value,
                testScannerSpeed = testScannerSpeed.value,
                onOpenScannerManager = { isScannerManagerOpen.value = true },
                onCloseScannerManager = {
                    isScannerManagerOpen.value = false
                    handleClearTestInput()
                },
                onTestScannerInputChange = { handleTestScannerInput(it) },

                // Dialog state properties
                duplicateBarcode = duplicateBarcode.value,
                duplicateType = duplicateType.value,
                confirmFinishModalOpen = confirmFinishModalOpen.value,
                successModalTitle = successModalTitle.value,
                successModalMessage = successModalMessage.value,

                onCloseDuplicateModal = { duplicateBarcode.value = null; duplicateType.value = null },
                onCloseConfirmFinishModal = { confirmFinishModalOpen.value = false },
                onCloseSuccessModal = { successModalTitle.value = ""; successModalMessage.value = "" },
                onTriggerConfirmFinishBox = { confirmFinishModalOpen.value = true },

                // Handlers / Callbacks
                onTabSelected = { activeTab.value = it },
                onMawbSelected = { handleMawbSelected(it) },
                onBagSelected = { handleBagSelected(it) },
                onFirstScanSubmit = { processFirstScan(it) },
                onFinishBox = { 
                    confirmFinishModalOpen.value = false
                    handleFinishBox() 
                },
                onResetFirstScan = { handleResetFirstScan() },
                onFirstScanInputChange = { firstScanInput.value = it },

                onAllocationSubmit = { processAllocationScan(it) },
                onClearAllocation = { handleClearAllocation() },
                onChangeLMDAllocation = { handleChangeLMDAllocation() },
                onAllocationInputChange = { barcodeInput.value = it },

                onDamagedScanSubmit = { processDamagedScan(it) },
                onConfirmDispatchDamaged = { handleConfirmDispatchDamaged() },
                onClearDamagedScan = { handleClearDamagedScan() },
                onChangeLMDDamaged = { handleChangeLMDDamaged() },
                onDamagedInputChange = { damagedBarcodeInput.value = it },

                onVerifyBinSelected = { selectedBin.value = it },
                onVerifySubmit = { processVerifyScan(it) },
                onConfirmDispatchVerify = { handleConfirmDispatchVerify() },
                onVerifyInputChange = { verifyBarcodeInput.value = it },

                // Settings Tab Handlers
                onImportCsv = { importManifestCsv(it) },
                onApiBaseUrlChange = { apiBaseUrl.value = AllocationUtils.normalizeApiBaseUrl(it) },
                onClearAllStates = { handleClearAllStates() }
            )
        }
    }

    private fun startClock() {
        lifecycleScope.launch(Dispatchers.Default) {
            val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            while (true) {
                val time = sdf.format(Date())
                withContext(Dispatchers.Main) {
                    timeString.value = time
                }
                kotlinx.coroutines.delay(1000)
            }
        }
    }

    private fun routeHardwareScan(barcode: String) {
        scannerConnected.value = true
        when (activeTab.value) {
            "first-scan" -> {
                if (selectedMawb.value.isNotEmpty() && selectedBag.value.isNotEmpty()) {
                    processFirstScan(barcode)
                } else {
                    Toast.makeText(this, "Select MAWB and Bag first!", Toast.LENGTH_SHORT).show()
                }
            }
            "second-scan" -> processAllocationScan(barcode)
            "damaged-barcode" -> processDamagedScan(barcode)
            "verify" -> {
                if (selectedBin.value != null) {
                    processVerifyScan(barcode)
                } else {
                    Toast.makeText(this, "Select a dispatch bin first!", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // TAB 1: 1ST SCAN (BOX UNSEALING) LOGIC
    // ═══════════════════════════════════════════════════════
    private fun refreshMawbsAndUnsealed() {
        lifecycleScope.launch {
            try {
                // Fetch MAWBs
                val mawbResponse = fetchMawbsFromApi()
                if (mawbResponse?.success == true && mawbResponse.mawbs != null) {
                    mawbsList.value = mawbResponse.mawbs
                }

                // Fetch Unsealed Bags
                val unsealedBags = fetchUnsealedBagsFromApi()
                if (unsealedBags != null) {
                    unsealedBoxes.clear()
                    unsealedBoxes.addAll(unsealedBags)
                }
            } catch (e: Exception) {
                android.util.Log.e("RTD_SORTER", "Initial load error: ${e.message}")
            }
        }
    }

    private fun handleMawbSelected(mawb: String) {
        selectedMawb.value = mawb
        selectedBag.value = ""
        expectedCount.value = null
        bagsList.value = emptyList()
        firstScanHistory.clear()
        firstScanError.value = ""
        firstScanCurrentScan.value = null

        if (mawb.isEmpty()) return

        firstScanStatus.value = "FETCHING"
        lifecycleScope.launch {
            val response = fetchBagsFromApi(mawb)
            if (response?.success == true && response.bags != null) {
                bagsList.value = response.bags
                firstScanStatus.value = "READY"
            } else {
                bagsList.value = emptyList()
                firstScanError.value = response?.error ?: "Failed to load bags"
                firstScanStatus.value = "ERROR"
            }
        }
    }

    private fun handleBagSelected(bag: String) {
        selectedBag.value = bag
        firstScanHistory.clear()
        firstScanError.value = ""
        firstScanCurrentScan.value = null

        val found = bagsList.value.find { it.bagNumber == bag }
        expectedCount.value = found?.expectedCount
    }

    private fun processFirstScan(barcode: String) {
        if (selectedMawb.value.isEmpty() || selectedBag.value.isEmpty()) return
        firstScanInput.value = barcode
        firstScanStatus.value = "FETCHING"
        firstScanError.value = ""

        // Check duplicates
        val isDup = firstScanHistory.any { it.trackingNumber == barcode }
        if (isDup) {
            duplicateBarcode.value = barcode
            duplicateType.value = "first"
            firstScanError.value = "Duplicate scan: Barcode \"$barcode\" already scanned in this box."
            firstScanStatus.value = "ERROR"
            return
        }

        lifecycleScope.launch {
            val res = callPostEndpoint(
                payload = JSONObject()
                    .put("trackingNumber", barcode)
                    .put("stage", "first")
                    .put("mawbRef", selectedMawb.value)
            )
            if (res != null && res.optBoolean("success")) {
                val parcelJson = res.optJSONObject("parcel")
                val parcel = parcelJson?.let {
                    ParcelData(
                        trackingNumber = it.optString("trackingNumber"),
                        recipientName = it.optString("recipientName"),
                        recipientPhone = it.optString("recipientPhone"),
                        recipientAddress = it.optString("recipientAddress"),
                        senderName = it.optString("senderName"),
                        senderAddress = it.optString("senderAddress"),
                        province = it.optString("province"),
                        district = it.optString("district"),
                        city = it.optString("city"),
                        weight = it.optDouble("weight", 0.0),
                        value = it.optString("value"),
                        account = it.optString("account"),
                        apiSync = it.optString("apiSync"),
                        goodsDesc = it.optString("goodsDesc"),
                        mawbRef = it.optString("mawbRef"),
                        mawbCarrier = it.optString("mawbCarrier"),
                        mawbFlight = it.optString("mawbFlight"),
                        mawbBags = it.optInt("mawbBags"),
                        serviceType = it.optString("serviceType"),
                        businessType = it.optString("businessType"),
                        senderReference = it.optString("senderReference")
                    )
                }

                val assignedPartner = AllocationUtils.normalizePartnerName(res.optString("assignedPartner"))
                val assignedZone = res.optString("assignedZone")

                val allocationResponse = AllocationResponse(
                    success = true,
                    parcel = parcel,
                    assignedPartner = assignedPartner,
                    assignedZone = assignedZone
                )

                firstScanCurrentScan.value = allocationResponse

                val item = FirstScanHistoryItem(
                    trackingNumber = parcel?.trackingNumber ?: barcode,
                    recipientName = parcel?.recipientName ?: "Unknown Recipient",
                    city = parcel?.city ?: "Unknown City",
                    timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
                    assignedPartner = assignedPartner,
                    assignedZone = assignedZone
                )
                firstScanHistory.add(0, item)
                firstScanLastScanned.value = item.trackingNumber
                firstScanInput.value = ""
                firstScanStatus.value = "SUCCESS"
            } else {
                val err = res?.optString("error") ?: "Server verification failed"
                firstScanError.value = err
                firstScanStatus.value = "ERROR"
            }
        }
    }

    private fun handleFinishBox() {
        val mawb = selectedMawb.value
        val bag = selectedBag.value
        val expected = expectedCount.value ?: 0
        val scanned = firstScanHistory.size

        if (mawb.isEmpty() || bag.isEmpty()) return

        firstScanStatus.value = "FETCHING"
        lifecycleScope.launch {
            val payload = JSONObject()
                .put("stage", "finish-bag")
                .put("mawbRef", mawb)
                .put("bagNumber", bag)
                .put("expectedCount", expected)
                .put("scannedCount", scanned)
                .put("status", "COUNTED")

            val res = callPostEndpoint(payload)
            if (res != null && res.optBoolean("success")) {
                unsealedBoxes.add(
                    0, UnsealedBoxData(
                        mawb = mawb,
                        bagNumber = bag,
                        expected = expected,
                        scanned = scanned,
                        timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                    )
                )
                successModalTitle.value = "Bag Closed Successfully"
                successModalMessage.value = "Bag $bag for MAWB $mawb has been unsealed and locked with $scanned parcels."
                handleResetFirstScan()
            } else {
                val err = res?.optString("error") ?: "Failed to close bag"
                firstScanError.value = err
                firstScanStatus.value = "ERROR"
            }
        }
    }

    private fun handleResetFirstScan() {
        selectedBag.value = ""
        expectedCount.value = null
        firstScanInput.value = ""
        firstScanLastScanned.value = ""
        firstScanHistory.clear()
        firstScanError.value = ""
        firstScanStatus.value = "READY"
        firstScanCurrentScan.value = null
    }

    // ═══════════════════════════════════════════════════════
    // TAB 2: 2ND SCAN (ALLOCATION) LOGIC
    // ═══════════════════════════════════════════════════════
    private fun processAllocationScan(barcode: String) {
        barcodeInput.value = barcode
        status.value = "FETCHING"
        errorMessage.value = ""
        currentScan.value = null
        lastScanned.value = barcode

        // Check duplicates
        val isDup = history.any { it.parcel?.trackingNumber == barcode || it.parcel?.senderReference == barcode }
        if (isDup) {
            duplicateBarcode.value = barcode
            duplicateType.value = "second"
            errorMessage.value = "Duplicate scan: Barcode \"$barcode\" already scanned/allocated today."
            status.value = "ERROR"
            return
        }

        // Offline pre-check
        lifecycleScope.launch {
            val localMatch = db.allocationDao().getAllocation(barcode)
            if (localMatch != null) {
                errorMessage.value = "Local DB Match: ${localMatch.provider}"
            }

            val res = callPostAllocationApi(barcode)
            if (res?.success == true) {
                currentScan.value = res
                history.add(0, res)
                scannedToday.value += 1
                status.value = "SUCCESS"
                barcodeInput.value = ""

                val partner = res.assignedPartner
                if (partner == "PickMe" || partner == "Domex" || partner == "Pronto") {
                    binCounts[partner] = (binCounts[partner] ?: 0) + 1
                    pendingDispatch.value += 1
                }
            } else {
                errorMessage.value = res?.error ?: "Unknown error"
                status.value = "ERROR"
            }
        }
    }

    private fun handleClearAllocation() {
        currentScan.value = null
        status.value = "READY"
        barcodeInput.value = ""
        lastScanned.value = ""
        errorMessage.value = ""
    }

    private fun handleChangeLMDAllocation() {
        val current = currentScan.value ?: return
        val partner = current.assignedPartner
        val next = when (partner) {
            "PickMe" -> "Domex"
            "Domex" -> "Pronto"
            else -> "PickMe"
        }
        currentScan.value = current.copy(assignedPartner = next)
    }

    // ═══════════════════════════════════════════════════════
    // TAB 3: DAMAGED SCAN LOGIC
    // ═══════════════════════════════════════════════════════
    private fun processDamagedScan(barcode: String) {
        damagedBarcodeInput.value = barcode
        damagedStatus.value = "FETCHING"
        damagedErrorMessage.value = ""
        damagedCurrentScan.value = null
        damagedLastScanned.value = barcode

        // Check duplicates
        val isDup = damagedHistory.any { it.parcel?.trackingNumber == barcode || it.parcel?.senderReference == barcode }
        if (isDup) {
            duplicateBarcode.value = barcode
            duplicateType.value = "second"
            damagedErrorMessage.value = "Duplicate scan: Barcode \"$barcode\" already scanned/allocated today."
            damagedStatus.value = "ERROR"
            return
        }

        lifecycleScope.launch {
            val res = callPostAllocationApi(barcode)
            if (res?.success == true) {
                damagedCurrentScan.value = res
                damagedHistory.add(0, res)
                scannedToday.value += 1
                damagedStatus.value = "SUCCESS"
                damagedBarcodeInput.value = ""

                val partner = res.assignedPartner
                if (partner == "PickMe" || partner == "Domex" || partner == "Pronto") {
                    binCounts[partner] = (binCounts[partner] ?: 0) + 1
                    pendingDispatch.value += 1
                }
            } else {
                damagedErrorMessage.value = res?.error ?: "Unknown error"
                damagedStatus.value = "ERROR"
            }
        }
    }

    private fun handleConfirmDispatchDamaged() {
        val current = damagedCurrentScan.value
        Toast.makeText(this, "Parcel ${current?.parcel?.trackingNumber} confirmed & dispatched!", Toast.LENGTH_SHORT).show()
        handleClearDamagedScan()
    }

    private fun handleClearDamagedScan() {
        damagedCurrentScan.value = null
        damagedStatus.value = "READY"
        damagedBarcodeInput.value = ""
        damagedLastScanned.value = ""
        damagedErrorMessage.value = ""
    }

    private fun handleChangeLMDDamaged() {
        val current = damagedCurrentScan.value ?: return
        val partner = current.assignedPartner
        val next = when (partner) {
            "PickMe" -> "Domex"
            "Domex" -> "Pronto"
            else -> "PickMe"
        }
        damagedCurrentScan.value = current.copy(assignedPartner = next)
    }

    // ═══════════════════════════════════════════════════════
    // TAB 4: DISPATCH VERIFY LOGIC
    // ═══════════════════════════════════════════════════════
    private fun processVerifyScan(barcode: String) {
        val activeBin = selectedBin.value ?: return
        verifyBarcodeInput.value = barcode
        verifyStatus.value = "FETCHING"
        verifyErrorMessage.value = ""
        verifyScan.value = null
        lastVerifyScanned.value = barcode

        // Check duplicates
        val isDup = verifyHistory.any { it.trackingNumber == barcode }
        if (isDup) {
            duplicateBarcode.value = barcode
            duplicateType.value = "verify"
            verifyErrorMessage.value = "Duplicate scan: Barcode \"$barcode\" already verified."
            verifyStatus.value = "ERROR"
            return
        }

        lifecycleScope.launch {
            val res = callPostAllocationApi(barcode) // verifies routing
            if (res?.success == true) {
                verifyScan.value = res
                val assigned = res.assignedPartner ?: "Unknown"
                val isMatch = assigned.lowercase() == activeBin.lowercase()

                if (isMatch) {
                    verifyStatus.value = "MATCH"
                    verifiedCount.value += 1
                    pendingDispatch.value = maxOf(0, pendingDispatch.value - 1)
                    binCounts[activeBin] = maxOf(0, (binCounts[activeBin] ?: 0) - 1)
                } else {
                    verifyStatus.value = "MISMATCH"
                    mismatchCount.value += 1
                }

                val item = VerifyHistoryItem(
                    trackingNumber = barcode,
                    bin = activeBin,
                    assignedPartner = assigned,
                    isMatch = isMatch,
                    timestamp = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()),
                    recipientName = res.parcel?.recipientName,
                    city = res.parcel?.city
                )
                verifyHistory.add(0, item)
                verifyBarcodeInput.value = ""
            } else {
                verifyErrorMessage.value = res?.error ?: "Verification lookup failed"
                verifyStatus.value = "ERROR"
            }
        }
    }

    private fun handleConfirmDispatchVerify() {
        successModalTitle.value = "Dispatch Confirmed"
        successModalMessage.value = "Successfully verified and dispatched ${verifiedCount.value} parcels to LMD carrier bins."
        verifiedCount.value = 0
        verifyScan.value = null
        verifyStatus.value = "READY"
        verifyHistory.clear()
    }

    // ═══════════════════════════════════════════════════════
    // SETTINGS TAB LOGIC & UTILITIES
    // ═══════════════════════════════════════════════════════
    private fun handleClearAllStates() {
        handleClearAllocation()
        handleClearDamagedScan()
        handleResetFirstScan()
        selectedBin.value = null
        verifyScan.value = null
        verifyStatus.value = "READY"
        verifyHistory.clear()
        verifiedCount.value = 0
        mismatchCount.value = 0
        pendingDispatch.value = 0
        history.clear()
        damagedHistory.clear()
        binCounts["PickMe"] = 0
        binCounts["Domex"] = 0
        binCounts["Pronto"] = 0
        Toast.makeText(this, "All states cleared!", Toast.LENGTH_SHORT).show()
    }

    private fun importManifestCsv(uri: Uri) {
        lifecycleScope.launch {
            try {
                val inputStream = contentResolver.openInputStream(uri) ?: return@launch
                val reader = BufferedReader(InputStreamReader(inputStream))
                var line: String?
                val list = mutableListOf<AllocationEntity>()

                while (reader.readLine().also { line = it } != null) {
                    val tokens = line!!.split(",")
                    if (tokens.size >= 2) {
                        val barcode = tokens[0].trim()
                        val rawProvider = tokens[1].trim()
                        val provider = when {
                            rawProvider.lowercase().contains("pickme") -> "PickMe"
                            rawProvider.lowercase().contains("domex") -> "Domex"
                            rawProvider.lowercase().contains("pronto") -> "Pronto"
                            else -> rawProvider
                        }
                        list.add(AllocationEntity(barcode, provider))
                    }
                }
                inputStream.close()

                db.allocationDao().clearAll()
                db.allocationDao().insertAll(list)
                updateLocalCount()
                Toast.makeText(this@MainActivity, "Imported ${list.size} manifest entries!", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Import failed: " + e.localizedMessage, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun updateLocalCount() {
        lifecycleScope.launch {
            dbCount.value = db.allocationDao().getCount()
        }
    }

    // ═══════════════════════════════════════════════════════
    // ASYNC REST API IMPLEMENTATIONS
    // ═══════════════════════════════════════════════════════
    private suspend fun fetchMawbsFromApi(): MawbResponse? = withContext(Dispatchers.IO) {
        try {
            val endpoint = "${apiBaseUrl.value}?mawbs=true"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode in 200..299) {
                val txt = conn.inputStream.bufferedReader().use(BufferedReader::readText)
                conn.disconnect()
                val json = JSONObject(txt)
                if (json.optBoolean("success")) {
                    val arr = json.optJSONArray("mawbs") ?: JSONArray()
                    val list = mutableListOf<MawbData>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        list.add(MawbData(
                            mawb_reference = obj.optString("mawb_reference"),
                            carrier = obj.optString("carrier"),
                            declared_bags = obj.optInt("declared_bags")
                        ))
                    }
                    MawbResponse(success = true, mawbs = list)
                } else {
                    MawbResponse(success = false, error = json.optString("error"))
                }
            } else {
                MawbResponse(success = false, error = "HTTP ${conn.responseCode}")
            }
        } catch (e: Exception) {
            MawbResponse(success = false, error = e.localizedMessage)
        }
    }

    private suspend fun fetchBagsFromApi(mawbRef: String): BagResponse? = withContext(Dispatchers.IO) {
        try {
            val endpoint = "${apiBaseUrl.value}?getBags=true&mawbRef=${Uri.encode(mawbRef)}"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode in 200..299) {
                val txt = conn.inputStream.bufferedReader().use(BufferedReader::readText)
                conn.disconnect()
                val json = JSONObject(txt)
                if (json.optBoolean("success")) {
                    val arr = json.optJSONArray("bags") ?: JSONArray()
                    val list = mutableListOf<BagData>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        list.add(BagData(
                            bagNumber = obj.optString("bagNumber"),
                            expectedCount = obj.optInt("expectedCount")
                        ))
                    }
                    BagResponse(success = true, bags = list)
                } else {
                    BagResponse(success = false, error = json.optString("error"))
                }
            } else {
                BagResponse(success = false, error = "HTTP ${conn.responseCode}")
            }
        } catch (e: Exception) {
            BagResponse(success = false, error = e.localizedMessage)
        }
    }

    private suspend fun fetchUnsealedBagsFromApi(): List<UnsealedBoxData>? = withContext(Dispatchers.IO) {
        try {
            val endpoint = "${apiBaseUrl.value}?getUnsealedBags=true"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode in 200..299) {
                val txt = conn.inputStream.bufferedReader().use(BufferedReader::readText)
                conn.disconnect()
                val json = JSONObject(txt)
                if (json.optBoolean("success")) {
                    val arr = json.optJSONArray("unsealedBags") ?: JSONArray()
                    val list = mutableListOf<UnsealedBoxData>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        list.add(UnsealedBoxData(
                            mawb = obj.optString("mawb_ref"),
                            bagNumber = obj.optString("bag_number"),
                            expected = obj.optInt("expected_count"),
                            scanned = obj.optInt("scanned_count"),
                            timestamp = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(obj.optLong("created_at", System.currentTimeMillis())))
                        ))
                    }
                    list
                } else null
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun callPostEndpoint(payload: JSONObject): JSONObject? = withContext(Dispatchers.IO) {
        try {
            val url = URL(apiBaseUrl.value)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }
            OutputStreamWriter(connection.outputStream).use { it.write(payload.toString()) }
            val responseCode = connection.responseCode
            val responseText = if (responseCode in 200..299) {
                connection.inputStream.bufferedReader().use(BufferedReader::readText)
            } else {
                connection.errorStream?.bufferedReader()?.use(BufferedReader::readText) ?: "{}"
            }
            connection.disconnect()
            JSONObject(responseText)
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun callPostAllocationApi(barcode: String): AllocationResponse? = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject()
                .put("trackingNumber", barcode)
                .put("stage", "second")

            val res = callPostEndpoint(payload)
            if (res != null && res.optBoolean("success")) {
                val parcelJson = res.optJSONObject("parcel")
                val parcel = parcelJson?.let {
                    ParcelData(
                        trackingNumber = it.optString("trackingNumber"),
                        recipientName = it.optString("recipientName"),
                        recipientPhone = it.optString("recipientPhone"),
                        recipientAddress = it.optString("recipientAddress"),
                        senderName = it.optString("senderName"),
                        senderAddress = it.optString("senderAddress"),
                        province = it.optString("province"),
                        district = it.optString("district"),
                        city = it.optString("city"),
                        weight = it.optDouble("weight", 0.0),
                        value = it.optString("value"),
                        account = it.optString("account"),
                        apiSync = it.optString("apiSync"),
                        goodsDesc = it.optString("goodsDesc"),
                        mawbRef = it.optString("mawbRef"),
                        mawbCarrier = it.optString("mawbCarrier"),
                        mawbFlight = it.optString("mawbFlight"),
                        mawbBags = it.optInt("mawbBags"),
                        serviceType = it.optString("serviceType"),
                        businessType = it.optString("businessType"),
                        senderReference = it.optString("senderReference")
                    )
                }
                AllocationResponse(
                    success = true,
                    parcel = parcel,
                    assignedZone = res.optString("assignedZone"),
                    assignedPartner = AllocationUtils.normalizePartnerName(res.optString("assignedPartner")),
                    missedFirstScan = res.optBoolean("missedFirstScan")
                )
            } else {
                AllocationResponse(success = false, error = res?.optString("error") ?: "Request failed")
            }
        } catch (e: Exception) {
            AllocationResponse(success = false, error = e.localizedMessage ?: "Connection exception")
        }
    }

    private fun handleTestScannerInput(text: String) {
        testScannerInput.value = text
        if (text.isEmpty()) {
            testKeyTimes.clear()
            testScannerSpeed.value = ""
            return
        }
        val now = System.currentTimeMillis()
        testKeyTimes.add(now)
        if (testKeyTimes.size > 15) {
            testKeyTimes.removeAt(0)
        }
        if (testKeyTimes.size >= 2) {
            val deltas = mutableListOf<Long>()
            for (i in 1 until testKeyTimes.size) {
                deltas.add(testKeyTimes[i] - testKeyTimes[i - 1])
            }
            val avg = deltas.average()
            if (avg < 50.0) {
                testScannerSpeed.value = "Verified RTD/Hardware Scanner (average keystroke: ${avg.toInt()}ms)"
                scannerConnected.value = true
            } else {
                testScannerSpeed.value = "Manual typing speed (average keystroke: ${avg.toInt()}ms)"
            }
        }
    }

    private fun handleClearTestInput() {
        testScannerInput.value = ""
        testScannerSpeed.value = ""
        testKeyTimes.clear()
    }

    override fun onResume() {
        super.onResume()
        ContextCompat.registerReceiver(
            this,
            scanReceiver,
            IntentFilter(RDT_SCAN_ACTION),
            ContextCompat.RECEIVER_EXPORTED
        )
    }

    override fun onPause() {
        super.onPause()
        unregisterReceiver(scanReceiver)
    }

    override fun onDestroy() {
        super.onDestroy()
        val inputManager = getSystemService(Context.INPUT_SERVICE) as android.hardware.input.InputManager
        inputManager.unregisterInputDeviceListener(inputDeviceListener)
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        if (isPhysicalKeyboardConnected()) {
            scannerConnected.value = true
        }
    }
}
