# Trend Fitur.MD — DCS Trend Monitoring System

Status: **Phase awal — HISTORICAL TREND aktif, modul SO2 Scrubber Inlet**
Sumber data: **read-only** dari Supabase `pm_records` (project sama dengan repo `Mahfudjtf/PM-UNIT-7`)

> **Revisi terbaru (fix layout & scroll):**
> - **Bug scroll halaman tidak bisa discroll di layar desktop full-screen** — diperbaiki. Akar masalah: layout lama pakai desain "1 layar penuh, tidak discroll" (`overflow:hidden` di `html/body`), dan HANYA `.panel-center` yang boleh discroll internal — sementara `.module-tab-bar`/`.module-kpi-bar` ada DI LUAR area itu (paling atas, tempat kursor biasanya berada). Scroll di situ tidak ngefek sama sekali, kelihatan seperti "halaman macet total". Sekarang **seluruh halaman discroll normal** (seperti browser pada umumnya) di semua ukuran layar — tidak ada lagi area "mati".
> - **Kotak panel deviasi yang kosong di bawah keterangan** — diperbaiki 2 arah: (1) kalau memang belum ada data (pasangan record DCS/Local atau Before/After yang cocok belum ketemu di rentang waktu itu), sekarang tampil pesan jelas ("Belum ada pasangan record ... yang cocok") alih-alih kanvas kosong; (2) kalau datanya ADA, area plot mini-chart diperbesar (margin grid dikurangi, dari ~34px area plot efektif dari total 80px jadi jauh lebih lega) supaya garis deviasi nyaris-datar tetap kelihatan, bukan menempel tak terlihat di tepi.

---

## 1. Apa yang sudah berfungsi penuh (bukan dummy)

| Fitur | Status | Keterangan |
|---|---|---|
| Tag List panel (search, checkbox show/hide) | ✅ | 2 tag aktif: `SO2-7FC-AT-7A`, `SO2-7FC-AT-7B` |
| **Overlay multi-tag dalam 1 grafik** | ✅ | Semua tag yang **dicentang** tampil bersama di 1 chart (bukan ganti-ganti per tag) — sesuai gaya trend recorder DCS/CEMS asli |
| **Sumbu Y "PER CENT SPAN" (0–100%)** | ✅ | Tiap series dinormalisasi ke `%` dari `engineeringLow..engineeringHigh` tag-nya, supaya unit/range beda tetap bisa ditumpuk di 1 sumbu. Nilai asli tetap tampil penuh di tooltip & panel VALUES |
| **Panel VALUES (kanan) — nilai hidup ikut cursor** | ✅ | Label berwarna + nilai + unit per series, otomatis update mengikuti posisi cursor di grafik; balik ke nilai TERKINI saat cursor keluar area chart |
| **Gap-break pada garis trend** | ✅ | Kalau jarak antar 2 titik kalibrasi berturutan > `GAP_BREAK_MINUTES` (default 3 hari), garis DIPUTUS — supaya lompatan waktu besar antar kejadian kalibrasi tidak salah dibaca sebagai tren proses kontinu |
| Historical Trend — Quick Range | ✅ | 5M/15M/30M/1H/4H/8H/12H/24H/7D/30D/90D + CUSTOM |
| Historical Trend — Custom Range (start/end date+time) | ✅ | Validasi start < end |
| LOAD DATA → fetch Supabase real-time | ✅ | `pm_records` difilter modul SO2 + rentang waktu (`updated_at`) |
| Trend Graph (ECharts) | ✅ | Multi-series, zoom (scroll + slider), tooltip cursor, time-axis auto-format |
| AUTO SCALE | ✅ | Reset zoom ke 100% |
| EXPORT CSV / JSON / IMAGE | ✅ | Export **semua tag yang dicentang sekaligus** (digabung 1 file) |
| Status Bar | ✅ | Total tag, active trend, jumlah record ter-load |
| Mode switch LIVE / HISTORICAL | ✅ (UI) | Tombol berfungsi; LIVE menampilkan notice jujur (lihat §3) |
| `window.DCSTrend` internal API | ✅ | `registerTag`, `updateTag`, `getTag`, `getAllTags`, `deleteTag`, `setTagVisibility`, `getHistoricalData`, `exportData`, `broadcastTagUpdate` |
| BroadcastChannel (`dcs_trend_channel`) | ✅ (siap) | Listener aktif, siap terima `TAG_UPDATE`/`TAG_REGISTER` dari halaman lain |

**Tidak ada tombol dummy** — setiap tombol yang tampil di UI terhubung ke logic nyata. Fitur yang belum diimplementasikan (lihat §3) sengaja **tidak** ditaruh sebagai tombol di UI supaya tidak menyesatkan.

> **Revisi sesi ini (setelah gap analysis §8):** scope disepakati **UX-only** — overlay multi-tag, panel nilai hidup, dan gap-break garis (lihat 3 baris ditandai di atas). Temuan 🔴 Tinggi (query multi-tabel server-side filtered, adapter generik, series deviasi DCS-vs-Local + threshold, audit lengkap 28 modul) **sengaja ditunda**, belum dikerjakan di sesi ini — lihat §9 untuk status prioritas terbaru.

---

## 2. Bagaimana data SO2 diproses

**Sumber:** `so2.html` di repo `PM-UNIT-7` bukan feed proses kontinu — dia adalah **form checksheet kalibrasi**. Setiap kali form disimpan, 1 baris baru masuk ke `pm_records` dengan `data.analyzer` berisi:

```
{ aDCS, aLocal, aZero, aSpan, aBefore, aAfter,   // a. Scrubber A Inlet SO2 (7FC-AT-7A)
  cDCS, cLocal, cZero, cSpan, cBefore, cAfter }  // b. Scrubber B Inlet SO2 (7FC-AT-7B)
```

Karena itu, "Historical Trend" di sini adalah **perbandingan pembacaan DCS vs Local dari waktu ke waktu (antar kejadian kalibrasi)**, bukan trend proses per-detik. Sesuai konfirmasi:

- Tag `SO2-7FC-AT-7A` → series **DCS Reading** (`aDCS`) vs **Local Reading** (`aLocal`)
- Tag `SO2-7FC-AT-7B` → series **DCS Reading** (`cDCS`) vs **Local Reading** (`cLocal`)
- X-axis = `updated_at` (fallback `created_at` → `tanggal`) tiap record
- Engineering range chart: 0–461 ppm (nilai default Span pada form `so2.html`)

Modul HTML lain di repo (`opacity.html`, `fegt.html`, `ph-analyzer.html`, `flow-meter-fgd.html`, `coal-silo-level.html`, `cems_calibration.html`) **belum** diaktifkan sebagai tag — sesuai arahan, checksheet/inspeksi (`checksheet-*`, `dcs-hmi-inspection`, dll) dilewati untuk sekarang.

---

## 3. Yang SENGAJA belum aktif (bukan lupa — keputusan desain)

- **LIVE TREND**: `LIVE_TREND_ENABLED = false` di `config/system-config.js`. Repo PM-UNIT-7 tidak punya feed proses real-time (semua event-based via form kalibrasi), jadi Live Trend butuh sumber data lain (simulator/API/WebSocket) yang belum ditentukan. Arsitektur (`js/live-trend-engine.js`, `js/simulator.js`) sudah disiapkan penuh — tinggal set flag `true` + sambungkan sumber data saat siap.
- **ADD TAG manual (modal)** dan **right-click menu** (edit/duplicate/delete tag) — belum dibangun di Phase ini. `TagManager` & `DCSTrend.registerTag()` sudah siap menerimanya (backend logic-nya sudah ada), tinggal dibuatkan modal UI-nya.
- **Alarm limit visualization** (garis HH/H/L/LL) — dikosongkan untuk 2 tag SO2 karena data kalibrasi ini tidak punya alarm proses formal (bukan PV real-time). Field `alarmHigh` dkk di tag object di-set `null`.
- **Dual cursor (Cursor A/B, ΔT, ΔValue, Rate of Change)** — belum diimplementasikan; saat ini pakai cursor tunggal bawaan ECharts (`tooltip axisPointer`).

---

## 4. Lokasi di repo & cara menjalankan

Folder ini ditaruh sebagai **`/trend/`** di root repo `PM-UNIT-7` — sejajar dengan folder `assets/`, jadi **tidak menimpa** `index.html` dashboard utama yang sudah ada.

```
PM-UNIT-7/
├── index.html              ← dashboard utama (TIDAK diubah/ditimpa)
├── assets/
├── shared.js / shared.css
├── so2.html, opacity.html, dst  (form-form PM yang sudah ada)
└── trend/                  ← project ini
    ├── index.html          (dibuka lewat PM-UNIT-7/trend/index.html)
    ├── css/
    ├── config/
    ├── js/
    └── Trend Fitur.MD
```

1. Buka `trend/index.html` di browser (tidak butuh build step — vanilla JS). Semua path CSS/JS di dalamnya relatif terhadap file ini sendiri, jadi tetap jalan normal walau ditaruh di subfolder.
2. Sistem otomatis: load tag SO2 → connect ke Supabase → load data 90 hari terakhir (default range) → render chart.
3. Klik tag di panel kiri untuk pindah trend. Klik quick range atau isi Custom Range → **LOAD DATA** untuk refresh.
4. Jika tidak ada data pada rentang waktu yang dipilih, chart akan menampilkan pesan "TIDAK ADA DATA PADA RENTANG WAKTU INI" (bukan chart kosong tanpa keterangan).

