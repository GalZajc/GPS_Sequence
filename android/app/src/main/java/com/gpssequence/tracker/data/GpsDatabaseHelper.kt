package com.gpssequence.tracker.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class GpsDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "gps_sequence.db"
        private const val DATABASE_VERSION = 1

        private const val TABLE_POINTS = "gps_points"
        private const val COL_ID = "id"
        private const val COL_TIMESTAMP = "timestamp"
        private const val COL_LATITUDE = "latitude"
        private const val COL_LONGITUDE = "longitude"
        private const val COL_ALTITUDE = "altitude"
        private const val COL_ACCURACY = "accuracy"
        private const val COL_SPEED = "speed"
        private const val COL_BEARING = "bearing"
        private const val COL_SYNCED = "synced"

        @Volatile
        private var instance: GpsDatabaseHelper? = null

        fun getInstance(context: Context): GpsDatabaseHelper {
            return instance ?: synchronized(this) {
                instance ?: GpsDatabaseHelper(context.applicationContext).also { instance = it }
            }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createTableSql = """
            CREATE TABLE $TABLE_POINTS (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_TIMESTAMP INTEGER NOT NULL,
                $COL_LATITUDE REAL NOT NULL,
                $COL_LONGITUDE REAL NOT NULL,
                $COL_ALTITUDE REAL NOT NULL,
                $COL_ACCURACY REAL NOT NULL,
                $COL_SPEED REAL NOT NULL,
                $COL_BEARING REAL NOT NULL,
                $COL_SYNCED INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent()
        db.execSQL(createTableSql)
        db.execSQL("CREATE INDEX idx_synced ON $TABLE_POINTS ($COL_SYNCED)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_POINTS")
        onCreate(db)
    }

    @Synchronized
    fun insertPoint(point: GpsPoint): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_TIMESTAMP, point.timestamp)
            put(COL_LATITUDE, point.latitude)
            put(COL_LONGITUDE, point.longitude)
            put(COL_ALTITUDE, point.altitude)
            put(COL_ACCURACY, point.accuracy)
            put(COL_SPEED, point.speed)
            put(COL_BEARING, point.bearing)
            put(COL_SYNCED, if (point.isSynced) 1 else 0)
        }
        return db.insert(TABLE_POINTS, null, values)
    }

    @Synchronized
    fun getUnsyncedPoints(limit: Int = 1000): List<GpsPoint> {
        val list = mutableListOf<GpsPoint>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_POINTS,
            null,
            "$COL_SYNCED = 0",
            null,
            null,
            null,
            "$COL_ID ASC",
            limit.toString()
        )

        cursor.use { c ->
            val idCol = c.getColumnIndexOrThrow(COL_ID)
            val timeCol = c.getColumnIndexOrThrow(COL_TIMESTAMP)
            val latCol = c.getColumnIndexOrThrow(COL_LATITUDE)
            val lonCol = c.getColumnIndexOrThrow(COL_LONGITUDE)
            val altCol = c.getColumnIndexOrThrow(COL_ALTITUDE)
            val accCol = c.getColumnIndexOrThrow(COL_ACCURACY)
            val spdCol = c.getColumnIndexOrThrow(COL_SPEED)
            val brgCol = c.getColumnIndexOrThrow(COL_BEARING)
            val synCol = c.getColumnIndexOrThrow(COL_SYNCED)

            while (c.moveToNext()) {
                list.add(
                    GpsPoint(
                        id = c.getLong(idCol),
                        timestamp = c.getLong(timeCol),
                        latitude = c.getDouble(latCol),
                        longitude = c.getDouble(lonCol),
                        altitude = c.getDouble(altCol),
                        accuracy = c.getFloat(accCol),
                        speed = c.getFloat(spdCol),
                        bearing = c.getFloat(brgCol),
                        isSynced = c.getInt(synCol) == 1
                    )
                )
            }
        }
        return list
    }

    @Synchronized
    fun markPointsSynced(ids: List<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            val values = ContentValues().apply {
                put(COL_SYNCED, 1)
            }
            // Execute in batches to prevent SQLite bind parameter overflow
            ids.chunked(400).forEach { chunk ->
                val placeholders = chunk.joinToString(",") { "?" }
                val args = chunk.map { it.toString() }.toTypedArray()
                db.update(TABLE_POINTS, values, "$COL_ID IN ($placeholders)", args)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    fun getUnsyncedCount(): Long {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_POINTS WHERE $COL_SYNCED = 0", null)
        return cursor.use {
            if (it.moveToFirst()) it.getLong(0) else 0L
        }
    }

    @Synchronized
    fun getTotalCount(): Long {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_POINTS", null)
        return cursor.use {
            if (it.moveToFirst()) it.getLong(0) else 0L
        }
    }

    @Synchronized
    fun deleteSyncedPoints(): Int {
        val db = writableDatabase
        return db.delete(TABLE_POINTS, "$COL_SYNCED = 1", null)
    }
}
