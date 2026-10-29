import {
  AMP_ATLAS_PRESENTATION,
  AMP_ATLAS_PRESENTATION_DEFAULT,
  AMP_IMAGE_FILTER,
  AMP_SORT,
  AMP_SORT_DEFAULT,
  AMP_SORT_OPTIONS,
  DISCOVER_BOARD_CATEGORIES,
  DISCOVER_ROTATION_FADE_MS,
  buildAmpManufacturerViewSections,
  buildAmpTimelineSections,
  createDiscoverRotationController,
  getAmpBrowseEntries,
  getAmpById,
  getAmpDetailView,
  getAmpLibraryStats,
  getManufacturerBrowseEntries,
  getManufacturerById,
  getManufacturerDetailView,
  getManufacturerLibraryStats,
  isAmpSortOption,
  isManufacturerSort,
  normalizeAmpSort,
  parseAmpSortSpec
} from "./library/index.js";
import { GEAR_CATEGORY, gearLibraryCategories, getGearCategory } from "./gearLibraryCatalog.js";
import { applyAmpThemeToElement, serializeAmpThemeStyle } from "./theme/ampTheme.js";
import {
  closeGearAmpImageFocus,
  closeGearAmpImageViews,
  initializeGearAmpImageFocus,
  isGearAmpImageFocusOpen,
  openGearAmpImageFocus
} from "./gearAmpImageFocus.js";
import {
  applyGearDesignPreview,
  GEAR_DESIGN_MODE,
  getActiveGearDesignMode,
  initializeGearDesignPreview,
  isCollectionsDesignMode,
  isMuseumDesignMode,
  syncGearDesignPreviewSwitcher
} from "./gearLibraryDesignPreview.js";
import {
  buildChapterOptions,
  jumpToManufacturerChapter,
  syncChapterSelect
} from "./gearLibraryChapters.js";
import {
  getMuseumExhibitEntry,
  renderMuseumExhibition,
  renderMuseumModelNav,
  resolveMuseumAmpId,
  resolveMuseumSection
} from "./museum/museumView.js";
import { bindMuseumOpticalAlign } from "./museum/museumOpticalAlign.js";
import { renderCollectionsCatalog } from "./collections/collectionsView.js";
import { bindAmpDetailsOverlay } from "./modules/ampDetails/AmpDetailsOverlay.js";
import { initializeGearColorTheme } from "./gearLibraryTheme.js";
import {
  exitPresentationMode,
  getPresentationVariant,
  initializePresentationMode,
  isPresentationModeActive,
  PRESENTATION_SCOPE
} from "./presentation/presentationMode.js";
import { getPresentationVariantConfig } from "./presentation/presentationVariants.js";
import {
  buildPlaylistByStrategy,
  classifyPowerClass,
  decadeFromYear
} from "./presentation/presentationPlaylist.js";
import {
  bindPresentationFit,
  stopPresentationFit
} from "./presentation/presentationFit.js";

const APP_VIEW = {
  LIVE: "live",
  GEAR: "gear"
};

const VIEW_SCROLL_SELECTORS = Object.freeze({
  [APP_VIEW.LIVE]: "#liveView .shell--live, #liveView .shell",
  [APP_VIEW.GEAR]: "#gearLibraryView .gear-library-scroll"
});

const ALL_MANUFACTURERS = "all";

let activeView = APP_VIEW.LIVE;
let activeGearCategory = GEAR_CATEGORY.AMPS;
let selectedAmpId = null;
let selectedManufacturerId = null;
let onViewChange = null;
let ampCatalogEntries = [];
let ampLibraryStatsData = { ampCount: 0, manufacturerCount: 0 };

const ampBrowserState = {
  manufacturer: ALL_MANUFACTURERS,
  searchQuery: "",
  sort: AMP_SORT_DEFAULT,
  atlasPresentation: AMP_ATLAS_PRESENTATION_DEFAULT,
  imageFilter: AMP_IMAGE_FILTER.ALL
};

const manufacturerBrowserState = {
  searchQuery: ""
};

let manufacturerCatalogEntries = [];
let manufacturerLibraryStatsData = { manufacturerCount: 0 };

let liveViewRoot = null;
let gearLibraryViewRoot = null;
let appRoot = null;
let appModuleLauncher = null;
let appModuleLauncherButton = null;
let appModuleMenu = null;
/** @type {HTMLElement[]} */
let appModuleMenuItems = [];
/** @type {Record<string, number>} */
const savedScrollByView = {
  [APP_VIEW.LIVE]: 0,
  [APP_VIEW.GEAR]: 0
};
let gearLibraryTitle = null;
let gearLibraryCollectionMeta = null;
let gearCategoryShell = null;
let gearLibraryScroll = null;
let gearLibrarySearch = null;
let gearLibraryViewWrap = null;
let gearAmpViewSelect = null;
let gearAtlasPresentationToggle = null;
let gearDesignPreview = null;
let gearAmpBrowserStage = null;
let gearAmpTimelineRail = null;
let gearAmpTimelineTrack = null;
let gearAmpImageFilterWrap = null;
/** @type {IntersectionObserver | null} */
let timelineYearObserver = null;
let timelineRailBound = false;
let gearAmpImageFilter = null;
let manufacturerBrowserGrid = null;
let ampBrowserGrid = null;
let gearLibraryChapterWrap = null;
let gearLibraryChapterSelect = null;
let museumModelNav = null;
let museumModelNavTrack = null;
/** @type {(() => void) | null} */
let stopMuseumOpticalAlign = null;
/** @type {{ manufacturerId: string | null, ampId: string | null }} */
const museumState = {
  manufacturerId: null,
  ampId: null
};
/** Full library catalog used by Presentation Mode slideshow. */
let presentationCatalogEntries = [];
let gearPresentationButton = null;
let gearPresentationButtonLabel = null;
let gearPresentationExit = null;
let gearDiscoverColumn = null;
let gearLibraryStatsEl = null;
let gearLibraryEmptyState = null;
let gearCategoryNav = null;
/** Kempanion (live) technical detail card */
let gearAmpDetailOverlay = null;
let gearAmpDetailBackdrop = null;
let gearAmpDetailClose = null;
let gearAmpDetailImage = null;
let gearAmpDetailManufacturer = null;
let gearAmpDetailModel = null;
let gearAmpDetailMeta = null;
let gearAmpDetailDescriptionSection = null;
let gearAmpDetailDescription = null;
let gearAmpDetailTechSection = null;
let gearAmpDetailTechList = null;
let gearAmpDetailHistorySection = null;
let gearAmpDetailHistory = null;
let gearAmpDetailPlayedBySection = null;
let gearAmpDetailPlayedByList = null;
/** Gear Library boutique / archive detail card */
let gearArchiveAmpDetailOverlay = null;
let gearArchiveAmpDetailBackdrop = null;
let gearArchiveAmpDetailClose = null;
let gearArchiveAmpDetailImage = null;
let gearArchiveAmpDetailManufacturer = null;
let gearArchiveAmpDetailModel = null;
let gearArchiveAmpDetailSpecs = null;
let gearArchiveAmpDetailDescription = null;
let gearArchiveAmpDetailHistory = null;
let gearArchiveAmpDetailValveSection = null;
let gearArchiveAmpDetailValveList = null;
let gearArchiveAmpDetailPlayedBySection = null;
let gearArchiveAmpDetailPlayedByList = null;
let gearManufacturerDetailOverlay = null;
let gearManufacturerDetailBackdrop = null;
let gearManufacturerDetailClose = null;
let gearManufacturerDetailTitle = null;
let gearManufacturerDetailMeta = null;
let gearManufacturerDetailDescription = null;
let gearManufacturerDetailHistory = null;
let gearManufacturerDetailWebsite = null;
let gearDiscoverBoard = null;
let gearKempanionSwitcher = null;
let gearAtlasSwitcher = null;
let noMidiGearAtlasSwitcher = null;
/** @type {import("./library/discoverLibrary.js").DiscoverBoardState | null} */
let discoverBoardState = null;
/** @type {ReturnType<typeof createDiscoverRotationController> | null} */
let discoverRotationController = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const discoverFadeTimers = new Map();
export function registerViewChangeHandler(handler) {
  onViewChange = handler;
}

export function getActiveAppView() {
  return activeView;
}

function isAppView(view) {
  return view === APP_VIEW.LIVE || view === APP_VIEW.GEAR;
}

/**
 * @param {string} view
 * @returns {HTMLElement | null}
 */
function getViewScrollElement(view) {
  const selector = VIEW_SCROLL_SELECTORS[view];
  if (!selector) return null;
  const element = document.querySelector(selector);
  return element instanceof HTMLElement ? element : null;
}

/**
 * @param {string} view
 */
function captureViewScroll(view) {
  const element = getViewScrollElement(view);
  if (element) savedScrollByView[view] = element.scrollTop;
}

/**
 * @param {string} view
 */
function restoreViewScroll(view) {
  const element = getViewScrollElement(view);
  if (!element) return;
  const top = savedScrollByView[view] || 0;
  window.requestAnimationFrame(() => {
    element.scrollTop = top;
  });
}

function setViewRootVisibility(view) {
  document.body.dataset.appView = view;

  if (liveViewRoot) {
    const showLive = view === APP_VIEW.LIVE;
    liveViewRoot.setAttribute("aria-hidden", showLive ? "false" : "true");
  }

  if (gearLibraryViewRoot) {
    const showGear = view === APP_VIEW.GEAR;
    gearLibraryViewRoot.setAttribute("aria-hidden", showGear ? "false" : "true");
  }

}

