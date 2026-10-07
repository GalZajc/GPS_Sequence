/**
 * GPS Sequence - Satelitski pregledovalnik meritev (Posodobljen)
 * Popolna podpora za:
 * - Minimalističen celozaslonski način z burger menijem
 * - YouTube časovnico na dnu (OD / DO rdeča gumba)
 * - Alt + Scroll interaktivno časovno zoomiranje in markerje
 * - Tipke: Space (Play/Pause), S/D (Upočasni/Pohitri z oblačkom)
 * - Shift + Enter: Sledenje točki (Center mode)
 * - Ctrl + Shift + Enter: Orientacija v smeri gibanja z zadušitvijo šuma
 * - Dvoklik: Kopiranje koordinat (t, lat, lon)
 */

// Globalno stanje
let map = null;
let tileLayers = {};
let allPoints = [];
let globalTMin = 0;
let globalTMax = 0;

// Aktivno časovno okno
let tStart = 0;
let tEnd = 0;
let currentQ = 1.0; // Delež od tStart do tEnd [0.0 ... 1.0]
let currentTime = 0;

// Aktivna časovna os na ekranu (viewport od 0% do 100% širine zaslona)
let viewStart = 0;
let viewEnd = 0;
let isWindowMode = false;

// Nastavitve renderiranja in zmogljivost
let maxRenderPoints = 3000;
let trajectoryWeight = 2.5; // Privzeto 2-krat tanjša sled
let showFuturePath = false; // Privzeto izklopljena črtkana sled
let isTimelinePinned = true; // Privzeto zaklenjena na dnu ekrana

// Vlečenje drsnika in markerjev
let isDraggingScrubber = false;
let dragMode = null; // null | 'scrubber' | 'leftHandle' | 'rightHandle' | 'centerBar'
let dragStartX = 0;
let dragInitialTStart = 0;
let dragInitialTEnd = 0;
let didDragMove = false;

// Intervali dejanskega gibanja
let movementIntervals = [];
let showMovementIntervals = true;
let movementWindowMs = 5 * 60 * 1000; // 5 minut
let movementDistM = 30; // 30 metrov
let snapDistancePx = 15; // Privzeta razdalja magnetnega privlačenja v pikslih (0 = izklopljeno)

// Kartografski objekti
let activePolyline = null;
let futurePolyline = null;
let currentMarker = null;
let proximityMarker = null;
let startMarker = null; // Pika v času OD (v okenskem načinu)
let endMarker = null;   // Pika v času DO (v okenskem načinu)

// Predvajanje
let isPlaying = false;
let playAnimFrame = null;
let lastPlayTimestamp = null;
const speedLevels = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
let speedIndex = 4; // Privzeto 5x
let playSpeed = speedLevels[speedIndex];

// Načini kamere (Shift+Enter in Ctrl+Shift+Enter)
let isFollowMode = false;
let isHeadingMode = false;
let currentHeadingAngle = 0;
let lastHeadingLat = null;
let lastHeadingLon = null;

// Popup za čas
let activePickerTarget = null;
let selectedPointForCopy = null;

// Časovnik za sredinski toast
let centerIndicatorTimeout = null;

// Večjezična podpora (i18n: sl in en)
const I18N = {
  sl: {
    btn_menu_title: "Odpri nastavitve in podatke (M)",
    sec_track: "SLED IN DATOTEKA",
    lbl_active_track: "Aktivna sled:",
    title_reload_tracks: "Osveži seznam",
    btn_open_file: "📂 Odpri lokalno .jsonl datoteko",
    lbl_auto_refresh: "Samodejno osveževanje (V živo)",
    btn_export_csv: "📥 Izvozi točke v CSV (t, lat, lon, alt)",
    sec_sat_map: "SATELITSKI ZEMLJEVID",
    opt_layer_hybrid: "Google Satelit (hibrid z imeni)",
    opt_layer_sat: "Google Satelit (čisti)",
    opt_layer_esri: "Esri World Imagery",
    opt_layer_osm: "OpenStreetMap",
    btn_fit_bounds: "🔍 Centriraj celotno pot",
    sec_view_camera: "POGLED IN KAMERA",
    lbl_follow_mode: "Sledenje točki (Center):",
    lbl_heading_mode: "Orientacija v smeri (Heading):",
    lbl_timeline_opacity: "Prosojnost časovnice:",
    lbl_pin_timeline: "Časovnica vedno vidna",
    sec_rendering: "RENDERIRANJE IN SLED",
    lbl_max_points: "Maks. točk (proti štekanju):",
    opt_pts_1k: "1.000 točk",
    opt_pts_3k: "3.000 točk",
    opt_pts_5k: "5.000 točk",
    opt_pts_10k: "10.000 točk",
    opt_pts_all: "Vse točke",
    opt_track_all_days: "Vsi dnevi (Združeno)",
    lbl_traj_thickness: "Debelina sledi:",
    lbl_show_future: "Prikaz prihodnje (črtkane) sledi",
    lbl_show_movement: "Označi intervale gibanja na časovnici",
    lbl_move_window: "Okno gibanja (min):",
    lbl_move_dist: "Min. premik (m):",
    lbl_snap_dist: "Magnetno privlačenje (px):",
    sec_current_point: "TRENUTNA TOČKA",
    lbl_hud_time: "Čas:",
    lbl_hud_speed: "Hitrost:",
    lbl_hud_alt: "Višina:",
    lbl_hud_acc: "Natančnost:",
    lbl_hud_coords: "Koordinate:",
    lbl_hud_total: "Število točk:",
    sec_shortcuts: "BLIŽNJICE NA TIPKOVNICI",
    sc_k_space: "Preslednica",
    sc_d_space: "Predvajaj / Zaustavi",
    sc_d_s: "Upočasni predvajanje",
    sc_d_d: "Pohitri predvajanje",
    sc_d_shift_enter: "Sledenje točki (Center)",
    sc_d_ctrl_shift_enter: "Obračanje v smeri (Heading)",
    sc_d_alt_scroll: "Povečaj/pomanjšaj časovno os",
    sc_d_scroll: "Premikaj časovnico levo/desno",
    sc_k_dblclick: "Dvoklik",
    sc_d_dblclick: "Kopiraj koordinate točke",
    sc_d_m: "Odpri / zapri ta meni",
    mode_active: "AKTIVNO",
    mode_off: "IZKLOPLJENO",
    tip_hint: "Dvoklik za kopiranje",
    tag_start: "OD",
    tag_end: "DO",
    tag_start_title: "Nastavi ali povleci začetni čas (OD)",
    tag_end_title: "Nastavi ali povleci končni čas (DO)",
    bar_title: "Povleci za premik časovnega okna (dvoklik za prikaz čez celotno časovnico)",
    picker_title_start: "Nastavitev začetnega časa (OD)",
    picker_title_end: "Nastavitev končnega časa (DO)",
    picker_title: "Nastavitev časa",
    picker_lbl_date: "Datum:",
    picker_lbl_time: "Čas (Ura : Minuta : Sekunda):",
    picker_sub_hour: "Ura (0-23)",
    picker_sub_min: "Min (0-59)",
    picker_sub_sec: "Sek (0-59)",
    btn_reset: "Ponastavi",
    btn_apply: "Uveljavi",
    modal_point_title: "📍 GPS Točka",
    detail_time: "Čas (t):",
    detail_lat: "Širina φ (Lat):",
    detail_lon: "Dolžina λ (Lon):",
    detail_alt_spd: "Višina / Hitrost:",
    btn_copy_triplet: "📋 Kopiraj trojico (t, lat, lon)",
    btn_copy_coords: "📋 Kopiraj koordinate (lat, lon)",
    btn_copy_json: "📋 Kopiraj kot JSON",
    toast_pause: "Pavza",
    toast_play: "Predvajanje:",
    toast_speed: "Hitrost:",
    toast_follow: "Sledenje točki:",
    toast_heading: "Orientacija v smeri:",
    toast_enabled: "VKLOPLJENO",
    toast_disabled: "IZKLOPLJENO",
    toast_full_width: "Časovnica: Celotna širina",
    toast_all_points: "Časovna os: Vse meritve",
    toast_time_updated: "Čas posodobljen!",
    toast_time_reset: "Čas ponastavljen!",
    toast_time_order_err_start: "OD mora biti pred DO!",
    toast_time_order_err_end: "DO mora biti za OD!",
    toast_invalid_date: "Izberite veljaven datum!",
    toast_triplet_copied: "Trojica (t, lat, lon) skopirana!",
    toast_coords_copied: "Koordinate (lat, lon) skopirane!",
    toast_json_copied: "JSON točke skopiran!",
    toast_no_export_pts: "Ni točk za izvoz!",
    toast_no_range_pts: "Ni točk v izbranem območju!",
    toast_exporting: "Priprava točk za izvoz...",
    toast_exported: "Uspešno izvoženo v CSV!",
    toast_loaded: "Naloženo točk:",
    toast_end_of_track: "Konec poti",
    toast_limit_pts: "Omejitev:",
    toast_all_pts: "Prikaz: Vse točke",
    toast_clipboard_copied: "Skopirano v odložišče!",
    display_range: "Prikaz:",
    time_axis: "Časovna os:"
  },
  en: {
    btn_menu_title: "Open settings & data (M)",
    sec_track: "TRACK & FILE",
    lbl_active_track: "Active track:",
    title_reload_tracks: "Refresh list",
    btn_open_file: "📂 Open local .jsonl file",
    lbl_auto_refresh: "Auto refresh (Live)",
    btn_export_csv: "📥 Export points to CSV (t, lat, lon, alt)",
    sec_sat_map: "SATELLITE MAP",
    opt_layer_hybrid: "Google Satellite (Hybrid)",
    opt_layer_sat: "Google Satellite (Pure)",
    opt_layer_esri: "Esri World Imagery",
    opt_layer_osm: "OpenStreetMap",
    btn_fit_bounds: "🔍 Fit entire track",
    sec_view_camera: "VIEW & CAMERA",
    lbl_follow_mode: "Follow vehicle (Center):",
    lbl_heading_mode: "Heading orientation:",
    lbl_timeline_opacity: "Timeline opacity:",
    lbl_pin_timeline: "Pin timeline visible",
    sec_rendering: "RENDERING & TRACK",
    lbl_max_points: "Max points (performance):",
    opt_pts_1k: "1,000 points",
    opt_pts_3k: "3,000 points",
    opt_pts_5k: "5,000 points",
    opt_pts_10k: "10,000 points",
    opt_pts_all: "All points",
    opt_track_all_days: "All days (Combined)",
    lbl_traj_thickness: "Track thickness:",
    lbl_show_future: "Show future (dashed) path",
    lbl_show_movement: "Highlight movement intervals on timeline",
    lbl_move_window: "Movement window (min):",
    lbl_move_dist: "Min. movement (m):",
    lbl_snap_dist: "Magnetic snap (px):",
    sec_current_point: "CURRENT POINT",
    lbl_hud_time: "Time:",
    lbl_hud_speed: "Speed:",
    lbl_hud_alt: "Altitude:",
    lbl_hud_acc: "Accuracy:",
    lbl_hud_coords: "Coordinates:",
    lbl_hud_total: "Total points:",
    sec_shortcuts: "KEYBOARD SHORTCUTS",
    sc_k_space: "Spacebar",
    sc_d_space: "Play / Pause",
    sc_d_s: "Slow down playback",
    sc_d_d: "Speed up playback",
    sc_d_shift_enter: "Follow vehicle (Center)",
    sc_d_ctrl_shift_enter: "Heading orientation",
    sc_d_alt_scroll: "Zoom time axis (in/out)",
    sc_d_scroll: "Pan timeline left/right",
    sc_k_dblclick: "Double-click",
    sc_d_dblclick: "Copy point coordinates",
    sc_d_m: "Open / close this menu",
    mode_active: "ACTIVE",
    mode_off: "OFF",
    tip_hint: "Double-click to copy",
    tag_start: "FR",
    tag_end: "TO",
    tag_start_title: "Set or drag start time (FR)",
    tag_end_title: "Set or drag end time (TO)",
    bar_title: "Drag to shift time window (double-click to expand to full screen)",
    picker_title_start: "Set Start Time (FR)",
    picker_title_end: "Set End Time (TO)",
    picker_title: "Set Time",
    picker_lbl_date: "Date:",
    picker_lbl_time: "Time (Hour : Minute : Second):",
    picker_sub_hour: "Hour (0-23)",
    picker_sub_min: "Min (0-59)",
    picker_sub_sec: "Sec (0-59)",
    btn_reset: "Reset",
    btn_apply: "Apply",
    modal_point_title: "📍 GPS Point",
    detail_time: "Time (t):",
    detail_lat: "Latitude φ (Lat):",
    detail_lon: "Longitude λ (Lon):",
    detail_alt_spd: "Altitude / Speed:",
    btn_copy_triplet: "📋 Copy triplet (t, lat, lon)",
    btn_copy_coords: "📋 Copy coordinates (lat, lon)",
    btn_copy_json: "📋 Copy as JSON",
    toast_pause: "Pause",
    toast_play: "Playback:",
    toast_speed: "Speed:",
    toast_follow: "Follow mode:",
    toast_heading: "Heading mode:",
    toast_enabled: "ENABLED",
    toast_disabled: "DISABLED",
    toast_full_width: "Timeline: Full width",
    toast_all_points: "Time axis: All measurements",
    toast_time_updated: "Time updated!",
    toast_time_reset: "Time reset!",
    toast_time_order_err_start: "Start must be before End!",
    toast_time_order_err_end: "End must be after Start!",
    toast_invalid_date: "Please select a valid date!",
    toast_triplet_copied: "Triplet (t, lat, lon) copied!",
    toast_coords_copied: "Coordinates (lat, lon) copied!",
    toast_json_copied: "Point JSON copied!",
    toast_no_export_pts: "No points to export!",
    toast_no_range_pts: "No points in selected range!",
    toast_exporting: "Preparing points for export...",
    toast_exported: "Successfully exported to CSV!",
    toast_loaded: "Points loaded:",
    toast_end_of_track: "End of route",
    toast_limit_pts: "Limit:",
    toast_all_pts: "View: All points",
    toast_clipboard_copied: "Copied to clipboard!",
    display_range: "View:",
    time_axis: "Time axis:"
  }
};

