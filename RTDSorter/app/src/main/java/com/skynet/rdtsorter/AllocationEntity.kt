package com.skynet.rdtsorter

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "allocations")
data class AllocationEntity(
    @PrimaryKey val barcode: String,
    val provider: String
)