**Catatan koneksi:** memakai anon key Supabase read-only yang sama dengan `shared.js` di PM-UNIT-7. Tidak ada operasi write/delete dari sistem trend ini.

**Akses dari dashboard utama:** belum otomatis ditautkan — `index.html` dashboard di root repo belum diubah. Tambahkan tombol/link manual ke `trend/index.html` di sana kalau mau bisa diakses dari menu utama (lihat §5).

---

## 5. Struktur file & menautkan ke dashboard

```
trend/
├── index.html
├── css/
│   ├── style.css        (layout & struktur)
│   └── dcs-theme.css     (warna & tema dark industrial)
├── config/
│   ├── system-config.js  (HISTORICAL_SOURCE Firestore, quick range, flags LIVE/HISTORICAL)
│   └── default-tags.js   (definisi tag SO2 A & B)
└── js/
    ├── storage-manager.js       (wrapper localStorage aman)
    ├── historical-adapter.js    (fetch pm_records dari Firestore eic8-3d7f1, read-only;
    │                             dulu supabase-adapter.js — lihat FIREBASE_MIGRATION.md Phase 3)
    ├── so2-adapter.js           (parser record SO2 → time series)
    ├── tag-manager.js           (registry tag)
    ├── historical-manager.js    (quick range, custom range, load orchestration)
    ├── chart-manager.js         (ECharts wrapper)
    ├── communication-manager.js (BroadcastChannel, CustomEvent, window.DCSTrend API)
    ├── export-manager.js        (CSV/JSON export)
    ├── live-trend-engine.js     (STUB — nonaktif, siap untuk Phase berikutnya)
    ├── simulator.js             (STUB — nonaktif, siap untuk Phase berikutnya)
    ├── ui-manager.js            (DOM wiring)
    └── app.js                   (bootstrap)
```

Untuk menambahkan tombol akses di dashboard utama (`index.html` root repo), tinggal tambah satu tombol/kartu menu yang mengarah ke `trend/index.html`, mengikuti pola tombol menu modul lain yang sudah ada di dashboard tersebut. Belum dilakukan otomatis di sini — repo asal tidak disentuh sampai ada instruksi eksplisit untuk push/edit.

---

## 6. Cara menambah modul baru (mis. Opacity, FEGT, pH)

1. Cek struktur `dbCollectData()` di file HTML modul terkait (repo PM-UNIT-7) untuk tahu field mana yang mau di-plot — ikuti pola diskusi yang sudah dipakai untuk SO2 (analisis dulu field kalibrasi mana yang relevan sebelum asal pilih).
2. Buat `js/<nama>-adapter.js` mengikuti pola `so2-adapter.js` (parse rows → `{ tagId: { seriesKey: [{time,value}] } }`).
3. Tambahkan tag baru di `config/default-tags.js`.
4. Daftarkan adapter baru di `HistoricalManager.ADAPTERS` (`js/historical-manager.js`).
5. Tambahkan `<script>` baru di `index.html`.

Tidak perlu mengubah `chart-manager.js`, `ui-manager.js`, atau `app.js` — arsitektur sudah modular untuk ini.

---

## 7. Pemetaan ke roadmap PDF asli (DCS_Trend_Monitoring_System.pdf)

| Phase (spec asli) | Status di deliverable ini |
|---|---|
| Phase 1 — Live Trend + Simulator | Ditunda (lihat §3) — diganti prioritas Historical dulu sesuai arahan terbaru |
| Phase 2 — Historical Trend, LocalStorage, Zoom, Export CSV | ✅ Aktif (pakai Supabase, bukan localStorage — karena sumber data real) |
| Phase 3 — BroadcastChannel, Interconnection, Auto Tag Discovery | Kerangka siap (`communication-manager.js`), belum ada halaman pengirim aktif |
| Phase 4 — WebSocket, REST API, DB Adapter | `SupabaseAdapter` sudah berperan sebagai DB Adapter nyata (bukan placeholder) |

---

## 8. Hasil Analisis Gap (dibanding trend tool DCS profesional, mis. PI ProcessBook)

Analisis dilakukan dengan membandingkan langsung ke contoh tampilan **PI ProcessBook Trend Display** (referensi visual dari user) dan membaca detail seluruh isi `trend/js/*.js`. Tujuan: menambahkan hal-hal yang membuat sistem ini terasa selevel tool DCS engineer profesional, sebelum diperluas ke semua modul checksheet.

### 8.1 Gap tampilan/UX

| # | Temuan | Detail | File terdampak |
|---|---|---|---|
| 1 | Tidak bisa overlay 2+ tag dalam satu plot | `chart-manager.js` selalu `chart.setOption(option, true)` (replace total) tiap ganti tag; `ui-manager.js` cuma simpan `selectedTagId` tunggal. PI bisa tampilkan `7FC-AT-7A` & `7FC-AT-7B` bersamaan di satu grafik. | `chart-manager.js`, `tag-manager.js`, `ui-manager.js` |
| 2 | Legend tidak menampilkan nilai live/dinamis | Legend ECharts bawaan cuma nama series (toggle show/hide), tidak ada angka seperti di PI (nama + nilai + satuan, ikut berubah sesuai posisi cursor). | `chart-manager.js` |
| 3 | Tidak ada cursor readout box yang snap ke data point | PI punya kotak nilai presisi + garis vertikal solid yang tetap muncul saat cursor digeser/diklik. Punya kita cuma tooltip hover bawaan ECharts (`axisPointer: cross`) yang hilang saat mouse keluar area chart. | `chart-manager.js`, `ui-manager.js` |
| 4 | Tidak ada navigasi geser tanggal (◄ ►) di toolbar | PI punya field tanggal + tombol maju/mundur untuk geser jendela waktu tanpa harus mengetik ulang. Sekarang cuma quick-range preset + custom range sekali input. | `historical-manager.js`, `index.html` |
| 5 | ✅ **Selesai** — Line chart menyambung gap waktu besar sebagai garis lurus | Ditangani via `GAP_BREAK_MINUTES` (config, default 4320 = 3 hari) — jarak antar titik > threshold disisipi titik `null` (`connectNulls:false`) sehingga garis diputus, bukan disambung miring. | `chart-manager.js`, `config/system-config.js` |

### 8.2 Gap arsitektur data — lebih serius dari sekadar tampilan

| # | Temuan | Detail |
|---|---|---|
| 6 | Query historis tidak scalable, berpotensi kehilangan data diam-diam | `supabase-adapter.js` → `fetchRecords()` selalu ambil **500 record TERBARU dari SELURUH tabel** (semua modul digabung, `order=updated_at.desc&limit=500`), baru difilter modul+waktu **di client**. Tidak ada filter `WHERE modul=eq.X` di level query REST. Tidak ada indikator "data dibatasi 500 record" ke user. Prioritas **tinggi** untuk dibenahi sebelum modul lain masuk. |
| 7 | Tidak ada perhitungan deviasi DCS vs Local (padahal itu tujuan inti alat ini) | `so2-adapter.js` cuma simpan `aDCS`/`aLocal` sebagai 2 series terpisah. Tidak ada series selisih (`aDCS - aLocal`), tidak ada ambang toleransi (mis. ±2% dari span), tidak ada penandaan otomatis titik yang menyimpang. Ini fitur paling bernilai untuk tujuan bisnis alat — mengubah dari "grafik dua garis" jadi alat bantu keputusan. |
| 8 | `recordId` dan `pic` (teknisi) sudah disimpan tapi tidak dipakai | `so2-adapter.js` sudah menyertakan `recordId`/`pic` per titik data, tapi belum disambungkan ke tooltip/detail panel. Quick win — data sudah ada, tinggal ditampilkan. |
| 9 | Tidak ada validasi/indikator kualitas data | Field kosong/null di satu record cuma di-skip diam-diam di adapter, tanpa pesan "N record dilewati karena data tidak lengkap". |
| 10 | Tidak ada caching antar-load | Tiap ganti tag/range selalu fetch ulang 500 record dari awal — boros network, padahal bisa di-cache per sesi. |
| 11 | State tidak persisten lintas reload | `storage-manager.js` sudah siap sebagai wrapper localStorage, tapi cuma dipakai untuk custom tag manual (fitur yang UI-nya belum dibuat). Tag & range terakhir tidak diingat — reload selalu balik ke tag pertama + range 90D default. |

### 8.3 Temuan kritis — audit kesiapan SEMUA modul checksheet untuk trend

Karena rencana ke depan trend ini dipakai untuk **semua HTML checksheet** di repo (bukan cuma SO2), dilakukan audit ke seluruh 28 file HTML modul. Hasilnya: **sumber data tidak seragam**, ini blocker paling mendasar sebelum ekspansi dilakukan.

**Tabel Supabase yang ditemukan (bukan cuma `pm_records`):**