const savedLang = localStorage.getItem("gps_sequence_lang");
let currentLang = savedLang || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "sl" : "en");

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.sl && I18N.sl[key]) || key;
}

function setLanguage(lang) {
  currentLang = (lang === "en" || lang === "sl") ? lang : "sl";
  localStorage.setItem("gps_sequence_lang", currentLang);
  document.documentElement.lang = currentLang;

  const btnLangSl = document.getElementById("btnLangSl");
  const btnLangEn = document.getElementById("btnLangEn");
  if (btnLangSl) btnLangSl.classList.toggle("active", currentLang === "sl");
  if (btnLangEn) btnLangEn.classList.toggle("active", currentLang === "en");

  // Posodobi vse elemente z data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (I18N[currentLang] && I18N[currentLang][key]) {
      el.textContent = I18N[currentLang][key];
    }
  });

  // Posodobi vse elemente z data-i18n-title
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (I18N[currentLang] && I18N[currentLang][key]) {
      el.title = I18N[currentLang][key];
    }
  });

  // Posodobi ročici na časovnici (OD/DO ali FR/TO)
  const leftTag = document.getElementById("leftHandleTag");
  const rightTag = document.getElementById("rightHandleTag");
  const leftHandle = document.getElementById("leftHandle");
  const rightHandle = document.getElementById("rightHandle");
  const centerBar = document.getElementById("windowCenterBar");

  if (leftTag) leftTag.textContent = I18N[currentLang].tag_start;
  if (rightTag) rightTag.textContent = I18N[currentLang].tag_end;
  if (leftHandle) leftHandle.title = I18N[currentLang].tag_start_title;
  if (rightHandle) rightHandle.title = I18N[currentLang].tag_end_title;
  if (centerBar) centerBar.title = I18N[currentLang].bar_title;

  // Posodobi ikoni pik na zemljevidu (OD/DO ali FR/TO)
  if (startMarker) startMarker.setIcon(getBoundaryIcon(I18N[currentLang].tag_start));
  if (endMarker) endMarker.setIcon(getBoundaryIcon(I18N[currentLang].tag_end));

  const allOpt = document.querySelector('#trackSelect option[value="__ALL__"]');
  if (allOpt) {
    allOpt.textContent = `★ ${t("opt_track_all_days")}`;
  }

  // Posodobi gumba načinov v meniju
  const btnFollow = document.getElementById("btnToggleFollow");
  if (btnFollow) {
    btnFollow.textContent = isFollowMode ? I18N[currentLang].mode_active : I18N[currentLang].mode_off;
  }
  const btnHeading = document.getElementById("btnToggleHeading");
  if (btnHeading) {
    btnHeading.textContent = isHeadingMode ? I18N[currentLang].mode_active : I18N[currentLang].mode_off;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupEventListeners();
  loadTrackList();
  setLanguage(currentLang);

  setInterval(() => {
    const chk = document.getElementById("chkAutoRefresh");
    if (chk && chk.checked) {
      pollCurrentTrack();
    }
  }, 5000);
});

/* ==========================================================
   1. INICIALIZACIJA ZEMLJEVIDA (Leaflet)
   ========================================================== */
function initMap() {
  map = L.map("map", {
    center: [46.0888, 14.6327],
    zoom: 16,
    zoomControl: false,
    doubleClickZoom: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  tileLayers = {
    google_hybrid: L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 22,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "Google Maps Satellite"
    }),
    google_sat: L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      maxZoom: 22,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "Google Satellite"
    }),
    esri_sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Esri World Imagery"
    }),
    osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "OpenStreetMap"
    })
  };

  tileLayers.google_hybrid.addTo(map);

  activePolyline = L.polyline([], {
    color: "#00e5ff",
    weight: trajectoryWeight,
    opacity: 0.95,
    lineJoin: "round",
    lineCap: "round",
    smoothFactor: 0
  }).addTo(map);

  futurePolyline = L.polyline([], {
    color: "rgba(255, 255, 255, 0.35)",
    weight: Math.max(1.5, trajectoryWeight - 1),
    dashArray: "4, 6",
    lineJoin: "round",
    smoothFactor: 0
  }).addTo(map);

  currentMarker = L.marker([0, 0], { icon: getVehicleIcon() }).addTo(map);

  const crossIcon = L.divIcon({
    className: "proximity-cross-icon",
    html: `
      <div style="
        position: relative;
        width: 15px; height: 15px;
        pointer-events: none;
      ">
        <div style="position: absolute; top: 6px; left: 0px; width: 15px; height: 3px; background: #ff0033; box-shadow: 0 0 3px #000; border-radius: 1px;"></div>
        <div style="position: absolute; top: 0px; left: 6px; width: 3px; height: 15px; background: #ff0033; box-shadow: 0 0 3px #000; border-radius: 1px;"></div>
      </div>
    `,
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5]
  });
  proximityMarker = L.marker([0, 0], { icon: crossIcon }).addTo(map);
  proximityMarker.setOpacity(0);

  startMarker = L.marker([0, 0], { icon: getBoundaryIcon("OD"), title: "Začetek okna (OD)" }).addTo(map);
  startMarker.setOpacity(0);

  endMarker = L.marker([0, 0], { icon: getBoundaryIcon("DO"), title: "Konec okna (DO)" }).addTo(map);
  endMarker.setOpacity(0);

  map.on("mousemove", onMapMouseMove);
  map.on("dblclick", onMapDoubleClick);

  // Ujemi Alt + Scroll tudi nad samim zemljevidom za brezhibno izkušnjo
  map.getContainer().addEventListener("wheel", (e) => {
    if (e.altKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      const cursorFraction = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
      handleTimelineZoom(e.deltaY, cursorFraction);
    }
  }, { capture: true, passive: false });
}

function getVehicleIcon() {
  const diameter = Math.round(11 * (trajectoryWeight / 2.5));
  const borderWidth = Math.max(1.5, Math.min(3.5, trajectoryWeight * 0.7));
  const half = diameter / 2;
  return L.divIcon({
    className: "current-vehicle-icon",
    html: `
      <div style="
        width: ${diameter}px; height: ${diameter}px;
        background: rgba(0, 229, 255, 0.35);
        border: ${borderWidth}px solid #00e5ff;
        border-radius: 50%;
        box-shadow: 0 0 8px #00e5ff, 0 0 3px #000000;
        box-sizing: border-box;
      "></div>
    `,
    iconSize: [diameter, diameter],
    iconAnchor: [half, half]
  });
}

