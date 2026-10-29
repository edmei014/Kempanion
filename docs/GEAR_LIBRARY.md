# Gear Library Architecture

The **Gear Library** is Kempanion’s code and data layer for equipment records. The **Gear Atlas** UI is the user-facing catalog: it browses the same normalized amp records that Live View uses for images and details. There is no separate “Live amp list”—recognition always goes through `allAmpRecords` → `src/library/` → `src/resolver/aliasResolver.js`.

Application code (UI, Live View, resolvers) must **never import from `src/data/` directly**.  
Use the public API in `src/library/index.js`.

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
  cabinetLibrary.js        Cabinet records + text resolution (Live + data)
  effectLibrary.js         Effect category API (stub)
  createGearLibrary.js     Shared indexed catalog factory
  fieldValues.js           Missing-value formatting (“Coming soon…”)
  validateGearRegistry.js  Startup consistency checks
```

- Normalizes records via `createAmpRecord()` (amps) or category-specific normalizers.
- Exposes **view models** for Gear Atlas: `AmpBrowseEntry`, `AmpDetailView`, timeline/collection section builders.
- Wraps alias resolution as `resolveAmpRecordFromTextSources`, `getAmpImageForText`, etc.

### `src/resolver/`

Helpers used **by the library** (and startup image init). UI should not import `aliasResolver.js` directly.

```
resolver/
  aliasResolver.js   Kemper/rig text → amp id (longest alias substring)
  imageResolver.js   Amp image base URLs (Tauri resources vs dev paths)