| Tabel | Dipakai oleh | Catatan |
|---|---|---|
| `pm_records` | SO2, Opacity, CEMS, Coal Feeder, Belt Scale (semua varian: b12/e23/e45), FEGT, Flow Meter FGD, Form O2, Generator Stator Leak, Maintenance Report, Mark VIE Inspection, pH Analyzer, PM HG Analyzer, DCS HMI Inspection | Skema `data.{...}` **tidak seragam** antar modul — lihat di bawah |
| `ts_checksheet` | `checksheet-temperature.html` | Skema terpisah total; ada komentar eksplisit di kode "kita tidak pakai dbSave dari shared" |
| `outage_assets` | `checksheet-level-switch.html`, `outage-input.html` | Skema terpisah total |
| `material_warehouse`, `material_jenis`, `material_pengambilan` | `material-warehouse.html` | Data inventaris gudang — bukan data pengukuran/kalibrasi |
| *(tidak ada penyimpanan data pengukuran)* | `device-admin.html` | Murni admin/konfigurasi, tidak relevan untuk trend |

**Bahkan di dalam `pm_records` sendiri, struktur field `data` tidak konsisten per modul:**
- `opacity.html` → `data.checks` (array) + `data.notes`
- `coal_feeder_calibration.html` → `data.{...}` field flat langsung
- `mark_vie_inspection.html` → `data.header` + `data.items` (array inspeksi checklist, bukan angka kontinu)
- `so2.html` → `data.analyzer` (flat) — pola yang sekarang jadi contoh satu-satunya adapter (`so2-adapter.js`)

**Implikasi:**
- `SupabaseAdapter` sekarang **hardcoded** cuma baca `pm_records` (`CFG.TABLE = 'pm_records'`). Modul `checksheet-temperature`, `checksheet-level-switch`, `material-warehouse` **tidak akan pernah muncul** di trend tanpa dukungan multi-tabel.
- Pola "1 file `<nama>-adapter.js` custom per modul" (seperti `so2-adapter.js`) **tidak scalable** untuk 20+ modul — terlalu banyak kerja manual berulang dan rawan human error tiap kali struktur field berbeda.
- Tidak semua modul cocok untuk trend numerik: `mark_vie_inspection.html` dan `dcs-hmi-inspection.html` isinya checklist pass/fail (butuh mode chart **step/discrete**, bukan line chart analog).
- `material-warehouse.html`, `device-admin.html`, `maintenance_report_form.html` kemungkinan besar **di luar cakupan trend** (administratif/inventaris, bukan data pengukuran berkala) — perlu diputuskan eksplisit modul mana yang in-scope.

---

## 9. Rekomendasi & Roadmap Pengembangan Berikutnya

Urutan prioritas berdasarkan dampak terhadap keandalan data dan nilai bisnis alat, bukan sekadar kemudahan implementasi:

| Prioritas | # | Rekomendasi | Kategori |
|---|---|---|---|
| 🔴 Tinggi | 1 | Audit lengkap semua modul checksheet → peta: tabel tujuan, field, tipe data, in-scope/out-of-scope untuk trend | Fondasi |
| 🔴 Tinggi | 2 | `SupabaseAdapter` dukung multi-tabel + query terfilter di server (`WHERE modul=eq.X`), bukan fetch-500-lalu-filter-client | Arsitektur |
| 🔴 Tinggi | 3 | Ganti pola "1 adapter.js custom per modul" → adapter generik berbasis config declaratif (field-map: tabel, path field, tipe numeric/boolean, unit, range) | Arsitektur |
| 🔴 Tinggi | 4 | Series deviasi DCS-vs-Local + ambang toleransi + penandaan otomatis titik menyimpang | Domain-value |
| ✅ Selesai | 5 | Overlay multi-tag dalam satu plot | UX |
| ✅ Selesai (sebagian) | 6 | Legend dengan nilai live + cursor snap. *Garis vertikal readout permanen (klik-untuk-pin, Cursor A/B ala PI)* belum — sekarang murni ikut hover, balik ke nilai terkini saat cursor keluar chart | UX |
| 🟡 Sedang | 7 | Tag taksonomi berjenjang (grouping per modul/area) — perlu sebelum tag list membengkak jadi 100+ | UX/Skalabilitas |
| 🟡 Sedang | 8 | Mode chart step/discrete untuk modul checklist (Mark VIE, DCS HMI Inspection) | Domain-value |
| 🟡 Sedang | 9 | Tampilkan `recordId`/`pic` di tooltip (data sudah ada, quick win) | Quick win |
| 🟢 Rendah | 10 | Navigasi geser tanggal ◄ ► di toolbar | UX |
| 🟢 Rendah | 11 | Caching antar-load + state persisten (tag/range terakhir) via `storage-manager.js` | Performa |
| 🟢 Rendah | 12 | Indikator kualitas data (record dilewati karena field tidak lengkap) | Robustness |
| ⏸️ Ditunda | 13 | Multi-window trend (dibandingkan side-by-side) | Diputuskan **tidak diperlukan** — cukup ganti tab/judul untuk pindah tampilan |

**Catatan:** Prioritas 1–4 sengaja didahulukan karena tanpa itu, ekspansi trend ke modul lain berisiko menghasilkan data yang salah/hilang diam-diam (bukan cuma "kurang fitur" tapi "berpotensi menyesatkan teknisi") — sejalan dengan prinsip "Tidak ada tombol dummy" di §1 dokumen ini.

---

## 10. Rekonstruksi Struktur Folder + Prioritas 3 & 4 (parsial)

Menyusul sesi UX-only (§8/§9 di atas) yang sengaja menunda prioritas 🔴 Tinggi, sesi ini mengerjakan **§9 prioritas #3 (adapter generik) dan #4 (deviasi DCS-vs-Local)** — sebagian, khusus untuk SO2 sebagai contoh — sekaligus merekonstruksi struktur folder supaya tidak menumpuk 1 file besar per modul ke depannya. Perubahan:

```
trend/
├── config/
│   ├── system-config.js
│   ├── default-tags.js
│   └── modules/                    ← BARU
│       └── so2.config.js           ← config deklaratif: deviationPairs, kpis, logTableColumns
├── js/
│   ├── adapters/                   ← BARU (dipindah dari js/)
│   │   └── so2-adapter.js          ← sekarang juga menarik Zero/Span/Before/After (sebelumnya cuma DCS/Local)
│   ├── module-view.js              ← BARU: mesin generik tab bar + KPI + deviasi + log table
│   ├── chart-manager.js            ← ditambah renderDeviationChart() (mini chart panel deviasi)
│   ├── ui-manager.js                ← ditambah filterTagsByIds/setModuleActiveTags/getVisibleTagIds + event dcsTagListChanged
│   └── ... (sisanya tidak berubah, termasuk mode overlay & panel VALUES dari sesi sebelumnya)
```

**Yang sudah aktif untuk SO2:**
- ✅ Tab bar per modul (baru 1 tab: "SO2 Scrubber Inlet" — cara ganti scope tag yang dicentang, bukan multi-window; kerja bersamaan dengan mode overlay §8.1 — pindah tab otomatis centang tag milik modul itu)
- ✅ Series **Before** & **After** kalibrasi kini ikut ditarik adapter (sebelumnya tidak dipakai sama sekali — §8.2 poin 7 sebagian)
- ✅ Panel deviasi otomatis **per tag** (Scrubber A dan B ditampilkan terpisah, TIDAK digabung — supaya data 2 instrumen berbeda tidak tercampur): **DCS − Local** (dengan band toleransi ±2% span) dan **Before − After** (tren drift, tanpa batas pass/fail) — §9 prioritas #4, khusus SO2
- ✅ Kartu KPI **per tag**: DCS terakhir, Local terakhir, deviasi terakhir, hari sejak kalibrasi terakhir — masing-masing Scrubber A & B punya baris kartu sendiri
- ✅ Tabel log record **per tag** (tanggal, teknisi, DCS, Local, Before, After, record ID) — `recordId`/`pic` yang sebelumnya tidak terpakai (§8.2 poin 8) sekarang tampil di sini
- ⏳ **Belum**: §9 prioritas #1 (audit multi-tabel lengkap), #2 (query server-side filtered, masih fetch-500-lalu-filter), #3 secara penuh (adapter generik config-driven — pola `config/modules/*.config.js` baru mencakup deviasi/KPI/tabel, BELUM mencakup parsing field otomatis tanpa nulis adapter.js manual)

**Pola untuk modul berikutnya (mis. FEGT):** buat 2 file baru saja —
`js/adapters/fegt-adapter.js` (parsing) + `config/modules/fegt.config.js` (deviationPairs/kpis/logTableColumns) — lalu daftarkan di `historical-manager.js` (`ADAPTERS`), `default-tags.js` (`DCS_DEFAULT_TAGS`), dan tambah `<script>` tag di `index.html`. **Tidak perlu** menyentuh `module-view.js`, `chart-manager.js`, atau `ui-manager.js`.

**Catatan kompatibilitas:** karena sesi sebelumnya mengubah arsitektur jadi mode overlay (banyak tag dicentang tampil bersama, panel kanan jadi "VALUES" bukan "TAG DETAILS"), `module-view.js` di sesi ini disesuaikan supaya tab modul bekerja DI ATAS mode overlay tsb — pindah tab = tag milik modul itu otomatis dicentang & tag modul lain tidak, tetap konsisten dengan satu grafik combined.

