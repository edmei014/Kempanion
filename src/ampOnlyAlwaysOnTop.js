/**
 * Authoritative native Always-on-Top control for Amp Only (Tauri main window).
 * UI layout lives in liveViewMode.js — failures here must not affect that layer.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";

const LOG_PREFIX = "[Amp Only Always-on-Top]";
const DIAG_STORAGE_KEY = "kempanion.debug.ampOnlyAlwaysOnTop";
/** Session-only restore snapshot if module state is lost (e.g. HMR) before exit. */
const RESTORE_SESSION_KEY = "kempanion.ampOnly.alwaysOnTopRestore";

/** @type {boolean | null} Original isAlwaysOnTop captured once per Amp Only session. */
let savedAlwaysOnTop = null;

/** @type {boolean} Successfully enabled AoT for the current Amp Only session. */
let ampOnlyAlwaysOnTopApplied = false;

/** @type {boolean} Kempanion turned AoT on (must restore on exit). */
let ampOnlyAlwaysOnTopOwned = false;

/** @type {boolean} Last requested Amp Only state from liveViewMode. */
let desiredAmpOnlyActive = false;

/** @type {number} Bumps on each sync request. */
let syncGeneration = 0;

/** @type {Promise<void>} */
let syncChain = Promise.resolve();

function isTauriRuntime() {
  return Boolean(
    window.__TAURI_INTERNALS__ ||
      window.__TAURI__?.core ||
      window.__TAURI__?.window
  );
}

