// Statistics overview and activity sub-page.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  const renderStatistics = context => {
    const { items: allItems, history: allHistory, config, prefs = {}, esc, roles, statsRange = "week", statsCategory = "series", statsSubpage = "", statsActivityDate = "", statsWatchtimePage = 0 } = context;
    const scopeCategory = statsCategory === "movie" ? "movie" : "series";
    const scoped = statsSubpage === "activity";
    const items = scoped ? allItems.filter(item => item.category === scopeCategory) : allItems;
    const scopedIds = new Set(items.map(item => String(item.id)));
    const history = scoped ? allHistory.filter(entry => scopedIds.has(String(entry.itemId))) : allHistory;
    const statisticsBack = `<button type="button" class="detail-back" data-go="profile"><span aria-hidden="true">‹</span> Profile</button>`;
    const nounPlural = config.nounPlural || "titles", nounOne = config.noun || "title";
    const total = items.length;
    const completed = items.filter(item => String(item.status).toLowerCase() === "completed").length;
    const active = items.filter(item => ["playing", "in progress"].includes(String(item.status).toLowerCase())).length;
    const queued = items.filter(item => ["backlog", "queued", "watchlist", "to play"].includes(String(item.status).toLowerCase())).length;
    const onHold = items.filter(item => String(item.status).toLowerCase() === "on hold").length;
    const dropped = items.filter(item => String(item.status).toLowerCase() === "dropped").length;
    const other = Math.max(0, total - completed - active - queued - onHold - dropped);
    const completionRate = total ? Math.round(completed / total * 100) : 0;
    const counts = { completed, active, queued, onHold, dropped, other };
    const statusBar = Object.entries({ completed, active, queued, onHold, dropped, other }).map(([key, count]) => count ? `<span class="stats-segment stats-segment-${key}" style="width:${total ? count / total * 100 : 0}%" title="${esc(key)}: ${count}"></span>` : "").join("");
    const unitOf = item => config.categories.find(category => category.key === item.category)?.unit || "minutes";
    const finished = item => [roles.done, roles.dropped].includes(item.status);
    const runtimeOf = item => Number(item.facts?.runtimeMinutes) || 0;
    const episodesOf = item => Number(item.facts?.episodeCount) || (unitOf(item) === "episodes" ? Number(item.goal) || 0 : 0);
    const totalOf = item => Number(item.facts?.totalMinutes) || (unitOf(item) === "minutes" ? runtimeOf(item) : episodesOf(item) * runtimeOf(item));
    const watchedOf = item => item.status === roles.done ? totalOf(item) : unitOf(item) === "minutes" ? Math.min(Number(item.progress) || 0, totalOf(item) || Infinity) : (Number(item.progress) || 0) * runtimeOf(item);
    const leftOf = item => finished(item) ? 0 : Math.max(0, totalOf(item) - watchedOf(item));
    const durText = minutes => { const m = Math.round(minutes); if (m <= 0) return "0 h"; if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return h >= 100 || !r ? `${h} h` : `${h}h ${r}m`; };
    const known = items.filter(item => totalOf(item) > 0);
    const unknownOpen = items.filter(item => totalOf(item) === 0 && !finished(item));
    const watchedMinutes = known.reduce((sum, item) => sum + watchedOf(item), 0);
    const knownMinutes = known.reduce((sum, item) => sum + totalOf(item), 0);
    const leftMinutes = known.reduce((sum, item) => sum + leftOf(item), 0);
    const episodesWatched = items.filter(item => unitOf(item) === "episodes").reduce((sum, item) => sum + (item.status === roles.done ? episodesOf(item) || Number(item.progress) || 0 : Number(item.progress) || 0), 0);
    const missingFacts = items.filter(item => item.metadataSource && item.providerId && !item.facts?.fetchedAt).length;
    const missingRuntime = items.filter(item => totalOf(item) === 0 && (item.metadataSource || item.title)).length;
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const movieCount = items.filter(item => item.category === "movie").length, seriesCount = items.filter(item => item.category === "series").length;
    const artwork = item => {
      const art = item.localThumbnailData || item.image;
      const localPending = !item.localThumbnailData && Boolean(item.thumbnailPath);
      const show = Boolean(art || localPending);
      return `<span class="stats-game-art">${show ? `<img ${localPending ? `data-deferred-image data-local-item-id="${esc(item.id)}" data-lazy-src="${esc(item.image || "")}"` : `src="${esc(art)}"`} alt="" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ""}<i data-lucide="clapperboard" aria-hidden="true"${show ? " hidden" : ""}></i></span>`;
    };
    const categoryLabel = item => config.categories.find(category => category.key === item.category)?.label || item.category || "Title";
    const titleRow = (item, extra = "") => `<button type="button" class="stats-game-row" data-open-details data-id="${esc(item.id)}">${artwork(item)}<span class="stats-game-copy"><strong>${esc(item.title)}</strong><span class="stats-game-meta"><small class="stats-game-category">${esc(categoryLabel(item))}</small>${extra}</span></span><i class="stats-game-chevron" data-lucide="chevron-right" aria-hidden="true"></i></button>`;

    // ---- Watch time
    const pace = leftMinutes <= 0 ? "" : `About ${plural(Math.ceil(leftMinutes / 120), "day")} left at 2 hours a day.`;
    const unknownText = unknownOpen.length ? `${plural(unknownOpen.length, "unfinished title")} ${unknownOpen.length === 1 ? "has" : "have"} no runtime data, so ${unknownOpen.length === 1 ? "it isn't" : "they aren't"} counted in “Left to watch”.` : "";
    const note = !items.length ? `Add ${nounPlural} to see watch time and totals here.` : !known.length ? "No title has runtime data yet. Use the button below to look it up." : [leftMinutes <= 0 && !unknownOpen.length ? "Nothing left to watch. 🎉" : pace, unknownText].filter(Boolean).join(" ");
    const runtimeLookupRows = items.filter(item => !totalOf(item)).slice(0, 8).map(item => `<div class="stats-runtime-lookup-row" data-runtime-item="${esc(item.id)}"><strong>${esc(item.title)}</strong><small data-runtime-state>Not checked</small></div>`).join("");
    const moreRuntime = missingRuntime > 8 ? `<p class="stats-time-note">Showing 8 of ${missingRuntime} titles.</p>` : "";
    const timePanel = `<article class="stats-panel stats-time-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">WATCH TIME</span><h3>Time to watch</h3></div><span class="stats-time-coverage"><strong>${known.length}/${items.length}</strong><span>titles with data</span></span></header><div class="stats-time-grid"><div class="stats-time-stat stats-time-stat-primary"><span class="stats-time-label">Watched so far</span><strong>${durText(watchedMinutes)}</strong><span class="stats-time-caption">Across all titles</span></div><div class="stats-time-stat"><span class="stats-time-label">Total length</span><strong>${durText(knownMinutes)}</strong><span class="stats-time-caption">${plural(known.length, nounOne)}</span></div><div class="stats-time-stat"><span class="stats-time-label">Left to watch</span><strong>${durText(leftMinutes)}</strong><span class="stats-time-caption">Unfinished titles</span></div><div class="stats-time-stat"><span class="stats-time-label">${scopeCategory === "movie" ? "Movies watched" : "Episodes watched"}</span><strong>${scopeCategory === "movie" ? items.filter(item => item.status === roles.done).length : episodesWatched}</strong><span class="stats-time-caption">${scopeCategory === "movie" ? `${movieCount} movies` : `${seriesCount} series`}</span></div></div>${knownMinutes ? `<div class="stats-time-progress" role="img" aria-label="${Math.round(watchedMinutes / knownMinutes * 100)}% of the known length watched"><span style="width:${Math.min(100, watchedMinutes / knownMinutes * 100)}%"></span></div><p class="stats-time-note">${durText(watchedMinutes)} of ${durText(knownMinutes)} watched in titles with data.</p>` : ""}<p class="stats-time-note">${esc(note)}</p><div class="stats-time-actions">${missingFacts ? `<button type="button" class="button secondary small" data-stats-fetch-facts>Fetch details for ${plural(missingFacts, nounOne)}</button>` : ""}${missingRuntime ? `<button type="button" class="button secondary small" data-stats-find-hours>Find runtimes for ${plural(missingRuntime, nounOne)}</button>` : ""}</div></article>`;
    const runtimePanel = missingRuntime ? `<article class="stats-panel stats-runtime-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">RUNTIME DATA</span><h3>Titles to look up</h3></div><span class="stats-total-chip">${missingRuntime}</span></header><div class="stats-runtime-lookup-list">${runtimeLookupRows}${moreRuntime}</div></article>` : "";
    const timeStatusOrder = [...new Set([...config.categories.flatMap(category => category.statuses || []), ...items.map(item => item.status || "Other")])];
    const timeStatusGroups = timeStatusOrder.map(status => ({ status, rows: items.filter(item => String(item.status || "Other").toLowerCase() === String(status).toLowerCase()) })).filter(group => group.rows.length);
    const timeStatusColor = status => ({ [roles.done]: "var(--status-color-completed)", [roles.active]: "var(--status-color-playing)", [roles.queued]: "var(--status-color-backlog)", [roles.hold]: "var(--status-color-on-hold)", [roles.dropped]: "var(--status-color-dropped)" }[status] || "var(--accent)");
    const timeStatusCards = timeStatusGroups.map(group => {
      const tracked = group.rows.filter(item => totalOf(item) > 0);
      const length = tracked.reduce((sum, item) => sum + totalOf(item), 0);
      const watched = tracked.reduce((sum, item) => sum + watchedOf(item), 0);
      const remaining = tracked.reduce((sum, item) => sum + leftOf(item), 0);
      const percent = length ? Math.min(100, Math.round(watched / length * 100)) : 0;
      return `<section class="stats-time-status-card"><header><span class="stats-status-dot" style="--status-dot-color:${timeStatusColor(group.status)}"></span><strong>${esc(group.status)}</strong><small>${group.rows.length} ${group.rows.length === 1 ? "title" : "titles"}</small></header><div class="stats-time-status-values"><span><small>Total length</small><b>${durText(length)}</b></span><span><small>Watched</small><b>${durText(watched)}</b></span><span><small>Remaining</small><b>${durText(remaining)}</b></span></div>${length ? `<div class="stats-time-progress"><span style="width:${percent}%"></span></div><small class="stats-time-status-note">${percent}% of known runtime watched · ${tracked.length}/${group.rows.length} with runtime data</small>` : `<small class="stats-time-status-note">No runtime data yet</small>`}</section>`;
    }).join("");
    const timeStatusPanel = `<div class="stats-section-label"><span>BY STATUS</span><em>${timeStatusGroups.length} groups · ${total} titles</em></div><article class="stats-panel stats-time-status-list">${timeStatusCards || `<p class="stats-empty-copy">Add titles to see time totals by status.</p>`}</article>`;
    const watchtimePageSize = 10, watchtimePageCount = Math.max(1, Math.ceil(known.length / watchtimePageSize));
    const watchtimePage = Math.min(watchtimePageCount - 1, Math.max(0, Number(statsWatchtimePage) || 0));
    const timeTitleRows = [...known].sort((a, b) => totalOf(b) - totalOf(a) || String(a.title).localeCompare(String(b.title))).slice(watchtimePage * watchtimePageSize, watchtimePage * watchtimePageSize + watchtimePageSize).map(item => {
      const length = totalOf(item), watched = Math.min(watchedOf(item), length), percent = Math.min(100, Math.round(watched / length * 100));
      return `<button type="button" class="stats-playtime-row" data-open-details data-id="${esc(item.id)}">${artwork(item)}<span class="stats-playtime-copy"><span class="stats-playtime-line"><strong>${esc(item.title)}</strong><b>${durText(length)}</b></span><span class="stats-playtime-track"><i style="width:${percent}%"></i></span><small>${esc(item.status || "In library")} · ${durText(watched)} watched</small></span></button>`;
    }).join("");
    const timeTitlePager = watchtimePageCount > 1 ? `<nav class="stats-pager" aria-label="Runtime breakdown pages"><button type="button" data-stats-watchtime-page="${Math.max(0, watchtimePage - 1)}" ${watchtimePage === 0 ? "disabled" : ""} aria-label="Previous page">‹</button><span>${watchtimePage * watchtimePageSize + 1}–${Math.min(known.length, watchtimePage * watchtimePageSize + watchtimePageSize)} of ${known.length} · page ${watchtimePage + 1}/${watchtimePageCount}</span><button type="button" data-stats-watchtime-page="${Math.min(watchtimePageCount - 1, watchtimePage + 1)}" ${watchtimePage >= watchtimePageCount - 1 ? "disabled" : ""} aria-label="Next page">›</button></nav>` : "";
    const timeTitlePanel = `<div class="stats-section-label"><span>TITLE BY TITLE · RUNTIME BREAKDOWN</span><em>${known.length} tracked</em></div><article class="stats-panel stats-playtime-games">${timeTitleRows || `<p class="stats-empty-copy">Runtime breakdowns appear when a title has a known length. Fetch details to look them up.</p>`}${timeTitlePager}</article>`;

    // ---- Library breakdown
    const statusOrder = [...new Set(config.categories.flatMap(category => category.statuses || []))];
    const statusGroups = [...new Set([...statusOrder, ...items.map(item => item.status || "Other")])].map(status => ({ status, rows: items.filter(item => String(item.status || "Other").toLowerCase() === String(status).toLowerCase()) })).filter(group => group.rows.length);
    const statusColor = status => ({ [roles.done]: "var(--status-color-completed)", [roles.active]: "var(--status-color-playing)", [roles.queued]: "var(--status-color-backlog)", [roles.hold]: "var(--status-color-on-hold)", [roles.dropped]: "var(--status-color-dropped)" }[status] || "var(--accent)");
    const statusSegments = statusGroups.map(group => `<span style="width:${total ? group.rows.length / total * 100 : 0}%;background:${statusColor(group.status)}" title="${esc(group.status)}: ${group.rows.length}"></span>`).join("");
    const statusAccordion = statusGroups.map(group => {
      const pct = total ? Math.round(group.rows.length / total * 100) : 0;
      const rows = group.rows.slice(0, 40).map(item => titleRow(item)).join("") + (group.rows.length > 40 ? `<p class="stats-empty-copy">Showing 40 of ${group.rows.length}. Open the library to see them all.</p>` : "");
      return `<details class="stats-status-group"><summary><span class="stats-status-dot" style="--status-dot-color:${statusColor(group.status)}"></span><span class="stats-status-name">${esc(group.status)}</span><span class="stats-status-percent">${pct}%</span><strong>${group.rows.length}</strong><i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="stats-status-games">${rows}</div></details>`;
    }).join("");
    const statusPanel = `<article class="stats-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">COLLECTION MIX</span><h3>Status</h3></div><span class="stats-total-chip"><strong>${total}</strong> ${nounPlural}</span></header><div class="stats-status-bar stats-status-bar-dynamic" role="img" aria-label="Library status breakdown">${statusSegments}</div>${statusGroups.length ? `<div class="stats-status-accordion">${statusAccordion}</div>` : `<p class="stats-empty-copy">Add ${nounPlural} to see your collection breakdown.</p>`}</article>`;
    const typePanel = `<article class="stats-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">TYPES</span><h3>Movies and series</h3></div></header><div class="stats-genre-list"><div class="stats-genre-row"><span><strong>Movies</strong><small>${movieCount} · ${total ? Math.round(movieCount / total * 100) : 0}%</small></span><i><b style="width:${total ? movieCount / total * 100 : 0}%"></b></i></div><div class="stats-genre-row"><span><strong>TV series</strong><small>${seriesCount} · ${total ? Math.round(seriesCount / total * 100) : 0}%</small></span><i><b style="width:${total ? seriesCount / total * 100 : 0}%"></b></i></div></div></article>`;
    const genreCounts = new Map();
    items.forEach(item => {
      const fieldGenres = item.cachedDetails?.fields?.find(field => /^(genres?|genre)$/i.test(String(field.label || "").trim()))?.value;
      const raw = item.facts?.genres || fieldGenres || item.cachedDetails?.genres || [];
      const values = Array.isArray(raw) ? raw : String(raw || "").split(/[,;/|]/);
      [...new Set(values.map(value => String(value).trim()).filter(Boolean))].forEach(genre => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
    });
    const genreRows = [...genreCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([genre, count]) => `<div class="stats-genre-row"><span><strong>${esc(genre)}</strong><small>${count} · ${total ? Math.round(count / total * 100) : 0}%</small></span><i><b style="width:${total ? count / total * 100 : 0}%"></b></i></div>`).join("");
    const genresPanel = `<article class="stats-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">GENRE MIX</span><h3>Genres in your library</h3></div></header>${genreRows ? `<div class="stats-genre-list">${genreRows}</div>` : `<p class="stats-empty-copy">Genre data isn’t available yet. Fetch details for ${nounPlural} in your library to build this view.</p>`}</article>`;

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
    const chartMarkup = (rows, unit) => rows.length ? `<div class="stats-reference-chart"><div class="stats-reference-bars">${rows.map(({ item, value }) => `<div class="stats-reference-bar"><b>${value}</b><span><i style="height:${Math.max(5, value / Math.max(...rows.map(row => row.value)) * 100)}%"></i></span><small title="${esc(item.title)}">${esc(item.title)}</small></div>`).join("")}</div><p>${unit}</p></div>` : `<p class="stats-reference-empty">${isShowStats ? "Episode progress and runtime details will appear here as you track your shows." : "Completed movies with runtime details will appear here."}</p>`;
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
    const empty = total === 0 && !statsSubpage ? `<div class="stats-empty-state"><span aria-hidden="true">▥</span><strong>Your stats will appear here.</strong><p>Add ${nounPlural} to your library to get started.</p><a href="#dashboard">Go to your library <span aria-hidden="true">→</span></a></div>` : "";
    return `<section class="stats-page">${statsSubpage ? subpage : overview}${empty}</section>`;
  };

  // The page is a pure function of the library, history, a few preferences and the selected range/day,
  // so identical inputs reuse the previous HTML instead of recomputing every panel.
  let cache = { key: "", html: "" };
  window.SplitAppPages.statistics = context => {
    if (context.dataRevision === undefined) return renderStatistics(context);
    const key = [context.dataRevision, context.items.length, context.history.length, context.statsRange, context.statsCategory, context.statsSubpage, context.statsActivityDate, context.statsWatchtimePage, new Date().toDateString(), JSON.stringify(context.prefs)].join("|");
    if (cache.key !== key) cache = { key, html: renderStatistics(context) };
    return cache.html;
  };
})();