**Catatan proses (sinkronisasi & pembersihan):** pengerjaan §10 ini sempat berjalan paralel dengan sesi lain yang mengerjakan mode overlay + panel VALUES (commit `7838ccc`, sudah lebih dulu di GitHub saat §10 mau di-push) — diselesaikan via `git rebase origin/main`, 3 file bentrok (`Trend Fitur.MD`, `chart-manager.js`, `ui-manager.js`) digabung manual. Setelah itu, saat hasilnya di-upload manual (drag-drop folder via GitHub Desktop), file lama `js/so2-adapter.js` sempat ikut ter-push kembali sebagai duplikat basi (drag-drop tidak menghapus file lama yang sudah tidak dipakai) — ternyata belum benar-benar terhapus sampai sesi berikutnya (lihat catatan di bawah). **Pelajaran:** saat update manual (bukan `git mv`/`git rm` lewat command line), selalu cek file lama yang seharusnya sudah pindah/dihapus tidak nyangkut lagi setelah drag-drop.

**Sesi berikutnya (mobile view + pembersihan final):**
- File duplikat basi `trend/js/so2-adapter.js` (di luar folder `adapters/`, tidak direferensikan `index.html`) ternyata masih nyangkut di repo — sekarang benar-benar dihapus via `git rm`.
- Mobile view diperbaiki: `css/style.css` sebelumnya sama sekali tidak punya `@media` query — layout 3-kolom fixed-width (tags 240px | chart | details 220px) di dalam `body{overflow:hidden}` bikin panel kanan (VALUES) terpotong di layar HP tanpa bisa discroll. Ditambahkan breakpoint `@media (max-width: 900px)` (panel ditumpuk 1 kolom, chart di atas lalu tag list lalu details, chart diberi tinggi eksplisit karena tidak lagi terikat 100vh, body bisa discroll) dan `@media (max-width: 480px)` untuk layar HP kecil.

**Sesi berikutnya (chart kecil + data tidak muncul):**
- **Chart kecil (desktop):** setelah `module-kpi-bar`/`module-deviation-area`/`module-log-wrap` jadi per-tag (2× lebih tinggi — Scrubber A & B masing-masing punya baris sendiri), total konten di `.panel-center` melebihi tinggi 1 viewport. Karena `.chart-wrap` sebelumnya `flex:1` (ikut menyusut menyesuaikan sisa ruang) sementara `app-shell` dipaku `height:100vh` + `overflow:hidden`, chart jadi diperas sampai sangat kecil supaya semua elemen lain tetap muat. **Fix:** `.panel-center` sekarang `overflow-y:auto` (yang discroll konten di bawah chart, bukan chart-nya), dan `.chart-wrap` diberi tinggi tetap `clamp(420px, 58vh, 640px)` (`flex:0 0 auto`) — chart selalu besar & jelas, tidak pernah ikut diperas lagi.
- **Data tidak muncul ("TIDAK ADA DATA"):** `SupabaseAdapter.fetchByModulAndRange()` sebelumnya fetch 500 record TERBARU dari **seluruh** `pm_records` (gabungan ±15 modul lain), baru filter modul SO2 di client — **ini persis temuan §8.2 poin 6 (prioritas 🔴 Tinggi) yang sebelumnya sengaja ditunda**. Kalau modul lain lebih sering menyimpan record daripada SO2, record SO2 gampang terlempar keluar dari window 500-terbaru itu — data SO2 ADA di database tapi tidak pernah ikut ter-fetch sama sekali. **Fix:** filter modul sekarang dilakukan di query REST itu sendiri (`modul=ilike.*SO2*`, PostgREST substring match — field `modul` di DB berisi teks bebas per form, mis. `so2.html` menyimpan `'SO2 Scrubber Inlet'` bukan cuma `'SO2'`), bukan fetch-semua-lalu-filter-client. Ini menuntaskan §9 prioritas #2 (query server-side filtered) sekaligus, khusus untuk SO2.

---

## 11. Sesi ini — Gaya Tampilan Sesuai Referensi "Trend Display" (screenshot user)

User membandingkan langsung ke screenshot layar **Trend Display** (line chart dengan sumbu ppm asli 0-500, titik data bertanggal, kotak nilai yang menempel di titik cursor). Konfirmasi & perubahan:

- **Konfirmasi cakupan data:** sudah benar cuma SO2 (`SO2-7FC-AT-7A`, `SO2-7FC-AT-7B`) yang ditarik — tidak ada modul lain aktif. Tidak ada perubahan di sisi ini, sudah sesuai sejak §2.
- **Sumbu Y — ppm asli, bukan % span:** `chart-manager.js` sebelumnya menormalisasi tiap titik ke persentase `engineeringLow..engineeringHigh` supaya multi-unit bisa ditumpuk (lihat §1/§8.1 lama). Sesuai keputusan user, ini **diganti** ke nilai ppm asli langsung di sumbu Y (rentang diambil dari `min`/`max` tag — untuk SO2 itu `0..500`, cocok dengan referensi). Catatan desain: kalau nanti tag dengan unit berbeda ditumpuk bersamaan dalam 1 grafik, rentang sumbu jadi gabungan min/max semua tag tanpa normalisasi ulang — trade-off yang disengaja demi keterbacaan angka asli, karena prioritas saat ini masih single-unit (SO2 saja).
- **Series default:** tetap semua 4 (DCS, Local, Before, After per tag) — tidak diubah, sesuai keputusan user.
- **Pinned readout box (BARU):** klik di area grafik sekarang "menempelkan" kotak nilai (tanggal/jam + nilai tiap series berwarna, mirip contoh gambar) plus garis vertikal putus-putus, ke titik data terdekat. Beda dari tooltip hover bawaan ECharts — box ini **persisten**, tidak hilang saat mouse dipindah. Maks 4 box sekaligus (klik lagi di waktu yang sama = lepas pin tertua otomatis digeser). Tutup via tombol × di kotak, atau tombol toolbar baru **CLEAR PINS** untuk hapus semua sekaligus. Diimplementasikan pakai ECharts `graphic` elements (bukan komponen bawaan), reposisi otomatis saat zoom/resize (`chart.on('dataZoom', ...)` + resize listener), di-reset tiap kali data/tag berganti (`renderCombined()`).
- File terdampak: `js/chart-manager.js` (mayoritas perubahan), `index.html` (+tombol CLEAR PINS), `js/ui-manager.js` (wiring tombol).
- **Belum dikerjakan:** Dual Cursor A/B dengan ΔT/ΔValue/Rate-of-Change (§8.1 poin 3, §9) — pin sekarang murni per-titik independen, belum ada perhitungan selisih otomatis antar 2 pin.

---

## 12. Sesi ini — Fix Tampilan (label tanggal, garis putus, batas atas sumbu)

User membandingkan ke contoh grafik Excel (2 garis dengan label tanggal M/D/YYYY dirotasi di sumbu X) dan melaporkan 3 masalah pada tampilan saat ini:

1. **Tidak ada label tanggal yang kelihatan di sumbu X.** Sebelumnya `xAxis.axisLabel` pakai `timeFormatter` (format `DD/MM HH:mm`, tanpa rotasi) — untuk data event-based (1 titik per hari, bukan per-menit) ini kurang pas dan gampang bertumpuk/hilang karena echarts auto-hide label yang overlap. **Fix:** formatter baru `dateAxisFormatter` (`M/D/YYYY`, tanpa jam — sesuai gaya contoh Excel user), `axisLabel.rotate:35` + `hideOverlap:true`, dan `grid.bottom` diperbesar dari 60→85px (dataZoom slider height/posisi juga disesuaikan turun) supaya label yang dirotasi tidak kepotong.
2. **Sambungan garis antar titik tidak ada, cuma titik-titik lepas.** Root cause: `GAP_BREAK_MINUTES` (config) di-set tetap 3 hari (4320 menit), sementara cadence kalibrasi SO2 di data nyata berjarak mingguan (~7 hari) — jadi SEMUA pasangan titik berturutan otomatis dianggap "gap besar" dan garis diputus di antara tiap titik, terlihat seperti tidak ada garis sama sekali. **Fix:** `computeGapThresholdMs()` baru di `chart-manager.js` — ambang gap-break sekarang **adaptif per series**: `3× median jarak antar-titik series itu sendiri`, dengan `GAP_BREAK_MINUTES` config sebagai lantai minimum (bukan lagi angka tetap). Cadence normal (mingguan/2-mingguan/apapun) otomatis tersambung, tapi jeda yang jauh di luar kebiasaan (mis. kekosongan data 2 bulan di tengah data mingguan) tetap diputus sesuai tujuan awal fitur ini.
3. **Batas atas sumbu Y diubah ke 700** (dari sebelumnya 500 = `tag.max`, rentang instrumen) supaya perubahan garis lebih jelas kelihatan, sesuai permintaan. Field baru `chartMax:700` ditambahkan ke config `SO2-7FC-AT-7A`/`SO2-7FC-AT-7B` di `config/default-tags.js`, dipakai terpisah dari `max` (rentang instrumen/engineering, tetap 500, masih dipakai di tempat lain kalau perlu) — `chart-manager.js` sekarang pakai `t.chartMax != null ? t.chartMax : t.max` saat menghitung batas sumbu.

File terdampak: `js/chart-manager.js` (formatter tanggal, grid margin, adaptive gap-break, chartMax lookup), `config/default-tags.js` (+`chartMax:700` di 2 tag SO2).

---

## 13. Sesi ini — Fix: tidak bisa scroll ke bawah (KPI/deviasi/log table tidak kejangkau)

**Gejala:** `.panel-center` sudah `overflow-y:auto` dan layout flex (`min-height:0`) sudah benar (lihat §10/§8.2 poin "chart kecil" yang sudah pernah dibenahi) — tapi user tetap tidak bisa scroll ke bawah untuk lihat KPI cards/panel deviasi/tabel log di bawah chart.