function isDiagEnabled() {
  if (window.__KEMPANION_AMP_ONLY_AOT_DIAG__ === true) return true;
  try {
    return window.localStorage.getItem(DIAG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readPersistedRestore() {
  try {
    const raw = window.sessionStorage.getItem(RESTORE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.saved !== "boolean") return null;
    return { saved: parsed.saved };
  } catch {
    return null;
  }
}

/** @param {boolean} saved */
function writePersistedRestore(saved) {
  try {
    window.sessionStorage.setItem(
      RESTORE_SESSION_KEY,
      JSON.stringify({ saved, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function clearPersistedRestore() {
  try {
    window.sessionStorage.removeItem(RESTORE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<boolean | null>}
 */
async function readNativeAlwaysOnTop() {
  if (!isTauriRuntime()) return null;
  try {
    return await getCurrentWindow().isAlwaysOnTop();
  } catch {
    return null;
  }
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [fields]
 */
function diag(event, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    desiredAmpOnlyActive,
    syncGeneration,
    savedAlwaysOnTop,
    ampOnlyAlwaysOnTopApplied,
    ampOnlyAlwaysOnTopOwned,
    ...fields
  };
  if (isDiagEnabled()) {
    console.info(LOG_PREFIX, payload);
  }
  return payload;
}

/**
 * @param {number} generation
 */
function stillWantAmpOnlyAoT(generation) {
  return generation === syncGeneration && desiredAmpOnlyActive;
}

/**
 * @param {import("@tauri-apps/api/window").Window} win
 * @param {boolean} value
 * @param {number} generation
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
async function setAlwaysOnTopDirect(win, value, generation, reason) {
  const before = await win.isAlwaysOnTop();
  diag("set-always-on-top-before", {
    reason,
    generation,
    value,
    isAlwaysOnTopBefore: before,
    ampOnlySessionActive: desiredAmpOnlyActive
  });

  await win.setAlwaysOnTop(value);

  const after = await win.isAlwaysOnTop();
  diag("set-always-on-top-after", {
    reason,
    generation,
    value,
    isAlwaysOnTopAfter: after,
    ampOnlySessionActive: desiredAmpOnlyActive
  });

  if (after !== value) {
    console.warn(
      `${LOG_PREFIX} setAlwaysOnTop(${value}) finished but isAlwaysOnTop()=${after} (${reason})`
    );
  }

  return after;
}

/**
 * @param {import("@tauri-apps/api/window").Window} win
 * @param {number} generation
 * @param {string} reason
 * @returns {Promise<{ skipped?: boolean }>}
 */
async function enableAlwaysOnTopForAmpOnly(win, generation, reason) {
  if (!stillWantAmpOnlyAoT(generation)) {
    diag("blocked-set-always-on-top-true", {
      reason,
      generation,
      liveSyncGeneration: syncGeneration
    });
    return { skipped: true };
  }

  await setAlwaysOnTopDirect(win, true, generation, reason);

  if (!stillWantAmpOnlyAoT(generation)) {
    const restore = savedAlwaysOnTop ?? false;
    diag("late-enable-revert", { reason, generation, restore });
    await setAlwaysOnTopDirect(win, restore, generation, `${reason}-late-revert`);
    return { skipped: true };
  }

  return {};
}

/**
 * @param {import("@tauri-apps/api/window").Window} win
 * @param {number} generation
 * @param {string} reason
 * @param {{ source?: string, ampOnly?: boolean }} [meta]
 */
async function releaseAmpOnlyAlwaysOnTop(win, generation, reason, meta = {}) {
  let restore = savedAlwaysOnTop;
  let shouldRestore =
    ampOnlyAlwaysOnTopApplied || ampOnlyAlwaysOnTopOwned || restore !== null;

  const skipPersistedRestore = meta.source === "initLiveViewMode";

  if (!shouldRestore && !skipPersistedRestore) {
    const persisted = readPersistedRestore();
    if (persisted) {
      restore = persisted.saved;
      shouldRestore = true;
      diag("release-from-session-storage", { reason, generation, restore, ...meta });
    }
  }

  const nativeBefore = await readNativeAlwaysOnTop();

  if (!shouldRestore) {
    diag("release-noop", {
      reason,
      generation,
      nativeIsAlwaysOnTop: nativeBefore,
      liveViewAmpOnly: meta.ampOnly,
      source: meta.source
    });
    if (nativeBefore === true && meta.source === "exitAmpOnly") {
      console.warn(
        `${LOG_PREFIX} exitAmpOnly ran but release was noop while native isAlwaysOnTop=true. ` +
          "Module state was lost or enable never registered — check prior logs / HMR."
      );
    }
    return;
  }

  const target = restore ?? false;
  diag("release-begin", {
    reason,
    generation,
    restoreTarget: target,
    nativeIsAlwaysOnTopBefore: nativeBefore,
    liveViewAmpOnly: meta.ampOnly,
    source: meta.source
  });

  try {
    await setAlwaysOnTopDirect(win, target, generation, reason);
    const nativeAfter = await win.isAlwaysOnTop();
    diag("release-complete", {
      reason,
      generation,
      restoreTarget: target,
      nativeIsAlwaysOnTopAfter: nativeAfter,
      source: meta.source
    });
    if (nativeAfter !== target) {
      console.warn(
        `${LOG_PREFIX} restore expected isAlwaysOnTop=${target}, got ${nativeAfter} (${reason})`
      );
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} restore failed (${reason}):`, error);
    diag("release-error", { reason, generation, error: String(error) });
  } finally {
    savedAlwaysOnTop = null;
    ampOnlyAlwaysOnTopApplied = false;
    ampOnlyAlwaysOnTopOwned = false;
    clearPersistedRestore();
  }
}

/**
 * @param {import("@tauri-apps/api/window").Window} win
 * @param {number} generation
 * @param {string} reason
 */
async function rollbackPendingEnable(win, generation, reason) {
  if (savedAlwaysOnTop === null) {
    ampOnlyAlwaysOnTopApplied = false;
    ampOnlyAlwaysOnTopOwned = false;
    return;
  }

  const restore = savedAlwaysOnTop;
  try {
    diag("rollback-pending-enable", { reason, generation, restore });
    await setAlwaysOnTopDirect(win, restore, generation, reason);
  } catch (error) {
    console.error(`${LOG_PREFIX} rollback failed (${reason}):`, error);
  } finally {
    savedAlwaysOnTop = null;
    ampOnlyAlwaysOnTopApplied = false;
    ampOnlyAlwaysOnTopOwned = false;
    clearPersistedRestore();
  }
}

/**
 * @param {number} generation
 * @param {{ source?: string, ampOnly?: boolean }} meta
 * @returns {Promise<void>}
 */
async function runSync(generation, meta) {
  if (!isTauriRuntime()) {
    diag("run-sync-skip-not-tauri", { generation, ...meta });
    return;
  }

  if (generation !== syncGeneration) {
    diag("run-sync-stale-generation", { generation, liveSyncGeneration: syncGeneration, ...meta });
    return;
  }

  const win = getCurrentWindow();

  try {
    if (!desiredAmpOnlyActive) {
      await releaseAmpOnlyAlwaysOnTop(win, generation, "sync-false", meta);
      const nativeAfter = await readNativeAlwaysOnTop();
      diag("sync-false-complete", {
        generation,
        nativeIsAlwaysOnTopAfter: nativeAfter,
        ...meta
      });
      return;
    }

    if (ampOnlyAlwaysOnTopApplied) {
      const nativeNow = await readNativeAlwaysOnTop();
      diag("sync-already-applied", { generation, nativeIsAlwaysOnTop: nativeNow, ...meta });
      return;
    }

    if (savedAlwaysOnTop === null) {
      savedAlwaysOnTop = await win.isAlwaysOnTop();
      writePersistedRestore(savedAlwaysOnTop);
      diag("amp-only-enter-snapshot", {
        generation,
        savedRestoreValue: savedAlwaysOnTop,
        nativeIsAlwaysOnTop: savedAlwaysOnTop,
        ...meta
      });
    }

    if (!stillWantAmpOnlyAoT(generation)) {
      await rollbackPendingEnable(win, generation, "enable-aborted-before-set");
      return;
    }

    const result = await enableAlwaysOnTopForAmpOnly(win, generation, "enable");
    if (result.skipped) {
      await rollbackPendingEnable(win, generation, "enable-blocked");
      return;
    }

    if (!stillWantAmpOnlyAoT(generation)) {
      await rollbackPendingEnable(win, generation, "enable-aborted-after-set");
      return;
    }

    ampOnlyAlwaysOnTopApplied = true;
    ampOnlyAlwaysOnTopOwned = true;
    writePersistedRestore(savedAlwaysOnTop ?? false);

    const nativeAfter = await readNativeAlwaysOnTop();
    diag("amp-only-enter-complete", {
      generation,
      savedRestoreValue: savedAlwaysOnTop,
      nativeIsAlwaysOnTopAfter: nativeAfter,
      ...meta
    });
    console.info(
      `${LOG_PREFIX} enabled (will restore to ${savedAlwaysOnTop} on exit)`
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} enable failed:`, error);
    diag("enable-error", { generation, error: String(error), ...meta });
    if (savedAlwaysOnTop !== null) {
      try {
        await setAlwaysOnTopDirect(
          win,
          savedAlwaysOnTop,
          generation,
          "enable-error-revert"
        );
      } catch (revertError) {
        console.error(`${LOG_PREFIX} enable-error revert failed:`, revertError);
      }
    }
    savedAlwaysOnTop = null;
    ampOnlyAlwaysOnTopApplied = false;
    ampOnlyAlwaysOnTopOwned = false;
    clearPersistedRestore();
  }
}

/**
 * @param {boolean} ampOnlyActive
 * @param {{ source?: string, ampOnly?: boolean }} [meta]
 * @returns {void}
 */
export function syncAmpOnlyAlwaysOnTop(ampOnlyActive, meta = {}) {
  desiredAmpOnlyActive = ampOnlyActive;
  const generation = ++syncGeneration;

  diag("sync-request", {
    source: meta.source ?? "unknown",
    requestedAmpOnlyActive: ampOnlyActive,
    liveViewAmpOnly: meta.ampOnly,
    generation
  });

  syncChain = syncChain
    .then(() => runSync(generation, meta))
    .catch((error) => {
      console.error(`${LOG_PREFIX} sync chain failed:`, error);
      diag("sync-chain-error", { generation, error: String(error), ...meta });
    });
}

/**
 * Read native AoT state and module snapshot (does not change the window).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readAmpOnlyAlwaysOnTopDiagnostics() {
  const nativeIsAlwaysOnTop = await readNativeAlwaysOnTop();
  const persisted = readPersistedRestore();
  return {
    runtime: isTauriRuntime() ? "tauri" : "browser",
    nativeIsAlwaysOnTop,
    module: {
      desiredAmpOnlyActive,
      syncGeneration,
      savedAlwaysOnTop,
      ampOnlyAlwaysOnTopApplied,
      ampOnlyAlwaysOnTopOwned
    },
    sessionStorageRestore: persisted
  };
}

/** @returns {void} */
export function registerAmpOnlyAlwaysOnTopDebugTools() {
  window.__KEMPANION_READ_ALWAYS_ON_TOP__ = readAmpOnlyAlwaysOnTopDiagnostics;
}
