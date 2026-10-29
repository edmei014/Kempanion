import "./styles.css";
import "./styles/gearLibraryTheme.css";
import "./styles/gearLibraryDesignPreviews.css";
import "./styles/presentationMode.css";
import { invoke } from "@tauri-apps/api/core";
import { effectImageMap } from "./effectImageMap.js";
import {
  getAmpById,
  getAmpDetailView,
  getAmpImage,
  getAmpPerformanceThumbnail,
  getCabinetDetailView,
  resolveAmpRecordFromTextSources,
  resolveCabinetRecordFromTextSources
} from "./library/index.js";
import {
  initializeGearLibrary,
  registerViewChangeHandler,
  setAppView
} from "./gearLibrary.js";
import {
  LEGACY_RIG_NOTES_KEY,
  RIG_NOTES_LEGACY_UNMAPPED_KEY,
  SLOT_NOTES_KEY,
  hydrateSlotNotesFromDocument,
  makeSlotNoteKey
} from "./performanceLibrarySlotNotes.js";
import { initializeBidirectionalDiscovery } from "./modules/bidirectional/BidirectionalDiscovery.js";
import { isBooleanOn } from "./modules/bidirectional/decoder/parameterScales.js";
import { parameterService } from "./modules/bidirectional/ParameterService.js";
import { CONTROL_PARAMETERS } from "./modules/bidirectional/controlBindings.js";
import { initializeAmpImageResolver } from "./resolver/imageResolver.js";
import { initLiveViewMode } from "./liveViewMode.js";
import {
  getEffectTypeName,
  observeEffectType,
  seedEffectTypeNames
} from "./modules/bidirectional/effectTypeRegistry.js";
import { openAmpDetailsOverlay } from "./modules/ampDetails/AmpDetailsOverlay.js";
import {
  cabinetImageMap,
  CAB_BRAND_ALIASES
} from "./cabinetImageMap";

const CURRENT_RIG_NAME_REQUEST = [
  0xf0, 0x00, 0x20, 0x33, 0x02, 0x7f, 0x43, 0x00, 0x00, 0x01, 0xf7
];
const SYSEX_HEADER = [0xf0, 0x00, 0x20, 0x33];
const KEMPER_REQUEST_PREFIX = [0xf0, 0x00, 0x20, 0x33, 0x02, 0x7f];
const STRING_TAGS = {
  rigName: [0x00, 0x01],
  rigAuthor: [0x00, 0x02],
  ampName: [0x00, 0x10],
  ampManufacturer: [0x00, 0x15],
  ampModel: [0x00, 0x18],
  ampYearOfProduction: [0x00, 0x1b],
  cabinetName: [0x00, 0x20],
  cabinetManufacturer: [0x00, 0x25],
  cabinetModel: [0x00, 0x2a],
  speakerConfiguration: [0x00, 0x29]
};
const NUMERIC_PARAMS = {
  gain: [0x0a, 0x04],
  tempoBpm: [0x04, 0x00]
};
const EFFECT_MODULES = [
  { key: "stompA", label: "Stomp A", cc: 17, page: 0x32, onOff: 0x03, type: 0x00, group: "stomp" },
  { key: "stompB", label: "Stomp B", cc: 18, page: 0x33, onOff: 0x03, type: 0x00, group: "stomp" },
  { key: "stompC", label: "Stomp C", cc: 19, page: 0x34, onOff: 0x03, type: 0x00, group: "stomp" },
  { key: "stompD", label: "Stomp D", cc: 20, page: 0x35, onOff: 0x03, type: 0x00, group: "stomp" },
  { key: "stompX", label: "Stomp X", cc: 22, page: 0x38, onOff: 0x03, type: 0x00, group: "stomp" },
  { key: "mod", label: "MOD", cc: 24, page: 0x3a, onOff: 0x03, type: 0x00, group: "mod" },
  { key: "delay", label: "Delay", cc: 26, page: 0x3c, onOff: 0x03, type: 0x00, group: "delay" },
  { key: "reverb", label: "Reverb", cc: 28, page: 0x3d, onOff: 0x03, type: 0x00, group: "reverb" }
];

/** @param {number} page @param {number} offset */
function kemperParamId(page, offset) {
  return ((page & 0x7f) << 8) | (offset & 0x7f);
}

const LIVE_PUSH_PARAM = Object.freeze({
  rigName: kemperParamId(0x00, 0x01),
  tempoBpm: kemperParamId(0x04, 0x00),
  gain: kemperParamId(0x0a, 0x04)
});

const EFFECT_ON_OFF_BY_PARAM_ID = new Map(
  EFFECT_MODULES.map((module) => [kemperParamId(module.page, module.onOff), module])
);
const EFFECT_TYPE_BY_PARAM_ID = new Map(
  EFFECT_MODULES.map((module) => [kemperParamId(module.page, module.type), module])
);

/**
 * Kemper bypass echo observed after Delay/Reverb writes (RX only — write stays 0x3C03/0x3D03).
 * Used for write confirmation only while a Delay/Reverb toggle is pending.
 */
const DELAY_REVERB_SYNC_STATUS_PARAM_ID = kemperParamId(0x7c, 0x00);

/** Push sync is preferred once bidirectional lease + traffic are healthy. */
const PUSH_TRAFFIC_MAX_AGE_MS = 5000;
const PUSH_CONFIRM_WINDOW_MS = 800;
const RIG_CHANGE_REFRESH_DEBOUNCE_MS = 180;
const DEBUG_RIG_SWITCH_TIMING = false;
const SLOT_SELECTORS = [
  { key: "slot1", label: "Slot 1", cc: 50, value: 1 },
  { key: "slot2", label: "Slot 2", cc: 51, value: 1 },
  { key: "slot3", label: "Slot 3", cc: 52, value: 1 },
  { key: "slot4", label: "Slot 4", cc: 53, value: 1 },
  { key: "slot5", label: "Slot 5", cc: 54, value: 1 }
];
const MIDI_CHANNEL = 1;
const STATUS_CONTROL_CHANGE = 0xb0 + (MIDI_CHANNEL - 1);
const LIBRARY_SCAN_PERFORMANCE_COUNT = 125;
const SLOT_SETTLE_MS = 500;
const PERFORMANCE_ADVANCE_MS = 500;
const PERFORMANCE_SELECT_SETTLE_MS = 700;
const EFFECT_PUSH_CONFIRM_MS = 1200;
const DELAY_REVERB_STATUS_REFRESH_DEBOUNCE_MS = 75;
/** @type {Map<string, number>} Last Kemper on/off push timestamp per effect slot. */
const lastEffectOnOffPushAt = new Map();
/**
 * Pending effect writes awaiting Kemper push confirmation.
 * @type {Map<string, {
 *   expectedActive: boolean,
 *   expectedRaw: number,
 *   sentAt: number,
 *   parameterIdHex: string,
 *   resolve: (result: { status: string, kemperActive?: boolean, kemperRaw?: number | null }) => void,
 *   timer: ReturnType<typeof setTimeout>
 * }>}
 */
const pendingEffectWriteConfirmations = new Map();
/** @type {ReturnType<typeof setTimeout> | null} */
let delayReverbStatusRefreshTimer = null;
let delayReverbStatusRefreshInFlight = false;
let delayReverbStatusRefreshQueued = false;
const PERFORMANCE_LIBRARY_STORAGE_KEY = "kemper-performance-library";
const PERFORMANCE_LIBRARY_META_KEY = "_meta";
const PERFORMANCE_NAMES_KEY = "performanceNames";
const RIG_NOTES_SAVE_DEBOUNCE_MS = 800;
const CONTROL_CHANGES = {
  tapTempo: 30,
  tuner: 31,
  morph: 80
};
const TAP_TEMPO_BPM_MIN = 40;
const TAP_TEMPO_BPM_MAX = 300;
const EFFECT_TYPE_NAMES = {
  1: "Wah Wah",
  2: "Wah Low Pass",
  3: "Wah High Pass",
  4: "Wah Vowel Filter",
  6: "Wah Phaser",
  7: "Wah Flanger",
  8: "Wah Rate Reducer",
  9: "Wah Ring Modulator",
  10: "Wah Freq Shifter",
  11: "Pedal Pitch",
  12: "Formant Wah",
  17: "Bit Shaper",
  18: "Recti Shaper",
  19: "Soft Shaper",
  20: "Hard Shaper",
  21: "Wave Shaper",
  32: "Kemper Drive",
  33: "Green Scream",
  34: "Plus DS",
  35: "One DS",
  36: "Muffin",
  37: "Mouse",
  38: "Fuzz DS",
  39: "Metal DS",
  42: "Full OC",
  49: "Compressor",
  57: "Gate 2:1",
  58: "Gate 4:1",
  65: "Vintage Chorus",
  66: "Hyper Chorus",
  67: "Air Chorus",
  68: "Vibrato",
  69: "Rotary Speaker",
  70: "Tremolo",
  71: "Micro Pitch",
  81: "Phaser",
  82: "Phaser Vibe",
  83: "Phaser Oneway",
  89: "Flanger",
  91: "Flanger Oneway",
  97: "Graphic EQ",
  98: "Studio EQ",
  99: "Metal EQ",
  100: "Acoustic Simulator",
  101: "Stereo Widener",
  113: "Treble Booster",
  114: "Lead Booster",
  115: "Pure Booster",
  116: "Wah Pedal Booster",
  121: "Loop Mono",
  122: "Loop Stereo",
  123: "Loop Distortion",
  129: "Transpose",
  130: "Chromatic Pitch",
  131: "Harmonic Pitch",
  132: "Analog Octaver",
  138: "Dual Harmonic",
  139: "Dual Crystal",
  140: "Dual Loop Pitch",
  145: "Legacy Delay",
  146: "Single Delay",
  147: "Dual Delay",
  148: "Two Tap Delay",
  149: "Serial TwoTap Delay",
  150: "Crystal Delay",
  151: "Loop Pitch Delay",
  152: "Freq Shifter Delay",
  161: "Rhythm Delay",
  162: "Melody Chromatic",
  163: "Melody Harmonic",
  164: "Quad Delay",
  165: "Quad Chromatic",
  166: "Quad Harmonic",
  177: "Legacy Reverb",
  178: "Natural Reverb",
  179: "Easy Reverb",
  180: "Echo Reverb",
  181: "Cirrus Reverb",
  182: "Formant Reverb",
  183: "Ionosphere Reverb",
  193: "Spring Reverb"
};

// Bootstrap the learning registry with known names; live traffic grows it further.
seedEffectTypeNames(EFFECT_TYPE_NAMES);

const EFFECT_IMAGE_ALIASES = {
  "Kemper Drive": "kemper_drive.png",
  "Kemper Fuzz": "fuzz_face.png",
  "Fuzz DS": "fuzz_face.png",
  "Graphic Equalizer": "eq.png",
  "Graphic EQ": "eq.png",
  "Studio Equalizer": "eq.png",
  "Studio EQ": "eq.png",
  "Metal Equalizer": "eq.png",
  "Metal EQ": "eq.png",
  "Gate 2:1": "noise_gate.png",
  "Gate 4:1": "noise_gate.png",
  "Tube Bias Tremolo": "tremolo.png",
  "Phaser Vibe": "phaser_vibe.png",
  "Vibe Phaser": "phaser_vibe.png",
  "Vibrato": "vibrato.png",
  "Two Tap Delay": "single_delay.png",
  "Serial TwoTap Delay": "single_delay.png",
  "Legacy Delay": "tape_delay.png",
  "Dual Crystal": "micro_pitch+crytal_delay.png",
  "Dual Harmonic": "whammy.png",
  "Loop Pitch Delay": "whammy.png",
  "Freq Shifter Delay": "transpose.png",
  "Easy Reverb": "reverb.png",
  "Echo Reverb": "reverb.png",
  "Cirrus Reverb": "reverb.png",
  "Formant Reverb": "reverb.png",
  "Ionosphere Reverb": "shimmer_reverb.png",
  "Spring Reverb": "reverb.png",
  "Recti Shaper": "octafuzz.png"
};
const MODULE_FALLBACK_EFFECTS = {
  reverb: {
    name: "Reverb",
    image: "reverb.png"
  },
  delay: {
    name: "Delay",
    image: "single_delay.png"
  }
};
const MANUFACTURER_PATTERNS = [
  ["marshall", "Marshall"],
  ["jcm", "Marshall"],
  ["plexi", "Marshall"],
  ["jtm", "Marshall"],
  ["jvm", "Marshall"],
  ["mesa", "Mesa"],
  ["boogie", "Mesa"],
  ["rectifier", "Mesa"],
  ["mark iic", "Mesa"],
  ["fender", "Fender"],
  ["twin", "Fender"],
  ["deluxe", "Fender"],
  ["bassman", "Fender"],
  ["vox", "Vox"],
  ["ac30", "Vox"],
  ["ac15", "Vox"],
  ["orange", "Orange"],
  ["rockerverb", "Orange"],
  ["engl", "ENGL"],
  ["diezel", "Diezel"],
  ["vh4", "Diezel"],
  ["soldano", "Soldano"],
  ["slo", "Soldano"],
  ["5150", "Peavey"],
  ["6505", "Peavey"],
  ["bogner", "Bogner"],
  ["friedman", "Friedman"],
  ["bad cat", "Bad Cat"],
  ["hiwatt", "Hiwatt"],
  ["matchless", "Matchless"],
  ["dumble", "Dumble"],
  ["roland", "Roland"],
  ["jc-120", "Roland"]
];

const inputPort = document.querySelector("#inputPort");
const outputPort = document.querySelector("#outputPort");
const rigName = document.querySelector("#rigName");
const rigNamePrevButton = document.querySelector("#rigNamePrevButton");
const rigNameNextButton = document.querySelector("#rigNameNextButton");
const ampManufacturer = document.querySelector("#ampManufacturer");
const ampModel = document.querySelector("#ampModel");
const ampDetailsManufacturer = document.querySelector("#ampDetailsManufacturer");
const ampDetailsModel = document.querySelector("#ampDetailsModel");
const ampDetailsYear = document.querySelector("#ampDetailsYear");
const ampDetailsYearRow = document.querySelector("#ampDetailsYearRow");
const ampDetailsPower = document.querySelector("#ampDetailsPower");
const ampDetailsPowerRow = document.querySelector("#ampDetailsPowerRow");
const ampDetailsTubeConfiguration = document.querySelector(
  "#ampDetailsTubeConfiguration"
);
const ampDetailsTubeRow = document.querySelector("#ampDetailsTubeRow");
const rigAuthor = document.querySelector("#rigAuthor");
const ampDetailsOriginalRigName = document.querySelector("#ampDetailsOriginalRigName");
const ampDetailsOriginalAmpName = document.querySelector("#ampDetailsOriginalAmpName");
const productionYear = document.querySelector("#productionYear");
const cabinetSection = document.querySelector(".cabinet-section");
const ampDetailsSection = document.querySelector("#ampDetailsSection");
const effectsSection = document.querySelector("#effectsSection");
const ampSection = document.querySelector("#ampSection");
const rigCard = document.querySelector("#rigCard");
const liveViewMenuButton = document.querySelector("#liveViewMenuButton");
const liveViewMenuPanel = document.querySelector("#liveViewMenuPanel");
const ampOnlyExitButton = document.querySelector("#ampOnlyExitButton");
let liveViewController = null;
const rigNotesInput = document.querySelector("#rigNotesInput");
const cabinetComboLabel = document.querySelector("#cabinetComboLabel");
const cabinetRecognizedGroup = document.querySelector("[data-cabinet-recognized]");
const cabinetRecognizedList = document.querySelector("[data-cabinet-recognized-list]");
const cabinetReportedGroup = document.querySelector("[data-cabinet-reported]");
const cabinetReportedList = document.querySelector("[data-cabinet-reported-list]");
const gainScale = document.querySelector("#gainScale");
const gainScaleValue = document.querySelector("#gainScaleValue");
const gainScaleFill = document.querySelector("#gainScaleFill");
const gainScaleMarker = document.querySelector("#gainScaleMarker");
const gainScaleTicks = document.querySelector("#gainScaleTicks");
const tunerToggleButton = document.querySelector("#tunerToggleButton");
const morphActionButton = document.querySelector("#morphActionButton");
const tempoBpmInput = document.querySelector("#tempoBpmInput");
const tempoBpmStepButtons = document.querySelectorAll(".tempo-bpm-step");
const tempoSetButton = document.querySelector("#tempoSetButton");
const tempoTapButton = document.querySelector("#tempoTapButton");
const tempoCurrentValue = document.querySelector("#tempoCurrentValue");
const tempoPanelToggle = document.querySelector("#tempoPanelToggle");
const tempoPanelControls = document.querySelector("#tempoPanelControls");
const tempoPanel = document.querySelector(".tempo-status");
const effectsList = document.querySelector("#effectsList");
const performanceSection = document.querySelector("#performanceSection");
const performanceEmptyState = document.querySelector("#performanceEmptyState");
const performanceBrowserControls = document.querySelector("#performanceBrowserControls");
const performancePrevFastButton = document.querySelector("#performancePrevFastButton");
const performancePrevButton = document.querySelector("#performancePrevButton");
const performanceNextButton = document.querySelector("#performanceNextButton");
const performanceNextFastButton = document.querySelector("#performanceNextFastButton");
const performanceBrowserLabel = document.querySelector("#performanceBrowserLabel");
const performanceScanPanel = document.querySelector("#performanceScanPanel");
const performanceScanStatus = document.querySelector("#performanceScanStatus");
const performanceProgress = document.querySelector("#performanceProgress");
const performanceProgressFill = document.querySelector("#performanceProgressFill");
const performanceSlotGrid = document.querySelector("#performanceSlotGrid");
const performanceSlotIndicatorRow = document.querySelector("#performanceSlotIndicatorRow");
const performanceExplorerSection = document.querySelector("#performanceExplorerSection");
const performanceSearchZone = document.querySelector("#performanceSearchZone");
const performanceBrowserHeaderBar = document.querySelector("#performanceBrowserHeaderBar");
const performanceBrowserPanel = document.querySelector("#performanceBrowserPanel");
const performanceExplorerContent = document.querySelector("#performanceExplorerContent");
const performanceExplorerSearch = document.querySelector("#performanceExplorerSearch");
const performanceExplorerEmpty = document.querySelector("#performanceExplorerEmpty");
const performanceExplorerList = document.querySelector("#performanceExplorerList");
const createLibraryButton = document.querySelector("#createLibraryButton");
const performanceReloadButton = document.querySelector("#performanceReloadButton");
const libraryConfirmDialog = document.querySelector("#libraryConfirmDialog");
const cancelLibraryScanButton = document.querySelector("#cancelLibraryScanButton");
const startLibraryScanButton = document.querySelector("#startLibraryScanButton");
const errorStatus = document.querySelector("#errorStatus");
const liveStatus = document.querySelector("#liveStatus");
const ampImageContainer = document.querySelector("#ampImageContainer");
const cabinetImageContainer = document.querySelector("#cabinetImageContainer");
const bootLoadingOverlay = document.querySelector("#bootLoadingOverlay");
const noMidiOverlay = document.querySelector("#noMidiOverlay");
const noMidiReconnectButton = document.querySelector("#noMidiReconnectButton");
const livePage = document.querySelector("#livePage");
let midiAccess;
let isRefreshingLiveData = false;
let isCheckingRigName = false;
let currentRigName = "";
/** @type {string | null} Gear Library amp id for the currently loaded live amp */
let currentLiveAmpId = null;
let monitorTimer;

const CONNECTION_STATE = {
  BOOT_LOADING: "boot_loading",
  REFRESHING: "refreshing",
  NO_MIDI: "no_midi",
  CONNECTED: "connected"
};

