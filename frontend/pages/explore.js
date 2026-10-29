// CueMark-style Explore hub for activity pages and individual metadata sources.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.explore = context => {
    const { config, prefs, esc, labelCategory } = context;
    const orderedSources = prefs.metadataSourceOrder
      .map(key => window.SplitAppSources.list().find(source => source.key === key))
      .filter(Boolean);
    const sourceIcons = { tvmaze: "tv", anilist: "sparkles", tmdb: "clapperboard", tvdb: "tv-2", imdb: "star", rottentomatoes: "apple", omdb: "film" };
    const mixOn = orderedSources.some(source => window.SplitAppSources.isEnabled(source.key, prefs) && !(source.keyRequired && !prefs.apiKeys[source.key]?.trim()));
    const sourceRows = orderedSources.map(source => {
      const enabled = window.SplitAppSources.isEnabled(source.key, prefs);
      const missingKey = source.keyRequired && !prefs.apiKeys[source.key]?.trim();
      const kinds = source.categories.map(labelCategory).join(", ");
      const note = !enabled ? `${kinds} · Off — turn on in Metadata Sources` : missingKey ? `${kinds} · API key needed — add it in Metadata Sources` : kinds;
      const href = !enabled || missingKey ? "#settings/metadata-sources" : `#discover?source=${encodeURIComponent(source.key)}`;
      const state = !enabled ? "Off" : missingKey ? "Setup" : "";
      return `<a class="explore-source-card explore-source-row${enabled && !missingKey ? "" : " is-inactive"}" href="${href}" data-explore-source="${esc(source.key)}" data-explore-search="${esc(`${source.name} ${note}`.toLowerCase())}">
          <span class="explore-source-icon"><i data-lucide="${sourceIcons[source.key] || "database"}" aria-hidden="true"></i></span>
          <span class="explore-source-row-copy"><strong>${esc(source.name)}</strong><small>${esc(note)}</small></span>
          ${state ? `<span class="explore-source-state">${state}</span>` : ""}
          <i data-lucide="chevron-right" aria-hidden="true"></i>
        </a>`;
    }).join("");
    return `<section class="explore-page">
      <header class="explore-heading"><h1>Explore</h1><a class="explore-icon-btn" href="#settings/metadata-sources" aria-label="Manage metadata sources" title="Manage metadata sources"><i data-lucide="wrench" aria-hidden="true"></i></a></header>
      <h2 class="explore-group-title">Insights &amp; Activity</h2>
      <div class="explore-list-group">
        <button class="explore-list-row" type="button" data-go="timeline"><span class="explore-list-icon" style="--tile:#34c759"><i data-lucide="clock" aria-hidden="true"></i></span><span class="explore-list-body"><span class="explore-list-name">Timeline</span><small class="explore-list-sub">Recent status &amp; watch history</small></span><i data-lucide="chevron-right" class="explore-list-chevron" aria-hidden="true"></i></button>
        <button class="explore-list-row" type="button" data-go="statistics"><span class="explore-list-icon" style="--tile:#ff9500"><i data-lucide="bar-chart-3" aria-hidden="true"></i></span><span class="explore-list-body"><span class="explore-list-name">Statistics</span><small class="explore-list-sub">Collection health &amp; watch time</small></span><i data-lucide="chevron-right" class="explore-list-chevron" aria-hidden="true"></i></button>
      </div>
      <div class="explore-group-head"><h2 class="explore-group-title">Metadata Sources</h2><a href="#settings/metadata-sources">Manage all</a></div>
      <label class="search-box explore-source-search"><i data-lucide="search" aria-hidden="true"></i><input id="explore-source-search" type="search" placeholder="Search metadata sources" autocomplete="off" aria-label="Search metadata sources"></label>
      <div class="explore-source-list">${sourceRows}</div><p class="explore-no-sources" id="explore-no-sources" hidden>No matching metadata sources.</p>
      <h2 class="explore-group-title">Beta</h2>
      <div class="explore-list-group">
        <button class="explore-list-row" type="button" data-go="mix"><span class="explore-list-icon" style="--tile:#7c3aed"><i data-lucide="blend" aria-hidden="true"></i></span><span class="explore-list-body"><span class="explore-list-name">Mix fetch <em class="mix-beta">EXPERIMENTAL</em></span><small class="explore-list-sub">One list from all sources; details merged when you open or add a title.</small></span><span class="explore-list-state${mixOn ? " on" : ""}">${mixOn ? "On" : "Off"}</span><i data-lucide="chevron-right" class="explore-list-chevron" aria-hidden="true"></i></button>
      </div>
    </section>`;
  };
})();
