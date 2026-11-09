// Profile overview and poster collections.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  let coverId = "";
  const PAGE_BATCH = 100;
  const titleCollator = new Intl.Collator(undefined, { sensitivity: "base" });
  const collectionVisible = new Map();
  let collectionQueryKey = "";
  const collectionSortCache = new Map();
  let collectionCacheItems = null, collectionCacheRevision, collectionCacheKey = "";
  const watchlistVisible = new Map();
  const artOf = item => item?.customCover || item?.localThumbnailData || item?.localPortraitData || item?.image || "";
  const landscapeOf = item => item?.localLandscapeData || item?.localImageData?.["cachedDetails.landscapeImage"] || item?.localImageData?.["cachedDetails.backgroundImage"] || item?.backdrop || item?.cachedDetails?.landscapeImage || item?.cachedDetails?.backgroundImage || "";
  const stampOf = item => Number(item?.createdAt) || Number(item?.updatedAt) || 0;
  const isDone = (item, roles) => String(item?.status || "").toLowerCase() === String(roles?.done || "completed").toLowerCase();
  const duration = minutes => {
    let hours = Math.max(0, Math.floor((Number(minutes) || 0) / 60));
    const months = Math.floor(hours / 720); hours %= 720;
    const days = Math.floor(hours / 24); hours %= 24;
    return { months, days, hours };
  };
  const durationMarkup = minutes => {
    const value = duration(minutes);
    return `<span class="profile-time-value"><strong>${value.months}</strong><small>MONTHS</small></span><span class="profile-time-value"><strong>${value.days}</strong><small>DAYS</small></span><span class="profile-time-value"><strong>${value.hours}</strong><small>HOURS</small></span>`;
  };
  const coverMarkup = (item, esc, landscape = false, imageMarkup = window.SplitAppImageMarkup) => {
    const art = landscape ? landscapeOf(item) : artOf(item);
    const fallback = `<span class="profile-art-placeholder"><i data-lucide="clapperboard" aria-hidden="true"></i></span>`;
    if (imageMarkup) return imageMarkup(landscape ? null : item, art, `${item.title} cover`, fallback);
    return art ? `<img src="${esc(art)}" alt="${esc(item.title)} cover" loading="lazy" decoding="async" onerror="this.hidden=true">` : fallback;
  };
  const posterButton = (item, esc, roles = {}, showProgress = false, imageMarkup = window.SplitAppImageMarkup) => {
    const goal = item.category === "series" ? Number(item.goal) || Number(item.facts?.episodeCount) || 0 : Number(item.goal) || Number(item.facts?.runtimeMinutes) || 0;
    const progress = Math.max(0, Number(item.progress) || 0);
    const done = isDone(item, roles);
    const percent = done ? 100 : goal ? Math.min(100, Math.round(progress / goal * 100)) : 0;
    const progressBar = showProgress ? `<span class="demo-poster-progress"><i class="${percent >= 100 ? "is-done" : ""}" style="width:${percent}%"></i></span>` : "";
    return `<button type="button" class="profile-poster" data-open-details data-id="${esc(item.id)}" aria-label="Open ${esc(item.title)}">${coverMarkup(item, esc, false, imageMarkup)}<span class="profile-poster-title">${esc(item.title)}</span>${progressBar}</button>`;
  };
  const sectionHeader = (title, target, count) => `<header class="profile-section-heading"><h2>${title}${Number.isFinite(count) ? ` <small>${count}</small>` : ""}</h2><button type="button" data-go="${target}" aria-label="See all ${title}"><i data-lucide="chevron-right" aria-hidden="true"></i></button></header>`;

  const DEFAULTS = { Source: "both", Mode: "random", Interval: "visit" };
  const INTERVALS = { visit: 0, hourly: 36e5, daily: 864e5, weekly: 6048e5, manual: Infinity };
  const SESSION = String(Date.now());
  const AVATAR_KEY = "screenmark_profile_avatar";
  const KINDS = {
    cover: { prefix: "profileCover", store: "screenmark_profile_cover", landscape: true, title: "Background cover", off: ["none", "No cover (remove)"] },
    avatar: { prefix: "profileAvatar", store: "screenmark_profile_avatar_pick", landscape: false, title: "Profile photo", off: ["none", "Default icon (remove)"], custom: ["custom", "My own photo"] }
  };
  const readJson = key => { try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (_) { return {}; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const readAvatar = () => { try { return localStorage.getItem(AVATAR_KEY) || ""; } catch (_) { return ""; } };
  const pref = (prefs, kind, name) => prefs[KINDS[kind].prefix + name] || (name === "Source" && kind === "avatar" ? "custom" : DEFAULTS[name]);
  const imageOf = (item, kind) => KINDS[kind].landscape ? landscapeOf(item) : artOf(item);
  const poolOf = (items, kind, source) => ["none", "custom", "pinned"].includes(source) ? [] : items.filter(item => imageOf(item, kind) && ({
    both: true, series: item.category === "series", movies: item.category === "movie", favorites: item.favorite,
    "series-favorites": item.category === "series" && item.favorite, "movie-favorites": item.category === "movie" && item.favorite
  }[source] ?? true));
  function pickFor(kind, items, prefs, force = false) {
    const source = pref(prefs, kind, "Source"), mode = pref(prefs, kind, "Mode"), interval = INTERVALS[pref(prefs, kind, "Interval")] ?? 0;
    if (source === "pinned") { const pinned = items.find(item => String(item.id) === String(prefs[KINDS[kind].prefix + "Pinned"]) && imageOf(item, kind)); return pinned || null; }
    const pool = poolOf(items, kind, source);
    if (!pool.length) return null;
    const store = KINDS[kind].store, saved = readJson(store), key = `${source}|${mode}`;
    const current = pool.find(item => String(item.id) === String(saved.id));
    const same = current && saved.key === key && !force;
    // "visit" re-picks once per app launch, not on every re-render.
    if (same && (interval === 0 ? saved.session === SESSION : Date.now() - (saved.at || 0) < interval)) return current;
    const choice = mode === "newest" ? [...pool].sort((a, b) => stampOf(b) - stampOf(a))[0] : pool[Math.floor(Math.random() * pool.length)];
    writeJson(store, { id: String(choice.id), at: Date.now(), key, session: SESSION });
    return choice;
  }
  const pickCover = (items, prefs, force) => pickFor("cover", items, prefs, force);
  const avatarMarkup = (esc, items = [], prefs = {}) => {
    const source = pref(prefs, "avatar", "Source");
    if (source === "custom") { const src = readAvatar(); if (src.startsWith("data:image/")) return `<span class="avatar-img" role="img" aria-label="Profile photo" style="background-image:url('${esc(src)}')"></span>`; }
    else if (source !== "none") { const item = pickFor("avatar", items, prefs); if (item) return `<span class="avatar-img" role="img" aria-label="${esc(item.title)}" style="background-image:url('${esc(artOf(item)).replace(/'/g, "%27")}')"></span>`; }
    return `<i data-lucide="user-round" aria-hidden="true"></i>`;
  };
  const optionLists = kind => {
    const k = KINDS[kind];
    return {
      Source: ["Images from", [k.off, ...(k.custom ? [k.custom] : []), ["pinned", "Picked below"], ["both", "Series and movies"], ["series", "Series only"], ["movies", "Movies only"], ["favorites", "Favorites only (both)"], ["series-favorites", "Series favorites only"], ["movie-favorites", "Movie favorites only"]]],
      Mode: ["Pick", [["random", "Random"], ["newest", "Most recently updated"]]],
      Interval: ["Change", [["visit", "Every app launch"], ["hourly", "Every hour"], ["daily", "Every day"], ["weekly", "Every week"], ["manual", "Only when I shuffle"]]]
    };
  };
  let coverTab = "avatar";
  const pickerLimit = { cover: 18, avatar: 24 };
  function profileCoverPage(context) {
    const { items = [], prefs = {}, esc } = context;
    const library = kind => {
      const k = KINDS[kind], all = items.filter(item => imageOf(item, kind)).sort((a, b) => stampOf(b) - stampOf(a));
      const shown = all.slice(0, pickerLimit[kind]), pinned = pref(prefs, kind, "Source") === "pinned" ? String(prefs[k.prefix + "Pinned"] || "") : "";
      if (!all.length) return "";
      return `<section class="profile-cover-library"><h3>Choose from your library</h3><div class="profile-pick-grid ${kind}">${shown.map(item => `<button type="button" class="profile-pick-tile${pinned === String(item.id) ? " selected" : ""}" data-cover-pick="${kind}" data-id="${esc(item.id)}" aria-label="Use ${esc(item.title)}" aria-pressed="${pinned === String(item.id)}"><img src="${esc(imageOf(item, kind))}" alt="" loading="lazy" decoding="async" onerror="this.closest('button').hidden=true"></button>`).join("")}</div>${shown.length < all.length ? `<button type="button" class="profile-cover-remove profile-pick-more" data-cover-more="${kind}">Load more (${all.length - shown.length} left)</button>` : ""}</section>`;
    };
    const section = kind => {
      const k = KINDS[kind], source = pref(prefs, kind, "Source"), lists = optionLists(kind), count = poolOf(items, kind, source).length;
      const group = name => `<section class="profile-cover-setting"><h3>${lists[name][0]}</h3>${lists[name][1].map(([value, label]) => `<label class="profile-cover-option"><input type="radio" name="${k.prefix}${name}" data-pref="${k.prefix}${name}" value="${value}" ${pref(prefs, kind, name) === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</section>`;
      let preview;
      if (kind === "cover") { const cover = pickCover(items, prefs); preview = `<div class="profile-cover-preview">${cover ? coverMarkup(cover, esc, true) : `<span class="profile-cover-empty"></span>`}<span class="profile-cover-shade"></span><small>${cover ? esc(cover.title) : "No cover"}</small></div>`; }
      else preview = `<div class="profile-avatar-editor"><span class="profile-avatar">${avatarMarkup(esc, items, prefs)}</span>${source === "custom" ? `<label class="profile-cover-shuffle"><i data-lucide="image-plus" aria-hidden="true"></i><span>Choose photo</span><input type="file" accept="image/*" data-profile-avatar-file hidden></label>${readAvatar() ? `<button type="button" class="profile-cover-remove" data-profile-avatar-remove>Remove photo</button>` : ""}` : ""}</div>`;
      const usesPool = !["none", "custom", "pinned"].includes(source);
      return `<section class="profile-cover-block"><h2>${k.title}</h2>${preview}${usesPool ? `<button type="button" class="profile-cover-shuffle" data-profile-cover-shuffle="${kind}"><i data-lucide="shuffle" aria-hidden="true"></i><span>Shuffle now</span></button>` : ""}${group("Source")}${usesPool ? group("Mode") + group("Interval") : ""}${library(kind)}</section>`;
    };
    return `<section class="profile-page profile-cover-page"><header class="profile-list-header"><button type="button" data-go="profile" aria-label="Back to profile"><i data-lucide="chevron-left" aria-hidden="true"></i></button><h2>Edit profile</h2><span></span></header><div class="watchlist-tabs" role="tablist"><button type="button" class="${coverTab === "avatar" ? "active" : ""}" data-cover-tab="avatar" role="tab" aria-selected="${coverTab === "avatar"}">Profile</button><button type="button" class="${coverTab === "cover" ? "active" : ""}" data-cover-tab="cover" role="tab" aria-selected="${coverTab === "cover"}">Background</button></div>${section(coverTab)}</section>`;
  }

  function profilePage(context) {
    const { items = [], roles = {}, esc, imageMarkup } = context;
    const series = items.filter(item => item.category === "series").sort((a, b) => stampOf(b) - stampOf(a));
    const movies = items.filter(item => item.category === "movie").sort((a, b) => stampOf(b) - stampOf(a));
    const cover = pickCover(items, context.prefs || {});
    let watchedEpisodes = 0, seriesMinutes = 0;
    series.forEach(item => {
      const totalEpisodes = Number(item.facts?.episodeCount) || Number(item.goal) || 0;
      const progress = Math.max(0, Number(item.progress) || 0);
      const watched = isDone(item, roles) ? Math.max(totalEpisodes, progress) : progress;
      let runtime = Number(item.facts?.runtimeMinutes) || 0;
      if (!runtime && Number(item.facts?.totalMinutes) && totalEpisodes) runtime = Number(item.facts.totalMinutes) / totalEpisodes;
      watchedEpisodes += watched;
      seriesMinutes += watched * runtime;
    });
    let movieMinutes = 0;
    movies.forEach(item => {
      const total = Number(item.facts?.totalMinutes) || Number(item.facts?.runtimeMinutes) || 0;
      const watched = isDone(item, roles) ? total : Math.min(Math.max(0, Number(item.progress) || 0), total || Infinity);
      movieMinutes += watched;
    });
    const watchedMovies = movies.filter(item => isDone(item, roles)).length;
    const favoriteSeries = series.filter(item => item.favorite);
    const favoriteMovies = movies.filter(item => item.favorite);
    const timeCard = (label, minutes, icon) => `<a class="profile-stat-card" href="#statistics"><span class="profile-stat-heading"><i data-lucide="${icon}" aria-hidden="true"></i><strong>${label}</strong></span><span class="profile-time-values">${durationMarkup(minutes)}</span></a>`;
    const countCard = (label, count, icon) => `<a class="profile-stat-card profile-stat-count-card" href="#statistics"><span class="profile-stat-heading"><i data-lucide="${icon}" aria-hidden="true"></i><strong>${label}</strong></span><span class="profile-count-value">${Math.round(Number(count) || 0)}</span></a>`;
    const empty = `<div class="profile-empty"><i data-lucide="library" aria-hidden="true"></i><strong>Your profile is ready</strong><span>Add tracked movies and series to build your page.</span><button type="button" data-go="discover">Discover titles</button></div>`;
    const shelves = `${series.length ? `<section class="profile-shelf">${sectionHeader("Series", "series", series.length)}<div class="profile-poster-rail">${series.slice(0, 5).map(item => posterButton(item, esc)).join("")}</div></section><section class="profile-shelf">${sectionHeader("♥ Series favorites", "series-favorites", favoriteSeries.length)}${favoriteSeries.length ? `<div class="profile-poster-rail">${favoriteSeries.slice(0, 5).map(item => posterButton(item, esc)).join("")}</div>` : `<button type="button" class="profile-favorite-empty" data-go="series-favorites">No series favorites yet <i data-lucide="chevron-right" aria-hidden="true"></i></button>`}</section>` : ""}${movies.length ? `<section class="profile-shelf">${sectionHeader("Movies", "movies", movies.length)}<div class="profile-poster-rail">${movies.slice(0, 5).map(item => posterButton(item, esc)).join("")}</div></section><section class="profile-shelf">${sectionHeader("♥ Movie favorites", "movie-favorites", favoriteMovies.length)}${favoriteMovies.length ? `<div class="profile-poster-rail">${favoriteMovies.slice(0, 5).map(item => posterButton(item, esc)).join("")}</div>` : `<button type="button" class="profile-favorite-empty" data-go="movie-favorites">No movie favorites yet <i data-lucide="chevron-right" aria-hidden="true"></i></button>`}</section>` : ""}`;
    return `<section class="profile-page"><section class="profile-hero"><div class="profile-cover">${cover ? coverMarkup(cover, esc, true) : `<span class="profile-cover-empty"></span>`}<span class="profile-cover-shade"></span></div><a class="profile-edit-trigger" href="#profile-cover" aria-label="Edit profile cover"><i data-lucide="pencil" aria-hidden="true"></i></a><button type="button" class="profile-overflow-trigger" aria-label="More profile options" data-open-profile-menu><i data-lucide="ellipsis" aria-hidden="true"></i></button><div class="profile-identity"><span class="profile-avatar">${avatarMarkup(esc, items, context.prefs || {})}</span><div><h2>My Profile</h2><small>${items.length} tracked ${items.length === 1 ? "title" : "titles"}</small></div><button type="button" class="profile-add-manual" data-profile-add><i data-lucide="plus" aria-hidden="true"></i><span>Add manually</span></button></div></section><dialog class="profile-options-dialog" id="profile-options-dialog" aria-label="Profile options"><header><strong>Profile options</strong><button type="button" data-profile-menu-close aria-label="Close options">×</button></header><nav><a href="#statistics/activity"><i data-lucide="activity" aria-hidden="true"></i><span>Activity</span></a><a href="#timeline"><i data-lucide="history" aria-hidden="true"></i><span>Timeline</span></a><a href="#settings"><i data-lucide="settings" aria-hidden="true"></i><span>Settings</span></a><a href="#settings/metadata-sources"><i data-lucide="database" aria-hidden="true"></i><span>Metadata sources</span></a><a href="#settings/app-info"><i data-lucide="circle-help" aria-hidden="true"></i><span>About ScreenMark</span></a></nav></dialog><section class="profile-stats"><header class="profile-section-heading"><h2>Stats</h2><a href="#statistics" aria-label="Open full statistics"><i data-lucide="chevron-right" aria-hidden="true"></i></a></header><div class="profile-stat-rail">${timeCard("Series time", seriesMinutes, "tv")} ${countCard("Episodes watched", watchedEpisodes, "tv")} ${timeCard("Movie time", movieMinutes, "clapperboard")} ${countCard("Movies watched", watchedMovies, "clapperboard")}</div></section>${shelves}${items.length ? "" : empty}</section>`;
  }

  function collectionPage(context, kind, favorites = false) {
    const { items = [], esc, config, roles = {}, profileCollectionSort = "alpha", profileStatusFilter = "all", profileGenreFilter = "all", profileStatusGroups = false } = context;
    const category = kind === "movie" ? "movie" : "series";
    const title = favorites ? `${category === "series" ? "Series" : "Movie"} Favorites` : category === "series" ? "Shows" : "Movies";
    const revisionKey = `${kind}|${favorites}|${profileCollectionSort}|${context.dataRevision ?? ""}`;
    if (collectionCacheItems !== items || collectionCacheRevision !== context.dataRevision || collectionCacheKey !== revisionKey) {
      collectionSortCache.clear(); collectionCacheItems = items; collectionCacheRevision = context.dataRevision; collectionCacheKey = revisionKey;
    }
    const categoryItems = items.filter(item => item.category === category && (!favorites || item.favorite));
    const statuses = config.categories.find(row => row.key === category)?.statuses || [];
    const selectedStatus = statuses.includes(profileStatusFilter) ? profileStatusFilter : "all";
    const sortItems = rows => [...rows].sort(profileCollectionSort === "alpha" ? (a, b) => titleCollator.compare(a.title || "", b.title || "") : profileCollectionSort === "watched" ? (a, b) => (Number(b.progress) || 0) - (Number(a.progress) || 0) : profileCollectionSort === "rating" ? (a, b) => (Number(b.facts?.rating) || 0) - (Number(a.facts?.rating) || 0) : (a, b) => stampOf(b) - stampOf(a));
    const genreOf = item => item.genres || item.facts?.genres || item.cachedDetails?.genres || [];
    const genres = [...new Set(categoryItems.flatMap(genreOf).map(value => String(value).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const sortKey = `${kind}|${favorites}|${profileCollectionSort}`;
    let sorted = collectionSortCache.get(sortKey);
    if (!sorted || sorted.items !== items || sorted.revision !== context.dataRevision) {
      sorted = { items, revision: context.dataRevision, rows: sortItems(categoryItems) };
      collectionSortCache.set(sortKey, sorted);
    }
    const filtered = sorted.rows.filter(item => (selectedStatus === "all" || item.status === selectedStatus) && (profileGenreFilter === "all" || genreOf(item).some(value => String(value).toLocaleLowerCase() === profileGenreFilter.toLocaleLowerCase())));
    const queryKey = `${kind}|${favorites}|${profileCollectionSort}|${selectedStatus}|${profileGenreFilter}|${profileStatusGroups}`;
    if (queryKey !== collectionQueryKey) { collectionQueryKey = queryKey; collectionVisible.set(queryKey, PAGE_BATCH); }
    const visibleCount = collectionVisible.get(queryKey) || PAGE_BATCH;
    const sortChoices = [["recent", "Recently added"], ["alpha", "Alphabetical"], ["rating", "Top rated"], ["watched", "Most watched"]];
    const selectedSortLabel = sortChoices.find(([key]) => key === profileCollectionSort)?.[1] || "Recently added";
    const filtersApplied = profileCollectionSort !== "alpha" || selectedStatus !== "all" || profileGenreFilter !== "all";
    const filterDialog = `<dialog class="choice-dialog profile-filter-dialog" id="profile-filter-dialog"><div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">${category === "series" ? "SHOWS" : "MOVIES"}</p><h2>Filters</h2></div><button type="button" class="choice-dialog-close" data-profile-filter-close aria-label="Close">×</button></header><div class="profile-filter-sheet-body"><section><h3>Sort by</h3><div class="profile-filter-chips">${sortChoices.map(([value, label]) => `<button type="button" class="${profileCollectionSort === value ? "active" : ""}" data-profile-sort-choice="${value}" aria-pressed="${profileCollectionSort === value}">${label}</button>`).join("")}</div></section>${genres.length ? `<section><h3>Genres</h3><div class="profile-filter-genres">${genres.map(genre => `<button type="button" class="${profileGenreFilter.toLocaleLowerCase() === genre.toLocaleLowerCase() ? "active" : ""}" data-profile-genre-choice="${esc(genre)}" aria-pressed="${profileGenreFilter.toLocaleLowerCase() === genre.toLocaleLowerCase()}">${esc(genre)}</button>`).join("")}</div></section>` : ""}<section><h3>Status</h3><div class="profile-filter-statuses"><button type="button" data-profile-status-choice="all" aria-pressed="${selectedStatus === "all"}"><span>All</span><i></i></button>${statuses.map(status => `<button type="button" data-profile-status-choice="${esc(status)}" aria-pressed="${status === selectedStatus}"><span>${esc(status)}</span><i></i></button>`).join("")}</div></section></div><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-profile-filter-reset>Reset</button><button type="button" class="button primary" data-profile-filter-close>Done</button></footer></dialog>`;
    const gridFor = rows => rows.length ? `<div class="profile-collection-grid">${rows.map(item => posterButton(item, esc, context.roles, true)).join("")}</div>` : "";
    let content;
    if (profileStatusGroups && selectedStatus === "all") {
      const ordered = [...statuses.filter(status => status !== (roles.done || "Completed")), roles.done || "Completed"].filter(status => statuses.includes(status));
      const groupMap = new Map(ordered.map(status => [status, []]));
      filtered.slice(0, visibleCount).forEach(item => groupMap.get(item.status)?.push(item));
      const grouped = ordered.map(status => ({ status, rows: groupMap.get(status) })).filter(group => group.rows.length);
      content = grouped.length ? `<div class="profile-status-groups">${grouped.map(group => `<section class="profile-status-group"><h3>${esc(group.status)}</h3>${gridFor(group.rows)}</section>`).join("")}</div>` : "";
    } else content = gridFor(filtered.slice(0, visibleCount));
    if (!filtered.length) content = context.libraryLoading && !items.length
      ? `<div class="profile-collection-grid profile-collection-skeleton" role="status" aria-label="Loading library">${Array.from({ length: 12 }, () => `<span class="profile-collection-skeleton-card" aria-hidden="true"></span>`).join("")}</div>`
      : `<div class="profile-empty profile-list-empty"><i data-lucide="library" aria-hidden="true"></i><strong>${categoryItems.length ? "No titles match this filter" : favorites ? "No favorites yet" : `No ${title.toLowerCase()} yet`}</strong><span>${categoryItems.length ? "Choose another status or clear the filter." : "Titles you add to your library will appear here."}</span></div>`;
    const filterControl = filtersApplied
      ? `<footer class="profile-filter-bar"><button type="button" class="profile-filter-icon" data-open-profile-filters aria-label="Open filters"><i data-lucide="sliders-horizontal" aria-hidden="true"></i></button><button type="button" class="profile-sort-pill" data-open-profile-filters aria-label="Sort by ${esc(selectedSortLabel)}">${esc(selectedSortLabel)} <i data-lucide="chevron-down" aria-hidden="true"></i></button></footer>`
      : `<button type="button" class="profile-filter-pill" data-open-profile-filters><i data-lucide="sliders-horizontal" aria-hidden="true"></i><span>Filters</span></button>`;
    const more = filtered.length > visibleCount ? `<button type="button" class="watchlist-browse" data-collection-more="${esc(queryKey)}">Show more · ${Math.min(visibleCount, filtered.length)} of ${filtered.length}</button>` : "";
    return `<section class="profile-page profile-list-page"><header class="profile-list-header"><button type="button" data-go="profile" aria-label="Back to profile"><i data-lucide="chevron-left" aria-hidden="true"></i></button><h2>${title}</h2><div class="profile-list-header-actions"><button class="profile-visibility-toggle${profileStatusGroups ? " is-active" : ""}" type="button" data-profile-groups aria-label="${profileStatusGroups ? "Show all titles in one grid" : "Group titles by status"}" aria-pressed="${profileStatusGroups}"><i data-lucide="eye" aria-hidden="true"></i></button></div></header>${content}${more}${filterControl}${filterDialog}</section>`;
  }

  const watchlistStatus = (item, roles) => item.status === roles.queued || ["watchlist", "backlog", "queued", "to watch", "to play"].includes(String(item.status || "").toLowerCase());
  const activeStatus = (item, roles) => item.status === roles.active || ["watching", "in progress", "playing"].includes(String(item.status || "").toLowerCase());
  const holdStatus = (item, roles) => item.status === roles.hold || ["on hold", "paused", "haven't started", "not started yet"].includes(String(item.status || "").toLowerCase());
  const agoLong = item => Date.now() - (Number(item?.updatedAt) || Number(item?.createdAt) || 0) > 30 * 86400000;
  const episodeAirTime = episode => window.SplitAppLibrary.episodeAirTime?.(episode) || 0;
  const daysUntil = value => {
    const timestamp = Date.parse(value || "");
    if (!timestamp) return "Date unknown";
    const days = Math.max(0, Math.ceil((timestamp - Date.now()) / 86400000));
    return days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
  };
  function watchlistCard({ item, episode, esc, roles, imageMarkup = window.SplitAppImageMarkup, watched = false, upcoming = false, view = "list" }) {
    const isMovie = item.category === "movie";
    const episodeArt = episode?.image || "";
    const thumb = episodeArt || item.customCover || item.localThumbnailData || item.localPortraitData || item.image || "";
    const landscape = item.localLandscapeData || item.localImageData?.["cachedDetails.landscapeImage"] || item.localImageData?.["cachedDetails.backgroundImage"] || item.backdrop || item.cachedDetails?.landscapeImage || item.cachedDetails?.backgroundImage || thumb;
    const season = Number(episode?.season) || 0, number = Number(episode?.number) || 0;
    const code = isMovie ? (item.year ? String(item.year).slice(0, 4) : "MOVIE") : `S${String(season).padStart(2, "0")} | E${String(number).padStart(2, "0")}`;
    const title = episode?.title || "Next episode";
    const watchedIds = new Set((item.watchedEpisodeIds || []).map(String));
    const markId = episode?.id || "";
    const isWatched = watched || watchedIds.has(String(markId));
    const caughtUp = !upcoming && !isMovie && Boolean(episode && window.SplitAppLibrary.isUpcoming?.(episode));
    const cardOpen = `data-watchlist-open="${esc(item.id)}" role="link" tabindex="0" aria-label="Open details for ${esc(item.title)}${item.year ? ` (${esc(String(item.year).slice(0, 4))})` : ""}"`;
    const tag = `<button type="button" class="watchlist-series-tag" data-open-details data-id="${esc(item.id)}">${esc(item.title)}${item.year ? ` (${esc(String(item.year).slice(0, 4))})` : ""} ›</button>`;
    const airdate = episode?.airdate || item.releaseDate || "";
    const check = upcoming ? `<span class="watchlist-airdate">${esc(daysUntil(airdate))}</span>` : caughtUp ? `<button type="button" class="watchlist-caught-up" data-watchlist-caught-up aria-label="Caught up. This episode has not aired yet.">Caught up</button>` : isMovie ? `<button type="button" class="watchlist-check" data-watchlist-movie="${esc(item.id)}" aria-label="Mark ${esc(item.title)} watched">✓</button>` : `<button type="button" class="watchlist-check${isWatched ? " is-watched" : ""}" data-episode-toggle data-item-id="${esc(item.id)}" data-episode-id="${esc(markId)}" data-episode-title="${esc(`${code} ${title}`)}" data-watchlist-card="${esc(item.id)}" aria-label="${isWatched ? "Watched" : "Mark watched"}" aria-pressed="${isWatched}">✓</button>`;
    const episodeProgress = !isMovie ? window.SplitAppLibrary.episodeInfo(item) : null;
    const remaining = isMovie ? "" : ` +${Math.max(0, (episodeProgress?.total || 0) - (episodeProgress?.done || 0))}`;
    const fallback = `<span class="watchlist-art-fallback"><i data-lucide="${isMovie ? "clapperboard" : "tv"}" aria-hidden="true"></i></span>`;
    const art = imageMarkup
      ? imageMarkup(!episodeArt ? item : null, thumb, "", fallback)
      : thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">` : fallback;
    if (view === "posters") {
      const progressInfo = !isMovie ? window.SplitAppLibrary.episodeInfo(item) : null;
      const posterThumb = item.customCover || item.localThumbnailData || item.localPortraitData || item.image || "";
      const posterArt = imageMarkup
        ? imageMarkup(item, posterThumb, `${item.title} poster`, fallback)
        : posterThumb ? `<img src="${esc(posterThumb)}" alt="${esc(item.title)} poster" loading="lazy" decoding="async" onerror="this.hidden=true">` : fallback;
      const total = Number(progressInfo?.total) || Number(item.goal) || (isMovie ? Number(item.facts?.runtimeMinutes) : 0) || 0;
      const trackedDone = Math.max(Number(progressInfo?.done) || 0, Number(item.progress) || 0, watchedIds.size);
      const done = total ? Math.min(total, trackedDone) : trackedDone;
      const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0;
      const episodeLabel = !isMovie && episode
        ? `S${String(season).padStart(2, "0")} · E${String(number).padStart(2, "0")}`
        : isMovie ? (item.year ? String(item.year).slice(0, 4) : "MOVIE") : "EPISODES";
      const progressCount = isMovie
        ? total ? `${done} / ${total} min` : "Movie"
        : total ? `${done} / ${total} eps` : `${done} eps`;
      const progress = !upcoming ? `<span class="watchlist-poster-progress-count">${esc(progressCount)}</span><span class="watchlist-poster-progress"><i class="${percent >= 100 ? "is-done" : ""}" style="width:${percent}%"></i></span>` : "";
      const posterTitle = `<span class="watchlist-poster-title">${esc(item.title)}</span>`;
      const badge = `<span class="watchlist-poster-episode${upcoming ? " is-upcoming" : ""}">${esc(upcoming ? daysUntil(airdate) : episodeLabel)}</span>`;
      return `<article class="watchlist-card is-poster-view${upcoming ? " is-upcoming" : ""}" data-watchlist-root="${esc(item.id)}" ${cardOpen}><div class="watchlist-thumb">${posterArt}</div><span class="watchlist-poster-shade" aria-hidden="true"></span>${badge}${posterTitle}${progress}${check}</article>`;
    }
    if (view === "cards") {
      const progressInfo = !isMovie ? window.SplitAppLibrary.episodeInfo(item) : null;
      const total = Number(progressInfo?.total) || Number(item.goal) || 0;
      const done = Number(progressInfo?.done) || Number(item.progress) || 0;
      const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0;
      const remainingEpisodes = Math.max(0, total - done);
      const topLabel = upcoming ? daysUntil(airdate).toUpperCase() : `NEXT · ${code.replace(" | ", " · ")}`;
      const subtitle = upcoming ? (isMovie ? "Movie release" : title) : (isMovie ? "Ready to watch" : `${title} · ${done}/${total || "?"} watched`);
      const cardArt = landscape
        ? (imageMarkup ? imageMarkup(null, landscape, "", fallback, "watchlist-landscape-image") : `<img src="${esc(landscape)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">`)
        : art;
      return `<article class="watchlist-card is-card-view${upcoming ? " is-upcoming" : ""}" data-watchlist-root="${esc(item.id)}" ${cardOpen}><div class="watchlist-card-art">${cardArt}</div><div class="watchlist-card-shade"></div><div class="watchlist-card-top"><span>${esc(topLabel)}</span>${!isMovie && !upcoming ? `<small>${remainingEpisodes} eps left</small>` : ""}</div><div class="watchlist-card-copy"><strong>${esc(item.title)}</strong><span>${esc(subtitle)}</span></div>${check}<span class="watchlist-card-progress"><i style="width:${percent}%"></i></span></article>`;
    }
    return `<article class="watchlist-card${upcoming ? " is-upcoming" : ""}" data-watchlist-root="${esc(item.id)}" ${cardOpen}><div class="watchlist-thumb">${art}</div><div class="watchlist-copy">${tag}<strong>${esc(code)}${upcoming ? "" : remaining}</strong><span>${esc(isMovie && upcoming ? "Movie release" : title)}</span></div>${check}</article>`;
  }

  function watchlistPage(context, kind) {
    const { items = [], esc, roles = {}, watchlistTab = "watchlist", watchlistView = "list" } = context;
    const category = kind === "movie" ? "movie" : "series";
    const tab = watchlistTab === "upcoming" ? "upcoming" : "watchlist";
    const allRelevant = items.filter(item => item.category === category && (tab === "upcoming" || !isDone(item, roles)));
    const identityOf = item => `${String(item.title || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()}|${String(item.year || item.releaseDate || "").match(/(?:19|20)\d{2}/)?.[0] || ""}`;
    const progressCache = new WeakMap();
    const progressOf = item => {
      const cached = progressCache.get(item); if (cached) return cached;
      const info = item.category === "series" ? window.SplitAppLibrary.episodeInfo(item) : null;
      const watched = Math.max(0, Number(info?.done) || 0, Number(item.progress) || 0, (item.watchedEpisodeIds || []).length);
      const total = Math.max(0, Number(info?.total) || Number(item.goal) || Number(item.facts?.runtimeMinutes) || 0);
      const value = { watched, remaining: total ? Math.max(0, total - watched) : Infinity, ratio: total ? Math.min(1, watched / total) : 0, touched: Number(item.lastProgressAt) || stampOf(item) };
      progressCache.set(item, value); return value;
    };
    const progressOrder = (left, right) => {
      const a = progressOf(left), b = progressOf(right);
      if (!a.watched && !b.watched) return b.touched - a.touched;
      return (b.ratio - a.ratio) || (a.remaining - b.remaining) || (b.watched - a.watched) || (b.touched - a.touched);
    };
    const relevant = category === "series" ? [...allRelevant.reduce((groups, item) => { const key = identityOf(item), rows = groups.get(key) || []; rows.push(item); groups.set(key, rows); return groups; }, new Map()).values()].map(rows => rows.sort(progressOrder)[0]) : allRelevant;
    const sections = [];
    const appendSection = (heading, subset, renderCard) => {
      if (!subset.length) return;
      const key = `${kind}|${tab}|${heading}`, limit = watchlistVisible.get(key) || PAGE_BATCH, shown = subset.slice(0, limit);
      const more = subset.length > limit ? `<button type="button" class="watchlist-browse" data-watchlist-more="${esc(key)}">Show more · ${Math.min(limit, subset.length)} of ${subset.length}</button>` : "";
      sections.push(`<section class="watchlist-section"><h3>${esc(heading)}</h3>${shown.map(renderCard).join("")}${more}</section>`);
    };
    if (tab === "upcoming") {
      if (category === "series") {
        const upcoming = relevant.flatMap(item => {
          const watched = new Set((item.watchedEpisodeIds || []).map(String));
          const episode = (item.cachedDetails?.sections || []).filter(section => section.kind === "episodes").flatMap(section => section.items || []).filter(row => Boolean(window.SplitAppLibrary.isUpcoming?.(row)) && !watched.has(String(row.id))).sort((a, b) => episodeAirTime(a) - episodeAirTime(b))[0];
          return episode ? [{ item, episode }] : [];
        }).sort((a, b) => episodeAirTime(a.episode) - episodeAirTime(b.episode));
        appendSection("Upcoming episodes", upcoming, row => watchlistCard({ ...row, esc, roles, upcoming: true, view: watchlistView }));
      } else {
        const upcoming = relevant.filter(item => watchlistStatus(item, roles) && Date.parse(item.releaseDate || "") > Date.now()).sort((a, b) => Date.parse(a.releaseDate) - Date.parse(b.releaseDate));
        appendSection("Upcoming movies", upcoming, item => watchlistCard({ item, episode: { id: `movie:${item.id}`, season: 0, number: 0, title: item.releaseDate || item.year || "Upcoming", image: item.localThumbnailData || item.localPortraitData || item.customCover || item.image || "", airdate: item.releaseDate || item.year || "" }, esc, roles, upcoming: true, view: watchlistView }));
      }
    } else {
      const rows = category === "series" ? relevant.map(item => ({ item, info: window.SplitAppLibrary.episodeInfo(item) })).filter(row => row.info?.next && episodeAirTime(row.info.next) <= Date.now() && !isDone(row.item, roles)) : relevant.filter(item => !isDone(item, roles) && (watchlistStatus(item, roles) || activeStatus(item, roles) || holdStatus(item, roles)));
      const started = category === "series"
        ? rows.filter(row => Number(row.info.done) > 0 || Number(row.item.progress) > 0 || activeStatus(row.item, roles)).sort((a, b) => progressOrder(a.item, b.item))
        : rows.filter(item => Number(item.progress) > 0 || activeStatus(item, roles)).sort(progressOrder);
      const queued = category === "series"
        ? rows.filter(row => (Number(row.info.done) || 0) <= 0 && (Number(row.item.progress) || 0) <= 0 && (watchlistStatus(row.item, roles) || holdStatus(row.item, roles))).sort((a, b) => stampOf(b.item) - stampOf(a.item))
        : rows.filter(item => (Number(item.progress) || 0) <= 0 && (watchlistStatus(item, roles) || holdStatus(item, roles))).sort((a, b) => stampOf(b) - stampOf(a));
      const stale = category === "series" ? rows.filter(row => (activeStatus(row.item, roles) || holdStatus(row.item, roles)) && agoLong(row.item)).sort((a, b) => stampOf(b.item) - stampOf(a.item)) : rows.filter(item => (activeStatus(item, roles) || holdStatus(item, roles)) && agoLong(item)).sort((a, b) => stampOf(b) - stampOf(a));
      const rested = new Set(stale.map(row => category === "series" ? row.item.id : row.id));
      const current = started.filter(row => !rested.has(category === "series" ? row.item.id : row.id));
      const onHold = category === "series" ? rows.filter(row => (Number(row.info.done) || 0) <= 0 && (Number(row.item.progress) || 0) <= 0 && holdStatus(row.item, roles) && !agoLong(row.item)).sort((a, b) => stampOf(b.item) - stampOf(a.item)) : rows.filter(item => (Number(item.progress) || 0) <= 0 && holdStatus(item, roles) && !agoLong(item)).sort((a, b) => stampOf(b) - stampOf(a));
      const asCard = row => category === "series" ? watchlistCard({ item: row.item, episode: row.info.next, esc, roles, view: watchlistView }) : watchlistCard({ item: row, episode: { title: "Ready to watch", image: row.localThumbnailData || row.customCover || row.image || "" }, esc, roles, view: watchlistView });
      const addSection = (heading, subset) => appendSection(heading, subset, asCard);
      const itemOf = row => category === "series" ? row.item : row;
      const notStarted = [...queued, ...onHold].sort((a, b) => stampOf(itemOf(b)) - stampOf(itemOf(a))).slice(0, 30);
      const watching = [...current].sort((a, b) => progressOf(itemOf(b)).touched - progressOf(itemOf(a)).touched).slice(0, 50);
      addSection("Watching", watching); addSection("Not started yet", notStarted); addSection("Haven't watched for a long time", stale.slice(0, 20));
    }
    const hasRows = sections.length > 0;
    const empty = `<div class="watchlist-empty"><span class="watchlist-empty-illustration"><i data-lucide="${category === "series" ? "tv" : "popcorn"}" aria-hidden="true"></i></span><h2>${tab === "upcoming" ? `No upcoming ${category === "series" ? "episodes" : "movies"} yet` : "Your watchlist is empty!"}</h2><p>${tab === "upcoming" ? "Upcoming titles with a known release date will appear here." : `Add ${category === "series" ? "shows" : "movies"} you want to watch.`}</p><button type="button" data-go="discover">Discover ${category === "series" ? "shows" : "movies"}</button></div>`;
    const loading = context.libraryLoading && !items.length
      ? `<div class="watchlist-loading-skeleton is-${esc(watchlistView)}" role="status" aria-label="Loading library">${Array.from({ length: watchlistView === "posters" ? 6 : 3 }, () => `<span aria-hidden="true"></span>`).join("")}</div>`
      : empty;
    const viewOrder = ["list", "posters", "cards"], viewIndex = Math.max(0, viewOrder.indexOf(watchlistView)), currentView = viewOrder[viewIndex];
    const viewIcon = currentView === "list" ? "list" : currentView === "posters" ? "layout-grid" : "rectangle-horizontal";
    const viewLabel = currentView === "list" ? "List" : currentView === "posters" ? "Posters" : "Cards";
    const viewToggle = `<button type="button" class="watchlist-view-toggle" data-watchlist-view aria-label="Current view: ${viewLabel}. Tap to change view" title="${viewLabel} view · tap to cycle"><i data-lucide="${viewIcon}" aria-hidden="true"></i></button>`;
    if (hasRows) {
      const firstSection = sections.findIndex(section => section.includes("<h3>"));
      if (firstSection >= 0) sections[firstSection] = sections[firstSection].replace(/<h3>(.*?)<\/h3>/, '<div class="watchlist-section-heading"><span class="watchlist-section-heading-spacer" aria-hidden="true"></span><h3>$1</h3>' + viewToggle + '</div>');
    }
    return `<section class="watchlist-page${hasRows ? "" : " is-empty"}"><header class="watchlist-tabs" role="tablist"><button type="button" class="${tab === "watchlist" ? "active" : ""}" data-watchlist-tab="watchlist" role="tab" aria-selected="${tab === "watchlist"}">Watchlist</button><button type="button" class="${tab === "upcoming" ? "active" : ""}" data-watchlist-tab="upcoming" role="tab" aria-selected="${tab === "upcoming"}">Upcoming</button></header><main class="watchlist-content${hasRows ? ` is-${currentView}` : " is-empty"}">${hasRows ? sections.join("") : loading}</main>${hasRows && tab === "watchlist" && category === "series" ? `<button type="button" class="watchlist-browse" data-go="series">Browse all shows</button>` : hasRows && tab === "watchlist" && category === "movie" ? `<button type="button" class="watchlist-browse" data-go="movies">Browse all movies</button>` : ""}</section>`;
  }

  window.SplitAppPages.watchlistCard = watchlistCard;
  window.SplitAppPages.loadMoreCollection = key => { const query = String(key || collectionQueryKey); collectionVisible.set(query, (collectionVisible.get(query) || PAGE_BATCH) + PAGE_BATCH); return true; };
  window.SplitAppPages.loadMoreWatchlist = key => { watchlistVisible.set(String(key), (watchlistVisible.get(String(key)) || PAGE_BATCH) + PAGE_BATCH); return true; };

  window.SplitAppPages.profile = profilePage;
  window.SplitAppPages["profile-cover"] = profileCoverPage;
  window.SplitAppPages.moreCovers = kind => { pickerLimit[kind] = (pickerLimit[kind] || 18) + 24; };
  window.SplitAppPages.setCoverTab = tab => { coverTab = tab === "cover" ? "cover" : "avatar"; };
  window.SplitAppPages.shuffleProfileCover = (items, prefs, kind = "cover") => { pickFor(kind === "avatar" ? "avatar" : "cover", items, prefs, true); };
  window.SplitAppPages.series = context => collectionPage(context, "series");
  window.SplitAppPages.movies = context => collectionPage(context, "movie");
  window.SplitAppPages["series-favorites"] = context => collectionPage(context, "series", true);
  window.SplitAppPages["movie-favorites"] = context => collectionPage(context, "movie", true);
  window.SplitAppPages["series-watchlist"] = context => watchlistPage(context, "series");
  window.SplitAppPages["movie-watchlist"] = context => watchlistPage(context, "movie");
})();