function isConnectionOperational() {
  return (
    connectionState === CONNECTION_STATE.CONNECTED ||
    connectionState === CONNECTION_STATE.REFRESHING
  );
}
const liveStatusLabel = document.querySelector("#liveStatusLabel");
let connectionState = null;
let reconnectInProgress = false;
let connectionWatcher = null;
let consecutiveMonitorFailures = 0;
let performanceLibraryDocument = {};
/** Kempanion-only labels keyed by performance number; never sent to the Kemper. */
let performanceNames = {};
let slotNotes = {};
let rigNotesLegacy = {};
/** @type {string | null} Active slot note key (performanceIndex:slotIndex). */
let rigNotesSlotKey = null;
let rigNotesSaveTimer = null;
let performanceLibraryScanInProgress = false;
let isReloadingCurrentPerformance = false;
/** Confirmed slot (1–5) for the arrow under the Performance Browser; updated on successful load or external Kemper sync. */
let activePerformanceSlotIndex = 1;
/** Last performance index confirmed on the Kemper via loadBrowserPerformanceSlot MIDI. */
let kemperLoadedPerformanceIndex = null;
let selectedPerformanceIndex = null;
let performanceExplorerExpanded = false;
let isLoadingPerformanceSlot = false;
let isTogglingEffect = false;
let isTogglingTuner = false;
let isTriggeringMorph = false;
let isSettingTempo = false;
let tempoPanelExpanded = false;
let tunerActive = false;
let lastKnownEffectsByKey = {};
const MONITOR_FAILURE_LIMIT = 2;
const RECONNECT_INTERVAL_MS = 2000;
let initialBootComplete = false;
let bootPresentationComplete = false;

/** @type {number} */
let lastTempoPushAt = 0;
/** @type {number} */
let lastGainPushAt = 0;
let gainInteractionActive = false;
let gainDragPointerId = null;
/** @type {number | null} */
let gainLocalRawValue = null;
/** @type {number | null} */
let pendingGainWriteRaw = null;
/** @type {number | null} */
let gainWriteTimer = null;
const GAIN_WRITE_INTERVAL_MS = 40;
/** @type {ReturnType<typeof setTimeout> | null} */
let rigChangeRefreshTimer = null;
/** @type {Set<string>} */
const effectTypeEnrichInFlight = new Set();

function updateConnectionPresentation(state) {
  const isBootLoading = state === CONNECTION_STATE.BOOT_LOADING;
  const showBootOverlay = !bootPresentationComplete || isBootLoading;
  const isNoMidi = state === CONNECTION_STATE.NO_MIDI;
  const isLiveView = document.body.dataset.appView === "live";
  const isAppVisible =
    bootPresentationComplete &&
    isLiveView &&
    (state === CONNECTION_STATE.CONNECTED || state === CONNECTION_STATE.REFRESHING);

  if (bootLoadingOverlay) {
    bootLoadingOverlay.dataset.visible = showBootOverlay ? "true" : "false";
    bootLoadingOverlay.setAttribute("aria-hidden", showBootOverlay ? "false" : "true");
    bootLoadingOverlay.setAttribute("aria-busy", showBootOverlay ? "true" : "false");
  }

  if (noMidiOverlay) {
    noMidiOverlay.dataset.visible =
      isNoMidi && bootPresentationComplete && isLiveView ? "true" : "false";
    noMidiOverlay.setAttribute(
      "aria-hidden",
      isNoMidi && bootPresentationComplete && isLiveView ? "false" : "true"
    );
  }

  if (noMidiReconnectButton) {
    noMidiReconnectButton.disabled =
      showBootOverlay || reconnectInProgress || isRefreshingLiveData;
  }

  document.body.dataset.boot = showBootOverlay ? "loading" : "ready";
  document.body.dataset.connection = state ?? CONNECTION_STATE.BOOT_LOADING;

  if (livePage) {
    const showLivePage =
      bootPresentationComplete &&
      isLiveView &&
      (state === CONNECTION_STATE.CONNECTED ||
        state === CONNECTION_STATE.REFRESHING ||
        state === CONNECTION_STATE.NO_MIDI);
    livePage.setAttribute("aria-hidden", showLivePage ? "false" : "true");
  }
}

function completeInitialBoot() {
  if (initialBootComplete) return;

  initialBootComplete = true;
}

async function finishBootPresentation() {
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  bootPresentationComplete = true;
  updateConnectionPresentation(connectionState);
}

async function bootApplication() {
  setConnectionState(CONNECTION_STATE.BOOT_LOADING);

  try {
    await Promise.all([initializePerformanceLibrary(), loadPorts()]);
  } finally {
    if (
      !initialBootComplete &&
      (connectionState === CONNECTION_STATE.CONNECTED ||
        connectionState === CONNECTION_STATE.NO_MIDI)
    ) {
      completeInitialBoot();
    }

    await finishBootPresentation();

    if (connectionState === CONNECTION_STATE.NO_MIDI) {
      setAppView("gear");
    }
  }
}

function hasSelectablePorts() {
  return Boolean(midiAccess && inputPort.value && outputPort.value);
}

function setStatus(message, tone = "neutral") {
  if (!errorStatus) return;

  errorStatus.textContent = tone === "error" ? message : "";
  errorStatus.dataset.visible = tone === "error" ? "true" : "false";
}

function setConnectionState(state) {
  if (connectionState === state) return;

  connectionState = state;

  if (liveStatus) {
    liveStatus.dataset.state = state;
  }

  if (liveStatusLabel) {
    liveStatusLabel.textContent =
      state === CONNECTION_STATE.CONNECTED
        ? "CONNECTED"
        : state === CONNECTION_STATE.REFRESHING
          ? "REFRESHING"
          : state === CONNECTION_STATE.BOOT_LOADING
            ? "LOADING"
            : "NO MIDI";
  }

  updateConnectionPresentation(state);

  if (state !== CONNECTION_STATE.NO_MIDI) {
    setStatus("");
  }

  updateControlSectionControls();

  if (
    hasPerformanceLibrary(performanceLibraryDocument) &&
    state !== CONNECTION_STATE.REFRESHING
  ) {
    renderPerformanceBrowser();
  }
}

function updateControlSectionControls() {
  updateTunerControls();
  updateMorphControls();
  updateTempoControls();
}

function parseTempoBpmInput(value) {
  const parsed = Number(String(value ?? "").trim());

  if (!Number.isFinite(parsed)) return null;

  const rounded = Math.round(parsed);
  if (rounded < TAP_TEMPO_BPM_MIN || rounded > TAP_TEMPO_BPM_MAX) return null;

  return rounded;
}

function setTempoInputState(state = "idle") {
  if (!tempoBpmInput) return;

  tempoBpmInput.dataset.state = state;
}

function updateTempoControls() {
  const blocked =
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    isSettingTempo;

  if (tempoBpmInput) tempoBpmInput.disabled = blocked;
  tempoBpmStepButtons.forEach((button) => {
    button.disabled = blocked;
  });
  if (tempoSetButton) tempoSetButton.disabled = blocked;
  if (tempoTapButton) tempoTapButton.disabled = blocked || isSettingTempo;
}

function setTempoPanelExpanded(expanded) {
  tempoPanelExpanded = expanded;

  if (tempoPanel) {
    tempoPanel.dataset.expanded = expanded ? "true" : "false";
  }

  if (tempoPanelToggle) {
    tempoPanelToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  if (tempoPanelControls) {
    tempoPanelControls.hidden = !expanded;
  }
}

function renderCurrentTempo(rawValue) {
  if (!tempoCurrentValue) return;

  if (rawValue === null || rawValue === undefined) {
    tempoCurrentValue.textContent = "-";
    tempoCurrentValue.dataset.state = "unknown";
    return;
  }

  tempoCurrentValue.textContent = `${Math.round(rawValue / 64)} BPM`;
  tempoCurrentValue.dataset.state = "ok";
}

function adjustTempoBpmInput(delta) {
  if (!tempoBpmInput || tempoBpmInput.disabled) return;

  const parsed = parseTempoBpmInput(tempoBpmInput.value);
  const base = parsed ?? 120;
  const next = Math.min(TAP_TEMPO_BPM_MAX, Math.max(TAP_TEMPO_BPM_MIN, base + delta));

  tempoBpmInput.value = String(next);

  if (tempoBpmInput.dataset.state === "error") {
    setTempoInputState("idle");
    setStatus("");
  }
}

function canUseBidirectionalPushSync() {
  return (
    bidirectionalDiscovery.isBidirectionalModeActive() &&
    bidirectionalDiscovery.isReceivingTraffic(PUSH_TRAFFIC_MAX_AGE_MS)
  );
}

function wasPushedRecently(timestamp, windowMs = PUSH_CONFIRM_WINDOW_MS) {
  return Boolean(timestamp) && Date.now() - timestamp <= windowMs;
}

async function refreshTempoOnly({ force = false } = {}) {
  if (
    !isConnectionOperational() ||
    isSettingTempo ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot
  ) {
    return;
  }

  if (!force && canUseBidirectionalPushSync() && wasPushedRecently(lastTempoPushAt)) {
    return;
  }

  try {
    const tempoRaw = await requestNumericParam(NUMERIC_PARAMS.tempoBpm);
    renderCurrentTempo(tempoRaw);
  } catch {
    // silent
  }
}

async function sendManualTapTempo() {
  if (
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    isSettingTempo
  ) {
    return;
  }

  try {
    const { output } = await getMidiPorts();
    sendMidiSafe(output, makeTapTempoCommand(), "Manual Tap Tempo");
    await delay(350);
    await refreshTempoOnly({ force: !wasPushedRecently(lastTempoPushAt) });
  } catch (error) {
    console.warn("[Live Companion] Manual tap tempo failed:", error.message || error);
  }
}

async function setTempoBpm(bpm) {
  if (
    isSettingTempo ||
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot
  ) {
    return;
  }

  const validatedBpm = parseTempoBpmInput(bpm);
  if (validatedBpm === null) {
    setTempoInputState("error");
    setStatus(`Bitte einen BPM-Wert zwischen ${TAP_TEMPO_BPM_MIN} und ${TAP_TEMPO_BPM_MAX} eingeben.`, "error");
    return;
  }

  setTempoInputState("idle");
  setStatus("");

  isSettingTempo = true;
  updateControlSectionControls();

  if (tempoSetButton) {
    tempoSetButton.dataset.state = "sending";
    tempoSetButton.textContent = "Sending…";
  }

  try {
    // Ensure MIDI ports / bidirectional lease are active before SysEx write.
    await getMidiPorts();
    const tempoControl = parameterService.get(CONTROL_PARAMETERS.tempo.key);
    if (!tempoControl) {
      throw new Error("Tempo parameter binding missing");
    }
    const result = await tempoControl.writeScaled(validatedBpm);

    if (!result.ok) {
      throw new Error(result.error || "Tempo SysEx write failed");
    }

    // Optimistic UI; Kemper push remains source of truth.
    renderCurrentTempo(result.rawValue);

    await delay(350);
    await refreshTempoOnly({ force: !wasPushedRecently(lastTempoPushAt) });
  } catch (error) {
    console.warn("[Live Companion] Tempo set failed:", error.message || error);
    setStatus("Tempo konnte nicht gesetzt werden.", "error");
  } finally {
    isSettingTempo = false;

    if (tempoSetButton) {
      tempoSetButton.dataset.state = "idle";
      tempoSetButton.textContent = "Set";
    }

    updateControlSectionControls();
  }
}

async function handleTempoSetRequest() {
  await setTempoBpm(tempoBpmInput?.value);
}

function setTunerMode(isActive) {
  tunerActive = Boolean(isActive);

  if (!tunerToggleButton) return;

  tunerToggleButton.dataset.state = tunerActive ? "on" : "off";
  tunerToggleButton.setAttribute("aria-pressed", tunerActive ? "true" : "false");
  tunerToggleButton.setAttribute("aria-label", tunerActive ? "Tuner schließen" : "Tuner öffnen");
}

function updateTunerControls() {
  if (!tunerToggleButton) return;

  tunerToggleButton.disabled =
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    isTogglingTuner;
}

const MORPH_PRESS_MS = 80;
const MORPH_FLASH_MS = 360;
const MORPH_GAIN_READ_DELAY_MS = 500;
const GAIN_SCALE_MAX = 10;
const GAIN_SCALE_TICK_COUNT = 101;

function updateMorphControls() {
  if (!morphActionButton) return;

  morphActionButton.disabled =
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    isTriggeringMorph;
}

async function triggerMorphAction() {
  if (
    isTriggeringMorph ||
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot
  ) {
    return;
  }

  isTriggeringMorph = true;
  morphActionButton?.classList.add("is-flashing");
  updateControlSectionControls();

  try {
    const { output } = await getMidiPorts();
    const pressed = sendMidiSafe(output, makeMorphPressCommand(), "Morph Press");

    if (pressed) {
      await delay(MORPH_PRESS_MS);
      sendMidiSafe(output, makeMorphReleaseCommand(), "Morph Release");
      await refreshGainAfterMorph();
    }
  } catch (error) {
    console.warn("[Live Companion] Morph action failed:", error.message || error);
  } finally {
    window.setTimeout(() => {
      morphActionButton?.classList.remove("is-flashing");
      isTriggeringMorph = false;
      updateControlSectionControls();
    }, MORPH_FLASH_MS);
  }
}

async function toggleTuner() {
  if (
    isTogglingTuner ||
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot
  ) {
    return;
  }

  const wasActive = tunerActive;
  const nextActive = !wasActive;

  isTogglingTuner = true;
  setTunerMode(nextActive);
  updateControlSectionControls();

  try {
    const { output } = await getMidiPorts();
    const sent = sendMidiSafe(
      output,
      makeTunerToggleCommand(wasActive),
      wasActive ? "Close Tuner" : "Open Tuner"
    );

    if (!sent) {
      setTunerMode(wasActive);
    }
  } catch (error) {
    setTunerMode(wasActive);
    console.warn("[Live Companion] Tuner toggle failed:", error.message || error);
  } finally {
    isTogglingTuner = false;
    updateControlSectionControls();
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function logRigSwitchTiming(phase, startMs, detail = "") {
  if (!DEBUG_RIG_SWITCH_TIMING) return;
  const elapsedMs = performance.now() - startMs;
  const suffix = detail ? ` (${detail})` : "";
  console.info(`[RigSwitchTiming] ${phase}: ${elapsedMs.toFixed(1)}ms${suffix}`);
}

function makeControlChange(controller, value) {
  return [STATUS_CONTROL_CHANGE, controller & 0x7f, value & 0x7f];
}

function makeSlotSelectCommand(slot) {
  return makeControlChange(slot.cc, slot.value);
}

function makePerformanceSelectCommand(performanceIndex) {
  return makeControlChange(47, performanceIndex & 0x7f);
}

function makeRigNextCommand() {
  return makeControlChange(48, 0);
}

function makeOpenTunerCommand() {
  return makeControlChange(CONTROL_CHANGES.tuner, 1);
}

function makeCloseTunerCommand() {
  return makeControlChange(CONTROL_CHANGES.tuner, 0);
}

function makeTunerToggleCommand(isActive) {
  return isActive ? makeCloseTunerCommand() : makeOpenTunerCommand();
}

function makeMorphPressCommand() {
  return makeControlChange(CONTROL_CHANGES.morph, 1);
}

function makeMorphReleaseCommand() {
  return makeControlChange(CONTROL_CHANGES.morph, 0);
}

function makeTapTempoCommand() {
  return makeControlChange(CONTROL_CHANGES.tapTempo, 0);
}

function sendMidi(output, bytes) {
  output.send(bytes);
}

function sendMidiSafe(output, bytes, label) {
  try {
    sendMidi(output, bytes);
    return true;
  } catch (error) {
    console.warn(`[Live Companion] MIDI send failed for ${label}:`, error.message || error);
    return false;
  }
}

async function resetToFirstPerformance(output, contextLabel) {
  console.info(`[Live Companion] ${contextLabel}: selecting Performance 1 Slot 1.`);
  sendMidiSafe(output, makePerformanceSelectCommand(0), `${contextLabel} Performance 1 preselect`);
  await delay(PERFORMANCE_SELECT_SETTLE_MS);
  sendMidiSafe(output, makeSlotSelectCommand(SLOT_SELECTORS[0]), `${contextLabel} Slot 1 load`);
  await delay(SLOT_SETTLE_MS);
}

async function invokeTauri(command, args = {}) {
  try {
    return await invoke(command, args);
  } catch (error) {
    console.warn(`[Live Companion] Tauri invoke ${command} unavailable:`, error.message || error);
    return null;
  }
}

function createEmptyLibraryDocument(originalRigNameAtStart = "") {
  return {
    [PERFORMANCE_LIBRARY_META_KEY]: {
      version: 1,
      scanStartedAt: new Date().toISOString(),
      lastSavedAt: null,
      originalRigNameAtStart,
      completedPerformances: 0,
      scanInProgress: true,
      scanComplete: false
    }
  };
}

function getPerformanceEntries(document = {}) {
  return Object.fromEntries(
    Object.entries(document || {}).filter(([key]) => /^\d+$/.test(key))
  );
}

/**
 * Normalizes a performance slot entry (legacy rig-name string or scan object).
 * @param {unknown} slotValue
 * @returns {{ rigName: string, ampName: string, ampManufacturer: string, ampModel: string, ampId: string | null }}
 */
function normalizePerformanceSlotRecord(slotValue) {
  if (typeof slotValue === "string") {
    return {
      rigName: slotValue.trim(),
      ampName: "",
      ampManufacturer: "",
      ampModel: "",
      ampId: null
    };
  }

  if (slotValue && typeof slotValue === "object") {
    const record = /** @type {Record<string, unknown>} */ (slotValue);
    const ampId = record.ampId;
    return {
      rigName: String(record.rigName ?? "").trim(),
      ampName: String(record.ampName ?? "").trim(),
      ampManufacturer: String(record.ampManufacturer ?? "").trim(),
      ampModel: String(record.ampModel ?? "").trim(),
      ampId: typeof ampId === "string" && ampId.trim() ? ampId.trim() : null
    };
  }

  return {
    rigName: "",
    ampName: "",
    ampManufacturer: "",
    ampModel: "",
    ampId: null
  };
}

/** @param {unknown} slotValue */
function getPerformanceSlotRigName(slotValue) {
  return normalizePerformanceSlotRecord(slotValue).rigName;
}

function enrichPerformanceSlotWithAmpMatch(slotEntry) {
  const resolvedAmp = resolveLiveAmpRecord(
    slotEntry.rigName,
    slotEntry.ampName,
    slotEntry.ampManufacturer,
    slotEntry.ampModel
  );

  const nextSlot = {
    rigName: slotEntry.rigName,
    ampName: slotEntry.ampName,
    ampManufacturer: slotEntry.ampManufacturer,
    ampModel: slotEntry.ampModel
  };

  if (resolvedAmp?.id) {
    nextSlot.ampId = resolvedAmp.id;
  }

  return nextSlot;
}

function applyAmpMatchingToPerformanceSlots(performanceData) {
  for (const slotKey of Object.keys(performanceData)) {
    const normalized = normalizePerformanceSlotRecord(performanceData[slotKey]);
    performanceData[slotKey] = enrichPerformanceSlotWithAmpMatch({
      rigName: normalized.rigName,
      ampName: normalized.ampName,
      ampManufacturer: normalized.ampManufacturer,
      ampModel: normalized.ampModel
    });
  }

  return performanceData;
}

function applyAmpMatchingToPerformanceLibrary(library) {
  const entries = getPerformanceEntries(library);

  for (const slots of Object.values(entries)) {
    if (!slots || typeof slots !== "object") continue;
    applyAmpMatchingToPerformanceSlots(slots);
  }
}

function resolveActiveSlotIndexForPerformance(performanceIndex) {
  if (
    String(selectedPerformanceIndex) === String(performanceIndex) &&
    activePerformanceSlotIndex >= 1 &&
    activePerformanceSlotIndex <= SLOT_SELECTORS.length
  ) {
    return activePerformanceSlotIndex;
  }

  const slots = getPerformanceEntries(performanceLibraryDocument)[String(performanceIndex)] || {};
  const currentRig = String(currentRigName || "").trim();

  if (currentRig) {
    for (let slotIndex = 1; slotIndex <= SLOT_SELECTORS.length; slotIndex += 1) {
      if (getPerformanceSlotRigName(slots[String(slotIndex)]) === currentRig) {
        return slotIndex;
      }
    }
  }

  return 1;
}

function updatePerformanceReloadButtonState() {
  if (!performanceReloadButton) return;

  const hasLibrary = hasPerformanceLibrary(performanceLibraryDocument);
  const showLibraryUi = hasLibrary && !performanceLibraryScanInProgress;
  performanceReloadButton.hidden = !showLibraryUi;

  performanceReloadButton.disabled =
    !showLibraryUi ||
    !isConnectionOperational() ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    isReloadingCurrentPerformance;
}

function countSavedPerformances(document = {}) {
  return Object.keys(getPerformanceEntries(document)).length;
}

function hasPerformanceLibrary(document = {}) {
  return countSavedPerformances(document) > 0;
}

function normalizePerformanceNames(value) {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, name]) => /^\d+$/.test(key) && typeof name === "string" && name.trim())
      .map(([key, name]) => [key, name.trim()])
  );
}