function getBoundaryIcon(label) {
  const diameter = Math.max(13, Math.round(13 * (trajectoryWeight / 2.5)));
  const borderWidth = Math.max(1.5, Math.min(3.5, trajectoryWeight * 0.7));
  const half = diameter / 2;
  return L.divIcon({
    className: "boundary-marker-icon",
    html: `
      <div style="
        width: ${diameter}px; height: ${diameter}px;
        background: #00b0ff;
        border: ${borderWidth}px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 10px #00b0ff, 0 0 4px #000000;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      ">
        <span style="font-size: 7px; font-weight: 900; color: #000; line-height: 1; user-select: none;">${label}</span>
      </div>
    `,
    iconSize: [diameter, diameter],
    iconAnchor: [half, half]
  });
}

function getPointAtTime(targetTime) {
  if (!allPoints || allPoints.length === 0) return null;
  let closest = allPoints[0];
  let minDiff = Math.abs(allPoints[0].time_ms - targetTime);
  for (let i = 1; i < allPoints.length; i++) {
    const diff = Math.abs(allPoints[i].time_ms - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = allPoints[i];
    } else if (allPoints[i].time_ms > targetTime) {
      break;
    }
  }
  return closest;
}

function updateVehicleIcon() {
  if (currentMarker) {
    currentMarker.setIcon(getVehicleIcon());
  }
  if (startMarker) {
    startMarker.setIcon(getBoundaryIcon("OD"));
  }
  if (endMarker) {
    endMarker.setIcon(getBoundaryIcon("DO"));
  }
}

/* ==========================================================
   2. NALAGANJE PODATKOV IN SLEDI
   ========================================================== */
async function loadTrackList() {
  const select = document.getElementById("trackSelect");
  try {
    const res = await fetch("/api/tracks");
    if (!res.ok) throw new Error("API ni na voljo");
    const files = await res.json();
    if (select) {
      select.innerHTML = "";
      if (files.length === 0) {
        select.innerHTML = `<option value="">Ni najdenih sledi</option>`;
        return;
      }

      files.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        if (f === "__ALL__") {
          opt.textContent = `★ ${t("opt_track_all_days")}`;
        } else {
          opt.textContent = f;
        }
        select.appendChild(opt);
      });
    }

    loadTrackFile((files && files.length > 0) ? files[0] : "__ALL__");
  } catch (err) {
    console.warn("Lokalni strežnik /api/tracks ni dosegljiv, nalagam __ALL__.", err);
    loadTrackFile("__ALL__");
  }
}

