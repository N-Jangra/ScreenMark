// Statistics: an overview page plus four sub-pages (watch time, library, activity, ratings).
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  const renderStatistics = context => {
    const { items, history, config, prefs = {}, esc, roles, statsRange = "week", statsSubpage = "", statsActivityDate = "" } = context;
    const statisticsInBottomBar = prefs.navBar?.visible?.statistics !== false;
    const statisticsBack = statisticsInBottomBar
      ? `<span class="detail-heading-spacer" aria-hidden="true"></span>`
      : `<button type="button" class="detail-back" data-go="explore"><span aria-hidden="true">‹</span> Back</button>`;
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
    const rated = items.filter(item => Number(item.rating) > 0);
    const avgRating = rated.length ? (rated.reduce((sum, item) => sum + Number(item.rating), 0) / rated.length).toFixed(1) : "—";
    const ratingRows = [...rated].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 5).map(item => `<div class="stats-rated-row"><span>${esc(item.title)}</span><span aria-label="${Number(item.rating)} out of 5">${"★".repeat(Math.min(5, Math.max(0, Math.round(Number(item.rating)))))}<small>${Number(item.rating)}</small></span></div>`).join("");
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
    const longest = [...known].sort((a, b) => totalOf(b) - totalOf(a)).slice(0, 5);
    const longestMax = Math.max(1, ...longest.map(totalOf));
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const movieCount = items.filter(item => item.category === "movie").length, seriesCount = items.filter(item => item.category === "series").length;
    const ratingMax = prefs.ratingFormat === "10-point" ? 10 : 5;
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
    const timePanel = `<article class="stats-panel stats-time-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">WATCH TIME</span><h3>Time to watch</h3></div><span class="stats-time-coverage"><strong>${known.length}/${items.length}</strong><span>titles with data</span></span></header><div class="stats-time-grid"><div class="stats-time-stat stats-time-stat-primary"><span class="stats-time-label">Watched so far</span><strong>${durText(watchedMinutes)}</strong><span class="stats-time-caption">Across all titles</span></div><div class="stats-time-stat"><span class="stats-time-label">Total length</span><strong>${durText(knownMinutes)}</strong><span class="stats-time-caption">${plural(known.length, nounOne)}</span></div><div class="stats-time-stat"><span class="stats-time-label">Left to watch</span><strong>${durText(leftMinutes)}</strong><span class="stats-time-caption">Unfinished titles</span></div><div class="stats-time-stat"><span class="stats-time-label">Episodes watched</span><strong>${episodesWatched}</strong><span class="stats-time-caption">${seriesCount} series</span></div></div>${knownMinutes ? `<div class="stats-time-progress" role="img" aria-label="${Math.round(watchedMinutes / knownMinutes * 100)}% of the known length watched"><span style="width:${Math.min(100, watchedMinutes / knownMinutes * 100)}%"></span></div><p class="stats-time-note">${durText(watchedMinutes)} of ${durText(knownMinutes)} watched in titles with data.</p>` : ""}<p class="stats-time-note">${esc(note)}</p><div class="stats-time-actions">${missingFacts ? `<button type="button" class="button secondary small" data-stats-fetch-facts>Fetch details for ${plural(missingFacts, nounOne)}</button>` : ""}${missingRuntime ? `<button type="button" class="button secondary small" data-stats-find-hours>Find runtimes for ${plural(missingRuntime, nounOne)}</button>` : ""}</div></article>`;
    const longestPanel = `<article class="stats-panel stats-playtime-games"><header class="stats-panel-heading"><div><span class="stats-eyebrow">LONGEST</span><h3>Longest titles</h3></div><span class="stats-total-chip">${known.length} tracked</span></header>${longest.length ? `<div class="stats-longest">${longest.map(item => `<div class="stats-longest-row"><span>${esc(item.title)}</span><div><i style="width:${totalOf(item) / longestMax * 100}%"></i></div><b>${durText(totalOf(item))}</b></div>`).join("")}</div>` : `<p class="stats-empty-copy">Runtimes appear once a title has a known length.</p>`}</article>`;

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

    // ---- Ratings
    const sortedRated = [...rated].sort((a, b) => Number(b.rating) - Number(a.rating));
    const ratingHistogram = Array.from({ length: ratingMax }, (_, index) => ratingMax - index).map(score => {
      const count = rated.filter(item => Math.round(Number(item.rating)) === score).length;
      const percent = rated.length ? Math.round(count / rated.length * 100) : 0;
      return `<div class="stats-rating-hist-row"><span>${ratingMax === 5 ? `${score} ★` : score}</span><span class="stats-rating-hist-track"><i style="width:${percent}%"></i></span><strong>${count}</strong></div>`;
    }).join("");
    const averageStars = ratingMax === 5 ? "★".repeat(Math.min(5, Math.max(0, Math.round(Number(avgRating) || 0)))).padEnd(5, "☆") : `out of ${ratingMax}`;
    const limit = context.statsLimits?.rated || 10;
    const ratedRows = sortedRated.slice(0, limit).map(item => `<button type="button" class="stats-rated-entry" data-open-details data-id="${esc(item.id)}">${artwork(item)}<span class="stats-rated-copy"><strong>${esc(item.title)}</strong><small>${esc(item.status || "In your library")}</small></span><span class="stats-rated-score" aria-label="${Number(item.rating)} out of ${ratingMax}">${ratingMax === 5 ? "★".repeat(Math.min(5, Math.max(0, Math.round(Number(item.rating))))).padEnd(5, "☆") : `${Number(item.rating)}/${ratingMax}`}<small>${Number(item.rating)}</small></span></button>`).join("");
    const moreRated = sortedRated.length > limit ? `<button type="button" class="stats-show-more" data-stats-more="rated"><span>Show ${Math.min(15, sortedRated.length - limit)} more</span><small>${sortedRated.length - limit} left</small><i data-lucide="chevron-down" aria-hidden="true"></i></button>` : "";
    // Titles still without a score, so they can be rated right here.
    const unrated = items.filter(item => !(Number(item.rating) > 0));
    const quickLimit = context.statsLimits?.quick || 8;
    const quickRows = unrated.slice(0, quickLimit).map(item => `<div class="stats-unrated-entry">${artwork(item)}<span class="stats-rated-copy"><strong>${esc(item.title)}</strong><small>${esc(categoryLabel(item))} · ${esc(item.status || "In your library")}</small></span><span class="stats-quick-rate" role="group" aria-label="Rate ${esc(item.title)}">${Array.from({ length: ratingMax }, (_, index) => index + 1).map(score => `<button type="button" data-stats-rating="${esc(item.id)}" data-score="${score}" aria-label="Rate ${score} out of ${ratingMax}">${ratingMax === 5 ? `<i data-lucide="star" aria-hidden="true"></i>` : score}</button>`).join("")}</span></div>`).join("");
    const moreQuick = unrated.length > quickLimit ? `<button type="button" class="stats-show-more" data-stats-more="quick"><span>Show ${Math.min(10, unrated.length - quickLimit)} more</span><small>${unrated.length - quickLimit} left</small><i data-lucide="chevron-down" aria-hidden="true"></i></button>` : "";
    const quickPanel = `<article class="stats-panel stats-quick-rate-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">QUICK RATE</span><h3>Not rated yet</h3></div><span class="stats-total-chip">${unrated.length}</span></header><p class="stats-empty-copy">Tap a star to rate. Change it later from the title’s details.</p>${quickRows || `<p class="stats-empty-copy">Every title in your library has a rating.</p>`}${moreQuick}</article>`;
    const ratingsPanel = `<article class="stats-panel stats-ratings-summary"><div class="stats-rating-overview"><div class="stats-rating-average"><strong>${avgRating}</strong><span>${averageStars}</span><small>${rated.length} of ${total} rated</small></div><div class="stats-rating-histogram">${ratingHistogram}</div></div></article>${rated.length ? `<article class="stats-panel"><header class="stats-panel-heading"><div><span class="stats-eyebrow">YOUR SCORES</span><h3>Highest rated</h3></div><span class="stats-total-chip">${rated.length}</span></header><div class="stats-rating-list">${ratedRows}</div>${moreRated}</article>` : `<article class="stats-panel stats-empty-ratings"><span class="stats-empty-icon"><i data-lucide="star" aria-hidden="true"></i></span><strong>No ratings yet</strong><p>Rate a title from its details page to build your ratings overview.</p></article>`}${quickPanel}`;

    // ---- Overview
    const destinations = [
      ["watchtime", "clock-3", "Watch time", "Time watched, runtimes and what’s left.", `${durText(watchedMinutes)} watched`],
      ["library", "library", "Library breakdown", `See how your ${nounPlural} are spread across statuses.`, `${completed} completed · ${queued} on ${roles.queued.toLowerCase()}`],
      ["activity", "activity", "Activity", "Review recent changes and your tracking rhythm.", `${activityTotal} in the last ${month ? "30 days" : "7 days"}`],
      ["ratings", "star", "Ratings", "See your average score and highest rated titles.", rated.length ? `${avgRating} avg · ${rated.length}/${total} rated` : "No ratings yet"]
    ];
    const coverage = count => total ? Math.min(100, Math.round(count / total * 100)) : 0;
    const overviewTile = ({ destination, label, icon, value, caption, percent, tone = "accent" }) => `<button type="button" class="stats-overview-tile" data-go="${destination}" data-tone="${tone}"><span class="stats-overview-tile-head"><span>${label}</span><i data-lucide="${icon}" aria-hidden="true"></i></span><strong>${value}</strong><span class="stats-overview-progress" aria-hidden="true"><i style="width:${percent}%"></i></span><small>${caption}</small></button>`;
    const overviewTiles = [
      overviewTile({ destination: "statistics/library", label: `${nounPlural[0].toUpperCase()}${nounPlural.slice(1)} tracked`, icon: "clapperboard", value: total, caption: "In your collection", percent: total ? 100 : 0 }),
      overviewTile({ destination: "statistics/library", label: "Completed", icon: "circle-check", value: completed, caption: `${completionRate}% of your collection`, percent: completionRate, tone: "success" }),
      overviewTile({ destination: "statistics/watchtime", label: "Time watched", icon: "clock-3", value: durText(watchedMinutes), caption: `${known.length} of ${total} have runtime data`, percent: coverage(known.length), tone: "info" }),
      overviewTile({ destination: "statistics/ratings", label: "Average rating", icon: "star", value: `${avgRating}${rated.length ? `<small> / ${ratingMax}</small>` : ""}`, caption: `${rated.length} of ${total} rated`, percent: rated.length ? Math.min(100, Number(avgRating) / ratingMax * 100) : 0, tone: "warning" })
    ].join("");
    const overview = `<section class="stats-overview"><header class="detail-page-heading analytics-page-heading">${statisticsBack}<strong>Statistics</strong><span class="stats-subpage-badge">${total} ${nounPlural.toUpperCase()}</span></header><div class="stats-overview-hero"><span class="stats-eyebrow">YOUR COLLECTION</span><h1>Collection overview</h1><p>A clear view of your watch time, collection, activity and ratings.</p></div><div class="stats-overview-grid">${overviewTiles}</div><section class="stats-section stats-explore-section"><div class="stats-section-heading"><div><span class="stats-eyebrow">DETAILS</span><h2>Explore your stats</h2><p>Open a section for a closer look.</p></div></div><div class="stats-destinations">${destinations.map(([key, icon, title, description, value]) => `<button type="button" class="stats-destination" data-go="statistics/${key}"><span class="stats-destination-icon"><i data-lucide="${icon}" aria-hidden="true"></i></span><span class="stats-destination-copy"><strong>${title}</strong><small>${description}</small></span><span class="stats-destination-value">${value}</span><i class="stats-destination-arrow" data-lucide="chevron-right" aria-hidden="true"></i></button>`).join("")}</div></section></section>`;
    const pages = {
      watchtime: { title: "Watch time", subtitle: "See time watched, runtimes and what remains.", badge: `${known.length}/${total} DATA`, body: `${timePanel}${longestPanel}` },
      library: { title: "Library breakdown", subtitle: `Understand the status of every ${nounOne} you’re tracking.`, badge: `${total} ${nounPlural.toUpperCase()}`, body: `${statusPanel}${typePanel}${genresPanel}` },
      activity: { title: "Activity", subtitle: "See how your library has changed over the selected period.", badge: `${activityTotal} UPDATES`, body: `<div class="stats-activity-toolbar">${rangeSwitch}<span>${month ? "Last 30 days" : "Last 7 days"}</span></div>${activityPanel}` },
      ratings: { title: "Ratings", subtitle: "Review your scores and the titles you’ve rated highest.", badge: rated.length ? `${avgRating} AVG` : "NO SCORES", body: ratingsPanel }
    };
    const selectedPage = pages[statsSubpage];
    const subpage = selectedPage ? `<section class="stats-subpage stats-subpage-${esc(statsSubpage)}"><header class="detail-page-heading analytics-page-heading"><button type="button" class="detail-back" data-go="statistics"><span aria-hidden="true">‹</span> All statistics</button><strong>${selectedPage.title}</strong><span class="stats-subpage-badge">${selectedPage.badge}</span></header><div class="stats-subpage-intro"><span class="stats-eyebrow">STATISTICS</span><h1>${selectedPage.title}</h1><p>${selectedPage.subtitle}</p></div>${selectedPage.body}</section>` : "";
    const empty = total === 0 && !statsSubpage ? `<div class="stats-empty-state"><span aria-hidden="true">▥</span><strong>Your stats will appear here.</strong><p>Add ${nounPlural} to your library to get started.</p><a href="#dashboard">Go to your library <span aria-hidden="true">→</span></a></div>` : "";
    return `<section class="stats-page">${statsSubpage ? subpage : overview}${empty}</section>`;
  };

  // The page is a pure function of the library, history, a few preferences and the selected range/day,
  // so identical inputs reuse the previous HTML instead of recomputing every panel.
  let cache = { key: "", html: "" };
  window.SplitAppPages.statistics = context => {
    if (context.dataRevision === undefined) return renderStatistics(context);
    const key = [context.dataRevision, context.items.length, context.history.length, context.statsRange, context.statsSubpage, context.statsActivityDate, JSON.stringify(context.statsLimits || null), new Date().toDateString(), JSON.stringify(context.prefs)].join("|");
    if (cache.key !== key) cache = { key, html: renderStatistics(context) };
    return cache.html;
  };
})();