function getPerformanceName(performanceIndex) {
  return performanceNames[String(performanceIndex)] || "";
}

function formatPerformanceLabel(performanceIndex) {
  const name = getPerformanceName(performanceIndex);
  return name ? `Performance ${performanceIndex} · ${name}` : `Performance ${performanceIndex}`;
}

function applySlotNotesToLibraryDocument(document) {
  if (Object.keys(slotNotes).length > 0) {
    document[SLOT_NOTES_KEY] = { ...slotNotes };
  } else {
    delete document[SLOT_NOTES_KEY];
  }

  delete document[LEGACY_RIG_NOTES_KEY];

  if (Object.keys(rigNotesLegacy).length > 0) {
    document[RIG_NOTES_LEGACY_UNMAPPED_KEY] = { ...rigNotesLegacy };
  } else {
    delete document[RIG_NOTES_LEGACY_UNMAPPED_KEY];
  }
}

async function loadPerformanceLibraryDocument() {
  const document = await readPerformanceLibraryDocument();
  performanceNames = normalizePerformanceNames(document?.[PERFORMANCE_NAMES_KEY]);
  const performanceEntries = getPerformanceEntries(document);
  const hydrated = hydrateSlotNotesFromDocument(document, performanceEntries);
  slotNotes = hydrated.slotNotes;
  rigNotesLegacy = hydrated.rigNotesLegacy;

  if (hydrated.migratedFromRigNames > 0) {
    applySlotNotesToLibraryDocument(document);
    await savePerformanceLibraryDocument(document);
  }

  return document;
}

async function readPerformanceLibraryDocument() {
  const fromTauri = await invokeTauri("load_performance_library");

  if (typeof fromTauri === "string") {
    try {
      return JSON.parse(fromTauri || "{}");
    } catch (error) {
      console.warn("[Live Companion] Invalid performance library JSON on disk:", error.message || error);
    }
  }

  try {
    const raw = window.localStorage.getItem(PERFORMANCE_LIBRARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function savePerformanceLibraryDocument(document) {
  document[PERFORMANCE_LIBRARY_META_KEY] = {
    ...document[PERFORMANCE_LIBRARY_META_KEY],
    lastSavedAt: new Date().toISOString()
  };

  // A rescan starts from an empty document; names must survive it.
  if (Object.keys(performanceNames).length > 0) {
    document[PERFORMANCE_NAMES_KEY] = { ...performanceNames };
  } else {
    delete document[PERFORMANCE_NAMES_KEY];
  }

  applySlotNotesToLibraryDocument(document);

  const serialized = JSON.stringify(document, null, 2);
  const fromTauri = await invokeTauri("save_performance_library", { contents: serialized });

  if (fromTauri === null) {
    window.localStorage.setItem(PERFORMANCE_LIBRARY_STORAGE_KEY, serialized);
  }

  return document;
}

function setPerformanceProgress({ savedCount = 0, totalPerformances = LIBRARY_SCAN_PERFORMANCE_COUNT } = {}) {
  const percent = totalPerformances
    ? Math.max(0, Math.min(100, (savedCount / totalPerformances) * 100))
    : 0;

  if (performanceProgressFill) {
    performanceProgressFill.style.width = `${percent}%`;
  }
}

function setPerformanceScanPanelVisible(visible) {
  if (performanceScanPanel) {
    performanceScanPanel.hidden = !visible;
  }

  if (performanceScanStatus) {
    performanceScanStatus.hidden = !visible;
    performanceScanStatus.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  if (!visible) {
    setPerformanceProgress({ savedCount: 0 });
  }
}

function setPerformanceScanStatus(message, state = "loading") {
  if (!performanceScanStatus) return;

  performanceScanStatus.textContent = message;
  performanceScanStatus.dataset.state = state;
}

function getPerformanceIndexList(document = performanceLibraryDocument) {
  return Object.keys(getPerformanceEntries(document)).sort(
    (left, right) => Number(left) - Number(right)
  );
}

function normalizeExplorerQuery(query) {
  return String(query || "").trim().toLowerCase();
}

/** @param {unknown} slotValue */
function getPerformanceSlotSearchTexts(slotValue) {
  const record = normalizePerformanceSlotRecord(slotValue);
  const texts = [
    record.rigName,
    record.ampName,
    record.ampManufacturer,
    record.ampModel,
    record.ampId || ""
  ];

  if (record.ampId) {
    const atlasAmp = getAmpById(record.ampId);
    if (atlasAmp) {
      texts.push(
        atlasAmp.manufacturer,
        atlasAmp.model,
        atlasAmp.id,
        ...(atlasAmp.aliases || [])
      );
    }
  }

  return texts
    .map((text) => String(text || "").trim().toLowerCase())
    .filter(Boolean);
}

/** @param {unknown} slotValue @param {number} slotIndex @param {string} query */
function performanceSlotMatchesExplorerQuery(slotValue, slotIndex, query) {
  const slotLabel = `slot ${slotIndex}`;
  if (slotLabel.includes(query)) return true;

  return getPerformanceSlotSearchTexts(slotValue).some((text) => text.includes(query));
}

function performanceMatchesExplorerQuery(performanceIndex, slots, query) {
  if (!query) return true;

  if (String(performanceIndex).includes(query)) return true;

  const performanceLabel = `performance ${performanceIndex}`;
  if (performanceLabel.includes(query)) return true;

  if (getPerformanceName(performanceIndex).toLowerCase().includes(query)) return true;

  return SLOT_SELECTORS.some((slot, index) => {
    const slotIndex = index + 1;
    return performanceSlotMatchesExplorerQuery(slots[String(slotIndex)], slotIndex, query);
  });
}

function createExplorerMark(text) {
  const mark = document.createElement("mark");
  mark.className = "performance-explorer-mark";
  mark.textContent = text;
  return mark;
}

function appendExplorerHighlightedText(container, text, query) {
  const normalizedText = String(text || "");
  container.textContent = "";

  if (!query) {
    container.textContent = normalizedText;
    return;
  }

  const lowerText = normalizedText.toLowerCase();
  const matchIndex = lowerText.indexOf(query);

  if (matchIndex === -1) {
    container.textContent = normalizedText;
    return;
  }

  container.append(
    document.createTextNode(normalizedText.slice(0, matchIndex)),
    createExplorerMark(normalizedText.slice(matchIndex, matchIndex + query.length)),
    document.createTextNode(normalizedText.slice(matchIndex + query.length))
  );
}

function setPerformanceExplorerExpanded(expanded) {
  performanceExplorerExpanded = expanded;

  if (performanceExplorerSearch) {
    performanceExplorerSearch.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  if (performanceExplorerContent) {
    performanceExplorerContent.hidden = !expanded;
  }

  if (performanceSection) {
    performanceSection.dataset.explorerExpanded = expanded ? "true" : "false";
  }

  liveViewController?.syncEffectsTriColumnLayout?.();
  syncCreateLibraryButtonVisibility();

  if (expanded) {
    renderPerformanceExplorer();
  }
}

function syncCreateLibraryButtonVisibility() {
  if (!createLibraryButton) return;

  const hasLibrary = hasPerformanceLibrary(performanceLibraryDocument);

  if (!hasLibrary) {
    createLibraryButton.hidden = false;
    return;
  }

  createLibraryButton.hidden = !(performanceExplorerExpanded || performanceLibraryScanInProgress);
}

function isPerformanceExplorerEventTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("#performanceBrowserHeaderBar") ||
    target.closest("#performanceBrowserPanel") ||
    target.closest("#createLibraryButton")
  );
}

function isPerformanceBrowserEntrySurfaceTarget(target) {
  if (!(target instanceof Element)) return false;
  if (!livePage?.contains(target)) return false;

  return Boolean(
    target.closest("#livePage .title-panel") || target.closest("#performanceSection")
  );
}

function isPerformanceBrowserEntryInteractiveException(target) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest("#gearAtlasSwitcher") ||
    target.closest(".gear-atlas-switcher") ||
    target.closest(".title-brand") ||
    target.closest("#errorStatus") ||
    target.closest("#performanceBrowserControls") ||
    target.closest(".performance-browser-nav") ||
    target.closest("#performanceSlotGrid") ||
    target.closest("#performanceReloadButton") ||
    target.closest("#performanceBrowserLabel") ||
    target.closest("#performanceExplorerSearch") ||
    target.closest("#createLibraryButton") ||
    target.closest("#performanceExplorerContent") ||
    target.closest("#performanceScanPanel") ||
    target.closest("button") ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("textarea") ||
    target.closest("a[href]")
  );
}

function activatePerformanceBrowserEntry() {
  if (!hasPerformanceLibrary(performanceLibraryDocument)) return;

  setPerformanceExplorerExpanded(true);

  if (performanceExplorerSearch && !performanceExplorerSection?.hidden) {
    performanceExplorerSearch.focus({ preventScroll: true });
  }
}

function updatePerformanceSectionLayout() {
  const hasLibrary = hasPerformanceLibrary(performanceLibraryDocument);
  const showLibraryUi = hasLibrary && !performanceLibraryScanInProgress;

  if (performanceBrowserHeaderBar) {
    performanceBrowserHeaderBar.hidden = !showLibraryUi;
  }

  if (performanceSearchZone) {
    performanceSearchZone.hidden = !showLibraryUi;
  }

  if (performanceBrowserPanel) {
    performanceBrowserPanel.hidden = !showLibraryUi;
  }

  if (performanceExplorerSection) {
    performanceExplorerSection.hidden = !showLibraryUi;
  }

  if (!showLibraryUi) {
    if (performanceExplorerContent) {
      performanceExplorerContent.hidden = true;
    }
    performanceExplorerExpanded = false;
    if (performanceExplorerSearch) {
      performanceExplorerSearch.setAttribute("aria-expanded", "false");
    }
    if (performanceSection) {
      performanceSection.dataset.explorerExpanded = "false";
    }
    syncCreateLibraryButtonVisibility();
    return;
  }

  if (performanceExplorerContent) {
    performanceExplorerContent.hidden = !performanceExplorerExpanded;
  }

  syncCreateLibraryButtonVisibility();

  if (performanceExplorerExpanded) {
    renderPerformanceExplorer();
  }
}

function setPerformanceExplorerSlotState(performanceIndex, slotIndex, state) {
  if (!performanceExplorerList) return;

  const targetPerformance = performanceIndex !== null ? String(performanceIndex) : null;
  const targetSlot = slotIndex !== null ? String(slotIndex) : null;

  performanceExplorerList.querySelectorAll(".performance-explorer-slot").forEach((chip) => {
    const isTarget =
      targetPerformance !== null &&
      targetSlot !== null &&
      chip.dataset.performanceIndex === targetPerformance &&
      chip.dataset.slotIndex === targetSlot;

    if (state === "loading") {
      chip.disabled = true;
      chip.dataset.state = isTarget ? "loading" : "disabled";
      return;
    }

    if (state === "success" && isTarget) {
      chip.dataset.state = "success";
      chip.disabled = true;
      return;
    }

    chip.disabled =
      performanceLibraryScanInProgress ||
      isLoadingPerformanceSlot ||
      !isConnectionOperational();
    chip.dataset.state = "idle";
  });
}

function renderPerformanceExplorer() {
  if (!performanceExplorerList) return;

  const query = normalizeExplorerQuery(performanceExplorerSearch?.value || "");
  performanceExplorerList.innerHTML = "";

  if (!hasPerformanceLibrary(performanceLibraryDocument)) {
    if (performanceExplorerEmpty) performanceExplorerEmpty.hidden = true;
    return;
  }

  const entries = getPerformanceEntries(performanceLibraryDocument);
  const indexes = getPerformanceIndexList();
  let visibleCount = 0;

  indexes.forEach((performanceIndex) => {
    const slots = entries[performanceIndex] || {};

    if (!performanceMatchesExplorerQuery(performanceIndex, slots, query)) return;

    visibleCount += 1;

    const row = document.createElement("div");
    row.className = "performance-explorer-row";
    row.dataset.performanceIndex = performanceIndex;
    row.setAttribute("role", "listitem");

    if (String(selectedPerformanceIndex) === String(performanceIndex)) {
      row.dataset.selected = "true";
    }

    const label = document.createElement("div");
    label.className = "performance-explorer-row-label";
    label.title = formatPerformanceLabel(performanceIndex);

    const indexSpan = document.createElement("span");
    indexSpan.className = "performance-explorer-row-index";
    const indexMatchesQuery =
      Boolean(query) &&
      (String(performanceIndex).includes(query) ||
        `performance ${performanceIndex}`.includes(query));
    appendExplorerHighlightedText(indexSpan, String(performanceIndex), indexMatchesQuery ? query : "");

    const nameHost = document.createElement("span");
    nameHost.className = "performance-explorer-row-name";
    nameHost.dataset.performanceIndex = String(performanceIndex);
    nameHost.setAttribute("role", "button");
    nameHost.tabIndex = 0;
    updateExplorerPerformanceNameDisplay(nameHost, performanceIndex, query);
    bindExplorerPerformanceNameHost(nameHost, performanceIndex);

    label.append(indexSpan, nameHost);

    const slotsWrap = document.createElement("div");
    slotsWrap.className = "performance-explorer-slots";

    SLOT_SELECTORS.forEach((slot, index) => {
      const slotIndex = index + 1;
      const slotRecord = normalizePerformanceSlotRecord(slots[String(slotIndex)]);
      const rigName = slotRecord.rigName || "Keine Antwort";
      const chip = document.createElement("button");
      const name = document.createElement("span");

      chip.type = "button";
      chip.className = "performance-explorer-slot";
      chip.dataset.performanceIndex = performanceIndex;
      chip.dataset.slotIndex = String(slotIndex);
      chip.dataset.state = "idle";
      chip.disabled =
        !isConnectionOperational() ||
        performanceLibraryScanInProgress ||
        isLoadingPerformanceSlot;

      if (Boolean(query) && performanceSlotMatchesExplorerQuery(slots[String(slotIndex)], slotIndex, query)) {
        chip.dataset.match = "true";
      }

      const thumbSrc = slotRecord.ampId ? getAmpPerformanceThumbnail(slotRecord.ampId) : null;
      if (thumbSrc) {
        const thumb = document.createElement("img");
        thumb.className = "performance-explorer-slot-thumb";
        thumb.src = thumbSrc;
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.decoding = "async";
        thumb.addEventListener("error", () => {
          thumb.remove();
        });
        chip.append(thumb);
      }

      name.className = "performance-explorer-slot-name";
      appendExplorerHighlightedText(name, rigName, query);
      chip.append(name);
      chip.setAttribute("aria-label", `Performance ${performanceIndex}, Slot ${slotIndex}: ${rigName}`);
      slotsWrap.append(chip);
    });

    row.append(label, slotsWrap);
    performanceExplorerList.append(row);
  });

  if (performanceExplorerEmpty) {
    performanceExplorerEmpty.hidden = visibleCount > 0 || !query;
  }
}

async function selectExplorerPerformanceSlot(performanceIndex, slotIndex) {
  selectedPerformanceIndex = String(performanceIndex);
  renderPerformanceBrowser();
  await loadBrowserPerformanceSlot(performanceIndex, slotIndex);
  renderPerformanceExplorer();
}

function getSelectedPerformanceData() {
  const entries = getPerformanceEntries(performanceLibraryDocument);
  const indexes = getPerformanceIndexList();

  if (indexes.length === 0) return null;

  const performanceIndex =
    selectedPerformanceIndex && entries[String(selectedPerformanceIndex)]
      ? String(selectedPerformanceIndex)
      : indexes[0];

  return {
    performanceIndex,
    slots: entries[performanceIndex] || {},
    libraryCount: indexes.length
  };
}

function selectPerformanceByOffset(offset) {
  const indexes = getPerformanceIndexList();
  if (indexes.length === 0 || isLoadingPerformanceSlot || offset === 0) return;

  const currentIndex = getSelectedPerformanceData()?.performanceIndex || indexes[0];
  const currentPosition = indexes.indexOf(String(currentIndex));
  const nextPosition = Math.max(0, Math.min(indexes.length - 1, currentPosition + offset));

  if (nextPosition === currentPosition) return;

  selectedPerformanceIndex = indexes[nextPosition];
  renderPerformanceBrowser();
}

function selectAdjacentPerformance(direction) {
  selectPerformanceByOffset(direction);
}

function resolveKemperRigSlotMatch() {
  const currentRig = String(currentRigName || "").trim();
  if (!currentRig || !hasPerformanceLibrary(performanceLibraryDocument)) return null;

  const entries = getPerformanceEntries(performanceLibraryDocument);
  const indexes = getPerformanceIndexList();
  const matches = [];

  for (const performanceIndex of indexes) {
    const slots = entries[String(performanceIndex)] || {};
    for (let slotIndex = 1; slotIndex <= SLOT_SELECTORS.length; slotIndex += 1) {
      if (getPerformanceSlotRigName(slots[String(slotIndex)]) === currentRig) {
        matches.push({
          performanceIndex: String(performanceIndex),
          slotIndex
        });
      }
    }
  }

  if (matches.length === 1) return matches[0];
  return null;
}

function syncPerformanceBrowserWithKemperRigMatch() {
  const currentRig = String(currentRigName || "").trim();
  if (
    !currentRig ||
    !hasPerformanceLibrary(performanceLibraryDocument) ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot
  ) {
    updatePerformanceSlotActiveIndicators();
    return;
  }

  const match = resolveKemperRigSlotMatch();
  if (!match) {
    updatePerformanceSlotActiveIndicators();
    return;
  }

  const nextPerformanceIndex = String(match.performanceIndex);
  const nextSlotIndex = match.slotIndex;
  const selectionChanged =
    String(selectedPerformanceIndex) !== nextPerformanceIndex ||
    activePerformanceSlotIndex !== nextSlotIndex;

  selectedPerformanceIndex = nextPerformanceIndex;
  activePerformanceSlotIndex = nextSlotIndex;

  if (selectionChanged) {
    renderPerformanceBrowser();
  } else {
    updatePerformanceSlotActiveIndicators();
  }
}

function buildRigNavigationSequence() {
  const indexes = getPerformanceIndexList();
  const sequence = [];

  for (const performanceIndex of indexes) {
    for (let slotIndex = 1; slotIndex <= SLOT_SELECTORS.length; slotIndex += 1) {
      sequence.push({
        performanceIndex: String(performanceIndex),
        slotIndex
      });
    }
  }

  return sequence;
}

function resolveRigNavigationPosition() {
  const kemperMatch = resolveKemperRigSlotMatch();
  if (kemperMatch) return kemperMatch;

  const selected = getSelectedPerformanceData();
  if (!selected) return null;

  const slotIndex =
    activePerformanceSlotIndex >= 1 && activePerformanceSlotIndex <= SLOT_SELECTORS.length
      ? activePerformanceSlotIndex
      : 1;

  return {
    performanceIndex: String(selected.performanceIndex),
    slotIndex
  };
}

function findRigNavigationIndex(sequence, position) {
  if (!position) return -1;

  return sequence.findIndex(
    (entry) =>
      String(entry.performanceIndex) === String(position.performanceIndex) &&
      entry.slotIndex === position.slotIndex
  );
}

async function selectAdjacentRigSlot(direction) {
  if (
    direction === 0 ||
    isLoadingPerformanceSlot ||
    performanceLibraryScanInProgress ||
    isReloadingCurrentPerformance ||
    !hasPerformanceLibrary(performanceLibraryDocument)
  ) {
    return;
  }

  const sequence = buildRigNavigationSequence();
  if (sequence.length === 0) return;

  const currentIndex = findRigNavigationIndex(sequence, resolveRigNavigationPosition());
  if (currentIndex === -1) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= sequence.length) return;

  const next = sequence[nextIndex];
  await loadBrowserPerformanceSlot(next.performanceIndex, next.slotIndex);
}

