/** @typedef {{ performanceIndex: string, slotIndex: number }} SlotRef */

export const SLOT_NOTES_KEY = "slotNotes";
/** @deprecated Legacy rig-name keys — read for migration only. */
export const LEGACY_RIG_NOTES_KEY = "rigNotes";
/** Rig-name notes that could not be mapped to a single performance slot. */
export const RIG_NOTES_LEGACY_UNMAPPED_KEY = "rigNotesLegacy";

const MAX_SLOT_INDEX = 5;

/**
 * @param {string | number} performanceIndex
 * @param {string | number} slotIndex
 * @returns {string}
 */
export function makeSlotNoteKey(performanceIndex, slotIndex) {
  return `${String(performanceIndex)}:${String(slotIndex)}`;
}

/**
 * @param {unknown} key
 * @returns {SlotRef | null}
 */
export function parseSlotNoteKey(key) {
  const match = String(key ?? "").match(/^(\d+):([1-5])$/);
  if (!match) return null;
  return {
    performanceIndex: match[1],
    slotIndex: Number(match[2])
  };
}

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function normalizeSlotNotes(value) {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, note]) => parseSlotNoteKey(key) && typeof note === "string" && note.trim())
      .map(([key, note]) => [key, String(note)])
  );
}

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function normalizeRigNameNotes(value) {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, note]) => String(key).trim() && typeof note === "string" && note.trim())
      .map(([key, note]) => [String(key).trim(), String(note)])
  );
}

/**
 * @param {unknown} slotValue
 * @returns {string}
 */
export function getRigNameFromSlotValue(slotValue) {
  if (typeof slotValue === "string") return slotValue.trim();
  if (slotValue && typeof slotValue === "object") {
    return String(/** @type {Record<string, unknown>} */ (slotValue).rigName ?? "").trim();
  }
  return "";
}

/**
 * @param {Record<string, Record<string, unknown>>} performanceEntries Numeric performance keys only.
 * @param {string} rigName
 * @returns {SlotRef[]}
 */
export function findSlotsByRigName(performanceEntries, rigName) {
  const needle = String(rigName || "").trim();
  if (!needle) return [];

  /** @type {SlotRef[]} */
  const matches = [];

  for (const [performanceIndex, slots] of Object.entries(performanceEntries)) {
    if (!/^\d+$/.test(performanceIndex) || !slots || typeof slots !== "object") continue;

    for (let slotIndex = 1; slotIndex <= MAX_SLOT_INDEX; slotIndex += 1) {
      const rig = getRigNameFromSlotValue(slots[String(slotIndex)]);
      if (rig === needle) {
        matches.push({ performanceIndex, slotIndex });
      }
    }
  }

  return matches;
}

/**
 * Migrates legacy rig-name notes to slot keys when unambiguous.
 * Does not duplicate one legacy note across multiple slots.
 *
 * @param {Record<string, unknown>} document Raw performance library JSON
 * @param {Record<string, Record<string, unknown>>} performanceEntries
 * @returns {{
 *   slotNotes: Record<string, string>,
 *   rigNotesLegacy: Record<string, string>,
 *   migratedFromRigNames: number
 * }}
 */
export function hydrateSlotNotesFromDocument(document, performanceEntries) {
  const slotNotes = normalizeSlotNotes(document?.[SLOT_NOTES_KEY]);
  const rigNotesLegacy = normalizeRigNameNotes(document?.[RIG_NOTES_LEGACY_UNMAPPED_KEY]);
  const legacyRigNotes = normalizeRigNameNotes(document?.[LEGACY_RIG_NOTES_KEY]);

  let migratedFromRigNames = 0;

  for (const [rigName, note] of Object.entries(legacyRigNotes)) {
    const matches = findSlotsByRigName(performanceEntries, rigName);

    if (matches.length === 1) {
      const key = makeSlotNoteKey(matches[0].performanceIndex, matches[0].slotIndex);
      if (!slotNotes[key]) {
        slotNotes[key] = note;
        migratedFromRigNames += 1;
      }
    } else {
      rigNotesLegacy[rigName] = note;
    }
  }

  return { slotNotes, rigNotesLegacy, migratedFromRigNames };
}