async function loadTrackFile(filename) {
  if (!filename) return;
  try {
    const res = await fetch(`/api/track/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error("Napaka pri branju datoteke");
    const points = await res.json();
    setGpsPoints(points);
  } catch (err) {
    flashCenterIndicator("Napaka pri nalaganju: " + err.message);
  }
}

async function pollCurrentTrack() {
  const select = document.getElementById("trackSelect");
  const filename = (select && select.value) ? select.value : "__ALL__";

  try {
    const res = await fetch(`/api/track/${encodeURIComponent(filename)}`);
    if (!res.ok) return;
    const points = await res.json();
    if (points.length !== allPoints.length) {
      const wasAtEnd = currentQ >= 0.99;
      setGpsPoints(points, false);
      if (wasAtEnd) {
        currentQ = 1.0;
        updateScrubberPosition();
      }
    }
  } catch (e) {}
}

function downsamplePoints(pts, maxCount) {
  if (!maxCount || maxCount <= 0 || pts.length <= maxCount) {
    return pts;
  }
  const result = [];
  const total = pts.length;
  const step = (total - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.min(total - 1, Math.round(i * step));
    result.push(pts[idx]);
  }
  return result;
}

function setGpsPoints(points, shouldFitBounds = true) {
  if (!points || points.length === 0) {
    allPoints = [];
    document.getElementById("hudTotalPoints").textContent = "0";
    return;
  }

  // Filtriraj morebitne testne točke v Ljubljani (lat: 46.056946)
  allPoints = points
    .filter(p => Math.abs(p.lat - 46.056946) > 0.001)
    .sort((a, b) => (a.time_ms || 0) - (b.time_ms || 0));

  if (allPoints.length === 0) return;

  globalTMin = allPoints[0].time_ms;
  globalTMax = allPoints[allPoints.length - 1].time_ms;

  // Izračunaj intervale dejanskega gibanja pred nastavitvijo privzetega okna
  computeMovementIntervals();

  // Privzeto nastavi OD in DO na zadnji interval premikanja (če obstaja)
  if (movementIntervals && movementIntervals.length > 0) {
    const lastMove = movementIntervals[movementIntervals.length - 1];
    tStart = lastMove.start;
    tEnd = Math.max(lastMove.start + 1000, lastMove.end);
  } else {
    // Če ni zaznanega premikanja, prikaži zadnjih 1000 sekund ali celotno pot
    const defaultWindowMs = 1000 * 1000; // 1000 s
    if (globalTMax - globalTMin > defaultWindowMs) {
      tStart = Math.max(globalTMin, globalTMax - defaultWindowMs);
      tEnd = globalTMax;
    } else {
      tStart = globalTMin;
      tEnd = globalTMax;
    }
  }

  isWindowMode = false;
  currentQ = 1.0;
  currentTime = tEnd;
  viewStart = tStart;
  viewEnd = tEnd;

  lastRenderedViewStart = null;
  lastRenderedViewEnd = null;

  document.getElementById("hudTotalPoints").textContent = allPoints.length.toString();

  updateScrubberPosition();

  if (shouldFitBounds) {
    fitBoundsToTrack();
  }
}

function fitBoundsToTrack() {
  if (allPoints.length === 0) return;
  const targetPoints = allPoints.filter(p => p.time_ms >= tStart && p.time_ms <= tEnd);
  const ptsToUse = targetPoints.length > 0 ? targetPoints : allPoints;
  const latLngs = ptsToUse.map(p => [p.lat, p.lon]);
  const bounds = L.latLngBounds(latLngs);
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
}

/* ==========================================================
   3. ČASOVNICA IN PREMIKANJE DRASNIKA (Scrubber q)
   ========================================================== */
function updateScrubberPosition() {
  if (tStart >= tEnd) tEnd = tStart + 1000;
  if (viewStart >= viewEnd) viewEnd = viewStart + 1000;

  // Zagotovi, da je prikazana časovna os znotraj veljavnih meritev
  if (viewStart < globalTMin) viewStart = globalTMin;
  if (viewEnd > globalTMax) viewEnd = globalTMax;

  const windowDuration = Math.max(1000, tEnd - tStart);
  const viewDuration = Math.max(1000, viewEnd - viewStart);

  currentQ = Math.max(0, Math.min(1, currentQ));
  currentTime = tStart + currentQ * windowDuration;

  const progressBar = document.getElementById("scrubberProgress");
  const thumb = document.getElementById("scrubberThumb");
  const highlight = document.getElementById("windowHighlight");
  const leftHandle = document.getElementById("leftHandle");
  const rightHandle = document.getElementById("rightHandle");

  // Položaj okna znotraj prikazane časovne osi na ekranu [viewStart, viewEnd]
  const startPct = ((tStart - viewStart) / viewDuration) * 100;
  const endPct = ((tEnd - viewStart) / viewDuration) * 100;
  const widthPct = Math.max(0, endPct - startPct);

  // isWindowMode: ali se izbrano območje razlikuje od celotne širine zaslona (več kot 0.8%) ali pa uporabnik vleče ročice
  isWindowMode = (startPct > 0.8 || endPct < 99.2 || startPct < -0.8 || endPct > 100.8) || (dragMode === 'leftHandle' || dragMode === 'rightHandle' || dragMode === 'centerBar');

  // Položaj trenutnega predvajanega časa
  const currentPct = ((currentTime - viewStart) / viewDuration) * 100;

  if (highlight) {
    highlight.style.display = "block";
    highlight.style.left = `${startPct.toFixed(2)}%`;
    highlight.style.width = `${widthPct.toFixed(2)}%`;

    const timelineEl = document.getElementById("timelineContainer");
    if (isWindowMode) {
      highlight.classList.add("window-active");
      if (leftHandle) leftHandle.classList.add("window-active");
      if (rightHandle) rightHandle.classList.add("window-active");
      if (timelineEl) timelineEl.classList.add("window-active-timeline");
    } else {
      highlight.classList.remove("window-active");
      if (leftHandle) leftHandle.classList.remove("window-active");
      if (rightHandle) rightHandle.classList.remove("window-active");
      if (timelineEl) timelineEl.classList.remove("window-active-timeline");
    }
  }

  // Rdeča vrstica in drsnik
  if (progressBar) {
    if (isWindowMode) {
      const leftClamped = Math.max(0, Math.min(100, startPct));
      const rightClamped = Math.max(0, Math.min(100, currentPct));
      progressBar.style.left = `${leftClamped.toFixed(2)}%`;
      progressBar.style.width = `${Math.max(0, rightClamped - leftClamped).toFixed(2)}%`;
    } else {
      progressBar.style.left = "0%";
      progressBar.style.width = `${Math.max(0, Math.min(100, currentPct)).toFixed(2)}%`;
    }
  }

  if (thumb) {
    if (currentPct >= -2 && currentPct <= 102) {
      thumb.style.display = "block";
      thumb.style.left = `${Math.max(0, Math.min(100, currentPct)).toFixed(2)}%`;
    } else {
      thumb.style.display = "none";
    }
  }

  updateTimelineVisualLayers();
  renderPathOnMap();
}

/* ==========================================================
   3b. VIZUALNE PLASTI ČASOVNICE: Ravnilo in zaznava gibanja
   ========================================================== */
let lastRenderedViewStart = null;
let lastRenderedViewEnd = null;
let lastRenderedWindowMode = null;

function updateTimelineVisualLayers() {
  if (viewStart === lastRenderedViewStart && viewEnd === lastRenderedViewEnd && isWindowMode === lastRenderedWindowMode) {
    return;
  }
  lastRenderedViewStart = viewStart;
  lastRenderedViewEnd = viewEnd;
  lastRenderedWindowMode = isWindowMode;
  renderMovementHighlights();
  renderTimelineRuler();
}

function computeMovementIntervals() {
  movementIntervals = [];
  if (!allPoints || allPoints.length < 2) return;

  const N = allPoints.length;
  const isMoving = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    const pi = allPoints[i];
    const maxT = pi.time_ms + movementWindowMs;
    for (let j = i + 1; j < N; j++) {
      const pj = allPoints[j];
      if (pj.time_ms > maxT) break;
      const d = haversineDistance(pi.lat, pi.lon, pj.lat, pj.lon);
      if (d >= movementDistM) {
        isMoving[i] = 1;
        break;
      }
    }
  }

  let inInterval = false;
  let intervalStart = 0;
  let intervalEnd = 0;

  for (let i = 0; i < N; i++) {
    if (isMoving[i]) {
      if (!inInterval) {
        inInterval = true;
        intervalStart = allPoints[i].time_ms;
      }
      intervalEnd = allPoints[i].time_ms;
    } else {
      if (inInterval) {
        inInterval = false;
        movementIntervals.push({ start: intervalStart, end: intervalEnd });
      }
    }
  }
  if (inInterval) {
    movementIntervals.push({ start: intervalStart, end: intervalEnd });
  }

  // Združi sosednje intervale z razmikom pod 60 sekund
  if (movementIntervals.length > 1) {
    const merged = [];
    let cur = movementIntervals[0];
    for (let k = 1; k < movementIntervals.length; k++) {
      const next = movementIntervals[k];
      if (next.start - cur.end <= 60000) {
        cur.end = Math.max(cur.end, next.end);
      } else {
        merged.push(cur);
        cur = next;
      }
    }
    merged.push(cur);
    movementIntervals = merged;
  }
}

/**
 * Magnetno privlačenje (snapping) za OD in DO markerje na robove intervalov gibanja.
 * @param {number} candidateT - Surovi čas (ms), ki ga določa položaj miške
 * @param {'start'|'end'} handleType - 'start' za levi OD marker, 'end' za desni DO marker
 * @param {number} trackWidthPx - Širina časovnice v pikslih na zaslonu
 * @param {number} viewDurationMs - Trajanje trenutno prikazanega časovnega okna (ms)
 * @returns {number} Čas po morebitnem privlačenju
 */
function snapHandleTime(candidateT, handleType, trackWidthPx, viewDurationMs) {
  if (snapDistancePx <= 0 || !movementIntervals || movementIntervals.length === 0) {
    return candidateT;
  }
  if (!trackWidthPx || trackWidthPx <= 0 || !viewDurationMs || viewDurationMs <= 0) {
    return candidateT;
  }

  let bestTarget = candidateT;
  let minDiffPx = Infinity;

  for (let i = 0; i < movementIntervals.length; i++) {
    const seg = movementIntervals[i];
    // OD marker se privlači na začetke intervalov premikanja (seg.start)
    // DO marker se privlači na konce intervalov premikanja (seg.end)
    const targetT = (handleType === 'start') ? seg.start : seg.end;
    const diffMs = Math.abs(candidateT - targetT);
    const diffPx = (diffMs / viewDurationMs) * trackWidthPx;

    if (diffPx <= snapDistancePx && diffPx < minDiffPx) {
      minDiffPx = diffPx;
      bestTarget = targetT;
    }
  }

  return bestTarget;
}

function renderMovementHighlights() {
  const layer = document.getElementById("movementHighlightLayer");
  if (!layer) return;

  // Prikaži le v okenskem načinu (Alt+Scroll z modrima markerjema OD in DO)
  if (!isWindowMode || !showMovementIntervals || movementIntervals.length === 0 || viewStart >= viewEnd) {
    layer.style.display = "none";
    layer.innerHTML = "";
    return;
  }

  layer.style.display = "block";
  const duration = Math.max(1000, viewEnd - viewStart);

  let html = "";
  for (let i = 0; i < movementIntervals.length; i++) {
    const seg = movementIntervals[i];
    if (seg.end < viewStart || seg.start > viewEnd) continue;

    const cStart = Math.max(viewStart, seg.start);
    const cEnd = Math.min(viewEnd, seg.end);

    const leftPct = ((cStart - viewStart) / duration) * 100;
    const rightPct = ((cEnd - viewStart) / duration) * 100;
    const widthPct = Math.max(0.1, rightPct - leftPct);

    html += `<div class="movement-segment" style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;"></div>`;
  }

  layer.innerHTML = html;
}

function renderTimelineRuler() {
  const rulerEl = document.getElementById("timelineRuler");
  if (!rulerEl) return;

  // Prikaži le v okenskem načinu (Alt+Scroll z modrima markerjema OD in DO)
  if (!isWindowMode || allPoints.length === 0 || viewStart >= viewEnd) {
    rulerEl.style.display = "none";
    rulerEl.innerHTML = "";
    return;
  }

  rulerEl.style.display = "block";
  const duration = Math.max(1000, viewEnd - viewStart);
  const durationMin = duration / 60000;
  const durationHours = duration / (3600 * 1000);

  let html = "";

  // 1. Dnevi (polnoči 00:00:00)
  const startDate = new Date(viewStart);
  startDate.setHours(0, 0, 0, 0);
  let dayCursor = startDate.getTime();

  while (dayCursor <= viewEnd + 86400000) {
    if (dayCursor >= viewStart && dayCursor <= viewEnd) {
      const pct = ((dayCursor - viewStart) / duration) * 100;
      const dObj = new Date(dayCursor);
      const dayLabel = `${dObj.getDate()}. ${dObj.getMonth() + 1}.`;
      html += `<div class="ruler-tick day" style="left: ${pct.toFixed(2)}%;"></div>`;
      html += `<div class="ruler-label day-label" style="left: ${pct.toFixed(2)}%;">${dayLabel}</div>`;
    }
    dayCursor += 86400000;
  }

  // 2. Ure in minute glede na raven zoomiranja
  if (durationHours > 120) {
    // Več kot 5 dni: samo dnevi
  } else if (durationHours > 36) {
    // 1.5 do 5 dni: ure na vsakih 6 ur
    stepThroughHours(6, false);
  } else if (durationHours > 12) {
    // 12 do 36 ur: ure na vsaki 2 uri
    stepThroughHours(2, true);
  } else if (durationHours > 3) {
    // 3 do 12 ur: vsaka ura z napisom
    stepThroughHours(1, true);
  } else if (durationMin > 30) {
    // 30 min do 3 ure: vsaka ura z napisom, črtice na 15 minut
    stepThroughHours(1, true);
    stepThroughMinutes(15, false);
  } else if (durationMin > 8) {
    // 8 do 30 min (privzeto 16.6 min = 1000 s): ure z napisom, črtice na 2 minuti
    stepThroughHours(1, true);
    stepThroughMinutes(2, true);
  } else {
    // Pod 8 minut: vsaka minuta z napisom
    stepThroughMinutes(1, true);
  }

  function stepThroughHours(stepH, showLabels) {
    const d = new Date(viewStart);
    d.setMinutes(0, 0, 0);
    let cursor = d.getTime();
    if (cursor < viewStart) cursor += 3600000;

    while (cursor <= viewEnd) {
      const hObj = new Date(cursor);
      const h = hObj.getHours();
      if (h % stepH === 0 && h !== 0) {
        const pct = ((cursor - viewStart) / duration) * 100;
        html += `<div class="ruler-tick hour" style="left: ${pct.toFixed(2)}%;"></div>`;
        if (showLabels) {
          const hStr = `${String(h).padStart(2, "0")}:00`;
          html += `<div class="ruler-label" style="left: ${pct.toFixed(2)}%;">${hStr}</div>`;
        }
      }
      cursor += 3600000;
    }
  }

  function stepThroughMinutes(stepM, showLabels) {
    const d = new Date(viewStart);
    d.setSeconds(0, 0, 0);
    let cursor = d.getTime();
    const rem = Math.floor(cursor / 60000) % stepM;
    if (rem !== 0) cursor += (stepM - rem) * 60000;
    if (cursor < viewStart) cursor += stepM * 60000;

    while (cursor <= viewEnd) {
      const mObj = new Date(cursor);
      const min = mObj.getMinutes();
      if (min % 60 !== 0) { // Ne riši čez polne ure
        const pct = ((cursor - viewStart) / duration) * 100;
        html += `<div class="ruler-tick minor" style="left: ${pct.toFixed(2)}%;"></div>`;
        if (showLabels && min % (stepM * 2) === 0) {
          const h = mObj.getHours();
          const str = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
          html += `<div class="ruler-label" style="left: ${pct.toFixed(2)}%; font-size: 8px;">${str}</div>`;
        }
      }
      cursor += stepM * 60000;
    }
  }

  rulerEl.innerHTML = html;
}

function renderPathOnMap() {
  if (allPoints.length === 0) {
    activePolyline.setLatLngs([]);
    futurePolyline.setLatLngs([]);
    return;
  }

  // V okenskem načinu (Alt+Scroll) se vedno prikaže celotna pot okna (za q = 1, torej do tEnd)
  const effectiveTime = isWindowMode ? tEnd : currentTime;

  const rawActive = [];
  const rawFuture = [];

  for (let i = 0; i < allPoints.length; i++) {
    const p = allPoints[i];
    const t = p.time_ms;

    if (t >= tStart && t <= effectiveTime) {
      rawActive.push(p);
    } else if (!isWindowMode && showFuturePath && t > effectiveTime && t <= tEnd) {
      rawFuture.push(p);
    }
  }

  // Pametno enakomerno vzorčenje (downsampling) za 60 FPS realtime izris pri velikem številu točk
  const sampledActive = downsamplePoints(rawActive, maxRenderPoints);
  const activeLatLngs = sampledActive.map(p => [p.lat, p.lon]);

  activePolyline.setStyle({
    weight: trajectoryWeight,
    color: isWindowMode ? "#00b0ff" : "#00e5ff",
    smoothFactor: 0
  });
  activePolyline.setLatLngs(activeLatLngs);

  if (!isWindowMode && showFuturePath && rawFuture.length > 0) {
    const sampledFuture = downsamplePoints(rawFuture, Math.min(1000, maxRenderPoints));
    futurePolyline.setStyle({
      opacity: 0.35,
      weight: Math.max(2, trajectoryWeight - 2),
      smoothFactor: 0
    });
    futurePolyline.setLatLngs(sampledFuture.map(p => [p.lat, p.lon]));
  } else {
    futurePolyline.setLatLngs([]);
  }

  if (isWindowMode) {
    // V okenskem načinu (zoom / scroll / prilagajanje OD in DO):
    // Modra pika za trenutni čas izgine
    currentMarker.setOpacity(0);

    // Prikazujeta se 2 piki: ena v času OD, druga v času DO
    const startPoint = getPointAtTime(tStart);
    const endPoint = getPointAtTime(tEnd);

    if (startPoint) {
      startMarker.setLatLng([startPoint.lat, startPoint.lon]);
      startMarker.setOpacity(1);
    } else {
      startMarker.setOpacity(0);
    }

    if (endPoint) {
      endMarker.setLatLng([endPoint.lat, endPoint.lon]);
      endMarker.setOpacity(1);
      updateHud(endPoint);
    } else if (startPoint) {
      endMarker.setOpacity(0);
      updateHud(startPoint);
    } else {
      endMarker.setOpacity(0);
    }
  } else {
    // V navadnem načinu predvajanja (ko sta OD in DO rdeče obarvana):
    // Skrij piki OD in DO
    startMarker.setOpacity(0);
    endMarker.setOpacity(0);

    // Prikazi modro piko za trenutno lokacijo predvajalnika (currentTime)
    let latestActivePoint = null;
    if (rawActive.length > 0) {
      latestActivePoint = rawActive[rawActive.length - 1];
    }

    if (latestActivePoint) {
      currentMarker.setLatLng([latestActivePoint.lat, latestActivePoint.lon]);
      currentMarker.setOpacity(1);
      updateHud(latestActivePoint);

      // Sledenje točki (Follow mode)
      if (isFollowMode) {
        map.panTo([latestActivePoint.lat, latestActivePoint.lon], { animate: false });
      }

      // Orientacija v smeri gibanja (Heading mode)
      if (isHeadingMode) {
        updateMapHeading(latestActivePoint);
      }
    } else if (activeLatLngs.length > 0) {
      currentMarker.setLatLng(activeLatLngs[0]);
      currentMarker.setOpacity(1);
    } else {
      currentMarker.setOpacity(0);
    }
  }
}

function updateHud(p) {
  document.getElementById("hudTime").textContent = formatTimeOnly(p.time_ms);
  document.getElementById("hudCoords").textContent = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
  const kmh = ((p.spd || 0) * 3.6).toFixed(1);
  document.getElementById("hudSpeed").textContent = `${kmh} km/h`;
  document.getElementById("hudAlt").textContent = `${Math.round(p.alt || 0)} m`;
  document.getElementById("hudAcc").textContent = `±${(p.acc || 0).toFixed(1)} m`;
}

/* ==========================================================
   4. ORIENTACIJA ZEMLJEVIDA (Heading) Z ZADUŠITVIJO ŠUMA
   ========================================================== */
function updateMapHeading(p) {
  if (lastHeadingLat === null || lastHeadingLon === null) {
    lastHeadingLat = p.lat;
    lastHeadingLon = p.lon;
    return;
  }

  // Izračunaj razdaljo med zadnjo referenco in trenutno točko v metrih
  const dMeters = haversineDistance(lastHeadingLat, lastHeadingLon, p.lat, p.lon);
  const spd = p.spd || 0; // m/s

  // ŠUM: če je telefon pri miru (hitrost < 0.7 m/s ali premik < 3.5m), NE obračaj pogleda!
  if (dMeters < 3.5 || spd < 0.7) {
    return;
  }

  // Izračunaj azimut (bearing)
  const dLon = (p.lon - lastHeadingLon) * (Math.PI / 180);
  const lat1 = lastHeadingLat * (Math.PI / 180);
  const lat2 = p.lat * (Math.PI / 180);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let targetAngle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  // Zglajevanje kota (shortest angular delta)
  let diff = ((targetAngle - currentHeadingAngle + 540) % 360) - 180;
  currentHeadingAngle += diff * 0.25;
  currentHeadingAngle = (currentHeadingAngle + 360) % 360;

  // Rotiraj zemljevid z CSS transform
  const mapEl = document.getElementById("map");
  mapEl.style.transform = `rotate(${-currentHeadingAngle}deg)`;

  lastHeadingLat = p.lat;
  lastHeadingLon = p.lon;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/* ==========================================================
/* ==========================================================
   5. INTERAKCIJA Z DRASNIKOM: Klik & Vlečenje
   ========================================================== */
function setupScrubberEvents() {
  const trackWrapper = document.getElementById("scrubberWrapper");
  const track = document.getElementById("scrubberTrack");
  const ghost = document.getElementById("scrubberGhost");
  const bubble = document.getElementById("scrubberBubble");
  const leftHandle = document.getElementById("leftHandle");
  const rightHandle = document.getElementById("rightHandle");
  const centerBar = document.getElementById("windowCenterBar");

  let handleDownTime = 0;
  let handleDownX = 0;
  let handleDownY = 0;
  let handleDragged = false;

  // Vlečenje levega markerja OD
  if (leftHandle) {
    leftHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      dragMode = 'leftHandle';
      dragStartX = e.clientX;
      handleDownTime = performance.now();
      handleDownX = e.clientX;
      handleDownY = e.clientY;
      handleDragged = false;
      dragInitialTStart = tStart;
      dragInitialTEnd = tEnd;
      didDragMove = false;
    });

    leftHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  }

  // Vlečenje desnega markerja DO
  if (rightHandle) {
    rightHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      dragMode = 'rightHandle';
      dragStartX = e.clientX;
      handleDownTime = performance.now();
      handleDownX = e.clientX;
      handleDownY = e.clientY;
      handleDragged = false;
      dragInitialTStart = tStart;
      dragInitialTEnd = tEnd;
      didDragMove = false;
    });

    rightHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  }

  // Vlečenje osrednjega traku med markerjema
  if (centerBar) {
    centerBar.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragMode = 'centerBar';
      dragStartX = e.clientX;
      dragInitialTStart = tStart;
      dragInitialTEnd = tEnd;
      didDragMove = false;
    });

    // Dvoklik na izbrano območje avtomatsko razširi prikazano časovnico čez celotno okno (kot na YouTubu)
    centerBar.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (isWindowMode) {
        viewStart = tStart;
        viewEnd = tEnd;
        updateScrubberPosition();
        flashCenterIndicator(t("toast_full_width"));
      } else {
        viewStart = globalTMin;
        viewEnd = globalTMax;
        updateScrubberPosition();
        flashCenterIndicator(t("toast_all_points"));
      }
    });
  }

  // Klik na prazen del časovnice
  trackWrapper.addEventListener("mousedown", (e) => {
    if (e.target.closest(".window-handle") || e.target.closest(".window-bar")) return;
    dragMode = 'scrubber';
    didDragMove = false;
    onScrubberClickOrMove(e);
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragMode) return;
    const rect = track.getBoundingClientRect();
    const viewDuration = Math.max(1000, viewEnd - viewStart);

    if (Math.abs(e.clientX - handleDownX) > 2 || Math.abs(e.clientY - handleDownY) > 2) {
      handleDragged = true;
      didDragMove = true;
    }

    if (dragMode === 'leftHandle') {
      const dt = ((e.clientX - dragStartX) / rect.width) * viewDuration;
      const rawT = dragInitialTStart + dt;
      const snappedT = snapHandleTime(rawT, 'start', rect.width, viewDuration);
      tStart = Math.round(Math.max(globalTMin, Math.min(tEnd - 1000, snappedT)));
      updateScrubberPosition();
    } else if (dragMode === 'rightHandle') {
      const dt = ((e.clientX - dragStartX) / rect.width) * viewDuration;
      const rawT = dragInitialTEnd + dt;
      const snappedT = snapHandleTime(rawT, 'end', rect.width, viewDuration);
      tEnd = Math.round(Math.min(globalTMax, Math.max(tStart + 1000, snappedT)));
      updateScrubberPosition();
    } else if (dragMode === 'centerBar') {
      const dt = ((e.clientX - dragStartX) / rect.width) * viewDuration;
      const dur = dragInitialTEnd - dragInitialTStart;
      let s = dragInitialTStart + dt;
      let en = s + dur;
      if (s < globalTMin) { s = globalTMin; en = s + dur; }
      if (en > globalTMax) { en = globalTMax; s = en - dur; }
      tStart = Math.round(s);
      tEnd = Math.round(en);
      updateScrubberPosition();
    } else if (dragMode === 'scrubber') {
      onScrubberClickOrMove(e);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (dragMode === 'leftHandle') {
      const elapsed = performance.now() - handleDownTime;
      const moved = handleDragged || Math.abs(e.clientX - handleDownX) > 2;
      if (!moved && elapsed < 500) {
        openTimePicker('start');
      }
    } else if (dragMode === 'rightHandle') {
      const elapsed = performance.now() - handleDownTime;
      const moved = handleDragged || Math.abs(e.clientX - handleDownX) > 2;
      if (!moved && elapsed < 500) {
        openTimePicker('end');
      }
    }
    dragMode = null;
    isDraggingScrubber = false;
  });

  trackWrapper.addEventListener("mousemove", (e) => {
    if (dragMode) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    ghost.style.left = `${(ratio * 100).toFixed(2)}%`;
    ghost.style.display = "block";

    const viewDuration = Math.max(1000, viewEnd - viewStart);
    const hoverTime = viewStart + ratio * viewDuration;
    bubble.textContent = formatTimeOnly(hoverTime);
    bubble.style.left = `${(ratio * 100).toFixed(2)}%`;
    bubble.style.display = "block";
  });

  trackWrapper.addEventListener("mouseleave", () => {
    ghost.style.display = "none";
    bubble.style.display = "none";
  });

  function onScrubberClickOrMove(e) {
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const viewDuration = Math.max(1000, viewEnd - viewStart);
    const clickedTime = viewStart + ratio * viewDuration;

    const windowDuration = Math.max(1000, tEnd - tStart);
    currentQ = Math.max(0, Math.min(1, (clickedTime - tStart) / windowDuration));
    updateScrubberPosition();
  }
}