function updateRigNameNavButtons() {
  const blocked =
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    isReloadingCurrentPerformance ||
    !isConnectionOperational() ||
    !hasPerformanceLibrary(performanceLibraryDocument);

  if (rigNamePrevButton) {
    rigNamePrevButton.disabled = true;
  }
  if (rigNameNextButton) {
    rigNameNextButton.disabled = true;
  }

  if (blocked) return;

  const sequence = buildRigNavigationSequence();
  if (sequence.length === 0) return;

  const currentIndex = findRigNavigationIndex(sequence, resolveRigNavigationPosition());
  if (currentIndex === -1) return;

  if (rigNamePrevButton) {
    rigNamePrevButton.disabled = currentIndex <= 0;
  }
  if (rigNameNextButton) {
    rigNameNextButton.disabled = currentIndex >= sequence.length - 1;
  }
}

let performanceSlotIndicatorLayoutGeneration = 0;

function applyPerformanceSlotActiveIndicatorPosition(activeSlotIndex) {
  if (!performanceSlotGrid || !performanceSlotIndicatorRow) return;

  const indicator = performanceSlotIndicatorRow.querySelector(".performance-slot-active-indicator");
  const gridWrap = performanceSlotGrid.parentElement;
  if (!indicator || !gridWrap) return;

  const card = performanceSlotGrid.querySelector(
    `.performance-slot-card[data-slot-index="${activeSlotIndex}"]`
  );
  if (!card) {
    performanceSlotIndicatorRow.hidden = true;
    return;
  }

  const wrapRect = gridWrap.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const centerX = cardRect.left - wrapRect.left + cardRect.width / 2;

  performanceSlotIndicatorRow.style.left = "0";
  performanceSlotIndicatorRow.style.width = "100%";
  indicator.style.removeProperty("grid-column");
  indicator.style.left = `${centerX}px`;
  performanceSlotIndicatorRow.hidden = false;
}

function updatePerformanceSlotActiveIndicators() {
  if (!performanceSlotGrid || !performanceSlotIndicatorRow) return;

  const gridWrap = performanceSlotGrid.parentElement;
  if (!gridWrap) return;

  if (
    performanceSlotGrid.hidden ||
    isLoadingPerformanceSlot ||
    !hasPerformanceLibrary(performanceLibraryDocument)
  ) {
    performanceSlotIndicatorRow.hidden = true;
    return;
  }

  const slotIndex = activePerformanceSlotIndex;
  if (slotIndex < 1 || slotIndex > SLOT_SELECTORS.length) {
    performanceSlotIndicatorRow.hidden = true;
    return;
  }

  const generation = (performanceSlotIndicatorLayoutGeneration += 1);
  requestAnimationFrame(() => {
    if (generation !== performanceSlotIndicatorLayoutGeneration) return;
    const currentSlot = activePerformanceSlotIndex;
    if (currentSlot < 1 || currentSlot > SLOT_SELECTORS.length) {
      performanceSlotIndicatorRow.hidden = true;
      return;
    }
    applyPerformanceSlotActiveIndicatorPosition(currentSlot);
  });
}

function updatePerformanceNavButtons() {
  const indexes = getPerformanceIndexList();
  const blocked =
    performanceLibraryScanInProgress || isLoadingPerformanceSlot || isReloadingCurrentPerformance;
  const navButtons = [
    performancePrevFastButton,
    performancePrevButton,
    performanceNextButton,
    performanceNextFastButton
  ];

  if (indexes.length === 0) {
    navButtons.forEach((button) => {
      if (button) button.disabled = true;
    });
    return;
  }

  const selected = getSelectedPerformanceData();
  const currentPosition = indexes.indexOf(String(selected?.performanceIndex ?? indexes[0]));
  const atFirst = currentPosition <= 0;
  const atLast = currentPosition >= indexes.length - 1;

  if (performancePrevFastButton) performancePrevFastButton.disabled = blocked || atFirst;
  if (performancePrevButton) performancePrevButton.disabled = blocked || atFirst;
  if (performanceNextButton) performanceNextButton.disabled = blocked || atLast;
  if (performanceNextFastButton) performanceNextFastButton.disabled = blocked || atLast;

  updateRigNameNavButtons();
  updatePerformanceSlotActiveIndicators();
}

function setPerformanceSlotCardsState(activeSlotIndex, state) {
  if (!performanceSlotGrid) return;

  performanceSlotGrid.querySelectorAll(".performance-slot-card").forEach((card) => {
    const slotIndex = Number(card.dataset.slotIndex);
    const isTarget = activeSlotIndex !== null && slotIndex === activeSlotIndex;
    const isLoading = state === "loading";

    card.disabled =
      isLoading ||
      performanceLibraryScanInProgress ||
      !isConnectionOperational();

    if (isTarget) {
      card.dataset.state = state;
      return;
    }

    card.dataset.state = isLoading ? "disabled" : "idle";
  });
}

async function waitForRigName(expectedRigName, { timeoutMs = 8000, pollMs = 250 } = {}) {
  const expected = String(expectedRigName || "").trim();
  if (!expected) return false;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const rigName = await requestCurrentRigName();
      if (String(rigName || "").trim() === expected) {
        return true;
      }
    } catch {
      // continue polling
    }

    await delay(pollMs);
  }

  return false;
}

async function waitForRigChangeFrom(previousRigName, { timeoutMs = 8000, pollMs = 250 } = {}) {
  const previous = String(previousRigName || "").trim();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const rigName = await requestCurrentRigName();
      const normalized = String(rigName || "").trim();
      if (normalized && normalized !== previous) {
        return true;
      }
    } catch {
      // continue polling
    }

    await delay(pollMs);
  }

  return false;
}

async function loadBrowserPerformanceSlot(performanceIndex, slotIndex) {
  const loadStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;

  if (isLoadingPerformanceSlot || performanceLibraryScanInProgress || isReloadingCurrentPerformance) {
    return;
  }

  const slot = SLOT_SELECTORS[slotIndex - 1];
  if (!slot) return;

  const targetPerformanceIndex = String(performanceIndex);
  const priorPerformanceIndex = selectedPerformanceIndex;
  const priorActiveSlotIndex = activePerformanceSlotIndex;
  const performanceAlreadyActive =
    kemperLoadedPerformanceIndex !== null &&
    String(kemperLoadedPerformanceIndex) === targetPerformanceIndex;

  selectedPerformanceIndex = targetPerformanceIndex;

  const entries = getPerformanceEntries(performanceLibraryDocument);
  const expectedRigName = getPerformanceSlotRigName(
    entries[String(performanceIndex)]?.[String(slotIndex)]
  );
  const performanceNumber = Number(performanceIndex);

  if (!Number.isFinite(performanceNumber) || performanceNumber < 1) return;

  isLoadingPerformanceSlot = true;
  stopRigMonitor();
  updateControlSectionControls();
  updatePerformanceReloadButtonState();
  setPerformanceSlotCardsState(slotIndex, "loading");
  setPerformanceExplorerSlotState(performanceIndex, slotIndex, "loading");

  if (performancePrevButton) performancePrevButton.disabled = true;
  if (performanceNextButton) performanceNextButton.disabled = true;
  if (performancePrevFastButton) performancePrevFastButton.disabled = true;
  if (performanceNextFastButton) performanceNextFastButton.disabled = true;

  try {
    const { output } = await getMidiPorts();

    if (!performanceAlreadyActive) {
      const performanceCcStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;
      sendMidiSafe(
        output,
        makePerformanceSelectCommand(performanceNumber - 1),
        `Browser Performance ${performanceNumber} preselect`
      );
      await delay(PERFORMANCE_SELECT_SETTLE_MS);
      logRigSwitchTiming("performance-cc+settle", performanceCcStartedAt);
    } else if (DEBUG_RIG_SWITCH_TIMING) {
      console.info("[RigSwitchTiming] performance-cc+settle: skipped (kemper already on performance)");
    }

    const slotCcStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;
    sendMidiSafe(
      output,
      makeSlotSelectCommand(slot),
      `Browser Performance ${performanceNumber} Slot ${slotIndex}`
    );
    await delay(SLOT_SETTLE_MS);
    logRigSwitchTiming("slot-cc+settle", slotCcStartedAt);

    kemperLoadedPerformanceIndex = targetPerformanceIndex;

    const waitForRigStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;
    const rigChanged = expectedRigName
      ? await waitForRigName(expectedRigName)
      : await waitForRigChangeFrom(currentRigName);
    logRigSwitchTiming("waitForRigName", waitForRigStartedAt, `matched=${rigChanged}`);

    const refreshStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;
    await refreshLiveData();
    logRigSwitchTiming("refreshLiveData (awaited from loadBrowser)", refreshStartedAt);

    logRigSwitchTiming(
      "loadBrowserPerformanceSlot total",
      loadStartedAt,
      `perf=${performanceIndex} slot=${slotIndex} perfCcSkipped=${performanceAlreadyActive}`
    );

    if (rigChanged) {
      activePerformanceSlotIndex = slotIndex;
      setPerformanceSlotCardsState(slotIndex, "success");
      setPerformanceExplorerSlotState(performanceIndex, slotIndex, "success");
      window.setTimeout(() => {
        setPerformanceSlotCardsState(null, "idle");
        setPerformanceExplorerSlotState(null, null, "idle");
      }, 700);
    } else {
      selectedPerformanceIndex = priorPerformanceIndex;
      activePerformanceSlotIndex = priorActiveSlotIndex;
      setPerformanceSlotCardsState(null, "idle");
      setPerformanceExplorerSlotState(null, null, "idle");
      renderPerformanceBrowser();
    }
  } catch (error) {
    console.warn("[Live Companion] Performance slot load failed:", error.message || error);
    selectedPerformanceIndex = priorPerformanceIndex;
    activePerformanceSlotIndex = priorActiveSlotIndex;
    setPerformanceSlotCardsState(null, "idle");
    setPerformanceExplorerSlotState(null, null, "idle");
    renderPerformanceBrowser();
  } finally {
    isLoadingPerformanceSlot = false;
    updatePerformanceNavButtons();
    updatePerformanceReloadButtonState();
    updateControlSectionControls();

    if (connectionState === CONNECTION_STATE.CONNECTED) {
      startRigMonitor();
    }
  }
}

function renderPerformanceBrowser() {
  if (!performanceSection || !performanceSlotGrid) return;

  performanceSection.hidden = false;
  performanceSlotGrid.innerHTML = "";

  if (!hasPerformanceLibrary(performanceLibraryDocument)) {
    selectedPerformanceIndex = null;
    if (performanceEmptyState) performanceEmptyState.hidden = false;
    if (performanceBrowserControls) performanceBrowserControls.hidden = true;
    if (performanceBrowserLabel) performanceBrowserLabel.hidden = true;
    if (createLibraryButton) {
      createLibraryButton.disabled = performanceLibraryScanInProgress;
    }
    if (!performanceLibraryScanInProgress) {
      setPerformanceScanPanelVisible(false);
    }
    updatePerformanceSectionLayout();
    updatePerformanceReloadButtonState();
    updateRigNameNavButtons();
    updatePerformanceSlotActiveIndicators();
    return;
  }

  const selected = getSelectedPerformanceData();
  selectedPerformanceIndex = selected.performanceIndex;

  if (performanceEmptyState) performanceEmptyState.hidden = true;
  if (performanceBrowserControls) {
    performanceBrowserControls.hidden = performanceLibraryScanInProgress;
  }
  if (performanceBrowserLabel) {
    performanceBrowserLabel.hidden = performanceLibraryScanInProgress;
    if (performanceBrowserLabel.dataset.editing !== "true") {
      const labelText = formatPerformanceLabel(selected.performanceIndex);
      performanceBrowserLabel.textContent = labelText;
      performanceBrowserLabel.title = `${labelText} — click to rename`;
    }
  }
  updatePerformanceNavButtons();
  updatePerformanceReloadButtonState();
  if (createLibraryButton) {
    createLibraryButton.disabled = performanceLibraryScanInProgress;
  }
  if (!performanceLibraryScanInProgress) {
    setPerformanceScanPanelVisible(false);
    if (performanceSlotGrid) performanceSlotGrid.hidden = false;
  }

  SLOT_SELECTORS.forEach((slot, index) => {
    const slotIndex = index + 1;
    const card = document.createElement("button");
    const label = document.createElement("span");
    const name = document.createElement("strong");
    const rig = getPerformanceSlotRigName(selected.slots[String(slotIndex)]) || "Keine Antwort";

    card.type = "button";
    card.className = "performance-slot-card";
    card.dataset.slotIndex = String(slotIndex);
    card.dataset.performanceIndex = selected.performanceIndex;
    card.dataset.state = "idle";
    card.disabled =
      !isConnectionOperational() ||
      performanceLibraryScanInProgress ||
      isLoadingPerformanceSlot;
    card.setAttribute("aria-label", `Slot ${slotIndex}: ${rig}`);
    label.textContent = `Slot ${slotIndex}`;
    name.textContent = rig;

    card.append(label, name);
    performanceSlotGrid.append(card);
  });

  updatePerformanceSectionLayout();
  updatePerformanceReloadButtonState();
  syncRigNotesInput();
}

async function initializePerformanceLibrary() {
  performanceLibraryDocument = await loadPerformanceLibraryDocument();
  renderPerformanceBrowser();
  syncRigNotesInput({ force: true });
}

function resolveCurrentSlotNoteContext() {
  if (!hasPerformanceLibrary(performanceLibraryDocument)) return null;

  const kemperMatch = resolveKemperRigSlotMatch();
  if (kemperMatch) {
    return {
      performanceIndex: String(kemperMatch.performanceIndex),
      slotIndex: kemperMatch.slotIndex
    };
  }

  const navigation = resolveRigNavigationPosition();
  if (navigation) {
    return {
      performanceIndex: String(navigation.performanceIndex),
      slotIndex: navigation.slotIndex
    };
  }

  const selected = getSelectedPerformanceData();
  if (
    selected &&
    activePerformanceSlotIndex >= 1 &&
    activePerformanceSlotIndex <= SLOT_SELECTORS.length
  ) {
    return {
      performanceIndex: String(selected.performanceIndex),
      slotIndex: activePerformanceSlotIndex
    };
  }

  return null;
}

async function setPerformanceName(performanceIndex, name) {
  const key = String(performanceIndex);
  const trimmed = String(name || "").trim();
  const nextNames = { ...performanceNames };

  if (trimmed) {
    nextNames[key] = trimmed;
  } else {
    delete nextNames[key];
  }

  if (nextNames[key] === performanceNames[key]) return;

  performanceNames = nextNames;
  await savePerformanceLibraryDocument(performanceLibraryDocument);
}

function syncSelectedPerformanceBrowserLabel() {
  if (!performanceBrowserLabel || performanceBrowserLabel.dataset.editing === "true") return;

  const selected = getSelectedPerformanceData();
  if (!selected) return;

  const labelText = formatPerformanceLabel(selected.performanceIndex);
  performanceBrowserLabel.textContent = labelText;
  performanceBrowserLabel.title = `${labelText} — click to rename`;
}

function getExplorerPerformanceNameQuery() {
  return normalizeExplorerQuery(performanceExplorerSearch?.value || "");
}

function updateExplorerPerformanceNameDisplay(nameHost, performanceIndex, query = getExplorerPerformanceNameQuery()) {
  if (!nameHost) return;

  const customName = getPerformanceName(performanceIndex);
  const displayText = customName || `Performance ${performanceIndex}`;

  nameHost.dataset.editing = "false";
  nameHost.classList.toggle("is-default", !customName);

  const nameMatchesQuery =
    Boolean(query) &&
    (customName.toLowerCase().includes(query) ||
      (!customName && `performance ${performanceIndex}`.includes(query)));
  appendExplorerHighlightedText(nameHost, displayText, nameMatchesQuery ? query : "");

  nameHost.title = customName
    ? `${formatPerformanceLabel(performanceIndex)} — click to rename`
    : `Click to name Performance ${performanceIndex}`;
}

async function commitExplorerPerformanceName(performanceIndex, input) {
  if (!input || input.dataset.busy === "true") return;

  const previous = getPerformanceName(performanceIndex);
  const trimmed = String(input.value || "").trim();
  if (trimmed === previous) return;

  input.dataset.busy = "true";
  try {
    await setPerformanceName(performanceIndex, input.value);
    if (String(selectedPerformanceIndex) === String(performanceIndex)) {
      syncSelectedPerformanceBrowserLabel();
    }
  } catch (error) {
    console.warn("[Live Companion] Performance name save failed:", error?.message || error);
    input.value = previous;
    throw error;
  } finally {
    delete input.dataset.busy;
  }
}

function beginExplorerPerformanceNameEdit(performanceIndex, nameHost) {
  if (!nameHost || performanceLibraryScanInProgress) return;
  if (nameHost.dataset.editing === "true") return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "performance-explorer-row-name-input";
  input.value = getPerformanceName(performanceIndex);
  input.placeholder = `Performance ${performanceIndex}`;
  input.maxLength = 60;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute(
    "aria-label",
    `Display name for Performance ${performanceIndex}. Leave empty for the default name.`
  );

  let finished = false;

  const stopRowPointer = (event) => {
    event.stopPropagation();
  };

  async function finish(commit) {
    if (finished) return;
    finished = true;

    if (commit) {
      try {
        await commitExplorerPerformanceName(performanceIndex, input);
      } catch {
        // Display restores from persisted name below.
      }
    }

    updateExplorerPerformanceNameDisplay(nameHost, performanceIndex);
  }

  input.addEventListener("mousedown", stopRowPointer);
  input.addEventListener("click", stopRowPointer);
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => {
    void finish(true);
  });

  nameHost.dataset.editing = "true";
  nameHost.textContent = "";
  nameHost.append(input);
  input.focus();
  input.select();
}

