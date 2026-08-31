/* ═══════════════════════════════════════════════════════
   SHARED.JS — Common utilities untuk semua modul PM Unit 7
   ═══════════════════════════════════════════════════════ */

/* ── GATE AKSES — DINONAKTIFKAN ──
   Atas permintaan user, gerbang password "Akses Terbatas" (Trusted Device)
   untuk departemen Instrument DIHAPUS: halaman langsung terbuka tanpa minta
   password. Elemen gate (#pmAuthGate + style #pmGateHideStyle) tidak lagi
   ditulis ke dokumen, dan pmInitGate() tidak lagi dipanggil (lihat di bawah).

   Fungsi pendukung (pmInitGate, pmUnlockGate, pmCheckAccessRemote,
   pmTrackPresence, raInitSiteGate, dst) SENGAJA TIDAK dihapus supaya alur
   lain yang memakainya tetap aman — khususnya raRequireLogin (login akun
   checker/SPV saat tanda tangan laporan), yang TIDAK terpengaruh perubahan
   ini. ── */

/* ── POLYFILLS (old Android Chrome) ── */
if (!Object.entries) {
  Object.entries = function(obj) {
    var keys = Object.keys(obj), arr = [];
    for (var i = 0; i < keys.length; i++) arr.push([keys[i], obj[keys[i]]]);
    return arr;
  };
}
if (!Object.assign) {
  Object.assign = function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  };
}
if (!Array.from) { Array.from = function(arr) { return Array.prototype.slice.call(arr); }; }
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function(fn) {
    for (var i = 0; i < this.length; i++) if (fn(this[i], i)) return i;
    return -1;
  };
}
if (!Array.prototype.find) {
  Array.prototype.find = function(fn) {
    for (var i = 0; i < this.length; i++) if (fn(this[i], i)) return this[i];
    return undefined;
  };
}
if (!Array.prototype.includes) { Array.prototype.includes = function(v) { return this.indexOf(v) !== -1; }; }
if (!String.prototype.includes) { String.prototype.includes = function(s) { return this.indexOf(s) !== -1; }; }
if (!String.prototype.startsWith) { String.prototype.startsWith = function(s) { return this.indexOf(s) === 0; }; }
if (!String.prototype.endsWith) { String.prototype.endsWith = function(s) { return this.slice(-s.length) === s; }; }
if (!String.prototype.padStart) {
  String.prototype.padStart = function(len, ch) {
    var s = String(this); ch = ch || ' ';
    while (s.length < len) s = ch + s;
    return s;
  };
}
if (!String.prototype.padEnd) {
  String.prototype.padEnd = function(len, ch) {
    var s = String(this); ch = ch || ' ';
    while (s.length < len) s = s + ch;
    return s;
  };
}
if (!Number.isNaN) { Number.isNaN = function(v) { return typeof v === 'number' && isNaN(v); }; }
if (!Number.isInteger) { Number.isInteger = function(v) { return typeof v === 'number' && Math.floor(v) === v; }; }

/* ── FIREBASE BACKEND (Firestore) ──
   Dulu modul ini pakai Supabase (tabel pm_records dkk). Sekarang SELURUHNYA
   jalan di Firebase project milik user sendiri (eic8-3d7f1) -- lihat
   firebase-config.js, yang WAJIB dimuat sebelum shared.js (window.db =
   firebase.firestore()). Tidak ada lagi Supabase / project Firebase lain.

   Model kepercayaan sama seperti Electric: TIDAK ada auth per-request untuk
   data check sheet (rules Firestore terbuka penuh, gating cuma di sisi
   aplikasi). Alur review/approval (ReportAuthManager, prefix "ra") memakai
   Firebase Auth email/password -- lihat _raGetAuth() di bawah. */
var PM_COLLECTION = 'pm_records';

/* Firestore doc -> bentuk "row" yang dipakai kode lama (dulu dari PostgREST).
   Kolom `data` disimpan sebagai STRING JSON di Firestore (bukan map bersarang)
   supaya bebas dari batasan nama-key Firestore -- di-parse balik ke object di
   sini. skipData=true dipakai dbList()/history (tidak perlu payload berat). */
function pmDocToRec(doc, skipData) {
  var d = doc.data() || {};
  d.id = doc.id;
  if (!skipData && typeof d.data === 'string') {
    try { d.data = JSON.parse(d.data); } catch (e) { d.data = {}; }
  }
  return d;
}
function pmSerializeRec(rec) {
  var out = {};
  Object.keys(rec).forEach(function(k){ if (rec[k] !== undefined) out[k] = rec[k]; });
  if (out.data !== undefined && typeof out.data !== 'string') out.data = JSON.stringify(out.data);
  return out;
}
/* Helper CRUD pm_records -- semua me-return Promise yang resolve ke bentuk
   array (mirip respons PostgREST lama) supaya call site berubah seminimal
   mungkin: [] kosong, atau [{id:...}] / [rec]. */
function pmDbGet(id) {
  return db.collection(PM_COLLECTION).doc(id).get()
    .then(function(s){ return s.exists ? [pmDocToRec(s)] : []; });
}
function pmDbList() {
  return db.collection(PM_COLLECTION).orderBy('updated_at', 'desc').limit(100).get()
    .then(function(q){ return q.docs.map(function(d){ return pmDocToRec(d, true); }); });
}
function pmDbInsert(rec) {
  var payload = pmSerializeRec(rec);
  payload.created_at = payload.created_at || new Date().toISOString();
  if (payload.status === undefined) payload.status = 'DRAFT';
  if (payload.firebase_synced_at === undefined) payload.firebase_synced_at = null;
  return db.collection(PM_COLLECTION).add(payload).then(function(ref){ return [{ id: ref.id }]; });
}
function pmDbUpdate(id, patch) {
  return db.collection(PM_COLLECTION).doc(id).set(pmSerializeRec(patch), { merge: true })
    .then(function(){ return [{ id: id }]; });
}
function pmDbDelete(id) {
  return db.collection(PM_COLLECTION).doc(id).delete().then(function(){ return []; });
}

/* ── pmRest: penerjemah subset PostgREST -> Firestore ──
   Dipakai halaman standalone (outage-*, material-warehouse, device-admin,
   checksheet-temperature/level-switch) yang dulu punya `supaFetch(method,
   path, body)` sendiri. Mereka cukup mengganti definisi lokalnya jadi
   `var supaFetch = pmRest;`.

   Didukung:
     GET   TABLE?select=...&col=eq.val&col=is.null&col=in.(a,b)&order=col.desc&limit=N&offset=M
     POST  TABLE            (body object -> .add(); return [{id,...body}])
     PATCH TABLE?id=eq.X    (atau col=eq.X -> query lalu update semua)
     DELETE TABLE?id=eq.X | id=in.(...) | col=eq.X
   Return: Promise -> array (mirip PostgREST Prefer: return=representation).
   TIDAK didukung: or=(...) ilike (cari teks) -> tangani sisi klien di
   halaman ybs; Range/Content-Range -> pakai query .count() langsung. */
function _pmRestVal(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v; // biarkan string -- jangan paksa jadi number (tipe field Firestore harus persis)
}
function pmRest(method, path, body) {
  method = String(method || 'GET').toUpperCase();
  var qi = path.indexOf('?');
  var table = qi === -1 ? path : path.slice(0, qi);
  var qs = qi === -1 ? '' : path.slice(qi + 1);
  var params = {};
  var filters = [];
  qs.split('&').forEach(function(kv) {
    if (!kv) return;
    var eq = kv.indexOf('=');
    var k = decodeURIComponent(kv.slice(0, eq));
    var v = decodeURIComponent(kv.slice(eq + 1));
    if (k === 'select' || k === 'order' || k === 'limit' || k === 'offset' || k === 'or') { params[k] = v; return; }
    var dot = v.indexOf('.');
    filters.push({ col: k, op: v.slice(0, dot), val: v.slice(dot + 1) });
  });
  var coll = db.collection(table);

  if (method === 'GET') {
    var q = coll;
    filters.forEach(function(f) {
      if (f.op === 'eq') q = q.where(f.col, '==', _pmRestVal(f.val));
      else if (f.op === 'neq') q = q.where(f.col, '!=', _pmRestVal(f.val));
      else if (f.op === 'gt') q = q.where(f.col, '>', _pmRestVal(f.val));
      else if (f.op === 'gte') q = q.where(f.col, '>=', _pmRestVal(f.val));
      else if (f.op === 'lt') q = q.where(f.col, '<', _pmRestVal(f.val));
      else if (f.op === 'lte') q = q.where(f.col, '<=', _pmRestVal(f.val));
      else if (f.op === 'is') q = q.where(f.col, '==', _pmRestVal(f.val));
      else if (f.op === 'in') {
        var arr = f.val.replace(/^\(|\)$/g, '').split(',').map(function(x) { return _pmRestVal(x.replace(/^"|"$/g, '')); });
        q = q.where(f.col, 'in', arr);
      }
    });
    if (params.order) {
      var od = params.order.split(',')[0].split('.');
      q = q.orderBy(od[0], od[1] === 'desc' ? 'desc' : 'asc');
    }
    var offset = parseInt(params.offset, 10) || 0;
    var limit = parseInt(params.limit, 10) || 0;
    if (limit) q = q.limit(offset + limit); // Firestore tak punya offset -> ambil sampai offset+limit, potong di klien
    return q.get().then(function(snap) {
      var rows = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      if (offset) rows = rows.slice(offset);
      return rows;
    });
  }

  if (method === 'POST') {
    var recs = Array.isArray(body) ? body : [body];
    return Promise.all(recs.map(function(rec) {
      return coll.add(rec).then(function(ref) { return Object.assign({ id: ref.id }, rec); });
    }));
  }

  // PATCH / DELETE -> cari doc target dari filter
  var locate;
  var idEq = filters.filter(function(f) { return f.col === 'id' && f.op === 'eq'; })[0];
  var idIn = filters.filter(function(f) { return f.col === 'id' && f.op === 'in'; })[0];
  if (idEq) {
    locate = Promise.resolve([coll.doc(idEq.val)]);
  } else if (idIn) {
    locate = Promise.resolve(idIn.val.replace(/^\(|\)$/g, '').split(',').map(function(x) { return coll.doc(x.trim()); }));
  } else {
    var wq = coll;
    filters.forEach(function(f) { if (f.op === 'eq') wq = wq.where(f.col, '==', _pmRestVal(f.val)); });
    locate = wq.get().then(function(snap) { return snap.docs.map(function(d) { return d.ref; }); });
  }

  if (method === 'PATCH') {
    return locate.then(function(refs) {
      return Promise.all(refs.map(function(r) { return r.set(body, { merge: true }); }))
        .then(function() { return refs.map(function(r) { return { id: r.id }; }); });
    });
  }
  if (method === 'DELETE') {
    return locate.then(function(refs) {
      return Promise.all(refs.map(function(r) { return r.delete(); })).then(function() { return []; });
    });
  }
  return Promise.reject(new Error('pmRest: metode tidak didukung: ' + method));
}

/* ── FIREBASE AUTH (lazy-loaded) ──
   Dipakai KHUSUS oleh ReportAuthManager (raLogin/raGetCurrentProfile/dst) --
   checker/reviewer/SPV login akun sungguhan buat menandatangani laporan.
   firebase-auth-compat dimuat on-demand supaya halaman yang tidak memakai
   alur review/approval tidak ikut menambah beban load. */
var _raAuthPromise = null;
function _raGetAuth() {
  if (_raAuthPromise) return _raAuthPromise;
  _raAuthPromise = new Promise(function(resolve, reject) {
    if (firebase && firebase.auth) { resolve(firebase.auth()); return; }
    var s = document.createElement('script');
    s.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js';
    s.onload = function() { try { resolve(firebase.auth()); } catch (e) { reject(e); } };
    s.onerror = function() { reject(new Error('Gagal memuat firebase-auth dari CDN')); };
    document.head.appendChild(s);
  });
  return _raAuthPromise;
}

/* ── GOOGLE DRIVE PHOTO STORAGE ──
   Upload foto PM ke Google Drive lewat Apps Script Web App. Fungsi ini
   PROMISE-BASED dan, kalau parameter `entry` (object foto) dikasih, otomatis
   nempelin hasilnya ke entry itu sendiri:
     entry.driveUrl    -> https://lh3.googleusercontent.com/d/FILE_ID (link
                           gambar langsung, bisa dipasang di <img src> ATAU
                           di-fetch buat diubah ke base64 pas generate PDF
                           dari histori lama)
     entry.driveFileId -> FILE_ID mentah, buat dihapus/direplace kalau foto
                           di-crop-ulang atau dihapus user
   `entry` TIDAK WAJIB diisi -- panggilan lama yang cuma kasih 4 argumen
   (dataUrlBase64, fileName, modul, keterangan) tetap jalan seperti biasa,
   cuma belum kebagian driveUrl-nya nempel otomatis.

   Upload tetap NON-BLOCKING (tidak nge-freeze UI pas user crop foto), tapi
   sekarang track-able: setiap panggilan didaftarkan ke _pmPendingDriveUploads
   supaya kode "Simpan ke Supabase" bisa nunggu (lihat waitForPendingDriveUploads
   di bawah) semua upload foto kelar dulu sebelum bikin payload -- jadi
   driveUrl-nya sudah pasti ada duluan pas record dikirim ke Supabase, bukan
   masih kosong karena kepotong buru-buru.

   Ganti GDRIVE_WEB_APP_URL kalau deployment Apps Script diganti/redeploy baru. */
var GDRIVE_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxyxAOQaIFkT9EZtTHfkjQeG3TlkLnEu2AKVyhUnguK7Td_zls1qL7IPB_hLsXTaLNBHA/exec';
var GDRIVE_SECRET_TOKEN = 'pmeicunit7-mahfud';

function gdriveFileIdToViewUrl(fileId) {
  return 'https://lh3.googleusercontent.com/d/' + fileId;
}

var _pmPendingDriveUploads = [];
/* Dipanggil sebelum dbCollectData/simpan-ke-Supabase, supaya nunggu semua
   upload foto yang masih berjalan kelar (baik sukses atau gagal) dulu.
   Tidak pernah reject -- upload yang gagal cuma bikin entry.driveUrl tetap
   kosong (nanti fallback ke dataUrl base64 di payload Supabase), bukan
   bikin proses Simpan ikut gagal total. */
function waitForPendingDriveUploads() {
  var pending = _pmPendingDriveUploads.slice();
  _pmPendingDriveUploads.length = 0;
  return Promise.all(pending.map(function(p){ return p.catch(function(){}); }));
}

/* ── FOTO: swap dataUrl (base64) <-> driveUrl, generik buat SEMUA modul ──
   Semua modul menyimpan foto sebagai object {name, dataUrl, type, caption,
   offsetX, widthCm, heightCm, driveUrl, driveFileId, ...} di dalam array,
   berapa pun level nesting-nya (sections[type][idx].images[], images[side][],
   dst). Karena bentuknya selalu konsisten, cukup ditangani SEKALI di sini
   (bukan per-modul) lewat dbSave/dbLoad -- kode render thumbnail & PDF
   export tiap modul TIDAK PERLU DIUBAH SAMA SEKALI, karena mereka selalu
   baca `dataUrl` seperti biasa dan tidak pernah tahu ada Drive di baliknya. */

/* Dipanggil dbSave() SEBELUM kirim ke Supabase: foto yang SUDAH punya
   driveUrl (artinya sudah aman tersimpan di Drive) -- dataUrl base64-nya
   (paling berat di payload) dibuang, cukup simpan driveUrl (string pendek).
   Foto yang upload Drive-nya gagal/belum kelar (driveUrl masih kosong)
   TETAP kirim dataUrl-nya apa adanya -- supaya tidak ada foto yang hilang. */
function _pmStripBase64ForSave(obj) {
  if (Array.isArray(obj)) { obj.forEach(_pmStripBase64ForSave); return; }
  if (!obj || typeof obj !== 'object') return;
  if (typeof obj.dataUrl === 'string' && obj.dataUrl.indexOf('data:') === 0 && obj.driveUrl) {
    obj.dataUrl = '';
  }
  Object.keys(obj).forEach(function(k){ _pmStripBase64ForSave(obj[k]); });
}

/* Dipanggil dbLoad() SETELAH ambil record dari Supabase: foto yang cuma
   punya driveUrl (dataUrl-nya sudah dibuang saat disimpan) di-fetch balik
   dari Drive lalu diubah ke base64, ditaruh lagi ke dataUrl. Return Promise
   yang resolve setelah SEMUA foto selesai dipulihkan (atau di-skip kalau
   fetch-nya gagal -- gagal ambil 1 foto tidak boleh bikin seluruh proses
   buka data gagal total, biarin foto itu kosong daripada nge-block semuanya). */
/* ── CACHE FOTO (IndexedDB) -- foto yang driveFileId-nya sama TIDAK PERNAH
   berubah isinya (lihat _pmGenUniqueDriveFileName: setiap slot foto = nama
   Drive unik permanen, foto yang di-crop ulang dapat driveFileId BARU,
   bukan overwrite yang lama) -- jadi begitu satu foto pernah di-download
   sekali di browser ini, aman disimpan permanen di cache lokal dan tidak
   perlu diambil ulang dari Drive lagi kapan pun laporan yang sama dibuka
   lagi. Database TERPISAH dari pm_unit7_autosave (draft recovery) supaya
   tidak saling ganggu skema/versioning-nya. */
var PHOTOCACHE_DB_NAME = 'pm_unit7_photocache';
var PHOTOCACHE_STORE   = 'photos';
var _photoCacheDbPromise = null;

function _photoCacheOpenDb() {
  if (_photoCacheDbPromise) return _photoCacheDbPromise;
  _photoCacheDbPromise = new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB tidak didukung browser ini')); return; }
    var req = indexedDB.open(PHOTOCACHE_DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(PHOTOCACHE_STORE)) db.createObjectStore(PHOTOCACHE_STORE, {keyPath:'fileId'});
    };
    req.onsuccess = function(e){ resolve(e.target.result); };
    req.onerror = function(e){ reject(e.target.error); };
  });
  return _photoCacheDbPromise;
}
// Tidak pernah reject -- cache itu murni optimasi, gagal baca/tulis cache
// TIDAK BOLEH menggagalkan proses ambil foto dari Drive yang sebenarnya.
function _photoCacheGet(fileId) {
  return _photoCacheOpenDb().then(function(db) {
    return new Promise(function(resolve) {
      try {
        var req = db.transaction(PHOTOCACHE_STORE, 'readonly').objectStore(PHOTOCACHE_STORE).get(fileId);
        req.onsuccess = function(){ resolve(req.result ? req.result.dataUrl : null); };
        req.onerror = function(){ resolve(null); };
      } catch (e) { resolve(null); }
    });
  }).catch(function(){ return null; });
}
function _photoCacheSet(fileId, dataUrl) {
  return _photoCacheOpenDb().then(function(db) {
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction(PHOTOCACHE_STORE, 'readwrite');
        tx.objectStore(PHOTOCACHE_STORE).put({fileId: fileId, dataUrl: dataUrl, cachedAt: Date.now()});
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ resolve(); };
      } catch (e) { resolve(); }
    });
  }).catch(function(){});
}

