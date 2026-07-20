package com.skynet.rdtsorter

data class AllocationResponse(
    val success: Boolean,
    val parcel: ParcelData? = null,
    val assignedZone: String? = null,
    val assignedPartner: String? = null,
    val error: String? = null,
    val missedFirstScan: Boolean? = null
)

data class ParcelData(
    val trackingNumber: String,
    val recipientName: String,
    val recipientPhone: String? = null,
    val recipientAddress: String? = null,
    val senderName: String? = null,
    val senderAddress: String? = null,
    val province: String,
    val district: String,
    val city: String,
    val weight: Double,
    val value: String? = null,
    val account: String? = null,
    val apiSync: String? = null,
    val goodsDesc: String? = null,
    val mawbRef: String? = null,
    val mawbCarrier: String? = null,
    val mawbFlight: String? = null,
    val mawbBags: Int? = null,
    val serviceType: String? = null,
    val businessType: String? = null,
    val senderReference: String? = null
)

data class MawbData(
    val mawb_reference: String,
    val carrier: String?,
    val declared_bags: Int?
)

data class MawbResponse(
    val success: Boolean,
    val mawbs: List<MawbData>? = null,
    val error: String? = null
)

data class BagData(
    val bagNumber: String,
    val expectedCount: Int
)

data class BagResponse(
    val success: Boolean,
    val bags: List<BagData>? = null,
    val error: String? = null
)

data class FirstScanHistoryItem(
    val trackingNumber: String,
    val recipientName: String,
    val city: String,
    val timestamp: String,
    val assignedPartner: String? = null,
    val assignedZone: String? = null
)

data class VerifyHistoryItem(
    val trackingNumber: String,
    val bin: String,
    val assignedPartner: String,
    val isMatch: Boolean,
    val timestamp: String,
    val recipientName: String? = null,
    val city: String? = null
)

data class UnsealedBoxData(
    val mawb: String,
    val bagNumber: String?,
    val expected: Int,
    val scanned: Int,
    val timestamp: String
)