function bindExplorerPerformanceNameHost(nameHost, performanceIndex) {
  const stopRowPointer = (event) => {
    event.stopPropagation();
  };

  nameHost.addEventListener("mousedown", stopRowPointer);
  nameHost.addEventListener("click", (event) => {
    stopRowPointer(event);
    if (event.target.closest(".performance-explorer-row-name-input")) return;
    beginExplorerPerformanceNameEdit(performanceIndex, nameHost);
  });
  nameHost.addEventListener("keydown", (event) => {
    if (event.target.closest(".performance-explorer-row-name-input")) return;
    event.stopPropagation();
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    beginExplorerPerformanceNameEdit(performanceIndex, nameHost);
  });
}

async function setSlotNote(performanceIndex, slotIndex, text) {
  const key = makeSlotNoteKey(performanceIndex, slotIndex);
  const note = String(text ?? "");
  const nextNotes = { ...slotNotes };

  if (note.trim()) {
    nextNotes[key] = note;
  } else {
    delete nextNotes[key];
  }

  if (nextNotes[key] === slotNotes[key]) return;

  slotNotes = nextNotes;
  // A running scan saves its own document on every step and carries slotNotes along.
  if (performanceLibraryScanInProgress) return;
  await savePerformanceLibraryDocument(performanceLibraryDocument);
}

function flushRigNote() {
  if (rigNotesSaveTimer != null) {
    window.clearTimeout(rigNotesSaveTimer);
    rigNotesSaveTimer = null;
  }
  if (!rigNotesInput || !rigNotesSlotKey) return;

  const parsed = parseSlotNoteKeyFromState(rigNotesSlotKey);
  if (!parsed) return;

  setSlotNote(parsed.performanceIndex, parsed.slotIndex, rigNotesInput.value).catch((error) => {
    console.warn("[Live Companion] Rig note save failed:", error?.message || error);
  });
}

/** @param {string} key */
function parseSlotNoteKeyFromState(key) {
  const match = String(key).match(/^(\d+):([1-5])$/);
  if (!match) return null;
  return { performanceIndex: match[1], slotIndex: Number(match[2]) };
}

function syncRigNotesInput({ force = false } = {}) {
  if (!rigNotesInput) return;

  const context = resolveCurrentSlotNoteContext();
  const nextKey = context ? makeSlotNoteKey(context.performanceIndex, context.slotIndex) : null;

  if (nextKey === rigNotesSlotKey) {
    if (!force || document.activeElement === rigNotesInput) return;
  } else {
    flushRigNote();
  }

  rigNotesSlotKey = nextKey;

  if (!nextKey) {
    rigNotesInput.value = "";
    rigNotesInput.disabled = true;
    rigNotesInput.setAttribute("aria-label", "Notes");
    return;
  }

  rigNotesInput.value = slotNotes[nextKey] || "";
  rigNotesInput.disabled = false;
  const parsed = parseSlotNoteKeyFromState(nextKey);
  rigNotesInput.setAttribute(
    "aria-label",
    parsed
      ? `Notes for Performance ${parsed.performanceIndex}, Slot ${parsed.slotIndex}`
      : "Notes"
  );
}

function beginPerformanceNameEdit() {
  if (!performanceBrowserLabel || performanceLibraryScanInProgress) return;
  if (performanceBrowserLabel.dataset.editing === "true") return;

  const performanceIndex = selectedPerformanceIndex;
  if (!performanceIndex) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "performance-browser-label-input";
  input.value = getPerformanceName(performanceIndex);
  input.placeholder = `Performance ${performanceIndex}`;
  input.maxLength = 60;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute(
    "aria-label",
    `Name for Performance ${performanceIndex}. Leave empty to remove the name.`
  );

  let finished = false;

  async function finish(commit, restoreFocus) {
    if (finished) return;
    finished = true;
    delete performanceBrowserLabel.dataset.editing;

    if (commit) {
      await setPerformanceName(performanceIndex, input.value);
      if (performanceExplorerExpanded && performanceExplorerList) {
        const rowNameHost = performanceExplorerList.querySelector(
          `.performance-explorer-row-name[data-performance-index="${String(performanceIndex)}"]`
        );
        if (rowNameHost && rowNameHost.dataset.editing !== "true") {
          updateExplorerPerformanceNameDisplay(rowNameHost, performanceIndex);
        }
      }
    }

    renderPerformanceBrowser();
    if (restoreFocus) performanceBrowserLabel.focus();
  }

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      finish(true, true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false, true);
    }
  });
  input.addEventListener("blur", () => finish(true, false));

  performanceBrowserLabel.dataset.editing = "true";
  performanceBrowserLabel.textContent = "";
  performanceBrowserLabel.append(input);
  input.focus();
  input.select();
}

