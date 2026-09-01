/**
 * ==========================================================================
 * DEFAULT TAGS — FEGT (Furnace Exit Gas Temperature) + LD (Leak Detection)
 * ==========================================================================
 * Sumber: fegt.html (modul Supabase 'FEGT & Leak Detection').
 * Lihat js/adapters/fegt-adapter.js untuk detail struktur data mentahnya.
 *
 * 21 tag FEGT-P1..P21 = titik acoustic pyrometry (lintasan sinyal TX->RX,
 * lihat array PATHS di fegt.html). 10 tag LD-1..LD-10 = titik leak
 * detection (lokasi fisik boiler, lihat array LEAK_PATHS di fegt.html).
 *
 * DEFAULT VISIBLE: semua 21 FEGT + 10 LD nyala dari awal saat halaman
 * dibuka (biar langsung kelihatan tanpa perlu centang manual satu-satu) —
 * checkbox + search box di TAG LIST tetap bisa dipakai untuk menyembunyikan/
 * mencari titik tertentu kalau chart dirasa terlalu penuh.
 *
 * ENGINEERING RANGE: form asal TIDAK mendefinisikan batas alarm/instrumen
 * eksplisit (lihat catatan di fegt-adapter.js) — angka min/max/chartMax di
 * bawah ini ASUMSI rentang tipikal, sesuaikan kalau ada spesifikasi
 * instrumen yang sebenarnya.
 * ========================================================================== 
 */
