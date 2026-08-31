# Instrument — Supabase → Firebase migration

The Instrument department used to run on Supabase (`ruvvximnnacpvvoogbzs.supabase.co`).
It now runs entirely on the same Firebase project as Electric — **`eic8-3d7f1`**
(see `firebase-config.js`). No Supabase, no other Firebase project.

Trust model matches Electric: Firestore rules are fully open, all gating is
app-layer only. The one exception is the report review/approval workflow, which
uses **Firebase Authentication** (email/password).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | `shared.js` core (`pm_records` CRUD, access gate, report workflow, signatures) + `history.html` | **done** |
| 2 | `outage-*.html`, `material-warehouse.html`, `checksheet-temperature.html`, `checksheet-level-switch.html`, `device-admin.html` | **done** |
| 3 | `trend/` system (`js/supabase-adapter.js` → `js/historical-adapter.js`, Firestore) | **done** |

### Phase 2 approach

`shared.js` gained **`pmRest(method, path, body)`** — a translator for the simple
PostgREST subset those standalone pages used (`GET` with `col=eq.`/`is.`/`in.`/
`order`/`limit`/`offset`, `POST`, `PATCH`/`DELETE` by `id=eq.` / `id=in.` / a
column filter). Each page just swapped its local `supaFetch`/`tsSupaFetch` for a
one-line delegate to `pmRest`.

- **`outage-index/history/input.html`, `checksheet-temperature/level-switch.html`**
  — pure `pmRest` swap. Collections: `outage_records`, `outage_assets`,
  `ts_checksheet`.
- **`device-admin.html`** — `pmRest` swap; "online" is now derived from
  `last_seen` freshness (< 5 min) instead of a Supabase Realtime presence
  channel, with a 60 s auto-refresh.
- **`material-warehouse.html`** — its search used PostgREST features with no
  Firestore equivalent (`or=`, `ilike`, `not.like`, `Content-Range` counts,
  large `offset`). Rewritten to **load each collection once into a client-side
  cache** (`_mwAssetsAll`, `_mwAmbilAll`) and do all search / Warehouse-vs-Internal
  split / pagination / counts in JS. Writes still go through `pmRest`, and bust
  the cache. Collections: `material_warehouse`, `material_jenis`,
  `material_pengambilan`.
- **`outage-checksheet.html`** — had no Supabase code; untouched.

New composite indexes in `firestore.indexes.json`: `outage_assets`
(`input_category` + `asset_tag`) and (`input_category` + `created_at`).

### Phase 3 approach (`trend/`)

`js/supabase-adapter.js` was replaced by **`js/historical-adapter.js`** — same
public object (still exposed as `window.SupabaseAdapter`, plus alias
`window.HistoricalAdapter`, so `historical-manager.js` and `js/adapters/*` are
untouched). It reads the `pm_records` collection straight from Firestore.

- `trend_so2.html` / `trend_fegt.html` / `trend_cems.html` now load the Firebase
  compat SDK + `../firebase-config.js` before the config scripts.
- `config/system-config.js`: the `SUPABASE` block became `HISTORICAL_SOURCE`
  (`{ PROJECT, COLLECTION, FETCH_LIMIT }`) — the Supabase URL and anon key are gone.
- `fetchByModulAndRange()` filters by a **prefix** query on `modul`
  (`modul >= key && modul < key + ''`) instead of PostgREST `ilike.*key*` —
  works because each form stores `modul` prefixed with its key (`SO2 Scrubber
  Inlet`, `FEGT & Leak Detection`, `CEMS Calibration`). Single-field range, no
  composite index needed. Time-range filtering stays client-side (unchanged).
- `data` is a JSON string in Firestore → parsed back to an object in `docToRec()`
  (same as `pmDocToRec` in `shared.js`), so `so2-adapter`/`cems-adapter` (which
  read `r.data.analyzer` / `r.data.zero`) work unchanged.
- `fegt-adapter`'s `selectColumns: 'paths:data->paths,leakPaths:data->leakPaths'`
  PostgREST projection is emulated client-side: the adapter parses that syntax,
  flattens `data.paths`/`data.leakPaths` onto `r.paths`/`r.leakPaths`, and drops
  the heavy `r.data`. Firestore still downloads the whole doc first (it can't
  project a sub-field of a string), but the prefix query keeps that to only FEGT
  records.