/* Ambil 1 file Drive sebagai base64 lewat Apps Script (action:'get') --
   BUKAN fetch() langsung ke lh3.googleusercontent.com (itu kena CORS, lihat
   catatan di _pmRestoreBase64AfterLoad). Cek cache lokal DULU (lihat blok
   CACHE FOTO di atas) -- kalau ketemu, tidak perlu roundtrip ke Apps Script
   sama sekali. Tidak pernah reject -- gagal ambil 1 foto (setelah semua
   percobaan) cukup bikin foto itu kosong, tidak boleh gagalkan proses lain.
   Retry sampai 3x kalau gagal -- ditemukan (lewat pengujian nyata, laporan
   Coal Feeder Calibration 71 foto) proxy Apps Script ini SERING melempar
   CORS error ("MissingAllowOriginHeader") kalau dibebani banyak fetch foto
   paralel sekaligus, TAPI itu transient -- percobaan ulang beberapa saat
   kemudian biasanya sukses. Sebelum ada retry ini, foto yang kena
   kegagalan transient itu tercetak KOSONG selamanya di PDF final yang
   terkirim ke Review Approval Dashboard (kotak foto putih + keterangan
   doang, tanpa gambar) -- padahal fotonya sendiri aman-aman saja di Drive. */
function _pmFetchDriveFileAsBase64(fileId, _attempt) {
  var attempt = _attempt || 1;
  return _photoCacheGet(fileId).then(function(cached) {
    if (cached) return cached;
    var fetchPromise = fetch(GDRIVE_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ token: GDRIVE_SECRET_TOKEN, action: 'get', fileId: fileId })
    }).then(function(res){ return res.json(); })
      .then(function(result){
        var dataUrl = (result && result.success && result.imageBase64) ? result.imageBase64 : null;
        if (dataUrl) _photoCacheSet(fileId, dataUrl);
        return dataUrl;
      });
    // 25 detik per percobaan -- SEBELUMNYA tidak ada batas waktu sama
    // sekali di sini, jadi kalau proxy Drive kita macet buat SATU foto
    // saja, Promise.all(jobs) di _pmRestoreBase64AfterLoad ikut nunggu
    // selamanya, dbLoad() TIDAK PERNAH manggil callback-nya -- laporan yang
    // punya banyak foto (jadi banyak job paralel) makin gampang kena ini
    // kalau ada 1 saja yang macet.
    return Promise.race([
      fetchPromise,
      new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 25000); })
    ]).catch(function(){ return null; }).then(function(dataUrl) {
      if (dataUrl || attempt >= 3) return dataUrl;
      return new Promise(function(resolve){
        setTimeout(function(){ resolve(_pmFetchDriveFileAsBase64(fileId, attempt + 1)); }, attempt * 400);
      });
    });
  });
}

// Jalankan `tasks` (array fungsi yang masing-masing me-return Promise)
// MAKSIMAL `limit` biji BERSAMAAN, bukan langsung semuanya lewat
// Promise.all -- ditemukan (Coal Feeder Calibration, 71 foto lewat
// pengujian nyata) proxy Apps Script kita kena error CORS
// ("MissingAllowOriginHeader") pada SEBAGIAN foto kalau dibebani puluhan
// fetch sekaligus (kemungkinan besar kena limit eksekusi paralel Apps
// Script itu sendiri) -- dan retry SAJA (lihat _pmFetchDriveFileAsBase64)
// TIDAK CUKUP kalau retry-nya ikut menumpuk di burst besar yang sama.
// Membatasi jumlah yang jalan bersamaan mengurangi beban puncaknya dari
// akarnya, laporan dengan sedikit foto praktis tidak berubah kecepatannya.
function _pmRunPool(tasks, limit) {
  return new Promise(function(resolve) {
    if (!tasks.length) { resolve(); return; }
    var next = 0, active = 0, done = 0;
    function runNext() {
      if (done >= tasks.length) { resolve(); return; }
      while (active < limit && next < tasks.length) {
        (function(task) {
          active++;
          task().catch(function(){}).then(function(){ active--; done++; runNext(); });
        })(tasks[next++]);
      }
    }
    runNext();
  });
}

function _pmRestoreBase64AfterLoad(obj) {
  var tasks = [];
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (o.driveUrl && (!o.dataUrl || o.dataUrl.indexOf('data:') !== 0)) {
      // Dulu di sini fetch() LANGSUNG ke o.driveUrl (lh3.googleusercontent.com)
      // -- itu gagal kena CORS, karena domain CDN Google itu tidak kirim
      // header Access-Control-Allow-Origin buat fetch() cross-origin dari
      // mahfudjtf.github.io (beda dengan <img src> yang boleh-boleh aja).
      // Sekarang dilewatkan Apps Script yang sama (action:'get') yang SUDAH
      // terbukti CORS-nya lolos, sama seperti upload/delete foto.
      if (o.driveFileId) {
        var fid = o.driveFileId;
        tasks.push(function(){ return _pmFetchDriveFileAsBase64(fid).then(function(dataUrl){ if (dataUrl) o.dataUrl = dataUrl; }); });
      } else {
        // Jaga-jaga: record lama yang cuma punya driveUrl tanpa driveFileId
        // tersimpan terpisah -- ekstrak fileId dari URL-nya
        // (https://lh3.googleusercontent.com/d/FILE_ID).
        var m = /\/d\/([^/?]+)/.exec(o.driveUrl);
        if (m) { var mid = m[1]; tasks.push(function(){ return _pmFetchDriveFileAsBase64(mid).then(function(dataUrl){ if (dataUrl) o.dataUrl = dataUrl; }); }); }
      }
      return; // object foto -- gak perlu turun lebih dalam lagi
    }
    Object.keys(o).forEach(function(k){ walk(o[k]); });
  })(obj);
  return _pmRunPool(tasks, 8);
}

/* Nama file yang dikirim ke Drive TIDAK BOLEH pakai nama asli dari device
   (file.name / img.name) -- nama kamera/galeri gampang collide (counter HP
   reset, hasil download WhatsApp, dsb), dan folder Drive di Apps Script itu
   SATU folder dipakai bersama semua modul. Kalau Apps Script diberi logika
   "hapus file lama dengan nama sama sebelum simpan yang baru" (lihat
   deleteFotoDariGDrive/action=delete di bawah, atau pola serupa di doPost),
   nama yang tidak unik bisa bikin file MILIK FOTO LAIN YANG TIDAK
   BERHUBUNGAN ikut kehapus tanpa sengaja. Makanya nama Drive dibuat sendiri
   di sini: modul + timestamp + random, dan TIDAK PERNAH dipakai ulang untuk
   foto yang beda (setiap slot foto = nama Drive unik permanen, disimpan di
   entry.driveFileId setelah upload sukses -- bukan di-generate ulang tiap
   render). */
function _pmGenUniqueDriveFileName(modul) {
  var safeModul = (modul || 'foto').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
  return safeModul + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
}

function uploadFotoKeGDrive(dataUrlBase64, fileName, modul, keterangan, entry) {
  if (!GDRIVE_WEB_APP_URL || !dataUrlBase64) return Promise.resolve(null);
  // fileName dari pemanggil (nama device) diabaikan sebagai KEY penyimpanan --
  // dipakai Apps Script cuma buat keterangan/logging, bukan buat identifikasi
  // file. Key aslinya selalu di-generate unik di sini.
  var driveFileName = _pmGenUniqueDriveFileName(modul);
  var promise = fetch(GDRIVE_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify({
      token: GDRIVE_SECRET_TOKEN,
      imageBase64: dataUrlBase64,
      fileName: driveFileName,
      originalFileName: fileName || '',
      modul: modul || (window.CURRENT_MODUL || 'unknown'),
      keterangan: keterangan || ''
    })
  }).then(function(res){ return res.json(); })
    .then(function(result){
      if (!result.success) { console.error('Upload GDrive gagal:', result.error); return null; }
      if (entry) { entry.driveUrl = gdriveFileIdToViewUrl(result.fileId); entry.driveFileId = result.fileId; }
      return result;
    })
    .catch(function(err){ console.error('Upload GDrive error:', err); return null; });
  _pmPendingDriveUploads.push(promise);
  return promise;
}

/* ── PASTIKAN SEMUA FOTO SUDAH DI DRIVE SEBELUM SIMPAN (WAJIB, bukan
   best-effort) ──
   Ditemukan laporan (Coal Feeder ~31MB, FEGT & Leak Detection ~6.5MB) yang
   base64 fotonya nempel PENUH di Supabase karena upload ke Drive gagal
   diam-diam saat awal disimpan -- usernya sendiri TIDAK PERNAH tahu
   fotonya gagal ke Drive, karena dbSave() dulu tetap "berhasil" (fallback
   diam-diam: simpan base64 kalau upload gagal, lihat catatan lama di
   _pmStripBase64ForSave). Ini bikin record jadi berat (lambat dibuka lagi,
   lambat di-submit ulang) TANPA usernya sadar sama sekali sampai lama
   kemudian.
   Sekarang upload ke Drive WAJIB berhasil sebelum data boleh disimpan ke
   Supabase -- dipanggil dbSave() SETELAH waitForPendingDriveUploads(),
   nyoba ulang (bukan cuma nunggu percobaan pertama) untuk foto mana pun
   yang masih belum punya driveUrl, sampai MAX_ATTEMPTS kali per foto.
   Kalau SETELAH itu masih ada yang gagal, dbSave() akan MENOLAK menyimpan
   (lihat pemanggilnya) -- BUKAN lagi diam-diam nyimpen base64-nya --
   supaya user LANGSUNG tahu ada foto yang gagal terkirim selagi masih di
   lokasi/koneksi yang sama, bukan ketahuan berbulan-bulan kemudian.
   Return: array nama foto yang MASIH gagal setelah semua percobaan
   (kosong = semua sukses, aman lanjut simpan). */
function _pmEnsureAllPhotosOnDrive(dataObj, modul) {
  var MAX_ATTEMPTS = 3;
  function collectPending(obj) {
    var found = [];
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      if (typeof o.dataUrl === 'string' && o.dataUrl.indexOf('data:') === 0 && !o.driveUrl) { found.push(o); return; }
      Object.keys(o).forEach(function(k){ walk(o[k]); });
    })(obj);
    return found;
  }
  function attempt(n) {
    var pending = collectPending(dataObj);
    if (!pending.length) return Promise.resolve([]);
    if (n > MAX_ATTEMPTS) return Promise.resolve(pending.map(function(p){ return p.name || '(tanpa nama)'; }));
    return Promise.all(pending.map(function(entry) {
      return uploadFotoKeGDrive(entry.dataUrl, entry.name, modul, entry.caption, entry);
    })).then(function() { return attempt(n + 1); });
  }
  return attempt(1);
}

/* Hapus 1 file di Drive berdasarkan fileId PASTI (bukan berdasarkan nama).
   Dipanggil saat: (a) foto di-crop-ulang -- versi lama dihapus setelah versi
   baru selesai diupload dengan nama Drive baru, dan (b) foto dihapus
   permanen dari galeri lewat tombol X (lihat pmDeleteImgFromArr di bawah).
   NON-BLOCKING dan tidak pernah reject -- kalau hapusnya gagal (mis. sudah
   kehapus manual duluan, atau jaringan lagi bermasalah), itu cuma jadi file
   nyangkut di Drive, TIDAK BOLEH bikin proses hapus-di-galeri/crop-ulang si
   user ikut gagal. */
function deleteFotoDariGDrive(fileId) {
  if (!GDRIVE_WEB_APP_URL || !fileId) return Promise.resolve(null);
  var promise = fetch(GDRIVE_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify({
      token: GDRIVE_SECRET_TOKEN,
      action: 'delete',
      fileId: fileId
    })
  }).then(function(res){ return res.json(); })
    .catch(function(err){ console.error('Hapus GDrive error:', err); return null; });
  _pmPendingDriveUploads.push(promise.catch(function(){}));
  return promise;
}

/* Helper GENERIK dipakai oleh SEMUA fungsi RemoveImg/hapus-foto di semua
   modul: hapus 1 entry foto dari array-nya (di posisi idx), dan kalau entry
   itu sudah kebagian driveFileId (artinya sempat berhasil ke-upload ke
   Drive), sekalian hapus file-nya di Drive juga -- supaya foto yang dihapus
   permanen dari galeri TIDAK nyangkut selamanya di Drive. Ganti array.splice
   langsung dengan pmDeleteImgFromArr(array, idx) di titik manapun user
   menghapus 1 foto dari galeri. */
function pmDeleteImgFromArr(imgArr, idx) {
  if (!imgArr || idx < 0 || idx >= imgArr.length) return;
  var item = imgArr[idx];
  if (item && item.driveFileId) deleteFotoDariGDrive(item.driveFileId);
  imgArr.splice(idx, 1);
}

/* ── UKURAN BYTE (UTF-8) DARI STRING ──
   Dipakai buat ngukur ukuran payload JSON yang beneran mau dikirim, disimpan
   sebagai `payload_size` di record supaya bisa jadi acuan estimasi. */
function _dbByteLength(str) {
  if (window.TextEncoder) return new TextEncoder().encode(str).length;
  return unescape(encodeURIComponent(str)).length; // fallback browser lama
}

/* ── GATE AKSES: LOGIC (device id, cek password, sinkron trusted device) ──
   Tabel Supabase yang dibutuhkan (jalankan sekali di SQL editor Supabase):
     create table trusted_devices (
       device_id text primary key,
       device_name text,
       user_agent text,
       first_seen timestamptz default now(),
       last_seen timestamptz default now(),
       trusted boolean default false,
       access_revoked boolean default false
     );
     alter table trusted_devices disable row level security;

     create table gate_config (
       id int primary key default 1,
       password_hash text not null,
       updated_at timestamptz default now()
     );
     insert into gate_config (id, password_hash) values (1, '<hash password awal>');
     alter table gate_config disable row level security;

   Password TIDAK lagi disimpan di file ini (sengaja, biar tidak kebaca lewat
   View Source) — ganti password sekarang lewat form di device-admin.html,
   yang meng-update baris di tabel gate_config. ── */
var PM_GATE_TABLE = 'trusted_devices';
var PM_GATE_CONFIG_TABLE = 'gate_config';

function pmSimpleHash(str) {
  // Hash sederhana (BUKAN cryptographic-grade) — cukup supaya password tidak
  // kebaca polos. Ini bukan proteksi keamanan tinggi, tapi cukup untuk
  // penghalang praktis (lihat penjelasan di chat).
  var h = 5381;
  for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function pmLS(op, key, val) {
  try {
    if (op === 'get') return localStorage.getItem(key);
    if (op === 'set') { localStorage.setItem(key, val); return true; }
    if (op === 'remove') { localStorage.removeItem(key); return true; }
  } catch (e) {}
  return null;
}

function pmGetDeviceId() {
  var id = pmLS('get', 'pm_device_id');
  if (!id) {
    id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    pmLS('set', 'pm_device_id', id);
  }
  return id;
}

function pmUnlockGate() {
  var style = document.getElementById('pmGateHideStyle');
  var gate = document.getElementById('pmAuthGate');
  if (style && style.parentNode) style.parentNode.removeChild(style);
  if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
}

function pmShowGateError(msg) {
  var el = document.getElementById('pmGateError');
  if (el) el.textContent = msg;
}

function pmFetchCurrentPwHash() {
  // Ambil hash password yang BERLAKU SEKARANG langsung dari Firestore (live,
  // bukan dari cache) — dipakai saat validasi submit password di gate supaya
  // password baru yang baru diganti admin langsung berlaku. Doc tunggal
  // gate_config/main { password_hash, updated_at }.
  return db.collection(PM_GATE_CONFIG_TABLE).doc('main').get()
    .then(function(s) { return s.exists ? (s.data().password_hash || null) : null; });
}

function pmSyncDeviceToSupabase(deviceId, name) {
  var ua = navigator.userAgent || '';
  var now = new Date().toISOString();
  var ref = db.collection(PM_GATE_TABLE).doc(deviceId);
  ref.get()
    .then(function(s) {
      if (s.exists) {
        var patch = { last_seen: now, user_agent: ua };
        if (name) patch.device_name = name;
        return ref.set(patch, { merge: true });
      }
      return ref.set({
        device_id: deviceId, device_name: name || '', user_agent: ua,
        first_seen: now, last_seen: now, trusted: false, access_revoked: false
      });
    })
    .then(function(){
      // Disimpan sebagai timestamp (bukan flag '1') supaya pmInitGate() bisa
      // tahu kapan harus resync lagi biar last_seen gak beku selamanya.
      pmLS('set', 'pm_device_synced', String(Date.now()));
    })
    .catch(function(err){ console.error('Gate sync error (akan dicoba lagi nanti):', err); });
}

function pmCheckAccessRemote(deviceId) {
  // Cek status SEKALI pas halaman dibuka (background, tidak nge-block UI):
  // - trusted=true            -> lolos otomatis, cache lokal disimpan.
  // - doc device dihapus admin -> "device di-reset total": cache password &
  //                              trusted lokal dihapus.
  // - access_revoked=true     -> admin "Cabut Trusted": cache password lokal
  //                              ikut dihapus.
  // - password_hash berubah   -> cache password lokal lama dihapus, device
  //                              (yang belum Trusted) wajib password baru.
  //
  // pmSubscribeGateChanges() memasang listener onSnapshot -- kalau admin
  // revoke/hapus/ganti SETELAH halaman terbuka, device dapat perubahan
  // INSTAN dari Firestore tanpa polling.
  db.collection(PM_GATE_TABLE).doc(deviceId).get()
    .then(function(s) { _pmApplyGateRow(s.exists ? s.data() : null); })
    .catch(function(){ /* gagal -> biarin cache lokal lama tetap berlaku */ });

  pmSubscribeGateChanges(deviceId);
}

function _pmApplyGateRow(row) {
  if (!row) {
    pmLS('remove', 'pm_trusted_flag');
    pmLS('remove', 'pm_auth_pw_hash');
    pmLS('remove', 'pm_device_synced');
    return;
  }
  if (row.trusted === true) { pmLS('set', 'pm_trusted_flag', '1'); pmUnlockGate(); return; }
  pmLS('remove', 'pm_trusted_flag');
  if (row.access_revoked === true) { pmLS('remove', 'pm_auth_pw_hash'); return; }
  // Bukan trusted & bukan revoked -> cek juga apakah password globalnya
  // sudah diganti admin sejak device ini terakhir login.
  pmFetchCurrentPwHash().then(function(currentHash) {
    var localHash = pmLS('get', 'pm_auth_pw_hash');
    if (currentHash && localHash && localHash !== currentHash) {
      pmLS('remove', 'pm_auth_pw_hash');
    }
  });
}

var _pmGateChannel = null;
function pmSubscribeGateChanges(deviceId) {
  if (_pmGateChannel) return; // sudah subscribe, jangan dobel
  try {
    // Firestore onSnapshot: doc device sendiri dipantau real-time. Kalau
    // admin revoke/hapus/ganti trusted, callback ini kepanggil INSTAN.
    _pmGateChannel = db.collection(PM_GATE_TABLE).doc(deviceId).onSnapshot(
      function(s) { _pmApplyGateRow(s.exists ? s.data() : null); },
      function(err) { console.error('Realtime gate subscribe gagal (fallback ke cek biasa):', err); }
    );
  } catch (e) {
    console.error('Realtime gate subscribe gagal (fallback ke cek biasa):', e);
  }
}

/* ── PRESENCE: "device mana yang lagi online sekarang" ──
   Dulu lewat channel Realtime Supabase (auto-hilang saat tab ditutup).
   Sekarang: heartbeat ringan ke trusted_devices/<id> (last_seen +
   current_page) tiap 2 menit selama tab terlihat (interval agak longgar
   supaya hemat kuota write Firestore Spark). device-admin.html (Phase 2)
   menganggap device "online" kalau last_seen < ~5 menit lalu. */
var _pmPresenceTimer = null;
function pmTrackPresence(deviceId, name) {
  if (_pmPresenceTimer) return; // sudah jalan, jangan dobel
  function beat() {
    if (document.hidden) return;
    var patch = {
      last_seen: new Date().toISOString(),
      current_page: (location.pathname.split('/').pop() || 'index')
    };
    if (name) patch.device_name = name;
    db.collection(PM_GATE_TABLE).doc(deviceId).set(patch, { merge: true }).catch(function(){});
  }
  beat();
  _pmPresenceTimer = setInterval(beat, 120000);
}
// Placeholder — implementasi asli (baca presence semua device) sekarang ada
// di device-admin.html sendiri lewat query trusted_devices + filter last_seen.
function pmOnPresenceSync(callback) { /* no-op: lihat device-admin.html (Phase 2) */ }

function pmInitGate() {
  var deviceId = pmGetDeviceId();
  var storedName = pmLS('get', 'pm_device_name') || '';
  var alreadyTrustedLocally = pmLS('get', 'pm_trusted_flag') === '1';
  var localPwHash = pmLS('get', 'pm_auth_pw_hash');
  // pm_device_synced dulu cuma flag '1'/kosong -- sekali ke-sync, last_seen
  // di Supabase jadi BEKU selamanya (gak pernah update lagi), padahal device
  // masih rutin dipakai. Akibatnya urutan "paling baru mengakses" di
  // device-admin.html sebenarnya cuma urutan "paling baru PERTAMA KALI
  // daftar", bukan aktivitas terkini. Sekarang disimpan sebagai timestamp
  // dan di-resync ulang tiap lewat PM_LAST_SEEN_THROTTLE_MS, supaya
  // last_seen tetap mencerminkan kunjungan terakhir yang sebenarnya, tanpa
  // nulis ke Supabase di SETIAP page load/navigasi (boros write).
  var PM_LAST_SEEN_THROTTLE_MS = 30 * 60 * 1000; // 30 menit
  var lastSyncedAt = parseInt(pmLS('get', 'pm_device_synced'), 10) || 0;
  var needsResync = (Date.now() - lastSyncedAt) > PM_LAST_SEEN_THROTTLE_MS;

  // Selalu cek ulang ke Supabase di background (nangkep kasus baru
  // ditandai/dicabut Trusted, password diganti admin, atau device pindah
  // browser/clear cache). Tidak nge-block tampilan halaman yang sedang
  // dibuka — cuma menentukan status untuk load berikutnya.
  pmCheckAccessRemote(deviceId);

  if (alreadyTrustedLocally || localPwHash) {
    // Catatan: device dengan localPwHash tersimpan dianggap lolos dulu
    // (instan, tanpa nunggu network) — kalau ternyata password sudah
    // diganti admin, pmCheckAccessRemote() di atas akan menghapus cache-nya
    // di background, jadi baru kunjungan BERIKUTNYA yang bakal diminta
    // password baru. Ini trade-off wajar untuk sistem tanpa server auth.
    pmUnlockGate();
    pmTrackPresence(deviceId, storedName);
    if (needsResync) pmSyncDeviceToSupabase(deviceId, storedName);
    return;
  }

  var nameWrap = document.getElementById('pmGateNameWrap');
  var nameInput = document.getElementById('pmGateName');
  var pwInput = document.getElementById('pmGatePw');
  var submitBtn = document.getElementById('pmGateSubmit');
  if (!storedName && nameWrap) nameWrap.style.display = 'block';

  function setSubmitBusy(busy) {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Memeriksa...' : 'Masuk';
  }

  function submit() {
    var pw = ((pwInput && pwInput.value) || '').trim();
    if (!pw) { pmShowGateError('Password wajib diisi.'); return; }
    var name = storedName;
    if (!storedName) {
      name = ((nameInput && nameInput.value) || '').trim();
      if (!name) { pmShowGateError('Nama wajib diisi (sekali saja).'); return; }
    }
    pmShowGateError('');
    setSubmitBusy(true);
    pmFetchCurrentPwHash().then(function(currentHash) {
      setSubmitBusy(false);
      if (!currentHash) {
        pmShowGateError('Tidak bisa menghubungi server, coba lagi.');
        return;
      }
      if (pmSimpleHash(pw) !== currentHash) {
        pmShowGateError('Password salah, coba lagi.');
        if (pwInput) { pwInput.value = ''; pwInput.focus(); }
        return;
      }
      if (!storedName) pmLS('set', 'pm_device_name', name);
      pmLS('set', 'pm_auth_pw_hash', currentHash);
      pmSyncDeviceToSupabase(deviceId, name);
      pmUnlockGate();
      pmTrackPresence(deviceId, name);
    }).catch(function() {
      setSubmitBusy(false);
      pmShowGateError('Gagal menghubungi server, coba lagi.');
    });
  }

  if (submitBtn) submitBtn.addEventListener('click', submit);
  if (pwInput) pwInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit(); });
  if (nameInput) nameInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit(); });
  if (nameWrap && nameWrap.style.display === 'block' && nameInput) nameInput.focus();
  else if (pwInput) pwInput.focus();
}

