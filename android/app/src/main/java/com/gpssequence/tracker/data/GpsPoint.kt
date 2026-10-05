package com.gpssequence.tracker.data

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class GpsPoint(
    val id: Long = 0,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    val altitude: Double,
    val accuracy: Float,
    val speed: Float,
    val bearing: Float,
    val isSynced: Boolean = false
) {
    fun toJson(): JSONObject {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        return JSONObject().apply {
            put("id", id)
            put("time_ms", timestamp)
            put("time_utc", isoFormat.format(Date(timestamp)))
            put("lat", latitude)
            put("lon", longitude)
            put("alt", altitude)
            put("acc", accuracy)
            put("spd", speed)
            put("brg", bearing)
        }
    }
}
