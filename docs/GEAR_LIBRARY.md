# Gear Library Architecture

The **Gear Library** is Kempanion’s code and data layer for equipment records. The **Gear Atlas** UI is the user-facing catalog: it browses the same normalized amp records that Live View uses for images and details. There is no separate “Live amp list”—recognition always goes through `allAmpRecords` → `src/library/` → `src/resolver/aliasResolver.js`.

Application code (UI, Live View) must **not import from `src/data/` directly** — use the public API in `src/library/index.js`.

**Documented exceptions (not data imports):** `src/main.js` calls `initializeAmpImageResolver()` from `src/resolver/imageResolver.js` at startup, and uses `src/cabinetImageMap.js` for Live cabinet image fallback (separate from amp alias matching in the library). Do not import `src/resolver/aliasResolver.js` from UI code.

**Document name:** `GEAR_LIBRARY.md` describes the shared library architecture (not only the Atlas UI). A rename is optional; the content below matches the current implementation.

---

## Directory roles

### `src/data/`

Version-controlled, file-based datasets. One folder per category:

```
data/
  amps/              Manufacturer files + index.js → allAmpRecords
  manufacturers/     Manufacturer profiles + name/id helpers
  cabinets/
  effects/
  speakers/
  microphones/
  pedals/
  discover/          Discover-board content (Gear Atlas column)
  ampSchema.js       createAmpRecord(), AMP_RECORD_FIELDS
```

- **Purpose:** Store raw records only.
- **No alias matching logic** in data files (matching lives in `src/resolver/aliasResolver.js` and library wrappers).
- Each amp manufacturer file exports one array, e.g. `marshallAmps`.
- `src/data/amps/index.js` merges arrays into `allAmpRecords`.

### `src/library/`

Public API layer—the only entry point for UI and Live View.

```
library/
  index.js                 Public exports — import from here
  ampLibrary.js            Amps: records, browse/detail views, text→record
  manufacturerLibrary.js   Manufacturer browse/detail
  cabinetLibrary.js        Cabinet records + text resolution (library API)
  effectLibrary.js         Effect records (createGearLibrary store; partial public export)
  discoverLibrary.js       Discover records + Atlas board helpers
  discoverRotation.js      Discover column rotation helpers
  createGearLibrary.js     Shared indexed catalog factory
  fieldValues.js           Missing-value formatting (“Coming soon…”)
  validateGearRegistry.js  Manual registry validation (not wired to app startup)
```

- Normalizes records via `createAmpRecord()` (amps) or category-specific normalizers.
- Exposes **view models** for Gear Atlas: `AmpBrowseEntry`, `AmpDetailView`, timeline/collection section builders.
- Wraps alias resolution as `resolveAmpRecordFromTextSources`, `getAmpImageForText`, etc.

### `src/resolver/`

Helpers used **by the library**. UI should not import `aliasResolver.js` directly; **`imageResolver.js`** may be imported for startup init only (see above).

```
resolver/
  aliasResolver.js   Kemper/rig text → amp id (longest alias substring)
  imageResolver.js   Amp image base URLs (Tauri resources vs dev paths)
```

- `aliasResolver.js` returns **only an amp id**—never descriptions or images.
- `imageResolver.js` sets amp image base URLs; `ampLibrary.js` wraps `resolveAmpImageSrc` when building public image URLs (see **Images** below).

---

## Gear Atlas catalog vs Live View matching

| Concern | Gear Atlas (browse/search) | Live View (automatic) |
|--------|----------------------------|------------------------|
| **Data source** | Same `AmpRecord` catalog | Same catalog |
| **Mechanism** | `searchAmps(query)` — substring over manufacturer, model, and aliases (`buildSearchText`) | `resolveAmpRecordFromTextSources(...)` — alias index, longest matching alias |
| **User action** | Intentional search by manufacturer/model name | Passive: Kemper rig name, amp name, manufacturer, model strings from MIDI |
| **Coverage** | Any amp in the catalog can be opened manually | Only amps **identified** by the matcher show images/details automatically |

**Catalog coverage ≠ automatic match success.** An amp can exist in the Gear Atlas but not appear in Live View if Kemper strings do not contain a recognizable alias (or a longer alias points elsewhere). Users can open the **Gear Atlas** and search by the real **manufacturer and model** to view that amp visually. If a model is **not** in the catalog, Kempanion cannot show library images or detail for it until a record (and optional image) is added.

---

## AmpRecord shape

After normalization (`createAmpRecord()` in `src/data/ampSchema.js`), every amp has a consistent shape. Required identity fields: `id`, `manufacturer`, `model`. `manufacturerId` links to `src/data/manufacturers/` (inferred from manufacturer name when omitted).

