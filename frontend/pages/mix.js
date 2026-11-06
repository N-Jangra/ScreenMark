// Experimental Mix fetch page: one plain list across all enabled sources; details are merged when a title is opened or added.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.mix = context => {
    const { config, prefs, esc, mixQuery = "", mixCategory = "all" } = context;
    const sources = window.SplitAppSources.available(mixCategory === "all" ? undefined : mixCategory, prefs);
    const switcher = `<div class="ios-pills segmented mix-category" role="group" aria-label="Type">${[{ key: "all", label: "All" }, ...config.categories].map(category => `<button type="button" class="ios-pill${category.key === mixCategory ? " active" : ""}" data-mix-category="${esc(category.key)}" aria-pressed="${category.key === mixCategory}">${esc(category.label)}</button>`).join("")}</div>`;
    const chips = sources.map(source => `<span class="mix-chip">${esc(source.name)}</span>`).join("") || `<span class="mix-chip mix-chip-off">No sources enabled</span>`;
    return `<section class="mix-page">
      <header class="explore-heading mix-heading"><a class="settings-back" data-back href="#explore"><span aria-hidden="true">‹</span> Explore</a><h1>Mix fetch</h1><span class="mix-beta">BETA</span></header>
      <section class="mix-intro"><span class="mix-intro-icon" aria-hidden="true"><i data-lucide="flask-conical"></i></span><div><strong>Experimental</strong><p>Search shows one plain list from every enabled source. Opening or adding a title fetches details from all of them and merges the results.</p></div></section>
      ${switcher}<div class="mix-sources" aria-label="Sources used">${chips}</div>
      <div class="discover-search-row" role="search"><label class="search-box discover-search"><span aria-hidden="true"><i data-lucide="search"></i></span><input id="mix-query" type="search" placeholder="Search movies and series" autocomplete="off" enterkeyhint="search" value="${esc(mixQuery)}" aria-label="Search movies and series"></label><button class="discover-submit" data-mix-search type="button" aria-label="Search" title="Search"><i data-lucide="search" aria-hidden="true"></i></button></div>
      <p id="mix-message" class="discover-message" aria-live="polite"></p>
      <ul id="mix-results" class="mix-list"></ul>
    </section>`;
  };
})();