```

- `aliasResolver.js` returns **only an amp id**—never descriptions or images.
- `imageResolver.js` is used internally by `ampLibrary.js` (`resolveAmpImageSrc`); Live View calls `getAmpImage(ampId)` from the library API.

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
- `resolveManufacturerIdFromAmpName()` (`manufacturerIds.js`) maps display names and `MANUFACTURER_NAME_ALIASES` when authoring data.
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
- Live View: `getAmpImage(ampId)`, `getAmpDetailView(ampId)` for overlay/details.
- If resolution fails (`null` id): Live View clears the amp image area; Kemper labels still show (`src/main.js` only renders an image when `ampImageSrc` is set).
- If resolution succeeds but `image` is missing/invalid: `resolveAmpImageSrc` may fall back to the shared placeholder (`/images/comingsoon.png`) when the library image helper is used—Live still treats that as “has image URL.”

---

## Images and bundled assets

- Records store an **image filename** only (e.g. `"marshall jcm800 2203.png"`), not a full URL.
- `initializeAmpImageResolver()` (`imageResolver.js`) sets base paths: Tauri resource URLs in production, `/images/amps` in dev.
- Performance Browser thumbnails use `getAmpPerformanceThumbnail()` → `images/amps-performance/` when available.
- Bundled paths are configured in `src-tauri/tauri.conf.json` (see [ARCHITECTURE.md](ARCHITECTURE.md)).

---

## Amp public API

Import from `src/library/index.js`:

| Function | Description |
|----------|-------------|
| `getAllAmps()` | All normalized amp records |
| `getAmpById(id)` | Single record or `null` |
| `getManufacturers()` / manufacturer helpers | Manufacturer catalog |
| `getAmpsByManufacturer(name)` / `getAmpsByManufacturerId(id)` | Filter by manufacturer |
| `searchAmps(query)` | Gear Atlas-style substring search (not identical to Live matcher) |
| `getAmpAliases(id)` | Alias list for an amp |
| `getAmpImage(id)` / `hasAmpImage(id)` | Image URL / filename presence |
| `getAmpImageForText(text)` / `getAmpImageFilenameForText(text)` | Text → image via alias resolver |
| `resolveAmpRecordFromTextSources(...)` | Text → full `AmpRecord` (Live matching) |
| `resolveAmpIdFromTextSources(...)` | Text → id only |
| `getAmpBrowseEntries(options)` | Gear Atlas card rows |
| `getAmpDetailView(id)` | Gear Atlas / overlay detail panel |
| `getAmpLibraryStats()` | Counts for stats UI |

Use `getAmpDetailView()` field formatting—not raw `if (description)` on records.

---

## When automatic matching fails (user-oriented)

Kemper **rig names are user-defined**. They often do not spell out official manufacturer and model names—shortened labels (e.g. `Mars` vs `Marshall`), descriptive titles (e.g. `Fender Fan`), or typos (e.g. `Duel Rectifier` vs `Dual Rectifier`) are common *patterns*; matching looks for **catalog alias substrings**, not intent. The same limitations apply to performance library `ampId` enrichment.

1. **Check Kemper strings** — Rig name and amp tags must contain text that matches a catalog alias (often model name or a known nickname in `aliases`).
2. **Search Gear Atlas** — Use manufacturer and model as you would in the real world; `searchAmps()` does not use the Live matcher and does not require the rig name to match.
3. **Missing image ≠ missing catalog entry** — Live View may show no image while the amp still exists in the Atlas; search manually by manufacturer/model.
4. **Catalog gap** — If the amp is not in `src/data/amps/`, it cannot appear in Gear Atlas or Live library visuals until added (see below).
5. **Ambiguous rigs** — Two models sharing a substring may resolve to the longer alias only; there is no chooser dialog.

Contributors improve Live matching by adding **specific aliases** on the correct `AmpRecord`, not by duplicating lists in Live View code.

---

## Performance library metadata (Kempanion-only)

Custom **performance names** (`performanceNames`) and **slot notes** (`slotNotes`, keys like `"12:4"` for performance 12 slot 4) are merged into the performance library document on save. Legacy rig-name notes (`rigNotes`) are migrated on load when unambiguous; otherwise they are kept in `rigNotesLegacy`. All of this is **local to Kempanion** (Tauri file or `localStorage` fallback)—not sent to the Kemper. See [ARCHITECTURE.md](ARCHITECTURE.md) for scan vs reload and Live View vs cache.

---

## Adding a new amp

1. Open or create `src/data/amps/<fileKey>.js` (e.g. `marshall.js`).
2. Add a record with `id`, `manufacturerId`, `manufacturer`, `model`, and `aliases` (image optional).
3. Import and spread the array in `src/data/amps/index.js`.
4. Ensure `manufacturerId` exists in `src/data/manufacturers/index.js`.
5. Run `node scripts/normalize-amp-records.mjs`.
6. No UI changes required for Atlas browse; new aliases affect Live matching after reload.

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

1. Create `src/data/amps/<fileKey>.js` with amps using that `manufacturerId`.
2. Register amps in `src/data/amps/index.js`.
3. Add a profile to `src/data/manufacturers/index.js` with the **same** `id`.
4. Optional: `MANUFACTURER_NAME_ALIASES` in `src/data/manufacturers/manufacturerIds.js` for spelling variants.
5. Run `node scripts/normalize-amp-records.mjs`.

`validateGearRegistry()` logs amp counts and reports amps whose `manufacturerId` is missing from manufacturer records.

Do **not** maintain a separate Kempanion amp list in Live View code.

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
| `scripts/normalize-amp-records.mjs` | Enforce AmpRecord fields in manufacturer files |
| `scripts/migrate-amp-data.mjs` | Legacy one-time migration helper |

---

## Rules for contributors

- **Do not** import `src/data/*` from UI or Live View code.
- **Do not** implement matching in data files or Gear Atlas UI—extend aliases and use the library API.
- **Do not** add UI-specific formatting in data or resolver layers.
- **Do** use `createAmpRecord()` / normalize script after data edits.
- **Do** extend `src/library/index.js` when new query patterns are needed.

---

## Related documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Tauri/MIDI, performance library, cabinet matching, module boundaries
- [README.md](../README.md) — product overview and user-facing matching summary