```js
{
  id: "marshall-jcm800-2203",
  manufacturerId: "marshall",
  manufacturer: "Marshall",
  model: "JCM800 2203",
  aliases: ["jcm 800", "jcm800 2203", "..."],
  image: "marshall jcm800 2203.png",  // filename or null
  description: "...",
  history: "...",
  introduced: 1981,
  discontinued: 1990,
  country: "United Kingdom",
  ampType: "Tube Head",
  power: "100 W",
  channels: 1,
  tubes: { preamp: ["3 × ECC83"], power: ["4 × EL34"] },
  genres: ["Hard Rock", "..."],
  notableUsers: ["..."],
  tags: null,
  theme: null,           // optional presentation theme input
  isCombo: true            // optional; only present when true
}
```

Fields such as `description` may be `null` in data files; `getAmpDetailView()` applies `formatGearFieldValue()` so the UI gets display strings (e.g. placeholders) instead of raw nulls.

**Not used for Live amp matching:** rig author, performance names, or Gear Atlas sort keys. Matching uses Kemper text sources only (see below).

---

## Manufacturers and `manufacturerId`

- Each amp should have `manufacturerId` matching `manufacturerRecords[].id` in `src/data/manufacturers/index.js`.
- When **authoring data**, `resolveManufacturerIdFromAmpName()` in `manufacturerIds.js` maps display names and `MANUFACTURER_NAME_ALIASES`. The **public library API** exposes `resolveManufacturerIdFromAmpManufacturerName()` (`manufacturerLibrary.js`), which wraps the same lookup and returns `null` when unknown.
- Gear Atlas shows `getManufacturerDisplayName(manufacturerId)` where available.
- **Alias index** also registers `"<manufacturer> <model>"` strings with `&` ↔ `and` variants on the **manufacturer** side only—not a separate pass on Kemper’s manufacturer field unless that string appears as its own matching source.

---

## Amp alias system (implementation)

Implemented in `src/resolver/aliasResolver.js`.

### Index contents (per amp)

For each normalized amp, the index includes:

1. Every entry in `aliases[]` (author-defined, e.g. `"jcm 800"`, `"cm800"`).
2. `model` alone.
3. `"<manufacturer> <model>"`.
4. The same with manufacturer name variants (`&` / `and`).

Entries are stored lowercase. The index is sorted by **alias length descending** before matching.

### Per-string matching

For one normalized string (trim + lowercase):

- Find all index entries where `normalized.includes(alias)` (substring match).
- Keep the match with the **longest** alias length (`length > bestLength`, not `>=`).

There is **no** fuzzy edit distance, **no** confidence score, and **no** UI to pick among ties. Equal-length ties go to whichever matching index entry is visited first.

### Multiple Kemper inputs (Live View)

`resolveLiveAmpRecord()` in `src/main.js` calls:

```text
resolveAmpRecordFromTextSources(ampName, rigName, ampManufacturer, ampModel)
```

Each non-empty source is scored independently; the **single best length across all sources** wins. Typical inputs:

| Source | Origin (SysEx string tags) |
|--------|----------------------------|
| Rig name | Current rig / slot rig name |
| Amp name | Kemper amp name tag |
| Amp manufacturer | Kemper manufacturer tag |
| Amp model | Kemper model tag |

Performance library scans store the same four text fields per slot and run the same matcher to attach `ampId` (`enrichPerformanceSlotWithAmpMatch`).

### After resolution

- `getAmpById(ampId)` → canonical `AmpRecord`.
- Live View uses `getAmpImage(ampId)` and `getAmpDetailView(ampId)` for overlay/details.
- **No match** (`null` id): Live View leaves the amp image area empty; Kemper text labels still show (`src/main.js` only renders an image when `liveData.ampImageSrc` is set).
- **Match with missing or unusable `image` filename:** `getAmpImage(ampId)` returns **`null`** (see **Images**). Live View does **not** show a placeholder on that path.

---

## Images and bundled assets

- Records store an **image filename** only (e.g. `"marshall jcm800 2203.png"`), not a full URL.
- `initializeAmpImageResolver()` (`imageResolver.js`) sets base paths: Tauri resource URLs in production, `/images/amps` in dev.
- **Public amp URLs:** `getAmpImage(ampId)` and browse/detail view models use `ampLibrary.js`, which calls `resolveAmpImageSrc(filename)` **only when** `isUsableAmpImageFilename(filename)` is true; otherwise the public API returns **`null`** (no image URL). **`getAmpDetailView()`** sets `imageSrc` from `getAmpImage` and `hasImage` from `hasAmpImage` — same rules, not a guaranteed placeholder.
- **`resolveAmpImageSrc()`** alone (low-level helper in `imageResolver.js`) returns the shared placeholder (`/images/comingsoon.png`) for invalid filenames. That behavior does **not** flow through `getAmpImage()` / Live View today.
- Performance Browser thumbnails: `getAmpPerformanceThumbnail()` → `images/amps-performance/` when a usable filename exists (`resolveAmpPerformanceThumbnailSrc`).
- Bundled paths are configured in `src-tauri/tauri.conf.json` (see [ARCHITECTURE.md](ARCHITECTURE.md)). Optional asset generation: `scripts/generate-amp-performance-thumbnails.ps1`.

