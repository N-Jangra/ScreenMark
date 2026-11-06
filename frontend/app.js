(() => {
  "use strict";

  const config = window.APP_CONFIG;
  const titles = { dashboard: "Collection", discover: "Discover", explore: "Explore", mix: "Mix fetch", details: "Details", add: "Add title", timeline: "Timeline", statistics: "Statistics", settings: "Settings", sync: "Metadata Sync" };
  const navItems = [
    { key: "dashboard", label: "Home", icon: "⌂", locked: true },
    { key: "discover", label: "Discover", icon: "✧" },
    { key: "explore", label: "Explore", icon: "compass" },
    { key: "timeline", label: "Timeline", icon: "◷" },
    { key: "statistics", label: "Stats", icon: "▥" },
    { key: "settings", label: "Settings", icon: "⚙", locked: true }
  ];
  const navKeys = navItems.map(item => item.key);
  const prefsDefaults = {
    theme: "system", textSize: "normal", dateFormat: "auto", iconStyle: "tiles", imageStorage: "all", favoritesOnly: false, reduceMotion: false, animationSpeed: "normal", animationCustom: 100, animationEasing: "smooth", pageTransition: "slide", cardEntrance: "rise", animationStagger: true, sheetAnimation: "slide", pressEffect: "shrink", hoverLift: false, navBounce: true, progressAnimation: true, skeletonShimmer: true, mainColor: "#6366f1",
    showSidebar: true, showScrollbars: false, bottomBarStyle: "box", bottomBarCorners: "round", bottomBarLabels: "icons-labels", bottomBarBackground: "solid", bottomBarTransparency: 100, bottomBarLayout: "spread", navIcons: { dashboard: "home", search: "search", discover: "bookmark", explore: "compass", timeline: "calendar-days", statistics: "pie-chart", settings: "settings" },
    navBar: { order: navKeys, visible: { dashboard: true, discover: true, explore: true, timeline: false, statistics: false, settings: true } },
    metadataSourceOrder: ["tvmaze", "anilist", "omdb"], customSources: [],
    dashboardView: "list", dashboardDefaultCategory: "series", cardCorners: "rounded", dashboardGroupBy: "status", dashboardSort: "alphabetical-asc", dashboardStatusFilter: "all", dashboardRowActions: "menu", oneHandedMode: "off", tabletTwoColumn: true,
    automaticCompletion: "automatic", defaultStatus: "", progressIncrement: 1,
    metadataSyncWorkers: 2, syncTimeout: 25, syncRetries: 1, syncRetryDelay: 2, syncMaxSources: 0, syncRequestDelay: 0, syncScope: "needed",
    backupSchedule: "daily", backupRetention: 10, backupBeforeDestructive: true, folderSyncDelay: 30,
    metadataMode: "online", metadataSources: { tvmaze: true, anilist: true, omdb: false }, metadataRefreshInterval: "weekly", offlineFallback: "cached", thumbnailSize: "medium",
    backgroundBackups: false,
    apiKeys: {}, sourceOptions: {}
  };
  const themePalettes = {
    light: { mode:"light", background:"#f8fafc", shell:"#f8fafc", surface:"#ffffff", surface2:"#f1f5f9", line:"rgba(15,23,42,.10)", text:"#0f172a", muted:"#64748b" },
    amoled: { mode:"dark", background:"#000000", shell:"#000000", surface:"#101010", surface2:"#1a1a1a", line:"rgba(255,255,255,.12)", text:"#f8fafc", muted:"#a1a1aa" }
  };
  function safeLucideName(value, fallback = "circle") {
    const name = String(value || "");
    if (name === "↺" || name === "↻") return "rotate-ccw";
    const exportName = name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()).replace(/^./, char => char.toUpperCase());
    return window.lucide?.icons?.[exportName] ? name : fallback;
  }
  const storageKey = window.SplitAppBackend?.storageKey || `splitapp_${config.key}_v1`;
  const librarySnapshotKey = `${storageKey}_snapshot`;
  let librarySnapshotTimer = 0;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (_) { stored = {}; }
  const prefs = { ...prefsDefaults, ...(stored.preferences || {}) };
  delete prefs.appLook;
  delete prefs.recentlyAddedLimit;
  delete prefs.appDisplayName;
  prefs.apiKeys = { ...prefsDefaults.apiKeys, ...(stored.preferences?.apiKeys || {}) };
  prefs.sourceOptions = { ...(stored.preferences?.sourceOptions || {}) };
  prefs.metadataSources = { ...prefsDefaults.metadataSources, ...(stored.preferences?.metadataSources || {}) };
  function refreshSourceRegistry() {
    prefs.customSources = Array.isArray(prefs.customSources) ? prefs.customSources.filter(config => config && config.id && /^https?:\/\//i.test(config.searchUrl || "")) : [];
    window.SplitAppMetadata.setCustom(prefs.customSources);
    window.SplitAppMetadata.normalize(prefs);
    const keys = window.SplitAppSources.list().map(source => source.key), saved = Array.isArray(prefs.metadataSourceOrder) ? prefs.metadataSourceOrder : [];
    prefs.metadataSourceOrder = [...saved.filter((key, index) => keys.includes(key) && saved.indexOf(key) === index), ...keys.filter(key => !saved.includes(key))];
  }
  refreshSourceRegistry();
  normalizeNavigationPrefs();
  function normalizeNavigationPrefs() {
    if (["icon", "icons-only"].includes(prefs.bottomBarStyle) && !Object.prototype.hasOwnProperty.call(stored.preferences || {}, "bottomBarLabels")) prefs.bottomBarLabels = "icons-only";
    if (prefs.bottomBarStyle === "soft") prefs.bottomBarStyle = "box";
    if (["icon", "icons-only", "pill"].includes(prefs.bottomBarStyle)) prefs.bottomBarStyle = "box";
    if (!["box", "icon-color", "underline"].includes(prefs.bottomBarStyle)) prefs.bottomBarStyle = prefsDefaults.bottomBarStyle;
    if (!["round", "sharp"].includes(prefs.bottomBarCorners)) prefs.bottomBarCorners = prefsDefaults.bottomBarCorners;
    if (!["icons-labels", "icons-only"].includes(prefs.bottomBarLabels)) prefs.bottomBarLabels = prefsDefaults.bottomBarLabels;
    prefs.showSidebar = prefs.showSidebar !== false;
    prefs.showScrollbars = prefs.showScrollbars === true;
    if (prefs.bottomBarBackground === "solid") prefs.bottomBarTransparency = 100;
    prefs.navIcons = { ...prefsDefaults.navIcons, ...(prefs.navIcons || {}) };
    const legacyIcons = { "⌂": "home", "⌕": "search", "✧": "sparkles", "◷": "calendar-days", "▥": "pie-chart", "⚙": "settings" };
    navKeys.forEach(key => {
      const icon = prefs.navIcons[key];
      if (legacyIcons[icon]) prefs.navIcons[key] = legacyIcons[icon];
      else if (icon !== "brand") prefs.navIcons[key] = safeLucideName(icon, prefsDefaults.navIcons[key]);
    });
    const savedNav = prefs.navBar || {};
    const savedOrder = Array.isArray(savedNav.order) ? savedNav.order.filter((key, index, keys) => navKeys.includes(key) && keys.indexOf(key) === index) : [];
    prefs.navBar = { order: [...savedOrder, ...navKeys.filter(key => !savedOrder.includes(key))], visible: { ...prefsDefaults.navBar.visible, ...(savedNav.visible || {}), dashboard: true, settings: true } };
    const savedSourceOrder = Array.isArray(prefs.metadataSourceOrder) ? prefs.metadataSourceOrder : [];
    const sourceKeys = window.SplitAppSources.list().map(source => source.key);
    prefs.metadataSourceOrder = [...savedSourceOrder.filter((key, index) => sourceKeys.includes(key) && savedSourceOrder.indexOf(key) === index), ...sourceKeys.filter(key => !savedSourceOrder.includes(key))];
  }
  let items = Array.isArray(stored.items) ? stored.items : [];
  let history = Array.isArray(stored.history) ? stored.history : [];
  const [initialHashPath, initialHashQuery = ""] = location.hash.slice(1).split("?");
  const initialRoute = initialHashPath.split("/");
  let discoverSource = new URLSearchParams(initialHashQuery).get("source") || "";
  let page = initialRoute[0] === "search" ? "dashboard" : initialRoute[0] in titles ? initialRoute[0] : "dashboard";
  let settingsGroup = page === "settings" ? (initialRoute[1] === "manage-backups" ? "backups" : initialRoute[1] || null) : null;
  let settingsParam = initialRoute[0] === "settings" ? new URLSearchParams(initialHashQuery).get("id") || "" : "", settingsFrom = "", renderedSettingsGroup;
  const statsSections = ["watchtime", "library", "activity"];
  const normalizeStatsSection = section => section === "playtime" ? "watchtime" : section === "breakdown" ? "library" : section;
  let statsSubpage = page === "statistics" && statsSections.includes(initialRoute[1]) ? normalizeStatsSection(initialRoute[1]) : "";
  let renderedRoute = null, inAppNav = false, mixCache = null, mixRequest = 0, mixCategory = "", statsRange = "week", statsActivityDate = "", statsWatchtimePage = 0, addCategory = "", discoverCategoryChoice = "";
  let metadataSourceFilter = "all";
  let entryDraftId = null, addReturnPage = "dashboard";
  let libraryQuery = new URLSearchParams(location.search).get("q") || "";
  let discoverQuery = "";
  let addMetadataQuery = "";
  let timelineFilter = "all", timelineSearch = "", timelineMonth = "", timelineYear = "", timelineFrom = "", timelineTo = "";
  let logQuery = "", logFrom = "", logTo = "";
  let historyQuery = "", historyFrom = "", historyTo = "";
  let metadataSyncState = null;
  let historyJournalLoaded = false, logJournalLoaded = false;
  try { metadataSyncState = JSON.parse(localStorage.getItem(`${storageKey}_metadata_sync`) || "null"); } catch (_) {}
  if (metadataSyncState?.entries) { let recovered = false; metadataSyncState.entries.forEach(entry => { if (entry.status === "running") { entry.status = "queued"; recovered = true; } }); if (recovered) { try { localStorage.setItem(`${storageKey}_metadata_sync`, JSON.stringify(metadataSyncState)); } catch (_) {} } }
  let dashboardStatusFilter = prefs.dashboardStatusFilter || "all";
  if (prefs.dashboardView === "cards") prefs.dashboardView = "grid";
  if (!["list", "compact-list", "grid", "detailed-grid", "compact-grid", "large-grid", "timeline"].includes(prefs.dashboardView)) prefs.dashboardView = "list";
  if (prefs.dashboardSort === "title") prefs.dashboardSort = "alphabetical-asc";
  else if (prefs.dashboardSort === "recent") prefs.dashboardSort = "created-desc";
  else if (["rating", "rating-desc", "highest-rated"].includes(prefs.dashboardSort)) prefs.dashboardSort = "alphabetical-asc";
  if (!["all", ...config.categories[0].statuses].includes(dashboardStatusFilter)) dashboardStatusFilter = prefs.dashboardStatusFilter = "all";
  delete prefs.defaultCategory;
  const oldCategoryPreference = prefs.dashboardDefaultCategory;
  let activeCategory = oldCategoryPreference === "remember" ? "series" : oldCategoryPreference || "series";
  if (!config.categories.some(category => category.key === activeCategory)) activeCategory = "series";
  const migrateDashboardCategory = oldCategoryPreference === "remember" || !oldCategoryPreference;
  if (migrateDashboardCategory) prefs.dashboardDefaultCategory = activeCategory;
  let toastTimer;
  const detailIdFromQuery = query => { const raw = String(query || ""); return raw.startsWith("=") ? decodeURIComponent(raw.slice(1)) : new URLSearchParams(raw).get("id") || ""; };
  let detailTab = "", detailSeason = "", detailStack = [], detailRef = null, detailRefOffset = 0, refData = null, refLoading = false, refError = "", refRequest = 0;
  let detailItemId = initialRoute[0] === "details" ? detailIdFromQuery(initialHashQuery) || null : null, detailPreview = null, detailData = null, detailError = "", detailLoading = false, detailEditMode = false, detailReturnPage = "dashboard", detailRequest = 0;
  let detailImagePosition = 0;
  const dashboardPageSize = 40;
  let dashboardLazyObserver = null;
  let searchRenderTimer = null;
  let discoverRequestId = 0;
  let addMetadataRequestId = 0;
  let localMutationRevision = 0;
  let discoverCache = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const category = key => config.categories.find(item => item.key === key) || config.categories[0];
  const labelCategory = key => category(key)?.label || key;
  // Status roles let the shared UI talk about "queued / active / done" without hard-coding status names.
  const roles = { queued: "Backlog", active: "Playing", hold: "On Hold", dropped: "Dropped", done: "Completed", ...(config.statusRoles || {}) };
  const trackedStatuses = [roles.dropped, roles.done, roles.hold, roles.active];
  const statusIcon = status => ({ [roles.queued]: "bookmark", [roles.active]: "circle-play", [roles.hold]: "circle-pause", [roles.dropped]: "circle-x", [roles.done]: "circle-check" })[status] || "circle";
  const defaultStatus = key => category(key)?.statuses?.[0] || roles.queued;
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
      dialog.onclick = event => { const choice = event.target.closest("[data-confirm]"); if (choice) finish(choice.dataset.confirm === "yes"); else if (event.target === dialog) finish(false); };
      try { dialog.showModal(); } catch (_) { dialog.setAttribute("open", ""); }
      dialog.querySelector('[data-confirm="yes"]')?.focus();
    });
  }
  function showPopup(dialog, { silent = false } = {}) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      try { dialog.showModal(); if (!silent) pushDialogEntry(); return; } catch (_) {}
    }
    dialog.setAttribute("open", "");
    dialog.setAttribute("aria-modal", "true");
    dialog.dataset.popupFallback = "true";
    document.body.dataset.popupFallback = "true";
  }
  function closePopup(dialog, { preserveHistory = false } = {}) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      try {
        const wasOpen = dialog.open; dialog.close();
        if (wasOpen && !closingFromPop) { if (preserveHistory) dialogEntries = Math.max(0, dialogEntries - 1); else popDialogEntry(); }
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
  function persist(scope) {
    localMutationRevision += 1;
    if (scope && typeof scope === "object") {
      (scope.ids || []).forEach(id => persistIds.add(String(id)));
      (scope.removed || []).forEach(id => persistRemoved.add(String(id)));
    } else persistFull = true;
    const promise = new Promise(resolve => persistWaiters.push(resolve));
    clearTimeout(persistTimer);
    persistTimer = setTimeout(flushPersist, 250);
    return promise;
  }
  const migrateLocalRatings = items.some(item => Object.prototype.hasOwnProperty.call(item, "rating") || Object.values(item.episodeNotes || {}).some(note => Object.prototype.hasOwnProperty.call(note || {}, "rating")));
  const legacyPreferences = stored.preferences || {};
  const migrateRemovedPreferences = ["showRatings", "ratingFormat", "dashboardDensity", "font", "categoryColors", "showThumbnails", "showProgress"].some(key => Object.prototype.hasOwnProperty.call(legacyPreferences, key)) || ["rating", "rating-desc", "highest-rated"].includes(legacyPreferences.dashboardSort) || Boolean(legacyPreferences.theme && !["system", "light", "amoled"].includes(legacyPreferences.theme));
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
  delete prefs.showRatings; delete prefs.ratingFormat; delete prefs.dashboardDensity; delete prefs.font; delete prefs.categoryColors; delete prefs.showThumbnails; delete prefs.showProgress;
  if (!["system", "light", "amoled"].includes(prefs.theme)) prefs.theme = "system";
  if (migrateLocalRatings) persist();
  else if (migrateDashboardCategory || migrateRemovedPreferences) persist({ meta: true });
  function flushPersist() {
    clearTimeout(persistTimer); persistTimer = 0;
    const waiters = persistWaiters; persistWaiters = [];
    if (!waiters.length) return;
    const scope = persistFull ? { full: true } : { ids: [...persistIds], removed: [...persistRemoved] };
    persistFull = false; persistIds.clear(); persistRemoved.clear();
    const write = window.SplitAppBackend?.save({ items, history, preferences: prefs }, scope);
    const finish = () => waiters.forEach(resolve => resolve());
    if (write?.catch) write.catch(error => { recordLog("error", `App data save failed: ${error.message || error}`); }).then(finish);
    else finish();
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
    const node = $("#toast"); node.classList.remove("has-action"); node.textContent = message; node.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2300);
  }
  function toastUndo(message, undo, ms = 8000) {
    const node = $("#toast"); node.textContent = "";
    const label = document.createElement("span"); label.textContent = message;
    const button = document.createElement("button"); button.type = "button"; button.className = "toast-undo"; button.textContent = "Undo";
    button.addEventListener("click", async event => { event.stopPropagation(); node.classList.remove("show", "has-action"); try { await undo(); } catch (error) { recordLog("error", `Undo failed: ${error?.message || error}`); toast("Could not undo that."); } });
    node.append(label, button); node.classList.add("show", "has-action"); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show", "has-action"), ms);
  }
  function applyPreferences() {
    document.body.dataset.page = page;
    const selectedTheme = prefs.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "amoled" : "light") : prefs.theme;
    const palette = themePalettes[selectedTheme] || themePalettes.amoled;
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
    document.body.style.setProperty("--accent-text", readable(prefs.mainColor || "#6657d9"));
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
    document.body.style.setProperty("--accent-soft", `color-mix(in srgb, ${prefs.mainColor || "#6366f1"} ${palette.mode === "light" ? "12%" : "20%"}, ${palette.surface})`);
    document.body.dataset.reducedMotion = String(Boolean(prefs.reduceMotion));
    const lowEnd = Boolean(navigator.connection?.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    root.dataset.lowend = String(lowEnd);
    document.body.dataset.corners = prefs.cardCorners;
    document.body.dataset.dashboardView = prefs.dashboardView;
    document.body.dataset.oneHanded = prefs.oneHandedMode || "off";
    document.body.dataset.tabletColumns = String(prefs.tabletTwoColumn !== false);
    document.body.dataset.barStyle = prefs.bottomBarStyle;
    document.body.dataset.barCorners = prefs.bottomBarCorners;
    document.body.dataset.barLabels = prefs.bottomBarLabels;
    document.body.dataset.sidebar = prefs.showSidebar ? "shown" : "hidden";
    document.documentElement.dataset.showScrollbars = prefs.showScrollbars === true ? "true" : "false";
    document.body.dataset.barLayout = prefs.bottomBarLayout;
    document.body.dataset.iconStyle = prefs.iconStyle === "inline" ? "inline" : "tiles";
    window.SplitAppDates?.setFormat(prefs.dateFormat); window.SplitAppBackend?.setImageStorage?.(prefs.imageStorage);
    $("#bottom-bar").dataset.bg = prefs.bottomBarBackground;
    document.body.dataset.barBackground = prefs.bottomBarBackground;
    document.documentElement.style.setProperty("--accent", prefs.mainColor || "#6657d9");
    document.documentElement.style.setProperty("--bar-alpha", String(Math.max(0, Math.min(100, Number(prefs.bottomBarTransparency))) / 100));
    document.documentElement.style.setProperty("--text-size", prefs.textSize === "large" ? "18px" : prefs.textSize === "small" ? "14px" : "16px");
    document.documentElement.style.setProperty("--item-art-width", prefs.thumbnailSize === "small" ? "48px" : prefs.thumbnailSize === "large" ? "72px" : "58px");
    document.documentElement.style.setProperty("--item-art-height", prefs.thumbnailSize === "small" ? "58px" : prefs.thumbnailSize === "large" ? "88px" : "72px");
    document.documentElement.style.setProperty("--discover-art-height", prefs.thumbnailSize === "small" ? "110px" : prefs.thumbnailSize === "large" ? "190px" : "150px");
    const speedMs = prefs.reduceMotion || prefs.animationSpeed === "off" ? 0 : prefs.animationSpeed === "fast" ? 100 : prefs.animationSpeed === "slow" ? 320 : prefs.animationSpeed === "custom" ? Math.round(180 * Math.max(25, Math.min(300, Number(prefs.animationCustom) || 100)) / 100) : 180;
    document.documentElement.style.setProperty("--speed", `${speedMs}ms`);
    const easing = { smooth: ["cubic-bezier(.2,.7,.2,1)", "cubic-bezier(.32,.72,0,1)"], spring: ["cubic-bezier(.32,.72,0,1)", "cubic-bezier(.32,.72,0,1)"], bouncy: ["cubic-bezier(.34,1.56,.64,1)", "cubic-bezier(.34,1.56,.64,1)"], linear: ["linear", "linear"] }[prefs.animationEasing] || ["cubic-bezier(.2,.7,.2,1)", "cubic-bezier(.32,.72,0,1)"];
    document.documentElement.style.setProperty("--ease-out", easing[0]); document.documentElement.style.setProperty("--ease-spring", easing[1]);
    Object.entries({ pageAnim: prefs.pageTransition || "slide", cardAnim: prefs.cardEntrance || "rise", stagger: prefs.animationStagger !== false, sheetAnim: prefs.sheetAnimation || "slide", press: prefs.pressEffect || "shrink", hoverLift: prefs.hoverLift === true, navBounce: prefs.navBounce !== false, progressAnim: prefs.progressAnimation !== false, shimmer: prefs.skeletonShimmer !== false }).forEach(([key, value]) => { document.body.dataset[key] = String(value); });
    $("#app-kicker").textContent = config.name.toUpperCase();
    document.title = `${config.name} · ${page === "settings" && settingsGroup ? settingsGroup : titles[page]}`;
    renderSidebar();
    renderBottomBar();
    $$(".nav-button").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
      const icon = $(".nav-icon", button);
      if (icon) {
        const selectedIcon = prefs.navIcons[button.dataset.page] || "circle";
        icon.innerHTML = button.dataset.page === "dashboard" && selectedIcon === "brand"
          ? '<img src="icons/screenmark.svg" alt="">'
          : `<i data-lucide="${safeLucideName(selectedIcon)}"></i>`;
      }
    });
    window.lucide?.createIcons({ root: $("#bottom-bar"), attrs: { "aria-hidden": "true" } });
  }
  function renderBottomBar() {
    const bar = $("#bottom-bar");
    if (!bar) return;
    const byKey = new Map(navItems.map(item => [item.key, item]));
    bar.innerHTML = prefs.navBar.order.filter(key => prefs.navBar.visible[key] !== false).map(key => {
      const item = byKey.get(key); if (!item) return "";
      const icon = prefs.navIcons[key] || item.icon;
      const iconMarkup = key === "dashboard" && icon === "brand" ? '<img src="icons/screenmark.svg" alt="">' : `<i data-lucide="${safeLucideName(icon)}"></i>`;
      return `<button data-page="${item.key}" class="nav-button${page === item.key ? " active" : ""}" aria-label="${esc(item.label)}"><span class="nav-icon" aria-hidden="true">${iconMarkup}</span><span>${esc(item.label)}</span></button>`;
    }).join("");
  }
  function renderSidebar() {
    const sidebar = $("#sidebar-nav");
    if (!sidebar) return;
    sidebar.innerHTML = navItems.map(item => {
      const icon = prefs.navIcons[item.key] || item.icon;
      const iconMarkup = item.key === "dashboard" && icon === "brand" ? '<img src="icons/screenmark.svg" alt="">' : `<i data-lucide="${safeLucideName(icon)}"></i>`;
      return `<button type="button" class="sidebar-nav-button${page === item.key ? " active" : ""}" data-sidebar-page="${item.key}" aria-current="${page === item.key ? "page" : "false"}"><span class="sidebar-nav-icon" aria-hidden="true">${iconMarkup}</span><span>${esc(item.label)}</span></button>`;
    }).join("");
    window.lucide?.createIcons({ root: sidebar, attrs: { "aria-hidden": "true" } });
  }
  function syncPageNavigation() {
    document.body.dataset.page = page;
    document.title = `${config.name} · ${page === "settings" && settingsGroup ? settingsGroup : titles[page]}`;
    $$("#bottom-bar .nav-button").forEach(button => button.classList.toggle("active", button.dataset.page === (page === "mix" ? "explore" : page)));
    $$("#sidebar-nav .sidebar-nav-button").forEach(button => {
      const active = button.dataset.sidebarPage === (page === "mix" ? "explore" : page);
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", String(active ? "page" : "false"));
    });
  }
  function goto(next, updateHistory = true, back = false) {
    if (!back) rememberScroll();
    if (next === "search") next = "dashboard";
    const [nextPage, nextSection] = String(next).split("/");
    page = nextPage in titles ? nextPage : "dashboard";
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
  const rememberScroll = () => scrollMemory.set(scrollKey(), window.scrollY);
  const restoreScroll = () => {
    const top = scrollMemory.get(scrollKey()) || 0;
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
    if (page === "dashboard" && libraryQuery) url.searchParams.set("q", libraryQuery);
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
      window.SplitAppBackend?.readJournal?.("history").then(rows => { if (page === "settings" && settingsGroup === "history" && Array.isArray(rows)) { const local = changeLog; const keys = row => `${row.action}|${row.at}|${row.detail || ""}`; changeLog = [...new Map([...rows, ...local].map(row => [keys(row), row])).values()].sort((a, b) => (Number(b.at) || Date.parse(b.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0)); try { localStorage.setItem(`${storageKey}_history`, JSON.stringify(changeLog.slice(0, 2000))); } catch (_) {} render(); } }).catch(() => {});
    }
    return { statsSubpage, statsActivityDate, statsRange, statsWatchtimePage, metadataSyncState, changeLog, logQuery, logFrom, logTo, historyQuery, historyFrom, historyTo, timelineFrom, timelineTo, dataRevision: localMutationRevision, libraryBytes: page === "settings" ? estimateLibraryBytes() : 0, config, prefs, items, history, logEntries, roles, trackedStatuses, statusIcon, activeCategory, discoverCategory: currentDiscoverCategory(), libraryQuery, discoverQuery, addMetadataQuery, mixQuery: mixCache?.query || "", mixCategory: mixCategory || (activeCategory !== "all" ? activeCategory : "all"), statsRange, settingsGroup, settingsParam, settingsFrom, discoverSource, dashboardStatusFilter, timelineFilter, timelineSearch, timelineMonth, timelineYear, detailItemId, detailPreview, detailEditMode, editingItem: items.find(item => item.id === entryDraftId) || null, addReturnPage, navItems, metadataSourceFilter,
      detailData, detailError, detailLoading, detailReturnPage, detailRef, detailRefOffset, refData, refLoading, refError, detailStackSize: detailStack.length, detailTab, detailSeason, refItem: detailRef?.type === "episode" ? items.find(entry => entry.category === "series" && (entry.cachedDetails?.sections || []).some(section => section.kind === "episodes" && section.items.some(row => String(row.id) === String(detailRef.id)))) || null : null, category, labelCategory, defaultStatus, esc, safeLucideName };
  }
  function dashboardGroupItems(groupKey) {
    const library = window.SplitAppLibrary.create(pageContext());
    const groupBy = prefs.dashboardGroupBy || "status";
    if (groupBy === "status") return library.dashboardItems(groupKey, libraryQuery);
    let games = library.dashboardItems(null, libraryQuery);
    if (dashboardStatusFilter !== "all") games = games.filter(item => item.status === dashboardStatusFilter);
    if (groupBy === "category") return games.filter(item => String(item.category || "other") === groupKey);
    if (groupBy === "release") return games.filter(item => String(item.year || "Unknown release date") === groupKey);
    return games;
  }
  // ---- Device artwork cache (IndexedDB blobs) ----
  // Order for every cover: on-device cache -> online (instant, HTTP-cached) -> saved-folder files.
  // The slow Android folder (storage framework) only fills the cache in the background.
  const nativeAndroid = Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "android");
  let itemIndex = new Map();
  function itemById(id) {
    const key = String(id);
    let at = itemIndex.get(key);
    if (at !== undefined && String(items[at]?.id) === key) return items[at];
    itemIndex = new Map(items.map((row, index) => [String(row.id), index]));
    at = itemIndex.get(key);
    return at === undefined ? undefined : items[at];
  }
  const thumbUrlCache = new Map(); // "key|sig" -> blob: URL
  const thumbKeyOf = item => `${item.id}:p`;
  const thumbSigOf = item => String(item.localImageFingerprint || item.thumbnailPath || "");
  function rememberThumbUrl(key, sig, url) {
    const cacheKey = `${key}|${sig}`;
    for (const [oldKey, oldUrl] of thumbUrlCache) if (oldKey.startsWith(`${key}|`) && oldKey !== cacheKey) { URL.revokeObjectURL(oldUrl); thumbUrlCache.delete(oldKey); }
    if (thumbUrlCache.has(cacheKey)) URL.revokeObjectURL(thumbUrlCache.get(cacheKey));
    thumbUrlCache.delete(cacheKey); thumbUrlCache.set(cacheKey, url);
    while (thumbUrlCache.size > 200) { const [oldKey, oldUrl] = thumbUrlCache.entries().next().value; URL.revokeObjectURL(oldUrl); thumbUrlCache.delete(oldKey); }
  }
  async function cachedThumbUrls(entries) {
    const found = new Map(), need = [];
    entries.forEach(([key, sig]) => { const cacheKey = `${key}|${sig}`, url = thumbUrlCache.get(cacheKey); if (url) { thumbUrlCache.delete(cacheKey); thumbUrlCache.set(cacheKey, url); found.set(key, url); } else need.push([key, sig]); });
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
    return new Promise(resolve => {
      const go = () => {
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
      const have = new Map(await window.SplitAppIDB.listThumbKeys());
      const missing = items.filter(item => item.thumbnailPath && have.get(thumbKeyOf(item)) !== thumbSigOf(item));
      for (let offset = 0; offset < missing.length; offset += 12) {
        while (document.hidden) await new Promise(resolve => setTimeout(resolve, 3000));
        await yieldToUser();
        const clones = missing.slice(offset, offset + 12).map(item => ({ ...item, localThumbnailData: "", localPortraitData: "", localLandscapeData: "", backdrop: "", cachedDetails: undefined, localImageFiles: undefined }));
        try { await hydrate(clones); } catch (_) {}
        const entries = [];
        for (let index = 0; index < clones.length; index++) {
          const blob = await dataUrlToBlob(clones[index].localThumbnailData);
          const original = missing[offset + index];
          if (blob) entries.push([thumbKeyOf(original), thumbSigOf(original), blob]);
        }
        if (entries.length) { try { await window.SplitAppIDB.putThumbs(entries); } catch (_) {} }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } finally { thumbFillRunning = false; }
  }
  const deferredQueue = [];
  let deferredTimer = 0, deferredDrain = null, deferredObserver = null;
  function finishDeferredImage(image, source) {
    if (!image?.isConnected) return;
    delete image.dataset.localItemId; delete image.dataset.lazySrc;
    if (source) image.src = source;
    else { image.hidden = true; if (image.nextElementSibling) image.nextElementSibling.hidden = false; }
  }
  async function drainDeferredImages() {
    if (deferredDrain) return deferredDrain;
    deferredDrain = (async () => {
      const hydrate = window.SplitAppBackend?.hydrateThumbnails;
      while (deferredQueue.length) {
        const batch = deferredQueue.splice(0, 24);
        const cached = await cachedThumbUrls(batch.map(record => [thumbKeyOf(record.item), thumbSigOf(record.item)]));
        const slow = [];
        for (const record of batch) {
          if (record.image.dataset.customCover) { finishDeferredImage(record.image, record.image.dataset.customCover); continue; }
          const hit = cached.get(thumbKeyOf(record.item));
          if (hit) finishDeferredImage(record.image, hit);
          else if (/^https?:/i.test(record.online)) finishDeferredImage(record.image, record.online); // not cached yet: online straight away
          else slow.push(record);
        }
        if (!slow.length || typeof hydrate !== "function") { slow.forEach(record => finishDeferredImage(record.image, record.online)); continue; }
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
    deferredQueue.push({ item, image, online });
    if (!deferredTimer) deferredTimer = setTimeout(() => { deferredTimer = 0; drainDeferredImages(); }, 0);
  }
  function observeDeferredImages(root = document) {
    const images = [...(root?.querySelectorAll?.("img[data-deferred-image]") || [])].filter(image => !image.hasAttribute("src"));
    if (!images.length) return;
    if (!window.IntersectionObserver) { images.forEach(activateDeferredImage); return; }
    if (!deferredObserver) deferredObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      deferredObserver.unobserve(entry.target);
      activateDeferredImage(entry.target);
    }), { rootMargin: "400px 0px" });
    images.forEach(image => deferredObserver.observe(image));
  }

  function loadDashboardMore(button) {
    const status = button.dataset.dashboardLoadMore;
    const offset = Number(button.dataset.offset) || 0;
    const games = button._dashboardItems || [];
    const batch = games.slice(offset, offset + dashboardPageSize);
    const target = $(`[data-dashboard-items="${CSS.escape(status)}"]`, button.closest("[data-dashboard-status-group]"));
    if (!target || !batch.length) { button.remove(); return; }
    const library = window.SplitAppLibrary.create(pageContext());
    target.insertAdjacentHTML("beforeend", batch.map(library.card).join(""));
    observeDeferredImages(target);
    const nextOffset = offset + batch.length;
    target.dataset.renderedCount = String(nextOffset);
    button.dataset.offset = String(nextOffset);
    const remaining = Math.max(0, games.length - nextOffset);
    if (!remaining) {
      dashboardLazyObserver?.unobserve(button);
      button.remove();
      return;
    }
    button.textContent = `Load more · ${remaining} remaining`;
    button.setAttribute("aria-label", `Load more ${status}; ${remaining} remaining`);
  }
  function observeDashboardLoaders() {
    dashboardLazyObserver?.disconnect();
    dashboardLazyObserver = null;
    if (page !== "dashboard") return;
    const loaders = $$("[data-dashboard-load-more]");
    if (!loaders.length) return;
    loaders.forEach(button => { button._dashboardItems = dashboardGroupItems(button.dataset.dashboardLoadMore); });
    if (!window.IntersectionObserver) return;
    dashboardLazyObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const button = entry.target;
      dashboardLazyObserver.unobserve(button);
      loadDashboardMore(button);
      if (button.isConnected && button.dataset.offset < button._dashboardItems.length) dashboardLazyObserver.observe(button);
    }), { rootMargin: "640px 0px" });
    loaders.forEach(button => dashboardLazyObserver.observe(button));
  }
  function render() {
    if (!metadataSync && metadataSyncState?.entries?.some(entry => ["queued", "running"].includes(entry.status)) && navigator.onLine && prefs.metadataMode !== "offline" && !document.hidden) queueMicrotask(() => startMetadataSync(null, true));
    document.body.dataset.page = page;
    if (page === "dashboard") $("#page-title").innerHTML = `Screen<span>Mark</span>`; else $("#page-title").textContent = titles[page];
    $("#header-filter").hidden = true;
    const headerType = $("#header-type");
    headerType.hidden = page !== "dashboard" && page !== "discover";
    if (page === "dashboard") {
      const count = key => key === "all" ? items.length : items.filter(item => item.category === key).length;
      headerType.innerHTML = [...config.categories].sort((x, y) => (y.key === "series") - (x.key === "series")).map(row => [row.key, row.key === "series" ? "Series" : row.label]).map(([key, label]) => `<button type="button" class="lens-tab${activeCategory === key ? " on" : ""}" data-category-filter="${esc(key)}" aria-pressed="${activeCategory === key}">${esc(label)} <span class="l-cnt">${count(key)}</span></button>`).join("");
    } else if (page === "discover") {
      const source = discoverSource ? window.SplitAppSources.list().find(row => row.key === discoverSource) : null;
      const categories = config.categories.filter(row => !source || source.categories.includes(row.key));
      headerType.hidden = categories.length < 2;
      headerType.innerHTML = categories.map(row => {
        const label = row.key === "movie" ? "Movies" : row.key === "series" ? "TV series" : row.label;
        const selected = currentDiscoverCategory() === row.key;
        return `<button type="button" class="lens-tab${selected ? " on" : ""}" data-discover-category="${esc(row.key)}" aria-pressed="${selected}">${esc(label)}</button>`;
      }).join("");
    }
    if (page === "dashboard" || page === "details") { let touched = false; items.forEach(entry => { if (entry.cachedDetails && reconcileEpisodes(entry)) touched = true; }); if (touched) persist(); }
    const content = $("#page-content");
    $("#floating-add").hidden = page !== "dashboard";
    if (page === "settings") { if (settingsGroup !== renderedSettingsGroup) { settingsFrom = renderedSettingsGroup || ""; renderedSettingsGroup = settingsGroup; } } else renderedSettingsGroup = undefined;
    const route = page === "settings" ? `settings/${settingsGroup || "index"}` : page === "statistics" && statsSubpage ? `statistics/${statsSubpage}` : page;
    const preservePageState = route === renderedRoute;
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
      if (!prefs.reduceMotion && prefs.animationSpeed !== "off") {
        void content.offsetWidth;
        content.classList.add("page-route-enter");
      }
      if (renderedRoute !== null) inAppNav = true;
      renderedRoute = route;
    }
    content.innerHTML = window.SplitAppPages[page](pageContext());
    if (selectMode && page === "dashboard") applySelectionUI();
    else if (selectMode) exitSelectMode();
    if (page === "discover" && discoverCache && discoverCache.source === discoverSource && discoverCache.query === discoverQuery) paintDiscoverResults(discoverCache.results, discoverSource);
    else if (page === "discover" && !discoverQuery) loadDiscoverSuggestions();
    if (page === "mix") paintMixResults();
    if (page === "statistics") { const chart = $(".stats-activity-chart-month"); if (chart) chart.scrollLeft = chart.scrollWidth; }
    if (preservePageState) {
      const controls = [...content.querySelectorAll("input, textarea, select")];
      previousControls.forEach((saved, index) => {
        const target = saved.id ? document.getElementById(saved.id) : saved.name ? controls.find(element => element.name === saved.name && element.type === saved.type && (saved.type !== "radio" || element.value === saved.value)) : controls[index];
        if (!target || target.type === "file") return;
        const stateBound = target.matches("[data-pref], #global-search, #library-search");
        if (target.type !== "radio" && target.type !== "checkbox" && (!stateBound || target.value === saved.value)) target.value = saved.value;
        if (saved.checked !== undefined && !target.matches("[data-pref], [data-detail-status], #dashboard-filter-form *")) target.checked = saved.checked;
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
        if (activeControl?.matches("[data-settings-index-search], [data-settings-search], #explore-source-search")) activeControl.dispatchEvent(new Event("input", { bubbles: true }));
        activeControl?.focus({ preventScroll: true });
      }
    }
    window.lucide?.createIcons({ root: content, attrs: { "aria-hidden": "true" } });
    window.lucide?.createIcons({ root: $("#header-filter"), attrs: { "aria-hidden": "true" } });
    window.lucide?.createIcons({ root: $("#floating-add"), attrs: { "aria-hidden": "true" } });
    observeDashboardLoaders();
    observeDeferredImages(content);
    content.querySelector("[data-clear-collection-search]")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      libraryQuery = "";
      clearTimeout(searchRenderTimer);
      const search = $("#global-search");
      if (search) search.value = "";
      event.currentTarget.hidden = true;
      refreshSearchResults("dashboard", "#collection-results");
      search?.focus();
    });
    content.querySelector("#item-form")?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.defaultPrevented || event.target.matches("textarea, #add-metadata-query")) return;
      event.preventDefault();
      saveAddForm(event.currentTarget);
    });
    content.querySelectorAll("[data-cancel-add]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); entryDraftId = null; goto(addReturnPage); }));
    content.querySelectorAll("[data-save-item]").forEach(saveButton => saveButton.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); saveAddForm($("#item-form")); }));
    content.querySelector("[data-discover-submit]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); submitDiscover(); });
    content.querySelector("#discover-query")?.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.keyCode !== 13) return;
      event.preventDefault(); event.stopPropagation();
      submitDiscover();
    });
    content.querySelector("#discover-query")?.addEventListener("input", event => { discoverQuery = event.target.value; });
    content.querySelector("[data-open-discover-consent]")?.addEventListener("click", event => { event.preventDefault(); showPopup($("#discover-consent-dialog")); });
    content.querySelectorAll("[data-close-discover-consent]").forEach(button => button.addEventListener("click", () => closePopup($("#discover-consent-dialog"))));
    content.querySelector("[data-review-hltb-consent]")?.addEventListener("click", async event => {
      event.preventDefault();
      closePopup($("#discover-consent-dialog"));
      const consent = window.Capacitor?.Plugins?.ProviderConsent;
      try {
        if (consent?.reviewHowLongToBeat) await consent.reviewHowLongToBeat();
        else window.open("https://howlongtobeat.com/", "_blank", "noopener,noreferrer");
        window.SplitAppDiscovery?.clearSourceCooldown?.("howlongtobeat");
        if (page === "discover" && discoverSource === "howlongtobeat") { toast("Session saved. Searching again…"); submitDiscover(); }
      } catch (error) { toast(error?.message || "Could not open HowLongToBeat."); }
    });
    content.querySelector("#detail-edit-form")?.addEventListener("submit", saveDetailEdit);
    content.querySelectorAll(".detail-page [data-action]").forEach(button => button.addEventListener("click", event => {
      const action = button.dataset.action;
      if (!["edit", "progress", "refresh-details", "delete-detail", "cancel-detail-edit", "save-detail-item"].includes(action)) return;
      event.preventDefault(); event.stopPropagation();
      if (action === "edit") { detailEditMode = true; render(); }
      else if (action === "progress") updateProgress(button.dataset.id);
      else if (action === "refresh-details") loadDetails();
      else if (action === "delete-detail") requestDeleteDetails(button.dataset.id);
      else if (action === "cancel-detail-edit") { detailEditMode = false; render(); }
      else if (action === "save-detail-item") {
        const saved = addDiscoverResult(detailPreview);
        if (saved) { detailPreview = null; detailItemId = saved.id; detailData = null; loadDetails(); }
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
      const button = event.target.closest("[data-add-metadata-index]");
      if (button) selectAddMetadata(button.dataset.addMetadataIndex);
    });
    if (page === "settings" && settingsGroup === "backups") refreshBackupFolderStatus();
    if (page === "settings" && settingsGroup === "storage-details") refreshStorageDetails();
    content.querySelectorAll("[data-open-details]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openDetails(button.dataset.id);
      });
    });
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
      prefs.navIcons[key] = icon === "brand" && key === "dashboard" ? "brand" : safeLucideName(icon, prefs.navIcons[key]);
      persist({ meta: true }); applyPreferences(); render();
    }));
    content.querySelectorAll("[data-nav-icon-select]").forEach(select => select.addEventListener("change", event => {
      event.stopPropagation();
      const key = select.dataset.navIconSelect;
      prefs.navIcons[key] = key === "dashboard" && select.value === "brand" ? "brand" : safeLucideName(select.value, prefs.navIcons[key]);
      persist({ meta: true }); applyPreferences(); render();
    }));
    content.querySelector("[data-close-dashboard-filter]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); closePopup($("#dashboard-filter-dialog")); });
    content.querySelector("[data-open-dashboard-filter]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); showPopup($("#dashboard-filter-dialog")); });
    content.querySelector("[data-reset-dashboard-filter]")?.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      dashboardStatusFilter = prefs.dashboardStatusFilter = "all"; prefs.favoritesOnly = false; libraryQuery = "";
      prefs.dashboardView = "list"; prefs.dashboardSort = "alphabetical-asc"; prefs.dashboardGroupBy = "status";
      persist({ meta: true }); applyPreferences(); historyPush(); closePopup($("#dashboard-filter-dialog")); render();
    });
    const dashboardFilterForm = content.querySelector("#dashboard-filter-form");
    const applyDashboardFilter = () => {
      if (!dashboardFilterForm) return;
      prefs.dashboardView = dashboardFilterForm?.elements.view?.value || prefs.dashboardView;
      prefs.dashboardSort = dashboardFilterForm.elements.sort?.value || prefs.dashboardSort;
      prefs.dashboardGroupBy = dashboardFilterForm.elements.groupBy?.value || prefs.dashboardGroupBy;
      persist({ meta: true }); applyPreferences(); closePopup($("#dashboard-filter-dialog")); render();
    };
    dashboardFilterForm?.addEventListener("submit", event => { event.preventDefault(); event.stopPropagation(); applyDashboardFilter(); });
    dashboardFilterForm?.querySelector('[type="submit"]')?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); applyDashboardFilter(); });
    content.querySelectorAll("[data-dashboard-view]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); setPreference("dashboardView", button.dataset.dashboardView);
    }));
    content.querySelectorAll("[data-dashboard-sort]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); setPreference("dashboardSort", button.dataset.dashboardSort);
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
    content.querySelectorAll("[data-nav-move]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      prefs.navBar.order = moveInOrder([...prefs.navBar.order], button.dataset.navKey, button.dataset.navMove);
      persist({ meta: true }); applyPreferences(); render();
    }));
    content.querySelectorAll("[data-source-move]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      prefs.metadataSourceOrder = moveInOrder([...prefs.metadataSourceOrder], button.dataset.sourceKey, button.dataset.sourceMove);
      persist({ meta: true }); render();
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
      if (button.dataset.metadataSyncAction === "retry") retryMetadataSync(button.dataset.id || null);
      else if (button.dataset.metadataSyncAction === "clear") clearMetadataSyncState();
    }));
    content.querySelectorAll("[data-setting-action]").forEach(button => button.addEventListener("click", event => {
      if (button.type === "file") return; // let the file picker open
      event.preventDefault(); event.stopPropagation();
      const key = button.dataset.settingAction;
      if (key === "resetDashboard") resetDashboard();
      else if (key === "resetAnimations") resetAnimations();
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
  function refreshSearchResults(pageKey, targetSelector) {
    const current = $(targetSelector);
    const renderer = window.SplitAppPages[pageKey];
    if (!current || !renderer) return;
    const template = document.createElement("template");
    template.innerHTML = renderer(pageContext());
    const fresh = template.content.querySelector(targetSelector);
    if (!fresh) return;
    current.replaceChildren(...fresh.childNodes);
    if (pageKey === "dashboard") observeDashboardLoaders();
    window.lucide?.createIcons({ root: current, attrs: { "aria-hidden": "true" } });
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
    history = Array.isArray(selected.history) ? selected.history : [];
    if (selected.loadedFromFolder) {
      Object.keys(prefs).forEach(key => delete prefs[key]);
      Object.assign(prefs, JSON.parse(JSON.stringify(prefsDefaults)));
    }
    if (selected.preferences && typeof selected.preferences === "object") Object.assign(prefs, selected.preferences);
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
      await window.SplitAppIDB?.clearShareCache?.().catch(() => {});
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
    history = [];
    localStorage.removeItem(`${storageKey}_history`);
    await Promise.all([persist(), window.SplitAppBackend?.clearJournal?.("history")]);
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
      items = []; history = []; persist(); render(); toast("Tracked data cleared."); return;
    }
    if (action === "factory-reset") {
      if (!(await appConfirm("Factory reset ScreenMark? This removes your library, settings, and app cache from this device.", { title: "Factory reset", confirmLabel: "Reset", danger: true }))) return;
      await clearAppCaches("temporary");
      localStorage.removeItem(`${storageKey}_log`);
      try { await window.Capacitor?.Plugins?.EncryptedStore?.clearState?.(); } catch (_) {}
      items = []; history = [];
      Object.keys(prefs).forEach(key => delete prefs[key]);
      Object.assign(prefs, JSON.parse(JSON.stringify(prefsDefaults)));
      prefs.navIcons = { ...prefsDefaults.navIcons };
      prefs.navBar = { order: [...navKeys], visible: { ...prefsDefaults.navBar.visible } };
      prefs.apiKeys = {}; prefs.sourceOptions = {};
      refreshSourceRegistry();
      persist(); applyPreferences(); render(); toast("ScreenMark has been reset.");
    }
  }
  function moveInOrder(order, key, direction, targetKey = null) {
    const from = order.indexOf(key);
    if (from < 0) return order;
    if (targetKey) {
      const to = order.indexOf(targetKey);
      if (to < 0 || to === from) return order;
      order.splice(from, 1); order.splice(to, 0, key); return order;
    }
    const to = from + (direction === "up" ? -1 : 1);
    if (to >= 0 && to < order.length) { order.splice(from, 1); order.splice(to, 0, key); }
    return order;
  }

  function openItem(item = null) {
    if (page !== "add") addReturnPage = page;
    entryDraftId = item?.id || null;
    addMetadataQuery = item?.title || "";
    addMetadataRequestId++;
    addCategory = item?.category || (activeCategory !== "all" ? activeCategory : config.categories[0].key);
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
      currentBox.innerHTML = results.slice(0, 16).map((result, index) => `<article class="add-metadata-result">${result.image ? `<img src="${esc(result.image)}" alt="" loading="lazy" onerror="this.hidden=true">` : ""}<div><strong>${esc(result.title)}</strong><small>${esc(result.source)}${result.year ? ` · ${esc(result.year)}` : ""}${result.subtitle ? ` · ${esc(result.subtitle)}` : ""}</small><p>${esc(result.description || "")}</p></div><button class="button secondary small" type="button" data-add-metadata-index="${index}">Use</button></article>`).join("");
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
    const old = items.find(item => item.id === id); const key = data.get("category") || old?.category || config.categories[0]?.key;
    const image = String(data.get("image") || "");
    const entry = { ...old, id: id || crypto.randomUUID(), title: String(data.get("title")).trim(), category: key, status: data.get("status") || defaultStatus(key), progress: Math.max(0, Number(data.get("progress")) || 0), goal: Math.max(0, Number(data.get("goal")) || 0), image, ...(image.startsWith("data:image/") ? { localThumbnailData: image } : {}), description: String(data.get("description") || "").trim(), metadataSource: String(data.get("metadataSource") || ""), providerId: String(data.get("providerId") || ""), url: String(data.get("url") || ""), year: String(data.get("year") || ""), createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() };
    stripLocalScores(entry);
    if (!entry.title) return;
    if (old) items[items.indexOf(old)] = entry; else { items.unshift(entry); recordLibraryChange("added", `Added ${entry.title}.`, [entry.id]); }
    if (old && JSON.stringify(old) !== JSON.stringify(entry)) recordLibraryChange("edited", `Updated ${entry.title}.`, [entry.id]);
    if (entry.status !== roles.queued && entry.status !== old?.status) history.unshift({ itemId: entry.id, title: entry.title, action: entry.status, status: entry.status, at: Date.now() });
    persist({ ids: [entry.id] }); entryDraftId = null; goto(addReturnPage); toast(old ? "Entry updated." : "Added to your library.");
  }
  function saveAddForm(form) {
    if (!form?.isConnected || !form.reportValidity()) return;
    saveItem({ currentTarget: form });
  }
  async function updateProgress(id) {
    const item = items.find(entry => entry.id === id); if (!item) return;
    const step = Math.max(1, Number(category(item.category)?.step) || Number(prefs.progressIncrement) || 1); if (!stepEpisodes(item, step)) item.progress = (Number(item.progress) || 0) + step; item.updatedAt = Date.now();
    const previousStatus = item.status;
    if (item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic") item.status = roles.done;
    if (item.goal && item.progress >= item.goal && prefs.automaticCompletion === "ask" && await appConfirm(`Mark “${item.title}” completed?`, { title: "Completed?", confirmLabel: "Mark completed" })) item.status = roles.done;
    if (item.status !== previousStatus && trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    persist({ ids: [item.id] }); render(); toast("Progress updated.");
  }
  async function deleteItem(id) {
    const item = items.find(entry => entry.id === id); if (!item) return;
    if (!(await appConfirm(`Delete “${item.title}” from your library?`, { title: "Delete title", confirmLabel: "Delete", danger: true }))) return;
    if (prefs.backupBeforeDestructive) exportList({ silent: true });
    recordLibraryChange("removed", `Deleted ${item.title}.`, [id]); items = items.filter(entry => entry.id !== id);
    persist({ removed: [id] }); entryDraftId = null; goto(addReturnPage); toast("Entry deleted.");
  }
  // ⋮ → Edit entry opens the title's details page in edit mode (same as its Edit button).
  function openEdit(id) { if (items.some(entry => entry.id === id)) openDetails(id, true); }
  function saveDetailEdit(event) {
    event.preventDefault();
    const item = items.find(row => row.id === detailItemId);
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
    discoverQuery = $("#discover-query")?.value || discoverQuery;
    // Some Android keyboards emit both Enter and the search action for one submission.
    if (discoverQuery === discoverSubmitted && Date.now() - discoverSubmittedAt < 500) return;
    discoverSubmitted = discoverQuery; discoverSubmittedAt = Date.now();
    discover();
  }
  // Discover / Explore / Mix search one type at a time; a single source only offers the types it supports.
  function currentDiscoverCategory() {
    const source = discoverSource ? window.SplitAppSources.list().find(row => row.key === discoverSource) : null;
    const allowed = source ? source.categories : config.categories.map(row => row.key);
    const preferred = discoverCategoryChoice || (activeCategory !== "all" ? activeCategory : "series");
    return allowed.includes(preferred) ? preferred : allowed.includes("series") ? "series" : allowed[0];
  }

  function paintDiscoverResults(results, sourceKey) {
    const key = currentDiscoverCategory();
    const sourceName = window.SplitAppSources.list().find(source => source.key === sourceKey)?.name;
    const currentMessage = $("#discover-message"), box = $("#discover-results"), empty = $("#discover-empty");
    if (!currentMessage || !box || !empty) return false;
    currentMessage.textContent = results.length ? `${results.length} results found${sourceName ? ` from ${sourceName}` : ""}.${results.warnings?.length ? ` ${results.warnings.length} source(s) did not respond: ${results.warnings.join("; ")}` : ""}` : `No results found${sourceName ? ` from ${sourceName}` : ""}.`;
    box.innerHTML = results.slice(0, 30).map((result, index) => `<article class="discover-card"><img src="${esc(result.image || "")}" alt="" loading="lazy" onerror="this.hidden=true"><div class="discover-card-body"><h3>${esc(result.title)}</h3><p>${esc(result.year || labelCategory(result.category || key))}${result.description ? ` · ${esc(result.description.slice(0, 85))}` : ""}</p><div class="toolbar"><button class="button secondary small" data-discover-details="${index}">Details</button><button class="button primary small" data-discover-add="${index}">Add</button></div></div></article>`).join("");
    empty.hidden = results.length > 0;
    box._results = results;
    return true;
  }
  let suggestionsCache = null, suggestionsRequest = 0;
  async function loadDiscoverSuggestions() {
    const requestId = ++suggestionsRequest, sourceKey = discoverSource, category = currentDiscoverCategory();
    const box = $("#discover-results"), empty = $("#discover-empty"), message = $("#discover-message");
    if (!box) return;
    if (prefs.metadataMode === "offline") return;
    const cacheKey = `${sourceKey}|${category}|${new Date().toDateString()}`;
    if (empty) empty.hidden = true;
    let sections = suggestionsCache?.key === cacheKey ? suggestionsCache.sections : null;
    if (!sections) {
      box.innerHTML = `<div class="discover-suggest-loading" aria-hidden="true">${"<span></span>".repeat(6)}</div>`;
      try { sections = await window.SplitAppDiscovery.trending(category, detailSettings(), sourceKey); }
      catch (error) {
        if (requestId !== suggestionsRequest || page !== "discover") return;
        box.innerHTML = ""; if (empty) empty.hidden = false;
        if (message && navigator.onLine) message.textContent = "Could not load suggestions right now.";
        return;
      }
      suggestionsCache = { key: cacheKey, sections };
    }
    if (requestId !== suggestionsRequest || page !== "discover" || discoverQuery || $("#discover-query")?.value.trim()) return;
    const flat = [];
    const html = sections.map(section => `<section class="discover-suggest"><h2>${esc(section.title)}</h2><div class="discover-rail">${section.items.map(result => {
      const index = flat.push(result) - 1;
      return `<article class="discover-card discover-suggest-card"><img src="${esc(result.image || "")}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true"><div class="discover-card-body"><h3>${esc(result.title)}</h3><p>${esc(result.subtitle || result.year || "")}</p><div class="toolbar"><button class="button secondary small" data-discover-details="${index}">Details</button><button class="button primary small" data-discover-add="${index}">Add</button></div></div></article>`;
    }).join("")}</div></section>`).join("");
    box.innerHTML = html || ""; box._results = flat;
    if (empty) empty.hidden = flat.length > 0;
  }
  async function discover() {
    const query = String(discoverQuery || "").trim(); const key = currentDiscoverCategory();
    const requestId = ++discoverRequestId; const sourceKey = discoverSource;
    const message = $("#discover-message");
    if (!query) { message.textContent = ""; loadDiscoverSuggestions(); return; }
    const initialEmpty = $("#discover-empty"); if (initialEmpty?.isConnected) initialEmpty.hidden = true;
    if (prefs.metadataMode === "offline") { message.textContent = "Online metadata is disabled in Settings."; return; }
    if (!navigator.onLine) { message.textContent = "You are offline. Reconnect and try again."; return; }
    if (message?.isConnected) message.textContent = "Searching connected sources…";
    const initialBox = $("#discover-results"); if (initialBox?.isConnected) initialBox.innerHTML = "";
    try {
      const results = sourceKey ? await exploreSourceSearch(query, sourceKey) : await discoverSearch(query, key);
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
      const consentLink = $("#discover-consent-link");
      if (consentLink && sourceKey === "howlongtobeat" && status === 403) {
        consentLink.hidden = false;
        // Give the user an immediate, explicit path to review the provider's
        // consent prompt after a 403. ScreenMark never accepts terms for them.
        showPopup($("#discover-consent-dialog"));
      }
      recordLog("warning", `Discover search failed${sourceName ? ` for ${sourceName}` : ""}: ${providerMessage}`);
    }
  }
  async function discoverSearch(query, key) {
    if (!window.SplitAppDiscovery) throw new Error("This app's discovery backend did not load.");
    return window.SplitAppDiscovery.search(query, key, {
      metadataSources: prefs.metadataSources, metadataSourceOrder: prefs.metadataSourceOrder, apiKeys: prefs.apiKeys, sourceOptions: prefs.sourceOptions,
      offlineFallback: prefs.offlineFallback, metadataRefreshInterval: prefs.metadataRefreshInterval
    });
  }
  async function exploreSourceSearch(query, sourceKey) {
    if (!window.SplitAppDiscovery?.searchSource) throw new Error("The metadata search service did not load.");
    return window.SplitAppDiscovery.searchSource(query, currentDiscoverCategory(), {
      metadataSources: prefs.metadataSources, metadataSourceOrder: prefs.metadataSourceOrder, apiKeys: prefs.apiKeys, sourceOptions: prefs.sourceOptions,
      offlineFallback: prefs.offlineFallback, metadataRefreshInterval: prefs.metadataRefreshInterval
    }, sourceKey);
  }
  function syncBackupSchedule() {
    const plugin = window.Capacitor?.Plugins?.BackupScheduler;
    if (!plugin) return;
    if (prefs.backgroundBackups && prefs.backupSchedule === "daily") plugin.schedule?.().catch(() => toast("Could not schedule encrypted backups."));
    else plugin.cancel?.().catch(() => {});
  }
  function addDiscoverResult(result, origin = "Discover") {
    if (!result) return null;
    const existing = items.find(item => item.category === result.category && item.title.toLowerCase() === result.title.toLowerCase());
    if (existing) {
      // A Mix add of a title that was saved from a single source upgrades that entry to a Mix entry.
      if (result.source === "mix" && existing.metadataSource !== "mix") {
        const from = window.SplitAppSources.list().find(source => source.key === existing.metadataSource)?.name || existing.metadataSource || "a manual entry";
        appConfirm(`“${existing.title}” is already in your library (${from}). Convert it to a Mix entry that merges every enabled source?`, { title: "Convert to Mix entry", confirmLabel: "Convert" }).then(ok => {
          if (ok) { Object.assign(existing, { metadataSource: "mix", source: "mix", providerId: result.providerId, updatedAt: Date.now() }); persist({ ids: [existing.id] }); render(); toast("Converted to a Mix entry."); }
        });
        return existing;
      }
      toast("That entry is already in your library."); return existing;
    }
    const item = stripLocalScores({ ...result, metadataSource: result.source, id: crypto.randomUUID(), status: prefs.defaultStatus || defaultStatus(result.category), progress: 0, createdAt: Date.now(), updatedAt: Date.now() });
    items.unshift(item); recordLibraryChange("added", `Added ${item.title} from ${origin}.`, [item.id]); if (trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() }); persist({ ids: [item.id] }); toast("Added to your library."); hydrateSavedItem(item); return item;
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
  function applyMixMatchState(item, loaded) {
    if (loaded.sourceMeta) item.sourceMeta = { ...(item.sourceMeta || {}), ...loaded.sourceMeta };
    if (loaded.noMatchSources || loaded.sourceMeta) {
      const noMatch = { ...(item.mixNoMatch || {}) };
      Object.keys(loaded.sourceMeta || {}).forEach(key => delete noMatch[key]);
      (loaded.noMatchSources || []).forEach(key => { noMatch[key] = noMatch[key] || Date.now(); });
      item.mixNoMatch = noMatch;
    }
    if (loaded.reviewFlags) {
      const review = loaded.reviewFlags.filter(flag => String((item.matchOk || {})[flag.key] ?? "") !== String(flag.providerId));
      if (review.length) item.matchReview = review.map(({ key, title, providerId }) => ({ key, title, providerId })); else delete item.matchReview;
    }
    return item.matchReview?.length || 0;
  }
  // ---- Mix fetch (experimental) ----
  const mixChips = keys => (keys || []).map(key => window.SplitAppSources.list().find(source => source.key === key)?.name || key).map(name => `<span class="mix-chip">${esc(name)}</span>`).join("");
  function paintMixResults() {
    const box = $("#mix-results"), message = $("#mix-message"); if (!box) return;
    const rows = mixCache?.results || [];
    box.innerHTML = rows.map((row, index) => `<li class="mix-row" data-mix-open="${index}" role="button" tabindex="0"><span class="mix-row-copy"><strong>${esc(row.title)}</strong><small>${esc(row.year || "")}</small><span class="mix-row-sources">${mixChips(row.sources)}</span></span><button type="button" class="button primary small" data-mix-add="${index}" aria-label="Add ${esc(row.title)}">Add</button></li>`).join("");
    if (message && mixCache && !message.textContent) message.textContent = rows.length ? `${rows.length} titles · open one to merge details from all sources.` : "No games found.";
  }
  async function runMixSearch() {
    const query = ($("#mix-query")?.value || "").trim(), message = $("#mix-message"), box = $("#mix-results");
    if (!query) { if (message) message.textContent = "Type a title to search."; return; }
    const requestId = ++mixRequest; if (box) box.innerHTML = ""; if (message) message.textContent = "Searching all enabled sources…";
    try {
      const results = await window.SplitAppMix.search(query, mixCategory || (activeCategory !== "all" ? activeCategory : "all"), detailSettings());
      if (requestId !== mixRequest || page !== "mix") return;
      mixCache = { query, results }; if (message) message.textContent = ""; paintMixResults();
    } catch (error) { if (requestId === mixRequest && message) message.textContent = error?.message || "Search failed."; }
  }
  const mixItem = row => ({ title: row.title, category: row.category || config.categories[0].key, source: "mix", metadataSource: "mix", providerId: row.key, image: row.image || "", year: row.year || "", description: "", url: "" });
  function openMixDetails(row) {
    clearDetailStack(); detailReturnPage = "mix"; detailPreview = mixItem(row); detailEditMode = false; detailItemId = null; detailData = null; detailError = "";
    goto("details"); loadDetails();
  }
  async function addMixResult(row) {
    const saved = addDiscoverResult(mixItem(row)); if (!saved) return;
    toast("Added. Merging details from all sources…");
    try {
      const loaded = await window.SplitAppDetails.load(saved, detailSettings());
      saved.metadataSource = "mix"; saved.source = "mix"; saved.mixSources = loaded.mixSources || [];
      // Keep provider IDs on the saved title so refreshes can load known matches directly.
      if (loaded.sourceIds) saved.sourceIds = { ...(saved.sourceIds || {}), ...loaded.sourceIds };
      const primary = loaded.mixPrimary || (saved.mixPrimary?.key ? saved.mixPrimary : null);
      if (primary) saved.mixPrimary = primary;
      saved.mixSourceKeys = [...new Set([...(saved.mixSourceKeys || []), ...(loaded.facts?.sources || []), ...Object.keys(loaded.sourceIds || {})])];
      saved.cachedDetails = loaded; saved.facts = mergeFacts(saved.facts, loaded.facts); applyMixMatchState(saved, loaded);
      saved.description = loaded.description || saved.description; saved.year = loaded.year || saved.year; saved.image = loaded.portraitImage || loaded.image || saved.image;
      saved.updatedAt = Date.now(); persist({ ids: [saved.id] }); toast(`Merged details from ${loaded.mixSources?.length || 0} sources.`);
    } catch (error) { recordLog("warning", `Mix fetch could not merge details for ${saved.title}: ${error?.message || error}`); toast("Added. Details could not be merged yet."); }
  }
  // Looks up runtime / episode counts (OMDb, TVmaze, then AniList) for titles whose saved source has none.
  async function findMissingHours(button) {
    if (factsRunning) return; factsRunning = true; button.disabled = true;
    const hasRuntime = item => Number(item.facts?.totalMinutes) || Number(item.facts?.runtimeMinutes);
    const pending = items.filter(item => !hasRuntime(item));
    const visible = new Set(pending.slice(0, 8).map(item => item.id));
    const setLookupState = (item, state) => {
      if (!visible.has(item.id)) return;
      const row = document.querySelector(`[data-runtime-item="${CSS.escape(item.id)}"]`);
      const label = row?.querySelector("[data-runtime-state]");
      if (label) { label.textContent = state; row.dataset.state = state === "Found" ? "found" : state === "Looking up…" ? "looking" : "missing"; }
    };
    let found = 0;
    for (const [index, item] of pending.entries()) {
      button.textContent = `Looking up ${index + 1} of ${pending.length}…`;
      setLookupState(item, "Looking up…");
      try {
        const runtime = await window.SplitAppMix.runtime(item, detailSettings());
        if (runtime) { item.facts = mergeFacts(item.facts, runtime); if (!Number(item.goal)) item.goal = category(item.category)?.unit === "minutes" ? runtime.runtimeMinutes : runtime.episodeCount || 0; item.updatedAt = Date.now(); found += 1; setLookupState(item, "Found"); persist(); }
        else setLookupState(item, "No runtime found");
      } catch (error) { setLookupState(item, "Lookup failed"); recordLog("warning", `Runtime lookup failed for ${item.title}: ${error?.message || error}`); }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    factsRunning = false; render(); toast(found ? `Found runtimes for ${found} of ${pending.length} titles.` : "No runtimes found. Enable TVmaze or AniList, or add an OMDb key.");
  }
  // Saves provider details (runtime, episodes, cast, ratings, images) for titles that never opened their details page.
  let factsRunning = false;
  async function fetchMissingFacts(button) {
    if (factsRunning) return; factsRunning = true; button.disabled = true;
    const pending = items.filter(item => item.metadataSource && item.providerId && !item.facts?.fetchedAt);
    let done = 0;
    for (const item of pending) {
      button.textContent = `Fetching ${done + 1} of ${pending.length}…`;
      try {
    const loaded = await window.SplitAppDetails.load(item, detailSettings());
        item.cachedDetails = loaded; item.metadataFetchedAt = Number(loaded.fetchedAt || loaded.facts?.fetchedAt) || Date.now(); item.facts = mergeFacts(item.facts, loaded.facts);
        item.description = loaded.description || item.description; item.year = loaded.year || item.year;
        item.image = item.customCover || loaded.portraitImage || loaded.image || item.image;
        done += 1; persist({ ids: [item.id] });
      } catch (error) { recordLog("warning", `Could not fetch details for ${item.title}: ${error?.message || error}`); }
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    factsRunning = false; render(); toast(`Saved details for ${done} of ${pending.length} titles.`);
  }
  function readCustomSourceForm() {
    const form = $("#custom-source-form"); if (!form) return null;
    const get = name => String(form.elements[name]?.value || "").trim();
    const group = prefix => Object.fromEntries([...form.elements].filter(el => el.name?.startsWith(prefix)).map(el => [el.name.slice(prefix.length), String(el.value || "").trim()]).filter(([, value]) => value));
    return { id: get("sourceId") || crypto.randomUUID().slice(0, 8), name: get("name"), searchUrl: get("searchUrl"), apiKey: get("apiKey"), categories: get("categories").split(",").filter(Boolean), apiKeyHeader: get("apiKeyHeader"), resultsPath: get("resultsPath"), imageTemplate: get("imageTemplate"), suggestionsUrl: get("suggestionsUrl"), detailUrl: get("detailUrl"), detailRoot: get("detailRoot"), map: group("map."), detailMap: group("dmap.") };
  }
  function validateCustomSource(config) {
    if (!config?.name) return "Give the source a name.";
    if (!/^https?:\/\//i.test(config.searchUrl)) return "The search URL must start with http:// or https://.";
    if (!/\{query\}/.test(config.searchUrl)) return "The search URL needs {query} where the search text goes.";
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
  function detailSettings() { return { syncTimeout: prefs.syncTimeout || 25, syncRetries: prefs.syncRetries ?? 1, syncRetryDelay: prefs.syncRetryDelay || 2, syncMaxSources: prefs.syncMaxSources || 0, metadataSources: prefs.metadataSources, apiKeys: prefs.apiKeys, sourceOptions: prefs.sourceOptions, offlineFallback: prefs.offlineFallback }; }
  async function loadDetails(targetId = null) {
    const item = detailPreview || items.find(row => String(row.id) === String(targetId ?? detailItemId));
    const requestId = ++detailRequest; detailData = item?.cachedDetails || null; detailError = "";
    if (!item) { detailLoading = false; render(); return; }
    if (!detailPreview && window.SplitAppBackend?.loadItemImages) {
      try {
        const localImageData = await window.SplitAppBackend.loadItemImages(item);
        if (requestId === detailRequest && Object.keys(localImageData).length) item.localImageData = localImageData;
      } catch (_) {}
    }
    if (item.metadataSource === "mix" ? !window.SplitAppMix?.load : (!item.metadataSource || !item.providerId)) { detailLoading = false; detailError = ""; render(); return; }
    detailLoading = true; render();
    try {
      const loaded = await window.SplitAppDetails.load(item, detailSettings());
      if (requestId === detailRequest) {
        detailData = loaded;
        if (detailPreview) { detailPreview.image ||= loaded.portraitImage || loaded.image || ""; detailPreview.year ||= loaded.year || ""; detailPreview.description ||= loaded.description || ""; detailPreview.title = loaded.title || detailPreview.title; }
        if (!detailPreview) {
          item.cachedDetails = loaded; item.metadataFetchedAt = Number(loaded.fetchedAt || loaded.facts?.fetchedAt) || Date.now();
          if (item.metadataSource === "mix") item.mixSources = loaded.mixSources || item.mixSources;
          if (loaded.sourceIds) item.sourceIds = { ...(item.sourceIds || {}), ...loaded.sourceIds };
          if (loaded.mixPrimary?.key) item.mixPrimary = loaded.mixPrimary;
          if (loaded.mixSources?.length) item.mixSources = [...new Set([...(item.mixSources || []), ...loaded.mixSources])];
          if (loaded.facts?.sources?.length) item.mixSourceKeys = [...new Set([...(item.mixSourceKeys || []), ...loaded.facts.sources])];
          applyMixMatchState(item, loaded);
          item.facts = item.relinkFresh ? { ...(loaded.facts || {}) } : mergeFacts(item.facts, loaded.facts);
          delete item.relinkFresh;
          if (!Number(item.goal)) item.goal = category(item.category)?.unit === "minutes" ? Number(loaded.facts?.runtimeMinutes) || 0 : Number(loaded.goal) || Number(loaded.facts?.episodeCount) || 0;
          item.description = loaded.description || item.description;
          item.year = loaded.year || item.year;
          item.image = item.customCover || loaded.portraitImage || loaded.image || item.image;
          item.backdrop = loaded.landscapeImage || loaded.backgroundImage || item.backdrop;
          item.updatedAt = Date.now();
          persist({ ids: [item.id] });
          const localImageData = await window.SplitAppBackend?.loadItemImages?.(item);
          if (localImageData && Object.keys(localImageData).length) item.localImageData = localImageData;
        }
      }
    }
    catch (error) { if (requestId === detailRequest) { detailError = error?.message || "Could not load source details."; recordLog("error", `${item.metadataSource} detail request failed: ${detailError}`); } }
    finally { if (requestId === detailRequest) { detailLoading = false; render(); if (page === "details") historyPush(true); } }
  }
  // In-app drill-down (cast, characters, staff, episodes, suggestions); each step keeps the page it came from for Back.
  const detailSnapshot = () => ({ detailPreview, detailItemId, detailData, detailError, detailLoading, detailEditMode, detailReturnPage, detailRef, detailRefOffset, refData, refError, scroll: window.scrollY });
  function clearDetailStack() { detailTab = ""; detailSeason = ""; detailStack = []; detailRef = null; detailRefOffset = 0; refData = null; refError = ""; refLoading = false; refRequest++; }
  function openDetailRef(type, id, title, extra, replace = false) {
    if (!id) return;
    if (!replace) detailStack.push(detailSnapshot());
    if (type === "show") {
      const existing = items.find(row => row.metadataSource === "tvmaze" && String(row.providerId) === String(id));
      detailRef = null; refData = null; detailEditMode = false; detailError = ""; detailData = null; detailRequest++;
      if (existing) { detailPreview = null; detailItemId = existing.id; }
      else { detailItemId = null; detailPreview = { id: `tvmaze:${id}`, title: title || "Series", category: "series", source: "tvmaze", metadataSource: "tvmaze", providerId: String(id), status: defaultStatus("series") }; }
      render(); scrollPageTop(); historyPush(replace); loadDetails(); return;
    }
    if (!replace) detailRefOffset = 0;
    detailRef = { type, id, title, extra }; refData = null; refError = ""; render(); scrollPageTop(); historyPush(replace); loadDetailRef();
  }
  async function loadDetailRef() {
    const ref = detailRef, requestId = ++refRequest; if (!ref) return;
    refLoading = true; render();
    try { const loaded = await window.SplitAppDetails.loadRef(ref, detailSettings()); if (requestId === refRequest) refData = loaded; }
    catch (error) { if (requestId === refRequest) refError = error?.message || "Could not load this page."; }
    finally { if (requestId === refRequest) { refLoading = false; render(); scrollPageTop(); historyPush(true); } }
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
    if (!item?.metadataSource || item.metadataSource === "mix" || !item.providerId || item.cachedDetails || hydrating.has(item.id) || prefs.metadataMode === "offline") return;
    hydrating.add(item.id);
    try {
      const loaded = await window.SplitAppDetails.load(item, detailSettings());
      if (!items.includes(item)) return;
      item.cachedDetails = loaded; item.metadataFetchedAt = Number(loaded.fetchedAt || loaded.facts?.fetchedAt) || Date.now(); item.facts = mergeFacts(item.facts, loaded.facts);
      if (loaded.sourceIds) item.sourceIds = { ...(item.sourceIds || {}), ...loaded.sourceIds };
      if (loaded.mixPrimary?.key) item.mixPrimary = loaded.mixPrimary;
      if (loaded.mixSources?.length) item.mixSources = [...new Set([...(item.mixSources || []), ...loaded.mixSources])];
      if (loaded.facts?.sources?.length) item.mixSourceKeys = [...new Set([...(item.mixSourceKeys || []), ...loaded.facts.sources])];
      if (!Number(item.goal)) item.goal = category(item.category)?.unit === "minutes" ? Number(loaded.facts?.runtimeMinutes) || 0 : Number(loaded.goal) || Number(loaded.facts?.episodeCount) || 0;
      item.description = loaded.description || item.description; item.year = loaded.year || item.year;
      item.image = item.customCover || loaded.portraitImage || loaded.image || item.image; item.backdrop = loaded.landscapeImage || item.backdrop;
      item.updatedAt = Date.now(); persist({ ids: [item.id] }); if (page === "details" && detailItemId === item.id) render();
    } catch (error) { recordLog("warning", `Could not save details for ${item.title}: ${error?.message || error}`); }
    finally { hydrating.delete(item.id); }
  }
  let selectMode = false;
  const selectedIds = new Set();
  let lastBulkBackupAt = 0;
  function backupBeforeBulk() {
    if (!prefs.backupBeforeDestructive || Date.now() - lastBulkBackupAt < 60000) return;
    lastBulkBackupAt = Date.now(); try { exportList({ silent: true }); } catch (_) {}
  }
  async function removeItemsWithUndo(list) {
    const removed = list.map(item => ({ item: JSON.parse(JSON.stringify(item)), index: items.indexOf(item) })).filter(row => row.index >= 0);
    if (!removed.length) return;
    backupBeforeBulk(); const ids = new Set(removed.map(row => String(row.item.id)));
    recordLibraryChange("removed", `Removed ${removed.length} ${removed.length === 1 ? "title" : "titles"}: ${removed.slice(0, 6).map(row => row.item.title).join(", ")}`, [...ids]);
    items = items.filter(item => !ids.has(String(item.id))); await persist({ removed: [...ids] }); render();
    toastUndo(`Removed ${removed.length} ${removed.length === 1 ? "title" : "titles"}.`, async () => {
      recordLibraryChange("restored", `Undo: restored ${removed.length} ${removed.length === 1 ? "title" : "titles"}.`, [...ids]);
      removed.sort((a, b) => a.index - b.index).forEach(row => items.splice(Math.min(row.index, items.length), 0, row.item));
      await persist({ ids: [...ids] }); render(); toast("Restored.");
    });
  }
  function enterSelectMode(id) { selectMode = true; selectedIds.clear(); if (id != null) selectedIds.add(String(id)); document.body.classList.add("select-mode"); applySelectionUI(); navigator.vibrate?.(15); }
  function exitSelectMode() { selectMode = false; selectedIds.clear(); document.body.classList.remove("select-mode"); applySelectionUI(); }
  function applySelectionUI() {
    document.querySelectorAll(".item-card[data-item]").forEach(card => card.classList.toggle("is-selected", selectMode && selectedIds.has(card.dataset.item)));
    let bar = $("#select-bar");
    if (!selectMode) { bar?.remove(); $("#select-toggle")?.classList.remove("is-active"); $("#select-toggle")?.setAttribute("aria-pressed", "false"); return; }
    $("#select-toggle")?.classList.add("is-active"); $("#select-toggle")?.setAttribute("aria-pressed", "true");
    if (!bar) { bar = document.createElement("div"); bar.id = "select-bar"; bar.className = "select-bar"; bar.setAttribute("role", "toolbar"); bar.innerHTML = '<span class="select-count" data-select-count></span><button type="button" data-select-act="status">Status</button><button type="button" data-select-act="favorite">♥ Favorite</button><button type="button" data-select-act="delete" class="danger">Delete</button><button type="button" data-select-act="merge" disabled>Merge</button><button type="button" data-select-act="all">All</button><button type="button" data-select-act="done">Done</button>'; document.body.appendChild(bar); bar.addEventListener("click", onSelectBarClick); }
    const count = bar.querySelector("[data-select-count]"); count.textContent = `${selectedIds.size} ✓`; count.setAttribute("aria-label", `${selectedIds.size} selected`);
    bar.querySelectorAll('[data-select-act="status"],[data-select-act="favorite"],[data-select-act="delete"]').forEach(button => { button.disabled = selectedIds.size === 0; });
    const merge = bar.querySelector('[data-select-act="merge"]'); if (merge) merge.disabled = selectedIds.size !== 2 || selectedItems().some((item, _, list) => item.category !== list[0].category);
  }
  const selectedItems = () => items.filter(item => selectedIds.has(String(item.id)));
  async function onSelectBarClick(event) {
    const act = event.target.closest("[data-select-act]")?.dataset.selectAct; if (!act) return;
    const list = selectedItems();
    if (act === "done") { exitSelectMode(); return; }
    if (act === "all") { let visible = window.SplitAppLibrary.create(pageContext()).filteredItems(libraryQuery); if (dashboardStatusFilter !== "all") visible = visible.filter(item => item.status === dashboardStatusFilter); visible.forEach(item => selectedIds.add(String(item.id))); applySelectionUI(); return; }
    if (act === "merge") { if (list.length !== 2 || list[0].category !== list[1].category) { toast("Select two titles from the same category to merge."); return; } exitSelectMode(); await mergeLibraryItems(list[0].id, list[1].id); return; }
    if (!list.length) return;
    if (act === "favorite") {
      const next = list.some(item => !item.favorite), before = list.map(item => [item, Boolean(item.favorite), item.updatedAt]);
      recordLibraryChange("favorite", `${next ? "Favorited" : "Unfavorited"} ${list.length} ${list.length === 1 ? "title" : "titles"}.`, list.map(item => item.id));
      list.forEach(item => { item.favorite = next; item.updatedAt = Date.now(); }); await persist({ ids: list.map(item => item.id) }); exitSelectMode(); render();
      toastUndo(`${next ? "Added" : "Removed"} ${list.length} ${list.length === 1 ? "title" : "titles"} ${next ? "to" : "from"} favorites.`, async () => { before.forEach(([item, favorite, updatedAt]) => { item.favorite = favorite; item.updatedAt = updatedAt; }); await persist({ ids: list.map(item => item.id) }); render(); });
    } else if (act === "delete") {
      if (!(await appConfirm(`Remove ${list.length} ${list.length === 1 ? "title" : "titles"} from your collection?`, { title: "Remove titles", confirmLabel: "Remove", danger: true }))) return;
      exitSelectMode(); await removeItemsWithUndo(list);
    } else if (act === "status") {
      const statuses = [...new Set(list.flatMap(item => category(item.category)?.statuses || []))];
      let dialog = $("#bulk-status-dialog"); if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "bulk-status-dialog"; dialog.className = "ios-action-sheet"; document.body.appendChild(dialog); }
      dialog.innerHTML = `<div class="ios-action-group"><p>Set ${list.length} ${list.length === 1 ? "title" : "titles"} to…</p>${statuses.map(status => `<button type="button" data-bulk-status="${esc(status)}">${esc(status)}</button>`).join("")}</div><div class="ios-action-group"><button type="button" data-bulk-status="">Cancel</button></div>`;
      dialog.onclick = async event2 => { if (event2.target === dialog) { closePopup(dialog); return; } const button = event2.target.closest("[data-bulk-status]"); if (!button) return; const status = button.dataset.bulkStatus; closePopup(dialog); if (!status) return; backupBeforeBulk(); const before = list.map(item => ({ item, status: item.status, progress: item.progress, updatedAt: item.updatedAt })), added = [];
        list.forEach(item => { if (item.status === status) return; item.status = status; item.updatedAt = Date.now(); if (status === roles.done && Number(item.goal) > 0) item.progress = Math.max(Number(item.progress) || 0, Number(item.goal)); if (trackedStatuses.includes(status)) { const entry = { itemId: item.id, title: item.title, action: status, status, at: Date.now() }; history.unshift(entry); added.push(entry); } });
        recordLibraryChange("status", `Marked ${list.length} ${list.length === 1 ? "title" : "titles"} as ${status}.`, list.map(item => item.id));
        await persist({ ids: list.map(item => item.id) }); exitSelectMode(); render(); toastUndo(`Marked ${list.length} ${list.length === 1 ? "title" : "titles"} as ${status}.`, async () => { before.forEach(row => { row.item.status = row.status; row.item.progress = row.progress; row.item.updatedAt = row.updatedAt; }); history = history.filter(entry => !added.includes(entry)); await persist({ ids: list.map(item => item.id) }); render(); });
      }; showPopup(dialog);
    }
  }
  document.addEventListener("click", event => { if (!selectMode || page !== "dashboard") return; const card = event.target.closest?.(".item-card[data-item]"); if (!card || event.target.closest("button, a, input, select, textarea")) return; event.preventDefault(); event.stopPropagation(); selectedIds.has(card.dataset.item) ? selectedIds.delete(card.dataset.item) : selectedIds.add(card.dataset.item); applySelectionUI(); }, true);
  document.addEventListener("click", event => {
    const toggle = event.target.closest?.("#select-toggle");
    if (toggle) { event.preventDefault(); event.stopPropagation(); selectMode ? exitSelectMode() : enterSelectMode(); return; }
    const share = event.target.closest?.("[data-share-all]");
    if (share) { let selected = window.SplitAppLibrary.create(pageContext()).filteredItems(libraryQuery); if (dashboardStatusFilter !== "all") selected = selected.filter(item => item.status === dashboardStatusFilter); openShareList("Collection", selected); }
  }, true);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && selectMode) exitSelectMode(); });

  let metadataSync = null;
  function saveMetadataSyncState() {
    try { if (metadataSyncState) localStorage.setItem(`${storageKey}_metadata_sync`, JSON.stringify(metadataSyncState)); else localStorage.removeItem(`${storageKey}_metadata_sync`); } catch (_) {}
  }
  const metadataStamp = item => Number(item?.metadataFetchedAt || item?.cachedDetails?.fetchedAt || item?.cachedDetails?.facts?.fetchedAt || item?.facts?.fetchedAt) || (item?.cachedDetails ? Number(item.updatedAt) || 0 : 0);
  const syncCounts = () => ({ total: metadataSyncState?.entries?.length || 0, done: metadataSyncState?.entries?.filter(row => row.status === "done").length || 0, failed: metadataSyncState?.entries?.filter(row => row.status === "failed").length || 0, remaining: metadataSyncState?.entries?.filter(row => ["queued", "running"].includes(row.status)).length || 0 });
  async function waitForSyncResume() {
    if (navigator.onLine && prefs.metadataMode !== "offline" && !document.hidden) return;
    await new Promise(resolve => {
      const done = () => { window.removeEventListener("online", done); document.removeEventListener("visibilitychange", onVisible); resolve(); };
      const onVisible = () => { if (!document.hidden) done(); };
      window.addEventListener("online", done, { once: true }); document.addEventListener("visibilitychange", onVisible);
    });
  }
  async function startMetadataSync(ids = null, retry = false, scope = "all") {
    if (metadataSync) { toast("Metadata refresh is already running."); return metadataSync; }
    if (prefs.metadataMode === "offline" || !navigator.onLine) { toast("Connect to the internet and enable online metadata to refresh."); return; }
    const wanted = ids ? new Set(ids.map(String)) : null;
    if (retry && metadataSyncState) metadataSyncState.entries.forEach(entry => { if ((entry.status === "failed" || entry.status === "running") && (!wanted || wanted.has(String(entry.id)))) { entry.status = "queued"; entry.error = ""; } });
    else {
      const intervalMs = { daily: 86400000, weekly: 7 * 86400000, monthly: 30 * 86400000, never: Infinity }[prefs.metadataRefreshInterval] ?? 7 * 86400000;
      const entries = items.filter(item => {
        if ((wanted && !wanted.has(String(item.id))) || !item.metadataSource || !(item.providerId || item.metadataSource === "mix") || !window.SplitAppSources.available(item.category, prefs).length) return false;
        const stamp = metadataStamp(item);
        if (scope === "missing") return !item.cachedDetails || !stamp;
        if (scope === "needed") return !stamp || (Number.isFinite(intervalMs) && Date.now() - stamp >= intervalMs);
        return true;
      }).map(item => ({ id: String(item.id), title: item.title, status: "queued", error: "" }));
      metadataSyncState = { startedAt: Date.now(), scope, entries };
    }
    saveMetadataSyncState();
    const queue = metadataSyncState?.entries?.filter(row => row.status === "queued") || [];
    if (!queue.length) { toast(retry ? "No failed metadata requests to retry." : scope === "needed" ? "No saved titles need a metadata refresh." : "No saved titles can be refreshed from the enabled sources."); render(); return; }
    const total = metadataSyncState.entries.length;
    toast(`Refreshing metadata · ${syncCounts().done + syncCounts().failed} of ${total}`); render();
    metadataSync = (async () => {
      let nextStartAt = 0;
      const workers = Array.from({ length: Math.min(3, Math.max(1, Number(prefs.metadataSyncWorkers) || 2), queue.length) }, async () => {
        while (queue.length) {
          if (!navigator.onLine || prefs.metadataMode === "offline" || document.hidden) { await waitForSyncResume(); continue; }
          await yieldToUser();
          const requestDelay = Math.max(0, Number(prefs.syncRequestDelay) || 0);
          if (requestDelay) { const startAt = Math.max(Date.now(), nextStartAt); nextStartAt = startAt + requestDelay; if (startAt > Date.now()) await new Promise(resolve => setTimeout(resolve, startAt - Date.now())); }
          if (!navigator.onLine || prefs.metadataMode === "offline" || document.hidden) continue;
          const entry = queue.shift(), item = itemById(entry.id); if (!item || !items.includes(item)) { entry.status = "failed"; entry.error = "Title was removed."; saveMetadataSyncState(); continue; }
          entry.status = "running"; entry.error = ""; saveMetadataSyncState(); render();
          try {
            const loaded = await window.SplitAppDetails.load(item, { ...detailSettings(), forceRefresh: true, background: true, recheckNoMatch: !retry && scope !== "needed" });
            if (!items.includes(item)) throw new Error("Title was removed.");
            item.cachedDetails = loaded; item.metadataFetchedAt = Number(loaded.fetchedAt || loaded.facts?.fetchedAt) || Date.now(); item.facts = item.relinkFresh ? { ...(loaded.facts || {}) } : mergeFacts(item.facts, loaded.facts); delete item.relinkFresh;
            if (loaded.sourceIds) item.sourceIds = { ...(item.sourceIds || {}), ...loaded.sourceIds };
            if (loaded.mixPrimary?.key) item.mixPrimary = loaded.mixPrimary;
            if (loaded.mixSources?.length) item.mixSources = [...new Set([...(item.mixSources || []), ...loaded.mixSources])];
            if (loaded.facts?.sources?.length) item.mixSourceKeys = [...new Set([...(item.mixSourceKeys || []), ...loaded.facts.sources])];
            entry.reviewCount = applyMixMatchState(item, loaded);
            item.description = loaded.description || item.description; item.year = loaded.year || item.year;
            item.image = item.customCover || item.localThumbnailData || loaded.portraitImage || loaded.image || item.image;
            item.backdrop = loaded.landscapeImage || loaded.backgroundImage || item.backdrop; item.updatedAt = Date.now();
            await persist({ ids: [item.id] }); entry.status = "done"; entry.error = "";
          } catch (error) { entry.status = "failed"; entry.error = error?.message || "Metadata refresh failed."; recordLog("warning", `Metadata refresh failed for ${item.title}: ${entry.error}`); }
          saveMetadataSyncState(); render(); const counts = syncCounts(); toast(`Refreshing metadata · ${counts.done + counts.failed} of ${total}`);
        }
      });
      try { await Promise.all(workers); }
      finally {
        metadataSync = null; if (!syncCounts().remaining) metadataSyncState.finishedAt = Date.now(); else delete metadataSyncState.finishedAt; saveMetadataSyncState(); render();
        const counts = syncCounts(); toast(`Metadata refresh: ${counts.done} updated${counts.failed ? ` · ${counts.failed} failed` : ""}.`);
      }
    })();
    return metadataSync;
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
    if (delta > 0) info.eps.filter(entry => !ids.has(String(entry.id))).slice(0, delta).forEach(entry => ids.add(String(entry.id)));
    else [...info.eps].reverse().filter(entry => ids.has(String(entry.id))).slice(0, -delta).forEach(entry => ids.delete(String(entry.id)));
    const currentGoal = Number(item.goal) || info.total;
    item.watchedEpisodeIds = [...ids]; item.progress = ids.size; item.goal = ids.size > currentGoal ? info.total : currentGoal;
    return true;
  }
  function scrollPageTop() { const go = () => { window.scrollTo({ top: 0, behavior: "instant" }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }; go(); requestAnimationFrame(go); }
  function detailBack() {
    const previous = detailStack.pop(); if (!previous) return;
    refRequest++; detailRequest++;
    ({ detailPreview, detailItemId, detailData, detailError, detailEditMode, detailReturnPage, detailRef, detailRefOffset = 0, refData, refError } = previous);
    detailLoading = false; refLoading = false;
    render(); window.scrollTo({ top: previous.scroll || 0, behavior: "instant" }); historyPush(true);
    if (!detailRef && !detailData && (detailPreview || detailItemId)) loadDetails();
  }
  function toggleSeason(itemId, ids, done) {
    const item = items.find(entry => entry.id === itemId); if (!item) return;
    const watched = new Set((item.watchedEpisodeIds || []).map(String));
    ids.forEach(id => done ? watched.delete(id) : watched.add(id));
    const info = window.SplitAppLibrary.episodeInfo(item), currentGoal = Number(item.goal) || Number(detailData?.goal) || watched.size;
    item.watchedEpisodeIds = [...watched]; item.goal = !done && info && watched.size > currentGoal ? info.total : currentGoal; item.progress = watched.size;
    if (item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic") item.status = roles.done;
    item.updatedAt = Date.now(); persist({ ids: [item.id] }); render();
  }
  function toggleEpisodeWatched(itemId, episodeId, episodeTitle) {
    const item = items.find(entry => entry.id === itemId); if (!item) return;
    const watched = new Set((item.watchedEpisodeIds || []).map(String));
    const id = String(episodeId);
    const markingWatched = !watched.has(id);
    const previousStatus = item.status;
    let earlier = 0;
    if (watched.has(id)) watched.delete(id);
    else {
      // Watching an episode means you saw the ones before it: check those too.
      const info = window.SplitAppLibrary.episodeInfo(item), index = info ? info.eps.findIndex(entry => String(entry.id) === id) : -1;
      if (index > 0) info.eps.slice(0, index).forEach(entry => { if (!watched.has(String(entry.id))) { watched.add(String(entry.id)); earlier += 1; } });
      watched.add(id);
    }
    item.watchedEpisodeIds = [...watched];
    const info = window.SplitAppLibrary.episodeInfo(item), currentGoal = Number(item.goal) || Number(detailData?.goal) || watched.size;
    item.goal = markingWatched && info && watched.size > currentGoal ? info.total : currentGoal;
    item.progress = watched.size;
    if (item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic") item.status = roles.done;
    item.updatedAt = Date.now();
    if (item.status !== previousStatus && trackedStatuses.includes(item.status)) history.unshift({ itemId: item.id, title: item.title, action: item.status, status: item.status, at: Date.now() });
    persist({ ids: [item.id] }); render(); toast(watched.has(id) ? (earlier ? `Episode and ${earlier} earlier ${earlier === 1 ? "episode" : "episodes"} marked watched.` : "Episode marked watched.") : "Episode marked unwatched.");
  }
  function deleteFromDetails(id) {
    const item = items.find(entry => entry.id === id); if (!item) return;
    recordLibraryChange("removed", `Deleted ${item.title}.`, [id]);
    if (prefs.backupBeforeDestructive) exportList({ silent: true });
    items = items.filter(entry => entry.id !== id);
    detailItemId = null; detailData = null; detailPreview = null;
    persist({ removed: [id] }); goto(detailReturnPage); toast("Entry deleted.");
  }
  function requestDeleteDetails(id) {
    if (!items.some(entry => entry.id === id)) return;
    showPopup($("#detail-delete-dialog"));
  }
  function setItemStatus(item, status) {
    if (!item || item.status === status) return;
    item.status = status; item.updatedAt = Date.now();
    if (trackedStatuses.includes(status)) history.unshift({ itemId: item.id, title: item.title, action: status, status, at: Date.now() });
    persist({ ids: [item.id] });
  }
  function resetMixCheck(item) { delete item.mixCheckedAt; delete item.mixCheckedSources; delete item.mixFailedAt; }
  async function mergeLibraryItems(sourceId, targetId, { confirmed = false } = {}) {
    const source = itemById(String(sourceId)), target = itemById(String(targetId));
    if (!source || !target || source === target) return;
    if (source.category !== target.category) { toast("Merge titles from the same category."); return; }
    const keep = async () => {
      const sourceCopy = JSON.parse(JSON.stringify(source)), targetCopy = JSON.parse(JSON.stringify(target));
      const sourceIndex = items.indexOf(source);
      const movedHistory = history.filter(entry => String(entry.itemId) === String(source.id)).map(entry => ({ ...entry }));
      const primaryKey = target.metadataSource === "mix" ? target.mixPrimary?.key : target.metadataSource;
      const primaryId = target.metadataSource === "mix" ? target.mixPrimary?.providerId : target.providerId;
      const sourceKeys = [source.metadataSource, ...Object.keys(source.sourceIds || {}), ...(source.mixSourceKeys || [])].filter(Boolean);
      const incomingIds = { ...(source.sourceIds || {}) };
      if (source.metadataSource && source.providerId) incomingIds[source.metadataSource] = source.providerId;
      const sourceIds = { ...(target.sourceIds || {}), ...incomingIds };
      const mixPins = { ...(target.mixPins || {}), ...incomingIds };
      if (target.metadataSource && target.providerId) { sourceIds[target.metadataSource] = target.providerId; mixPins[target.metadataSource] = target.providerId; }
      target.sourceIds = sourceIds;
      target.mixPins = mixPins;
      target.mixSourceKeys = [...new Set([...(target.mixSourceKeys || []), ...sourceKeys])];
      const primary = primaryKey && primaryId ? { key: primaryKey, providerId: String(primaryId) } : (source.metadataSource && source.providerId ? { key: source.metadataSource, providerId: String(source.providerId) } : null);
      if (primary) target.mixPrimary = primary;
      target.metadataSource = "mix"; target.source = "mix";
      target.mixSkip = { ...(target.mixSkip || {}) };
      sourceKeys.forEach(key => { delete target.mixSkip[key]; });
      if (!target.description && source.description) target.description = source.description;
      if (!target.year && source.year) target.year = source.year;
      if (!target.image && source.image) target.image = source.image;
      if (!target.backdrop && source.backdrop) target.backdrop = source.backdrop;
      target.facts = mergeFacts(target.facts, source.facts);
      if (source.cachedDetails && target.cachedDetails) {
        target.cachedDetails = { ...target.cachedDetails, sections: [...(target.cachedDetails.sections || []), ...(source.cachedDetails.sections || [])] };
      } else if (!target.cachedDetails && source.cachedDetails) target.cachedDetails = source.cachedDetails;
      target.progress = Math.max(Number(target.progress) || 0, Number(source.progress) || 0);
      target.favorite = Boolean(target.favorite || source.favorite); target.updatedAt = Date.now();
      history = history.map(entry => String(entry.itemId) === String(source.id) ? { ...entry, itemId: target.id, title: target.title } : entry);
      items = items.filter(item => item !== source);
      recordLibraryChange("merged", `Merged “${source.title}” into “${target.title}”.`, [source.id, target.id]);
      await persist({ ids: [target.id], removed: [source.id] }); render(); toast(`Merged sources into “${target.title}”.`);
      toastUndo(`Merged “${sourceCopy.title}” into “${targetCopy.title}”.`, async () => {
        const currentTarget = itemById(String(targetCopy.id));
        if (!currentTarget || items.some(item => String(item.id) === String(sourceCopy.id))) return;
        Object.assign(currentTarget, targetCopy);
        items.splice(Math.min(sourceIndex, items.length), 0, sourceCopy);
        const movedIds = new Set(movedHistory.map(entry => `${entry.at}|${entry.action}|${entry.status || ""}`));
        history = history.filter(entry => !(String(entry.itemId) === String(targetCopy.id) && movedIds.has(`${entry.at}|${entry.action}|${entry.status || ""}`)));
        history.push(...movedHistory);
        await persist({ ids: [sourceCopy.id, targetCopy.id] }); render(); toast("Merge undone.");
      });
      try {
        const loaded = await window.SplitAppDetails.load(target, detailSettings());
        if (items.includes(target)) { target.cachedDetails = loaded; target.facts = mergeFacts(target.facts, loaded.facts); if (loaded.sourceIds) target.sourceIds = { ...(target.sourceIds || {}), ...loaded.sourceIds }; if (loaded.mixSources) target.mixSources = loaded.mixSources; target.description = loaded.description || target.description; target.image = target.customCover || loaded.portraitImage || loaded.image || target.image; target.backdrop = loaded.landscapeImage || loaded.backgroundImage || target.backdrop; target.updatedAt = Date.now(); await persist({ ids: [target.id] }); if (page === "details" && detailItemId === target.id) { detailData = loaded; render(); } }
      } catch (error) { recordLog("warning", `Could not refresh merged Mix title ${target.title}: ${error?.message || error}`); }
    };
    if (confirmed || await appConfirm(`Merge “${source.title}” into “${target.title}”? Their metadata sources and tracking progress will be combined.`, { title: "Merge titles", confirmLabel: "Merge" })) await keep();
  }
  (() => {
    let timer = 0, start = null, drag = null, dragEndedAt = 0;
    const clearTargets = () => document.querySelectorAll(".item-card.merge-target").forEach(card => card.classList.remove("merge-target"));
    const finish = async (x, y, cancelled) => {
      clearTimeout(timer);
      if (!drag) { start = null; return; }
      const current = drag; drag = null; start = null; current.ghost.remove(); current.source.style.opacity = ""; clearTargets(); dragEndedAt = Date.now();
      if (cancelled) return;
      const target = document.elementFromPoint(x, y)?.closest?.(".item-card[data-item]");
      const from = itemById(current.id), to = target && itemById(target.dataset.item);
      if (!from) return;
      if (!to || from === to) { enterSelectMode(from.id); return; }
      if (from.category !== to.category) { toast("Merge titles from the same category."); return; }
      if (await appConfirm(`Merge “${from.title}” into “${to.title}” as one Mix title? Their source matches and tracking will be combined.`, { title: "Merge as Mix", confirmLabel: "Merge" })) await mergeLibraryItems(from.id, to.id, { confirmed: true });
    };
    document.addEventListener("pointerdown", event => {
      if (page !== "dashboard" || selectMode || (event.pointerType === "mouse" && event.button !== 0)) return;
      const card = event.target.closest?.(".item-card[data-item]"); if (!card || event.target.closest("button, a, input, select, textarea")) return;
      start = { id: card.dataset.item, x: event.clientX, y: event.clientY };
      timer = setTimeout(() => {
        if (!start) return;
        const rect = card.getBoundingClientRect(), ghost = card.cloneNode(true);
        Object.assign(ghost.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, margin: "0", zIndex: 9999, pointerEvents: "none", opacity: ".92", transform: "scale(.94)", boxShadow: "0 12px 30px rgba(0,0,0,.3)" });
        document.body.appendChild(ghost); card.style.opacity = ".4"; drag = { id: card.dataset.item, source: card, ghost, dx: start.x - rect.left, dy: start.y - rect.top, x: start.x, y: start.y }; navigator.vibrate?.(25);
      }, 500);
    }, true);
    document.addEventListener("pointermove", event => {
      if (!drag) { if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) { clearTimeout(timer); start = null; } return; }
      drag.x = event.clientX; drag.y = event.clientY; drag.ghost.style.left = `${event.clientX - drag.dx}px`; drag.ghost.style.top = `${event.clientY - drag.dy}px`; clearTargets(); document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".item-card[data-item]")?.classList.add("merge-target");
    }, true);
    document.addEventListener("pointerup", event => finish(event.clientX, event.clientY, false), true);
    document.addEventListener("pointercancel", event => finish(event.clientX, event.clientY, true), true);
    document.addEventListener("touchmove", event => { if (drag && event.cancelable) event.preventDefault(); }, { passive: false });
    document.addEventListener("contextmenu", event => { if (drag || start) event.preventDefault(); }, true);
    document.addEventListener("click", event => { if (Date.now() - dragEndedAt < 400) { event.preventDefault(); event.stopPropagation(); } }, true);
  })();
  function resyncAfterRelink(item, message, matchedSource = null) {
    resetMixCheck(item);
    item.relinkFresh = true;
    delete item.sourceMeta; delete item.matchReview; delete item.matchOk; delete item.mixNoMatch;
    if (matchedSource) item.sourceMeta = { [matchedSource.key]: matchedSource.meta };
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
      dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">FIX MATCH</p><h2>${esc(current.title)}</h2></div><button class="choice-dialog-close" type="button" data-fix-close aria-label="Close">×</button></header><div class="fix-match-body"><div class="fix-match-links">${sources.map(source => { const providerId = (current.sourceIds || {})[source.key] || (current.metadataSource === source.key ? current.providerId : ""), matchedTitle = current.sourceMeta?.[source.key]?.title; const summary = providerId ? `Linked${matchedTitle ? ` · ${matchedTitle}` : ""} · ${providerId}` : current.mixSkip?.[source.key] ? "Skipped" : current.mixNoMatch?.[source.key] ? "No match found recently" : "Not linked"; return `<div class="fix-match-link"><strong>${esc(source.name)}</strong><small>${esc(summary)}</small>${providerId && sources.length > 1 ? `<button type="button" class="button secondary small" data-fix-unlink="${esc(source.key)}">Unlink</button>` : current.mixSkip?.[source.key] ? `<button type="button" class="button secondary small" data-fix-unskip="${esc(source.key)}">Allow</button>` : ""}</div>`; }).join("")}</div><div class="fix-match-search"><select data-fix-source aria-label="Source">${sources.map(source => `<option value="${esc(source.key)}"${source.key === state.key ? " selected" : ""}>${esc(source.name)}</option>`).join("")}</select><input type="search" data-fix-query value="${esc(state.query ?? current.title)}" placeholder="Search this source"><button type="button" class="button primary small" data-fix-search>Search</button></div><p class="fix-match-status" role="status">${esc(state.message)}</p><ul class="fix-match-results">${state.rows.map((row, index) => `<li><span class="fix-match-art">${row.image ? `<img src="${esc(row.image)}" alt="" loading="lazy" onerror="this.hidden=true">` : ""}</span><span class="fix-match-copy"><strong>${esc(row.title)}</strong><small>${esc([row.year, row.description].filter(Boolean).join(" · ") || row.providerId)}</small></span><button type="button" class="button secondary small" data-fix-view="${index}">View</button><button type="button" class="button primary small" data-fix-use="${index}">Use</button></li>`).join("")}</ul></div>`;
    };
    const search = async () => { state.query = dialog.querySelector("[data-fix-query]")?.value.trim() || ""; state.key = dialog.querySelector("[data-fix-source]")?.value || state.key; if (!state.query) return; state.rows = []; state.preview = null; state.message = "Searching…"; paint(); try { state.rows = (await window.SplitAppDiscovery.searchSource(state.query, item.category, detailSettings(), state.key)).slice(0, 15); state.message = state.rows.length ? "Choose the correct title." : "No results from this source."; } catch (error) { state.message = error?.message || "Search failed."; } paint(); };
    dialog.onclick = event => {
      const current = itemById(String(id)); if (!current) return;
      if (event.target === dialog || event.target.closest("[data-fix-close]")) { closePopup(dialog); return; }
      if (event.target.closest("[data-fix-search]")) { search(); return; }
      const view = event.target.closest("[data-fix-view]"); if (view) { state.preview = Number(view.dataset.fixView); paint(); return; }
      if (event.target.closest("[data-fix-back]")) { state.preview = null; paint(); return; }
      const use = event.target.closest("[data-fix-use]");
      if (use) {
        const row = state.rows[Number(use.dataset.fixUse)]; if (!row) return; const key = state.key, providerId = String(row.providerId);
        if (current.metadataSource === "mix") { current.sourceIds = { ...(current.sourceIds || {}), [key]: providerId }; current.mixPins = { ...(current.mixPins || {}), [key]: providerId }; current.mixSkip = { ...(current.mixSkip || {}) }; delete current.mixSkip[key]; if (!current.mixPrimary?.key) current.mixPrimary = { key, providerId }; }
        else { current.metadataSource = key; current.providerId = providerId; current.sourceIds = { ...(current.sourceIds || {}), [key]: providerId }; }
        current.cachedDetails = null; closePopup(dialog); resyncAfterRelink(current, `Linked “${row.title}”.`, { key, meta: { title: row.title || "", year: row.year || "", url: row.url || "", image: row.image || "" } }); return;
      }
      const unlink = event.target.closest("[data-fix-unlink]");
      if (unlink) { const key = unlink.dataset.fixUnlink; if (current.sourceIds) delete current.sourceIds[key]; if (current.mixPins) delete current.mixPins[key]; if (current.metadataSource === "mix") { current.mixSkip = { ...(current.mixSkip || {}), [key]: true }; if (current.mixPrimary?.key === key) delete current.mixPrimary; } else if (current.metadataSource === key) { current.metadataSource = ""; current.providerId = ""; current.cachedDetails = null; } closePopup(dialog); resyncAfterRelink(current, "Source unlinked."); }
      const allow = event.target.closest("[data-fix-unskip]");
      if (allow) { const key = allow.dataset.fixUnskip; current.mixSkip = { ...(current.mixSkip || {}) }; delete current.mixSkip[key]; closePopup(dialog); resyncAfterRelink(current, "Source enabled for this title."); }
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
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">COVER</p><h2>${esc(item.title)}</h2></div><button class="choice-dialog-close" type="button" data-cover-close aria-label="Close">×</button></header><div class="cover-picker-body"><p class="fix-match-status">${item.customCover ? "Using your chosen cover." : "Pick a cover; it stays when metadata refreshes."}</p><div class="cover-picker-grid">${urls.map(url => `<button type="button" class="cover-choice${item.customCover === url ? " is-current" : ""}" data-cover-url="${esc(url)}"><img src="${esc(url)}" alt="" loading="lazy" onerror="this.closest('button').hidden=true"></button>`).join("")}</div>${item.customCover ? '<button type="button" class="button secondary" data-cover-auto>Use automatic cover</button>' : ""}</div>`;
    dialog.onclick = event => { if (event.target === dialog || event.target.closest("[data-cover-close]")) { closePopup(dialog); return; } const choice = event.target.closest("[data-cover-url]"), automatic = event.target.closest("[data-cover-auto]"); if (!choice && !automatic) return; if (choice) { item.customCover = choice.dataset.coverUrl; item.image = item.customCover; } else delete item.customCover; item.updatedAt = Date.now(); persist({ ids: [item.id] }); closePopup(dialog); render(); toast(automatic ? "Automatic cover restored." : "Cover updated."); };
    showPopup(dialog);
  }
  function openItemActions(id) {
    const item = items.find(entry => entry.id === id); if (!item) return;
    let dialog = $("#item-action-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog"); dialog.id = "item-action-dialog"; dialog.className = "ios-action-sheet";
      document.body.appendChild(dialog);
      dialog.addEventListener("click", async event => {
        if (event.target === dialog) { closePopup(dialog); return; }
        const button = event.target.closest("[data-sheet-action]"); if (!button) return;
        const target = items.find(entry => entry.id === dialog.dataset.itemId);
        const action = button.dataset.sheetAction;
        // Details/Edit navigate to another page; keep the sheet's history entry so closing it cannot undo that navigation.
        closePopup(dialog, { preserveHistory: action === "details" || action === "edit" });
        if (!target) return;
        if (action === "details") openDetails(target.id);
        else if (action === "edit") openEdit(target.id);
        else if (action === "remove") {
          if (!(await appConfirm(`Remove “${target.title}” from your collection?`, { title: "Remove title", confirmLabel: "Remove", danger: true }))) return;
          if (prefs.backupBeforeDestructive) exportList({ silent: true });
          recordLibraryChange("removed", `Removed ${target.title}.`, [target.id]); items = items.filter(entry => entry.id !== target.id); persist({ removed: [target.id] }); render(); toast("Entry removed.");
        } else if (action !== "cancel") { setItemStatus(target, action); render(); toast(`Marked as ${action}.`); }
      });
    }
    dialog.dataset.itemId = id;
    dialog.innerHTML = `<div class="ios-action-group"><p>${esc(item.title)}</p><button type="button" data-sheet-action="${esc(roles.active)}" class="accent"><i data-lucide="circle-play"></i>Mark as ${esc(roles.active)}</button><button type="button" data-sheet-action="${esc(roles.done)}" class="success"><i data-lucide="check-circle"></i>Mark as ${esc(roles.done)}</button><button type="button" data-sheet-action="edit"><i data-lucide="pencil"></i>Edit entry</button><button type="button" data-sheet-action="details"><i data-lucide="info"></i>View Full Details</button><button type="button" data-sheet-action="remove" class="danger"><i data-lucide="trash-2"></i>Remove from Collection</button></div><button type="button" class="ios-action-cancel" data-sheet-action="cancel">Cancel</button>`;
    window.lucide?.createIcons({ root: dialog, attrs: { "aria-hidden": "true" } });
    showPopup(dialog);
  }
  function shareEntry(item, detail = null) {
    const progress = Math.max(0, Number(item.progress) || 0), goal = Math.max(0, Number(item.goal) || 0);
    const unit = config.categories.find(row => row.key === item.category)?.unit || "";
    const fields = detail?.fields || item.cachedDetails?.fields || [];
    const field = pattern => fields.find(row => pattern.test(String(row.label || "")))?.value || "";
    const tags = detail?.tags || item.cachedDetails?.tags || item.cachedDetails?.genres || item.facts?.genres || field(/^genres?$/i) || [];
    const tagList = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(/,\s*/) : [tags];
    const info = detail ? [field(/^director|directors|created by$/i), field(/^runtime$/i), field(/^network|studio$/i), field(/^language$/i)].filter(Boolean) : [];
    const tagText = [...tagList.map(tag => typeof tag === "string" ? tag : tag?.name || tag?.title || ""), ...info].filter(Boolean).slice(0, 8).join(" · ");
    return { id: String(item.id), title: item.title, subtitle: [category(item.category)?.label, item.year, tagText].filter(Boolean).join(" · "), status: item.status, progressText: progress || goal ? `${progress}${goal ? ` / ${goal}` : ""}${unit ? ` ${unit}` : ""}` : "", percent: goal ? Math.min(100, Math.round(progress / goal * 100)) : null };
  }
  const shareCacheGet = (key, sig) => window.SplitAppIDB?.getShareCache?.(key, sig) || Promise.resolve(null);
  const shareCachePut = (key, sig, blob) => window.SplitAppIDB?.putShareCache?.(key, sig, blob).catch(() => {});
  async function shareLoadUrl(source, maxWidth = 720) {
    if (!source) return null;
    let blob = null;
    if (/^data:image\//i.test(source)) { try { blob = await (await fetch(source)).blob(); } catch (_) {} }
    else if (/^https?:/i.test(source)) { try { const response = await fetch(source, { mode: "cors", credentials: "omit" }); if (response.ok) blob = await response.blob(); } catch (_) {} }
    if (!blob) return null;
    if (window.createImageBitmap) { try { return await createImageBitmap(blob, { resizeWidth: maxWidth, resizeQuality: "medium" }); } catch (_) {} }
    const url = URL.createObjectURL(blob);
    return new Promise(resolve => { const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve(image); }; image.onerror = () => { URL.revokeObjectURL(url); resolve(null); }; image.src = url; });
  }
  async function shareImageFor(entry) {
    const item = itemById(entry.id); if (!item) return null;
    const source = item.customCover || item.localPortraitData || item.localThumbnailData || item.localImageData?.image || item.image || item.cachedDetails?.portraitImage || item.cachedDetails?.image;
    return shareLoadUrl(source, 720);
  }
  function openShareList(title, selected) {
    if (!selected.length) return;
    const detail = selected.length === 1 && page === "details" ? detailData : null;
    window.SplitAppShare?.open({ title, entries: selected.map(item => shareEntry(item, detail)), getImage: shareImageFor }, { showPopup, closePopup, toast, esc, cacheGet: shareCacheGet, cachePut: shareCachePut });
  }
  async function openShareDetail(id) {
    const item = itemById(String(id)); if (!item) return;
    const detail = detailData || item.cachedDetails || {};
    const entry = shareEntry(item, detail);
    const facts = { ...(detail.facts || {}), ...(item.facts || {}) };
    const fields = [...(detail.fields || [])].filter(row => row?.label && String(row.value ?? "").trim());
    const ensureField = (label, value) => { if (value && !fields.some(row => String(row.label).toLowerCase() === label.toLowerCase())) fields.push({ label, value }); };
    ensureField("Runtime", facts.runtimeMinutes ? `${facts.runtimeMinutes} min` : "");
    ensureField("Episodes", facts.episodeCount || ""); ensureField("Seasons", facts.seasonCount || "");
    const sections = detail.sections || [];
    const images = [...new Set(sections.filter(section => section.kind === "gallery").flatMap(section => (section.items || []).map(row => row.image || row.url)).filter(url => /^https?:|^data:image\//i.test(url || "")))];
    const cast = sections.filter(section => /^(cast|characters)/i.test(section.title || "")).flatMap(section => section.items || []).slice(0, 24).map(row => `${row.title || row.name || ""}${row.meta ? ` (${row.meta})` : ""}`).filter(Boolean);
    const episodes = sections.filter(section => section.kind === "episodes" || section.kind === "episodes-list").flatMap(section => (section.items || []).map(row => row.title || row.name || "")).filter(Boolean).slice(0, 36);
    const overview = [String(detail.description || item.description || ""), cast.length ? `Cast\n${cast.join(" · ")}` : "", episodes.length ? `Episode guide\n${episodes.join("\n")}` : ""].filter(Boolean).join("\n\n");
    const tags = detail.tags || facts.genres || [];
    const languages = (detail.languages || []).map(row => typeof row === "string" ? row : row?.name).filter(Boolean);
    const report = {
      title: item.title, category: item.category, subtitle: [category(item.category)?.label, item.year, item.status].filter(Boolean).join(" · "),
      status: item.status, progressText: entry.progressText, percent: entry.percent,
      fields, description: overview, requirements: null,
      languages, tags: Array.isArray(tags) ? tags.map(row => typeof row === "string" ? row : row?.name).filter(Boolean) : String(tags).split(/,\s*/),
      shotUrls: images, coverPromise: shareLoadUrl(item.customCover || item.localPortraitData || item.localThumbnailData || item.localImageData?.image || detail.portraitImage || item.image || detail.image, 720)
    };
    window.SplitAppShareTitle?.open(report, { showPopup, closePopup, toast, esc, loadImage: url => shareLoadUrl(url, 720) });
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
    persist({ meta: true }); applyPreferences();
    if (key === "backgroundBackups" || key === "backupSchedule") syncBackupSchedule();
    if (key === "dashboardStatusFilter") dashboardStatusFilter = value || "all";
    if (key === "dashboardDefaultCategory") activeCategory = value === "remember" || value === "all" ? "all" : value;
    if (["dashboardGroupBy", "dashboardSort", "dashboardView", "dashboardStatusFilter", "dashboardDefaultCategory", "dashboardRowActions", "cardCorners", "oneHandedMode", "tabletTwoColumn", "theme"].includes(key)) render();
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
      system:["Match your device's light or dark appearance.","#f8fafc","#6366f1","#0f172a"],
      light:["Clean white surfaces with indigo accents.","#f8fafc","#4f46e5","#0f172a"],
      amoled:["Pure black surfaces with raised charcoal cards.","#000000","#a78bfa","#f8fafc"]
    };
    const settingPreviewIcons = {
      textSize: { small: "type", normal: "text", large: "text-cursor-input" },
      animationSpeed: { off: "pause", fast: "zap", normal: "gauge", slow: "turtle", custom: "sliders-horizontal" },
      dashboardView: { list: "list", "compact-list": "align-justify", grid: "layout-grid", "detailed-grid": "layout-dashboard", "compact-grid": "grid-3x3", "large-grid": "square", timeline: "calendar-days" },
      dashboardDefaultCategory: { remember: "history", all: "layers", movie: "film", series: "tv" },
      dashboardSort: { "updated-desc": "clock-3", "created-desc": "calendar-plus", "progress-desc": "trending-up", "progress-asc": "trending-down", "release-desc": "calendar-days", "alphabetical-asc": "arrow-down-a-z", "alphabetical-desc": "arrow-up-z-a" },
      defaultStatus: { Watchlist: "bookmark", "In Progress": "play", Completed: "circle-check", "On Hold": "pause", Dropped: "circle-x" },
      dateFormat: { auto: "globe", dmy: "calendar", mdy: "calendar", iso: "calendar-days", long: "calendar-check" },
      iconStyle: { tiles: "layout-grid", inline: "list" },
      imageStorage: { all: "images", posters: "image", online: "cloud-off" },
      animationEasing: { smooth: "spline", spring: "activity", bouncy: "repeat", linear: "move-right" },
      pageTransition: { slide: "move-right", fade: "cloud", zoom: "maximize-2", rise: "move-up", flip: "flip-horizontal", none: "ban" },
      cardEntrance: { rise: "arrow-up-from-line", fade: "cloud", pop: "sparkles", slide: "move-right", none: "ban" },
      sheetAnimation: { slide: "panel-bottom", pop: "maximize-2", fade: "cloud" },
      pressEffect: { shrink: "pointer", soft: "hand", none: "pointer-off" },
      bottomBarBackground: { solid: "square", glass: "panels-top-left", transparent: "panels-top-bottom" },
      bottomBarStyle: { box: "square", "icon-color": "palette", underline: "underline" },
      bottomBarCorners: { round: "panels-top-left", sharp: "square" },
      bottomBarLabels: { "icons-labels": "list", "icons-only": "layout-grid" },
      bottomBarLayout: { spread: "align-horizontal-space-between", center: "align-horizontal-justify-center", left: "align-horizontal-justify-start" },
      cardCorners: { rounded: "circle", soft: "squircle", square: "square" },
      dashboardGroupBy: { none: "list", status: "circle-check", category: "folders", release: "calendar-days" },
      automaticCompletion: { automatic: "refresh-cw", ask: "message-circle-question", manual: "hand" },
      defaultStatus: Object.fromEntries(config.categories[0].statuses.map(status => [status, statusIcon(status)])),
      progressIncrement: { 1: "signal-low", 5: "signal-medium", 10: "signal-high" },
      backupSchedule: { never: "calendar-x", daily: "calendar-days" },
      backupRetention: { 3: "archive", 5: "archive-restore", 10: "boxes", 20: "warehouse" },
      folderSyncDelay: { 0: "zap", 30: "timer", 60: "alarm-clock", 300: "hourglass" },
      metadataMode: { online: "globe", offline: "wifi-off" },
      metadataRefreshInterval: { daily: "calendar-check", weekly: "calendar-range", monthly: "calendar-days", never: "calendar-x" },
      offlineFallback: { cached: "database", none: "ban" },
      thumbnailSize: { small: "image", medium: "images", large: "gallery-horizontal" },
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
        preview = document.createElement("span"); preview.className = "setting-color-preview"; preview.style.setProperty("--choice-color", option.value);
        description = `Use ${option.label.toLowerCase()} for buttons and highlights.`;
      } else if (key === "bottomBarStyle") {
        preview = document.createElement("span"); preview.className = `setting-nav-style-preview setting-nav-style-${option.value}`;
        preview.innerHTML = `<i data-lucide="${settingPreviewIcons.bottomBarStyle[option.value]}"></i>`;
        description = option.value === "box" ? "Highlight the selected destination with a soft tile." : option.value === "icon-color" ? "Color the selected icon without a tile." : "Underline the selected destination.";
      } else {
        preview = document.createElement("span"); preview.className = "setting-option-preview";
        const icon = settingPreviewIcons[key]?.[option.value];
        if (icon) preview.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
        else preview.textContent = "•";
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
      const custom = document.createElement("label"); custom.className = "setting-custom-color"; custom.innerHTML = `<span><strong>Custom color</strong><small>Choose any accent color.</small></span><input type="color" data-custom-picker value="${esc(prefs[key] || "#6366f1")}" aria-label="Choose a custom accent color">`;
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
    items.forEach((item, index) => parts.push((index ? "," : "") + JSON.stringify(item)));
    parts.push(`],"history":${JSON.stringify(history)},"preferences":${JSON.stringify(prefs)}}`);
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(parts, { type: "application/json" })); link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); toast("Export ready.");
  }
  async function importList(file) {
    if (!file) return;
    try {
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
        const key = activeCategory !== "all" && config.categories.some(cat => cat.key === activeCategory) ? activeCategory : config.categories[0].key;
        incoming = text.split(/\r?\n/).map(title => title.trim()).filter(Boolean).map(title => ({ title, category: key, status: defaultStatus(key) })); data = { items: incoming };
      } else if (/\.csv$/i.test(file.name)) {
        const rows = parseCsv(text); if (!rows.length) throw new Error("The CSV file has no title rows.");
        const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
        const first = rows[0].map(normalize), hasHeader = first.some(value => ["title", "name"].includes(value));
        const headers = hasHeader ? first : ["title", "category", "year", "status", "progress", "goal", "review"];
        const records = (hasHeader ? rows.slice(1) : rows).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
        const fallbackCategory = activeCategory !== "all" ? activeCategory : config.categories[0].key;
        incoming = records.map(record => {
          const title = String(record.title || record.name || Object.values(record)[0] || "").trim();
          const categoryKey = config.categories.some(cat => cat.key === record.category) ? record.category : fallbackCategory;
          const cat = config.categories.find(entry => entry.key === categoryKey);
          return { ...record, title, category: categoryKey, status: cat?.statuses.includes(record.status) ? record.status : defaultStatus(categoryKey), year: record.year || "", progress: Number(record.progress) || 0, goal: Number(record.goal) || 0 };
        }).filter(item => item.title);
        data = { items: incoming };
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
      const identity = item => `${item.category}:${String(item.title || "").trim().toLocaleLowerCase()}`;
      const byIdentity = new Map(items.map(item => [identity(item), item]));
      const fresh = [], patches = [];
      const fillFields = ["favorite", "progress", "goal", "metadataSource", "providerId", "sourceIds", "mixPrimary", "mixSources", "mixSourceKeys", "facts", "cachedDetails", "url", "description", "image", "backdrop", "year"];
      const empty = value => value == null || value === "" || value === 0 || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);
      for (const imported of normalized) {
        const existing = byIdentity.get(identity(imported));
        if (!existing) { fresh.push(imported); continue; }
        const patch = {};
        for (const field of fillFields) if (empty(existing[field]) && !empty(imported[field])) patch[field] = imported[field];
        // Keep ScreenMark's episode checklist and per-episode notes when filling an existing title.
        if (Object.keys(patch).length) patches.push({ item: existing, patch });
      }
      const duplicateKey = title => String(title || "").toLocaleLowerCase().replace(/^the\s+/, "").replace(/\b(definitive|complete|ultimate|deluxe|enhanced|special|gold|standard|anniversary|remastered|remaster|edition|extended|director'?s cut|remake)\b/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
      const nearDuplicate = (left, right) => {
        if (left.category !== right.category) return false;
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
        if (event.target.closest("[data-duplicate-keep]")) accepted.add(rowItemId());
        if (!event.target.closest("[data-duplicate-keep],[data-duplicate-skip]")) return;
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
      items = [...fresh, ...items];
      for (const { item, patch } of patches) Object.assign(item, patch, { updatedAt: Date.now() });
      history = [...importedHistory, ...history].sort((a, c) => (Number(c.at) || Date.parse(c.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0));
      recordLibraryChange("imported", `Imported ${fresh.length} ${fresh.length === 1 ? "title" : "titles"}.`, fresh.map(item => item.id));
      persist(); render(); toast(`Imported ${fresh.length} ${fresh.length === 1 ? "entry" : "entries"}${patches.length ? ` and restored details for ${patches.length} existing ${patches.length === 1 ? "title" : "titles"}` : ""}.`);
    } catch (error) { toast(error.message || "Could not import this file."); }
  }
  function resetDashboard() {
    Object.assign(prefs, { dashboardView: "list", dashboardDefaultCategory: "series", dashboardStatusFilter: "all", dashboardSort: "alphabetical-asc", cardCorners: "rounded", dashboardGroupBy: "status", dashboardRowActions: "menu", oneHandedMode: "off", tabletTwoColumn: true });
    dashboardStatusFilter = "all"; activeCategory = "series"; persist({ meta: true }); applyPreferences(); render(); toast("Dashboard preferences restored.");
  }
  function resetAnimations() {
    ["reduceMotion", "animationSpeed", "animationCustom", "animationEasing", "pageTransition", "cardEntrance", "animationStagger", "sheetAnimation", "pressEffect", "hoverLift", "navBounce", "progressAnimation", "skeletonShimmer"].forEach(key => { prefs[key] = JSON.parse(JSON.stringify(prefsDefaults[key])); });
    persist({ meta: true }); applyPreferences(); render(); toast("Animation settings restored.");
  }
  function previewAnimations() {
    const content = $("#page-content"); if (!content) return;
    document.body.dataset.navDir = "forward"; content.classList.remove("page-route-enter"); void content.offsetWidth; content.classList.add("page-route-enter");
    toast("Replaying animations.");
  }
  function resetAppearance() {
    ["theme", "textSize", "dateFormat", "iconStyle", "mainColor", "showSidebar", "showScrollbars", "bottomBarStyle", "bottomBarCorners", "bottomBarLabels", "bottomBarBackground", "bottomBarTransparency", "bottomBarLayout"].forEach(key => { prefs[key] = JSON.parse(JSON.stringify(prefsDefaults[key])); });
    prefs.navIcons = { ...prefsDefaults.navIcons };
    prefs.navBar = { order: [...navKeys], visible: { ...prefsDefaults.navBar.visible } };
    persist({ meta: true }); applyPreferences(); render(); toast("Appearance settings restored.");
  }

  $("#page-content").addEventListener("click", event => {
    const pill = event.target.closest("[data-pill-name]");
    if (pill) {
      const group = pill.closest(".ios-pills");
      group.querySelector('input[type="hidden"]').value = pill.dataset.pillValue;
      group.querySelectorAll("[data-pill-name]").forEach(button => { const on = button === pill; button.classList.toggle("active", on); button.setAttribute("aria-pressed", String(on)); });
      return;
    }
    const mixCategoryButton = event.target.closest("[data-mix-category]");
    if (mixCategoryButton) { mixCategory = mixCategoryButton.dataset.mixCategory; mixCache = null; render(); return; }
    const discoverCategoryButton = event.target.closest("[data-discover-category]");
    if (discoverCategoryButton) { discoverCategoryChoice = discoverCategoryButton.dataset.discoverCategory; discoverCache = null; suggestionsCache = null; discoverQuery = ""; render(); return; }
    const addCategoryButton = event.target.closest("[data-add-category]");
    if (addCategoryButton) { applyAddCategory(addCategoryButton.dataset.addCategory); return; }
    const categoryFilter = event.target.closest("[data-category-filter]");
    if (categoryFilter) { activeCategory = categoryFilter.dataset.categoryFilter || "all"; render(); return; }
    const shareTitle = event.target.closest('[data-action="share-title"]');
    if (shareTitle) {
      const item = itemById(shareTitle.dataset.id);
      if (item) openShareDetail(item.id);
      return;
    }
    const shareGroup = event.target.closest("[data-share-group]");
    if (shareGroup) {
      let ids = [];
      try { ids = JSON.parse(shareGroup.dataset.shareIds || "[]"); } catch (_) {}
      const selected = ids.map(itemById).filter(Boolean);
      openShareList(shareGroup.getAttribute("aria-label")?.replace(/^Share\s+/i, "") || "Collection", selected);
      return;
    }
    const quickStatus = event.target.closest("[data-quick-status]");
    if (quickStatus) { if (quickStatus.dataset.quickStatus === "all" && prefs.favoritesOnly) prefs.favoritesOnly = false; setPreference("dashboardStatusFilter", quickStatus.dataset.quickStatus); return; }
    const detailStatus = event.target.closest("[data-detail-status-btn]");
    if (detailStatus) {
      const item = items.find(row => row.id === detailItemId);
      if (item) {
        setItemStatus(item, detailStatus.dataset.detailStatusBtn);
        detailStatus.parentElement.querySelectorAll("[data-detail-status-btn]").forEach(button => button.classList.toggle("active", button === detailStatus));
      }
      return;
    }
    const itemMenu = event.target.closest("[data-open-item-actions]");
    if (itemMenu) { openItemActions(itemMenu.dataset.openItemActions); return; }
    const fixMatch = event.target.closest("[data-fix-match]");
    if (fixMatch) { event.preventDefault(); event.stopPropagation(); openFixMatch(fixMatch.dataset.fixMatch); return; }
    const changeCover = event.target.closest("[data-change-cover]");
    if (changeCover) { event.preventDefault(); event.stopPropagation(); openCoverPicker(changeCover.dataset.changeCover); return; }
    const dashboardViewChoice = event.target.closest("button[data-dashboard-view]");
    if (dashboardViewChoice) { setPreference("dashboardView", dashboardViewChoice.dataset.dashboardView); return; }
    const dashboardSortChoice = event.target.closest("button[data-dashboard-sort]");
    if (dashboardSortChoice) { setPreference("dashboardSort", dashboardSortChoice.dataset.dashboardSort); return; }
    if (event.target.closest("[data-close-dashboard-filter]")) { closePopup($("#dashboard-filter-dialog")); return; }
    if (event.target.closest("[data-reset-dashboard-filter]")) { dashboardStatusFilter = prefs.dashboardStatusFilter = "all"; activeCategory = "all"; prefs.favoritesOnly = false; libraryQuery = ""; prefs.dashboardView = "list"; prefs.dashboardSort = "alphabetical-asc"; prefs.dashboardGroupBy = "status"; persist({ meta: true }); applyPreferences(); historyPush(); closePopup($("#dashboard-filter-dialog")); render(); return; }
    const dashboardLoader = event.target.closest("[data-dashboard-load-more]");
    if (dashboardLoader) { dashboardLazyObserver?.unobserve(dashboardLoader); loadDashboardMore(dashboardLoader); if (dashboardLoader.isConnected) dashboardLazyObserver?.observe(dashboardLoader); return; }
    const detailImage = event.target.closest("[data-detail-image-src]");
    if (detailImage) {
      showDetailImage($$("[data-detail-image-src]", $("#page-content")).indexOf(detailImage));
      return;
    }
    if (event.target.closest("[data-detail-image-close]")) { closePopup($("#detail-image-modal")); return; }
    if (event.target.closest("[data-detail-image-prev]")) { showDetailImage(detailImagePosition - 1); return; }
    if (event.target.closest("[data-detail-image-next]")) { showDetailImage(detailImagePosition + 1); return; }
    if (event.target.id === "detail-image-modal") { closePopup(event.target); return; }
    const statsFilter = event.target.closest("[data-stats-filter]");
    if (statsFilter) { setPreference("dashboardStatusFilter", statsFilter.dataset.statsFilter); goto("dashboard"); return; }
    if (event.target.closest("[data-mix-search]")) { runMixSearch(); return; }
    const mixAdd = event.target.closest("[data-mix-add]");
    if (mixAdd) { event.stopPropagation(); const row = mixCache?.results?.[Number(mixAdd.dataset.mixAdd)]; if (row) addMixResult(row); return; }
    const mixOpen = event.target.closest("[data-mix-open]");
    if (mixOpen) { const row = mixCache?.results?.[Number(mixOpen.dataset.mixOpen)]; if (row) openMixDetails(row); return; }
    const backLink = event.target.closest("[data-back]");
    if (backLink && inAppNav) { event.preventDefault(); window.history.back(); return; }
    const csType = event.target.closest("[data-cs-type]");
    if (csType) {
      const input = $("#custom-source-form")?.elements.categories, key = csType.dataset.csType;
      const chosen = new Set(String(input?.value || "").split(",").filter(Boolean));
      if (chosen.has(key) && chosen.size > 1) chosen.delete(key); else chosen.add(key);
      if (input) input.value = [...chosen].join(",");
      $$("[data-cs-type]").forEach(button => { const on = chosen.has(button.dataset.csType); button.classList.toggle("active", on); button.setAttribute("aria-pressed", String(on)); });
      return;
    }
    const csInsert = event.target.closest("[data-cs-insert]");
    if (csInsert) { const input = $("#custom-source-form")?.elements.searchUrl; if (input) { const at = input.selectionStart ?? input.value.length; input.setRangeText(csInsert.dataset.csInsert, at, input.selectionEnd ?? at, "end"); input.focus(); } return; }
    if (event.target.closest("[data-custom-source-test]")) { testCustomSourceForm(); return; }
    if (event.target.closest("[data-custom-source-delete]")) { deleteCustomSource(); return; }
    const rangeButton = event.target.closest("[data-stats-range]");
    if (rangeButton) { statsRange = rangeButton.dataset.statsRange === "month" ? "month" : "week"; statsActivityDate = ""; render(); return; }
    const watchtimePageButton = event.target.closest("[data-stats-watchtime-page]");
    if (watchtimePageButton) { statsWatchtimePage = Math.max(0, Number(watchtimePageButton.dataset.statsWatchtimePage) || 0); render(); return; }
    const activityDay = event.target.closest("[data-stats-activity-date]");
    if (activityDay) { statsActivityDate = activityDay.dataset.statsActivityDate; render(); return; }
    const findHours = event.target.closest("[data-stats-find-hours]");
    if (findHours) { findMissingHours(findHours); return; }
    const fetchFacts = event.target.closest("[data-stats-fetch-facts]");
    if (fetchFacts) { fetchMissingFacts(fetchFacts); return; }
    const adjust = event.target.closest("[data-adjust-progress]");
    if (adjust) {
      const item = items.find(row => row.id === detailItemId);
      if (item) {
        if (!stepEpisodes(item, Number(adjust.dataset.adjustProgress))) item.progress = Math.max(0, (Number(item.progress) || 0) + Number(adjust.dataset.adjustProgress));
        item.updatedAt = Date.now();
        if (item.goal && item.progress >= item.goal && prefs.automaticCompletion === "automatic" && item.status !== roles.done) { item.status = roles.done; history.unshift({ itemId: item.id, title: item.title, action: roles.done, status: roles.done, at: Date.now() }); toast(`Marked as ${roles.done}.`); }
        persist({ ids: [item.id] }); render();
      }
      return;
    }
    const stepper = event.target.closest("[data-step-input]");
    if (stepper) {
      const input = $("#item-form")?.elements[stepper.dataset.stepInput];
      if (input) { input.value = Math.max(0, (Number(input.value) || 0) + Number(stepper.dataset.step)); input.dispatchEvent(new Event("input", { bubbles: true })); }
      return;
    }
    const cancelAdd = event.target.closest("[data-cancel-add]");
    if (cancelAdd) { entryDraftId = null; goto(addReturnPage); return; }
    const entryStatus = event.target.closest("[data-entry-status]");
    if (entryStatus) {
      const form = entryStatus.closest("form");
      if (form?.elements.status) form.elements.status.value = entryStatus.dataset.entryStatus;
      entryStatus.parentElement?.querySelectorAll("[data-entry-status]").forEach(button => {
        const selected = button === entryStatus; button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected));
      });
      return;
    }
    const clearCookies = event.target.closest("[data-source-clear-cookies]");
    if (clearCookies) {
      const key = clearCookies.dataset.sourceClearCookies, provider = window.SplitAppSources.list().find(row => row.key === key);
      if (prefs.sourceOptions[key]) { delete prefs.sourceOptions[key].cookies; if (!Object.keys(prefs.sourceOptions[key]).length) delete prefs.sourceOptions[key]; }
      const host = window.SplitAppMetadata.cleanDomain(prefs.sourceOptions[key]?.domain) || provider?.domain;
      try { window.Capacitor?.Plugins?.CapacitorCookies?.clearCookies?.({ url: `https://${host}` }); } catch (_) {}
      persist({ meta: true }); render(); toast("Cookies cleared."); return;
    }
    const domainPick = event.target.closest("[data-source-domain-pick]");
    if (domainPick) {
      const [key, host] = domainPick.dataset.sourceDomainPick.split("|"), provider = window.SplitAppSources.list().find(row => row.key === key);
      const next = { ...(prefs.sourceOptions[key] || {}) };
      if (host === provider?.domain) delete next.domain; else next.domain = host;
      if (Object.keys(next).length) prefs.sourceOptions[key] = next; else delete prefs.sourceOptions[key];
      persist({ meta: true }); render(); return;
    }
    const resetOptions = event.target.closest("[data-source-reset-options]");
    if (resetOptions) { delete prefs.sourceOptions[resetOptions.dataset.sourceResetOptions]; persist({ meta: true }); render(); toast("Source options reset."); return; }
    const go = event.target.closest("[data-go]"); if (go) { goto(go.dataset.go); return; }
    const navMove = event.target.closest("[data-nav-move]");
    if (navMove) { prefs.navBar.order = moveInOrder([...prefs.navBar.order], navMove.dataset.navKey, navMove.dataset.navMove); persist({ meta: true }); applyPreferences(); render(); return; }
    const sourceMove = event.target.closest("[data-source-move]");
    if (sourceMove) { prefs.metadataSourceOrder = moveInOrder([...prefs.metadataSourceOrder], sourceMove.dataset.sourceKey, sourceMove.dataset.sourceMove); persist({ meta: true }); render(); return; }
    const sourceFilter = event.target.closest("[data-source-filter]");
    if (sourceFilter) {
      metadataSourceFilter = sourceFilter.dataset.sourceFilter;
      $$('[data-source-filter]').forEach(button => { const selected = button === sourceFilter; button.classList.toggle("active", selected); button.setAttribute("aria-pressed", String(selected)); });
      $$('[data-source-row]').forEach(row => { const enabled = row.dataset.sourceEnabledState === "true"; row.hidden = metadataSourceFilter === "enabled" ? !enabled : metadataSourceFilter === "disabled" ? enabled : false; });
      return;
    }
    const storageAction = event.target.closest("[data-storage-action]");
    if (storageAction) { runStorageAction(storageAction.dataset.storageAction); return; }
    const backupFolderAction = event.target.closest("[data-backup-folder-action]");
    if (backupFolderAction) {
      if (backupFolderAction.dataset.backupFolderAction === "choose") chooseBackupDatabaseFolder();
      else refreshBackupFolderStatus();
      return;
    }
    if (event.target.closest("[data-log-dates-clear]")) { if (settingsGroup === "history") { historyFrom = ""; historyTo = ""; } else { logFrom = ""; logTo = ""; } render(); return; }
    if (event.target.closest("[data-open-log-filter]")) { showPopup($("#log-filter-dialog")); return; }
    if (event.target.closest("[data-close-log-filter]")) { closePopup($("#log-filter-dialog")); return; }
    const logRangeButton = event.target.closest("[data-log-range]");
    if (logRangeButton) {
      const now = new Date(), to = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const fromDate = new Date(now); if (logRangeButton.dataset.logRange !== "today") fromDate.setDate(fromDate.getDate() - Number(logRangeButton.dataset.logRange) + 1);
      const from = new Date(fromDate.getTime() - fromDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      $("[data-log-filter-from]").value = from; $("[data-log-filter-to]").value = to; return;
    }
    if (event.target.closest("[data-log-filter-apply]")) {
      const from = $("[data-log-filter-from]")?.value || "", to = $("[data-log-filter-to]")?.value || "";
      if (settingsGroup === "history") { historyFrom = from; historyTo = to; } else { logFrom = from; logTo = to; }
      closePopup($("#log-filter-dialog")); render(); return;
    }
    if (event.target.closest("[data-log-filter-clear]")) {
      if (settingsGroup === "history") { historyFrom = ""; historyTo = ""; } else { logFrom = ""; logTo = ""; }
      closePopup($("#log-filter-dialog")); render(); return;
    }
    const logAction = event.target.closest("[data-log-action]");
    if (logAction?.dataset.logAction === "clear") { clearLogcat().then(() => { render(); toast("Logs cleared."); }).catch(error => { recordLog("error", `Log clear failed: ${error?.message || error}`); toast("Could not clear logs."); }); return; }
    if (logAction?.dataset.logAction === "clear-history") {
      clearLibraryHistory().then(() => { render(); toast("History cleared."); }).catch(error => { recordLog("error", `History clear failed: ${error?.message || error}`); toast("Could not clear history."); });
      return;
    }
    const syncAction = event.target.closest("[data-metadata-sync-action]");
    if (syncAction) { if (syncAction.dataset.metadataSyncAction === "start") syncMetadataNow(); else if (syncAction.dataset.metadataSyncAction === "retry") retryMetadataSync(syncAction.dataset.id || null); else if (syncAction.dataset.metadataSyncAction === "clear") clearMetadataSyncState(); return; }
    const matchReviewOk = event.target.closest("[data-match-review-ok]");
    if (matchReviewOk) {
      const item = itemById(String(matchReviewOk.dataset.matchReviewOk)); if (!item) return;
      item.matchOk = { ...(item.matchOk || {}) };
      (item.matchReview || []).forEach(flag => { item.matchOk[flag.key] = flag.providerId || item.sourceIds?.[flag.key] || ""; });
      delete item.matchReview; persist({ ids: [item.id] }); render(); toast("Match marked as correct."); return;
    }
    if (event.target.closest("[data-match-review-ok-all]")) {
      const reviewed = [];
      items.forEach(item => { if (!item.matchReview?.length) return; item.matchOk = { ...(item.matchOk || {}) }; item.matchReview.forEach(flag => { item.matchOk[flag.key] = flag.providerId || item.sourceIds?.[flag.key] || ""; }); delete item.matchReview; reviewed.push(item.id); });
      if (reviewed.length) { persist({ ids: reviewed }); render(); toast("Matches marked as correct."); } return;
    }
    const settingPicker = event.target.closest("[data-setting-picker]");
    if (settingPicker) { openSettingPicker(settingPicker); return; }
    if (event.target.closest("[data-close-setting-picker]")) { closePopup($("#setting-picker-dialog")); return; }
    if (event.target.id === "setting-picker-dialog") { closePopup(event.target); return; }
    const timelineFilterButton = event.target.closest("[data-timeline-filter]");
    if (timelineFilterButton) { timelineFilter = timelineFilterButton.dataset.timelineFilter; render(); return; }
    if (event.target.closest("[data-open-timeline-filters]")) { showPopup($("#timeline-filter-dialog")); return; }
    if (event.target.closest("[data-clear-timeline-filters]")) {
      timelineSearch = ""; timelineMonth = ""; timelineYear = ""; timelineFilter = "all";
      closePopup($("#timeline-filter-dialog")); render(); return;
    }
    const detailRefButton = event.target.closest("[data-detail-ref]");
    if (detailRefButton) { const [type, ...rest] = detailRefButton.dataset.detailRef.split(":"); { let extra; try { extra = JSON.parse(detailRefButton.dataset.detailRefExtra || "null"); } catch (_) {} openDetailRef(type, rest.join(":"), detailRefButton.dataset.detailRefTitle, extra, detailRefButton.dataset.refReplace === "true"); } return; }
    if (event.target.closest("[data-detail-back]")) { detailBack(); return; }
    if (event.target.closest("[data-detail-ref-retry]")) { loadDetailRef(); return; }
    const refPage = event.target.closest("[data-detail-ref-page]");
    if (refPage) { detailRefOffset = Math.max(0, Number(refPage.dataset.detailRefPage) || 0); render(); scrollPageTop(); return; }
    const seasonButton = event.target.closest("[data-season-toggle]");
    if (seasonButton) {
      const ids = seasonButton.dataset.seasonToggle.split(","), undo = seasonButton.dataset.seasonDone === "true";
      appConfirm(`${undo ? "Uncheck" : "Mark as watched"} all ${ids.length} episodes of this season?`, { title: undo ? "Uncheck season" : "Check whole season", confirmLabel: undo ? "Uncheck" : "Mark watched" }).then(ok => { if (ok) toggleSeason(detailItemId, ids, undo); });
      return;
    }
    const episode = event.target.closest("[data-episode-toggle]");
    if (episode) { toggleEpisodeWatched(episode.dataset.itemId || detailItemId, episode.dataset.episodeId, episode.dataset.episodeTitle || "Episode"); return; }
    const favoritesFilter = event.target.closest("[data-favorites-filter]");
    if (favoritesFilter) { setPreference("favoritesOnly", !prefs.favoritesOnly); render(); return; }
    const quick = event.target.closest("[data-action=watch-next],[data-action=mark-all-watched],[data-action=toggle-favorite]");
    if (quick) {
      const item = items.find(entry => entry.id === quick.dataset.id), kind = quick.dataset.action; if (!item) return;
      const info = window.SplitAppLibrary.episodeInfo(item);
      if (kind === "watch-next") { if (info?.next) toggleEpisodeWatched(item.id, info.next.id, `${info.mark(info.next)} ${info.next.title}`); else updateProgress(item.id); }
      else if (kind === "mark-all-watched") { if (info) { const undo = info.done === info.total; appConfirm(`${undo ? "Uncheck" : "Mark as watched"} all ${info.total} episodes of “${item.title}”?`, { title: undo ? "Uncheck all" : "Mark all watched", confirmLabel: undo ? "Uncheck" : "Mark watched" }).then(ok => { if (ok) toggleSeason(item.id, info.eps.map(entry => String(entry.id)), undo); }); } }
      else { item.favorite = !item.favorite; item.updatedAt = Date.now(); persist({ ids: [item.id] }); render(); toast(item.favorite ? "Added to favorites." : "Removed from favorites."); }
      return;
    }
    const tabButton = event.target.closest("[data-detail-tab]");
    if (tabButton) {
      detailTab = tabButton.dataset.detailTab; const root = tabButton.closest(".detail-page");
      root.querySelectorAll("[data-detail-tab]").forEach(button => { const on = button === tabButton; button.classList.toggle("active", on); button.setAttribute("aria-selected", String(on)); });
      root.querySelectorAll("[data-detail-panel]").forEach(panel => { panel.hidden = panel.dataset.detailPanel !== detailTab; });
      return;
    }
    const seasonPill = event.target.closest("[data-season-pill]");
    if (seasonPill) {
      detailSeason = seasonPill.dataset.seasonPill; const root = seasonPill.closest(".season-list");
      root.querySelectorAll("[data-season-pill]").forEach(button => { const on = button === seasonPill; button.classList.toggle("active", on); button.setAttribute("aria-selected", String(on)); });
      root.querySelectorAll("[data-season-panel]").forEach(panel => { panel.hidden = panel.dataset.seasonPanel !== detailSeason; const lazy = !panel.hidden && panel.querySelector("template[data-lazy-season]"); if (lazy) lazy.replaceWith(lazy.content); });
      return;
    }
    const reactEpisode = event.target.closest("[data-episode-react]");
    if (reactEpisode) {
      const item = items.find(entry => entry.id === reactEpisode.dataset.itemId); if (!item) return;
      item.episodeNotes = item.episodeNotes || {}; const note = { ...(item.episodeNotes[reactEpisode.dataset.episodeId] || {}) };
      if (note.reaction === reactEpisode.dataset.episodeReact) delete note.reaction; else note.reaction = reactEpisode.dataset.episodeReact;
      if (Object.keys(note).length) item.episodeNotes[reactEpisode.dataset.episodeId] = note; else delete item.episodeNotes[reactEpisode.dataset.episodeId];
      if (!Object.keys(item.episodeNotes).length) delete item.episodeNotes;
      item.updatedAt = Date.now(); persist({ ids: [item.id] }); render(); return;
    }
    const layoutToggle = event.target.closest("[data-ratings-layout]");
    if (layoutToggle) {
      const grid = layoutToggle.closest(".ep-ratings"), next = grid.dataset.layout === "vertical" ? "horizontal" : "vertical";
      grid.dataset.layout = next; layoutToggle.textContent = next === "vertical" ? "Horizontal" : "Vertical";
      try { localStorage.setItem("screenmark_ratings_layout", next); } catch (_) {}
      return;
    }
    const expandCast = event.target.closest("[data-carousel-expand]");
    if (expandCast) { const carousel = expandCast.closest(".detail-section")?.querySelector(".detail-carousel"); const open = carousel?.classList.toggle("expanded"); expandCast.textContent = open ? "Collapse" : "Full list"; return; }
    const action = event.target.closest("[data-action]");
    if (action) { if (action.dataset.action === "add") openItem(); else if (action.dataset.action === "progress") updateProgress(action.dataset.id); else if (action.dataset.action === "edit") { if (page === "details") { detailEditMode = true; render(); } else openEdit(action.dataset.id); } else if (action.dataset.action === "cancel-detail-edit") { detailEditMode = false; render(); } else if (action.dataset.action === "details") openDetails(action.dataset.id); else if (action.dataset.action === "refresh-details") loadDetails(); else if (action.dataset.action === "delete-detail") requestDeleteDetails(action.dataset.id); else if (action.dataset.action === "save-detail-item") { const saved = addDiscoverResult(detailPreview); if (saved) { detailPreview = null; detailItemId = saved.id; detailData = null; loadDetails(); } } return; }
    const deleteButton = event.target.closest("#delete-item"); if (deleteButton) { deleteItem(deleteButton.dataset.id); return; }
    const settingAction = event.target.closest("[data-setting-action]");
    if (settingAction && settingAction.type !== "file") {
      const key = settingAction.dataset.settingAction;
      if (key === "export") exportList(); else if (key === "export-txt") exportNames("txt"); else if (key === "export-csv") exportNames("csv"); else if (key === "sync-metadata") syncMetadataNow(); else if (key === "resetDashboard") resetDashboard(); else if (key === "resetAnimations") resetAnimations(); else if (key === "previewAnimations") previewAnimations(); else if (key === "resetAppearance") resetAppearance();
      else if (key.startsWith("clear-")) {
        clearAppCaches(key === "clear-images" ? "images" : key === "clear-metadata" ? "metadata" : "temporary");
        toast("Temporary cache cleared.");
      }
      return;
    }
    const sourceDetails = event.target.closest("[data-discover-details]"); if (sourceDetails) { openDiscoverDetails($("#discover-results")._results?.[Number(sourceDetails.dataset.discoverDetails)]); return; }
    const discoverAdd = event.target.closest("[data-discover-add]"); if (discoverAdd) { addDiscoverResult($("#discover-results")._results?.[Number(discoverAdd.dataset.discoverAdd)]); return; }
  });
  document.addEventListener("change", event => {
    const input = event.target;
    if (input.matches("[data-detail-status]")) {
      const item = items.find(row => row.id === detailItemId);
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
    if (input.matches("[data-pref]")) {
      const key = input.dataset.pref; let value = input.type === "checkbox" ? input.checked : input.value;
      if (input.type === "number" || input.type === "range") value = Number(value);
      setPreference(key, value); if (input.type === "range") input.nextElementSibling.value = `${value}%`;
    }
    if (input.matches("[data-api-key]")) { prefs.apiKeys[input.dataset.apiKey] = input.value.trim(); persist({ meta: true }); }
    if (input.matches("[data-source]")) { window.SplitAppSources.setEnabled(prefs, input.dataset.source, input.checked); persist({ meta: true }); }
    if (input.matches("[data-nav-visible]")) {
      const key = input.dataset.navVisible;
      if (key !== "dashboard" && key !== "settings") prefs.navBar.visible[key] = input.checked;
      persist({ meta: true }); applyPreferences(); render();
    }
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
      if (value && !window.SplitAppSources.isEnabled(key, prefs)) { window.SplitAppSources.setEnabled(prefs, key, true); toast(`${window.SplitAppSources.list().find(row => row.key === key)?.name || "Source"} turned on.`); persist(); render(); return; }
      persist({ meta: true });
    }
    if (input.matches("[data-setting-action=import]")) { const file = input.files?.[0]; input.value = ""; importList(file); }
  });
  document.addEventListener("dragstart", event => {
    const row = event.target.closest("[data-nav-row], [data-source-row]");
    if (!row || !event.dataTransfer) return;
    const kind = row.hasAttribute("data-nav-row") ? "nav" : "source";
    const key = row.dataset.navRow || row.dataset.sourceRow;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${kind}:${key}`);
    row.classList.add("dragging");
  });
  document.addEventListener("dragend", event => event.target.closest("[data-nav-row], [data-source-row]")?.classList.remove("dragging"));
  document.addEventListener("dragover", event => {
    if (event.target.closest("[data-nav-row], [data-source-row]")) event.preventDefault();
  });
  document.addEventListener("drop", event => {
    const targetRow = event.target.closest("[data-nav-row], [data-source-row]");
    if (!targetRow || !event.dataTransfer) return;
    event.preventDefault();
    const [kind, key] = event.dataTransfer.getData("text/plain").split(":");
    if (kind === "nav" && targetRow.dataset.navRow) {
      prefs.navBar.order = moveInOrder([...prefs.navBar.order], key, null, targetRow.dataset.navRow); persist({ meta: true }); applyPreferences(); render();
    } else if (kind === "source" && targetRow.dataset.sourceRow) {
      prefs.metadataSourceOrder = moveInOrder([...prefs.metadataSourceOrder], key, null, targetRow.dataset.sourceRow); persist({ meta: true }); render();
    }
  });
  document.addEventListener("input", event => {
    if (event.target.matches("[data-log-search]")) { if (settingsGroup === "history") historyQuery = event.target.value; else logQuery = event.target.value; const list = $(".logcat-list"); if (list) { const query = (settingsGroup === "history" ? historyQuery : logQuery).toLowerCase(); list.querySelectorAll(".logcat-entry").forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); }); } return; }
    if (event.target.matches("[data-detail-notes]")) {
      const item = items.find(row => row.id === detailItemId);
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
    if (event.target.id === "explore-source-search") {
      const query = event.target.value.trim().toLowerCase();
      const rows = $$("[data-explore-search]");
      let matches = 0;
      rows.forEach(row => { row.hidden = query !== "" && !row.dataset.exploreSearch.includes(query); if (!row.hidden) matches++; });
      const empty = $("#explore-no-sources");
      if (empty) empty.hidden = query === "" || matches > 0;
      return;
    }
    if (event.target.id === "global-search") {
      libraryQuery = event.target.value;
      const clearButton = $("[data-clear-collection-search]");
      if (clearButton) clearButton.hidden = !libraryQuery;
      clearTimeout(searchRenderTimer);
      searchRenderTimer = setTimeout(() => refreshSearchResults("dashboard", "#collection-results"), 120);
      return;
    }
    if (event.target.id === "library-search") {
      libraryQuery = event.target.value;
      clearTimeout(searchRenderTimer);
      searchRenderTimer = setTimeout(() => refreshSearchResults("search", "#search-results"), 120);
    }
  });
  document.addEventListener("submit", event => {
    if (event.target.id === "custom-source-form") { saveCustomSource(event); return; }
    if (event.target.id !== "dashboard-filter-form") return;
    event.preventDefault();
    prefs.dashboardView = event.target.elements.view?.value || prefs.dashboardView;
    persist({ meta: true });
    applyPreferences();
    closePopup($("#dashboard-filter-dialog"));
    render();
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
    const button = event.target.closest(".nav-button[data-page]");
    if (!button) return;
    settingsGroup = null;
    goto(button.dataset.page);
  });
  $("#sidebar-nav").addEventListener("click", event => {
    const button = event.target.closest(".sidebar-nav-button[data-sidebar-page]");
    if (!button) return;
    settingsGroup = null;
    goto(button.dataset.sidebarPage);
  });
  $("#header-filter").addEventListener("click", () => showPopup($("#dashboard-filter-dialog")));
  // ---- Pull to refresh on Details and drill-down pages (touch or mouse drag from the very top) ----
  (() => {
    const THRESHOLD = 72, MAX = 130; let ptr = null, startY = 0, candidate = false, pulling = false, distance = 0, busy = false;
    const element = () => {
      if (ptr) return ptr;
      ptr = document.createElement("div"); ptr.className = "ptr"; ptr.setAttribute("role", "status"); ptr.setAttribute("aria-live", "polite");
      ptr.innerHTML = '<span class="ptr-bubble"><svg class="ptr-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg><span class="ptr-spinner"></span><svg class="ptr-check" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span><span class="ptr-text"></span>';
      document.body.appendChild(ptr); return ptr;
    };
    const show = (state, text, offset) => { const el = element(); el.dataset.state = state; el.querySelector(".ptr-text").textContent = text; el.style.setProperty("--pull", `${offset}px`); el.style.setProperty("--turn", `${Math.min(1, offset / THRESHOLD) * 180}deg`); el.classList.add("show"); };
    const hide = () => { if (ptr) { ptr.classList.remove("show"); ptr.dataset.state = ""; ptr.style.setProperty("--pull", "0px"); } };
    const allowed = target => page === "details" && !busy && window.scrollY <= 0 && !target.closest?.("input, textarea, select, dialog, [data-detail-image-src], .detail-carousel, .detail-gallery, .ep-ratings-scroll, .season-pills, .detail-tabs");
    const begin = (y, target) => { candidate = allowed(target); startY = y; pulling = false; distance = 0; };
    const move = (y, event) => {
      if (!candidate) return;
      const dy = y - startY;
      if (dy <= 6 || window.scrollY > 0) { if (pulling) { pulling = false; hide(); } return; }
      pulling = true; distance = Math.min(MAX, dy * .55);
      if (event.cancelable) event.preventDefault();
      show(distance >= THRESHOLD ? "ready" : "pull", distance >= THRESHOLD ? "Release to refresh" : "Pull to refresh", distance);
    };
    const finish = async () => {
      const shouldRefresh = pulling && distance >= THRESHOLD; candidate = false; pulling = false;
      if (!shouldRefresh) { hide(); return; }
      busy = true; show("loading", "Refreshing…", 62);
      try { await (detailRef ? loadDetailRef() : loadDetails()); show("done", "Updated", 62); }
      catch (_) { show("done", "Could not refresh", 62); }
      await new Promise(resolve => setTimeout(resolve, 650)); hide(); busy = false;
    };
    document.addEventListener("touchstart", event => begin(event.touches[0].clientY, event.target), { passive: true });
    document.addEventListener("touchmove", event => move(event.touches[0].clientY, event), { passive: false });
    document.addEventListener("touchend", finish); document.addEventListener("touchcancel", () => { candidate = false; pulling = false; hide(); });
    let mouseDown = false;
    document.addEventListener("mousedown", event => { if (event.button !== 0 || event.target.closest("button, a, label")) return; mouseDown = true; begin(event.clientY, event.target); });
    document.addEventListener("mousemove", event => { if (mouseDown) move(event.clientY, event); });
    document.addEventListener("mouseup", () => { if (mouseDown) { mouseDown = false; finish(); } });
  })();
  $("#header-type").addEventListener("click", event => {
    const discoverButton = event.target.closest("[data-discover-category]");
    if (discoverButton && page === "discover") { discoverCategoryChoice = discoverButton.dataset.discoverCategory; discoverCache = null; suggestionsCache = null; discoverQuery = ""; render(); return; }
    const button = event.target.closest("[data-category-filter]"); if (!button) return; activeCategory = button.dataset.categoryFilter || "series"; prefs.dashboardDefaultCategory = activeCategory; persist({ meta: true }); render();
  });
  $("[data-close-setting-picker]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); closePopup($("#setting-picker-dialog")); });
  $("#floating-add").addEventListener("click", () => openItem());
  function syncRouteFromHash() {
    rememberScroll();
    const [hashPath, hashQuery = ""] = location.hash.slice(1).split("?");
    const route = hashPath.split("/"); const next = route[0];
    if (next === "search") { page = "dashboard"; settingsGroup = null; historyPush(); render(); syncPageNavigation(); restoreScroll(); return; }
    if (!(next in titles)) return;
    if (next !== "discover") { discoverQuery = ""; discoverRequestId++; }
    if (next !== "add") { addMetadataQuery = ""; addMetadataRequestId++; entryDraftId = null; }
    else if (page !== "add") { entryDraftId = null; addMetadataQuery = ""; } // opening Add from a link/back is a new entry
    if (next === "details" && detailStack.length) { detailBack(); return; }
    if (next !== "details" || (detailIdFromQuery(hashQuery) || null) !== detailItemId) clearDetailStack();
    discoverSource = next === "discover" ? new URLSearchParams(hashQuery).get("source") || "" : "";
    page = next; settingsGroup = next === "settings" ? (route[1] === "manage-backups" ? "backups" : route[1] || null) : null;
    settingsParam = next === "settings" ? new URLSearchParams(hashQuery).get("id") || "" : "";
    statsSubpage = next === "statistics" && statsSections.includes(route[1]) ? normalizeStatsSection(route[1]) : "";
    document.body.dataset.navDir = "back";
    if (next === "details") { const id = detailIdFromQuery(hashQuery); if (id && id !== detailItemId) { detailItemId = id; detailPreview = null; detailData = null; detailError = ""; render(); syncPageNavigation(); loadDetails(); return; } }
    render(); syncPageNavigation(); restoreScroll();
  }
  document.addEventListener("keydown", event => { if (event.key === "Enter" && event.target?.id === "mix-query") { event.preventDefault(); runMixSearch(); } });
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
    if (page !== "dashboard" || settingsGroup) { if (window.history.length > 1) window.history.back(); else goto("dashboard"); return; }
    window.Capacitor.Plugins.App.exitApp?.();
  });
  window.addEventListener("hashchange", syncRouteFromHash);
  window.addEventListener("storage", event => { if (event.key === storageKey) toast("Library changed in another tab."); });
  window.addEventListener("beforeunload", () => { flushPersist(); window.SplitAppBackend?.flushJournals?.(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { flushPersist(); window.SplitAppBackend?.flushJournals?.(); if (metadataSync) recordLog("info", "Metadata refresh pauses while the app is hidden and resumes when visible."); } else if (!metadataSync && metadataSyncState?.entries?.some(entry => ["queued", "running"].includes(entry.status))) startMetadataSync(null, true); });
  window.addEventListener("online", () => { if (!metadataSync && metadataSyncState?.entries?.some(entry => ["queued", "running"].includes(entry.status))) startMetadataSync(null, true); });
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
    const initialItems = new Map(items.map(item => [String(item.id), JSON.stringify(item)]));
    const initialPreferences = JSON.parse(JSON.stringify(prefs));
    try {
      const restored = await window.SplitAppBackend.load({ fast });
      if (!restored) return null; // nothing stored locally yet: the caller runs the full restore
      const nativeItems = Array.isArray(restored.items) ? restored.items.filter(item => config.categories.some(category => category.key === item.category)) : items;
      const nativeHistory = Array.isArray(restored.history) ? restored.history : history;
      const nativePreferences = restored.preferences && typeof restored.preferences === "object" ? restored.preferences : {};
      const nativeHasLegacyScores = nativeItems.some(item => Object.prototype.hasOwnProperty.call(item, "rating") || Object.values(item.episodeNotes || {}).some(note => Object.prototype.hasOwnProperty.call(note || {}, "rating")));
      const nativeHasLegacyPreferences = ["showRatings", "ratingFormat", "dashboardDensity", "font", "categoryColors", "showThumbnails", "showProgress"].some(key => Object.prototype.hasOwnProperty.call(nativePreferences, key)) || ["rating", "rating-desc", "highest-rated"].includes(nativePreferences.dashboardSort) || Boolean(nativePreferences.theme && !["system", "light", "amoled"].includes(nativePreferences.theme));
      // Changes made while the folder was loading win over the loaded copy (they used to be overwritten).
      if (localMutationRevision === initialRevision) {
        items = nativeItems;
        history = nativeHistory;
        if (restored.loadedFromFolder) {
          Object.keys(prefs).forEach(key => delete prefs[key]);
          Object.assign(prefs, JSON.parse(JSON.stringify(prefsDefaults)), nativePreferences);
        } else Object.assign(prefs, nativePreferences);
      } else {
        const currentItems = new Map(items.map(item => [String(item.id), item]));
        const mergedItems = new Map(nativeItems.map(item => [String(item.id), item]));
        for (const id of initialItems.keys()) if (!currentItems.has(id)) mergedItems.delete(id);
        for (const [id, item] of currentItems) {
          if (!initialItems.has(id) || initialItems.get(id) !== JSON.stringify(item)) mergedItems.set(id, item);
        }
        items = [...mergedItems.values()];
        history = [...new Map([...history, ...nativeHistory].map(entry => [JSON.stringify(entry), entry])).values()];
        for (const [key, value] of Object.entries(prefs)) {
          if (JSON.stringify(value) !== JSON.stringify(initialPreferences[key])) nativePreferences[key] = value;
        }
        Object.assign(prefs, nativePreferences);
      }
      items.forEach(stripLocalScores);
      delete prefs.showRatings; delete prefs.ratingFormat; delete prefs.dashboardDensity; delete prefs.font; delete prefs.categoryColors; delete prefs.showThumbnails; delete prefs.showProgress;
      if (!["system", "light", "amoled"].includes(prefs.theme)) prefs.theme = "system";
      if (["rating", "rating-desc", "highest-rated"].includes(prefs.dashboardSort)) prefs.dashboardSort = "alphabetical-asc";
      delete prefs.defaultCategory;
      delete prefs.appLook;
      delete prefs.appDisplayName;
      refreshSourceRegistry();
      normalizeNavigationPrefs();
      if (!restored.fast || nativeHasLegacyScores || nativeHasLegacyPreferences) await window.SplitAppBackend.save({ items, history, preferences: prefs });
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
    if (refType && refId) { detailStack.push(detailSnapshot()); detailRef = { type: refType, id: refId, title: (refSlug || "").replace(/-/g, " ") }; loadDetailRef(); }
    else loadDetails();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => window.ScreenMarkSplash?.ready?.()));
  const finishStartup = success => {
    if (!success) {
      if (nativeFolderStorage && storageFolderGate) storageFolderGate.hidden = false;
      return;
    }
    if (storageFolderGate) storageFolderGate.hidden = true;
    applyPreferences(); render(); syncBackupSchedule();
    if (metadataSyncState?.entries?.some(entry => ["queued", "running"].includes(entry.status))) startMetadataSync(null, true);
    if (page === "details" && detailItemId && !detailPreview) loadDetails();
  };
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
      else if (full && libraryStamp() !== before) { applyPreferences(); render(); } // keep scroll position when nothing changed
      if (full) checkLibraryDrift();
      setTimeout(fillThumbCache, 1500);
      return;
    }
    const full = await restoreNativeData();
    finishStartup(full);
    if (full) checkLibraryDrift();
    setTimeout(fillThumbCache, 3000);
  });
})();
