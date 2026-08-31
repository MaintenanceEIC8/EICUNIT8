/**
 * ==========================================================================
 * SYSTEM CONFIG — DCS TREND MONITORING SYSTEM
 * ==========================================================================
 * Konfigurasi global sistem. Ubah nilai di sini untuk menyesuaikan target
 * deployment tanpa harus menyentuh logic di file lain.
 * ==========================================================================
 */
window.DCS_CONFIG = {

  APP_NAME: 'DCS TREND MONITORING SYSTEM',
  APP_VERSION: '0.1.0-phase1',

  /* ------------------------------------------------------------------
   * DATA SOURCE — FIRESTORE (dipakai untuk HISTORICAL TREND)
   * Trend membaca collection `pm_records` LANGSUNG dari Firestore project
   * eic8-3d7f1 — project yang sama dipakai seluruh check sheet Instrument
   * (lihat ../firebase-config.js). Dulu Supabase (project
   * ruvvximnnacpvvoogbzs), sudah dimigrasikan penuh: lihat
   * js/historical-adapter.js.
   * ------------------------------------------------------------------ */
  HISTORICAL_SOURCE: {
    PROJECT: 'eic8-3d7f1',
    COLLECTION: 'pm_records',
    // Kolom yang dulu diminta saat fetch (referensi historis — Firestore
    // selalu mengembalikan dokumen penuh; `data` disimpan sebagai string
    // JSON lalu di-parse di historical-adapter.js).
    SELECT_COLUMNS: 'id,modul,tanggal,pic,work_order,unit,data,created_at,updated_at',
    // Batas dokumen per modul per fetch. Query sudah difilter prefix `modul`
    // di server, jadi ini cuma jaring pengaman — record PM sifatnya
    // event-based (jarang), praktis tak pernah mentok.
    FETCH_LIMIT: 3000
  },

  /* ------------------------------------------------------------------
   * MODE OPERASI DATA
   * live   : LiveTrendEngine + Simulator (lihat js/simulator.js) — DISABLED
   *          di Phase ini sesuai arahan: prioritas HISTORICAL dulu.
   * historical : HistoricalAdapter (read-only) dari Firestore pm_records — ACTIVE.
   * ------------------------------------------------------------------ */
  LIVE_TREND_ENABLED: false,
  HISTORICAL_TREND_ENABLED: true,

  /* ------------------------------------------------------------------
   * STORAGE
   * ------------------------------------------------------------------ */
  MAX_RECORDS_PER_TAG: 100000,
  LOCAL_STORAGE_PREFIX: 'dcsTrend_',

  /* ------------------------------------------------------------------
   * QUICK RANGE (Historical Trend)
   * Nilai dalam menit. "7D" dan seterusnya ditambahkan karena data PM/
   * kalibrasi sifatnya event-based (jarang per-menit), tapi preset asli
   * dari spec (5M..24H) tetap dipertahankan.
   * ------------------------------------------------------------------ */
  QUICK_RANGES: [
    { key: '5M',  label: '5M',  minutes: 5 },
    { key: '15M', label: '15M', minutes: 15 },
    { key: '30M', label: '30M', minutes: 30 },
    { key: '1H',  label: '1H',  minutes: 60 },
    { key: '4H',  label: '4H',  minutes: 240 },
    { key: '8H',  label: '8H',  minutes: 480 },
    { key: '12H', label: '12H', minutes: 720 },
    { key: '24H', label: '24H', minutes: 1440 },
    { key: '7D',  label: '7D',  minutes: 10080 },
    { key: '30D', label: '30D', minutes: 43200 },
    { key: '90D', label: '90D', minutes: 129600 },
    { key: '1Y',  label: '1 TAHUN', minutes: 525600 },
    { key: '2Y',  label: '2 TAHUN', minutes: 1051200 },
    { key: '3Y',  label: '3 TAHUN', minutes: 1576800 },
    { key: 'CUSTOM', label: 'CUSTOM', minutes: null }
  ],

  DEFAULT_QUICK_RANGE: '90D', // data kalibrasi jarang, default rentang lebih panjang

  UPDATE_INTERVAL_DEFAULT: 1000,

  /* ------------------------------------------------------------------
   * GAP BREAK (Chart Manager)
   * Kalau jarak antar 2 titik historical berturutan > nilai ini (menit),
   * garis di grafik DIPUTUS — supaya lompatan waktu besar antar kejadian
   * kalibrasi tidak salah dibaca sebagai tren proses kontinu.
   * Default 3 hari (4320 menit).
   * ------------------------------------------------------------------ */
  GAP_BREAK_MINUTES: 4320
};
