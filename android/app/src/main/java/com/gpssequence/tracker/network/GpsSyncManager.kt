package com.gpssequence.tracker.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import com.gpssequence.tracker.data.GpsDatabaseHelper
import com.gpssequence.tracker.data.GpsPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GpsSyncManager(private val context: Context) {

    private val dbHelper = GpsDatabaseHelper.getInstance(context)

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    companion object {
        private const val TAG = "GpsSyncManager"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }

    data class SyncResult(
        val success: Boolean,
        val pointsUploaded: Int,
        val message: String
    )

    fun isNetworkAvailable(): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    suspend fun syncBatch(webhookUrl: String, maxPoints: Int = 1000): SyncResult = withContext(Dispatchers.IO) {
        if (webhookUrl.isBlank()) {
            return@withContext SyncResult(false, 0, "Webhook URL ni nastavljen")
        }

        if (!isNetworkAvailable()) {
            val pending = dbHelper.getUnsyncedCount()
            return@withContext SyncResult(false, 0, "Brez interneta ($pending točk v čakalni vrsti)")
        }

        val unsynced = dbHelper.getUnsyncedPoints(maxPoints)
        if (unsynced.isEmpty()) {
            return@withContext SyncResult(true, 0, "Ni novih točk za prenos")
        }

        try {
            val jsonArray = JSONArray()
            for (p in unsynced) {
                jsonArray.put(p.toJson())
            }

            val payload = JSONObject().apply {
                put("device", android.os.Build.MODEL)
                put("count", unsynced.size)
                put("points", jsonArray)
            }

            val requestBody = payload.toString().toRequestBody(JSON_MEDIA_TYPE)

            var request = Request.Builder()
                .url(webhookUrl)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .build()

            var response = client.newCall(request).execute()

            // Če bi ostal ročni 302/307 redirect, sledimo z GET (Google Apps Script macros/echo)
            if (response.code in 300..399) {
                val redirectLocation = response.header("Location")
                if (redirectLocation != null) {
                    response.close()
                    val getReq = Request.Builder().url(redirectLocation).get().build()
                    response = client.newCall(getReq).execute()
                }
            }

            val responseBody = response.body?.string() ?: ""
            val code = response.code
            response.close()

            if (code in 200..299) {
                // Uspešno poslano -> označi točke v bazi
                val ids = unsynced.map { it.id }
                dbHelper.markPointsSynced(ids)
                Log.d(TAG, "Uspešno prenesenih ${unsynced.size} točk na Drive")
                return@withContext SyncResult(true, unsynced.size, "Uspešno poslano (${unsynced.size} točk)")
            } else {
                Log.e(TAG, "Napaka pri prenosu: HTTP $code - $responseBody")
                return@withContext SyncResult(false, 0, "Strežnik vrnil kodo $code")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Izjema pri sinhronizaciji: ${e.message}", e)
            val pending = dbHelper.getUnsyncedCount()
            return@withContext SyncResult(false, 0, "Napaka: ${e.localizedMessage ?: "Povezava ni uspela"} ($pending točk na čakanju)")
        }
    }
}
