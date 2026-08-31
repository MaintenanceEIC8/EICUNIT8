/**
 * ==========================================================================
 * HISTORICAL ADAPTER — READ-ONLY (Firestore / project eic8-3d7f1)
 * ==========================================================================
 * Menggantikan js/supabase-adapter.js. Trend System sekarang membaca record
 * `pm_records` LANGSUNG dari Firestore project eic8-3d7f1 — project yang sama
 * dipakai seluruh check sheet Instrument (lihat ../firebase-config.js). Tidak
 * ada lagi Supabase.
 *
 * Modul ini SENGAJA hanya GET (tidak ada create/update/delete) — Trend hanya
 * membaca hasil PM/kalibrasi, bukan mengubahnya.
 *
 * KOMPATIBILITAS: object global tetap diexpose sebagai `window.SupabaseAdapter`
 * (plus alias `window.HistoricalAdapter`) dengan method yang PERSIS sama
 * (fetchRecords / fetchByModulAndRange / normalizeModul / recordTimestamp),
 * jadi historical-manager.js dan js/adapters/*-adapter.js TIDAK perlu diubah.
 *
 * BENTUK DATA: dokumen `pm_records` di Firestore menyimpan kolom `data`
 * sebagai STRING JSON (bukan map bersarang) — di sini di-parse balik ke
 * object supaya adapter modul (so2/cems yang baca r.data.analyzer /
 * r.data.zero) tetap jalan tanpa perubahan. Sama seperti pmDocToRec() di
 * ../shared.js.
 * ==========================================================================
 */
