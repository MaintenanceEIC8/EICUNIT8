/**
 * ==========================================================================
 * DEFAULT TAGS — Diturunkan dari repo Mahfudjtf/PM-UNIT-7
 * ==========================================================================
 * Sesuai arahan: tag pertama yang diaktifkan penuh adalah "SO2 Scrubber
 * Inlet" (so2.html). Field kalibrasi di so2.html:
 *   a. Scrubber A Inlet SO2 (7FC-AT-7A) -> s2aDCS, s2aLocal, s2aZero, s2aSpan
 *   b. Scrubber B Inlet SO2 (7FC-AT-7B) -> s2cDCS, s2cLocal, s2cZero, s2cSpan
 * disimpan ke Supabase (pm_records.data.analyzer) sebagai:
 *   { aDCS, aLocal, aZero, aSpan, aBefore, aAfter,
 *     cDCS, cLocal, cZero, cSpan, cBefore, cAfter }
 *
 * Setiap record = 1 kejadian PM/kalibrasi (bukan sampling per-detik), jadi
 * trend di sini adalah PERBANDINGAN PEMBACAAN DCS vs LOCAL dari waktu ke
 * waktu, bukan trend proses kontinu.
 *
 * Modul HTML lain di repo (opacity.html, fegt.html, ph-analyzer.html, dst)
 * BELUM diaktifkan sebagai tag — checklist/inspeksi (checksheet-*, dcs-hmi-
 * inspection, dll) sengaja dilewati sesuai arahan. Tinggal tambahkan entry
 * baru di array TAGS di bawah + adapter parser-nya di js/adapters/<modul>-
 * adapter.js + config deklaratif di config/modules/<modul>.config.js untuk
 * mengaktifkan modul lain (lihat js/adapters/so2-adapter.js +
 * config/modules/so2.config.js sebagai contoh pola).
 * ==========================================================================
 */
window.DCS_DEFAULT_TAGS = [
  {
    id: 'SO2-7FC-AT-7A',
    name: 'SO2 SCRUBBER A INLET',
    description: 'Scrubber A Inlet SO2 Analyzer (7FC-AT-7A) — DCS vs Local reading, per kejadian kalibrasi PM',
    unit: 'ppm',
    engineeringLow: 0,
    engineeringHigh: 461,   // default Span value pada form so2.html
    min: 0,
    max: 500,
    chartMax: 700, // batas atas VISUAL sumbu grafik (beda dari `max`=rentang instrumen) — biar perubahan garis lebih jelas kelihatan
    // Tidak ada alarm proses formal untuk data kalibrasi ini — dikosongkan.
    alarmLowLow: null,
    alarmLow: null,
    alarmHigh: null,
    alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'SO2 Scrubber Inlet',
    updateInterval: null, // event-based, bukan interval
    series: [
      { key: 'DCS',    label: 'DCS Reading',   color: '#1f6fb2' },
      { key: 'Local',  label: 'Local Reading', color: '#e07b12' },
      { key: 'Before', label: 'Before Kalibrasi', color: '#7a52a8', defaultVisible: false },
      { key: 'After',  label: 'After Kalibrasi',  color: '#b083c9', defaultVisible: false }
    ]
  },
  {
    id: 'SO2-7FC-AT-7B',
    name: 'SO2 SCRUBBER B INLET',
    description: 'Scrubber B Inlet SO2 Analyzer (7FC-AT-7B) — DCS vs Local reading, per kejadian kalibrasi PM',
    unit: 'ppm',
    engineeringLow: 0,
    engineeringHigh: 461,
    min: 0,
    max: 500,
    chartMax: 700,
    alarmLowLow: null,
    alarmLow: null,
    alarmHigh: null,
    alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'SO2 Scrubber Inlet',
    updateInterval: null,
    series: [
      { key: 'DCS',    label: 'DCS Reading',   color: '#1c8a4c' },
      { key: 'Local',  label: 'Local Reading', color: '#c8342f' },
      { key: 'Before', label: 'Before Kalibrasi', color: '#8a5a3e', defaultVisible: false },
      { key: 'After',  label: 'After Kalibrasi',  color: '#c96aa3', defaultVisible: false }
    ]
  }
];
