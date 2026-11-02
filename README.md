# Kempanion

Because it's more than just a profile. It's a sound with a story.

Kempanion is a Windows desktop companion for the Kemper Profiler. It connects **Live View** (MIDI-driven rig control and overview) with **Gear Atlas** (a searchable visual amp library) in one application.

The product idea is simple: what runs on the Profiler should be easy to recognize—not only as text, but as the amplifier behind the rig, with a path to deeper model information when a match exists in the database.

![Kempanion Live View overview](public/images/kempanion-overview.png)

---

## Live View

**MIDI** is the communication link between Kempanion and your Kemper Profiler: it carries control and status messages between the app and the device. Kempanion uses the **Web MIDI API** with **SysEx** (System Exclusive) enabled—SysEx is the part of MIDI used for detailed, Kemper-specific requests and responses (rig data, performance library reads, and similar).

When the Kemper is available through your **configured MIDI connection**, Kempanion **normally connects automatically** (it prefers input/output ports whose names suggest Kemper/Profiler and retries while ports are available). For **configuration or troubleshooting**, you may still need to choose the correct **MIDI input and output** ports manually—especially if several interfaces appear or auto-connect does not succeed.

While connected, Live View reads the **currently active rig directly from the Profiler**—active rig, amp and cabinet labels, effect slots, gain, tempo, and related controls (including the tuner). This live data is independent of the Performance Browser’s cached library.

The **Gear Atlas** is Kempanion’s visual amp catalog—the same record set powers Live View matching. When matching succeeds, Kempanion shows the corresponding **amp image** and library-backed details. **Cabinet** display combines library resolution with a dedicated image map for common configurations. Clicking the amp image opens the shared **amp detail overlay** without leaving Live View.

### Morph

The **Morph** button sends a Morph press/release to the Profiler. It **switches between the two Morph states only when a Morph function has been configured for the current rig** on the Kemper. Kempanion does **not** continuously morph, blend, or automatically transition the sound over time. **Not every rig supports Morph**; rigs without Morph configured may not respond to this control.

### Configurable layout

The **View** menu toggles which blocks are visible (settings persist locally):

| Toggle | Section |
|--------|---------|
| Performance Browser | Performances, slots, and library tools |
| Effects | Stomp and post-amp effect overview |
| Amp Details | Technical amp readout alongside the image |
| Cabinet | Cabinet image and labels |

**Amp Only** hides everything except the amp image and caption, resizes the window to a compact footprint on desktop, and can keep the window above others while that mode is active.

Switch to Gear Atlas with the **compass** control; return to Live View with the **Kempanion signet**.

![Amp Only Window](public/images/amp-only.png)

---

## Performance Browser

The Performance Browser is **not** an independent sound organizer and is **not** a substitute for browsing rigs on the Kemper without Profiler data. It **displays a locally stored library** on your PC that Kempanion **populates from the Kemper Profiler** (performance and rig-slot information read over MIDI). **Kemper performance data is required**—until you build or refresh that library from the device, the browser has nothing meaningful to show.

Each Kemper **performance** contains **five rig slots**. After a scan or reload, Kempanion stores rig names, amp tags, and related metadata in the local library. The Performance Browser **displays and searches** that cache; it does not invent or organize performances independently of what was read from the Kemper.

**Cached library vs Live View:** The Performance Browser uses this **local, cached** data only. **Live View** is independent of the performance library and the browser: it reads the **currently active rig directly from the Kemper** over MIDI and can show that rig even when the slot was **not** scanned into the library, **as long as the Profiler provides the rig information**. After you change performances or rigs **on the Kemper**, update the browser with **Reload** (one performance) or **Rebuild Performance Library** (full scan)—otherwise the Performance Browser can be out of date.

### Building and refreshing the library

- **Rebuild Performance Library** (full scan) — Reads slot data from the Kemper over MIDI and builds or replaces Kempanion’s local library. The Profiler **steps through its performances** during the scan; Kempanion warns that the current performance/slot on the device will change and that the scan can take several minutes. Run an initial scan to populate the browser; run it again when Kemper-side setups have changed enough that the cached overview is out of date.
- **Reload** (↻ on the current performance) — Re-reads **only the selected performance’s five slots** from the Kemper and updates that slice of the local library. Use this when you edited rigs in one performance and do not want a full rescan.

During a full scan, Kempanion reads rig information from the Kemper **step by step via SysEx** and stores it in the local performance library. It then sends **MIDI CC** to move to the next rig so that slot can be read in turn, **building the performance/slot matrix** in the Performance Browser over time. **Do not change performances or rigs manually on the Kemper while a full scan is running**—that can disrupt the scan and how read data is assigned to slots.

Slot entries get **gear-library amp IDs** via the same text matching as Live View. When the Profiler’s current rig name matches **exactly one** library slot, the browser can highlight that performance and slot.

### Custom performance names and rig notes (local only)

Kempanion adds organization the Kemper does not provide as the same editable metadata in this app:

- **Performance names** — Assign your own label to each performance index (e.g. “Studio set”, “Solo night”) so the Performance Browser and Explorer show *what that bank is for*, not only “Performance 42”. Click the performance title in the browser or edit names in the Performance Explorer.
- **Rig notes** — Add free-text notes for the **selected performance slot** (e.g. Performance 12, Slot 4). Each slot has its own note, even when two slots use the same rig name; renaming a rig on the Kemper does not move a note to another slot.

