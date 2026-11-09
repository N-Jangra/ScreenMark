(() => {
  "use strict";

  const config = window.APP_CONFIG;
  const titles = { discover: "Discover", details: "Details", add: "Add title", timeline: "Timeline", statistics: "Statistics", profile: "Profile", setup: "Quick setup", "profile-cover": "Profile cover", series: "Series", movies: "Movies", "series-favorites": "Series Favorites", "movie-favorites": "Movie Favorites", "series-watchlist": "Shows Watchlist", "movie-watchlist": "Movies Watchlist", settings: "Settings", sync: "Metadata Sync" };
  const hasPage = name => Object.prototype.hasOwnProperty.call(titles, name);
  const navItems = [
    { key: "series-watchlist", label: "Shows", icon: "tv" },
    { key: "movie-watchlist", label: "Movies", icon: "clapperboard" },
    { key: "discover", label: "Discover", icon: "✧" },
    { key: "profile", label: "Profile", icon: "user-round" }
  ];
  const navKeys = navItems.map(item => item.key);
  const prefsDefaults = {
    theme: "system", textSize: "normal", dateFormat: "auto", imageStorage: "all", reduceMotion: false, animationSpeed: "fast", pageTransition: "slide", sheetAnimation: "slide", pressEffect: "shrink", progressAnimation: true, progressStyle: "smooth", skeletonShimmer: true, placeholderAnimation: "shimmer", mainColor: "default", accentColorDefaultVersion: 2,
    profileCoverSource: "both", profileCoverMode: "random", profileCoverInterval: "visit", profileAvatarSource: "custom", profileAvatarMode: "random", profileAvatarInterval: "visit", profileAvatarPinned: "", profileCoverPinned: "", showSidebar: true, showScrollbars: false, bottomBarStyle: "icon-color", bottomBarLabels: "icons-labels", bottomBarBackground: "solid", bottomBarTransparency: 100, navIcons: { discover: "bookmark", "series-watchlist": "tv", "movie-watchlist": "clapperboard", profile: "user-round" },
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
  const removedPreferenceKeys = ["iconStyle", "bottomBarLayout", "progressIncrement", "animationCustom", "animationEasing", "cardEntrance", "animationStagger", "hoverLift", "navBounce"];
  const librarySnapshotKey = `${storageKey}_snapshot`;
  let librarySnapshotTimer = 0;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  let stored = {};
  try { const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}"); if (isRecord(parsed)) stored = parsed; } catch (_) {}
  const storedPreferences = isRecord(stored.preferences) ? stored.preferences : {};
  const prefs = { ...prefsDefaults, ...storedPreferences };
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
  let profileCollectionCacheRevision = -1;
  let discoverSearchFocused = false;
  let watchlistTab = "watchlist";
  let watchlistViews = { series: "list", movie: "list" };
  let watchlistSwipe = null;
  try {
    const savedViews = JSON.parse(localStorage.getItem(`${storageKey}_watchlist_views`) || "{}");
    for (const kind of ["series", "movie"]) if (["list", "posters", "cards"].includes(savedViews[kind])) watchlistViews[kind] = savedViews[kind];
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
  function imageMarkup(item, source, alt = "", fallback = "", className = "") {
    const useLocalThumb = Boolean(item?.id && item.thumbnailPath && !item.localThumbnailData && !item.localPortraitData && !item.customCover);
    if (!source && !useLocalThumb) return fallback;
    const imageSource = useLocalThumb
      ? `data-deferred-image data-local-item-id="${esc(item.id)}" data-lazy-src="${esc(source || "")}"`
      : `src="${esc(source)}"`;
    const placeholder = useLocalThumb ? fallback : fallback.replace(/^(<[a-z][\w-]*)(?=[\s>])/i, "$1 hidden");
    return `<img ${imageSource}${useLocalThumb ? " hidden" : ""}${className ? ` class="${esc(className)}"` : ""} alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.hidden=true;if(this.nextElementSibling)this.nextElementSibling.hidden=false">${placeholder}`;
  }
  window.SplitAppImageMarkup = imageMarkup;
  const category = key => config.categories.find(item => item.key === key) || config.categories[0];
  const labelCategory = key => category(key)?.label || key;
  // Status roles let the shared UI talk about "queued / active / done" without hard-coding status names.
  const roles = { queued: "Backlog", active: "Playing", hold: "On Hold", dropped: "Dropped", done: "Completed", ...(config.statusRoles || {}) };
  const trackedStatuses = [roles.dropped, roles.done, roles.hold, roles.active];
  const statusIcon = status => ({ [roles.queued]: "bookmark", [roles.active]: "circle-play", [roles.hold]: "circle-pause", [roles.dropped]: "circle-x", [roles.done]: "circle-check" })[status] || "circle";
  const defaultStatus = key => category(key)?.statuses?.[0] || roles.queued;
  const seriesProgressComplete = (item, info, progress = Number(item?.progress) || 0) => info?.total ? progress >= info.total : Number(item?.goal) > 0 && progress >= Number(item.goal);
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
  let dialogEntries = 0, skipNextPop = false, closingFromPop = false;
  function pushDialogEntry() { try { window.history.pushState({ dialog: true }, "", location.href); dialogEntries += 1; } catch (_) {} }
  function popDialogEntry() { if (dialogEntries > 0 && window.history.state?.dialog) { dialogEntries -= 1; skipNextPop = true; window.history.back(); } }
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
  function closePopup(dialog, { preserveHistory = false, immediate = false, fromPop = false } = {}) {
    if (!dialog) return;
    if (!immediate && dialog.matches?.(".choice-dialog, dialog.ios-action-sheet") && dialog.open && !dialog.dataset.closeAnimating) {
      const reduced = motionIsReduced();
      const preferredSpeed = prefs.animationSpeed === "fast" ? 120 : prefs.animationSpeed === "slow" ? 280 : 180;
      const speed = document.documentElement.dataset.lowend === "true" ? Math.min(preferredSpeed, 120) : preferredSpeed;
      const duration = reduced ? 0 : Math.min(240, Math.max(0, speed * .8));
      if (duration) {
        const popped = fromPop || closingFromPop;
        dialog.dataset.closeAnimating = "true"; dialog.classList.add("is-closing");
        dialog._closeTimer = window.setTimeout(() => { dialog._closeTimer = 0; dialog.classList.remove("is-closing"); delete dialog.dataset.closeAnimating; closePopup(dialog, { preserveHistory, immediate: true, fromPop: popped }); }, duration);
        return;
      }
    }
    if (typeof dialog.close === "function") {
      try {
        const wasOpen = dialog.open; dialog.close();
        if (wasOpen && !closingFromPop && !fromPop) { if (preserveHistory) dialogEntries = Math.max(0, dialogEntries - 1); else popDialogEntry(); }
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
  function noteLocalMutation(scope, revision) {
    if (!scope || typeof scope !== "object") { fullMutationRevision = revision; historyReplaceRevision = revision; return; }
    if (scope.meta) metadataMutationRevision = revision;
    if (scope.replaceHistory) historyReplaceRevision = revision;
    const ids = [...(scope.ids || []), ...(scope.removed || [])];
    if (!scope.meta && !ids.length) { fullMutationRevision = revision; return; }
    ids.forEach(id => itemMutationRevisions.set(String(id), revision));
  }
  function persist(scope) {
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
  function recordLog(level, message) {
    try {
      const key = `${storageKey}_log`;
      const entries = JSON.parse(localStorage.getItem(key) || "[]");
      const entry = { level, message: String(message), at: new Date().toISOString() };
      entries.unshift(entry);
      localStorage.setItem(key, JSON.stringify(entries.slice(0, 200)));
      window.SplitAppBackend?.appendJournal?.("logcat", entry);
    } catch (_) {}
  }
  function recordLibraryChange(action, detail, ids = []) {
    const key = `${storageKey}_history`;
    const entry = { at: Date.now(), action, detail: String(detail || "").slice(0, 400), ids: ids.slice(0, 60).map(String) };
    try { const rows = JSON.parse(localStorage.getItem(key) || "[]"); rows.unshift(entry); localStorage.setItem(key, JSON.stringify(rows.slice(0, 2000))); } catch (_) {}
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
        const changes = JSON.parse(localStorage.getItem(`${storageKey}_history`) || "[]");
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
  function applyPreferences() {
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
  const restoreScroll = () => {
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
    const route = page === "details" ? detailRoute() : page === "settings" && settingsGroup ? `settings/${settingsGroup}${settingsParam ? `?id=${encodeURIComponent(settingsParam)}` : ""}` : page === "discover" && discoverSource ? `discover?source=${encodeURIComponent(discoverSource)}` : page === "statistics" && statsSubpage ? `statistics/${statsSubpage}` : page;
    const url = new URL(location.href);
    url.search = "";
    url.hash = route;
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== nextUrl) {
      try { window.history[replace ? "replaceState" : "pushState"]({ page, settingsGroup }, "", nextUrl); } catch (_) {}
    }
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
    try { const savedLogs = JSON.parse(localStorage.getItem(`${storageKey}_log`) || "[]"); if (Array.isArray(savedLogs)) logEntries = savedLogs; } catch (_) {}
    if (settingsGroup === "logcat" && !logJournalLoaded) {
      logJournalLoaded = true;
      window.SplitAppBackend?.readJournal?.("logcat").then(rows => { if (page === "settings" && settingsGroup === "logcat" && Array.isArray(rows)) { logEntries = rows; try { localStorage.setItem(`${storageKey}_log`, JSON.stringify(rows.slice(0, 200))); } catch (_) {} render(); } }).catch(() => {});
    }
    let changeLog = [];
    try { const saved = JSON.parse(localStorage.getItem(`${storageKey}_history`) || "[]"); if (Array.isArray(saved)) changeLog = saved; } catch (_) {}
    if (settingsGroup === "history" && !historyJournalLoaded) {
      historyJournalLoaded = true;
      const readRevision = historyJournalRevision;
      window.SplitAppBackend?.readJournal?.("history").then(rows => { if (readRevision === historyJournalRevision && page === "settings" && settingsGroup === "history" && Array.isArray(rows)) { const local = changeLog; const keys = row => `${row.action}|${row.at}|${row.detail || ""}`; changeLog = [...new Map([...rows, ...local].map(row => [keys(row), row])).values()].sort((a, b) => (Number(b.at) || Date.parse(b.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0)); try { localStorage.setItem(`${storageKey}_history`, JSON.stringify(changeLog.slice(0, 2000))); } catch (_) {} render(); } }).catch(() => {});
    }
    const parentForRef = detailRef?.type === "episode" ? itemById(String(detailItemId)) : null;
    const refItem = parentForRef?.category === "series" && (parentForRef.cachedDetails?.sections || []).some(section => section.kind === "episodes" && (section.items || []).some(row => String(row.id) === String(detailRef.id) || String(row.ref?.id) === String(detailRef.id))) ? parentForRef : null;
    return { setup: setupState, statsSubpage, statsCategory, statsActivityDate, statsRange, profileCollectionSort, profileStatusFilter, profileGenreFilter, profileStatusGroups, libraryLoading: !libraryRestoreComplete, watchlistTab, watchlistView: currentWatchlistView(), metadataSyncState, metadataSyncCounts: page === "sync" ? syncCounts() : null, changeLog, history, logQuery, logFrom, logTo, historyQuery, historyFrom, historyTo, timelineFrom, timelineTo, dataRevision: localMutationRevision, itemById, libraryBytes: page === "settings" ? estimateLibraryBytes() : 0, config, prefs, items, logEntries, roles, trackedStatuses, statusIcon, discoverCategory: currentDiscoverCategory(), discoverQuery, addMetadataQuery, settingsGroup, settingsParam, settingsFrom, discoverSource, timelineFilter, timelineSearch, timelineMonth, timelineYear, detailItemId, detailPreview, detailEditMode, editingItem: itemById(String(entryDraftId)) || null, addReturnPage, navItems, metadataSourceFilter, titleIdentity,
      detailData, detailError, detailLoading, detailReturnPage, detailRef, detailRefOffset, refData, refLoading, refError, detailStackSize: detailStack.length, detailTab, detailSeason, detailCastOnline, refItem, category, labelCategory, defaultStatus, esc, imageMarkup, safeLucideName };
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
  const thumbUrlCacheLimit = nativeAndroid ? 48 : 128;
  const thumbKeyOf = item => `${item.id}:p`;
  const thumbSigOf = item => String(item.localImageFingerprint || item.thumbnailPath || "");
  function rememberThumbUrl(key, sig, url) {
    const cacheKey = `${key}|${sig}`;
    for (const [oldKey, oldUrl] of thumbUrlCache) if (oldKey.startsWith(`${key}|`) && oldKey !== cacheKey) { URL.revokeObjectURL(oldUrl); thumbUrlCache.delete(oldKey); }
    if (thumbUrlCache.has(cacheKey)) URL.revokeObjectURL(thumbUrlCache.get(cacheKey));
    thumbUrlCache.delete(cacheKey); thumbUrlCache.set(cacheKey, url);
    while (thumbUrlCache.size > thumbUrlCacheLimit) { const [oldKey, oldUrl] = thumbUrlCache.entries().next().value; URL.revokeObjectURL(oldUrl); thumbUrlCache.delete(oldKey); }
  }
  async function cachedThumbUrls(entries) {
    const found = new Map(), need = [], seen = new Set();
    entries.forEach(([key, sig]) => {
      const cacheKey = `${key}|${sig}`, prefix = `${key}|`;
      for (const [oldKey, oldUrl] of thumbUrlCache) if (oldKey.startsWith(prefix) && oldKey !== cacheKey) { URL.revokeObjectURL(oldUrl); thumbUrlCache.delete(oldKey); found.delete(key); }
      const url = thumbUrlCache.get(cacheKey);
      if (url) { thumbUrlCache.delete(cacheKey); thumbUrlCache.set(cacheKey, url); found.set(key, url); }
      else if (!seen.has(key)) { need.push([key, sig]); seen.add(key); }
    });
    if (need.length && window.SplitAppIDB?.getThumbs) {
      try {
        const sigByKey = new Map(need);
        (await window.SplitAppIDB.getThumbs(need)).forEach(([key, blob]) => {
          const url = URL.createObjectURL(blob);
          rememberThumbUrl(key, sigByKey.get(key), url);
          found.set(key, url);
        });
      } catch (_) {}
    }
    return found;
  }
  // fetch() decodes data: URLs natively, off the JS thread.
  async function dataUrlToBlob(dataUrl) {
    if (!/^data:[^;,]+;base64,/i.test(dataUrl || "")) return null;
    try { return await (await fetch(dataUrl)).blob(); } catch (_) { return null; }
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
  let thumbFillRunning = false;
  async function fillThumbCache() {
    if (thumbFillRunning || !nativeAndroid || !window.SplitAppIDB?.listThumbKeys) return;
    const hydrate = window.SplitAppBackend?.hydrateThumbnails;
    if (typeof hydrate !== "function") return;
    thumbFillRunning = true;
    try {
      const savedKeys = await window.SplitAppIDB.listThumbKeys();
      const liveKeys = new Set(items.filter(item => item.thumbnailPath).map(thumbKeyOf));
      const staleKeys = savedKeys.map(([key]) => key).filter(key => !liveKeys.has(key));
      if (staleKeys.length) {
        await window.SplitAppIDB.deleteThumbs?.(staleKeys);
        const stalePrefixes = staleKeys.map(key => `${key}|`);
        for (const [cacheKey, url] of thumbUrlCache) if (stalePrefixes.some(prefix => cacheKey.startsWith(prefix))) { URL.revokeObjectURL(url); thumbUrlCache.delete(cacheKey); }
      }
      const have = new Map(savedKeys.filter(([key]) => liveKeys.has(key)));
      const missing = items.filter(item => item.thumbnailPath && have.get(thumbKeyOf(item)) !== thumbSigOf(item));
      const batchSize = Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2 ? 2 : 4;
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
      }
    } finally { thumbFillRunning = false; }
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
          while (nativeImageFallbacks.size > 24) {
            const [oldSource, oldUrl] = nativeImageFallbacks.entries().next().value;
            nativeImageFallbacks.delete(oldSource); URL.revokeObjectURL(oldUrl);
          }
        }
        image.addEventListener("load", () => { image.hidden = false; if (image.nextElementSibling) image.nextElementSibling.hidden = true; }, { once: true });
        image.src = objectUrl;
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
        const fallback = image.onerror;
        image.dataset.proxySource = source;
        image.onerror = function (event) {
          if (this.dataset.proxySource && !this.dataset.proxyFallbackTried) {
            this.dataset.proxyFallbackTried = "true"; this.hidden = false; this.src = this.dataset.proxySource; return;
          }
          if (fallback) fallback.call(this, event);
        };
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
      const reveal = () => { image.hidden = false; if (image.nextElementSibling) image.nextElementSibling.hidden = true; };
      image.addEventListener("load", reveal, { once: true });
      image.src = window.SplitAppDiscovery?.imageUrl?.(source) || source;
      if (image.complete && image.naturalWidth) reveal();
    }
    else { image.hidden = true; if (image.nextElementSibling) image.nextElementSibling.hidden = false; }
  }
  async function drainDeferredImages() {
    if (deferredDrain) return deferredDrain;
    deferredDrain = (async () => {
      const hydrate = window.SplitAppBackend?.hydrateThumbnails;
      while (deferredQueue.length) {
        const batchSize = Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2 ? 16 : 40;
        const batch = deferredQueue.splice(0, batchSize);
        const cached = await cachedThumbUrls(batch.map(record => [thumbKeyOf(record.item), thumbSigOf(record.item)]));
        const slow = [];
        for (const record of batch) {
          if (!record.image.isConnected) continue;
          if (record.image.dataset.customCover) { finishDeferredImage(record.image, record.image.dataset.customCover); continue; }
          const hit = cached.get(thumbKeyOf(record.item));
          if (hit) finishDeferredImage(record.image, hit);
          else if (/^https?:/i.test(record.online)) finishDeferredImage(record.image, record.online); // not cached yet: online straight away
          else slow.push(record);
        }
        if (!slow.length || typeof hydrate !== "function") { slow.forEach(record => finishDeferredImage(record.image, record.online)); continue; }
        for (let index = slow.length - 1; index >= 0; index--) if (!slow[index].image.isConnected) slow.splice(index, 1);
        if (!slow.length) continue;
        const clones = slow.map(record => ({ ...record.item, localThumbnailData: "", localPortraitData: "", localLandscapeData: "", backdrop: "", cachedDetails: undefined, localImageFiles: undefined }));
        try { await hydrate(clones); } catch (error) { recordLog("warning", `Could not load saved artwork: ${error?.message || error}`); }
        slow.forEach((record, index) => {
          const local = clones[index].localThumbnailData;
          finishDeferredImage(record.image, local || record.online);
          if (local) dataUrlToBlob(local).then(blob => blob && window.SplitAppIDB?.putThumbs?.([[thumbKeyOf(record.item), thumbSigOf(record.item), blob]])).catch(() => {});
        });
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
    const warm = thumbUrlCache.get(`${thumbKeyOf(item)}|${thumbSigOf(item)}`);
    if (warm) { finishDeferredImage(image, warm); return; }
    if (deferredQueue.length >= 256) { finishDeferredImage(image, online); return; }
    deferredQueue.push({ item, image, online });
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
    images.forEach(image => deferredObserver.observe(image));
  }

  let metadataLibraryReady = false;
  let libraryRestoreComplete = false;
  function render() {
    if (metadataLibraryReady && !metadataSync && metadataSyncState?.entries?.some(entry => ["queued", "running"].includes(entry.status)) && navigator.onLine && prefs.metadataMode !== "offline" && !document.hidden) queueMicrotask(() => startMetadataSync(null, true, "needed", true, true));
    document.body.dataset.page = page;
    $("#page-title").textContent = titles[page];
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
    document.getElementById("collection-toolbar")?.remove();
    disposeContentResources(content);
    if (page === "setup" && !setupStarted) beginSetup(); else if (page !== "setup") setupStarted = false;
    content.innerHTML = window.SplitAppPages[page](pageContext());
    if (page === "setup") { const grid = $("#setup-grid"); if (grid) routeRemoteImages(grid); }
    if (page === "details") prioritizeVisibleDetailImages(content);
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
    if (page === "discover" && discoverCache && discoverCache.source === discoverSource && discoverCache.query === discoverQuery) paintDiscoverResults(discoverCache.results, discoverSource);
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
    window.lucide?.createIcons({ root: $("#discover-top-search"), attrs: { "aria-hidden": "true" } });
    observeDeferredImages(content);
    prioritizeVisibleCollectionImages(content);
    const collectionMore = content.querySelector("[data-collection-more]");
    collectionMore?.addEventListener("click", event => {
      if (window.SplitAppPages.loadMoreCollection?.(event.currentTarget.dataset.collectionMore)) render();
    });
    if (collectionMore && window.IntersectionObserver) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect(); contentObservers.delete(observer); collectionMore.click();
      }, { rootMargin: "900px 0px" });
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
        }, { rootMargin: "900px 0px" });
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
      else if (action === "refresh-details") loadDetails();
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
    content.querySelector("[data-detail-delete-confirm]")?.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); closePopup($("#detail-delete-dialog")); deleteFromDetails(detailItemId);
    });
    content.querySelector("[data-detail-delete-cancel]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); closePopup($("#detail-delete-dialog")); });
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
      closePopup($("#timeline-filter-dialog")); render();
    });
    content.querySelector("#timeline-filter-dialog form")?.addEventListener("submit", event => {
      event.preventDefault(); event.stopPropagation();
      timelineSearch = event.currentTarget.elements["timeline-search"].value.trim();
      timelineMonth = event.currentTarget.elements["timeline-month"].value;
      timelineYear = event.currentTarget.elements["timeline-year"].value;
      timelineFrom = event.currentTarget.elements["timeline-from"]?.value || ""; timelineTo = event.currentTarget.elements["timeline-to"]?.value || "";
      closePopup($("#timeline-filter-dialog")); render();
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
    }));
    content.querySelectorAll("[data-setting-action]").forEach(button => button.addEventListener("click", event => {
      if (button.type === "file") return; // let the file picker open
      event.preventDefault(); event.stopPropagation();
      const key = button.dataset.settingAction;
      if (key === "resetAnimations") resetAnimations();
      else if (key === "previewAnimations") previewAnimations();
      else if (key === "resetAppearance") resetAppearance();
      else if (key === "export") exportList();
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
      thumbUrlCache.clear();
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
    localStorage.removeItem(`${storageKey}_log`);
    await window.SplitAppBackend?.clearJournal?.("logcat");
  }
  async function clearLibraryHistory() {
    historyJournalRevision += 1;
    historyJournalLoaded = true;
    history = [];
    localStorage.removeItem(`${storageKey}_history`);
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
      localStorage.removeItem(`${storageKey}_log`);
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
    if (item.category === "series" && seriesProgressComplete(item, window.SplitAppLibrary.episodeInfo(item), item.progress)) item.status = roles.done;
    if (item.category !== "series" && item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic") item.status = roles.done;
    if (item.category !== "series" && item.goal && item.progress >= item.goal && prefs.automaticCompletion === "ask" && await appConfirm(`Mark “${item.title}” completed?`, { title: "Completed?", confirmLabel: "Mark completed" })) item.status = roles.done;
    if (item.status !== previousStatus && trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    persist({ ids: [item.id] }); render(); toast(stepped?.skippedUpcoming ? `Progress updated; skipped ${stepped.skippedUpcoming} upcoming ${stepped.skippedUpcoming === 1 ? "episode" : "episodes"}.` : "Progress updated.");
  }
  async function deleteItem(id) {
    const item = itemById(id); if (!item) return;
    if (!(await appConfirm(`Delete “${item.title}” from your library?`, { title: "Delete title", confirmLabel: "Delete", danger: true }))) return;
    if (prefs.backupBeforeDestructive) exportList({ silent: true });
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
    if (item.category === "series" && window.SplitAppLibrary.episodeInfo(item)) { const wanted = item.progress, info = window.SplitAppLibrary.episodeInfo(item); stepEpisodes(item, wanted - info.done); }
    item.goal = Math.max(0, Number(data.get("goal")) || 0);
    item.updatedAt = Date.now();
    if (oldStatus !== item.status && trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    detailEditMode = false;
    persist({ ids: [item.id] }); render(); toast("Entry updated.");
  }

  let discoverSubmitted = "", discoverSubmittedAt = 0;
  function submitDiscover() {
    discoverQuery = $("#discover-query")?.value ?? discoverQuery;
    const category = currentDiscoverCategory();
    const requestKey = `${discoverQuery.trim().toLocaleLowerCase()}\u0000${category}\u0000${discoverSource}`;
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
    const key = currentDiscoverCategory();
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
    backdropCache.set(showId, url); return url;
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
    const setGrid = () => { const grid = $("#setup-grid"); if (grid && page === "setup") { grid.innerHTML = window.SplitAppSetup.grid(setupState, esc); routeRemoteImages(grid); } };
    setupState.error = "";
    if (setupState.mode) {
      // Favorites picker: list what is already in the local library (no network).
      const needle = query.toLocaleLowerCase();
      setupState.rows = items.filter(item => item.category === step.category && !item.favorite && (!needle || String(item.title || "").toLocaleLowerCase().includes(needle)))
        .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
        .map(item => ({ source: "local", providerId: String(item.id), localId: String(item.id), title: item.title, year: item.year, image: item.customCover || item.localThumbnailData || item.localPortraitData || item.image || "" }));
      setupState.loading = false; setGrid(); return;
    }
    if (!query && setupTrending[step.category]) { setupState.rows = setupTrending[step.category]; setupState.loading = false; setGrid(); return; }
    if (prefs.metadataMode === "offline") { setupState.rows = []; setupState.loading = false; setupState.error = "Quick setup needs an internet connection."; setGrid(); return; }
    setupState.loading = true; setGrid();
    try {
      let rows;
      if (query) rows = await window.SplitAppDiscovery.search(query, step.category, detailSettings());
      else {
        const sections = await window.SplitAppDiscovery.trending(step.category, detailSettings());
        const seen = new Set(); rows = sections.flatMap(section => section.items || []);
        rows = rows.filter(row => { const key = `${String(row.title).toLowerCase()}|${String(row.year || "").slice(0, 4)}`; return row.title && row.image && !seen.has(key) && seen.add(key); }).slice(0, 60);
        if (rows.length) setupTrending[step.category] = rows;
      }
      if (request !== setupRequest) return;
      setupState.rows = (rows || []).filter(row => row.image).slice(0, 60);
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
        if (items.length > before) added++;
        else if (item && step.status === "done" && item.status !== roles.done) { item.status = roles.done; item.updatedAt = Date.now(); persist({ ids: [item.id] }); }
      });
    });
    return added;
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
    const mode = setupState.mode, target = mode === "favorites-movie" ? "movie-favorites" : "series-favorites";
    const added = save ? applySetupPicks() : 0;
    setupStarted = false; setupState.mode = "";
    if (mode) { if (added) { favoritesSetupSkipped.add(target); toast(`Added ${added} ${added === 1 ? "favorite" : "favorites"}.`); goto(target, true); } else goto("profile"); return; }
    markSetupDone();
    if (added) toast(`Added ${added} ${added === 1 ? "title" : "titles"} to your library.`);
    goto("series-watchlist");
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
    if (initialBox?.isConnected) { initialBox.setAttribute("aria-busy", "true"); initialBox.innerHTML = window.SplitAppDiscoverCards.loading(); }
    try {
      const results = sourceKey ? await exploreSourceSearch(query, sourceKey, controller?.signal) : await discoverSearch(query, key, controller?.signal);
      if (requestId !== discoverRequestId || page !== "discover" || discoverSource !== sourceKey) return;
      const sourceName = window.SplitAppSources.list().find(source => source.key === sourceKey)?.name;
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
  function sameDiscoverTitle(item, result, category) {
    return Boolean(item && result && item.category === (category || result.category) && titleIdentity(item) === titleIdentity({ ...result, category: category || result.category, metadataSource: result.metadataSource || result.source }));
  }
  function addDiscoverResult(result, origin = "Discover", options = {}) {
    if (!result) return null;
    const existing = itemByTitleIdentity(titleIdentity({ ...result, metadataSource: result.metadataSource || result.source }));
    if (existing) {
      if (!options.quiet) toast("That entry is already in your library."); return existing;
    }
    const item = stripLocalScores({ ...result, metadataSource: result.source, id: crypto.randomUUID(), status: options.status || prefs.defaultStatus || defaultStatus(result.category), ...(options.favorite ? { favorite: true } : {}), progress: 0, createdAt: Date.now(), updatedAt: Date.now() });
    items.unshift(item); itemIndexItems = null; recordLibraryChange("added", `Added ${item.title} from ${origin}.`, [item.id]); if (trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() }); persist({ ids: [item.id] }); if (!options.quiet) toast("Added to your library."); hydrateSavedItem(item); return item;
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
  function applyLoadedMetadata(item, loaded, { cacheDetails = true, replaceFacts = false } = {}) {
    if (!item || !loaded || typeof loaded !== "object") throw new Error("Metadata source returned an invalid detail record.");
    let cachedDetails = loaded;
    if (cacheDetails && item.cachedDetails && !replaceFacts) {
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
    if (cacheDetails) item.cachedDetails = cachedDetails;
    if (cacheDetails && page === "details" && String(detailItemId) === String(item.id)) detailData = cachedDetails;
    item.metadataFetchedAt = Number(loaded.fetchedAt || loaded.facts?.fetchedAt) || Date.now();
    item.facts = replaceFacts ? { ...(loaded.facts || {}) } : mergeFacts(item.facts, loaded.facts);
    delete item.relinkFresh;
    if (!Number(item.goal)) item.goal = category(item.category)?.unit === "minutes" ? Number(loaded.facts?.runtimeMinutes) || 0 : Number(loaded.goal) || Number(loaded.facts?.episodeCount) || 0;
    item.description = loaded.description || item.description;
    item.year = loaded.year || item.year;
    item.image = item.customCover || loaded.portraitImage || loaded.image || item.image;
    item.backdrop = loaded.landscapeImage || loaded.backgroundImage || item.backdrop;
    item.updatedAt = Date.now();
    reconcileEpisodes(item);
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
      const results = await window.SplitAppDiscovery.searchSource(query, category, { ...detailSettings(), metadataSources }, sourceKey);
      output.dataset.state = "ok";
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
  async function loadDetails(targetId = null) {
    detailAbortController?.abort();
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    detailAbortController = controller;
    const item = detailPreview || itemById(String(targetId ?? detailItemId));
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
    detailLoading = true; render();
    try {
      const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), ...(controller ? { signal: controller.signal } : {}) });
      if (requestId === detailRequest) {
        detailData = loaded;
        if (detailPreview) { detailPreview.image ||= loaded.portraitImage || loaded.image || ""; detailPreview.year ||= loaded.year || ""; detailPreview.description ||= loaded.description || ""; detailPreview.title = loaded.title || detailPreview.title; }
        if (!detailPreview) {
          applyLoadedMetadata(item, loaded, { replaceFacts: Boolean(item.relinkFresh) });
          persist({ ids: [item.id] });
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
  function clearDetailStack() { detailAbortController?.abort(); refAbortController?.abort(); detailAbortController = refAbortController = null; detailRequest++; detailTab = ""; detailSeason = ""; detailStack = []; detailRef = null; detailRefOffset = 0; refData = null; refError = ""; refLoading = false; refRequest++; }
  function openDetailRef(type, id, title, extra, replace = false) {
    if (!id) return;
    if (!replace) { detailStack.push(detailSnapshot()); if (detailStack.length > 50) detailStack.shift(); }
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
      const cachedEpisode = ref.type === "episode" && parent
        ? (parent.cachedDetails?.sections || []).filter(section => section.kind === "episodes").flatMap(section => section.items || []).find(row => String(row.id) === String(ref.id) || String(row.ref?.id) === String(ref.id))
        : null;
      const cachedMediaSections = cachedEpisode?.mediaSections || [];
      const referenceSourceKey = parent?.metadataSource || ({ tenrai: "anilist" }[ref.extra?.source] || ref.extra?.source) || String(ref.id || "").match(/^(tmdb|tvdb|imdb|anilist):/i)?.[1]?.toLowerCase() || "tvmaze";
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
  async function hydrateSavedItem(item) {
    if (!item?.metadataSource || !item.providerId || item.cachedDetails || hydrating.has(item.id) || prefs.metadataMode === "offline") return;
    hydrating.add(item.id);
    try {
      const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), background: true });
      if (itemById(item.id) !== item) return;
      applyLoadedMetadata(item, loaded); persist({ ids: [item.id] }); if (page === "details" && detailItemId === item.id) render();
    } catch (error) { recordLog("warning", `Could not save details for ${item.title}: ${error?.message || error}`); }
    finally { hydrating.delete(item.id); }
  }
  let metadataSync = null;
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
    if (!document.hidden && !metadataSyncRenderTimer) metadataSyncRenderTimer = setTimeout(() => { metadataSyncRenderTimer = 0; render(); }, 300);
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
    metadataSync = (async () => {
      let nextStartAt = 0, queueIndex = 0;
      const reportedMemory = Number(navigator.deviceMemory) || 4;
      const reportedCores = Number(navigator.hardwareConcurrency) || 4;
      const memoryLimit = nativeAndroid
        ? (reportedMemory <= 2 || reportedCores <= 4 ? 1 : 2)
        : reportedMemory <= 2 ? 1 : 3;
      const workers = Array.from({ length: Math.min(memoryLimit, 3, Math.max(1, Number(prefs.metadataSyncWorkers) || 2), queue.length) }, async () => {
        while (queueIndex < queue.length) {
          if (!navigator.onLine || prefs.metadataMode === "offline") { await waitForSyncResume(); continue; }
          await yieldToUser();
          const requestDelay = Math.max(0, Number(prefs.syncRequestDelay) || 0);
          if (requestDelay) { const startAt = Math.max(Date.now(), nextStartAt); nextStartAt = startAt + requestDelay; if (startAt > Date.now()) await new Promise(resolve => setTimeout(resolve, startAt - Date.now())); }
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
            const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), forceRefresh: true, background: true });
            if (itemById(entry.id) !== item) throw new Error("Title was removed or replaced.");
            if (metadataSourceIdentity(item) !== requestIdentity) throw new Error("The metadata source or match changed during refresh. Retry to sync the current match.");
            const changed = metadataComparison(item.cachedDetails, Boolean(item.cachedDetails?.trimmed)) !== metadataComparison(loaded, Boolean(item.cachedDetails?.trimmed));
            applyLoadedMetadata(item, loaded, { cacheDetails: changed, replaceFacts: Boolean(item.relinkFresh) });
            await persist({ ids: [item.id] }); setMetadataSyncStatus(entry, changed ? "done" : "checked"); entry.error = ""; delete entry.retryAfterAt; markMetadataSyncEntryDirty(entry);
          } catch (error) { setMetadataSyncStatus(entry, "failed"); entry.error = String(error?.message || "Metadata refresh failed.").slice(0, 240); if (automatic) entry.retryAfterAt = Date.now() + 6 * 60 * 60 * 1000; markMetadataSyncEntryDirty(entry); recordLog("warning", `Metadata refresh failed for ${item.title}: ${entry.error}`); }
          deferMetadataSyncUpdate(); const counts = syncCounts(); if (!quiet) toast(`Refreshing metadata · ${counts.done + counts.failed} of ${total}`);
        }
      });
      try { await Promise.all(workers); }
      finally {
        metadataSync = null; if (!syncCounts().remaining) metadataSyncState.finishedAt = Date.now(); else delete metadataSyncState.finishedAt; saveMetadataSyncState(); clearTimeout(metadataSyncRenderTimer); metadataSyncRenderTimer = 0; render();
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
  function clearMetadataSyncState() { if (metadataSync) return; metadataSyncState = null; saveMetadataSyncState(); render(); }
  // Watch progress and the episode checklist are one thing: for a series with a saved episode guide the watched episodes are the truth and `progress` is their count.
  function reconcileEpisodes(item) {
    const info = item?.category === "series" ? window.SplitAppLibrary.episodeInfo(item) : null; if (!info) return false;
    const before = Number(item.progress) || 0, ids = new Set((item.watchedEpisodeIds || []).map(String));
    // Older entries only had a counter: turn it into the first N episodes watched.
    if (!info.done && before > 0) info.eps.slice(0, Math.min(before, info.total)).forEach(entry => ids.add(String(entry.id)));
    const next = info.eps.filter(entry => ids.has(String(entry.id))).length;
    const changed = next !== before || ids.size !== (item.watchedEpisodeIds || []).length;
    item.watchedEpisodeIds = [...ids]; item.progress = next;
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
    if (seriesProgressComplete(item, info, item.progress)) item.status = roles.done;
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
    if (seriesProgressComplete(item, info, item.progress)) item.status = roles.done;
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
        const root = [...document.querySelectorAll("[data-watchlist-root]")].find(row => row.dataset.watchlistRoot === String(watchlistCard));
        const infoNext = window.SplitAppLibrary.episodeInfo(item)?.next;
        const fresh = infoNext ? window.SplitAppPages.watchlistCard({ item, episode: infoNext, esc, roles, view: currentWatchlistView() }) : null;
        if (root && fresh) { root.outerHTML = fresh; if (markingWatched) animateWatchlistCard(item.id); }
        else if (root) root.remove();
        animateWatchlistLayout(before);
        window.lucide?.createIcons({ root: document.querySelector("#page-content"), attrs: { "aria-hidden": "true" } });
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
    items = items.filter(entry => entry.id !== id); itemIndexItems = null;
    detailItemId = null; detailData = null; detailPreview = null;
    persist({ removed: [id] }); goto(detailReturnPage); toast("Entry deleted.");
  }
  function requestDeleteDetails(id) {
    if (!itemById(id)) return;
    showPopup($("#detail-delete-dialog"));
  }
  function setItemStatus(item, status) {
    if (!item || item.status === status) return;
    if (item.category === "series") {
      const progress = Math.max(Number(item.progress) || 0, (item.watchedEpisodeIds || []).length);
      const allowed = progress > 0 ? [roles.active, roles.hold, roles.dropped, roles.done] : [roles.queued, roles.done];
      if (!allowed.includes(status)) return;
    } else if (item.category === "movie" && ![roles.queued, roles.dropped, roles.done].includes(status)) return;
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
  function coverCandidates(item) {
    const details = item.cachedDetails || {}, urls = [details.portraitImage, details.image, details.landscapeImage, details.backgroundImage, item.image, item.backdrop];
    (details.sections || []).filter(section => section.kind === "gallery").forEach(section => (section.items || []).slice(0, 8).forEach(row => urls.push(row.image)));
    return [...new Set(urls.filter(url => /^https?:/i.test(url || "")))];
  }
  function openCoverPicker(id) {
    const item = itemById(String(id)); if (!item) return;
    let dialog = $("#cover-picker-dialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "cover-picker-dialog"; dialog.className = "choice-dialog cover-picker-dialog"; document.body.appendChild(dialog); }
    const urls = coverCandidates(item);
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">COVER</p><h2>${esc(item.title)}</h2></div><button class="choice-dialog-close" type="button" data-cover-close aria-label="Close">×</button></header><div class="cover-picker-body"><p class="fix-match-status">${item.customCover ? "Using your chosen cover." : "Pick a cover; it stays when metadata refreshes."}</p><div class="cover-picker-grid">${urls.map(url => `<button type="button" class="cover-choice${item.customCover === url ? " is-current" : ""}" data-cover-url="${esc(url)}"><img src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.closest('button').hidden=true"></button>`).join("")}</div>${item.customCover ? '<button type="button" class="button secondary" data-cover-auto>Use automatic cover</button>' : ""}</div>`;
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
    if (!dialog.open) showPopup(dialog);
  }


  function setPreference(key, value) {
    prefs[key] = value;
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
      defaultStatus: { Watchlist: "bookmark", "In Progress": "play", Completed: "circle-check", "On Hold": "pause", Dropped: "circle-x" },
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
    const columns = ["Title", "Category", "Year", "Status", "Progress", "Goal", "Review"];
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const content = format === "txt"
      ? items.map(item => String(item.title || "").trim()).filter(Boolean).join("\n") + "\n"
      : [columns.map(quote).join(","), ...items.map(item => [item.title, item.category, item.year, item.status, item.progress, item.goal, item.review || item.notes].map(quote).join(","))].join("\r\n");
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
  async function exportList({ silent = false } = {}) {
    if (exportRunning) { toast("An export is already running."); return; }
    const backend = window.SplitAppBackend;
    if (nativeAndroid && backend?.exportLibrary) {
      exportRunning = true;
      let lastToast = 0;
      try {
        if (!silent) toast("Choose where to save your library…");
        const result = await backend.exportLibrary({ items, history, preferences: prefs }, { mode: silent ? "folder" : "ask", onProgress: (done, total) => {
          if (Date.now() - lastToast > 700 && done < total) { lastToast = Date.now(); toast(`Exporting… ${Math.round(done / total * 100)}%`); }
        } });
        toast(silent ? `Backup saved: ${result.fileName}` : `Exported ${items.length} games.`);
      } catch (error) {
        const message = String(error?.message || error);
        if (!/cancel/i.test(message)) { toast(`Export failed: ${message}`); recordLog("error", `Export failed: ${message}`); }
      } finally { exportRunning = false; }
      return;
    }
    const fileName = `${config.key}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const parts = [`{"app":${JSON.stringify(config.name)},"version":1,"exportedAt":${JSON.stringify(new Date().toISOString())},"items":[`];
    items.forEach((item, index) => parts.push((index ? "," : "") + JSON.stringify(backend?.backupItem ? backend.backupItem(item) : item)));
    parts.push(`],"history":${JSON.stringify(history)},"preferences":${JSON.stringify(prefs)}}`);
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(parts, { type: "application/json" })); link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); toast("Export ready.");
  }
  async function importList(file) {
    if (!file) return;
    try {
      const encryptedImportIds = [];
      const text = await file.text();
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
        incoming = text.split(/\r?\n/).map(title => title.trim()).filter(Boolean).map(title => ({ title, category: key, status: defaultStatus(key) })); data = { items: incoming };
      } else if (/\.csv$/i.test(file.name)) {
        const rows = parseCsv(text); if (!rows.length) throw new Error("The CSV file has no title rows.");
        const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
        const first = rows[0].map(normalize), hasHeader = first.some(value => ["title", "name"].includes(value));
        const headers = hasHeader ? first : ["title", "category", "year", "status", "progress", "goal", "review"];
        const records = (hasHeader ? rows.slice(1) : rows).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
        const fallbackCategory = preferredCategory !== "all" ? preferredCategory : config.categories[0].key;
        incoming = records.map(record => {
          const title = String(record.title || record.name || Object.values(record)[0] || "").trim();
          const categoryKey = config.categories.some(cat => cat.key === record.category) ? record.category : fallbackCategory;
          const cat = config.categories.find(entry => entry.key === categoryKey);
          return { ...record, title, category: categoryKey, status: cat?.statuses.includes(record.status) ? record.status : defaultStatus(categoryKey), year: record.year || "", progress: Number(record.progress) || 0, goal: Number(record.goal) || 0 };
        }).filter(item => item.title);
        data = { items: incoming };
      } else if (/\.sqdb$/i.test(file.name)) {
        const plugin = window.Capacitor?.Plugins?.EncryptedStore;
        if (!plugin?.importPackedState) throw new Error("Encrypted Android backups can only be restored in the ScreenMark Android app.");
        const restored = await plugin.importPackedState({ packed: text });
        data = restored?.data;
        incoming = Array.isArray(data?.items) ? data.items : null;
        encryptedImportIds.push(...(incoming || []).filter(item => item?.id != null).map(item => String(item.id)));
        if (!incoming) throw new Error("The encrypted backup does not contain a library.");
      } else {
        data = JSON.parse(text); incoming = Array.isArray(data) ? data : data.items;
      }
      if (!Array.isArray(incoming)) throw new Error("No item list found in this file.");
      const now = Date.now(), idMap = new Map();
      const stamp = value => { const n = Number(value) || Date.parse(value) || 0; return n > 0 && n <= now ? n : now; };
      // Keep the backup's own dates so Timeline and Statistics → Activity show when things really happened.
      const normalized = incoming.filter(item => item && item.title).map(item => {
        const id = crypto.randomUUID();
        if (item.id != null) idMap.set(String(item.id), id);
        const categoryKey = config.categories.some(cat => cat.key === item.category) ? item.category : config.categories[0].key;
        const statuses = config.categories.find(cat => cat.key === categoryKey)?.statuses || [];
        const cleanItem = stripLocalScores({ ...item });
        return { ...cleanItem, id, category: categoryKey, status: item.status || defaultStatus(categoryKey), createdAt: stamp(item.createdAt), updatedAt: stamp(item.updatedAt) };
      });
      const byIdentity = new Map(items.map(item => [titleIdentity(item), item]));
      const fresh = [], patches = [];
      const fillFields = ["favorite", "progress", "goal", "metadataSource", "providerId", "facts", "cachedDetails", "url", "description", "image", "backdrop", "year"];
      const empty = value => value == null || value === "" || value === 0 || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);
      for (const imported of normalized) {
        const existing = byIdentity.get(titleIdentity(imported));
        if (!existing) { fresh.push(imported); continue; }
        const patch = {};
        for (const field of fillFields) if (empty(existing[field]) && !empty(imported[field])) patch[field] = imported[field];
        // Keep ScreenMark's episode checklist and per-episode notes when filling an existing title.
        if (Object.keys(patch).length) patches.push({ item: existing, patch });
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
      for (const { item, patch } of patches) Object.assign(item, patch, { updatedAt: Date.now() });
      history = [...importedHistory, ...history].sort((a, c) => (Number(c.at) || Date.parse(c.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0));
      recordLibraryChange("imported", `Imported ${fresh.length} ${fresh.length === 1 ? "title" : "titles"}.`, fresh.map(item => item.id));
      await persist({ ids: [...fresh, ...patches.map(row => row.item)].map(item => item.id), meta: true });
      if (encryptedImportIds.length) {
        const retained = new Set(items.map(item => String(item.id)));
        const store = window.Capacitor?.Plugins?.EncryptedStore;
        for (const id of encryptedImportIds) if (!retained.has(id)) await store?.deleteItem?.({ id });
      }
      render(); toast(`Imported ${fresh.length} ${fresh.length === 1 ? "entry" : "entries"}${patches.length ? ` and restored details for ${patches.length} existing ${patches.length === 1 ? "title" : "titles"}` : ""}.`);
    } catch (error) { toast(error.message || "Could not import this file."); }
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
    const discoverCategoryButton = eventClosest(event, "[data-discover-category]");
    if (discoverCategoryButton) { discoverCategoryChoice = discoverCategoryButton.dataset.discoverCategory; discoverCache = null; suggestionsCache = null; discoverQuery = ""; render(); return; }
    const addCategoryButton = eventClosest(event, "[data-add-category]");
    if (addCategoryButton) { applyAddCategory(addCategoryButton.dataset.addCategory); return; }
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
        if (item.category === "series" && seriesProgressComplete(item, window.SplitAppLibrary.episodeInfo(item), item.progress)) item.status = roles.done;
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
          else if (page === "details" && detailItemId && itemById(detailItemId)?.metadataSource === key) loadDetails(detailItemId);
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
      closePopup($("#log-filter-dialog")); render(); return;
    }
    if (eventClosest(event, "[data-log-filter-clear]")) {
      if (settingsGroup === "history") { historyFrom = ""; historyTo = ""; } else { logFrom = ""; logTo = ""; }
      closePopup($("#log-filter-dialog")); render(); return;
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
    if (syncAction) { if (syncAction.dataset.metadataSyncAction === "start") syncMetadataNow(); else if (syncAction.dataset.metadataSyncAction === "retry") retryMetadataSync(syncAction.dataset.id || null); else if (syncAction.dataset.metadataSyncAction === "clear") clearMetadataSyncState(); return; }
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
      watchlistViews[kind] = current === "list" ? "posters" : current === "posters" ? "cards" : "list";
      try { localStorage.setItem(`${storageKey}_watchlist_views`, JSON.stringify(watchlistViews)); } catch (_) {}
      render(); syncPageNavigation(); return;
    }
    const setupToggle = eventClosest(event, "[data-setup-toggle]");
    if (setupToggle) {
      const row = setupState.rows[Number(setupToggle.dataset.setupToggle)]; if (!row) return;
      const key = `${row.source}:${row.providerId}`, picks = setupState.picks[setupState.step];
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
    const coverPick = eventClosest(event, "[data-cover-pick]");
    if (coverPick) { const prefix = coverPick.dataset.coverPick === "avatar" ? "profileAvatar" : "profileCover"; prefs[prefix + "Pinned"] = coverPick.dataset.id; setPreference(prefix + "Source", "pinned"); render(); return; }
    const coverMore = eventClosest(event, "[data-cover-more]");
    if (coverMore) { window.SplitAppPages.moreCovers(coverMore.dataset.coverMore); render(); return; }
    const coverTabButton = eventClosest(event, "[data-cover-tab]");
    if (coverTabButton) { window.SplitAppPages.setCoverTab(coverTabButton.dataset.coverTab); render(); return; }
    if (eventClosest(event, "[data-profile-avatar-remove]")) { try { localStorage.removeItem("screenmark_profile_avatar"); } catch (_) {} render(); return; }
    if (eventClosest(event, "[data-profile-cover-shuffle]")) { window.SplitAppPages.shuffleProfileCover(items, prefs, eventClosest(event, "[data-profile-cover-shuffle]").dataset.profileCoverShuffle); render(); return; }
    if (eventClosest(event, "[data-open-profile-menu]")) { showPopup($("#profile-options-dialog")); return; }
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
      const skipped = toggleSeason(detailItemId, ids, undo);
      if (skipped === null) return;
      const changedCount = ids.length - skipped;
      toast(undo ? `${changedCount} episodes marked unwatched.` : `${changedCount} episodes marked watched.${skipped ? ` ${skipped} upcoming ${skipped === 1 ? "episode" : "episodes"} skipped.` : ""}`);
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
      return;
    }
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
      if (key === "export") exportList(); else if (key === "export-txt") exportNames("txt"); else if (key === "export-csv") exportNames("csv"); else if (key === "sync-metadata") syncMetadataNow(); else if (key === "resetAnimations") resetAnimations(); else if (key === "previewAnimations") previewAnimations(); else if (key === "resetAppearance") resetAppearance();
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
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const size = 256, canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
        const scale = Math.max(size / img.width, size / img.height), w = img.width * scale, h = img.height * scale;
        canvas.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        URL.revokeObjectURL(url);
        try { localStorage.setItem("screenmark_profile_avatar", canvas.toDataURL("image/jpeg", .86)); } catch (_) { toast("Could not save photo."); }
        render();
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast("Could not read that image."); };
      img.src = url; return;
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
    if (input.matches("[data-setting-action=import]")) { const file = input.files?.[0]; input.value = ""; importList(file); }
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
      setupState.query = event.target.value; clearTimeout(setupSearchTimer);
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
    closePopup($("#timeline-filter-dialog")); render();
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
        if (page === "details") await (detailRef ? loadDetailRef() : loadDetails());
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
    discoverCategoryChoice = button.dataset.discoverCategory;
    discoverAbortController?.abort(); discoverAbortController = null;
    suggestionsAbortController?.abort(); suggestionsAbortController = null; suggestionsPendingKey = ""; suggestionsRequest++;
    discoverCache = null;
    suggestionsCache = null;
    discoverQuery = "";
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
    discoverSearchFocused = true;
    syncDiscoverTypeTabs();
  });
  document.addEventListener("focusout", event => {
    if (event.target.id !== "discover-query") return;
    discoverSearchFocused = Boolean(event.relatedTarget?.closest?.("#header-type"));
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
    page = next; settingsGroup = next === "settings" ? (route[1] === "manage-backups" ? "backups" : route[1] || null) : null;
    settingsParam = next === "settings" ? new URLSearchParams(hashQuery).get("id") || "" : "";
    statsSubpage = next === "statistics" && statsSections.includes(route[1]) ? normalizeStatsSection(route[1]) : "";
    document.body.dataset.navDir = "back";
    if (next === "details") { const id = detailIdFromQuery(hashQuery); if (id && id !== detailItemId) { detailItemId = id; detailPreview = null; detailData = null; detailError = ""; render(); syncPageNavigation(); loadDetails(); return; } }
    if (next === "statistics" && route[1] && !statsSubpage) historyPush(true);
    render(); syncPageNavigation(); restoreScroll();
    if (sourceChanged && discoverQuery.trim()) { discoverSubmitted = ""; discoverCache = null; submitDiscover(); }
  }
  window.addEventListener("popstate", event => {
    if (skipNextPop) { skipNextPop = false; event.stopImmediatePropagation(); return; }
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
    if (!info?.version) return;
    window.APP_INSTALLED_VERSION = info.version;
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
      flushPersist(); saveMetadataSyncState(); window.SplitAppBackend?.flushJournals?.();
      clearTimeout(metadataSyncRenderTimer); metadataSyncRenderTimer = 0;
      if (metadataSync) recordLog("info", "Metadata refresh continues while the app runtime is active; unfinished titles resume when the app reopens.");
    } else {
      if (metadataSyncState) render();
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
      if (!restored.fast || pendingStartupMigration || nativeHasLegacyScores || nativeHasLegacyPreferences || migratedMixItems || migrateNativeAccentDefault) await window.SplitAppBackend.save({ items, history, preferences: prefs });
      return true;
    } catch (error) {
      recordLog("error", `App data restore failed: ${error.message || error}`);
      const message = $("#storage-folder-gate-message");
      if (message) message.textContent = `${error.message || "ScreenMark could not open its database folder."} Select a storage folder to continue.`;
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
      applyPreferences(); render(); syncBackupSchedule();
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
    if (refType && refId) { detailStack.push(detailSnapshot()); if (detailStack.length > 50) detailStack.shift(); detailRef = { type: refType, id: refId, title: (refSlug || "").replace(/-/g, " ") }; loadDetailRef(); }
    else loadDetails();
  }
  const finishStartup = success => {
    libraryRestoreComplete = true;
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
    if (storageFolderGate) storageFolderGate.hidden = true;
    applySeriesInactivityTransitions();
    applyPreferences(); render(); syncPageNavigation(); syncBackupSchedule();
    if (page === "details" && detailItemId && !detailPreview) loadDetails();
    window.ScreenMarkSplash?.ready?.();
  };
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
      await new Promise(resolve => setTimeout(resolve, 2500));
      const libraryStamp = () => `${items.length}:${items.reduce((sum, item) => sum + (Number(item.updatedAt) || 0), 0)}`;
      const before = libraryStamp();
      const full = await restoreNativeData();
      if (full === false) finishStartup(false);
      else if (full) { applySeriesInactivityTransitions(); if (libraryStamp() !== before) { applyPreferences(); render(); } } // keep scroll position when nothing changed
      if (full) { checkLibraryDrift(); metadataLibraryReady = true; maybeAutoMetadataSync(); }
      setTimeout(fillThumbCache, 1500);
      return;
    }
    const full = await restoreNativeData();
    finishStartup(full);
    if (full) { checkLibraryDrift(); metadataLibraryReady = true; maybeAutoMetadataSync(); }
    setTimeout(fillThumbCache, 3000);
  });
})();