window.DCS_DEFAULT_TAGS = [
  {
    id: 'FEGT-P1',
    name: 'FEGT PATH 1',
    description: 'Acoustic pyrometry path 1 (TX6 \u2192 RX1) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#a51d1d' }
    ]
  },
  {
    id: 'FEGT-P2',
    name: 'FEGT PATH 2',
    description: 'Acoustic pyrometry path 2 (TX7 \u2192 RX3) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#a5441d' }
    ]
  },
  {
    id: 'FEGT-P3',
    name: 'FEGT PATH 3',
    description: 'Acoustic pyrometry path 3 (TX8 \u2192 RX5) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#97621b' }
    ]
  },
  {
    id: 'FEGT-P4',
    name: 'FEGT PATH 4',
    description: 'Acoustic pyrometry path 4 (TX5 \u2192 RX2) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#887818' }
    ]
  },
  {
    id: 'FEGT-P5',
    name: 'FEGT PATH 5',
    description: 'Acoustic pyrometry path 5 (TX8 \u2192 RX4) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#6a7815' }
    ]
  },
  {
    id: 'FEGT-P6',
    name: 'FEGT PATH 6',
    description: 'Acoustic pyrometry path 6 (TX3 \u2192 RX6) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#436812' }
    ]
  },
  {
    id: 'FEGT-P7',
    name: 'FEGT PATH 7',
    description: 'Acoustic pyrometry path 7 (TX5 \u2192 RX7) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#265d10' }
    ]
  },
  {
    id: 'FEGT-P8',
    name: 'FEGT PATH 8',
    description: 'Acoustic pyrometry path 8 (TX3 \u2192 RX8) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#136d13' }
    ]
  },
  {
    id: 'FEGT-P9',
    name: 'FEGT PATH 9',
    description: 'Acoustic pyrometry path 9 (TX7 \u2192 RX5) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#167d33' }
    ]
  },
  {
    id: 'FEGT-P10',
    name: 'FEGT PATH 10',
    description: 'Acoustic pyrometry path 10 (TX4 \u2192 RX3) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#198d5b' }
    ]
  },
  {
    id: 'FEGT-P11',
    name: 'FEGT PATH 11',
    description: 'Acoustic pyrometry path 11 (TX6 \u2192 RX5) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1c9d8a' }
    ]
  },
  {
    id: 'FEGT-P12',
    name: 'FEGT PATH 12',
    description: 'Acoustic pyrometry path 12 (TX8 \u2192 RX2) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1d91a5' }
    ]
  },
  {
    id: 'FEGT-P13',
    name: 'FEGT PATH 13',
    description: 'Acoustic pyrometry path 13 (TX7 \u2192 RX4) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1d6ba5' }
    ]
  },
  {
    id: 'FEGT-P14',
    name: 'FEGT PATH 14',
    description: 'Acoustic pyrometry path 14 (TX2 \u2192 RX6) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1d44a5' }
    ]
  },
  {
    id: 'FEGT-P15',
    name: 'FEGT PATH 15',
    description: 'Acoustic pyrometry path 15 (TX2 \u2192 RX7) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1d1da5' }
    ]
  },
  {
    id: 'FEGT-P16',
    name: 'FEGT PATH 16',
    description: 'Acoustic pyrometry path 16 (TX1 \u2192 RX8) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#441da5' }
    ]
  },
  {
    id: 'FEGT-P17',
    name: 'FEGT PATH 17',
    description: 'Acoustic pyrometry path 17 (TX1 \u2192 RX2) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#6b1da5' }
    ]
  },
  {
    id: 'FEGT-P18',
    name: 'FEGT PATH 18',
    description: 'Acoustic pyrometry path 18 (TX4 \u2192 RX5) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#911da5' }
    ]
  },
  {
    id: 'FEGT-P19',
    name: 'FEGT PATH 19',
    description: 'Acoustic pyrometry path 19 (TX1 \u2192 RX4) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#a51d91' }
    ]
  },
  {
    id: 'FEGT-P20',
    name: 'FEGT PATH 20',
    description: 'Acoustic pyrometry path 20 (TX4 \u2192 RX6) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#a51d6b' }
    ]
  },
  {
    id: 'FEGT-P21',
    name: 'FEGT PATH 21',
    description: 'Acoustic pyrometry path 21 (TX3 \u2192 RX2) \u2014 suhu gas keluar furnace per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 1300,
    min: 0,
    max: 1300,
    chartMax: 1400,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#a51d44' }
    ]
  },
  {
    id: 'LD-1',
    name: 'LD SH1',
    description: 'SH1 — Lt.12 Superheater 1 Sisi Timur \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#923f1c' }
    ]
  },
  {
    id: 'LD-2',
    name: 'LD SH2',
    description: 'SH2 — Lt.12 Superheater 2 Sisi Selatan \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#766c16' }
    ]
  },
  {
    id: 'LD-3',
    name: 'LD SH3',
    description: 'SH3 — Lt.12 Superheater 3 Sisi Barat \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#355811' }
    ]
  },
  {
    id: 'LD-4',
    name: 'LD FRH1',
    description: 'FRH1 — Lt.12 Reheater 1 Sisi Timur \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#13651c' }
    ]
  },
  {
    id: 'LD-5',
    name: 'LD FRH2',
    description: 'FRH2 — Lt.12 Reheater 2 Sisi Barat \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#198363' }
    ]
  },
  {
    id: 'LD-6',
    name: 'LD ECON 6',
    description: 'ECON 6 — Lt.10.5 Economizer Sisi Timur \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1c6e92' }
    ]
  },
  {
    id: 'LD-7',
    name: 'LD ECON 7',
    description: 'ECON 7 — Lt.10.5 Economizer Sisi Utara \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#1c2892' }
    ]
  },
  {
    id: 'LD-8',
    name: 'LD ECON 8',
    description: 'ECON 8 — Lt.10.5 Economizer Sisi Barat \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#571c92' }
    ]
  },
  {
    id: 'LD-9',
    name: 'LD BS 09',
    description: 'BS 09 — Lt.2 Bottom Slope Sisi Barat \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#921c86' }
    ]
  },
  {
    id: 'LD-10',
    name: 'LD BS 10',
    description: 'BS 10 — Lt.2 Bottom Slope Sisi Timur \u2014 suhu lokal titik leak detection per kejadian pengukuran',
    unit: '\u00b0C',
    engineeringLow: 0,
    engineeringHigh: 600,
    min: 0,
    max: 600,
    chartMax: 700,
    alarmLowLow: null, alarmLow: null, alarmHigh: null, alarmHighHigh: null,
    visible: true,
    enabled: true,
    source: 'firestore:pm_records',
    sourceModul: 'FEGT & Leak Detection',
    updateInterval: null,
    series: [
      { key: 'Temp', label: 'Temp', color: '#921c3f' }
    ]
  },
];
