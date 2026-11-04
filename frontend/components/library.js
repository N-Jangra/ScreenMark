// Shared library card and category components used by Dashboard and Search.
(() => {
  // Episode progress for a series whose episode guide is saved with it (next unwatched, last watched, counts).
  const episodeInfo = item => {
    const section = (item?.cachedDetails?.sections || []).find(entry => entry.kind === "episodes");
    const eps = (section?.items || []).filter(entry => entry.number).sort((a, b) => a.season - b.season || a.number - b.number);
    if (!eps.length) return null;
    const watched = new Set((item.watchedEpisodeIds || []).map(String));
    const mark = entry => `S${entry.season} · E${entry.number}`;
    return { eps, watched, total: eps.length, done: eps.filter(entry => watched.has(String(entry.id))).length, next: eps.find(entry => !watched.has(String(entry.id))), last: [...eps].reverse().find(entry => watched.has(String(entry.id))), mark };
  };
  // One shared collator: String.localeCompare with options builds a new one per call, which dominates sorting 1000+ titles.
  const titleCollator = new Intl.Collator(undefined, { sensitivity: "base" });
  window.SplitAppLibrary = Object.freeze({
    episodeInfo,
    create(context) {
      const { prefs, items, activeCategory, category, labelCategory, esc } = context;
      return { card, filteredItems, listOrEmpty, dashboardItems };
  function card(item) {
    const cat = category(item.category), progress = Math.max(0, Number(item.progress) || 0), goal = Math.max(0, Number(item.goal) || 0);
    const percent = goal ? Math.min(100, Math.round(progress / goal * 100)) : 0;
    const rating = item.rating ? `★ ${esc(item.rating)}${prefs.ratingFormat === "10-point" ? "/10" : "/5"}` : "";
    const thumbnail = item.localThumbnailData || item.image;
    // Covers saved on this device load via the artwork cache (see app.js); others straight from their URL.
    const localPending = !item.localThumbnailData && Boolean(item.thumbnailPath);
    const fallbackIcon = `<span${thumbnail || localPending ? " hidden" : ""}>${esc(cat?.icon || "✦")}</span>`;
    const art = prefs.showThumbnails && (thumbnail || localPending)
      ? (localPending
        ? `<img data-deferred-image data-lazy-src="${esc(item.image || "")}" data-local-item-id="${esc(item.id)}" alt="" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${fallbackIcon}`
        : `<img src="${esc(thumbnail)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${fallbackIcon}`)
      : `<span>${esc(cat?.icon || "✦")}</span>`;
    const accent = prefs.categoryColors[item.category] || cat?.color || prefs.mainColor;
    const info = item.category === "series" ? episodeInfo(item) : null;
    const check = info?.next ? `<button type="button" class="card-check" data-action="watch-next" data-id="${esc(item.id)}" aria-label="Mark ${esc(info.mark(info.next))} watched" title="Mark ${esc(info.mark(info.next))} watched">✓</button>` : "";
    const actions = check + (prefs.dashboardRowActions === "quick"
      ? `<button data-action="progress" data-id="${esc(item.id)}" aria-label="Add progress" title="Add progress">＋</button>`
      : `<button type="button" class="card-menu-button" data-open-item-actions="${esc(item.id)}" aria-label="Title actions" title="Title actions">⋮</button>`);
    return `<article class="item-card dashboard-card" data-item="${esc(item.id)}" style="--item-accent:${esc(accent)}"><div class="item-art">${art}</div><div class="item-copy"><h3><button class="item-title-link" data-open-details data-action="details" data-id="${esc(item.id)}">${esc(item.title)}</button>${item.favorite ? `<span class="card-heart" title="Favorite" aria-label="Favorite">♥</span>` : ""}</h3><div class="item-meta">${rating && prefs.showRatings ? `<span class="item-rating">${rating}</span>` : ""}<span class="status-pill">${esc(item.status)}</span>${goal && prefs.showProgress ? `<span class="muted">${info?.last ? `${esc(info.mark(info.last))} watched · ${Math.max(0, info.total - info.done)} eps left` : `${progress}/${goal} ${esc(cat?.unit || "")}`}</span>` : ""}</div>${goal && prefs.showProgress ? `<div class="progress-line"><span style="width:${percent}%"></span></div>` : ""}</div><div class="card-actions">${actions}</div></article>`;
  }
  function filteredItems(query = "") {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter(item => (activeCategory === "all" || item.category === activeCategory) && (!prefs.favoritesOnly || item.favorite) && (!normalized || `${item.title} ${item.status}`.toLocaleLowerCase().includes(normalized)));
  }
  function dashboardItems(status, query = "") {
    const compareTitle = (left, right) => titleCollator.compare(String(left.title || ""), String(right.title || ""));
    return filteredItems(query).filter(item => !status || item.status === status).sort((left, right) => {
      switch (prefs.dashboardSort) {
        case "recent": case "recently-added": case "created-desc": return (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0) || compareTitle(left, right);
        case "recently-updated": case "updated-desc": return (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0) || compareTitle(left, right);
        case "rating": case "highest-rated": case "rating-desc": return (Number(right.rating) || 0) - (Number(left.rating) || 0) || compareTitle(left, right);
        case "most-progress": case "progress-desc": return (Number(right.progress) || 0) - (Number(left.progress) || 0) || compareTitle(left, right);
        case "least-progress": case "progress-asc": return (Number(left.progress) || 0) - (Number(right.progress) || 0) || compareTitle(left, right);
        case "newest-release": case "release-desc": return (Number(right.year) || 0) - (Number(left.year) || 0) || compareTitle(left, right);
        case "title-desc": case "alphabetical-desc": return compareTitle(right, left);
        case "alphabetical-asc": return compareTitle(left, right);
        default: return compareTitle(left, right);
      }
    });
  }
  function listOrEmpty(list, message = "Nothing here yet.") {
    return list.length ? `<div class="item-list">${list.map(card).join("")}</div>` : `<div class="empty-state"><strong>${esc(message)}</strong><span>Add something to get started.</span></div>`;
  }
    }
  });
})();