---

## Public API (`src/library/index.js`)

Import from **`src/library/index.js` only** for gear records and queries. The list below groups **exported** symbols; it is not every internal helper inside `ampLibrary.js` et al.

### Amps — records, matching, images

| Export | Role |
|--------|------|
| `getAllAmps`, `getAmpById`, `getAmpAliases` | Catalog access |
| `getManufacturers`, `getAmpsByManufacturer`, `getAmpsByManufacturerId` | Manufacturer filters |
| `searchAmps` | Atlas substring search (≠ Live matcher) |
| `resolveAmpRecordFromTextSources`, `resolveAmpIdFromTextSources` | Multi-source Live matching |
| `resolveAmpRecordFromText`, `resolveAmpIdFromText` | Single-string helpers |
| `getAmpImage`, `getAmpImageFilename`, `hasAmpImage`, `getAmpPerformanceThumbnail` | Image URLs / thumbnails |
| `getAmpImageForText`, `getAmpImageFilenameForText` | Text → image via matcher |
| `getAmpDetailView`, `getAmpFieldDisplayValue` | Detail overlay / formatted fields |
| `getAmpLibraryStats` | Counts for stats UI |

### Amps — Gear Atlas browse / sort / sections

| Export | Role |
|--------|------|
| `getAmpBrowseEntries` | Filtered card rows (query, manufacturer, sort, image filter) |
| `buildAmpBrowseSections`, `buildAmpManufacturerViewSections`, `buildAmpTimelineSections` | Section layouts |
| `groupAmpBrowseEntriesByManufacturer`, `segmentAmpBrowseEntriesByManufacturerRuns`, `compareAmpBrowseEntries` | Grouping and sort helpers |
| `AMP_SORT*`, `AMP_IMAGE_FILTER`, `AMP_ATLAS_PRESENTATION*`, `normalizeAmpSort`, `parseAmpSortSpec`, … | Sort/presentation constants and parsers |
| `AMP_BROWSER_VIEW*` (deprecated aliases) | Legacy view ids — prefer `AMP_SORT` / `AMP_ATLAS_PRESENTATION` |
| `AMP_IMAGE_BASE_PATH` | Dev/public base path constant |

### Manufacturers

| Export | Role |
|--------|------|
| `getManufacturerById`, `getManufacturerDisplayName`, `getManufacturerDetailView` | Detail and labels |
| `getManufacturerBrowseEntries`, `getAllManufacturerIds`, `getManufacturerLibraryStats` | Atlas manufacturer browse |
| `resolveManufacturerIdFromAmpManufacturerName` | Public name → `manufacturerId` (wrapper around data-layer lookup) |

### Cabinets (library resolver — not `cabinetImageMap`)

| Export | Role |
|--------|------|
| `getAllCabinets`, `getCabinetById`, `searchCabinets` | Catalog |
| `resolveCabinetRecordFromTextSources` | Longest-alias text match (`cabinetLibrary.js`) |
| `getCabinetDetailView`, `getCabinetImage` | Detail and image URL |

Live View may still use **`cabinetImageMap.js`** in addition to this API ([ARCHITECTURE.md](ARCHITECTURE.md)).

### Effects

**Exported:** `getAllEffects()` only.

**Internal to `effectLibrary.js` (not in `index.js`):** e.g. `getEffectById`, `searchEffects`, `getEffectImage`. Use or export via `index.js` if UI needs them.

### Discover (Gear Atlas column)

| Export | Role |
|--------|------|
| `getAllDiscoverRecords`, `getDiscoverById`, `getDiscoverRecordsByCategory`, … | Discover content |
| `createDiscoverBoardState`, `advanceDiscoverBoard`, `createDiscoverEntryView`, … | Board UI helpers |
| `createDiscoverRotationController`, `rotateDiscoverSlot`, … | Rotation timing helpers |

Use `getAmpDetailView()` field formatting for amp details—not raw `if (description)` on records.

---

## Improving Live matching (contributors)

