package com.gpssequence.tracker

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.gpssequence.tracker.data.GpsDatabaseHelper
import com.gpssequence.tracker.databinding.ActivityMainBinding
import com.gpssequence.tracker.network.GpsSyncManager
import kotlinx.coroutines.launch
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences
    private lateinit var dbHelper: GpsDatabaseHelper
    private lateinit var syncManager: GpsSyncManager

    companion object {
        private const val PREFS_NAME = "gps_sequence_prefs"
        private const val KEY_T1 = "pref_t1"
        private const val KEY_T2 = "pref_t2"
        private const val KEY_WEBHOOK = "pref_webhook"
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (fineLocationGranted) {
            checkBackgroundLocationPermission()
        } else {
            Toast.makeText(this, "Natančna lokacija je obvezna za delovanje!", Toast.LENGTH_LONG).show()
        }
    }

    private val backgroundLocationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Obravnavano
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        dbHelper = GpsDatabaseHelper.getInstance(this)
        syncManager = GpsSyncManager(this)

        loadSavedSettings()
        setupListeners()
        requestInitialPermissions()
        observeServiceState()
    }

    override fun onResume() {
        super.onResume()
        updateDatabaseCounters()
    }

    private fun loadSavedSettings() {
        val t1 = prefs.getLong(KEY_T1, 1L)
        val t2 = prefs.getLong(KEY_T2, 60L)
        val webhook = prefs.getString(KEY_WEBHOOK, "") ?: ""

        binding.etIntervalT1.setText(t1.toString())
        binding.etIntervalT2.setText(t2.toString())
        binding.etWebhookUrl.setText(webhook)

        updateDatabaseCounters()
    }

    private fun saveCurrentSettings() {
        val t1 = binding.etIntervalT1.text.toString().toLongOrNull() ?: 1L
        val t2 = binding.etIntervalT2.text.toString().toLongOrNull() ?: 60L
        val webhook = binding.etWebhookUrl.text.toString().trim()

        prefs.edit()
            .putLong(KEY_T1, t1.coerceAtLeast(1L))
            .putLong(KEY_T2, t2.coerceAtLeast(1L))
            .putString(KEY_WEBHOOK, webhook)
            .apply()
    }

    private fun setupListeners() {
        binding.btnToggleTracking.setOnClickListener {
            saveCurrentSettings()
            val isRunning = LocationService.serviceState.value.isRunning
            if (isRunning) {
                stopTrackingService()
            } else {
                startTrackingService()
            }
        }

        binding.btnTestUpload.setOnClickListener {
            saveCurrentSettings()
            val webhook = binding.etWebhookUrl.text.toString().trim()
            if (webhook.isBlank()) {
                Toast.makeText(this, "Vnesite veljaven Webhook URL!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            binding.btnTestUpload.isEnabled = false
            lifecycleScope.launch {
                val res = syncManager.syncBatch(webhook, maxPoints = 50)
                Toast.makeText(this@MainActivity, res.message, Toast.LENGTH_LONG).show()
                binding.btnTestUpload.isEnabled = true
                updateDatabaseCounters()
            }
        }

        binding.btnBatteryOpt.setOnClickListener {
            requestIgnoreBatteryOptimizations()
        }

        binding.btnClearSynced.setOnClickListener {
            val deleted = dbHelper.deleteSyncedPoints()
            Toast.makeText(this, "Pobrisano $deleted že poslanih točk.", Toast.LENGTH_SHORT).show()
            updateDatabaseCounters()
        }
    }

    private fun startTrackingService() {
        if (!hasLocationPermissions()) {
            requestInitialPermissions()
            return
        }

        val t1 = binding.etIntervalT1.text.toString().toLongOrNull() ?: 1L
        val t2 = binding.etIntervalT2.text.toString().toLongOrNull() ?: 60L
        val webhook = binding.etWebhookUrl.text.toString().trim()

        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_START
            putExtra(LocationService.EXTRA_T1_SECONDS, t1)
            putExtra(LocationService.EXTRA_T2_SECONDS, t2)
            putExtra(LocationService.EXTRA_WEBHOOK_URL, webhook)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopTrackingService() {
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_STOP
        }
        startService(intent)
    }

    private fun hasLocationPermissions(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine && coarse
    }

    private fun requestInitialPermissions() {
        val list = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            list.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(list.toTypedArray())
    }

    private fun checkBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val bgGranted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!bgGranted) {
                backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
        }
    }

    @SuppressLint("BatteryLife")
    private fun requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    startActivity(fallbackIntent)
                }
            } else {
                Toast.makeText(this, "Aplikacija že ima neomejeno delovanje v ozadju!", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun observeServiceState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                LocationService.serviceState.collect { state ->
                    updateUiState(state)
                }
            }
        }
    }

    private fun updateUiState(state: ServiceState) {
        if (state.isRunning) {
            binding.btnToggleTracking.text = "USTAVI SLEDENJE"
            binding.btnToggleTracking.setBackgroundColor(ContextCompat.getColor(this, R.color.red_stop))
            binding.tvServiceStatus.text = "Status: AKTIVNO - SNEMANJE"
            binding.tvServiceStatus.setTextColor(ContextCompat.getColor(this, R.color.teal_200))
        } else {
            binding.btnToggleTracking.text = "ZAŽENI SLEDENJE"
            binding.btnToggleTracking.setBackgroundColor(ContextCompat.getColor(this, R.color.green_start))
            binding.tvServiceStatus.text = "Status: USTAVLJENO"
            binding.tvServiceStatus.setTextColor(ContextCompat.getColor(this, R.color.white))
        }

        state.lastPoint?.let { p ->
            binding.tvLastLocation.text = String.format(Locale.US, "Zadnja lokacija: %.6f, %.6f", p.latitude, p.longitude)
            val speedKmh = p.speed * 3.6f
            binding.tvLocationDetails.text = String.format(
                Locale.US,
                "Natančnost: ±%.1f m | Hitrost: %.1f km/h | Višina: %.1f m",
                p.accuracy, speedKmh, p.altitude
            )
        }

        binding.tvTotalPoints.text = "Vseh shranjenih točk v bazi: ${state.totalPoints}"
        binding.tvUnsyncedPoints.text = "Čaka na prenos (offline zaloga): ${state.unsyncedPoints}"
        binding.tvLastSyncStatus.text = "Zadnji prenos: ${state.lastSyncStatus}"
    }

    private fun updateDatabaseCounters() {
        val total = dbHelper.getTotalCount()
        val unsynced = dbHelper.getUnsyncedCount()
        binding.tvTotalPoints.text = "Vseh shranjenih točk v bazi: $total"
        binding.tvUnsyncedPoints.text = "Čaka na prenos (offline zaloga): $unsynced"
    }
}