## Firestore data model (Phase 1)

| Collection | Doc id | Fields |
|---|---|---|
| `pm_records` | auto | `modul, tanggal, pic, work_order, unit, status, created_at, updated_at, submitted_at, payload_size, firebase_synced_at, firebase_sync_error` + workflow fields (`submitted_by, checked_by_account, checked_by_name, checked_signature_url, checked_at, reviewed_by_account, review_signature_url, final_approved_at, return_reason`) + **`data`: a JSON string** (the whole check-sheet payload, kept as a string to dodge Firestore map-key limits; parsed back on load) |
| `trusted_devices` | `pm_device_id` (`dev-…`) | `device_id, device_name, user_agent, first_seen, last_seen, trusted, access_revoked, current_page` |
| `gate_config` | `main` | `password_hash, updated_at` |
| `pm_profiles` | Firebase Auth UID | `username, role, display_name` |
| `pm_signatures` | slug of display name | `display_name, dataurl` (PNG data-URL) |

`data` sits inside the same `pm_records` doc, so a single submission must stay
under Firestore's 1 MiB/doc limit. In practice evidence photos are stripped to
Google-Drive URLs before save (`_pmStripBase64ForSave` / `_pmEnsureAllPhotosOnDrive`),
so the JSON is text-only and well under the limit — but a pathological sheet
with hundreds of long free-text fields could get close.

## One-time setup on `eic8-3d7f1`

1. **Enable Email/Password auth** — Firebase console → Authentication → Sign-in
   method → Email/Password → Enable. (No email link, just password.)

2. **Create the report-workflow accounts** — for every checker / reviewer / SPV:
   - Authentication → Add user → email `‹username›@pmunit7.local`, set a password.
   - Copy the new user's UID, then create Firestore doc
     `pm_profiles/‹UID›` = `{ username: "‹username›", role: "checker" | "reviewer" | "spv" | "admin", display_name: "Full Name" }`.

3. **Seed the access-gate password** — create Firestore doc `gate_config/main`
   = `{ password_hash: "‹hash›", updated_at: "‹ISO date›" }`. Compute `‹hash›`
   for your chosen gate password by pasting this in any browser console:
   ```js
   (p => { let h = 5381; for (let i = 0; i < p.length; i++) h = ((h * 33) ^ p.charCodeAt(i)) >>> 0; return h.toString(36); })('YOUR_GATE_PASSWORD')
   ```
   (This is `pmSimpleHash` from `shared.js` — a deliberate low-grade obfuscation,
   not real crypto, same as before.) After Phase 2, `device-admin.html` sets this
   for you.

4. **Signatures** — either let each approver draw theirs via the in-app signature
   pad (writes `pm_signatures/‹slug›` automatically), or seed
   `pm_signatures/‹slug-of-display-name›` = `{ display_name, dataurl: "data:image/png;base64,…" }`
   by hand.

5. **Deploy rules + indexes** (from `Electric/`, which holds this repo's firebase
   config): `firebase deploy --only firestore:rules,firestore:indexes`.
   `firestore.rules` already allowlists every Instrument collection incl.
   `pm_signatures`; `firestore.indexes.json` has the `pm_records`
   `status + firebase_synced_at` composite index used by the sync-retry queue.

## Notes / known trade-offs

- **Real-time gate revoke** now uses Firestore `onSnapshot` on the device's own
  `trusted_devices` doc (was a Supabase Realtime channel).
- **Presence** ("who's online" in device-admin) is now a `last_seen` heartbeat
  every 2 min while the tab is visible; device-admin should treat `last_seen`
  within ~5 min as online. The old instant-disconnect behaviour is gone.
- **Upload/download progress bars** in `dbSave`/`dbLoad` are now the simulated
  asymptotic animation only — Firestore has no transfer-progress events.
- `dbList()` / `history.html` fetch whole `pm_records` docs (Firestore can't
  project columns) but skip parsing the `data` string, so the list stays light.
- `orderBy('updated_at')` in `dbList()` silently drops docs with no `updated_at`;
  every write path in `shared.js` sets it, and this is a fresh project with no
  legacy rows, so that's fine.
- The `sql/` folder and any remaining "Supabase" wording in `shared.js` comments
  are historical; the SQL migrations no longer apply.
