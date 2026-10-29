// CueMark-inspired activity timeline, backed by ScreenMark's saved history.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.timeline = context => {
    const { history, items = [], roles, trackedStatuses, esc, timelineFilter = "all", timelineSearch = "", timelineMonth = "", timelineYear = "" } = context;
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const visibleStatuses = new Set(trackedStatuses);
    const yearOptions = [...new Set(history.map(entry => new Date(entry.at || 0).getFullYear()).filter(year => year > 1970))].sort((a, b) => b - a);
    const entries = history.filter(entry => {
      const status = entry.status || entry.action;
      if (!visibleStatuses.has(status)) return false;
      const at = Number(entry.at) || Date.parse(entry.at) || 0;
      const date = new Date(at);
      if (timelineFilter === "week" && at < weekStart) return false;
      if (timelineFilter === "month" && at < monthStart) return false;
      if (timelineSearch && !String(entry.title || "").toLowerCase().includes(timelineSearch.toLowerCase())) return false;
      if (timelineMonth !== "" && date.getMonth() !== Number(timelineMonth)) return false;
      if (timelineYear && date.getFullYear() !== Number(timelineYear)) return false;
      return true;
    }).sort((a, b) => (Number(b.at) || Date.parse(b.at) || 0) - (Number(a.at) || Date.parse(a.at) || 0)).slice(0, 120);
    const groups = new Map();
    entries.forEach(entry => {
      const date = new Date(Number(entry.at) || Date.parse(entry.at) || Date.now());
      const key = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ entry, date });
    });
    const statusIcons = { [roles.dropped]: "↓", [roles.done]: "✓", [roles.hold]: "Ⅱ", [roles.active]: "▶" };
    const cards = [...groups].map(([month, records]) => `<section class="timeline-month-group"><div class="timeline-month-marker"><span class="timeline-month-dot"></span><h2 class="timeline-month-title">${esc(month)}</h2><span class="timeline-month-count">${records.length}</span></div><div class="timeline-month-items">${records.map(({ entry, date }) => { const status = entry.status || entry.action; return `<article class="timeline-item">${(() => { const game = items.find(row => row.id === entry.itemId) || items.find(row => String(row.title).toLowerCase() === String(entry.title || "").toLowerCase()); const art = game?.localThumbnailData || game?.image || ""; return art ? `<span class="timeline-item-thumb has-art"><img src="${esc(art)}" alt="" loading="lazy" decoding="async"><b class="timeline-status-dot" aria-label="${esc(status)}">${statusIcons[status]}</b></span>` : `<span class="timeline-item-thumb" aria-hidden="true">${statusIcons[status]}</span>`; })()}<div class="timeline-item-content"><strong class="timeline-item-text">${esc(entry.title || "Untitled")}</strong><span class="timeline-item-meta">${esc(status)} · ${esc(date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }))}</span></div></article>`; }).join("")}</div></section>`).join("");
    const hasAdvancedFilter = timelineSearch || timelineMonth !== "" || timelineYear;
    return `<section class="timeline-page"><div class="timeline-filters" role="group" aria-label="Filter activity by date"><button class="date-filter-btn ${timelineFilter === "all" ? "active" : ""}" data-timeline-filter="all">All time</button><button class="date-filter-btn ${timelineFilter === "week" ? "active" : ""}" data-timeline-filter="week">This week</button><button class="date-filter-btn ${timelineFilter === "month" ? "active" : ""}" data-timeline-filter="month">This month</button><button class="timeline-filter-icon-btn ${hasAdvancedFilter ? "active" : ""}" data-open-timeline-filters aria-label="More timeline filters" title="More filters">⌕</button></div><div class="timeline-summary"><div><span class="timeline-eyebrow">YOUR LIBRARY</span><h2>Recent activity</h2><p>Status changes for ${esc(roles.dropped)}, ${esc(roles.done)}, ${esc(roles.hold)}, and ${esc(roles.active)}.</p></div><span class="timeline-total">${entries.length} ${entries.length === 1 ? "event" : "events"}</span></div>${entries.length ? `<div class="timeline">${cards}</div>` : `<div class="timeline-empty"><span class="timeline-empty-icon" aria-hidden="true">◷</span><h3>${history.length ? "No status changes found" : "Your timeline starts here"}</h3><p>${history.length ? "Try another date range or clear your filters." : "Changes to ${esc(roles.dropped)}, ${esc(roles.done)}, ${esc(roles.hold)}, and ${esc(roles.active)} will appear here."}</p></div>`}</section><dialog class="choice-dialog timeline-filter-dialog" id="timeline-filter-dialog"><form method="dialog"><div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">ACTIVITY</p><h2>Filter timeline</h2></div><button class="choice-dialog-close" value="cancel" aria-label="Close">×</button></header><div class="timeline-filter-fields"><label>Search by title<input name="timeline-search" data-timeline-search type="search" value="${esc(timelineSearch)}" placeholder="Search titles"></label><label>Month<select name="timeline-month" data-timeline-month><option value="">Any month</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index}" ${String(index) === String(timelineMonth) ? "selected" : ""}>${new Date(2020, index, 1).toLocaleDateString(undefined, { month: "long" })}</option>`).join("")}</select></label><label>Year<select name="timeline-year" data-timeline-year><option value="">Any year</option>${yearOptions.map(year => `<option value="${year}" ${String(year) === String(timelineYear) ? "selected" : ""}>${year}</option>`).join("")}</select></label></div><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-clear-timeline-filters>Clear</button><button type="submit" class="button primary" value="apply">Apply filters</button></footer></form></dialog>`;
  };
})();