// GATE AKSES DINONAKTIFKAN (lihat catatan di atas file): pmInitGate() tidak
// lagi dipanggil, jadi halaman Instrument terbuka langsung tanpa password.
// pmInitGate();

/* ── JARING PENGAMAN TOTAL untuk halaman ?autosubmit=1 ──
   Ditemukan laporan yang macet total di alur Submit dari Riwayat/retry
   otomatis TANPA PERNAH lapor sukses maupun gagal, bahkan setelah
   raSendFinalPdfToFirebaseDashboard() dikasih timeout eksplisit -- artinya
   proses itu tidak pernah nyampe ke titik itu SAMA SEKALI (kemungkinan
   besar ada error JS yang throw di suatu tempat sebelum sempat ke situ,
   mis. di dbLoad()/pemulihan foto/generate PDF -- terutama untuk laporan
   dengan data besar yang bisa bikin tab kehabisan memori). Dipasang
   SEDINI MUNGKIN (baris-baris awal shared.js, sebelum kode lain di file
   ini ATAU script modul sempat jalan) supaya menangkap error dari MANA
   PUN di halaman ini, bukan cuma dari raSendFinalPdfToFirebaseDashboard.
   window._raAutosubmitReport (dipakai raSubmitReportAuto() di bawah)
   memastikan HANYA SATU laporan yang benar-benar terkirim ke
   opener/parent, dari sumber mana pun yang pertama kali memicu (sukses
   asli, error yang ketangkap normal, error JS tak terduga, promise gagal
   tak tertangani, atau watchdog kalau semuanya diam lebih dari 4.5 menit). */
(function() {
  var params = new URLSearchParams(location.search);
  if (params.get('autosubmit') !== '1') return; // cuma aktif di halaman yang memang dibuka buat submit otomatis
  var reported = false;
  window._raAutosubmitReport = function(ok, err) {
    if (reported) return;
    reported = true;
    try {
      var target = window.opener || ((window.parent && window.parent !== window) ? window.parent : null);
      if (target) {
        target.postMessage({
          type: 'raAutosubmitDone',
          id: window._editingId || params.get('id'),
          ok: !!ok,
          error: err ? String((err && err.message) || err) : null
        }, '*');
      }
    } catch (e) {}
    try {
      if (window.opener && params.get('autoclose') === '1') {
        setTimeout(function(){ try { window.close(); } catch (e) {} }, ok ? 1500 : 6000);
      }
    } catch (e) {}
  };
  window.addEventListener('error', function(e) {
    window._raAutosubmitReport(false, 'JS error tak tertangkap: ' + (e && e.message || 'unknown') + (e && e.filename ? (' @' + e.filename + ':' + e.lineno) : ''));
  });
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e && e.reason;
    window._raAutosubmitReport(false, 'Promise gagal tak tertangani: ' + String((reason && reason.message) || reason || 'unknown'));
  });
  // Watchdog -- kalau BENAR-BENAR tidak ada apa pun yang lapor dalam 4.5
  // menit (lebih besar dari total timeout internal raSendFinalPdfToFirebaseDashboard:
  // 30 detik + 3 menit = 3.5 menit), paksa lapor gagal supaya tab/tombol
  // di sisi pemanggil TIDAK PERNAH nyangkut diam selamanya.
  setTimeout(function() {
    window._raAutosubmitReport(false, 'Watchdog: tidak ada aktivitas yang lapor selesai dalam 4.5 menit -- kemungkinan macet/tab kehabisan memori (data laporan ini mungkin besar).');
  }, 270000);
})();

/* ── FORMAT TANGGAL/JAM LOKAL dari timestamp Supabase (UTC) ──
   r.updated_at/r.created_at dari Supabase itu UTC (mis. "...T03:08:12+00:00").
   Beberapa halaman (history.html, outage-history.html) dulu cuma
   substring(0,16) mentah tanpa dikonversi -- jamnya kelihatan mundur
   sejumlah selisih timezone (7 jam buat WIB). new Date() + getter lokal di
   sini otomatis ikut timezone perangkat/browser yang buka halaman. */
function dbFmtLocalDateTime(iso) {
  if (!iso) return '-';
  try {
    var d = new Date(iso);
    var pad = function(n){ return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  } catch (e) { return iso; }
}

/* ── TOAST NOTIFICATION ── */
function dbShowToast(msg) {
  var t = document.getElementById('dbToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'dbToast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#16a085;color:#fff;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s;white-space:nowrap;max-width:90vw;text-align:center';
    // Hide toast during print (pages define @media print .no-print{display:none})
    try { t.classList.add('no-print'); } catch(e){}
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(function(){ t.style.opacity='0'; }, 3000);
}

/* ── DB LOAD (satu record by ID) ── */
function dbLoad(id, callback) {
  dbShowSavingOverlay(true, 'Memuat data, mohon tunggu...', 'Data dengan banyak gambar membutuhkan waktu yang lama');
  // Firestore tidak punya event progress transfer -> pakai simulasi
  // asymptotic (dbStartFakeProgress) sampai data & pemulihan foto selesai.
  dbStartFakeProgress();
  pmDbGet(id)
    .then(function(rows) {
      if (rows && rows[0]) {
        // Foto lama yang cuma punya driveUrl (base64-nya sudah dibuang saat
        // disimpan) dipulihkan ke dataUrl dulu sebelum callback dipanggil --
        // supaya applyRecordToForm/render/PDF export tiap modul tetap nerima
        // bentuk data yang sama seperti biasa (selalu ada dataUrl).
        _pmRestoreBase64AfterLoad(rows[0].data).then(function(){
          dbStopFakeProgress();
          dbSetSavingProgress(100);
          dbShowSavingOverlay(false);
          callback(rows[0]);
        });
      }
      else dbShowSavingOverlayError('Data tidak ditemukan.', 'Kemungkinan data sudah dihapus atau ID tidak valid.');
    })
    .catch(function(err){ dbShowSavingOverlayError('Gagal memuat data.', err.message || String(err), function(){ dbLoad(id, callback); }); });
}

/* ── DB DELETE ── */
function dbDelete(id) {
  if (!confirm('Hapus data PM ini dari database?')) return;
  pmDbDelete(id)
    .then(function() {
      dbShowToast('Data berhasil dihapus');
      if (typeof dbLoadRiwayat === 'function') dbLoadRiwayat();
    })
    .catch(function(err){ alert('Gagal hapus: ' + (err.message||err)); });
}

/* ── SAVING OVERLAY (full-screen, blocks double-submit) ── */
function dbShowSavingOverlay(show, msg, submsg) {
  var ov = document.getElementById('dbSavingOverlay');
  if (show) {
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'dbSavingOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:#060a10;z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;transition:background-color 0.2s;overflow:hidden';
      ov.innerHTML = '<div id="dbSavingGlowField" style="position:absolute;width:min(92vw,440px);height:min(92vw,440px);border-radius:50%;background:radial-gradient(ellipse at center, rgba(66,220,255,0.16) 0%, rgba(66,220,255,0) 70%);filter:blur(2px);animation:dbEicFieldPulse 2.6s ease-in-out infinite;pointer-events:none;z-index:0"></div>'
        + '<div id="dbSavingSpinner" style="width:min(96vw,560px);height:min(96vw,560px);position:relative;margin-bottom:10px;z-index:1">'
        +   '<svg id="dbSavingRingSvg" viewBox="0 0 320 320" style="width:100%;height:100%;display:block;overflow:visible">'
        +     '<defs><path id="dbBoltShape" d="M14 0 L2 20 L11 20 L8 40 L23 16 L13 16 Z"/></defs>'
        +     '<circle cx="160" cy="160" r="128" fill="none" stroke="#3ad4ff" stroke-width="1.5" stroke-dasharray="3 9" opacity="0.5" style="filter:drop-shadow(0 0 5px #35c9ff);transform-origin:160px 160px;animation:dbEicRingSpin 10s linear infinite"/>'
        +     '<circle cx="160" cy="160" r="112" fill="none" stroke="#3ad4ff" stroke-width="2.5" style="filter:drop-shadow(0 0 5px #35c9ff) drop-shadow(0 0 14px #0aa8ff);animation:dbEicRingPulse 2s ease-in-out infinite"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(268.2,189.0) rotate(105) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:0s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(216.0,257.0) rotate(150) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:0.2s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(131.0,268.2) rotate(195) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:0.4s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(63.0,216.0) rotate(240) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:0.6s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(51.8,131.0) rotate(285) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:0.8s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(104.0,63.0) rotate(330) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:1s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(189.0,51.8) rotate(15) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:1.2s"/>'
        +     '<use href="#dbBoltShape" fill="#cdf9ff" transform="translate(257.0,104.0) rotate(60) scale(1.3) translate(-11.5,-20)" style="filter:drop-shadow(0 0 4px #9fefff) drop-shadow(0 0 10px #35c9ff);animation:dbEicBoltPulse 1.6s ease-in-out infinite;animation-delay:1.4s"/>'
        +   '</svg>'
        +   '<div id="dbSavingEicWrap" style="position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);display:flex;font-family:\'Arial Black\',Impact,-apple-system,sans-serif;font-weight:900;font-size:clamp(24px,7.5vw,32px);letter-spacing:2px;color:#eaffff">'
        +     '<span style="display:inline-block;animation:dbEicFlicker 2.4s infinite;animation-delay:0s;text-shadow:0 0 6px #7fe9ff,0 0 14px #35c9ff,0 0 24px #0aa8ff">E</span>'
        +     '<span style="display:inline-block;animation:dbEicFlicker 2.4s infinite;animation-delay:0.15s;text-shadow:0 0 6px #7fe9ff,0 0 14px #35c9ff,0 0 24px #0aa8ff">I</span>'
        +     '<span style="display:inline-block;animation:dbEicFlicker 2.4s infinite;animation-delay:0.3s;text-shadow:0 0 6px #7fe9ff,0 0 14px #35c9ff,0 0 24px #0aa8ff">C</span>'
        +     '<span style="display:inline-block;animation:dbEicFlicker 2.4s infinite;animation-delay:0.45s;text-shadow:0 0 6px #7fe9ff,0 0 14px #35c9ff,0 0 24px #0aa8ff">7</span>'
        +   '</div>'
        +   '<div id="dbSavingErrorIcon" style="display:none;position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;background:#e74c3c;color:#fff;font-size:26px;font-weight:700;align-items:center;justify-content:center;line-height:1">&#10005;</div>'
        +   '<div id="dbSavingMsgGroup" style="position:absolute;left:50%;top:63%;transform:translate(-50%,-50%);width:62%;max-width:320px;text-align:center">'
        +     '<div id="dbSavingOverlayMsg" style="font-size:clamp(11px,3.4vw,14px);font-weight:600;line-height:1.35"></div>'
        +     '<div id="dbSavingProgressWrap" style="width:100%;max-width:180px;height:6px;background:rgba(255,255,255,0.2);border-radius:5px;margin:10px auto 0;overflow:hidden;display:none">'
        +       '<div id="dbSavingProgressBar" style="height:100%;width:0%;background:#2ecc71;border-radius:5px;transition:width 0.12s linear"></div>'
        +     '</div>'
        +     '<div id="dbSavingProgressPct" style="font-size:12px;font-weight:700;color:#fff;margin-top:5px;display:none"></div>'
        +     '<div id="dbSavingOverlaySub" style="font-size:clamp(9px,2.8vw,11px);font-weight:400;margin-top:8px;color:rgba(255,255,255,0.75);line-height:1.3"></div>'
        +     '<button id="dbSavingRetryBtn" type="button" style="display:none;margin-top:14px;padding:9px 22px;border:none;border-radius:8px;background:#2ecc71;color:#fff;font-size:13px;font-weight:700;cursor:pointer;z-index:2">&#8635; Coba Lagi</button>'
        +   '</div>'
        + '</div>'
        + '<div id="dbSavingOverlayTapHint" style="display:none;font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);margin-top:14px;letter-spacing:0.3px;z-index:1">Tap dimana saja untuk menutup</div>';
      document.body.appendChild(ov);
      // Tap-to-close HANYA berfungsi kalau overlay lagi dalam mode error
      // (ov._isError === true) -- supaya overlay TIDAK bisa ke-tap-tutup
      // sengaja/gak-sengaja pas proses simpan/muat masih benar-benar berjalan.
      ov.addEventListener('click', function() {
        if (ov._isError) dbShowSavingOverlay(false);
      });
      // Tombol Coba Lagi -- stopPropagation supaya klik di tombol ini TIDAK
      // ikut kena listener "tap dimana saja untuk menutup" di atas (yang
      // akan langsung menyembunyikan overlay sebelum retryFn sempat jalan).
      document.getElementById('dbSavingRetryBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        var fn = ov._retryFn;
        ov._retryFn = null;
        if (typeof fn === 'function') fn();
      });
      if (!document.getElementById('dbSpinKeyframes')) {
        var style = document.createElement('style');
        style.id = 'dbSpinKeyframes';
        style.textContent = '@keyframes dbSpin{to{transform:rotate(360deg)}}'
          + '@keyframes dbEicRingSpin{to{transform:rotate(360deg)}}'
          + '@keyframes dbEicRingPulse{0%,100%{stroke-opacity:0.55}50%{stroke-opacity:1}}'
          + '@keyframes dbEicBoltPulse{0%,100%{opacity:0.6}50%{opacity:1}}'
          + '@keyframes dbEicFlicker{0%,92%,100%{opacity:1}93%{opacity:0.35}95%{opacity:1}96%{opacity:0.5}98%{opacity:1}}'
          + '@keyframes dbEicFieldPulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}';
        document.head.appendChild(style);
      }
    }
    document.getElementById('dbSavingOverlayMsg').textContent = msg || 'Menyimpan data, mohon tunggu...';
    document.getElementById('dbSavingOverlaySub').textContent = submsg || '';
    // Pastikan overlay balik ke mode NORMAL (spinner) setiap kali dipanggil
    // buat proses baru -- jaga-jaga kalau sebelumnya sempat ditinggal dalam
    // mode error (mestinya sudah ditutup manual, tapi ini pengaman tambahan).
    ov._isError = false;
    ov.style.cursor = 'default';
    ov.style.backgroundColor = '#060a10';
    document.getElementById('dbSavingRingSvg').style.display = 'block';
    document.getElementById('dbSavingEicWrap').style.display = 'flex';
    document.getElementById('dbSavingErrorIcon').style.display = 'none';
    document.getElementById('dbSavingOverlayTapHint').style.display = 'none';
    document.getElementById('dbSavingRetryBtn').style.display = 'none';
    ov._retryFn = null;
    ov.style.display = 'flex';
    dbStartFakeProgress(); // langsung tampil & jalan 0% -> ~90%, di-override begitu ada progress asli
  } else if (ov) {
    ov.style.display = 'none';
    ov._isError = false;
    dbStopFakeProgress();
    dbSetSavingProgress(null);
  }
}