(function () {
  'use strict';

  var CFG = (window.DCS_CONFIG && window.DCS_CONFIG.HISTORICAL_SOURCE) || {};
  var COLLECTION = CFG.COLLECTION || 'pm_records';
  var FETCH_LIMIT = CFG.FETCH_LIMIT || 3000;

  // Sentinel karakter tertinggi — dipakai Firestore utk range/prefix match
  // (`modul >= key` && `modul < key + HI_SENTINEL`).
  var HI_SENTINEL = String.fromCharCode(0xf8ff);

  function getDb() {
    // `db` di-set oleh ../firebase-config.js (window.db = firebase.firestore()).
    if (typeof window.db !== 'undefined' && window.db) return window.db;
    if (typeof db !== 'undefined' && db) return db; // eslint-disable-line no-undef
    throw new Error(
      '[HistoricalAdapter] Firestore belum siap — pastikan firebase-app-compat.js, ' +
      'firebase-firestore-compat.js, dan ../firebase-config.js dimuat SEBELUM file ini.'
    );
  }

  /* Firestore doc -> bentuk "row" yang dipakai adapter modul (dulu dari
     PostgREST Supabase). `data` string JSON -> object. */
  function docToRec(doc) {
    var d = doc.data() || {};
    d.id = doc.id;
    if (typeof d.data === 'string') {
      try { d.data = JSON.parse(d.data); } catch (e) { d.data = {}; }
    }
    return d;
  }

  /* Parse sintaks PostgREST `alias:data->key` dari selectColumns adapter
     (dipakai fegt-adapter.js: 'paths:data->paths,leakPaths:data->leakPaths').
     Firestore tidak bisa project sub-field di dalam string JSON, jadi kita
     ambil dokumen penuh lalu ratakan sub-path yang diminta ke top-level
     (r.paths, r.leakPaths) dan BUANG r.data yang berat — meniru efek
     select PostgREST lama supaya parser fegt (yang baca r.paths, bukan
     r.data.paths) tidak perlu diubah. */
  function parseDataProjection(selectColumns) {
    var out = [];
    if (!selectColumns || selectColumns.indexOf('->') === -1) return out;
    selectColumns.split(',').forEach(function (tok) {
      tok = tok.trim();
      var m = /^([A-Za-z0-9_]+)\s*:\s*data->>?([A-Za-z0-9_]+)$/.exec(tok);
      if (m) out.push({ alias: m[1], key: m[2] });
    });
    return out;
  }

  function applyProjection(rows, proj) {
    if (!proj.length) return rows;
    rows.forEach(function (r) {
      var obj = r.data || {};
      proj.forEach(function (p) { r[p.alias] = obj[p.key]; });
      delete r.data; // lepas payload besar (foto base64) — sama seperti select PostgREST lama
    });
    return rows;
  }

  /**
   * Ambil seluruh record pm_records (dibatasi FETCH_LIMIT), terbaru dulu.
   * Dipertahankan untuk kompatibilitas — konsumen aktif memakai
   * fetchByModulAndRange().
   */
  function fetchRecords() {
    return getDb().collection(COLLECTION)
      .orderBy('updated_at', 'desc')
      .limit(FETCH_LIMIT)
      .get()
      .then(function (snap) { return snap.docs.map(docToRec); })
      .catch(function (err) {
        console.error('[HistoricalAdapter] fetchRecords error:', err);
        throw err;
      });
  }

  /** Normalisasi nama modul supaya varian penulisan tetap cocok. */
  function normalizeModul(name) {
    if (!name) return '';
    var n = String(name).toUpperCase();
    if (n.indexOf('SO2') >= 0 || n.indexOf('SCRUBBER') >= 0) return 'SO2';
    return n;
  }

  /**
   * Ambil record `pm_records` untuk 1 modul + rentang waktu.
   *
   * Supabase dulu memakai `modul=ilike.*<key>*` (substring, server-side).
   * Firestore tidak punya substring match, jadi dipakai PREFIX match
   * (`modul >= key` && `modul < key + HI_SENTINEL`) — cukup karena tiap form
   * menyimpan `modul` diawali key-nya ('SO2 Scrubber Inlet',
   * 'FEGT & Leak Detection', 'CEMS Calibration'). Query 1-field range =
   * ter-index otomatis, tidak butuh composite index bikinan tangan.
   * Filter rentang waktu tetap di client (recordTimestamp bisa jatuh ke
   * `tanggal`/`created_at` yang tak selalu bisa jadi 1 kondisi query).
   *
   * @param {string} modulKey
   * @param {number} startTime  epoch ms
   * @param {number} endTime    epoch ms
   * @param {string} [selectColumnsOverride]  sintaks PostgREST lama; hanya
   *   klausa `alias:data->key` yang dipakai (lihat parseDataProjection).
   */
  function fetchByModulAndRange(modulKey, startTime, endTime, selectColumnsOverride) {
    var proj = parseDataProjection(selectColumnsOverride);
    return getDb().collection(COLLECTION)
      .where('modul', '>=', modulKey)
      .where('modul', '<', modulKey + HI_SENTINEL)
      .limit(FETCH_LIMIT)
      .get()
      .then(function (snap) {
        if (snap.size >= FETCH_LIMIT) {
          console.warn('[HistoricalAdapter] modul "' + modulKey + '" mentok di FETCH_LIMIT (' +
            FETCH_LIMIT + ') — sebagian record lama mungkin tidak ikut ter-fetch.');
        }
        var rows = snap.docs.map(docToRec);
        applyProjection(rows, proj);
        rows = rows.filter(function (r) {
          var t = recordTimestamp(r);
          if (t === null) return false;
          if (startTime && t < startTime) return false;
          if (endTime && t > endTime) return false;
          return true;
        });
        rows.sort(function (a, b) { return (recordTimestamp(b) || 0) - (recordTimestamp(a) || 0); });
        return rows;
      })
      .catch(function (err) {
        console.error('[HistoricalAdapter] fetchByModulAndRange error:', err);
        throw err;
      });
  }

  /**
   * `tanggal` didahulukan — itu tanggal KEJADIAN (kalibrasi/inspeksi) yang
   * diisi manual oleh teknisi, sumber kebenaran untuk posisi waktu di trend.
   * `updated_at`/`created_at` cuma metadata kapan record terakhir disimpan.
   */
  function recordTimestamp(r) {
    var raw = r.tanggal || r.updated_at || r.created_at;
    if (!raw) return null;
    var t = new Date(raw).getTime();
    return isNaN(t) ? null : t;
  }

  var api = {
    fetchRecords: fetchRecords,
    fetchByModulAndRange: fetchByModulAndRange,
    normalizeModul: normalizeModul,
    recordTimestamp: recordTimestamp
  };

  window.HistoricalAdapter = api;
  window.SupabaseAdapter = api; // alias kompatibilitas — historical-manager.js & adapters/*
})();
