// Quick setup wizard: pick series / movies you have watched or plan to watch.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  const STEPS = [
    { category: "series", status: "done", title: "Series you already watched", subtitle: "Pick the shows you have finished or watched before.", shelf: "Trending shows" },
    { category: "series", status: "queued", title: "Series you want to watch", subtitle: "Add shows to your watchlist so you never forget them.", shelf: "Trending shows" },
    { category: "movie", status: "done", title: "Movies you already watched", subtitle: "So we can keep your library accurate.", shelf: "Trending movies" },
    { category: "movie", status: "queued", title: "Movies you want to watch", subtitle: "Build your watchlist with movies you plan to see.", shelf: "Trending movies" }
  ];
  const stepsFor = state => state?.mode ? [{ category: state.mode === "favorites-movie" ? "movie" : "series", status: "favorite", title: state.mode === "favorites-movie" ? "Pick your favorite movies" : "Pick your favorite series", subtitle: "Choose from the titles already in your library.", shelf: state.mode === "favorites-movie" ? "Your movies" : "Your series" }] : STEPS;
  const resolveStatus = (current, requested, completed = "Completed") => current === completed || requested === completed ? completed : requested;
  const normalizeTitle = value => String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[™®©]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const yearOf = value => String(value || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
  function samePick(left, right) {
    const leftCategory = left?.category || "", rightCategory = right?.category || "";
    if (leftCategory && rightCategory && leftCategory !== rightCategory) return false;
    if (left?.source && right?.source && left.providerId != null && right.providerId != null && left.source === right.source && String(left.providerId) === String(right.providerId)) return true;
    if (normalizeTitle(left?.title) !== normalizeTitle(right?.title)) return false;
    const leftYear = yearOf(left?.year), rightYear = yearOf(right?.year);
    return !leftYear || !rightYear || leftYear === rightYear;
  }
  function mergeSearchResults(resultsBySource, sourceOrder = [...resultsBySource.keys()]) {
    const merged = new Map();
    for (const source of sourceOrder) for (const row of resultsBySource.get(source) || []) {
      if (!row?.title) continue;
      const key = `${row.source || source}:${row.providerId || String(row.title).toLocaleLowerCase()}`;
      if (!merged.has(key)) merged.set(key, row);
    }
    return [...merged.values()];
  }
  async function searchIncrementally(query, category, settings, sourceOrder, searchSource, onResults = () => {}, isCurrent = () => true) {
    const resultsBySource = new Map(), errors = [];
    await Promise.all(sourceOrder.map(async source => {
      try {
        const rows = await searchSource(query, category, settings, source);
        if (!isCurrent()) return;
        resultsBySource.set(source, rows || []);
        const partial = mergeSearchResults(resultsBySource, sourceOrder);
        if (partial.length) onResults(partial);
      } catch (error) { if (isCurrent()) errors.push(error); }
    }));
    if (!isCurrent()) return null;
    const rows = mergeSearchResults(resultsBySource, sourceOrder);
    if (!rows.length && errors.length) throw errors[0];
    return rows;
  }
  function withLibraryStatus(rows, items, fallbackCategory = "") {
    const byProvider = new Set(), byTitle = new Map();
    const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const yearOf = value => String(value || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
    for (const item of items || []) {
      if (!item?.title) continue;
      const category = item.category || "", sourceIds = { ...(item.sourceIds || {}) };
      const source = item.metadataSource || item.source;
      if (source && item.providerId != null && item.providerId !== "") sourceIds[source] = item.providerId;
      for (const [key, id] of Object.entries(sourceIds)) if (id != null && id !== "") byProvider.add(`${key}\u0000${category}\u0000${String(id)}`);
      const title = normalize(item.title);
      if (!title) continue;
      const key = `${category}\u0000${title}`, matches = byTitle.get(key) || [];
      matches.push(item); byTitle.set(key, matches);
    }
    return (rows || []).map(row => {
      const category = row.category || fallbackCategory, source = row.source || row.metadataSource || "";
      const providerMatch = source && row.providerId != null && row.providerId !== "" && byProvider.has(`${source}\u0000${category}\u0000${String(row.providerId)}`);
      const matches = byTitle.get(`${category}\u0000${normalize(row.title)}`) || [], year = yearOf(row.year);
      const titleMatch = year ? matches.some(item => yearOf(item.year) === year) || (matches.length === 1 && !yearOf(matches[0].year)) : matches.length === 1;
      return { ...row, inLibrary: Boolean(providerMatch || titleMatch) };
    });
  }
  const tile = (row, index, selected, locked, esc) => `<button type="button" class="setup-tile${selected && !row.inLibrary ? " selected" : ""}${row.inLibrary ? " is-in-library" : ""}"${row.inLibrary ? " disabled aria-disabled=\"true\"" : ` data-setup-toggle="${index}" aria-pressed="${selected}"`}${locked ? ' data-setup-locked="true"' : ""} aria-label="${esc(row.title)}${row.year ? ` (${esc(String(row.year).slice(0, 4))})` : ""}${row.inLibrary ? ", already in library" : ""}${locked ? ", already selected in another step" : ""}"><span class="setup-poster">${row.image ? `<img src="${esc(row.image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : `<span class="setup-noimg">${esc(row.title)}</span>`}</span><span class="setup-tile-title">${esc(row.title)}</span>${row.inLibrary ? '<span class="setup-library-indicator" aria-label="Already in library">✓ In library</span>' : ""}<span class="setup-mark" aria-hidden="true"></span></button>`;
  function grid(state, esc) {
    if (state.loading && !state.rows.length) return `<p class="setup-wait" role="status" aria-live="polite"><i data-lucide="loader-circle" aria-hidden="true"></i><span>Please wait while the sources load data…</span></p><div class="setup-grid" aria-busy="true">${Array.from({ length: 9 }, () => `<span class="setup-tile setup-skeleton"></span>`).join("")}</div>`;
    if (state.error) return `<p class="setup-message">${esc(state.error)}</p>`;
    if (!state.rows.length) return `<p class="setup-message">${state.query ? "No matches found." : state.mode ? "No titles in your library yet." : "No suggestions available right now. Try searching instead."}</p>`;
    const selected = new Set(state.selected.keys()), priorPicks = [], priorKeys = new Set();
    state.picks?.forEach((pick, index) => { if (index !== state.step) pick.forEach((row, key) => { priorPicks.push(row); priorKeys.add(key); }); });
    return `${state.loading ? '<p class="setup-wait setup-wait-more" role="status" aria-live="polite"><i data-lucide="loader-circle" aria-hidden="true"></i><span>More matches are loading…</span></p>' : ""}${state.query ? "" : `<h3 class="setup-shelf">${esc(stepsFor(state)[state.step].shelf)}</h3>`}<div class="setup-grid"${state.loading ? ' aria-busy="true"' : ""}>${state.rows.map((row, index) => { const key = `${row.source}:${row.providerId}`, matchedEarlier = priorKeys.has(key) || priorPicks.some(pick => samePick(row, pick)); return tile(row, index, selected.has(key) || matchedEarlier, matchedEarlier, esc); }).join("")}</div>`;
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
  window.SplitAppSetup = { steps: STEPS, stepsFor, grid, footerLabel, resolveStatus, withLibraryStatus, mergeSearchResults, searchIncrementally, samePick };
})();
