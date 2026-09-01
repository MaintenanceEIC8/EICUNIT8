/**
 * ==========================================================================
 * DEFAULT TAGS — CEMS Calibration
 * ==========================================================================
 * Sumber: cems_calibration.html (modul Supabase 'CEMS Calibration').
 * Lihat js/adapters/cems-adapter.js untuk detail struktur data mentahnya.
 *
 * 10 parameter = 10 tag total (SATU trend per parameter, DIGABUNG dari
 * SEMUA kejadian kalibrasi apa pun frequency-nya di Step 1 form — 2-Weekly,
 * Monthly, 3-Monthly, 2-Yearly). Frequency itu cuma menentukan PEKERJAAN
 * TAMBAHAN (checklist inspeksi Step 9-11) yang ikut dikerjakan saat itu —
 * pengukuran kalibrasi Zero/Span1/Span2 sendiri (Before/After) SAMA untuk
 * semua frequency, jadi tidak ada alasan dipisah jadi trend yang berbeda.
 * Sempat dipecah jadi 40-50 tag (10 param x 4-5 tab frequency) dan itu
 * salah — memecah 1 rangkaian kalibrasi yang sama jadi banyak trend
 * pendek terpisah, bukannya 1 trend panjang yang benar. Lihat §21 Trend
 * Fitur.MD.
 *
 * 2 series per tag: Actual (pembacaan CEMS) vs Expected (nilai reference
 * gas kalibrasi) — pola sama dengan DCS/Local di SO2.
 *
 * DEFAULT VISIBLE: semua 10 tag nyala dari awal saat halaman dibuka (biar
 * langsung kelihatan tanpa perlu centang manual satu-satu) — checkbox di
 * TAG LIST tetap bisa dipakai untuk menyembunyikan tag yang tidak perlu.
 *
 * ENGINEERING RANGE: ASUMSI rentang tipikal CEMS batubara (SO2/NOx/CO span
 * gas ~ratusan ppm, CO2 0-20%, O2 0-25%) -- sesuaikan kalau ada spesifikasi
 * gas kalibrasi aktual dari instrumen.
 * ==========================================================================
 */
window.DCS_DEFAULT_TAGS = [

  {
    id: 'CEMS-SO2-ZERO',
    name: 'CEMS SO2 Zero',
    description: 'SO2 Zero -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 50, min: 0, max: 50, chartMax: 60,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#ab2121' },
      { key: 'Expected', label: 'Expected', color: '#ca7e72' }
    ]
  },
  {
    id: 'CEMS-SO2-SPAN1',
    name: 'CEMS SO2 Span1',
    description: 'SO2 Span1 -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 500, min: 0, max: 500, chartMax: 550,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#9c691e' },
      { key: 'Expected', label: 'Expected', color: '#bea254' }
    ]
  },
  {
    id: 'CEMS-SO2-SPAN2',
    name: 'CEMS SO2 Span2',
    description: 'SO2 Span2 -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 500, min: 0, max: 500, chartMax: 550,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#667917' },
      { key: 'Expected', label: 'Expected', color: '#78983a' }
    ]
  },
  {
    id: 'CEMS-NOX-ZERO',
    name: 'CEMS NOx Zero',
    description: 'NOx Zero -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 50, min: 0, max: 50, chartMax: 60,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#246613' },
      { key: 'Expected', label: 'Expected', color: '#3e9338' }
    ]
  },
  {
    id: 'CEMS-NOX-SPAN2',
    name: 'CEMS NOx Span2',
    description: 'NOx Span2 -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 500, min: 0, max: 500, chartMax: 550,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#1a8946' },
      { key: 'Expected', label: 'Expected', color: '#4ebc89' }
    ]
  },
  {
    id: 'CEMS-CO-ZERO',
    name: 'CEMS CO Zero',
    description: 'CO Zero -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 50, min: 0, max: 50, chartMax: 60,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#21abab' },
      { key: 'Expected', label: 'Expected', color: '#72beca' }
    ]
  },
  {
    id: 'CEMS-CO-SPAN1',
    name: 'CEMS CO Span1',
    description: 'CO Span1 -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: 'ppm',
    engineeringLow: 0, engineeringHigh: 1000, min: 0, max: 1000, chartMax: 1100,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#2158ab' },
      { key: 'Expected', label: 'Expected', color: '#728aca' }
    ]
  },
  {
    id: 'CEMS-CO2-ZERO',
    name: 'CEMS CO2 Zero',
    description: 'CO2 Zero -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: '%',
    engineeringLow: 0, engineeringHigh: 5, min: 0, max: 5, chartMax: 6,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#3c21ab' },
      { key: 'Expected', label: 'Expected', color: '#9072ca' }
    ]
  },
  {
    id: 'CEMS-CO2-SPAN1',
    name: 'CEMS CO2 Span1',
    description: 'CO2 Span1 -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: '%',
    engineeringLow: 0, engineeringHigh: 20, min: 0, max: 20, chartMax: 22,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#9021ab' },
      { key: 'Expected', label: 'Expected', color: '#c472ca' }
    ]
  },
  {
    id: 'CEMS-O2-ZERO',
    name: 'CEMS O2 Zero',
    description: 'O2 Zero -- pembacaan CEMS (Actual) vs reference gas kalibrasi (Expected), semua kejadian kalibrasi',
    unit: '%',
    engineeringLow: 0, engineeringHigh: 25, min: 0, max: 25, chartMax: 26,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true, enabled: true,
    source: 'firestore:pm_records', sourceModul: 'CEMS Calibration', updateInterval: null,
    series: [
      { key: 'Actual',   label: 'Actual',   color: '#ab2174' },
      { key: 'Expected', label: 'Expected', color: '#ca729b' }
    ]
  }

];
