package com.skynet.rdtsorter

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SorterDashboard(
    barcode: String?,
    provider: String?,
    isNotFound: Boolean,
    dbCount: Int,
    apiStatus: String,
    apiMessage: String,
    currentParcel: ParcelData?,
    apiBaseUrl: String,
    verifyBarcode: String,
    verifyResult: String?,
    onImportCsv: (Uri) -> Unit,
    onManualScan: (String) -> Unit,
    onApiBaseUrlChange: (String) -> Unit,
    onVerifyBarcodeChange: (String) -> Unit,
    onVerifySubmit: (String) -> Unit,
    onRefreshConfig: () -> Unit,
    onClear: () -> Unit
) {
    var manualText by remember { mutableStateOf("") }

    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { onImportCsv(it) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("SKYNET SORTER", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Text("Manifest entries: $dbCount", color = Color(0xFF94A3B8), fontSize = 12.sp)
            }
            Button(
                onClick = { filePicker.launch("text/*") },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Import CSV")
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Scan result", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            color = when {
                                provider == "PickMe" -> Color(0xFF15803D)
                                provider == "Domex" -> Color(0xFF1D4ED8)
                                provider == "Pronto" -> Color(0xFF7C3AED)
                                isNotFound -> Color(0xFFB91C1C)
                                else -> Color(0xFF2D2D2D)
                            },
                            shape = RoundedCornerShape(12.dp)
                        )
                        .padding(18.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        if (barcode != null) {
                            Text("BARCODE: $barcode", color = Color.White.copy(alpha = 0.8f), fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = when (provider) {
                                    "PickMe" -> "BIN: PICKME"
                                    "Domex" -> "BIN: DOMEX"
                                    "Pronto" -> "BIN: PRONTO"
                                    else -> "PARCEL NOT FOUND"
                                },
                                color = Color.White,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                textAlign = TextAlign.Center
                            )
                        } else {
                            Text("AWAITING SCAN", color = Color.Gray, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
                Text("Status: $apiStatus", color = Color(0xFFBFDBFE), fontSize = 13.sp)
                if (apiMessage.isNotBlank()) {
                    Text(apiMessage, color = Color(0xFFE2E8F0), fontSize = 13.sp)
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Manual test", color = Color.White, fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = manualText,
                    onValueChange = { manualText = it },
                    placeholder = { Text("Scan or type a tracking number", color = Color.Gray) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF16A34A),
                        unfocusedBorderColor = Color.Gray
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    trailingIcon = {
                        Button(
                            onClick = {
                                if (manualText.isNotBlank()) {
                                    onManualScan(manualText.trim())
                                    manualText = ""
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2D2D2D)),
                            contentPadding = PaddingValues(horizontal = 12.dp)
                        ) {
                            Text("Check", color = Color.White)
                        }
                    }
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("API config", color = Color.White, fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = apiBaseUrl,
                    onValueChange = onApiBaseUrlChange,
                    label = { Text("Endpoint") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF16A34A),
                        unfocusedBorderColor = Color.Gray
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onRefreshConfig, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))) {
                        Text("Refresh")
                    }
                    Button(onClick = onClear, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6B7280))) {
                        Text("Clear")
                    }
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Verify parcel", color = Color.White, fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = verifyBarcode,
                    onValueChange = onVerifyBarcodeChange,
                    label = { Text("Tracking number") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF16A34A),
                        unfocusedBorderColor = Color.Gray
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Button(onClick = { onVerifySubmit(verifyBarcode) }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))) {
                    Text("Verify")
                }
                if (verifyResult != null) {
                    Text(verifyResult, color = Color(0xFFE2E8F0), fontSize = 13.sp)
                }
            }
        }

        if (currentParcel != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Parcel details", color = Color.White, fontWeight = FontWeight.Bold)
                    Text("Recipient: ${currentParcel.recipientName}", color = Color(0xFFE2E8F0), fontSize = 13.sp)
                    Text("City: ${currentParcel.city}", color = Color(0xFFE2E8F0), fontSize = 13.sp)
                    Text("Weight: ${currentParcel.weight}", color = Color(0xFFE2E8F0), fontSize = 13.sp)
                    currentParcel.value?.let { value ->
                        Text("Value: $value", color = Color(0xFFE2E8F0), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