/* ── OVERLAY MODE ERROR ──
   Dipanggil sebagai pengganti dbShowSavingOverlay(false) + alert() di titik
   .catch() proses simpan/muat data. BEDA dari alert(): overlay ini TETAP
   NEMPEL di layar sampai user sendiri yang tap untuk menutup -- alasannya,
   kalau user kebetulan lagi AFK / HP diletak pas errornya kejadian, alert()
   gampang kelewat/ke-skip (apalagi di HP: alert() browser bisa otomatis
   ke-dismiss kalau tab pindah fokus/HP dikunci). Overlay full-screen begini
   jauh lebih susah kelewat karena nutupin seluruh layar terus sampai dibuka.
   retryFn (opsional): kalau diisi, tombol "↺ Coba Lagi" muncul dan
   memanggil fungsi ini persis (retry beneran -- ulang proses yang gagal
   dengan argumen yang sama, bukan cuma tutup lalu user klik manual lagi
   dari awal). Dibiarkan kosong/null kalau proses itu tidak aman/tidak
   masuk akal untuk diulang otomatis. */
function dbShowSavingOverlayError(msg, submsg, retryFn) {
  var ov = document.getElementById('dbSavingOverlay');
  if (!ov) { alert(msg || 'Terjadi kesalahan.'); return; } // safety net kalau overlay belum sempat dibuat
  dbStopFakeProgress();
  dbSetSavingProgress(null);
  ov._isError = true;
  ov._retryFn = retryFn || null;
  ov.style.cursor = 'pointer';
  ov.style.backgroundColor = '#1a0505'; // semburat merah gelap solid, beda dari overlay normal
  document.getElementById('dbSavingRingSvg').style.display = 'none';
  document.getElementById('dbSavingEicWrap').style.display = 'none';
  document.getElementById('dbSavingErrorIcon').style.display = 'flex';
  document.getElementById('dbSavingOverlayMsg').textContent = msg || 'Terjadi kesalahan, proses tidak selesai.';
  document.getElementById('dbSavingOverlaySub').textContent = submsg || '';
  document.getElementById('dbSavingRetryBtn').style.display = retryFn ? 'inline-block' : 'none';
  document.getElementById('dbSavingOverlayTapHint').textContent = retryFn
    ? 'Tap "Coba Lagi" untuk mengulang, atau tap di luar untuk menutup'
    : 'Tap dimana saja untuk menutup';
  document.getElementById('dbSavingOverlayTapHint').style.display = 'block';
  ov.style.display = 'flex';
}

/* ── PROGRESS SIMULASI (fallback) ──
   Banyak respons Supabase/PostgREST (terutama GET/download) tidak mengirim
   header Content-Length (chunked transfer), sehingga e.lengthComputable
   selalu false dan event progress ASLI tidak pernah terpanggil. Supaya
   garis loading tidak diam/kosong, kita jalankan simulasi 0% -> ~90% yang
   melambat (asymptotic). Begitu progress ASLI datang (dbReportRealProgress),
   simulasi langsung berhenti dan angka asli yang dipakai. */
var _dbFakeProgressTimer = null;
var _dbFakeProgressVal = 0;
var _dbRealProgressSeen = false;
var _dbLastShownPercent = 0; // dipakai supaya progress gak pernah keliatan mundur/reset (lihat dbSetSavingProgress)

function dbStartFakeProgress() {
  _dbFakeProgressVal = 0;
  _dbRealProgressSeen = false;
  _dbLastShownPercent = 0;
  dbSetSavingProgress(0);
  clearInterval(_dbFakeProgressTimer);
  _dbFakeProgressTimer = setInterval(function () {
    if (_dbRealProgressSeen) { clearInterval(_dbFakeProgressTimer); return; }
    _dbFakeProgressVal += (90 - _dbFakeProgressVal) * 0.08 + 0.4;
    if (_dbFakeProgressVal > 90) _dbFakeProgressVal = 90;
    dbSetSavingProgress(_dbFakeProgressVal);
  }, 180);
}

function dbStopFakeProgress() {
  clearInterval(_dbFakeProgressTimer);
  _dbFakeProgressTimer = null;
}

/* Dipanggil dari callback onProgress supaFetchProgress ketika ada progress ASLI
   (lengthComputable true, atau expectedTotal sudah diketahui duluan). Menghentikan
   simulasi & memakai angka sebenarnya. */
function dbReportRealProgress(percent) {
  _dbRealProgressSeen = true;
  dbSetSavingProgress(percent);
}

/* ── SET PROGRESS 0-100% di overlay ──
   percent = null/undefined -> sembunyikan garis progress (dipakai saat overlay ditutup,
   ini juga me-reset _dbLastShownPercent supaya overlay berikutnya mulai dari 0 lagi).
   Progress SENGAJA dibikin gak pernah mundur (selalu ambil nilai terbesar antara yang
   lama & yang baru) -- soalnya kalau simulasi sempat jalan duluan lalu progress ASLI
   datang mulai dari angka lebih kecil, angkanya bakal keliatan "loncat balik ke 0%
   terus naik lagi", yang kesannya kayak loading dua kali padahal cuma satu proses. */
function dbSetSavingProgress(percent) {
  var wrap = document.getElementById('dbSavingProgressWrap');
  var bar  = document.getElementById('dbSavingProgressBar');
  var pct  = document.getElementById('dbSavingProgressPct');
  if (!wrap || !bar || !pct) return;
  if (percent === null || percent === undefined || isNaN(percent)) {
    wrap.style.display = 'none';
    pct.style.display = 'none';
    _dbLastShownPercent = 0;
    return;
  }
  var p = Math.max(0, Math.min(100, Math.round(percent)));
  if (p < _dbLastShownPercent) p = _dbLastShownPercent; // jangan pernah mundur
  _dbLastShownPercent = p;
  wrap.style.display = 'block';
  pct.style.display = 'block';
  bar.style.width = p + '%';
  pct.textContent = p + '%';
}

/* ── DB SAVE (generic — modul-specific dbCollectData defined per page) ── */
function dbSave(modul, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
  if (window._dbSaving) return; // cegah klik dobel saat masih proses simpan
  var _dbSaveRetryArgs = arguments; // dipakai tombol "Coba Lagi" -- ulang panggilan ini persis kalau gagal
  var rec, existingId, callback;
  if (arg6 !== undefined && typeof arg6 === 'object') {
    rec = { modul:modul, tanggal:arg2||null, pic:arg3||null, work_order:arg4||null,
            unit:arg5||'Unit 7', data:arg6, updated_at:new Date().toISOString() };
    existingId = arg7 || window._editingId || null;
    callback = arg8 || null;
  } else {
    if (typeof dbCollectData !== 'function') { alert('dbCollectData tidak ditemukan'); return; }
    rec = dbCollectData(modul);
    if (!rec) return;
    rec.updated_at = new Date().toISOString();
    existingId = (typeof arg2 === 'string' && arg2.length > 10) ? arg2 : (window._editingId || null);
    callback = null;
  }
  var btn = null;
  try { btn = event && event.target && event.target.tagName === 'BUTTON' ? event.target : null; } catch(e){}
  var origText = btn ? btn.innerHTML : '';
  window._dbSaving = true;
  if (btn) { btn.innerHTML = '⏳ Menyimpan...'; btn.disabled = true; }
  dbShowSavingOverlay(true, existingId ? 'Memperbarui data, mohon tunggu...' : 'Menyimpan data, mohon tunggu...', 'Mengupload foto ke Google Drive dulu, mohon tunggu...');
  // Tunggu semua upload foto ke Google Drive yang masih berjalan (dipicu pas
  // user crop foto) kelar dulu, LALU pastikan SEMUA foto benar-benar sudah
  // di Drive (retry sampai 3x per foto kalau ada yang masih gagal) --
  // upload ke Drive sekarang WAJIB, bukan lagi best-effort. Kalau setelah
  // semua percobaan masih ada foto yang gagal, data TIDAK disimpan sama
  // sekali (lihat blok if di bawah) -- supaya tidak ada lagi laporan yang
  // diam-diam jadi puluhan MB karena fotonya nempel base64 tanpa user sadar.
  waitForPendingDriveUploads().then(function() {
    return _pmEnsureAllPhotosOnDrive(rec.data, modul);
  }).then(function(stillFailed) {
    if (stillFailed.length) {
      window._dbSaving = false;
      if (btn) { btn.innerHTML = origText; btn.disabled = false; }
      dbShowSavingOverlayError(
        'Gagal upload ' + stillFailed.length + ' foto ke Google Drive.',
        'Data BELUM disimpan supaya foto tidak nyangkut/hilang. Cek koneksi internet, lalu coba lagi. Foto: ' + stillFailed.slice(0, 3).join(', ') + (stillFailed.length > 3 ? ', dll.' : ''),
        function(){ dbSave.apply(null, _dbSaveRetryArgs); }
      );
      return; // hentikan di sini -- overlay error+retry sudah ditampilkan di atas, jangan lanjut simpan
    }
    _pmStripBase64ForSave(rec.data);
    // Ukuran byte payload SETELAH base64 yang sudah punya driveUrl dibuang --
    // disimpan sebagai payload_size buat acuan/estimasi.
    rec.payload_size = _dbByteLength(JSON.stringify(rec));
    dbStartFakeProgress();
    var op = existingId ? pmDbUpdate(existingId, rec) : pmDbInsert(rec);
    op
      .then(function(rows) {
        window._dbSaving = false;
        dbStopFakeProgress();
        dbSetSavingProgress(100);
        dbShowSavingOverlay(false);
        if (btn) { btn.innerHTML = origText; btn.disabled = false; }
        var savedId = (rows && rows[0] && rows[0].id) ? rows[0].id : existingId;
        // PENTING: tetap "nempel" ke record yang sama (bukan di-null-kan) supaya
        // klik Simpan berikutnya tetap UPDATE record ini, bukan bikin duplikat baru.
        // _editingId hanya boleh direset ke null lewat tombol Reset/mulai entri baru.
        window._editingId = savedId || null;
        if (typeof autosaveClear === 'function') autosaveClear();
        dbShowToast(existingId ? '✓ Data berhasil diperbarui!' : '✓ Data berhasil disimpan!');
        if (callback) callback(savedId);
      })
      .catch(function(err) {
        window._dbSaving = false;
        if (btn) { btn.innerHTML = origText; btn.disabled = false; }
        // Sengaja TIDAK pakai dbShowToast di sini -- toast otomatis hilang
        // dalam 3 detik, jadi kalau user lagi AFK/HP diletak pas errornya
        // kejadian, notifikasinya kelewat dan data yang gagal simpan
        // (kadang sudah termasuk banyak foto) jadi tidak ketahuan.
        dbShowSavingOverlayError('Gagal menyimpan data.', err.message || String(err), function(){ dbSave.apply(null, _dbSaveRetryArgs); });
      });
  });
}

/* ── EDIT DI TEMPAT (Checker/Reviewer betulkan isi laporan TANPA ikut
   pindah status) — dipakai halaman modul saat dibuka lewat tombol "Edit"
   di Submit Report.html untuk record yang sudah SUBMITTED/CHECKED.
   BEDA dari dbSave(): lewat client yang SUDAH LOGIN (raGetClient, bukan
   anon key) supaya RLS "pm_records_checker_edit_in_place" /
   "pm_records_reviewer_edit_in_place" (lihat sql/003_edit_in_place.sql)
   berlaku -- dan TIDAK MENGIRIM field status sama sekali (biar tetap
   di status semula, cuma isi datanya yang berubah). Struktur payload
   (rec) sama persis seperti dbSave: dari dbCollectData(modul), foto
   di-strip base64-nya kalau sudah punya driveUrl. */
function raResaveInPlace(modul, callback) {
  if (window._dbSaving) return;
  if (typeof dbCollectData !== 'function') { alert('dbCollectData tidak ditemukan'); return; }
  var rec = dbCollectData(modul);
  if (!rec) return;
  var existingId = window._editingId || null;
  if (!existingId) { alert('Tidak ada record yang sedang dibuka untuk diedit.'); return; }

  window._dbSaving = true;
  dbShowSavingOverlay(true, 'Menyimpan perubahan, mohon tunggu...', 'Mengupload banyak gambar membutuhkan waktu yang lama');
  waitForPendingDriveUploads().then(function() {
    _pmStripBase64ForSave(rec.data);
    var patch = {
      data: rec.data, tanggal: rec.tanggal, pic: rec.pic, work_order: rec.work_order,
      updated_at: new Date().toISOString()
    };
    raUpdateRecord(existingId, patch, function(err, updated) {
      window._dbSaving = false;
      dbShowSavingOverlay(false);
      if (err) {
        dbShowSavingOverlayError('Gagal menyimpan perubahan.', err, function(){ raResaveInPlace(modul, callback); });
        return;
      }
      dbShowToast('✓ Perubahan tersimpan (status tidak berubah)');
      if (callback) callback(updated);
    });
  });
}

/* ── DB LIST (untuk history page) ──
   Firestore tidak bisa "select kolom" -> pmDbList() ambil doc utuh tapi
   TIDAK mem-parse `data` (skipData) supaya tetap ringan. orderBy('updated_at')
   -> doc tanpa field itu tidak akan muncul; semua penyimpanan baru selalu
   men-set updated_at, jadi aman untuk data yang dibuat sistem ini. */
function dbList(modul, callback) {
  pmDbList()
    .then(function(rows) {
      if (!modul) { callback(rows || []); return; }
      var normFilter = normalizeModul(modul);
      var filtered = (rows || []).filter(function(r) {
        return normalizeModul(r.modul) === normFilter;
      });
      callback(filtered);
    })
    .catch(function(){ callback([]); });
}

/* ── NORMALIZE MODUL NAME ── */
function normalizeModul(name) {
  if (!name) return '';
  var n = name.toUpperCase();
  // HARUS sebelum cek FEGT/LEAK di bawah -- 'GENERATOR_STATOR_LEAK' (nilai
  // modul asli generator_stator_leak_monitoring.html) juga mengandung
  // substring 'LEAK', jadi kalau urutannya dibalik bakal ke-normalize
  // salah jadi 'FEGT' (bug lama: record ini kebuka lewat fegt.html dari
  // history.html -- file salah, struktur data-nya beda sama sekali).
  if (n.indexOf('GENERATOR')>=0 && n.indexOf('STATOR')>=0) return 'GENERATOR_STATOR_LEAK';
  if (n.indexOf('FEGT')>=0 || n.indexOf('LEAK')>=0) return 'FEGT';
  if (n.indexOf('SO2')>=0 || n.indexOf('SCRUBBER')>=0) return 'SO2';
  // HARUS sebelum cek O2 di bawah -- bukan cuma soal urutan proteksi
  // seperti SO2 (nilai 'Mark VIe...' tidak mengandung 'O2'), tapi
  // sebelumnya mark_vie_inspection.html sama sekali tidak ke-mapping
  // (jatuh ke fallback `return n` di paling bawah) -- history.html
  // jadinya gak tahu mesti buka file mana buat modul ini.
  if (n.indexOf('MARK VI')>=0) return 'MARK_VIE';
  if (n.indexOf('O2')>=0) return 'O2';
  if (n.indexOf('OPACITY')>=0) return 'OPACITY';
  if (n.indexOf('CEMS')>=0) return 'CEMS_CALIBRATION';
  if (n.indexOf('BELT')>=0 || n.indexOf('CONVEYOR')>=0) {
    if (n.indexOf('E4')>=0 || n.indexOf('E45')>=0 || (n.indexOf('E-4')>=0)) return 'BELT_E45';
    if (n.indexOf('E2')>=0 || n.indexOf('E23')>=0 || (n.indexOf('E-2')>=0)) return 'BELT_E23';
    if (n.indexOf('B1')>=0 || n.indexOf('B12')>=0 || (n.indexOf('B-1')>=0)) return 'BELT_B12';
    return 'BELT';
  }
  if (n.indexOf('MAINTENANCE')>=0 || n.indexOf('REPORT')>=0) return 'MAINTENANCE_REPORT';
  if (n.indexOf('SILO')>=0) return 'COAL_SILO_LEVEL';
  if (n.indexOf('COAL')>=0 || n.indexOf('FEEDER')>=0) return 'COAL_FEEDER';
  if (n.indexOf('DCS')>=0 || n.indexOf('HMI')>=0 || n.indexOf('OIS')>=0) return 'DCS_HMI';
  if (n.indexOf('FLOW METER')>=0 || n.indexOf('FLOWMETER')>=0 || n.indexOf('FGD')>=0) return 'FLOWMETER_FGD';
  if (n.indexOf('CONDUCTIVITY')>=0) return 'CONDUCTIVITY';
  if (n.indexOf('HG')>=0 || n.indexOf('MERCURY')>=0) return 'PM_HG_ANALYZER';
  if (n.indexOf('PH')>=0 || n.indexOf('TRANSMITTER')>=0 || n.indexOf('AIT')>=0 || n.indexOf('ANALYZER')>=0) return 'PH-ANALYZER';
  return n;
}

/* ── MODUL -> URL HALAMAN ──
   Versi kanonis (dulu ada 2 salinan identik di history.html & submit-report.html
   yang gampang nyimpang) -- dipakai history.html DAN raRetryPendingFirebaseSyncs()
   (perlu tahu halaman modul mana yang harus dibuka lewat iframe tersembunyi
   buat kirim ulang PDF yang belum sukses ke Firebase). */
function raModulToUrl(modul, id) {
  var norm = normalizeModul(modul);
  if (norm === 'FEGT')               return 'fegt.html?id=' + id;
  if (norm === 'CEMS_CALIBRATION')   return 'cems_calibration.html?id=' + id;
  if (norm === 'SO2')                return 'so2.html?id=' + id;
  if (norm === 'OPACITY')            return 'opacity.html?id=' + id;
  if (norm === 'BELT_E45')           return 'beltscale-e45.html?id=' + id;
  if (norm === 'BELT_E23')           return 'beltscale-e23.html?id=' + id;
  if (norm === 'BELT_B12')           return 'beltscale-b12.html?id=' + id;
  if (norm === 'MAINTENANCE_REPORT') return 'maintenance_report_form.html?id=' + id;
  if (norm === 'COAL_FEEDER')        return 'coal_feeder_calibration.html?id=' + id;
  if (norm === 'DCS_HMI')            return 'dcs-hmi-inspection.html?id=' + id;
  if (norm === 'PH-ANALYZER')        return 'ph-analyzer.html?id=' + id;
  if (norm === 'COAL_SILO_LEVEL')    return 'coal-silo-level.html?id=' + id;
  if (norm === 'CONDUCTIVITY')       return 'conductivity.html?id=' + id;
  if (norm === 'FLOWMETER_FGD')      return 'flow-meter-fgd.html?id=' + id;
  if (norm === 'PM_HG_ANALYZER')     return 'pm-hg-analyzer.html?id=' + id;
  if (norm === 'O2')                 return 'form_o2_report.html?id=' + id;
  if (norm === 'GENERATOR_STATOR_LEAK') return 'generator_stator_leak_monitoring.html?id=' + id;
  if (norm === 'MARK_VIE')              return 'mark_vie_inspection.html?id=' + id;
  return 'index.html';
}
function raModulToPrintUrl(modul, id) {
  var u = raModulToUrl(modul, id);
  return u === 'index.html' ? u : (u + '&print=1');
}

