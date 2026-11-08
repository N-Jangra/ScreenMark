// Statistics overview and activity sub-page.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  const renderStatistics = context => {
    const { items: allItems, history: allHistory, config, prefs = {}, esc, roles, statsRange = "week", statsCategory = "series", statsSubpage = "", statsActivityDate = "" } = context;
    const scopeCategory = statsCategory === "movie" ? "movie" : "series";
    const scoped = statsSubpage === "activity";
    const items = scoped ? allItems.filter(item => item.category === scopeCategory) : allItems;
    const scopedIds = new Set(items.map(item => String(item.id)));
    const history = scoped ? allHistory.filter(entry => scopedIds.has(String(entry.itemId))) : [];
    const statisticsBack = `<button type="button" class="detail-back" data-go="profile"><span aria-hidden="true">‹</span> Profile</button>`;
    const nounPlural = config.nounPlural || "titles";
    const total = items.length;
    const unitOf = item => config.categories.find(category => category.key === item.category)?.unit || "minutes";
    const runtimeOf = item => Number(item.facts?.runtimeMinutes) || 0;
    const episodesOf = item => Number(item.facts?.episodeCount) || (unitOf(item) === "episodes" ? Number(item.goal) || 0 : 0);
    const totalOf = item => Number(item.facts?.totalMinutes) || (unitOf(item) === "minutes" ? runtimeOf(item) : episodesOf(item) * runtimeOf(item));
    const watchedOf = item => item.status === roles.done ? totalOf(item) : unitOf(item) === "minutes" ? Math.min(Number(item.progress) || 0, totalOf(item) || Infinity) : (Number(item.progress) || 0) * runtimeOf(item);
    const durText = minutes => { const m = Math.round(minutes); if (m <= 0) return "0 h"; if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return h >= 100 || !r ? `${h} h` : `${h}h ${r}m`; };
    // ---- Activity
    const month = statsRange === "month", rangeDays = month ? 30 : 7;
    const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const historyTime = entry => Number(entry.at) || Date.parse(entry.at) || 0;
    const stamps = new Map(history.map(entry => [entry, historyTime(entry)]));
    const timeOf = entry => stamps.get(entry) ?? historyTime(entry);
    const dayStarts = Array.from({ length: rangeDays }, (_, offset) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (rangeDays - 1 - offset)); return date; });
    const dayCounts = dayStarts.map(() => 0);
    const firstDay = dayStarts[0].getTime(), lastEnd = new Date(dayStarts[rangeDays - 1].getTime() + 36 * 3600000); lastEnd.setHours(0, 0, 0, 0);
    stamps.forEach(at => { if (at < firstDay || at >= lastEnd.getTime()) return; for (let index = rangeDays - 1; index >= 0; index -= 1) { if (at >= dayStarts[index].getTime()) { dayCounts[index] += 1; break; } } });
    const activityDays = dayStarts.map((date, index) => ({ date, key: dayKey(date), count: dayCounts[index] }));
    const maxActivity = Math.max(1, ...activityDays.map(day => day.count));
    const activityTotal = activityDays.reduce((sum, day) => sum + day.count, 0);
    const selectedDay = activityDays.find(day => day.key === statsActivityDate) || [...activityDays].reverse().find(day => day.count) || activityDays.at(-1);
    const dayEvents = selectedDay ? history.filter(entry => { const at = timeOf(entry), start = selectedDay.date.getTime(); return at >= start && at < start + 86400000; }).sort((a, b) => timeOf(b) - timeOf(a)) : [];
    const activityBars = activityDays.map((day, index) => {
      const label = month ? `${day.date.getDate()}` : day.date.toLocaleDateString(undefined, { weekday: "short" });
      const sub = month && (index === 0 || day.date.getDate() === 1) ? `<em>${esc(day.date.toLocaleDateString(undefined, { month: "short" }))}</em>` : "";
      const dayLabel = day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      const selected = selectedDay?.key === day.key;
      return `<button type="button" class="stats-activity-day${day.count ? " has-data" : " is-empty"}${selected ? " selected" : ""}" data-stats-activity-date="${day.key}" aria-pressed="${selected}" aria-label="${esc(dayLabel)}: ${day.count} ${day.count === 1 ? "update" : "updates"}" title="${esc(dayLabel)}: ${day.count} ${day.count === 1 ? "update" : "updates"}"><b class="stats-activity-count">${day.count}</b><span class="stats-activity-track"><i style="height:${day.count ? Math.max(8, day.count / maxActivity * 100) : 0}%"></i></span><small>${esc(label)}${sub}</small></button>`;
    }).join("");
    const rangeSwitch = `<div class="ios-pills segmented stats-range" role="group" aria-label="Activity range"><button type="button" class="ios-pill${month ? "" : " active"}" data-stats-range="week" aria-pressed="${!month}">Week</button><button type="button" class="ios-pill${month ? " active" : ""}" data-stats-range="month" aria-pressed="${month}">Month</button></div>`;
    const byId = new Map(items.map(row => [String(row.id), row]));
    const eventRows = dayEvents.map(entry => {
      const item = byId.get(String(entry.itemId));
      const stamp = timeOf(entry) ? new Date(timeOf(entry)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
      const content = `<span class="stats-activity-entry-icon"><i data-lucide="${String(entry.status || entry.action) === roles.done ? "circle-check" : "activity"}" aria-hidden="true"></i></span><span class="stats-activity-entry-copy"><strong>${esc(entry.title || item?.title || "Library update")}</strong><small>${esc(entry.action || entry.status || "Updated")}${stamp ? ` · ${esc(stamp)}` : ""}</small></span><span class="stats-activity-entry-status">${esc(entry.status || entry.action || "")}</span>`;
      return item ? `<button type="button" class="stats-activity-entry" data-open-details data-id="${esc(item.id)}">${content}</button>` : `<div class="stats-activity-entry">${content}</div>`;
    }).join("");
    const selectedDayLabel = selectedDay?.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) || "No date selected";
    const activityPanel = `<article class="stats-panel stats-activity-panel"><div class="stats-activity-chart stats-activity-chart-${month ? "month" : "week"}">${activityBars}</div><div class="stats-activity-summary"><span>${activityTotal} ${activityTotal === 1 ? "update" : "updates"} in this period</span><span>${history.length} total ${history.length === 1 ? "update" : "updates"}</span></div><p class="stats-activity-day-note"><strong>${esc(selectedDayLabel)}</strong><span>${dayEvents.length} ${dayEvents.length === 1 ? "change" : "changes"} · Tap a bar to inspect another day.</span></p></article><article class="stats-panel stats-activity-feed"><header class="stats-panel-heading"><div><span class="stats-eyebrow">SELECTED DAY</span><h3>Recent updates</h3></div><span class="stats-total-chip">${dayEvents.length} events</span></header>${eventRows || `<p class="stats-empty-copy">No library changes on this day. Select another bar to review its activity.</p>`}<button type="button" class="button secondary small" data-go="timeline">Open full timeline <span aria-hidden="true">→</span></button></article>`;

    // ---- Overview
    const mediaCategory = statsCategory === "movie" ? "movie" : "series";
    const mediaItems = items.filter(item => item.category === mediaCategory);
    const isShowStats = mediaCategory === "series";
    const mediaPlural = isShowStats ? "shows" : "movies";
    const mediaCompleted = mediaItems.filter(item => item.status === roles.done).length;
    const mediaWatching = mediaItems.filter(item => item.status === roles.active).length;
    const mediaWatchedMinutes = mediaItems.reduce((sum, item) => sum + Math.min(watchedOf(item), totalOf(item) || Infinity), 0);
    const episodeProgress = item => {
      const totalEpisodes = episodesOf(item);
      const checkedCount = Array.isArray(item.watchedEpisodeIds) ? item.watchedEpisodeIds.length : 0;
      return item.status === roles.done ? totalEpisodes || Number(item.progress) || checkedCount : Math.max(Number(item.progress) || 0, checkedCount);
    };
    const mediaEpisodesWatched = isShowStats ? mediaItems.reduce((sum, item) => sum + episodeProgress(item), 0) : 0;
    const mediaTimeRows = mediaItems.map(item => ({ item, value: Math.round(Math.min(watchedOf(item), totalOf(item) || Infinity) / 60) })).filter(row => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 7);
    const mediaEpisodeRows = mediaItems.map(item => ({ item, value: episodeProgress(item) })).filter(row => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 7);
    const mediaMovieRows = mediaItems.filter(item => item.status === roles.done).map(item => ({ item, value: Math.round(runtimeOf(item) / 60) })).sort((a, b) => b.value - a.value).slice(0, 7);
    const chartMarkup = (rows, unit) => {
      if (!rows.length) return `<p class="stats-reference-empty">${isShowStats ? "Episode progress and runtime details will appear here as you track your shows." : "Completed movies with runtime details will appear here."}</p>`;
      const maximum = rows.reduce((max, row) => Math.max(max, Number(row.value) || 0), 0);
      return `<div class="stats-reference-chart"><div class="stats-reference-bars">${rows.map(({ item, value }) => `<div class="stats-reference-bar"><b>${value}</b><span><i style="height:${Math.max(5, maximum ? value / maximum * 100 : 0)}%"></i></span><small title="${esc(item.title)}">${esc(item.title)}</small></div>`).join("")}</div><p>${unit}</p></div>`;
    };
    const bigNumberCard = (title, value, caption) => `<article class="stats-reference-card stats-reference-number"><h2>${title}</h2><strong>${value}</strong><p>${caption}</p></article>`;
    const tableCard = (title, leftHeading, rightHeading, rows, emptyText) => `<article class="stats-reference-card stats-reference-table-card"><h2>${title}</h2><div class="stats-reference-table"><div class="stats-reference-table-head"><span>${leftHeading}</span><span>${rightHeading}</span></div>${rows || `<p class="stats-reference-empty">${emptyText}</p>`}</div></article>`;
    const byGenre = new Map();
    mediaItems.forEach(item => {
      const fieldGenres = item.cachedDetails?.fields?.find(field => /^(genres?|genre)$/i.test(String(field.label || "").trim()))?.value;
      const raw = item.facts?.genres || fieldGenres || item.cachedDetails?.genres || [];
      const values = Array.isArray(raw) ? raw : String(raw || "").split(/[,;/|]/);
      [...new Set(values.map(value => String(value?.name || value).trim()).filter(Boolean))].forEach(genre => byGenre.set(genre, (byGenre.get(genre) || 0) + 1));
    });
    const mediaGenreRows = [...byGenre.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name, count]) => `<div class="stats-reference-table-row"><span>${esc(name)}</span><span>${count}</span></div>`).join("");
    const networkCounts = new Map();
    mediaItems.forEach(item => {
      const field = item.cachedDetails?.fields?.find(entry => /(network|studio|production company|broadcaster|distributor)/i.test(String(entry.label || "")))?.value;
      const raw = item.facts?.network || item.facts?.studio || field || "";
      (Array.isArray(raw) ? raw : String(raw).split(/[,;/|]/)).map(value => String(value?.name || value).trim()).filter(Boolean).forEach(name => networkCounts.set(name, (networkCounts.get(name) || 0) + 1));
    });
    const networkRows = [...networkCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name, count]) => `<div class="stats-reference-table-row"><span>${esc(name)}</span><span>${count}</span></div>`).join("");
    const marathonItems = isShowStats
      ? [...mediaItems].sort((a, b) => episodeProgress(b) - episodeProgress(a)).filter(item => episodeProgress(item) > 0).slice(0, 3)
      : [...mediaItems].filter(item => item.status === roles.done).sort((a, b) => runtimeOf(b) - runtimeOf(a)).slice(0, 3);
    const marathonRows = marathonItems.map(item => `<button type="button" class="stats-reference-table-row${isShowStats ? " stats-reference-marathon-row" : ""}" data-open-details data-id="${esc(item.id)}"><span>${esc(item.title)}</span><span>${isShowStats ? episodeProgress(item) : durText(runtimeOf(item))}</span>${isShowStats ? `<span>${durText(Math.min(watchedOf(item), totalOf(item) || Infinity))}</span>` : ""}</button>`).join("");
    const marathonPanel = isShowStats
      ? `<article class="stats-reference-card stats-reference-table-card"><h2>Biggest marathons</h2><div class="stats-reference-table stats-reference-marathon-table"><div class="stats-reference-table-head"><span>SHOW</span><span>EPISODES</span><span>HOURS</span></div>${marathonRows || `<p class="stats-reference-empty">Add shows and track episodes to build this list.</p>`}</div></article>`
      : tableCard("Longest movies watched", "MOVIE", "RUNTIME", marathonRows, "Completed movies with runtime details will appear here.");
    const topChartRows = isShowStats ? mediaTimeRows : mediaMovieRows;
    const topChartTitle = isShowStats ? "Time spent watching episodes" : "Time spent watching movies";
    const lowerChartTitle = isShowStats ? "Episodes watched" : "Completed movies";
    const lowerChartRows = isShowStats ? mediaEpisodeRows : mediaMovieRows;
    const mediaTabs = `<nav class="stats-media-tabs" role="tablist" aria-label="Statistics category"><button type="button" role="tab" aria-selected="${isShowStats}" class="${isShowStats ? "active" : ""}" data-stats-category="series">Shows</button><button type="button" role="tab" aria-selected="${!isShowStats}" class="${!isShowStats ? "active" : ""}" data-stats-category="movie">Movies</button></nav>`;
    const statsBoard = `<div class="stats-reference-board"><article class="stats-reference-card stats-reference-chart-card"><h2>${topChartTitle}</h2>${chartMarkup(topChartRows, isShowStats ? "HOURS BY SHOW" : "HOURS BY MOVIE")}</article>${bigNumberCard(isShowStats ? "Total episodes watched" : "Movies watched", isShowStats ? mediaEpisodesWatched.toLocaleString() : mediaCompleted.toLocaleString(), isShowStats ? `Across ${mediaItems.length} ${mediaPlural}` : `Completed from ${mediaItems.length} saved ${mediaPlural}`)}<article class="stats-reference-card stats-reference-chart-card"><h2>${lowerChartTitle}</h2>${chartMarkup(lowerChartRows, isShowStats ? "EPISODES BY SHOW" : "HOURS BY MOVIE")}</article>${marathonPanel}${bigNumberCard(`Added ${mediaPlural}`, mediaItems.length.toLocaleString(), `${mediaWatching} currently ${isShowStats ? "watching" : "in progress"}`)}${tableCard(`Top ${isShowStats ? "show" : "movie"} genres`, "GENRE", isShowStats ? "SHOWS" : "MOVIES", mediaGenreRows, `Genre details for your ${mediaPlural} will appear here.`)}${tableCard(isShowStats ? "Top show networks" : "Top movie studios", isShowStats ? "NETWORK" : "STUDIO", isShowStats ? "SHOWS" : "MOVIES", networkRows, `Provider details for your ${mediaPlural} will appear here.`)}</div>`;
    const overview = `<section class="stats-overview"><header class="detail-page-heading analytics-page-heading">${statisticsBack}<strong>Statistics</strong><span class="stats-subpage-badge">${total} ${nounPlural.toUpperCase()}</span></header>${mediaTabs}${statsBoard}</section>`;
    const pages = {
      activity: { title: "Activity", subtitle: "See how your library has changed over the selected period.", badge: `${activityTotal} UPDATES`, body: `<div class="stats-activity-toolbar">${rangeSwitch}<span>${month ? "Last 30 days" : "Last 7 days"}</span></div>${activityPanel}` }
    };
    const selectedPage = pages[statsSubpage];
    const subpage = selectedPage ? `<section class="stats-subpage stats-subpage-${esc(statsSubpage)}"><header class="detail-page-heading analytics-page-heading"><button type="button" class="detail-back" data-go="profile"><span aria-hidden="true">‹</span> Profile</button><strong>${selectedPage.title}</strong><span class="stats-subpage-badge">${selectedPage.badge}</span></header>${scoped ? mediaTabs : ""}<div class="stats-subpage-intro"><span class="stats-eyebrow">STATISTICS</span><h1>${selectedPage.title}</h1><p>${selectedPage.subtitle}</p></div>${selectedPage.body}</section>` : "";
    const empty = total === 0 && !statsSubpage ? `<div class="stats-empty-state"><span aria-hidden="true">▥</span><strong>Your stats will appear here.</strong><p>Add ${nounPlural} to your library to get started.</p><a href="#series-watchlist">Go to your library <span aria-hidden="true">→</span></a></div>` : "";
    return `<section class="stats-page">${statsSubpage ? subpage : overview}${empty}</section>`;
  };

  // The page is a pure function of the library, history, a few preferences and the selected range/day,
  // so identical inputs reuse the previous HTML instead of recomputing every panel.
  let cache = { key: "", html: "" };
  window.SplitAppPages.statistics = context => {
    if (context.dataRevision === undefined) return renderStatistics(context);
    const key = [context.dataRevision, context.items.length, context.history.length, context.statsRange, context.statsCategory, context.statsSubpage, context.statsActivityDate, new Date().toDateString(), JSON.stringify(context.prefs)].join("|");
    if (cache.key !== key) cache = { key, html: renderStatistics(context) };
    return cache.html;
  };
})();