**Root cause:** `dataZoom` tipe `inside` di ECharts (`js/chart-manager.js`) secara default meng-capture event scroll-wheel untuk **zoom grafik**, bukan cuma saat drag slider. Karena chart mengisi sebagian besar area `.panel-center` yang terlihat, hampir semua percobaan scroll-wheel di area itu ke-intercept jadi zoom-in/out chart, bukan scroll halaman turun ke konten di bawahnya.

**Fix:** `dataZoom[0]` (`type:'inside'`) diberi `zoomOnMouseWheel:'ctrl'` (scroll-wheel biasa tidak lagi di-capture; harus tahan **Ctrl** dulu baru scroll = zoom chart) + `moveOnMouseWheel:false`. Scroll biasa di atas chart sekarang tembus ke scroll halaman seperti area lain. Zoom masih bisa lewat slider di bawah chart, drag-select, atau Ctrl+scroll.

File terdampak: `js/chart-manager.js` (`dataZoom` config di `renderCombined`).

---

## 14. Sesi ini — Panel deviasi: teks keterangan terlalu gelap + area kosong terlalu besar

User membandingkan tampilan panel "Deviasi DCS − Local" / "Koreksi Kalibrasi (Before − After)" (`module-view.js` + `dcs-theme.css`) dan komplain 2 hal:

1. **Teks keterangan (`.deviation-panel-desc`) terlalu gelap, susah dibaca** — sebelumnya pakai `var(--text-dim)` (`#5a6b76`, warna paling redup di palet, dimaksudkan utk label sekunder seperti timestamp status bar), kurang cocok dipakai untuk kalimat penjelasan yang harus dibaca jelas. **Fix:** diganti ke `var(--text-secondary)` (`#8b9aa5`, sama dengan warna title panel), kontras lebih baik terhadap `--bg-panel-alt`.
2. **Banyak area kosong di tiap kartu panel** — `.deviation-panel-chart` (mini chart ECharts per pair deviasi) tingginya 120px, padahal garis deviasi yang ditampilkan seringkali flat/tipis (nilai deviasi kecil, mis. `+0.00 ppm`), jadi visualnya didominasi ruang kosong. **Fix:** tinggi dikecilkan ke 80px, gap antar-panel di `.module-deviation-area` dikecilkan 8px→6px, margin bawah `.deviation-panel-desc` 6px→4px — kartu jadi lebih ringkas, lebih banyak panel kelihatan tanpa scroll berlebihan. Override khusus mobile (`style.css`, breakpoint ≤900px) yang membesarkan chart ke 150px **tidak diubah** — itu sengaja dibuat lebih besar untuk kenyamanan baca di layar sentuh.

File terdampak: `css/dcs-theme.css` (`.deviation-panel-desc`, `.deviation-panel-chart`, `.module-deviation-area`).

---

## 15. Sesi ini — Modul baru: FEGT & LD, restrukturisasi jadi multi-halaman

### Restrukturisasi file

Sebelumnya `trend/index.html` = 1 halaman untuk 1 modul (SO2). Supaya menambah modul baru tidak bikin semuanya bertumpuk di satu halaman, direstruktur jadi:

```
trend/
├── index.html          ← HUB baru: kartu link ke tiap modul (statis, tanpa app JS)
├── trend_so2.html       ← bekas index.html lama, khusus modul SO2
├── trend_fegt.html      ← BARU: modul FEGT + LD
├── config/
│   ├── default-tags-so2.js   (rename dari default-tags.js)
│   ├── default-tags-fegt.js  (BARU — 31 tag: FEGT-P1..21 + LD-1..10)
│   └── modules/
│       ├── so2.config.js
│       ├── fegt.config.js    (BARU — tab "FEGT — Acoustic Pyrometry")
│       └── ld.config.js      (BARU — tab "LD — Leak Detection")
└── js/adapters/
    ├── so2-adapter.js
    └── fegt-adapter.js       (BARU)
```

Semua modul JS "generik" (`chart-manager.js`, `ui-manager.js`, `module-view.js`, `tag-manager.js`, dst) **tidak berubah fungsinya** — dipakai bersama oleh `trend_so2.html` dan `trend_fegt.html` tanpa modifikasi khusus per-modul, kecuali 1 perbaikan arsitektur (lihat bawah).

### Data FEGT & LD

Sumber: `fegt.html` (`dbCollectData`), modul Supabase `'FEGT & Leak Detection'`. SATU form/record berisi DUA kelompok data fisik berbeda:
- `data.paths` (21 entri `{id,temp,status}`) = titik acoustic pyrometry FEGT (suhu gas keluar furnace, per lintasan sinyal TX→RX)
- `data.leakPaths` (10 entri `{id,temp,status}`) = titik leak detection LD (suhu lokal di superheater/reheater/economizer/bottom slope)

Sesuai arahan: **grafik FEGT dan LD dipisah** — diimplementasikan sebagai 2 tab modul (`fegt.config.js` + `ld.config.js`) di halaman `trend_fegt.html` yang sama, bukan 2 file terpisah, karena datanya memang 1 fetch Supabase yang sama (`js/adapters/fegt-adapter.js` — 1 adapter, parsing kedua kelompok sekaligus, didaftarkan sebagai `DCS_ADAPTERS['FEGT']` dan dipakai oleh KEDUA module config lewat `adapterKey:'FEGT'`).

Field temp yang `<= 0` (status "data fail" di form asal) **tidak ikut diplot** — bukan bacaan proses valid.

**Catatan asumsi:** `fegt.html` tidak mendefinisikan batas alarm/rentang instrumen eksplisit (status cuma dari `temp>0`). Angka `min/max/chartMax` di `default-tags-fegt.js` (FEGT: 0–1300°C, LD: 0–600°C) adalah **asumsi rentang tipikal**, bukan dari spesifikasi instrumen aktual — sesuaikan kalau ada angka pastinya.

### Perbaikan arsitektur: `historical-manager.js` sekarang benar-benar generik

Sebelumnya `ADAPTERS` di `historical-manager.js` di-hardcode isinya (`{'SO2': window.SO2Adapter}`) — jadi tiap tambah modul baru, file ini tetap harus diedit (bertentangan dengan tujuan modularitasnya sendiri). **Fix:** tiap adapter sekarang **mendaftar diri sendiri** ke `window.DCS_ADAPTERS` (lihat akhir `so2-adapter.js`/`fegt-adapter.js`), dan `historical-manager.js` cukup baca `window.DCS_ADAPTERS` — file itu sekarang benar-benar tidak perlu disentuh lagi untuk modul apa pun ke depannya.

### Bug yang ditemukan & diperbaiki saat build modul bertag-banyak

1. **21 tag auto-nyala semua saat buka tab FEGT** — perilaku lama ("pindah tab = centang semua tag modul itu") masuk akal untuk SO2 (2 tag) tapi bikin chart FEGT langsung penuh 21 garis. **Fix:** tiap tag FEGT/LD punya `visible` default sendiri di `default-tags-fegt.js` (cuma 3 titik FEGT + 2 titik LD yang nyala dari awal) — tidak lagi dipaksa nyala semua.
2. **Pindah tab FEGT→LD mematikan default LD secara permanen** — konsekuensi dari fix #1 yang kurang lengkap: logic "matikan tag di luar modul aktif" ternyata juga mematikan default LD SEBELUM user sempat lihat tab LD (karena FEGT dibuka duluan sebagai tab pertama). **Fix:** `module-view.js` sekarang **mengingat pilihan tag terakhir per-modul** (`moduleVisibleMemory`, in-memory) — tiap keluar dari tab, state tag modul itu disimpan; tiap masuk tab, dipulihkan dari memori itu (atau dari `tag._defaultVisible` kalau modul belum pernah dikunjungi). `tag._defaultVisible` sendiri baru ditambahkan di `tag-manager.js` (snapshot visibility asli dari config, terpisah dari `visible` yang berubah-ubah). Sudah diuji lewat 5 skenario (headless browser): default awal per-tab benar, pindah tab bolak-balik tidak saling menimpa, dan pilihan manual user tetap diingat setelah pindah-pindah tab.

File terdampak: `js/tag-manager.js`, `js/module-view.js`, `js/ui-manager.js` (`setModuleActiveTags` dihapus — logicnya pindah ke `module-view.js` yang butuh akses ke memori per-modul), `js/historical-manager.js`, `js/adapters/so2-adapter.js` (tambah self-registrasi), `js/adapters/fegt-adapter.js` (baru), `config/default-tags-fegt.js` (baru), `config/modules/fegt.config.js` + `ld.config.js` (baru), `index.html` (jadi hub), `trend_so2.html` + `trend_fegt.html` (baru).

---

## 16. Sesi ini — Tema terang (putih), palet warna garis, rentang 1/2/3 Tahun

### Tema putih di semua halaman

Ganti total dari dark-room SCADA ke tema terang. Karena **seluruh** `css/dcs-theme.css` sudah dibangun di atas CSS variable (`--bg-main`, `--text-primary`, `--accent-cyan`, dst — tidak ada warna hardcode di file itu), cukup ganti nilai variable di `:root` untuk membalik 3 halaman (`index.html`, `trend_so2.html`, `trend_fegt.html`) sekaligus tanpa menyentuh komponen satu-satu.

