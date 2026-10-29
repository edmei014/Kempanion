import assert from "node:assert/strict";
import {
  findSlotsByRigName,
  hydrateSlotNotesFromDocument,
  makeSlotNoteKey,
  parseSlotNoteKey
} from "../src/performanceLibrarySlotNotes.js";

const library = {
  "1": {
    "1": { rigName: "Same Rig" },
    "2": { rigName: "Other" }
  },
  "2": {
    "1": { rigName: "Same Rig" }
  }
};

assert.equal(makeSlotNoteKey(12, 4), "12:4");
assert.deepEqual(parseSlotNoteKey("12:4"), { performanceIndex: "12", slotIndex: 4 });
assert.equal(parseSlotNoteKey("12:6"), null);

assert.equal(findSlotsByRigName(library, "Same Rig").length, 2);
assert.equal(findSlotsByRigName(library, "Other").length, 1);

const ambiguous = hydrateSlotNotesFromDocument(
  {
    rigNotes: {
      "Same Rig": "shared legacy note",
      "Unique Rig": "only one slot"
    },
    "1": library["1"]
  },
  { ...library, "3": { "4": { rigName: "Unique Rig" } } }
);

assert.equal(ambiguous.rigNotesLegacy["Same Rig"], "shared legacy note");
assert.equal(ambiguous.slotNotes[makeSlotNoteKey(3, 4)], "only one slot");
assert.equal(ambiguous.migratedFromRigNames, 1);

const roundTrip = hydrateSlotNotesFromDocument(
  {
    slotNotes: { "5:2": "slot note" },
    rigNotesLegacy: { "orphan": "kept" }
  },
  library
);

assert.equal(roundTrip.slotNotes["5:2"], "slot note");
assert.equal(roundTrip.rigNotesLegacy.orphan, "kept");

console.log("test-slot-notes.mjs: ok");
