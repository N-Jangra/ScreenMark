(() => {
  "use strict";

  const config = window.APP_CONFIG;
  // Ask Chromium to protect this origin's IndexedDB from routine storage
  // pressure eviction. Portable exports remain necessary for uninstall or a
  // deliberate clear-storage action.
  window.SplitAppIDB?.persistStorage?.().catch(() => {});
  const titles = { status: "Status", discover: "Discover", details: "Details", timeline: "Timeline", statistics: "Statistics", help: "Help & FAQ", "whats-new": "What’s new", profile: "Profile", achievements: "Achievements", setup: "Quick setup", "profile-cover": "Profile cover", series: "Series", movies: "Movies", "series-favorites": "Series Favorites", "movie-favorites": "Movie Favorites", "series-watchlist": "Shows Watchlist", "movie-watchlist": "Movies Watchlist", settings: "Settings", sync: "Metadata Sync" };
  const hasPage = name => Object.prototype.hasOwnProperty.call(titles, name);
  const navItems = [
    { key: "series-watchlist", label: "Shows", icon: "tv" },
    { key: "movie-watchlist", label: "Movies", icon: "clapperboard" },
    { key: "discover", label: "Discover", icon: "✧" },
    { key: "profile", label: "Profile", icon: "user-round" }
  ];
  const navKeys = navItems.map(item => item.key);
  const prefsDefaults = {
    splashStyle: "a", splashSize: 100, splashName: false,
    theme: "system", textSize: "normal", dateFormat: "auto", imageStorage: "all", libraryMemory: "auto", reduceMotion: false, animationSpeed: "fast", pageTransition: "slide", sheetAnimation: "slide", pressEffect: "shrink", progressAnimation: true, progressStyle: "smooth", skeletonShimmer: true, placeholderAnimation: "shimmer", mainColor: "default", accentColorDefaultVersion: 2,
    profileCoverSource: "both", profileCoverMode: "random", profileCoverInterval: "visit", profileAvatarSource: "custom", profileAvatarMode: "random", profileAvatarInterval: "visit", profileAvatarPinned: "", profileCoverPinned: "", profileAvatarPinnedImage: "", profileCoverPinnedImage: "", showSidebar: true, showScrollbars: false, bottomBarStyle: "icon-color", bottomBarLabels: "icons-labels", bottomBarBackground: "solid", bottomBarTransparency: 100, navIcons: { discover: "bookmark", "series-watchlist": "tv", "movie-watchlist": "clapperboard", profile: "user-round" },
    navBar: { order: navKeys, visible: { "series-watchlist": true, "movie-watchlist": true, discover: true, profile: true } },
    metadataSourceOrder: ["tvmaze", "imdb", "omdb", "tvdb", "tmdb", "rottentomatoes", "anilist", "kitsu", "jikan"], customSources: [],
    dashboardDefaultCategory: "series",
    automaticCompletion: "automatic", defaultStatus: "",
    metadataSyncWorkers: 2, syncRequestDelay: 0, syncScope: "needed",
    backupSchedule: "daily", backupRetention: 10, backupBeforeDestructive: true, folderSyncDelay: 30,
    metadataMode: "online", metadataSources: { tvmaze: true, imdb: true, omdb: false, tvdb: false, tmdb: false, rottentomatoes: true, anilist: true, kitsu: false, jikan: false }, metadataRefreshInterval: "weekly", offlineFallback: "cached", thumbnailSize: "medium",
    backgroundBackups: false,
    apiKeys: {}, sourceOptions: {}
  };
  const themePalettes = {
    light: { mode:"light", background:"#f8fafc", shell:"#f8fafc", surface:"#ffffff", surface2:"#f1f5f9", line:"rgba(15,23,42,.10)", text:"#0f172a", muted:"#64748b" },
    dark: { mode:"dark", background:"#111827", shell:"#111827", surface:"#1f2937", surface2:"#273449", line:"rgba(203,213,225,.15)", text:"#f3f4f6", muted:"#a1aab8" },
    amoled: { mode:"dark", background:"#000000", shell:"#000000", surface:"#101010", surface2:"#1a1a1a", line:"rgba(255,255,255,.12)", text:"#f8fafc", muted:"#a1a1aa" }
  };
  const defaultAccentColor = "#f5c518";
  function safeLucideName(value, fallback = "circle") {
    const name = String(value || "");
    if (name === "↺" || name === "↻") return "rotate-ccw";
    const exportName = name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()).replace(/^./, char => char.toUpperCase());
    return window.lucide?.icons?.[exportName] ? name : fallback;
  }
  const storageKey = window.SplitAppBackend?.storageKey || `splitapp_${config.key}_v1`;
  const customCategoryKey = `${storageKey}_custom_categories_v1`;
  try { const rows = JSON.parse(localStorage.getItem(customCategoryKey) || "[]"); (Array.isArray(rows) ? rows : []).forEach(row => { if (row?.key && !config.categories.some(category => category.key === row.key)) config.categories.push(row); }); } catch (_) {}
  const trashStorageKey = `${storageKey}_trash_v1`;
  const readTrash = () => { try { const rows = JSON.parse(localStorage.getItem(trashStorageKey) || "[]"); const fresh = (Array.isArray(rows) ? rows : []).filter(row => row?.item && Date.now() - Number(row.deletedAt) < 30 * 86400000); if (fresh.length !== rows.length) localStorage.setItem(trashStorageKey, JSON.stringify(fresh)); return fresh; } catch (_) { return []; } };
  const writeTrash = rows => { try { localStorage.setItem(trashStorageKey, JSON.stringify(rows)); } catch (_) {} };
  const moveToTrash = item => {
    const index = items.indexOf(item);
    if (index < 0) return;
    const trash = readTrash();
    trash.unshift({ item: JSON.parse(JSON.stringify(item)), index, deletedAt: Date.now() });
    writeTrash(trash);
  };
  const sessionUiKey = `${storageKey}_session_ui_v1`;
  const validMemoryModes = ["auto", "low", "minimum", "off"];
  let savedSessionUi = null;
  try {
    const saved = JSON.parse(localStorage.getItem(sessionUiKey) || "null");
    if (saved && typeof saved.hash === "string" && saved.hash.startsWith("#") && Date.now() - Number(saved.at) < 86400000) savedSessionUi = saved;
  } catch (_) {}
  if (!location.hash && savedSessionUi) window.history.replaceState({}, "", savedSessionUi.hash);
  let sessionUiTimer = 0;
  let lastSessionUiWriteAt = 0;
  let lastVisibleScrollHash = location.hash || savedSessionUi?.hash || "#series-watchlist";
  let lastVisibleScrollY = Number(savedSessionUi?.scrollY) || window.scrollY || 0;
  let lastScrollInputAt = 0;
  let lastScrollToTopKeyAt = 0;
  const markScrollInput = () => { lastScrollInputAt = Date.now(); };
  window.addEventListener("touchstart", markScrollInput, { passive: true });
  window.addEventListener("touchmove", markScrollInput, { passive: true });
  window.addEventListener("wheel", markScrollInput, { passive: true });
  window.addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) markScrollInput();
    if (event.key === "Home") lastScrollToTopKeyAt = Date.now();
  });
  const saveSessionUi = () => {
    const hash = location.hash || "#series-watchlist";
    let scrollY = Math.max(0, Math.round(window.scrollY || 0));
    if (scrollY === 0 && lastVisibleScrollHash === hash && lastVisibleScrollY > 0) scrollY = lastVisibleScrollY;
    // Some Android WebViews reset scrollY to zero as the activity becomes hidden.
    // Keep the last visible offset for that transition, while respecting an actual
    // user scroll to the top that occurred before the page was hidden.
    if (document.hidden && scrollY === 0 && lastVisibleScrollHash === hash) scrollY = lastVisibleScrollY;
    try { localStorage.setItem(sessionUiKey, JSON.stringify({ hash, scrollY, at: Date.now() })); } catch (_) {}
  };
  window.addEventListener("scroll", () => {
    if (!document.hidden) {
      const hash = location.hash || "#series-watchlist", nextY = Math.max(0, Math.round(window.scrollY || 0));
      const recentTouchScrollNearTop = Date.now() - lastScrollInputAt < 500 && lastVisibleScrollY < 12000;
      const explicitScrollToTop = Date.now() - lastScrollToTopKeyAt < 1000;
      // Ignore the zero-position scroll some Android WebViews emit while the
      // activity is being paused; a real touch/key scroll to the top is kept.
      if (hash !== lastVisibleScrollHash || nextY > 0 || lastVisibleScrollY === 0 || recentTouchScrollNearTop || explicitScrollToTop) {
        lastVisibleScrollY = nextY;
        lastVisibleScrollHash = hash;
        if (Date.now() - lastSessionUiWriteAt >= 200) { saveSessionUi(); lastSessionUiWriteAt = Date.now(); }
      }
    }
    clearTimeout(sessionUiTimer);
    sessionUiTimer = setTimeout(saveSessionUi, 350);
  }, { passive: true });
  window.addEventListener("hashchange", saveSessionUi);
  window.addEventListener("pagehide", saveSessionUi);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { lastVisibleScrollY = Math.max(0, Math.round(window.scrollY || 0)); lastVisibleScrollHash = location.hash || "#series-watchlist"; }
  });
  const removedPreferenceKeys = ["iconStyle", "bottomBarLayout", "progressIncrement", "animationCustom", "animationEasing", "cardEntrance", "animationStagger", "hoverLift", "navBounce"];
  const librarySnapshotKey = `${storageKey}_snapshot`;
  let librarySnapshotTimer = 0;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  let stored = {};
  try { const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}"); if (isRecord(parsed)) stored = parsed; } catch (_) {}
  const storedPreferences = isRecord(stored.preferences) ? stored.preferences : {};
  const prefs = { ...prefsDefaults, ...storedPreferences };
  if (!validMemoryModes.includes(prefs.libraryMemory)) prefs.libraryMemory = prefsDefaults.libraryMemory;
  const applyLibraryMemoryThreshold = mode => {
    try {
      const thresholds = { auto: 2000, low: 500, minimum: 1 };
      if (mode === "off") localStorage.removeItem(`${storageKey}_slim_min`);
      else localStorage.setItem(`${storageKey}_slim_min`, String(thresholds[mode] || thresholds.auto));
    } catch (_) {}
  };
  applyLibraryMemoryThreshold(prefs.libraryMemory);
  const migrateAccentColorDefault = Number(storedPreferences.accentColorDefaultVersion) < 2;
  if (migrateAccentColorDefault && (!storedPreferences.mainColor || storedPreferences.mainColor === "#6366f1")) prefs.mainColor = "default";
  const motionIsReduced = () => Boolean(prefs.reduceMotion) || prefs.animationSpeed === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  function normalizeMotionPreferences() {
    if (!["off", "fast", "normal", "slow"].includes(prefs.animationSpeed)) prefs.animationSpeed = prefsDefaults.animationSpeed;
    if (!["slide", "fade", "zoom", "none"].includes(prefs.pageTransition)) prefs.pageTransition = prefsDefaults.pageTransition;
    if (!["slide", "fade", "scale"].includes(prefs.sheetAnimation)) prefs.sheetAnimation = prefsDefaults.sheetAnimation;
    if (!["shrink", "fade", "none"].includes(prefs.pressEffect)) prefs.pressEffect = prefsDefaults.pressEffect;
    if (!["smooth", "snappy", "spring"].includes(prefs.progressStyle)) prefs.progressStyle = prefsDefaults.progressStyle;
    if (!["shimmer", "pulse", "static"].includes(prefs.placeholderAnimation)) prefs.placeholderAnimation = prefsDefaults.placeholderAnimation;
    prefs.progressAnimation = prefs.progressAnimation !== false;
    prefs.skeletonShimmer = prefs.skeletonShimmer !== false;
  }
  normalizeMotionPreferences();
  if (Number(storedPreferences.motionProfileVersion) < 2) {
    if (!["off", "fast", "normal", "slow"].includes(prefs.animationSpeed)) prefs.animationSpeed = "normal";
    if (!["slide", "fade", "zoom", "none"].includes(prefs.pageTransition)) prefs.pageTransition = "slide";
    if (!["slide", "fade", "scale"].includes(prefs.sheetAnimation)) prefs.sheetAnimation = "slide";
    if (!Object.prototype.hasOwnProperty.call(storedPreferences, "skeletonShimmer")) prefs.skeletonShimmer = true;
    prefs.motionProfileVersion = 2;
  }
  removedPreferenceKeys.forEach(key => delete prefs[key]);
  delete prefs.appLook;
  delete prefs.recentlyAddedLimit;
  delete prefs.appDisplayName;
  delete prefs.bottomBarCorners;
  delete prefs.cardCorners;
  prefs.apiKeys = { ...prefsDefaults.apiKeys, ...(isRecord(storedPreferences.apiKeys) ? storedPreferences.apiKeys : {}) };
  prefs.sourceOptions = { ...(isRecord(storedPreferences.sourceOptions) ? storedPreferences.sourceOptions : {}) };
  prefs.metadataSources = { ...prefsDefaults.metadataSources, ...(isRecord(storedPreferences.metadataSources) ? storedPreferences.metadataSources : {}) };
  const migrateManualMetadataSources = Number(storedPreferences.manualMetadataSourcesVersion) < 1;
  if (migrateManualMetadataSources) {
    prefs.metadataSources.imdb = true;
    prefs.metadataSources.rottentomatoes = true;
    prefs.manualMetadataSourcesVersion = 1;
  }
  const localSourceKeys = { omdb: window.ScreenMarkLocalConfig?.omdbApiKey, tmdb: window.ScreenMarkLocalConfig?.tmdbApiKey };
  const localPreview = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  let seedLocalApiKeys = false;
  if (localPreview) Object.entries(localSourceKeys).forEach(([source, key]) => {
    if (key && !prefs.apiKeys[source]) { prefs.apiKeys[source] = key; prefs.metadataSources[source] = true; seedLocalApiKeys = true; }
  });
  function refreshSourceRegistry() {
    prefs.customSources = Array.isArray(prefs.customSources) ? prefs.customSources.filter(config => config && config.id && /^https?:\/\//i.test(config.searchUrl || "")) : [];
    window.SplitAppMetadata.setCustom(prefs.customSources);
    window.SplitAppMetadata.normalize(prefs);
    const keys = window.SplitAppSources.list().map(source => source.key), saved = Array.isArray(prefs.metadataSourceOrder) ? prefs.metadataSourceOrder : [];
    prefs.metadataSourceOrder = [...saved.filter((key, index) => keys.includes(key) && saved.indexOf(key) === index), ...keys.filter(key => !saved.includes(key))];
  }
  function migrateLegacyMixItems(list = items) {
    let changed = false;
    for (const item of list) {
      if (!isRecord(item) || (item.metadataSource !== "mix" && item.source !== "mix")) continue;
      const preferred = item.mixPrimary?.key && item.mixPrimary?.providerId ? item.mixPrimary : null;
      const alternate = Object.entries(item.sourceIds || {}).find(([key, id]) => key !== "mix" && id != null && id !== "");
      const source = preferred || (alternate ? { key: alternate[0], providerId: alternate[1] } : null);
      if (source) { item.metadataSource = source.key; item.source = source.key; item.providerId = String(source.providerId); }
      else { item.metadataSource = ""; item.source = ""; item.providerId = ""; }
      ["sourceIds", "mixPrimary", "mixSources", "mixSourceKeys", "mixPins", "mixSkip", "mixNoMatch", "mixCheckedAt", "mixCheckedSources", "mixFailedAt", "sourceMeta", "matchReview", "matchOk"].forEach(key => delete item[key]);
      changed = true;
    }
    return changed;
  }
  refreshSourceRegistry();
  normalizeNavigationPrefs();
  function normalizeNavigationPrefs() {
    if (["icon", "icons-only"].includes(prefs.bottomBarStyle) && !Object.prototype.hasOwnProperty.call(stored.preferences || {}, "bottomBarLabels")) prefs.bottomBarLabels = "icons-only";
    if (prefs.bottomBarStyle === "soft") prefs.bottomBarStyle = "box";
    if (["icon", "icons-only"].includes(prefs.bottomBarStyle)) prefs.bottomBarStyle = "box";
    if (!["icon-color", "underline", "pill", "minimal"].includes(prefs.bottomBarStyle)) prefs.bottomBarStyle = prefsDefaults.bottomBarStyle;
    if (!["icons-labels", "icons-only", "labels-only"].includes(prefs.bottomBarLabels)) prefs.bottomBarLabels = prefsDefaults.bottomBarLabels;
    prefs.showSidebar = prefs.showSidebar !== false;
    prefs.showScrollbars = prefs.showScrollbars === true;
    if (prefs.bottomBarBackground === "solid") prefs.bottomBarTransparency = 100;
    prefs.navIcons = { ...prefsDefaults.navIcons, ...(prefs.navIcons || {}) };
    delete prefs.navIcons.dashboard;
    const legacyIcons = { "⌂": "home", "⌕": "search", "✧": "sparkles", "◷": "calendar-days", "▥": "pie-chart", "⚙": "settings" };
    navKeys.forEach(key => {
      const icon = prefs.navIcons[key];
      if (legacyIcons[icon]) prefs.navIcons[key] = legacyIcons[icon];
      else if (icon !== "brand") prefs.navIcons[key] = safeLucideName(icon, prefsDefaults.navIcons[key]);
    });
    prefs.navBar = { order: [...navKeys], visible: { ...prefsDefaults.navBar.visible } };
    const savedSourceOrder = Array.isArray(prefs.metadataSourceOrder) ? prefs.metadataSourceOrder : [];
    const sourceKeys = window.SplitAppSources.list().map(source => source.key);
    prefs.metadataSourceOrder = [...savedSourceOrder.filter((key, index) => sourceKeys.includes(key) && savedSourceOrder.indexOf(key) === index), ...sourceKeys.filter(key => !savedSourceOrder.includes(key))];
  }
  let items = Array.isArray(stored.items) ? stored.items.filter(item => isRecord(item) && item.id != null && String(item.id) !== "") : [];
  let history = Array.isArray(stored.history) ? stored.history.filter(isRecord) : [];
  const [initialHashPath, initialHashQuery = ""] = location.hash.slice(1).split("?");
  const initialRoute = initialHashPath.split("/");
  let discoverSource = new URLSearchParams(initialHashQuery).get("source") || "";
  const legacyExploreRoute = initialRoute[0] === "explore";
  let page = legacyExploreRoute ? "settings" : ["dashboard", "search"].includes(initialRoute[0]) ? "discover" : hasPage(initialRoute[0]) ? initialRoute[0] : "series-watchlist";
  let achievementId = initialRoute[0] === "achievements" ? initialRoute[1] || "" : "";
  let statusName = initialRoute[0] === "status" ? decodeURIComponent(initialRoute[1] || "") : "";
  const legacyDashboardSettingsRoute = initialRoute[0] === "settings" && initialRoute[1] === "dashboard";
  let settingsGroup = page === "settings" ? (legacyExploreRoute ? "metadata-sources" : (legacyDashboardSettingsRoute || initialRoute[1] === "nav-layout") ? null : initialRoute[1] === "manage-backups" ? "backups" : initialRoute[1] || null) : null;
  let settingsParam = initialRoute[0] === "settings" ? new URLSearchParams(initialHashQuery).get("id") || "" : "", settingsFrom = "", renderedSettingsGroup;
  const statsSections = [];
  const normalizeStatsSection = section => section === "playtime" ? "watchtime" : section === "breakdown" ? "library" : section;
  let statsSubpage = page === "statistics" && statsSections.includes(initialRoute[1]) ? normalizeStatsSection(initialRoute[1]) : "";
  let renderedRoute = null, inAppNav = false, statsRange = "week", statsCategory = "series", statsActivityDate = "", addCategory = "", discoverCategoryChoice = "";
  let setPullToRefreshEnabled = () => {};
  let metadataSourceFilter = "all";
  let entryDraftId = null, addReturnPage = "discover";
  let discoverQuery = "";
  let addMetadataQuery = "";
  let timelineFilter = "all", timelineSearch = "", timelineMonth = "", timelineYear = "", timelineFrom = "", timelineTo = "";
  let profileCollectionSort = "alpha", profileStatusFilter = "all", profileGenreFilter = "all", profileStatusGroups = false;
  let watchlistTab = "watchlist";
  let watchlistViews = { series: "list", movie: "list" };
  let watchlistSwipe = null;
  try {
    const savedViews = JSON.parse(localStorage.getItem(`${storageKey}_watchlist_views`) || "{}");
    for (const kind of ["series", "movie"]) if (["list", "posters", "cards", "large"].includes(savedViews[kind])) watchlistViews[kind] = savedViews[kind];
  } catch (_) {}
  const currentWatchlistView = () => watchlistViews[page === "movie-watchlist" ? "movie" : "series"];
  let logQuery = "", logFrom = "", logTo = "";
  let historyQuery = "", historyFrom = "", historyTo = "";
  const metadataSyncStorageKey = `${storageKey}_metadata_sync`;
  const metadataSyncChunkSize = 256;
  const metadataSyncChunkKey = index => `${metadataSyncStorageKey}_chunk_${index}`;
  let metadataSyncState = null;
  let metadataSyncChunks = [], metadataSyncEntryPositions = new Map(), metadataSyncDirtyChunks = new Set();
  let metadataSyncChunkCount = 0, metadataSyncPersistedChunkCount = 0, metadataSyncIndexedState = null;
  let metadataSyncNeedsCheckpoint = false;
  let historyJournalLoaded = false, logJournalLoaded = false, historyJournalRevision = 0;
  const compactSyncEntry = entry => [String(entry.id ?? ""), String(entry.status || "queued"), String(entry.sourceIdentity || ""), Number(entry.retryAfterAt) || 0, String(entry.error || "").slice(0, 240)];
  const inflateSyncEntry = entry => Array.isArray(entry)
    ? { id: String(entry[0] ?? ""), status: String(entry[1] || "queued"), sourceIdentity: String(entry[2] || ""), retryAfterAt: Number(entry[3]) || 0, error: String(entry[4] || "") }
    : entry;
  const indexMetadataSyncState = state => {
    metadataSyncChunks = []; metadataSyncEntryPositions = new Map();
    (state?.entries || []).forEach((entry, index) => {
      const chunkIndex = Math.floor(index / metadataSyncChunkSize), offset = index % metadataSyncChunkSize;
      (metadataSyncChunks[chunkIndex] ||= [])[offset] = compactSyncEntry(entry);
      metadataSyncEntryPositions.set(String(entry.id), index);
    });
    metadataSyncChunkCount = metadataSyncChunks.length;
    metadataSyncIndexedState = state;
  };
  const markMetadataSyncEntryDirty = entry => {
    if (metadataSyncIndexedState !== metadataSyncState || !entry) return;
    const position = metadataSyncEntryPositions.get(String(entry.id));
    if (position === undefined) return;
    const chunkIndex = Math.floor(position / metadataSyncChunkSize);
    metadataSyncChunks[chunkIndex][position % metadataSyncChunkSize] = compactSyncEntry(entry);
    metadataSyncDirtyChunks.add(chunkIndex);
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(metadataSyncStorageKey) || "null");
    if (isRecord(parsed) && parsed.version === 3) {
      const requestedChunkCount = Math.floor(Number(parsed.chunkCount) || 0);
      const chunkCount = Math.max(0, Math.min(4096, requestedChunkCount)), entries = [];
      let badChunk = requestedChunkCount !== chunkCount;
      for (let index = 0; index < chunkCount; index++) {
        try {
          const chunk = JSON.parse(localStorage.getItem(metadataSyncChunkKey(index)) || "null");
          if (!Array.isArray(chunk)) { badChunk = true; continue; }
          entries.push(...chunk);
        } catch (_) { badChunk = true; }
      }
      metadataSyncState = { version: 3, startedAt: Number(parsed.startedAt) || 0, finishedAt: Number(parsed.finishedAt) || 0, scope: String(parsed.scope || "needed"), entries };
      metadataSyncPersistedChunkCount = chunkCount;
      metadataSyncNeedsCheckpoint = badChunk;
    } else if (isRecord(parsed)) metadataSyncState = parsed;
  } catch (_) {}
  if (metadataSyncState) {
    const sourceEntries = Array.isArray(metadataSyncState.entries) ? metadataSyncState.entries : [];
    const validEntries = sourceEntries.map(inflateSyncEntry)
      .filter(entry => isRecord(entry) && entry.id != null && String(entry.id) !== "")
      .map(entry => ({ id: String(entry.id), status: ["queued", "running", "done", "checked", "failed", "skipped"].includes(entry.status) ? entry.status : "queued", sourceIdentity: String(entry.sourceIdentity || ""), retryAfterAt: Number(entry.retryAfterAt) || 0, error: String(entry.error || "").slice(0, 240) }));
    let recovered = !Array.isArray(metadataSyncState.entries) || validEntries.length !== sourceEntries.length;
    metadataSyncState.entries = validEntries;
    validEntries.forEach(entry => { if (entry.status === "running") { entry.status = "queued"; recovered = true; } });
    metadataSyncNeedsCheckpoint ||= recovered || metadataSyncState.version !== 3;
    metadataSyncState.version = 3;
    indexMetadataSyncState(metadataSyncState);
    if (metadataSyncNeedsCheckpoint) metadataSyncChunks.forEach((_, index) => metadataSyncDirtyChunks.add(index));
  }
  delete prefs.defaultCategory;
  const oldCategoryPreference = prefs.dashboardDefaultCategory;
  let preferredCategory = oldCategoryPreference === "remember" ? "series" : oldCategoryPreference || "series";
  if (!config.categories.some(category => category.key === preferredCategory)) preferredCategory = "series";
  const migrateDashboardCategory = oldCategoryPreference === "remember" || !oldCategoryPreference;
  if (migrateDashboardCategory) prefs.dashboardDefaultCategory = preferredCategory;
  ["dashboardView", "dashboardGroupBy", "dashboardSort", "dashboardStatusFilter", "dashboardRowActions", "favoritesOnly", "oneHandedMode", "tabletTwoColumn"].forEach(key => delete prefs[key]);
  let toastTimer;
  const detailIdFromQuery = query => { const raw = String(query || ""); return raw.startsWith("=") ? decodeURIComponent(raw.slice(1)) : new URLSearchParams(raw).get("id") || ""; };
  let detailTab = "", detailSeason = "", detailStack = [], detailRef = null, detailRefOffset = 0, refData = null, refLoading = false, refError = "", refRequest = 0, detailAbortController = null, refAbortController = null;
  let detailItemId = initialRoute[0] === "details" ? detailIdFromQuery(initialHashQuery) || null : null, detailPreview = null, detailData = null, detailError = "", detailLoading = false, detailEditMode = false, detailReturnPage = "discover", detailRequest = 0;
  let detailImagePosition = 0;
  let searchRenderTimer = null;
  let discoverRequestId = 0, discoverAbortController = null;
  let addMetadataRequestId = 0;
  let localMutationRevision = 0;
  let fullMutationRevision = 0, metadataMutationRevision = 0, historyReplaceRevision = 0;
  const itemMutationRevisions = new Map();
  let discoverCache = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const eventClosest = (event, selector) => {
    let target = event?.target;
    if (target?.nodeType !== 1) target = target?.parentElement;
    while (target && typeof target.closest !== "function") target = target.parentElement;
    return target?.closest(selector) || null;
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Grid and list posters do not need the full-size artwork: ask the image host for a smaller rendition (the original is kept as a
  // one-time fallback if the host does not have it). Detail pages keep full size.
  function smallArt(url) {
    const value = String(url || "");
    if (/^https:\/\/image\.tmdb\.org\/t\/p\/(?:original|w1280|w780|w500)\//.test(value)) return value.replace(/\/t\/p\/[^/]+\//, "/t/p/w342/");
    if (/^https:\/\/static\.tvmaze\.com\/uploads\/images\/original_untouched\//.test(value)) return value.replace("/original_untouched/", "/medium_portrait/");
    return value;
  }
  function imageMarkup(item, source, alt = "", fallback = "", className = "", episode = null, cacheOwner = item) {
    const remoteArtwork = /^https:\/\//i.test(String(source || ""));
    const artworkEntry = remoteArtwork ? (window.SplitAppBackend?.artworkCacheEntries?.(cacheOwner) || []).find(row => row.signature === source) : null;
    const localCacheKey = episode?.id != null ? episodeThumbKeyOf(cacheOwner, episode.id) : artworkEntry?.key || thumbKeyOf(cacheOwner || {});
    const localCacheSignature = episode?.id != null ? String(source || "") : artworkEntry?.signature || thumbSigOf(cacheOwner || {});
    const useLocalThumb = Boolean(cacheOwner?.id && nativeAndroid && remoteArtwork);
    if (!source && !useLocalThumb) return fallback;
    const sized = className === "detail-image" || !item ? source : smallArt(source); // landscape / hero art (no item) keeps full size
    const fullAttr = sized && sized !== source ? ` data-full-src="${esc(source)}"` : "";
    const imageSource = useLocalThumb
      ? `data-deferred-image data-local-item-id="${esc(cacheOwner.id)}"${episode?.id != null ? ` data-local-episode-id="${esc(episode.id)}"` : ""} data-local-cache-key="${esc(localCacheKey)}" data-local-cache-signature="${esc(localCacheSignature)}" data-lazy-src="${esc(sized || "")}"${fullAttr}`
      : `src="${esc(sized)}"${fullAttr}`;
    const placeholder = useLocalThumb ? fallback : fallback.replace(/^(<[a-z][\w-]*)(?=[\s>])/i, "$1 hidden");
    return `<img ${imageSource}${useLocalThumb ? ' style="visibility:hidden"' : ""}${className ? ` class="${esc(className)}"` : ""} alt="${esc(alt)}" loading="lazy" decoding="async" onerror="if(this.dataset.fullSrc&&!this.dataset.fullTried){this.dataset.fullTried=1;this.src=this.dataset.fullSrc;return}this.hidden=true;this.style.visibility="";if(this.nextElementSibling)this.nextElementSibling.hidden=false">${placeholder}`;
  }
  window.SplitAppImageMarkup = imageMarkup;
  const category = key => config.categories.find(item => item.key === key) || config.categories[0];
  const labelCategory = key => category(key)?.label || key;
  // Status roles let the shared UI talk about "queued / active / done" without hard-coding status names.
  const roles = { queued: "Backlog", active: "Playing", hold: "On Hold", dropped: "Dropped", done: "Completed", ...(config.statusRoles || {}) };
  // User-defined status options: custom statuses can be added, renamed and removed; built-in ones can be hidden (Completed and Backlog always stay).
  const statusOptionsKey = `${storageKey}_status_options_v1`, PROTECTED_STATUSES = [roles.queued, roles.done];
  const statusOptions = (() => { try { const value = JSON.parse(localStorage.getItem(statusOptionsKey) || "null"); return { custom: value?.custom || {}, hidden: value?.hidden || {} }; } catch (_) { return { custom: {}, hidden: {} }; } })();
  function applyStatusOptions() {
    config.categories.forEach(row => {
      if (!row.baseStatuses) row.baseStatuses = [...(row.statuses || [])];
      const hidden = new Set(statusOptions.hidden[row.key] || []);
      row.statuses = [...row.baseStatuses.filter(name => PROTECTED_STATUSES.includes(name) || !hidden.has(name)), ...(statusOptions.custom[row.key] || []).filter(name => !row.baseStatuses.includes(name))];
    });
  }
  function saveStatusOptions() { try { localStorage.setItem(statusOptionsKey, JSON.stringify(statusOptions)); } catch (_) {} applyStatusOptions(); }
  applyStatusOptions();
  const trackedStatuses = [roles.dropped, roles.done, roles.hold, roles.active];
  const statusIcon = status => ({ [roles.queued]: "bookmark", [roles.active]: "circle-play", [roles.hold]: "circle-pause", [roles.dropped]: "circle-x", [roles.done]: "circle-check" })[status] || "circle";
  const defaultStatus = key => category(key)?.statuses?.[0] || roles.queued;
  const seriesProgressComplete = (item, info, progress = Number(item?.progress) || 0) => info?.total ? progress >= info.total : Number(item?.goal) > 0 && progress >= Number(item.goal);
  // Settings → Tracking → Automatic Completion governs series too: Automatic completes at once, Ask prompts, Manual leaves the status alone.
  const completionPrompts = new Set();
  function finishSeriesIfComplete(item, info) {
    if (!seriesProgressComplete(item, info, item.progress)) return false;
    const mode = prefs.automaticCompletion || "automatic";
    if (mode === "automatic") { item.status = roles.done; return true; }
    if (mode === "ask" && item.status !== roles.done && !completionPrompts.has(item.id)) {
      completionPrompts.add(item.id);
      appConfirm(`Mark “${item.title}” completed?`, { title: "Completed?", confirmLabel: "Mark completed" }).then(ok => {
        completionPrompts.delete(item.id);
        if (!ok || item.status === roles.done || !seriesProgressComplete(item, window.SplitAppLibrary.episodeInfo(item), item.progress)) return;
        item.status = roles.done; item.updatedAt = Date.now();
        history.unshift({ itemId: item.id, title: item.title, action: roles.done, status: roles.done, at: Date.now() });
        persist({ ids: [item.id] }); render();
      });
    }
    return false;
  }
  const latestEpisodeActivityByItem = () => {
    const latest = new Map();
    history.forEach(entry => {
      if (entry?.type !== "episode" || /marked unwatched/i.test(String(entry.action || ""))) return;
      const id = String(entry.itemId || ""), at = Number(entry.at) || 0;
      if (id && at > (latest.get(id) || 0)) latest.set(id, at);
    });
    return latest;
  };
  function applySeriesInactivityTransitions() {
    const now = Date.now(), changed = new Set(), latestActivity = latestEpisodeActivityByItem();
    for (const item of items) {
      if (item.category === "movie") {
        if ([roles.active, roles.hold].includes(item.status)) { item.status = roles.queued; item.updatedAt = now; changed.add(item.id); }
        continue;
      }
      if (item.category !== "series") continue;
      const progress = Math.max(Number(item.progress) || 0, (item.watchedEpisodeIds || []).length);
      if (!progress) {
        if (item.status !== roles.queued && item.status !== roles.done) { item.status = roles.queued; item.updatedAt = now; changed.add(item.id); }
        continue;
      }
      if ([roles.done, roles.dropped].includes(item.status)) continue;
      const lastProgressAt = Number(item.lastProgressAt) || latestActivity.get(String(item.id)) || Number(item.updatedAt) || Number(item.createdAt) || now;
      if (!Number(item.lastProgressAt)) { item.lastProgressAt = lastProgressAt; changed.add(item.id); }
      const idleFor = now - lastProgressAt;
      const nextStatus = idleFor >= 30 * 86400000 ? roles.dropped : idleFor >= 7 * 86400000 ? roles.hold : item.status === roles.queued ? roles.active : item.status;
      if (nextStatus === item.status) continue;
      item.status = nextStatus; item.updatedAt = now;
      history.unshift({ itemId: item.id, title: item.title, action: nextStatus, status: nextStatus, at: now });
      changed.add(item.id);
    }
    if (changed.size) persist({ ids: [...changed] });
    scheduleSeriesInactivityCheck(latestActivity);
    return changed.size > 0;
  }
  // Each open sheet/dialog gets a history entry so the back button (or Android back) closes it first.
  let dialogEntries = 0, skipNextPop = false, closingFromPop = false, dialogPopCallback = null;
  function pushDialogEntry() { try { window.history.pushState({ dialog: true }, "", location.href); dialogEntries += 1; } catch (_) {} }
  function popDialogEntry(afterPop) { if (dialogEntries > 0 && window.history.state?.dialog) { dialogEntries -= 1; skipNextPop = true; dialogPopCallback = afterPop || null; window.history.back(); } else afterPop?.(); }
  // In-app password dialog; Android WebView does not support window.prompt().
  function appPrompt(message, { title = "Password required", inputLabel = "Password", confirmLabel = "Continue", autocomplete = "current-password", minLength = 0 } = {}) {
    return new Promise(resolve => {
      let dialog = document.getElementById("app-prompt");
      if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "app-prompt"; dialog.className = "app-confirm app-prompt"; dialog.setAttribute("aria-labelledby", "app-prompt-title"); document.body.appendChild(dialog); }
      dialog.innerHTML = `<div class="app-confirm-card"><h2 id="app-prompt-title">${esc(title)}</h2><p>${esc(message)}</p><label class="app-prompt-field"><span>${esc(inputLabel)}</span><input type="password" autocomplete="${esc(autocomplete)}" minlength="${Math.max(0, Number(minLength) || 0)}" data-app-prompt-input></label><p class="app-prompt-error" data-app-prompt-error role="alert" hidden></p><div class="app-confirm-actions"><button type="button" class="button secondary" data-prompt="cancel">Cancel</button><button type="button" class="button primary" data-prompt="submit">${esc(confirmLabel)}</button></div></div>`;
      let settled = false;
      const finish = value => { if (settled) return; settled = true; try { dialog.close(); } catch (_) {} dialog.removeAttribute("open"); dialog.remove(); resolve(value); };
      dialog.onclose = () => finish(null); dialog.oncancel = () => finish(null);
      dialog.onclick = event => {
        const action = eventClosest(event, "[data-prompt]");
        if (!action) { if (event.target === dialog) finish(null); return; }
        if (action.dataset.prompt === "cancel") { finish(null); return; }
        const input = dialog.querySelector("[data-app-prompt-input]"), error = dialog.querySelector("[data-app-prompt-error]");
        if ((Number(minLength) || 0) > 0 && input.value.length < Number(minLength)) { error.textContent = `Use at least ${Number(minLength)} characters.`; error.hidden = false; input.focus(); return; }
        finish(input.value);
      };
      try { dialog.showModal(); } catch (_) { dialog.setAttribute("open", ""); }
      dialog.querySelector("[data-app-prompt-input]")?.focus();
    });
  }
  // In-app confirmation sheet (replaces the browser's window.confirm). Resolves true or false.
  function appConfirm(message, { title = "Are you sure?", confirmLabel = "Confirm", danger = false } = {}) {
    return new Promise(resolve => {
      let dialog = document.getElementById("app-confirm");
      if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "app-confirm"; dialog.className = "app-confirm"; dialog.setAttribute("aria-labelledby", "app-confirm-title"); document.body.appendChild(dialog); }
      dialog.innerHTML = `<div class="app-confirm-card"><h2 id="app-confirm-title">${esc(title)}</h2><p>${esc(message)}</p><div class="app-confirm-actions"><button type="button" class="button secondary" data-confirm="no">Cancel</button><button type="button" class="button ${danger ? "danger" : "primary"}" data-confirm="yes">${esc(confirmLabel)}</button></div></div>`;
      let settled = false;
      const finish = value => { if (settled) return; settled = true; try { dialog.close(); } catch (_) {} dialog.removeAttribute("open"); resolve(value); };
      dialog.onclose = () => finish(false); dialog.oncancel = () => finish(false);
      dialog.onclick = event => { const choice = eventClosest(event, "[data-confirm]"); if (choice) finish(choice.dataset.confirm === "yes"); else if (event.target === dialog) finish(false); };
      try { dialog.showModal(); } catch (_) { dialog.setAttribute("open", ""); }
      dialog.querySelector('[data-confirm="yes"]')?.focus();
    });
  }
  function showPopup(dialog, { silent = false } = {}) {
    if (!dialog) return;
    if (dialog._closeTimer) { clearTimeout(dialog._closeTimer); dialog._closeTimer = 0; dialog.classList.remove("is-closing"); delete dialog.dataset.closeAnimating; }
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") {
      try { dialog.showModal(); if (!silent) pushDialogEntry(); return; } catch (_) {}
    }
    dialog.setAttribute("open", "");
    dialog.setAttribute("aria-modal", "true");
    dialog.dataset.popupFallback = "true";
    document.body.dataset.popupFallback = "true";
  }
  let profileCropState = null;
  function openProfileCrop({ kind, src, title = "", onApply }) {
    if (!src) return;
    profileCropState?.dispose?.();
    const landscape = kind === "cover", width = landscape ? 1200 : 720;
    const aspect = landscape ? window.SplitAppPages.profileCoverAspect() : 1, height = landscape ? Math.round(width / aspect) : 720;
    const dialog = document.createElement("dialog");
    dialog.className = `choice-dialog profile-crop-dialog${landscape ? " is-cover" : " is-avatar"}`;
    if (landscape) dialog.style.setProperty("--profile-crop-aspect", String(aspect));
    dialog.setAttribute("aria-label", landscape ? "Adjust profile background" : "Adjust profile photo");
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">EDIT PROFILE</p><h2>${landscape ? "Adjust background" : "Adjust profile photo"}</h2></div><button type="button" class="choice-dialog-close" data-profile-crop-cancel aria-label="Cancel">×</button></header><p class="profile-crop-hint">Drag to reposition and use the slider to zoom. ${landscape ? "The frame shows how your background will appear." : "Keep the subject inside the circle."}</p><div class="profile-crop-viewport"><img alt="${esc(title || (landscape ? "Background" : "Profile photo"))}"><div class="profile-crop-frame${landscape ? " is-cover" : " is-avatar"}" aria-hidden="true"></div></div><label class="profile-crop-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom image"><output>1×</output></label><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-profile-crop-cancel>Cancel</button><button type="button" class="button primary" data-profile-crop-apply>Use image</button></footer>`;
    document.body.append(dialog);
    const image = dialog.querySelector(".profile-crop-viewport img"), viewport = dialog.querySelector(".profile-crop-viewport"), frame = dialog.querySelector(".profile-crop-frame"), zoom = dialog.querySelector("input[type=range]"), output = dialog.querySelector("output");
    if (landscape) frame.style.aspectRatio = String(aspect);
    let scale = 1, x = 0, y = 0, drag = null, closed = false, baseWidth = 0, baseHeight = 0;
    const clampPan = () => { const frameBounds = frame.getBoundingClientRect(), renderedWidth = baseWidth * scale, renderedHeight = baseHeight * scale; x = Math.max(-Math.max(0, (renderedWidth - frameBounds.width) / 2), Math.min(Math.max(0, (renderedWidth - frameBounds.width) / 2), x)); y = Math.max(-Math.max(0, (renderedHeight - frameBounds.height) / 2), Math.min(Math.max(0, (renderedHeight - frameBounds.height) / 2), y)); };
    const update = () => { clampPan(); image.style.width = `${baseWidth * scale}px`; image.style.height = `${baseHeight * scale}px`; image.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`; output.value = `${scale.toFixed(1)}×`; output.textContent = output.value; };
    const cleanup = () => { if (closed) return; closed = true; URL.revokeObjectURL(src.startsWith("blob:") ? src : ""); try { if (dialog.open) dialog.close(); } catch (_) {} dialog.remove(); profileCropState = null; };
    const cancel = () => { cleanup(); };
    image.onload = () => { const bounds = frame.getBoundingClientRect(); const fit = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight); baseWidth = image.naturalWidth * fit; baseHeight = image.naturalHeight * fit; update(); };
    image.onerror = () => { toast("Could not read that image."); cleanup(); };
    image.src = src;
    zoom.addEventListener("input", () => { scale = Number(zoom.value) || 1; update(); });
    viewport.addEventListener("pointerdown", event => { drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: x, oy: y }; viewport.setPointerCapture?.(event.pointerId); });
    viewport.addEventListener("pointermove", event => { if (!drag || drag.id !== event.pointerId) return; const bounds = viewport.getBoundingClientRect(), frameBounds = frame.getBoundingClientRect(), renderedWidth = baseWidth * scale, renderedHeight = baseHeight * scale; const maxX = Math.max(0, (renderedWidth - frameBounds.width) / 2), maxY = Math.max(0, (renderedHeight - frameBounds.height) / 2); x = Math.max(-maxX, Math.min(maxX, drag.ox + event.clientX - drag.x)); y = Math.max(-maxY, Math.min(maxY, drag.oy + event.clientY - drag.y)); update(); });
    const stopDrag = event => { if (drag?.id === event.pointerId) drag = null; };
    viewport.addEventListener("pointerup", stopDrag); viewport.addEventListener("pointercancel", stopDrag);
    dialog.addEventListener("click", event => { if (event.target === dialog || event.target.closest("[data-profile-crop-cancel]")) { cancel(); return; } if (!event.target.closest("[data-profile-crop-apply]")) return;
      const bounds = viewport.getBoundingClientRect(), frameBounds = frame.getBoundingClientRect(), renderedWidth = baseWidth * scale, renderedHeight = baseHeight * scale;
      const outputCanvas = document.createElement("canvas"); outputCanvas.width = width; outputCanvas.height = height;
      const ctx = outputCanvas.getContext("2d");
      const left = (bounds.width - renderedWidth) / 2 + x, top = (bounds.height - renderedHeight) / 2 + y;
      const frameX = frameBounds.left - bounds.left, frameY = frameBounds.top - bounds.top;
      const sourceX = (frameX - left) * image.naturalWidth / renderedWidth, sourceY = (frameY - top) * image.naturalHeight / renderedHeight;
      const sourceWidth = frameBounds.width * image.naturalWidth / renderedWidth, sourceHeight = frameBounds.height * image.naturalHeight / renderedHeight;
      const positionX = Math.max(0, Math.min(100, (sourceX / Math.max(1, image.naturalWidth - sourceWidth) * 100)));
      const positionY = Math.max(0, Math.min(100, (sourceY / Math.max(1, image.naturalHeight - sourceHeight) * 100)));
      try { ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height); onApply({ image: outputCanvas.toDataURL("image/jpeg", .88), crop: null }); }
      catch (_) { onApply({ image: src, crop: { positionX: Number(positionX.toFixed(2)), positionY: Number(positionY.toFixed(2)), zoom: Number(scale.toFixed(3)) } }); }
      cleanup();
    });
    dialog.addEventListener("cancel", event => { event.preventDefault(); cancel(); });
    dialog.addEventListener("close", cleanup);
    profileCropState = { dispose: cleanup };
    showPopup(dialog);
  }
  function closePopup(dialog, { preserveHistory = false, immediate = false, fromPop = false, afterPop } = {}) {
    if (!dialog) return;
    if (!immediate && dialog.matches?.(".choice-dialog, dialog.ios-action-sheet") && dialog.open && !dialog.dataset.closeAnimating) {
      const reduced = motionIsReduced();
      const preferredSpeed = prefs.animationSpeed === "fast" ? 120 : prefs.animationSpeed === "slow" ? 280 : 180;
      const speed = document.documentElement.dataset.lowend === "true" ? Math.min(preferredSpeed, 120) : preferredSpeed;
      const duration = reduced ? 0 : Math.min(240, Math.max(0, speed * .8));
      if (duration) {
        const popped = fromPop || closingFromPop;
        dialog.dataset.closeAnimating = "true"; dialog.classList.add("is-closing");
        dialog._closeTimer = window.setTimeout(() => { dialog._closeTimer = 0; dialog.classList.remove("is-closing"); delete dialog.dataset.closeAnimating; closePopup(dialog, { preserveHistory, immediate: true, fromPop: popped, afterPop }); }, duration);
        return;
      }
    }
    if (typeof dialog.close === "function") {
      try {
        const wasOpen = dialog.open; dialog.close();
        if (wasOpen && !closingFromPop && !fromPop) { if (preserveHistory) dialogEntries = Math.max(0, dialogEntries - 1); else popDialogEntry(afterPop); }
        return;
      } catch (_) {}
    }
    dialog.removeAttribute("open");
    dialog.removeAttribute("aria-modal");
    delete dialog.dataset.popupFallback;
    if (!document.querySelector("dialog[data-popup-fallback][open]")) delete document.body.dataset.popupFallback;
  }

  // Saving is scoped so a change only touches what changed:
  //   persist()                    whole library (imports, resets, anything unspecified)
  //   persist({ ids: [id, ...] })  only those titles (add / edit / status / progress / sync)
  //   persist({ removed: [id] })   delete those titles
  //   persist({ meta: true })      preferences and history only
  // Bursts are coalesced into one write ~250ms after the last change.
  let persistTimer = 0, persistWaiters = [], persistFull = false;
  const persistIds = new Set(), persistRemoved = new Set();
  const achievementAwardsKey = `${storageKey}_achievement_ranks_v1`;
  let achievementAwardsReady = false, achievementAwardQueue = [], achievementAwardVisible = false;
  function currentAchievementUnlocks() { return window.SplitAppAchievements?.unlocks?.(items, roles)?.map(row => row.id) || []; }
  function initializeAchievementAwards() {
    if (achievementAwardsReady) return;
    window.SplitAppAchievements?.stamp?.(items, roles);
    try {
      const current = currentAchievementUnlocks(), previous = JSON.parse(localStorage.getItem(achievementAwardsKey) || "null");
      localStorage.setItem(achievementAwardsKey, JSON.stringify([...new Set([...(Array.isArray(previous) ? previous : []), ...current])])); achievementAwardsReady = true;
    } catch (_) { achievementAwardsReady = true; }
  }
  function showNextAchievementAward() {
    if (achievementAwardVisible || !achievementAwardQueue.length) return;
    const award = achievementAwardQueue.shift(), dialog = document.createElement("div");
    dialog.className = "achievement-award-backdrop"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", "Achievement earned");
    dialog.innerHTML = `<article class="achievement-award-card"><button type="button" class="achievement-award-close" aria-label="Close">×</button><span class="achievement-award-spark" aria-hidden="true">✦</span><img src="${esc(award.asset)}" alt="" width="112" height="112"><p>ACHIEVEMENT UNLOCKED</p><h2>${esc(award.name)}</h2><strong>${esc(award.title)}</strong><span class="achievement-award-xp">+${award.xp} XP</span><a href="#achievements/${encodeURIComponent(award.badgeId)}">View badge</a></article>`;
    document.body.append(dialog); achievementAwardVisible = true;
    const close = () => { dialog.remove(); achievementAwardVisible = false; setTimeout(showNextAchievementAward, 220); };
    dialog.querySelector(".achievement-award-close").addEventListener("click", close);
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    dialog.querySelector("a").addEventListener("click", close);
    window.setTimeout(() => { if (dialog.isConnected) close(); }, 6500);
    dialog.querySelector(".achievement-award-close").focus();
  }
  function detectAchievementAwards() {
    if (!achievementAwardsReady || !window.SplitAppAchievements?.unlocks) return;
    const currentRows = window.SplitAppAchievements.unlocks(items, roles), current = new Set(currentRows.map(row => row.id));
    let seen = [];
    try { const parsed = JSON.parse(localStorage.getItem(achievementAwardsKey) || "[]"); if (Array.isArray(parsed)) seen = parsed; } catch (_) {}
    const seenSet = new Set(seen), newlyEarned = currentRows.filter(row => !seenSet.has(row.id));
    try { localStorage.setItem(achievementAwardsKey, JSON.stringify([...new Set([...seen, ...current])])); } catch (_) {}
    window.SplitAppAchievements.stamp?.(items, roles);
    newlyEarned.sort((x, y) => y.xp - x.xp).slice(0, 3).forEach(row => achievementAwardQueue.push(row));
    showNextAchievementAward();
  }
  function noteLocalMutation(scope, revision) {
    if (!scope || typeof scope !== "object") { fullMutationRevision = revision; historyReplaceRevision = revision; return; }
    if (scope.meta) metadataMutationRevision = revision;
    if (scope.replaceHistory) historyReplaceRevision = revision;
    const ids = [...(scope.ids || []), ...(scope.removed || [])];
    if (!scope.meta && !ids.length) { fullMutationRevision = revision; return; }
    ids.forEach(id => itemMutationRevisions.set(String(id), revision));
  }
  function persist(scope) {
    detectAchievementAwards();
    localMutationRevision += 1;
    noteLocalMutation(scope, localMutationRevision);
    if (scope && typeof scope === "object") {
      (scope.ids || []).forEach(id => persistIds.add(String(id)));
      (scope.removed || []).forEach(id => persistRemoved.add(String(id)));
    } else persistFull = true;
    const promise = new Promise(resolve => persistWaiters.push(resolve));
    clearTimeout(persistTimer);
    persistTimer = setTimeout(flushPersist, 250);
    return promise;
  }
  const migratedStoredMixItems = migrateLegacyMixItems();
  const migrateLocalRatings = items.some(item => Object.prototype.hasOwnProperty.call(item, "rating") || Object.values(item.episodeNotes || {}).some(note => Object.prototype.hasOwnProperty.call(note || {}, "rating")));
  const legacyPreferences = stored.preferences || {};
  const migrateRemovedPreferences = ["showRatings", "ratingFormat", "dashboardDensity", "font", "categoryColors", "showThumbnails", "showProgress", ...removedPreferenceKeys].some(key => Object.prototype.hasOwnProperty.call(legacyPreferences, key)) || ["rating", "rating-desc", "highest-rated"].includes(legacyPreferences.dashboardSort) || Boolean(legacyPreferences.theme && !["system", "light", "dark", "amoled"].includes(legacyPreferences.theme));
  const pendingStartupMigration = migratedStoredMixItems || seedLocalApiKeys || migrateManualMetadataSources || migrateAccentColorDefault || migrateLocalRatings || migrateDashboardCategory || migrateRemovedPreferences;
  const stripLocalScores = item => {
    if (!item || typeof item !== "object") return item;
    delete item.rating;
    Object.entries(item.episodeNotes || {}).forEach(([id, note]) => {
      if (note && typeof note === "object") delete note.rating;
      if (!note || !Object.keys(note).length) delete item.episodeNotes[id];
    });
    if (item.episodeNotes && !Object.keys(item.episodeNotes).length) delete item.episodeNotes;
    return item;
  };
  items.forEach(stripLocalScores);
  delete prefs.showRatings; delete prefs.ratingFormat; delete prefs.dashboardDensity; delete prefs.font; delete prefs.categoryColors; delete prefs.showThumbnails; delete prefs.showProgress; removedPreferenceKeys.forEach(key => delete prefs[key]);
  if (!["system", "light", "dark", "amoled"].includes(prefs.theme)) prefs.theme = prefsDefaults.theme;
  function flushPersist() {
    clearTimeout(persistTimer); persistTimer = 0;
    const waiters = persistWaiters; persistWaiters = [];
    if (!waiters.length) return;
    const scope = persistFull ? { full: true } : { ids: [...persistIds], removed: [...persistRemoved] };
    persistFull = false; persistIds.clear(); persistRemoved.clear();
    const finish = () => waiters.forEach(resolve => resolve());
    try {
      const changedItems = scope && typeof scope === "object" && scope.ids?.length
        ? scope.ids.map(itemById).filter(Boolean)
        : undefined;
      const write = window.SplitAppBackend?.save({ items, history, preferences: prefs, changedItems }, scope);
      if (write?.then) Promise.resolve(write).catch(error => { recordLog("error", `App data save failed: ${error.message || error}`); }).then(finish);
      else finish();
    } catch (error) {
      recordLog("error", `App data save failed: ${error?.message || error}`);
      finish();
    }
  }
  // Log and history rows are cached in memory and written once per burst: adding 30 titles used to parse and
  // re-serialize up to 2000 stored rows 30 times.
  const normalizeLogRows = rows => (Array.isArray(rows) ? rows : []).map(entry => {
    if (entry?.level !== "error" || !/^App data restore failed:\s*(?:user cancelled folder selection|no storage folder was selected)\.?$/i.test(String(entry.message || ""))) return entry;
    return { ...entry, level: "warning", message: String(entry.message).replace(/^App data restore failed:/i, "App data restore cancelled:") };
  });
  const rowStores = {};
  function rowStore(suffix, limit) {
    const key = `${storageKey}_${suffix}`;
    if (!rowStores[suffix]) {
      let rows = [];
      try { const saved = JSON.parse(localStorage.getItem(key) || "[]"); if (Array.isArray(saved)) rows = suffix === "log" ? normalizeLogRows(saved) : saved; } catch (_) {}
      rowStores[suffix] = { key, rows, limit, timer: 0 };
    }
    return rowStores[suffix];
  }
  function flushRowStores() {
    Object.values(rowStores).forEach(store => { if (!store.timer) return; clearTimeout(store.timer); store.timer = 0; try { localStorage.setItem(store.key, JSON.stringify(store.rows)); } catch (_) {} });
  }
  function pushRow(suffix, limit, entry) {
    const store = rowStore(suffix, limit);
    store.rows.unshift(entry); if (store.rows.length > limit) store.rows.length = limit;
    if (!store.timer) store.timer = setTimeout(() => { store.timer = 0; try { localStorage.setItem(store.key, JSON.stringify(store.rows)); } catch (_) {} }, 600);
  }
  window.addEventListener("pagehide", flushRowStores);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushRowStores(); });
  function recordLog(level, message) {
    try {
      const entry = { level, message: String(message), at: new Date().toISOString() };
      pushRow("log", 200, entry);
      window.SplitAppBackend?.appendJournal?.("logcat", entry);
    } catch (_) {}
  }
  function recordLibraryChange(action, detail, ids = []) {
    const entry = { at: Date.now(), action, detail: String(detail || "").slice(0, 400), ids: ids.slice(0, 60).map(String) };
    try { pushRow("history", 2000, entry); } catch (_) {}
    window.SplitAppBackend?.appendJournal?.("history", entry);
    saveLibrarySnapshot();
  }
  function saveLibrarySnapshot() {
    clearTimeout(librarySnapshotTimer);
    librarySnapshotTimer = setTimeout(() => {
      try { localStorage.setItem(librarySnapshotKey, JSON.stringify(Object.fromEntries(items.map(item => [String(item.id), String(item.title || "")])))); } catch (_) {}
    }, 4000);
  }
  function checkLibraryDrift() {
    try {
      const previous = JSON.parse(localStorage.getItem(librarySnapshotKey) || "null");
      if (previous && items.length) {
        const current = new Set(items.map(item => String(item.id)));
        const changes = rowStore("history", 2000).rows;
        const explained = new Set(changes.flatMap(entry => entry.ids || []).map(String));
        const lost = Object.entries(previous).filter(([id]) => !current.has(String(id)) && !explained.has(String(id)));
        if (lost.length) {
          const names = lost.map(([, title]) => title).filter(Boolean);
          const detail = `${lost.length} ${lost.length === 1 ? "title is" : "titles are"} missing without a recorded removal${names.length ? `: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` and ${names.length - 6} more` : ""}` : ""}.`;
          recordLibraryChange("missing", detail, lost.map(([id]) => id));
          recordLog("warning", detail);
        }
      }
    } catch (_) {}
    saveLibrarySnapshot();
  }
  function toast(message) {
    const node = $("#toast"); node.textContent = message; node.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2300);
  }
  // Persistent import progress card: stays visible until the import finishes (a toast disappears after 2s).
  let importProgressHideTimer = 0;
  // Android notification for imports (same channel as exports, import wording). Silently does nothing off-device or without permission.
  let importNotifyAt = 0, importNotifyAsked = false;
  async function importNotify(method, data = {}) {
    const plugin = window.Capacitor?.Plugins?.ShareIntent; if (!plugin?.[method]) return;
    try {
      if (!importNotifyAsked && method === "startExportNotification") { importNotifyAsked = true; await plugin.requestExportNotificationPermission?.(); }
      await plugin[method]({ id: "import", kind: "import", filename: data.filename || "backup", ...data });
    } catch (_) {}
  }
  let exportCardShown = false;
  function importProgress(message, fraction = null, { done = false, error = false, quiet = false } = {}) {
    let node = $("#import-progress");
    if (!node) {
      node = document.createElement("button"); node.id = "import-progress"; node.type = "button"; node.className = "sync-fab import-fab"; node.setAttribute("aria-live", "polite");
      node.innerHTML = '<span class="sync-fab-pie"><b></b></span>';
      node.addEventListener("click", () => openImportDetails());
      document.body.appendChild(node);
    }
    clearTimeout(importProgressHideTimer);
    const known = typeof fraction === "number" && isFinite(fraction), percent = known ? Math.max(0, Math.min(100, Math.round(fraction * 100))) : null;
    node.hidden = false;
    node.style.setProperty("--p", (done && !error ? 100 : percent || 0) + "%");
    node.classList.toggle("is-done", done); node.classList.toggle("has-failed", error); node.classList.toggle("is-indeterminate", !known && !done);
    node.classList.remove("is-hidden-card"); node.classList.add("show");
    node.querySelector("b").textContent = error ? "!" : done ? "✓" : known ? `${percent}%` : "…";
    node.setAttribute("aria-label", `${message} ${known ? percent + "%" : ""}. Open details.`);
    node.dataset.stage = message; node.dataset.percent = known ? String(percent) : "";
    updateImportDetails();
    if (quiet) { /* exports have their own notification */ }
    else if (!node.dataset.notified) { node.dataset.notified = "1"; importNotify("startExportNotification", { total: 100, done: percent || 0, message }); }
    else if (done) importNotify("finishExportNotification", { success: !error, message });
    else if (Date.now() - importNotifyAt > 600) { importNotifyAt = Date.now(); importNotify("updateExportNotification", { total: 100, done: percent || 0, message }); }
    if (done) importProgressHideTimer = setTimeout(() => { node.remove(); const dialog = $("#import-details-dialog"); if (dialog?.open) updateImportDetails(true); }, error ? 6000 : 3500);
  }
  // Tapping the progress button opens a page laid out like SavePoint's import progress page; it follows the transfer live.
  function updateImportDetails(finished = false) {
    const dialog = $("#import-details-dialog"); if (!dialog) return;
    const card = $("#import-progress");
    const stage = card?.dataset.stage || "Finished", percent = card?.dataset.percent || "", done = finished || !card || card.classList.contains("is-done"), failed = Boolean(card?.classList.contains("has-failed"));
    const kind = /export/i.test(stage) ? "export" : "import";
    const set = (selector, value) => { const node = dialog.querySelector(selector); if (node) node.textContent = value; };
    set("[data-import-kind]", failed ? "TRANSFER FAILED" : done ? (kind === "export" ? "BACKUP COMPLETE" : "RESTORE COMPLETE") : kind === "export" ? "CREATING YOUR BACKUP" : "RESTORING YOUR LIBRARY");
    set("[data-import-title]", failed ? "Something went wrong" : done ? (kind === "export" ? "Export complete" : "Import complete") : kind === "export" ? "Exporting titles" : "Importing titles");
    set("[data-import-stage]", stage);
    set("[data-import-percent]", done && !failed ? "100%" : percent ? `${percent}%` : "");
    const track = dialog.querySelector(".import-progress-track"), bar = track?.firstElementChild;
    track?.classList.toggle("is-indeterminate", !percent && !done); track?.classList.toggle("is-error", failed);
    if (bar) bar.style.width = done && !failed ? "100%" : percent ? `${percent}%` : "";
    const live = dialog.querySelector("[data-import-live]"); if (live) live.hidden = done;
    const icon = dialog.querySelector(".import-restore-icon"); if (icon) icon.classList.toggle("is-complete", done && !failed);
  }
  function openImportDetails() {
    let dialog = $("#import-details-dialog");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "import-details-dialog"; dialog.className = "import-page-dialog"; document.body.appendChild(dialog); }
    dialog.innerHTML = `<section class="import-restore-page import-restore-active"><header class="settings-page-heading settings-subpage-heading import-page-heading"><button type="button" class="settings-back" data-import-details-close><span aria-hidden="true">‹</span> Back</button><h1>Import List</h1><span class="settings-subpage-icon" aria-hidden="true"><i data-lucide="file-down"></i></span></header><div class="import-progress-card" role="status" aria-live="polite"><span class="import-restore-icon"><i data-lucide="library-big" aria-hidden="true"></i></span><p class="settings-overline" data-import-kind></p><h1 data-import-title></h1><p class="import-progress-message" data-import-stage></p><div class="import-progress-track" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100"><span style="width:0%"></span></div><div class="import-progress-summary"><strong data-import-percent></strong></div><div class="import-progress-live" data-import-live><span class="import-restore-spinner" aria-hidden="true"></span><span>Keep ScreenMark open while this finishes.</span></div></div></section>`;
    dialog.onclick = event => { if (eventClosest(event, "[data-import-details-close]")) closePopup(dialog); };
    window.lucide?.createIcons({ root: dialog, attrs: { "aria-hidden": "true" } });
    showPopup(dialog); updateImportDetails();
  }
  // Opening animation: the choice and its layout (size %, name below logo) live in their own localStorage entries so the boot screen can read them.
  const SPLASH_KEY = "screenmark_splash_style", SPLASH_LAYOUT_KEY = "screenmark_splash_layout", SPLASH_IDS = ["a", "b", "c", "d"];
  function syncSplashStyle() {
    let saved = "";
    try { saved = localStorage.getItem(SPLASH_KEY) || ""; } catch (_) {}
    if (SPLASH_IDS.includes(saved)) prefs.splashStyle = saved;
    else { prefs.splashStyle = SPLASH_IDS.includes(prefs.splashStyle) ? prefs.splashStyle : "a"; try { localStorage.setItem(SPLASH_KEY, prefs.splashStyle); } catch (_) {} }
  }
  function splashLayout(style = prefs.splashStyle) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SPLASH_LAYOUT_KEY) || "{}") || {}; } catch (_) {}
    return { size: Math.min(130, Math.max(50, Number(saved.size) || 100)), name: typeof saved.name === "boolean" ? saved.name : false };
  }
  // Bridge used by the opening-animation page (pages/splash-studio.js).
  window.SplashHost = {
    layout: () => splashLayout(),
    style: () => prefs.splashStyle || "a",
    layoutSaved: () => { try { return typeof JSON.parse(localStorage.getItem(SPLASH_LAYOUT_KEY) || "{}").name === "boolean"; } catch (_) { return false; } },
    toast: message => toast(message),
    save({ id, size, name }) {
      if (SPLASH_IDS.includes(id)) { try { localStorage.setItem(SPLASH_KEY, id); } catch (_) {} setPreference("splashStyle", id); }
      if (size === undefined) { toast("Opening screen saved."); return; }
      try { localStorage.setItem(SPLASH_LAYOUT_KEY, JSON.stringify({ size, name })); } catch (_) {}
      setPreference("splashSize", size); setPreference("splashName", name);
      toast("Opening screen saved.");
    }
  };
  function applyPreferences() {
    syncSplashStyle();
    normalizeMotionPreferences();
    document.body.dataset.page = page;
    const selectedTheme = prefs.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "amoled" : "light") : prefs.theme;
    const palette = themePalettes[selectedTheme] || themePalettes.amoled;
    const accentColor = prefs.mainColor === "default" ? defaultAccentColor : prefs.mainColor || defaultAccentColor;
    document.body.dataset.theme = palette.mode;
    document.body.dataset.palette = themePalettes[selectedTheme] ? selectedTheme : "amoled";
    document.body.style.background = palette.background;
    document.body.style.color = palette.text;
    const root = document.documentElement;
    // Text-safe versions of the accent and status colors for this theme's surfaces (nudged lighter on dark themes, darker on light ones until they read clearly).
    const toRgb = hex => { const m = String(hex).replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i) || String(hex).replace("#", "").match(/^([0-9a-f])([0-9a-f])([0-9a-f])$/i)?.slice(1).map(x => x + x).reduce((acc, x, i) => (acc[i + 1] = x, acc), []); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [99, 102, 241]; };
    const relLum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const contrast = (a, b) => { const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
    const readable = hex => {
      let color = toRgb(hex); const surfaces = [palette.surface, palette.surface2, palette.shell].map(toRgb), target = palette.mode === "dark" ? [255, 255, 255] : [0, 0, 0];
      for (let step = 0; step <= 20 && Math.min(...surfaces.map(surface => contrast(color, surface))) < 4.5; step++) color = color.map((v, i) => Math.round(v + (target[i] - v) * .12));
      return `rgb(${color.join(",")})`;
    };
    const accentForeground = contrast(toRgb(accentColor), [255, 255, 255]) >= contrast(toRgb(accentColor), [17, 24, 39]) ? "#ffffff" : "#111827";
    document.body.style.setProperty("--accent-text", readable(accentColor));
    document.body.style.setProperty("--accent-foreground", accentForeground);
    document.body.style.setProperty("--warn-text", readable("#d97706"));
    document.body.style.setProperty("--danger-text", readable("#dc3545"));
    document.body.style.setProperty("--ok-text", readable("#16a34a"));
    document.body.style.setProperty("--info-text", readable("#0ea5e9"));
    document.body.style.setProperty("--legacy-bg", palette.shell);
    document.body.style.setProperty("--legacy-card", palette.surface);
    document.body.style.setProperty("--legacy-text", palette.text);
    document.body.style.setProperty("--legacy-secondary", palette.muted);
    document.body.style.setProperty("--surface", palette.surface);
    document.body.style.setProperty("--surface-2", palette.surface2);
    document.body.style.setProperty("--line", palette.line);
    document.body.style.setProperty("--muted", palette.muted);
    document.body.style.setProperty("--accent-soft", `color-mix(in srgb, ${accentColor} ${palette.mode === "light" ? "12%" : "20%"}, ${palette.surface})`);
    document.body.dataset.reducedMotion = String(motionIsReduced());
    const nativeAndroid = Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "android");
    const cores = Number(navigator.hardwareConcurrency) || 4, memory = Number(navigator.deviceMemory) || 4;
    const weakDevice = Boolean(navigator.connection?.saveData) || /^(slow-2g|2g)$/.test(navigator.connection?.effectiveType || "") || memory <= 2 || cores <= 2;
    // Android WebViews use the lighter profile even on newer phones: reducing blur and entrance work
    // keeps scrolling responsive at high refresh rates. Very constrained devices get the low profile.
    const lowEnd = weakDevice || nativeAndroid;
    root.dataset.perf = weakDevice ? "low" : lowEnd ? "mid" : "high";
    root.dataset.lowend = String(lowEnd);
    root.dataset.nativeAndroid = String(nativeAndroid);
    document.body.dataset.barStyle = prefs.bottomBarStyle;
    document.body.dataset.barLabels = prefs.bottomBarLabels;
    document.body.dataset.sidebar = prefs.showSidebar ? "shown" : "hidden";
    document.documentElement.dataset.showScrollbars = prefs.showScrollbars === true ? "true" : "false";
    window.Capacitor?.Plugins?.ScrollbarControl?.setEnabled?.({ enabled: prefs.showScrollbars === true }).catch(() => {});
    document.body.dataset.iconStyle = "inline";
    window.SplitAppDates?.setFormat(prefs.dateFormat); window.SplitAppBackend?.setImageStorage?.(prefs.imageStorage);
    $("#bottom-bar").dataset.bg = prefs.bottomBarBackground;
    document.body.dataset.barBackground = prefs.bottomBarBackground;
    try { document.body.dataset.discoverView = (["list", "cards"].includes(localStorage.getItem(`${storageKey}_discover_view`)) ? localStorage.getItem(`${storageKey}_discover_view`) : "grid"); } catch (_) { document.body.dataset.discoverView = "grid"; }
    document.body.style.setProperty("--accent", accentColor);
    document.body.style.setProperty("--legacy-accent", accentColor);
    document.body.style.setProperty("--legacy-glow", `color-mix(in srgb, ${accentColor} 15%, transparent)`);
    document.body.style.setProperty("--d-gold", accentColor);
    document.body.style.setProperty("--d-gold-fg", accentForeground);
    document.body.style.setProperty("--d-gold-soft", `color-mix(in srgb, ${accentColor} ${palette.mode === "light" ? "12%" : "20%"}, ${palette.surface})`);
    document.body.style.setProperty("--d-gold-border", `color-mix(in srgb, ${accentColor} 32%, transparent)`);
    document.documentElement.style.setProperty("--ios-violet", accentColor);
    document.documentElement.style.setProperty("--ios-indigo", accentColor);
    document.documentElement.style.setProperty("--ios-grad", `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 78%, white))`);
    document.documentElement.style.setProperty("--bar-alpha", String(Math.max(0, Math.min(100, Number(prefs.bottomBarTransparency))) / 100));
    document.documentElement.style.setProperty("--text-size", prefs.textSize === "large" ? "18px" : prefs.textSize === "small" ? "14px" : "16px");
    document.documentElement.style.setProperty("--item-art-width", prefs.thumbnailSize === "small" ? "48px" : prefs.thumbnailSize === "large" ? "72px" : "58px");
    document.documentElement.style.setProperty("--item-art-height", prefs.thumbnailSize === "small" ? "58px" : prefs.thumbnailSize === "large" ? "88px" : "72px");
    document.documentElement.style.setProperty("--discover-art-height", prefs.thumbnailSize === "small" ? "110px" : prefs.thumbnailSize === "large" ? "190px" : "150px");
    const speedMs = prefs.reduceMotion || prefs.animationSpeed === "off" ? 0 : prefs.animationSpeed === "fast" ? 120 : prefs.animationSpeed === "slow" ? 280 : 180;
    document.documentElement.style.setProperty("--speed", `${speedMs}ms`);
    const placeholderAnimation = prefs.skeletonShimmer ? prefs.placeholderAnimation : "static";
    Object.entries({ pageAnim: prefs.pageTransition, sheetAnim: prefs.sheetAnimation, press: prefs.pressEffect, progressAnim: prefs.progressAnimation, progressStyle: prefs.progressStyle, shimmer: placeholderAnimation !== "static", placeholderAnim: placeholderAnimation }).forEach(([key, value]) => { document.body.dataset[key] = String(value); });
    $("#app-kicker").textContent = config.name.toUpperCase();
    document.title = `${config.name} · ${page === "settings" && settingsGroup ? settingsGroup : titles[page]}`;
    renderSidebar();
    renderBottomBar();
    $$(".nav-button").forEach(button => {
      button.classList.toggle("active", button.dataset.page === activeNavigationKey());
      const icon = $(".nav-icon", button);
      if (icon) {
        const navItem = navItems.find(item => item.key === button.dataset.page);
        const selectedIcon = prefs.navIcons[button.dataset.page] || navItem?.icon || "circle";
        icon.innerHTML = `<i data-lucide="${safeLucideName(selectedIcon, navItem?.icon || "circle")}"></i>`;
      }
    });
    window.lucide?.createIcons({ root: $("#bottom-bar"), attrs: { "aria-hidden": "true" } });
  }
  function activeNavigationKey() {
    if (page === "series-watchlist" || page === "movie-watchlist") return page;
    if (["series", "movies", "series-favorites", "movie-favorites"].includes(page)) return "profile";
    if (page === "timeline" || page === "statistics" || page === "profile-cover") return "profile";
    if (page === "details") {
      if (detailReturnPage === "series-watchlist" || detailReturnPage === "movie-watchlist") return detailReturnPage;
      if (["profile", "series", "movies", "series-favorites", "movie-favorites", "timeline", "statistics"].includes(detailReturnPage)) return "profile";
    }
    return page;
  }
  function renderBottomBar() {
    const bar = $("#bottom-bar");
    if (!bar) return;
    const activeKey = activeNavigationKey();
    const byKey = new Map(navItems.map(item => [item.key, item]));
    bar.innerHTML = prefs.navBar.order.filter(key => prefs.navBar.visible[key] !== false).map(key => {
      const item = byKey.get(key); if (!item) return "";
      const icon = prefs.navIcons[key] || item.icon;
    const iconMarkup = `<i data-lucide="${safeLucideName(icon, item.icon)}"></i>`;
      return `<button data-page="${item.key}" class="nav-button${activeKey === item.key ? " active" : ""}" aria-label="${esc(item.label)}"><span class="nav-icon" aria-hidden="true">${iconMarkup}</span><span>${esc(item.label)}</span></button>`;
    }).join("");
  }
  function renderSidebar() {
    const sidebar = $("#sidebar-nav");
    if (!sidebar) return;
    const activeKey = activeNavigationKey();
    sidebar.innerHTML = navItems.map(item => {
      const icon = prefs.navIcons[item.key] || item.icon;
      const iconMarkup = `<i data-lucide="${safeLucideName(icon, item.icon)}"></i>`;
      return `<button type="button" class="sidebar-nav-button${activeKey === item.key ? " active" : ""}" data-sidebar-page="${item.key}" aria-current="${activeKey === item.key ? "page" : "false"}"><span class="sidebar-nav-icon" aria-hidden="true">${iconMarkup}</span><span>${esc(item.label)}</span></button>`;
    }).join("");
    window.lucide?.createIcons({ root: sidebar, attrs: { "aria-hidden": "true" } });
  }
  function syncPageNavigation() {
    document.body.dataset.page = page;
    document.title = `${config.name} · ${page === "settings" && settingsGroup ? settingsGroup : titles[page]}`;
    const activeKey = activeNavigationKey();
    $$("#bottom-bar .nav-button").forEach(button => button.classList.toggle("active", button.dataset.page === activeKey));
    $$("#sidebar-nav .sidebar-nav-button").forEach(button => {
      const active = button.dataset.sidebarPage === activeKey;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", String(active ? "page" : "false"));
    });
  }
  function goto(next, updateHistory = true, back = false) {
    if (!back) rememberScroll();
    if (next === "explore") next = "settings/metadata-sources";
    if (next === "dashboard" || next === "search") next = "discover";
    if (favoritesNeedSetup(String(next).split("/")[0]) && !back) {
      setupState.mode = String(next).startsWith("movie") ? "favorites-movie" : "favorites-series"; setupStarted = false; next = "setup";
    }
    if (String(next).split("/")[0] !== "setup") setupState.mode = "";
    const [nextPage, nextSection] = String(next).split("/");
    page = hasPage(nextPage) ? nextPage : "discover";
    achievementId = page === "achievements" ? nextSection || "" : "";
    statusName = page === "status" ? decodeURIComponent(nextSection || "") : "";
    if (page !== "discover") { discoverAbortController?.abort(); discoverAbortController = null; suggestionsAbortController?.abort(); suggestionsAbortController = null; suggestionsPendingKey = ""; suggestionsRequest++; }
    if (page === "series-watchlist" || page === "movie-watchlist") watchlistTab = "watchlist";
    statsSubpage = page === "statistics" && statsSections.includes(nextSection) ? normalizeStatsSection(nextSection) : "";
    if (page !== "discover" && !(page === "details" && detailReturnPage === "discover")) { discoverSource = ""; discoverQuery = ""; discoverRequestId++; discoverCache = null; }
    if (page !== "add") { addMetadataQuery = ""; addMetadataRequestId++; entryDraftId = null; }
    if (page !== "details") clearDetailStack();
    if (page !== "settings") settingsGroup = null;
    if (updateHistory) historyPush();
    document.body.dataset.navDir = back ? "back" : "forward";
    render(); syncPageNavigation();
    if (back) restoreScroll(); else window.scrollTo({ top: 0, behavior: "auto" });
  }
  // Keep the reading position for each page and settings subsection when browser Back is used.
  const scrollMemory = new Map();
  const scrollKey = () => page === "settings" ? `settings/${settingsGroup || ""}` : page === "details" ? `details/${detailItemId || ""}` : page === "statistics" ? `statistics/${statsSubpage || ""}` : page;
  const rememberScroll = () => {
    const key = scrollKey();
    scrollMemory.delete(key); scrollMemory.set(key, window.scrollY);
    while (scrollMemory.size > 100) scrollMemory.delete(scrollMemory.keys().next().value);
  };
  try { history.scrollRestoration = "manual"; } catch (_) {}
  const restoreScroll = () => {
    if (page === "achievements") { window.scrollTo({ top: 0, behavior: "auto" }); return; }
    const key = scrollKey(), top = scrollMemory.get(key) || 0;
    if (scrollMemory.has(key)) { scrollMemory.delete(key); scrollMemory.set(key, top); }
    window.scrollTo({ top, behavior: "auto" });
    if (top) requestAnimationFrame(() => window.scrollTo({ top, behavior: "auto" }));
  };
  const slugOf = text => String(text || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "title";
  // details?id=<uuid> for library titles, details/<source>/<id>/<name> for Discover/Explore previews; &ref= adds the open cast/character/episode page.
  function detailRoute() {
    const params = new URLSearchParams();
    let base = "details";
    if (detailPreview?.providerId) { base = `details/${encodeURIComponent(detailPreview.metadataSource || detailPreview.source)}/${encodeURIComponent(detailPreview.providerId)}/${slugOf(detailPreview.title)}`; params.set("c", detailPreview.category || ""); }
    else if (detailItemId) params.set("id", detailItemId);
    if (detailRef) params.set("ref", `${detailRef.type}/${detailRef.id}/${slugOf(refData?.title || detailRef.title)}`);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }
  function historyPush(replace = false) {
    const route = page === "details" ? detailRoute() : page === "settings" && settingsGroup ? `settings/${settingsGroup}${settingsParam ? `?id=${encodeURIComponent(settingsParam)}` : ""}` : page === "discover" && discoverSource ? `discover?source=${encodeURIComponent(discoverSource)}` : page === "statistics" && statsSubpage ? `statistics/${statsSubpage}` : page === "achievements" && achievementId ? `achievements/${encodeURIComponent(achievementId)}` : page === "status" && statusName ? `status/${encodeURIComponent(statusName)}` : page;
    const url = new URL(location.href);
    url.search = "";
    url.hash = route;
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== nextUrl) {
      try { window.history[replace ? "replaceState" : "pushState"]({ page, settingsGroup }, "", nextUrl); } catch (_) {}
    }
    saveSessionUi();
  }

  // Cheap size estimate (sampled) instead of serialising the whole library on every Settings render.
  let libraryBytesCache = { key: "", value: 0 };
  function estimateLibraryBytes() {
    const key = `${localMutationRevision}|${items.length}`;
    if (libraryBytesCache.key === key) return libraryBytesCache.value;
    const step = Math.max(1, Math.floor(items.length / 40));
    let sampled = 0, bytes = 0;
    for (let index = 0; index < items.length; index += step) { bytes += JSON.stringify(items[index]).length; sampled++; }
    const value = Math.round((sampled ? bytes / sampled * items.length : 0) + JSON.stringify(history).length + JSON.stringify(prefs).length);
    libraryBytesCache = { key, value };
    return value;
  }
  function pageContext() {
    const activeDetailItem = detailPreview || itemById(String(detailItemId));
    const activeDetailSource = activeDetailItem?.metadataSource || activeDetailItem?.source || "";
    const detailCastOnline = Boolean(prefs.metadataMode !== "offline" && navigator.onLine && activeDetailSource && window.SplitAppSources?.isEnabled?.(activeDetailSource, prefs));
    let logEntries = [];
    // Only the Logcat / History settings pages read these stores; parsing up to 200 rows on every render was wasted work.
    const needsLogs = page === "settings" && settingsGroup === "logcat", needsHistory = page === "settings" && settingsGroup === "history";
    if (needsLogs) logEntries = rowStore("log", 200).rows;
    if (settingsGroup === "logcat" && !logJournalLoaded) {
      logJournalLoaded = true;
      window.SplitAppBackend?.readJournal?.("logcat").then(rows => { if (page === "settings" && settingsGroup === "logcat" && Array.isArray(rows)) { logEntries = normalizeLogRows(rows); { const store = rowStore("log", 200); store.rows = logEntries.slice(0, 200); try { localStorage.setItem(store.key, JSON.stringify(store.rows)); } catch (_) {} } render(); } }).catch(() => {});
    }
    let changeLog = [];
    if (needsHistory) changeLog = rowStore("history", 2000).rows;
    if (settingsGroup === "history" && !historyJournalLoaded) {
      historyJournalLoaded = true;
      const readRevision = historyJournalRevision;
      window.SplitAppBackend?.readJournal?.("history").then(rows => { if (readRevision === historyJournalRevision && page === "settings" && settingsGroup === "history" && Array.isArray(rows)) { const local = changeLog; const keys = row => `${row.action}|${row.at}|${row.detail || ""}`; changeLog = [...new Map([...rows, ...local].map(row => [keys(row), row])).values()].sort((a, b) => (Number(b.at) || Date.parse(b.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0)); { const store = rowStore("history", 2000); store.rows = changeLog.slice(0, 2000); try { localStorage.setItem(store.key, JSON.stringify(store.rows)); } catch (_) {} } render(); } }).catch(() => {});
    }
    const parentForRef = detailRef?.type === "episode" ? itemById(String(detailItemId)) : null;
    const refItem = parentForRef?.category === "series" && (parentForRef.cachedDetails?.sections || []).some(section => section.kind === "episodes" && (section.items || []).some(row => String(row.id) === String(detailRef.id) || String(row.ref?.id) === String(detailRef.id))) ? parentForRef : null;
    return { setup: setupState, statsSubpage, statsCategory, statsActivityDate, statsRange, profileCollectionSort, profileStatusFilter, profileGenreFilter, profileStatusGroups, achievementId, statusName, libraryLoading: !libraryRestoreComplete, watchlistTab, watchlistView: currentWatchlistView(), setupDownloads: [...setupDownloads.values()], setupDownloadsPaused, setupDownloadProgress: setupDownloadProgress([...setupDownloads.values()]), metadataSyncState, metadataSyncCounts: page === "sync" ? syncCounts() : null, changeLog, history, trashRows: page === "settings" && settingsGroup === "trash" ? readTrash() : [], logQuery, logFrom, logTo, historyQuery, historyFrom, historyTo, timelineFrom, timelineTo, dataRevision: localMutationRevision, itemById, libraryBytes: page === "settings" ? estimateLibraryBytes() : 0, config, prefs, items, logEntries, roles, trackedStatuses, statusIcon, discoverCategory: currentDiscoverCategory(), discoverQuery, addMetadataQuery, settingsGroup, settingsParam, settingsFrom, discoverSource, timelineFilter, timelineSearch, timelineMonth, timelineYear, detailItemId, detailPreview, detailEditMode, editingItem: itemById(String(entryDraftId)) || null, addReturnPage, navItems, metadataSourceFilter, titleIdentity,
      detailData, detailError, detailLoading, detailReturnPage, detailRef, detailRefOffset, refData, refLoading, refError, detailStackSize: detailStack.length, detailTab, detailSeason, detailCastOnline, detailCastSections: castCache.get(castKeyNow()) || [], detailCastLoading: castState.loading && castState.key === castKeyNow(), detailCastError: castState.key === castKeyNow() ? castState.error : "", refItem, statusOptions, protectedStatuses: PROTECTED_STATUSES, category, labelCategory, defaultStatus, esc, imageMarkup,
      isLocalImageUrlAvailable: localImageUrlAvailable, safeLucideName };
  }
  // ---- Device artwork cache (IndexedDB blobs) ----
  // Order for every cover: on-device cache -> online (instant, HTTP-cached) -> saved-folder files.
  // The slow Android folder (storage framework) only fills the cache in the background.
  const nativeAndroid = Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "android");
  let itemIndex = new Map();
  let itemIndexItems = null;
  let providerItemIndex = new Map();
  let providerItemIndexItems = null;
  let providerItemIndexRevision = -1;
  let titleIndex = new Map();
  let titleIndexItems = null;
  let titleIndexRevision = -1;
  function itemById(id) {
    const key = String(id);
    // Build once per immutable array revision, including for misses. Rebuilding
    // on every absent lookup made repeated stale IDs turn into O(n × misses).
    if (itemIndexItems !== items) {
      itemIndex = new Map(items.map((row, index) => [String(row.id), index]));
      itemIndexItems = items;
    }
    const at = itemIndex.get(key);
    return at === undefined ? undefined : items[at];
  }
  function itemByProvider(source, category, providerId) {
    if (providerItemIndexItems !== items || providerItemIndexRevision !== localMutationRevision) {
      providerItemIndex = new Map();
      items.forEach(item => {
        if (!item?.metadataSource || !item?.providerId) return;
        const key = `${item.metadataSource}\u0000${item.category || ""}\u0000${String(item.providerId)}`;
        if (!providerItemIndex.has(key)) providerItemIndex.set(key, String(item.id));
      });
      providerItemIndexItems = items;
      providerItemIndexRevision = localMutationRevision;
    }
    const id = providerItemIndex.get(`${source}\u0000${category || ""}\u0000${String(providerId)}`);
    return id === undefined ? undefined : itemById(id);
  }
  function itemByTitleIdentity(identity) {
    if (titleIndexItems !== items || titleIndexRevision !== localMutationRevision) { titleIndex = new Map(); titleIndexItems = items; titleIndexRevision = localMutationRevision; }
    if (!titleIndex.size && items.length) items.forEach(item => { const key = titleIdentity(item); if (!titleIndex.has(key)) titleIndex.set(key, item); });
    return titleIndex.get(identity);
  }
  const thumbUrlCache = new Map(); // "key|sig" -> blob: URL
  const thumbKeyOf = item => `${item.id}:p`;
  const staleThumbGenerations = new Set(); // cache keys kept only while a rendered image still references them
  const episodeThumbKeyOf = (item, episodeId) => `${window.SplitAppBackend?.key || config.key}:episode:${String(item.id)}:${String(episodeId)}`;
  const thumbSigOf = item => String(item.localImageFingerprint || item.thumbnailPath || item.customCover || item.image || "");
  const isLiveEpisodeThumbKey = (key, liveItemIds) => {
    const prefix = `${window.SplitAppBackend?.key || config.key}:episode:`;
    const value = String(key || "");
    if (!value.startsWith(prefix)) return false;
    const itemId = value.slice(prefix.length).split(":", 1)[0];
    return liveItemIds.has(itemId);
  };
  const isLiveArtworkThumbKey = (key, liveItemIds) => {
    const prefix = `${window.SplitAppBackend?.key || config.key}:art:`;
    const value = String(key || "");
    if (!value.startsWith(prefix)) return false;
    const itemId = value.slice(prefix.length).split(":", 1)[0];
    return liveItemIds.has(itemId);
  };
  // Session poster cache: item key -> the URL of its poster blob. Entries are kept until the app closes (or the artwork itself
  // changes), so a poster that was shown never goes blank, and lookups are O(1) even with tens of thousands of titles.
  const thumbKeyIndex = new Map(); // item key -> cache key currently held
  function imageUrlIsLive(url) {
    return [...document.images].some(image => image.currentSrc === url || image.src === url);
  }
  function localImageUrlAvailable(url) {
    if (!/^blob:/i.test(String(url || ""))) return true;
    for (const active of thumbUrlCache.values()) if (active === url) return true;
    for (const active of nativeImageFallbacks.values()) if (active === url) return true;
    return false;
  }
  // Bounded session cache: past the limit, the oldest poster URLs that are not on screen are released (the poster blob stays in
  // the database and is re-read in a moment if it scrolls back), so memory stays flat however far you scroll.
  function trimThumbCache() {
    const { max, keep } = ({ auto: { max: 900, keep: 600 }, low: { max: 400, keep: 250 }, minimum: { max: 150, keep: 100 }, off: { max: 900, keep: 600 } }[prefs.libraryMemory] || { max: 900, keep: 600 });
    const live = new Set([...document.images].map(image => image.currentSrc || image.src));
    // Replaced generations stay indexed in thumbUrlCache while an image still
    // displays them. Collect detached generations on every insert, even below
    // the size limit, without scanning the full poster cache.
    for (const cacheKey of staleThumbGenerations) {
      const url = thumbUrlCache.get(cacheKey);
      const key = cacheKey.slice(0, cacheKey.lastIndexOf("|"));
      if (!url || thumbKeyIndex.get(key) === cacheKey) { staleThumbGenerations.delete(cacheKey); continue; }
      if (live.has(url)) continue;
      URL.revokeObjectURL(url); thumbUrlCache.delete(cacheKey); staleThumbGenerations.delete(cacheKey);
    }
    if (thumbUrlCache.size <= max) return;
    for (const [cacheKey, url] of thumbUrlCache) {
      if (thumbUrlCache.size <= keep) break;
      if (live.has(url)) continue;
      URL.revokeObjectURL(url); thumbUrlCache.delete(cacheKey); staleThumbGenerations.delete(cacheKey);
      const key = cacheKey.slice(0, cacheKey.lastIndexOf("|"));
      if (thumbKeyIndex.get(key) === cacheKey) thumbKeyIndex.delete(key);
    }
    // A previously replaced object URL may remain in the DOM for one frame.
    // Once that image is gone, release the detached generation as well.
    for (const [cacheKey, url] of thumbUrlCache) {
      if (thumbKeyIndex.get(cacheKey.slice(0, cacheKey.lastIndexOf("|"))) === cacheKey || imageUrlIsLive(url)) continue;
      URL.revokeObjectURL(url); thumbUrlCache.delete(cacheKey); staleThumbGenerations.delete(cacheKey);
    }
  }
  function rememberThumbUrl(key, sig, url) {
    const cacheKey = `${key}|${sig}`;
    const existing = thumbUrlCache.get(cacheKey);
    // Two reads of the same poster can finish together: keep the URL that may already be on screen, drop the extra one.
    if (existing) { URL.revokeObjectURL(url); return existing; }
    const previous = thumbKeyIndex.get(key);
    if (previous && previous !== cacheKey) {
      const old = thumbUrlCache.get(previous);
      if (old && !imageUrlIsLive(old)) { URL.revokeObjectURL(old); thumbUrlCache.delete(previous); staleThumbGenerations.delete(previous); }
      else if (old) staleThumbGenerations.add(previous); // retain live replaced generations for a later trim
    }
    thumbUrlCache.set(cacheKey, url); thumbKeyIndex.set(key, cacheKey);
    trimThumbCache();
    return url;
  }
  window.addEventListener("pagehide", () => { for (const url of thumbUrlCache.values()) URL.revokeObjectURL(url); thumbUrlCache.clear(); thumbKeyIndex.clear(); staleThumbGenerations.clear(); });
  // ---- Windowed poster grids -------------------------------------------------------------------------------------
  // A collection with thousands of titles draws only the rows near the screen. The grid keeps its full height with
  // padding, so the scrollbar, "back" scroll restore and jumping around all behave as if every row existed.
  let virtualGrids = [], virtualScrollBound = false, virtualFrame = 0, virtualTimer = 0;
  function virtualMetrics(grid) {
    const style = getComputedStyle(grid), tracks = style.gridTemplateColumns.split(" ").map(parseFloat).filter(value => value > 0);
    const columns = Math.max(1, tracks.length), width = tracks[0] || 0, gap = parseFloat(style.rowGap) || 0;
    // Posters are 2:3, so a row's height is known without drawing it.
    return { columns, tile: width * 1.5, row: width * 1.5 + gap };
  }
  function updateVirtualGrid(entry, force = false) {
    const { grid, source } = entry;
    if (!grid.isConnected) return false;
    const metrics = virtualMetrics(grid);
    if (!(metrics.row > 0)) return false;
    const total = source.count, rows = Math.ceil(total / metrics.columns);
    const top = -grid.getBoundingClientRect().top, viewport = window.innerHeight || document.documentElement.clientHeight || 800;
    const buffer = viewport * 2.5;
    const first = Math.max(0, Math.min(rows, Math.floor((top - buffer) / metrics.row)));
    const last = Math.max(first, Math.min(rows, Math.ceil((top + viewport + buffer) / metrics.row)));
    const needFirst = Math.max(0, Math.floor(top / metrics.row)), needLast = Math.min(rows, Math.ceil((top + viewport) / metrics.row));
    // Redraw only when the visible rows are no longer inside the drawn window (or the column count / size changed).
    // Rebuild while the visible rows are still a screenful away from the edge of the drawn window (not after they have run past it), so a fast flick never reaches empty space.
    const lead = Math.max(2, Math.ceil(viewport / metrics.row));
    if (!force && entry.start !== undefined && entry.columns === metrics.columns && entry.row === metrics.row && (needFirst - lead >= entry.start || entry.start === 0) && (needLast + lead <= entry.end || entry.end >= rows)) return false;
    const start = Math.max(0, first - 2), end = Math.min(rows, last + 2);
    entry.start = start; entry.end = end; entry.columns = metrics.columns; entry.row = metrics.row;
    grid.style.gridAutoRows = `${metrics.tile}px`;
    grid.style.paddingTop = `${start * metrics.row}px`;
    grid.style.paddingBottom = `${Math.max(0, (rows - end) * metrics.row)}px`;
    const from = start * metrics.columns, to = Math.min(total, end * metrics.columns);
    let html = "";
    for (let index = from; index < to; index++) html += source.tile(index);
    // Virtual rows are recycled on scroll. Release the previous window's image
    // observations and queued image records before replacing its DOM.
    disposeContentResources(grid);
    grid.innerHTML = html;
    window.lucide?.createIcons({ root: grid, attrs: { "aria-hidden": "true" } });
    observeDeferredImages(grid);
    trackPosterLoading(grid.parentElement || grid);
    prioritizeVisibleCollectionImages(grid.parentElement || grid);
    return true;
  }
  function scheduleVirtualUpdate() {
    if (virtualFrame || virtualTimer) return;
    // requestAnimationFrame is the normal path; the timer covers hidden / throttled frames so the window still catches up.
    const run = () => { cancelAnimationFrame(virtualFrame); clearTimeout(virtualTimer); virtualFrame = 0; virtualTimer = 0; virtualGrids.forEach(entry => updateVirtualGrid(entry)); };
    virtualFrame = requestAnimationFrame(run); virtualTimer = setTimeout(run, 100);
  }
  function mountVirtualGrids(root) {
    virtualGrids = [...(root?.querySelectorAll?.("[data-virtual-grid]") || [])].map(grid => ({ grid, source: window.SplitAppPages.virtualGrid?.(grid.dataset.virtualGrid) })).filter(entry => entry.source);
    if (!virtualScrollBound) {
      virtualScrollBound = true;
      window.addEventListener("scroll", scheduleVirtualUpdate, { passive: true });
      window.addEventListener("resize", () => { virtualGrids.forEach(entry => { entry.start = undefined; }); scheduleVirtualUpdate(); }, { passive: true });
    }
    virtualGrids.forEach(entry => updateVirtualGrid(entry, true));
  }
  async function cachedThumbUrls(entries) {
    const found = new Map(), need = [], seen = new Set();
    entries.forEach(([key, sig]) => {
      const cacheKey = `${key}|${sig}`;
      const previous = thumbKeyIndex.get(key);
      if (previous && previous !== cacheKey) {
        const stale = thumbUrlCache.get(previous);
        if (stale && !imageUrlIsLive(stale)) { URL.revokeObjectURL(stale); thumbUrlCache.delete(previous); staleThumbGenerations.delete(previous); }
        else if (stale) staleThumbGenerations.add(previous);
        if (thumbKeyIndex.get(key) === previous) thumbKeyIndex.delete(key);
      }
      const url = thumbUrlCache.get(cacheKey);
      if (url) found.set(key, url);
      else if (!seen.has(key)) { need.push([key, sig]); seen.add(key); }
    });
    if (need.length && window.SplitAppIDB?.getThumbs) {
      try {
        const sigByKey = new Map(need);
        (await window.SplitAppIDB.getThumbs(need)).forEach(([key, blob]) => {
          found.set(key, rememberThumbUrl(key, sigByKey.get(key), URL.createObjectURL(blob)));
        });
      } catch (_) {}
    }
    trimThumbCache();
    return found;
  }
  // fetch() decodes data: URLs natively, off the JS thread.
  // Grid posters are shown at about 130 css px, so the stored grid copy is shrunk to a 420 px long edge (WebP). That makes each
  // poster several times smaller to read from the database and decode, which is what keeps big grids smooth. The detail page
  // keeps using the full artwork.
  const THUMB_EDGE = 420;
  async function shrinkThumbBlob(blob) {
    try {
      if (!blob || blob.size < 24000 || typeof createImageBitmap !== "function") return blob;
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1) { bitmap.close?.(); return blob; }
      const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
      let out = null;
      if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(width, height); canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        out = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
      } else {
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        out = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
      }
      bitmap.close?.();
      return out && out.size && out.size < blob.size ? out : blob;
    } catch (_) { return blob; }
  }
  async function dataUrlToBlob(dataUrl) {
    if (!/^data:[^;,]+;base64,/i.test(dataUrl || "")) return null;
    try { return await shrinkThumbBlob(await (await fetch(dataUrl)).blob()); } catch (_) { return null; }
  }
  // Background work waits for an idle moment and for pending taps/scrolls.
  function yieldToUser() {
    if (document.hidden) return Promise.resolve();
    return new Promise(resolve => {
      const go = () => {
        if (document.hidden) { resolve(); return; }
        if (navigator.scheduling?.isInputPending?.()) { setTimeout(go, 40); return; }
        if (window.scheduler?.postTask) window.scheduler.postTask(resolve, { priority: "background" }).catch(resolve);
        else if (window.requestIdleCallback) window.requestIdleCallback(() => resolve(), { timeout: 1500 });
        else setTimeout(resolve, 0);
      };
      go();
    });
  }
  // After a restore the poster bytes are already in memory: write them straight into the device artwork cache
  // (one batched IndexedDB write) instead of re-reading every file from the storage folder one by one.
  // Blobs are held until the folder write assigns each title its thumbnail signature; a cache row written
  // earlier would carry an empty signature and be ignored (and cleaned up as stale).
  const primedThumbs = new Map();
  async function primeThumbCache(list) {
    let ready = 0;
    for (let offset = 0; offset < list.length; offset += 24) {
      for (const item of list.slice(offset, offset + 24)) {
        if (primedThumbs.size >= 300) break; // bound memory on very large restores; the rest load from the folder
        const blob = await dataUrlToBlob(item.localThumbnailData || item.localPortraitData);
        if (blob) { primedThumbs.set(String(item.id), blob); ready++; }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return ready;
  }
  let thumbRefillTimer = 0;
  window.addEventListener("screenmark:folder-written", () => {
    if (!primedThumbs.size && !nativeAndroid) return;
    clearTimeout(thumbRefillTimer); thumbRefillTimer = setTimeout(() => fillThumbCache(), 1200);
  });
  let thumbFillRunning = false;
  async function fillThumbCache() {
    if (thumbFillRunning || !nativeAndroid || !window.SplitAppIDB?.listThumbKeys) return;
    const hydrate = window.SplitAppBackend?.hydrateThumbnails;
    if (typeof hydrate !== "function") return;
    thumbFillRunning = true;
    try {
      const savedKeys = await window.SplitAppIDB.listThumbKeys();
      const liveKeys = new Set(items.map(thumbKeyOf));
      const liveItemIds = new Set(items.map(item => String(item.id)));
      const staleKeys = savedKeys.map(([key]) => key).filter(key => !liveKeys.has(key) && !isLiveEpisodeThumbKey(key, liveItemIds) && !isLiveArtworkThumbKey(key, liveItemIds));
      if (staleKeys.length) {
        await window.SplitAppIDB.deleteThumbs?.(staleKeys);
        for (const key of staleKeys) { const held = thumbKeyIndex.get(key); if (held) { const url = thumbUrlCache.get(held); if (url) URL.revokeObjectURL(url); thumbUrlCache.delete(held); thumbKeyIndex.delete(key); } }
      }
      const have = new Map(savedKeys.filter(([key]) => liveKeys.has(key)));
      const missing = items.filter(item => item.thumbnailPath && have.get(thumbKeyOf(item)) !== thumbSigOf(item));
      const batchSize = Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2 ? 3 : 8;
      // Restored titles: reuse the in-memory poster instead of re-reading it from the storage folder.
      const primedEntries = [];
      for (const item of missing) { const blob = primedThumbs.get(String(item.id)); if (blob) { primedEntries.push([thumbKeyOf(item), thumbSigOf(item), blob]); primedThumbs.delete(String(item.id)); } }
      if (primedEntries.length) {
        try { await window.SplitAppIDB.putThumbs(primedEntries); } catch (_) {}
        const replacements = new Set(primedEntries.map(([key]) => key));
        for (const [cacheKey, url] of thumbUrlCache) {
          const key = cacheKey.slice(0, cacheKey.lastIndexOf("|"));
          if (!replacements.has(key)) continue;
          if (imageUrlIsLive(url)) continue;
          URL.revokeObjectURL(url);
          thumbUrlCache.delete(cacheKey);
          if (thumbKeyIndex.get(key) === cacheKey) thumbKeyIndex.delete(key);
        }
      }
      const primedKeys = new Set(primedEntries.map(entry => entry[0]));
      missing.splice(0, missing.length, ...missing.filter(item => !primedKeys.has(thumbKeyOf(item))));
      for (let offset = 0; offset < missing.length; offset += batchSize) {
        if (document.hidden) {
          await new Promise(resolve => {
            const onVisible = () => {
              if (document.hidden) return;
              document.removeEventListener("visibilitychange", onVisible);
              resolve();
            };
            document.addEventListener("visibilitychange", onVisible);
            // Close the race where the app became visible between the check and
            // listener registration. This also avoids periodic wakeups in background.
            if (!document.hidden) onVisible();
          });
        }
        await yieldToUser();
        const clones = missing.slice(offset, offset + batchSize).map(item => ({ ...item, localThumbnailData: "", localPortraitData: "", localLandscapeData: "", backdrop: "", cachedDetails: undefined, localImageFiles: undefined }));
        try { await hydrate(clones); } catch (_) {}
        const entries = [];
        for (let index = 0; index < clones.length; index++) {
          const blob = await dataUrlToBlob(clones[index].localThumbnailData);
          const original = missing[offset + index];
          if (blob) entries.push([thumbKeyOf(original), thumbSigOf(original), blob]);
        }
        if (entries.length) { try { await window.SplitAppIDB.putThumbs(entries); } catch (_) {} }
        // A short breather between batches keeps scrolling and taps smooth while a large library is being cached.
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally { thumbFillRunning = false; }
  }
  let thumbShrinkRunning = false;
  async function shrinkThumbCacheOnce() {
    if (!nativeAndroid || thumbShrinkRunning || !window.SplitAppIDB?.getMetaValue || !window.SplitAppIDB?.setMetaValue) return;
    thumbShrinkRunning = true;
    try {
      if (await window.SplitAppIDB.getMetaValue("thumbsShrunkV1")) return;
      const rows = await window.SplitAppIDB.listThumbKeys();
      for (let offset = 0; offset < rows.length; offset += 12) {
        if (document.hidden) {
          await new Promise(resolve => {
            const onVisible = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", onVisible); resolve(); } };
            document.addEventListener("visibilitychange", onVisible);
            if (!document.hidden) onVisible();
          });
        }
        await yieldToUser();
        const page = rows.slice(offset, offset + 12), blobs = await window.SplitAppIDB.getThumbs(page);
        const smaller = [];
        for (const [key, blob] of blobs) {
          const shrunk = await shrinkThumbBlob(blob);
          if (shrunk && shrunk !== blob && shrunk.size < blob.size) smaller.push([key, page.find(row => row[0] === key)?.[1], shrunk]);
        }
        if (smaller.length) await window.SplitAppIDB.putThumbs(smaller);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      await window.SplitAppIDB.setMetaValue("thumbsShrunkV1", true);
    } catch (error) { console.warn("Could not finish the one-time thumbnail optimization", error); }
    finally { thumbShrinkRunning = false; }
  }
  const deferredQueue = [];
  let deferredTimer = 0, deferredDrain = null, deferredObserver = null;
  const contentObservers = new Map();
  function syncRatingsLayoutControls(rating, layout, automatic) {
    rating.querySelectorAll("[data-ratings-layout]").forEach(button => {
      const selected = button.dataset.ratingsLayout === layout;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
      const label = button.dataset.ratingsLayout === "horizontal" ? "Horizontal" : "Vertical";
      button.setAttribute("aria-label", `${label} ratings layout${selected && automatic ? ", selected automatically" : ""}`);
      button.title = `${label} layout${selected && automatic ? " · automatic" : ""}`;
    });
  }
  function disposeContentResources(root) {
    const images = [];
    if (root?.matches?.("img[data-deferred-image]")) images.push(root);
    images.push(...(root?.querySelectorAll?.("img[data-deferred-image]") || []));
    const staleImages = new Set(images);
    images.forEach(image => deferredObserver?.unobserve(image));
    for (let index = deferredQueue.length - 1; index >= 0; index--) {
      const image = deferredQueue[index].image;
      if (staleImages.has(image) || !image.isConnected) deferredQueue.splice(index, 1);
    }
    for (const [observer, owner] of contentObservers) {
      if (root === document || root === owner || root?.contains?.(owner)) {
        observer.disconnect(); contentObservers.delete(observer);
      }
    }
  }
  const nativeImageFallbacks = new Map();
  const nativeImageFallbackInflight = new Map();
  const nativeImageFallbackHandlers = new WeakSet();
  function trimNativeImageFallbacks() {
    while (nativeImageFallbacks.size > 24) {
      const stale = [...nativeImageFallbacks].find(([, url]) => !imageUrlIsLive(url));
      if (!stale) break; // Every cached URL is still rendered; keep those images valid.
      nativeImageFallbacks.delete(stale[0]); URL.revokeObjectURL(stale[1]);
    }
  }
  window.addEventListener("pagehide", () => {
    for (const url of nativeImageFallbacks.values()) URL.revokeObjectURL(url);
    nativeImageFallbacks.clear(); nativeImageFallbackInflight.clear();
  });
  function attachNativeImageFallback(image) {
    if (!nativeAndroid || nativeImageFallbackHandlers.has(image)) return;
    nativeImageFallbackHandlers.add(image);
    image.addEventListener("error", async () => {
      const source = image.dataset.proxySource || image.currentSrc || image.getAttribute("src") || image.dataset.lazySrc || "";
      if (!/^https:\/\//i.test(source) || image.dataset.nativeFallbackTried) return;
      image.dataset.nativeFallbackTried = "true";
      const nativeHttp = window.CapacitorHttp || window.Capacitor?.Plugins?.CapacitorHttp;
      if (!nativeHttp?.get) return;
      try {
        let objectUrl = nativeImageFallbacks.get(source);
        if (!objectUrl) {
          let pending = nativeImageFallbackInflight.get(source);
          if (!pending) {
            pending = nativeHttp.get({ url: source, responseType: "blob", connectTimeout: 10000, readTimeout: 15000 }).then(response => {
              const encoded = typeof response?.data === "string" ? response.data : "";
              const contentType = Object.entries(response?.headers || {}).find(([key]) => key.toLowerCase() === "content-type")?.[1]?.split(";")[0] || "image/jpeg";
              if (Number(response?.status) < 200 || Number(response?.status) >= 300 || !/^image\/[a-z0-9.+-]+$/i.test(contentType) || !encoded || encoded.length > 8 * 1024 * 1024) return "";
              const binary = atob(encoded), bytes = new Uint8Array(binary.length);
              for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
              return URL.createObjectURL(new Blob([bytes], { type: contentType }));
            }).finally(() => nativeImageFallbackInflight.delete(source));
            nativeImageFallbackInflight.set(source, pending);
          }
          objectUrl = await pending;
          if (!objectUrl) return;
          nativeImageFallbacks.set(source, objectUrl);
        }
        image.addEventListener("load", () => { image.hidden = false; if (image.nextElementSibling) image.nextElementSibling.hidden = true; }, { once: true });
        image.src = objectUrl;
        trimNativeImageFallbacks();
      } catch (_) { /* Preserve the normal image placeholder when native retrieval also fails. */ }
    });
  }
  function routeRemoteImages(root = document) {
    const resolveImage = window.SplitAppDiscovery?.imageUrl;
    if (typeof resolveImage !== "function") return;
    const images = [];
    if (root.matches?.("img[src]")) images.push(root);
    images.push(...(root.querySelectorAll?.("img[src]") || []));
    images.forEach(image => {
      attachNativeImageFallback(image);
      const source = image.getAttribute("src");
      if (!source || image.dataset.proxySource) return;
      if (/^http:\/\//i.test(source)) { image.removeAttribute("src"); image.hidden = true; return; }
      const resolved = resolveImage(source);
      if (resolved !== source) {
        image.dataset.proxySource = source;
        image.addEventListener("error", event => {
          if (!image.dataset.proxyFallbackTried) {
            image.dataset.proxyFallbackTried = "true"; image.hidden = false; image.src = image.dataset.proxySource;
            event.stopImmediatePropagation();
          }
        }, { capture: true });
        image.src = resolved;
      }
    });
  }
  function prioritizeVisibleDetailImages(root = document) {
    const activePanel = root.querySelector?.(".detail-tab-panel:not([hidden])");
    const scope = activePanel || root.querySelector?.(".demo-detail-content") || root;
    const images = [...(scope?.querySelectorAll?.("img[loading=lazy]") || [])].slice(0, 36);
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    images.map(image => ({ image, rect: image.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom >= -180 && rect.top <= viewportHeight + 360 && rect.right >= -180 && rect.left <= viewportWidth + 220)
      .forEach(({ image }) => { image.loading = "eager"; });
  }
  function prioritizeVisibleCollectionImages(root = document) {
    const collectionPage = ["series", "movies", "series-favorites", "movie-favorites"].includes(page);
    const watchlistPage = ["series-watchlist", "movie-watchlist"].includes(page);
    if (!collectionPage && !watchlistPage) return;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const selector = collectionPage ? ".profile-collection-grid img" : ".watchlist-card img";
    const cardSelector = collectionPage ? ".profile-poster" : ".watchlist-card";
    const images = [...(root?.querySelectorAll?.(selector) || [])];
    images.map(image => ({ image, rect: (image.closest(cardSelector) || image).getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom >= -120 && rect.top < viewportHeight + 240)
      .slice(0, 12)
      .forEach(({ image }, index) => { image.loading = "eager"; if (index < 6 && "fetchPriority" in image) image.fetchPriority = "high"; });
  }
  function finishDeferredImage(image, source) {
    if (!image?.isConnected) return;
    delete image.dataset.localItemId; delete image.dataset.lazySrc;
    if (/^http:\/\//i.test(String(source || ""))) source = "";
    const detailTrigger = image.closest("[data-detail-image-src]");
    if (detailTrigger && source) detailTrigger.dataset.detailImageSrc = source;
    if (source) {
      const reveal = () => { image.hidden = false; image.style.visibility = ""; if (image.nextElementSibling) image.nextElementSibling.hidden = true; };
      image.addEventListener("load", reveal, { once: true });
      image.src = window.SplitAppDiscovery?.imageUrl?.(source) || source;
      if (image.complete && image.naturalWidth) reveal();
    }
    else { image.hidden = true; image.style.visibility = ""; if (image.nextElementSibling) image.nextElementSibling.hidden = false; }
  }
  async function drainDeferredImages() {
    if (deferredDrain) return deferredDrain;
    deferredDrain = (async () => {
      const hydrate = window.SplitAppBackend?.hydrateThumbnails;
      while (deferredQueue.length) {
        const batchSize = Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2 ? 16 : 40;
        const batch = deferredQueue.splice(0, batchSize);
        const cached = await cachedThumbUrls(batch.map(record => [record.key, record.signature]));
        const slow = [];
        for (const record of batch) {
          if (!record.image.isConnected) continue;
          if (record.image.dataset.customCover) { finishDeferredImage(record.image, record.image.dataset.customCover); continue; }
          const hit = cached.get(record.key);
          if (hit) finishDeferredImage(record.image, hit);
          else if (/^https?:/i.test(record.online) && navigator.onLine) finishDeferredImage(record.image, record.online); // not cached yet: online straight away
          else slow.push(record);
        }
        const folderBacked = slow.filter(record => !record.episodeId && record.key === thumbKeyOf(record.item));
        if (!folderBacked.length || typeof hydrate !== "function") { slow.forEach(record => finishDeferredImage(record.image, record.online)); continue; }
        for (let index = slow.length - 1; index >= 0; index--) if (!slow[index].image.isConnected) slow.splice(index, 1);
        const records = slow.filter(record => !record.episodeId);
        if (!records.length) continue;
        const clones = records.map(record => ({ ...record.item, localThumbnailData: "", localPortraitData: "", localLandscapeData: "", backdrop: "", cachedDetails: undefined, localImageFiles: undefined }));
        try { await hydrate(clones); } catch (error) { recordLog("warning", `Could not load saved artwork: ${error?.message || error}`); }
        records.forEach((record, index) => {
          const local = clones[index].localThumbnailData;
          finishDeferredImage(record.image, local || record.online);
          if (local) dataUrlToBlob(local).then(blob => blob && window.SplitAppIDB?.putThumbs?.([[record.key, record.signature, blob]])).catch(() => {});
        });
        slow.filter(record => record.episodeId).forEach(record => finishDeferredImage(record.image, record.online));
      }
    })().finally(() => { deferredDrain = null; });
    return deferredDrain;
  }
  function activateDeferredImage(image) {
    if (!image?.isConnected || image.hasAttribute("src")) return;
    const item = image.dataset.localItemId && itemById(image.dataset.localItemId);
    const online = image.dataset.lazySrc || "";
    if (!item) { finishDeferredImage(image, online); return; }
    if (image.dataset.customCover) { finishDeferredImage(image, image.dataset.customCover); return; }
    const episodeId = image.dataset.localEpisodeId || "";
    const key = image.dataset.localCacheKey || (episodeId ? episodeThumbKeyOf(item, episodeId) : thumbKeyOf(item));
    const signature = image.dataset.localCacheSignature || (episodeId ? online : thumbSigOf(item));
    const warm = thumbUrlCache.get(`${key}|${signature}`);
    if (warm) { finishDeferredImage(image, warm); return; }
    if (deferredQueue.length >= 256) { finishDeferredImage(image, online); return; }
    deferredQueue.push({ item, image, online, key, signature, episodeId });
    if (!deferredTimer) deferredTimer = setTimeout(() => { deferredTimer = 0; drainDeferredImages(); }, 0);
  }
  function observeDeferredImages(root = document) {
    root?.querySelectorAll?.("img").forEach(attachNativeImageFallback);
    routeRemoteImages(root);
    const images = [...(root?.querySelectorAll?.("img[data-deferred-image]") || [])].filter(image => !image.hasAttribute("src"));
    if (!images.length) return;
    if (!window.IntersectionObserver) { images.forEach(activateDeferredImage); return; }
    if (!deferredObserver) deferredObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      deferredObserver.unobserve(entry.target);
      activateDeferredImage(entry.target);
    }), { rootMargin: "700px 0px" });
    images.forEach(image => {
      // Posters whose thumbnail is already in memory are painted synchronously: a re-render (e.g. "load more") must not flash empty tiles.
      const item = image.dataset.localItemId && itemById(image.dataset.localItemId);
      if (item && !image.dataset.localEpisodeId && !image.dataset.customCover) {
        const key = image.dataset.localCacheKey || thumbKeyOf(item), signature = image.dataset.localCacheSignature || thumbSigOf(item);
        if (thumbUrlCache.get(`${key}|${signature}`)) { image.decoding = "sync"; activateDeferredImage(image); return; }
      }
      deferredObserver.observe(image);
    });
  }

  let metadataLibraryReady = false;
  let libraryRestoreComplete = false;
  // A re-render that would produce exactly the HTML already on screen is skipped: swapping the grid recreates every poster <img>,
  // which blanks and reloads all thumbnails (the visible "blink").
  const STABLE_RENDER_PAGES = new Set(["profile", "series", "movies", "series-favorites", "movie-favorites", "series-watchlist", "movie-watchlist"]);
  let lastPageHtml = "", lastPageHtmlRoute = "";
  function render() {
    if (metadataLibraryReady && !metadataSync && metadataSyncState?.entries?.some(entry => ["queued", "running"].includes(entry.status)) && navigator.onLine && prefs.metadataMode !== "offline" && !document.hidden) queueMicrotask(() => startMetadataSync(null, true, "needed", true, true));
    document.body.dataset.page = page;
    $("#page-title").textContent = titles[page];
    { const back = $("#topbar-back"); if (back) { back.hidden = page !== "achievements"; if (page === "achievements") { back.href = achievementId ? "#achievements" : "#profile"; back.setAttribute("aria-label", achievementId ? "Back to achievements" : "Back to profile"); window.lucide?.createIcons({ root: back, attrs: { "aria-hidden": "true" } }); } } }
    $("#topbar-title-block").hidden = page === "discover";
    $("#discover-top-search").hidden = page !== "discover";
    const discoverInput = $("#discover-query");
    if (discoverInput) {
      discoverInput.value = discoverQuery;
      discoverInput.placeholder = currentDiscoverCategory() === "series" ? "Search shows" : "Search movies";
      const clearButton = $("[data-discover-clear]");
      if (clearButton) clearButton.hidden = !discoverQuery.trim();
    }
    const headerType = $("#header-type");
    headerType.hidden = page !== "discover";
    if (page === "discover") {
      const source = discoverSource ? window.SplitAppSources.list().find(row => row.key === discoverSource) : null;
      const categories = config.categories.filter(row => !source || source.categories.includes(row.key));
      headerType.hidden = categories.length < 2;
      headerType.innerHTML = [...categories].sort((a, b) => (a.key === "series" ? 0 : 1) - (b.key === "series" ? 0 : 1)).map(row => {
        const label = row.key === "movie" ? "Movies" : row.key === "series" ? "Shows" : row.label;
        const selected = currentDiscoverCategory() === row.key;
        return `<button type="button" class="lens-tab${selected ? " on" : ""}" data-discover-category="${esc(row.key)}" aria-pressed="${selected}">${esc(label)}</button>`;
      }).join("");
    }
    if (page === "details" && detailItemId) {
      const viewedItem = itemById(detailItemId);
      if (viewedItem?.cachedDetails && reconcileEpisodes(viewedItem)) persist({ ids: [viewedItem.id] });
    }
    const content = $("#page-content");
    // Discover's backdrop observer closes over the old results container. Stop it
    // before leaving the page so detached cards and their result array can be freed.
    if (page !== "discover" && backdropObserver) { backdropObserver.disconnect(); backdropObserver = null; }
    setPullToRefreshEnabled(["details", "discover", "series-watchlist", "movie-watchlist"].includes(page));
    if (page === "settings") { if (settingsGroup !== renderedSettingsGroup) { settingsFrom = renderedSettingsGroup || ""; renderedSettingsGroup = settingsGroup; } } else renderedSettingsGroup = undefined;
    const route = page === "settings" ? `settings/${settingsGroup || "index"}` : page === "statistics" && statsSubpage ? `statistics/${statsSubpage}` : page;
    const preservePageState = route === renderedRoute;
    let enterRoute = false;
    const previousControls = preservePageState ? [...content.querySelectorAll("input, textarea, select")].map(element => ({
      id: element.id,
      name: element.name,
      type: element.type,
      value: element.value,
      checked: "checked" in element ? element.checked : undefined,
      start: typeof element.selectionStart === "number" ? element.selectionStart : null,
      end: typeof element.selectionEnd === "number" ? element.selectionEnd : null
    })) : [];
    const activeControlIndex = preservePageState ? [...content.querySelectorAll("input, textarea, select")].indexOf(document.activeElement) : -1;
    const openPageDialogs = preservePageState ? [...content.querySelectorAll("dialog[open]")].map(dialog => dialog.id).filter(Boolean) : [];
    if (route !== renderedRoute) {
      content.classList.remove("page-route-enter");
      enterRoute = !motionIsReduced();
      if (renderedRoute !== null) inAppNav = true;
      renderedRoute = route;
    }
    let nextHtml = null;
    if (preservePageState && STABLE_RENDER_PAGES.has(page) && lastPageHtmlRoute === route && typeof window.SplitAppPages[page] === "function") {
      nextHtml = window.SplitAppPages[page](pageContext());
      if (nextHtml === lastPageHtml && content.firstElementChild && !content.querySelector("[data-virtual-grid]")) { return; }
    }
    const previousCollectionToolbar = document.getElementById("collection-toolbar");
    if (previousCollectionToolbar) {
      // The toolbar is portaled to body, outside #page-content; dispose its
      // deferred images and observers explicitly before removing it.
      disposeContentResources(previousCollectionToolbar);
      previousCollectionToolbar.remove();
    }
    disposeContentResources(content);
    if (page === "setup" && !setupStarted) beginSetup(); else if (page !== "setup") setupStarted = false;
    if (typeof window.SplitAppPages[page] !== "function") {
      // A page module failed to register: log it and fall back instead of leaving a blank, crashed screen.
      recordLog("error", `Page "${page}" is not available (its script did not load).`);
      const fallback = ["series-watchlist", "discover", "profile"].find(name => typeof window.SplitAppPages[name] === "function");
      if (!fallback || fallback === page) { content.innerHTML = `<section class="settings-page"><p class="app-info">This page could not be loaded. Restart ScreenMark.</p></section>`; return; }
      page = fallback; setupStarted = false;
    }
    const pageHtml = nextHtml ?? window.SplitAppPages[page](pageContext());
    lastPageHtml = STABLE_RENDER_PAGES.has(page) ? pageHtml : ""; lastPageHtmlRoute = STABLE_RENDER_PAGES.has(page) ? route : "";
    content.innerHTML = pageHtml;
    if (page === "setup") { const grid = $("#setup-grid"); if (grid) routeRemoteImages(grid); }
    if (["series", "movies", "series-favorites", "movie-favorites"].includes(page)) trackPosterLoading(content);
    if (page === "details") { prioritizeVisibleDetailImages(content); if (detailTab === "cast" && !detailRef && content.querySelector("[data-cast-lazy]")) Promise.resolve().then(() => loadDetailCast()); }
    if (page === "series-watchlist") hydrateWatchlistEpisodeThumbs(content);
    if (page === "series-watchlist" || page === "movie-watchlist") {
      // Above-the-fold thumbnails: fetch immediately at high priority instead of waiting for lazy-load heuristics.
      content.querySelectorAll(".watchlist-card img[loading=lazy]").forEach((img, index) => {
        if (index >= 8) return;
        img.loading = "eager"; img.fetchPriority = "high";
      });
    }
    if (enterRoute) requestAnimationFrame(() => { if (renderedRoute === route) content.classList.add("page-route-enter"); });
    const collectionToolbar = content.querySelector(".profile-filter-bar, .profile-filter-pill");
    if (collectionToolbar) {
      collectionToolbar.id = "collection-toolbar";
      document.body.append(collectionToolbar);
      collectionToolbar.addEventListener("click", event => {
        const button = eventClosest(event, "[data-open-profile-filters]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        showPopup($("#profile-filter-dialog"));
      });
      window.lucide?.createIcons({ root: collectionToolbar, attrs: { "aria-hidden": "true" } });
    }
    const episodeRail = content.querySelector("[data-tracking-episode-rail]");
    const focusEpisode = episodeRail?.querySelector('[data-current-episode="true"]');
    if (episodeRail && focusEpisode) {
      const railRect = episodeRail.getBoundingClientRect(), cardRect = focusEpisode.getBoundingClientRect();
      episodeRail.scrollLeft = Math.max(0, episodeRail.scrollLeft + cardRect.left - railRect.left - (episodeRail.clientWidth - focusEpisode.clientWidth) / 2);
    }
    if (episodeRail) {
      // Cheap settle-based highlight: no per-frame layout work, only one class swap after scrolling pauses.
      const railCards = [...episodeRail.querySelectorAll(".tracking-episode-card")];
      let settleTimer = 0, activeCard = null;
      const settle = () => {
        settleTimer = 0;
        const center = episodeRail.scrollLeft + episodeRail.clientWidth / 2;
        let best = null, bestDist = Infinity;
        for (const card of railCards) {
          const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
          if (dist < bestDist) { best = card; bestDist = dist; } else if (best) break;
        }
        if (best === activeCard) return;
        activeCard?.classList.remove("is-active");
        best?.classList.add("is-active");
        activeCard = best;
      };
      const queueSettle = () => { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 24); };
      episodeRail.addEventListener("scroll", queueSettle, { passive: true });
      settle();
    }
    content.querySelectorAll('.ep-ratings[data-layout-mode="auto"]').forEach(rating => {
      const resize = () => {
        if (!rating.isConnected || rating.dataset.layoutMode !== "auto") return;
        const next = window.SplitAppPages.autoRatingsLayout?.(rating.clientWidth, Number(rating.dataset.seasonCount) || 0, Number(rating.dataset.longest) || 0);
        if (!next || next === rating.dataset.layout) return;
        rating.dataset.layout = next;
        syncRatingsLayoutControls(rating, next, true);
      };
      resize();
      if (window.ResizeObserver) {
        const observer = new ResizeObserver(resize);
        contentObservers.set(observer, rating);
        observer.observe(rating);
      }
    });
    content.querySelectorAll(".ep-ratings-v[data-ratings-lazy]").forEach(rating => {
      const grid = rating.querySelector(".ep-ratings-cols"), sentinel = rating.querySelector("[data-ratings-sentinel]");
      if (!grid || !sentinel) return;
      if (!window.IntersectionObserver) {
        rating.querySelectorAll("template[data-ratings-chunk]").forEach(template => { grid.append(template.content); template.remove(); });
        sentinel.remove();
        return;
      }
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        const template = rating.querySelector("template[data-ratings-chunk]");
        if (!template) { observer.disconnect(); contentObservers.delete(observer); sentinel.remove(); return; }
        grid.append(template.content);
        template.remove();
        if (!rating.querySelector("template[data-ratings-chunk]")) { observer.disconnect(); contentObservers.delete(observer); sentinel.remove(); return; }
        observer.unobserve(sentinel);
        requestAnimationFrame(() => {
          if (sentinel.isConnected) observer.observe(sentinel);
          else { observer.disconnect(); contentObservers.delete(observer); }
        });
      }, { rootMargin: "700px 0px" });
      contentObservers.set(observer, rating);
      observer.observe(sentinel);
    });
    if (page === "discover" && discoverCache && discoverCache.source === discoverSource && discoverCache.query === discoverQuery && discoverCache.category === currentDiscoverCategory()) paintDiscoverResults(discoverCache.results, discoverSource);
    else if (page === "discover" && discoverQuery.trim() && discoverSubmitted !== discoverRequestKey()) submitDiscover();
    else if (page === "discover" && !discoverQuery) loadDiscoverSuggestions();
    if (page === "statistics") { const chart = $(".stats-activity-chart-month"); if (chart) chart.scrollLeft = chart.scrollWidth; }
    if (preservePageState) {
      const controls = [...content.querySelectorAll("input, textarea, select")];
      previousControls.forEach((saved, index) => {
        const target = saved.id ? document.getElementById(saved.id) : saved.name ? controls.find(element => element.name === saved.name && element.type === saved.type && (saved.type !== "radio" || element.value === saved.value)) : controls[index];
        if (!target || target.type === "file") return;
        const stateBound = target.matches("[data-pref], #global-search");
        if (target.type !== "radio" && target.type !== "checkbox" && (!stateBound || target.value === saved.value)) target.value = saved.value;
        if (saved.checked !== undefined && !target.matches("[data-pref], [data-detail-status]")) target.checked = saved.checked;
        if (saved.start !== null && typeof target.setSelectionRange === "function") {
          try { target.setSelectionRange(saved.start, saved.end); } catch (_) {}
        }
      });
      openPageDialogs.forEach(id => {
        const dialog = document.getElementById(id);
        if (dialog && !dialog.open) showPopup(dialog, { silent: true });
      });
      if (activeControlIndex >= 0) {
        const activeControl = controls[activeControlIndex];
        if (activeControl?.matches("[data-settings-index-search], [data-settings-search]")) activeControl.dispatchEvent(new Event("input", { bubbles: true }));
        activeControl?.focus({ preventScroll: true });
      }
    }
    window.lucide?.createIcons({ root: content, attrs: { "aria-hidden": "true" } });
    updateSyncOverlay();
    window.lucide?.createIcons({ root: $("#sync-overlay"), attrs: { "aria-hidden": "true" } });
    window.lucide?.createIcons({ root: $("#discover-top-search"), attrs: { "aria-hidden": "true" } });
    observeDeferredImages(content);
    mountVirtualGrids(content);
    prioritizeVisibleCollectionImages(content);
    const collectionMore = content.querySelector("[data-collection-more]");
    collectionMore?.addEventListener("click", event => {
      if (window.SplitAppPages.loadMoreCollection?.(event.currentTarget.dataset.collectionMore)) render();
    });
    if (collectionMore && window.IntersectionObserver) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect(); contentObservers.delete(observer); collectionMore.click();
      }, { rootMargin: "1800px 0px" });
      contentObservers.set(observer, collectionMore);
      observer.observe(collectionMore);
    }
    const watchlistMoreButtons = [...content.querySelectorAll("[data-watchlist-more]")];
    watchlistMoreButtons.forEach(button => {
      button.addEventListener("click", () => {
        if (window.SplitAppPages.loadMoreWatchlist?.(button.dataset.watchlistMore)) render();
      });
      if (window.IntersectionObserver) {
        const observer = new IntersectionObserver(entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect(); contentObservers.delete(observer); button.click();
        }, { rootMargin: "1800px 0px" });
        contentObservers.set(observer, button);
        observer.observe(button);
      }
    });
    content.querySelector("#item-form")?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.defaultPrevented || event.target.matches("textarea, #add-metadata-query")) return;
      event.preventDefault();
      saveAddForm(event.currentTarget);
    });
    content.querySelectorAll("[data-cancel-add]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); entryDraftId = null; goto(addReturnPage); }));
    content.querySelectorAll("[data-save-item]").forEach(saveButton => saveButton.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); saveAddForm($("#item-form")); }));
    content.querySelector("#detail-edit-form")?.addEventListener("submit", saveDetailEdit);
    content.querySelectorAll(".detail-page [data-action]").forEach(button => button.addEventListener("click", event => {
      const action = button.dataset.action;
      if (!["edit", "progress", "refresh-details", "delete-detail", "cancel-detail-edit", "save-detail-item", "open-library-item"].includes(action)) return;
      event.preventDefault(); event.stopPropagation();
      if (action === "edit") { detailEditMode = true; render(); }
      else if (action === "progress") updateProgress(button.dataset.id);
      else if (action === "refresh-details") loadDetails(null, true);
      else if (action === "delete-detail") requestDeleteDetails(button.dataset.id);
      else if (action === "cancel-detail-edit") { detailEditMode = false; render(); }
      else if (action === "open-library-item") openDetails(button.dataset.id);
      else if (action === "save-detail-item") {
        const saved = addDiscoverResult(detailPreview);
        if (saved) { detailPreview = null; detailItemId = saved.id; if (saved.category === "series") detailTab = "episodes"; detailData = null; loadDetails(); }
      }
    }));
    content.querySelector("[data-detail-save]")?.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const form = content.querySelector("#detail-edit-form");
      if (form?.reportValidity()) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const detailDeleteDialog = content.querySelector("#detail-delete-dialog");
    if (detailDeleteDialog && !detailDeleteDialog.dataset.portalCloseBound) {
      detailDeleteDialog.dataset.portalCloseBound = "true";
      detailDeleteDialog.addEventListener("close", () => {
        if (detailDeleteDialog.open) return;
        const parent = detailDeleteDialog._returnToParent; detailDeleteDialog._returnToParent = null;
        if (detailDeleteDialog.dataset.removeAfterClose === "true" || !parent?.isConnected) { detailDeleteDialog.remove(); return; }
        parent.append(detailDeleteDialog);
      });
    }
    content.querySelector("[data-detail-delete-confirm]")?.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); const dialog = $("#detail-delete-dialog");
      if (dialog) { dialog.dataset.removeAfterClose = "true"; closePopup(dialog, { immediate: true, afterPop: () => deleteFromDetails(detailItemId) }); }
      else deleteFromDetails(detailItemId);
    });
    content.querySelector("[data-detail-delete-cancel]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); closePopup($("#detail-delete-dialog"), { immediate: true }); });
    content.querySelectorAll("[data-add-image-picker]").forEach(button => button.addEventListener("click", () => {
      const picker = button.dataset.addImagePicker === "camera" ? $("#add-camera-picker") : $("#add-gallery-picker");
      picker?.click();
    }));
    [$("#add-gallery-picker"), $("#add-camera-picker")].filter(Boolean).forEach(picker => picker.addEventListener("change", () => readAddImage(picker.files?.[0])));
    content.querySelector("[data-add-metadata-search]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); searchAddMetadata(); });
    content.querySelector("#add-metadata-query")?.addEventListener("input", event => { addMetadataQuery = event.target.value; });
    content.querySelector("#add-metadata-query")?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); searchAddMetadata(); } });
    content.querySelector("#add-metadata-results")?.addEventListener("click", event => {
      const button = eventClosest(event, "[data-add-metadata-index]");
      if (button) selectAddMetadata(button.dataset.addMetadataIndex);
    });
    if (page === "settings" && settingsGroup === "backups") refreshBackupFolderStatus();
    if (page === "settings" && settingsGroup === "storage") refreshStorageDetails();
    content.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); goto(button.dataset.go); }));
    content.querySelectorAll("[data-entry-status]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const form = button.closest("form");
      if (form?.elements.status) form.elements.status.value = button.dataset.entryStatus;
      button.parentElement?.querySelectorAll("[data-entry-status]").forEach(option => {
        const selected = option === button; option.classList.toggle("active", selected); option.setAttribute("aria-pressed", String(selected));
      });
    }));
    content.querySelectorAll("[data-timeline-filter]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); timelineFilter = button.dataset.timelineFilter; render();
    }));
    content.querySelectorAll("[data-nav-icon-pick]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const key = button.dataset.navIconPick, icon = button.dataset.icon;
      prefs.navIcons[key] = safeLucideName(icon, prefs.navIcons[key]);
      persist({ meta: true }); applyPreferences(); render();
    }));
    content.querySelectorAll("[data-nav-icon-select]").forEach(select => select.addEventListener("change", event => {
      event.stopPropagation();
      const key = select.dataset.navIconSelect;
      prefs.navIcons[key] = safeLucideName(select.value, prefs.navIcons[key]);
      persist({ meta: true }); applyPreferences(); render();
    }));
    content.querySelector("[data-open-timeline-filters]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); showPopup($("#timeline-filter-dialog")); });
    content.querySelector("[data-clear-timeline-filters]")?.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      timelineSearch = ""; timelineMonth = ""; timelineYear = ""; timelineFrom = ""; timelineTo = ""; timelineFilter = "all";
      closePopup($("#timeline-filter-dialog"), { immediate: true }); render();
    });
    content.querySelector("#timeline-filter-dialog form")?.addEventListener("submit", event => {
      event.preventDefault(); event.stopPropagation();
      timelineSearch = event.currentTarget.elements["timeline-search"].value.trim();
      timelineMonth = event.currentTarget.elements["timeline-month"].value;
      timelineYear = event.currentTarget.elements["timeline-year"].value;
      timelineFrom = event.currentTarget.elements["timeline-from"]?.value || ""; timelineTo = event.currentTarget.elements["timeline-to"]?.value || "";
      closePopup($("#timeline-filter-dialog"), { immediate: true }); render();
    });
    content.querySelectorAll("[data-source-filter]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      metadataSourceFilter = button.dataset.sourceFilter;
      content.querySelectorAll("[data-source-filter]").forEach(filter => {
        const selected = filter === button;
        filter.classList.toggle("active", selected);
        filter.setAttribute("aria-pressed", String(selected));
      });
      content.querySelectorAll("[data-source-row]").forEach(row => {
        const enabled = row.dataset.sourceEnabledState === "true";
        row.hidden = metadataSourceFilter === "enabled" ? !enabled : metadataSourceFilter === "disabled" ? enabled : false;
      });
    }));
    content.querySelectorAll("[data-backup-folder-action]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      if (button.dataset.backupFolderAction === "choose") chooseBackupDatabaseFolder();
      else refreshBackupFolderStatus();
    }));
    content.querySelectorAll("[data-storage-action]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      runStorageAction(button.dataset.storageAction).catch(error => toast(error.message || "Storage action failed."));
    }));
    content.querySelectorAll("[data-metadata-sync-action]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      if (button.dataset.metadataSyncAction === "start") syncMetadataNow();
      else if (button.dataset.metadataSyncAction === "retry") retryMetadataSync(button.dataset.id || null);
      else if (button.dataset.metadataSyncAction === "clear") clearMetadataSyncState();
      else if (button.dataset.metadataSyncAction === "toggle") setMetadataSyncPaused(!metadataSyncPaused);
    }));
    content.querySelectorAll("[data-setting-action]").forEach(button => button.addEventListener("click", event => {
      if (button.type === "file") return; // let the file picker open
      event.preventDefault(); event.stopPropagation();
      const key = button.dataset.settingAction;
      if (key === "resetAnimations") resetAnimations();
      else if (key === "previewAnimations") previewAnimations();
      else if (key === "resetAppearance") resetAppearance();
      else if (key === "export") exportList();
      else if (key === "export-encrypted") createEncryptedTransfer();
      else if (key === "export-share") createEncryptedTransfer({ share: true });
      else if (key === "export-txt") exportNames("txt");
      else if (key === "export-csv") exportNames("csv");
      else if (key === "sync-metadata") syncMetadataNow();
      else if (key.startsWith("syncRun")) runMetadataSyncAction(key);
      else if (key.startsWith("clear-")) {
        clearAppCaches(key === "clear-images" ? "images" : key === "clear-metadata" ? "metadata" : "temporary")
          .then(() => toast("Temporary cache cleared."))
          .catch(error => toast(error.message || "Could not clear the cache."));
      }
    }));
    content.querySelectorAll("[data-setting-picker]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openSettingPicker(button); }));
    content.querySelectorAll("[data-detail-image-src]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); showDetailImage($$('[data-detail-image-src]', content).indexOf(button));
    }));
    content.querySelector("[data-detail-image-close]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); closePopup($("#detail-image-modal")); });
    content.querySelector("[data-detail-image-prev]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); showDetailImage(detailImagePosition - 1); });
    content.querySelector("[data-detail-image-next]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); showDetailImage(detailImagePosition + 1); });
  }
  async function refreshStorageDetails() {
    const target = $("#storage-cache-breakdown");
    if (!target) return;
    const prefix = `splitapp_${config.key}`;
    const snapshotKey = `${prefix}_storage_snapshot_v1`;
    try { const snap = JSON.parse(localStorage.getItem(snapshotKey) || "null"); if (snap?.html) { target.innerHTML = snap.html; const node = $("#storage-total"); if (node && snap.total) node.textContent = snap.total; } } catch (_) {}
    try {
      const names = (await window.caches?.keys?.() || []).filter(name => name.startsWith(prefix));
      const totals = { metadata: 0, images: 0, other: 0 };
      // Per-cache sizes are remembered with a cheap signature (entry count + first/last URL), so an unchanged
      // cache costs one keys() call. Changed caches are measured in small slices that yield to the UI and stop
      // as soon as the page is left, so this never competes with scrolling or navigation.
      const sizesKey = `${prefix}_cache_sizes_v1`;
      let known = {}; try { known = JSON.parse(localStorage.getItem(sizesKey) || "{}") || {}; } catch (_) {}
      const next = {};
      const alive = () => Boolean($("#storage-cache-breakdown")?.isConnected) && page === "settings";
      for (const name of names) {
        if (!alive()) return;
        const bucket = name.includes("image") ? "images" : name.includes("metadata") ? "metadata" : "other";
        const cache = await window.caches.open(name);
        const requests = await cache.keys();
        const sig = `${requests.length}|${requests[0]?.url || ""}|${requests[requests.length - 1]?.url || ""}`;
        if (known[name]?.sig === sig) { next[name] = known[name]; totals[bucket] += known[name].bytes; continue; }
        let bytes = 0;
        for (let offset = 0; offset < requests.length; offset += 16) {
          if (!alive()) return;
          const sizes = await Promise.all(requests.slice(offset, offset + 16).map(async request => {
            const response = await cache.match(request);
            return Number(response?.headers.get("content-length")) || (response ? (await response.blob()).size : 0);
          }));
          bytes += sizes.reduce((sum, size) => sum + size, 0);
          await yieldToUser();
        }
        next[name] = { sig, bytes }; totals[bucket] += bytes;
      }
      try { localStorage.setItem(sizesKey, JSON.stringify(next)); } catch (_) {}
      if (!$("#storage-cache-breakdown")) return;
      const format = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      const libraryBytes = estimateLibraryBytes();
      const total = libraryBytes + totals.metadata + totals.images + totals.other;
      const totalNode = $("#storage-total"); if (totalNode) totalNode.textContent = format(total);
      target.innerHTML = `<div class="storage-breakdown-row"><span>Metadata responses</span><strong>${format(totals.metadata)}</strong></div><div class="storage-breakdown-row"><span>Images and artwork</span><strong>${format(totals.images)}</strong></div>${totals.other ? `<div class="storage-breakdown-row"><span>Other app cache</span><strong>${format(totals.other)}</strong></div>` : ""}`;
      try { localStorage.setItem(snapshotKey, JSON.stringify({ html: target.innerHTML, total: format(total) })); } catch (_) {}
    } catch (_) {
      if (target.isConnected) target.innerHTML = '<div class="storage-breakdown-row"><span>Cache usage</span><strong>Not available in this browser</strong></div>';
    }
  }
  async function refreshBackupFolderStatus() {
    const status = $("#backup-folder-status");
    if (!status || !window.SplitAppBackend?.inspectFolder) return;
    try {
      const result = await window.SplitAppBackend.inspectFolder();
      if (!status.isConnected) return;
      if (result.unsupported) status.textContent = "Folder storage is available in the Android app.";
      else if (!result.configured) status.textContent = "No database folder selected";
      else if (!result.valid) status.textContent = "Folder access is unavailable. Choose a folder again.";
      else if (result.databaseExists && result.mediaFoldersReady) status.textContent = "Database found. Movies and shows are stored separately.";
      else if (result.databaseExists) status.textContent = "Database found. Separating movies and shows in the background…";
      else status.textContent = "Folder is available. A database will be created there.";
    } catch (error) {
      if (status.isConnected) status.textContent = `Could not check folder: ${error.message || error}`;
    }
  }
  function applySelectedFolderData(selected) {
    items = Array.isArray(selected.items) ? selected.items.filter(item => config.categories.some(category => category.key === item.category)) : [];
    itemIndexItems = null;
    history = Array.isArray(selected.history) ? selected.history : [];
    if (selected.loadedFromFolder) {
      Object.keys(prefs).forEach(key => delete prefs[key]);
      Object.assign(prefs, JSON.parse(JSON.stringify(prefsDefaults)));
    }
    if (selected.preferences && typeof selected.preferences === "object") Object.assign(prefs, selected.preferences);
    migrateLegacyMixItems();
    refreshSourceRegistry();
    normalizeNavigationPrefs();
  }
  async function chooseBackupDatabaseFolder() {
    const button = $("[data-backup-folder-action=choose]");
    if (button) button.disabled = true;
    try {
      const selected = await window.SplitAppBackend.chooseFolder({ items, history, preferences: prefs });
      applySelectedFolderData(selected);
      await window.SplitAppBackend.save({ items, history, preferences: prefs });
      localMutationRevision += 1;
      noteLocalMutation(null, localMutationRevision);
      applyPreferences(); render();
      toast(selected.loadedFromFolder ? "Database loaded from the selected folder." : "Database folder selected and current data saved.");
    } catch (error) {
      toast(error.message || "Could not select a database folder.");
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }
  async function clearAppCaches(kind) {
    if (kind === "images" || kind === "temporary") {
      for (const url of thumbUrlCache.values()) URL.revokeObjectURL(url);
      thumbUrlCache.clear(); thumbKeyIndex.clear();
    }
    if (kind === "images") {
      await window.SplitAppIDB?.clearThumbs?.().catch(() => {});
    }
    if (kind === "temporary") {
      try { await window.Capacitor?.Plugins?.CacheManager?.clearWebViewCache?.(); } catch (_) {}
    }
    if (!window.caches) return;
    const prefix = `splitapp_${config.key}`;
    const names = (await caches.keys()).filter(name => name.startsWith(prefix) && (kind === "temporary" || name.includes(kind === "images" ? "image" : "metadata")));
    await Promise.all(names.map(name => caches.delete(name)));
  }
  async function clearLogcat() {
    localStorage.removeItem(`${storageKey}_log`); rowStore("log", 200).rows = [];
    await window.SplitAppBackend?.clearJournal?.("logcat");
  }
  async function clearLibraryHistory() {
    historyJournalRevision += 1;
    historyJournalLoaded = true;
    history = [];
    localStorage.removeItem(`${storageKey}_history`); rowStore("history", 2000).rows = [];
    await Promise.all([persist({ meta: true, replaceHistory: true }), window.SplitAppBackend?.clearJournal?.("history")]);
  }
  async function runStorageAction(action) {
    if (action === "metadata" || action === "images" || action === "temporary") {
      await clearAppCaches(action); render(); toast("Temporary cache cleared."); return;
    }
    if (action === "logcat") {
      await clearLogcat(); render(); toast("Logs cleared."); return;
    }
    if (action === "library-history") {
      await clearLibraryHistory(); render(); toast("History cleared."); return;
    }
    if (action === "clear-data") {
      if (!(await appConfirm("Clear all tracked movies, series and activity history from this device?", { title: "Clear tracked data", confirmLabel: "Clear", danger: true }))) return;
      items = []; itemIndexItems = null; history = []; persist(); render(); toast("Tracked data cleared."); return;
    }
    if (action === "factory-reset") {
      if (!(await appConfirm("Factory reset ScreenMark? This removes your library, settings, and app cache from this device.", { title: "Factory reset", confirmLabel: "Reset", danger: true }))) return;
      await clearAppCaches("temporary");
      localStorage.removeItem(`${storageKey}_log`); rowStore("log", 200).rows = [];
      try { await window.Capacitor?.Plugins?.EncryptedStore?.clearState?.(); } catch (_) {}
      items = []; itemIndexItems = null; history = [];
      Object.keys(prefs).forEach(key => delete prefs[key]);
      Object.assign(prefs, JSON.parse(JSON.stringify(prefsDefaults)));
      prefs.navIcons = { ...prefsDefaults.navIcons };
      prefs.navBar = { order: [...navKeys], visible: { ...prefsDefaults.navBar.visible } };
      prefs.apiKeys = {}; prefs.sourceOptions = {};
      refreshSourceRegistry();
      persist(); applyPreferences(); render(); toast("ScreenMark has been reset.");
    }
  }
  function openItem(item = null) {
    if (page !== "add") addReturnPage = page;
    entryDraftId = item?.id || null;
    addMetadataQuery = item?.title || "";
    addMetadataRequestId++;
    addCategory = item?.category || (preferredCategory !== "all" ? preferredCategory : config.categories[0].key);
    goto("add");
    setTimeout(() => $("#item-form")?.elements.title.focus(), 50);
  }
  function readAddImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result || "");
      const field = $("#item-form")?.elements.image;
      const preview = $("[data-add-image-preview]");
      if (field) field.value = image;
      if (preview) { preview.src = image; preview.hidden = false; }
      const placeholder = $("[data-add-image-placeholder]"); if (placeholder) placeholder.hidden = true;
    };
    reader.readAsDataURL(file);
  }
  async function searchAddMetadata() {
    addMetadataQuery = $("#add-metadata-query")?.value ?? addMetadataQuery;
    const query = addMetadataQuery.trim();
    const requestId = ++addMetadataRequestId;
    const message = $("#add-metadata-message"), box = $("#add-metadata-results");
    if (!query) { message.textContent = "Enter a title to search."; return; }
    if (prefs.metadataMode === "offline" || !navigator.onLine) { message.textContent = prefs.metadataMode === "offline" ? "Online metadata is disabled in Settings." : "Reconnect to search metadata sources."; return; }
    message.textContent = "Searching enabled sources…"; box.innerHTML = ""; box.hidden = false;
    try {
      const results = await discoverSearch(query, $("#item-form")?.elements.category.value || config.categories[0].key);
      if (requestId !== addMetadataRequestId || page !== "add") return;
      const currentBox = $("#add-metadata-results"), currentMessage = $("#add-metadata-message");
      if (!currentBox || !currentMessage) return;
      currentBox._results = results;
      currentBox.innerHTML = results.slice(0, 16).map((result, index) => `<article class="add-metadata-result">${result.image ? `<img src="${esc(result.image)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">` : ""}<div><strong>${esc(result.title)}</strong><small>${esc(result.source)}${result.year ? ` · ${esc(result.year)}` : ""}${result.subtitle ? ` · ${esc(result.subtitle)}` : ""}</small><p>${esc(result.description || "")}</p></div><button class="button secondary small" type="button" data-add-metadata-index="${index}">Use</button></article>`).join("");
      currentMessage.textContent = results.length ? `${results.length} matches found${results.warnings?.length ? `; ${results.warnings.length} source(s) unavailable` : ""}.` : "No matches found.";
    } catch (error) {
      if (requestId !== addMetadataRequestId || page !== "add") return;
      const currentMessage = $("#add-metadata-message");
      if (currentMessage) currentMessage.textContent = `Could not search metadata: ${error.message || "Please try again."}`;
    }
  }
  async function selectAddMetadata(index) {
    const box = $("#add-metadata-results"), result = box?._results?.[Number(index)], form = $("#item-form");
    if (!result || !form) return;
    form.elements.title.value = result.title || form.elements.title.value;
    form.elements.metadataSource.value = result.source || "";
    form.elements.providerId.value = result.providerId || "";
    form.elements.url.value = result.url || "";
    form.elements.year.value = result.year || "";
    form.elements.description.value = result.description || "";
    const hasLocalImage = /^data:image\//i.test(form.elements.image.value);
    if (!hasLocalImage && result.image) form.elements.image.value = result.image;
    const preview = $("[data-add-image-preview]");
    if (preview && result.image && !hasLocalImage) { preview.src = result.image; preview.hidden = false; }
    const message = $("#add-metadata-message");
    // The match is applied: collapse the result list (searching again reopens it).
    box.innerHTML = ""; box._results = null; box.hidden = true;
    const queryInput = $("#add-metadata-query"); if (queryInput) queryInput.value = result.title || queryInput.value;
    
    message.textContent = `Selected ${result.source} · ${result.title}. Loading available details…`;
    if (!result.providerId || !window.SplitAppDetails?.load) { message.textContent = `Selected ${result.source} · ${result.title}`; return; }
    try {
      const details = await window.SplitAppDetails.load({ ...result, category: form.elements.category.value, metadataSource: result.source }, detailSettings());
      if (!$("#item-form") || $("#item-form") !== form) return;
      if (!form.elements.description.value.trim() && details.description) form.elements.description.value = details.description;
      form.elements.year.value = details.year || form.elements.year.value;
      form.elements.url.value = details.url || result.url || form.elements.url.value;
      const fills = form.elements.category.value === "movie" ? Number(details.facts?.runtimeMinutes) || 0 : Number(details.goal) || Number(details.facts?.episodeCount) || 0;
      if (fills && !Number(form.elements.goal.value)) form.elements.goal.value = String(fills);
      const detailImage = details.portraitImage || details.image || "";
      if (!hasLocalImage && detailImage) {
        form.elements.image.value = detailImage;
        if (preview) { preview.src = detailImage; preview.hidden = false; }
      }
      message.textContent = `Selected ${result.source} · ${result.title}; details loaded.`;
    } catch (_) {
      message.textContent = `Selected ${result.source} · ${result.title}; basic match details are ready.`;
    }
  }
  // Switching Movie <-> TV series changes the progress/goal wording and the stepper sizes.
  function applyAddCategory(key) {
    const cat = category(key), form = $("#item-form"); if (!form || !cat) return;
    form.elements.category.value = cat.key; addCategory = cat.key;
    $$("[data-add-category]").forEach(button => { const on = button.dataset.addCategory === cat.key; button.classList.toggle("active", on); button.setAttribute("aria-pressed", String(on)); });
    const label = $("#progress-label"), goalLabel = $("#goal-label");
    if (label) label.firstChild.textContent = cat.progressLabel; if (goalLabel) goalLabel.firstChild.textContent = cat.goalLabel;
    $$('[data-step-input="progress"]').forEach((button, index) => { button.dataset.step = String((index ? 1 : -1) * cat.step); });
    $$('[data-step-input="goal"]').forEach((button, index) => { button.dataset.step = String((index ? 1 : -1) * cat.goalStep); });
    const results = $("#add-metadata-results"); if (results) { results.innerHTML = ""; results._results = []; }
  }

  function saveItem(event) {
    const form = event.currentTarget; const data = new FormData(form); const id = data.get("id");
    const old = id ? itemById(id) : null; const key = data.get("category") || old?.category || config.categories[0]?.key;
    const image = String(data.get("image") || "");
    const entry = { ...old, id: id || crypto.randomUUID(), title: String(data.get("title")).trim(), category: key, status: data.get("status") || defaultStatus(key), progress: Math.max(0, Number(data.get("progress")) || 0), goal: Math.max(0, Number(data.get("goal")) || 0), image, ...(image.startsWith("data:image/") ? { localThumbnailData: image } : {}), description: String(data.get("description") || "").trim(), metadataSource: String(data.get("metadataSource") || ""), providerId: String(data.get("providerId") || ""), url: String(data.get("url") || ""), year: String(data.get("year") || ""), createdAt: old?.createdAt || Date.now(), updatedAt: old?.updatedAt || Date.now() };
    if (key === "movie" && [roles.active, roles.hold].includes(entry.status)) entry.status = roles.queued;
    if (key === "series") {
      const progress = Math.max(entry.progress, (entry.watchedEpisodeIds || []).length);
      if (!progress && entry.status !== roles.done) entry.status = roles.queued;
      else if (progress && entry.status === roles.queued) entry.status = roles.active;
      if (progress && (!old || Number(old.progress) !== entry.progress)) entry.lastProgressAt = Date.now();
    }
    stripLocalScores(entry);
    if (!entry.title) return;
    const changed = !old || ["title", "category", "status", "progress", "goal", "image", "description", "metadataSource", "providerId", "url", "year"].some(field => !Object.is(old[field], entry[field]));
    if (old && !changed) { entryDraftId = null; goto(addReturnPage); toast("No changes to save."); return; }
    if (old) entry.updatedAt = Date.now();
    if (old) { const oldIndex = itemIndex.get(String(old.id)); if (oldIndex !== undefined) items[oldIndex] = entry; }
    else { items.unshift(entry); itemIndexItems = null; recordLibraryChange("added", `Added ${entry.title}.`, [entry.id]); }
    if (old && changed) recordLibraryChange("edited", `Updated ${entry.title}.`, [entry.id]);
    if (entry.status !== roles.queued && entry.status !== old?.status) history.unshift({ itemId: entry.id, title: entry.title, action: entry.status, status: entry.status, at: Date.now() });
    persist({ ids: [entry.id] }); entryDraftId = null;
    if (!old && entry.category === "series" && entry.metadataSource) openAddedSeriesDetails(entry, addReturnPage);
    else goto(addReturnPage);
    toast(old ? "Entry updated." : "Added to your library.");
  }
  function openAddedSeriesDetails(item, returnPage = "dashboard") {
    if (!item?.id) return;
    clearDetailStack(); detailReturnPage = returnPage || "dashboard"; detailTab = "episodes"; detailItemId = item.id;
    detailPreview = null; detailEditMode = false; detailData = null; detailError = "";
    goto("details"); loadDetails();
  }
  function saveAddForm(form) {
    if (!form?.isConnected || !form.reportValidity()) return;
    saveItem({ currentTarget: form });
  }
  async function updateProgress(id) {
    const item = itemById(id); if (!item) return;
    const step = Math.max(1, Number(category(item.category)?.step) || 1), stepped = stepEpisodes(item, step);
    if (!stepped) item.progress = (Number(item.progress) || 0) + step;
    else if (!stepped.changed) { toast("No released episodes are available to mark yet."); return; }
    item.updatedAt = Date.now();
    const previousStatus = item.status;
    if (item.category === "series" && step > 0) { item.lastProgressAt = item.updatedAt; item.status = roles.active; }
    if (item.category === "series") finishSeriesIfComplete(item, window.SplitAppLibrary.episodeInfo(item));
    if (item.category !== "series" && item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic") item.status = roles.done;
    if (item.category !== "series" && item.goal && item.progress >= item.goal && prefs.automaticCompletion === "ask" && await appConfirm(`Mark “${item.title}” completed?`, { title: "Completed?", confirmLabel: "Mark completed" })) item.status = roles.done;
    if (item.status !== previousStatus && trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    persist({ ids: [item.id] }); render(); toast(stepped?.skippedUpcoming ? `Progress updated; skipped ${stepped.skippedUpcoming} upcoming ${stepped.skippedUpcoming === 1 ? "episode" : "episodes"}.` : "Progress updated.");
  }
  async function deleteItem(id) {
    const item = itemById(id); if (!item) return;
    if (!(await appConfirm(`Delete “${item.title}” from your library?`, { title: "Delete title", confirmLabel: "Delete", danger: true }))) return;
    if (prefs.backupBeforeDestructive) exportList({ silent: true });
    moveToTrash(item);
    recordLibraryChange("removed", `Deleted ${item.title}.`, [id]); items = items.filter(entry => entry.id !== id); itemIndexItems = null;
    persist({ removed: [id] }); entryDraftId = null; goto(addReturnPage); toast("Entry deleted.");
  }
  // ⋮ → Edit entry opens the title's details page in edit mode (same as its Edit button).
  function openEdit(id) { if (itemById(id)) openDetails(id, true); }
  function saveDetailEdit(event) {
    event.preventDefault();
    const item = itemById(detailItemId);
    if (!item) return;
    const data = new FormData(event.currentTarget);
    const oldStatus = item.status;
    item.title = String(data.get("title") || "").trim();
    item.status = String(data.get("status") || item.status);
    item.progress = Math.max(0, Number(data.get("progress")) || 0);
    item.whereToWatchUrl = String(data.get("whereToWatchUrl") || "").trim();
    if (item.category === "series" && window.SplitAppLibrary.episodeInfo(item)) { const wanted = item.progress, info = window.SplitAppLibrary.episodeInfo(item); stepEpisodes(item, wanted - info.done); }
    item.goal = Math.max(0, Number(data.get("goal")) || 0);
    item.updatedAt = Date.now();
    if (oldStatus !== item.status && trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    detailEditMode = false;
    persist({ ids: [item.id] }); render(); toast("Entry updated.");
  }

  let discoverSubmitted = "", discoverSubmittedAt = 0;
  function discoverRequestKey() {
    return `${discoverQuery.trim().toLocaleLowerCase()}\u0000${currentDiscoverCategory()}\u0000${discoverSource}`;
  }
  function submitDiscover() {
    discoverQuery = $("#discover-query")?.value ?? discoverQuery;
    const requestKey = discoverRequestKey();
    // Some Android keyboards emit both Enter and the search action for one submission.
    if (requestKey === discoverSubmitted && Date.now() - discoverSubmittedAt < 500) return;
    discoverSubmitted = requestKey; discoverSubmittedAt = Date.now();
    discover();
  }
  // Discover and Explore search one type at a time; a single source only offers the types it supports.
  function currentDiscoverCategory() {
    const source = discoverSource ? window.SplitAppSources.list().find(row => row.key === discoverSource) : null;
    const allowed = source ? source.categories : config.categories.map(row => row.key);
    const preferred = discoverCategoryChoice || (preferredCategory !== "all" ? preferredCategory : "series");
    return allowed.includes(preferred) ? preferred : allowed.includes("series") ? "series" : allowed[0];
  }

  function paintDiscoverResults(results, sourceKey) {
    const sourceName = window.SplitAppSources.list().find(source => source.key === sourceKey)?.name;
    const currentMessage = $("#discover-message"), box = $("#discover-results"), empty = $("#discover-empty");
    if (!currentMessage || !box || !empty) return false;
    box.setAttribute("aria-busy", "false");
    currentMessage.textContent = results.length ? (results.warnings?.length ? `${results.warnings.length} source(s) did not respond: ${results.warnings.join("; ")}` : "") : `No results found${sourceName ? ` from ${sourceName}` : ""}.`;
    const visible = results.slice(0, 48);
    const sourceRows = window.SplitAppSources.list();
    const sourceOf = row => row.source || row.metadataSource || "";
    const shelves = sourceKey ? [{ key: sourceKey, name: sourceName || sourceKey, items: visible }] : sourceRows.map(source => ({ key: source.key, name: source.name, items: visible.filter(row => sourceOf(row) === source.key || source.key === "tmdb" && sourceOf(row) === "themoviedb") })).filter(shelf => shelf.items.length);
    box.innerHTML = sourceKey
      ? `<section class="discover-all-results"><header><h2>${esc(sourceName || sourceKey)}</h2><span>${visible.length} results</span></header><div class="discover-all-results-grid">${visible.map((row, index) => discoverCatalogCard(row, index)).join("")}</div></section>`
      : shelves.length ? `<div class="discover-catalog-sections discover-search-sections">${shelves.map(shelf => `<section class="discover-catalog-section discover-source-section"><header><h2>${esc(shelf.name)}</h2><a href="#discover?source=${encodeURIComponent(shelf.key)}" aria-label="View all ${esc(shelf.name)} results">View all <i data-lucide="arrow-up-right" aria-hidden="true"></i></a></header><div class="discover-catalog-grid">${shelf.items.slice(0, 8).map(row => discoverCatalogCard(row, visible.indexOf(row))).join("")}</div></section>`).join("")}</div>` : `<div class="discover-catalog-grid">${visible.map((row, index) => discoverCatalogCard(row, index)).join("")}</div>`;
    routeRemoteImages(box);
    empty.hidden = results.length > 0;
    box._results = visible;
    enrichCardBackdrops(box);
    window.lucide?.createIcons({ root: box, attrs: { "aria-hidden": "true" } });
    return true;
  }
  // Cards view wants landscape art. TVmaze only lists posters in search/schedule results, so fetch its
  // "background" image for the cards that are actually on screen (cached, spaced to respect its rate limit).
  const backdropCache = new Map(); let backdropQueue = Promise.resolve(), backdropObserver = null;
  async function tvmazeBackdrop(showId) {
    if (backdropCache.has(showId)) return backdropCache.get(showId);
    let url = "";
    try {
      const response = await fetch(`https://api.tvmaze.com/shows/${encodeURIComponent(showId)}/images`);
      if (response.ok) { const rows = await response.json(); const bg = (Array.isArray(rows) ? rows : []).find(row => row.type === "background"); url = bg?.resolutions?.original?.url || ""; }
    } catch (_) {}
    backdropCache.delete(showId);
    backdropCache.set(showId, url);
    while (backdropCache.size > 120) backdropCache.delete(backdropCache.keys().next().value);
    return url;
  }
  function enrichCardBackdrops(box = $("#discover-results")) {
    backdropObserver?.disconnect(); backdropObserver = null;
    if (!box || !window.IntersectionObserver) return;
    const cards = [...box.querySelectorAll(".discover-catalog-card:not(.has-backdrop)")].filter(card => card.querySelector("[data-discover-add]"));
    if (!cards.length) return;
    backdropObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting || document.body.dataset.discoverView !== "cards") return;
      const card = entry.target; backdropObserver?.unobserve(card);
      const result = box._results?.[Number(card.querySelector("[data-discover-add]")?.dataset.discoverAdd)];
      if (!result || result.source !== "tvmaze" || !result.providerId || result.backdrop) return;
      backdropQueue = backdropQueue.then(async () => {
        const url = await tvmazeBackdrop(result.providerId);
        if (!url || !card.isConnected) return;
        result.backdrop = url;
        const poster = card.querySelector(".discover-catalog-poster"); if (!poster) return;
        const img = document.createElement("img"); img.className = "discover-catalog-backdrop"; img.alt = ""; img.decoding = "async"; img.src = url;
        img.onerror = () => { img.remove(); card.classList.remove("has-backdrop"); };
        img.onload = () => card.classList.add("has-backdrop");
        poster.append(img);
        await new Promise(resolve => setTimeout(resolve, 150));
      });
    }), { rootMargin: "300px 0px" });
    cards.forEach(card => backdropObserver.observe(card));
  }
  // Library posters: shimmer placeholder until the thumbnail is ready, then the progress bar animates up to its value.
  let posterLoadingBound = false;
  const markPosterLoaded = img => img.closest?.(".profile-collection-grid .profile-poster")?.classList.add("is-loaded");
  function trackPosterLoading(root) {
    if (!posterLoadingBound) {
      posterLoadingBound = true;
      const handler = event => { if (event.target?.tagName === "IMG") markPosterLoaded(event.target); };
      document.addEventListener("load", handler, true); document.addEventListener("error", handler, true);
    }
    const posters = [...root.querySelectorAll(".profile-collection-grid .profile-poster")];
    posters.forEach(poster => {
      const img = poster.querySelector("img");
      // No picture to wait for (placeholder shown, nothing deferred) or already decoded: show the progress bar now.
      const nothingToWaitFor = !img || (img.complete && img.naturalWidth > 0) || (img.hidden && !img.hasAttribute("data-deferred-image") && !img.getAttribute("src"));
      if (nothingToWaitFor) { requestAnimationFrame(() => poster.classList.add("is-loaded")); }
    });
    // Slow network or missing art: never leave a bar stuck at zero (this used to wait 4 s).
    setTimeout(() => posters.forEach(poster => { if (poster.isConnected) poster.classList.add("is-loaded"); }), 1500);
  }
  function discoverCatalogCard(result, index) {
    const category = result.category || currentDiscoverCategory();
    const saved = itemByTitleIdentity(titleIdentity({ ...result, category, metadataSource: result.metadataSource || result.source }));
    return window.SplitAppDiscoverCards.card(result, index, { category, saved });
  }
  function refreshDiscoverSavedActions() {
    const box = $("#discover-results"), results = box?._results || [];
    box?.querySelectorAll("[data-discover-add]").forEach(button => {
      const result = results[Number(button.dataset.discoverAdd)];
      if (!result || !itemByTitleIdentity(titleIdentity({ ...result, category: result.category || currentDiscoverCategory(), metadataSource: result.metadataSource || result.source }))) return;
      button.disabled = true; button.classList.add("is-saved"); button.innerHTML = '<span aria-hidden="true">✓</span>'; button.setAttribute("aria-label", "Already in library");
    });
  }
  function renderDiscoverCatalog(sections, box) {
    const yearOf = row => Number(String(row.year || "").match(/\b(?:19|20)\d{2}\b/)?.[0]) || 0;
    const titleKey = value => String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim().replace(/[.,!?\-'"(){}:;–—]/g, "").replace(/\[|\]/g, "");
    const keyOf = row => `${row?.category || currentDiscoverCategory()}:${titleKey(row?.title)}:${yearOf(row) || "undated"}`;
    const unique = new Map();
    (sections || []).forEach(section => (section.items || []).forEach(result => {
      if (!result?.title || !(result.image || "").trim()) return;
      const key = keyOf(result);
      if (!unique.has(key)) unique.set(key, result);
    }));
    const all = [...unique.values()];
    const shelves = [], assigned = new Set();
    const addShelf = (title, rows) => {
      const shelf = [], local = new Set();
      for (const candidate of rows) {
        const row = unique.get(keyOf(candidate));
        if (!row) continue;
        const key = keyOf(row);
        if (assigned.has(key) || local.has(key)) continue;
        local.add(key); assigned.add(key); shelf.push(row);
        if (shelf.length >= 12) break;
      }
      if (shelf.length) shelves.push({ title, items: shelf });
    };
    const trendItems = (sections || []).filter(section => /trending|popular|top movies/i.test(section.title || "")).flatMap(section => section.items || []);
    const latestItems = (sections || []).filter(section => /latest|streaming today|on tv today/i.test(section.title || "")).flatMap(section => section.items || []);
    addShelf("Latest", latestItems.length ? latestItems : [...all].sort((a, b) => yearOf(b) - yearOf(a)));
    addShelf("Trending", trendItems.length ? trendItems : [...all].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)));
    const genres = [
      ["Comedy", /\bcom(?:edy|edies)\b/i],
      ["Action", /\baction\b/i],
      ["Horror", /\bhorror\b/i],
      ["Romance", /\bromance\b/i],
      ["Slice of Life", /slice[ -]of[ -]life/i],
      ["Sci-Fi", /sci[ -]?fi|science fiction/i],
      ["Fantasy", /\bfantasy\b/i],
      ["Adventure", /\badventure\b/i]
    ];
    genres.forEach(([label, pattern]) => {
      const matches = all.filter(row => (Array.isArray(row.genres) ? row.genres : []).some(genre => pattern.test(String(genre))));
      addShelf(label, matches);
    });
    const genreShelves = new Set(["Comedy", "Action", "Horror", "Romance", "Slice of Life", "Sci-Fi", "Fantasy", "Adventure"]);
    const sourceNames = new Map((window.SplitAppSources?.list?.() || []).map(row => [row.key, row.name]));
    const multiSource = new Set(all.map(row => row.source).filter(Boolean)).size > 1;
    const shelfSources = shelf => { if (!multiSource) return ""; const names = [...new Set(shelf.items.map(row => sourceNames.get(row.source) || row.source).filter(Boolean))]; return names.length ? `<small class="discover-shelf-sources">${esc(names.join(" · "))}</small>` : ""; };
    box.innerHTML = shelves.length ? `<div class="discover-catalog-sections">${shelves.map(shelf => `<section class="discover-catalog-section${genreShelves.has(shelf.title) ? " discover-genre-shelf" : ""}"><h2>${esc(shelf.title)}${shelfSources(shelf)}</h2><div class="discover-catalog-grid">${shelf.items.map(row => discoverCatalogCard(row, all.indexOf(row))).join("")}</div></section>`).join("")}</div>` : `<p class="discover-catalog-empty">No titles match these filters.</p>`;
    routeRemoteImages(box);
    box._results = all;
    enrichCardBackdrops(box);
    return all.length;
  }
  // ---- Quick setup wizard ----
  const SETUP_DONE_KEY = `${storageKey}_setup_done`;
  const setupState = { mode: "", step: 0, query: "", rows: [], loading: false, error: "", selected: new Map(), picks: [new Map(), new Map(), new Map(), new Map()] };
  let setupStarted = false, setupRequest = 0, setupSearchTimer = 0; const setupTrending = {};
  const setupDone = () => { try { return localStorage.getItem(SETUP_DONE_KEY) === "1"; } catch (_) { return true; } };
  const markSetupDone = () => { try { localStorage.setItem(SETUP_DONE_KEY, "1"); } catch (_) {} };
  function beginSetup() {
    setupStarted = true; if (page !== "setup") setupState.mode = ""; setupState.step = 0; setupState.query = ""; setupState.picks.forEach(map => map.clear());
    setupState.selected = setupState.picks[0]; loadSetupRows();
  }
  async function loadSetupRows() {
    const request = ++setupRequest, step = window.SplitAppSetup.stepsFor(setupState)[setupState.step], query = setupState.query.trim();
    setupState.selected = setupState.picks[setupState.step];
    const setGrid = () => { const grid = $("#setup-grid"); if (grid && page === "setup") { grid.innerHTML = window.SplitAppSetup.grid(setupState, esc); routeRemoteImages(grid); window.lucide?.createIcons?.({ root: grid, attrs: { "aria-hidden": "true" } }); } };
    setupState.error = "";
    if (setupState.mode) {
      // Favorites picker: list what is already in the local library (no network).
      const needle = query.toLocaleLowerCase();
      setupState.rows = items.filter(item => item.category === step.category && !item.favorite && (!needle || String(item.title || "").toLocaleLowerCase().includes(needle)))
        .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
        .map(item => ({ source: "local", providerId: String(item.id), localId: String(item.id), title: item.title, year: item.year, image: item.customCover || item.localThumbnailData || item.localPortraitData || item.image || "" }));
      setupState.loading = false; setGrid(); return;
    }
    const withLibraryStatus = rows => window.SplitAppSetup.withLibraryStatus((rows || []).slice(0, 60), items, step.category);
    if (!query && setupTrending[step.category]) { setupState.rows = withLibraryStatus(setupTrending[step.category]); setupState.loading = false; setGrid(); return; }
    if (prefs.metadataMode === "offline") { setupState.rows = []; setupState.loading = false; setupState.error = "Quick setup needs an internet connection."; setGrid(); return; }
    if (query) setupState.rows = [];
    setupState.loading = true; setGrid();
    try {
      let rows, settings = detailSettings();
      if (query) {
        const sources = window.SplitAppSources.available(step.category, prefs).filter(source => !source.keyRequired || settings.apiKeys?.[source.key]?.trim());
        if (!sources.length) rows = await window.SplitAppDiscovery.search(query, step.category, settings);
        else {
          const sourceOrder = sources.map(source => source.key);
          rows = await window.SplitAppSetup.searchIncrementally(query, step.category, settings, sourceOrder,
            (searchQuery, categoryKey, searchSettings, sourceKey) => window.SplitAppDiscovery.searchSource(searchQuery, categoryKey, searchSettings, sourceKey),
            partialRows => {
            const partial = partialRows.filter(row => row.image);
            if (!partial.length) return;
            setupState.rows = withLibraryStatus(partial);
            setGrid();
          }, () => request === setupRequest);
          if (request !== setupRequest) return;
        }
      }
      else {
        const sections = await window.SplitAppDiscovery.trending(step.category, settings);
        const seen = new Set(); rows = sections.flatMap(section => section.items || []);
        rows = rows.filter(row => { const key = `${String(row.title).toLowerCase()}|${String(row.year || "").slice(0, 4)}`; return row.title && row.image && !seen.has(key) && seen.add(key); }).slice(0, 60);
        if (rows.length) setupTrending[step.category] = rows;
      }
      if (request !== setupRequest) return;
      setupState.rows = withLibraryStatus((rows || []).filter(row => row.image));
    } catch (error) {
      if (request !== setupRequest) return;
      setupState.rows = []; setupState.error = "Could not load titles. Check your connection and try again.";
    }
    setupState.loading = false; setGrid();
  }
  function applySetupPicks() {
    let added = 0;
    window.SplitAppSetup.stepsFor(setupState).forEach((step, index) => {
      setupState.picks[index].forEach(result => {
        if (step.status === "favorite") {
          if (result.localId) { const own = itemById(result.localId); if (own && !own.favorite) { own.favorite = true; own.updatedAt = Date.now(); persist({ ids: [own.id] }); added++; } return; }
          const before = items.length, item = addDiscoverResult(result, "Favorites", { status: roles.queued, quiet: true, favorite: true });
          if (items.length > before) added++;
          else if (item && !item.favorite) { item.favorite = true; item.updatedAt = Date.now(); persist({ ids: [item.id] }); added++; }
          return;
        }
        const status = step.status === "done" ? roles.done : roles.queued;
        const before = items.length;
        const item = addDiscoverResult(result, "Quick setup", { status, quiet: true });
        if (items.length > before) { if (status === roles.done) { completeQuickSetupProgress(item); persist({ ids: [item.id] }); } added++; }
        else if (item) {
          const resolvedStatus = window.SplitAppSetup.resolveStatus(item.status, status, roles.done);
          if (item.status !== resolvedStatus) item.status = resolvedStatus;
          if (resolvedStatus === roles.done) completeQuickSetupProgress(item);
          item.updatedAt = Date.now(); persist({ ids: [item.id] });
        }
      });
    });
    return added;
  }
  function completeQuickSetupProgress(item) {
    if (item.category === "movie") {
      const runtime = Number(item.goal) || Number(item.facts?.runtimeMinutes) || Number(item.facts?.totalMinutes) || Number(item.cachedDetails?.facts?.runtimeMinutes) || 0;
      if (runtime) { item.goal = runtime; item.progress = Math.max(Number(item.progress) || 0, runtime); }
      return;
    }
    if (item.category !== "series") return;
    const info = window.SplitAppLibrary.episodeInfo(item);
    if (!info) return;
    item.watchedEpisodeIds = [...new Set([...(item.watchedEpisodeIds || []).map(String), ...info.eps.map(episode => String(episode.id))])];
    item.progress = Math.max(Number(item.progress) || 0, info.total);
    item.goal = Math.max(Number(item.goal) || 0, info.total);
  }
  const favoritesSetupSkipped = new Set();
  // Empty favorites page: offer the quick-setup style picker first (skippable).
  function favoritesNeedSetup(target) {
    if (target !== "series-favorites" && target !== "movie-favorites") return false;
    if (favoritesSetupSkipped.has(target) || !libraryRestoreComplete) return false;
    const category = target === "movie-favorites" ? "movie" : "series";
    return !items.some(item => item.category === category && item.favorite);
  }
  function finishSetup(save = true) {
    // Invalidate provider responses and the debounce timer before leaving. A
    // delayed search must not mutate the next Quick Setup session.
    clearTimeout(setupSearchTimer); setupSearchTimer = 0; setupRequest++; setupState.loading = false;
    const mode = setupState.mode, target = mode === "favorites-movie" ? "movie-favorites" : "series-favorites";
    const added = save ? applySetupPicks() : 0;
    setupStarted = false; setupState.mode = "";
    if (mode) { if (added) { favoritesSetupSkipped.add(target); toast(`Added ${added} ${added === 1 ? "favorite" : "favorites"}.`); goto(target, true); } else goto("profile"); return; }
    markSetupDone();
    if (added) toast(`Added ${added} ${added === 1 ? "title" : "titles"} to your library.`);
    // A big pick list downloads for a while: show the progress and per-title status on the sync page.
    goto(added > 8 ? "sync" : "series-watchlist");
  }
  let suggestionsCache = null, suggestionsRequest = 0, suggestionsPendingKey = "", suggestionsAbortController = null;
  async function loadDiscoverSuggestions() {
    const sourceKey = discoverSource, category = currentDiscoverCategory();
    const cacheKey = `${sourceKey}|${category}|${new Date().toDateString()}`;
    const cachedSections = suggestionsCache?.key === cacheKey ? suggestionsCache.sections : null;
    const box = $("#discover-results"), empty = $("#discover-empty");
    if (!box) return;
    // render() can run repeatedly while the page is open. Reuse the active request
    // so each render does not start another full set of provider requests.
    if (prefs.metadataMode !== "offline" && !cachedSections && suggestionsPendingKey === cacheKey) {
      box.setAttribute("aria-busy", "true");
      if (empty) empty.hidden = true;
      if (!box.querySelector(".discover-catalog-loading")) box.innerHTML = window.SplitAppDiscoverCards.loading({ sections: [["Latest", 3], ["Trending", 3]] });
      return;
    }
    suggestionsAbortController?.abort();
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    suggestionsAbortController = controller;
    const requestId = ++suggestionsRequest;
    box.setAttribute("aria-busy", "true");
    if (prefs.metadataMode === "offline") {
      if (suggestionsAbortController === controller) suggestionsAbortController = null;
      box.innerHTML = "";
      box.setAttribute("aria-busy", "false");
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    let sections = cachedSections;
    if (!sections) {
      suggestionsPendingKey = cacheKey;
      box.innerHTML = window.SplitAppDiscoverCards.loading({ sections: [["Latest", 3], ["Trending", 3]] });
      try { sections = await window.SplitAppDiscovery.trending(category, { ...detailSettings(), ...(controller ? { signal: controller.signal } : {}) }, sourceKey); }
      catch (error) {
        if (suggestionsPendingKey === cacheKey) suggestionsPendingKey = "";
        if (suggestionsAbortController === controller) suggestionsAbortController = null;
        if (requestId !== suggestionsRequest || page !== "discover") return;
        const currentBox = $("#discover-results"), currentEmpty = $("#discover-empty"), currentMessage = $("#discover-message");
        currentBox?.setAttribute("aria-busy", "false");
        if (currentBox) currentBox.innerHTML = "";
        if (currentEmpty) currentEmpty.hidden = false;
        if (currentMessage && navigator.onLine) currentMessage.textContent = "Could not load suggestions right now.";
        return;
      }
      if (suggestionsPendingKey === cacheKey) suggestionsPendingKey = "";
      suggestionsCache = { key: cacheKey, sections };
    }
    if (suggestionsAbortController === controller) suggestionsAbortController = null;
    if (requestId !== suggestionsRequest || page !== "discover" || discoverQuery || $("#discover-query")?.value.trim()) return;
    const currentBox = $("#discover-results"), currentEmpty = $("#discover-empty");
    if (!currentBox) return;
    const count = renderDiscoverCatalog(sections, currentBox);
    currentBox.setAttribute("aria-busy", "false");
    if (currentEmpty) currentEmpty.hidden = count > 0;
  }
  async function discover() {
    const query = String(discoverQuery || "").trim(); const key = currentDiscoverCategory();
    discoverAbortController?.abort(); discoverAbortController = null;
    if (query) { suggestionsAbortController?.abort(); suggestionsAbortController = null; suggestionsPendingKey = ""; suggestionsRequest++; }
    const requestId = ++discoverRequestId; const sourceKey = discoverSource;
    const message = $("#discover-message");
    if (!query) { message.textContent = ""; const box = $("#discover-results"); if (box) box.setAttribute("aria-busy", "false"); loadDiscoverSuggestions(); return; }
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    discoverAbortController = controller;
    const initialEmpty = $("#discover-empty"); if (initialEmpty?.isConnected) initialEmpty.hidden = true;
    const initialBox = $("#discover-results");
    if (prefs.metadataMode === "offline") { message.textContent = "Online metadata is disabled in Settings."; initialBox?.setAttribute("aria-busy", "false"); return; }
    if (!navigator.onLine) { message.textContent = "You are offline. Reconnect and try again."; initialBox?.setAttribute("aria-busy", "false"); return; }
    if (message?.isConnected) message.textContent = "Searching connected sources…";
    if (initialBox?.isConnected) {
      initialBox.setAttribute("aria-busy", "true");
      // Same shape as the results that replace it: a single source gets one grid, all sources get one shelf per source.
      const sourceList = window.SplitAppSources.list(), usable = row => window.SplitAppSources.isEnabled(row.key, prefs) && !(row.keyRequired && !prefs.apiKeys?.[row.key]?.trim());
      const searchSourceName = sourceKey ? sourceList.find(row => row.key === sourceKey)?.name || sourceKey : "";
      const shelfNames = sourceList.filter(row => usable(row) && row.categories.includes(key)).slice(0, 3).map(row => row.name);
      initialBox.innerHTML = window.SplitAppDiscoverCards.loading(searchSourceName ? { searchSource: searchSourceName } : { searchShelves: shelfNames.length ? shelfNames : ["Results"] });
    }
    try {
      const results = sourceKey ? await exploreSourceSearch(query, sourceKey, controller?.signal) : await discoverSearch(query, key, controller?.signal);
      if (requestId !== discoverRequestId || page !== "discover" || discoverSource !== sourceKey) return;
      if (!paintDiscoverResults(results, sourceKey)) return;
      discoverCache = { source: sourceKey, query, results };
    } catch (error) {
      if (requestId !== discoverRequestId || page !== "discover" || discoverSource !== sourceKey) return;
      const sourceName = window.SplitAppSources.list().find(source => source.key === sourceKey)?.name;
      const status = Number(error?.status) || Number(/\b(\d{3})\b/.exec(error?.message || "")?.[1]);
      const providerMessage = status === 403
        ? `${sourceName || "The metadata source"} denied this request (HTTP 403). If the provider showed a consent prompt, review it there and retry; otherwise try another source or try again later.`
        : error?.message || "Please try again.";
      const currentMessage = $("#discover-message"); if (currentMessage) currentMessage.textContent = `Could not search${sourceName ? ` ${sourceName}` : " sources"}: ${providerMessage}`;
      const resultsBox = $("#discover-results"); resultsBox?.setAttribute("aria-busy", "false"); if (resultsBox) resultsBox.innerHTML = "";
      recordLog("warning", `Discover search failed${sourceName ? ` for ${sourceName}` : ""}: ${providerMessage}`);
    } finally {
      if (discoverAbortController === controller) discoverAbortController = null;
    }
  }
  async function discoverSearch(query, key, signal) {
    if (!window.SplitAppDiscovery) throw new Error("This app's discovery backend did not load.");
    return window.SplitAppDiscovery.search(query, key, {
      metadataSources: prefs.metadataSources, metadataSourceOrder: prefs.metadataSourceOrder, apiKeys: prefs.apiKeys, sourceOptions: prefs.sourceOptions,
      offlineFallback: prefs.offlineFallback, metadataRefreshInterval: prefs.metadataRefreshInterval, ...(signal ? { signal } : {})
    });
  }
  async function exploreSourceSearch(query, sourceKey, signal) {
    if (!window.SplitAppDiscovery?.searchSource) throw new Error("The metadata search service did not load.");
    return window.SplitAppDiscovery.searchSource(query, currentDiscoverCategory(), {
      metadataSources: prefs.metadataSources, metadataSourceOrder: prefs.metadataSourceOrder, apiKeys: prefs.apiKeys, sourceOptions: prefs.sourceOptions,
      offlineFallback: prefs.offlineFallback, metadataRefreshInterval: prefs.metadataRefreshInterval, ...(signal ? { signal } : {})
    }, sourceKey);
  }
  function syncBackupSchedule() {
    const plugin = window.Capacitor?.Plugins?.BackupScheduler;
    if (!plugin) return;
    if (prefs.backgroundBackups && prefs.backupSchedule === "daily") plugin.schedule?.({ retention: Number(prefs.backupRetention) || 10 }).catch(() => toast("Could not schedule encrypted backups."));
    else plugin.cancel?.().catch(() => {});
  }
  const titleIdentity = item => {
    const normalize = value => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const year = String(item?.year || item?.releaseDate || "").match(/(?:19|20)\d{2}/)?.[0] || "";
    return [item?.category || "", item?.metadataSource || item?.source || "manual", normalize(item?.title), year].join("\u0000");
  };
  const pendingLibraryItemWrites = new Map();
  function saveLibraryItemToIDB(item) {
    const save = window.SplitAppBackend?.saveLibraryItemToIDB;
    if (typeof save === "function") return Promise.resolve(save.call(window.SplitAppBackend, item, { history, preferences: prefs }));
    return persist({ ids: [item.id] });
  }
  function addDiscoverResult(result, origin = "Discover", options = {}) {
    if (!result) return null;
    const existing = (result.source && result.providerId ? itemByProvider(result.source, result.category, result.providerId) : null) || itemByTitleIdentity(titleIdentity({ ...result, metadataSource: result.metadataSource || result.source }));
    if (existing) {
      if (!options.quiet) toast("That entry is already in your library."); return existing;
    }
    const item = stripLocalScores({ ...result, metadataSource: result.source, id: crypto.randomUUID(), status: options.status || ((category(result.category)?.statuses || []).includes(prefs.defaultStatus) && [roles.queued, roles.done].includes(prefs.defaultStatus) ? prefs.defaultStatus : defaultStatus(result.category)), ...(options.favorite ? { favorite: true } : {}), progress: 0, createdAt: Date.now(), updatedAt: Date.now() });
    items.unshift(item); itemIndexItems = null; recordLibraryChange("added", `Added ${item.title} from ${origin}.`, [item.id]); if (trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    // Queue immediately so progress is visible. Save the row directly first;
    // the debounced app save can be delayed behind native snapshots of a large
    // library and must not gate metadata/episode hydration.
    const initialWrite = saveLibraryItemToIDB(item);
    pendingLibraryItemWrites.set(String(item.id), initialWrite);
    initialWrite.then(() => { if (pendingLibraryItemWrites.get(String(item.id)) === initialWrite) persist({ meta: true }); }, () => {
      if (pendingLibraryItemWrites.get(String(item.id)) === initialWrite) pendingLibraryItemWrites.delete(String(item.id));
    });
    hydrateSavedItem(item);
    if (!options.quiet) toast("Added to your library."); return item;
  }
  // Keep the best value per fact across providers (a later source never blanks out earlier data).
  function mergeFacts(previous = {}, next = {}) {
    const merged = { ...previous };
    for (const [key, value] of Object.entries(next || {})) {
      const empty = value === "" || value == null || value === 0 || (Array.isArray(value) && !value.length);
      if (!empty || merged[key] == null) merged[key] = value;
    }
    return merged;
  }
  // What changed on the last refresh of each saved title (not persisted): field names, used for the "Updated" note.
  const metadataChanges = new Map();
  const stableJson = value => JSON.stringify(value, (key, entry) => key === "fetchedAt" || key === "localImageData" ? undefined : entry);
  const comparableArtworkUrl = value => {
    try {
      const url = new URL(String(value || ""));
      url.hash = ""; url.search = "";
      if (url.hostname === "image.tmdb.org") url.pathname = url.pathname.replace(/\/t\/p\/(?:original|w\d+)\//, "/t/p/{size}/");
      return url.href;
    } catch (_) { return String(value || ""); }
  };
  const episodeThumbCacheKey = (item, episode) => `${window.SplitAppBackend?.key || "screenmark"}:episode:${String(item.id)}:${String(episode.id)}`;
  async function hydrateEpisodeThumbnailCache(item) {
    const api = window.SplitAppIDB;
    if (!item?.cachedDetails || !api?.getThumbs) return 0;
    const seriesArtwork = new Set([item.image, item.customCover, item.backdrop, item.cachedDetails.image, item.cachedDetails.portraitImage, item.cachedDetails.landscapeImage, item.cachedDetails.backgroundImage]
      .filter(value => /^https:\/\//i.test(String(value || ""))).map(comparableArtworkUrl));
    const rows = (item.cachedDetails.sections || []).filter(section => section?.kind === "episodes").flatMap(section => section.items || [])
      .filter(episode => episode?.id != null && /^https:\/\//i.test(String(episode.image || "")) && !seriesArtwork.has(comparableArtworkUrl(episode.image)));
    if (!rows.length) return 0;
    const episodeByCacheKey = new Map(rows.map(episode => [episodeThumbCacheKey(item, episode), episode]));
    const pairs = [...episodeByCacheKey].map(([key, episode]) => [key, String(episode.image)]);
    let blobs = [];
    try { blobs = await api.getThumbs(pairs); } catch (_) { return 0; }
    item.localImageData ||= {};
    let hydrated = 0;
    for (const [key, blob] of blobs) {
      const episode = episodeByCacheKey.get(key);
      if (!episode || !blob) continue;
      const cacheKey = `${key}|${String(episode.image)}`;
      const url = thumbUrlCache.get(cacheKey) || rememberThumbUrl(key, String(episode.image), URL.createObjectURL(blob));
      item.localImageData[`cachedDetails.episodesById.${String(episode.id)}.image`] = url;
      hydrated++;
    }
    return hydrated;
  }
  async function hydrateArtworkThumbnailCache(item) {
    const api = window.SplitAppIDB, getEntries = window.SplitAppBackend?.artworkCacheEntries;
    if (!item?.id || !api?.getThumbs || typeof getEntries !== "function") return 0;
    const entries = getEntries(item);
    if (!entries.length) return 0;
    let blobs = [];
    try { blobs = await api.getThumbs(entries.map(({ key, signature }) => [key, signature])); } catch (_) { return 0; }
    item.localImageData ||= {};
    let hydrated = 0;
    for (const [key, blob] of blobs) {
      const entry = entries.find(row => row.key === key);
      if (!entry || !blob) continue;
      const objectUrl = thumbUrlCache.get(`${key}|${entry.signature}`) || rememberThumbUrl(key, entry.signature, URL.createObjectURL(blob));
      if (key === thumbKeyOf(item)) { item.localThumbnailData = objectUrl; item.localPortraitData = objectUrl; }
      item.localImageData[`imageUrl:${entry.signature}`] = objectUrl;
      for (const path of entry.paths) item.localImageData[path.join(".")] = objectUrl;
      hydrated++;
    }
    return hydrated;
  }
  // Watchlist cards show each series' next episode still: restore the copies already saved on this device (the details page does the same).
  const watchlistThumbRequested = new Set();
  async function hydrateWatchlistEpisodeThumbs(root) {
    const api = window.SplitAppIDB;
    if (!api?.getThumbs) return;
    const jobs = [];
    $$(".watchlist-card[data-watchlist-root]", root).forEach(card => {
      const item = itemById(card.dataset.watchlistRoot);
      if (!item || item.category !== "series") return;
      const episode = window.SplitAppLibrary.episodeInfo(item)?.next, image = String(episode?.image || "");
      if (episode?.id == null || !/^https:\/\//i.test(image)) return;
      const path = `cachedDetails.episodesById.${String(episode.id)}.image`;
      const savedUrl = item.localImageData?.[path];
      if (savedUrl && localImageUrlAvailable(savedUrl)) return;
      if (savedUrl) delete item.localImageData[path];
      jobs.push({ item, path, image, key: episodeThumbCacheKey(item, episode) });
    });
    if (!jobs.length) return;
    let blobs = [];
    try { blobs = await api.getThumbs(jobs.map(job => [job.key, job.image])); } catch (_) { return; }
    let changed = 0;
    const found = new Set(blobs.filter(([, blob]) => blob).map(([key]) => key));
    // Not saved on this device yet: download it in the background; the card refreshes when it lands.
    jobs.filter(job => !found.has(job.key) && !watchlistThumbRequested.has(job.key)).forEach(job => { watchlistThumbRequested.add(job.key); queueEpisodeThumbnailCache(job.item); });
    for (const [key, blob] of blobs) {
      const job = jobs.find(row => row.key === key);
      if (!job || !blob) continue;
      const url = thumbUrlCache.get(`${key}|${job.image}`) || rememberThumbUrl(key, job.image, URL.createObjectURL(blob));
      (job.item.localImageData ||= {})[job.path] = url; changed++;
    }
    if (changed && page === "series-watchlist") render();
  }
  function queueArtworkThumbnailCache(item) {
    if (!item?.id) return;
    hydrateArtworkThumbnailCache(item).then(count => {
      if (count && page === "details" && !detailRef && String(detailItemId) === String(item.id)) render();
    }).catch(() => {});
    const cache = window.SplitAppBackend?.cacheArtwork;
    if (!navigator.onLine || typeof cache !== "function") return;
    Promise.resolve(cache.call(window.SplitAppBackend, item)).then(() => hydrateArtworkThumbnailCache(item)).then(count => {
      if (count && page === "details" && !detailRef && String(detailItemId) === String(item.id)) render();
    }).catch(() => {});
  }
  function queueEpisodeThumbnailCache(item) {
    if (!item?.cachedDetails) return;
    const cache = window.SplitAppBackend?.cacheEpisodeThumbnails;
    // Show images already saved on this device immediately, including while
    // offline; then fill any missing rows in the background when connected.
    hydrateEpisodeThumbnailCache(item).then(count => {
      if (count && ((page === "details" && !detailRef && String(detailItemId) === String(item.id)) || page === "series-watchlist")) render();
    }).catch(() => {});
    if (!navigator.onLine || typeof cache !== "function") return;
    Promise.resolve(cache.call(window.SplitAppBackend, item)).then(() => hydrateEpisodeThumbnailCache(item)).then(count => {
      if (count && ((page === "details" && !detailRef && String(detailItemId) === String(item.id)) || page === "series-watchlist")) render();
    }).catch(() => {});
  }
  function applyLoadedMetadata(item, loaded, { cacheDetails = true, replaceFacts = false, queueArtwork = true } = {}) {
    if (!item || !loaded || typeof loaded !== "object") throw new Error("Metadata source returned an invalid detail record.");
    const changes = [];
    let cachedDetails = loaded;
    if (cacheDetails && item.cachedDetails && !item.cachedDetails.compact && !replaceFacts) {
      const sections = [...(loaded.sections || [])];
      const sectionKey = section => `${section.kind || ""}:${String(section.title || "").replace(/\s*\(\d+\)\s*$/, "").trim().toLocaleLowerCase()}`;
      const available = new Set(sections.filter(section => (section.items || []).length).map(sectionKey));
      for (const section of item.cachedDetails.sections || []) {
        if (!(section.items || []).length || !["gallery", "carousel", "people"].includes(section.kind)) continue;
        const key = sectionKey(section);
        if (available.has(key)) continue;
        sections.push(section); available.add(key);
      }
      if (sections.length !== (loaded.sections || []).length) cachedDetails = { ...loaded, sections };
    }
    // Only write what actually changed; everything else keeps its stored value.
    if (cacheDetails) {
      const oldSections = new Map((item.cachedDetails?.sections || []).map(section => [`${section.kind}:${section.title}`, stableJson(section)]));
      (cachedDetails.sections || []).forEach(section => { if (oldSections.get(`${section.kind}:${section.title}`) !== stableJson(section)) changes.push(String(section.title || section.kind || "details").toLowerCase()); });
      if (!item.cachedDetails || stableJson(item.cachedDetails) !== stableJson(cachedDetails)) item.cachedDetails = cachedDetails;
      if (page === "details" && String(detailItemId) === String(item.id)) detailData = item.cachedDetails;
    }
    item.metadataFetchedAt = Number(loaded.fetchedAt || loaded.facts?.fetchedAt) || Date.now();
    const nextFacts = replaceFacts ? { ...(loaded.facts || {}) } : mergeFacts(item.facts, loaded.facts);
    const changedFacts = Object.keys(nextFacts).filter(key => key !== "fetchedAt" && stableJson(nextFacts[key]) !== stableJson((item.facts || {})[key]));
    if (changedFacts.length) { item.facts = nextFacts; changes.push(changedFacts.length === 1 ? changedFacts[0] : `${changedFacts.length} facts`); }
    delete item.relinkFresh;
    if (!Number(item.goal)) item.goal = category(item.category)?.unit === "minutes" ? Number(loaded.facts?.runtimeMinutes) || 0 : Number(loaded.goal) || Number(loaded.facts?.episodeCount) || 0;
    const set = (field, value, label) => { if (value && value !== item[field]) { item[field] = value; changes.push(label); } };
    set("description", loaded.description, "description");
    set("year", loaded.year, "year");
    set("image", item.customCover ? "" : (loaded.portraitImage || loaded.image), "poster");
    set("backdrop", loaded.landscapeImage || loaded.backgroundImage, "backdrop");
    if (changes.length) item.updatedAt = Date.now();
    const metadataKey = String(item.id);
    metadataChanges.delete(metadataKey);
    metadataChanges.set(metadataKey, [...new Set(changes)]);
    while (metadataChanges.size > 600) metadataChanges.delete(metadataChanges.keys().next().value);
    reconcileEpisodes(item);
    if (item.status === roles.done) completeQuickSetupProgress(item);
    if (queueArtwork && item.category === "series" && item.cachedDetails) queueEpisodeThumbnailCache(item);
    return item;
  }
  function readCustomSourceForm() {
    const form = $("#custom-source-form"); if (!form) return null;
    const get = name => String(form.elements[name]?.value || "").trim();
    const group = prefix => Object.fromEntries([...form.elements].filter(el => el.name?.startsWith(prefix)).map(el => [el.name.slice(prefix.length), String(el.value || "").trim()]).filter(([, value]) => value));
    return { id: get("sourceId") || crypto.randomUUID().slice(0, 8), name: get("name"), searchUrl: get("searchUrl"), apiKey: get("apiKey"), categories: get("categories").split(",").filter(Boolean), apiKeyHeader: get("apiKeyHeader"), resultsPath: get("resultsPath"), imageTemplate: get("imageTemplate"), suggestionsUrl: get("suggestionsUrl"), detailUrl: get("detailUrl"), detailRoot: get("detailRoot"), map: group("map."), detailMap: group("dmap.") };
  }
  function isSecureCustomEndpoint(value) {
    try {
      const url = new URL(String(value || ""));
      if (url.username || url.password) return false;
      if (url.protocol === "https:") return true;
      return !window.Capacitor?.isNativePlatform?.() && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    } catch { return false; }
  }
  function validateCustomSource(config) {
    if (!config?.name) return "Give the source a name.";
    if (!isSecureCustomEndpoint(config.searchUrl)) return "Use an HTTPS endpoint. HTTP is allowed only for localhost during web preview.";
    if (!/\{query\}/.test(config.searchUrl)) return "The search URL needs {query} where the search text goes.";
    if ([config.suggestionsUrl, config.detailUrl].some(value => value && !isSecureCustomEndpoint(value))) return "Suggestions and details endpoints must use HTTPS.";
    if (config.apiKeyHeader && (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,80}$/.test(config.apiKeyHeader) || /^(host|cookie|origin|referer|content-length|connection|transfer-encoding|proxy-.*|sec-.*)$/i.test(config.apiKeyHeader))) return "Choose a valid, non-restricted API-key header name.";
    if (!config.map.title) return "Say which field holds the title.";
    return "";
  }
  async function testCustomSourceForm() {
    const output = $("#custom-source-test-output"), config = readCustomSourceForm(), problem = validateCustomSource(config);
    if (problem) { output.textContent = problem; output.dataset.state = "error"; return; }
    output.textContent = "Testing…"; output.dataset.state = "";
    try {
      const results = await window.SplitAppDiscovery.testCustomSource(config, "zelda", detailSettings());
      output.dataset.state = results.length ? "ok" : "error";
      output.innerHTML = results.length ? `<strong>${results.length} result${results.length === 1 ? "" : "s"} found</strong>${results.slice(0, 4).map(row => `<div class="cs-test-row">${row.image ? `<img src="${esc(row.image)}" alt="" onerror="this.hidden=true">` : ""}<span>${esc(row.title)}<small>${esc(row.subtitle || row.year || "")}</small></span></div>`).join("")}` : "The request worked but no results matched. Check the results path and the title field.";
    } catch (error) { output.dataset.state = "error"; output.textContent = `Failed: ${error?.message || error}`; }
  }
  async function testMetadataSource(sourceKey, button) {
    const source = window.SplitAppSources.list().find(row => row.key === sourceKey);
    const output = $(`[data-source-test-output="${CSS.escape(sourceKey)}"]`);
    if (!source || !output) return;
    const key = prefs.apiKeys?.[sourceKey]?.trim();
    if (source.keyRequired && !key) { output.textContent = "Add the required API key before testing this source."; output.dataset.state = "error"; $(`[data-source-api-key="${CSS.escape(sourceKey)}"]`)?.focus(); return; }
    const category = source.categories.includes("series") ? "series" : source.categories[0] || "movie";
    const query = ["anilist", "jikan", "kitsu"].includes(sourceKey) ? "Naruto" : category === "series" ? "Breaking Bad" : "Inception";
    const label = button.textContent;
    button.disabled = true; button.textContent = "Testing…";
    output.textContent = `Searching ${source.name}…`; output.dataset.state = "";
    try {
      const metadataSources = { ...prefs.metadataSources, [sourceKey]: true };
      const results = await window.SplitAppDiscovery.searchSource(query, category, { ...detailSettings(), metadataSources, bypassSourceHealth: true }, sourceKey);
      output.dataset.state = "ok";
      if (results.some(row => row.via)) { output.textContent = `${source.name} cannot be reached directly from this network, so titles are loaded through ${results[0].via} instead (found ${results.length} for “${query}”).`; return; }
      output.textContent = results.length ? `Connection successful. Found ${results.length} ${results.length === 1 ? "match" : "matches"} for “${query}”.` : `The source responded successfully, but returned no matches for “${query}”.`;
    } catch (error) {
      output.dataset.state = "error";
      output.textContent = `Test failed: ${error?.message || error}`;
    } finally {
      button.disabled = false; button.textContent = label;
    }
  }
  function saveCustomSource(event) {
    event.preventDefault();
    const config = readCustomSourceForm(), problem = validateCustomSource(config);
    if (problem) { const output = $("#custom-source-test-output"); output.textContent = problem; output.dataset.state = "error"; return; }
    const list = [...(prefs.customSources || [])], index = list.findIndex(row => row.id === config.id);
    if (index >= 0) list[index] = config; else list.push(config);
    prefs.customSources = list; refreshSourceRegistry();
    prefs.metadataSources[`custom:${config.id}`] = prefs.metadataSources[`custom:${config.id}`] !== false;
    persist({ meta: true }); settingsParam = ""; settingsGroup = "metadata-sources"; goto("settings", false); window.history.replaceState({ page, settingsGroup }, "", "#settings/metadata-sources"); toast(index >= 0 ? "Custom source updated." : "Custom source added.");
  }
  async function deleteCustomSource() {
    const id = $("#custom-source-form")?.elements.sourceId.value; if (!id || !(await appConfirm("Delete this custom source?", { title: "Delete source", confirmLabel: "Delete", danger: true }))) return;
    prefs.customSources = (prefs.customSources || []).filter(row => row.id !== id);
    delete prefs.metadataSources[`custom:${id}`]; refreshSourceRegistry();
    persist({ meta: true }); settingsParam = ""; settingsGroup = "metadata-sources"; goto("settings", false); window.history.replaceState({ page, settingsGroup }, "", "#settings/metadata-sources"); toast("Custom source deleted.");
  }
  function detailSettings() { return { metadataSources: prefs.metadataSources, apiKeys: prefs.apiKeys, sourceOptions: prefs.sourceOptions, offlineFallback: prefs.offlineFallback }; }
  const DETAIL_REFRESH_MS = 24 * 60 * 60 * 1000;
  // Big libraries keep a compact copy of each title's details in memory (see backend/idb-store.js). The full stored copy is read back
  // when a title is opened and released again once other titles have been opened; a compact copy never overwrites the stored one.
  const hydratedDetails = new Map(); // id -> the full details object that was read back (insertion order = least recent first)
  async function hydrateDetails(item) {
    if (!item?.cachedDetails?.compact || !window.SplitAppIDB?.getDetails) return item;
    try {
      const full = await window.SplitAppIDB.getDetails(item.id);
      if (full && !full.compact && item.cachedDetails?.compact) {
        item.cachedDetails = full;
        hydratedDetails.delete(String(item.id)); hydratedDetails.set(String(item.id), full);
        releaseHydratedDetails();
      }
    } catch (_) {}
    return item;
  }
  function releaseHydratedDetails(keep = ({ auto: 2, low: 1, minimum: 0, off: 6 }[prefs.libraryMemory] ?? 2), force = false) {
    // Only an untouched read-back object is released (a changed copy is a different object), and never the open title.
    for (const [id, full] of [...hydratedDetails]) {
      if (hydratedDetails.size <= keep) break;
      if (!force && id === String(detailItemId)) continue;
      hydratedDetails.delete(id);
      const item = itemById(id);
      if (item && item.cachedDetails === full && window.SplitAppIDB?.compactDetails) item.cachedDetails = window.SplitAppIDB.compactDetails(full);
    }
  }
  async function loadDetails(targetId = null, force = false) {
    detailAbortController?.abort();
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    detailAbortController = controller;
    const item = detailPreview || itemById(String(targetId ?? detailItemId));
    if (item?.cachedDetails?.compact) await hydrateDetails(item);
    if (item?.cachedDetails) {
      // Restore device-cached episode artwork before checking network state.
      hydrateArtworkThumbnailCache(item).then(count => {
        if (count && page === "details" && !detailRef && String(detailItemId) === String(item.id)) render();
      }).catch(() => {});
      queueArtworkThumbnailCache(item);
    }
    if (item?.category === "series" && item.cachedDetails) {
      hydrateEpisodeThumbnailCache(item).then(count => {
        if (count && page === "details" && !detailRef && String(detailItemId) === String(item.id)) render();
      }).catch(() => {});
      queueEpisodeThumbnailCache(item);
    }
    const requestId = ++detailRequest, useCached = Boolean(item?.cachedDetails && prefs.offlineFallback !== "none");
    detailData = useCached ? item.cachedDetails : null; detailError = "";
    if (!item) { if (detailAbortController === controller) detailAbortController = null; detailLoading = false; render(); return; }
    if (!detailPreview && window.SplitAppBackend?.loadItemImages) {
      Promise.resolve().then(() => window.SplitAppBackend.loadItemImages(item)).then(localImageData => {
        if (requestId !== detailRequest || !localImageData || !Object.keys(localImageData).length) return;
        item.localImageData = { ...(item.localImageData || {}), ...localImageData };
        if (page === "details" && !detailRef && String(detailItemId) === String(item.id)) render();
      }).catch(() => {});
    }
    if (!item.metadataSource || !item.providerId) { if (detailAbortController === controller) detailAbortController = null; detailLoading = false; detailError = ""; render(); return; }
    const source = window.SplitAppSources.list().find(row => row.key === item.metadataSource);
    const sourceEnabled = source && window.SplitAppSources.isEnabled(source.key, prefs);
    if (prefs.metadataMode === "offline" || !navigator.onLine || !sourceEnabled) {
      detailLoading = false;
      if (detailAbortController === controller) detailAbortController = null;
      if (!useCached && prefs.offlineFallback !== "none") detailError = prefs.metadataMode === "offline" || !navigator.onLine
        ? "No saved metadata is available for this title yet. Connect and sync it once to make details available offline."
        : `${source?.name || "This metadata source"} is disabled and no saved details are available.`;
      render(); return;
    }
    // Saved titles refresh from their source at most once a day when opened; pull-to-refresh or Refresh forces it.
    if (!force && !detailPreview && useCached && !item.relinkFresh && item.fullDetailsAt && Date.now() - metadataStamp(item) < DETAIL_REFRESH_MS && ((item.cachedDetails.sections || []).length || Object.keys(item.cachedDetails.facts || {}).length)) {
      detailLoading = false; if (detailAbortController === controller) detailAbortController = null; render(); return;
    }
    detailLoading = true; render();
    try {
      const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), ...(controller ? { signal: controller.signal } : {}) });
      if (requestId === detailRequest) {
        detailData = loaded;
        if (detailPreview) { detailPreview.image ||= loaded.portraitImage || loaded.image || ""; detailPreview.year ||= loaded.year || ""; detailPreview.description ||= loaded.description || ""; detailPreview.title = loaded.title || detailPreview.title; }
        if (!detailPreview) {
          const hadCache = Boolean(item.cachedDetails);
          applyLoadedMetadata(item, loaded, { replaceFacts: Boolean(item.relinkFresh) });
          item.fullDetailsAt = Date.now();
          persist({ ids: [item.id] });
          const changes = metadataChanges.get(String(item.id));
          if (hadCache && changes?.length) toast(`Updated from ${item.metadataSource}: ${changes.slice(0, 4).join(", ")}${changes.length > 4 ? "…" : ""}.`);
        }
      }
    }
    catch (error) { if (requestId === detailRequest) { const message = error?.message || "Could not load source details."; detailError = useCached ? "" : message; recordLog(useCached ? "warning" : "error", `${item.metadataSource} detail request failed${useCached ? "; showing saved metadata" : `: ${message}`}`); } }
    finally {
      if (detailAbortController === controller) detailAbortController = null;
      if (requestId === detailRequest) { detailLoading = false; render(); if (page === "details") historyPush(true); }
    }
  }
  // In-app drill-down (cast, characters, staff, episodes, suggestions); each step keeps the page it came from for Back.
  const detailSnapshot = () => ({ detailPreview, detailItemId, detailData, detailError, detailLoading, detailEditMode, detailReturnPage, detailRef, detailRefOffset, refData, refError, scroll: window.scrollY });
  function pushDetailSnapshot() {
    detailStack.push(detailSnapshot());
    const limit = ({ auto: 10, low: 5, minimum: 2, off: 50 }[prefs.libraryMemory] || 10);
    while (detailStack.length > limit) detailStack.shift();
  }
  function clearDetailStack() { detailAbortController?.abort(); refAbortController?.abort(); detailAbortController = refAbortController = null; detailRequest++; detailTab = ""; detailSeason = ""; detailStack = []; detailRef = null; detailRefOffset = 0; refData = null; refError = ""; refLoading = false; refRequest++; }
  function openDetailRef(type, id, title, extra, replace = false) {
    if (!id) return;
    if (!replace) pushDetailSnapshot();
    if (type === "show") {
      const source = extra?.source || "tvmaze", showCategory = extra?.category || "series";
      const existing = itemByProvider(source, showCategory, id);
      detailAbortController?.abort(); refAbortController?.abort(); detailAbortController = refAbortController = null;
      detailRef = null; refData = null; detailEditMode = false; detailError = ""; detailData = null; detailRequest++; refRequest++;
      if (existing) { detailPreview = null; detailItemId = existing.id; }
      else { detailItemId = null; detailPreview = { id: `${source}:${id}`, title: title || (showCategory === "movie" ? "Movie" : "Series"), category: showCategory, source, metadataSource: source, providerId: String(id), status: defaultStatus(showCategory) }; }
      render(); scrollPageTop(); historyPush(replace); loadDetails(); return;
    }
    if (!replace) detailRefOffset = 0;
    detailRef = { type, id, title, extra }; refData = null; refError = ""; render(); scrollPageTop(); historyPush(replace); loadDetailRef();
  }
  async function loadDetailRef() {
    refAbortController?.abort();
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    refAbortController = controller;
    const ref = detailRef, requestId = ++refRequest;
    if (!ref) { if (refAbortController === controller) refAbortController = null; return; }
    refData = null; refError = "";
    refLoading = true; render();
    try {
      const parent = detailItemId ? itemById(detailItemId) : null;
      if (parent?.cachedDetails?.compact) await hydrateDetails(parent);
      const cachedEpisode = ref.type === "episode" && parent
        ? (parent.cachedDetails?.sections || []).filter(section => section.kind === "episodes").flatMap(section => section.items || []).find(row => String(row.id) === String(ref.id) || String(row.ref?.id) === String(ref.id))
        : null;
      const cachedMediaSections = cachedEpisode?.mediaSections || [];
      // A person/character id names the source that serves its page (e.g. imdb:nm…, tmdb:…, kitsu-person:…); only fall back to the parent title's source for plain ids.
      const idSource = ({ "jikan-person": "jikan", "jikan-character": "jikan", "kitsu-person": "kitsu", "kitsu-character": "kitsu", "anilist-staff": "anilist", "anilist-character": "anilist", "tmdb-character": "tmdb", "tmdb-episode": "tmdb", "imdb-episode": "imdb", "rt-celebrity": "rottentomatoes" })[String(ref.id || "").match(/^([a-z-]+):/i)?.[1]?.toLowerCase()] || String(ref.id || "").match(/^(tmdb|tvdb|imdb|anilist):/i)?.[1]?.toLowerCase() || "";
      const referenceSourceKey = idSource || parent?.metadataSource || ({ tenrai: "anilist" }[ref.extra?.source] || ref.extra?.source) || "tvmaze";
      const referenceSource = window.SplitAppSources.list().find(source => source.key === referenceSourceKey);
      const referenceSourceUnavailable = Boolean(referenceSource && (!window.SplitAppSources.isEnabled(referenceSource.key, prefs) || (referenceSource.keyRequired && !prefs.apiKeys?.[referenceSource.key]?.trim())));
      const localOnly = prefs.metadataMode === "offline" || !navigator.onLine || referenceSourceUnavailable;
      let loaded;
      if (cachedEpisode?.raw) {
        const raw = cachedEpisode.raw, na = value => value && value !== "N/A" ? value : "", people = (value, meta) => String(na(value) || "").split(/,\s*/).filter(Boolean).map(title => ({ title, meta, image: "" }));
        loaded = { type: "episode", source: "OMDb", title: na(raw.Title) || cachedEpisode.title, subtitle: `${parent.title} · S${cachedEpisode.season}E${cachedEpisode.number}`, image: na(raw.Poster) || cachedEpisode.image, description: na(raw.Plot) || cachedEpisode.description, url: raw.imdbID ? `https://www.imdb.com/title/${raw.imdbID}/` : "", facts: [["Aired", na(raw.Released) || cachedEpisode.airdate], ["Runtime", na(raw.Runtime) || (cachedEpisode.runtime ? `${cachedEpisode.runtime} min` : "")], ["Rating", na(raw.imdbRating) ? `★ ${raw.imdbRating}` : cachedEpisode.rating ? `★ ${cachedEpisode.rating}` : ""], ["Votes", na(raw.imdbVotes)], ["Rated", na(raw.Rated)]].filter(([, value]) => value), sections: [{ title: "Cast", kind: "people", items: people(raw.Actors, "Actor") }, { title: "Staff", kind: "people", items: [...people(raw.Director, "Director"), ...people(raw.Writer, "Writer")] }].filter(section => section.items.length), raw };
      } else if (localOnly && prefs.offlineFallback !== "none" && cachedEpisode) {
        loaded = { type: "episode", source: parent.metadataSource || "ScreenMark", title: cachedEpisode.title || ref.title || "Episode", subtitle: `${parent.title} · S${cachedEpisode.season}E${cachedEpisode.number}`, image: cachedEpisode.image || "", description: cachedEpisode.description || "", url: cachedEpisode.url || "", facts: [["Aired", cachedEpisode.airdate], ["Runtime", cachedEpisode.runtime ? `${cachedEpisode.runtime} min` : ""], ["Rating", cachedEpisode.rating ? `★ ${cachedEpisode.rating}` : ""], ["Season", cachedEpisode.season], ["Episode", cachedEpisode.number]].filter(([, value]) => value !== undefined && value !== ""), sections: cachedMediaSections };
      } else if (localOnly) {
        const sourceName = referenceSource?.name || "The metadata source";
        throw new Error(referenceSourceUnavailable ? `${sourceName} is disabled or needs its API key in Metadata Sources.` : prefs.offlineFallback === "none" ? "Offline metadata fallback is turned off." : ref.type === "person" || ref.type === "character" ? "Cast pages are only available while the metadata source is online." : "No saved details are available for this page. Open it online once to save it for offline use.");
      } else {
        loaded = await window.SplitAppDetails.loadRef(ref, { ...detailSettings(), ...(controller ? { signal: controller.signal } : {}) });
        if (ref.type === "episode" && cachedEpisode && parent && requestId === refRequest) {
          const fetchedMedia = (loaded.sections || []).filter(section => section.kind === "gallery" && (section.items || []).some(row => /^https:\/\//i.test(String(row.image || row.url || ""))));
          if (fetchedMedia.length) {
            cachedEpisode.mediaSections = fetchedMedia;
            persist({ ids: [parent.id] });
          } else if (cachedMediaSections.length) {
            loaded.sections = [...(loaded.sections || []).filter(section => section.kind !== "gallery"), ...cachedMediaSections];
          }
        }
      }
      if (requestId === refRequest) refData = loaded;
    }
    catch (error) { if (requestId === refRequest) refError = error?.message || "Could not load this page."; }
    finally {
      if (refAbortController === controller) refAbortController = null;
      if (requestId === refRequest) { refLoading = false; render(); scrollPageTop(); historyPush(true); }
    }
  }
  // Seasons after the first keep their episode rows inert in a <template> until opened.
  document.addEventListener("toggle", event => {
    const block = event.target;
    if (!block?.matches?.(".season-block") || !block.open) return;
    block.querySelector("template[data-lazy-season]")?.replaceWith(block.querySelector("template[data-lazy-season]").content);
  }, true);
  // Saving a title mirrors its full details (cast, episodes, images) into the app database right away, not only when its page is opened.
  const hydrating = new Set();
  // Cast & crew is never stored: it is fetched on demand (only while online) when the Cast & Crew tab opens.
  const castCache = new Map(); let castState = { key: "", loading: false, error: "" };
  const castKeyNow = () => { const entry = detailPreview || itemById(String(detailItemId)); return entry ? String(entry.id) : ""; };
  const isCastSection = section => section?.kind === "people" || /^(cast|characters|staff|crew|people|guest cast|guest crew)(?:\b|\s)/i.test(section?.title || "");
  async function loadDetailCast(retry = false) {
    const entry = detailPreview || itemById(String(detailItemId)), key = castKeyNow();
    if (!entry || !key || castCache.has(key) || (castState.loading && castState.key === key)) return;
    if (!retry && castState.key === key && castState.error) return;
    castState = { key, loading: true, error: "" };
    const panel = $("[data-cast-lazy]"); if (panel && retry) { panel.setAttribute("aria-busy", "true"); render(); }
    try {
      const loaded = await window.SplitAppDetails.load(entry, { ...detailSettings() });
      const people = (loaded.sections || []).filter(section => isCastSection(section) && (section.items || []).length);
      if (!people.length) throw new Error("This source has no cast & crew for this title.");
      castCache.delete(key);
      castCache.set(key, people);
      while (castCache.size > 24) castCache.delete(castCache.keys().next().value);
      castState = { key, loading: false, error: "" };
    } catch (error) { castState = { key, loading: false, error: error?.message || "Could not load cast & crew." }; }
    if (page === "details" && !detailRef && castKeyNow() === key) render();
  }
  // Added titles load full details (episodes, ratings, posters, backgrounds,
  // screenshots) two at a time so every title is complete without hammering the providers.
  const hydrateQueue = []; let hydrateActive = 0;
  // Progress of added titles and their episode artwork (shown on #sync).
  const setupDownloads = new Map();
  const cancelledDownloadIds = new Set();
  const DOWNLOADS_KEY = `${storageKey}_sync_downloads`;
  const DOWNLOADS_PAUSED_KEY = `${storageKey}_sync_downloads_paused`;
  let setupDownloadsPaused = localStorage.getItem(DOWNLOADS_PAUSED_KEY) === "true";
  let setupDownloadResumeWaiters = [];
  async function waitForDownloadResume() {
    while (setupDownloadsPaused) await new Promise(resolve => setupDownloadResumeWaiters.push(resolve));
  }
  function setSetupDownloadsPaused(paused) {
    setupDownloadsPaused = Boolean(paused);
    try { localStorage.setItem(DOWNLOADS_PAUSED_KEY, String(setupDownloadsPaused)); } catch (_) {}
    if (!setupDownloadsPaused) { const waiters = setupDownloadResumeWaiters; setupDownloadResumeWaiters = []; waiters.forEach(resolve => resolve()); pumpHydrateQueue(); }
    if (page === "sync") render();
    updateSyncOverlay();
  }
  function clearSetupDownloads() {
    setSetupDownloadsPaused(true);
    hydrateQueue.length = 0;
    for (const id of setupDownloads.keys()) cancelledDownloadIds.add(id);
    setupDownloads.clear();
    saveDownloads();
    if (page === "sync") render();
    updateSyncOverlay();
  }
  let downloadSaveTimer = 0;
  let syncOverlayDismissed = false;
  let syncOverlayTimer = 0;
  function setupDownloadProgress(rows = [...setupDownloads.values()]) {
    const done = rows.filter(row => row.status === "done").length;
    const failed = rows.filter(row => row.status === "failed").length;
    const remaining = rows.filter(row => row.status === "queued" || row.status === "running").length;
    const fraction = row => row.status === "done" || row.status === "failed" ? 1
      : row.status === "running" ? (Number(row.total) ? Math.min(0.99, (Number(row.completed) || 0) / Number(row.total)) : row.detailsComplete ? 0.5 : 0)
      : 0;
    const percent = rows.length ? Math.min(100, Math.round(rows.reduce((sum, row) => sum + fraction(row), 0) / rows.length * 100)) : 0;
    return { done, failed, remaining, percent };
  }
  function updateSyncOverlay() {
    const overlay = $("#sync-overlay"); if (!overlay) return;
    if (page === "sync") { overlay.hidden = true; return; }
    const rows = [...setupDownloads.values()];
    const active = rows.filter(row => ["queued", "running"].includes(row.status));
    const failed = rows.filter(row => row.status === "failed");
    const summary = setupDownloadProgress(rows);
    overlay.classList.toggle("has-failed", !active.length && failed.length > 0);
    overlay.classList.toggle("is-complete", !active.length && !failed.length && rows.length > 0 && rows.every(row => row.status === "done"));
    const running = active.find(row => row.status === "running") || active[0];
    const title = $("[data-sync-overlay-title]", overlay);
    const detail = $("[data-sync-overlay-detail]", overlay);
    const progress = $("[data-sync-overlay-progress]", overlay);
    const percentLabel = $("[data-sync-overlay-percent]", overlay);
    const retry = $("[data-sync-overlay-retry]", overlay);
    if (active.length) {
      clearTimeout(syncOverlayTimer);
      if (active.some(row => row.status === "queued" && row.at > Date.now() - 5000)) syncOverlayDismissed = false;
      const completed = summary.done;
      const epTotal = Number(running?.total) || 0, epDone = Number(running?.completed) || 0;
      const imageStage = running?.stage === "images";
      const percent = summary.percent;
      title.textContent = `Syncing ${completed + 1} of ${rows.length} titles`;
      detail.textContent = epTotal && imageStage
        ? `${running.title || "Title"} · S${running.season || "…"} · ${epDone}/${epTotal} images`
        : `${running?.title || "Preparing library sync"} · ${imageStage ? "Saving episode images" : running?.stage === "seasons" ? "Syncing seasons" : "Getting details"}`;
      progress.style.width = `${percent}%`;
      overlay.style.setProperty("--sync-progress", `${percent}%`);
      percentLabel.textContent = `${percent}%`;
      retry.hidden = true;
      overlay.hidden = syncOverlayDismissed;
    } else if (failed.length) {
      clearTimeout(syncOverlayTimer);
      title.textContent = `${failed.length} ${failed.length === 1 ? "title needs" : "titles need"} attention`;
      detail.textContent = `${failed[0].title || "Sync failed"} · ${failed[0].error || "Retry when online"}`;
      progress.style.width = `${summary.percent}%`;
      overlay.style.setProperty("--sync-progress", `${summary.percent}%`);
      percentLabel.textContent = `${summary.percent}%`;
      retry.hidden = false;
      overlay.hidden = syncOverlayDismissed;
    } else {
      retry.hidden = true;
      const needsArtworkSync = prefs.imageStorage === "all" && rows.some(row => {
        const item = itemById(row.id);
        return item?.category === "series" && item.cachedDetails && !item.cachedDetails.compact;
      });
      if (rows.length && rows.every(row => row.status === "done") && !needsArtworkSync && !syncOverlayDismissed) {
        title.textContent = "Library sync complete";
        detail.textContent = `${rows.length} ${rows.length === 1 ? "title" : "titles"} saved for offline use`;
        progress.style.width = `${summary.percent}%`;
        overlay.style.setProperty("--sync-progress", `${summary.percent}%`);
        percentLabel.textContent = "✓";
        overlay.hidden = false;
        if (!syncOverlayTimer) syncOverlayTimer = setTimeout(() => { syncOverlayTimer = 0; syncOverlayDismissed = true; overlay.hidden = true; }, 5000);
      } else overlay.hidden = true;
    }
  }
  document.addEventListener("click", event => {
    if (eventClosest(event, "[data-sync-overlay-dismiss]")) { syncOverlayDismissed = true; $("#sync-overlay").hidden = true; return; }
    if (eventClosest(event, "[data-sync-overlay-open]")) { goto("sync"); return; }
    const overlayRetry = eventClosest(event, "#sync-overlay [data-setup-download-retry]");
    if (overlayRetry) retryDownloadButton(overlayRetry);
  });
  // The list survives navigation and restarts (compact rows only), and unfinished rows resume on launch.
  function saveDownloads() {
    clearTimeout(downloadSaveTimer);
    downloadSaveTimer = setTimeout(() => { try { localStorage.setItem(DOWNLOADS_KEY, JSON.stringify([...setupDownloads.values()].slice(-400))); } catch (_) {} }, 400);
  }
  const markDownload = (item, status, error = "") => {
    if (cancelledDownloadIds.has(String(item?.id))) return;
    const row = setupDownloads.get(String(item.id)) || {};
    setupDownloads.set(String(item.id), { ...row, id: String(item.id), title: item.title, category: item.category, source: item.metadataSource, providerId: item.providerId, status, error, stage: status === "running" ? "details" : status === "done" ? "complete" : status, detailsComplete: status === "done" || row.detailsComplete || false, at: Date.now() });
    if (status === "queued") syncOverlayDismissed = false;
    saveDownloads(); updateSyncOverlay(); if (page === "sync") scheduleHydrateRender();
  };
  function restoreDownloads() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(DOWNLOADS_KEY) || "[]"); } catch (_) {}
    for (const row of Array.isArray(saved) ? saved : []) {
      const item = itemById(row?.id); if (!item) continue;
      const restored = { ...row, title: item.title };
      const unfinished = ["queued", "running"].includes(restored.status) && (!item.fullDetailsAt || (item.category === "series" && prefs.imageStorage === "all"));
      if (unfinished) { restored.status = "queued"; setupDownloadsPaused = true; }
      else if (row.status === "done" || item.fullDetailsAt) { restored.status = "done"; restored.error = ""; }
      setupDownloads.set(String(row.id), restored);
    }
    try { localStorage.setItem(DOWNLOADS_PAUSED_KEY, String(setupDownloadsPaused)); } catch (_) {}
    updateSyncOverlay();
    if (page === "sync") scheduleHydrateRender();
  }
  function resumeArtworkCaching() {
    if (setupDownloadsPaused || !navigator.onLine || prefs.imageStorage !== "all") return;
    const cachedGuides = items.filter(item => item.cachedDetails);
    if (!cachedGuides.length) return;
    let index = 0;
    const worker = async () => {
      while (index < cachedGuides.length && !setupDownloadsPaused) {
        const item = cachedGuides[index++];
        try {
          const currentDownload = setupDownloads.get(String(item.id));
          if (hydrating.has(String(item.id)) || ["queued", "running"].includes(currentDownload?.status)) continue;
          if (item.cachedDetails?.compact) await hydrateDetails(item);
          if (item.cachedDetails && !item.cachedDetails.compact && navigator.onLine) {
            const artworkEntries = window.SplitAppBackend?.artworkCacheEntries?.(item) || [];
            const artworkHits = await window.SplitAppIDB?.getThumbs?.(artworkEntries.map(({ key, signature }) => [key, signature])) || [];
            const seriesArtwork = new Set([item.image, item.customCover, item.backdrop, item.cachedDetails.image, item.cachedDetails.portraitImage, item.cachedDetails.landscapeImage, item.cachedDetails.backgroundImage]
              .filter(value => /^https:\/\//i.test(String(value || ""))).map(comparableArtworkUrl));
            const episodeEntries = item.category === "series" ? (item.cachedDetails.sections || []).filter(section => section?.kind === "episodes").flatMap(section => section.items || [])
              .filter(episode => episode?.id != null && /^https:\/\//i.test(String(episode.image || "")) && !seriesArtwork.has(comparableArtworkUrl(episode.image)))
              .map(episode => [episodeThumbKeyOf(item, episode.id), String(episode.image)]) : [];
            const episodeHits = episodeEntries.length ? await window.SplitAppIDB?.getThumbs?.(episodeEntries) || [] : [];
            const needsArtwork = artworkHits.length < artworkEntries.length || episodeHits.length < episodeEntries.length;
            if (!needsArtwork) continue;
            if (!setupDownloads.has(String(item.id)) || setupDownloads.get(String(item.id)).status === "done") markDownload(item, "queued");
            const artwork = await window.SplitAppBackend?.cacheArtwork?.(item, progress => updateArtworkProgress(item, progress));
            if (!artwork || artwork.skipped) throw new Error("Title artwork could not be saved on this device.");
            if (artwork.failed) throw new Error(`${artwork.failed} artwork image${artwork.failed === 1 ? "" : "s"} could not be saved. Retry when online.`);
            if (item.category !== "series") { markDownload(item, "done"); continue; }
            const result = await window.SplitAppBackend?.cacheEpisodeThumbnails?.(item, progress => updateArtworkProgress(item, progress));
      if (result?.skipped) throw new Error("Episode thumbnails could not be saved on this device.");
      if (result?.failed) throw new Error(`${result.failed} episode still${result.failed === 1 ? "" : "s"} could not be saved. Retry when online.`);
            markDownload(item, "done");
          }
        } catch (error) {
          if (setupDownloads.has(String(item.id))) markDownload(item, "failed", error?.message || "Could not save episode artwork.");
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(2, cachedGuides.length) }, worker)).catch(() => {});
  }
  function updateArtworkProgress(item, progress) {
    const row = setupDownloads.get(String(item?.id));
    if (!row || row.status === "failed") return;
    setupDownloads.set(String(item.id), { ...row, ...progress, stage: progress.status, status: "running", at: Date.now() });
    saveDownloads();
    updateSyncOverlay();
    if (page === "sync") scheduleHydrateRender();
  }
  function hydrateSavedItem(item) {
    if (!item?.metadataSource || !item.providerId || item.fullDetailsAt || hydrating.has(item.id) || prefs.metadataMode === "offline") return;
    hydrating.add(item.id); hydrateQueue.push(item); markDownload(item, "queued"); pumpHydrateQueue();
  }
  function retryDownloadButton(button) {
    const ids = button.dataset.setupDownloadRetry ? [button.dataset.setupDownloadRetry] : [...setupDownloads.values()].filter(row => row.status === "failed").map(row => row.id);
    if (setupDownloadsPaused) setSetupDownloadsPaused(false);
    ids.forEach(id => { const entry = itemById(id); cancelledDownloadIds.delete(String(id)); if (entry) { hydrating.delete(entry.id); resumeSavedDownload(entry); } });
    if (page === "sync") render();
  }
  function resumeSetupDownloads() {
    setSetupDownloadsPaused(false);
    for (const row of setupDownloads.values()) {
      if (row.status !== "queued") continue;
      const item = itemById(row.id);
      if (!item || hydrating.has(item.id)) continue;
      cancelledDownloadIds.delete(String(row.id));
      if (!item.fullDetailsAt) { if (item.metadataSource && item.providerId) hydrateSavedItem(item); else syncImported([item]); }
      else resumeSavedDownload(item);
    }
  }
  function resumeSavedDownload(item) {
    if (!item || hydrating.has(item.id)) return;
    if (!navigator.onLine) { markDownload(item, "failed", "Offline. Retry when connected."); return; }
    if (!item.fullDetailsAt) { hydrateSavedItem(item); return; }
    if (item.category !== "series" || prefs.imageStorage !== "all" || !item.cachedDetails || item.cachedDetails.compact) return;
    hydrating.add(item.id); markDownload(item, "queued");
    const run = async () => {
      try {
        await waitForDownloadResume();
        if (item.cachedDetails?.compact) await hydrateDetails(item);
        if (!item.cachedDetails || item.cachedDetails.compact) throw new Error("Saved episode details are not available on this device.");
        const result = await window.SplitAppBackend?.cacheEpisodeThumbnails?.(item, progress => updateArtworkProgress(item, progress));
        if (!result || result.skipped) throw new Error("Episode thumbnails could not be saved on this device.");
        if (result.failed) throw new Error(`${result.failed} episode still${result.failed === 1 ? "" : "s"} could not be saved. Retry when online.`);
        markDownload(item, "done");
      } catch (error) { markDownload(item, "failed", error?.message || "Could not save episode artwork."); }
      finally { hydrating.delete(item.id); }
    };
    run();
  }
  function pumpHydrateQueue() {
    while (!setupDownloadsPaused && hydrateActive < 2 && hydrateQueue.length) {
      const item = hydrateQueue.shift(); hydrateActive++; markDownload(item, "running");
      hydrateOne(item).finally(() => { hydrateActive--; hydrating.delete(item.id); pumpHydrateQueue(); });
    }
  }
  async function hydrateOne(item) {
    try {
      await waitForDownloadResume();
      if (cancelledDownloadIds.has(String(item.id))) return;
      if (!navigator.onLine) { markDownload(item, "failed", "Offline. Retry when connected."); return; }
      const initialWrite = pendingLibraryItemWrites.get(String(item.id));
      if (initialWrite) await initialWrite;
      pendingLibraryItemWrites.delete(String(item.id));
      const savedItem = itemById(item.id);
      if (!savedItem) { setupDownloads.delete(String(item.id)); return; }
      item = savedItem;
      const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), librarySync: true });
      if (cancelledDownloadIds.has(String(item.id))) return;
      if (itemById(item.id) !== item) { setupDownloads.delete(String(item.id)); return; }
      applyLoadedMetadata(item, loaded, { queueArtwork: false });
      await saveLibraryItemToIDB(item);
      item.fullDetailsAt = Date.now();
      if (item.cachedDetails && !item.cachedDetails.compact && window.SplitAppIDB?.getDetails) {
        const savedDetails = await window.SplitAppIDB.getDetails(item.id);
        if (!savedDetails) throw new Error("Title details could not be saved on this device.");
      }
      persist({ ids: [item.id] });
      markDownload(item, "running");
      // Queue the complete episode guide immediately; it must not depend on
      // which season the user happens to expand in the details view.
      if (prefs.imageStorage === "all" && item.cachedDetails && !item.cachedDetails.compact) {
        const artwork = await window.SplitAppBackend?.cacheArtwork?.(item, progress => updateArtworkProgress(item, progress));
        if (artwork?.failed) throw new Error(`${artwork.failed} artwork image${artwork.failed === 1 ? "" : "s"} could not be saved. Retry when online.`);
      }
      if (item.category === "series" && prefs.imageStorage === "all" && item.cachedDetails && !item.cachedDetails.compact) {
        const result = await window.SplitAppBackend?.cacheEpisodeThumbnails?.(item, progress => updateArtworkProgress(item, progress));
        if (result?.skipped) throw new Error("Episode thumbnails could not be saved on this device.");
        if (result?.failed) throw new Error(`${result.failed} episode still${result.failed === 1 ? "" : "s"} could not be saved. Retry when online.`);
      }
      markDownload(item, "done");
      if (page === "details" && String(detailItemId) === String(item.id)) { detailData = item.cachedDetails; render(); }
      else if (page === "sync") scheduleHydrateRender(); // collection pages are not rebuilt while downloads run: a full re-render restarts every poster's image loading
    } catch (error) { markDownload(item, "failed", error?.message || "Could not load details."); recordLog("warning", `Could not save details for ${item.title}: ${error?.message || error}`); if (page === "sync") scheduleHydrateRender(); }
  }
  // Restore sync: titles with a source + id are filled in through the same download queue; names-only titles
  // (TXT / CSV, or an older backup) are first matched to a source by searching for the title.
  const normalizeTitle = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/^the\s+/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let matchTail = Promise.resolve();
  async function matchTitleToSource(item) {
    const rows = await window.SplitAppDiscovery.search(item.title, item.category, detailSettings());
    const wanted = normalizeTitle(item.title), year = String(item.year || "").match(/(?:19|20)\d{2}/)?.[0] || "";
    const pick = (rows || []).find(row => normalizeTitle(row.title) === wanted && (!year || !row.year || String(row.year).slice(0, 4) === year));
    if (!pick) throw new Error("No exact match found in the enabled sources.");
    item.metadataSource = pick.source; item.providerId = String(pick.providerId);
    if (!item.image && pick.image) item.image = pick.image;
    if (!item.year && pick.year) item.year = pick.year;
    item.updatedAt = Date.now(); persist({ ids: [item.id] });
  }
  function syncImported(list) {
    if (prefs.metadataMode === "offline") return 0;
    let queued = 0;
    for (const item of list) {
      if (!item || item.fullDetailsAt) continue;
      cancelledDownloadIds.delete(String(item.id));
      if (item.metadataSource && item.providerId) { hydrateSavedItem(item); queued++; continue; }
      if (hydrating.has(item.id)) continue;
      hydrating.add(item.id); markDownload(item, "queued"); queued++;
      matchTail = matchTail.then(async () => {
        try {
          if (!navigator.onLine) throw new Error("Offline. Retry when connected.");
          markDownload(item, "running");
          await matchTitleToSource(item);
          hydrating.delete(item.id); hydrateSavedItem(item);
        } catch (error) { hydrating.delete(item.id); markDownload(item, "failed", error?.message || "Could not match this title."); if (page === "sync") scheduleHydrateRender(); }
        await new Promise(resolve => setTimeout(resolve, 350));
      });
    }
    return queued;
  }
  let hydrateRenderTimer = 0;
  function scheduleHydrateRender() { if (!hydrateRenderTimer) hydrateRenderTimer = setTimeout(() => { hydrateRenderTimer = 0; if (!document.hidden) render(); }, page === "sync" ? 400 : 1500); }
  let metadataSync = null, metadataSyncPaused = false, metadataSyncResumeWaiters = [];
  let metadataSyncSaveTimer = 0, metadataSyncRenderTimer = 0;
  let metadataSyncCountState = null, metadataSyncCounters = null;
  function saveMetadataSyncState() {
    clearTimeout(metadataSyncSaveTimer); metadataSyncSaveTimer = 0;
    if (!metadataSyncState) {
      try {
        localStorage.removeItem(metadataSyncStorageKey);
        for (let index = 0; index < Math.max(metadataSyncPersistedChunkCount, metadataSyncChunkCount); index++) localStorage.removeItem(metadataSyncChunkKey(index));
      } catch (error) { recordLog("warning", `Could not clear metadata refresh progress: ${error?.message || error}`); }
      metadataSyncChunks = []; metadataSyncEntryPositions.clear(); metadataSyncDirtyChunks.clear();
      metadataSyncChunkCount = 0; metadataSyncPersistedChunkCount = 0; metadataSyncIndexedState = null; metadataSyncNeedsCheckpoint = false;
      return;
    }
    if (metadataSyncIndexedState !== metadataSyncState) {
      indexMetadataSyncState(metadataSyncState);
      metadataSyncChunks.forEach((_, index) => metadataSyncDirtyChunks.add(index));
    }
    const previousChunkCount = metadataSyncPersistedChunkCount;
    const header = { version: 3, startedAt: Number(metadataSyncState.startedAt) || 0, finishedAt: Number(metadataSyncState.finishedAt) || 0, scope: String(metadataSyncState.scope || "needed"), chunkCount: metadataSyncChunkCount };
    try {
      metadataSyncDirtyChunks.forEach(index => localStorage.setItem(metadataSyncChunkKey(index), JSON.stringify(metadataSyncChunks[index] || [])));
      localStorage.setItem(metadataSyncStorageKey, JSON.stringify(header));
      for (let index = metadataSyncChunkCount; index < previousChunkCount; index++) localStorage.removeItem(metadataSyncChunkKey(index));
      metadataSyncDirtyChunks.clear(); metadataSyncPersistedChunkCount = metadataSyncChunkCount; metadataSyncNeedsCheckpoint = false;
    } catch (error) { recordLog("warning", `Could not save metadata refresh progress: ${error?.message || error}`); }
  }
  function deferMetadataSyncUpdate() {
    if (!metadataSyncSaveTimer) metadataSyncSaveTimer = setTimeout(saveMetadataSyncState, 500);
    // Only the pages that show refresh progress re-render during a sync; rebuilding Series / Movies / Favorites every 300 ms made posters reload and scrolling lag.
    if (!document.hidden && !metadataSyncRenderTimer && (page === "sync" || page === "settings")) metadataSyncRenderTimer = setTimeout(() => { metadataSyncRenderTimer = 0; render(); }, 300);
  }
  function isMetadataRefreshable(item) {
    const source = window.SplitAppSources.list(item?.category).find(row => row.key === item?.metadataSource);
    return Boolean(item?.providerId && source && window.SplitAppSources.isEnabled(source.key, prefs) && (!source.keyRequired || prefs.apiKeys?.[source.key]?.trim()));
  }
  const metadataSourceIdentity = item => [item?.metadataSource || item?.source || "", item?.category || "", String(item?.providerId || "")].join("\u0000");
  const metadataComparison = (details, trim = Boolean(details?.trimmed)) => {
    if (!details) return "";
    const copy = { ...details };
    delete copy.raw;
    if (copy.facts) { copy.facts = { ...copy.facts }; delete copy.facts.cast; }
    if (Array.isArray(copy.fields)) copy.fields = copy.fields.filter(field => !/^cast|^actors?$/i.test(String(field?.label || "").trim()));
    if (Array.isArray(copy.sections)) {
      const limits = { screenshots: 6 };
      copy.sections = copy.sections.filter(section => section?.kind !== "people" && !/^(posters|you might also like|cast|characters|staff|crew|people|guest cast|guest crew)(?:\b|\s)/i.test(section.title || "")).map(section => {
        const key = Object.keys(limits).find(name => new RegExp(`^${name}`, "i").test(section.title || ""));
        if (key) return { ...section, items: (section.items || []).slice(0, limits[key]) };
        return section;
      });
      if (trim) copy.trimmed = true;
    }
    return JSON.stringify(copy, (key, child) => key === "fetchedAt" ? undefined : child);
  };
  const metadataStamp = item => Number(item?.metadataFetchedAt || item?.cachedDetails?.fetchedAt || item?.cachedDetails?.facts?.fetchedAt || item?.facts?.fetchedAt) || (item?.cachedDetails ? Number(item.updatedAt) || 0 : 0);
  const syncCounts = () => {
    if (metadataSyncCountState !== metadataSyncState || !metadataSyncCounters) {
      const entries = metadataSyncState?.entries || [];
      metadataSyncCounters = { total: entries.length, done: 0, changed: 0, unchanged: 0, failed: 0, skipped: 0, remaining: 0 };
      entries.forEach(entry => {
        if (entry.status === "done") { metadataSyncCounters.done++; metadataSyncCounters.changed++; }
        else if (entry.status === "checked") { metadataSyncCounters.done++; metadataSyncCounters.unchanged++; }
        else if (entry.status === "failed") metadataSyncCounters.failed++;
        else if (entry.status === "skipped") metadataSyncCounters.skipped++;
        else if (entry.status === "queued" || entry.status === "running") metadataSyncCounters.remaining++;
      });
      metadataSyncCountState = metadataSyncState;
    }
    return metadataSyncCounters;
  };
  function setMetadataSyncStatus(entry, status) {
    const counters = metadataSyncCountState === metadataSyncState ? metadataSyncCounters : null;
    const previous = entry.status;
    if (counters && previous !== status) {
      if (previous === "done") { counters.done--; counters.changed--; }
      else if (previous === "checked") { counters.done--; counters.unchanged--; }
      else if (previous === "failed") counters.failed--;
      else if (previous === "skipped") counters.skipped--;
      else if (previous === "queued" || previous === "running") counters.remaining--;
      if (status === "done") { counters.done++; counters.changed++; }
      else if (status === "checked") { counters.done++; counters.unchanged++; }
      else if (status === "failed") counters.failed++;
      else if (status === "skipped") counters.skipped++;
      else if (status === "queued" || status === "running") counters.remaining++;
    }
    entry.status = status;
    markMetadataSyncEntryDirty(entry);
  }
  async function waitForSyncResume() {
    if (navigator.onLine && prefs.metadataMode !== "offline") return;
    await new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("online", done);
        window.removeEventListener("screenmark:sync-resume", done);
        resolve();
      };
      window.addEventListener("online", done);
      window.addEventListener("screenmark:sync-resume", done);
      // Recheck after registering listeners so a transition between the initial
      // state check and listener setup cannot strand a worker indefinitely.
      if (navigator.onLine && prefs.metadataMode !== "offline") done();
    });
  }
  async function waitForMetadataSyncResume() {
    while (metadataSyncPaused) await new Promise(resolve => metadataSyncResumeWaiters.push(resolve));
  }
  function setMetadataSyncPaused(paused) {
    if (!metadataSync || metadataSyncPaused === paused) return;
    metadataSyncPaused = paused;
    if (metadataSyncState) metadataSyncState.paused = paused;
    if (!paused) { const waiters = metadataSyncResumeWaiters; metadataSyncResumeWaiters = []; waiters.forEach(resolve => resolve()); }
    render();
    toast(paused ? "Metadata refresh paused after current requests." : "Metadata refresh resumed.");
  }
  async function startMetadataSync(ids = null, retry = false, scope = "all", quiet = false, automatic = false) {
    if (metadataSync) { toast("Metadata refresh is already running."); return metadataSync; }
    if (prefs.metadataMode === "offline" || !navigator.onLine) { toast("Connect to the internet and enable online metadata to refresh."); return; }
    const wanted = ids ? new Set(ids.map(String)) : null;
    if (retry && metadataSyncState) metadataSyncState.entries.forEach(entry => { if ((entry.status === "failed" || entry.status === "running") && (!automatic || !entry.retryAfterAt || entry.retryAfterAt <= Date.now()) && (!wanted || wanted.has(String(entry.id)))) { setMetadataSyncStatus(entry, "queued"); entry.error = ""; markMetadataSyncEntryDirty(entry); } });
    else {
      const intervalMs = { daily: 86400000, weekly: 7 * 86400000, monthly: 30 * 86400000, never: Infinity }[prefs.metadataRefreshInterval] ?? 7 * 86400000;
      const priorById = new Map((metadataSyncState?.entries || []).map(entry => [String(entry.id), entry]));
      const entries = items.filter(item => {
        const identity = metadataSourceIdentity(item);
        const prior = priorById.get(String(item.id));
        const priorFailure = automatic && prior && (!prior.sourceIdentity || prior.sourceIdentity === identity) && prior.status === "failed" && Number(prior.retryAfterAt) > Date.now();
        if (priorFailure || (wanted && !wanted.has(String(item.id))) || !isMetadataRefreshable(item)) return false;
        const stamp = metadataStamp(item);
        if (scope === "missing") return !item.cachedDetails || !stamp;
        if (scope === "needed") return !stamp || (Number.isFinite(intervalMs) && Date.now() - stamp >= intervalMs);
        return true;
      }).map(item => ({ id: String(item.id), title: item.title, source: item.metadataSource || item.source || "", category: item.category || "", providerId: String(item.providerId || ""), sourceIdentity: metadataSourceIdentity(item), status: "queued", error: "" }));
      if (entries.length) metadataSyncState = { startedAt: Date.now(), scope, entries };
      else if (!metadataSyncState) metadataSyncState = { startedAt: Date.now(), scope, entries: [] };
    }
    saveMetadataSyncState();
    const queue = metadataSyncState?.entries?.filter(row => row.status === "queued") || [];
    if (!queue.length) { if (!quiet) toast(retry ? "No failed metadata requests to retry." : scope === "needed" ? "No saved titles need a metadata refresh." : "No saved titles can be refreshed from the enabled sources."); render(); return; }
    const total = metadataSyncState.entries.length;
    if (!quiet) toast(`Refreshing metadata · ${syncCounts().done + syncCounts().failed} of ${total}`); render();
    metadataSyncState.active = true;
    metadataSync = (async () => {
      let nextStartAt = 0, queueIndex = 0;
      let lastLibraryPersist = Promise.resolve();
      const reportedMemory = Number(navigator.deviceMemory) || 4;
      const reportedCores = Number(navigator.hardwareConcurrency) || 4;
      const memoryLimit = nativeAndroid
        ? (reportedMemory <= 2 || reportedCores <= 2 ? 1 : reportedMemory <= 4 || reportedCores <= 4 ? 2 : 3)
        : reportedMemory <= 2 ? 1 : 3;
      const workers = Array.from({ length: Math.min(memoryLimit, 3, Math.max(1, Number(prefs.metadataSyncWorkers) || 2), queue.length) }, async () => {
        while (queueIndex < queue.length) {
          await waitForMetadataSyncResume();
          if (!navigator.onLine || prefs.metadataMode === "offline") { await waitForSyncResume(); continue; }
          await yieldToUser();
          await waitForMetadataSyncResume();
          const requestDelay = Math.max(0, Number(prefs.syncRequestDelay) || 0);
          if (requestDelay) { const startAt = Math.max(Date.now(), nextStartAt); nextStartAt = startAt + requestDelay; if (startAt > Date.now()) await new Promise(resolve => setTimeout(resolve, startAt - Date.now())); }
          await waitForMetadataSyncResume();
          if (!navigator.onLine || prefs.metadataMode === "offline") continue;
          if (queueIndex >= queue.length) return;
          const entry = queue[queueIndex++], item = itemById(entry.id); if (!item) { setMetadataSyncStatus(entry, "failed"); entry.error = "Title was removed."; markMetadataSyncEntryDirty(entry); deferMetadataSyncUpdate(); continue; }
          // A queued refresh may survive an app restart after its source was disabled
          // or its provider match was removed. Finish it as skipped instead of
          // issuing a doomed request or repeatedly resuming the same stale queue.
          if (!isMetadataRefreshable(item)) { setMetadataSyncStatus(entry, "skipped"); entry.error = "Metadata source is disabled or unavailable."; markMetadataSyncEntryDirty(entry); deferMetadataSyncUpdate(); continue; }
          const requestIdentity = metadataSourceIdentity(item);
          entry.source = item.metadataSource || item.source || ""; entry.category = item.category || ""; entry.providerId = String(item.providerId || ""); entry.sourceIdentity = requestIdentity;
          setMetadataSyncStatus(entry, "running"); entry.error = ""; deferMetadataSyncUpdate();
          markMetadataSyncEntryDirty(entry);
          try {
            await hydrateDetails(item);
            const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), forceRefresh: true, background: true });
            if (itemById(entry.id) !== item) throw new Error("Title was removed or replaced.");
            if (metadataSourceIdentity(item) !== requestIdentity) throw new Error("The metadata source or match changed during refresh. Retry to sync the current match.");
            const changed = metadataComparison(item.cachedDetails, Boolean(item.cachedDetails?.trimmed)) !== metadataComparison(loaded, Boolean(item.cachedDetails?.trimmed));
            applyLoadedMetadata(item, loaded, { cacheDetails: changed, replaceFacts: Boolean(item.relinkFresh) });
            // The WebView/IndexedDB save is debounced and coalesced across
            // workers. Let network requests continue while native recovery
            // snapshots and the selected-folder mirror catch up in order.
            lastLibraryPersist = persist({ ids: [item.id] }); setMetadataSyncStatus(entry, changed ? "done" : "checked"); entry.error = ""; delete entry.retryAfterAt; markMetadataSyncEntryDirty(entry);
          } catch (error) { setMetadataSyncStatus(entry, "failed"); entry.error = String(error?.message || "Metadata refresh failed.").slice(0, 240); if (automatic) entry.retryAfterAt = Date.now() + 6 * 60 * 60 * 1000; markMetadataSyncEntryDirty(entry); recordLog("warning", `Metadata refresh failed for ${item.title}: ${entry.error}`); }
          deferMetadataSyncUpdate(); const counts = syncCounts(); if (!quiet) toast(`Refreshing metadata · ${counts.done + counts.failed} of ${total}`);
        }
      });
      try { await Promise.all(workers); }
      finally {
        await lastLibraryPersist;
        metadataSync = null; metadataSyncPaused = false; metadataSyncResumeWaiters = []; if (metadataSyncState) { metadataSyncState.paused = false; metadataSyncState.active = false; } if (!syncCounts().remaining) metadataSyncState.finishedAt = Date.now(); else delete metadataSyncState.finishedAt; saveMetadataSyncState(); clearTimeout(metadataSyncRenderTimer); metadataSyncRenderTimer = 0; render();
        const counts = syncCounts(); if (!quiet) toast(`Metadata refresh: ${counts.changed} updated · ${counts.unchanged} unchanged${counts.failed ? ` · ${counts.failed} failed` : ""}.`);
      }
    })();
    return metadataSync;
  }
  let automaticMetadataCheckAt = 0, automaticMetadataTimer = 0;
  const MAX_TIMEOUT_DELAY = 2_147_000_000;
  const metadataRefreshMs = () => ({ daily: 86400000, weekly: 7 * 86400000, monthly: 30 * 86400000, never: Infinity }[prefs.metadataRefreshInterval] ?? 7 * 86400000);
  function scheduleAutomaticMetadataCheck() {
    clearTimeout(automaticMetadataTimer); automaticMetadataTimer = 0;
    const interval = metadataRefreshMs();
    if (!Number.isFinite(interval) || !items.length) return;
    const eligible = items.filter(isMetadataRefreshable);
    if (!eligible.length) return;
    const priorById = new Map((metadataSyncState?.entries || []).map(entry => [String(entry.id), entry]));
    const retryAfter = item => {
      const entry = priorById.get(String(item.id));
      return entry?.status === "failed" && (!entry.sourceIdentity || entry.sourceIdentity === metadataSourceIdentity(item)) ? Number(entry.retryAfterAt) || 0 : 0;
    };
    const now = Date.now();
    let nextDue = Infinity;
    for (const item of eligible) {
      const retryAt = retryAfter(item);
      const dueAt = retryAt > now ? retryAt : (metadataStamp(item) || 0) + interval;
      if (dueAt < nextDue) nextDue = dueAt;
    }
    const nextAllowed = automaticMetadataCheckAt ? automaticMetadataCheckAt + 15 * 60 * 1000 : 0;
    const delay = Math.max(60000, nextDue - now, nextAllowed - now);
    // Browser timers overflow above the signed 32-bit millisecond range. A 30-day
    // monthly refresh must be split into safe waits and recalculated on each wake.
    automaticMetadataTimer = setTimeout(() => maybeAutoMetadataSync(), Math.min(delay, MAX_TIMEOUT_DELAY));
  }
  function maybeAutoMetadataSync() {
    if (!metadataLibraryReady || !Number.isFinite(metadataRefreshMs()) || metadataSync || !navigator.onLine || prefs.metadataMode === "offline" || document.hidden) return;
    if (automaticMetadataCheckAt && Date.now() - automaticMetadataCheckAt < 15 * 60 * 1000) { scheduleAutomaticMetadataCheck(); return; }
    automaticMetadataCheckAt = Date.now();
    const pending = metadataSyncState?.entries?.some(entry => entry.status === "queued" || entry.status === "running");
    const work = pending ? startMetadataSync(null, true, "needed", true, true) : startMetadataSync(null, false, "needed", true, true);
    Promise.resolve(work).finally(scheduleAutomaticMetadataCheck);
  }
  async function syncMetadataNow() { return startMetadataSync(null, false, prefs.syncScope || "needed"); }
  async function runMetadataSyncAction(action) {
    if (action === "syncRunFailed") return retryMetadataSync();
    if (action === "syncRunMissing") return startMetadataSync(null, false, "missing");
    if (action === "syncRunAll") return startMetadataSync(null, false, "all");
    return startMetadataSync(null, false, "needed");
  }
  async function retryMetadataSync(id = null) { return startMetadataSync(id == null ? null : [id], true); }
  // Remove only the finished rows of one kind (updated = changed + unchanged, or failed); queued/running rows stay.
  function clearMetadataSyncEntries(kind) {
    if (metadataSync || !metadataSyncState) return;
    const drop = kind === "failed" ? new Set(["failed"]) : new Set(["done", "checked"]);
    const entries = (metadataSyncState.entries || []).filter(entry => !drop.has(entry.status));
    metadataSyncState = entries.length ? { ...metadataSyncState, entries } : null;
    metadataSyncCounters = null;
    saveMetadataSyncState(); render();
  }
  function clearMetadataSyncState() { if (metadataSync) return; metadataSyncState = null; saveMetadataSyncState(); render(); }
  // Watch progress and the episode checklist are one thing: for a series with a saved episode guide the watched episodes are the truth and `progress` is their count.
  function reconcileEpisodes(item) {
    const info = item?.category === "series" ? window.SplitAppLibrary.episodeInfo(item) : null; if (!info) return false;
    const before = Number(item.progress) || 0, ids = new Set((item.watchedEpisodeIds || []).map(String));
    // Older entries only had a counter: turn it into the first N episodes watched.
    if (!info.done && before > 0) info.eps.slice(0, Math.min(before, info.total)).forEach(entry => ids.add(String(entry.id)));
    const next = info.eps.filter(entry => ids.has(String(entry.id))).length;
    const changed = next !== before || ids.size !== (item.watchedEpisodeIds || []).length;
    // Only rewrite when something changed: this runs on every details render and used to allocate a new array each time.
    if (changed) { item.watchedEpisodeIds = [...ids]; item.progress = next; }
    // Keep the tracked goal stable when a metadata refresh adds a new episode.
    // The newly listed episode remains the next item, while progress can still
    // accurately read 62/62 until the user chooses to continue.
    if (!(Number(item.goal) > 0)) item.goal = info.total;
    return changed;
  }
  // Move progress by `delta` episodes: forward marks the next unwatched ones, back unmarks the latest watched ones.
  function stepEpisodes(item, delta) {
    const info = window.SplitAppLibrary.episodeInfo(item); if (!info) return false;
    const ids = new Set((item.watchedEpisodeIds || []).map(String));
    const previousIds = new Set(ids);
    let skippedUpcoming = 0;
    if (delta > 0) {
      const added = info.eps.filter(entry => !ids.has(String(entry.id)) && !window.SplitAppLibrary.isUpcoming(entry)).slice(0, delta);
      added.forEach(entry => ids.add(String(entry.id)));
      skippedUpcoming = Math.max(0, delta - added.length);
    } else if (delta < 0) [...info.eps].reverse().filter(entry => ids.has(String(entry.id))).slice(0, -delta).forEach(entry => ids.delete(String(entry.id)));
    const changed = ids.size !== previousIds.size || [...ids].some(id => !previousIds.has(id));
    if (!changed) { item.progress = ids.size; return { changed: false, skippedUpcoming }; }
    const currentGoal = Number(item.goal) || info.total;
    item.watchedEpisodeIds = [...ids]; item.progress = ids.size; item.goal = ids.size > currentGoal ? info.total : currentGoal;
    return { changed: true, skippedUpcoming };
  }
  function scrollPageTop() { const go = () => { window.scrollTo({ top: 0, behavior: "instant" }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }; go(); requestAnimationFrame(go); }
  function detailBack() {
    const previous = detailStack.pop(); if (!previous) return;
    detailAbortController?.abort(); refAbortController?.abort(); detailAbortController = refAbortController = null;
    refRequest++; detailRequest++;
    ({ detailPreview, detailItemId, detailData, detailError, detailEditMode, detailReturnPage, detailRef, detailRefOffset = 0, refData, refError } = previous);
    detailLoading = false; refLoading = false;
    render(); window.scrollTo({ top: previous.scroll || 0, behavior: "instant" }); historyPush(true);
    if (!detailRef && !detailData && (detailPreview || detailItemId)) loadDetails();
  }
  function toggleSeason(itemId, ids, done) {
    const item = itemById(itemId); if (!item) return;
    const watched = new Set((item.watchedEpisodeIds || []).map(String));
    const previousWatched = watched.size, previousStatus = item.status;
    const info = window.SplitAppLibrary.episodeInfo(item);
    const upcomingIds = new Set((info?.eps || []).filter(window.SplitAppLibrary.isUpcoming).map(entry => String(entry.id)));
    const idsToApply = done ? ids.map(String) : ids.map(String).filter(id => !upcomingIds.has(id));
    const skippedUpcoming = ids.length - idsToApply.length;
    if (!done && !idsToApply.length && skippedUpcoming) { toast("Upcoming episodes cannot be marked watched yet."); return null; }
    idsToApply.forEach(id => done ? watched.delete(id) : watched.add(id));
    const currentGoal = Number(item.goal) || Number(detailData?.goal) || watched.size;
    item.watchedEpisodeIds = [...watched]; item.goal = !done && info && watched.size > currentGoal ? info.total : currentGoal; item.progress = watched.size;
    if (!done && watched.size) item.lastProgressAt = Date.now();
    if (finishSeriesIfComplete(item, info)) { /* completed automatically */ }
    else if (done && !item.progress && item.status !== roles.dropped) item.status = roles.queued;
    else if (done && item.status === roles.done) item.status = roles.active;
    else if (!done && item.progress) item.status = roles.active;
    item.updatedAt = Date.now();
    if (watched.size !== previousWatched || item.status !== previousStatus) {
      const allEpisodes = info && idsToApply.length === info.total;
      history.unshift({ itemId: item.id, title: item.title, action: `${allEpisodes ? "All episodes" : "Season episodes"} marked ${done ? "unwatched" : "watched"}`, status: item.status, type: "episode", at: item.updatedAt });
    }
    persist({ ids: [item.id] }); render();
    return skippedUpcoming;
  }
  function animateWatchlistCard(itemId) {
    requestAnimationFrame(() => {
      const card = [...document.querySelectorAll("[data-watchlist-root]")].find(row => row.dataset.watchlistRoot === String(itemId));
      if (!card) return;
      card.classList.remove("is-entering");
      requestAnimationFrame(() => card.classList.add("is-entering"));
      window.setTimeout(() => card.classList.remove("is-entering"), 260);
    });
  }
  function captureWatchlistLayout() {
    if (page !== "series-watchlist" && page !== "movie-watchlist") return null;
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    return new Map($$(".watchlist-content [data-watchlist-root]").flatMap(card => {
      const rect = card.getBoundingClientRect();
      const section = card.closest(".watchlist-section")?.querySelector(".watchlist-section-heading h3, h3")?.textContent || "";
      return rect.bottom >= -120 && rect.top <= viewport + 120 ? [[String(card.dataset.watchlistRoot), { left: rect.left, top: rect.top, section }]] : [];
    }));
  }
  function animateWatchlistLayout(before) {
    if (!before?.size || motionIsReduced()) return;
    const viewport = window.innerHeight || document.documentElement.clientHeight;
      const duration = document.documentElement.dataset.lowend === "true" ? 150 : prefs.animationSpeed === "fast" ? 185 : prefs.animationSpeed === "slow" ? 360 : 240;
    requestAnimationFrame(() => $$(".watchlist-content [data-watchlist-root]").forEach(card => {
      const from = before.get(String(card.dataset.watchlistRoot));
      if (!from || !card.animate) return;
      const rect = card.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > viewport + 120) return;
      const section = card.closest(".watchlist-section")?.querySelector(".watchlist-section-heading h3, h3")?.textContent || "";
      if (from.section !== section) { animateWatchlistCard(card.dataset.watchlistRoot); return; }
      const x = from.left - rect.left, y = from.top - rect.top;
      if (Math.abs(x) < 2 && Math.abs(y) < 2) return;
      card.animate([{ transform: `translate3d(${x}px,${y}px,0)` }, { transform: "translate3d(0,0,0)" }], { duration, easing: "cubic-bezier(.2,.75,.25,1)" });
    }));
  }
  function toggleEpisodeWatched(itemId, episodeId, episodeTitle, watchlistCard = "") {
    const item = itemById(itemId); if (!item) return;
    const info = window.SplitAppLibrary.episodeInfo(item);
    const previousStatus = item.status;
    const watched = new Set((item.watchedEpisodeIds || []).map(String));
    const id = String(episodeId);
    const markingWatched = !watched.has(id);
    const selectedEpisode = info?.eps.find(entry => String(entry.id) === id);
    if (markingWatched && selectedEpisode && window.SplitAppLibrary.isUpcoming(selectedEpisode)) { toast("This episode has not aired yet."); return; }
    let earlier = 0;
    if (watched.has(id)) watched.delete(id);
    else {
      // Watching an episode means you saw the ones before it: check those too.
      const index = info ? info.eps.findIndex(entry => String(entry.id) === id) : -1;
      if (index > 0) info.eps.slice(0, index).forEach(entry => { if (!watched.has(String(entry.id)) && !window.SplitAppLibrary.isUpcoming(entry)) { watched.add(String(entry.id)); earlier += 1; } });
      watched.add(id);
    }
    item.watchedEpisodeIds = [...watched];
    const currentGoal = Number(item.goal) || Number(detailData?.goal) || watched.size;
    item.goal = markingWatched && info && watched.size > currentGoal ? info.total : currentGoal;
    item.progress = watched.size;
    if (markingWatched) item.lastProgressAt = Date.now();
    if (finishSeriesIfComplete(item, info)) { /* completed automatically */ }
    else if (markingWatched) item.status = roles.active;
    else if (!item.progress && item.status !== roles.dropped) item.status = roles.queued;
    else if (item.status === roles.done) item.status = roles.active;
    item.updatedAt = Date.now();
    history.unshift({ itemId: item.id, title: item.title, action: `${episodeTitle || "Episode"} marked ${markingWatched ? "watched" : "unwatched"}`, status: item.status, type: "episode", at: Date.now() });
    persist({ ids: [item.id] });
    if (previousStatus !== item.status) { const before = captureWatchlistLayout(); render(); animateWatchlistLayout(before); }
    else if (watchlistCard && page === (item.category === "movie" ? "movie-watchlist" : "series-watchlist")) {
      const before = captureWatchlistLayout();
      const replaceCard = () => {
          const infoNext = window.SplitAppLibrary.episodeInfo(item)?.next;
        const fresh = infoNext ? window.SplitAppPages.watchlistCard({ item, episode: infoNext, esc, roles, view: currentWatchlistView() }) : null;
        if (root && fresh) { root.outerHTML = fresh; if (markingWatched) animateWatchlistCard(item.id); }
        else if (root) root.remove();
        animateWatchlistLayout(before);
        window.lucide?.createIcons({ root: document.querySelector("#page-content"), attrs: { "aria-hidden": "true" } });
        if (item.category === "series") hydrateWatchlistEpisodeThumbs(document.querySelector("#page-content"));
      };
      const root = [...document.querySelectorAll("[data-watchlist-root]")].find(row => row.dataset.watchlistRoot === String(watchlistCard));
      replaceCard();
    } else render();
    toast(watched.has(id) ? (earlier ? `Episode and ${earlier} earlier ${earlier === 1 ? "episode" : "episodes"} marked watched.` : "Episode marked watched.") : "Episode marked unwatched.");
  }
  function changeWatchlistTab(tab) {
    const next = tab === "upcoming" ? "upcoming" : "watchlist";
    if (next === watchlistTab) return;
    watchlistTab = next;
    render();
    syncPageNavigation();
  }
  function deleteFromDetails(id) {
    const item = itemById(id); if (!item) return;
    recordLibraryChange("removed", `Deleted ${item.title}.`, [id]);
    if (prefs.backupBeforeDestructive) exportList({ silent: true });
    moveToTrash(item);
    items = items.filter(entry => entry.id !== id); itemIndexItems = null;
    detailItemId = null; detailData = null; detailPreview = null;
    persist({ removed: [id] }); goto(detailReturnPage); toast("Entry deleted.");
  }
  function requestDeleteDetails(id) {
    if (!itemById(id)) return;
    const dialog = $("#detail-delete-dialog");
    if (!dialog) return;
    if (!dialog._returnToParent) dialog._returnToParent = dialog.parentElement;
    document.body.append(dialog);
    showPopup(dialog);
  }
  function setItemStatus(item, status) {
    if (!item || item.status === status) return;
    if (item.category === "series") {
      const progress = Math.max(Number(item.progress) || 0, (item.watchedEpisodeIds || []).length);
      const allowed = [...(progress > 0 ? [roles.active, roles.hold, roles.dropped, roles.done] : [roles.queued, roles.done]), ...(statusOptions.custom.series || [])];
      if (!allowed.includes(status)) return;
    } else if (item.category === "movie" && ![roles.queued, roles.dropped, roles.done, ...(statusOptions.custom.movie || [])].includes(status)) return;
    item.status = status; item.updatedAt = Date.now();
    // Completed movie = fully watched: fill the runtime so the bar, percentage and "left" time update too.
    if (item.category === "movie" && status === roles.done) {
      const runtime = Number(item.goal) || Number(item.facts?.runtimeMinutes) || Number(item.facts?.totalMinutes) || 0;
      if (runtime) { item.goal = Number(item.goal) || runtime; item.progress = runtime; item.lastProgressAt = Date.now(); }
    }
    // Back to Watchlist = not watched yet: clear the progress.
    if (item.category === "movie" && status === roles.queued) { item.progress = 0; delete item.lastProgressAt; }
    if (trackedStatuses.includes(status)) history.unshift({ itemId: item.id, title: item.title, action: status, status, at: Date.now() });
    persist({ ids: [item.id] });
  }
  function resyncAfterRelink(item, message) {
    item.relinkFresh = true;
    ["localImageData", "localPortraitData", "localThumbnailData", "localLandscapeData", "thumbnailPath", "thumbnailMime", "localImageFiles", "localImageFingerprint"].forEach(key => delete item[key]);
    item.updatedAt = Date.now(); persist({ ids: [item.id] }); detailData = null; loadDetails(item.id); toast(message);
  }
  function openFixMatch(id) {
    const item = itemById(String(id)); if (!item) return;
    const sources = window.SplitAppSources.available(item.category, prefs);
    if (!sources.length) { toast("Enable a metadata source first."); return; }
    let dialog = $("#fix-match-dialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "fix-match-dialog"; dialog.className = "choice-dialog fix-match-dialog"; document.body.appendChild(dialog); }
    const state = { key: sources[0].key, rows: [], message: "", preview: null };
    const paint = () => {
      const current = itemById(String(id)); if (!current) return;
      const preview = state.preview == null ? null : state.rows[state.preview];
      const sourceName = sources.find(source => source.key === state.key)?.name || state.key;
      if (preview) {
        const fields = [["Source", sourceName], ["Year", preview.year], ["Runtime", preview.runtime || preview.runtimeMinutes], ["Genre", Array.isArray(preview.genres) ? preview.genres.join(", ") : preview.genre], ["Provider ID", preview.providerId]].filter(([, value]) => value);
        dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">CHECK THIS MATCH</p><h2>${esc(current.title)}</h2></div><button class="choice-dialog-close" type="button" data-fix-close aria-label="Close">×</button></header><div class="fix-match-body fix-match-preview"><div class="fix-match-preview-head">${preview.image ? `<img src="${esc(preview.image)}" alt="" onerror="this.hidden=true">` : `<span class="fix-match-preview-noart">No poster</span>`}<div><small>${esc(sourceName)} result</small><h3>${esc(preview.title)}</h3><dl>${fields.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></div></div>${preview.description ? `<p class="fix-match-preview-desc">${esc(preview.description)}</p>` : `<p class="fix-match-status">Check the title, year and poster before linking.</p>`}<div class="fix-match-preview-compare"><span>Your title</span><strong>${esc(current.title)}${current.year ? ` · ${esc(current.year)}` : ""}</strong></div><div class="fix-match-preview-actions">${/^https?:\/\//i.test(preview.url || "") ? `<a class="button secondary" href="${esc(preview.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ""}<button type="button" class="button secondary" data-fix-back>Back</button><button type="button" class="button primary" data-fix-use="${state.preview}">Use this match</button></div></div>`;
        return;
      }
      dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">FIX MATCH</p><h2>${esc(current.title)}</h2></div><button class="choice-dialog-close" type="button" data-fix-close aria-label="Close">×</button></header><div class="fix-match-body"><div class="fix-match-search"><select data-fix-source aria-label="Source">${sources.map(source => `<option value="${esc(source.key)}"${source.key === state.key ? " selected" : ""}>${esc(source.name)}</option>`).join("")}</select><input type="search" data-fix-query value="${esc(state.query ?? current.title)}" placeholder="Search this source"><button type="button" class="button primary small" data-fix-search>Search</button></div><p class="fix-match-status" role="status">${esc(state.message)}</p><ul class="fix-match-results">${state.rows.map((row, index) => `<li><span class="fix-match-art">${row.image ? `<img src="${esc(row.image)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">` : ""}</span><span class="fix-match-copy"><strong>${esc(row.title)}</strong><small>${esc([row.year, row.description].filter(Boolean).join(" · ") || row.providerId)}</small></span><button type="button" class="button secondary small" data-fix-view="${index}">View</button><button type="button" class="button primary small" data-fix-use="${index}">Use</button></li>`).join("")}</ul></div>`;
    };
    const search = async () => { state.query = dialog.querySelector("[data-fix-query]")?.value.trim() || ""; state.key = dialog.querySelector("[data-fix-source]")?.value || state.key; if (!state.query) return; state.rows = []; state.preview = null; state.message = "Searching…"; paint(); try { state.rows = (await window.SplitAppDiscovery.searchSource(state.query, item.category, detailSettings(), state.key)).slice(0, 15); state.message = state.rows.length ? "Choose the correct title." : "No results from this source."; } catch (error) { state.message = error?.message || "Search failed."; } paint(); };
    dialog.onclick = event => {
      const current = itemById(String(id)); if (!current) return;
      if (event.target === dialog || eventClosest(event, "[data-fix-close]")) { closePopup(dialog); return; }
      if (eventClosest(event, "[data-fix-search]")) { search(); return; }
      const view = eventClosest(event, "[data-fix-view]"); if (view) { state.preview = Number(view.dataset.fixView); paint(); return; }
      if (eventClosest(event, "[data-fix-back]")) { state.preview = null; paint(); return; }
      const use = eventClosest(event, "[data-fix-use]");
      if (use) {
        const row = state.rows[Number(use.dataset.fixUse)]; if (!row) return; const key = state.key, providerId = String(row.providerId);
        current.metadataSource = key; current.source = key; current.providerId = providerId; current.year = row.year || current.year || "";
        current.cachedDetails = null; closePopup(dialog); resyncAfterRelink(current, `Linked “${row.title}”.`); return;
      }
    };
    dialog.onchange = event => { if (event.target.matches("[data-fix-source]")) { state.key = event.target.value; state.rows = []; state.preview = null; state.message = ""; paint(); } };
    dialog.onkeydown = event => { if (event.key === "Enter" && event.target.matches("[data-fix-query]")) { event.preventDefault(); search(); } };
    paint(); showPopup(dialog);
  }
  // Pictures this title has, as { url, src }: `url` is saved as the cover, `src` is shown (the on-device copy when there is one, so it works offline).
  function coverCandidates(item, local = {}) {
    const details = item.cachedDetails || {}, rows = [];
    const add = (url, ...paths) => {
      if (!/^https?:/i.test(url || "") || rows.some(row => row.url === url)) return;
      rows.push({ url, src: paths.map(path => path === "@portrait" ? (item.localPortraitData || item.localThumbnailData) : path === "@landscape" ? item.localLandscapeData : local[path]).find(src => src && !/^blob:.*undefined/.test(src)) || local[`imageUrl:${url}`] || url });
    };
    add(details.portraitImage, "cachedDetails.portraitImage", "@portrait"); add(details.image, "cachedDetails.image", "@portrait");
    add(details.landscapeImage, "cachedDetails.landscapeImage", "@landscape"); add(details.backgroundImage, "cachedDetails.backgroundImage", "@landscape");
    add(item.image, "image", "@portrait"); add(item.backdrop, "backdrop", "@landscape");
    (details.sections || []).forEach((section, sectionIndex) => { if (section.kind !== "gallery") return; (section.items || []).slice(0, 8).forEach((row, index) => add(row.image, `cachedDetails.sections.${sectionIndex}.items.${index}.image`)); });
    return navigator.onLine ? rows : rows.filter(row => row.src !== row.url);
  }
  async function openCoverPicker(id) {
    const item = itemById(String(id)); if (!item) return;
    let dialog = $("#cover-picker-dialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "cover-picker-dialog"; dialog.className = "choice-dialog cover-picker-dialog"; document.body.appendChild(dialog); }
    if (item.cachedDetails?.compact) await hydrateDetails(item);
    let localImages = item.localImageData || {};
    try { const loaded = await window.SplitAppBackend?.loadItemImages?.(item); if (loaded && Object.keys(loaded).length) { localImages = loaded; item.localImageData = loaded; } } catch (_) {}
    const urls = coverCandidates(item, localImages);
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">COVER</p><h2>${esc(item.title)}</h2></div><button class="choice-dialog-close" type="button" data-cover-close aria-label="Close">×</button></header><div class="cover-picker-body"><p class="fix-match-status">${item.customCover ? "Using your chosen cover." : "Pick a cover; it stays when metadata refreshes."}</p><div class="cover-picker-grid">${urls.length ? urls.map(({ url, src }) => `<button type="button" class="cover-choice${item.customCover === url ? " is-current" : ""}" data-cover-url="${esc(url)}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.closest('button').hidden=true"></button>`).join("") : `<p class="fix-match-status">No saved pictures yet. Open this title once online to save them for offline use.</p>`}</div>${item.customCover ? '<button type="button" class="button secondary" data-cover-auto>Use automatic cover</button>' : ""}</div>`;
    dialog.onclick = event => { if (event.target === dialog || eventClosest(event, "[data-cover-close]")) { closePopup(dialog); return; } const choice = eventClosest(event, "[data-cover-url]"), automatic = eventClosest(event, "[data-cover-auto]"); if (!choice && !automatic) return; if (choice) { item.customCover = choice.dataset.coverUrl; item.image = item.customCover; } else delete item.customCover; item.updatedAt = Date.now(); persist({ ids: [item.id] }); closePopup(dialog); render(); toast(automatic ? "Automatic cover restored." : "Cover updated."); };
    showPopup(dialog);
  }
  function openItemActions(id) {
    const item = itemById(id); if (!item) return;
    let dialog = $("#item-action-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog"); dialog.id = "item-action-dialog"; dialog.className = "ios-action-sheet";
      document.body.appendChild(dialog);
      dialog.addEventListener("click", async event => {
        if (event.target === dialog) { closePopup(dialog); return; }
        const button = eventClosest(event, "[data-sheet-action]"); if (!button) return;
        const target = itemById(dialog.dataset.itemId);
        const action = button.dataset.sheetAction;
        // Details/Edit navigate to another page; keep the sheet's history entry so closing it cannot undo that navigation.
        closePopup(dialog, { preserveHistory: action === "details" || action === "edit" });
        if (!target) return;
        if (action === "details") openDetails(target.id);
        else if (action === "edit") openEdit(target.id);
        else if (action === "remove") {
          if (!(await appConfirm(`Remove “${target.title}” from your collection?`, { title: "Remove title", confirmLabel: "Remove", danger: true }))) return;
          if (prefs.backupBeforeDestructive) exportList({ silent: true });
          moveToTrash(target);
          recordLibraryChange("removed", `Removed ${target.title}.`, [target.id]); items = items.filter(entry => entry.id !== target.id); itemIndexItems = null; persist({ removed: [target.id] }); render(); toast("Entry removed.");
        } else if (action !== "cancel") { setItemStatus(target, action); render(); toast(`Marked as ${action}.`); }
      });
    }
    dialog.dataset.itemId = id;
    dialog.innerHTML = `<div class="ios-action-group"><p>${esc(item.title)}</p><button type="button" data-sheet-action="${esc(roles.active)}" class="accent"><i data-lucide="circle-play"></i>Mark as ${esc(roles.active)}</button><button type="button" data-sheet-action="${esc(roles.done)}" class="success"><i data-lucide="check-circle"></i>Mark as ${esc(roles.done)}</button><button type="button" data-sheet-action="edit"><i data-lucide="pencil"></i>Edit entry</button><button type="button" data-sheet-action="details"><i data-lucide="info"></i>View Full Details</button><button type="button" data-sheet-action="remove" class="danger"><i data-lucide="trash-2"></i>Remove from Collection</button></div><button type="button" class="ios-action-cancel" data-sheet-action="cancel">Cancel</button>`;
    window.lucide?.createIcons({ root: dialog, attrs: { "aria-hidden": "true" } });
    showPopup(dialog);
  }
  function openDetails(id, edit = false) { clearDetailStack(); detailReturnPage = page === "details" ? detailReturnPage : page; detailPreview = null; detailEditMode = edit; detailItemId = id; detailData = null; detailError = ""; goto("details"); loadDetails(); }
  function openDiscoverDetails(result) { if (!result) return; clearDetailStack(); detailReturnPage = "discover"; detailPreview = { ...result, metadataSource: result.source }; detailEditMode = false; detailItemId = null; detailData = null; detailError = ""; goto("details"); loadDetails(); }
  function showDetailImage(position) {
    const dialog = $("#detail-image-modal");
    const triggers = $$("#page-content [data-detail-image-src]");
    if (!dialog || !triggers.length) return;
    detailImagePosition = (position + triggers.length) % triggers.length;
    const trigger = triggers[detailImagePosition];
    const image = $("[data-detail-modal-img]", dialog);
    image.src = trigger.dataset.detailImageSrc;
    image.alt = trigger.dataset.detailImageLabel || "Image";
    $("[data-detail-modal-caption]", dialog).textContent = image.alt;
    $("[data-detail-image-prev]", dialog).hidden = triggers.length < 2;
    $("[data-detail-image-next]", dialog).hidden = triggers.length < 2;
    const counter = $("[data-detail-image-counter]", dialog); if (counter) counter.textContent = triggers.length > 1 ? `${detailImagePosition + 1} / ${triggers.length}` : "";
    if (!dialog.open) { dialog.classList.remove("is-rotated"); dialog.dataset.rotate = ""; showPopup(dialog); window.lucide?.createIcons({ root: dialog, attrs: { "aria-hidden": "true" } }); }
  }
  function currentDetailImage() {
    const trigger = $$("#page-content [data-detail-image-src]")[detailImagePosition];
    const src = trigger?.dataset.detailImageSrc;
    if (!src) { toast("Image is unavailable."); return null; }
    const label = trigger.dataset.detailImageLabel || "ScreenMark image";
    const baseName = label.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "screenmark-image";
    return { src, label, baseName };
  }
  async function detailImageBlob(src) { const response = await fetch(src); if (!response.ok) throw new Error("Could not read this image."); return response.blob(); }
  const detailImageFilename = (baseName, blob) => `${baseName}.${({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" })[blob.type] || "jpg"}`;
  function rotateDetailImage() {
    const modal = $("#detail-image-modal"); if (!modal) return;
    const next = { "": "cw", cw: "ccw", ccw: "" }[modal.dataset.rotate || ""];
    modal.dataset.rotate = next; modal.classList.toggle("is-rotated", Boolean(next));
  }
  async function downloadDetailImage() {
    const image = currentDetailImage(); if (!image) return;
    const nativeShare = window.Capacitor?.Plugins?.ShareIntent;
    if (nativeShare?.downloadImage) {
      try { const result = await nativeShare.downloadImage({ src: image.src, filename: image.baseName, title: image.label }); toast(`Saved ${result?.location || "image to Downloads"}.`); }
      catch (error) { toast(error?.message || "Could not save the image."); }
      return;
    }
    try {
      const blob = await detailImageBlob(image.src), url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = detailImageFilename(image.baseName, blob); anchor.style.display = "none";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); toast("Image downloaded.");
    } catch (_) {
      const anchor = document.createElement("a"); anchor.href = image.src; anchor.download = `${image.baseName}.jpg`; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); toast("Opened the image so you can save it.");
    }
  }
  async function copyDetailImage() {
    const image = currentDetailImage(); if (!image) return;
    const nativeShare = window.Capacitor?.Plugins?.ShareIntent;
    if (nativeShare?.copyImage) {
      try { await nativeShare.copyImage({ src: image.src, filename: image.baseName, title: image.label }); toast("Image copied to clipboard."); }
      catch (error) { toast(error?.message || "Could not copy the image."); }
      return;
    }
    try {
      const blob = await detailImageBlob(image.src);
      if (navigator.clipboard?.write && window.ClipboardItem && /^image\/(png|jpeg|webp)$/.test(blob.type)) { await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); toast("Image copied."); return; }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(image.src); toast("Image link copied.");
    } catch (_) {
      try { await navigator.clipboard.writeText(image.src); toast("Image link copied."); } catch (__) { toast("Could not copy this image on this device."); }
    }
  }
  async function shareDetailImage() {
    const image = currentDetailImage(); if (!image) return;
    const nativeShare = window.Capacitor?.Plugins?.ShareIntent;
    if (nativeShare?.shareImage) {
      try { await nativeShare.shareImage({ src: image.src, filename: image.baseName, title: image.label }); }
      catch (error) { toast(error?.message || "Could not open Android sharing."); }
      return;
    }
    try {
      const blob = await detailImageBlob(image.src), file = new File([blob], detailImageFilename(image.baseName, blob), { type: blob.type || "image/jpeg" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { await navigator.share({ files: [file], title: image.label }); return; }
      if (navigator.share) { await navigator.share({ title: image.label, text: image.label, url: image.src }); return; }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(image.src); toast("Sharing isn’t available here; image link copied."); return; }
      toast("Sharing isn’t available on this device.");
    } catch (error) {
      if (error?.name === "AbortError") return;
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(image.src); toast("Image link copied."); return; } } catch (_) {}
      toast("Could not share this image.");
    }
  }


  async function shareAchievementBadge(id) {
    try {
      const image = await window.SplitAppAchievements.shareImage(items, roles, id), file = new File([image.blob], image.filename, { type: "image/png" });
      const nativeShare = window.Capacitor?.Plugins?.ShareIntent;
      if (nativeShare?.shareImage) { const src = URL.createObjectURL(image.blob); try { await nativeShare.shareImage({ src, filename: image.filename, title: image.title }); } finally { setTimeout(() => URL.revokeObjectURL(src), 60000); } return; }
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { await navigator.share({ files: [file], title: image.title }); return; }
      const url = URL.createObjectURL(image.blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = image.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); toast("Image saved.");
    } catch (error) { if (error?.name !== "AbortError") toast(error?.message || "Could not share this badge."); }
  }

  function setPreference(key, value) {
    prefs[key] = value;
    if (key === "libraryMemory") {
      applyLibraryMemoryThreshold(value);
      const threshold = ({ auto: 2000, low: 500, minimum: 1 }[value] || Infinity);
      if (items.length >= threshold && window.SplitAppIDB?.compactDetails) {
        for (const item of items) if (item.cachedDetails && !item.cachedDetails.compact) item.cachedDetails = window.SplitAppIDB.compactDetails(item.cachedDetails, item);
        releaseHydratedDetails(0, true);
      }
      trimThumbCache();
      if (value === "off") toast("Full details will load into memory after restarting ScreenMark.");
      else toast("Library memory setting updated.");
    }
    if (key === "bottomBarBackground" && value === "solid") prefs.bottomBarTransparency = 100;
    if (key === "bottomBarBackground" && value === "transparent" && Number(prefs.bottomBarTransparency) >= 100) prefs.bottomBarTransparency = 30;
    persist({ meta: true }); applyPreferences();
    if (key === "metadataMode") { window.dispatchEvent(new Event("screenmark:sync-resume")); maybeAutoMetadataSync(); }
    if (key === "metadataRefreshInterval") scheduleAutomaticMetadataCheck();
    if (key === "backgroundBackups" || key === "backupSchedule" || key === "backupRetention") syncBackupSchedule();
    if (key === "theme") render();
  }
  function openSettingPicker(trigger) {
    let options = [];
    try { options = JSON.parse(trigger.dataset.pickerOptions || "[]").map(entry => { const [value, ...label] = entry.split("|"); return { value, label: label.join("|") }; }); } catch (_) { return; }
    const key = trigger.dataset.settingPicker;
    const kind = trigger.dataset.pickerKind;
    const dialog = $("#setting-picker-dialog");
    const list = $("[data-setting-picker-list]", dialog);
    const title = $("[data-setting-picker-title]", dialog);
    if (!dialog || !list || !title) return;
    title.textContent = trigger.getAttribute("aria-label")?.split(":")[0] || "Choose an option";
    const themeInfo = {
      system:["Match your device's light or dark appearance.","#f8fafc",defaultAccentColor,"#0f172a"],
      light:["Clean white surfaces with warm gold accents.","#f8fafc",defaultAccentColor,"#0f172a"],
      dark:["Charcoal surfaces with soft neutral contrast.","#111827",defaultAccentColor,"#f3f4f6"],
      amoled:["Pure black surfaces with raised charcoal cards.","#000000",defaultAccentColor,"#f8fafc"]
    };
    const settingPreviewIcons = {
      textSize: { small: "type", normal: "text", large: "text-cursor-input" },
      animationSpeed: { off: "pause", fast: "zap", normal: "gauge", slow: "turtle" },
      dateFormat: { auto: "globe", dmy: "calendar", mdy: "calendar", iso: "calendar-days", long: "calendar-check" },
      imageStorage: { all: "images", posters: "image", online: "cloud-off" },
      pageTransition: { slide: "move-right", fade: "cloud", zoom: "zoom-in", none: "ban" },
      sheetAnimation: { slide: "panel-bottom", fade: "cloud", scale: "maximize-2" },
      pressEffect: { shrink: "pointer", fade: "scan-eye", none: "pointer-off" },
      progressStyle: { smooth: "waves", snappy: "zap", spring: "activity" },
      placeholderAnimation: { shimmer: "sparkles", pulse: "circle-dot", static: "pause" },
      bottomBarBackground: { solid: "square", glass: "panels-top-left", transparent: "panels-top-bottom" },
      bottomBarStyle: { "icon-color": "palette", underline: "underline", pill: "pill", minimal: "minus" },
      bottomBarLabels: { "icons-labels": "list", "icons-only": "layout-grid", "labels-only": "text" },
      automaticCompletion: { automatic: "refresh-cw", ask: "message-circle-question", manual: "hand" },
      defaultStatus: Object.fromEntries(config.categories[0].statuses.map(status => [status, statusIcon(status)])),
      backupSchedule: { never: "calendar-x", daily: "calendar-days" },
      backupRetention: { 3: "archive", 5: "archive-restore", 10: "boxes", 20: "warehouse" },
      folderSyncDelay: { 0: "zap", 30: "timer", 60: "alarm-clock", 300: "hourglass" },
      metadataMode: { online: "globe", offline: "wifi-off" },
      metadataRefreshInterval: { daily: "calendar-check", weekly: "calendar-range", monthly: "calendar-days", never: "calendar-x" },
      offlineFallback: { cached: "database", none: "ban" },
      thumbnailSize: { small: "image", medium: "images", large: "gallery-horizontal" },
      syncScope: { needed: "list-checks", missing: "file-question", all: "layers-3" },
      metadataSyncWorkers: { 1: "user-round", 2: "users-round", 3: "users" },
      syncRequestDelay: { 0: "zap", 250: "timer", 1000: "clock-3", 2000: "hourglass" },
      libraryMemory: { auto: "sparkles", low: "gauge", minimum: "memory-stick", off: "database" },
    };
    const settingPreviewDescriptions = {
      bottomBarStyle: { "icon-color": "Tint the selected icon with a soft accent tile.", underline: "Mark the selected destination with an accent line.", pill: "Fill the selected destination with the accent color.", minimal: "Use the accent color without an icon tile." },
      bottomBarLabels: { "icons-labels": "Show the icon and destination name.", "icons-only": "Show destination icons without names.", "labels-only": "Show destination names without icons." },
      animationSpeed: { off: "Disable app motion.", fast: "Use short transitions.", normal: "Use the standard transition timing.", slow: "Use longer, more relaxed transitions." },
      pageTransition: { slide: "Move the new page in from the navigation direction.", fade: "Fade the new page in.", zoom: "Fade and gently scale the new page in.", none: "Change pages without a transition." },
      sheetAnimation: { slide: "Slide menus up from the bottom.", fade: "Fade menus in and out.", scale: "Fade and scale menus in and out." },
      pressEffect: { shrink: "Scale controls down slightly while pressed.", fade: "Fade controls briefly while pressed.", none: "Keep controls still while pressed." },
      progressStyle: { smooth: "Use a smooth ease-out movement.", snappy: "Use a short, quick movement.", spring: "Use a soft spring-like finish." },
      placeholderAnimation: { shimmer: "Move a light band across loading shapes.", pulse: "Gently fade loading shapes in and out.", static: "Keep loading shapes still." },
      syncScope: { needed: "Refresh titles missing details or past their refresh interval.", missing: "Refresh only titles with no saved detail record.", all: "Recheck every saved title from its saved metadata source." },
      metadataSyncWorkers: { 1: "Refresh one title at a time.", 2: "Refresh two titles at once.", 3: "Refresh three titles at once; this uses more network and device resources." },
      syncRequestDelay: { 0: "Start the next title as soon as a worker is free.", 250: "Pause briefly between starting titles.", 1000: "Wait one second before starting the next title.", 2000: "Wait two seconds before starting the next title." },
      libraryMemory: { auto: "Compact detail records at 2,000 titles; cache up to 900 poster URLs.", low: "Start compacting at 500 titles; cache up to 400 poster URLs.", minimum: "Always compact detail records; cache up to 150 poster URLs.", off: "Keep full detail records expanded in memory. Applies after restarting ScreenMark." },
    };
    list.replaceChildren();
    options.forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `setting-picker-option${String(prefs[key]) === option.value ? " active" : ""}`;
      button.setAttribute("aria-pressed", String(String(prefs[key]) === option.value));
      const radio = document.createElement("span"); radio.className = "setting-picker-radio"; radio.setAttribute("aria-hidden", "true");
      let preview;
      let description = "";
      if (kind === "theme") {
        const palette = themeInfo[option.value] || themeInfo.amoled;
        preview = document.createElement("span"); preview.className = "setting-theme-preview";
        preview.style.setProperty("--preview-bg", palette[1]); preview.style.setProperty("--preview-accent", palette[2]); preview.style.setProperty("--preview-text", palette[3]);
        preview.innerHTML = '<i></i><span><b></b><b></b></span>';
        description = palette[0];
      } else if (kind === "palette") {
        preview = document.createElement("span"); preview.className = "setting-color-preview";
        preview.style.setProperty("--choice-color", option.value === "default" ? "var(--d-gold)" : option.value);
        description = option.value === "default" ? "Use ScreenMark’s Discover and watchlist accent." : `Use ${option.label.toLowerCase()} for buttons and highlights.`;
      } else if (key === "bottomBarStyle") {
        preview = document.createElement("span"); preview.className = `setting-nav-style-preview setting-nav-style-${option.value}`;
        preview.innerHTML = `<i data-lucide="${settingPreviewIcons.bottomBarStyle[option.value]}"></i>`;
        description = settingPreviewDescriptions.bottomBarStyle?.[option.value] || "Change the selected destination style.";
      } else {
        preview = document.createElement("span"); preview.className = "setting-option-preview";
        const icon = settingPreviewIcons[key]?.[option.value];
        if (icon) preview.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
        else preview.textContent = "•";
        description = settingPreviewDescriptions[key]?.[option.value] || "";
      }
      const copy = document.createElement("span"); copy.className = "setting-picker-copy";
      const name = document.createElement("strong"); name.textContent = option.label;
      copy.appendChild(name);
      if (description) { const detail = document.createElement("small"); detail.textContent = description; copy.appendChild(detail); }
      button.append(radio, preview, copy);
      button.addEventListener("click", () => { setPreference(key, option.value); render(); closePopup(dialog); });
      list.appendChild(button);
    });
    if (kind === "palette") {
      const defaultColor = document.body.dataset.theme === "light" ? "#6366f1" : "#f5c518";
      const customColor = prefs[key] === "default" ? defaultColor : prefs[key] || "#6366f1";
      const custom = document.createElement("label"); custom.className = "setting-custom-color"; custom.innerHTML = `<span><strong>Custom color</strong><small>Choose any accent color.</small></span><input type="color" data-custom-picker value="${esc(customColor)}" aria-label="Choose a custom accent color">`;
      list.appendChild(custom);
    }
    window.lucide?.createIcons({ root: list, attrs: { "aria-hidden": "true" } });
    showPopup(dialog);
  }
  // Native: stream the library in small chunks to a file the user picks with Android's "Save as" screen
  // (silent: straight into the backup folder, used before destructive actions). Browsers get a normal download.
  let exportRunning = false;
  async function exportNames(format) {
    if (exportRunning) { toast("An export is already running."); return; }
    exportRunning = true;
    try { return await exportNamesBody(format); }
    finally { exportRunning = false; }
  }
  async function exportNamesBody(format) {
    // CSV keeps everything a restore needs to re-link titles (source, source id, id) plus tracking details; TXT is "Title (Year)".
    const columns = ["Title", "Category", "Year", "Status", "Progress", "Goal", "Favorite", "Review", "Source", "SourceID", "ID", "Added", "Updated"];
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const iso = value => Number(value) ? new Date(Number(value)).toISOString() : "";
    const yearOf = item => String(item.year || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
    const content = format === "txt"
      ? items.map(item => { const title = String(item.title || "").replace(/[\r\n]+/g, " ").trim(); return title && `${title}${yearOf(item) ? ` (${yearOf(item)})` : ""}`; }).filter(Boolean).join("\n") + "\n"
      : "\uFEFF" + [columns.map(quote).join(","), ...items.map(item => [item.title, item.category, item.year, item.status, item.progress, item.goal, item.favorite ? "yes" : "", item.review || item.notes, item.metadataSource || item.source || "", item.providerId || "", item.id, iso(item.createdAt), iso(item.updatedAt)].map(quote).join(","))].join("\r\n");
    const mime = format === "txt" ? "text/plain;charset=utf-8" : "text/csv;charset=utf-8";
    const name = `${config.key}-titles-${new Date().toISOString().slice(0, 10)}`;
    try {
      const backend = window.SplitAppBackend;
      if (nativeAndroid && backend?.exportTextFile) {
        const saved = await backend.exportTextFile({ fileName: `${name}.${format}`, mimeType: mime, content });
        toast(`Saved ${saved?.fileName || `${name}.${format}`}.`);
      } else {
        const url = URL.createObjectURL(new Blob([content], { type: mime }));
        const link = document.createElement("a"); link.href = url; link.download = `${name}.${format}`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); toast(`Exported ${items.length} titles as ${format.toUpperCase()}.`);
      }
    } catch (error) { toast(error?.message || "Could not export title names."); }
  }
  async function createEncryptedTransfer({ share = false } = {}) {
    if (!nativeAndroid || !window.SplitAppBackend?.exportLibrary) { toast("Encrypted transfer files are currently available in the Android app."); return; }
    const password = await appPrompt("Create a transfer password (at least 8 characters). You will need it on the receiving device.", { title: "Protect transfer", inputLabel: "New password", confirmLabel: "Continue", autocomplete: "new-password", minLength: 8 });
    if (password == null) return;
    const confirmation = await appPrompt("Enter the transfer password again to confirm.", { title: "Confirm transfer password", inputLabel: "Confirm password", confirmLabel: "Create transfer", autocomplete: "new-password", minLength: 8 });
    if (confirmation == null) return;
    if (password !== confirmation) { toast("The passwords do not match."); return; }
    try {
      toast(share ? "Preparing encrypted transfer to share…" : "Creating encrypted transfer file…");
      await exportList({ password, share });
    } catch (error) { toast(error?.message || "Could not create the encrypted transfer file."); }
  }
  async function exportList(options = {}) {
    if (exportRunning) { toast("An export is already running."); return; }
    exportRunning = true;
    try { return await exportListBody(options); }
    finally { exportRunning = false; if (exportCardShown) { exportCardShown = false; importProgress("Export finished", 1, { done: true, quiet: true }); } }
  }
  async function exportListBody({ silent = false, password = "", share = false } = {}) {
    const backend = window.SplitAppBackend;
    if (password && (!nativeAndroid || !backend?.exportLibrary)) { toast("Password-protected transfer files are currently available in the Android app."); return; }
    if (nativeAndroid && backend?.exportLibrary) {
      let lastToast = 0;
      try {
        if (!silent && !share) toast("Choose where to save your library…");
        const result = await backend.exportLibrary({ items, history, preferences: prefs }, { mode: silent ? "folder" : share ? "share" : "ask", password, onProgress: (done, total, status) => {
          if (status?.notificationsAllowed === false) { toast("Allow notifications to see export progress while ScreenMark is in the background."); lastToast = Date.now(); return; }
          importProgress("Exporting backup…", total ? done / total : null, { quiet: true }); exportCardShown = true;
          if (Date.now() - lastToast > 700 && done < total) { lastToast = Date.now(); toast(`Exporting… ${Math.round(done / total * 100)}%`); }
        } });
        toast(share ? "Encrypted transfer ready to share." : password ? `Encrypted transfer saved: ${result.fileName}. Share it from the location you chose.` : silent ? `Backup saved: ${result.fileName}` : `Exported ${items.length} titles.`);
        return result;
      } catch (error) {
        const message = String(error?.message || error);
        if (!/cancel/i.test(message)) { toast(`Export failed: ${message}`); recordLog("error", `Export failed: ${message}`); }
      }
      return;
    }
    const fileName = `${config.key}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const parts = [`{"app":${JSON.stringify(config.name)},"version":2,"exportedAt":${JSON.stringify(new Date().toISOString())},"index":${JSON.stringify(items.map(item => backend?.backupRefOf ? backend.backupRefOf(item) : { id: String(item.id), source: item.metadataSource || "manual", providerId: String(item.providerId || "") }))},"items":[`];
    for (let offset = 0, first = true; offset < items.length; offset += 8) {
      const batch = backend?.detailedItems ? await backend.detailedItems(items.slice(offset, offset + 8)) : items.slice(offset, offset + 8);
      for (const item of batch) { parts.push((first ? "" : ",") + JSON.stringify(backend?.backupItem ? await backend.backupItem(item) : item)); first = false; }
    }
    parts.push(`],"history":${JSON.stringify(history)},"preferences":${JSON.stringify(prefs)}}`);
    let blob = new Blob(parts, { type: "application/json" }), name = fileName;
    // Large libraries compress ~10x as gzip; the importer reads either form.
    if (typeof CompressionStream === "function") { try { blob = await new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob(); name = `${fileName}.gz`; } catch (_) {} }
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); toast("Export ready.");
  }
  // Backups may be gzip-compressed (.json.gz): detect by name or magic bytes and inflate with the built-in stream.
  async function readBackupText(file) {
    // Decide by content, not by name: a plain JSON file called .gz, or a gzip file called .json, both open.
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (!file.size) throw new Error("This backup file is empty.");
    if (!(head[0] === 0x1f && head[1] === 0x8b)) return file.text();
    if (typeof DecompressionStream !== "function") throw new Error("This device cannot open compressed backups.");
    try { return await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text(); }
    catch (_) { throw new Error("This compressed backup is damaged or incomplete, so it could not be read."); }
  }
  function restoreTransferImages(item) {
    const copy = { ...item }, images = copy.transferImages;
    delete copy.transferImages;
    delete copy.localImageFiles; delete copy.thumbnailPath; delete copy.thumbnailMime; delete copy.localImageFingerprint;
    if (images && typeof images === "object") for (const [key, value] of Object.entries(images)) {
      if (typeof value !== "string" || !/^data:image\//i.test(value)) continue;
    }
    return copy;
  }
  // Runs `worker` over `list` with at most `limit` in flight (order of results is kept).
  async function mapPool(list, limit, worker) {
    const out = new Array(list.length); let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => { for (;;) { const at = next++; if (at >= list.length) return; out[at] = await worker(list[at], at); } }));
    return out;
  }
  async function cacheImportedTransferImages(item, images) {
    if (!images || typeof images !== "object") return;
    const writes = [];
    const artworkEntries = window.SplitAppBackend?.artworkCacheEntries?.(item) || [];
    const decoded = await mapPool(Object.entries(images).filter(([, dataUrl]) => typeof dataUrl === "string" && /^data:image\//i.test(dataUrl)), 4, async ([path, dataUrl]) => [path, await dataUrlToBlob(dataUrl)]);
    for (const [path, blob] of decoded) {
      if (!blob) continue;
      const entry = artworkEntries.find(row => row.paths?.some(imagePath => imagePath.join(".") === path));
      if (entry) writes.push([entry.key, entry.signature, blob]);
      // The grid poster reads its own cache row (<id>:p); without it the imported poster only lives in memory until the next restart.
      if (path === "image") writes.push([thumbKeyOf(item), thumbSigOf(item), blob]);
      const episode = /^cachedDetails\.episodesById\.([^.]+)\.image$/.exec(path);
      if (episode && window.SplitAppIDB?.putThumbs) {
        const row = (item.cachedDetails?.episodesById || {})[episode[1]]
          || (item.cachedDetails?.sections || []).flatMap(section => section?.kind === "episodes" ? section.items || [] : []).find(value => String(value.id) === episode[1]);
        if (row?.image) try { await window.SplitAppIDB.putThumbs([[`${config.key}:episode:${String(item.id)}:${episode[1]}`, row.image, blob]]); } catch (_) {}
      }
    }
    try { if (writes.length) await window.SplitAppIDB?.putThumbs?.(writes); } catch (_) {}
  }
  async function importList(file) {
    if (!file) return;
    recordLog("info", `Library import started: ${file.name || "unnamed file"} (${Number(file.size) || 0} bytes).`);
    try {
      importProgress("Reading backup…");
      const encryptedImportIds = [];
      const fileHead = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const encryptedTransfer = window.SplitAppTransferCrypto?.isEncryptedHeader(fileHead) || /\.sqx$/i.test(file.name || "");
      const transferPassword = encryptedTransfer ? await appPrompt("Enter the password for this encrypted transfer file.", { title: "Unlock transfer", confirmLabel: "Open transfer" }) : "";
      if (encryptedTransfer && transferPassword == null) throw new Error("Import cancelled.");
      importProgress(encryptedTransfer ? "Decrypting transfer…" : "Reading backup…");
      // Big JSON backups are read one title at a time from the stream instead of as one giant string; any problem falls back to the whole-file path.
      let streamed = null;
      if (encryptedTransfer || (/\.(json|gz)$/i.test(file.name) && !/\.sqdb/i.test(file.name) && file.size > 2 * 1024 * 1024)) {
        try { streamed = await window.SplitAppBackupStream.parseFile(file, { password: transferPassword, onBytes: (done, total) => importProgress(`${encryptedTransfer ? "Decrypting & reading" : "Reading"} backup…`, total ? 0.5 * done / total : null) }); } catch (error) { if (encryptedTransfer) throw error; streamed = null; }
      }
      const text = streamed ? "" : await readBackupText(file);
      const parseCsv = value => {
        const rows = []; let row = [], cell = "", quoted = false;
        for (let i = 0; i < value.length; i++) {
          const char = value[i];
          if (quoted && char === '"' && value[i + 1] === '"') { cell += '"'; i++; }
          else if (char === '"') quoted = !quoted;
          else if (!quoted && char === ",") { row.push(cell); cell = ""; }
          else if (!quoted && (char === "\n" || char === "\r")) { if (char === "\r" && value[i + 1] === "\n") i++; row.push(cell); if (row.some(part => part.trim())) rows.push(row); row = []; cell = ""; }
          else cell += char;
        }
        row.push(cell); if (row.some(part => part.trim())) rows.push(row); return rows;
      };
      let data, incoming;
      if (/\.txt$/i.test(file.name)) {
        const key = preferredCategory !== "all" && config.categories.some(cat => cat.key === preferredCategory) ? preferredCategory : config.categories[0].key;
        incoming = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => { const match = line.match(/^(.*?)\s*\(((?:19|20)\d{2})\)\s*$/); return { title: (match ? match[1] : line).trim(), ...(match ? { year: match[2] } : {}), category: key, status: defaultStatus(key) }; }); data = { items: incoming };
      } else if (/\.csv$/i.test(file.name)) {
        const rows = parseCsv(text); if (!rows.length) throw new Error("The CSV file has no title rows.");
        const normalize = value => String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
        const first = rows[0].map(normalize), hasHeader = first.some(value => ["title", "name"].includes(value));
        const headers = hasHeader ? first : ["title", "category", "year", "status", "progress", "goal", "favorite", "review", "source", "sourceid", "id", "added", "updated"];
        const records = (hasHeader ? rows.slice(1) : rows).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
        const fallbackCategory = preferredCategory !== "all" ? preferredCategory : config.categories[0].key;
        incoming = records.map(record => {
          const title = String(record.title || record.name || Object.values(record)[0] || "").trim();
          const categoryKey = config.categories.some(cat => cat.key === record.category) ? record.category : fallbackCategory;
          const cat = config.categories.find(entry => entry.key === categoryKey);
          const { source: csvSource, sourceid: csvSourceId, id: _csvId, added: csvAdded, updated: csvUpdated, favorite: csvFavorite, ...rest } = record;
          return { ...rest, title, category: categoryKey, status: cat?.statuses.includes(record.status) ? record.status : defaultStatus(categoryKey), year: record.year || "", progress: Number(record.progress) || 0, goal: Number(record.goal) || 0, ...(/^(yes|true|1|y)$/i.test(String(csvFavorite || "")) ? { favorite: true } : {}), ...(Date.parse(csvAdded) ? { createdAt: Date.parse(csvAdded) } : {}), ...(Date.parse(csvUpdated) ? { updatedAt: Date.parse(csvUpdated) } : {}), ...(csvSource && csvSource !== "manual" && csvSourceId ? { metadataSource: csvSource, providerId: csvSourceId } : {}) };
        }).filter(item => item.title);
        data = { items: incoming };
      } else if (/\.sqdb$/i.test(file.name) && !/\.gz$/i.test(file.name)) {
        const plugin = window.Capacitor?.Plugins?.EncryptedStore;
        if (!plugin?.importPackedState) throw new Error("Encrypted Android backups can only be restored in the ScreenMark Android app.");
        const restored = await plugin.importPackedState({ packed: text });
        data = restored?.data;
        incoming = Array.isArray(data?.items) ? data.items : null;
        encryptedImportIds.push(...(incoming || []).filter(item => item?.id != null).map(item => String(item.id)));
        if (!incoming) throw new Error("The encrypted backup does not contain a library.");
      } else {
        data = streamed || JSON.parse(text); incoming = Array.isArray(data) ? data : data.items;
      }
      if (!Array.isArray(incoming)) throw new Error("No item list found in this file.");
      if (!Array.isArray(data) && data.app && data.app !== config.name) throw new Error(`This transfer belongs to ${data.app}, not ${config.name}.`);
      importProgress("Matching titles with your library…");
      await new Promise(resolve => setTimeout(resolve, 0));
      const now = Date.now(), idMap = new Map();
      const stamp = value => { const n = Number(value) || Date.parse(value) || 0; return n > 0 && n <= now ? n : now; };
      // Keep the backup's own dates so Timeline and Statistics → Activity show when things really happened.
      const normalized = incoming.filter(item => item && item.title).map(item => {
        const id = crypto.randomUUID();
        if (item.id != null) idMap.set(String(item.id), id);
        const categoryKey = config.categories.some(cat => cat.key === item.category) ? item.category : config.categories[0].key;
        const cleanItem = stripLocalScores(restoreTransferImages(item));
        // Backups carry the source and its id: use them to rebuild the metadata link and to match titles exactly.
        const ref = item.backupRef && typeof item.backupRef === "object" ? item.backupRef : null;
        if (ref) {
          if (!cleanItem.metadataSource && ref.source && ref.source !== "manual") cleanItem.metadataSource = ref.source;
          if (!cleanItem.providerId && ref.providerId) cleanItem.providerId = ref.providerId;
        }
        delete cleanItem.backupRef;
        const normalizedItem = { ...cleanItem, id, category: categoryKey, status: item.status || defaultStatus(categoryKey), createdAt: stamp(item.createdAt), updatedAt: stamp(item.updatedAt) };
        if (item.transferImages && typeof item.transferImages === "object") normalizedItem._transferImagesPending = item.transferImages;
        return normalizedItem;
      });
      const byIdentity = new Map(items.map(item => [titleIdentity(item), item]));
      const fresh = [], patches = [];
      const fillFields = ["favorite", "progress", "goal", "metadataSource", "providerId", "facts", "cachedDetails", "url", "description", "image", "backdrop", "year"];
      const empty = value => value == null || value === "" || value === 0 || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);
      for (const imported of normalized) {
        const existing = (imported.metadataSource && imported.providerId ? itemByProvider(imported.metadataSource, imported.category, imported.providerId) : null) || byIdentity.get(titleIdentity(imported));
        if (!existing) { fresh.push(imported); continue; }
        const patch = {};
        for (const field of [...fillFields, "localThumbnailData", "localPortraitData", "localLandscapeData"]) if (empty(existing[field]) && !empty(imported[field])) patch[field] = imported[field];
        // Keep ScreenMark's episode checklist and per-episode notes when filling an existing title.
        if (Object.keys(patch).length || imported._transferImagesPending) patches.push({ item: existing, patch, transferImages: imported._transferImagesPending || null });
      }
      const duplicateKey = title => String(title || "").toLocaleLowerCase().replace(/^the\s+/, "").replace(/\b(definitive|complete|ultimate|deluxe|enhanced|special|gold|standard|anniversary|remastered|remaster|edition|extended|director'?s cut|remake)\b/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
      const nearDuplicate = (left, right) => {
        if (left.category !== right.category || (left.metadataSource || left.source || "manual") !== (right.metadataSource || right.source || "manual")) return false;
        const a = duplicateKey(left.title), b = duplicateKey(right.title);
        const yearA = String(left.year || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "", yearB = String(right.year || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
        return Boolean(a && b && a === b && (yearA === yearB || !yearA || !yearB) && String(left.title).toLocaleLowerCase() !== String(right.title).toLocaleLowerCase());
      };
      const seenImports = [];
      const collisions = fresh.map(item => {
        const candidates = [...items.filter(existing => nearDuplicate(item, existing)), ...seenImports.filter(existing => nearDuplicate(item, existing))];
        seenImports.push(item); return { item, candidates };
      }).filter(row => row.candidates.length);
      if (collisions.length) {
        const accepted = new Set();
        let dialog = $("#import-duplicate-dialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "import-duplicate-dialog"; dialog.className = "choice-dialog import-duplicate-dialog"; document.body.appendChild(dialog); }
        let position = 0;
        const paint = () => {
          if (position >= collisions.length) { closePopup(dialog); dialog._finishDuplicateReview?.(); return; }
          const row = collisions[position];
          dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">POSSIBLE DUPLICATE · ${position + 1} OF ${collisions.length}</p><h2>${esc(row.item.title)}</h2></div></header><div class="ios-sheet-body"><p>These saved titles look similar:</p><ul>${row.candidates.map(candidate => `<li>${esc(candidate.title)}${candidate.year ? ` · ${esc(candidate.year)}` : ""}</li>`).join("")}</ul></div><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-duplicate-skip>Skip title</button><button type="button" class="button primary" data-duplicate-keep>Import anyway</button></footer>`;
        };
      dialog.onclick = event => {
        if (event.target === dialog) { closePopup(dialog); dialog._finishDuplicateReview?.(); return; }
        if (eventClosest(event, "[data-duplicate-keep]")) accepted.add(rowItemId());
        if (!eventClosest(event, "[data-duplicate-keep],[data-duplicate-skip]")) return;
        position++; if (position >= collisions.length) { closePopup(dialog); dialog._finishDuplicateReview?.(); return; } paint();
      };
        const rowItemId = () => collisions[position]?.item.id;
        paint(); showPopup(dialog);
        await new Promise(resolve => { dialog._finishDuplicateReview = resolve; });
        const keepIds = accepted;
        for (const collision of collisions) if (!keepIds.has(collision.item.id)) fresh.splice(fresh.indexOf(collision.item), 1);
      }
      const freshIds = new Set(fresh.map(item => item.id));
      let importedHistory = (Array.isArray(data.history) ? data.history : []).filter(entry => entry && idMap.has(String(entry.itemId)) && freshIds.has(idMap.get(String(entry.itemId)))).map(entry => ({ ...entry, itemId: idMap.get(String(entry.itemId)) }));
      if (!importedHistory.length) importedHistory = fresh.filter(item => trackedStatuses.includes(item.status)).map(item => ({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: item.updatedAt }));
      items = [...fresh, ...items]; itemIndexItems = null;
      for (const { item, patch } of patches) {
        Object.assign(item, patch, { updatedAt: Object.keys(patch).length ? Date.now() : item.updatedAt });
        if (Object.keys(patch).length) itemMutationRevisions.set(String(item.id), localMutationRevision + 1);
      }
      const restoredArtItems = [...fresh, ...patches.map(row => row.item)];
      const transferImageMaps = new Map([
        ...fresh.filter(item => item._transferImagesPending).map(item => [String(item.id), item._transferImagesPending]),
        ...patches.filter(row => row.transferImages).map(row => [String(row.item.id), row.transferImages])
      ]);
      restoredArtItems.forEach(item => { delete item._transferImagesPending; });
      if (data.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)) Object.assign(prefs, data.preferences);
      history = [...importedHistory, ...history].sort((a, c) => (Number(c.at) || Date.parse(c.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0));
      recordLibraryChange("imported", `Imported ${fresh.length} ${fresh.length === 1 ? "title" : "titles"}.`, fresh.map(item => item.id));
      importProgress(`Saving ${fresh.length} ${fresh.length === 1 ? "title" : "titles"}…`, 0.55);
      await new Promise(resolve => requestAnimationFrame(resolve));
      await persist({ ids: [...fresh, ...patches.map(row => row.item)].map(item => item.id), meta: true });
      let artDone = 0;
      await mapPool(restoredArtItems, Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2 ? 2 : 3, async item => {
        await cacheImportedTransferImages(item, transferImageMaps.get(String(item.id)));
        artDone += 1;
        if (artDone % 3 === 0 || artDone === restoredArtItems.length) importProgress("Saving covers and images…", 0.55 + 0.37 * artDone / restoredArtItems.length);
      });
      applyPreferences();
      if (encryptedImportIds.length) {
        const retained = new Set(items.map(item => String(item.id)));
        const store = window.Capacitor?.Plugins?.EncryptedStore;
        for (const id of encryptedImportIds) if (!retained.has(id)) await store?.deleteItem?.({ id });
      }
      importProgress("Preparing thumbnails…", 0.95);
      await primeThumbCache(fresh).catch(() => 0);
      const syncing = syncImported([...fresh, ...patches.map(row => row.item)]);
      importProgress(`Imported ${fresh.length} ${fresh.length === 1 ? "entry" : "entries"}`, 1, { done: true });
      render(); setTimeout(fillThumbCache, 800); if (syncing) setTimeout(() => toast(`Syncing ${syncing} ${syncing === 1 ? "title" : "titles"} with their sources. Progress: Metadata Sync → Refresh status.`), 1800); toast(`Imported ${fresh.length} ${fresh.length === 1 ? "entry" : "entries"}${patches.length ? ` and restored details for ${patches.length} existing ${patches.length === 1 ? "title" : "titles"}` : ""}.`);
    } catch (error) { recordLog("error", `Library import failed: ${error.message || "Could not import this file."}`); importProgress(error.message || "Could not import this file.", null, { done: true, error: true }); toast(error.message || "Could not import this file."); }
  }
  function resetAnimations() {
    ["reduceMotion", "animationSpeed", "pageTransition", "sheetAnimation", "pressEffect", "progressAnimation", "progressStyle", "skeletonShimmer", "placeholderAnimation"].forEach(key => { prefs[key] = JSON.parse(JSON.stringify(prefsDefaults[key])); });
    persist({ meta: true }); applyPreferences(); render(); toast("Animation settings restored.");
  }
  function previewAnimations() {
    if (motionIsReduced()) { toast("Motion is reduced on this device."); return; }
    const content = $("#page-content"); if (!content) return;
    document.body.dataset.navDir = "forward"; content.classList.remove("page-route-enter");
    requestAnimationFrame(() => content.classList.add("page-route-enter"));
    toast("Replaying animations.");
  }
  function resetAppearance() {
    ["theme", "textSize", "dateFormat", "mainColor", "showSidebar", "showScrollbars", "bottomBarStyle", "bottomBarLabels", "bottomBarBackground", "bottomBarTransparency"].forEach(key => { prefs[key] = JSON.parse(JSON.stringify(prefsDefaults[key])); });
    prefs.navIcons = { ...prefsDefaults.navIcons };
    prefs.navBar = { order: [...navKeys], visible: { ...prefsDefaults.navBar.visible } };
    persist({ meta: true }); applyPreferences(); render(); toast("Appearance settings restored.");
  }

  $("#page-content").addEventListener("click", event => {
    const shareBadge = eventClosest(event, "[data-share-badge]");
    if (shareBadge) { shareAchievementBadge(shareBadge.dataset.shareBadge); return; }
    const statusToggle = eventClosest(event, "[data-status-toggle]");
    if (statusToggle) {
      const key = statusToggle.dataset.statusToggle, name = statusToggle.dataset.statusName, hidden = new Set(statusOptions.hidden[key] || []);
      if (hidden.has(name)) hidden.delete(name); else hidden.add(name);
      statusOptions.hidden[key] = [...hidden]; saveStatusOptions(); render(); return;
    }
    const statusDelete = eventClosest(event, "[data-status-delete]");
    if (statusDelete) {
      const key = statusDelete.dataset.statusDelete, name = statusDelete.dataset.statusName, row = config.categories.find(entry => entry.key === key);
      const moved = items.filter(item => item.category === key && item.status === name);
      statusOptions.custom[key] = (statusOptions.custom[key] || []).filter(value => value !== name); saveStatusOptions();
      if (moved.length && row) { const fallback = row.statuses[0] || roles.queued; moved.forEach(item => { item.status = fallback; item.updatedAt = Date.now(); }); persist({ ids: moved.map(item => item.id) }); }
      render(); toast(moved.length ? `Status removed. ${moved.length} X moved to ${row?.statuses[0] || "Backlog"}.` : "Status removed."); return;
    }
    const trashRestore = eventClosest(event, "[data-trash-restore]");
    if (trashRestore) { const trash = readTrash(), index = Number(trashRestore.dataset.trashRestore), row = trash[index]; if (row?.item && !itemById(row.item.id)) { items.splice(Math.min(Number(row.index) || 0, items.length), 0, row.item); itemIndexItems = null; writeTrash(trash.filter((_, at) => at !== index)); persist({ ids: [row.item.id] }); render(); toast("Title restored."); } return; }
    const trashDelete = eventClosest(event, "[data-trash-delete]");
    if (trashDelete) { const trash = readTrash(); trash.splice(Number(trashDelete.dataset.trashDelete), 1); writeTrash(trash); render(); return; }
    const openDetailButton = eventClosest(event, "[data-open-details]");
    if (openDetailButton) {
      event.preventDefault();
      event.stopPropagation();
      openDetails(openDetailButton.dataset.id);
      return;
    }
    const watchlistOpen = eventClosest(event, "[data-watchlist-open]");
    if (watchlistOpen && !eventClosest(event, "button, a, input, select, textarea")) { openDetails(watchlistOpen.dataset.watchlistOpen); return; }
    const pill = eventClosest(event, "[data-pill-name]");
    if (pill) {
      const group = pill.closest(".ios-pills");
      group.querySelector('input[type="hidden"]').value = pill.dataset.pillValue;
      group.querySelectorAll("[data-pill-name]").forEach(button => { const on = button === pill; button.classList.toggle("active", on); button.setAttribute("aria-pressed", String(on)); });
      return;
    }
    const addCategoryButton = eventClosest(event, "[data-add-category]");
    if (addCategoryButton) { applyAddCategory(addCategoryButton.dataset.addCategory); return; }
    const rewatchButton = eventClosest(event, "[data-rewatch]");
    if (rewatchButton) { const item = itemById(detailItemId); if (item?.status === roles.done) { item.rewatchCount = Math.max(0, Number(item.rewatchCount) || 0) + 1; item.lastRewatchedAt = Date.now(); item.updatedAt = Date.now(); history.unshift({ itemId: item.id, title: item.title, action: "Rewatched", status: roles.done, at: Date.now() }); persist({ ids: [item.id] }); render(); toast("Rewatch logged."); } return; }
    const detailStatus = eventClosest(event, "[data-detail-status-btn]");
    if (detailStatus) {
      const item = itemById(detailItemId);
      if (item) {
        setItemStatus(item, detailStatus.dataset.detailStatusBtn);
        detailStatus.parentElement.querySelectorAll("[data-detail-status-btn]").forEach(button => button.classList.toggle("active", button === detailStatus));
        if (item.category === "movie") render();
      }
      return;
    }
    const itemMenu = eventClosest(event, "[data-open-item-actions]");
    if (itemMenu) { openItemActions(itemMenu.dataset.openItemActions); return; }
    const fixMatch = eventClosest(event, "[data-fix-match]");
    if (fixMatch) { event.preventDefault(); event.stopPropagation(); openFixMatch(fixMatch.dataset.fixMatch); return; }
    const changeCover = eventClosest(event, "[data-change-cover]");
    if (changeCover) { event.preventDefault(); event.stopPropagation(); openCoverPicker(changeCover.dataset.changeCover); return; }
    const detailImage = eventClosest(event, "[data-detail-image-src]");
    if (detailImage) {
      showDetailImage($$("[data-detail-image-src]", $("#page-content")).indexOf(detailImage));
      return;
    }
    if (eventClosest(event, "[data-detail-image-rotate]")) { rotateDetailImage(); return; }
    if (eventClosest(event, "[data-detail-image-download]")) { downloadDetailImage(); return; }
    if (eventClosest(event, "[data-detail-image-copy]")) { copyDetailImage(); return; }
    if (eventClosest(event, "[data-detail-image-share]")) { shareDetailImage(); return; }
    if (eventClosest(event, "[data-detail-image-close]")) { closePopup($("#detail-image-modal")); return; }
    if (eventClosest(event, "[data-detail-image-prev]")) { showDetailImage(detailImagePosition - 1); return; }
    if (eventClosest(event, "[data-detail-image-next]")) { showDetailImage(detailImagePosition + 1); return; }
    if (event.target.id === "detail-image-modal") { closePopup(event.target); return; }
    const backLink = eventClosest(event, "[data-back]");
    if (backLink && inAppNav) { event.preventDefault(); window.history.back(); return; }
    const internalRouteLink = eventClosest(event, 'a[href^="#"]');
    if (internalRouteLink) {
      const target = internalRouteLink.getAttribute("href") || "";
      const routeName = target.slice(1).split(/[/?#]/, 1)[0];
      if (hasPage(routeName) && target !== location.hash) {
        event.preventDefault();
        const nextUrl = new URL(location.href); nextUrl.search = ""; nextUrl.hash = target.slice(1);
        try { window.history.pushState({ page: routeName }, "", nextUrl); syncRouteFromHash(); }
        catch (_) { location.hash = target.slice(1); }
        return;
      }
    }
    const csType = eventClosest(event, "[data-cs-type]");
    if (csType) {
      const input = $("#custom-source-form")?.elements.categories, key = csType.dataset.csType;
      const chosen = new Set(String(input?.value || "").split(",").filter(Boolean));
      if (chosen.has(key) && chosen.size > 1) chosen.delete(key); else chosen.add(key);
      if (input) input.value = [...chosen].join(",");
      $$("[data-cs-type]").forEach(button => { const on = chosen.has(button.dataset.csType); button.classList.toggle("active", on); button.setAttribute("aria-pressed", String(on)); });
      return;
    }
    const csInsert = eventClosest(event, "[data-cs-insert]");
    if (csInsert) { const input = $("#custom-source-form")?.elements.searchUrl; if (input) { const at = input.selectionStart ?? input.value.length; input.setRangeText(csInsert.dataset.csInsert, at, input.selectionEnd ?? at, "end"); input.focus(); } return; }
    const sourceKeyToggle = eventClosest(event, "[data-toggle-source-key]");
    if (sourceKeyToggle) {
      const input = $(`[data-source-api-key="${CSS.escape(sourceKeyToggle.dataset.toggleSourceKey)}"]`);
      if (input) { const reveal = input.type === "password"; input.type = reveal ? "text" : "password"; sourceKeyToggle.textContent = reveal ? "Hide" : "Show"; sourceKeyToggle.setAttribute("aria-label", `${reveal ? "Hide" : "Show"} API key`); sourceKeyToggle.setAttribute("aria-pressed", String(reveal)); }
      return;
    }
    const sourceTest = eventClosest(event, "[data-test-metadata-source]");
    if (sourceTest) { testMetadataSource(sourceTest.dataset.testMetadataSource, sourceTest); return; }
    if (eventClosest(event, "[data-custom-source-test]")) { testCustomSourceForm(); return; }
    if (eventClosest(event, "[data-custom-source-delete]")) { deleteCustomSource(); return; }
    const statsCategoryButton = eventClosest(event, "[data-stats-category]");
    if (statsCategoryButton) { statsCategory = statsCategoryButton.dataset.statsCategory === "movie" ? "movie" : "series"; render(); return; }
    const rangeButton = eventClosest(event, "[data-stats-range]");
    if (rangeButton) { statsRange = rangeButton.dataset.statsRange === "month" ? "month" : "week"; statsActivityDate = ""; render(); return; }
    const activityDay = eventClosest(event, "[data-stats-activity-date]");
    if (activityDay) { statsActivityDate = activityDay.dataset.statsActivityDate; render(); return; }
    const adjust = eventClosest(event, "[data-adjust-progress]");
    if (adjust) {
      const item = itemById(detailItemId);
      if (item) {
        const amount = Number(adjust.dataset.adjustProgress);
        const stepped = stepEpisodes(item, amount);
        if (!stepped) item.progress = Math.max(0, (Number(item.progress) || 0) + amount);
        else if (!stepped.changed) { toast("No released episodes are available to mark yet."); return; }
        item.updatedAt = Date.now();
        if (item.category === "series" && amount > 0) { item.lastProgressAt = item.updatedAt; item.status = roles.active; }
        if (item.category === "series") finishSeriesIfComplete(item, window.SplitAppLibrary.episodeInfo(item));
        if (item.category !== "series" && item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic" && item.status !== roles.done) { item.status = roles.done; history.unshift({ itemId: item.id, title: item.title, action: roles.done, status: roles.done, at: Date.now() }); toast(`Marked as ${roles.done}.`); }
        persist({ ids: [item.id] }); render();
        if (stepped?.skippedUpcoming) toast(`Skipped ${stepped.skippedUpcoming} upcoming ${stepped.skippedUpcoming === 1 ? "episode" : "episodes"}.`);
      }
      return;
    }
    const stepper = eventClosest(event, "[data-step-input]");
    if (stepper) {
      const input = $("#item-form")?.elements[stepper.dataset.stepInput];
      if (input) { input.value = Math.max(0, (Number(input.value) || 0) + Number(stepper.dataset.step)); input.dispatchEvent(new Event("input", { bubbles: true })); }
      return;
    }
    const cancelAdd = eventClosest(event, "[data-cancel-add]");
    if (cancelAdd) { entryDraftId = null; goto(addReturnPage); return; }
    const entryStatus = eventClosest(event, "[data-entry-status]");
    if (entryStatus) {
      const form = entryStatus.closest("form");
      if (form?.elements.status) form.elements.status.value = entryStatus.dataset.entryStatus;
      entryStatus.parentElement?.querySelectorAll("[data-entry-status]").forEach(button => {
        const selected = button === entryStatus; button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected));
      });
      return;
    }
    const clearCookies = eventClosest(event, "[data-source-clear-cookies]");
    if (clearCookies) {
      const key = clearCookies.dataset.sourceClearCookies, provider = window.SplitAppSources.list().find(row => row.key === key);
      if (prefs.sourceOptions[key]) { delete prefs.sourceOptions[key].cookies; if (!Object.keys(prefs.sourceOptions[key]).length) delete prefs.sourceOptions[key]; }
      const host = window.SplitAppMetadata.cleanDomain(prefs.sourceOptions[key]?.domain) || provider?.domain;
      try { window.Capacitor?.Plugins?.CapacitorCookies?.clearCookies?.({ url: `https://${host}` }); } catch (_) {}
      persist({ meta: true }); render(); toast("Cookies cleared."); return;
    }
    const reviewProvider = eventClosest(event, "[data-review-provider-session]");
    if (reviewProvider) {
      const key = reviewProvider.dataset.reviewProviderSession, plugin = window.Capacitor?.Plugins?.ProviderSession;
      const url = key === "imdb" ? "https://www.imdb.com/" : key === "rottentomatoes" ? "https://www.rottentomatoes.com/" : "";
      (async () => {
        try {
          if (!url) throw new Error("Unsupported provider.");
          if (plugin?.reviewProvider) await plugin.reviewProvider({ provider: key });
          else window.open(url, "_blank", "noopener,noreferrer");
          toast(`${key === "imdb" ? "IMDb" : "Rotten Tomatoes"} session ready.`);
          if (page === "discover" && discoverSource === key && discoverQuery.trim()) submitDiscover();
          else if (page === "details" && detailRef && (detailRef.extra?.source === key || itemById(detailItemId)?.metadataSource === key)) loadDetailRef();
          else if (page === "details" && detailItemId && itemById(detailItemId)?.metadataSource === key) loadDetails(detailItemId, true);
        } catch (error) { toast(error?.message || "Could not open the provider."); }
      })();
      return;
    }
    const domainPick = eventClosest(event, "[data-source-domain-pick]");
    if (domainPick) {
      const [key, host] = domainPick.dataset.sourceDomainPick.split("|"), provider = window.SplitAppSources.list().find(row => row.key === key);
      const next = { ...(prefs.sourceOptions[key] || {}) };
      if (host === provider?.domain) delete next.domain; else next.domain = host;
      if (Object.keys(next).length) prefs.sourceOptions[key] = next; else delete prefs.sourceOptions[key];
      persist({ meta: true }); render(); return;
    }
    const resetOptions = eventClosest(event, "[data-source-reset-options]");
    if (resetOptions) { delete prefs.sourceOptions[resetOptions.dataset.sourceResetOptions]; persist({ meta: true }); render(); toast("Source options reset."); return; }
    const go = eventClosest(event, "[data-go]"); if (go) { goto(go.dataset.go); return; }
    const sourceFilter = eventClosest(event, "[data-source-filter]");
    if (sourceFilter) {
      metadataSourceFilter = sourceFilter.dataset.sourceFilter;
      $$('[data-source-filter]').forEach(button => { const selected = button === sourceFilter; button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected)); });
      $$('[data-source-row]').forEach(row => { const enabled = row.dataset.sourceEnabledState === "true"; row.hidden = metadataSourceFilter === "enabled" ? !enabled : metadataSourceFilter === "disabled" ? enabled : false; });
      return;
    }
    const storageAction = eventClosest(event, "[data-storage-action]");
    if (storageAction) { runStorageAction(storageAction.dataset.storageAction); return; }
    const backupFolderAction = eventClosest(event, "[data-backup-folder-action]");
    if (backupFolderAction) {
      if (backupFolderAction.dataset.backupFolderAction === "choose") chooseBackupDatabaseFolder();
      else refreshBackupFolderStatus();
      return;
    }
    if (eventClosest(event, "[data-log-dates-clear]")) { if (settingsGroup === "history") { historyFrom = ""; historyTo = ""; } else { logFrom = ""; logTo = ""; } render(); return; }
    if (eventClosest(event, "[data-open-log-filter]")) { showPopup($("#log-filter-dialog")); return; }
    if (eventClosest(event, "[data-close-log-filter]")) { closePopup($("#log-filter-dialog")); return; }
    const logRangeButton = eventClosest(event, "[data-log-range]");
    if (logRangeButton) {
      const now = new Date(), to = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const fromDate = new Date(now); if (logRangeButton.dataset.logRange !== "today") fromDate.setDate(fromDate.getDate() - Number(logRangeButton.dataset.logRange) + 1);
      const from = new Date(fromDate.getTime() - fromDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      $("[data-log-filter-from]").value = from; $("[data-log-filter-to]").value = to; return;
    }
    if (eventClosest(event, "[data-log-filter-apply]")) {
      const from = $("[data-log-filter-from]")?.value || "", to = $("[data-log-filter-to]")?.value || "";
      if (settingsGroup === "history") { historyFrom = from; historyTo = to; } else { logFrom = from; logTo = to; }
      closePopup($("#log-filter-dialog"), { immediate: true }); render(); return;
    }
    if (eventClosest(event, "[data-log-filter-clear]")) {
      if (settingsGroup === "history") { historyFrom = ""; historyTo = ""; } else { logFrom = ""; logTo = ""; }
      closePopup($("#log-filter-dialog"), { immediate: true }); render(); return;
    }
    const logAction = eventClosest(event, "[data-log-action]");
    if (logAction?.dataset.logAction === "clear") { clearLogcat().then(() => { render(); toast("Logs cleared."); }).catch(error => { recordLog("error", `Log clear failed: ${error?.message || error}`); toast("Could not clear logs."); }); return; }
    if (logAction?.dataset.logAction === "clear-history") {
      appConfirm("This removes saved library activity. The same events will disappear from Timeline and Statistics → Activity. Your tracked titles stay untouched.", { title: "Clear activity history", confirmLabel: "Clear history", danger: true }).then(confirmed => {
        if (!confirmed) return;
        clearLibraryHistory().then(() => { render(); toast("History cleared."); }).catch(error => { recordLog("error", `History clear failed: ${error?.message || error}`); toast("Could not clear history."); });
      });
      return;
    }
    const syncAction = eventClosest(event, "[data-metadata-sync-action]");
    if (syncAction) { if (syncAction.dataset.metadataSyncAction === "start") syncMetadataNow(); else if (syncAction.dataset.metadataSyncAction === "retry") retryMetadataSync(syncAction.dataset.id || null); else if (syncAction.dataset.metadataSyncAction === "clear") clearMetadataSyncState(); else if (syncAction.dataset.metadataSyncAction === "clear-updated") clearMetadataSyncEntries("updated"); else if (syncAction.dataset.metadataSyncAction === "clear-failed") clearMetadataSyncEntries("failed"); else if (syncAction.dataset.metadataSyncAction === "toggle") setMetadataSyncPaused(!metadataSyncPaused); return; }
    const settingPicker = eventClosest(event, "[data-setting-picker]");
    if (settingPicker) { openSettingPicker(settingPicker); return; }
    if (eventClosest(event, "[data-close-setting-picker]")) { closePopup($("#setting-picker-dialog")); return; }
    if (event.target.id === "setting-picker-dialog") { closePopup(event.target); return; }
    const timelineFilterButton = eventClosest(event, "[data-timeline-filter]");
    if (timelineFilterButton) { timelineFilter = timelineFilterButton.dataset.timelineFilter; render(); return; }
    const watchlistTabButton = eventClosest(event, "[data-watchlist-tab]");
    if (watchlistTabButton) { changeWatchlistTab(watchlistTabButton.dataset.watchlistTab); return; }
    if (eventClosest(event, "[data-watchlist-view]")) {
      const kind = page === "movie-watchlist" ? "movie" : "series";
      const current = watchlistViews[kind];
      watchlistViews[kind] = current === "list" ? "posters" : current === "posters" ? "cards" : current === "cards" ? "large" : "list";
      try { localStorage.setItem(`${storageKey}_watchlist_views`, JSON.stringify(watchlistViews)); } catch (_) {}
      render(); syncPageNavigation(); return;
    }
    const setupToggle = eventClosest(event, "[data-setup-toggle]");
    if (setupToggle) {
      const row = setupState.rows[Number(setupToggle.dataset.setupToggle)]; if (!row) return;
      const key = `${row.source}:${row.providerId}`, picks = setupState.picks[setupState.step];
      if (setupToggle.dataset.setupLocked === "true") return;
      const on = !picks.has(key); if (on) picks.set(key, row); else picks.delete(key);
      setupToggle.classList.toggle("selected", on); setupToggle.setAttribute("aria-pressed", String(on));
      const next = $("[data-setup-next]"); if (next) next.textContent = window.SplitAppSetup.footerLabel(setupState);
      return;
    }
    if (eventClosest(event, "[data-setup-next]")) {
      if (setupState.step >= window.SplitAppSetup.stepsFor(setupState).length - 1) { finishSetup(true); return; }
      setupState.step++; setupState.query = ""; render(); loadSetupRows(); window.scrollTo({ top: 0 }); return;
    }
    if (eventClosest(event, "[data-setup-back]")) { if (setupState.step > 0) { setupState.step--; setupState.query = ""; render(); loadSetupRows(); window.scrollTo({ top: 0 }); } return; }
    if (eventClosest(event, "[data-setup-skip]")) { finishSetup(false); return; }
    const coverTitle = eventClosest(event, "[data-cover-title]");
    if (coverTitle) { window.SplitAppPages.browseCover(coverTitle.dataset.coverTitle, coverTitle.dataset.id); render(); scrollPageTop(); return; }
    const coverBack = eventClosest(event, "[data-cover-back]");
    if (coverBack) { window.SplitAppPages.browseCover(coverBack.dataset.coverBack, ""); render(); return; }
    const coverImage = eventClosest(event, "[data-cover-image]");
    if (coverImage) {
      const pickItem = itemById(coverImage.dataset.id), kind = coverImage.dataset.coverImage, chosen = pickItem && window.SplitAppPages.coverCandidates(pickItem, kind)[Number(coverImage.dataset.index)];
      if (chosen) {
        openProfileCrop({ kind, src: chosen.src || chosen.value, title: chosen.label || pickItem.title, onApply: result => {
          const prefix = kind === "avatar" ? "profileAvatar" : "profileCover";
          prefs[prefix + "Pinned"] = String(pickItem.id); prefs[prefix + "PinnedImage"] = result.image; prefs[prefix + "PinnedCrop"] = result.crop;
          setPreference(prefix + "Source", "pinned"); window.SplitAppPages.browseCover(kind, ""); render(); toast(kind === "avatar" ? "Profile photo updated." : "Background updated.");
        } });
      }
      return;
    }
    const coverMore = eventClosest(event, "[data-cover-more]");
    if (coverMore) { window.SplitAppPages.moreCovers(coverMore.dataset.coverMore); render(); return; }
    const coverTabButton = eventClosest(event, "[data-cover-tab]");
    if (coverTabButton) { window.SplitAppPages.setCoverTab(coverTabButton.dataset.coverTab); render(); return; }
    if (eventClosest(event, "[data-profile-avatar-remove]")) { try { localStorage.removeItem("screenmark_profile_avatar"); } catch (_) {} render(); return; }
    if (eventClosest(event, "[data-profile-cover-shuffle]")) { window.SplitAppPages.shuffleProfileCover(items, prefs, eventClosest(event, "[data-profile-cover-shuffle]").dataset.profileCoverShuffle); render(); return; }
    if (eventClosest(event, "[data-open-profile-menu]")) { showPopup($("#profile-options-dialog")); return; }
    if (eventClosest(event, "[data-profile-reorder-open]")) { closePopup($("#profile-options-dialog"), { preserveHistory: true }); showPopup($("#profile-reorder-dialog")); return; }
    if (event.target?.id === "profile-reorder-dialog" || eventClosest(event, "[data-profile-reorder-close]")) { closePopup($("#profile-reorder-dialog")); return; }
    const orderMove = eventClosest(event, "[data-order-move]");
    if (orderMove) {
      const row = orderMove.closest("[data-order-key]"), list = row?.parentElement, target = orderMove.dataset.orderMove === "up" ? row?.previousElementSibling : row?.nextElementSibling;
      if (row && target) {
        if (orderMove.dataset.orderMove === "up") list.insertBefore(row, target); else list.insertBefore(target, row);
        const rows = [...list.querySelectorAll("[data-order-key]")];
        rows.forEach((entry, index) => { entry.querySelector(".profile-reorder-count").textContent = String(index + 1); entry.querySelector('[data-order-move="up"]').disabled = index === 0; entry.querySelector('[data-order-move="down"]').disabled = index === rows.length - 1; });
        const keys = rows.map(entry => entry.dataset.orderKey);
        try { localStorage.setItem("screenmark_profile_section_order", JSON.stringify(keys)); } catch (_) {}
        const sectionList = $("[data-profile-sections]");
        keys.forEach(key => { const section = sectionList?.querySelector(`[data-profile-section="${key}"]`); if (section) sectionList.append(section); });
      }
      return;
    }
    if (eventClosest(event, "[data-profile-add]")) { openItem(); return; }
    if (event.target?.id === "profile-options-dialog") { closePopup(event.target); return; }
    if (eventClosest(event, "[data-profile-menu-close]")) { closePopup($("#profile-options-dialog")); return; }
    if (eventClosest(event, "#profile-options-dialog a")) closePopup($("#profile-options-dialog"), { preserveHistory: true });
    if (eventClosest(event, "[data-open-timeline-filters]")) { showPopup($("#timeline-filter-dialog")); return; }
    if (eventClosest(event, "[data-clear-timeline-filters]")) {
      timelineSearch = ""; timelineMonth = ""; timelineYear = ""; timelineFilter = "all";
      closePopup($("#timeline-filter-dialog")); render(); return;
    }
    const detailRefButton = eventClosest(event, "[data-detail-ref]");
    if (detailRefButton) { const [type, ...rest] = detailRefButton.dataset.detailRef.split(":"); { let extra; try { extra = JSON.parse(detailRefButton.dataset.detailRefExtra || "null"); } catch (_) {} openDetailRef(type, rest.join(":"), detailRefButton.dataset.detailRefTitle, extra, detailRefButton.dataset.refReplace === "true"); } return; }
    if (eventClosest(event, "[data-detail-back]")) { detailBack(); return; }
    if (eventClosest(event, "[data-detail-ref-retry]")) { loadDetailRef(); return; }
    const refPage = eventClosest(event, "[data-detail-ref-page]");
    if (refPage) { detailRefOffset = Math.max(0, Number(refPage.dataset.detailRefPage) || 0); render(); scrollPageTop(); return; }
    const seasonButton = eventClosest(event, "[data-season-toggle]");
    if (seasonButton) {
      const ids = seasonButton.dataset.seasonToggle.split(","), undo = seasonButton.dataset.seasonDone === "true";
      const item = itemById(detailItemId), info = item && window.SplitAppLibrary.episodeInfo(item);
      const rows = info?.eps || [];
      const selected = new Set(ids.map(String));
      const selectedSeasons = [...new Set(rows.filter(row => selected.has(String(row.id))).map(row => Number(row.season)).filter(Number.isFinite))];
      const season = selectedSeasons.length === 1 ? selectedSeasons[0] : null;
      const earlierIds = season === null ? [] : rows.filter(row => Number(row.season) < season).map(row => String(row.id));
      const applySeason = includeEarlier => {
        const applyIds = includeEarlier ? [...new Set([...earlierIds, ...ids])] : ids;
        const skipped = toggleSeason(detailItemId, applyIds, undo);
        if (skipped === null) return;
        const changedCount = applyIds.length - skipped;
        toast(undo ? `${changedCount} episodes marked unwatched.` : `${changedCount} episodes marked watched.${skipped ? ` ${skipped} upcoming ${skipped === 1 ? "episode" : "episodes"} skipped.` : ""}`);
      };
      if (!undo && earlierIds.length) {
        appConfirm(`Also mark earlier seasons of “${item.title}” watched?`, { title: "Previous seasons", confirmLabel: "Yes, mark them" }).then(includeEarlier => applySeason(includeEarlier));
      } else applySeason(false);
      return;
    }
    const caughtUp = eventClosest(event, "[data-watchlist-caught-up]");
    if (caughtUp) { event.preventDefault(); event.stopPropagation(); toast("Caught up. Waiting for the next episode."); return; }
    const episode = eventClosest(event, "[data-episode-toggle]");
    if (episode) {
      const watchlistCard = episode.dataset.watchlistCard || "";
      if (watchlistCard) {
        if (episode.disabled) return;
        episode.disabled = true;
        episode.classList.add("is-checking");
        const itemId = episode.dataset.itemId || detailItemId, episodeId = episode.dataset.episodeId, title = episode.dataset.episodeTitle || "Episode";
        window.setTimeout(() => toggleEpisodeWatched(itemId, episodeId, title, watchlistCard), 120);
      } else toggleEpisodeWatched(episode.dataset.itemId || detailItemId, episode.dataset.episodeId, episode.dataset.episodeTitle || "Episode", "");
      return;
    }
    const movieWatched = eventClosest(event, "[data-watchlist-movie]");
    if (movieWatched) {
      const item = itemById(movieWatched.dataset.watchlistMovie);
      if (!item || item.category !== "movie") return;
      item.status = roles.done; item.progress = Number(item.goal) || Number(item.facts?.runtimeMinutes) || 1; item.updatedAt = Date.now();
      history.unshift({ itemId: item.id, title: item.title, action: "Marked watched", status: item.status, type: "movie", at: item.updatedAt });
      persist({ ids: [item.id] }); render(); toast("Movie marked watched."); return;
    }
    const quick = eventClosest(event, "[data-action=watch-next],[data-action=mark-all-watched],[data-action=toggle-favorite]");
    if (quick) {
      const item = itemById(quick.dataset.id), kind = quick.dataset.action; if (!item) return;
      const info = window.SplitAppLibrary.episodeInfo(item);
      if (kind === "watch-next") { if (info?.next) toggleEpisodeWatched(item.id, info.next.id, `${info.mark(info.next)} ${info.next.title}`); else updateProgress(item.id); }
      else if (kind === "mark-all-watched") { if (info) { const undo = info.done === info.total; appConfirm(`${undo ? "Uncheck" : "Mark as watched"} all ${info.total} episodes of “${item.title}”?`, { title: undo ? "Uncheck all" : "Mark all watched", confirmLabel: undo ? "Uncheck" : "Mark watched" }).then(ok => { if (ok) { const ids = info.eps.map(entry => String(entry.id)), skipped = toggleSeason(item.id, ids, undo); if (skipped !== null) toast(undo ? `${ids.length} episodes marked unwatched.` : `${ids.length - skipped} episodes marked watched.${skipped ? ` ${skipped} upcoming ${skipped === 1 ? "episode" : "episodes"} skipped.` : ""}`); } }); } }
      else { item.favorite = !item.favorite; item.updatedAt = Date.now(); persist({ ids: [item.id] }); render(); toast(item.favorite ? "Added to favorites." : "Removed from favorites."); }
      return;
    }
    const tabButton = eventClosest(event, "[data-detail-tab]");
    if (tabButton) {
      detailTab = tabButton.dataset.detailTab; const root = tabButton.closest(".detail-page");
      root.querySelectorAll("[data-detail-tab]").forEach(button => { const on = button === tabButton; button.classList.toggle("active", on); button.setAttribute("aria-selected", String(on)); });
      root.querySelectorAll("[data-detail-panel]").forEach(panel => { panel.hidden = panel.dataset.detailPanel !== detailTab; });
      prioritizeVisibleDetailImages(root);
      if (detailTab === "cast" && root.querySelector("[data-cast-lazy]")) loadDetailCast();
      return;
    }
    if (eventClosest(event, "[data-setup-download-toggle]")) { if (setupDownloadsPaused) resumeSetupDownloads(); else setSetupDownloadsPaused(true); return; }
    if (eventClosest(event, "[data-setup-download-clear]")) { clearSetupDownloads(); return; }
    const retryDownload = eventClosest(event, "[data-setup-download-retry]");
    if (retryDownload) { retryDownloadButton(retryDownload); return; }
    if (eventClosest(event, "[data-cast-load]")) { loadDetailCast(true); return; }
    const seasonPill = eventClosest(event, "[data-season-pill]");
    if (seasonPill) {
      const root = seasonPill.closest(".season-list"), collapsing = seasonPill.getAttribute("aria-expanded") === "true";
      detailSeason = collapsing ? "" : seasonPill.dataset.seasonPill;
      root.querySelectorAll("[data-season-pill]").forEach(row => { const on = !collapsing && row === seasonPill; row.setAttribute("aria-expanded", String(on)); row.querySelector(".season-accordion-trigger")?.classList.toggle("is-open", on); row.closest(".season-accordion-group")?.classList.toggle("is-open", on); });
      root.querySelectorAll("[data-season-panel]").forEach(panel => { panel.hidden = panel.dataset.seasonPanel !== detailSeason; const lazy = !panel.hidden && panel.querySelector("template[data-lazy-season]"); if (lazy) lazy.replaceWith(lazy.content); });
      return;
    }
    const reactEpisode = eventClosest(event, "[data-episode-react]");
    if (reactEpisode) {
      const item = itemById(reactEpisode.dataset.itemId); if (!item) return;
      item.episodeNotes = item.episodeNotes || {}; const note = { ...(item.episodeNotes[reactEpisode.dataset.episodeId] || {}) };
      if (note.reaction === reactEpisode.dataset.episodeReact) delete note.reaction; else note.reaction = reactEpisode.dataset.episodeReact;
      if (Object.keys(note).length) item.episodeNotes[reactEpisode.dataset.episodeId] = note; else delete item.episodeNotes[reactEpisode.dataset.episodeId];
      if (!Object.keys(item.episodeNotes).length) delete item.episodeNotes;
      item.updatedAt = Date.now(); persist({ ids: [item.id] }); render(); return;
    }
    const layoutToggle = eventClosest(event, "[data-ratings-layout]");
    if (layoutToggle) {
      const grid = layoutToggle.closest(".ep-ratings"), next = layoutToggle.dataset.ratingsLayout === "horizontal" ? "horizontal" : "vertical";
      grid.dataset.layout = next; grid.dataset.layoutMode = "manual";
      syncRatingsLayoutControls(grid, next, false);
      try { localStorage.setItem("screenmark_ratings_layout", next); } catch (_) {}
      return;
    }
    const expandCast = eventClosest(event, "[data-carousel-expand]");
    if (expandCast) { const carousel = expandCast.closest(".detail-section")?.querySelector(".detail-carousel"); const open = carousel?.classList.toggle("expanded"); expandCast.textContent = open ? "Collapse" : "Full list"; return; }
    const action = eventClosest(event, "[data-action]");
    if (action) { if (action.dataset.action === "add") openItem(); else if (action.dataset.action === "progress") updateProgress(action.dataset.id); else if (action.dataset.action === "edit") { if (page === "details") { detailEditMode = true; render(); } else openEdit(action.dataset.id); } else if (action.dataset.action === "cancel-detail-edit") { detailEditMode = false; render(); } else if (action.dataset.action === "details") openDetails(action.dataset.id); else if (action.dataset.action === "refresh-details") loadDetails(); else if (action.dataset.action === "delete-detail") requestDeleteDetails(action.dataset.id); else if (action.dataset.action === "save-detail-item") { const saved = addDiscoverResult(detailPreview); if (saved) { detailPreview = null; detailItemId = saved.id; detailData = null; loadDetails(); } } return; }
    const deleteButton = eventClosest(event, "#delete-item"); if (deleteButton) { deleteItem(deleteButton.dataset.id); return; }
    const settingAction = eventClosest(event, "[data-setting-action]");
    if (settingAction && settingAction.type !== "file") {
      const key = settingAction.dataset.settingAction;
      if (key === "export") exportList(); else if (key === "export-encrypted") createEncryptedTransfer(); else if (key === "export-share") createEncryptedTransfer({ share: true }); else if (key === "export-txt") exportNames("txt"); else if (key === "export-csv") exportNames("csv"); else if (key === "sync-metadata") syncMetadataNow(); else if (key === "resetAnimations") resetAnimations(); else if (key === "previewAnimations") previewAnimations(); else if (key === "resetAppearance") resetAppearance();
      else if (key.startsWith("clear-")) {
        clearAppCaches(key === "clear-images" ? "images" : key === "clear-metadata" ? "metadata" : "temporary");
        toast("Temporary cache cleared.");
      }
      return;
    }
    const cardText = eventClosest(event, ".discover-catalog-card h3, .discover-catalog-card > small, .discover-catalog-card > .discover-catalog-genres");
    if (cardText) { cardText.closest(".discover-catalog-card")?.querySelector("[data-discover-details]")?.click(); return; }
    const sourceDetails = eventClosest(event, "[data-discover-details]"); if (sourceDetails) { openDiscoverDetails($("#discover-results")._results?.[Number(sourceDetails.dataset.discoverDetails)]); return; }
    if (eventClosest(event, "[data-open-profile-filters]")) { showPopup($("#profile-filter-dialog")); return; }
    if (eventClosest(event, "[data-profile-filter-close]")) { closePopup($("#profile-filter-dialog")); return; }
    if (eventClosest(event, "[data-profile-filter-reset]")) { profileStatusFilter = "all"; profileGenreFilter = "all"; profileCollectionSort = "alpha"; render(); const dialog = $("#profile-filter-dialog"); if (dialog) showPopup(dialog, { silent: true }); return; }
    const sortChoice = eventClosest(event, "[data-profile-sort-choice]");
    if (sortChoice) { profileCollectionSort = sortChoice.dataset.profileSortChoice || "alpha"; render(); const dialog = $("#profile-filter-dialog"); if (dialog) showPopup(dialog, { silent: true }); return; }
    const statusChoice = eventClosest(event, "[data-profile-status-choice]");
    if (statusChoice) { profileStatusFilter = statusChoice.dataset.profileStatusChoice || "all"; render(); const dialog = $("#profile-filter-dialog"); if (dialog) showPopup(dialog, { silent: true }); return; }
    const genreChoice = eventClosest(event, "[data-profile-genre-choice]");
    if (genreChoice) { profileGenreFilter = genreChoice.dataset.profileGenreChoice || "all"; render(); const dialog = $("#profile-filter-dialog"); if (dialog) showPopup(dialog, { silent: true }); return; }
    if (eventClosest(event, "[data-profile-groups]")) { profileStatusGroups = !profileStatusGroups; render(); return; }
    const discoverAdd = eventClosest(event, "[data-discover-add]"); if (discoverAdd) {
      const result = $("#discover-results")._results?.[Number(discoverAdd.dataset.discoverAdd)];
      addDiscoverResult(result);
      refreshDiscoverSavedActions(); return;
    }
  });
  const watchlistSwipeIgnoredTarget = target => target?.closest?.("input, select, textarea, dialog, .watchlist-view-toggle");
  const watchlistSwipeStart = (x, y, target, id) => {
    if ((page !== "series-watchlist" && page !== "movie-watchlist") || watchlistSwipeIgnoredTarget(target)) { watchlistSwipe = null; return; }
    if (!target?.closest?.(".watchlist-page")) { watchlistSwipe = null; return; }
    watchlistSwipe = { id, x, y, tab: watchlistTab };
  };
  const watchlistSwipeEnd = (x, y, id) => {
    const swipe = watchlistSwipe;
    if (!swipe || (id != null && swipe.id != null && swipe.id !== id)) return;
    watchlistSwipe = null;
    const dx = x - swipe.x, dy = y - swipe.y;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx < 0 && swipe.tab === "watchlist") changeWatchlistTab("upcoming");
    else if (dx > 0 && swipe.tab === "upcoming") changeWatchlistTab("watchlist");
  };
  $("#page-content").addEventListener("touchstart", event => {
    if (event.touches.length !== 1) { watchlistSwipe = null; return; }
    const touch = event.touches[0]; watchlistSwipeStart(touch.clientX, touch.clientY, event.target, touch.identifier);
  }, { passive: true });
  $("#page-content").addEventListener("touchend", event => {
    const touch = event.changedTouches[0]; if (touch) watchlistSwipeEnd(touch.clientX, touch.clientY, touch.identifier);
  }, { passive: true });
  $("#page-content").addEventListener("touchcancel", () => { watchlistSwipe = null; }, { passive: true });
  $("#page-content").addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || !event.isPrimary || event.button !== 0) return;
    watchlistSwipeStart(event.clientX, event.clientY, event.target, event.pointerId);
  }, { passive: true });
  $("#page-content").addEventListener("pointerup", event => {
    if (event.pointerType !== "mouse") return;
    watchlistSwipeEnd(event.clientX, event.clientY, event.pointerId);
  }, { passive: true });
  $("#page-content").addEventListener("pointercancel", () => { watchlistSwipe = null; }, { passive: true });
  $("#page-content").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const watchlistCard = eventClosest(event, "[data-watchlist-open]");
    if (watchlistCard && event.target === watchlistCard) { event.preventDefault(); openDetails(watchlistCard.dataset.watchlistOpen); return; }
    const row = eventClosest(event, '.season-accordion-row[role="button"][data-season-pill]');
    if (!row || event.target !== row) return;
    event.preventDefault(); row.click();
  });
  document.addEventListener("input", event => {
    const box = event.target?.closest?.("[data-cover-search]"); if (!box) return;
    const needle = box.value.trim().toLocaleLowerCase();
    box.closest(".profile-cover-library")?.querySelectorAll("[data-title]").forEach(tile => { tile.hidden = Boolean(needle) && !tile.dataset.title.includes(needle); });
  });
  let importPickerPending = false;
  let importPickerRenderTimer = 0;
  document.addEventListener("click", event => {
    if (event.target?.matches?.("[data-setting-action=import]")) importPickerPending = true;
  }, true);
  document.addEventListener("change", event => {
    const input = event.target;
    if (input.matches("[data-profile-sort]")) { profileCollectionSort = input.value; render(); const dialog = $("#profile-filter-dialog"); if (dialog) showPopup(dialog, { silent: true }); syncPageNavigation(); return; }
    if (input.matches("[data-profile-status]")) { profileStatusFilter = input.value; render(); const dialog = $("#profile-filter-dialog"); if (dialog) showPopup(dialog, { silent: true }); syncPageNavigation(); return; }
    if (input.matches("[data-detail-status]")) {
      const item = itemById(detailItemId);
      if (!item || item.status === input.value) return;
      item.status = input.value;
      item.updatedAt = Date.now();
      if (trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
      persist({ ids: [item.id] });
      return;
    }
    if (input.matches("[data-custom-picker]")) {
      setPreference("mainColor", input.value); render();
      const list = $("[data-setting-picker-list]");
      list?.querySelectorAll(".setting-picker-option").forEach(option => { option.classList.remove("active"); option.setAttribute("aria-pressed", "false"); });
      return;
    }
    if (input.matches("[data-profile-avatar-file]")) {
      const file = input.files?.[0]; input.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      openProfileCrop({ kind: "avatar", src: url, title: file.name, onApply: result => { try { localStorage.setItem("screenmark_profile_avatar", result.image); render(); toast("Profile photo updated."); } catch (_) { toast("Could not save photo."); } } }); return;
    }
    if (input.matches("[data-pref]")) {
      const key = input.dataset.pref; let value = input.type === "checkbox" ? input.checked : input.value;
      if (input.type === "number" || input.type === "range") value = Number(value);
      setPreference(key, value); if (/^profile(Cover|Avatar)/.test(key)) { render(); return; } if (input.type === "range") input.nextElementSibling.value = `${value}%`;
    }
    if (input.matches("[data-api-key]")) { prefs.apiKeys[input.dataset.apiKey] = input.value.trim(); persist({ meta: true }); }
    if (input.matches("[data-source]")) { window.SplitAppSources.setEnabled(prefs, input.dataset.source, input.checked); persist({ meta: true }); }
    if (input.matches("[data-source-enabled]")) {
      window.SplitAppSources.setEnabled(prefs, input.dataset.sourceEnabled, input.checked);
      persist({ meta: true }); render();
    }
    if (input.matches("[data-source-option]")) {
      const [key, field] = input.dataset.sourceOption.split("|");
      const next = { ...(prefs.sourceOptions[key] || {}) }, value = field === "domain" ? window.SplitAppMetadata.cleanDomain(input.value) : input.value.trim();
      if (value) next[field] = value; else delete next[field];
      if (Object.keys(next).length) prefs.sourceOptions[key] = next; else delete prefs.sourceOptions[key];
      if (field === "domain") input.value = value;
      persist({ meta: true }); return;
    }
    if (input.matches("[data-source-api-key]")) {
      const key = input.dataset.sourceApiKey, value = input.value.trim();
      prefs.apiKeys[key] = value;
      // Pasting a key into a source that is switched off turns it on, so the key is not silently ignored.
      if (value && !window.SplitAppSources.isEnabled(key, prefs)) { window.SplitAppSources.setEnabled(prefs, key, true); toast(`${window.SplitAppSources.list().find(row => row.key === key)?.name || "Source"} turned on.`); persist({ meta: true }); render(); return; }
      persist({ meta: true });
    }
    if (input.matches("[data-setting-action=import]")) {
      const file = input.files?.[0];
      importPickerPending = false;
      clearTimeout(importPickerRenderTimer); importPickerRenderTimer = 0;
      if (!file) { recordLog("warning", "Library import picker closed without returning a file."); toast("No file was selected."); return; }
      input.value = ""; importList(file);
    }
  });
  let sourcePointerDrag = null;
  const finishSourcePointerDrag = () => {
    if (!sourcePointerDrag) return;
    const { row, list, moved } = sourcePointerDrag;
    row.classList.remove("dragging");
    sourcePointerDrag = null;
    if (!moved) return;
    prefs.metadataSourceOrder = [...list.querySelectorAll("[data-source-row]")].map(entry => entry.dataset.sourceRow);
    persist({ meta: true }); render();
  };
  document.addEventListener("pointerdown", event => {
    const handle = eventClosest(event, ".metadata-source-row .drag-handle");
    if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;
    const row = handle.closest("[data-source-row]"), list = row?.parentElement;
    if (!row || !list) return;
    sourcePointerDrag = { row, list, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    row.classList.add("dragging");
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener("pointermove", event => {
    const drag = sourcePointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-source-row]");
    if (!target || target === drag.row || target.parentElement !== drag.list || target.hidden) return;
    const rect = target.getBoundingClientRect();
    drag.list.insertBefore(drag.row, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
  }, { passive: false });
  document.addEventListener("pointerup", event => { if (sourcePointerDrag?.pointerId === event.pointerId) finishSourcePointerDrag(); });
  document.addEventListener("pointercancel", event => { if (sourcePointerDrag?.pointerId === event.pointerId) finishSourcePointerDrag(); });
  document.addEventListener("keydown", event => {
    const handle = eventClosest(event, ".metadata-source-row .drag-handle");
    if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const row = handle.closest("[data-source-row]"), list = row?.parentElement;
    const neighbor = event.key === "ArrowUp" ? row?.previousElementSibling : row?.nextElementSibling;
    if (!row || !neighbor || neighbor.hidden) return;
    event.preventDefault();
    list.insertBefore(row, event.key === "ArrowUp" ? neighbor : neighbor.nextSibling);
    prefs.metadataSourceOrder = [...list.querySelectorAll("[data-source-row]")].map(entry => entry.dataset.sourceRow);
    persist({ meta: true }); render();
  });
  document.addEventListener("click", event => {
    if (!eventClosest(event, "[data-discover-view-toggle]")) return;
    const next = ({ grid: "list", list: "cards", cards: "grid" })[document.body.dataset.discoverView] || "list";
    document.body.dataset.discoverView = next;
    try { localStorage.setItem(`${storageKey}_discover_view`, next); } catch (_) {}
    if (next === "cards") enrichCardBackdrops();
  });
  document.addEventListener("input", event => {
    if (event.target.matches?.("[data-collection-search]")) {
      window.SplitAppPages.setCollectionSearch?.(event.target.dataset.collectionSearch, event.target.value);
      render(); return;
    }
    if (event.target.matches?.("[data-setup-search]")) {
      setupState.query = event.target.value; setupRequest++; clearTimeout(setupSearchTimer);
      setupSearchTimer = setTimeout(loadSetupRows, 350); return;
    }
    if (event.target.id === "discover-query") { discoverQuery = event.target.value; const clearButton = $("[data-discover-clear]"); if (clearButton) clearButton.hidden = !discoverQuery.trim(); syncDiscoverTypeTabs(); return; }
    if (event.target.matches("[data-log-search]")) { if (settingsGroup === "history") historyQuery = event.target.value; else logQuery = event.target.value; const list = $(".logcat-list"); if (list) { const query = (settingsGroup === "history" ? historyQuery : logQuery).toLowerCase(); list.querySelectorAll(".logcat-entry").forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); }); } return; }
    if (event.target.matches("[data-detail-notes]")) {
      const item = itemById(detailItemId);
      if (item) { item.notes = event.target.value; item.updatedAt = Date.now(); persist({ ids: [item.id] }); }
      return;
    }
    if (event.target.matches("[data-settings-index-search]")) {
      const query = event.target.value.trim().toLowerCase();
      let hasMatch = false;
      document.querySelectorAll("[data-settings-index-result]").forEach(result => {
        const matches = Boolean(query) && result.dataset.searchValue.includes(query);
        result.hidden = query !== "" && !matches;
        hasMatch ||= matches;
      });
      const results = $("[data-settings-index-results]");
      const categories = $("[data-settings-index-categories]");
      const empty = $("[data-settings-index-empty]");
      if (results) results.hidden = query === "";
      if (categories) categories.hidden = query !== "";
      if (empty) empty.hidden = query === "" || hasMatch;
      return;
    }
    if (event.target.matches("[data-settings-search]")) {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".settings-section").forEach(section => {
        const rows = [...section.querySelectorAll("[data-setting-search-row]")];
        rows.forEach(row => { row.hidden = query !== "" && !row.dataset.settingSearchRow.includes(query); });
        section.hidden = rows.length > 0 && rows.every(row => row.hidden);
      });
      let hasGlobalMatch = false;
      document.querySelectorAll("[data-settings-global-result]").forEach(result => {
        const matches = query !== "" && result.dataset.searchValue.includes(query);
        result.hidden = !matches;
        hasGlobalMatch ||= matches;
      });
      const globalResults = $("[data-settings-global-results]");
      if (globalResults) globalResults.hidden = !hasGlobalMatch;
      return;
    }
  });
  document.addEventListener("submit", event => {
    const statusAdd = event.target.closest("[data-status-add]"), statusRename = event.target.closest("[data-status-rename]");
    if (statusAdd || statusRename) {
      event.preventDefault();
      const form = statusAdd || statusRename, key = form.dataset.statusAdd || form.dataset.statusRename, row = config.categories.find(entry => entry.key === key), name = String(new FormData(form).get(statusAdd ? "status-new" : "status-rename") || "").trim().replace(/\s+/g, " ");
      if (!row || !name) return;
      const old = statusRename ? form.dataset.statusOld : "";
      if (name === old) return;
      if (row.statuses.concat(row.baseStatuses || []).some(value => value.toLocaleLowerCase() === name.toLocaleLowerCase() && value !== old)) { toast("That status already exists."); return; }
      if (statusAdd) { statusOptions.custom[key] = [...(statusOptions.custom[key] || []), name]; saveStatusOptions(); render(); toast("Status added."); return; }
      statusOptions.custom[key] = (statusOptions.custom[key] || []).map(value => value === old ? name : value); saveStatusOptions();
      const renamed = items.filter(item => item.category === key && item.status === old); renamed.forEach(item => { item.status = name; item.updatedAt = Date.now(); });
      if (renamed.length) persist({ ids: renamed.map(item => item.id) });
      render(); toast("Status renamed."); return;
    }
    if (event.target.id === "custom-source-form") saveCustomSource(event);
  });
  document.addEventListener("submit", event => {
    if (!event.target.matches("#timeline-filter-dialog form")) return;
    event.preventDefault();
    const form = event.target;
    timelineSearch = form.elements["timeline-search"].value.trim();
    timelineMonth = form.elements["timeline-month"].value;
    timelineYear = form.elements["timeline-year"].value;
    timelineFrom = form.elements["timeline-from"]?.value || ""; timelineTo = form.elements["timeline-to"]?.value || "";
    closePopup($("#timeline-filter-dialog"), { immediate: true }); render();
  });
  $("#bottom-bar").addEventListener("click", event => {
    const button = eventClosest(event, ".nav-button[data-page]");
    if (!button) return;
    settingsGroup = null;
    goto(button.dataset.page);
  });
  $("#sidebar-nav").addEventListener("click", event => {
    const button = eventClosest(event, ".sidebar-nav-button[data-sidebar-page]");
    if (!button) return;
    settingsGroup = null;
    goto(button.dataset.sidebarPage);
  });
  // ---- Pull to refresh on details, watchlists, and Discover ----
  setPullToRefreshEnabled = (() => {
    const THRESHOLD = 72, MAX = 130; let ptr = null, startY = 0, candidate = false, pulling = false, distance = 0, busy = false;
    const contentTargets = () => page === "discover"
      ? [$("#page-content")].filter(Boolean)
      : page === "series-watchlist" || page === "movie-watchlist"
        ? [$(".watchlist-content"), $(".watchlist-browse")].filter(Boolean)
        : [];
    const setContentPull = (offset, dragging = false) => contentTargets().forEach(target => {
      target.classList.add("ptr-content");
      target.classList.toggle("ptr-dragging", dragging);
      target.style.setProperty("--ptr-push", `${offset}px`);
    });
    const clearContentPull = () => contentTargets().forEach(target => {
      target.classList.remove("ptr-dragging");
      target.style.setProperty("--ptr-push", "0px");
      const targetRef = target;
      window.setTimeout(() => { if (targetRef.isConnected && targetRef.style.getPropertyValue("--ptr-push") === "0px") targetRef.classList.remove("ptr-content"); }, 260);
    });
    const anchorTop = () => {
      const sticky = page === "discover" ? $(".topbar") : $(".watchlist-tabs");
      if (!sticky) return 10 + (window.visualViewport?.offsetTop || 0);
      const rect = sticky.getBoundingClientRect();
      return Math.max(8, rect.bottom + 5);
    };
    const element = () => {
      if (ptr) return ptr;
      ptr = document.createElement("div"); ptr.className = "ptr"; ptr.setAttribute("role", "status"); ptr.setAttribute("aria-live", "polite");
      ptr.innerHTML = '<span class="ptr-bubble"><svg class="ptr-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg><span class="ptr-spinner"></span><svg class="ptr-check" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg><svg class="ptr-error" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m7 7 10 10M17 7 7 17"/></svg></span><span class="ptr-text"></span>';
      document.body.appendChild(ptr); return ptr;
    };
    const show = (state, text, offset) => { const el = element(); el.dataset.state = state; el.querySelector(".ptr-text").textContent = text; el.style.setProperty("--pull", `${offset}px`); el.style.setProperty("--ptr-anchor", `${anchorTop()}px`); el.style.setProperty("--turn", `${Math.min(1, offset / THRESHOLD) * 180}deg`); el.style.setProperty("--ptr-progress", `${["ready", "loading", "done", "error"].includes(state) ? 1 : Math.min(1, offset / THRESHOLD)}`); el.classList.add("show"); };
    const hide = () => { if (ptr) { ptr.classList.remove("show"); ptr.dataset.state = ""; ptr.style.setProperty("--pull", "0px"); } clearContentPull(); };
    const allowed = target => {
      if (!["details", "discover", "series-watchlist", "movie-watchlist"].includes(page) || busy || window.scrollY > 0) return false;
      if (page === "details") return !target.closest?.("input, textarea, select, dialog, [data-detail-image-src], .detail-carousel, .detail-gallery, .ep-ratings-scroll, .season-pills, .detail-tabs");
      if (page === "discover") return !target.closest?.("input, textarea, select, dialog, .topbar");
      return !target.closest?.("input, textarea, select, dialog, .watchlist-tabs");
    };
    const begin = (y, target) => { candidate = allowed(target); startY = y; pulling = false; distance = 0; };
    const move = (y, event) => {
      if (!candidate) return;
      const dy = y - startY;
      if (dy <= 6 || window.scrollY > 0) { if (pulling) { pulling = false; hide(); } return; }
      pulling = true; distance = Math.min(MAX, dy * .55);
      if (event.cancelable) event.preventDefault();
      setContentPull(distance, true);
      show(distance >= THRESHOLD ? "ready" : "pull", distance >= THRESHOLD ? "Release to refresh" : "Pull to refresh", distance);
    };
    const finish = async () => {
      document.removeEventListener("touchmove", onTouchMove);
      const shouldRefresh = pulling && distance >= THRESHOLD; candidate = false; pulling = false;
      if (!shouldRefresh) { hide(); return; }
      busy = true; setContentPull(62); show("loading", "Refreshing…", 62);
      let completedText = "Updated";
      try {
        if (page === "details") await (detailRef ? loadDetailRef() : loadDetails(null, true));
        else if (page === "discover") {
          discoverQuery = $("#discover-query")?.value || discoverQuery;
          if (discoverQuery.trim()) await discover();
          else { suggestionsCache = null; await loadDiscoverSuggestions(); }
        } else {
          const restored = await restoreNativeData({ fast: false });
          if (restored === false) throw new Error("The saved library could not be refreshed.");
          if (restored) render();
          else completedText = "Already up to date";
        }
        setContentPull(62); show("done", completedText, 62);
      } catch (_) { show("error", "Could not refresh", 62); }
      await new Promise(resolve => setTimeout(resolve, 520)); hide(); busy = false;
    };
    let mouseDown = false;
    const onTouchStart = event => {
      if (!event.touches[0]) return;
      begin(event.touches[0].clientY, event.target);
      if (candidate) document.addEventListener("touchmove", onTouchMove, { passive: false });
    };
    const onTouchMove = event => { if (event.touches[0]) move(event.touches[0].clientY, event); };
    const onTouchCancel = () => { document.removeEventListener("touchmove", onTouchMove); candidate = false; pulling = false; hide(); };
    const onMouseDown = event => { if (event.button !== 0 || eventClosest(event, "button, a, label")) return; mouseDown = true; begin(event.clientY, event.target); };
    const onMouseMove = event => { if (mouseDown) move(event.clientY, event); };
    const onMouseUp = () => { if (mouseDown) { mouseDown = false; finish(); } };
    let enabled = false;
    return next => {
      if (enabled === next) return;
      enabled = next;
      const method = next ? "addEventListener" : "removeEventListener";
      document[method]("touchstart", onTouchStart, { passive: true });
      document[method]("touchend", finish, { passive: true });
      document[method]("touchcancel", onTouchCancel, { passive: true });
      document[method]("mousedown", onMouseDown);
      document[method]("mousemove", onMouseMove);
      document[method]("mouseup", onMouseUp);
      if (!next) { document.removeEventListener("touchmove", onTouchMove); mouseDown = false; candidate = false; pulling = false; hide(); }
    };
  })();
  $("#header-type").addEventListener("click", event => {
    const button = eventClosest(event, "[data-discover-category]");
    if (!button || page !== "discover") return;
    discoverQuery = $("#discover-query")?.value ?? discoverQuery;
    discoverCategoryChoice = button.dataset.discoverCategory;
    discoverAbortController?.abort(); discoverAbortController = null;
    suggestionsAbortController?.abort(); suggestionsAbortController = null; suggestionsPendingKey = ""; suggestionsRequest++;
    discoverCache = null;
    suggestionsCache = null;
    discoverSubmitted = "";
    render();
  });
  $("#discover-top-search").addEventListener("submit", event => {
    event.preventDefault();
    submitDiscover();
    event.currentTarget.querySelector("#discover-query")?.blur();
  });
  $("#discover-top-search").addEventListener("click", event => {
    if (!eventClosest(event, "[data-discover-clear]")) return;
    event.preventDefault();
    discoverQuery = ""; discoverSubmitted = ""; discoverSubmittedAt = 0;
    discoverAbortController?.abort(); discoverAbortController = null;
    suggestionsAbortController?.abort(); suggestionsAbortController = null; suggestionsPendingKey = "";
    discoverRequestId++; suggestionsRequest++;
    discoverCache = null;
    const input = $("#discover-query"); if (input) input.value = "";
    const clearButton = $("[data-discover-clear]"); if (clearButton) clearButton.hidden = true;
    const message = $("#discover-message"); if (message) message.textContent = "";
    syncDiscoverTypeTabs();
    const results = $("#discover-results"); if (results) { results.innerHTML = ""; results.setAttribute("aria-busy", "false"); }
    const empty = $("#discover-empty"); if (empty) empty.hidden = false;
    loadDiscoverSuggestions();
    input?.focus();
  });
  function syncDiscoverTypeTabs() {
    const headerType = $("#header-type");
    if (!headerType || page !== "discover") return;
    const source = discoverSource ? window.SplitAppSources.list().find(row => row.key === discoverSource) : null;
    const hasBothCategories = config.categories.filter(row => !source || source.categories.includes(row.key)).length > 1;
    headerType.hidden = !hasBothCategories;
  }
  document.addEventListener("focusin", event => {
    if (event.target.id !== "discover-query") return;
    syncDiscoverTypeTabs();
  });
  document.addEventListener("focusout", event => {
    if (event.target.id !== "discover-query") return;
    syncDiscoverTypeTabs();
  });
  $("[data-close-setting-picker]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); closePopup($("#setting-picker-dialog")); });
  $("#setting-picker-dialog")?.addEventListener("cancel", event => { event.preventDefault(); closePopup(event.currentTarget); });
  function syncRouteFromHash() {
    rememberScroll();
    const [hashPath, hashQuery = ""] = location.hash.slice(1).split("?");
    const route = hashPath.split("/"); const next = route[0];
    if (next === "explore") { goto("settings/metadata-sources", false); historyPush(true); return; }
    if (next === "dashboard" || next === "search") { goto("discover", false); historyPush(true); return; }
    if (next === "settings" && route[1] === "dashboard") { goto("settings", false); historyPush(true); return; }
    if (next === "settings" && route[1] === "nav-layout") { goto("settings", false); historyPush(true); return; }
    if (!hasPage(next)) return;
    if (favoritesNeedSetup(next)) { setupState.mode = next === "movie-favorites" ? "favorites-movie" : "favorites-series"; setupStarted = false; goto("setup", false); historyPush(true); return; }
    if (next === "series-watchlist" || next === "movie-watchlist") watchlistTab = "watchlist";
    if (next !== "discover") { discoverQuery = ""; discoverAbortController?.abort(); discoverAbortController = null; discoverRequestId++; }
    if (next !== "add") { addMetadataQuery = ""; addMetadataRequestId++; entryDraftId = null; }
    else if (page !== "add") { entryDraftId = null; addMetadataQuery = ""; } // opening Add from a link/back is a new entry
    if (next === "details" && detailStack.length) { detailBack(); return; }
    if (next !== "details" || (detailIdFromQuery(hashQuery) || null) !== detailItemId) clearDetailStack();
    const nextDiscoverSource = next === "discover" ? new URLSearchParams(hashQuery).get("source") || "" : "";
    const sourceChanged = next === "discover" && discoverSource !== nextDiscoverSource;
    discoverSource = nextDiscoverSource;
    page = next; achievementId = next === "achievements" ? route[1] || "" : ""; statusName = next === "status" ? decodeURIComponent(route[1] || "") : ""; settingsGroup = next === "settings" ? (route[1] === "manage-backups" ? "backups" : route[1] || null) : null;
    settingsParam = next === "settings" ? new URLSearchParams(hashQuery).get("id") || "" : "";
    statsSubpage = next === "statistics" && statsSections.includes(route[1]) ? normalizeStatsSection(route[1]) : "";
    document.body.dataset.navDir = "back";
    if (next === "details") { const id = detailIdFromQuery(hashQuery); if (id && id !== detailItemId) { detailItemId = id; detailPreview = null; detailData = null; detailError = ""; render(); syncPageNavigation(); loadDetails(); return; } }
    if (next === "statistics" && route[1] && !statsSubpage) historyPush(true);
    render(); syncPageNavigation(); restoreScroll();
    if (sourceChanged && discoverQuery.trim()) { discoverSubmitted = ""; discoverCache = null; submitDiscover(); }
  }
  window.addEventListener("popstate", event => {
    if (skipNextPop) { skipNextPop = false; event.stopImmediatePropagation(); const callback = dialogPopCallback; dialogPopCallback = null; callback?.(); return; }
    const open = document.querySelector("dialog[open]");
    if (open && dialogEntries > 0) { dialogEntries -= 1; closingFromPop = true; closePopup(open); closingFromPop = false; event.stopImmediatePropagation(); }
  });
  // Tapping the dimmed area outside a sheet/dialog closes it.
  document.addEventListener("click", event => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePopup(dialog);
  });
  window.addEventListener("popstate", syncRouteFromHash);
  // Android hardware back: close an open sheet, then step back through pages, then leave the app from Home.
  // Show the version that is actually installed (from the APK), not the one baked into app-config.js.
  window.Capacitor?.Plugins?.App?.getInfo?.().then(info => {
    const version = info?.version || config.version;
    if (!version) return;
    window.APP_INSTALLED_VERSION = version;
    let previous = "";
    try { const seenKey = `${storageKey}_seen_version`; previous = localStorage.getItem(seenKey) || ""; localStorage.setItem(seenKey, version); } catch (_) {}
    if (previous && previous !== version) setTimeout(() => goto("whats-new"), 400);
    if (page === "settings" && settingsGroup === "app-info") render();
  }).catch(() => {});
  window.Capacitor?.Plugins?.App?.addListener?.("backButton", () => {
    const openDialog = document.querySelector("dialog[open]");
    if (openDialog) { closePopup(openDialog); return; }
    if (page !== "series-watchlist" || settingsGroup) { if (window.history.length > 1) window.history.back(); else goto("series-watchlist"); return; }
    window.Capacitor.Plugins.App.exitApp?.();
  });
  window.addEventListener("hashchange", syncRouteFromHash);
  window.addEventListener("storage", event => { if (event.key === storageKey) toast("Library changed in another tab."); });
  window.addEventListener("beforeunload", () => { flushPersist(); saveMetadataSyncState(); window.SplitAppBackend?.flushJournals?.(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(sessionUiTimer); saveSessionUi();
      releaseHydratedDetails(0, true);
      flushPersist(); saveMetadataSyncState(); window.SplitAppBackend?.flushJournals?.();
      clearTimeout(metadataSyncRenderTimer); metadataSyncRenderTimer = 0;
      if (metadataSync) recordLog("info", "Metadata refresh continues while the app runtime is active; unfinished titles resume when the app reopens.");
    } else {
      if (importPickerPending) {
        // Android resumes the WebView before delivering the file-input change event.
        // Re-rendering here replaces the picker input and drops the selected File.
        clearTimeout(importPickerRenderTimer);
        importPickerRenderTimer = setTimeout(() => {
          importPickerRenderTimer = 0;
          if (importPickerPending && metadataSyncState) render();
          importPickerPending = false;
        }, 1200);
      } else if (metadataSyncState) render();
      maybeAutoMetadataSync();
    }
  });
  window.addEventListener("offline", () => { if (page === "details") { render(); if (detailRef && ["person", "character"].includes(detailRef.type)) loadDetailRef(); } });
  window.addEventListener("online", () => { maybeAutoMetadataSync(); if (page === "details") { render(); if (detailRef) loadDetailRef(); else loadDetails(); } });
  document.addEventListener("input", event => {
    if (!event.target.matches("[data-log-search]")) return;
    logQuery = event.target.value; clearTimeout(searchRenderTimer); searchRenderTimer = setTimeout(render, 120);
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-log-from]")) { if (settingsGroup === "history") historyFrom = event.target.value; else logFrom = event.target.value; render(); }
    else if (event.target.matches("[data-log-to]")) { if (settingsGroup === "history") historyTo = event.target.value; else logTo = event.target.value; render(); }
  });
  window.addEventListener("error", event => recordLog("error", event.message || "Unknown page error"));
  window.addEventListener("unhandledrejection", event => recordLog("error", event.reason?.message || event.reason || "Unhandled promise rejection"));
  async function restoreNativeData({ fast = false } = {}) {
    if (!window.SplitAppBackend?.load) return;
    const initialRevision = localMutationRevision;
    // Keep only IDs for conflict resolution. Serializing every record here
    // duplicated the full library as large strings on the UI thread at launch.
    const initialIds = new Set(items.map(item => String(item.id)));
    try {
      const restored = await window.SplitAppBackend.load({ fast });
      if (!restored) return null; // nothing stored locally yet: the caller runs the full restore
      const nativeItems = Array.isArray(restored.items) ? restored.items.filter(item => isRecord(item) && item.id != null && String(item.id) !== "" && config.categories.some(category => category.key === item.category)) : items;
      const nativeHistory = Array.isArray(restored.history) ? restored.history.filter(isRecord) : history;
      const nativePreferences = isRecord(restored.preferences) ? restored.preferences : {};
      const migrateNativeAccentDefault = Number(nativePreferences.accentColorDefaultVersion) < 2;
      const nativeHasLegacyScores = nativeItems.some(item => Object.prototype.hasOwnProperty.call(item, "rating") || Object.values(item.episodeNotes || {}).some(note => Object.prototype.hasOwnProperty.call(note || {}, "rating")));
      const nativeHasLegacyPreferences = ["showRatings", "ratingFormat", "dashboardDensity", "font", "categoryColors", "showThumbnails", "showProgress", ...removedPreferenceKeys].some(key => Object.prototype.hasOwnProperty.call(nativePreferences, key)) || ["rating", "rating-desc", "highest-rated"].includes(nativePreferences.dashboardSort) || Boolean(nativePreferences.theme && !["system", "light", "dark", "amoled"].includes(nativePreferences.theme));
      // Changes made while the folder was loading win over the loaded copy (they used to be overwritten).
      if (localMutationRevision === initialRevision) {
        items = nativeItems; itemIndexItems = null;
        history = nativeHistory;
        if (restored.loadedFromFolder) {
          Object.keys(prefs).forEach(key => delete prefs[key]);
          Object.assign(prefs, JSON.parse(JSON.stringify(prefsDefaults)), nativePreferences);
        } else Object.assign(prefs, nativePreferences);
      } else {
        const currentItems = new Map(items.map(item => [String(item.id), item]));
        const mergedItems = new Map(nativeItems.map(item => [String(item.id), item]));
        if (fullMutationRevision > initialRevision) {
          for (const id of initialIds) if (!currentItems.has(id)) mergedItems.delete(id);
          currentItems.forEach((item, id) => mergedItems.set(id, item));
        } else {
          for (const [id, revision] of itemMutationRevisions) {
            if (revision <= initialRevision) continue;
            const item = currentItems.get(id);
            if (item) mergedItems.set(id, item);
            else mergedItems.delete(id);
          }
        }
        items = [...mergedItems.values()]; itemIndexItems = null;
        if (historyReplaceRevision > initialRevision || fullMutationRevision > initialRevision) history = [...history];
        else history = [...new Map([...history, ...nativeHistory].map(entry => [JSON.stringify(entry), entry])).values()];
        if (metadataMutationRevision > initialRevision || fullMutationRevision > initialRevision) Object.assign(nativePreferences, prefs);
        Object.assign(prefs, nativePreferences);
      }
      if (migrateNativeAccentDefault) {
        if (!nativePreferences.mainColor || nativePreferences.mainColor === "#6366f1") prefs.mainColor = "default";
        prefs.accentColorDefaultVersion = 2;
      }
      items.forEach(stripLocalScores);
      const migratedMixItems = migratedStoredMixItems || migrateLegacyMixItems();
      delete prefs.showRatings; delete prefs.ratingFormat; delete prefs.dashboardDensity; delete prefs.font; delete prefs.categoryColors; delete prefs.showThumbnails; delete prefs.showProgress; removedPreferenceKeys.forEach(key => delete prefs[key]);
      if (!["system", "light", "dark", "amoled"].includes(prefs.theme)) prefs.theme = prefsDefaults.theme;
      if (["rating", "rating-desc", "highest-rated"].includes(prefs.dashboardSort)) prefs.dashboardSort = "alphabetical-asc";
      delete prefs.defaultCategory;
      delete prefs.appLook;
      delete prefs.appDisplayName;
      refreshSourceRegistry();
      normalizeNavigationPrefs();
      normalizeMotionPreferences();
      if (!validMemoryModes.includes(prefs.libraryMemory)) prefs.libraryMemory = prefsDefaults.libraryMemory;
      applyLibraryMemoryThreshold(prefs.libraryMemory);
      if (restored.folderNeedsPersist || pendingStartupMigration || nativeHasLegacyScores || nativeHasLegacyPreferences || migratedMixItems || migrateNativeAccentDefault) await window.SplitAppBackend.save({ items, history, preferences: prefs });
      // Mutation revisions only matter while a restore is in flight; keep the map from growing for the whole session.
      // Per-title revisions are only needed while startup restore overlaps local
      // edits. Retaining them after the final restore makes memory scale with the
      // number of titles edited during a long session.
      if (!fast) itemMutationRevisions.clear();
      return true;
    } catch (error) {
      const errorMessage = String(error?.message || error);
      const cancelled = /user cancelled folder selection|no storage folder was selected/i.test(errorMessage);
      recordLog(cancelled ? "warning" : "error", `App data restore ${cancelled ? "cancelled" : "failed"}: ${errorMessage}`);
      const message = $("#storage-folder-gate-message");
      if (message) message.textContent = `${errorMessage || "ScreenMark could not open its database folder."} Select a storage folder to continue.`;
      return false;
    }
  }
  const storageFolderGate = $("#storage-folder-gate");
  const nativeFolderStorage = Boolean(window.SplitAppBackend?.isNativeFolderStorageAvailable?.());
  const folderGateRetry = $("#storage-folder-gate-retry");
  folderGateRetry?.addEventListener("click", async () => {
    folderGateRetry.disabled = true;
    try {
      const selected = await window.SplitAppBackend.chooseFolder({ items, history, preferences: prefs });
      applySelectedFolderData(selected);
      if (storageFolderGate) storageFolderGate.hidden = true;
      // Fresh install: once the storage folder is chosen (and holds no library), start Quick setup right away.
      if (!items.length && !setupDone() && page !== "setup") { setupStarted = false; setupState.mode = ""; page = "setup"; historyPush(true); }
      applyPreferences(); render(); syncPageNavigation(); syncBackupSchedule();
      // The first full save of a large library is slow; do it in the background instead of holding the gate open.
      Promise.resolve(window.SplitAppBackend.save({ items, history, preferences: prefs })).catch(error => recordLog("error", `App data save failed: ${error?.message || error}`));
      setTimeout(fillThumbCache, 3000);
    } catch (error) {
      const message = $("#storage-folder-gate-message");
      if (message) message.textContent = `${error.message || "ScreenMark could not open that folder."} Choose a folder to continue.`;
    } finally { folderGateRetry.disabled = false; }
  });
  applyPreferences();
  render();
  if (!initialHashPath) historyPush(true);
  if (initialRoute[0] === "dashboard" || initialRoute[0] === "search") historyPush(true);
  if (legacyDashboardSettingsRoute) historyPush(true);
  if (legacyExploreRoute) historyPush(true);
  if (page === "statistics" && initialRoute[1] && !statsSubpage) historyPush(true);
  const systemColorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const syncSystemTheme = () => { if (prefs.theme === "system") { applyPreferences(); render(); } };
  systemColorScheme.addEventListener?.("change", syncSystemTheme);
  if (!systemColorScheme.addEventListener) systemColorScheme.addListener?.(syncSystemTheme);
  if (page === "details" && initialRoute[1] && !detailItemId) {
    const query = new URLSearchParams(initialHashQuery), source = decodeURIComponent(initialRoute[1]), providerId = decodeURIComponent(initialRoute[2] || "");
    const known = window.SplitAppMetadata?.providers?.find(row => row.key === source);
    const kind = query.get("c") || known?.categories?.[0] || "series";
    if (providerId) detailPreview = { id: `${source}:${providerId}`, title: (initialRoute[3] || "").replace(/-/g, " ") || "Title", category: kind, source, metadataSource: source, providerId, status: defaultStatus(kind) };
  }
  if (page === "details" && (detailItemId || detailPreview)) {
    const [refType, refId, refSlug] = (new URLSearchParams(initialHashQuery).get("ref") || "").split("/");
    if (refType && refId) { pushDetailSnapshot(); detailRef = { type: refType, id: refId, title: (refSlug || "").replace(/-/g, " ") }; loadDetailRef(); }
    else loadDetails();
  }
  async function finishStartup(success) {
    libraryRestoreComplete = true;
    if (success) {
      try {
        const launchState = await window.Capacitor?.Plugins?.LaunchState?.consumeResetHome?.();
        if (launchState?.resetHome) {
          page = "series-watchlist";
          detailItemId = null; detailPreview = null; detailData = null; detailError = ""; detailStack = [];
          detailRef = null; refData = null; settingsGroup = null; statsSubpage = "";
          discoverSource = ""; discoverQuery = ""; discoverCache = null;
          savedSessionUi = null; scrollMemory.clear();
          lastVisibleScrollHash = "#series-watchlist"; lastVisibleScrollY = 0;
          inAppNav = false;
          try { window.history.replaceState({ page }, "", "#series-watchlist"); } catch (_) {}
        }
      } catch (_) { /* Keep the saved route if the native launch-state bridge is unavailable. */ }
    }
    // Fresh install (empty library, wizard never finished): open Quick setup first.
    const folderBlocked = !success && nativeFolderStorage && storageFolderGate;
    if (!folderBlocked && success && favoritesNeedSetup(page)) { setupState.mode = page === "movie-favorites" ? "favorites-movie" : "favorites-series"; setupStarted = false; page = "setup"; historyPush(true); }
    if (!folderBlocked && !items.length && !setupDone() && page !== "setup") {
      page = "setup"; historyPush(true);
      if (!success) { applyPreferences(); render(); syncPageNavigation(); }
    }
    if (!success) {
      if (nativeFolderStorage && storageFolderGate) storageFolderGate.hidden = false;
      window.ScreenMarkSplash?.ready?.();
      return;
    }
    initializeAchievementAwards();
    if (storageFolderGate) storageFolderGate.hidden = true;
    applySeriesInactivityTransitions();
    applyPreferences(); render(); syncPageNavigation(); syncBackupSchedule();
    if (savedSessionUi && Number.isFinite(Number(savedSessionUi.scrollY))) {
      const targetY = Math.max(0, Number(savedSessionUi.scrollY) || 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: "instant" });
        if (typeof scheduleVirtualUpdate === "function") scheduleVirtualUpdate();
      }));
      savedSessionUi = null;
    }
    if (page === "details" && detailItemId && !detailPreview) loadDetails();
    window.ScreenMarkSplash?.ready?.();
  }
  let seriesInactivityTimer = 0;
  function scheduleSeriesInactivityCheck(latestActivity = latestEpisodeActivityByItem()) {
    clearTimeout(seriesInactivityTimer); seriesInactivityTimer = 0;
    if (document.hidden) return;
    const now = Date.now(); let nextAt = Infinity;
    for (const item of items) {
      if (item.category !== "series" || ![roles.active, roles.hold].includes(item.status)) continue;
      const progress = Math.max(Number(item.progress) || 0, (item.watchedEpisodeIds || []).length);
      if (!progress) continue;
      const lastProgressAt = Number(item.lastProgressAt) || latestActivity.get(String(item.id)) || Number(item.updatedAt) || Number(item.createdAt) || now;
      const idleLimit = item.status === roles.active ? 7 * 86400000 : 30 * 86400000;
      nextAt = Math.min(nextAt, lastProgressAt + idleLimit);
    }
    if (Number.isFinite(nextAt)) {
      const delay = Math.max(1000, nextAt - now);
      seriesInactivityTimer = setTimeout(() => {
        seriesInactivityTimer = 0;
        if (!document.hidden && applySeriesInactivityTransitions()) render();
      }, Math.min(delay, MAX_TIMEOUT_DELAY));
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearTimeout(seriesInactivityTimer); seriesInactivityTimer = 0; }
    else applySeriesInactivityTransitions();
  });
  // Phase 1: paint the library straight from IndexedDB (instant). Phase 2: reconcile with the saved folder /
  // encrypted store in the background, then fill the device artwork cache.
  restoreNativeData({ fast: true }).then(async fastResult => {
    if (fastResult === true) {
      finishStartup(true);
      // Hydrate episode stills already stored on this device immediately;
      // later full restore may start online cache-fill work if needed.
      const openSeries = page === "details" && detailItemId ? itemById(detailItemId) : null;
      if (openSeries?.category === "series" && openSeries.cachedDetails) {
        if (openSeries.cachedDetails.compact) hydrateDetails(openSeries).then(() => hydrateEpisodeThumbnailCache(openSeries)).catch(() => {});
        else hydrateEpisodeThumbnailCache(openSeries).catch(() => {});
      }
      // Upgrade old inline detail rows after the first paint, in small
      // transactions so migration never competes with startup or scrolling.
      const migrateStoredDetails = async () => {
        if (!window.SplitAppIDB?.migrateDetailsBatch) return;
        try {
          for (;;) {
            if (document.hidden) await new Promise(resolve => document.addEventListener("visibilitychange", resolve, { once: true }));
            await yieldToUser();
            if (window.SplitAppBackend?.isFolderSnapshotBusy?.()) {
              await new Promise(resolve => setTimeout(resolve, 800));
              continue;
            }
            const result = await window.SplitAppIDB.migrateDetailsBatch(25);
            if (result.done) break;
          }
        } catch (error) { console.warn("Could not finish the resumable details-store migration", error); }
      };
      setTimeout(migrateStoredDetails, 3000);
      await new Promise(resolve => setTimeout(resolve, 2500));
      const libraryStamp = () => `${items.length}:${items.reduce((sum, item) => sum + (Number(item.updatedAt) || 0), 0)}`;
      const before = libraryStamp();
      const full = await restoreNativeData();
      if (full === false) finishStartup(false);
      else if (full) { initializeAchievementAwards(); applySeriesInactivityTransitions(); if (libraryStamp() !== before) { applyPreferences(); render(); } } // keep scroll position when nothing changed
      if (full) { checkLibraryDrift(); metadataLibraryReady = true; maybeAutoMetadataSync(); restoreDownloads(); resumeArtworkCaching(); }
      setTimeout(fillThumbCache, 1500);
      setTimeout(shrinkThumbCacheOnce, 8000);
      return;
    }
    // null means "nothing stored yet" (a fresh install), which is a valid empty library, not a failure.
    const full = await restoreNativeData();
    finishStartup(full !== false);
    if (full !== false) { checkLibraryDrift(); metadataLibraryReady = true; maybeAutoMetadataSync(); restoreDownloads(); resumeArtworkCaching(); }
    setTimeout(fillThumbCache, 3000);
    setTimeout(shrinkThumbCacheOnce, 8000);
  });
})();