**Yang TIDAK ikut otomatis (dan harus diedit manual):** ECharts (`chart-manager.js`) menggambar ke `<canvas>`, jadi warnanya di-hardcode di JS, bukan baca CSS variable. Semua warna chart (axis, grid, tooltip, pin box, dataZoom slider, background export PNG) diganti manual ke padanan versi terang — daftar lengkap pemetaan warna ada di commit ini. Tooltip & pin-box juga ditambah `box-shadow` supaya tetap kelihatan menonjol di atas background putih (sebelumnya cukup mengandalkan warna gelap vs terang).

### Palet warna garis tag (per-series `color`)

Warna neon lama (`#00d9ff`, `#39ff88`, dst — dipilih buat kontras di background GELAP) nyaris tidak kelihatan di background putih. Diganti:
- **SO2** (2 tag × 4 series): warna dipilih manual, cukup sedikit.
- **FEGT (21 tag) + LD (10 tag)**: digenerate via HSL dengan **koreksi lightness per-hue** (pita kuning-hijau butuh lightness lebih rendah dari biru/merah/ungu supaya kontrasnya setara — mata manusia lebih sensitif ke hijau/kuning). Diverifikasi tiap warna via **kalkulasi WCAG contrast ratio** terhadap putih (`(L+0.05)/(0.05)` formula standar) — semua di atas rasio 3.3:1.

### Rentang waktu 1/2/3 Tahun

Ditambahkan ke `QUICK_RANGES` (`system-config.js`): `1Y` (525600 menit), `2Y` (1051200 menit), `3Y` (1576800 menit). `FETCH_LIMIT` Supabase dinaikkan dari 500 → 3000 baris sebagai headroom (query per-modul sudah server-side filtered sejak §8.2, jadi 3000 baris itu per-modul, bukan gabungan seluruh tabel — cukup luas untuk beberapa tahun data kalibrasi event-based).

### Perbaikan kecil lain

- Panel diagnostik LOAD DATA (`trend_fegt.html`, ditambahkan sesi sebelumnya buat debug "data tidak muncul") warnanya masih hardcode gelap (`#1a1a2e`) — ketinggalan saat migrasi tema. Disamakan ke tema terang.
- Halaman hub (`index.html`) dirombak visual: pola grid halus ala kertas gambar teknik di background, kartu dengan aksen warna kiri per-modul (kode-warna cepat, akan konsisten dengan warna garis chart modul itu), dan 1 slot kartu "belum aktif" (dashed border) buat modul berikutnya — supaya hub ini terasa sebagai daftar yang akan terus tumbuh, bukan cuma 2 kartu tetap selamanya.

File terdampak: `css/dcs-theme.css` (rewrite total, tetap struktur variable sama), `js/chart-manager.js` (13 pemetaan warna hardcode), `config/default-tags-so2.js`, `config/default-tags-fegt.js` (regenerasi palet), `config/system-config.js` (QUICK_RANGES + FETCH_LIMIT), `index.html` (redesign), `trend_fegt.html` (fix warna panel diagnostik).

---

## 17. Sesi ini — Reconcile modul CEMS Calibration (ditambahkan sesi lain, ditemukan bug arsitektur)

### Konteks

Saat mau push tema terang (§16), `git fetch` menemukan commit baru dari sesi Claude lain yang menambahkan modul CEMS Calibration. Setelah diperiksa, commit itu punya masalah nyata:

