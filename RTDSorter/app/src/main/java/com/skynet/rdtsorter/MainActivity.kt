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
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class MainActivity : ComponentActivity() {

    private val RDT_SCAN_ACTION = "com.skynet.ACTION_BARCODE_SCAN"
    private lateinit var db: AppDatabase

    private val lastScannedBarcode = mutableStateOf<String?>(null)
    private val assignedProvider = mutableStateOf<String?>(null)
    private val isNotFound = mutableStateOf(false)
    private val dbCount = mutableStateOf(0)
    private val apiStatus = mutableStateOf("READY")
    private val apiMessage = mutableStateOf("")
    private val currentParcel = mutableStateOf<ParcelData?>(null)
    private val apiBaseUrl = mutableStateOf(AllocationUtils.DEFAULT_API_URL)
    private val verifyBarcode = mutableStateOf("")
    private val verifyResult = mutableStateOf<String?>(null)

    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == RDT_SCAN_ACTION) {
                val barcode = intent.getStringExtra("com.symbol.datawedge.data_string")
                    ?: intent.getStringExtra("barcode_data")

                if (!barcode.isNullOrBlank()) {
                    processBarcodeScan(barcode.trim())
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        db = AppDatabase.getDatabase(this)
        updateLocalCount()

        setContent {
            SorterDashboard(
                barcode = lastScannedBarcode.value,
                provider = assignedProvider.value,
                isNotFound = isNotFound.value,
                dbCount = dbCount.value,
                apiStatus = apiStatus.value,
                apiMessage = apiMessage.value,
                currentParcel = currentParcel.value,
                apiBaseUrl = apiBaseUrl.value,
                verifyBarcode = verifyBarcode.value,
                verifyResult = verifyResult.value,
                onImportCsv = { uri -> importManifestCsv(uri) },
                onManualScan = { processBarcodeScan(it) },
                onApiBaseUrlChange = { apiBaseUrl.value = AllocationUtils.normalizeApiBaseUrl(it) },
                onVerifyBarcodeChange = { verifyBarcode.value = it },
                onVerifySubmit = { verifyBarcode(it) },
                onRefreshConfig = { refreshConfig() },
                onClear = { clearState() }
            )
        }
    }

    private fun processBarcodeScan(barcode: String) {
        lastScannedBarcode.value = barcode
        isNotFound.value = false
        apiStatus.value = "FETCHING"
        apiMessage.value = ""
        currentParcel.value = null

        lifecycleScope.launch {
            val localMatch = db.allocationDao().getAllocation(barcode)
            if (localMatch != null) {
                assignedProvider.value = localMatch.provider
                apiMessage.value = "Matched local manifest entry"
                apiStatus.value = "SUCCESS"
                updateSystemApi(barcode, localMatch.provider)
            } else {
                assignedProvider.value = null
                isNotFound.value = true
                apiStatus.value = "ERROR"
                apiMessage.value = "Parcel not found locally"
                Toast.makeText(this@MainActivity, "No local allocation for $barcode", Toast.LENGTH_SHORT).show()
            }

            callAllocationApi(barcode)
        }
    }

    private fun verifyBarcode(barcode: String) {
        if (barcode.isBlank()) return
        lifecycleScope.launch {
            apiStatus.value = "FETCHING"
            apiMessage.value = ""
            val response = callAllocationApi(barcode, showToast = false)
            verifyResult.value = if (response?.success == true) {
                "MATCH: ${response.assignedPartner ?: "Unknown"}"
            } else {
                "MISMATCH / ERROR: ${response?.error ?: "Unknown"}"
            }
            apiStatus.value = if (response?.success == true) "SUCCESS" else "ERROR"
        }
    }

    private suspend fun callAllocationApi(barcode: String, showToast: Boolean = true): AllocationResponse? = withContext(Dispatchers.IO) {
        try {
            val endpoint = apiBaseUrl.value
            val url = URL(endpoint)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }

            val body = JSONObject().put("trackingNumber", barcode).toString()
            OutputStreamWriter(connection.outputStream).use { it.write(body) }

            val responseCode = connection.responseCode
            val responseText = connection.inputStream.bufferedReader().use(BufferedReader::readText)
            connection.disconnect()

            val json = JSONObject(responseText)
            if (responseCode in 200..299 && json.optBoolean("success")) {
                val parcelJson = json.optJSONObject("parcel")
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
                        businessType = it.optString("businessType")
                    )
                }
                val assignedPartner = AllocationUtils.normalizePartnerName(json.optString("assignedPartner"))
                currentParcel.value = parcel
                assignedProvider.value = assignedPartner
                apiStatus.value = "SUCCESS"
                apiMessage.value = "Fetched allocation from ${endpoint}"
                if (showToast) Toast.makeText(this@MainActivity, "Allocated to $assignedPartner", Toast.LENGTH_SHORT).show()
                AllocationResponse(success = true, parcel = parcel, assignedZone = json.optString("assignedZone"), assignedPartner = assignedPartner)
            } else {
                val error = json.optString("error", "Request failed")
                apiStatus.value = "ERROR"
                apiMessage.value = error
                if (showToast) Toast.makeText(this@MainActivity, error, Toast.LENGTH_LONG).show()
                AllocationResponse(success = false, error = error)
            }
        } catch (e: Exception) {
            val message = e.localizedMessage ?: "Connection error"
            apiStatus.value = "ERROR"
            apiMessage.value = message
            if (showToast) Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
            AllocationResponse(success = false, error = message)
        }
    }

    private fun refreshConfig() {
        apiMessage.value = "Using endpoint: ${apiBaseUrl.value}"
        Toast.makeText(this@MainActivity, "Configuration refreshed", Toast.LENGTH_SHORT).show()
    }

    private fun clearState() {
        lastScannedBarcode.value = null
        assignedProvider.value = null
        isNotFound.value = false
        apiStatus.value = "READY"
        apiMessage.value = ""
        currentParcel.value = null
        verifyBarcode.value = ""
        verifyResult.value = null
    }

    private fun updateSystemApi(barcode: String, provider: String) {
        android.util.Log.d("RTD_SORTER", "Local manifest match: $barcode -> $provider")
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
                        val provider = if (rawProvider.lowercase().contains("pickme")) "PickMe" else if (rawProvider.lowercase().contains("domex")) "Domex" else if (rawProvider.lowercase().contains("pronto")) "Pronto" else rawProvider
                        list.add(AllocationEntity(barcode, provider))
                    }
                }
                inputStream.close()

                db.allocationDao().clearAll()
                db.allocationDao().insertAll(list)
                updateLocalCount()
                Toast.makeText(this@MainActivity, "Successfully imported ${list.size} allocations!", Toast.LENGTH_LONG).show()
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
}
