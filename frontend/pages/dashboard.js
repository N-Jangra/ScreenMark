// Dashboard page template for this app.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.dashboard = context => {
    const { config, esc, libraryQuery, dashboardStatusFilter = "all", prefs, category, labelCategory, roles, activeCategory = "all" } = context;
    const { dashboardItems } = window.SplitAppLibrary.create(context);
    const view = prefs.dashboardView || "list";
    const statusOrder = [roles.active, roles.queued, roles.done, roles.hold, roles.dropped];
    const statuses = [...statusOrder.filter(status => config.categories[0]?.statuses?.includes(status)), ...(config.categories[0]?.statuses || []).filter(status => !statusOrder.includes(status))];
    const allCount = dashboardItems(null, libraryQuery).length;
    const favoriteCount = context.items.filter(item => item.favorite && (activeCategory === "all" || item.category === activeCategory)).length;
    const views = [["list", "List"], ["grid", "Posters"], ["posters-plus", "Posters+"], ["compact-grid", "Compact grid"], ["large-grid", "Large poster grid"]];
    
    const sortList = [["updated-desc", "Recently updated"], ["created-desc", "Recently added"], ["progress-desc", "Most progress"], ["progress-asc", "Least progress"], ["release-desc", "Newest release"], ["alphabetical-asc", "Title A–Z"], ["alphabetical-desc", "Title Z–A"]];
    const pillList = (name, options, current, extra = "") => `<div class="ios-pills ${extra}"><input type="hidden" name="${name}" value="${esc(current)}">${options.map(([key, label]) => `<button type="button" class="ios-pill${String(current) === String(key) ? " active" : ""}" data-pill-name="${name}" data-pill-value="${esc(key)}" aria-pressed="${String(current) === String(key)}">${esc(label)}</button>`).join("")}</div>`;
    const sheetCard = (title, body) => `<section class="ios-card"><span class="ios-label">${title}</span>${body}</section>`;
    const row = (label, body) => `<div class="ios-row"><span>${label}</span>${body}</div>`;
    const groupList = [["status", "Status"], ["category", "Category"], ["release", "Release"], ["none", "None"]];
    const emptyMessage = libraryQuery ? `No matching ${config.nounPlural || "titles"} found.` : "Your collection is empty.";
    const episodeInfo = window.SplitAppLibrary.episodeInfo;
    const showExtras = !libraryQuery && !prefs.favoritesOnly && dashboardStatusFilter === "all" && (activeCategory === "all" || activeCategory === "series");
    const seriesInfo = showExtras ? context.items.filter(item => item.category === "series").map(item => ({ item, info: episodeInfo(item) })).filter(row => row.info && row.info.next).sort((a, b) => (Number(b.item.updatedAt) || 0) - (Number(a.item.updatedAt) || 0)).slice(0, 12) : [];
    const upNextHtml = seriesInfo.length ? `<section class="demo-up-next"><header class="demo-section-heading"><span>Up next queue <b>${seriesInfo.length}</b></span><small>Tap ✓ to check in +1 episode</small></header><div class="demo-up-next-rail">${seriesInfo.map(({ item, info }) => { const art = item.backdrop || item.localThumbnailData || item.image || ""; const percent = info.total ? Math.round(info.done / info.total * 100) : 0; const left = Math.max(0, info.total - info.done); return `<article class="demo-up-next-card"${art ? ` style="--demo-card-image:url('${esc(art)}')"` : ""}><span class="demo-episode-code">NEXT · ${esc(info.mark(info.next))}</span><span class="demo-left-pill">${left} ep${left === 1 ? "" : "s"} left</span><button class="demo-up-next-open" type="button" data-action="details" data-id="${esc(item.id)}" aria-label="Open ${esc(item.title)}"><span class="demo-up-next-copy"><strong>${esc(item.title)}</strong><small>${info.next.title ? `“${esc(info.next.title)}” · ` : ""}${info.done}/${info.total} watched</small></span></button><button class="demo-check-in" type="button" data-action="watch-next" data-id="${esc(item.id)}" aria-label="Mark ${esc(info.mark(info.next))} watched">✓</button><span class="demo-up-next-progress"><i style="width:${percent}%"></i></span></article>`; }).join("")}</div></section>` : "";
    const wallItems = dashboardItems(dashboardStatusFilter === "all" ? null : dashboardStatusFilter, libraryQuery);
    const poster = item => {
      const image = item.customCover || item.localThumbnailData || item.image || "";
      const localPending = !image && Boolean(item.thumbnailPath);
      const art = image
        ? `<img src="${esc(image)}" alt="${esc(item.title)} poster" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${esc(category(item.category)?.icon || "✦")}</span>`
        : localPending
          ? `<img data-deferred-image data-lazy-src="${esc(item.image || "")}" data-local-item-id="${esc(item.id)}"${item.customCover ? ` data-custom-cover="${esc(item.customCover)}"` : ""} alt="${esc(item.title)} poster" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span>${esc(category(item.category)?.icon || "✦")}</span>`
          : `<span>${esc(category(item.category)?.icon || "✦")}</span>`;
      const goal = Math.max(0, Number(item.goal) || 0), progress = Math.max(0, Number(item.progress) || 0), percent = goal ? Math.min(100, Math.round(progress / goal * 100)) : 0;
      const info = item.category === "series" ? episodeInfo(item) : null;
      const lastDone = info ? [...info.eps].reverse().find(entry => info.watched.has(String(entry.id))) : null;
      const badge = info ? info.mark(lastDone || info.eps[0] || info.next || {}) : labelCategory(item.category);
      const left = info ? `${info.done}/${info.total} ep` : (item.year || labelCategory(item.category));
      const titleMeta = `<strong class="demo-poster-title">${esc(item.title)}</strong><span class="demo-poster-meta"><span>${esc(left)}</span></span>`;
      const progressBar = `<span class="demo-poster-progress"><i class="${percent >= 100 ? "is-done" : ""}" style="width:${percent}%"></i></span>`;
      return `<article class="demo-poster-tile" data-item="${esc(item.id)}"><button class="demo-poster-open" type="button" data-action="details" data-id="${esc(item.id)}" aria-label="Open ${esc(item.title)}"><span class="demo-poster-art">${art}<span class="demo-poster-kind">${esc(badge || labelCategory(item.category))}</span>${item.favorite ? `<span class="demo-poster-favorite" aria-label="Favorite">♥</span>` : ""}${view === "list" ? "" : progressBar}</span>${view === "posters-plus" ? `<span class="demo-poster-accessible-title">${esc(item.title)}</span>` : titleMeta}</button>${view === "list" ? `<span class="demo-list-progress">${progressBar}</span>` : ""}</article>`;
    };
    const collectionTitle = activeCategory === "all" ? "Your collection" : `Your ${labelCategory(activeCategory).toLowerCase()} collection`;
    return `<section class="demo-home-page">
      ${upNextHtml}
      <div class="demo-home-controls"><label class="demo-search"><i data-lucide="search" aria-hidden="true"></i><input id="global-search" type="search" placeholder="Filter collection (Breaking Bad, FROM, Naruto…)" value="${esc(libraryQuery)}" autocomplete="off" aria-label="Search your collection"><button type="button" data-clear-collection-search aria-label="Clear search" ${libraryQuery ? "" : "hidden"}>×</button></label><button type="button" class="demo-tool-button demo-filter-button" data-open-dashboard-filter aria-label="Filter titles"><i data-lucide="sliders-horizontal" aria-hidden="true"></i></button></div>
      <div class="demo-collection-pills" role="group" aria-label="Filter by status"><button type="button" class="demo-filter-pill${dashboardStatusFilter === "all" && !prefs.favoritesOnly ? " active" : ""}" data-quick-status="all" aria-pressed="${dashboardStatusFilter === "all" && !prefs.favoritesOnly}">All (${allCount})</button><button type="button" class="demo-filter-pill${prefs.favoritesOnly ? " active" : ""}" data-favorites-filter aria-pressed="${Boolean(prefs.favoritesOnly)}">♥ Favorites (${favoriteCount})</button>${statuses.map(status => `<button type="button" class="demo-filter-pill${dashboardStatusFilter === status ? " active" : ""}" data-quick-status="${esc(status)}" aria-pressed="${dashboardStatusFilter === status}">${esc(status)} (${dashboardItems(status, libraryQuery).length})</button>`).join("")}</div>
      <div class="demo-collection-heading"><span>${esc(collectionTitle)} <b>${wallItems.length}</b></span><span class="demo-heading-tools"><button type="button" data-share-all aria-label="Share list"><i data-lucide="share-2" aria-hidden="true"></i>Share</button></span></div>
      <div id="collection-results" class="demo-poster-wall" data-view="${esc(view)}">${wallItems.length ? wallItems.map(poster).join("") : `<div class="demo-empty"><strong>${esc(emptyMessage)}</strong><span>Add a movie or series to get started.</span></div>`}</div>
      <dialog class="choice-dialog dashboard-filter-dialog" id="dashboard-filter-dialog"><form id="dashboard-filter-form"><div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">COLLECTION</p><h2>Filter titles</h2></div><button type="button" class="choice-dialog-close" data-close-dashboard-filter aria-label="Close">×</button></header><div class="ios-sheet-body">${sheetCard("Sort By", pillList("sort", sortList, prefs.dashboardSort))}${sheetCard("View &amp; Layout", `${row("Layout", "")}${pillList("view", views, view)}${row("Group by", "")}${pillList("groupBy", groupList, prefs.dashboardGroupBy || "status", "segmented")}`)}</div><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-reset-dashboard-filter>Clear filters</button><button type="submit" class="button primary">Apply filter</button></footer></form></dialog>
    </section>`;
  };
})();
