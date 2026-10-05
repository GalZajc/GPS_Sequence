# 🛰️ GPS Sequence

**GPS Sequence** is a full-stack, high-precision GPS tracking and visualization suite. It consists of:
1. **Android GPS Tracker**: A lightweight Kotlin background service that records high-frequency location fixes with local SQLite caching and automatic cloud synchronization.
2. **Google Apps Script Bridge**: A serverless endpoint that receives encrypted/batched GPS packets and appends them daily to `.jsonl` files in Google Drive.
3. **Desktop Satellite Viewer**: A hardware-accelerated interactive satellite web application with YouTube-style timeline scrubbing, vehicle follow & heading orientation modes, downsampling, and CSV export.

---

## 🌍 Language Support / Podpora za jezike

The web viewer provides full **bilingual support**:
- 🇸🇮 **Slovenščina**: Privzeto pri zagonu na `localhost` (markerji `OD` in `DO`, slovenske nastavitve in obvestila).
- 🇬🇧 **English**: Default on external/hosted deployments or selectable via the flag switch (markers `FR` and `TO`, English settings and notifications).
- Language preference is stored in `localStorage` and can be toggled anytime from the settings drawer.

---

## ✨ Features

### 📱 Android Tracker (`android/`)
- **Foreground Location Service**: Continuous tracking with `FusedLocationProviderClient` even when the screen is locked or the app is minimized.
- **Offline Resilience**: Stores points in local SQLite database when cellular connectivity is unavailable.
- **Batch Synchronization**: Pushes queued points in chunks to minimize radio wake-ups and battery usage.
- **Dynamic Configuration**: Adjustable sync interval, accuracy filter, and distance thresholds.

### 🌐 Desktop Satellite Viewer (`desktop/`)
- **YouTube-Style Scrubber & Dual Timeline Navigation**:
  - Drag the timeline scrubber to travel through time with real-time map marker interpolation.
  - Drag the range bar or handles (`OD`/`DO` in Slovenian, `FR`/`TO` in English) to narrow down playback windows.
  - **Alt + Mouse Wheel**: Zoom in/out on the time axis around the cursor.
  - **Mouse Wheel**: Pan the time window left/right.
  - **Double Click** on the time window: Instant zoom to full track span.
- **Intelligent Vehicle Camera**:
  - **Follow Mode (`Shift + Enter`)**: Keeps the active vehicle position centered on the map.
  - **Heading Mode (`Ctrl + Shift + Enter`)**: Smoothly rotates the satellite map to align with the direction of travel. Features an automatic noise threshold filter to prevent map jitter during stationary stops.
- **Performance Downsampling**:
  - Real-time downsampling selector (1,000, 3,000, 5,000, 10,000, or All points) ensuring 60 FPS performance even over multi-hour trips with hundreds of thousands of coordinates.
- **Data Export & Inspection**:
  - **CSV Export**: Exports the active time slice into a 4-column CSV (`time_utc,latitude,longitude,altitude_m`) using the native Windows Save File Picker.
  - **Proximity Hover**: Interactive tooltip showing precise timestamp, latitude, longitude, altitude, speed, and accuracy.
  - **Double Click on Point**: Modal dialog to copy (t, lat, lon) triplets, raw coordinates, or full JSON.
- **Map Layers**: Google Satellite Hybrid, Pure Google Satellite, Esri World Imagery, and OpenStreetMap.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause playback |
| <kbd>S</kbd> | Slow down playback speed |
| <kbd>D</kbd> | Speed up playback speed |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Toggle Follow vehicle mode (Center) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> | Toggle Heading orientation mode |
| <kbd>Alt</kbd> + <kbd>Scroll</kbd> | Zoom timeline time axis in / out |
| <kbd>Scroll</kbd> | Pan timeline left / right |
| <kbd>M</kbd> | Open / Close settings menu drawer |
| <kbd>Esc</kbd> | Close opened dialogs or drawer |
| Double-click on track | Open point coordinate copy dialog |

---

## 🚀 Quick Start

### 1. Launching the Desktop Viewer
Requirements: **Python 3.8+** and any modern web browser.

#### Windows (Instant Launch):
Double-click `Zazeni_GPS_Viewer.vbs` in the root folder. It starts the local Python server in the background and opens `http://localhost:8050` directly in your default browser.

#### Manual Terminal Launch:
```bash
python desktop/server.py
```
Then navigate to: [http://localhost:8050](http://localhost:8050)

### 2. Google Apps Script Setup
1. Open Google Drive and create a new **Google Apps Script** project.
2. Paste the code from `google-apps-script/Code.js`.
3. Deploy as **Web App** (Execute as: *Me*, Who has access: *Anyone*).
4. Copy the deployment URL into the Android app settings.
5. See `google-apps-script/NAVODILA_GOOGLE_DRIVE.md` for step-by-step instructions.

### 3. Building the Android Tracker
1. Open the `android/` directory in **Android Studio** (Koala / Ladybug or newer).
2. Sync Gradle dependencies.
3. Build and install the APK on your Android device (`Build > Build APK(s)`).
4. Grant *Precise Location* and *Background Location* permissions.

---

## 📁 Repository Structure

```
GPS Sequence/
├── android/                   # Android Studio tracker project (Kotlin)
│   ├── app/
│   │   └── src/main/java/com/gpssequence/tracker/
│   ├── build.gradle.kts
│   └── settings.gradle.kts
├── desktop/                   # Satellite web viewer
│   ├── index.html             # UI layout & responsive dialogs
│   ├── style.css              # Dark theme styling & timeline design
│   ├── viewer.js              # Leaflet engine, i18n, timeline & downsampling
│   ├── server.py              # Local HTTP API server
│   ├── zazeni_pregledovalnik.bat # Batch startup script
│   └── tracks/                # Recorded .jsonl track files
├── google-apps-script/        # Cloud synchronization backend
│   ├── Code.js                # Apps Script receiver endpoint
│   └── NAVODILA_GOOGLE_DRIVE.md # Cloud setup instructions
├── Zazeni_GPS_Viewer.vbs      # Silent background launcher
├── .gitignore
└── README.md
```

---

## 📄 License
MIT License. Developed for high-precision GPS tracking, trajectory analysis, and navigation research.