/* ==========================================================
   6. ALT + SCROLL ČASOVNICE IN ROČICE (Window Mode)
   ========================================================== */
function formatDuration(ms) {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs} h ${mins} min ${secs} s`;
  }
  if (mins > 0) {
    return `${mins} min ${secs} s`;
  }
  return `${secs} s`;
}

function setupTimelineZoomAndPan() {
  const timeline = document.getElementById("timelineContainer");

  // Poslušalec na celotni časovnici za kolesce miške
  timeline.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (allPoints.length === 0) return;

    const track = document.getElementById("scrubberTrack");
    const rect = track.getBoundingClientRect();
    const cursorFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    // Če drži Alt ali Ctrl: ZOOM (povečaj / pomanjšaj časovno okno)
    if (e.altKey || e.ctrlKey) {
      handleTimelineZoom(e.deltaY, cursorFraction);
    } else {
      // Brez Alt: PAN (premik časovnega okna levo-desno)
      handleTimelinePan(e.deltaY);
    }
  }, { passive: false });
}

function handleTimelineZoom(deltaY, cursorFraction) {
  if (allPoints.length === 0) return;

  // Wheel UP (deltaY < 0) = ZOOM IN (povečaj / približaj časovno os)
  // Wheel DOWN (deltaY > 0) = ZOOM OUT (pomanjšaj / oddalji časovno os)
  const zoomIn = deltaY < 0;
  const globalDuration = Math.max(1000, globalTMax - globalTMin);
  const currentDuration = Math.max(1000, viewEnd - viewStart);
  const cursorTime = viewStart + cursorFraction * currentDuration;

  if (zoomIn) {
    // Zoom in: zoži prikazano časovno os viewStart ... viewEnd okoli kazalca
    const newDuration = Math.max(2000, currentDuration * 0.75);
    let rel = (cursorTime - viewStart) / currentDuration;
    rel = Math.max(0, Math.min(1, rel));

    let newStart = cursorTime - rel * newDuration;
    let newEnd = newStart + newDuration;

    if (newStart < globalTMin) {
      newStart = globalTMin;
      newEnd = Math.min(globalTMax, newStart + newDuration);
    }
    if (newEnd > globalTMax) {
      newEnd = globalTMax;
      newStart = Math.max(globalTMin, newEnd - newDuration);
    }

    viewStart = Math.round(newStart);
    viewEnd = Math.round(newEnd);

    updateScrubberPosition();
    flashCenterIndicator(`${t("display_range")} ${formatDuration(viewEnd - viewStart)}`);
  } else {
    // Zoom out: razširi prikazano časovno os viewStart ... viewEnd okoli kazalca
    // Meja: ne pomanjšuj onkraj celotnega območja meritev [globalTMin, globalTMax]!
    if (viewStart <= globalTMin && viewEnd >= globalTMax) {
      viewStart = globalTMin;
      viewEnd = globalTMax;
      updateScrubberPosition();
      flashCenterIndicator(t("toast_full_width"));
      return;
    }

    const newDuration = Math.min(globalDuration, currentDuration * 1.333333);
    if (newDuration >= globalDuration * 0.99) {
      viewStart = globalTMin;
      viewEnd = globalTMax;
      updateScrubberPosition();
      flashCenterIndicator(t("toast_full_width"));
      return;
    }

    let rel = (cursorTime - viewStart) / currentDuration;
    rel = Math.max(0, Math.min(1, rel));

    let newStart = cursorTime - rel * newDuration;
    let newEnd = newStart + newDuration;

    if (newStart < globalTMin) {
      newStart = globalTMin;
      newEnd = Math.min(globalTMax, newStart + newDuration);
    }
    if (newEnd > globalTMax) {
      newEnd = globalTMax;
      newStart = Math.max(globalTMin, newEnd - newDuration);
    }

    viewStart = Math.round(newStart);
    viewEnd = Math.round(newEnd);

    updateScrubberPosition();
    flashCenterIndicator(`${t("display_range")} ${formatDuration(viewEnd - viewStart)}`);
  }
}

function handleTimelinePan(deltaY) {
  if (allPoints.length === 0) return;

  const currentDuration = viewEnd - viewStart;
  const globalDuration = Math.max(1000, globalTMax - globalTMin);

  // Če je že celotna širina meritev na ekranu, ni mogoče translirati
  if (viewStart <= globalTMin && viewEnd >= globalTMax) {
    return;
  }

  // deltaY > 0 = scroll navzdol (premik naprej v času / desno)
  // deltaY < 0 = scroll navzgor (premik nazaj v času / levo)
  const step = Math.max(1000, Math.round(currentDuration * 0.08)) * (deltaY > 0 ? 1 : -1);

  let newStart = viewStart + step;
  let newEnd = viewEnd + step;

  // Če prideš do prve ali zadnje meritve, od tam ne scrolla več naprej
  if (newStart < globalTMin) {
    newStart = globalTMin;
    newEnd = newStart + currentDuration;
  }
  if (newEnd > globalTMax) {
    newEnd = globalTMax;
    newStart = newEnd - currentDuration;
  }

  viewStart = Math.round(newStart);
  viewEnd = Math.round(newEnd);

  updateScrubberPosition();
  flashCenterIndicator(`${t("time_axis")} ${formatTimeOnly(viewStart)} - ${formatTimeOnly(viewEnd)}`);
}

/* ==========================================================
   7. PREDVAJANJE (PLAY / PAUSE) IN HITROST (S / D)
   ========================================================== */
function togglePlayPause() {
  if (isPlaying) {
    pause();
    flashCenterIndicator(t("toast_pause"));
  } else {
    play();
    flashCenterIndicator(`${t("toast_play")} ${playSpeed}x`);
  }
}

function play() {
  if (allPoints.length === 0) return;
  if (currentQ >= 1.0) currentQ = 0.0;

  isPlaying = true;
  lastPlayTimestamp = performance.now();
  playAnimFrame = requestAnimationFrame(playLoop);
}

function pause() {
  isPlaying = false;
  if (playAnimFrame) cancelAnimationFrame(playAnimFrame);
  playAnimFrame = null;
}

function playLoop(now) {
  if (!isPlaying) return;

  const dtRealMs = now - (lastPlayTimestamp || now);
  lastPlayTimestamp = now;

  const totalDuration = tEnd - tStart;
  if (totalDuration > 0) {
    const advanceMs = dtRealMs * playSpeed;
    const advanceQ = advanceMs / totalDuration;
    currentQ += advanceQ;

    if (currentQ >= 1.0) {
      currentQ = 1.0;
      pause();
      flashCenterIndicator(t("toast_end_of_track"));
    }
    updateScrubberPosition();
  }

  if (isPlaying) {
    playAnimFrame = requestAnimationFrame(playLoop);
  }
}

function changeSpeed(step) {
  speedIndex = Math.max(0, Math.min(speedLevels.length - 1, speedIndex + step));
  playSpeed = speedLevels[speedIndex];
  flashCenterIndicator(`${t("toast_speed")} ${playSpeed}x`);
}

function flashCenterIndicator(text) {
  const el = document.getElementById("centerIndicator");
  el.textContent = text;
  el.style.display = "block";
  if (centerIndicatorTimeout) clearTimeout(centerIndicatorTimeout);
  centerIndicatorTimeout = setTimeout(() => {
    el.style.display = "none";
  }, 1000);
}

/* ==========================================================
   8. POPUP MENI ZA NASTAVITEV ČASA (Črn dizajn)
   ========================================================== */
function openTimePicker(target) {
  activePickerTarget = target;
  const popup = document.getElementById("timePickerPopup");
  const title = document.getElementById("pickerModalTitle");

  title.textContent = target === "start" ? t("picker_title_start") : t("picker_title_end");

  const currentValMs = target === "start" ? tStart : tEnd;
  const dateObj = new Date(currentValMs || Date.now());

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const dateInput = document.getElementById("pickerDateInput");
  dateInput.value = `${yyyy}-${mm}-${dd}`;

  if (globalTMin && globalTMax) {
    dateInput.min = formatInputDate(globalTMin);
    dateInput.max = formatInputDate(globalTMax);

    const hintEl = document.getElementById("pickerDateHint");
    if (hintEl) {
      const minD = new Date(globalTMin);
      const maxD = new Date(globalTMax);
      const minStr = `${minD.getDate()}. ${minD.getMonth() + 1}. ${minD.getFullYear()}`;
      const maxStr = `${maxD.getDate()}. ${maxD.getMonth() + 1}. ${maxD.getFullYear()}`;
      hintEl.textContent = currentLang === "sl"
        ? `📅 Na voljo meritve: ${minStr} – ${maxStr}`
        : `📅 Available records: ${minStr} – ${maxStr}`;
    }
  }

  document.getElementById("pickerHour").value = dateObj.getHours();
  document.getElementById("pickerMinute").value = dateObj.getMinutes();
  document.getElementById("pickerSecond").value = dateObj.getSeconds();

  const handle = target === "start" ? document.getElementById("leftHandle") : document.getElementById("rightHandle");
  if (handle) {
    const rect = handle.getBoundingClientRect();
    if (target === "start") {
      popup.style.left = `${Math.max(10, Math.min(window.innerWidth - 330, rect.left - 20))}px`;
      popup.style.right = "auto";
    } else {
      popup.style.left = `${Math.max(10, Math.min(window.innerWidth - 330, rect.right - 300))}px`;
      popup.style.right = "auto";
    }
  } else {
    if (target === "start") {
      popup.style.left = "10px";
      popup.style.right = "auto";
    } else {
      popup.style.right = "10px";
      popup.style.left = "auto";
    }
  }

  popup.style.display = "block";
  const timeline = document.getElementById("timelineContainer");
  if (timeline) timeline.classList.remove("auto-hidden");
}

function closeTimePicker() {
  document.getElementById("timePickerPopup").style.display = "none";
  activePickerTarget = null;
}

function applyTimePicker() {
  const dateStr = document.getElementById("pickerDateInput").value;
  const h = parseInt(document.getElementById("pickerHour").value, 10) || 0;
  const m = parseInt(document.getElementById("pickerMinute").value, 10) || 0;
  const s = parseInt(document.getElementById("pickerSecond").value, 10) || 0;

  if (!dateStr) {
    flashCenterIndicator(t("toast_invalid_date"));
    return;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const newDate = new Date(year, month - 1, day, h, m, s, 0);
  let newMs = newDate.getTime();

  if (isNaN(newMs)) {
    flashCenterIndicator(t("toast_invalid_date"));
    return;
  }

  if (globalTMin && newMs < globalTMin) newMs = globalTMin;
  if (globalTMax && newMs > globalTMax) newMs = globalTMax;

  if (activePickerTarget === "start") {
    if (newMs >= tEnd) {
      flashCenterIndicator(t("toast_time_order_err_start"));
      return;
    }
    tStart = newMs;
  } else {
    if (newMs <= tStart) {
      flashCenterIndicator(t("toast_time_order_err_end"));
      return;
    }
    tEnd = newMs;
  }

  // Zagotovi, da se časovna os prilagodi izbranemu oknu, če je izbrano okno zunaj trenutnega pogleda
  const pickedDur = Math.max(60000, tEnd - tStart);
  if (tStart < viewStart || tEnd > viewEnd) {
    const pad = Math.round(pickedDur * 0.1);
    viewStart = Math.max(globalTMin, tStart - pad);
    viewEnd = Math.min(globalTMax, tEnd + pad);
  }
  if (viewStart < globalTMin) viewStart = globalTMin;
  if (viewEnd > globalTMax) viewEnd = globalTMax;

  updateScrubberPosition();
  closeTimePicker();
  flashCenterIndicator(t("toast_time_updated"));
}

function resetTimePicker() {
  if (activePickerTarget === "start") {
    tStart = globalTMin;
    viewStart = globalTMin;
  } else {
    tEnd = globalTMax;
    viewEnd = globalTMax;
  }
  updateScrubberPosition();
  closeTimePicker();
  flashCenterIndicator(t("toast_time_reset"));
}

/* ==========================================================
   9. BLIŽINSKI HOVER IN DVOKLIK ZA KOPIRANJE KOORDINAT
   ========================================================== */
function onMapMouseMove(e) {
  if (allPoints.length === 0) return;

  const mousePoint = e.containerPoint;
  let closest = null;
  let minDistPx = 30;

  // Če je črtkana prihodnja sled izklopljena, upoštevamo točke le do trenutnega predvajanega časa
  const effectiveMaxTime = (isWindowMode || showFuturePath) ? tEnd : currentTime;

  for (let i = 0; i < allPoints.length; i++) {
    const p = allPoints[i];
    if (p.time_ms < tStart || p.time_ms > effectiveMaxTime) continue;

    const layerPoint = map.latLngToContainerPoint([p.lat, p.lon]);
    const distPx = mousePoint.distanceTo(layerPoint);

    if (distPx < minDistPx) {
      minDistPx = distPx;
      closest = p;
    }
  }

  const tooltip = document.getElementById("proximityTooltip");
  if (closest) {
    proximityMarker.setLatLng([closest.lat, closest.lon]);
    proximityMarker.setOpacity(1);

    tooltip.style.left = `${mousePoint.x}px`;
    tooltip.style.top = `${mousePoint.y}px`;
    tooltip.style.display = "block";

    document.getElementById("tipTime").textContent = `🕒 ${formatDateTime(closest.time_ms)}`;
    document.getElementById("tipCoords").textContent = `φ: ${closest.lat.toFixed(7)}, λ: ${closest.lon.toFixed(7)}`;
    const kmh = ((closest.spd || 0) * 3.6).toFixed(1);
    document.getElementById("tipStats").textContent = `Alt: ${Math.round(closest.alt || 0)}m | ${kmh} km/h | ±${(closest.acc || 0).toFixed(1)}m`;
  } else {
    proximityMarker.setOpacity(0);
    tooltip.style.display = "none";
  }
}

function onMapDoubleClick(e) {
  if (allPoints.length === 0) return;

  const mousePoint = e.containerPoint;
  let closest = null;
  let minDistPx = 40;
  const effectiveMaxTime = (isWindowMode || showFuturePath) ? tEnd : currentTime;

  for (let i = 0; i < allPoints.length; i++) {
    const p = allPoints[i];
    if (p.time_ms < tStart || p.time_ms > effectiveMaxTime) continue;

    const layerPoint = map.latLngToContainerPoint([p.lat, p.lon]);
    const distPx = mousePoint.distanceTo(layerPoint);
    if (distPx < minDistPx) {
      minDistPx = distPx;
      closest = p;
    }
  }

  if (closest) {
    openCopyModal(closest);
  }
}

function openCopyModal(p) {
  selectedPointForCopy = p;
  const modal = document.getElementById("copyModal");

  const isoTime = p.time_utc || new Date(p.time_ms).toISOString();
  document.getElementById("copyValTime").textContent = `${isoTime}`;
  document.getElementById("copyValLat").textContent = p.lat.toFixed(8);
  document.getElementById("copyValLon").textContent = p.lon.toFixed(8);
  const kmh = ((p.spd || 0) * 3.6).toFixed(1);
  document.getElementById("copyValAltSpd").textContent = `${Math.round(p.alt || 0)} m | ${kmh} km/h`;

  modal.style.display = "flex";
}

function closeCopyModal() {
  document.getElementById("copyModal").style.display = "none";
}

function copyToClipboard(text, message = "Skopirano v odložišče!") {
  navigator.clipboard.writeText(text).then(() => {
    flashCenterIndicator(message);
  }).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    flashCenterIndicator(message);
  });
}

/* ==========================================================
   10. POSLUŠALCI IN BLIŽNJICE NA TIPKOVNICI
   ========================================================== */
function setupEventListeners() {
  // Preklop jezika (SL / EN)
  const btnLangSl = document.getElementById("btnLangSl");
  if (btnLangSl) btnLangSl.addEventListener("click", () => setLanguage("sl"));
  const btnLangEn = document.getElementById("btnLangEn");
  if (btnLangEn) btnLangEn.addEventListener("click", () => setLanguage("en"));

  // Burger meni odpri/zapri
  const sideMenu = document.getElementById("sideMenu");
  document.getElementById("btnMenuToggle").addEventListener("click", () => {
    sideMenu.style.display = sideMenu.style.display === "none" ? "flex" : "none";
  });
  document.getElementById("btnCloseMenu").addEventListener("click", () => {
    sideMenu.style.display = "none";
  });

  // Sloji
  document.getElementById("layerSelect").addEventListener("change", (e) => {
    const selected = e.target.value;
    Object.keys(tileLayers).forEach(k => map.removeLayer(tileLayers[k]));
    if (tileLayers[selected]) tileLayers[selected].addTo(map);
  });

  document.getElementById("btnFitBounds").addEventListener("click", fitBoundsToTrack);

  // Sled (če je element prisoten)
  const trackSel = document.getElementById("trackSelect");
  if (trackSel) trackSel.addEventListener("change", (e) => loadTrackFile(e.target.value));
  const btnReload = document.getElementById("btnReloadTracks");
  if (btnReload) btnReload.addEventListener("click", loadTrackList);

  // Lokalna datoteka (če je element prisoten)
  const fileIn = document.getElementById("fileInput");
  if (fileIn) {
    fileIn.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          const points = [];
          for (const line of lines) {
            try { points.push(JSON.parse(line)); } catch (err) {}
          }
          setGpsPoints(points);
          flashCenterIndicator(`${t("toast_loaded")} ${points.length}`);
        } catch (err) {
          flashCenterIndicator("Napaka pri branju: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Načini sledenja gumbi v meniju
  const btnFollow = document.getElementById("btnToggleFollow");
  btnFollow.addEventListener("click", toggleFollowMode);

  const btnHeading = document.getElementById("btnToggleHeading");
  btnHeading.addEventListener("click", toggleHeadingMode);

  document.getElementById("btnClosePicker").addEventListener("click", closeTimePicker);
  document.getElementById("btnApplyPicker").addEventListener("click", applyTimePicker);
  document.getElementById("btnResetPicker").addEventListener("click", resetTimePicker);

  // Izvoz točk v CSV v burger meniju
  const btnExport = document.getElementById("btnExportCsv");
  if (btnExport) {
    btnExport.addEventListener("click", exportActiveRangeCsv);
  }

  // Drsnik za prosojnost časovnice v burger meniju
  const opacitySlider = document.getElementById("opacitySlider");
  const opacityValLabel = document.getElementById("opacityValLabel");
  if (opacitySlider) {
    opacitySlider.addEventListener("input", (e) => {
      const val = e.target.value;
      if (opacityValLabel) opacityValLabel.textContent = `${val}%`;
      const alpha = (val / 100).toFixed(2);
      document.documentElement.style.setProperty("--timeline-opacity", alpha);
      const container = document.getElementById("timelineContainer");
      if (container) {
        container.style.backgroundColor = `rgba(10, 10, 14, ${alpha})`;
      }
    });
  }

  // Nastavitve renderiranja v burger meniju
  const maxPointsSelect = document.getElementById("maxPointsSelect");
  if (maxPointsSelect) {
    maxPointsSelect.addEventListener("change", (e) => {
      maxRenderPoints = parseInt(e.target.value, 10);
      renderPathOnMap();
      flashCenterIndicator(maxRenderPoints > 0 ? `Omejitev: ${maxRenderPoints} točk` : "Prikaz: Vse točke");
    });
  }

  const trajThickness = document.getElementById("trajThickness");
  const trajThicknessLabel = document.getElementById("trajThicknessLabel");
  if (trajThickness) {
    trajThickness.addEventListener("input", (e) => {
      trajectoryWeight = parseFloat(e.target.value);
      if (trajThicknessLabel) trajThicknessLabel.textContent = `${trajectoryWeight} px`;
      updateVehicleIcon();
      renderPathOnMap();
    });
  }

  const chkShowFuture = document.getElementById("chkShowFuture");
  if (chkShowFuture) {
    chkShowFuture.addEventListener("change", (e) => {
      showFuturePath = e.target.checked;
      renderPathOnMap();
    });
  }

  // Nastavitve intervalov gibanja na časovnici
  const chkShowMovement = document.getElementById("chkShowMovement");
  if (chkShowMovement) {
    chkShowMovement.checked = showMovementIntervals;
    chkShowMovement.addEventListener("change", (e) => {
      showMovementIntervals = e.target.checked;
      renderMovementHighlights();
    });
  }

  const moveWindowInput = document.getElementById("moveWindowInput");
  if (moveWindowInput) {
    moveWindowInput.addEventListener("change", (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        movementWindowMs = val * 60 * 1000;
        computeMovementIntervals();
        renderMovementHighlights();
      }
    });
  }

  const moveDistInput = document.getElementById("moveDistInput");
  if (moveDistInput) {
    moveDistInput.addEventListener("change", (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        movementDistM = val;
        computeMovementIntervals();
        renderMovementHighlights();
      }
    });
  }

  const snapDistInput = document.getElementById("snapDistInput");
  if (snapDistInput) {
    snapDistInput.value = snapDistancePx;
    snapDistInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      snapDistancePx = isNaN(val) ? 0 : Math.max(0, val);
    });
  }

  // Zapri časovni popup ob kliku izven
  window.addEventListener("click", (e) => {
    const popup = document.getElementById("timePickerPopup");
    if (popup && popup.style.display !== "none") {
      const leftEl = document.getElementById("leftHandle");
      const rightEl = document.getElementById("rightHandle");
      if (!popup.contains(e.target) && (!leftEl || !leftEl.contains(e.target)) && (!rightEl || !rightEl.contains(e.target))) {
        closeTimePicker();
      }
    }
  });

  // Modal za kopiranje
  document.getElementById("btnCloseCopyModal").addEventListener("click", closeCopyModal);
  document.getElementById("copyModal").addEventListener("click", (e) => {
    if (e.target.id === "copyModal") closeCopyModal();
  });

  document.getElementById("btnCopyTriplet").addEventListener("click", () => {
    if (!selectedPointForCopy) return;
    const iso = selectedPointForCopy.time_utc || new Date(selectedPointForCopy.time_ms).toISOString();
    const str = `${iso}, ${selectedPointForCopy.lat.toFixed(8)}, ${selectedPointForCopy.lon.toFixed(8)}`;
    copyToClipboard(str, t("toast_triplet_copied"));
    closeCopyModal();
  });

  document.getElementById("btnCopyCoords").addEventListener("click", () => {
    if (!selectedPointForCopy) return;
    const str = `${selectedPointForCopy.lat.toFixed(8)}, ${selectedPointForCopy.lon.toFixed(8)}`;
    copyToClipboard(str, t("toast_coords_copied"));
    closeCopyModal();
  });

  document.getElementById("btnCopyJson").addEventListener("click", () => {
    if (!selectedPointForCopy) return;
    copyToClipboard(JSON.stringify(selectedPointForCopy, null, 2), t("toast_json_copied"));
    closeCopyModal();
  });

  // TIPKOVNICA BLIŽNJICE
  window.addEventListener("keydown", (e) => {
    // Escape za zapiranje popupov in menija
    if (e.key === "Escape") {
      closeTimePicker();
      closeCopyModal();
      const m = document.getElementById("sideMenu");
      if (m) m.style.display = "none";
      return;
    }

    // Ne prestrezaj, če uporabnik piše v polje za vnos
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    // Shift + Enter: Sledenje točki (Center mode)
    // Ctrl + Shift + Enter: Orientacija v smeri (Heading mode)
    if (e.key === "Enter") {
      if (e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        toggleHeadingMode();
        return;
      } else if (e.shiftKey) {
        e.preventDefault();
        toggleFollowMode();
        return;
      }
    }

    // Space: Play / Pause
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
      return;
    }

    // S: Upočasni
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      changeSpeed(-1);
      return;
    }

    // D: Pohitri
    if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      changeSpeed(1);
      return;
    }

    // M: Toggle meni
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      const m = document.getElementById("sideMenu");
      m.style.display = m.style.display === "none" ? "flex" : "none";
      return;
    }
  });

  setupScrubberEvents();
  setupTimelineZoomAndPan();
  setupAutoHideTimeline();
}

/* ==========================================================
   11. SAMODEJNO SKRIVANJE ČASOVNICE IN IZVOZ V CSV
   ========================================================== */
function setupAutoHideTimeline() {
  const timeline = document.getElementById("timelineContainer");
  const chkPin = document.getElementById("chkPinTimeline");

  if (chkPin) {
    chkPin.checked = isTimelinePinned;
    chkPin.addEventListener("change", (e) => {
      isTimelinePinned = e.target.checked;
      if (isTimelinePinned) {
        timeline.classList.remove("auto-hidden");
      } else {
        timeline.classList.add("auto-hidden");
      }
    });
  }

  // Privzeto skrij, če ni pripeta
  if (!isTimelinePinned) {
    timeline.classList.add("auto-hidden");
  }

  window.addEventListener("mousemove", (e) => {
    if (isTimelinePinned) {
      timeline.classList.remove("auto-hidden");
      return;
    }

    // Če uporabnik vleče drsnik ali marker, ali ima odprt časovni popup, časovnica mora ostati vidna
    const popup = document.getElementById("timePickerPopup");
    const isPickerOpen = popup && popup.style.display !== "none";
    if (dragMode !== null || isDraggingScrubber || isPickerOpen) {
      timeline.classList.remove("auto-hidden");
      return;
    }

    // Sproščena (nekliknjena) miška na dnu ekrana:
    // e.buttons === 0 pomeni, da nobena tipka na miški ni pritisnjena!
    const isNearBottom = e.clientY >= window.innerHeight - 35;
    if (isNearBottom && e.buttons === 0) {
      timeline.classList.remove("auto-hidden");
    } else {
      const rect = timeline.getBoundingClientRect();
      const isOverTimeline = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!isOverTimeline) {
        timeline.classList.add("auto-hidden");
      }
    }
  });

  timeline.addEventListener("mouseenter", () => {
    timeline.classList.remove("auto-hidden");
  });

  timeline.addEventListener("mouseleave", () => {
    if (!isTimelinePinned && dragMode === null && !isDraggingScrubber) {
      const popup = document.getElementById("timePickerPopup");
      if (!popup || popup.style.display === "none") {
        timeline.classList.add("auto-hidden");
      }
    }
  });
}

async function exportActiveRangeCsv() {
  if (allPoints.length === 0) {
    flashCenterIndicator(t("toast_no_export_pts"));
    return;
  }

  const exportPoints = allPoints.filter(p => p.time_ms >= tStart && p.time_ms <= tEnd);
  if (exportPoints.length === 0) {
    flashCenterIndicator(t("toast_no_range_pts"));
    return;
  }

  flashCenterIndicator(t("toast_exporting"));

  // Sestavi CSV z glavo in 4 stolpci: time_utc, latitude, longitude, altitude_m
  const rows = ["time_utc,latitude,longitude,altitude_m"];
  for (let i = 0; i < exportPoints.length; i++) {
    const p = exportPoints[i];
    const iso = p.time_utc || new Date(p.time_ms).toISOString();
    const alt = p.alt != null ? p.alt.toFixed(2) : "0.00";
    rows.push(`${iso},${p.lat.toFixed(8)},${p.lon.toFixed(8)},${alt}`);
  }
  const csvContent = rows.join("\r\n");

  const startStr = formatFileDate(tStart);
  const endStr = formatFileDate(tEnd);
  const connector = currentLang === "sl" ? "do" : "to";
  const defaultFilename = `gps_track_${startStr}_${connector}_${endStr}.csv`;

  // Odpri Windows File Explorer s showSaveFilePicker API-jem
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [{
          description: currentLang === "sl" ? "CSV preglednica (*.csv)" : "CSV spreadsheet (*.csv)",
          accept: { "text/csv": [".csv"] }
        }]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(csvContent);
      await writable.close();
      flashCenterIndicator(t("toast_exported"));
      return;
    } catch (err) {
      if (err.name === "AbortError") {
        return; // Uporabnik je preklical shranjevanje v raziskovalcu
      }
      console.warn("showSaveFilePicker napaka, preklapljam na prenos:", err);
    }
  }

  // Fallback prek prenosa z Blob povezavo
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  flashCenterIndicator(t("toast_exported"));
}

function formatFileDate(ms) {
  if (!ms) return "000000";
  const d = new Date(ms);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${Y}${M}${D}_${h}${m}${s}`;
}