function setLibraryConfirmDialogOpen(isOpen) {
  if (!libraryConfirmDialog) return;

  libraryConfirmDialog.dataset.open = isOpen ? "true" : "false";
  libraryConfirmDialog.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function confirmPerformanceLibraryRebuild() {
  if (!libraryConfirmDialog || !cancelLibraryScanButton || !startLibraryScanButton) {
    return Promise.resolve(window.confirm(
      "The current position on the Kemper will be changed during the scan.\n\nThe scan may take several minutes.\n\nDo you want to continue?"
    ));
  }

  setLibraryConfirmDialogOpen(true);
  startLibraryScanButton.focus();

  return new Promise((resolve) => {
    function cleanup(result) {
      cancelLibraryScanButton.removeEventListener("click", onCancel);
      startLibraryScanButton.removeEventListener("click", onStart);
      libraryConfirmDialog.removeEventListener("click", onBackdropClick);
      window.removeEventListener("keydown", onKeyDown);
      setLibraryConfirmDialogOpen(false);
      resolve(result);
    }

    function onCancel() {
      cleanup(false);
    }

    function onStart() {
      cleanup(true);
    }

    function onBackdropClick(event) {
      if (event.target === libraryConfirmDialog) {
        cleanup(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        cleanup(false);
      }
    }

    cancelLibraryScanButton.addEventListener("click", onCancel);
    startLibraryScanButton.addEventListener("click", onStart);
    libraryConfirmDialog.addEventListener("click", onBackdropClick);
    window.addEventListener("keydown", onKeyDown);
  });
}

async function readPerformanceSlotLibraryEntry(contextLabel) {
  const rigName = await readRigNameSafe(contextLabel);
  const ampTags = await readPerformanceSlotAmpTags();

  return {
    rigName,
    ampName: ampTags.ampName,
    ampManufacturer: ampTags.ampManufacturer,
    ampModel: ampTags.ampModel
  };
}

async function readPerformanceSlotsForPerformanceFromDevice(output, performanceIndex, contextLabel) {
  const performanceNumber = Number(performanceIndex);
  if (!Number.isFinite(performanceNumber) || performanceNumber < 1) {
    return {};
  }

  sendMidiSafe(
    output,
    makePerformanceSelectCommand(performanceNumber - 1),
    `${contextLabel} Performance ${performanceNumber} select`
  );
  await delay(PERFORMANCE_SELECT_SETTLE_MS);

  const performanceData = {};

  for (let slotIndex = 1; slotIndex <= SLOT_SELECTORS.length; slotIndex += 1) {
    const slot = SLOT_SELECTORS[slotIndex - 1];

    sendMidiSafe(
      output,
      makeSlotSelectCommand(slot),
      `${contextLabel} Performance ${performanceNumber} Slot ${slotIndex}`
    );
    await delay(SLOT_SETTLE_MS);

    performanceData[String(slotIndex)] = await readPerformanceSlotLibraryEntry(
      `${contextLabel} Performance ${performanceNumber} Slot ${slotIndex}`
    );
  }

  return performanceData;
}

async function reloadCurrentPerformanceFromDevice() {
  if (
    isReloadingCurrentPerformance ||
    performanceLibraryScanInProgress ||
    isLoadingPerformanceSlot ||
    !isConnectionOperational()
  ) {
    return;
  }

  const selected = getSelectedPerformanceData();
  if (!selected) return;

  const performanceIndex = selected.performanceIndex;
  const restoreSlotIndex = resolveActiveSlotIndexForPerformance(performanceIndex);

  isReloadingCurrentPerformance = true;
  stopRigMonitor();
  updatePerformanceReloadButtonState();
  updatePerformanceNavButtons();

  try {
    const { output } = await getMidiPorts();
    const performanceData = await readPerformanceSlotsForPerformanceFromDevice(
      output,
      performanceIndex,
      "Reload"
    );

    applyAmpMatchingToPerformanceSlots(performanceData);
    performanceLibraryDocument[String(performanceIndex)] = performanceData;
    await savePerformanceLibraryDocument(performanceLibraryDocument);

    renderPerformanceBrowser();
    if (performanceExplorerExpanded) {
      renderPerformanceExplorer();
    }
  } catch (error) {
    console.warn("[Live Companion] Performance reload failed:", error.message || error);
  } finally {
    isReloadingCurrentPerformance = false;
    updatePerformanceReloadButtonState();
    updatePerformanceNavButtons();

    try {
      await loadBrowserPerformanceSlot(performanceIndex, restoreSlotIndex);
    } catch (error) {
      console.warn(
        "[Live Companion] Performance reload restore failed:",
        error.message || error
      );
      if (connectionState === CONNECTION_STATE.CONNECTED) {
        startRigMonitor();
      }
    }
  }
}

async function readPerformanceSlotAmpTags() {
  const [ampName, ampManufacturer, ampModel] = await Promise.all([
    requestStringTag(STRING_TAGS.ampName),
    requestStringTag(STRING_TAGS.ampManufacturer),
    requestStringTag(STRING_TAGS.ampModel)
  ]);

  return {
    ampName: ampName || "",
    ampManufacturer: ampManufacturer || "",
    ampModel: ampModel || ""
  };
}

async function readRigNameSafe(contextLabel) {
  try {
    const value = await requestCurrentRigName();
    const normalized = (value || "").trim();

    if (!normalized) {
      console.warn(`[Live Companion] Timeout or empty rig name while reading ${contextLabel}.`);
      return "";
    }

    return normalized;
  } catch (error) {
    console.warn(`[Live Companion] Rig name read failed for ${contextLabel}:`, error.message || error);
    return "";
  }
}

async function scanPerformanceLibrary({ onProgress } = {}) {
  const { output } = await getMidiPorts();
  await resetToFirstPerformance(output, "Library scan start");
  const originalRigName = await readRigNameSafe("scan start");
  let library = createEmptyLibraryDocument(originalRigName);

  await savePerformanceLibraryDocument(library);
  onProgress?.({
    performanceIndex: 1,
    slotIndex: 0,
    savedCount: 0,
    totalPerformances: LIBRARY_SCAN_PERFORMANCE_COUNT,
    phase: "started"
  });

  try {
    for (let performanceIndex = 1; performanceIndex <= LIBRARY_SCAN_PERFORMANCE_COUNT; performanceIndex += 1) {
      console.info(`[Live Companion] Scanning Performance ${performanceIndex}/${LIBRARY_SCAN_PERFORMANCE_COUNT}.`);
      const performanceData = {};

      for (let slotIndex = 1; slotIndex <= SLOT_SELECTORS.length; slotIndex += 1) {
        const slot = SLOT_SELECTORS[slotIndex - 1];

        onProgress?.({
          performanceIndex,
          slotIndex,
          savedCount: performanceIndex - 1,
          totalPerformances: LIBRARY_SCAN_PERFORMANCE_COUNT,
          phase: "slot"
        });

        sendMidiSafe(output, makeSlotSelectCommand(slot), `Performance ${performanceIndex} Slot ${slotIndex}`);
        await delay(SLOT_SETTLE_MS);

        performanceData[String(slotIndex)] = await readPerformanceSlotLibraryEntry(
          `Performance ${performanceIndex} Slot ${slotIndex}`
        );
      }

      library[String(performanceIndex)] = performanceData;
      library[PERFORMANCE_LIBRARY_META_KEY].completedPerformances = performanceIndex;
      library[PERFORMANCE_LIBRARY_META_KEY].scanInProgress = performanceIndex < LIBRARY_SCAN_PERFORMANCE_COUNT;
      library[PERFORMANCE_LIBRARY_META_KEY].scanComplete = false;
      await savePerformanceLibraryDocument(library);

      onProgress?.({
        performanceIndex,
        slotIndex: SLOT_SELECTORS.length,
        savedCount: performanceIndex,
        totalPerformances: LIBRARY_SCAN_PERFORMANCE_COUNT,
        phase: "performance-saved"
      });

      if (performanceIndex < LIBRARY_SCAN_PERFORMANCE_COUNT) {
        sendMidiSafe(output, makeRigNextCommand(), `Advance after Performance ${performanceIndex}`);
        await delay(PERFORMANCE_ADVANCE_MS);
      }
    }

    applyAmpMatchingToPerformanceLibrary(library);

    library[PERFORMANCE_LIBRARY_META_KEY].scanInProgress = false;
    library[PERFORMANCE_LIBRARY_META_KEY].scanComplete = true;
    await savePerformanceLibraryDocument(library);

    onProgress?.({
      performanceIndex: LIBRARY_SCAN_PERFORMANCE_COUNT,
      slotIndex: SLOT_SELECTORS.length,
      savedCount: LIBRARY_SCAN_PERFORMANCE_COUNT,
      totalPerformances: LIBRARY_SCAN_PERFORMANCE_COUNT,
      phase: "complete"
    });
  } finally {
    await resetToFirstPerformance(output, "Library scan end");
  }

  return library;
}

function renderLibraryScanProgress({
  performanceIndex = 1,
  slotIndex = 0,
  savedCount = 0,
  totalPerformances = LIBRARY_SCAN_PERFORMANCE_COUNT,
  phase = "idle"
} = {}) {
  if (phase === "complete") {
    setPerformanceScanPanelVisible(false);
    updatePerformanceSectionLayout();
    return;
  }

  setPerformanceScanPanelVisible(true);
  if (performanceBrowserControls) performanceBrowserControls.hidden = true;
  if (performanceBrowserLabel) performanceBrowserLabel.hidden = true;
  if (performanceSlotGrid) performanceSlotGrid.hidden = true;

  if (phase === "performance-saved") {
    setPerformanceScanStatus(
      `Scanning Performance ${performanceIndex} / ${totalPerformances} · ${savedCount} gespeichert`,
      "loading"
    );
  } else {
    setPerformanceScanStatus(
      `Scanning Performance ${performanceIndex} / ${totalPerformances}, Slot ${slotIndex || 1}`,
      "loading"
    );
  }

  setPerformanceProgress({ savedCount, totalPerformances });
  updatePerformanceSectionLayout();
}

async function createPerformanceLibrary() {
  if (performanceLibraryScanInProgress) return;

  const shouldStartScan = await confirmPerformanceLibraryRebuild();
  if (!shouldStartScan) return;

  performanceLibraryScanInProgress = true;
  stopRigMonitor();

  if (createLibraryButton) {
    createLibraryButton.disabled = true;
    createLibraryButton.textContent = "Scanning Performance Library...";
  }

  setPerformanceProgress({ savedCount: 0 });
  setPerformanceScanPanelVisible(true);
  setPerformanceScanStatus("Scanning Performance Library...", "loading");
  if (performanceSlotGrid) performanceSlotGrid.hidden = true;

  try {
    performanceLibraryDocument = await scanPerformanceLibrary({
      onProgress: renderLibraryScanProgress
    });
    performanceLibraryDocument = await loadPerformanceLibraryDocument();
    selectedPerformanceIndex = "1";
    if (performanceSlotGrid) performanceSlotGrid.hidden = false;
    renderPerformanceBrowser();
    await refreshLiveData();
  } catch (error) {
    performanceLibraryDocument = await loadPerformanceLibraryDocument();
    if (performanceSlotGrid) performanceSlotGrid.hidden = false;
    renderPerformanceBrowser();
    setPerformanceScanPanelVisible(false);
    setStatus(`Library-Scan fehlgeschlagen: ${error.message || error}`, "error");
  } finally {
    performanceLibraryScanInProgress = false;
    setPerformanceScanPanelVisible(false);

    if (createLibraryButton) {
      createLibraryButton.disabled = false;
      createLibraryButton.textContent = "Rebuild Performance Library";
    }

    renderPerformanceBrowser();

    if (connectionState === CONNECTION_STATE.CONNECTED) {
      startRigMonitor();
    }
  }
}

function updateLiveAmpDetailAffordance() {
  if (!ampImageContainer) return;
  const hasDetail = Boolean(currentLiveAmpId);
  ampImageContainer.dataset.hasAmpDetail = hasDetail ? "true" : "false";
  ampImageContainer.setAttribute(
    "aria-label",
    hasDetail ? "Open amplifier details" : "Amplifier image"
  );
  ampImageContainer.tabIndex = hasDetail ? 0 : -1;
  ampImageContainer.setAttribute("role", hasDetail ? "button" : "presentation");
}

function openLiveAmpDetailsOverlay() {
  if (!currentLiveAmpId) return false;
  return openAmpDetailsOverlay(currentLiveAmpId, { source: "live" });
}

function fillSelect(select, ports, emptyText) {
  select.innerHTML = "";

  if (ports.length === 0) {
    const option = document.createElement("option");
    option.textContent = emptyText;
    option.value = "";
    select.append(option);
    return;
  }

  ports.forEach((port) => {
    const option = document.createElement("option");
    option.textContent = port.name || port.id;
    option.value = port.id;
    select.append(option);
  });
}

function preferProfilerPort(select) {
  const profilerOption = [...select.options].find((option) =>
    option.textContent.toLowerCase().includes("profiler") ||
    option.textContent.toLowerCase().includes("kemper")
  );

  if (profilerOption) {
    select.value = profilerOption.value;
  }
}

function refreshPortSelects() {
  fillSelect(inputPort, [...midiAccess.inputs.values()], "No MIDI input found");
  fillSelect(outputPort, [...midiAccess.outputs.values()], "No MIDI output found");
  preferProfilerPort(inputPort);
  preferProfilerPort(outputPort);
}

function stopRigMonitor() {
  if (!monitorTimer) return;

  window.clearInterval(monitorTimer);
  monitorTimer = null;
}

function handleDisconnected() {
  stopRigMonitor();
  bidirectionalDiscovery.stop();
  consecutiveMonitorFailures = 0;
  currentLiveAmpId = null;
  kemperLoadedPerformanceIndex = null;
  updateLiveAmpDetailAffordance();
  setConnectionState(CONNECTION_STATE.NO_MIDI);
}

async function attemptConnection() {
  if (reconnectInProgress || isRefreshingLiveData) return;

  if (!hasSelectablePorts()) {
    handleDisconnected();
    return;
  }

  reconnectInProgress = true;

  try {
    await refreshLiveData();
  } finally {
    reconnectInProgress = false;
  }
}

function handlePortChange() {
  if (hasSelectablePorts()) {
    if (!isConnectionOperational()) {
      attemptConnection();
    }
  } else {
    handleDisconnected();
  }
}

function ensureConnectionWatcher() {
  if (connectionWatcher) return;

  connectionWatcher = window.setInterval(() => {
    if (
      !isConnectionOperational() &&
      hasSelectablePorts() &&
      !reconnectInProgress &&
      !isRefreshingLiveData
    ) {
      attemptConnection();
    }
  }, RECONNECT_INTERVAL_MS);
}

async function handleNoMidiReconnect() {
  if (reconnectInProgress || isRefreshingLiveData) return;

  await loadPorts();
}

async function loadPorts() {
  setConnectionState(CONNECTION_STATE.BOOT_LOADING);

  try {
    if (!("requestMIDIAccess" in navigator)) {
      throw new Error("Web MIDI API ist in dieser WebView nicht verfuegbar.");
    }

    midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    refreshPortSelects();
    midiAccess.onstatechange = () => {
      refreshPortSelects();
      handlePortChange();
    };
    ensureConnectionWatcher();
    await attemptConnection();
  } catch (error) {
    setStatus(String(error), "error");
    setConnectionState(CONNECTION_STATE.NO_MIDI);
  }
}

function getKemperFrame(data) {
  const bytes = Array.from(data);
  const start = bytes.indexOf(0xf0);
  const end = bytes.lastIndexOf(0xf7);

  if (start < 0 || end < 0 || end <= start) return null;

  const frame = bytes.slice(start, end + 1);
  const isKemperFrame = SYSEX_HEADER.every((byte, index) => frame[index] === byte);

  return isKemperFrame ? frame : null;
}

function parseAsciiString(frame, startIndex) {
  const chars = [];
  for (let index = startIndex; index < frame.length - 1; index += 1) {
    const byte = frame[index];
    if (byte === 0x00) break;
    if (byte >= 0x20 && byte <= 0x7e) chars.push(byte);
  }

  return String.fromCharCode(...chars).trim();
}

function parseStringResponse(data, address) {
  const frame = getKemperFrame(data);
  if (!frame) return "";

  const isKnownKemperShape =
    frame[4] === 0x00 &&
    frame[5] === 0x00 &&
    frame[6] === 0x03 &&
    frame[7] === 0x00 &&
    frame[8] === address[0] &&
    frame[9] === address[1];

  if (!isKnownKemperShape) return "";

  return parseAsciiString(frame, 10);
}

function parseCurrentRigName(data) {
  const frame = getKemperFrame(data);
  if (!frame) return "";

  const isKnownKemperShape =
    frame[4] === 0x00 &&
    frame[5] === 0x00 &&
    frame[6] === 0x03 &&
    frame[7] === 0x00 &&
    frame[8] === STRING_TAGS.rigName[0] &&
    frame[9] === STRING_TAGS.rigName[1];

  if (!isKnownKemperShape) return "";

  return parseAsciiString(frame, 10);
}

function parseNumericResponse(data, address) {
  const frame = getKemperFrame(data);
  if (!frame) return null;

  const isKnownKemperShape =
    frame[4] === 0x00 &&
    frame[5] === 0x00 &&
    frame[6] === 0x01 &&
    frame[7] === 0x00 &&
    frame[8] === address[0] &&
    frame[9] === address[1];

  if (!isKnownKemperShape) return null;

  return (frame[10] << 7) + frame[11];
}

function parseRenderedStringResponse(data, address, value) {
  const frame = getKemperFrame(data);
  if (!frame) return "";

  const valueMsb = (value >> 7) & 0x7f;
  const valueLsb = value & 0x7f;
  const isKnownKemperShape =
    frame[4] === 0x00 &&
    frame[5] === 0x00 &&
    frame[6] === 0x3c &&
    frame[7] === 0x00 &&
    frame[8] === address[0] &&
    frame[9] === address[1] &&
    frame[10] === valueMsb &&
    frame[11] === valueLsb;

  if (!isKnownKemperShape) return "";

  return parseAsciiString(frame, 12);
}

function makeStringRequest(address) {
  return [...KEMPER_REQUEST_PREFIX, 0x43, 0x00, address[0], address[1], 0xf7];
}

function makeNumericRequest(address) {
  return [...KEMPER_REQUEST_PREFIX, 0x41, 0x00, address[0], address[1], 0xf7];
}

function makeRenderedStringRequest(address, value) {
  return [
    ...KEMPER_REQUEST_PREFIX,
    0x7c,
    0x00,
    address[0],
    address[1],
    (value >> 7) & 0x7f,
    value & 0x7f,
    0xf7
  ];
}

async function getMidiPorts() {
  if (!midiAccess) {
    midiAccess = await navigator.requestMIDIAccess({ sysex: true });
  }

  const input = midiAccess.inputs.get(inputPort.value);
  const output = midiAccess.outputs.get(outputPort.value);

  if (!input) throw new Error("Please select a MIDI input.");
  if (!output) throw new Error("Please select a MIDI output.");

  await input.open();
  await output.open();
  bidirectionalDiscovery.start(input, output);

  return { input, output };
}

async function requestSysex({ request, parse, timeoutMs = 1200 }) {
  const { input, output } = await getMidiPorts();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      input.removeEventListener("midimessage", onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(event) {
      const value = parse(event.data);
      if (value === "" || value === null || value === undefined) return;

      window.clearTimeout(timeout);
      input.removeEventListener("midimessage", onMessage);
      resolve(value);
    }

    input.addEventListener("midimessage", onMessage);
    try {
      output.send(request);
    } catch (error) {
      window.clearTimeout(timeout);
      input.removeEventListener("midimessage", onMessage);
      reject(error);
    }
  });
}

async function requestCurrentRigName() {
  const value = await requestSysex({
    request: CURRENT_RIG_NAME_REQUEST,
    parse: parseCurrentRigName,
    timeoutMs: 5000
  });

  if (!value) throw new Error("Keine Kemper SysEx-Antwort empfangen.");
  return value;
}

async function requestStringTag(address) {
  return (
    (await requestSysex({
      request: makeStringRequest(address),
      parse: (data) => parseStringResponse(data, address)
    })) || ""
  );
}

async function requestNumericParam(address) {
  return await requestSysex({
    request: makeNumericRequest(address),
    parse: (data) => parseNumericResponse(data, address)
  });
}

async function requestRenderedString(address, value) {
  if (value === null || value === undefined) return "";

  return (
    (await requestSysex({
      request: makeRenderedStringRequest(address, value),
      parse: (data) => parseRenderedStringResponse(data, address, value),
      timeoutMs: 600
    })) || ""
  );
}

function formatGain(value) {
  if (value === null || value === undefined) return "";
  const decoded = parameterService.get(CONTROL_PARAMETERS.gain.key)?.decode(value);
  if (decoded?.display && decoded.display !== "—") return decoded.display;
  return (value / 1638.3).toFixed(1);
}

function normalizeEffectName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getEffectImage(effectName, moduleGroup = "") {
  const normalizedEffectName = normalizeEffectName(effectName);
  if (!normalizedEffectName) return "";

  if (moduleGroup === "reverb" && normalizedEffectName.includes("wah")) {
    return "";
  }

  const aliasMatch = Object.entries(EFFECT_IMAGE_ALIASES).find(
    ([name]) => normalizeEffectName(name) === normalizedEffectName
  );
  if (aliasMatch) return aliasMatch[1];

  const exactMatch = Object.entries(effectImageMap).find(
    ([name]) => normalizeEffectName(name) === normalizedEffectName
  );

  if (exactMatch) return exactMatch[1];
  return "";
}

function getEffectName(typeName, typeValue, module) {
  void module;
  if (typeName) return typeName;

  if (!typeValue || typeValue === 0) {
    return "";
  }

  return getEffectTypeName(typeValue) || EFFECT_TYPE_NAMES[typeValue] || "";
}

function getModuleEffectImage(typeName, module) {
  const mappedImage = getEffectImage(typeName, module.group);
  if (mappedImage) return mappedImage;

  return MODULE_FALLBACK_EFFECTS[module.group]?.image || "";
}

function isEffectActive(effect) {
  if (effect?.activeValue != null) return isBooleanOn(effect.activeValue);
  return Boolean(effect?.active);
}

function getEffectModuleByKey(effectKey) {
  return EFFECT_MODULES.find((module) => module.key === effectKey);
}

function setEffectItemBusy(effectKey, busy) {
  const item = effectsList?.querySelector(`li[data-key="${effectKey}"]`);
  if (!item) return;

  item.dataset.busy = busy ? "true" : "false";
  item.setAttribute("aria-busy", busy ? "true" : "false");
}

function clearEffectWriteConfirmation(effectKey, resolveStatus = null) {
  const pending = pendingEffectWriteConfirmations.get(effectKey);
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pendingEffectWriteConfirmations.delete(effectKey);
  if (resolveStatus) {
    pending.resolve({ status: resolveStatus });
  }
}

/**
 * @param {string} effectKey
 * @param {boolean} expectedActive
 * @param {number} expectedRaw
 * @param {string} parameterIdHex
 */
function registerEffectWriteConfirmation(effectKey, expectedActive, expectedRaw, parameterIdHex) {
  clearEffectWriteConfirmation(effectKey);

  return new Promise((resolve) => {
    const sentAt = Date.now();
    const timer = window.setTimeout(() => {
      if (!pendingEffectWriteConfirmations.has(effectKey)) return;
      pendingEffectWriteConfirmations.delete(effectKey);
      resolve({ status: "timeout" });
    }, EFFECT_PUSH_CONFIRM_MS);

    pendingEffectWriteConfirmations.set(effectKey, {
      expectedActive,
      expectedRaw,
      sentAt,
      parameterIdHex,
      resolve,
      timer
    });

  });
}

/**
 * @param {typeof EFFECT_MODULES[number]} module
 * @param {number} activeValue
 * @param {number | null | undefined} kemperRaw
 */
function settleEffectWriteConfirmation(module, activeValue, kemperRaw) {
  const pending = pendingEffectWriteConfirmations.get(module.key);
  if (!pending) return false;

  window.clearTimeout(pending.timer);
  pendingEffectWriteConfirmations.delete(module.key);

  const raw = kemperRaw == null ? null : Number(kemperRaw);
  const kemperActive = isBooleanOn(raw ?? activeValue);
  const confirmed = kemperActive === pending.expectedActive;

  if (confirmed) {
    pending.resolve({ status: "confirmed", kemperActive, kemperRaw: raw });
    return true;
  }

  pending.resolve({ status: "mismatch", kemperActive, kemperRaw: raw });
  return true;
}

/**
 * Delay/Reverb writes echo on 0x7C00 (raw 0 = OFF, raw 1 = ON), not on 0x3C03/0x3D03.
 * Only settles pending toggles — never maps 0x7C00 to effect UI globally.
 *
 * @param {{ rawValue: number | null }} state
 * @param {{ changed?: boolean, initial?: boolean }} result
 * @returns {boolean}
 */
function tryConfirmDelayReverbFromSyncStatus(state, result) {
  if (state.rawValue == null) return false;

  const kemperActive = isBooleanOn(state.rawValue);
  const activeValue = kemperActive ? 1 : 0;
  let confirmed = false;

  for (const slotKey of ["delay", "reverb"]) {
    const pending = pendingEffectWriteConfirmations.get(slotKey);
    if (!pending) continue;

    const module = getEffectModuleByKey(slotKey);
    if (!module) continue;

    if (kemperActive !== pending.expectedActive) continue;

    lastEffectOnOffPushAt.set(slotKey, Date.now());

    settleEffectWriteConfirmation(module, activeValue, state.rawValue);
    upsertEffectFromPush(module, {
      active: kemperActive,
      activeValue
    });
    confirmed = true;
  }

  return confirmed;
}

/**
 * Read Delay/Reverb through their existing module-specific read paths after
 * 0x7C00 reports a relevant status change.
 */
async function refreshDelayReverbStatusFromDevice() {
  delayReverbStatusRefreshTimer = null;

  if (delayReverbStatusRefreshInFlight) {
    delayReverbStatusRefreshQueued = true;
    return;
  }

  delayReverbStatusRefreshInFlight = true;

  try {
    const modules = ["delay", "reverb"]
      .map((key) => getEffectModuleByKey(key))
      .filter(Boolean);
    const effects = await Promise.all(
      modules.map((module) => requestEffectModule(module))
    );

    effects.forEach((effect, index) => {
      const module = modules[index];
      lastEffectOnOffPushAt.set(module.key, Date.now());
      upsertEffectFromPush(module, effect, "refresh");
    });
  } catch (error) {
    console.warn(
      "[Live Companion] Delay/Reverb status refresh failed:",
      error?.message || error
    );
  } finally {
    delayReverbStatusRefreshInFlight = false;
    if (delayReverbStatusRefreshQueued) {
      delayReverbStatusRefreshQueued = false;
      scheduleDelayReverbStatusRefresh();
    }
  }
}

function scheduleDelayReverbStatusRefresh() {
  if (delayReverbStatusRefreshTimer) {
    window.clearTimeout(delayReverbStatusRefreshTimer);
  }

  delayReverbStatusRefreshTimer = window.setTimeout(() => {
    void refreshDelayReverbStatusFromDevice();
  }, DELAY_REVERB_STATUS_REFRESH_DEBOUNCE_MS);
}

function canToggleEffects() {
  return (
    connectionState === CONNECTION_STATE.CONNECTED &&
    !performanceLibraryScanInProgress &&
    !isLoadingPerformanceSlot &&
    !isRefreshingLiveData &&
    !isTogglingEffect
  );
}

async function toggleEffectModule(effectKey) {
  if (!canToggleEffects()) return;

  const module = getEffectModuleByKey(effectKey);
  const knownEffect = lastKnownEffectsByKey[effectKey];
  const control = parameterService.get(effectKey);

  if (!module || !knownEffect?.typeName || !control) return;

  const isCurrentlyActive = isEffectActive(knownEffect);
  const expectedActive = !isCurrentlyActive;
  const expectedRaw = expectedActive ? 1 : 0;
  const parameterIdHex = control.parameterIdHex;

  isTogglingEffect = true;
  setEffectItemBusy(effectKey, true);

  const confirmationPromise = registerEffectWriteConfirmation(
    effectKey,
    expectedActive,
    expectedRaw,
    parameterIdHex
  );

  try {
    await getMidiPorts();

    const result = await control.writeScaled(expectedActive);

    if (!result.ok) {
      clearEffectWriteConfirmation(effectKey, "write-failed");
      throw new Error(result.error || `Toggle ${module.label} failed`);
    }

    const pending = pendingEffectWriteConfirmations.get(effectKey);
    if (pending) {
      pending.expectedRaw = result.rawValue;
    }

    const confirmation = await confirmationPromise;

    if (confirmation.status === "timeout") {
      // UI unchanged — Kemper remains source of truth; no poll fallback.
      console.warn(
        `[Live Companion] Effect toggle unconfirmed for ${module.label} — no Kemper push received.`
      );
    } else if (confirmation.status === "mismatch") {
      console.warn(
        `[Live Companion] Effect toggle rejected by Kemper for ${module.label}.`
      );
    }
  } catch (error) {
    clearEffectWriteConfirmation(effectKey, "write-failed");
    console.warn("[Live Companion] Effect toggle failed:", error.message || error);
  } finally {
    isTogglingEffect = false;
    setEffectItemBusy(effectKey, false);
  }
}

function getAmpSearchText(...values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function normalizeGearName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isPresentCabinetValue(value) {
  return Boolean(String(value ?? "").trim());
}

function valuesMatchIgnoreCase(left, right) {
  const a = normalizeGearName(left);
  const b = normalizeGearName(right);
  return Boolean(a) && a === b;
}

/**
 * @param {{
 *   manufacturer?: unknown,
 *   model?: unknown,
 *   variant?: unknown
 * }} fields
 * @returns {{ label: string, value: string }[]}
 */
function buildRecognizedCabinetRows(fields) {
  /** @type {{ label: string, value: string }[]} */
  const rows = [];
  const manufacturer = String(fields.manufacturer ?? "").trim();
  const model = String(fields.model ?? "").trim();
  const variant = String(fields.variant ?? "").trim();

  if (manufacturer) rows.push({ label: "Manufacturer", value: manufacturer });
  if (model) rows.push({ label: "Model", value: model });
  if (variant) rows.push({ label: "Configuration", value: variant });

  return rows;
}

/**
 * Recognized Cabinet is Gear Library / image-map display data only.
 * Kemper rig cabinet strings are never used as recognized manufacturer/model.
 *
 * @param {{
 *   libraryView?: {
 *     manufacturer?: string,
 *     model?: string,
 *     variant?: string,
 *     imageSrc?: string | null,
 *     recognizedRows?: { label: string, value: string }[]
 *   } | null,
 *   mapEntry?: {
 *     image?: string,
 *     manufacturer?: string,
 *     model?: string,
 *     variant?: string
 *   } | null
 * }} input
 */
function buildRecognizedCabinetView(input) {
  const libraryView = input.libraryView || null;
  const mapEntry = input.mapEntry || null;
  const mapImageSrc = mapEntry?.image ? `/images/cabinets/${mapEntry.image}` : null;
  const mapVariant = String(mapEntry?.variant ?? "").trim();

  if (libraryView) {
    const recognizedRows = [...(libraryView.recognizedRows || [])];
    const hasConfigurationRow = recognizedRows.some((row) =>
      valuesMatchIgnoreCase(row.label, "Configuration")
    );
    if (mapVariant && !hasConfigurationRow) {
      recognizedRows.push({ label: "Configuration", value: mapVariant });
    }

    return {
      manufacturer: libraryView.manufacturer || "",
      model: libraryView.model || "",
      imageSrc: libraryView.imageSrc || mapImageSrc,
      recognizedRows
    };
  }

  const manufacturer = String(mapEntry?.manufacturer ?? "").trim();
  const model = String(mapEntry?.model ?? "").trim();
  const recognizedRows = buildRecognizedCabinetRows({
    manufacturer,
    model,
    variant: mapVariant
  });

  if (!recognizedRows.length && !mapImageSrc) {
    return null;
  }

  return {
    manufacturer,
    model,
    imageSrc: mapImageSrc,
    recognizedRows
  };
}

/**
 * @param {HTMLElement | null} listEl
 * @param {{ label: string, value: string }[]} rows
 */
function fillCabinetDetailList(listEl, rows) {
  if (!listEl) return;
  listEl.replaceChildren();

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "cabinet-details-row";

    const dt = document.createElement("dt");
    dt.textContent = row.label;

    const dd = document.createElement("dd");
    dd.textContent = row.value;
    dd.title = row.value;

    item.append(dt, dd);
    listEl.append(item);
  }
}

/**
 * @param {unknown} name
 * @returns {{ label: string, value: string }[]}
 */
function buildReportedCabinetRows(name) {
  /** @type {{ label: string, value: string }[]} */
  const rows = [];
  const nameText = String(name ?? "").trim();
  if (nameText) {
    rows.push({ label: "Name", value: nameText });
  }
  return rows;
}

/**
 * Cabinet panel display only. Source cabinet fields stay populated.
 * @param {{
 *   isCombo?: boolean,
 *   cabinetName?: string,
 *   recognizedCabinet?: {
 *     recognizedRows?: { label: string, value: string }[],
 *     imageSrc?: string | null,
 *     manufacturer?: string,
 *     model?: string
 *   } | null
 * }} liveData
 */
function renderCabinetSection(liveData) {
  const isCombo = liveData.isCombo === true;
  const recognized = liveData.recognizedCabinet || null;

  const recognizedRows = isCombo
    ? []
    : (recognized?.recognizedRows || []).filter((row) => isPresentCabinetValue(row.value));
  const reportedRows = isCombo ? [] : buildReportedCabinetRows(liveData.cabinetName);

  const showRecognized = recognizedRows.length > 0;
  const showReported = reportedRows.length > 0;
  const showImage = !isCombo && Boolean(recognized?.imageSrc);

  if (cabinetSection) {
    cabinetSection.dataset.combo = isCombo ? "true" : "false";
  }

  if (cabinetComboLabel) {
    cabinetComboLabel.hidden = !isCombo;
  }

  if (cabinetRecognizedGroup) {
    cabinetRecognizedGroup.hidden = !showRecognized;
  }
  fillCabinetDetailList(cabinetRecognizedList, showRecognized ? recognizedRows : []);

  if (cabinetReportedGroup) {
    cabinetReportedGroup.hidden = !showReported;
  }
  fillCabinetDetailList(cabinetReportedList, showReported ? reportedRows : []);

  if (!cabinetImageContainer) return;

  if (!showImage) {
    cabinetImageContainer.innerHTML = "";
    cabinetImageContainer.hidden = true;
    return;
  }

  cabinetImageContainer.hidden = false;
  const image = document.createElement("img");
  image.src = recognized.imageSrc;
  image.className = "cabinet-image";
  image.alt =
    [recognized.manufacturer, recognized.model].filter(Boolean).join(" ") || "Cabinet";
  cabinetImageContainer.replaceChildren(image);
}

function deriveManufacturer(ampName, modelName) {
  const searchText = getAmpSearchText(ampName, modelName);
  const match = MANUFACTURER_PATTERNS.find(([needle]) => searchText.includes(needle));
  return match ? match[1] : "Unknown";
}

function formatLibraryAmpYear(introduced) {
  if (introduced === undefined || introduced === null || introduced === "") return "";
  const match = String(introduced).match(/\d{4}/);
  return match ? match[0] : String(introduced).trim();
}

/**
 * Resolves Kemper amp/rig strings to the canonical Gear Library AmpRecord.
 * Amp name and rig name are scored independently; best alias wins.
 * Creator names are lookup input only — never for display.
 */
function resolveLiveAmpRecord(
  liveRigName,
  liveAmpName,
  liveAmpManufacturer,
  liveAmpModel
) {
  return resolveAmpRecordFromTextSources(
    liveAmpName,
    liveRigName,
    liveAmpManufacturer,
    liveAmpModel
  );
}

function normalizeCabinetSearch(text) {
  let result = text.toLowerCase();

  Object.entries(CAB_BRAND_ALIASES).forEach(([brand, aliases]) => {
    aliases.forEach(alias => {
      result = result.replaceAll(alias.toLowerCase(), brand);
    });
  });

  return result;
}

function getCabinetEntryConfiguration(entry) {
  return getCabinetConfiguration(
    entry.configuration,
    entry.image,
    ...(entry.aliases || [])
  );
}

function matchCabinetImageMapEntry(manufacturer, model, configuration = "") {
  const normalizedConfiguration = getCabinetConfiguration(configuration);
  const search = normalizeCabinetSearch(
    `${manufacturer} ${model} ${normalizedConfiguration}`.trim()
  );
  let bestMatch = null;
  let bestScore = -Infinity;

  for (const entry of cabinetImageMap) {
    const entryConfiguration = getCabinetEntryConfiguration(entry);

    if (
      normalizedConfiguration &&
      entryConfiguration &&
      entryConfiguration !== normalizedConfiguration
    ) {
      continue;
    }

    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeCabinetSearch(alias);

      if (!search.includes(normalizedAlias)) continue;

      let score = normalizedAlias.length;

      if (normalizedConfiguration && entryConfiguration === normalizedConfiguration) {
        score += 1000;
      }

      if (score > bestScore) {
        bestMatch = entry;
        bestScore = score;
      }
    }
  }

  return bestMatch;
}

