import { LogicalSize, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  registerAmpOnlyAlwaysOnTopDebugTools,
  syncAmpOnlyAlwaysOnTop
} from "./ampOnlyAlwaysOnTop.js";

const LIVE_VIEW_STORAGE_KEY = "kempanion.liveView.v2";

const AMP_ONLY_COMPACT_LOGICAL_SIZE = Object.freeze({ width: 600, height: 500 });

/** @type {null | { maximized: boolean, fullscreen: boolean, width: number, height: number }} */
let ampOnlyWindowSizeSnapshot = null;

function isTauriWindowRuntime() {
  return Boolean(
    window.__TAURI_INTERNALS__ ||
      window.__TAURI__?.core ||
      window.__TAURI__?.window
  );
}

async function applyAmpOnlyCompactWindowSize() {
  if (!isTauriWindowRuntime() || ampOnlyWindowSizeSnapshot) return;

  const win = getCurrentWindow();

  try {
    const [maximized, fullscreen, size] = await Promise.all([
      win.isMaximized(),
      win.isFullscreen(),
      win.outerSize()
    ]);

    ampOnlyWindowSizeSnapshot = {
      maximized,
      fullscreen,
      width: size.width,
      height: size.height
    };

    if (fullscreen) {
      await win.setFullscreen(false);
    }
    if (maximized) {
      await win.unmaximize();
    }

    await win.setSize(
      new LogicalSize(AMP_ONLY_COMPACT_LOGICAL_SIZE.width, AMP_ONLY_COMPACT_LOGICAL_SIZE.height)
    );
  } catch (error) {
    ampOnlyWindowSizeSnapshot = null;
    console.warn("[Live Companion] Amp Only compact window failed:", error);
  }
}

async function restoreAmpOnlyWindowSize() {
  if (!isTauriWindowRuntime()) {
    ampOnlyWindowSizeSnapshot = null;
    return;
  }

  const saved = ampOnlyWindowSizeSnapshot;
  ampOnlyWindowSizeSnapshot = null;
  if (!saved) return;

  const win = getCurrentWindow();

  try {
    if (saved.fullscreen) {
      await win.setFullscreen(true);
      return;
    }
    if (saved.maximized) {
      await win.maximize();
      return;
    }
    await win.setSize(new PhysicalSize(saved.width, saved.height));
  } catch (error) {
    console.warn("[Live Companion] Amp Only window size restore failed:", error);
  }
}

const DEFAULT_SECTIONS = {
  performance: true,
  effects: true,
  ampDetails: true,
  cabinet: true
};


function defaultLiveViewState() {
  return {
    ampOnly: false,
    sections: { ...DEFAULT_SECTIONS },
    lastNonAmpOnlySections: { ...DEFAULT_SECTIONS }
  };
}

function normalizeSections(value) {
  const sections = { ...DEFAULT_SECTIONS };
  if (!value || typeof value !== "object") return sections;

  for (const key of Object.keys(DEFAULT_SECTIONS)) {
    if (typeof value[key] === "boolean") {
      sections[key] = value[key];
    }
  }
  return sections;
}

function normalizeLiveViewState(raw) {
  const base = defaultLiveViewState();
  if (!raw || typeof raw !== "object") return base;

  if ("sections" in raw || "ampOnly" in raw) {
    return {
      ampOnly: Boolean(raw.ampOnly),
      sections: normalizeSections(raw.sections),
      lastNonAmpOnlySections: normalizeSections(raw.lastNonAmpOnlySections ?? raw.sections)
    };
  }

  const legacyCustom = normalizeSections(raw.custom);
  const legacyAmpOnly = raw.mode === "amp-only";
  const lastNonAmpOnlySections = normalizeSections(raw.lastNonAmpOnly?.custom ?? legacyCustom);

  return {
    ampOnly: legacyAmpOnly,
    sections: legacyCustom,
    lastNonAmpOnlySections
  };
}

function loadLiveViewState() {
  try {
    const raw = window.localStorage.getItem(LIVE_VIEW_STORAGE_KEY);
    if (!raw) {
      const legacyRaw = window.localStorage.getItem("kempanion.liveView.v1");
      return normalizeLiveViewState(legacyRaw ? JSON.parse(legacyRaw) : null);
    }
    return normalizeLiveViewState(JSON.parse(raw));
  } catch {
    return defaultLiveViewState();
  }
}

function saveLiveViewState(state) {
  try {
    window.localStorage.setItem(LIVE_VIEW_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("[Live Companion] Live view settings save failed:", error?.message || error);
  }
}

function isEditableEventTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(
    target.closest(
      ".performance-browser-label-input, .performance-explorer-row-name-input, .performance-explorer-search, .rig-notes-input"
    )
  );
}