function syncModuleMenuActiveState(view) {
  appModuleMenuItems.forEach((item) => {
    const isActive = item.dataset.view === view;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function closeModuleMenu() {
  if (!appModuleLauncher || !appModuleLauncherButton || !appModuleMenu) return;
  appModuleLauncher.dataset.open = "false";
  appModuleLauncherButton.setAttribute("aria-expanded", "false");
  appModuleMenu.hidden = true;
}

function openModuleMenu() {
  if (!appModuleLauncher || !appModuleLauncherButton || !appModuleMenu) return;
  appModuleLauncher.dataset.open = "true";
  appModuleLauncherButton.setAttribute("aria-expanded", "true");
  appModuleMenu.hidden = false;
}

function toggleModuleMenu() {
  if (appModuleLauncher?.dataset.open === "true") {
    closeModuleMenu();
  } else {
    openModuleMenu();
  }
}

function isAmpDetailOpen() {
  return gearAmpDetailOverlay?.dataset.open === "true";
}

function isArchiveAmpDetailOpen() {
  return gearArchiveAmpDetailOverlay?.dataset.open === "true";
}

function isManufacturerDetailOpen() {
  return gearManufacturerDetailOverlay?.dataset.open === "true";
}

function updateGearOverlayLock() {
  const ampOpen = isAmpDetailOpen();
  const archiveOpen = isArchiveAmpDetailOpen();
  const manufacturerOpen = isManufacturerDetailOpen();
  const imageFocusOpen = isGearAmpImageFocusOpen();
  const anyOpen = ampOpen || archiveOpen || manufacturerOpen || imageFocusOpen;

  document.body.dataset.gearDetailOpen =
    ampOpen || archiveOpen ? "true" : "false";
  document.body.dataset.gearManufacturerOpen = manufacturerOpen ? "true" : "false";
  document.body.dataset.gearImageFocusOpen = imageFocusOpen ? "true" : "false";
  document.body.dataset.gearOverlayOpen = anyOpen ? "true" : "false";

  if (gearLibraryViewRoot) {
    gearLibraryViewRoot.dataset.detailOpen =
      ampOpen || archiveOpen || manufacturerOpen ? "true" : "false";
  }

  if (appRoot) {
    if (anyOpen) {
      appRoot.setAttribute("inert", "");
    } else {
      appRoot.removeAttribute("inert");
    }
  }
}

function closeAllGearOverlays() {
  closeGearAmpImageViews();
  closeManufacturerDetail();
  closeArchiveAmpDetail();
  closeAmpDetail();
}

export function setAppView(view) {
  if (!isAppView(view)) return;
  if (activeView === view) {
    closeModuleMenu();
    return;
  }

  captureViewScroll(activeView);

  if (activeView === APP_VIEW.GEAR && isPresentationModeActive()) {
    exitPresentationMode();
  }

  if (view !== APP_VIEW.GEAR) {
    stopDiscoverRotation();
  }

  activeView = view;
  setViewRootVisibility(view);
  syncModuleMenuActiveState(view);
  closeModuleMenu();

  onViewChange?.(view);

  if (view === APP_VIEW.GEAR && discoverBoardState && !isPresentationModeActive()) {
    startDiscoverRotation();
  }

  restoreViewScroll(view);
}

function normalizeAmpBrowserState(state = ampBrowserState) {
  if (state.view && !state.sort) {
    if (state.view === "timeline") {
      state.atlasPresentation = AMP_ATLAS_PRESENTATION.TIMELINE;
      state.sort = AMP_SORT_DEFAULT;
    } else if (state.view === "model") {
      state.sort = AMP_SORT.MODEL_ASC;
      state.atlasPresentation = AMP_ATLAS_PRESENTATION_DEFAULT;
    } else {
      state.sort = AMP_SORT.MANUFACTURER_ASC;
      state.atlasPresentation = AMP_ATLAS_PRESENTATION_DEFAULT;
    }
    delete state.view;
  }

  if (!state.atlasPresentation) {
    state.atlasPresentation = AMP_ATLAS_PRESENTATION_DEFAULT;
  }

  state.sort = isAmpSortOption(state.sort)
    ? state.sort
    : normalizeAmpSort(state.sort || AMP_SORT_DEFAULT);
}

function isTimelinePresentation() {
  return ampBrowserState.atlasPresentation === AMP_ATLAS_PRESENTATION.TIMELINE;
}

function resetAmpBrowserViewToDefault() {
  ampBrowserState.sort = AMP_SORT_DEFAULT;
  ampBrowserState.atlasPresentation = AMP_ATLAS_PRESENTATION_DEFAULT;

  if (gearAmpViewSelect) {
    gearAmpViewSelect.value = AMP_SORT_DEFAULT;
  }

  syncAtlasPresentationToggle();
}

function isManufacturersCategory() {
  return activeGearCategory === GEAR_CATEGORY.MANUFACTURERS;
}

function isAmpsCategory() {
  return activeGearCategory === GEAR_CATEGORY.AMPS;
}

function updateGearCategoryPanels() {
  const isManufacturers = isManufacturersCategory();

  if (gearCategoryShell) {
    gearCategoryShell.dataset.activeCategory = activeGearCategory;
  }

  if (gearLibraryViewWrap) {
    const hideView = isManufacturers;
    gearLibraryViewWrap.classList.toggle("is-inactive", hideView);
    gearLibraryViewWrap.setAttribute("aria-hidden", hideView ? "true" : "false");
  }

  if (gearLibraryChapterWrap) {
    gearLibraryChapterWrap.classList.toggle("is-inactive", isManufacturers);
    gearLibraryChapterWrap.setAttribute(
      "aria-hidden",
      isManufacturers ? "true" : "false"
    );
  }

  if (gearAmpImageFilterWrap) {
    gearAmpImageFilterWrap.classList.toggle("is-inactive", isManufacturers);
    gearAmpImageFilterWrap.setAttribute("aria-hidden", isManufacturers ? "true" : "false");
  }

  syncMuseumModelNavVisibility(isMuseumDesignMode() && !isManufacturers);

  if (gearLibraryTitle) {
    const category = getGearCategory(activeGearCategory);
    gearLibraryTitle.textContent =
      category?.id === GEAR_CATEGORY.MANUFACTURERS ? "Manufacturers" : "Amp Collection";
  }

  syncGearLibraryCollectionMeta();
  syncGearLibrarySearchField();

  if (gearLibraryScroll) {
    gearLibraryScroll.scrollTop = 0;
  }
}

function syncGearLibrarySearchField() {
  if (!gearLibrarySearch) return;

  gearLibrarySearch.value = isManufacturersCategory()
    ? manufacturerBrowserState.searchQuery
    : ampBrowserState.searchQuery;
  gearLibrarySearch.placeholder = "Search...";
}

function updateGearLibraryEmptyState(isEmpty, message) {
  if (!gearLibraryEmptyState) return;

  gearLibraryEmptyState.textContent = message;
  gearLibraryEmptyState.hidden = !isEmpty;
}

function setGearCategory(categoryId) {
  const category = getGearCategory(categoryId);
  if (!category || !category.enabled) return;
  if (activeGearCategory === categoryId) return;

  activeGearCategory = categoryId;
  closeAllGearOverlays();
  renderGearCategoryNav();
  updateGearCategoryPanels();
  renderActiveGearCategory();
}

function renderActiveGearCategory() {
  if (manufacturerBrowserGrid) {
    manufacturerBrowserGrid.hidden = !isManufacturersCategory();
  }

  if (ampBrowserGrid) {
    ampBrowserGrid.hidden = !isAmpsCategory();
  }

  if (isManufacturersCategory()) {
    renderManufacturerBrowser();
    return;
  }

  if (isAmpsCategory()) {
    renderAmpBrowser();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadAmpBrowseEntries() {
  const sort = isTimelinePresentation()
    ? AMP_SORT.AMP_YEAR_ASC
    : ampBrowserState.sort;

  return getAmpBrowseEntries({
    query: ampBrowserState.searchQuery,
    manufacturer:
      ampBrowserState.manufacturer === ALL_MANUFACTURERS
        ? ""
        : ampBrowserState.manufacturer,
    sort,
    imageFilter: ampBrowserState.imageFilter
  });
}

function isAmpBrowserFiltered() {
  return (
    ampBrowserState.searchQuery.trim().length > 0 ||
    ampBrowserState.manufacturer !== ALL_MANUFACTURERS ||
    ampBrowserState.imageFilter === AMP_IMAGE_FILTER.AVAILABLE
  );
}

function syncAmpImageFilterUi() {
  if (!gearAmpImageFilter) return;

  gearAmpImageFilter.querySelectorAll(".gear-library-image-filter-option").forEach((button) => {
    const isActive = button.dataset.imageFilter === ampBrowserState.imageFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function findAmpEntry(ampId) {
  return ampCatalogEntries.find((entry) => entry.id === ampId) || null;
}

function renderGearCategoryNav() {
  if (!gearCategoryNav) return;

  gearCategoryNav.innerHTML = gearLibraryCategories
    .map((category) => {
      const isActive = category.id === activeGearCategory;
      const isDisabled = !category.enabled;

      return `
        <button
          type="button"
          class="gear-category-button${isActive ? " is-active" : ""}"
          data-category="${escapeHtml(category.id)}"
          aria-current="${isActive ? "page" : "false"}"
          ${isDisabled ? "disabled" : ""}
          title="${isDisabled ? "Coming soon..." : ""}"
        >
          ${escapeHtml(category.label)}
        </button>
      `;
    })
    .join("");
}

function renderManufacturerLibraryStats(filteredCount) {
  if (!gearLibraryStatsEl || !isManufacturersCategory()) return;

  const isFiltered = manufacturerBrowserState.searchQuery.trim().length > 0;

  gearLibraryStatsEl.innerHTML = `
    <span class="gear-library-stat">
      ${filteredCount} ${filteredCount === 1 ? "manufacturer" : "manufacturers"}
    </span>
    ${
      isFiltered
        ? `
          <span class="gear-library-stat-separator" aria-hidden="true">·</span>
          <span class="gear-library-stat gear-library-stat-muted">
            ${manufacturerLibraryStatsData.manufacturerCount} in collection
          </span>
        `
        : ""
    }
  `;
}

function renderManufacturerMetaLine({ founded, country, ampCount = null }) {
  /** @type {string[]} */
  const parts = [];

  if (country) parts.push(country);
  if (founded) parts.push(`Founded ${founded}`);
  if (typeof ampCount === "number" && ampCount >= 0) {
    parts.push(`${ampCount} ${ampCount === 1 ? "Amplifier" : "Amplifiers"}`);
  }

  return parts.join(" • ");
}

/**
 * @param {string} manufacturerId
 * @param {number} [ampCount]
 */
function renderManufacturerChapterMeta(manufacturerId, ampCount) {
  const record = getManufacturerById(manufacturerId);
  if (!record && typeof ampCount !== "number") return "";

  const country = String(record?.country ?? "").trim();
  const founded = String(record?.founded ?? "").trim();

  return renderManufacturerMetaLine({
    country: country || null,
    founded: founded || null,
    ampCount: typeof ampCount === "number" ? ampCount : null
  });
}

function syncGearLibraryCollectionMeta() {
  if (!gearLibraryCollectionMeta) return;

  gearLibraryCollectionMeta.hidden = true;
  gearLibraryCollectionMeta.textContent = "";
}

function renderManufacturerBrowserCard(entry) {
  const { id, name, founded, country, summary } = entry;
  const metaLine = renderManufacturerMetaLine({ founded, country });
  const isSelected = selectedManufacturerId === id;

  return `
    <article
      class="manufacturer-browser-card"
      role="button"
      tabindex="0"
      aria-label="${escapeHtml(name)}"
      data-manufacturer-id="${escapeHtml(id)}"
      data-selected="${isSelected ? "true" : "false"}"
    >
      <div class="manufacturer-browser-card-body">
        <h3 class="manufacturer-browser-card-name">${escapeHtml(name)}</h3>
        ${
          metaLine
            ? `<p class="manufacturer-browser-card-meta">${escapeHtml(metaLine)}</p>`
            : ""
        }
        ${
          summary
            ? `<p class="manufacturer-browser-card-summary">${escapeHtml(summary)}</p>`
            : ""
        }
      </div>
    </article>
  `;
}

function updateManufacturerCardSelection() {
  if (!manufacturerBrowserGrid) return;

  manufacturerBrowserGrid.querySelectorAll(".manufacturer-browser-card").forEach((card) => {
    card.dataset.selected =
      card.dataset.manufacturerId === selectedManufacturerId ? "true" : "false";
  });
}

function renderManufacturerBrowser() {
  if (!manufacturerBrowserGrid) return;

  manufacturerCatalogEntries = getManufacturerBrowseEntries({
    query: manufacturerBrowserState.searchQuery
  });

  renderManufacturerLibraryStats(manufacturerCatalogEntries.length);

  const isEmpty = manufacturerCatalogEntries.length === 0;
  manufacturerBrowserGrid.hidden = isEmpty;
  updateGearLibraryEmptyState(isEmpty, "No manufacturers match your search.");

  manufacturerBrowserGrid.innerHTML = manufacturerCatalogEntries
    .map((entry) => renderManufacturerBrowserCard(entry))
    .join("");

  updateManufacturerCardSelection();
}

function handleManufacturerBrowserClick(event) {
  const card = event.target.closest(".manufacturer-browser-card");
  if (!card || !manufacturerBrowserGrid?.contains(card)) return;

  openManufacturerDetail(card.dataset.manufacturerId);
}

function handleManufacturerBrowserKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest(".manufacturer-browser-card");
  if (!card || !manufacturerBrowserGrid?.contains(card)) return;

  event.preventDefault();
  openManufacturerDetail(card.dataset.manufacturerId);
}

function normalizeGearSearchKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function clearGearLibrarySearchField({ blur = true } = {}) {
  if (isManufacturersCategory()) {
    manufacturerBrowserState.searchQuery = "";
  } else {
    ampBrowserState.searchQuery = "";
  }

  if (gearLibrarySearch) {
    gearLibrarySearch.value = "";
    if (blur) gearLibrarySearch.blur();
  }
}

/**
 * @param {string} query
 * @returns {{ type: "amp", ampId: string, manufacturerId: string } | { type: "manufacturer", manufacturerId: string } | null}
 */
function resolveAmpSearchNavigationTarget(query) {
  const normalized = normalizeGearSearchKey(query);
  if (normalized.length < 2) return null;

  const entries = loadAmpBrowseEntries();
  if (!entries.length) return null;

  const exactModel = entries.filter(
    (entry) => normalizeGearSearchKey(entry.model) === normalized
  );
  if (exactModel.length === 1) {
    return {
      type: "amp",
      ampId: exactModel[0].id,
      manufacturerId: exactModel[0].manufacturerId
    };
  }

  const exactFull = entries.filter(
    (entry) =>
      normalizeGearSearchKey(`${entry.manufacturer} ${entry.model}`) === normalized
  );
  if (exactFull.length === 1) {
    return {
      type: "amp",
      ampId: exactFull[0].id,
      manufacturerId: exactFull[0].manufacturerId
    };
  }

  /** @type {Map<string, string>} */
  const manufacturers = new Map();
  for (const entry of entries) {
    manufacturers.set(entry.manufacturerId, entry.manufacturer);
  }

  const exactManufacturer = [...manufacturers.entries()].filter(
    ([, name]) => normalizeGearSearchKey(name) === normalized
  );
  if (exactManufacturer.length === 1) {
    return {
      type: "manufacturer",
      manufacturerId: exactManufacturer[0][0]
    };
  }

  // Unique residual match only after a slightly longer query — avoids early jumps
  if (entries.length === 1 && normalized.length >= 3) {
    return {
      type: "amp",
      ampId: entries[0].id,
      manufacturerId: entries[0].manufacturerId
    };
  }

  return null;
}

/**
 * @param {string} query
 * @returns {{ type: "manufacturer", manufacturerId: string } | null}
 */
function resolveManufacturerSearchNavigationTarget(query) {
  const normalized = normalizeGearSearchKey(query);
  if (normalized.length < 2) return null;

  const entries = getManufacturerBrowseEntries({ query });
  if (!entries.length) return null;

  const exact = entries.filter(
    (entry) => normalizeGearSearchKey(entry.name) === normalized
  );
  if (exact.length === 1) {
    return { type: "manufacturer", manufacturerId: exact[0].id };
  }

  if (entries.length === 1 && normalized.length >= 3) {
    return { type: "manufacturer", manufacturerId: entries[0].id };
  }

  return null;
}

/**
 * @param {{ type: "amp", ampId: string, manufacturerId: string } | { type: "manufacturer", manufacturerId: string }} target
 */
function navigateGearLibrarySearchTarget(target) {
  closeAllGearOverlays();

  if (isManufacturersCategory() && target.type === "manufacturer") {
    clearGearLibrarySearchField({ blur: true });
    renderManufacturerBrowser();
    requestAnimationFrame(() => {
      const card = manufacturerBrowserGrid?.querySelector(
        `.manufacturer-browser-card[data-manufacturer-id="${CSS.escape(target.manufacturerId)}"]`
      );
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      selectedManufacturerId = target.manufacturerId;
      updateManufacturerCardSelection();
    });
    return;
  }

  clearGearLibrarySearchField({ blur: true });

  if (isMuseumDesignMode()) {
    museumState.manufacturerId = target.manufacturerId;
    museumState.ampId = target.type === "amp" ? target.ampId : null;
    setChapterSelectManufacturer(target.manufacturerId);
    renderAmpBrowser();
    return;
  }

  renderAmpBrowser();

  requestAnimationFrame(() => {
    jumpToManufacturerChapter({
      manufacturerId: target.manufacturerId,
      root: ampBrowserGrid,
      scrollRoot: gearLibraryScroll,
      topPadding: 16
    });

    if (target.type === "amp") {
      const card = ampBrowserGrid?.querySelector(
        `.amp-browser-card[data-amp-id="${CSS.escape(target.ampId)}"]`
      );
      if (card) {
        selectedAmpId = target.ampId;
        updateAmpCardSelection();
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setChapterSelectManufacturer(target.manufacturerId);
    }
  });
}

function handleGearLibrarySearchInput() {
  const query = gearLibrarySearch?.value || "";

  if (isManufacturersCategory()) {
    manufacturerBrowserState.searchQuery = query;
    closeAllGearOverlays();

    const target = resolveManufacturerSearchNavigationTarget(query);
    if (target) {
      navigateGearLibrarySearchTarget(target);
      return;
    }

    renderManufacturerBrowser();
    return;
  }

  ampBrowserState.searchQuery = query;
  closeAllGearOverlays();

  const target = resolveAmpSearchNavigationTarget(query);
  if (target) {
    navigateGearLibrarySearchTarget(target);
    return;
  }

  renderAmpBrowser();
}

function handleGearLibrarySearchKeydown(event) {
  if (event.key !== "Enter") return;

  const query = gearLibrarySearch?.value || "";
  if (!normalizeGearSearchKey(query)) return;

  event.preventDefault();

  if (isManufacturersCategory()) {
    manufacturerBrowserState.searchQuery = query;
    const target = resolveManufacturerSearchNavigationTarget(query);
    if (target) {
      navigateGearLibrarySearchTarget(target);
      return;
    }
    renderManufacturerBrowser();
    return;
  }

  ampBrowserState.searchQuery = query;
  const target = resolveAmpSearchNavigationTarget(query);
  if (target) {
    navigateGearLibrarySearchTarget(target);
    return;
  }

  const entries = loadAmpBrowseEntries();
  if (entries.length > 0) {
    navigateGearLibrarySearchTarget({
      type: "amp",
      ampId: entries[0].id,
      manufacturerId: entries[0].manufacturerId
    });
  }
}

function handleGearCategoryNavClick(event) {
  const button = event.target.closest(".gear-category-button");
  if (!button || !gearCategoryNav?.contains(button)) return;

  setGearCategory(button.dataset.category);
}

function renderLibraryStats(_filteredCount) {
  // Release presentation: collection stats live in the page header and footnote.
  if (gearLibraryStatsEl) {
    gearLibraryStatsEl.innerHTML = "";
    gearLibraryStatsEl.hidden = true;
  }

  syncGearLibraryCollectionMeta();
}

function renderCollectionStatsFootnote(_entryCount) {
  return "";
}

function renderSortOptions() {
  if (!gearAmpViewSelect) return;

  gearAmpViewSelect.innerHTML = AMP_SORT_OPTIONS.map(
    ({ value, label }) =>
      `<option value="${escapeHtml(value)}"${
        ampBrowserState.sort === value ? " selected" : ""
      }>${escapeHtml(label)}</option>`
  ).join("");
}

function syncAtlasPresentationToggle() {
  if (!gearAtlasPresentationToggle) return;

  const isTimeline = isTimelinePresentation();
  gearAtlasPresentationToggle.dataset.mode = isTimeline ? "collection" : "timeline";
  gearAtlasPresentationToggle.setAttribute("aria-pressed", isTimeline ? "true" : "false");
  gearAtlasPresentationToggle.setAttribute(
    "aria-label",
    isTimeline ? "Back to collection view" : "Timeline"
  );
  gearAtlasPresentationToggle.classList.toggle("is-timeline-back", isTimeline);
}

/**
 * @param {import("./library/ampLibrary.js").AmpBrowseEntry} entry
 * @param {{ showManufacturer?: boolean }} [options]
 */
function renderAmpBrowserCard(entry, options = {}) {
  const { showManufacturer = false } = options;
  const {
    model,
    manufacturer,
    manufacturerId,
    id: ampId,
    imageSrc,
    theme
  } = entry;
  const isSelected = selectedAmpId === ampId;
  const themeStyle = serializeAmpThemeStyle(theme);
  const ariaLabel = showManufacturer ? `${manufacturer} ${model}` : model;

  return `
    <article
      class="amp-browser-card${showManufacturer ? " amp-browser-card--with-manufacturer" : ""}"
      role="button"
      tabindex="0"
      aria-label="${escapeHtml(ariaLabel)}"
      data-amp-id="${escapeHtml(ampId)}"
      data-manufacturer-id="${escapeHtml(manufacturerId)}"
      data-selected="${isSelected ? "true" : "false"}"
      style="${escapeHtml(themeStyle)}"
    >
      <div class="amp-browser-card-media">
        <img
          class="amp-browser-card-image"
          src="${escapeHtml(imageSrc)}"
          alt=""
          loading="lazy"
        />
      </div>
      <div class="amp-browser-card-meta">
        ${
          showManufacturer
            ? `<span class="amp-browser-card-manufacturer">${escapeHtml(manufacturer)}</span>`
            : ""
        }
        <strong class="amp-browser-card-model">${escapeHtml(model)}</strong>
      </div>
    </article>
  `;
}

function manufacturerGroupId(manufacturerId) {
  return manufacturerId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderAmpBrowserGroup(
  { manufacturerId, manufacturer, entries },
  sectionIndex = 0
) {
  const groupId = `amp-group-${manufacturerGroupId(manufacturerId)}-${sectionIndex}`;
  const chapterMeta = renderManufacturerChapterMeta(
    manufacturerId,
    entries.length
  );

  return `
    <section
      class="amp-browser-group"
      id="${groupId}"
      data-manufacturer-id="${escapeHtml(manufacturerId)}"
      aria-labelledby="${groupId}-title"
    >
      <header class="amp-browser-group-header">
        <button
          type="button"
          class="gear-manufacturer-link amp-browser-group-title"
          id="${groupId}-title"
          data-manufacturer-id="${escapeHtml(manufacturerId)}"
        >
          ${escapeHtml(manufacturer)}
        </button>
        <div class="amp-browser-group-rule" aria-hidden="true"></div>
        ${
          chapterMeta
            ? `<p class="amp-browser-group-meta">${escapeHtml(chapterMeta)}</p>`
            : ""
        }
      </header>
      <div class="amp-browser-group-grid" role="group" aria-label="${escapeHtml(manufacturer)} amps">
        ${entries.map((entry) => renderAmpBrowserCard(entry)).join("")}
      </div>
    </section>
  `;
}

function renderAmpModelView(entries) {
  return `
    <div class="amp-browser-flat-grid" role="list" aria-label="Amps by model">
      ${entries
        .map((entry) => renderAmpBrowserCard(entry, { showManufacturer: true }))
        .join("")}
    </div>
  `;
}

/**
 * @param {import("./library/ampLibrary.js").AmpTimelineSection} section
 */
function renderAmpTimelineYearSection(section) {
  return `
    <section
      class="amp-browser-year-section"
      id="${escapeHtml(section.sectionId)}"
      data-timeline-year="${section.year === null ? "unknown" : section.year}"
      aria-labelledby="${escapeHtml(section.sectionId)}-title"
    >
      <h3 id="${escapeHtml(section.sectionId)}-title" class="amp-browser-year-title">
        ${escapeHtml(section.label)}
      </h3>
      <div class="amp-browser-group-grid" role="group" aria-label="${escapeHtml(section.label)} amps">
        ${section.entries
          .map((entry) => renderAmpBrowserCard(entry, { showManufacturer: true }))
          .join("")}
      </div>
    </section>
  `;
}

function renderAmpTimelineView(entries) {
  const sections = buildAmpTimelineSections(entries);
  return sections.map((section) => renderAmpTimelineYearSection(section)).join("");
}

/**
 * @param {string | null | undefined} manufacturerId
 */
function setChapterSelectManufacturer(manufacturerId) {
  if (!gearLibraryChapterSelect || !manufacturerId) return;
  if (gearLibraryChapterSelect.value === manufacturerId) return;

  const hasOption = [...gearLibraryChapterSelect.options].some(
    (option) => option.value === manufacturerId
  );
  if (!hasOption) return;

  gearLibraryChapterSelect.value = manufacturerId;
}

function teardownMuseumOpticalAlign() {
  if (stopMuseumOpticalAlign) {
    stopMuseumOpticalAlign();
    stopMuseumOpticalAlign = null;
  }
}

function syncMuseumModelNavVisibility(museumMode = isMuseumDesignMode()) {
  if (!museumModelNav) return;

  const show =
    Boolean(museumMode) && isAmpsCategory() && !isPresentationModeActive();
  museumModelNav.hidden = !show;
  museumModelNav.setAttribute("aria-hidden", show ? "false" : "true");

  if (!show && museumModelNavTrack) {
    museumModelNavTrack.innerHTML = "";
  }

  if (!show) teardownMuseumOpticalAlign();
}

/**
 * @param {import("./library/ampLibrary.js").AmpBrowseEntry[]} entries
 * @param {string | null | undefined} activeAmpId
 */
function renderMuseumModelNavigation(entries, activeAmpId) {
  if (!museumModelNavTrack) return;

  museumModelNavTrack.innerHTML = renderMuseumModelNav(entries, activeAmpId);

  const activeButton = museumModelNavTrack.querySelector(
    '.museum-model-nav-item[data-active="true"]'
  );
  activeButton?.scrollIntoView({
    block: "nearest",
    inline: "center",
    behavior: "smooth"
  });
}

/**
 * @param {import("./library/ampLibrary.js").AmpBrowseEntry[]} entries
 */
function renderMuseumBrowser(entries) {
  const sections = buildAmpManufacturerViewSections(entries);
  const preferredManufacturerId =
    museumState.manufacturerId ||
    gearLibraryChapterSelect?.value ||
    null;
  const section = resolveMuseumSection(sections, preferredManufacturerId);

  if (!section) {
    ampBrowserGrid.innerHTML = "";
    syncMuseumModelNavVisibility(true);
    if (museumModelNavTrack) museumModelNavTrack.innerHTML = "";
    return;
  }

  const ampId = resolveMuseumAmpId(section, museumState.ampId);
  museumState.manufacturerId = section.manufacturerId;
  museumState.ampId = ampId;

  setChapterSelectManufacturer(section.manufacturerId);
  syncMuseumModelNavVisibility(true);
  renderMuseumModelNavigation(section.entries, ampId);

  const exhibit = getMuseumExhibitEntry(ampId);
  teardownMuseumOpticalAlign();
  ampBrowserGrid.innerHTML = renderMuseumExhibition({
    manufacturer: section.manufacturer,
    manufacturerId: section.manufacturerId,
    exhibit
  });

  if (gearLibraryScroll) gearLibraryScroll.scrollTop = 0;
  stopMuseumOpticalAlign = bindMuseumOpticalAlign(ampBrowserGrid);
}

function syncChapterNavigation(entries = ampCatalogEntries) {
  const activeId = isMuseumDesignMode()
    ? museumState.manufacturerId || gearLibraryChapterSelect?.value || null
    : gearLibraryChapterSelect?.value || null;

  syncChapterSelect(gearLibraryChapterSelect, buildChapterOptions(entries), {
    selectedId: activeId
  });
}

function handleChapterSelectChange() {
  const manufacturerId = gearLibraryChapterSelect?.value;
  if (!manufacturerId) return;

  if (isMuseumDesignMode()) {
    museumState.manufacturerId = manufacturerId;
    museumState.ampId = null;
    renderAmpBrowser();
    return;
  }

  jumpToManufacturerChapter({
    manufacturerId,
    root: ampBrowserGrid,
    scrollRoot: gearLibraryScroll,
    topPadding: 16
  });
}

function handleMuseumModelNavClick(event) {
  if (!isMuseumDesignMode()) return;

  const button = event.target.closest(".museum-model-nav-item");
  if (!button || !museumModelNavTrack?.contains(button)) return;

  const ampId = button.dataset.ampId;
  const manufacturerId = button.dataset.manufacturerId;
  if (!ampId) return;

  if (
    museumState.ampId === ampId &&
    museumState.manufacturerId === manufacturerId
  ) {
    return;
  }

  museumState.manufacturerId = manufacturerId || museumState.manufacturerId;
  museumState.ampId = ampId;
  renderAmpBrowser();
}

function syncAmpBrowserPresentation() {
  const isTimeline = isTimelinePresentation();
  const sortSpec = parseAmpSortSpec(ampBrowserState.sort);
  const designMode = getActiveGearDesignMode();
  const museumMode = isMuseumDesignMode(designMode);
  const collectionsMode = isCollectionsDesignMode(designMode);
  const hideSortControls = isManufacturersCategory() || isTimeline || museumMode;
  const hideViewIcons = isTimeline;

  if (gearAmpBrowserStage) {
    gearAmpBrowserStage.dataset.ampView = isTimeline ? "timeline" : sortSpec.field;
    gearAmpBrowserStage.dataset.atlasPresentation = ampBrowserState.atlasPresentation;
    gearAmpBrowserStage.dataset.gearDesign = designMode;
  }

  if (ampBrowserGrid) {
    ampBrowserGrid.dataset.ampPresentation = museumMode
      ? "museum"
      : collectionsMode
        ? "collections"
        : isTimeline
          ? "timeline"
          : isManufacturerSort(ampBrowserState.sort)
            ? "manufacturer"
            : "model";
    ampBrowserGrid.dataset.gearDesign = designMode;
  }

  if (gearLibraryViewWrap) {
    gearLibraryViewWrap.classList.toggle("is-inactive", hideSortControls);
    gearLibraryViewWrap.setAttribute(
      "aria-hidden",
      hideSortControls ? "true" : "false"
    );
  }

  if (gearLibraryChapterWrap) {
    gearLibraryChapterWrap.classList.toggle("is-inactive", isManufacturersCategory() || isTimeline);
    gearLibraryChapterWrap.setAttribute(
      "aria-hidden",
      isManufacturersCategory() || isTimeline ? "true" : "false"
    );
  }

  if (gearDesignPreview) {
    gearDesignPreview.classList.toggle("is-inactive", hideViewIcons);
    gearDesignPreview.setAttribute("aria-hidden", hideViewIcons ? "true" : "false");
  }

  if (gearAtlasPresentationToggle) {
    const hideTimelineToggle = isManufacturersCategory() || museumMode;
    gearAtlasPresentationToggle.classList.toggle("is-inactive", hideTimelineToggle);
    gearAtlasPresentationToggle.setAttribute(
      "aria-hidden",
      hideTimelineToggle ? "true" : "false"
    );
    gearAtlasPresentationToggle.hidden = hideTimelineToggle;
  }

  if (gearAmpTimelineRail) {
    gearAmpTimelineRail.hidden = !isTimeline || museumMode || collectionsMode;
  }

  syncAtlasPresentationToggle();
  syncMuseumModelNavVisibility(museumMode);
}

function disconnectTimelineYearObserver() {
  if (timelineYearObserver) {
    timelineYearObserver.disconnect();
    timelineYearObserver = null;
  }
}

function setActiveTimelineYear(yearKey) {
  if (!gearAmpTimelineTrack) return;

  gearAmpTimelineTrack.querySelectorAll(".gear-amp-timeline-year").forEach((button) => {
    const isActive = button.dataset.timelineYear === String(yearKey);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function scrollToTimelineYear(yearKey, { smooth = true } = {}) {
  if (!gearLibraryScroll) return;

  const section = ampBrowserGrid?.querySelector(
    `[data-timeline-year="${CSS.escape(String(yearKey))}"]`
  );
  if (!section) return;

  const scrollTop =
    section.getBoundingClientRect().top -
    gearLibraryScroll.getBoundingClientRect().top +
    gearLibraryScroll.scrollTop -
    24;

  gearLibraryScroll.scrollTo({
    top: Math.max(0, scrollTop),
    behavior: smooth ? "smooth" : "auto"
  });
  setActiveTimelineYear(yearKey);
}

function renderTimelineRail(entries) {
  if (!gearAmpTimelineTrack) return;

  const sections = buildAmpTimelineSections(entries);
  const known = sections.filter((section) => section.year !== null);
  const minYear = known[0]?.year ?? null;
  const maxYear = known[known.length - 1]?.year ?? null;
  const span = minYear !== null && maxYear !== null ? Math.max(1, maxYear - minYear) : 1;

  gearAmpTimelineTrack.innerHTML = sections
    .map((section) => {
      const yearKey = section.year === null ? "unknown" : section.year;
      const top =
        section.year === null || minYear === null
          ? 100
          : ((section.year - minYear) / span) * 100;
      const showLabel =
        section.year === null ||
        section.year === minYear ||
        section.year === maxYear ||
        (typeof section.year === "number" && section.year % 10 === 0);

      return `
        <button
          type="button"
          class="gear-amp-timeline-year${showLabel ? " has-label" : ""}"
          data-timeline-year="${escapeHtml(String(yearKey))}"
          style="top: ${Math.min(100, Math.max(0, top))}%"
          aria-label="Go to ${escapeHtml(section.label)}"
          title="${escapeHtml(section.label)}"
        >
          <span class="gear-amp-timeline-year-marker" aria-hidden="true"></span>
          <span class="gear-amp-timeline-year-label">${escapeHtml(section.label)}</span>
        </button>
      `;
    })
    .join("");

  if (sections[0]) {
    setActiveTimelineYear(sections[0].year === null ? "unknown" : sections[0].year);
  }
}

function observeTimelineYears() {
  disconnectTimelineYearObserver();
  if (!gearLibraryScroll || !ampBrowserGrid) return;

  const sections = [
    ...ampBrowserGrid.querySelectorAll(".amp-browser-year-section[data-timeline-year]")
  ];
  if (!sections.length) return;

  timelineYearObserver = new IntersectionObserver(
    (observations) => {
      const visible = observations
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

      const active = visible[0]?.target;
      if (!active) return;

      setActiveTimelineYear(active.dataset.timelineYear || "unknown");
    },
    {
      root: gearLibraryScroll,
      threshold: [0.2, 0.45],
      rootMargin: "-18% 0px -55% 0px"
    }
  );

  sections.forEach((section) => timelineYearObserver?.observe(section));
}

function nearestTimelineYearKey(clientY) {
  if (!gearAmpTimelineTrack) return null;

  const buttons = [
    ...gearAmpTimelineTrack.querySelectorAll(".gear-amp-timeline-year")
  ];
  if (!buttons.length) return null;

  let nearest = buttons[0];
  let nearestDistance = Infinity;

  for (const button of buttons) {
    const rect = button.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const distance = Math.abs(clientY - midpoint);
    if (distance < nearestDistance) {
      nearest = button;
      nearestDistance = distance;
    }
  }

  return nearest.dataset.timelineYear || "unknown";
}

function bindTimelineRail() {
  if (!gearAmpTimelineTrack || timelineRailBound) return;

  timelineRailBound = true;
  let isDragging = false;

  gearAmpTimelineTrack.addEventListener("click", (event) => {
    const yearButton = event.target.closest(".gear-amp-timeline-year");
    if (!yearButton || !gearAmpTimelineTrack.contains(yearButton)) return;
    scrollToTimelineYear(yearButton.dataset.timelineYear || "unknown");
  });

  gearAmpTimelineTrack.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    isDragging = true;
    gearAmpTimelineTrack.setPointerCapture(event.pointerId);
    const yearKey = nearestTimelineYearKey(event.clientY);
    if (yearKey) scrollToTimelineYear(yearKey, { smooth: false });
  });

  gearAmpTimelineTrack.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const yearKey = nearestTimelineYearKey(event.clientY);
    if (yearKey) scrollToTimelineYear(yearKey, { smooth: false });
  });

  const endDrag = (event) => {
    if (!isDragging) return;
    isDragging = false;
    if (gearAmpTimelineTrack.hasPointerCapture(event.pointerId)) {
      gearAmpTimelineTrack.releasePointerCapture(event.pointerId);
    }
  };

  gearAmpTimelineTrack.addEventListener("pointerup", endDrag);
  gearAmpTimelineTrack.addEventListener("pointercancel", endDrag);
}

function applyAmpDetailHeroTheme(hero, theme) {
  applyAmpThemeToElement(hero, theme, { detail: true });
  hero.dataset.themeVisible = "false";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hero.dataset.themeVisible = "true";
    });
  });
}

/**
 * @param {import("./library/ampLibrary.js").AmpDetailView} detail
 * @param {{
 *   image: HTMLImageElement | null,
 *   heroSelector: string,
 *   applyTheme: boolean,
 *   manufacturer: HTMLElement | null,
 *   model: HTMLElement | null,
 *   specs: HTMLElement | null,
 *   description: HTMLElement | null,
 *   history: HTMLElement | null,
 *   powerSection?: HTMLElement | null,
 *   power?: HTMLElement | null,
 *   valveSection: HTMLElement | null,
 *   valveList: HTMLElement | null,
 *   playedBySection: HTMLElement | null,
 *   playedByList: HTMLElement | null,
 *   playedByAsChips?: boolean,
 *   classNames: {
 *     section: string,
 *     spec: string,
 *     valveRow: string,
 *     valveLabel: string,
 *     valveValue: string,
 *     artistChip?: string
 *   }
 * }} target
 */

/**
 * @param {import("./library/ampLibrary.js").AmpDetailView} detail
 * @returns {string}
 */
function buildKempanionDetailMetaLine(detail) {
  /** @type {Record<string, string>} */
  const byLabel = Object.fromEntries(
    detail.specs.map((spec) => [spec.label, spec.value])
  );
  return [byLabel.Country, byLabel.Year, byLabel.Type]
    .filter((value) => Boolean(String(value || "").trim()))
    .join(" • ");
}

/**
 * Compact catalog facts only — Country/Year/Type already live in the hero meta.
 * @param {import("./library/ampLibrary.js").AmpDetailView} detail
 * @returns {{ label: string, value: string }[]}
 */
function buildKempanionTechRows(detail) {
  /** @type {{ label: string, value: string }[]} */
  const rows = [];

  if (detail.power) rows.push({ label: "Power", value: detail.power });

  for (const line of detail.valveConfiguration || []) {
    const label =
      line.label === "Preamp"
        ? "Preamp Tubes"
        : line.label === "Power"
          ? "Power Tubes"
          : line.label;
    rows.push({ label, value: line.value });
  }

  return rows;
}

function populateAmpDetailContent(detail, target) {
  if (target.image) {
    const hero = target.image.closest(target.heroSelector);

    target.image.src = detail.imageSrc;
    target.image.alt = `${detail.manufacturer} ${detail.model}`;
    target.image.hidden = false;
    if (hero) {
      hero.dataset.hasImage = detail.imageSrc ? "true" : "false";
      if (target.applyTheme) {
        applyAmpDetailHeroTheme(hero, detail.theme);
      }
    }
  }

  if (target.manufacturer) {
    target.manufacturer.textContent = detail.manufacturer;
    target.manufacturer.dataset.manufacturerId = detail.manufacturerId;
  }

  if (target.model) {
    target.model.textContent = detail.model;
  }

  if (target.specs) {
    const specs =
      target.powerSection
        ? detail.specs.filter((spec) => spec.label !== "Power")
        : detail.specs;
    const hasSpecs = specs.length > 0;
    const specLabelClass = target.classNames.specLabel;
    const specValueClass = target.classNames.specValue;
    target.specs.hidden = !hasSpecs;
    target.specs.innerHTML = hasSpecs
      ? specs
          .map((spec) => {
            if (specLabelClass && specValueClass) {
              return `<div class="${target.classNames.spec}"><span class="${specLabelClass}">${escapeHtml(spec.label)}</span><span class="${specValueClass}">${escapeHtml(spec.value)}</span></div>`;
            }
            return `<span class="${target.classNames.spec}">${escapeHtml(spec.value)}</span>`;
          })
          .join("")
      : "";
  }

  if (target.description) {
    const descriptionSection = target.description.closest(
      `.${target.classNames.section}`
    );
    const hasDescription = Boolean(detail.description?.trim());
    target.description.textContent = hasDescription ? detail.description : "";
    if (descriptionSection) descriptionSection.hidden = !hasDescription;
  }

  if (target.powerSection && target.power) {
    const hasPower = Boolean(detail.power?.trim());
    target.powerSection.hidden = !hasPower;
    target.power.textContent = hasPower ? detail.power : "";
  }

  if (target.history) {
    const historySection = target.history.closest(`.${target.classNames.section}`);
    const hasHistory = Boolean(detail.history?.trim());
    target.history.textContent = hasHistory ? detail.history : "";
    if (historySection) historySection.hidden = !hasHistory;
  }

  if (target.valveSection && target.valveList) {
    const valveConfiguration = detail.valveConfiguration;
    const hasValveConfiguration = Boolean(valveConfiguration?.length);

    target.valveSection.hidden = !hasValveConfiguration;
    target.valveList.innerHTML = hasValveConfiguration
      ? valveConfiguration
          .map(
            ({ label, value }) => `
              <div class="${target.classNames.valveRow}">
                <p class="${target.classNames.valveLabel}">${escapeHtml(label)}</p>
                <p class="${target.classNames.valveValue}">${escapeHtml(value)}</p>
              </div>
            `
          )
          .join("")
      : "";
  }

  if (target.playedBySection && target.playedByList) {
    const playedBy = detail.playedBy.filter((name) =>
      Boolean(String(name).trim())
    );
    const hasPlayedBy = playedBy.length > 0;
    const chipClass =
      target.classNames.artistChip || "gear-archive-detail-artist-chip";

    target.playedBySection.hidden = !hasPlayedBy;
    target.playedByList.innerHTML = hasPlayedBy
      ? target.playedByAsChips
        ? playedBy
            .map(
              (name) =>
                `<span class="${chipClass}" role="listitem">${escapeHtml(name)}</span>`
            )
            .join("")
        : playedBy.map((name) => `<li>${escapeHtml(name)}</li>`).join("")
      : "";
  }
}

function renderAmpDetailPanel(ampId) {
  if (!gearAmpDetailOverlay) return;

  const detail = getAmpDetailView(ampId);
  if (!detail) return;

  populateAmpDetailContent(detail, {
    image: gearAmpDetailImage,
    heroSelector: ".gear-amp-detail-hero",
    applyTheme: true,
    manufacturer: gearAmpDetailManufacturer,
    model: gearAmpDetailModel,
    description: gearAmpDetailDescription,
    history: gearAmpDetailHistory,
    playedBySection: gearAmpDetailPlayedBySection,
    playedByList: gearAmpDetailPlayedByList,
    playedByAsChips: true,
    classNames: {
      section: "gear-amp-detail-section",
      spec: "gear-amp-detail-spec",
      valveRow: "gear-amp-detail-valve-row",
      valveLabel: "gear-amp-detail-valve-label",
      valveValue: "gear-amp-detail-valve-value",
      artistChip: "gear-amp-detail-artist-chip"
    }
  });

  if (gearAmpDetailDescriptionSection) {
    const description = String(detail.description || "").trim();
    const hasDescription =
      Boolean(description) && description.toLowerCase() !== "coming soon...";
    gearAmpDetailDescriptionSection.hidden = !hasDescription;
  }

  if (gearAmpDetailHistorySection) {
    const history = String(detail.history || "").trim();
    const hasHistory =
      Boolean(history) && history.toLowerCase() !== "coming soon...";
    gearAmpDetailHistorySection.hidden = !hasHistory;
  }

  if (gearAmpDetailMeta) {
    const metaLine = buildKempanionDetailMetaLine(detail);
    gearAmpDetailMeta.hidden = !metaLine;
    gearAmpDetailMeta.textContent = metaLine;
  }

  if (gearAmpDetailTechSection && gearAmpDetailTechList) {
    const rows = buildKempanionTechRows(detail);
    const hasRows = rows.length > 0;

    gearAmpDetailTechSection.hidden = !hasRows;
    gearAmpDetailTechList.innerHTML = hasRows
      ? rows
          .map(
            (row) => `
              <div class="gear-amp-detail-tech-fact">
                <span class="gear-amp-detail-tech-label">${escapeHtml(row.label)}</span>
                <span class="gear-amp-detail-tech-value">${escapeHtml(row.value)}</span>
              </div>
            `
          )
          .join("")
      : "";
  }
}

function renderArchiveAmpDetailPanel(ampId) {
  if (!gearArchiveAmpDetailOverlay) return;

  const detail = getAmpDetailView(ampId);
  if (!detail) return;

  populateAmpDetailContent(detail, {
    image: gearArchiveAmpDetailImage,
    heroSelector: ".gear-archive-detail-hero",
    applyTheme: false,
    manufacturer: gearArchiveAmpDetailManufacturer,
    model: gearArchiveAmpDetailModel,
    specs: gearArchiveAmpDetailSpecs,
    description: gearArchiveAmpDetailDescription,
    history: gearArchiveAmpDetailHistory,
    valveSection: gearArchiveAmpDetailValveSection,
    valveList: gearArchiveAmpDetailValveList,
    playedBySection: gearArchiveAmpDetailPlayedBySection,
    playedByList: gearArchiveAmpDetailPlayedByList,
    playedByAsChips: true,
    classNames: {
      section: "gear-archive-detail-section",
      spec: "gear-archive-detail-spec",
      specLabel: "gear-archive-detail-spec-label",
      specValue: "gear-archive-detail-spec-value",
      valveRow: "gear-archive-detail-valve-row",
      valveLabel: "gear-archive-detail-valve-label",
      valveValue: "gear-archive-detail-valve-value",
      artistChip: "gear-archive-detail-artist-chip"
    }
  });
}

function renderManufacturerDetailPanel(manufacturerId) {
  if (!gearManufacturerDetailOverlay) return;

  const detail = getManufacturerDetailView(manufacturerId);
  if (!detail) return;

  if (gearManufacturerDetailTitle) {
    gearManufacturerDetailTitle.textContent = detail.name;
  }

  if (gearManufacturerDetailMeta) {
    if (detail.metaLine) {
      gearManufacturerDetailMeta.textContent = detail.metaLine;
      gearManufacturerDetailMeta.hidden = false;
    } else {
      gearManufacturerDetailMeta.textContent = "";
      gearManufacturerDetailMeta.hidden = true;
    }
  }

  if (gearManufacturerDetailDescription) {
    if (detail.description) {
      gearManufacturerDetailDescription.textContent = detail.description;
      gearManufacturerDetailDescription.hidden = false;
    } else {
      gearManufacturerDetailDescription.textContent = "";
      gearManufacturerDetailDescription.hidden = true;
    }
  }

  if (gearManufacturerDetailHistory) {
    if (detail.history) {
      gearManufacturerDetailHistory.textContent = detail.history;
      gearManufacturerDetailHistory.hidden = false;
    } else {
      gearManufacturerDetailHistory.textContent = "";
      gearManufacturerDetailHistory.hidden = true;
    }
  }

  if (gearManufacturerDetailWebsite) {
    if (detail.websiteUrl) {
      gearManufacturerDetailWebsite.href = detail.websiteUrl;
      gearManufacturerDetailWebsite.hidden = false;
    } else {
      gearManufacturerDetailWebsite.removeAttribute("href");
      gearManufacturerDetailWebsite.hidden = true;
    }
  }
}

function setAmpDetailOpen(isOpen) {
  if (gearAmpDetailOverlay) {
    gearAmpDetailOverlay.dataset.open = isOpen ? "true" : "false";
    gearAmpDetailOverlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }

  updateGearOverlayLock();

  if (isOpen && gearAmpDetailClose) {
    gearAmpDetailClose.focus();
  }
}

function setArchiveAmpDetailOpen(isOpen) {
  if (gearArchiveAmpDetailOverlay) {
    gearArchiveAmpDetailOverlay.dataset.open = isOpen ? "true" : "false";
    gearArchiveAmpDetailOverlay.setAttribute(
      "aria-hidden",
      isOpen ? "false" : "true"
    );
  }

  updateGearOverlayLock();

  if (isOpen && gearArchiveAmpDetailClose) {
    gearArchiveAmpDetailClose.focus();
  }
}

function setManufacturerDetailOpen(isOpen) {
  if (gearManufacturerDetailOverlay) {
    gearManufacturerDetailOverlay.dataset.open = isOpen ? "true" : "false";
    gearManufacturerDetailOverlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }

  updateGearOverlayLock();

  if (isOpen && gearManufacturerDetailClose) {
    gearManufacturerDetailClose.focus();
  }
}

function handleGearOverlayKeydown(event) {
  if (event.key !== "Escape") return;
  if (isPresentationModeActive()) return;

  if (isGearAmpImageFocusOpen()) {
    event.preventDefault();
    closeGearAmpImageFocus();
    return;
  }

  if (isManufacturerDetailOpen()) {
    event.preventDefault();
    closeManufacturerDetail();
    return;
  }

  if (isArchiveAmpDetailOpen()) {
    event.preventDefault();
    closeArchiveAmpDetail();
    return;
  }

  if (isAmpDetailOpen()) {
    event.preventDefault();
    closeAmpDetail();
  }
}

function handleManufacturerLinkClick(event) {
  const manufacturerId = event.currentTarget?.dataset?.manufacturerId;
  if (!manufacturerId) return;

  event.preventDefault();
  openManufacturerDetail(manufacturerId);
}

function openManufacturerDetail(manufacturerId) {
  if (!getManufacturerDetailView(manufacturerId)) return;

  closeAmpDetail();
  closeArchiveAmpDetail();
  selectedManufacturerId = manufacturerId;
  renderManufacturerDetailPanel(manufacturerId);
  setManufacturerDetailOpen(true);
  updateManufacturerCardSelection();
}

function closeManufacturerDetail() {
  selectedManufacturerId = null;
  setManufacturerDetailOpen(false);
  updateManufacturerCardSelection();
}

function updateAmpCardSelection() {
  if (!ampBrowserGrid) return;

  ampBrowserGrid
    .querySelectorAll(".amp-browser-card, .collections-thumb")
    .forEach((card) => {
      card.dataset.selected =
        card.dataset.ampId === selectedAmpId ? "true" : "false";
    });
}

/**
 * Host for AmpDetailsOverlay — Kempanion technical detail card.
 *
 * @param {string} ampId
 * @returns {boolean}
 */
function openAmpDetail(ampId) {
  if (!ampId || !getAmpDetailView(ampId)) return false;

  closeManufacturerDetail();
  closeArchiveAmpDetail();
  selectedAmpId = ampId;
  renderAmpDetailPanel(ampId);
  setAmpDetailOpen(true);
  updateAmpCardSelection();
  return true;
}

/**
 * Gear Library boutique / archive detail card.
 *
 * @param {string} ampId
 * @returns {boolean}
 */
function openArchiveAmpDetail(ampId) {
  if (!ampId || !getAmpDetailView(ampId)) return false;

  closeManufacturerDetail();
  closeAmpDetail();
  selectedAmpId = ampId;
  renderArchiveAmpDetailPanel(ampId);
  setArchiveAmpDetailOpen(true);
  updateAmpCardSelection();
  return true;
}

function renderDiscoverEntry(article, view) {
  const categoryEl = article.querySelector(".gear-discover-category");
  const titleEl = article.querySelector(".gear-discover-title");
  const textEl = article.querySelector(".gear-discover-text");
  const ampLinkEl = article.querySelector(".gear-discover-amp-link");

  // Release: Discover is read-only — never surface amp links.
  if (ampLinkEl) {
    ampLinkEl.hidden = true;
    ampLinkEl.dataset.ampId = "";
    ampLinkEl.textContent = "";
    ampLinkEl.removeAttribute("aria-label");
  }

  if (!view) {
    article.hidden = true;
    article.dataset.discoverId = "";
    return;
  }

  article.hidden = false;
  article.dataset.discoverId = view.id;

  if (categoryEl) categoryEl.textContent = view.categoryLabel;
  if (titleEl) titleEl.textContent = view.title;
  if (textEl) textEl.textContent = view.text;
}

function clearDiscoverFadeTimers() {
  for (const timerId of discoverFadeTimers.values()) {
    clearTimeout(timerId);
  }
  discoverFadeTimers.clear();

  if (!gearDiscoverBoard) return;
  gearDiscoverBoard
    .querySelectorAll(".gear-discover-entry.is-fading-out")
    .forEach((el) => el.classList.remove("is-fading-out"));
}

/**
 * Crossfades a single Discover slot. Content swaps at mid-fade only.
 * @param {string} categoryId
 * @param {import("./library/discoverLibrary.js").DiscoverEntryView | null} view
 */
function fadeDiscoverSlot(categoryId, view) {
  if (!gearDiscoverBoard) return;

  const article = gearDiscoverBoard.querySelector(
    `[data-discover-category="${categoryId}"]`
  );
  if (!article) return;

  const previousTimer = discoverFadeTimers.get(categoryId);
  if (previousTimer !== undefined) {
    clearTimeout(previousTimer);
    discoverFadeTimers.delete(categoryId);
  }

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    article.classList.remove("is-fading-out");
    renderDiscoverEntry(article, view);
    return;
  }

  article.classList.add("is-fading-out");

  const timerId = setTimeout(() => {
    renderDiscoverEntry(article, view);
    // Next frame so the browser paints opacity:0 content before fading in.
    requestAnimationFrame(() => {
      article.classList.remove("is-fading-out");
      discoverFadeTimers.delete(categoryId);
    });
  }, DISCOVER_ROTATION_FADE_MS);

  discoverFadeTimers.set(categoryId, timerId);
}

function renderDiscoverBoard(state = discoverBoardState) {
  if (!gearDiscoverBoard || !state) return;

  discoverBoardState = state;
  clearDiscoverFadeTimers();

  for (const { id } of DISCOVER_BOARD_CATEGORIES) {
    const article = gearDiscoverBoard.querySelector(
      `[data-discover-category="${id}"]`
    );
    if (!article) continue;
    renderDiscoverEntry(article, state[id]?.view ?? null);
  }
}

function stopDiscoverRotation() {
  discoverRotationController?.stop();
  clearDiscoverFadeTimers();
}

function startDiscoverRotation() {
  if (!discoverRotationController || !gearDiscoverBoard) return;

  discoverBoardState = discoverRotationController.start();
  renderDiscoverBoard(discoverBoardState);
}

function initializeDiscoverColumn() {
  if (!gearDiscoverBoard) return;

  discoverRotationController = createDiscoverRotationController({
    onSlotRotate: ({ categoryId, view, state }) => {
      discoverBoardState = state;
      fadeDiscoverSlot(categoryId, view);
    }
  });

  startDiscoverRotation();
}

function closeAmpDetail() {
  if (isAmpDetailOpen()) {
    closeGearAmpImageViews();
  }
  if (!isArchiveAmpDetailOpen()) {
    selectedAmpId = null;
  }
  setAmpDetailOpen(false);
  updateAmpCardSelection();
}

function closeArchiveAmpDetail() {
  if (isArchiveAmpDetailOpen()) {
    closeGearAmpImageViews();
  }
  if (!isAmpDetailOpen()) {
    selectedAmpId = null;
  }
  setArchiveAmpDetailOpen(false);
  updateAmpCardSelection();
}

function setDesignPreviewSelectValue(designId) {
  syncGearDesignPreviewSwitcher(designId);
}

function capturePresentationRestoreState() {
  return {
    designMode: getActiveGearDesignMode(),
    activeGearCategory,
    ampBrowserState: { ...ampBrowserState },
    museumState: { ...museumState },
    searchValue: gearLibrarySearch?.value ?? "",
    chapterValue: gearLibraryChapterSelect?.value ?? "",
    scrollTop: gearLibraryScroll?.scrollTop ?? 0,
    selectedAmpId,
    selectedManufacturerId
  };
}

/**
 * @param {ReturnType<typeof capturePresentationRestoreState> | null | undefined} snapshot
 */
function restorePresentationState(snapshot) {
  if (!snapshot) {
    renderAmpBrowser();
    return;
  }

  activeGearCategory = snapshot.activeGearCategory || GEAR_CATEGORY.AMPS;
  Object.assign(ampBrowserState, snapshot.ampBrowserState || {});
  normalizeAmpBrowserState();
  museumState.manufacturerId = snapshot.museumState?.manufacturerId ?? null;
  museumState.ampId = snapshot.museumState?.ampId ?? null;
  selectedAmpId = snapshot.selectedAmpId ?? null;
  selectedManufacturerId = snapshot.selectedManufacturerId ?? null;

  if (gearLibrarySearch) {
    gearLibrarySearch.value = snapshot.searchValue ?? "";
  }

  applyGearDesignPreview(snapshot.designMode || GEAR_DESIGN_MODE.DEFAULT, {
    rootElements: [
      document.querySelector("#gearCategoryShell"),
      document.querySelector("#gearAmpBrowserStage"),
      document.querySelector("#ampBrowserGrid")
    ]
  });
  setDesignPreviewSelectValue(getActiveGearDesignMode());

  updateGearCategoryPanels();
  syncGearLibrarySearchField();
  if (gearAmpViewSelect) gearAmpViewSelect.value = ampBrowserState.sort;
  syncAtlasPresentationToggle();
  syncAmpImageFilterUi();
  renderAmpBrowser();

  if (gearLibraryChapterSelect && snapshot.chapterValue) {
    setChapterSelectManufacturer(snapshot.chapterValue);
  }

  if (gearLibraryScroll) {
    gearLibraryScroll.scrollTop = snapshot.scrollTop ?? 0;
  }
}

function enterPresentationMuseumLayout() {
  closeAllGearOverlays();

  if (!isAmpsCategory()) {
    activeGearCategory = GEAR_CATEGORY.AMPS;
    updateGearCategoryPanels();
  }

  applyGearDesignPreview(GEAR_DESIGN_MODE.MUSEUM, {
    rootElements: [
      document.querySelector("#gearCategoryShell"),
      document.querySelector("#gearAmpBrowserStage"),
      document.querySelector("#ampBrowserGrid")
    ]
  });
  setDesignPreviewSelectValue(GEAR_DESIGN_MODE.MUSEUM);
  syncAmpBrowserPresentation();
}

/**
 * @param {string} variantId
 */
function applyPresentationVariantLayout(variantId) {
  const config = getPresentationVariantConfig(variantId);
  document.body.dataset.presentationVariant = variantId;

  if (gearLibraryViewRoot) {
    gearLibraryViewRoot.dataset.presentationVariant = variantId;
  }

  if (!config) return;

  if (config.showsDiscover) {
    if (!discoverRotationController?.isRunning() && !config.drivesDiscoverRotation) {
      startDiscoverRotation();
    }
    if (config.drivesDiscoverRotation) {
      stopDiscoverRotation();
      if (discoverRotationController) {
        discoverBoardState = discoverRotationController.rotateAll({
          emit: false
        });
        renderDiscoverBoard(discoverBoardState);
      }
    }
  } else {
    stopDiscoverRotation();
  }

  if (gearDiscoverColumn) {
    gearDiscoverColumn.hidden = !config.showsDiscover;
    gearDiscoverColumn.setAttribute(
      "aria-hidden",
      config.showsDiscover ? "false" : "true"
    );
  }

  if (gearCategoryShell) {
    gearCategoryShell.hidden = !config.showsAmp;
    gearCategoryShell.setAttribute(
      "aria-hidden",
      config.showsAmp ? "false" : "true"
    );
  }

  schedulePresentationFit();
}

function clearPresentationVariantLayout() {
  stopPresentationFit();
  delete document.body.dataset.presentationVariant;
  if (gearLibraryViewRoot) {
    delete gearLibraryViewRoot.dataset.presentationVariant;
  }

  if (gearDiscoverColumn) {
    gearDiscoverColumn.hidden = false;
    gearDiscoverColumn.setAttribute("aria-hidden", "false");
  }

  if (gearCategoryShell) {
    gearCategoryShell.hidden = false;
    gearCategoryShell.setAttribute("aria-hidden", "false");
  }

  if (activeView === APP_VIEW.GEAR && !discoverRotationController?.isRunning()) {
    startDiscoverRotation();
  }
}

function schedulePresentationFit() {
  if (!isPresentationModeActive()) return;
  bindPresentationFit(gearLibraryViewRoot || document.querySelector("#gearLibraryView"));
}

function rotatePresentationDiscoverBoard() {
  if (!discoverRotationController) return;

  // Keep the interval engine stopped in Discover Only; presentation timer owns ticks.
  discoverRotationController.stop();
  discoverBoardState = discoverRotationController.rotateAll({ emit: false });
  renderDiscoverBoard(discoverBoardState);
  schedulePresentationFit();
}

/**
 * @param {string} scope
 * @param {{
 *   manufacturerId?: string | null,
 *   strategy?: string | null,
 *   modeId?: string | null
 * }} [context]
 */
function buildPresentationPlaylist(scope, context = {}) {
  presentationCatalogEntries = getAmpBrowseEntries({
    query: "",
    manufacturer: "",
    sort: AMP_SORT.MANUFACTURER_ASC,
    imageFilter: AMP_IMAGE_FILTER.ALL
  });

  /** @type {import("./presentation/presentationPlaylist.js").PresentationPlaylistItem[]} */
  let items = presentationCatalogEntries.map((entry) => {
    const amp = getAmpById(entry.id);
    const sortYear = entry.sortYear ?? null;
    return {
      ampId: entry.id,
      manufacturerId: entry.manufacturerId,
      manufacturer: entry.manufacturer,
      sortYear,
      ampType: amp?.ampType ? String(amp.ampType) : null,
      power: amp?.power ? String(amp.power) : null,
      decade: decadeFromYear(sortYear),
      powerClass: classifyPowerClass(amp?.power),
      chapterId: entry.manufacturerId || entry.manufacturer || null
    };
  });

  if (scope === PRESENTATION_SCOPE.MANUFACTURER) {
    const manufacturerId = String(
      context.manufacturerId || museumState.manufacturerId || ""
    ).trim();
    if (manufacturerId) {
      items = items.filter((item) => item.manufacturerId === manufacturerId);
    }
  }

  const strategy = context.strategy || "bag";
  const ordered = buildPlaylistByStrategy(items, strategy);

  return ordered.map((item) => ({
    ampId: item.ampId,
    manufacturerId: item.manufacturerId,
    manufacturer: item.manufacturer
  }));
}

/**
 * @param {{ ampId: string, manufacturerId: string }} slide
 */
function showPresentationSlide(slide) {
  museumState.manufacturerId = slide.manufacturerId;
  museumState.ampId = slide.ampId;
  setChapterSelectManufacturer(slide.manufacturerId);
  renderMuseumBrowser(presentationCatalogEntries);
  schedulePresentationFit();
}

function getPresentationFadeTarget() {
  const variant = getPresentationVariant();
  const config = getPresentationVariantConfig(variant);

  if (config && !config.showsAmp) {
    return gearDiscoverColumn || gearDiscoverBoard;
  }

  return (
    ampBrowserGrid?.querySelector(".museum-catalog") ||
    ampBrowserGrid?.querySelector(".museum-stage") ||
    ampBrowserGrid
  );
}

function setupPresentationMode() {
  initializePresentationMode({
    modeButton: gearPresentationButton,
    modeButtonLabel: gearPresentationButtonLabel,
    exitButton: gearPresentationExit,
    host: {
      captureState: capturePresentationRestoreState,
      restoreState: (snapshot) => {
        clearPresentationVariantLayout();
        restorePresentationState(snapshot);
      },
      enterMuseumLayout: enterPresentationMuseumLayout,
      applyPresentationVariant: applyPresentationVariantLayout,
      clearPresentationVariant: clearPresentationVariantLayout,
      buildPlaylist: buildPresentationPlaylist,
      showSlide: showPresentationSlide,
      rotateDiscoverBoard: rotatePresentationDiscoverBoard,
      getFadeTarget: getPresentationFadeTarget,
      getEnterOptions: () => ({
        startAmpId: museumState.ampId || selectedAmpId,
        manufacturerId:
          museumState.manufacturerId ||
          selectedManufacturerId ||
          gearLibraryChapterSelect?.value ||
          null
      }),
      handleEscape: () => {
        if (isGearAmpImageFocusOpen()) {
          closeGearAmpImageFocus();
          return true;
        }
        return false;
      },
      onActiveChange: (active) => {
        if (active) closeModuleMenu();
        syncMuseumModelNavVisibility(isMuseumDesignMode());
      },
      onCompositionReady: () => {
        schedulePresentationFit();
      }
    }
  });
}

function renderAmpBrowser() {
  if (!ampBrowserGrid) return;
  if (isPresentationModeActive()) return;

  normalizeAmpBrowserState();
  ampCatalogEntries = loadAmpBrowseEntries();
  const isTimeline = isTimelinePresentation();
  const designMode = getActiveGearDesignMode();
  const museumMode = isMuseumDesignMode(designMode);
  const collectionsMode = isCollectionsDesignMode(designMode);

  if (selectedAmpId && !findAmpEntry(selectedAmpId)) {
    closeAmpDetail();
  }

  if (museumMode && isAmpDetailOpen()) {
    closeAmpDetail();
  }

  if (!museumMode) {
    teardownMuseumOpticalAlign();
    syncMuseumModelNavVisibility(false);
  }

  renderLibraryStats(ampCatalogEntries.length);
  syncAmpBrowserPresentation();
  syncChapterNavigation(ampCatalogEntries);

  const isEmpty = ampCatalogEntries.length === 0;
  ampBrowserGrid.hidden = isEmpty;
  updateGearLibraryEmptyState(isEmpty, "No amps match your filters.");

  disconnectTimelineYearObserver();

  if (isEmpty) {
    ampBrowserGrid.innerHTML = "";
    if (gearAmpTimelineTrack) gearAmpTimelineTrack.innerHTML = "";
    if (museumMode && museumModelNavTrack) museumModelNavTrack.innerHTML = "";
    return;
  }

  const footnote = renderCollectionStatsFootnote(ampCatalogEntries.length);

  if (isTimeline) {
    ampBrowserGrid.innerHTML = `${renderAmpTimelineView(ampCatalogEntries)}${footnote}`;
    renderTimelineRail(ampCatalogEntries);
    observeTimelineYears();
    if (gearLibraryScroll) {
      gearLibraryScroll.scrollTop = 0;
    }
    return;
  }

  if (museumMode) {
    if (gearAmpTimelineTrack) gearAmpTimelineTrack.innerHTML = "";
    renderMuseumBrowser(ampCatalogEntries);
    return;
  }

  if (collectionsMode) {
    if (gearAmpTimelineTrack) gearAmpTimelineTrack.innerHTML = "";
    const sections = buildAmpManufacturerViewSections(ampCatalogEntries);
    ampBrowserGrid.innerHTML = `${renderCollectionsCatalog(sections)}${footnote}`;
    if (gearLibraryScroll) gearLibraryScroll.scrollTop = 0;
    updateAmpCardSelection();
    return;
  }

  if (gearAmpTimelineTrack) gearAmpTimelineTrack.innerHTML = "";

  if (isManufacturerSort(ampBrowserState.sort)) {
    ampBrowserGrid.innerHTML = `${buildAmpManufacturerViewSections(ampCatalogEntries)
      .map((section, sectionIndex) => renderAmpBrowserGroup(section, sectionIndex))
      .join("")}${footnote}`;
    return;
  }

  ampBrowserGrid.innerHTML = `${renderAmpModelView(ampCatalogEntries)}${footnote}`;
}

function handleGearDesignModeChange() {
  closeAllGearOverlays();
  renderAmpBrowser();
}

/** @type {ReturnType<typeof setTimeout> | null} */
let pendingAmpCardClick = null;

function clearPendingAmpCardClick() {
  if (pendingAmpCardClick != null) {
    clearTimeout(pendingAmpCardClick);
    pendingAmpCardClick = null;
  }
}

function handleAmpBrowserClick(event) {
  if (isMuseumDesignMode()) {
    // Museum exhibits are self-contained — no detail overlay.
    return;
  }

  const manufacturerLink = event.target.closest(".gear-manufacturer-link");
  if (
    manufacturerLink?.dataset?.manufacturerId &&
    ampBrowserGrid?.contains(manufacturerLink)
  ) {
    clearPendingAmpCardClick();
    openManufacturerDetail(manufacturerLink.dataset.manufacturerId);
    return;
  }

  const card = event.target.closest(
    isCollectionsDesignMode() ? ".collections-thumb" : ".amp-browser-card"
  );
  if (!card || !ampBrowserGrid?.contains(card)) return;

  // Delay detail open so double-click on the image can open fullscreen instead.
  const ampId = card.dataset.ampId;
  clearPendingAmpCardClick();
  pendingAmpCardClick = setTimeout(() => {
    pendingAmpCardClick = null;
    openArchiveAmpDetail(ampId);
  }, 220);
}

function handleAmpBrowserDblClick(event) {
  if (isMuseumDesignMode()) {
    const museumImage = event.target.closest(".museum-exhibit-image");
    if (museumImage && ampBrowserGrid?.contains(museumImage)) {
      event.preventDefault();
      event.stopPropagation();
      openGearAmpImageFocus(museumImage);
    }
    return;
  }

  if (isCollectionsDesignMode()) {
    const thumbImage = event.target.closest(".collections-thumb-image");
    if (thumbImage && ampBrowserGrid?.contains(thumbImage)) {
      clearPendingAmpCardClick();
      event.preventDefault();
      event.stopPropagation();
      openGearAmpImageFocus(thumbImage);
    }
    return;
  }

  const image = event.target.closest(".amp-browser-card-image");
  if (!image || !ampBrowserGrid?.contains(image)) return;

  clearPendingAmpCardClick();
  event.preventDefault();
  event.stopPropagation();
  openGearAmpImageFocus(image);
}

function handleAmpBrowserKeydown(event) {
  if (isMuseumDesignMode()) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest(
    isCollectionsDesignMode() ? ".collections-thumb" : ".amp-browser-card"
  );
  if (!card || !ampBrowserGrid?.contains(card)) return;

  event.preventDefault();
  openArchiveAmpDetail(card.dataset.ampId);
}

function handleAmpSortChange() {
  const nextSort = gearAmpViewSelect?.value || AMP_SORT_DEFAULT;
  ampBrowserState.sort = isAmpSortOption(nextSort)
    ? nextSort
    : normalizeAmpSort(nextSort);

  if (gearAmpViewSelect && gearAmpViewSelect.value !== ampBrowserState.sort) {
    gearAmpViewSelect.value = ampBrowserState.sort;
  }

  closeAllGearOverlays();
  renderAmpBrowser();
}

function handleAtlasPresentationToggle() {
  ampBrowserState.atlasPresentation = isTimelinePresentation()
    ? AMP_ATLAS_PRESENTATION.COLLECTION
    : AMP_ATLAS_PRESENTATION.TIMELINE;

  closeAllGearOverlays();
  renderAmpBrowser();
}

function handleAmpImageFilterClick(event) {
  const button = event.target.closest(".gear-library-image-filter-option");
  if (!button || !gearAmpImageFilter?.contains(button)) return;

  const nextFilter = button.dataset.imageFilter;
  if (!nextFilter || nextFilter === ampBrowserState.imageFilter) return;

  ampBrowserState.imageFilter = nextFilter;
  syncAmpImageFilterUi();
  closeAllGearOverlays();
  renderAmpBrowser();
}

function setupGearLibraryControls() {
  renderSortOptions();
  syncAtlasPresentationToggle();
  syncAmpImageFilterUi();
  bindTimelineRail();

  if (gearCategoryNav) {
    gearCategoryNav.addEventListener("click", handleGearCategoryNavClick);
  }

  if (gearLibrarySearch) {
    gearLibrarySearch.addEventListener("input", handleGearLibrarySearchInput);
    gearLibrarySearch.addEventListener("keydown", handleGearLibrarySearchKeydown);
  }

  if (manufacturerBrowserGrid) {
    manufacturerBrowserGrid.addEventListener("click", handleManufacturerBrowserClick);
    manufacturerBrowserGrid.addEventListener("keydown", handleManufacturerBrowserKeydown);
  }

  if (gearAmpViewSelect) {
    gearAmpViewSelect.addEventListener("change", handleAmpSortChange);
  }

  if (gearAtlasPresentationToggle) {
    gearAtlasPresentationToggle.addEventListener("click", handleAtlasPresentationToggle);
  }

  if (gearLibraryChapterSelect) {
    gearLibraryChapterSelect.addEventListener("change", handleChapterSelectChange);
  }

  if (museumModelNavTrack) {
    museumModelNavTrack.addEventListener("click", handleMuseumModelNavClick);
  }

  if (gearAmpImageFilter) {
    gearAmpImageFilter.addEventListener("click", handleAmpImageFilterClick);
  }

  if (ampBrowserGrid) {
    ampBrowserGrid.addEventListener("click", handleAmpBrowserClick);
    ampBrowserGrid.addEventListener("dblclick", handleAmpBrowserDblClick);
    ampBrowserGrid.addEventListener("keydown", handleAmpBrowserKeydown);
  }

  if (gearAmpDetailImage) {
    gearAmpDetailImage.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openGearAmpImageFocus(gearAmpDetailImage);
    });
  }

  if (gearArchiveAmpDetailImage) {
    gearArchiveAmpDetailImage.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openGearAmpImageFocus(gearArchiveAmpDetailImage);
    });
  }

  if (gearAmpDetailClose) {
    gearAmpDetailClose.addEventListener("click", closeAmpDetail);
  }

  if (gearAmpDetailBackdrop) {
    gearAmpDetailBackdrop.addEventListener("click", closeAmpDetail);
  }

  if (gearArchiveAmpDetailClose) {
    gearArchiveAmpDetailClose.addEventListener("click", closeArchiveAmpDetail);
  }

  if (gearArchiveAmpDetailBackdrop) {
    gearArchiveAmpDetailBackdrop.addEventListener("click", closeArchiveAmpDetail);
  }

  if (gearAmpDetailManufacturer) {
    gearAmpDetailManufacturer.addEventListener("click", handleManufacturerLinkClick);
  }

  if (gearArchiveAmpDetailManufacturer) {
    gearArchiveAmpDetailManufacturer.addEventListener(
      "click",
      handleManufacturerLinkClick
    );
  }

  if (gearManufacturerDetailClose) {
    gearManufacturerDetailClose.addEventListener("click", closeManufacturerDetail);
  }

  if (gearManufacturerDetailBackdrop) {
    gearManufacturerDetailBackdrop.addEventListener("click", closeManufacturerDetail);
  }

  initializeGearAmpImageFocus({
    sourceImage: gearAmpDetailImage,
    onOpenChange: () => {
      updateGearOverlayLock();
    }
  });

  document.addEventListener("keydown", handleGearOverlayKeydown);
}

