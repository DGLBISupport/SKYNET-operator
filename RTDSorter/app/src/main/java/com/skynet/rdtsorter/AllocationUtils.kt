package com.skynet.rdtsorter

object AllocationUtils {
    const val DEFAULT_API_URL = "http://10.0.2.2:3000/api/allocate"

    fun normalizePartnerName(raw: String?): String? {
        val value = raw?.trim().orEmpty()
        return when (value.lowercase()) {
            "pickme" -> "PickMe"
            "domex" -> "Domex"
            "pronto" -> "Pronto"
            else -> value.ifBlank { null }
        }
    }

    fun normalizeApiBaseUrl(raw: String?): String {
        val value = raw?.trim().orEmpty()
        if (value.isBlank()) return DEFAULT_API_URL
        return when {
            value.startsWith("http://") || value.startsWith("https://") -> value
            else -> "http://$value"
        }
    }
}