function setToggleControl(toggle, on) {
  if (!toggle) return;
  toggle.setAttribute("aria-checked", on ? "true" : "false");
  toggle.dataset.checked = on ? "true" : "false";
}

export function initLiveViewMode({
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
  sectionToggles = [],
  ampOnlyToggle,
  ampOnlyExitButton
} = {}) {
  let liveViewState = loadLiveViewState();
  let menuOpen = false;
  let ampOnlyFitFrame = 0;

  function setMenuOpen(open) {
    menuOpen = open;
    if (liveViewMenuPanel) {
      liveViewMenuPanel.hidden = !open;
    }
    if (liveViewMenuButton) {
      liveViewMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function syncMenuControls() {
    sectionToggles.forEach(({ key, toggle }) => {
      if (!key || !toggle) return;
      setToggleControl(toggle, Boolean(liveViewState.sections[key]));
    });
    setToggleControl(ampOnlyToggle, liveViewState.ampOnly);
  }

  function setSectionHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle("live-view-section-hidden", hidden);
  }

  function resetAmpOnlyImageInlineStyles() {
    const img = ampImageContainer?.querySelector(".amp-image");
    if (!img) return;
    img.style.removeProperty("width");
    img.style.removeProperty("height");
    img.style.removeProperty("max-width");
    img.style.removeProperty("max-height");
    img.style.removeProperty("transform");
  }

  function fitAmpOnlyImageLayout() {
    if (document.body.dataset.liveViewMode !== "amp-only") {
      resetAmpOnlyImageInlineStyles();
      return;
    }

    const img = ampImageContainer?.querySelector(".amp-image");
    const caption = ampSection?.querySelector(".amp-main-display");
    if (!img) return;

    if (!img.complete || !img.naturalWidth) {
      return;
    }

    const captionHeight = caption?.getBoundingClientRect().height ?? 72;
    const padX = 36;
    const padTop = 52;
    const padBottom = 24;
    const availW = Math.max(80, window.innerWidth - padX);
    const availH = Math.max(80, window.innerHeight - captionHeight - padTop - padBottom);

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const scale = Math.min(availW / natW, availH / natH, 1);
    const width = Math.max(1, Math.round(natW * scale));
    const height = Math.max(1, Math.round(natH * scale));

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.style.maxWidth = "none";
    img.style.maxHeight = "none";
    img.style.transform = "none";
  }

  function scheduleAmpOnlyImageFit() {
    cancelAnimationFrame(ampOnlyFitFrame);
    ampOnlyFitFrame = requestAnimationFrame(() => {
      fitAmpOnlyImageLayout();
    });
  }

  const EFFECTS_TRI_COLUMN_PRE_KEYS = ["stompA", "stompB", "stompC", "stompD"];
  const EFFECTS_TRI_COLUMN_POST_KEYS = ["stompX", "mod", "delay", "reverb"];

  function isEffectsTriColumnLayoutActive() {
    if (liveViewState.ampOnly) return false;
    if (!liveViewState.sections.effects) return false;
    if (liveViewState.sections.ampDetails || liveViewState.sections.cabinet) return false;
    if (
      liveViewState.sections.performance &&
      performanceSection?.dataset.explorerExpanded === "true"
    ) {
      return false;
    }
    return true;
  }

  function syncEffectsTriColumnLayout() {
    const effectsList = document.querySelector("#effectsList");
    if (!effectsList) return;

    const active = isEffectsTriColumnLayoutActive();
    effectsList.dataset.compactColumns = active ? "true" : "false";

    const keyItems = effectsList.querySelectorAll("li[data-key]");
    if (!active) {
      keyItems.forEach((item) => item.style.removeProperty("grid-row"));
      return;
    }

    const assignCompactRows = (keys) => {
      let row = 2;
      keys.forEach((key) => {
        const item = effectsList.querySelector(`li[data-key="${key}"]`);
        if (!item) return;
        if (item.dataset.state === "empty") {
          item.style.removeProperty("grid-row");
          return;
        }
        item.style.gridRow = String(row);
        row += 1;
      });
    };

    assignCompactRows(EFFECTS_TRI_COLUMN_PRE_KEYS);
    assignCompactRows(EFFECTS_TRI_COLUMN_POST_KEYS);
  }

  function applyLiveViewMode() {
    const ampOnly = liveViewState.ampOnly;
    document.body.dataset.liveViewMode = ampOnly ? "amp-only" : "sections";

    setSectionHidden(performanceSection, ampOnly || !liveViewState.sections.performance);
    setSectionHidden(effectsSection, ampOnly || !liveViewState.sections.effects);
    setSectionHidden(ampDetailsSection, ampOnly || !liveViewState.sections.ampDetails);
    setSectionHidden(cabinetSection, ampOnly || !liveViewState.sections.cabinet);
    setSectionHidden(rigCard, ampOnly);

    if (livePage) {
      livePage.dataset.liveViewMode = ampOnly ? "amp-only" : "sections";
    }

    if (ampOnlyExitButton) {
      ampOnlyExitButton.hidden = !ampOnly;
    }

    syncMenuControls();
    scheduleAmpOnlyImageFit();
    syncEffectsTriColumnLayout();
  }

  function persistLiveViewState() {
    if (!liveViewState.ampOnly) {
      liveViewState.lastNonAmpOnlySections = { ...liveViewState.sections };
    }
    saveLiveViewState(liveViewState);
  }

  function enterAmpOnly() {
    if (!liveViewState.ampOnly) {
      liveViewState.lastNonAmpOnlySections = { ...liveViewState.sections };
    }
    liveViewState.ampOnly = true;
    persistLiveViewState();
    applyLiveViewMode();
    setMenuOpen(false);
    syncAmpOnlyAlwaysOnTop(true, {
      source: "enterAmpOnly",
      ampOnly: liveViewState.ampOnly
    });
    void applyAmpOnlyCompactWindowSize();
  }

  function exitAmpOnly() {
    if (!liveViewState.ampOnly) return;

    liveViewState.ampOnly = false;
    persistLiveViewState();
    applyLiveViewMode();
    syncAmpOnlyAlwaysOnTop(false, {
      source: "exitAmpOnly",
      ampOnly: liveViewState.ampOnly
    });
    void restoreAmpOnlyWindowSize();
  }

  function setSectionVisibility(key, visible) {
    if (!(key in DEFAULT_SECTIONS)) return;
    liveViewState.sections[key] = visible;
    persistLiveViewState();
    applyLiveViewMode();
  }

  function bindToggle(toggle, onChange) {
    if (!toggle) return;

    const activate = () => {
      const next = toggle.getAttribute("aria-checked") !== "true";
      setToggleControl(toggle, next);
      onChange(next);
    };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      activate();
    });

    toggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      activate();
    });
  }

  if (liveViewMenuButton && liveViewMenuPanel) {
    liveViewMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenuOpen(!menuOpen);
    });

    liveViewMenuPanel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => {
      if (menuOpen) setMenuOpen(false);
    });
  }

  sectionToggles.forEach(({ key, toggle }) => {
    bindToggle(toggle, (visible) => {
      setSectionVisibility(key, visible);
    });
  });

  bindToggle(ampOnlyToggle, (enabled) => {
    if (enabled) {
      enterAmpOnly();
    } else {
      exitAmpOnly();
    }
  });

  ampOnlyExitButton?.addEventListener("click", () => {
    exitAmpOnly();
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      if (!liveViewState.ampOnly) return;
      if (isEditableEventTarget(event.target)) return;
      event.preventDefault();
      exitAmpOnly();
    },
    true
  );

  if (ampImageContainer) {
    ampImageContainer.addEventListener(
      "load",
      (event) => {
        if (event.target instanceof HTMLImageElement && event.target.classList.contains("amp-image")) {
          scheduleAmpOnlyImageFit();
        }
      },
      true
    );

    if (typeof MutationObserver === "function") {
      const imageObserver = new MutationObserver(() => {
        scheduleAmpOnlyImageFit();
      });
      imageObserver.observe(ampImageContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"]
      });
    }
  }

  window.addEventListener("resize", scheduleAmpOnlyImageFit);

  if (livePage && typeof ResizeObserver === "function") {
    const pageObserver = new ResizeObserver(() => {
      scheduleAmpOnlyImageFit();
    });
    pageObserver.observe(livePage);
  }

  registerAmpOnlyAlwaysOnTopDebugTools();

  applyLiveViewMode();
  syncAmpOnlyAlwaysOnTop(liveViewState.ampOnly, {
    source: "initLiveViewMode",
    ampOnly: liveViewState.ampOnly
  });
  if (liveViewState.ampOnly) {
    void applyAmpOnlyCompactWindowSize();
  }

  return {
    applyLiveViewMode,
    exitAmpOnly,
    scheduleAmpOnlyImageFit,
    syncEffectsTriColumnLayout,
    isAmpOnly: () => liveViewState.ampOnly
  };
}