1. **`trend/index.html` ditulis balik ke versi app-shell lama** (single-page, sebelum restrukturisasi §15) — bukan halaman hub. Sesi itu tampaknya bekerja dari checkout lokal yang stale (masih referensi `config/default-tags.js` yang sudah di-rename jadi `default-tags-so2.js` sejak §15, dan tidak tahu soal FEGT/LD sama sekali).
2. **Tag definition CEMS tidak pernah dibuat** — `cems.config.js` mereferensikan tag ID seperti `CEMS-SO2-ZERO`, tapi tidak ada `default-tags-cems.js` atau entry manapun yang mendefinisikan tag itu (nama, unit, warna, dst). Kalau dipakai apa adanya, `TagManager.getTag()` akan selalu return `undefined` untuk semua tag CEMS — modul ini akan gagal total, bukan cuma kurang lengkap.
3. **Tag ID dipakai ulang di 4 tab** (`CEMS-SO2-ZERO` dst sama persis di tab 2-Weekly #1, #2, Monthly, 2-Yearly) — karena `TagManager` cuma kenal 1 objek per ID, centang/uncentang di 1 tab akan ikut mengubah tag "yang sama" secara ID di tab lain. Bug ini sama persis kelasnya dengan yang sudah diperbaiki di §15 untuk FEGT/LD (moduleVisibleMemory), tapi CEMS commit itu tidak mengantisipasinya sama sekali.
4. `historical-manager.js` di-refactor balik ke `ADAPTERS` yang di-hardcode (bukan `window.DCS_ADAPTERS` generik dari §15), plus menghilangkan SO2 dari FEGT (karena base branch-nya predates FEGT).

### Yang dikerjakan

- **`git merge origin/main`**: konflik di `system-config.js` (beda label quick-range, dipilih punya sendiri yang lebih deskriptif) dan `index.html` (dipertahankan versi hub, BUKAN app-shell lama).
- **`historical-manager.js`**: dikembalikan ke versi generik (`window.DCS_ADAPTERS`) dari §15 — TIDAK dipakai `ADAPTER_MODUL_MAP` ala commit CEMS, karena ternyata tidak perlu: kalau 4 tab CEMS semuanya `adapterKey:'CEMS'` menunjuk ke SATU adapter yang sama-sama terdaftar di `window.DCS_ADAPTERS['CEMS']`, dedup fetch sudah otomatis terjadi (persis pola FEGT+LD di §15) — TANPA butuh mekanisme mapping tambahan.
- **`js/adapters/cems-adapter.js`**: ditulis ulang. Tag ID sekarang UNIK per tab (prefix `CEMS-W1-*`, `CEMS-W2-*`, `CEMS-M-*`, `CEMS-Y-*`), 1 adapter memparse SEMUA 40 tag dari 1 fetch Supabase modul `'CEMS Calibration'`.
- **`config/modules/cems.config.js`**: ditulis ulang, dibuat generik per-tag (persis pola `so2.config.js`: `deviationPairs`/`kpis` berlaku untuk tag APAPUN yang dicentang, bukan tag spesifik) — draft awal sempat pakai `forTagId` custom yang ternyata tidak dibutuhkan sama sekali karena mesin KPI/deviasi (`module-view.js`) memang sudah generik per-context.
  - **Bug kedua ditemukan & diperbaiki saat testing**: field `key` tiap module config sempat di-set ke prefix tag pendek (`'CEMS-W1'`) alih-alih key registry (`'CEMS-WEEKLY-1'`) — akibatnya `selectModule()` gagal mencocokkan `window.DCS_MODULES[key]`, return diam-diam tanpa error, dan tag list tidak pernah ke-filter (semua 40 tag tampil sekaligus, tab tidak ada yang aktif). Ketahuan karena diuji end-to-end (headless browser, cek jumlah `.tag-row` per tab) — bukan cuma syntax check.
- **`config/default-tags-cems.js`** (baru): 40 tag (10 parameter × 4 tab), 2 series per tag (`Actual`/`Expected`), warna HSL dgn koreksi kontras (pola sama dgn §16), unit & rentang **asumsi tipikal CEMS batubara** (SO2/NOx/CO dlm ppm, CO2/O2 dlm %) — sesuaikan kalau ada spesifikasi gas kalibrasi aktual.
- **`trend_cems.html`** (baru): halaman modul CEMS, mengikuti pola persis `trend_so2.html`/`trend_fegt.html`.
- **`index.html`**: kartu ke-3 ditambahkan untuk CEMS Calibration.

### Verifikasi

Diuji lewat headless browser: 4 tab CEMS masing-masing menampilkan 10 tag UNIK (tidak tabrakan), tab aktif ke-highlight dengan benar, tidak ada error JS di 4 halaman (`index.html`, `trend_so2.html`, `trend_fegt.html`, `trend_cems.html`).

### Pelajaran untuk sesi berikutnya

Kalau ada sesi Claude lain yang mengedit `trend/` secara paralel, **selalu `git fetch` + baca commit terbaru SEBELUM mulai kerja**, dan jangan asumsikan commit message merepresentasikan isi commit dengan akurat — commit CEMS ini message-nya terdengar lengkap ("BARU: ... DIUPDATE: ...") tapi isinya punya 2 bug yang bikin modul itu gagal total kalau tidak ditemukan lewat testing end-to-end.

---

## 18. Sesi ini — Redesign hub `index.html` (mewah/profesional) + fix urutan mobile

### Masalah yang dilaporkan

Screenshot dari HP menunjukkan `trend_cems.html` tampil sebagai 3 kolom desktop yang diperkecil (TAG LIST | TREND GRAPH | VALUES berdampingan, teks jadi sangat kecil) alih-alih ditumpuk vertikal — meski secara kode `@media (max-width: 900px)` sudah ada sejak §-§ sebelumnya. Akar masalahnya BUKAN media query itu sendiri (sudah diverifikasi lewat headless browser di lebar 390px — konten memang ditumpuk benar), melainkan **urutan tumpukan yang tidak sesuai alur pakai**: `.panel-center` (chart + historical + SEMUA panel deviasi + tabel log, bisa >2500px tinggi untuk modul CEMS 40-tag) adalah SATU flex-item yang di-`order:1`, sehingga tag list (`order:2`, alat untuk MEMILIH tag) baru muncul setelah pengguna scroll melewati seluruh dinding kartu KPI/deviasi/log — dan `.module-kpi-bar` (di LUAR `.main-grid`) selalu tampil di paling atas sebelum grafik sama sekali, di semua lebar layar.

### Fix: pecah `.panel-center` + pindah ke CSS Grid dengan urutan sumber mobile-first

- **`css/style.css`**: `.main-grid` diganti dari `display:flex` jadi `display:grid` dengan `grid-template-areas` 3-kolom (`tags chart values` / `tags kpi values` / `tags extra values`) di desktop. `.panel-center` dipecah jadi **`.panel-chart`** (toolbar + notice + chart-wrap saja) dan **`.panel-extra`** (historical-panel + module-deviation-area + module-log-wrap), keduanya jadi grid-item terpisah. `.module-kpi-bar` juga dipindah JADI CHILD `.main-grid` (grid-area `kpi`) alih-alih sibling di luar grid.
- **`trend_so2.html` / `trend_fegt.html` / `trend_cems.html`**: DOM ditulis ulang dalam urutan SUMBER mobile-first — `panel-chart` → `panel-tags` → `panel-details` (values) → `module-kpi-bar` → `panel-extra`. Di mobile (`@media max-width:900px`, `.main-grid{display:block}`), urutan tampil otomatis mengikuti urutan sumber ini — TIDAK ada lagi trik `order` yang gampang meleset. Di desktop, `grid-template-areas` menata ulang jadi 3 kolom klasik seperti sebelumnya.
- Hasil verifikasi (headless, viewport 390×844 & 1440×900, `trend_cems.html`): urutan mobile persis **1. grafik trend → 2. pilihan tag → 3. data (VALUES) tag yang dipilih → 4. sisanya (KPI cards, kontrol historical, panel deviasi, tabel log)**; desktop tetap 3 kolom (tags | chart+kpi+extra | values), tidak ada regresi. `panel-tags`/`panel-details` tetap `position:sticky` di desktop.
- Kelas `.panel-center` yang sudah tidak dipakai HTML sempat tertinggal 1 baris di `css/dcs-theme.css` (`.panel-center{background:...}`) — diganti `.panel-chart, .panel-extra` supaya kedua panel baru tidak transparan.

### Polish visual ("mewah"/profesional, tema tetap putih)

- `--shadow-card` diperkaya jadi 2 layer, ditambah `--shadow-card-hover` untuk elevasi saat hover (dipakai di `.tag-row`, `.kpi-card`, `.deviation-panel`, `.load-btn`).
- Border-radius dinaikkan (2–4px → 6–8px) di seluruh kontrol interaktif (`.tag-row`, `.icon-btn`, `.range-btn`, `.mode-btn`, `.load-btn`, `.value-row`, input search/date/time) + transisi hover yang lebih halus.
- `.kpi-card` dapat aksen garis kiri (pola sama dengan `.hub-card`) + hover elevation. `.topbar` dan `.tag-search-wrap input` dapat sentuhan gradient/focus-ring tipis.
- **`index.html` (hub) dirombak signifikan**: ditambah slim brand bar di atas (konsisten dengan `.topbar` halaman modul, supaya hub & modul terasa satu aplikasi), judul diperbesar dengan aksen gradient teks, baris ringkasan angka (`hub-stats`: jumlah modul aktif, total tag, sumber data), kartu modul dapat monogram berwarna (SO2/FG/CE) sesuai `--card-accent`, border-radius & shadow kartu diperkaya, kartu slot kosong dapat ikon "+". Diverifikasi tampilan mobile (390px) sudah menyerupai desktop (cuma ditumpuk 1 kolom), sesuai permintaan.

File terdampak: `css/style.css`, `css/dcs-theme.css`, `index.html`, `trend_so2.html`, `trend_fegt.html`, `trend_cems.html`.

---

## 19. Sesi ini — Perbaikan lanjutan mobile: toolbar/KPI 1 baris, urutan tag list, hub tanpa garis grid

User memberi feedback via screenshot beranotasi pada tampilan mobile `trend_so2.html` (masih versi SEBELUM §18 live/ter-deploy): toolbar chart + kartu KPI wrap jadi banyak baris dan mendorong grafik jauh ke bawah, TAG LIST (pilihan tag) muncul sebelum kontrol rentang waktu padahal harusnya setelah, dan ada celah kosong di layout kolom (gejala bug "3 kolom desktop diperkecil" yang sama seperti §18, belum sempat dicoba user setelah fix).

### Urutan mobile diperbarui

Ditambah 1 grid-area baru: `.panel-historical` (berisi `#historicalPanel` — quick range s/d 90D, 1/2/3 TAHUN, custom, LOAD DATA), dipisah dari `.panel-extra` (kini cuma deviasi + log). Urutan sumber HTML (dipakai apa adanya di mobile lewat `display:block`) sekarang:

1. **Chart** (`.panel-chart`)
2. **Historical** (`.panel-historical`) — rentang waktu + LOAD DATA
3. **Tags** (`.panel-tags`) — pilihan tag (sesuai permintaan: setelah rentang waktu, bukan sebelumnya)
4. **Values** (`.panel-details`) — data tag yang dipilih
5. **KPI + Extra** (`.module-kpi-bar`, `.panel-extra`) — sisanya

Desktop menambah 1 baris di `grid-template-areas` untuk `historical` di kolom tengah (`tags chart/kpi/historical/extra values`), tidak mengubah urutan yang sudah ada.

### Toolbar & KPI jadi 1 baris (scroll horizontal)

`.chart-toolbar` dan `.kpi-group-row` di mobile diubah dari `flex-wrap:wrap` (yang bikin tombol EXPORT/kartu KPI wrap ke banyak baris) jadi `flex-wrap:nowrap; overflow-x:auto` — 1 baris yang bisa digeser horizontal, sama seperti pola toolbar aplikasi mobile pada umumnya. Ditemukan bug cascade saat implementasi: `.kpi-group-row{flex-wrap:wrap}` sempat didefinisikan TANPA media query di `dcs-theme.css` yang di-load SETELAH `style.css` — aturan itu menang atas override mobile di `style.css` meski spesifisitasnya sama (unconditional rule yang di-load belakangan mengalahkan aturan bersyarat media query yang di-load duluan, pada spesifisitas yang sama). Fix: pindahkan definisi layout (`display/gap/flex-wrap`) `.kpi-group-row` sepenuhnya ke `style.css` (base rule, sebelum media query) — `dcs-theme.css` seharusnya cuma untuk warna/tema, bukan layout.

### Hub `index.html`: hapus pola garis grid + navigasi balik ke dashboard

Background pola garis grid teknik (`linear-gradient` 28px×28px) di halaman hub dihapus — dinilai user kelihatan "berisik"/kurang premium. Diganti background polos. Brand bar hub ditambah link "← Dashboard Utama" (`../index.html`, dashboard PM Diagnostic System root — sebelumnya cuma bisa MASUK ke `trend/` dari sana, tidak ada jalan pulang) plus jam berjalan (format sama dengan `topbar-clock` di `trend_*.html`, lewat script kecil berdiri sendiri karena hub tidak pakai `ui-manager.js`).

File terdampak: `css/style.css`, `css/dcs-theme.css`, `index.html`, `trend_so2.html`, `trend_fegt.html`, `trend_cems.html`.

---

## 21. Sesi ini — CEMS: gabung semua frequency jadi 1 trend per parameter (bukan dipisah per tab)

### Masalah

User menjelaskan: pemisahan CEMS jadi 4-5 tab per frequency (2-Weekly #1/#2, Monthly, 3-Monthly, 2-Yearly — masing-masing tab dapat SET TAG ID SENDIRI, jadi 40-50 tag total) itu **salah secara proses**. Frequency yang dipilih di Step 1 form (`cems_calibration.html`) cuma menentukan **pekerjaan tambahan** (checklist inspeksi Step 9-11) yang ikut dikerjakan saat kunjungan itu — pengukuran kalibrasi Zero/Span1/Span2 (Before/After) sendiri **sama** untuk semua frequency. Akibat pemisahan per tab: 1 rangkaian kalibrasi yang harusnya jadi 1 trend panjang malah terpecah jadi banyak trend pendek (bahkan 2-Weekly sendiri masih dibagi lagi jadi slot ganjil/genap) — makanya trend tidak pernah kelihatan terbentuk meski sudah banyak record tersimpan (lihat §20).

### Fix

- **`config/default-tags-cems.js`**: 40 tag (10 parameter × 4 tab) diringkas jadi **10 tag** (1 per parameter: `CEMS-SO2-ZERO`, `CEMS-SO2-SPAN1`, dst — tanpa suffix tab).
- **`js/adapters/cems-adapter.js`**: `TABS` (grouping per frequency + slot ganjil/genap untuk 2-Weekly) dihapus total. Semua record CEMS diurutkan by waktu lalu diparse langsung ke 10 tag itu — SEMUA frequency masuk ke trend yang sama. `frequency` tetap dicatat di debug output tapi cuma sebagai info, tidak lagi menentukan tag tujuan.
- **`config/modules/cems.config.js`**: 5 module (`CEMS-WEEKLY-1/2`, `CEMS-MONTHLY`, `CEMS-3MONTHLY`, `CEMS-YEARLY`) diringkas jadi **1 module** (`CEMS`) — tab bar modul CEMS sekarang cuma 1 tab "CEMS Calibration" (pola sama dengan SO2 yang juga 1 tab).
- **`trend_cems.html`**: panel diagnostik (`#dcsDiagPanel`) disesuaikan — kolom "tab tujuan" dihapus, `frequency` ditampilkan sebagai info saja.
- **`index.html`** (hub): kartu CEMS diupdate (`10 tag`, deskripsi dijelaskan alasan digabung), total tag di ringkasan angka (`73`→`43`: SO2 2 + FEGT 31 + CEMS 10).

Diverifikasi via Playwright (5 record mock lintas frequency 2-Weekly/Monthly/3-Monthly + 1 draft meta-only): tab bar cuma 1 ("CEMS Calibration"), TAG LIST 10 tag, dan `CEMS-SO2-ZERO` benar menggabungkan 4 titik dari 3 frequency berbeda jadi 1 trend (sebelumnya akan terpecah ke 3-4 tag berbeda).

File terdampak: `config/default-tags-cems.js`, `config/modules/cems.config.js`, `js/adapters/cems-adapter.js`, `trend_cems.html`, `index.html`.

---

## 22. Sesi ini — Fix urutan waktu trend: pakai `tanggal` (tanggal kejadian), bukan `updated_at`

### Masalah

Setelah §21 (CEMS digabung jadi 1 trend), user masih lihat titik-titik menumpuk di 1-2 posisi waktu saja padahal panel diagnostik menunjukkan banyak record (tanggal kejadian berbeda-beda, April–Agustus). Root cause: `SupabaseAdapter.recordTimestamp()` — dipakai SEMUA adapter (SO2/FEGT/CEMS) untuk menentukan posisi sumbu-X di trend — mendahulukan `updated_at` (kapan record TERAKHIR disimpan ke Supabase) di atas `tanggal` (tanggal kejadian kalibrasi/inspeksi yang diisi manual teknisi). Beberapa draft CEMS lama sempat dibuka & disimpan ulang di hari yang sama (`updated_at` jadi hampir sama semua, ~2026-08-07), walau `tanggal` kejadian aslinya beda-beda berbulan-bulan — trend jadi numpuk di 1-2 titik waktu (waktu save-nya), bukan tersebar sesuai tanggal kalibrasi yang sebenarnya.

### Fix

`recordTimestamp()` dibalik urutannya: `r.tanggal || r.updated_at || r.created_at` — tanggal kejadian didahulukan, `updated_at`/`created_at` cuma fallback kalau `tanggal` kosong/tidak valid. Ini fix di level `js/supabase-adapter.js` (dipakai bersama), jadi berlaku otomatis untuk SO2/FEGT/CEMS sekaligus.

Diverifikasi via Playwright: 8 record mock dengan `tanggal` tersebar April–Agustus tapi `updated_at` numpuk di 1-2 timestamp — sebelum fix akan collapse ke 1-2 titik; setelah fix, posisi tiap titik di trend benar mengikuti `tanggal` masing-masing record (dicek dengan filter rentang "3 TAHUN": 2 record `tanggal` 2026-04-16 & 2026-05-26 muncul benar di posisi masing-masing meski `updated_at` keduanya sama).

File terdampak: `js/supabase-adapter.js`, cache-busting `trend_so2.html`/`trend_fegt.html`/`trend_cems.html` (`?v=20260827c` khusus `supabase-adapter.js`).

---

## 23. Sesi ini — Semua tag tercentang default + label tanggal panel deviasi dirotasi

### 1. Semua tag tercentang otomatis saat halaman dibuka

Sebelumnya tiap modul cuma menyalakan 1-2 tag default (`visible: true`) supaya chart tidak langsung penuh — user minta SEMUA tag tercentang dari awal (berlaku untuk semua modul: SO2, FEGT, CEMS). `default-tags-fegt.js` (31 tag) dan `default-tags-cems.js` (10 tag) diubah semua entrinya jadi `visible: true` (SO2 sudah begitu dari awal, 2 tag). Checkbox di TAG LIST tetap berfungsi normal untuk menyembunyikan tag yang tidak diperlukan.

### 2. Label tanggal panel mini deviasi dirotasi (sama gaya dengan chart utama)

Panel mini "Deviasi Actual − Expected" (`js/module-view.js` → `ChartManager.renderDeviationChart`) sebelumnya pakai `timeFormatter` (format tanggal+jam, mis. "22/06 09:16") TANPA rotasi label — begitu titik data banyak & berdekatan, label sumbu-X saling tumpang tindih jadi tidak terbaca (terlihat di screenshot user: deretan angka menyatu). Chart utama sudah lebih dulu menangani ini dengan `dateAxisFormatter` (tanggal saja, tanpa jam) + `rotate: 35` + `hideOverlap: true` — pola yang sama sekarang diterapkan ke `renderDeviationChart`. `grid.bottom` dinaikkan (22→36) dan tinggi kontainer `.deviation-panel-chart` (110-120px → 130-140px) supaya label miring itu punya cukup ruang, tidak terpotong.

Diverifikasi via Playwright: tag checkbox 10/10 (CEMS) dan 21/21+10 (FEGT) tercentang saat load; `xAxis.axisLabel` panel deviasi menunjukkan `rotate:35, hideOverlap:true` dan formatter menghasilkan `"6/22/2026"` (bukan lagi `"22/06 09:16"`).

File terdampak: `config/default-tags-fegt.js`, `config/default-tags-cems.js`, `js/chart-manager.js`, `css/dcs-theme.css`, `css/style.css`.

---

## 24. Sesi ini — Fix panel deviasi CEMS kosong (blank) setelah semua tag tercentang default (§23)

### Masalah

Setelah §23 (semua tag tercentang default), user lapor: panel "Deviasi Actual − Expected" di halaman CEMS jadi banyak kolom (10, sesuai 10 tag) tapi AREA GRAFIKNYA KOSONG (cuma judul + deskripsi yang muncul, chart-nya blank putih) — padahal SO2 (2 tag) tetap normal. "harusnya tetap seperti so2, bukan malah jadi banyak kolom akhirnya datanya jadi hilang di cems."

### Root cause

`js/module-view.js` → `renderDeviationPanels()` selalu mengosongkan (`innerHTML=''`) lalu membangun ULANG seluruh DOM panel deviasi setiap kali data historical dimuat ulang (event `dcsHistoricalLoadEnd`) — dan event ini terpicu SETIAP KALI klik tombol quick-range (mis. "3 TAHUN") ATAU tombol "LOAD DATA", masing-masing independen. Jadi urutan klik "3 TAHUN" lalu "LOAD DATA" = 2x render ulang panel deviasi berturut-turut.

`js/chart-manager.js` → `renderDeviationChart(domId, ...)` men-cache instance ECharts per `domId` di object `deviationCharts`. Karena `domId` (string) dipakai ulang sama persis di setiap render ulang, pass render KEDUA menemukan instance lama di cache dan langsung pakai `.setOption()` ke situ — padahal DOM element lama sudah di-detach (dihapus lewat `innerHTML=''`) dan diganti element BARU dengan id yang sama. Hasilnya: chart "berhasil" di-render tapi ke element yang sudah tidak ada di halaman, sementara container yang benar-benar terlihat di layar tidak pernah dapat instance ECharts sama sekali → tetap kosong.

Kenapa CEMS lebih kena dibanding SO2: bukan soal jumlah tag (2 vs 10), tapi soal peluang — makin banyak panel & makin sering trigger render ulang (quick-range + LOAD DATA yang biasa diklik berurutan saat eksplorasi rentang waktu), makin gampang kena celah dobel-render ini. Bug ini sebenarnya laten di SEMUA modul (SO2/FEGT/CEMS), bukan spesifik CEMS — cuma kebetulan lebih sering kelihatan efeknya di CEMS.

### Fix

`renderDeviationChart()` sekarang cek apakah instance ECharts yang di-cache masih menempel ke DOM element yang sedang dipakai (`inst.getDom() !== domEl`). Kalau sudah tidak sama (element lama sudah diganti/di-detach), instance lama di-`dispose()` dulu baru dibuat instance baru via `echarts.init(domEl, ...)`. Fix ini di level `js/chart-manager.js` (dipakai bersama), jadi berlaku otomatis untuk SO2/FEGT/CEMS sekaligus, mencegah bug ini muncul di modul lain juga (walau baru kelihatan gejalanya di CEMS).

Diverifikasi via Playwright dengan ECharts asli (bukan stub) — reproduksi persis urutan klik user (quick range "3 TAHUN" → "LOAD DATA" → "LOAD DATA" lagi buat stress-test reload berulang): sebelum fix, panel `CEMS-SO2-ZERO/SPAN1/SPAN2` kosong (`childCount:0`, tidak ada `<canvas>`); setelah fix, ke-10 panel CEMS punya `<canvas>` dan grafik garis deviasi tampil normal di setiap reload.

File terdampak: `js/chart-manager.js`; cache-busting `?v=20260827e` untuk `chart-manager.js` di `trend_so2.html`/`trend_fegt.html`/`trend_cems.html`.