Names and notes are saved **only in Kempanion’s local performance library file** on this computer (with a browser storage fallback if the desktop save path is unavailable). They are **not** written back to the Kemper and are **not** synced to other machines. Custom performance names and slot notes are **kept across a full library rescan** and when you **Reload** a single performance; scanned slot/rig text always comes fresh from the Profiler. Older libraries that stored notes by rig name are migrated when possible; ambiguous legacy notes remain under `rigNotesLegacy` until you reassign them.

Together, custom names, notes, and the Explorer search help you keep an overview of what each performance and rig is intended for without relying on Kemper rig names alone.

![Performance Browser](public/images/performance-browser.png)

---

## How rig and amp matching works

Live View does **not** use AI or fuzzy “semantic” guessing. Kempanion compares text from the Kemper (rig name, amp name, manufacturer, and model) to entries in the **Gear Atlas amp catalog** using fixed rules: known **aliases** and model strings, and the **longest matching substring** wins when several candidates could apply.

### Why an amp might not appear

- Kempanion matches **Profiler text** against the Gear Atlas catalog—it does not read your intent from a personal rig name alone.
- **Rig names are your labels.** They often omit official manufacturer and model wording (shortened names, descriptive titles, typos). The same real amp can appear under many different rig names.
- **No amp image in Live View does not necessarily mean the amplifier is missing from the catalog.** Automatic matching may have failed. Search **Gear Atlas** manually using the **actual manufacturer and model name** you expect—not only the rig name shown in Live View.
- If that amp **is not in Gear Atlas**, it is not in Kempanion’s amp catalog yet—adding it requires catalog data, not a MIDI fix.
- Matching returns **one best match or no match**. There is **no confidence score** and **no manual picker** for automatic Live View matching when several amps could fit.

Technical detail: [Gear Library architecture](docs/GEAR_LIBRARY.md) (data model, aliases, API) · [System architecture](docs/ARCHITECTURE.md) (Live View pipeline, performance library).

---

## Gear Atlas

Gear Atlas is Kempanion’s **visual amp catalog**—search, manufacturer filtering, sorting, and chapter-style navigation over the same amp records Live View uses. **Manufacturers** and **Amps** are the active categories in the app today; additional gear categories exist in the data model but are not yet exposed in the Atlas UI.

![Gear Atlas overview](public/images/gear-atlas-overview.png)

**Standard browse and Collections** — card grids and themed collection layouts for exploration.

**Museum Mode** — one amp at a time, exhibition-style presentation within the Atlas.

**Timeline** — amps arranged by production era and year where that metadata exists.

**Presentation Mode** — reduced chrome and a presentation-oriented full-screen frame (independent of Museum layout).

Amp detail views show images and metadata fields when present in the database (descriptions, history, specs, and similar).

---

## Technology

| Layer | Role |
|-------|------|
| **Tauri 2** | Desktop shell, window behavior, bundled amp image resources |
| **Vite** | Frontend build and dev server |
| **Vanilla JavaScript (ES modules)** | UI, MIDI, Gear Atlas, Live View logic |
| **Rust** | Persisting the performance library JSON under the user data directory |
| **Web MIDI + SysEx** | Kemper communication from the embedded webview |

---

## Requirements, installation, and build

### Requirements

- **Windows** (installer target is NSIS)
- **Kemper Profiler** and a **MIDI connection** to the PC for Live View and performance library scanning
- Gear Atlas can be browsed without a connected Kemper; Live View and library scan/reload require MIDI

### Install

1. Download the **Windows installer** from **[GitHub Releases](https://github.com/edmei014/Kempanion/releases)** for this repository.
2. Install and launch Kempanion (e.g. from the Start menu).
3. Connect the Kemper Profiler to the PC via **MIDI** (interface or USB, depending on your setup).
4. Kempanion **normally connects automatically** when the Kemper is available through the **configured MIDI connection**. If Live View does not connect, select the **MIDI input and output** ports manually for setup or troubleshooting (use **Reconnect** on the no-MIDI screen if shown).
5. Open the **Performance Browser** and explicitly start **Rebuild Performance Library** to populate the local library. Confirm the dialog to begin—the scan does **not** start automatically. Expect **several minutes** while Kempanion walks through performances on the Profiler; the **current performance and slot on the Kemper will change** during the scan.

### Build from source

```bash
git clone https://github.com/edmei014/Kempanion.git
cd Kempanion
npm install
npm run tauri build
```

The NSIS installer is produced under `src-tauri/target/release/bundle/nsis/`.

---

## Project status

Kempanion is under active development (see `package.json` / Tauri app version). Live View, Gear Atlas, and the shared amp library are wired together; the amp catalog and UI continue to evolve.

---

## Author

**edmei014** — [github.com/edmei014](https://github.com/edmei014)

---

## Disclaimer

Kempanion is an independent third-party project. It is not officially affiliated with Kemper GmbH and is neither supported nor endorsed by Kemper.

“Kemper” and “Kemper Profiler” are trademarks of their respective owners and are used here solely to describe compatibility.
