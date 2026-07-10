package com.skynet.rdtsorter

data class AllocationResponse(
    val success: Boolean,
    val parcel: ParcelData? = null,
    val assignedZone: String? = null,
    val assignedPartner: String? = null,
    val error: String? = null
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
    val businessType: String? = null
)
