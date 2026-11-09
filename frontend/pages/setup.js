// Quick setup wizard: pick series / movies you have watched or plan to watch.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  const STEPS = [
    { category: "series", status: "done", title: "Series you already watched", subtitle: "Pick the shows you have finished or watched before.", shelf: "Trending shows" },
    { category: "series", status: "queued", title: "Series you want to watch", subtitle: "Add shows to your watchlist so you never forget them.", shelf: "Trending shows" },
    { category: "movie", status: "done", title: "Movies you already watched", subtitle: "So we can keep your library accurate.", shelf: "Trending movies" },
    { category: "movie", status: "queued", title: "Movies you want to watch", subtitle: "Build your watchlist with movies you plan to see.", shelf: "Trending movies" }
  ];
  const stepsFor = state => state?.mode ? [{ category: state.mode === "favorites-movie" ? "movie" : "series", status: "favorite", title: state.mode === "favorites-movie" ? "Pick your favorite movies" : "Pick your favorite series", subtitle: "Choose titles you love. They are added to your library and your favorites.", shelf: state.mode === "favorites-movie" ? "Trending movies" : "Trending shows" }] : STEPS;
  const tile = (row, index, selected, esc) => `<button type="button" class="setup-tile${selected ? " selected" : ""}" data-setup-toggle="${index}" aria-pressed="${selected}" aria-label="${esc(row.title)}${row.year ? ` (${esc(String(row.year).slice(0, 4))})` : ""}"><span class="setup-poster"><img src="${esc(row.image)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.setup-tile').hidden=true"></span><span class="setup-tile-title">${esc(row.title)}</span><span class="setup-mark" aria-hidden="true"></span></button>`;
  function grid(state, esc) {
    if (state.loading) return `<div class="setup-grid">${Array.from({ length: 9 }, () => `<span class="setup-tile setup-skeleton"></span>`).join("")}</div>`;
    if (state.error) return `<p class="setup-message">${esc(state.error)}</p>`;
    if (!state.rows.length) return `<p class="setup-message">${state.query ? "No matches found." : "No suggestions available right now. Try searching instead."}</p>`;
    return `${state.query ? "" : `<h3 class="setup-shelf">${esc(stepsFor(state)[state.step].shelf)}</h3>`}<div class="setup-grid">${state.rows.map((row, index) => tile(row, index, state.selected.has(`${row.source}:${row.providerId}`), esc)).join("")}</div>`;
  }
  function footerLabel(state) {
    const count = state.selected.size, last = state.step === stepsFor(state).length - 1;
    if (state.mode) return count ? `Add ${count} ${count === 1 ? "favorite" : "favorites"}` : "Skip";
    return count ? `${last ? "Finish" : "Next"} · ${count} selected` : last ? "Skip & finish" : "Skip";
  }
  window.SplitAppPages.setup = context => {
    const { setup: state, esc } = context, all = stepsFor(state), step = all[state.step];
    return `<section class="setup-page"><header class="setup-header"><button type="button" class="setup-back" data-setup-back aria-label="Back" ${state.step === 0 ? "hidden" : ""}><i data-lucide="chevron-left" aria-hidden="true"></i></button><span class="setup-step">${state.mode ? "Favorites" : `Step ${state.step + 1} of ${all.length}`}</span><button type="button" class="setup-later" data-setup-skip>Later</button><h1>${esc(step.title)}</h1><p>${esc(step.subtitle)}</p></header><label class="setup-search"><i data-lucide="search" aria-hidden="true"></i><input type="search" data-setup-search value="${esc(state.query)}" placeholder="Search ${step.category === "movie" ? "movies" : "shows"}" autocomplete="off" aria-label="Search"></label><div id="setup-grid">${grid(state, esc)}</div><footer class="setup-footer"><button type="button" class="setup-next" data-setup-next>${esc(footerLabel(state))}</button></footer></section>`;
  };
  window.SplitAppSetup = { steps: STEPS, stepsFor, grid, footerLabel };
})();
