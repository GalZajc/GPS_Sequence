package com.gpssequence.tracker

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.gpssequence.tracker.data.GpsDatabaseHelper
import com.gpssequence.tracker.data.GpsPoint
import com.gpssequence.tracker.network.GpsSyncManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ServiceState(
    val isRunning: Boolean = false,
    val lastPoint: GpsPoint? = null,
    val totalPoints: Long = 0,
    val unsyncedPoints: Long = 0,
    val lastSyncStatus: String = "Čakanje na prvi prenos"
)

class LocationService : Service() {

    companion object {
        private const val TAG = "LocationService"
        const val ACTION_START = "com.gpssequence.tracker.ACTION_START"
        const val ACTION_STOP = "com.gpssequence.tracker.ACTION_STOP"
        const val EXTRA_T1_SECONDS = "extra_t1_seconds"
        const val EXTRA_T2_SECONDS = "extra_t2_seconds"
        const val EXTRA_WEBHOOK_URL = "extra_webhook_url"

        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "gps_sequence_channel"

        private val _serviceState = MutableStateFlow(ServiceState())
        val serviceState: StateFlow<ServiceState> = _serviceState.asStateFlow()
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var dbHelper: GpsDatabaseHelper
    private lateinit var syncManager: GpsSyncManager
    private var wakeLock: PowerManager.WakeLock? = null

    private val serviceScope = CoroutineScope(Dispatchers.Default + Job())
    private var syncJob: Job? = null

    private var t1Seconds: Long = 1
    private var t2Seconds: Long = 60
    private var webhookUrl: String = ""

    override fun onCreate() {
        super.onCreate()
        dbHelper = GpsDatabaseHelper.getInstance(this)
        syncManager = GpsSyncManager(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        createNotificationChannel()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    onNewLocation(location)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                t1Seconds = (intent.getLongExtra(EXTRA_T1_SECONDS, 1)).coerceAtLeast(1)
                t2Seconds = (intent.getLongExtra(EXTRA_T2_SECONDS, 60)).coerceAtLeast(1)
                webhookUrl = intent.getStringExtra(EXTRA_WEBHOOK_URL) ?: ""

                startForegroundTracking()
            }
            ACTION_STOP -> {
                stopTracking()
                stopSelf()
            }
        }
        return START_STICKY
    }

    @SuppressLint("MissingPermission", "WakelockTimeout")
    private fun startForegroundTracking() {
        acquireWakeLock()

        val notification = buildNotification("Zagon merjenja...", 0, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Nastavitev zajema GPS lokacij
        val intervalMillis = t1Seconds * 1000L
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMillis)
            .setMinUpdateIntervalMillis(intervalMillis)
            .setMinUpdateDistanceMeters(0f)
            .setWaitForAccurateLocation(false)
            .build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.d(TAG, "GPS posodobitve zagnane z intervalom ${t1Seconds}s")
        } catch (e: SecurityException) {
            Log.e(TAG, "Manjkajoča dovoljenja za lokacijo", e)
            stopSelf()
            return
        }

        // Posodobi začetno stanje
        val total = dbHelper.getTotalCount()
        val unsynced = dbHelper.getUnsyncedCount()
        _serviceState.value = ServiceState(
            isRunning = true,
            lastPoint = null,
            totalPoints = total,
            unsyncedPoints = unsynced,
            lastSyncStatus = "Pripravljen na sinhronizacijo"
        )

        // Zaženi periodično zanko za pošiljanje paketov na t2 sekund
        startSyncLoop()
    }

    private fun onNewLocation(location: Location) {
        val point = GpsPoint(
            timestamp = location.time.takeIf { it > 0 } ?: System.currentTimeMillis(),
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = location.altitude,
            accuracy = location.accuracy,
            speed = location.speed,
            bearing = location.bearing,
            isSynced = false
        )

        // Takojšen zapis v lokalno SQLite bazo (brez izgube!)
        dbHelper.insertPoint(point)

        val total = dbHelper.getTotalCount()
        val unsynced = dbHelper.getUnsyncedCount()

        _serviceState.value = _serviceState.value.copy(
            lastPoint = point,
            totalPoints = total,
            unsyncedPoints = unsynced
        )

        // Posodobi obvestilo občasno (na vsakih 5 točk za varčevanje CPU)
        if (total % 5L == 0L) {
            updateNotification("Zabeleženo: $total točk | Čaka: $unsynced", total, unsynced)
        }
    }

    private fun startSyncLoop() {
        syncJob?.cancel()
        syncJob = serviceScope.launch {
            while (isActive) {
                delay(t2Seconds * 1000L)
                if (!isActive) break

                val result = syncManager.syncBatch(webhookUrl)
                val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                val statusText = "[$timeStr] ${result.message}"

                val total = dbHelper.getTotalCount()
                val unsynced = dbHelper.getUnsyncedCount()

                _serviceState.value = _serviceState.value.copy(
                    totalPoints = total,
                    unsyncedPoints = unsynced,
                    lastSyncStatus = statusText
                )

                updateNotification("Shranjeno: $total | Čaka: $unsynced | Sync: ${result.message}", total, unsynced)
            }
        }
    }

    private fun stopTracking() {
        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (e: Exception) {
            Log.e(TAG, "Napaka pri zaustavitvi GPS posodobitev", e)
        }
        syncJob?.cancel()
        releaseWakeLock()

        _serviceState.value = _serviceState.value.copy(isRunning = false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        Log.d(TAG, "GPS sledenje ustavljeno")
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "GpsSequence::LocationWakeLock"
            ).apply {
                acquire()
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Napaka pri sprostitvi WakeLocka", e)
        }
        wakeLock = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "GPS Sequence Snemanje",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Neprekinjeno beleženje GPS koordinat v ozadju"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String, total: Long, unsynced: Long): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val stopIntent = Intent(this, LocationService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val title = getString(R.string.notification_title_format, t1Seconds, t2Seconds)
        val stopActionTitle = getString(R.string.notification_action_stop)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_location)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, stopActionTitle, stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String, total: Long, unsynced: Long) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text, total, unsynced))
    }

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