function getCabinetImage(manufacturer, model, configuration = "") {
  return matchCabinetImageMapEntry(manufacturer, model, configuration)?.image || "";
}

function getCabinetConfiguration(...values) {
  const searchText = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const explicitMatch = searchText.match(
    /(?:^|[^0-9])([1-9])\s*[x*×]\s*(1[0-9]|[8-9])(?:$|[^0-9])/
  );

  if (explicitMatch) {
    return `${explicitMatch[1]}x${explicitMatch[2]}`;
  }

  const compactMatch = searchText.match(/(?:^|[^0-9])([1-9])(1[0-9]|[8-9])(?:$|[^0-9])/);

  if (compactMatch) {
    return `${compactMatch[1]}x${compactMatch[2]}`;
  }

  return "";
}

function removeCabinetConfiguration(model, configuration) {
  if (!model || !configuration) return model || "";

  const [speakers, size] = configuration.split("x");
  const explicitPattern = new RegExp(`(^|[^0-9])${speakers}\\s*x\\s*${size}($|[^0-9])`, "gi");
  const compactPattern = new RegExp(`(^|[^a-z0-9])${speakers}${size}($|[^a-z0-9])`, "gi");

  return model
    .replace(explicitPattern, "$1$2")
    .replace(compactPattern, "$1$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function requestEffectModule(module) {
  const onOffAddress = [module.page, module.onOff];
  const typeAddress = [module.page, module.type];

  const [activeValue, typeValue] = await Promise.all([
    requestNumericParam(onOffAddress),
    requestNumericParam(typeAddress)
  ]);

  const renderedTypeName = await requestRenderedString(typeAddress, typeValue);

  const typeName = getEffectName(renderedTypeName, typeValue, module);
  const kemperActive = isBooleanOn(activeValue);

  return {
    ...module,
    active: kemperActive,
    activeValue,
    typeValue,
    typeName,
    image: getModuleEffectImage(typeName, module)
  };
}

async function requestEffectsData() {
  return await Promise.all(
    EFFECT_MODULES.map(module => requestEffectModule(module))
  );
}

async function requestLiveKemperData() {
  const currentRigName = await requestCurrentRigName();
  const [
    liveRigAuthor,
    liveAmpName,
    liveAmpManufacturer,
    liveAmpModel,
    liveAmpYear,
    liveCabinetName,
    liveCabinetManufacturer,
    liveCabinetModel,
    liveSpeakerConfiguration,
    liveGainValue,
    liveTempoValue
  ] =
    await Promise.all([
      requestStringTag(STRING_TAGS.rigAuthor),
      requestStringTag(STRING_TAGS.ampName),
      requestStringTag(STRING_TAGS.ampManufacturer),
      requestStringTag(STRING_TAGS.ampModel),
      requestStringTag(STRING_TAGS.ampYearOfProduction),
      requestStringTag(STRING_TAGS.cabinetName),
      requestStringTag(STRING_TAGS.cabinetManufacturer),
      requestStringTag(STRING_TAGS.cabinetModel),
      requestStringTag(STRING_TAGS.speakerConfiguration),
      requestNumericParam(NUMERIC_PARAMS.gain),
      requestNumericParam(NUMERIC_PARAMS.tempoBpm)
    ]);
  console.info("[Live Companion] Speaker Configuration:", liveSpeakerConfiguration);
  const effects = await Promise.all(
  EFFECT_MODULES.map(module => requestEffectModule(module))
);

  const resolvedAmp = resolveLiveAmpRecord(
    currentRigName,
    liveAmpName,
    liveAmpManufacturer,
    liveAmpModel
  );

  const resolvedCabinet = resolveCabinetRecordFromTextSources(
    liveCabinetName,
    liveCabinetManufacturer,
    liveCabinetModel
  );
  const libraryCabinetView = resolvedCabinet?.id
    ? getCabinetDetailView(resolvedCabinet.id)
    : null;
  const mapEntry = matchCabinetImageMapEntry(
    liveCabinetManufacturer,
    liveCabinetModel || liveCabinetName,
    liveSpeakerConfiguration || liveCabinetName
  );
  const recognizedCabinet = buildRecognizedCabinetView({
    libraryView: libraryCabinetView,
    mapEntry
  });

  const libraryYear = formatLibraryAmpYear(resolvedAmp?.introduced);
  const libraryDetail = resolvedAmp?.id ? getAmpDetailView(resolvedAmp.id) : null;
  const libraryPower = libraryDetail?.power || "";
  const libraryTubeConfiguration = libraryDetail?.valveConfiguration?.length
    ? libraryDetail.valveConfiguration
        .map(({ label, value }) => `${label}: ${value}`)
        .join("\n")
    : "";

  return {
    rigName: currentRigName,
    rigAuthor: liveRigAuthor || "",
    ampId: resolvedAmp?.id ?? null,
    isCombo: resolvedAmp?.isCombo === true,
    ampName: liveAmpName,
    manufacturer: resolvedAmp?.manufacturer ?? "",
    ampModel: resolvedAmp?.model ?? "",
    libraryYear,
    libraryPower,
    libraryTubeConfiguration,
    productionYear: libraryYear || liveAmpYear || "",
    originalRigName: currentRigName || "",
    originalAmpName: liveAmpName || "",
    originalCabinetName: liveCabinetName || "",
    ampImageSrc: resolvedAmp ? getAmpImage(resolvedAmp.id) : null,
    cabinetName: String(liveCabinetName || "").trim(),
    cabinetManufacturer: String(liveCabinetManufacturer || "").trim(),
    cabinetModel: String(liveCabinetModel || "").trim(),
    speakerConfiguration: String(liveSpeakerConfiguration ?? ""),
    recognizedCabinet,
    gain: formatGain(liveGainValue),
    gainRaw: liveGainValue,
    tempoBpmRaw: liveTempoValue,
    effects
  };
}

function createEffectItem(effect) {
  const item = document.createElement("li");
  item.dataset.key = effect.key;

  const image = document.createElement("img");
  image.hidden = true;

  const led = document.createElement("i");
  led.className = "effect-led";
  led.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  const name = document.createElement("strong");

  item.append(image, led, label, name);
  return item;
}

function createEffectChainHeading(key, title) {
  const item = document.createElement("li");
  const label = document.createElement("span");

  item.className = "effect-chain-heading";
  item.dataset.chainHeading = key;
  label.textContent = title;
  item.append(label);

  return item;
}

function ensureEffectChainHeading(key, title) {
  let item = effectsList.querySelector(`li[data-chain-heading="${key}"]`);

  if (!item) {
    item = createEffectChainHeading(key, title);
    effectsList.append(item);
  }

  return item;
}

function updateEffectItem(item, effect) {
  const hasEffect = Boolean(effect.typeName);
  const state = hasEffect ? (isEffectActive(effect) ? "on" : "off") : "empty";
  const displayName = effect.typeName || "";
  const image = item.querySelector("img");
  const label = item.querySelector("span");
  const name = item.querySelector("strong");
  const isClickable = hasEffect && canToggleEffects();

  if (item.dataset.state !== state) {
    item.dataset.state = state;
  }

  if (item.dataset.effectName !== displayName) {
    item.dataset.effectName = displayName;
    name.textContent = displayName;
  }

  if (item.dataset.effectLabel !== effect.label) {
    item.dataset.effectLabel = effect.label;
    label.textContent = effect.label;
  }

  if (item.dataset.effectImage !== (effect.image || "")) {
    item.dataset.effectImage = effect.image || "";

    if (effect.image) {
      image.src = `./images/effects/${effect.image}`;
      image.alt = displayName;
      image.hidden = false;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      image.hidden = true;
    }
  } else if (image.alt !== displayName) {
    image.alt = displayName;
  }

  item.tabIndex = isClickable ? 0 : -1;
  item.setAttribute("role", hasEffect ? "button" : "presentation");
  item.setAttribute("aria-pressed", hasEffect && state === "on" ? "true" : "false");
  item.setAttribute("aria-disabled", hasEffect && !canToggleEffects() ? "true" : "false");
  item.setAttribute(
    "aria-label",
    hasEffect
      ? `${effect.label}: ${displayName}, ${state === "on" ? "ein" : "aus"}`
      : effect.label
  );
}

function renderEffects(effects) {
  effects.forEach((effect) => {
    lastKnownEffectsByKey[effect.key] = effect;

    if (effect.key === "stompA") {
      ensureEffectChainHeading("pre", "PRE AMP");
    }

    if (effect.key === "stompX") {
      ensureEffectChainHeading("post", "POST AMP");
    }

    let item = effectsList.querySelector(`li[data-key="${effect.key}"]`);

    if (!item) {
      item = createEffectItem(effect);
      effectsList.append(item);
    }

    updateEffectItem(item, effect);
  });

  liveViewController?.syncEffectsTriColumnLayout?.();
}

function gainRawToScaleValue(rawValue) {
  const formatted = formatGain(rawValue);
  const numericValue = Number(formatted);

  if (Number.isFinite(numericValue)) {
    return Math.max(0, Math.min(GAIN_SCALE_MAX, numericValue));
  }

  if (rawValue === null || rawValue === undefined) return null;
  return Math.max(0, Math.min(GAIN_SCALE_MAX, rawValue / 1638.3));
}

function ensureGainScaleTicks() {
  if (!gainScaleTicks || gainScaleTicks.childElementCount === GAIN_SCALE_TICK_COUNT) {
    return;
  }

  gainScaleTicks.innerHTML = Array.from({ length: GAIN_SCALE_TICK_COUNT }, (_, index) => {
    const isMajor = index % 10 === 0;
    const isMid = !isMajor && index % 5 === 0;
    const tickClass = isMajor
      ? "gain-scale-tick is-major"
      : isMid
        ? "gain-scale-tick is-mid"
        : "gain-scale-tick";
    return `<i class="${tickClass}"></i>`;
  }).join("");
}

function applyGainDisplay(rawValue, formattedValue = "") {
  if (!gainScale || !gainScaleFill || !gainScaleMarker || !gainScaleValue) {
    return;
  }

  ensureGainScaleTicks();

  const scaleValue =
    formattedValue !== "" && Number.isFinite(Number(formattedValue))
      ? Math.max(0, Math.min(GAIN_SCALE_MAX, Number(formattedValue)))
      : gainRawToScaleValue(rawValue);

  if (scaleValue === null || !Number.isFinite(scaleValue)) {
    gainLocalRawValue = null;
    gainScale.dataset.hasValue = "false";
    gainScaleValue.textContent = "—";
    gainScaleFill.style.width = "0%";
    gainScaleMarker.style.left = "0%";
    gainScale.setAttribute("aria-valuenow", "0");
    gainScale.setAttribute("aria-valuetext", "unavailable");
    return;
  }

  const display = scaleValue.toFixed(1);
  const percent = (scaleValue / GAIN_SCALE_MAX) * 100;
  const raw =
    rawValue != null && Number.isFinite(Number(rawValue))
      ? Math.max(0, Math.min(16383, Math.round(Number(rawValue))))
      : Math.round(scaleValue * 1638.3);

  gainLocalRawValue = raw;
  gainScale.dataset.hasValue = "true";
  gainScaleValue.textContent = display;
  gainScaleFill.style.width = `${percent}%`;
  /* Keep green→amber→orange mapped to the full 0–10 track, not the fill width */
  gainScaleFill.style.backgroundSize =
    percent > 0 ? `${(100 / percent) * 100}% 100%` : "100% 100%";
  gainScaleFill.style.backgroundPosition = "left center";
  gainScaleMarker.style.left = `${percent}%`;
  gainScale.setAttribute("aria-valuenow", display);
  gainScale.setAttribute("aria-valuetext", `${display} of ${GAIN_SCALE_MAX}`);
}

function canControlGain() {
  return (
    isConnectionOperational() &&
    !performanceLibraryScanInProgress &&
    !isLoadingPerformanceSlot
  );
}

/**
 * @param {number} clientX
 * @returns {number | null}
 */
function pointerToGainScaleValue(clientX) {
  const track = document.querySelector("#gainScaleTrack") || gainScale?.querySelector(".gain-scale-track");
  if (!track) return null;
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(GAIN_SCALE_MAX, ratio * GAIN_SCALE_MAX));
}

/**
 * @param {number} scaleValue 0–10
 * @param {{ send?: boolean }} [options]
 */
function setGainFromScaleValue(scaleValue, options = {}) {
  const send = options.send !== false;
  const clamped = Math.max(0, Math.min(GAIN_SCALE_MAX, scaleValue));
  const raw = Math.max(0, Math.min(16383, Math.round(clamped * 1638.3)));
  if (gainScale) gainScale.dataset.source = "local";
  applyGainDisplay(raw, clamped.toFixed(1));
  if (send) queueGainParameterWrite(raw);
}

/**
 * @param {number} rawValue
 */
function queueGainParameterWrite(rawValue) {
  pendingGainWriteRaw = Math.max(0, Math.min(16383, Math.round(rawValue)));
  if (gainWriteTimer != null) return;

  const flush = async () => {
    gainWriteTimer = null;
    const raw = pendingGainWriteRaw;
    pendingGainWriteRaw = null;
    if (raw == null || !canControlGain()) return;

    try {
      await getMidiPorts();
      const result = await parameterService.setParameter(
        CONTROL_PARAMETERS.gain.parameterId,
        raw
      );
      if (result.ok) {
        // Suppress echo race briefly; Kemper push remains authoritative afterward.
        lastGainPushAt = Date.now();
      }
    } catch (error) {
      console.warn("[Live Companion] Gain write failed:", error?.message || error);
    }

    if (pendingGainWriteRaw != null) {
      gainWriteTimer = window.setTimeout(flush, GAIN_WRITE_INTERVAL_MS);
    }
  };

  gainWriteTimer = window.setTimeout(flush, 0);
}

function endGainPointerInteraction() {
  if (!gainScale) return;
  gainInteractionActive = false;
  gainDragPointerId = null;
  gainScale.dataset.dragging = "false";
}

/**
 * Wire click/drag/keyboard Gain control → SysEx parameter writes.
 */
function bindGainScaleControl() {
  if (!gainScale) return;

  const track =
    document.querySelector("#gainScaleTrack") ||
    gainScale.querySelector(".gain-scale-track");
  if (!track) return;

  gainScale.dataset.interactive = "true";

  const applyFromClientX = (clientX) => {
    const scaleValue = pointerToGainScaleValue(clientX);
    if (scaleValue == null) return;
    setGainFromScaleValue(scaleValue, { send: true });
  };

  track.addEventListener("pointerdown", (event) => {
    if (!canControlGain()) return;
    if (event.button != null && event.button !== 0) return;

    gainInteractionActive = true;
    gainDragPointerId = event.pointerId;
    gainScale.dataset.dragging = "true";
    track.setPointerCapture?.(event.pointerId);
    applyFromClientX(event.clientX);
    event.preventDefault();
  });

  track.addEventListener("pointermove", (event) => {
    if (!gainInteractionActive || event.pointerId !== gainDragPointerId) return;
    applyFromClientX(event.clientX);
    event.preventDefault();
  });

  const release = (event) => {
    if (event.pointerId != null && event.pointerId !== gainDragPointerId) return;
    endGainPointerInteraction();
  };

  track.addEventListener("pointerup", release);
  track.addEventListener("pointercancel", release);
  track.addEventListener("lostpointercapture", () => {
    endGainPointerInteraction();
  });

  gainScale.addEventListener("keydown", (event) => {
    if (!canControlGain()) return;
    const current =
      gainRawToScaleValue(gainLocalRawValue) ??
      Number(gainScale.getAttribute("aria-valuenow"));
    if (!Number.isFinite(current)) return;

    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 0.1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 0.1;
    else if (event.key === "PageUp") next += 1;
    else if (event.key === "PageDown") next -= 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = GAIN_SCALE_MAX;
    else return;

    event.preventDefault();
    gainInteractionActive = true;
    setGainFromScaleValue(next, { send: true });
    window.setTimeout(() => {
      gainInteractionActive = false;
    }, PUSH_CONFIRM_WINDOW_MS);
  });
}

async function refreshGainAfterMorph() {
  await delay(MORPH_GAIN_READ_DELAY_MS);

  if (!isConnectionOperational()) return;

  if (canUseBidirectionalPushSync() && wasPushedRecently(lastGainPushAt, MORPH_GAIN_READ_DELAY_MS + 250)) {
    return;
  }

  try {
    const rawValue = await requestNumericParam(NUMERIC_PARAMS.gain);
    if (rawValue === null || rawValue === undefined) return;
    renderGain(formatGain(rawValue), rawValue);
  } catch {
    // Morph gain test read failed silently.
  }
}

/**
 * Apply one effect slot update from bidirectional push (Kemper wins).
 * @param {typeof EFFECT_MODULES[number]} module
 * @param {{ active?: boolean, activeValue?: number, typeValue?: number, typeName?: string }} patch
 * @param {"push" | "refresh" | "enrich"} [source]
 */