Matching uses **catalog alias substrings**, not user intent. To fix missed Live matches or wrong `ampId` on performance slots, add **specific `aliases[]`** on the correct `AmpRecord` in `src/data/amps/`, then run the normalize script. Do **not** duplicate matching logic in Live View or Gear Atlas UI.

For user-facing troubleshooting (Atlas search vs Live, missing images, catalog gaps), see [README.md](../README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

Performance library names, slot notes, and scan behavior are documented in [ARCHITECTURE.md](ARCHITECTURE.md) — not part of the Gear Library data layer.

---

## Adding a new amp

1. Add a record (with `id`, `manufacturerId`, `manufacturer`, `model`, and `aliases`; image optional) to the appropriate `src/data/amps/<fileKey>.js`, or create that file if needed.
2. Ensure `manufacturerId` exists in `src/data/manufacturers/index.js`.
3. Run **`node scripts/normalize-amp-records.mjs`**. This **regenerates** all manufacturer amp files and **`src/data/amps/index.js`** from `allAmpRecords` — you do not need to maintain `index.js` imports by hand after normalize.
4. The script maps `manufacturer` → file name via an internal **`FILE_NAMES`** table for special keys (e.g. `3rd Power` → `thirdPower.js`, `Tone King` → `toneKing.js`); other manufacturers default to a lowercased slug from the display name. Add a `FILE_NAMES` entry when the default slug is wrong.
5. No UI changes required for Atlas browse; new aliases affect Live matching after app reload.

Optional: run **`validateGearRegistry()`** from `validateGearRegistry.js` (manual call) to check registry consistency.

### Example (minimal)

```js
{
  id: "marshall-jcm800-2203",
  manufacturerId: "marshall",
  manufacturer: "Marshall",
  model: "JCM800 2203",
  aliases: ["jcm 800", "jcm800 2203"],
  image: "marshall jcm800 2203.png",
  description: null,
  history: null,
  introduced: 1981,
  discontinued: null,
  country: null,
  ampType: null,
  power: null,
  channels: null,
  tubes: null,
  genres: null,
  notableUsers: null,
  tags: null
}
```

---

## Adding a new manufacturer

1. Add a profile to `src/data/manufacturers/index.js` with a stable `id`.
2. Create or extend `src/data/amps/<fileKey>.js` with amps using that **`manufacturerId`** (set `FILE_NAMES` in the normalize script if the file key should not be auto-derived).
3. Optional: `MANUFACTURER_NAME_ALIASES` in `src/data/manufacturers/manufacturerIds.js` for spelling variants when authoring `manufacturer` strings.
4. Run **`node scripts/normalize-amp-records.mjs`** (regenerates amp files and `index.js`).

Do **not** maintain a separate Kempanion amp list in Live View code.

### `validateGearRegistry()` (manual)

Not invoked during app startup or build. Call **`validateGearRegistry({ warn: true })`** from `src/library/validateGearRegistry.js` when you want a consistency report after data edits. It checks among other things:

- **Duplicate amp ids**
- **Duplicate aliases** (same alias string claimed by multiple amps)
- **Empty alias lists**
- **Missing or orphan `manufacturerId`** values (amps pointing at unknown manufacturer records, and manufacturers with no amps)

Returns a structured report (`ok`, counts, issue lists). Fixing issues is a data/contributor task — the app does not auto-run this.

---

## Adding a new category (Cabinets, Effects, …)

1. Add dataset under `src/data/<category>/`.
2. Create `src/library/<category>Library.js` using `createGearLibrary()` (cabinets already follow this).
3. Export from `src/library/index.js`.
4. Gear Atlas category toggles live in `src/gearLibraryCatalog.js` (amps/manufacturers enabled today).

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/normalize-amp-records.mjs` | Normalize all amps with `createAmpRecord()`, rewrite manufacturer files and `amps/index.js` |
| `scripts/generate-amp-performance-thumbnails.ps1` | Generate `amps-performance` thumbnail assets from full-size amp images (optional maintenance) |
| `scripts/migrate-amp-data.mjs` | Legacy one-time migration helper |

---

## Rules for contributors

- **Do not** import `src/data/*` from UI or Live View code (library layer imports data).
- **Do not** import `aliasResolver.js` from UI; use `src/library/index.js` matching helpers.
- **Do not** implement matching in data files or Gear Atlas UI—extend aliases and use the library API.
- **Do not** add UI-specific formatting in data or resolver layers.
- **Do** run `node scripts/normalize-amp-records.mjs` after amp data edits.
- **Do** extend `src/library/index.js` when new query patterns should be public.

---

## Related documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Tauri/MIDI, performance library, cabinet matching, module boundaries
- [README.md](../README.md) — product overview and user-facing matching summary