function bindGearLibraryDom() {
  appRoot = document.querySelector("#appRoot");
  liveViewRoot = document.querySelector("#liveView");
  gearLibraryViewRoot = document.querySelector("#gearLibraryView");
  gearLibraryTitle = document.querySelector("#gearLibraryTitle");
  gearLibraryCollectionMeta = document.querySelector("#gearLibraryCollectionMeta");
  gearCategoryShell = document.querySelector("#gearCategoryShell");
  gearLibraryScroll = document.querySelector("#gearLibraryScroll");
  gearLibrarySearch = document.querySelector("#gearLibrarySearch");
  gearLibraryViewWrap = document.querySelector("#gearLibraryViewWrap");
  gearAmpViewSelect = document.querySelector("#gearAmpViewSelect");
  gearAtlasPresentationToggle = document.querySelector("#gearAtlasPresentationToggle");
  gearDesignPreview = document.querySelector("#gearDesignPreview");
  gearLibraryChapterWrap = document.querySelector("#gearLibraryChapterWrap");
  gearLibraryChapterSelect = document.querySelector("#gearLibraryChapterSelect");
  museumModelNav = document.querySelector("#museumModelNav");
  museumModelNavTrack = document.querySelector("#museumModelNavTrack");
  gearPresentationButton = document.querySelector("#gearPresentationButton");
  gearPresentationButtonLabel = document.querySelector("#gearPresentationButtonLabel");
  gearPresentationExit = document.querySelector("#gearPresentationExit");
  gearDiscoverColumn = document.querySelector("#gearDiscoverColumn");
  gearAmpBrowserStage = document.querySelector("#gearAmpBrowserStage");
  gearAmpTimelineRail = document.querySelector("#gearAmpTimelineRail");
  gearAmpTimelineTrack = document.querySelector("#gearAmpTimelineTrack");
  gearAmpImageFilterWrap = document.querySelector("#gearAmpImageFilterWrap");
  gearAmpImageFilter = document.querySelector("#gearAmpImageFilter");
  manufacturerBrowserGrid = document.querySelector("#manufacturerBrowserGrid");
  ampBrowserGrid = document.querySelector("#ampBrowserGrid");
  gearLibraryStatsEl = document.querySelector("#gearLibraryStats");
  gearLibraryEmptyState = document.querySelector("#gearLibraryEmptyState");
  gearCategoryNav = document.querySelector("#gearCategoryNav");
  gearAmpDetailOverlay = document.querySelector("#gearAmpDetailOverlay");
  gearAmpDetailBackdrop = document.querySelector("#gearAmpDetailBackdrop");
  gearAmpDetailClose = document.querySelector("#gearAmpDetailClose");
  gearAmpDetailImage = document.querySelector("#gearAmpDetailImage");
  gearAmpDetailManufacturer = document.querySelector("#gearAmpDetailManufacturer");
  gearAmpDetailModel = document.querySelector("#gearAmpDetailModel");
  gearAmpDetailMeta = document.querySelector("#gearAmpDetailMeta");
  gearAmpDetailDescriptionSection = document.querySelector(
    "#gearAmpDetailDescriptionSection"
  );
  gearAmpDetailDescription = document.querySelector("#gearAmpDetailDescription");
  gearAmpDetailTechSection = document.querySelector("#gearAmpDetailTechSection");
  gearAmpDetailTechList = document.querySelector("#gearAmpDetailTechList");
  gearAmpDetailHistorySection = document.querySelector("#gearAmpDetailHistorySection");
  gearAmpDetailHistory = document.querySelector("#gearAmpDetailHistory");
  gearAmpDetailPlayedBySection = document.querySelector("#gearAmpDetailPlayedBySection");
  gearAmpDetailPlayedByList = document.querySelector("#gearAmpDetailPlayedByList");
  gearArchiveAmpDetailOverlay = document.querySelector("#gearArchiveAmpDetailOverlay");
  gearArchiveAmpDetailBackdrop = document.querySelector(
    "#gearArchiveAmpDetailBackdrop"
  );
  gearArchiveAmpDetailClose = document.querySelector("#gearArchiveAmpDetailClose");
  gearArchiveAmpDetailImage = document.querySelector("#gearArchiveAmpDetailImage");
  gearArchiveAmpDetailManufacturer = document.querySelector(
    "#gearArchiveAmpDetailManufacturer"
  );
  gearArchiveAmpDetailModel = document.querySelector("#gearArchiveAmpDetailModel");
  gearArchiveAmpDetailSpecs = document.querySelector("#gearArchiveAmpDetailSpecs");
  gearArchiveAmpDetailDescription = document.querySelector(
    "#gearArchiveAmpDetailDescription"
  );
  gearArchiveAmpDetailHistory = document.querySelector("#gearArchiveAmpDetailHistory");
  gearArchiveAmpDetailValveSection = document.querySelector(
    "#gearArchiveAmpDetailValveSection"
  );
  gearArchiveAmpDetailValveList = document.querySelector(
    "#gearArchiveAmpDetailValveList"
  );
  gearArchiveAmpDetailPlayedBySection = document.querySelector(
    "#gearArchiveAmpDetailPlayedBySection"
  );
  gearArchiveAmpDetailPlayedByList = document.querySelector(
    "#gearArchiveAmpDetailPlayedByList"
  );
  gearManufacturerDetailOverlay = document.querySelector("#gearManufacturerDetailOverlay");
  gearManufacturerDetailBackdrop = document.querySelector("#gearManufacturerDetailBackdrop");
  gearManufacturerDetailClose = document.querySelector("#gearManufacturerDetailClose");
  gearManufacturerDetailTitle = document.querySelector("#gearManufacturerDetailTitle");
  gearManufacturerDetailMeta = document.querySelector("#gearManufacturerDetailMeta");
  gearManufacturerDetailDescription = document.querySelector(
    "#gearManufacturerDetailDescription"
  );
  gearManufacturerDetailHistory = document.querySelector("#gearManufacturerDetailHistory");
  gearManufacturerDetailWebsite = document.querySelector("#gearManufacturerDetailWebsite");
  gearDiscoverBoard = document.querySelector("#gearDiscoverBoard");
  gearKempanionSwitcher = document.querySelector("#gearKempanionSwitcher");
  gearAtlasSwitcher = document.querySelector("#gearAtlasSwitcher");
  noMidiGearAtlasSwitcher = document.querySelector("#noMidiGearAtlasSwitcher");
  appModuleLauncher = document.querySelector(".app-module-launcher");
  appModuleLauncherButton = document.querySelector("#appModuleLauncherButton");
  appModuleMenu = document.querySelector("#appModuleMenu");
  appModuleMenuItems = [
    ...(appModuleMenu?.querySelectorAll(".app-module-menu-item") ?? [])
  ];
}