/* ── FILE TYPE HELPERS ── */
var IMG_EXTS = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|cr2|nef|arw|orf|rw2|dng|raw|svg)$/i;
var VIDEO_EXTS = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;
var HEIC_EXTS = /\.(heic|heif)$/i;

function isImageFile(file) {
  return IMG_EXTS.test(file.name) || (file.type && file.type.startsWith('image/'));
}
function fileIcon(name) {
  if (IMG_EXTS.test(name)) return '🖼️';
  if (VIDEO_EXTS.test(name)) return '🎥';
  if (/\.pdf$/i.test(name)) return '📄';
  if (/\.(doc|docx)$/i.test(name)) return '📝';
  if (/\.(xls|xlsx)$/i.test(name)) return '📊';
  return '📁';
}

function openFileInputSource(inputId, source) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.value = '';
  input.removeAttribute('capture');
  if (source === 'camera') {
    input.setAttribute('capture', 'environment');
  }
  input.click();
}

function toggleSourceChoices(elementId) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = (el.style.display === 'flex' || el.style.display === 'block') ? 'none' : 'flex';
}

/* ── IMAGE LOADING OVERLAY ── */
function showImgLoading(msg) {
  var el = document.getElementById('imgLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'imgLoadingOverlay';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:15px;gap:12px';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div style="font-size:36px">⏳</div><div>' + (msg||'Memproses gambar...') + '</div>';
  el.style.display = 'flex';
}
function hideImgLoading() {
  var el = document.getElementById('imgLoadingOverlay');
  if (el) el.style.display = 'none';
}

function showHeicWarning() {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:320px;width:100%">' +
    '<div style="font-size:16px;font-weight:700;color:#111;margin-bottom:12px">Format HEIC tidak didukung</div>' +
    '<div style="font-size:13px;color:#444;line-height:1.6">Android Chrome tidak bisa membaca file HEIC.<br><br>' +
    '<b>Solusi:</b><br>• Buka foto di Galeri → Share → pilih <b>JPG</b><br>• Atau screenshot foto tersebut<br>• Lalu upload gambar JPG/PNG</div>' +
    '<button onclick="this.parentNode.parentNode.remove()" style="margin-top:16px;width:100%;padding:10px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Mengerti</button>' +
    '</div>';
  document.body.appendChild(d);
}

/* ── IMAGE CONVERTER: file → JPEG dataUrl ── */
function fileToJpegDataUrl(file, callback) {
  showImgLoading('Memproses ' + file.name + '...');
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function() {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth || 800;
      c.height = img.naturalHeight || 600;
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      hideImgLoading();
      callback(c.toDataURL('image/jpeg', 0.92));
    } catch(e) {
      URL.revokeObjectURL(url);
      strategy2(file, callback);
    }
  };
  img.onerror = function() {
    URL.revokeObjectURL(url);
    strategy2(file, callback);
  };
  img.src = url;
}

function strategy2(file, callback) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      try {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth || 800;
        c.height = img.naturalHeight || 600;
        c.getContext('2d').drawImage(img, 0, 0);
        hideImgLoading();
        callback(c.toDataURL('image/jpeg', 0.92));
      } catch(e) {
        hideImgLoading();
        callback(ev.target.result);
      }
    };
    img.onerror = function() {
      hideImgLoading();
      var ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'heic' || ext === 'heif') { showHeicWarning(); callback(null); }
      else callback(ev.target.result);
    };
    img.src = ev.target.result;
  };
  reader.onerror = function() {
    hideImgLoading();
    alert('Gagal membaca file: ' + file.name + '\n\nKemungkinan sebab:\n\u2022 Foto masih tersimpan di cloud (Google Photos / Samsung Cloud) dan belum terunduh penuh ke HP \u2014 buka foto itu di aplikasi Galeri sampai termuat penuh, lalu coba upload lagi.\n\u2022 File terlalu besar atau format tidak didukung.\n\nJika masih gagal, coba screenshot foto tersebut lalu upload screenshot-nya.');
    callback(null);
  };
  reader.readAsDataURL(file);
}

/* ── CROP ENGINE ── */
function cropLinkSize(changed) {
  var locked = document.getElementById('cropLock').checked;
  if (!locked) return;
  var box = document.getElementById('cropBox');
  var ratio = box.offsetWidth / box.offsetHeight;
  var wEl = document.getElementById('cropOutW'), hEl = document.getElementById('cropOutH');
  if (changed === 'w' && wEl.value) hEl.value = Math.round(parseInt(wEl.value) / ratio);
  else if (changed === 'h' && hEl.value) wEl.value = Math.round(parseInt(hEl.value) * ratio);
}

function cropReset() {
  var img = document.getElementById('cropImg');
  var box = document.getElementById('cropBox');
  var wrap = document.getElementById('cropWrap');
  var ww = wrap.clientWidth, wh = wrap.clientHeight;
  var iw = img.naturalWidth, ih = img.naturalHeight;
  var scale = Math.min(ww/iw, wh/ih, 1);
  img.style.width = (iw*scale)+'px'; img.style.height = (ih*scale)+'px';
  img.style.left = ((ww-iw*scale)/2)+'px'; img.style.top = ((wh-ih*scale)/2)+'px';
  box.style.left = img.style.left; box.style.top = img.style.top;
  box.style.width = (iw*scale)+'px'; box.style.height = (ih*scale)+'px';
  document.getElementById('cropOutW').value = iw;
  document.getElementById('cropOutH').value = ih;
}

function imgOpenCropper(dataUrl, name, type, imgArr, side, modulePrefix, replaceIdx) {
  var modal = document.getElementById('cropModal');
  var cropImg = document.getElementById('cropImg');
  modal._pending = {dataUrl:dataUrl, name:name, type:type, imgArr:imgArr, side:side, modulePrefix:modulePrefix, replaceIdx:(replaceIdx!==undefined?replaceIdx:-1)};

  function initCropBox() {
    var box = document.getElementById('cropBox');
    var wrap = document.getElementById('cropWrap');
    var iw = cropImg.naturalWidth, ih = cropImg.naturalHeight;
    if (!iw || !ih) { iw = 800; ih = 600; }
    var ww = wrap.clientWidth || 300, wh = wrap.clientHeight || 280;
    var scale = Math.min(ww/iw, wh/ih, 1);
    var dw = iw*scale, dh = ih*scale;
    cropImg.style.width = dw+'px'; cropImg.style.height = dh+'px';
    cropImg.style.position = 'absolute';
    cropImg.style.left = ((ww-dw)/2)+'px'; cropImg.style.top = ((wh-dh)/2)+'px';
    box.style.left = cropImg.style.left; box.style.top = cropImg.style.top;
    box.style.width = dw+'px'; box.style.height = dh+'px';
    document.getElementById('cropOutW').value = iw;
    document.getElementById('cropOutH').value = ih;
    document.getElementById('cropNatSize').textContent = iw + ' x ' + ih + ' px';
    initDragCrop(box, wrap);
  }

  cropImg.onload = function() { initCropBox(); };
  cropImg.onerror = function() {
    modal.style.display = 'none';
    imgCompressAndStore(null, name, imgArr, side, modulePrefix, dataUrl);
  };
  modal.style.display = 'flex';
  cropImg.src = ''; cropImg.src = dataUrl;
  if (cropImg.complete && cropImg.naturalWidth) { initCropBox(); }
}

function initDragCrop(box, wrap) {
  var startX, startY, startL, startT, startW, startH, mode;
  box.onmousedown = box.ontouchstart = function(e) {
    e.preventDefault();
    var touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX; startY = touch.clientY;
    startL = parseInt(box.style.left)||0; startT = parseInt(box.style.top)||0;
    startW = box.offsetWidth; startH = box.offsetHeight;
    var bRect = box.getBoundingClientRect();
    var rx = touch.clientX - bRect.left, ry = touch.clientY - bRect.top;
    var edgeX = rx < 16 ? 'l' : rx > startW-16 ? 'r' : '';
    var edgeY = ry < 16 ? 't' : ry > startH-16 ? 'b' : '';
    mode = (edgeX||edgeY) ? edgeX+edgeY : 'move';

    function onMove(ev) {
      var t = ev.touches ? ev.touches[0] : ev;
      var dx = t.clientX - startX, dy = t.clientY - startY;
      var img = document.getElementById('cropImg');
      var iLeft = parseInt(img.style.left)||0, iTop = parseInt(img.style.top)||0;
      var iW = img.offsetWidth, iH = img.offsetHeight;
      if (mode === 'move') {
        var nl = Math.max(iLeft, Math.min(iLeft+iW-startW, startL+dx));
        var nt = Math.max(iTop, Math.min(iTop+iH-startH, startT+dy));
        box.style.left = nl+'px'; box.style.top = nt+'px';
      } else {
        var nl = parseInt(box.style.left)||startL, nt = parseInt(box.style.top)||startT;
        var nw = startW, nh = startH;
        if(mode.includes('r')) nw = Math.max(40, Math.min(iLeft+iW-nl, startW+dx));
        if(mode.includes('b')) nh = Math.max(40, Math.min(iTop+iH-nt, startH+dy));
        if(mode.includes('l')){ nl=Math.max(iLeft,Math.min(startL+startW-40,startL+dx)); nw=startL+startW-nl; }
        if(mode.includes('t')){ nt=Math.max(iTop,Math.min(startT+startH-40,startT+dy)); nh=startT+startH-nt; }
        box.style.left=nl+'px'; box.style.top=nt+'px'; box.style.width=nw+'px'; box.style.height=nh+'px';
      }
    }
    function onUp() {
      document.removeEventListener('mousemove',onMove); document.removeEventListener('touchmove',onMove);
      document.removeEventListener('mouseup',onUp); document.removeEventListener('touchend',onUp);
    }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('mouseup',onUp);
    document.addEventListener('touchend',onUp);
  };
}

function cropAndSave() {
  var modal = document.getElementById('cropModal');
  var p = modal._pending;
  var img = document.getElementById('cropImg');
  var box = document.getElementById('cropBox');
  var iLeft = parseInt(img.style.left)||0, iTop = parseInt(img.style.top)||0;
  var iW = img.offsetWidth, iH = img.offsetHeight;
  var bLeft = parseInt(box.style.left)||0, bTop = parseInt(box.style.top)||0;
  var bW = box.offsetWidth, bH = box.offsetHeight;
  var scale = img.naturalWidth / iW;
  var sx = (bLeft-iLeft)*scale, sy = (bTop-iTop)*scale;
  var sw = bW*scale, sh = bH*scale;
  var outW = parseInt(document.getElementById('cropOutW').value)||Math.round(sw);
  var outH = parseInt(document.getElementById('cropOutH').value)||Math.round(sh);
  var canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  modal.style.display = 'none';
  var caption = '';
  var existing = (p.replaceIdx >= 0 && p.imgArr[p.replaceIdx]) ? p.imgArr[p.replaceIdx] : null;
  if (existing) caption = existing.caption || '';
  imgCompressAndStore(canvas, p.name, p.imgArr, p.side, p.modulePrefix, null, caption, existing ? p.replaceIdx : -1);
}

function skipCrop() {
  var modal = document.getElementById('cropModal');
  var p = modal._pending;
  modal.style.display = 'none';
  var caption = '';
  var existing = (p.replaceIdx >= 0 && p.imgArr[p.replaceIdx]) ? p.imgArr[p.replaceIdx] : null;
  if (existing) caption = existing.caption || '';
  var img2 = new Image();
  img2.onload = function(){
    var c = document.createElement('canvas');
    c.width = img2.naturalWidth; c.height = img2.naturalHeight;
    c.getContext('2d').drawImage(img2,0,0);
    imgCompressAndStore(c, p.name, p.imgArr, p.side, p.modulePrefix, null, caption, existing ? p.replaceIdx : -1);
  };
  img2.onerror = function(){ imgCompressAndStore(null, p.name, p.imgArr, p.side, p.modulePrefix, p.dataUrl, caption, existing ? p.replaceIdx : -1); };
  img2.src = p.dataUrl;
}

function imgCompressAndStore(canvas, name, imgArr, side, modulePrefix, rawDataUrl, caption, replaceIdx) {
  // Diturunkan dari 1MB -- laporan dengan BANYAK kelompok foto terpisah (mis.
  // Coal Feeder Calibration: 17 kelompok evidence, masing-masing dijatah
  // budget ini SENDIRI-SENDIRI) jadi PDF akhirnya besar totalnya (17 x 1MB =
  // ~17MB + overhead PDF = ~19MB yang ditemukan user) meski tiap kelompok
  // sudah benar terkompresi sesuai batasnya masing-masing. 500KB per
  // kelompok menghasilkan total yang jauh lebih masuk akal untuk laporan
  // banyak-section, kualitas tetap wajar untuk dilihat di layar/print biasa
  // (resolusi tetap di-cap 1920px duluan, lihat MAX_DIMENSION di bawah --
  // penurunan cap ini cuma mendorong kualitas JPEG turun sedikit lebih jauh
  // di foto yang sudah padat, bukan resolusinya).
  var MAX_TOTAL = 500 * 1024;
  // Cap resolusi maksimal SEBELUM kompresi kualitas dimulai. Foto kamera HP modern
  // biasanya 3000-4000px+ di sisi terpanjang, padahal di PDF foto ini paling besar
  // dicetak ~18cm lebar (lihat iePhotoDrawSize / maxPhotoW di tiap modul) -- di
  // 300dpi (kualitas cetak bagus) itu cuma butuh ~2126px. 1920px dipilih sebagai
  // batas aman (masih di atas kebutuhan cetak manapun di sistem ini) supaya TIDAK
  // ADA PENURUNAN KUALITAS YANG KELIHATAN, tapi total piksel (dan makanya ukuran
  // file) bisa turun drastis dibanding resolusi asli kamera. Ini dilakukan DULU,
  // baru sisa logika kompresi kualitas (0.85->0.25) jalan di atas kanvas yang
  // sudah dikecilkan -- jadi jarang perlu turun kualitas jauh sama sekali, karena
  // resolusi sudah masuk akal duluan.
  var MAX_DIMENSION = 1920;
  if (canvas && (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION)) {
    var capFactor = MAX_DIMENSION / Math.max(canvas.width, canvas.height);
    var capped = document.createElement('canvas');
    capped.width = Math.max(1, Math.round(canvas.width * capFactor));
    capped.height = Math.max(1, Math.round(canvas.height * capFactor));
    capped.getContext('2d').drawImage(canvas, 0, 0, capped.width, capped.height);
    canvas = capped;
  }
  var quality = 0.85, dataUrl;
  if (!canvas && rawDataUrl) { dataUrl = rawDataUrl; }
  else if (!canvas) { return; }
  if (canvas) {
    for (var q = quality; q >= 0.25; q -= 0.1) {
      dataUrl = canvas.toDataURL('image/jpeg', q);
      var currentTotal = imgArr.reduce(function(acc,im,i){return acc+((replaceIdx>=0 && i===replaceIdx) ? 0 : (im.dataUrl?im.dataUrl.length*0.75:0));},0);
      var newSize = dataUrl.length * 0.75;
      if (currentTotal + newSize <= MAX_TOTAL) break;
      if (q <= 0.25) {
        var factor = Math.sqrt(MAX_TOTAL / (currentTotal + newSize));
        var c2 = document.createElement('canvas');
        c2.width = Math.max(100, Math.floor(canvas.width * factor));
        c2.height = Math.max(100, Math.floor(canvas.height * factor));
        c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
        dataUrl = c2.toDataURL('image/jpeg', 0.7);
        break;
      }
    }
  }
  var entry = {name: name.replace(/\.[^.]+$/, '.jpg'), dataUrl: dataUrl, type: 'image/jpeg', caption: caption||''};
  // Foto lama yang lagi di-replace (crop-ulang) -- kalau sudah sempat ke-upload
  // ke Drive, fileId-nya disimpan dulu di sini SEBELUM entry lama diganti,
  // supaya bisa dihapus eksplisit dari Drive setelah versi barunya terupload.
  // Dihapus lewat fileId pasti (deleteFotoDariGDrive), BUKAN lewat cocokkan
  // nama file di server -- supaya tidak mungkin salah hapus file foto lain
  // yang kebetulan nama device-nya sama.
  var oldDriveFileId = (replaceIdx >= 0 && imgArr[replaceIdx]) ? imgArr[replaceIdx].driveFileId : null;
  // Foto yang di-edit ulang (replaceIdx>=0) ditaruh KEMBALI di posisi yang sama,
  // bukan dihapus lalu ditambahkan di akhir array — supaya urutan galeri (dan
  // keterangan yang mengikuti indexnya saat render) tidak berubah/tertukar.
  if (replaceIdx >= 0 && imgArr[replaceIdx]) imgArr.splice(replaceIdx, 1, entry);
  else imgArr.push(entry);
  uploadFotoKeGDrive(dataUrl, name, modulePrefix, caption, entry);
  if (oldDriveFileId) deleteFotoDariGDrive(oldDriveFileId);
  if (modulePrefix === 'op') { opRenderPreviews(side); updateSizeIndicator('op', side); }
  else if (modulePrefix === 'bs') { bsRenderPreviews(side); updateSizeIndicator('bs', side); }
  else if (modulePrefix === 'cf') { cfRenderPreviews(); updateSizeIndicator('cf', null); }
  else if (modulePrefix === 'ph') {
    if (typeof phRenderPreviews === 'function') phRenderPreviews(side);
    if (typeof phUpdateSizeInfo === 'function') phUpdateSizeInfo(side);
  }
  else if (modulePrefix === 'dcs') {
    if (typeof dcsRenderPreviews === 'function') dcsRenderPreviews(side);
  }
  else if (modulePrefix === 'cl') {
    if (typeof clRenderPreviews === 'function') clRenderPreviews(side);
  }
  else if (modulePrefix === 'ld') {
    if (typeof ldRenderPreviews === 'function') ldRenderPreviews(side);
  }
  else if (modulePrefix === 'fm') {
    if (typeof fmRenderPreviews === 'function') fmRenderPreviews(side);
  }
  else if (modulePrefix === 'hg') {
    if (typeof hgRenderPreviews === 'function') hgRenderPreviews(side);
  }
  else if (modulePrefix === 'cs') {
    if (typeof csRenderPreviews === 'function') csRenderPreviews(side);
    if (typeof csUpdateSizeInfo === 'function') csUpdateSizeInfo(side);
  }
}