function toggleFollowMode() {
  isFollowMode = !isFollowMode;
  const btn = document.getElementById("btnToggleFollow");
  if (isFollowMode) {
    btn.classList.add("active");
    btn.textContent = t("mode_active");
    flashCenterIndicator(`${t("toast_follow")} ${t("toast_enabled")}`);
  } else {
    btn.classList.remove("active");
    btn.textContent = t("mode_off");
    flashCenterIndicator(`${t("toast_follow")} ${t("toast_disabled")}`);
  }
}

function toggleHeadingMode() {
  isHeadingMode = !isHeadingMode;
  const btn = document.getElementById("btnToggleHeading");
  if (isHeadingMode) {
    // Avtomatsko vklopi tudi sledenje
    isFollowMode = true;
    document.getElementById("btnToggleFollow").classList.add("active");
    document.getElementById("btnToggleFollow").textContent = t("mode_active");

    btn.classList.add("active");
    btn.textContent = t("mode_active");
    lastHeadingLat = null;
    lastHeadingLon = null;
    flashCenterIndicator(`${t("toast_heading")} ${t("toast_enabled")}`);
  } else {
    btn.classList.remove("active");
    btn.textContent = t("mode_off");
    document.getElementById("map").style.transform = "none";
    flashCenterIndicator(`${t("toast_heading")} ${t("toast_disabled")}`);
  }
}

function formatDateTime(ms) {
  if (!ms || isNaN(ms)) return "--:--:--";
  const d = new Date(ms);
  const locale = currentLang === "en" ? "en-GB" : "sl-SI";
  const dateStr = d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${dateStr} ${timeStr}`;
}

function formatTimeOnly(ms) {
  if (!ms || isNaN(ms)) return "--:--:--";
  const d = new Date(ms);
  const locale = currentLang === "en" ? "en-GB" : "sl-SI";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatInputDate(ms) {
  if (!ms || isNaN(ms)) return "";
  const d = new Date(ms);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${Y}-${M}-${D}`;
}