function refreshGearLibraryCache() {
  ampLibraryStatsData = getAmpLibraryStats();
  manufacturerLibraryStatsData = getManufacturerLibraryStats();
}

function setupNavigation() {
  gearKempanionSwitcher?.addEventListener("click", () => {
    setAppView(APP_VIEW.LIVE);
  });

  gearAtlasSwitcher?.addEventListener("click", () => {
    setAppView(APP_VIEW.GEAR);
  });

  noMidiGearAtlasSwitcher?.addEventListener("click", () => {
    setAppView(APP_VIEW.GEAR);
  });

  appModuleLauncherButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleModuleMenu();
  });

  appModuleMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      setAppView(item.dataset.view);
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (appModuleLauncher?.dataset.open !== "true") return;
    if (!(event.target instanceof Node)) return;
    if (appModuleLauncher.contains(event.target)) return;
    closeModuleMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && appModuleLauncher?.dataset.open === "true") {
      event.preventDefault();
      closeModuleMenu();
      appModuleLauncherButton?.focus();
    }
  });
}

export function initializeGearLibrary() {
  bindGearLibraryDom();
  initializeGearColorTheme({
    toggleElement: document.querySelector("#gearColorThemeToggle")
  });
  bindAmpDetailsOverlay({
    open: openAmpDetail,
    close: closeAmpDetail,
    isOpen: isAmpDetailOpen
  });
  refreshGearLibraryCache();
  initializeGearDesignPreview({
    rootElement: document.querySelector("#gearDesignPreview"),
    rootElements: [
      document.querySelector("#gearCategoryShell"),
      document.querySelector("#gearAmpBrowserStage"),
      document.querySelector("#ampBrowserGrid")
    ],
    onChange: handleGearDesignModeChange
  });

  document.body.dataset.appView = APP_VIEW.LIVE;
  setViewRootVisibility(APP_VIEW.LIVE);
  closeAllGearOverlays();

  renderGearCategoryNav();
  updateGearCategoryPanels();
  setupGearLibraryControls();
  setupPresentationMode();
  renderActiveGearCategory();
  initializeDiscoverColumn();
  setupNavigation();
}