function updateSizeIndicator(prefix, side) {
  var arr;
  if (prefix === 'op') arr = opImages[side];
  else if (prefix === 'bs') arr = bsImages[side];
  else if (prefix === 'cf') arr = (typeof cfImages !== 'undefined') ? cfImages : [];
  else arr = [];
  if (!arr) arr = [];
  var total = arr.reduce(function(acc,im){return acc+(im.dataUrl?im.dataUrl.length*0.75:0);},0);
  var kb = (total/1024).toFixed(0);
  var color = total > 900*1024 ? '#e74c3c' : total > 700*1024 ? '#f39c12' : 'var(--text3)';
  var el = prefix === 'cf'
    ? document.getElementById('cfSizeInfo')
    : document.getElementById(prefix+'SizeInfo'+side);
  if(el){ el.textContent = kb+' KB / 1024 KB'; el.style.color = color; }
}

/* ═══════════════════════════════════════════════════════
   AUTOSAVE DRAFT (IndexedDB) — jaga-jaga halaman tertutup
   tidak sengaja sebelum sempat klik Simpan.

   Cara pakai di tiap file modul (HTML):
   1. Di awal <script>, definisikan nama modul:
        window.CURRENT_MODUL = 'fegt';   // sesuaikan per modul
   2. Sediakan fungsi restoreDraftData(rec, editingId) yang mengisi
      ulang field form dari objek rec (struktur sama persis dengan
      return value dbCollectData(modul)). Lihat contoh di fegt.html.
   Modul yang BELUM punya restoreDraftData() otomatis dilewati
   (autosave tetap jalan di background, hanya prompt "lanjutkan draft"
   yang tidak akan muncul).
   ═══════════════════════════════════════════════════════ */
var AUTOSAVE_DB_NAME = 'pm_unit7_autosave';
var AUTOSAVE_STORE   = 'drafts';
var AUTOSAVE_DELAY   = 2500; // ms, debounce setelah berhenti mengetik/upload
var _autosaveTimer = null;
var _autosaveDbPromise = null;

function _autosaveOpenDb() {
  if (_autosaveDbPromise) return _autosaveDbPromise;
  _autosaveDbPromise = new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB tidak didukung browser ini')); return; }
    var req = indexedDB.open(AUTOSAVE_DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) db.createObjectStore(AUTOSAVE_STORE, {keyPath:'key'});
    };
    req.onsuccess = function(e){ resolve(e.target.result); };
    req.onerror = function(e){ reject(e.target.error); };
  });
  return _autosaveDbPromise;
}
function autosaveSet(key, value) {
  return _autosaveOpenDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(AUTOSAVE_STORE, 'readwrite');
      tx.objectStore(AUTOSAVE_STORE).put({key:key, value:value, savedAt:Date.now()});
      tx.oncomplete = function(){ resolve(); };
      tx.onerror = function(e){ reject(e.target.error); };
    });
  });
}
function autosaveGet(key) {
  return _autosaveOpenDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(AUTOSAVE_STORE, 'readonly');
      var req = tx.objectStore(AUTOSAVE_STORE).get(key);
      req.onsuccess = function(){ resolve(req.result || null); };
      req.onerror = function(e){ reject(e.target.error); };
    });
  });
}
function autosaveDelete(key) {
  return _autosaveOpenDb().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(AUTOSAVE_STORE, 'readwrite');
      tx.objectStore(AUTOSAVE_STORE).delete(key);
      tx.oncomplete = function(){ resolve(); };
      tx.onerror = function(e){ reject(e.target.error); };
    });
  });
}
function _autosaveKey() {
  var modul = window.CURRENT_MODUL || location.pathname.split('/').pop().replace(/\.html$/,'') || 'unknown';
  return 'draft_' + modul;
}
function _autosaveIndicator() {
  var el = document.getElementById('autosaveIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'autosaveIndicator';
    el.className = 'no-print';
    el.style.cssText = 'position:fixed;bottom:14px;right:14px;background:rgba(0,0,0,0.65);color:#cfe3f7;font-size:11px;padding:5px 11px;border-radius:14px;z-index:99998;pointer-events:none;opacity:0;transition:opacity .35s';
    document.body.appendChild(el);
  }
  el.textContent = '💾 Draft tersimpan otomatis';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.style.opacity='0'; }, 1800);
}
function autosaveTrigger() {
  window._raDirty = true; // dipakai AUTOSAVE SERVER di bawah -- ada perubahan sejak autosave server terakhir
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(function(){
    try {
      if (typeof dbCollectData !== 'function') return;
      var modul = window.CURRENT_MODUL || undefined;
      var rec = modul ? dbCollectData(modul) : dbCollectData();
      if (!rec) return;
      autosaveSet(_autosaveKey(), {rec: rec, editingId: window._editingId || null})
        .then(_autosaveIndicator).catch(function(){});
    } catch(e) {}
  }, AUTOSAVE_DELAY);
}

/* ── AUTOSAVE SERVER (diam-diam, ke Supabase) ──
   BEDA dari autosaveTrigger() di atas (itu draft LOKAL di IndexedDB, cuma
   buat recovery kalau tab kepencet close -- tidak pernah menyentuh
   database). Ini sungguhan nyimpan ke pm_records tiap 60 detik SEKALI,
   dari pertama kali halaman dibuka (timer mulai jalan begitu shared.js
   dimuat) sampai halaman ditutup/dipindah (setInterval otomatis berhenti
   begitu halaman unload, tidak perlu dibersihkan manual).
   Sengaja TIDAK pakai overlay/spinner apa pun -- background total, tidak
   boleh mengganggu user yang lagi ngisi form (beda dari Simpan/Submit
   manual yang memang harus kelihatan prosesnya). Kalau gagal (timeout/
   network error), cuma di-log ke console + skip diam-diam -- percobaan
   BERIKUTNYA 60 detik lagi yang akan coba lagi otomatis (bukan retry
   button manual seperti dbShowSavingOverlayError, karena ini tidak ada
   UI yang bisa di-tap user).
   window._raDirty (di-set true oleh autosaveTrigger() setiap ada
   input/change) dipakai supaya tick yang TIDAK ADA PERUBAHAN APA PUN sejak
   autosave server terakhir di-skip -- menghindari nyimpan draft kosong
   berulang-ulang kalau user cuma buka halaman lalu diam saja, dan
   menghindari request Supabase yang percuma. */
var RA_SERVER_AUTOSAVE_INTERVAL = 60000;

function _raServerAutosaveIndicator() {
  var el = document.getElementById('raServerAutosaveIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'raServerAutosaveIndicator';
    el.className = 'no-print';
    el.style.cssText = 'position:fixed;bottom:14px;right:14px;background:rgba(16,80,40,0.78);color:#d7ffe6;font-size:11px;padding:5px 11px;border-radius:14px;z-index:99998;pointer-events:none;opacity:0;transition:opacity .35s';
    document.body.appendChild(el);
  }
  var t = new Date();
  el.textContent = '☁️ Auto-tersimpan ' + String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.style.opacity = '0'; }, 2500);
}

function dbSaveSilent(modul) {
  if (window._dbSaving) return; // biarkan Simpan/Submit manual yang lagi jalan, jangan tabrakan
  if (typeof dbCollectData !== 'function') return;
  var rec = dbCollectData(modul);
  if (!rec) return;
  rec.updated_at = new Date().toISOString();
  var existingId = window._editingId || null;
  window._dbSaving = true;
  waitForPendingDriveUploads().then(function() {
    _pmStripBase64ForSave(rec.data);
    rec.payload_size = _dbByteLength(JSON.stringify(rec));
    var op = existingId ? pmDbUpdate(existingId, rec) : pmDbInsert(rec);
    op
      .then(function(rows) {
        window._dbSaving = false;
        var savedId = (rows && rows[0] && rows[0].id) ? rows[0].id : existingId;
        window._editingId = savedId || null;
        window._raDirty = false;
        if (typeof autosaveClear === 'function') autosaveClear(); // draft lokal tidak perlu lagi, sudah kepakai di server
        _raServerAutosaveIndicator();
      })
      .catch(function(err) {
        window._dbSaving = false;
        console.warn('[autosave-server] gagal simpan otomatis, akan dicoba lagi ~1 menit ke depan:', err);
      });
  });
}

setInterval(function() {
  try {
    if (!window._raDirty) return;
    if (window._dbSaving) return;
    if (typeof dbCollectData !== 'function') return;
    if (!window.CURRENT_MODUL) return;
    dbSaveSilent(window.CURRENT_MODUL);
  } catch (e) {}
}, RA_SERVER_AUTOSAVE_INTERVAL);
function autosaveClear() {
  autosaveDelete(_autosaveKey()).catch(function(){});
}
function autosaveCheckAndPrompt() {
  // Jangan tawarkan draft kalau memang sedang buka record dari RIWAYAT (?id=...)
  var params = new URLSearchParams(window.location.search);
  if (params.get('id')) return;
  if (typeof restoreDraftData !== 'function') return; // modul ini belum siap restore draft
  autosaveGet(_autosaveKey()).then(function(row){
    if (!row || !row.value || !row.value.rec) return;
    var savedAt = row.value.savedAt ? new Date(row.value.savedAt) : null;
    var timeStr = savedAt ? savedAt.toLocaleString('id-ID') : '';
    var msg = 'Ditemukan draft yang belum sempat disimpan' + (timeStr ? ' (terakhir diubah ' + timeStr + ')' : '') + '.\n\nLanjutkan mengisi draft ini?';
    if (confirm(msg)) {
      restoreDraftData(row.value.rec, row.value.editingId);
    } else {
      autosaveDelete(_autosaveKey()).catch(function(){});
    }
  }).catch(function(){});
}
// Trigger autosave saat ada perubahan input apa pun di halaman (event delegation)
document.addEventListener('input', autosaveTrigger, true);
document.addEventListener('change', autosaveTrigger, true);
// Simpan segera saat halaman mau ditutup/di-minimize (jaga-jaga sebelum sempat debounce)
document.addEventListener('visibilitychange', function(){
  if (document.visibilityState === 'hidden') {
    clearTimeout(_autosaveTimer);
    try {
      if (typeof dbCollectData !== 'function') return;
      var modul = window.CURRENT_MODUL || undefined;
      var rec = modul ? dbCollectData(modul) : dbCollectData();
      if (rec) autosaveSet(_autosaveKey(), {rec: rec, editingId: window._editingId || null});
    } catch(e) {}
  }
});
// Cek draft begitu halaman selesai load
if (document.readyState === 'complete') {
  setTimeout(autosaveCheckAndPrompt, 300);
} else {
  window.addEventListener('load', function(){ setTimeout(autosaveCheckAndPrompt, 300); });
}

/* ═══════════════════════════════════════════════════════
   REPORT AUTHENTICATION & WORKFLOW (ReportAuthManager, prefix "ra")
   ═══════════════════════════════════════════════════════
   INI TERPISAH TOTAL dari "GATE AKSES (Password + Trusted Device)" di
   atas -- jangan digabung/ditukar:
     - Gate akses (pmXxx)  = boleh MEMBUKA aplikasi sama sekali atau
       tidak (per device, sekali masuk berlaku terus).
     - ReportAuthManager (raXxx) = SIAPA (akun sungguhan: user1/checker1/
       spv1/admin1) yang sedang bertindak atas SATU laporan tertentu
       (submit/check/approve), dicatat sebagai audit trail di pm_records.

   Login pakai Firebase Auth (email+password), tapi user cukup ketik
   USERNAME -- dipetakan ke email internal @pmunit7.local di sini saja,
   tidak pernah terlihat oleh user. firebase-auth-compat dimuat on-demand
   lewat _raGetAuth() (lihat atas file).

   Skema Firestore yang dibutuhkan modul ini:
     collection pm_profiles: doc id = Firebase Auth UID,
       { username, role, display_name }
     field tambahan di doc pm_records: status, submitted_by, submitted_at,
       checked_by_account, checked_by_name, checked_signature_url, checked_at,
       reviewed_by_account, review_signature_url, final_approved_at, return_reason
     collection pm_signatures: doc id = slug(nama tampilan),
       { display_name, dataurl } -- PNG tanda tangan sebagai data-URL base64
   ── */

var RA_EMAIL_DOMAIN = '@pmunit7.local';
var RA_PROFILE_TABLE = 'pm_profiles';
var RA_SIGNATURE_COLLECTION = 'pm_signatures';

/* slug nama tampilan -> doc id di collection pm_signatures. Nama tampilan
   berasal dari dropdown "Checked By" / nama SPV -- BUKAN username akun. */
function _raSigSlug(name) {
  return (name || 'ttd').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '') || 'ttd';
}

var _raProfileCache = null; // {id, username, role, display_name} | null kalau belum login

/* Cek status login SEKARANG (dari session Firebase Auth yang persist
   otomatis -- tetap login walau halaman direfresh sampai logout eksplisit
   atau token expired). */
function raGetCurrentProfile(callback) {
  if (_raProfileCache) { callback(_raProfileCache); return; }
  _raGetAuth().then(function(auth) {
    var unsub = auth.onAuthStateChanged(function(user) {
      unsub();
      if (!user) { callback(null); return; }
      db.collection(RA_PROFILE_TABLE).doc(user.uid).get()
        .then(function(s) {
          _raProfileCache = s.exists ? Object.assign({ id: user.uid }, s.data()) : null;
          callback(_raProfileCache);
        })
        .catch(function() { callback(null); });
    });
  }).catch(function() { callback(null); });
}

function raLogin(username, password, callback) {
  _raGetAuth().then(function(auth) {
    return auth.signInWithEmailAndPassword(username + RA_EMAIL_DOMAIN, password)
      .then(function(cred) {
        return db.collection(RA_PROFILE_TABLE).doc(cred.user.uid).get().then(function(s) {
          if (!s.exists) {
            callback('Akun ditemukan tapi profil belum terdaftar di pm_profiles.', null);
            return;
          }
          _raProfileCache = Object.assign({ id: cred.user.uid }, s.data());
          callback(null, _raProfileCache);
        });
      });
  }).catch(function(err) { callback((err && err.message) || String(err), null); });
}

function raLogout(callback) {
  _raGetAuth().then(function(auth) { return auth.signOut(); })
    .then(function() { _raProfileCache = null; if (callback) callback(); })
    .catch(function() { _raProfileCache = null; if (callback) callback(); });
}

/* Modal login report-level (BEDA TAMPILAN dari modal gate akses supaya
   user tidak bingung keduanya). requiredRoles = array role yang boleh
   (mis. ['checker','admin']) atau null/undefined (siapa saja asal login). */
function raShowLoginModal(requiredRoles, title, onSuccess) {
  var old = document.getElementById('raLoginModal');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var wrap = document.createElement('div');
  wrap.id = 'raLoginModal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,18,0.6);z-index:2000000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif';
  wrap.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:22px;width:min(94vw,340px);box-shadow:0 10px 40px rgba(0,0,0,0.35)">' +
      '<div style="font-weight:800;font-size:15px;margin-bottom:4px;color:#1f2937">' + (title || 'Login diperlukan') + '</div>' +
      '<div style="font-size:12px;color:#6b7280;margin-bottom:14px">Masukkan akun laporan Anda untuk melanjutkan aksi ini.</div>' +
      '<input id="raLoginUser" type="text" placeholder="Username" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #ddd;border-radius:8px;margin-bottom:8px;font-size:14px">' +
      '<input id="raLoginPass" type="password" placeholder="Password" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #ddd;border-radius:8px;margin-bottom:8px;font-size:14px">' +
      '<div id="raLoginError" style="color:#e74c3c;font-size:12px;min-height:16px;margin-bottom:6px"></div>' +
      '<button id="raLoginSubmit" style="width:100%;padding:11px;border:none;border-radius:8px;background:#16a085;color:#fff;font-weight:700;cursor:pointer;margin-bottom:8px;font-size:14px">Masuk</button>' +
      '<button id="raLoginCancel" style="width:100%;padding:9px;border:none;border-radius:8px;background:#f3f4f6;color:#4b5563;font-weight:600;cursor:pointer;font-size:13px">Batal</button>' +
    '</div>';
  document.body.appendChild(wrap);
  document.getElementById('raLoginCancel').onclick = function() {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
  };
  document.getElementById('raLoginSubmit').onclick = function() {
    var u = document.getElementById('raLoginUser').value.trim();
    var p = document.getElementById('raLoginPass').value;
    var errEl = document.getElementById('raLoginError');
    if (!u || !p) { errEl.textContent = 'Username & password wajib diisi.'; return; }
    errEl.textContent = 'Memeriksa...';
    raLogin(u, p, function(err, profile) {
      if (err) { errEl.textContent = err; return; }
      if (requiredRoles && requiredRoles.indexOf(profile.role) === -1) {
        errEl.textContent = 'Akun ini (role: ' + profile.role + ') tidak punya akses untuk aksi ini.';
        raLogout();
        return;
      }
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      onSuccess(profile);
    });
  };
}

/* Pastikan sudah login DENGAN ROLE YANG SESUAI sebelum menjalankan aksi.
   Kalau sudah -> langsung onSuccess(profile). Kalau belum -> tampilkan modal. */
function raRequireLogin(requiredRoles, title, onSuccess) {
  raGetCurrentProfile(function(profile) {
    if (profile && (!requiredRoles || requiredRoles.indexOf(profile.role) !== -1)) {
      onSuccess(profile);
      return;
    }
    raShowLoginModal(requiredRoles, title, onSuccess);
  });
}

/* Update doc pm_records lewat Firestore, lalu ambil ulang doc-nya supaya
   callback dapat record lengkap terbaru (dulu PostgREST .select().single()).
   Model kepercayaan: gating per-role SEKARANG di sisi aplikasi (rules
   Firestore terbuka penuh, sama seperti Electric) -- dulu RLS Postgres. */
function raUpdateRecord(recordId, patch, callback) {
  var ref = db.collection(PM_COLLECTION).doc(recordId);
  ref.set(pmSerializeRec(patch), { merge: true })
    .then(function() { return ref.get(); })
    .then(function(s) { callback(null, s.exists ? pmDocToRec(s) : null); })
    .catch(function(err) { callback((err && err.message) || String(err), null); });
}

/* Ambil tanda tangan (PNG data-URL) untuk nama tampilan tertentu dari
   collection pm_signatures. Doc id = slug(displayName). Isi diisi lewat
   pad TTD (raSignPadSave) atau manual oleh admin. */
function raGetSignatureDataUrl(displayName, callback) {
  db.collection(RA_SIGNATURE_COLLECTION).doc(_raSigSlug(displayName)).get()
    .then(function(s) {
      var u = s.exists && s.data().dataurl;
      if (u) callback(null, u);
      else callback('Tanda tangan untuk "' + displayName + '" belum ada.', null);
    })
    .catch(function(err) { callback((err && err.message) || String(err), null); });
}

/* Kompat: beberapa pemanggil lama minta "URL" -- sekarang data-URL langsung. */
function raGetSignatureUrl(displayName, callback) {
  raGetSignatureDataUrl(displayName, callback);
}

/* Dipanggil oleh tiap modul SEBELUM drawSignatureBlock() (lihat shared.js
   bagian atas), buat nyiapin nama & gambar tanda tangan checker/reviewer
   berdasarkan STATUS record yang lagi dibuka -- supaya PDF yang
   di-export/preview otomatis nampilin tanda tangan ASLI (bukan cuma nama
   teks) begitu laporan sudah diverifikasi/di-approve lewat
   submit-report.html.
     - record null / status DRAFT / SUBMITTED -> semua null (belum ada yang
       tanda tangan, drawSignatureBlock jatuh ke default text-only seperti
       biasa).
     - status CHECKED / FINAL_APPROVED -> checkedByName dari
       record.checked_by_name langsung (kolom teks, sudah ada), tanda
       tangannya di-fetch dari Storage.
     - status FINAL_APPROVED -> reviewedByName di-resolve dulu dari
       record.reviewed_by_account (uuid) -> pm_profiles.display_name (TIDAK
       disimpan sebagai kolom teks terpisah di pm_records), baru tanda
       tangannya di-fetch.
   Gagal ambil gambar (network/file belum diupload admin/dst) TIDAK PERNAH
   menggagalkan PDF -- cuma warning di console, area itu dibiarkan kosong
   (nama tetap tercetak sebagai bukti proses sudah terjadi). callback selalu
   dipanggil, tidak pernah reject. */
