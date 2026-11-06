// CueMark-inspired activity timeline, backed by ScreenMark's saved history.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.timeline = context => {
    const { history, items = [], prefs = {}, roles, trackedStatuses, esc, timelineFilter = "all", timelineSearch = "", timelineMonth = "", timelineYear = "" } = context;
    const timelineInBottomBar = prefs.navBar?.visible?.timeline !== false;
    const timelineBack = timelineInBottomBar
      ? `<span class="detail-heading-spacer" aria-hidden="true"></span>`
      : `<button type="button" class="detail-back" data-go="explore"><span aria-hidden="true">‹</span> Back</button>`;
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const visibleStatuses = new Set(trackedStatuses);
    const historyEntryIndex = new Map(history.map((entry, index) => [entry, index]));
    const yearOptions = [...new Set(history.map(entry => new Date(entry.at || 0).getFullYear()).filter(year => year > 1970))].sort((a, b) => b - a);
    const stamp = new Map();
    const timeOf = entry => { let v = stamp.get(entry); if (v === undefined) { v = Number(entry.at) || Date.parse(entry.at) || 0; stamp.set(entry, v); } return v; };
    const searchNeedle = timelineSearch.toLowerCase();
    const entries = history.filter(entry => {
      const status = entry.status || entry.action;
      if (!visibleStatuses.has(status)) return false;
      const at = timeOf(entry);
      const date = new Date(at);
      const from = context.timelineFrom ? new Date(`${context.timelineFrom}T00:00:00`).getTime() : 0, to = context.timelineTo ? new Date(`${context.timelineTo}T23:59:59.999`).getTime() : Infinity;
      if (at < from || at > to) return false;
      if (timelineFilter === "week" && at < weekStart) return false;
      if (timelineFilter === "month" && at < monthStart) return false;
      if (timelineSearch && !String(entry.title || "").toLowerCase().includes(searchNeedle)) return false;
      if (timelineMonth !== "" && date.getMonth() !== Number(timelineMonth)) return false;
      if (timelineYear && date.getFullYear() !== Number(timelineYear)) return false;
      return true;
    }).sort((a, b) => timeOf(b) - timeOf(a)).slice(0, 120);
    const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
    const groups = new Map();
    entries.forEach(entry => {
      const date = new Date(Number(entry.at) || Date.parse(entry.at) || Date.now());
      const month = monthFormat.format(date);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groups.has(month)) groups.set(month, new Map());
      const days = groups.get(month);
      if (!days.has(dayKey)) days.set(dayKey, []);
      days.get(dayKey).push({ entry, date });
    });
    const statusIcons = { [roles.queued]: "▤", [roles.dropped]: "↓", [roles.done]: "✓", [roles.hold]: "Ⅱ", [roles.active]: "▶" };
    // Two O(1) indexes instead of scanning every game for every history row.
    const gameById = new Map(), gameByTitle = new Map();
    items.forEach(row => { gameById.set(String(row.id), row); const key = String(row.title).toLowerCase(); if (!gameByTitle.has(key)) gameByTitle.set(key, row); });
    const findGame = entry => gameById.get(String(entry.itemId)) || gameByTitle.get(String(entry.title || "").toLowerCase());
    const cards = [...groups].map(([month, days]) => {
      const monthCount = [...days.values()].reduce((sum, records) => sum + records.length, 0);
      const dayCards = [...days.values()].map(records => {
        const dayLabel = window.SplitAppDates.withWeekday(records[0].date);
        const rows = records.map(({ entry, date }) => {
      const status = entry.status || entry.action;
      const game = findGame(entry);
      const typeLabel = context.config?.categories?.find(category => category.key === game?.category)?.label || "";
      const localArt = game?.localThumbnailData || "";
      const onlineArt = game?.image || entry.image || "";
      const localPending = Boolean(game && !localArt && game.thumbnailPath);
      const dot = `<b class="timeline-status-dot" aria-label="${esc(status)}">${statusIcons[status] || "•"}</b>`;
      const thumb = localArt || onlineArt || localPending
        ? `<span class="timeline-item-thumb has-art"><img ${localPending ? `data-deferred-image data-local-item-id="${esc(game.id)}" data-lazy-src="${esc(onlineArt)}"` : `src="${esc(localArt || onlineArt)}"`} alt="" loading="lazy" decoding="async" onerror="this.remove()">${dot}</span>`
        : `<span class="timeline-item-thumb" aria-hidden="true">${statusIcons[status] || "•"}</span>`;
          const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
          const action = entry.action || "Status updated";
          return `<article class="timeline-item">${thumb}<div class="timeline-item-content"><strong class="timeline-item-text">${esc(entry.title || "Untitled")}</strong><span class="timeline-item-meta">${typeLabel ? `<b class="timeline-type-chip">${esc(typeLabel)}</b> · ` : ""}${esc(action)} · ${esc(time)}</span></div><span class="timeline-event-status" data-status="${esc(String(status).toLowerCase())}">${esc(status)}</span></article>`;
        }).join("");
        return `<section class="timeline-day-card"><header class="timeline-day-heading"><h3>${esc(dayLabel)}</h3><span>${records.length} ${records.length === 1 ? "update" : "updates"}</span></header><div class="timeline-month-items">${rows}</div></section>`;
      }).join("");
      return `<section class="timeline-month-group"><div class="timeline-month-marker"><span class="timeline-month-dot"></span><h2 class="timeline-month-title">${esc(month)}</h2><span class="timeline-month-count">${monthCount}</span></div><div class="timeline-month-days">${dayCards}</div></section>`;
    }).join("");
    const hasAdvancedFilter = timelineSearch || timelineMonth !== "" || timelineYear || context.timelineFrom || context.timelineTo;
    return `<section class="timeline-page"><header class="detail-page-heading analytics-page-heading">${timelineBack}<strong>Timeline</strong><span class="detail-heading-spacer" aria-hidden="true"></span></header><div class="timeline-filters" role="group" aria-label="Filter activity by date"><button type="button" class="date-filter-btn ${timelineFilter === "week" ? "active" : ""}" data-timeline-filter="week" aria-pressed="${timelineFilter === "week"}">This week</button><button type="button" class="date-filter-btn ${timelineFilter === "month" ? "active" : ""}" data-timeline-filter="month" aria-pressed="${timelineFilter === "month"}">This month</button><button type="button" class="date-filter-btn ${timelineFilter === "all" ? "active" : ""}" data-timeline-filter="all" aria-pressed="${timelineFilter === "all"}">All time</button><button type="button" class="timeline-filter-icon-btn ${hasAdvancedFilter ? "active" : ""}" data-open-timeline-filters aria-label="More timeline filters" aria-controls="timeline-filter-dialog" aria-haspopup="dialog" aria-pressed="${Boolean(hasAdvancedFilter)}" title="More filters"><i data-lucide="sliders-horizontal" aria-hidden="true"></i></button></div><div class="timeline-summary"><div><span class="timeline-eyebrow">COLLECTION ACTIVITY</span><h2>Recent activity</h2><p>Status changes for ${esc(roles.dropped)}, ${esc(roles.done)}, ${esc(roles.hold)} and ${esc(roles.active)}, grouped by day.</p></div><span class="timeline-total">${entries.length} ${entries.length === 1 ? "event" : "events"}</span></div>${entries.length ? `<div class="timeline">${cards}</div>` : `<div class="timeline-empty"><span class="timeline-empty-icon" aria-hidden="true"><i data-lucide="calendar-clock"></i></span><h3>${history.length ? "No status changes found" : "Your timeline starts here"}</h3><p>${history.length ? "Try another date range or clear your filters." : `Changes to ${esc(roles.dropped)}, ${esc(roles.done)}, ${esc(roles.hold)} and ${esc(roles.active)} will appear here.`}</p></div>`}</section><dialog class="choice-dialog timeline-filter-dialog" id="timeline-filter-dialog" aria-labelledby="timeline-filter-title"><form method="dialog"><div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">ACTIVITY</p><h2 id="timeline-filter-title">Filter timeline</h2></div><button type="submit" class="choice-dialog-close" value="cancel" aria-label="Close filters">×</button></header><div class="timeline-filter-fields"><label>Search by title<input name="timeline-search" data-timeline-search type="search" value="${esc(timelineSearch)}" placeholder="Search titles"></label><label>Month<select name="timeline-month" data-timeline-month><option value="">Any month</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index}" ${String(index) === String(timelineMonth) ? "selected" : ""}>${new Date(2020, index, 1).toLocaleDateString(undefined, { month: "long" })}</option>`).join("")}</select></label><label>Year<select name="timeline-year" data-timeline-year><option value="">Any year</option>${yearOptions.map(year => `<option value="${year}" ${String(year) === String(timelineYear) ? "selected" : ""}>${year}</option>`).join("")}</select></label><label>From date<input type="date" name="timeline-from" value="${esc(context.timelineFrom || "")}"></label><label>To date<input type="date" name="timeline-to" value="${esc(context.timelineTo || "")}"></label></div><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-clear-timeline-filters>Clear</button><button type="submit" class="button primary" value="apply">Apply filters</button></footer></form></dialog>`;
  };
})();