function upsertEffectFromPush(module, patch, source = "push") {
  const previous = lastKnownEffectsByKey[module.key] || {
    ...module,
    active: false,
    activeValue: 0,
    typeValue: 0,
    typeName: "",
    image: ""
  };

  const typeValue =
    patch.typeValue !== undefined ? patch.typeValue : previous.typeValue;
  const typeName =
    patch.typeName !== undefined
      ? patch.typeName
      : getEffectName("", typeValue, module) || previous.typeName;

  if (
    patch.typeValue !== undefined &&
    typeValue &&
    typeName
  ) {
    observeEffectType(typeValue, typeName);
  }

  const next = {
    ...previous,
    ...module,
    active: patch.active !== undefined ? patch.active : previous.active,
    activeValue:
      patch.activeValue !== undefined ? patch.activeValue : previous.activeValue,
    typeValue,
    typeName,
    image: getModuleEffectImage(typeName, module)
  };

  lastKnownEffectsByKey[module.key] = next;
  void source;

  if (!effectsList) return;

  if (module.key === "stompA") {
    ensureEffectChainHeading("pre", "PRE AMP");
  }
  if (module.key === "stompX") {
    ensureEffectChainHeading("post", "POST AMP");
  }

  let item = effectsList.querySelector(`li[data-key="${module.key}"]`);
  if (!item) {
    item = createEffectItem(next);
    effectsList.append(item);
  }
  updateEffectItem(item, next);
}

/**
 * One-shot rendered-string lookup when push delivers an unknown effect type id.
 * @param {typeof EFFECT_MODULES[number]} module
 * @param {number} typeValue
 */
async function enrichEffectTypeNameFromDevice(module, typeValue) {
  const enrichKey = `${module.key}:${typeValue}`;
  if (effectTypeEnrichInFlight.has(enrichKey)) return;
  effectTypeEnrichInFlight.add(enrichKey);

  try {
    const rendered = await requestRenderedString(
      [module.page, module.type],
      typeValue
    );
    const typeName = getEffectName(rendered, typeValue, module);
    if (!typeName) return;

    const current = lastKnownEffectsByKey[module.key];
    if (!current || current.typeValue !== typeValue) return;
    upsertEffectFromPush(module, { typeValue, typeName }, "enrich");
  } catch {
    // silent — keep numeric/empty label until next refresh
  } finally {
    effectTypeEnrichInFlight.delete(enrichKey);
  }
}

/**
 * @param {string | null | undefined} ascii
 */
function scheduleRigChangeRefreshFromPush(ascii) {
  const nextName = String(ascii || "").trim();
  if (!nextName || nextName === currentRigName) return;
  if (performanceLibraryScanInProgress || isLoadingPerformanceSlot) return;

  currentRigName = nextName;
  if (rigName) {
    rigName.textContent = nextName;
    rigName.title = nextName;
  }

  if (rigChangeRefreshTimer != null) {
    window.clearTimeout(rigChangeRefreshTimer);
  }

  rigChangeRefreshTimer = window.setTimeout(() => {
    rigChangeRefreshTimer = null;
    if (
      isRefreshingLiveData ||
      isLoadingPerformanceSlot ||
      performanceLibraryScanInProgress ||
      !isConnectionOperational()
    ) {
      return;
    }
    void refreshLiveData();
  }, RIG_CHANGE_REFRESH_DEBOUNCE_MS);
}

/**
 * Bridge bidirectional ParameterStateStore → live stage UI.
 * Outgoing controls are unchanged; Kemper push is preferred source of truth.
 * @param {{ result: { changed: boolean, initial: boolean, state: any } }} event
 */
function handleBidirectionalLivePush(event) {
  const result = event?.result;
  const state = result?.state;
  if (!state || performanceLibraryScanInProgress || isLoadingPerformanceSlot) {
    return;
  }

  const id = state.id;

  if (id === LIVE_PUSH_PARAM.tempoBpm) {
    lastTempoPushAt = Date.now();
    if (state.rawValue != null) {
      renderCurrentTempo(state.rawValue);
    }
    return;
  }

  if (id === LIVE_PUSH_PARAM.gain) {
    lastGainPushAt = Date.now();
    // Local drag temporarily owns the knob; otherwise Kemper is source of truth.
    if (gainInteractionActive) return;
    if (state.rawValue != null) {
      syncGainFromDevice(state.rawValue);
    }
    return;
  }

  if (id === LIVE_PUSH_PARAM.rigName) {
    if (result.changed) {
      scheduleRigChangeRefreshFromPush(state.ascii);
    } else if (result.initial && state.ascii && !currentRigName) {
      currentRigName = String(state.ascii).trim();
      if (rigName && currentRigName) {
        rigName.textContent = currentRigName;
        rigName.title = currentRigName;
      }
    }
    return;
  }

  if (id === DELAY_REVERB_SYNC_STATUS_PARAM_ID) {
    tryConfirmDelayReverbFromSyncStatus(state, result);
    scheduleDelayReverbStatusRefresh();
    return;
  }

  const onOffModule = EFFECT_ON_OFF_BY_PARAM_ID.get(id);
  if (onOffModule) {
    lastEffectOnOffPushAt.set(onOffModule.key, Date.now());
    const kemperActive = isBooleanOn(state.rawValue);
    const activeValue = kemperActive ? 1 : 0;

    settleEffectWriteConfirmation(onOffModule, activeValue, state.rawValue);
    upsertEffectFromPush(onOffModule, {
      active: kemperActive,
      activeValue
    });
    return;
  }

  const typeModule = EFFECT_TYPE_BY_PARAM_ID.get(id);
  if (typeModule && state.rawValue != null) {
    const typeValue = state.rawValue;
    const typeName = getEffectName("", typeValue, typeModule);

    upsertEffectFromPush(typeModule, { typeValue, typeName });
    if (!typeName && typeValue) {
      void enrichEffectTypeNameFromDevice(typeModule, typeValue);
    }
  }
}

function renderGain(value, rawValue) {
  if (!gainScale) return;

  const hasFormattedValue = value !== null && value !== undefined && value !== "";
  const hasRawValue = rawValue !== null && rawValue !== undefined;

  if (!hasFormattedValue && !hasRawValue) {
    applyGainDisplay(null, "");
    return;
  }

  const formatted = hasFormattedValue ? String(value) : formatGain(rawValue);
  const raw = hasRawValue ? rawValue : Math.round(Number(value) * 1638.3);
  applyGainDisplay(raw, formatted);
}

/**
 * Apply a Kemper-reported Gain value to the slider (animated, no user action).
 * @param {number} rawValue
 */
function syncGainFromDevice(rawValue) {
  if (!gainScale || rawValue == null || !Number.isFinite(Number(rawValue))) {
    return;
  }

  // Ensure remote updates always animate (even right after a local drag).
  gainScale.dataset.dragging = "false";
  gainScale.dataset.source = "device";

  const raw = Math.max(0, Math.min(16383, Math.round(Number(rawValue))));
  // Skip redundant paints only when already showing the same raw value.
  if (gainLocalRawValue === raw && gainScale.dataset.hasValue === "true") return;

  renderGain(formatGain(raw), raw);
}

function startRigMonitor() {
  if (monitorTimer) return;

  monitorTimer = window.setInterval(async () => {
    if (
      performanceLibraryScanInProgress ||
      isLoadingPerformanceSlot ||
      isRefreshingLiveData ||
      isCheckingRigName ||
      isTogglingEffect ||
      !midiAccess
    ) {
      return;
    }

    // Hybrid path: when Kemper push + lease are healthy, skip steady-state
    // effects/tempo/rig-name polling. Connection health uses sensing traffic.
    if (canUseBidirectionalPushSync()) {
      consecutiveMonitorFailures = 0;
      if (connectionState !== CONNECTION_STATE.CONNECTED) {
        setConnectionState(CONNECTION_STATE.CONNECTED);
      }
      return;
    }

    isCheckingRigName = true;

    try {
      // Legacy / fallback poll when bidirectional push is not healthy.
      const nextRigName = await requestCurrentRigName();

      consecutiveMonitorFailures = 0;
      setConnectionState(CONNECTION_STATE.CONNECTED);

      if (nextRigName && currentRigName && nextRigName !== currentRigName) {
        await refreshLiveData();
      } else {
        const effects = await requestEffectsData();
        renderEffects(effects);
        await refreshTempoOnly({ force: true });
      }
    } catch {
      consecutiveMonitorFailures += 1;

      if (consecutiveMonitorFailures >= MONITOR_FAILURE_LIMIT) {
        handleDisconnected();
      }
    } finally {
      isCheckingRigName = false;
    }
  }, 250);
}

async function refreshLiveData() {
  if (isRefreshingLiveData) return;

  const refreshStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;
  isRefreshingLiveData = true;

  if (initialBootComplete) {
    setConnectionState(CONNECTION_STATE.REFRESHING);
  }

  try {
    const requestLiveStartedAt = DEBUG_RIG_SWITCH_TIMING ? performance.now() : 0;
    const liveData = await requestLiveKemperData();
    logRigSwitchTiming("requestLiveKemperData", requestLiveStartedAt);
    currentRigName = liveData.rigName || currentRigName;
    rigName.textContent = liveData.rigName || "-";
    syncRigNotesInput();
    ampManufacturer.textContent = liveData.manufacturer || "-";
    ampModel.textContent = liveData.ampModel || "-";
    ampModel.title = liveData.ampModel || "";

    if (ampDetailsManufacturer) {
      ampDetailsManufacturer.textContent = liveData.manufacturer || "-";
      ampDetailsManufacturer.title = liveData.manufacturer || "";
    }

    if (ampDetailsModel) {
      ampDetailsModel.textContent = liveData.ampModel || "-";
      ampDetailsModel.title = liveData.ampModel || "";
    }

    if (ampDetailsYear) {
      const year = liveData.libraryYear || "";
      if (ampDetailsYearRow) {
        ampDetailsYearRow.hidden = !year;
      }
      ampDetailsYear.textContent = year || "-";
      ampDetailsYear.title = year;
    }

    if (ampDetailsPower) {
      const power = liveData.libraryPower || "";
      if (ampDetailsPowerRow) {
        ampDetailsPowerRow.hidden = !power;
      }
      ampDetailsPower.textContent = power || "-";
      ampDetailsPower.title = power;
    }

    if (ampDetailsTubeConfiguration) {
      const tubes = liveData.libraryTubeConfiguration || "";
      if (ampDetailsTubeRow) {
        ampDetailsTubeRow.hidden = !tubes;
      }
      ampDetailsTubeConfiguration.textContent = tubes || "-";
      ampDetailsTubeConfiguration.title = tubes.replaceAll("\n", " · ");
    }

    if (rigAuthor) {
      rigAuthor.textContent = liveData.rigAuthor || "-";
      rigAuthor.title = liveData.rigAuthor || "";
    }

    if (ampDetailsOriginalRigName) {
      ampDetailsOriginalRigName.textContent = liveData.originalRigName || "-";
      ampDetailsOriginalRigName.title = liveData.originalRigName || "";
    }

    if (ampDetailsOriginalAmpName) {
      ampDetailsOriginalAmpName.textContent = liveData.originalAmpName || "-";
      ampDetailsOriginalAmpName.title = liveData.originalAmpName || "";
    }

    currentLiveAmpId = liveData.ampId ?? null;
    ampImageContainer.innerHTML = "";
    if (liveData.ampImageSrc) {
      const ampImage = document.createElement("img");
      ampImage.src = liveData.ampImageSrc;
      ampImage.className = "amp-image";
      ampImage.alt = liveData.ampModel || liveData.manufacturer || "Amplifier";
      ampImageContainer.append(ampImage);
      liveViewController?.scheduleAmpOnlyImageFit?.();
    }
    updateLiveAmpDetailAffordance();

    productionYear.textContent =
      liveData.productionYear && liveData.productionYear !== "Unknown"
        ? `Amp Year ${liveData.productionYear}`
        : "";
    renderCabinetSection(liveData);
    renderGain(liveData.gain, liveData.gainRaw);
    renderCurrentTempo(liveData.tempoBpmRaw);
    renderEffects(liveData.effects);
    syncPerformanceBrowserWithKemperRigMatch();
    updateRigNameNavButtons();
    consecutiveMonitorFailures = 0;
    setConnectionState(CONNECTION_STATE.CONNECTED);
    startRigMonitor();
  } catch (error) {
    setConnectionState(CONNECTION_STATE.NO_MIDI);
  } finally {
    isRefreshingLiveData = false;
    logRigSwitchTiming("refreshLiveData total", refreshStartedAt);
  }
}

async function refreshEffectsOnly() {
  try {
    const effects = await requestEffectsData();
    renderEffects(effects);
  } catch {
    // silent
  }
}

if (ampImageContainer) {
  ampImageContainer.addEventListener("click", () => {
    openLiveAmpDetailsOverlay();
  });
  ampImageContainer.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openLiveAmpDetailsOverlay();
  });
}

if (createLibraryButton) {
  createLibraryButton.addEventListener("click", createPerformanceLibrary);
}

if (performanceExplorerSearch) {
  performanceExplorerSearch.addEventListener("focus", () => {
    if (!performanceExplorerExpanded) {
      setPerformanceExplorerExpanded(true);
    }
  });
  performanceExplorerSearch.addEventListener("input", () => {
    if (!performanceExplorerExpanded) {
      setPerformanceExplorerExpanded(true);
      return;
    }
    renderPerformanceExplorer();
  });
  performanceExplorerSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setPerformanceExplorerExpanded(false);
    performanceExplorerSearch.blur();
  });
}

if (livePage) {
  livePage.addEventListener("click", (event) => {
    if (performanceExplorerExpanded) return;
    if (!isPerformanceBrowserEntrySurfaceTarget(event.target)) return;
    if (isPerformanceBrowserEntryInteractiveException(event.target)) return;
    activatePerformanceBrowserEntry();
    event.stopPropagation();
  });
}

document.addEventListener("click", (event) => {
  if (!performanceExplorerExpanded) return;
  if (isPerformanceExplorerEventTarget(event.target)) return;
  setPerformanceExplorerExpanded(false);
});

if (performanceExplorerList) {
  performanceExplorerList.addEventListener("click", (event) => {
    const chip = event.target.closest(".performance-explorer-slot");
    if (!chip || chip.disabled) return;

    const performanceIndex = chip.dataset.performanceIndex;
    const slotIndex = Number(chip.dataset.slotIndex);
    if (!performanceIndex || !slotIndex) return;

    selectExplorerPerformanceSlot(performanceIndex, slotIndex);
  });
}

if (performancePrevFastButton) {
  performancePrevFastButton.addEventListener("click", () => selectPerformanceByOffset(-10));
}

if (performancePrevButton) {
  performancePrevButton.addEventListener("click", () => selectAdjacentPerformance(-1));
}

if (performanceNextButton) {
  performanceNextButton.addEventListener("click", () => selectAdjacentPerformance(1));
}

if (performanceNextFastButton) {
  performanceNextFastButton.addEventListener("click", () => selectPerformanceByOffset(10));
}

if (performanceReloadButton) {
  performanceReloadButton.addEventListener("click", () => {
    void reloadCurrentPerformanceFromDevice();
  });
}

if (performanceBrowserLabel) {
  performanceBrowserLabel.addEventListener("click", (event) => {
    if (event.target.closest(".performance-browser-label-input")) return;
    beginPerformanceNameEdit();
  });
  performanceBrowserLabel.addEventListener("keydown", (event) => {
    if (event.target !== performanceBrowserLabel) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    beginPerformanceNameEdit();
  });
}

if (rigNotesInput) {
  rigNotesInput.addEventListener("input", () => {
    if (rigNotesSaveTimer != null) window.clearTimeout(rigNotesSaveTimer);
    rigNotesSaveTimer = window.setTimeout(flushRigNote, RIG_NOTES_SAVE_DEBOUNCE_MS);
  });
  rigNotesInput.addEventListener("blur", flushRigNote);
}

if (rigNamePrevButton) {
  rigNamePrevButton.addEventListener("click", () => {
    void selectAdjacentRigSlot(-1);
  });
}

if (rigNameNextButton) {
  rigNameNextButton.addEventListener("click", () => {
    void selectAdjacentRigSlot(1);
  });
}

if (performanceSlotGrid) {
  performanceSlotGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".performance-slot-card");
    if (!card || card.disabled) return;

    const performanceIndex = card.dataset.performanceIndex;
    const slotIndex = Number(card.dataset.slotIndex);
    if (!performanceIndex || !slotIndex) return;

    loadBrowserPerformanceSlot(performanceIndex, slotIndex);
  });

  const performanceSlotGridWrap = performanceSlotGrid.parentElement;
  if (performanceSlotIndicatorRow && performanceSlotGridWrap) {
    const syncPerformanceSlotActiveIndicatorLayout = () => {
      updatePerformanceSlotActiveIndicators();
    };
    const performanceSlotIndicatorResizeObserver = new ResizeObserver(
      syncPerformanceSlotActiveIndicatorLayout
    );
    performanceSlotIndicatorResizeObserver.observe(performanceSlotGrid);
    performanceSlotIndicatorResizeObserver.observe(performanceSlotGridWrap);
  }
}

if (effectsList) {
  effectsList.addEventListener("click", (event) => {
    const item = event.target.closest("li[data-key]");
    if (!item || item.dataset.state === "empty" || item.dataset.busy === "true") return;

    toggleEffectModule(item.dataset.key);
  });

  effectsList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const item = event.target.closest("li[data-key]");
    if (!item || item.dataset.state === "empty" || item.dataset.busy === "true") return;

    event.preventDefault();
    toggleEffectModule(item.dataset.key);
  });
}

if (tunerToggleButton) {
  tunerToggleButton.addEventListener("click", toggleTuner);
}

if (morphActionButton) {
  morphActionButton.addEventListener("click", triggerMorphAction);
}

if (tempoPanelToggle) {
  tempoPanelToggle.addEventListener("click", () => {
    setTempoPanelExpanded(!tempoPanelExpanded);
  });
}

if (tempoSetButton) {
  tempoSetButton.addEventListener("click", handleTempoSetRequest);
}

if (tempoTapButton) {
  tempoTapButton.addEventListener("click", sendManualTapTempo);
}

if (tempoBpmInput) {
  tempoBpmInput.addEventListener("input", () => {
    if (tempoBpmInput.dataset.state === "error") {
      setTempoInputState("idle");
      setStatus("");
    }
  });

  tempoBpmInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleTempoSetRequest();
    }
  });
}

tempoBpmStepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    adjustTempoBpmInput(Number(button.dataset.step));
  });
});

if (noMidiReconnectButton) {
  noMidiReconnectButton.addEventListener("click", handleNoMidiReconnect);
}

const bidirectionalDiscovery = initializeBidirectionalDiscovery();
bidirectionalDiscovery.subscribe(handleBidirectionalLivePush);

parameterService.setOutputProvider(async () => {
  const { output } = await getMidiPorts();
  return output;
});

bindGainScaleControl();

registerViewChangeHandler((view) => {
  updateConnectionPresentation(connectionState);
});

ensureGainScaleTicks();
applyGainDisplay(null, "");

async function initializeApplication() {
  await initializeAmpImageResolver();
  initializeGearLibrary();
  liveViewController = initLiveViewMode({
    livePage,
    performanceSection,
    effectsSection,
    ampDetailsSection,
    cabinetSection,
    rigCard,
    ampSection,
    ampImageContainer,
    liveViewMenuButton,
    liveViewMenuPanel,
    sectionToggles: [
      { key: "performance", toggle: document.querySelector("#liveViewTogglePerformance") },
      { key: "effects", toggle: document.querySelector("#liveViewToggleEffects") },
      { key: "ampDetails", toggle: document.querySelector("#liveViewToggleAmpDetails") },
      { key: "cabinet", toggle: document.querySelector("#liveViewToggleCabinet") }
    ],
    ampOnlyToggle: document.querySelector("#liveViewToggleAmpOnly"),
    ampOnlyExitButton
  });
  await bootApplication();
}

initializeApplication();