function raResolveWorkflowSignatures(record, callback) {
  var result = { checkedByName: null, checkedSigDataUrl: null, reviewedByName: null, reviewSigDataUrl: null };
  var status = record && record.status;
  if (!record || (status !== 'CHECKED' && status !== 'FINAL_APPROVED')) { callback(result); return; }

  result.checkedByName = record.checked_by_name || null;
  var tasks = [];

  if (result.checkedByName) {
    tasks.push(new Promise(function(resolve) {
      raGetSignatureDataUrl(result.checkedByName, function(err, dataUrl) {
        if (err) console.warn('[raResolveWorkflowSignatures] TTD checker:', err);
        else result.checkedSigDataUrl = dataUrl;
        resolve();
      });
    }));
  }

  if (status === 'FINAL_APPROVED' && record.reviewed_by_account) {
    tasks.push(
      db.collection(RA_PROFILE_TABLE).doc(record.reviewed_by_account).get().then(function(s) {
        if (!s.exists) return;
        var p = s.data();
        result.reviewedByName = p.display_name || p.username;
        return new Promise(function(resolve) {
          raGetSignatureDataUrl(result.reviewedByName, function(err, dataUrl) {
            if (err) console.warn('[raResolveWorkflowSignatures] TTD reviewer:', err);
            else result.reviewSigDataUrl = dataUrl;
            resolve();
          });
        });
      }).catch(function(err) { console.warn('[raResolveWorkflowSignatures] reviewer lookup:', err); })
    );
  }

  if (!tasks.length) { callback(result); return; }
  Promise.all(tasks).then(function(){ callback(result); }).catch(function(){ callback(result); });
}

/* ── KIRIM PDF FINAL KE REVIEW APPROVAL DASHBOARD (ELECTRIC 7 POMI,
   Firebase terpisah) ──
   Review & approval untuk laporan PM Unit 7 SEPENUHNYA dilakukan di
   Review_Approval_Dashboard.html (koleksi Firestore `checksheets` +
   `approvals`, lihat firebase-config.js/db-helper.js/storage-helper.js/
   approval-helper.js) -- kita TIDAK punya UI review/approve/tanda tangan
   sendiri lagi. Fungsi ini cuma "menitipkan" PDF hasil export checksheet
   ke sana, PERSIS seperti hasil klik Export PDF di modul ybs, TANPA
   diedit/ditambah apa pun.
   Dipanggil dari raSubmitReport() setelah status Supabase berhasil di-set
   SUBMITTED. Modul WAJIB set window._raBuildPdf = <fungsi export PDF modul
   ybs> (dipanggil TANPA argumen) SEKALI di scriptnya sendiri -- fungsi itu
   pada akhirnya memanggil showPdfPreview(doc, filename) seperti biasa;
   showPdfPreview() tiap modul sudah ditambah pengecekan
   window._raPdfCapture di baris pertamanya, yang men-"tangkap" doc itu
   alih-alih menampilkan modal preview, KHUSUS untuk pemanggilan ini.
   Kalau modul belum punya window._raBuildPdf, atau Firebase SDK/DB/
   Approvals belum termuat (file firebase-config.js dkk hilang), fungsi ini
   diam-diam skip -- gagal kirim ke dashboard eksternal TIDAK BOLEH
   menggagalkan submit laporan itu sendiri (status Supabase sudah kepakai
   duluan).
   onDone(ok, err) OPSIONAL -- dipanggil persis SEKALI di setiap jalur
   keluar (termasuk dua guard skip di atas), SETELAH proses kirim (yang
   async: build PDF -> upload -> Firestore) benar-benar selesai/gagal --
   BUKAN begitu fungsi ini dipanggil. Ini penting supaya caller (raSubmitReportCore,
   dan raRetryPendingFirebaseSyncs lewat iframe tersembunyi) tahu KAPAN
   aman menganggap pekerjaan ini selesai/menutup iframe-nya -- sebelumnya
   caller melapor "selesai" seketika tanpa menunggu bagian ini, jadi kalau
   dipanggil dari iframe tersembunyi (submit dari Riwayat / retry otomatis),
   iframe-nya keburu dibuang SEBELUM PDF sempat ke-build & ke-upload,
   sehingga laporan tercatat SUBMITTED di Supabase tapi TIDAK PERNAH sampai
   ke Review Approval Dashboard. */
var RA_ASSET_LABEL = {
  FEGT: 'FEGT 6 Monthly', SO2: 'SO2 Scrubber Inlet', O2: 'O2 Report',
  OPACITY: 'Opacity Monitor', CEMS_CALIBRATION: 'CEMS Calibration',
  BELT_E45: 'Belt Conveyor E4-E5', BELT_E23: 'Belt Conveyor E2-E3', BELT_B12: 'Belt Conveyor B1-B2',
  MAINTENANCE_REPORT: 'Maintenance Report', COAL_SILO_LEVEL: 'Coal Silo Level Transmitter',
  COAL_FEEDER: 'Coal Feeder Calibration', DCS_HMI: 'DCS HMI/OIS Inspection',
  FLOWMETER_FGD: 'Flow Meter FGD', 'PH-ANALYZER': 'Analyzer Indicator Transmitter (pH)',
  PM_HG_ANALYZER: 'PM HG Analyzer', GENERATOR_STATOR_LEAK: 'Generator Stator Leak Monitoring',
  MARK_VIE: 'Mark VIe Alarm & Module Inspection'
};

/* ── PEMETAAN MODUL -> AREA (routing eksplisit ke reviewer) ──
   Versi lama: Review_Approval_Dashboard.html cuma bisa routing lewat
   name-match `submittedBy` ke akun dashboard_users terdaftar, jadi kita
   kirim identitas "Teknisi" SINTETIS per area (bukan nama asli) supaya
   routing pasti benar -- lihat riwayat git kalau perlu detail pendekatan
   lama ini.
   SEKARANG: approval-helper.js (EenPutra) sudah menerima parameter
   team/area/src eksplisit di Approvals.submitWithFiles(), dicek
   scopeOfApproval() SEBELUM jatuh ke name-match -- jadi routing tidak lagi
   perlu bergantung sama isi submittedBy sama sekali. submittedBy sekarang
   bisa balik jadi NAMA ASLI (PIC/Checked By yang diketik user), tidak perlu
   akun sintetis atau auto-provisioning apa pun lagi.
   Modul yang TIDAK ada di peta ini (mis. Maintenance Report -- form
   generik, tidak terikat 1 area tetap) kirim team/area sebagai undefined,
   Firestore-nya jadi tidak punya key itu sama sekali, dan
   Review_Approval_Dashboard.html fallback ke name-match seperti biasa.
   Kunci area di bawah ('boiler'/'turbine'/'common'/'wwtp') SENGAJA
   disamakan persis dengan value <option> filter Area di index.html --
   supaya cuma ada SATU kosakata area di seluruh repo, tidak nyimpang kalau
   salah satu diubah nanti. */
var RA_MODUL_AREA = {
  FEGT: 'boiler', SO2: 'boiler', O2: 'boiler', OPACITY: 'boiler', CEMS_CALIBRATION: 'boiler',
  COAL_SILO_LEVEL: 'boiler', COAL_FEEDER: 'boiler', FLOWMETER_FGD: 'boiler', PM_HG_ANALYZER: 'boiler',
  BELT_E45: 'common', BELT_E23: 'common', BELT_B12: 'common', DCS_HMI: 'common',
  'PH-ANALYZER': 'wwtp', CONDUCTIVITY: 'wwtp',
  GENERATOR_STATOR_LEAK: 'turbine', MARK_VIE: 'turbine'
};
// Nilai AREA PERSIS seperti pilihan checkbox Register di
// Review_Approval_Dashboard.html (TEAM_AREAS.C7 di file itu) -- kalau
// mereka ganti label/ejaan area C7, samakan lagi di sini. Dikirim sebagai
// parameter `area` eksplisit ke Approvals.submitWithFiles().
var RA_AREA_LABEL_C7 = {
  boiler: 'Boiler',
  turbine: 'Turbine',
  common: 'Common (CHCB)',
  wwtp: 'Common (WWTP-Ashdisposal)'
};

function raSendFinalPdfToFirebaseDashboard(record, submittedByName, onDone) {
  function finish(ok, err) {
    if (ok) {
      // Tandai "sudah nyampe" -- dicek oleh raRetryPendingFirebaseSyncs()
      // supaya record ini tidak dicoba kirim ulang lagi di kunjungan
      // berikutnya. Fire-and-forget -- gagal nulis field ini TIDAK dianggap
      // gagal kirim (PDF-nya sendiri sudah beneran sampai di dashboard),
      // paling buruk cuma dicoba kirim ulang (duplikat) lain kali.
      db.collection(PM_COLLECTION).doc(record.id).set({
        firebase_synced_at: new Date().toISOString(), firebase_sync_error: null
      }, { merge: true }).catch(function(){});
    } else if (record && record.id) {
      db.collection(PM_COLLECTION).doc(record.id).set({
        firebase_sync_error: String((err && err.message) || err || 'gagal tidak diketahui').slice(0, 500)
      }, { merge: true }).catch(function(){});
    }
    if (onDone) onDone(ok, err);
  }
  if (typeof window._raBuildPdf !== 'function') {
    console.warn('[raSendFinalPdfToFirebaseDashboard] window._raBuildPdf belum di-set modul ini, skip kirim ke Review Approval Dashboard.');
    finish(false, 'window._raBuildPdf belum di-set modul ini.');
    return;
  }
  if (typeof firebase === 'undefined' || typeof DB === 'undefined' || typeof Approvals === 'undefined') {
    console.warn('[raSendFinalPdfToFirebaseDashboard] firebase-config.js/db-helper.js/approval-helper.js belum dimuat, skip kirim ke Review Approval Dashboard.');
    finish(false, 'firebase-config.js/db-helper.js/approval-helper.js belum dimuat.');
    return;
  }
  var modKey = normalizeModul(record.modul) || record.modul || 'UNKNOWN';
  // Prioritaskan nama SPESIFIK yang benar-benar disimpan modul ybs
  // (record.modul) -- SEBAGIAN BESAR modul sudah menyimpan nama tampilan
  // yang bagus di sana (mis. 'FEGT & Leak Detection' vs 'FEGT 6 Monthly' --
  // dua form BEDA yang keduanya di-normalizeModul() jadi satu bucket 'FEGT'
  // untuk keperluan ROUTING/buka-file-mana, jadi TIDAK BOLEH dipakai lagi
  // sebagai label tampilan, nanti dua form beda kekirim dengan nama yang
  // sama). RA_ASSET_LABEL[record.modul] cuma buat modul yang nyimpan KODE
  // singkat mentah sebagai modul (mis. 'O2', 'GENERATOR_STATOR_LEAK').
  var label = RA_ASSET_LABEL[record.modul] || record.modul || RA_ASSET_LABEL[modKey] || modKey;
  // Nama PIC/Checked By ASLI -- lihat catatan RA_MODUL_AREA di atas,
  // routing reviewer sekarang lewat parameter team/area eksplisit di
  // Approvals.submitWithFiles(), bukan lagi lewat name-match submittedBy,
  // jadi tidak perlu diganti identitas sintetis lagi.
  var effectiveSubmittedBy = submittedByName || record.pic || '';
  var areaKey = RA_MODUL_AREA[modKey];
  // Ditemukan laporan yang macet TANPA PERNAH melapor sukses ATAU gagal
  // (firebase_synced_at dan firebase_sync_error dua-duanya kosong selamanya)
  // -- root cause paling mungkin: fetch() ke Apps Script Drive proxy milik
  // Review Approval Dashboard (storage-helper.js, server PIHAK LAIN, di
  // luar kendali kita) macet/hang tanpa pernah resolve ATAU reject. Tanpa
  // batas waktu di sisi kita, promise chain di bawah nunggu selamanya --
  // satu-satunya yang menghentikannya adalah timeout 120 detik di
  // _raProcessSyncQueue yang CUMA membuang iframe-nya (tidak sempat catat
  // error apa pun ke firebase_sync_error), jadi kita tidak pernah tahu
  // penyebab pastinya. raWithTimeout membungkus proses ini dengan batas
  // waktu tegas supaya SELALU ada firebase_sync_error yang tercatat kalau
  // macet lagi, bukan diam selamanya.
  function raWithTimeout(promise, ms, stepLabel) {
    return Promise.race([
      promise,
      new Promise(function(_, reject) {
        setTimeout(function(){ reject(new Error(stepLabel + ' tidak merespons dalam ' + Math.round(ms/1000) + ' detik.')); }, ms);
      })
    ]);
  }
  window._raPdfCapture = function(doc) {
    raWithTimeout(DB.save({
      assetTag: modKey,
      assetName: label,
      woNumber: record.work_order || '',
      executionDate: record.tanggal || '',
      checkedBy: record.pic || ''
    }), 30000, 'Menyimpan checksheet ke Firestore').then(function(checksheetId) {
      return raWithTimeout(Approvals.submitWithFiles(checksheetId, {
        photos: null,
        pdfBuilder: function() { return Promise.resolve(doc); },
        assetTag: modKey,
        assetName: label,
        checksheetFile: location.pathname.split('/').pop(),
        submittedBy: effectiveSubmittedBy,
        // Routing eksplisit (lihat catatan RA_MODUL_AREA) -- undefined
        // untuk modul yang belum dipetakan, supaya Firestore-nya tidak
        // punya key ini sama sekali dan scopeOfApproval() fallback ke
        // name-match seperti biasa.
        team: areaKey ? 'C7' : undefined,
        area: areaKey ? RA_AREA_LABEL_C7[areaKey] : undefined,
        src: 'PM Unit 7'
      // 3 menit (bukan cuma 45 detik) -- PDF checksheet dengan banyak foto
      // (mis. Coal Feeder + 4000 Hours Mill) hasil PDF-nya besar, upload
      // base64-nya ke Apps Script Drive proxy bisa genuinely butuh lebih
      // dari 1 menit. Timeout terlalu pendek justru bikin upload yang
      // sebenarnya BAKAL SUKSES (cuma lambat) malah dianggap gagal duluan.
      }), 180000, 'Upload PDF ke Google Drive (Review Approval Dashboard)');
    }).then(function(ok) {
      if (ok) { dbShowToast('✓ PDF terkirim ke Review Approval Dashboard'); finish(true, null); }
      else { console.warn('[raSendFinalPdfToFirebaseDashboard] Approvals.submitWithFiles gagal, lihat console.'); finish(false, 'Approvals.submitWithFiles mengembalikan gagal.'); }
    }).catch(function(err) {
      console.error('[raSendFinalPdfToFirebaseDashboard] gagal kirim:', err);
      finish(false, err);
    });
  };
  window._raBuildPdf();
}

/* ── SUBMIT LAPORAN (Level 1) — GENERIK, dipakai semua modul ──
   Dulu didefinisikan per-file (maintenance_report_form.html), sekarang
   dipindah ke sini karena isinya sudah 100% generik: cuma butuh
   window._editingId (sudah standar di semua modul) + shared functions.
   raSetCurrentRecord (kalau ada, dipanggil abis submit sukses) OPSIONAL --
   cuma dipanggil kalau modul yang manggil punya panel workflow lokal (mis.
   maintenance_report_form.html); modul lain (mis. fegt.html, yang cuma
   punya tombol Submit tanpa panel checker/reviewer lokal -- itu sekarang
   di submit-report.html) aman-aman saja tanpa fungsi itu. */
/* Inti proses submit (update status + kirim PDF ke Firebase), TANPA
   confirm() -- dipakai bareng oleh raSubmitReport() (tombol manual, ada
   confirm dulu) dan raSubmitReportAuto() (dipanggil headless dari iframe
   tersembunyi via history.html, TIDAK BOLEH nge-confirm karena usernya
   sudah konfirmasi di halaman histori sebelum iframe ini dibuka).
   onDone(ok, err) opsional -- dipanggil PERSIS SEKALI, SETELAH status
   Supabase ter-update DAN pengiriman PDF ke Firebase benar-benar
   selesai/gagal (bukan begitu dikirim) -- dipakai raSubmitReportAuto buat
   lapor balik ke parent lewat postMessage HANYA kalau pekerjaannya sudah
   betul-betul tuntas, supaya history.html/raRetryPendingFirebaseSyncs
   tidak membuang iframe-nya lebih awal (lihat catatan panjang di
   raSendFinalPdfToFirebaseDashboard di atas -- ini bug lama yang
   diperbaiki). */
function raSubmitReportCore(onDone) {
  raUpdateRecord(window._editingId, {
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    firebase_synced_at: null
  }, function(err, updated) {
    if (err) {
      if (onDone) onDone(false, err); else alert('Gagal submit: ' + err);
      return;
    }
    dbShowToast('✓ Tersubmit, mengirim PDF ke Review Approval Dashboard...');
    if (typeof raSetCurrentRecord === 'function') raSetCurrentRecord(updated);
    raSendFinalPdfToFirebaseDashboard(updated || { modul: window.CURRENT_MODUL, id: window._editingId }, (updated && updated.pic) || '', onDone);
  });
}
function raSubmitReport() {
  if (!window._editingId) {
    alert('Simpan dulu sebagai Draft sebelum submit.');
    return;
  }
  if (!confirm('Apakah data sudah lengkap? Yakin Submit?')) return;
  raSubmitReportCore(function(ok, err) {
    if (!ok) dbShowToast('⚠️ Tersubmit, tapi belum terkirim ke Review Approval Dashboard (' + ((err && err.message) || err) + ') — akan dicoba otomatis lagi nanti.');
  });
}

/* Submit HEADLESS dari history.html -- halaman modul ini dimuat di dalam
   iframe tersembunyi (lihat historySubmit() di history.html) dengan
   ?id=xxx&autosubmit=1, ATAU dipanggil ulang otomatis oleh
   raRetryPendingFirebaseSyncs() (lihat di bawah) untuk record yang SUDAH
   SUBMITTED di Supabase tapi belum sukses terkirim ke Firebase di
   percobaan sebelumnya (mis. tab/iframe keburu tertutup, jaringan putus,
   ATAU browser mobile membatasi aktivitas jaringan di iframe/tab yang
   tidak sedang terlihat -- alasan inilah kenapa history.html sekarang
   membuka TAB BIASA yang terlihat lewat window.open() untuk tombol
   Resubmit manual, bukan lagi iframe tersembunyi; retry otomatis di
   halaman manapun tetap pakai iframe tersembunyi sebagai best-effort,
   karena browser MEMBLOKIR window.open() yang tidak dipicu klik user).
   Modul WAJIB panggil ini SETELAH window._raBuildPdf di-set & data record
   selesai dimuat ke form (lihat contoh pemasangan di "LOAD FROM HISTORY"
   tiap modul). Tidak pernah nge-confirm() -- konfirmasi sudah terjadi satu
   kali di history.html sebelum halaman ini dibuka. Lapor balik ke
   window.opener (kalau dibuka lewat window.open(), tab biasa) ATAU
   window.parent (kalau dibuka lewat iframe, retry otomatis) lewat
   postMessage, sukses maupun gagal, HANYA setelah proses benar-benar
   tuntas -- lalu tutup diri sendiri kalau dibuka sebagai tab biasa
   (?autoclose=1), supaya user tidak perlu menutup manual. */
