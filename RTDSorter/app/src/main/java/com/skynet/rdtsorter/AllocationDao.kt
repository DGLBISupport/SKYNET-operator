package com.skynet.rdtsorter

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface AllocationDao {
    @Query("SELECT * FROM allocations WHERE barcode = :barcode LIMIT 1")
    suspend fun getAllocation(barcode: String): AllocationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(allocations: List<AllocationEntity>)

    @Query("DELETE FROM allocations")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM allocations")
    suspend fun getCount(): Int
}