function raSubmitReportAuto() {
  // report() cuma tipis membungkus window._raAutosubmitReport (dipasang
  // SEDINI MUNGKIN di awal shared.js, lihat "JARING PENGAMAN TOTAL" di
  // atas) -- itu satu-satunya jalur lapor balik sekarang, sudah otomatis
  // dedupe (cuma laporan PERTAMA yang benar-benar terkirim, entah dari
  // sini, dari error JS tak tertangkap, promise gagal, atau watchdog) dan
  // sudah menangani window.opener/window.parent + autoclose. Fallback
  // inline HANYA buat jaga-jaga kalau fungsi itu somehow belum sempat
  // terpasang (mis. dipanggil sebelum shared.js selesai load -- seharusnya
  // tidak pernah terjadi karena shared.js dimuat duluan, tapi lebih aman
  // ada fallback daripada diam total).
  function report(ok, err) {
    if (typeof window._raAutosubmitReport === 'function') { window._raAutosubmitReport(ok, err); return; }
    try {
      var target = (window.opener) ? window.opener : ((window.parent && window.parent !== window) ? window.parent : null);
      if (target) {
        target.postMessage({ type: 'raAutosubmitDone', id: window._editingId, ok: ok, error: err ? String(err.message || err) : null }, '*');
      }
    } catch (e) {}
  }
  if (!window._editingId) { report(false, 'Tidak ada draft tersimpan untuk laporan ini.'); return; }
  // Cek status TERKINI dulu -- kalau record ini SUDAH SUBMITTED (berarti
  // dipanggil ulang buat retry, bukan submit pertama kali), cukup kirim
  // ulang PDF-nya saja, tidak perlu ubah status lagi.
  pmDbGet(window._editingId)
    .then(function(rows) {
      var rec = rows && rows[0];
      if (rec && String(rec.status || '').toUpperCase() === 'SUBMITTED') {
        raSendFinalPdfToFirebaseDashboard(rec, rec.pic || '', report);
        return;
      }
      raSubmitReportCore(report);
    })
    .catch(function() { raSubmitReportCore(report); }); // gagal cek status -- anggap belum submit, coba jalur normal
}

/* ── RETRY OTOMATIS: laporan SUBMITTED yang belum sukses terkirim ke
   Review Approval Dashboard ──
   Kalau tab/iframe kebetulan tertutup (atau jaringan putus) di tengah
   proses kirim PDF setelah status Supabase sudah SUBMITTED, laporan itu
   "nyangkut": sudah tercatat submit di Supabase tapi belum pernah sampai
   ke dashboard. Fungsi ini dipanggil otomatis (lihat pemanggilan di akhir
   file ini) SETIAP kali halaman mana pun di situs ini dibuka -- selama ada
   koneksi, laporan yang nyangkut akan otomatis dicoba kirim ulang lewat
   iframe tersembunyi yang membuka ulang halaman modulnya sendiri (persis
   mekanisme "Submit dari Riwayat"), TANPA perlu user submit ulang manual.
   Diproses SATU PER SATU (bukan sekaligus) supaya tidak membuka banyak
   iframe/permintaan network bersamaan. Timeout per-record cuma jaring
   pengaman (1 record macet tidak boleh menyandera antrian selamanya) --
   BUKAN alasan untuk berhenti mencoba: selama firebase_synced_at masih
   null, record itu akan dicoba lagi di kunjungan berikutnya. */
var _raSyncQueueRunning = false;
function raRetryPendingFirebaseSyncs() {
  if (_raSyncQueueRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  // Halaman ini sendiri sedang jadi "worker" submit/retry (dibuka lewat
  // iframe tersembunyi) -- jangan ikut nge-scan/buka iframe baru lagi di
  // dalam sini (cegah rekursi tak terkendali).
  if (/[?&]autosubmit=1(&|$)/.test(location.search)) return;
  _raSyncQueueRunning = true;
  // where(status) + where(firebase_synced_at == null): butuh composite index
  // (status ASC, firebase_synced_at ASC) -- sudah ada di firestore.indexes.json.
  // Urut submitted_at di client (limit 10, murah). `== null` cuma cocok untuk
  // doc yang field-nya EKSPLISIT null -- makanya insert/submit selalu set
  // firebase_synced_at: null.
  db.collection(PM_COLLECTION)
    .where('status', '==', 'SUBMITTED')
    .where('firebase_synced_at', '==', null)
    .limit(10).get()
    .then(function(q) {
      var rows = q.docs.map(function(d) { var x = d.data() || {}; return { id: d.id, modul: x.modul, submitted_at: x.submitted_at }; });
      rows.sort(function(a, b) { return String(a.submitted_at || '').localeCompare(String(b.submitted_at || '')); });
      _raProcessSyncQueue(rows, 0);
    })
    .catch(function() { _raSyncQueueRunning = false; });
}
function _raProcessSyncQueue(rows, idx) {
  if (idx >= rows.length) { _raSyncQueueRunning = false; return; }
  var row = rows[idx];
  var url = typeof raModulToUrl === 'function' ? raModulToUrl(row.modul, row.id) : null;
  if (!url || url === 'index.html') { _raProcessSyncQueue(rows, idx + 1); return; } // modul tidak dikenali, lewati baris ini
  var iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  var done = false;
  var timeoutId;
  function onMsg(e) {
    if (!e.data || e.data.type !== 'raAutosubmitDone' || String(e.data.id) !== String(row.id)) return;
    finish();
  }
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timeoutId);
    window.removeEventListener('message', onMsg);
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    _raProcessSyncQueue(rows, idx + 1);
  }
  window.addEventListener('message', onMsg);
  // 4.5 menit -- HARUS lebih besar dari total timeout internal di
  // raSendFinalPdfToFirebaseDashboard (30 detik simpan + 3 menit upload PDF
  // = 3.5 menit) supaya laporan besar/banyak foto sempat dapat kesempatan
  // melapor gagal dengan pesan error yang jelas SEBELUM iframe-nya dibuang
  // paksa di sini. Ini jaring pengaman, BUKAN batas nyerah (lihat catatan
  // di atas fungsi ini) -- record yang timeout di sini dicoba lagi di
  // kunjungan berikutnya.
  timeoutId = setTimeout(finish, 270000);
  iframe.src = url + '&autosubmit=1';
  document.body.appendChild(iframe);
}
setTimeout(raRetryPendingFirebaseSyncs, 3000);

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNATURE PAD SYSTEM
   - raSignPadShow(options)  : tampilkan modal pad TTD
   - raSignPadSave()         : simpan TTD ke Supabase Storage bucket 'signatures'
   - raSignPadCancel()       : tutup modal tanpa simpan
   - raGetSignatureDataUrl(displayName, callback) : ambil TTD sebagai dataUrl
     (fallback-safe: coba Storage signed URL dulu, kalau gagal cek tabel
      pm_profiles kolom signature_dataurl)
   ═══════════════════════════════════════════════════════════════════════════ */

var _raSignPadState = {
  canvas: null, ctx: null, drawing: false, empty: true,
  onSaved: null, displayName: null, role: null
};

/* Buka modal signature pad.
   opts = { displayName, role, onSaved(dataUrl) }
   displayName = nama tampilan (untuk label + filename di Storage)
   onSaved     = callback setelah TTD berhasil tersimpan */
function raSignPadShow(opts) {
  opts = opts || {};
  _raSignPadState.displayName = opts.displayName || '';
  _raSignPadState.role        = opts.role || '';
  _raSignPadState.onSaved     = opts.onSaved || null;
  _raSignPadState.empty       = true;

  var old = document.getElementById('raSignPadModal');
  if (old && old.parentNode) old.parentNode.removeChild(old);

  var wrap = document.createElement('div');
  wrap.id = 'raSignPadModal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(10,18,15,0.78);z-index:2100000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif';
  wrap.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:min(96vw,480px);overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.45)">' +
      '<div style="background:linear-gradient(90deg,#1a6b3a,#16a085);padding:14px 18px;display:flex;justify-content:space-between;align-items:center">' +
        '<div>' +
          '<div style="font-weight:800;font-size:14px;color:#fff">✍️ Tanda Tangan Digital</div>' +
          '<div style="font-size:11px;color:#a7f3d0;margin-top:2px">' + _raSignPadState.displayName + (_raSignPadState.role ? ' · ' + _raSignPadState.role : '') + '</div>' +
        '</div>' +
        '<button onclick="raSignPadCancel()" style="background:rgba(255,255,255,0.15);border:none;border-radius:6px;color:#fff;font-size:18px;width:30px;height:30px;cursor:pointer;line-height:30px;text-align:center;padding:0">✕</button>' +
      '</div>' +
      '<div style="padding:14px 16px 6px">' +
        '<div style="font-size:11px;color:#6b7280;margin-bottom:6px">Gambar tanda tangan Anda di kotak di bawah ini:</div>' +
        '<div style="position:relative;border:2px solid #d1d5db;border-radius:8px;background:#fafafa;overflow:hidden">' +
          '<canvas id="raSignPadCanvas" style="display:block;width:100%;cursor:crosshair;touch-action:none" height="160"></canvas>' +
          '<div id="raSignPadHint" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:13px;color:#d1d5db;font-style:italic">Tanda tangan di sini</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px">' +
          '<button onclick="raSignPadClear()" style="flex:1;padding:9px;border:1px solid #e5e7eb;border-radius:7px;background:#f9fafb;color:#374151;font-size:12px;font-weight:600;cursor:pointer">🗑 Hapus</button>' +
          '<button onclick="raSignPadSave()" style="flex:2;padding:9px;border:none;border-radius:7px;background:#16a085;color:#fff;font-size:13px;font-weight:700;cursor:pointer">💾 Simpan Tanda Tangan</button>' +
        '</div>' +
        '<div id="raSignPadMsg" style="font-size:11px;color:#6b7280;text-align:center;margin-top:6px;min-height:16px"></div>' +
      '</div>' +
      '<div style="padding:6px 16px 14px">' +
        '<div style="font-size:10px;color:#9ca3af;text-align:center">TTD tersimpan ke server dan akan otomatis muncul di laporan yang di-approve.</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  // Init canvas
  var canvas = document.getElementById('raSignPadCanvas');
  _raSignPadState.canvas = canvas;
  // Set pixel width setelah DOM ready
  setTimeout(function() {
    canvas.width = canvas.offsetWidth;
    _raSignPadState.ctx = canvas.getContext('2d');
    _raSignPadState.ctx.strokeStyle = '#111';
    _raSignPadState.ctx.lineWidth = 2.5;
    _raSignPadState.ctx.lineCap = 'round';
    _raSignPadState.ctx.lineJoin = 'round';
    _raSignPadInitDraw();
  }, 30);
}

function _raSignPadInitDraw() {
  var canvas = _raSignPadState.canvas;
  if (!canvas) return;
  var state = _raSignPadState;

  function getPos(e) {
    var r = canvas.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) };
  }

  function onStart(e) {
    e.preventDefault();
    state.drawing = true;
    state.empty = false;
    var hint = document.getElementById('raSignPadHint');
    if (hint) hint.style.display = 'none';
    var p = getPos(e);
    state.ctx.beginPath();
    state.ctx.moveTo(p.x, p.y);
  }
  function onMove(e) {
    if (!state.drawing) return;
    e.preventDefault();
    var p = getPos(e);
    state.ctx.lineTo(p.x, p.y);
    state.ctx.stroke();
  }
  function onEnd(e) { state.drawing = false; }

  canvas.addEventListener('mousedown',  onStart, {passive:false});
  canvas.addEventListener('mousemove',  onMove,  {passive:false});
  canvas.addEventListener('mouseup',    onEnd);
  canvas.addEventListener('mouseleave', onEnd);
  canvas.addEventListener('touchstart', onStart, {passive:false});
  canvas.addEventListener('touchmove',  onMove,  {passive:false});
  canvas.addEventListener('touchend',   onEnd);
}

function raSignPadClear() {
  var state = _raSignPadState;
  if (!state.canvas || !state.ctx) return;
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  state.empty = true;
  var hint = document.getElementById('raSignPadHint');
  if (hint) hint.style.display = 'flex';
}

function raSignPadCancel() {
  var el = document.getElementById('raSignPadModal');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

/* Simpan TTD ke Firestore collection pm_signatures sebagai PNG data-URL
   base64 (doc id = slug nama tampilan). Tidak ada Storage bucket lagi. */
function raSignPadSave() {
  var state = _raSignPadState;
  if (!state.canvas || state.empty) {
    var msg = document.getElementById('raSignPadMsg');
    if (msg) { msg.textContent = '⚠️ Tanda tangan belum digambar.'; msg.style.color='#e74c3c'; }
    return;
  }
  var msg = document.getElementById('raSignPadMsg');
  if (msg) { msg.textContent = '⏳ Menyimpan...'; msg.style.color='#6b7280'; }

  var dataUrl = state.canvas.toDataURL('image/png');
  var slug = _raSigSlug(state.displayName);

  db.collection(RA_SIGNATURE_COLLECTION).doc(slug).set({
    display_name: state.displayName || '',
    dataurl: dataUrl,
    updated_at: new Date().toISOString()
  }, { merge: true }).then(function() {
    if (msg) { msg.textContent = '✓ Tanda tangan berhasil disimpan!'; msg.style.color='#16a085'; }
    if (typeof state.onSaved === 'function') state.onSaved(dataUrl);
    setTimeout(function() { raSignPadCancel(); }, 1200);
  }).catch(function(err) {
    if (msg) { msg.textContent = '❌ ' + ((err && err.message) || String(err)); msg.style.color='#e74c3c'; }
  });
}

/* Helper: tampilkan TTD di elemen <img> atau <canvas> berdasarkan nama.
   Jika belum ada TTD dan showPadIfMissing=true (default), buka pad untuk menggambar. */
function raRenderSignatureToElement(displayName, role, elementId, showPadIfMissing) {
  if (showPadIfMissing === undefined) showPadIfMissing = false;
  raGetSignatureDataUrl(displayName, function(err, dataUrl) {
    if (!err && dataUrl) {
      var el = document.getElementById(elementId);
      if (!el) return;
      if (el.tagName === 'IMG') { el.src = dataUrl; el.style.display = 'block'; }
      else if (el.tagName === 'CANVAS') {
        var img = new Image();
        img.onload = function() {
          el.width = img.naturalWidth; el.height = img.naturalHeight;
          el.getContext('2d').drawImage(img, 0, 0);
        };
        img.src = dataUrl;
      } else { el.style.backgroundImage = 'url(' + dataUrl + ')'; el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; }
    } else if (showPadIfMissing) {
      raSignPadShow({ displayName: displayName, role: role, onSaved: function(dUrl) {
        raRenderSignatureToElement(displayName, role, elementId, false);
      }});
    }
  });
}
/* ── GERBANG SITUS (raInitSiteGate) — MENGGANTIKAN pmInitGate lama ──
   Dipanggil sekali di akhir file ini. Elemen gate (#pmAuthGate, dst) sudah
   pasti ada di DOM di titik ini (ditulis via document.write sinkron di
   paling atas file, dalam satu eksekusi <script> yang sama).

   Alur:
     1. Cek session Supabase Auth yang sedang aktif (raGetCurrentProfile --
        otomatis persist di localStorage, jadi kalau sudah pernah login di
        halaman lain, di sini langsung "lolos" tanpa perlu login ulang).
     2. Kalau belum ada session -> gerbang tetap tampil, tunggu submit
        username+password (raLogin).
     3. Begitu berhasil (baik dari session lama atau login baru) -> buka
        gerbang, render widget kecil "login sebagai ... · Logout" di
        pojok halaman, dan tetap track presence (dipakai device-admin.html
        untuk lihat siapa yang online sekarang -- reuse mekanisme lama,
        cuma nama yang ditampilkan sekarang username akun, bukan nama
        device manual). ── */
function raInitSiteGate() {
  raGetCurrentProfile(function(profile) {
    if (profile) {
      pmUnlockGate();
      raRenderSessionWidget(profile);
      pmTrackPresence(pmGetDeviceId(), profile.display_name || profile.username);
      return;
    }

    var userInput = document.getElementById('pmGateUser');
    var pwInput = document.getElementById('pmGatePw');
    var submitBtn = document.getElementById('pmGateSubmit');

    function setSubmitBusy(busy) {
      if (!submitBtn) return;
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? 'Memeriksa...' : 'Masuk';
    }

    function submit() {
      var u = ((userInput && userInput.value) || '').trim();
      var p = (pwInput && pwInput.value) || '';
      if (!u || !p) { pmShowGateError('Username & password wajib diisi.'); return; }
      pmShowGateError('');
      setSubmitBusy(true);
      raLogin(u, p, function(err, loggedInProfile) {
        setSubmitBusy(false);
        if (err) {
          pmShowGateError(err);
          if (pwInput) { pwInput.value = ''; pwInput.focus(); }
          return;
        }
        pmUnlockGate();
        raRenderSessionWidget(loggedInProfile);
        pmTrackPresence(pmGetDeviceId(), loggedInProfile.display_name || loggedInProfile.username);
      });
    }

    if (submitBtn) submitBtn.addEventListener('click', submit);
    if (pwInput) pwInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit(); });
    if (userInput) userInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit(); });
    if (userInput) userInput.focus();
  });
}

/* Widget kecil mengambang (pojok kanan bawah, tidak ganggu layout halaman
   manapun) nampilin siapa yang lagi login + tombol Logout -- muncul di
   SEMUA halaman yang load shared.js, begitu gerbang terbuka. */
function raRenderSessionWidget(profile) {
  var old = document.getElementById('raSessionWidget');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var el = document.createElement('div');
  el.id = 'raSessionWidget';
  el.className = 'no-print';
  el.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:999998;background:rgba(15,25,20,0.92);color:#e6f2ec;font-size:11px;padding:6px 8px 6px 12px;border-radius:20px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,0.3)';
  var who = profile.display_name || profile.username;
  el.innerHTML =
    '<span style="opacity:0.92;white-space:nowrap">&#128100; ' + who + ' <span style="opacity:0.6">(' + profile.role + ')</span></span>' +
    '<button id="raSessionLogoutBtn" type="button" style="background:#ef4444;color:#fff;border:none;border-radius:12px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap">Logout</button>';
  document.body.appendChild(el);
  document.getElementById('raSessionLogoutBtn').onclick = function() {
    if (!confirm('Logout dari akun ini? Anda perlu login lagi untuk membuka halaman manapun.')) return;
    raLogout(function() { location.reload(); });
  };
}

// raInitSiteGate() (gerbang login akun) SENGAJA TIDAK dipanggil lagi --
// gerbang situs dikembalikan ke pmInitGate() (Trusted Device) di atas.
// Fungsi ini & fungsi raXxx pendukungnya TETAP dipakai oleh raRequireLogin
// (modal login khusus di alur Submit Laporan checker/SPV, terpisah dari
// gerbang situs), jadi sengaja tidak dihapus.
