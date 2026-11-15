"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const metadataSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/features/metadata.js"), "utf8");
const pageSource = fs.readFileSync(path.join(__dirname, "../frontend/pages/details.js"), "utf8");

function renderLoadingDetails(categoryKey, detailTab = "") {
  const window = {
    SplitAppDates: { text: value => String(value ?? "") },
    SplitAppLibrary: { episodeInfo: () => null }
  };
  const contextVm = vm.createContext({ window, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent });
  vm.runInContext(metadataSource, contextVm, { filename: "metadata.js" });
  vm.runInContext(pageSource, contextVm, { filename: "details.js" });
  const item = { id: "loading-item", title: "Loading title", category: categoryKey, metadataSource: "tvmaze", providerId: "1", status: "Playing", progress: 0, goal: 0, watchedEpisodeIds: [] };
  const categories = [
    { key: "movie", label: "Movies", singular: "Movie", unit: "minutes", step: 10, icon: "🎬", statuses: ["Backlog", "Completed"] },
    { key: "series", label: "Shows", singular: "TV series", unit: "episodes", step: 1, icon: "📺", statuses: ["Backlog", "Playing", "Completed"] }
  ];
  const renderContext = {
    detailPreview: null, items: [item], itemById: id => id === item.id ? item : null,
    detailItemId: item.id, detailReturnPage: "series-watchlist", detailData: null, detailLoading: true,
    detailError: "", detailEditMode: false, category: key => categories.find(row => row.key === key),
    labelCategory: key => categories.find(row => row.key === key)?.label || key,
    prefs: {}, roles: { queued: "Backlog", active: "Playing", hold: "On Hold", dropped: "Dropped", done: "Completed" },
    esc: value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
    detailTab, detailStackSize: 0
  };
  return window.SplitAppPages.details(renderContext);
}

function renderLoadingRef(kind, refItem = null) {
  const window = {
    SplitAppDates: { text: value => String(value ?? "") },
    SplitAppLibrary: { episodeInfo: () => null }
  };
  const contextVm = vm.createContext({ window, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent });
  vm.runInContext(metadataSource, contextVm, { filename: "metadata.js" });
  vm.runInContext(pageSource, contextVm, { filename: "details.js" });
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return window.SplitAppPages.details({
    detailPreview: null, items: [], detailItemId: "", detailReturnPage: "library", detailData: null, detailLoading: false,
    detailError: "", detailEditMode: false, category: () => null, labelCategory: key => key, prefs: {}, roles: {}, esc,
    detailRef: { type: kind, id: "ref-1", title: "Loading title", extra: { source: "tvmaze" } },
    detailRefOffset: 0, refData: null, refLoading: true, refError: "", refItem
  });
}

test("cold series details show the episode skeleton in an active Episodes tab", () => {
  const html = renderLoadingDetails("series");
  assert.match(html, /aria-selected="true"[^>]*data-detail-tab="episodes"/);
  assert.match(html, /data-detail-panel="episodes"[^>]*><section class="detail-section detail-skeleton-block"[^>]*><h3>Episodes<\/h3>/);
  assert.match(html, /class="detail-skeleton-episodes"/);
  assert.doesNotMatch(html, /data-detail-panel="episodes" hidden/);
});

test("cold movie placeholders stay in their corresponding Overview, Details and Media tabs", () => {
  const html = renderLoadingDetails("movie");
  assert.match(html, /aria-selected="true"[^>]*data-detail-tab="overview"/);
  assert.match(html, /data-detail-panel="overview"[^>]*>[\s\S]*?<h3>Synopsis<\/h3>/);
  assert.match(html, /data-detail-panel="details" hidden>[\s\S]*?<h3>Production details<\/h3>/);
  assert.match(html, /data-detail-panel="media" hidden>[\s\S]*?<h3>Images<\/h3>/);
});

test("cast profile loading uses its portrait and credits layout with an accessible status", () => {
  const html = renderLoadingRef("person");
  assert.match(html, /demo-person-page[^>]*aria-busy="true"/);
  assert.match(html, /role="status"[^>]*>Loading cast profile from TVmaze/);
  assert.match(html, /class="demo-actor-hero ref-skeleton-actor"/);
  assert.match(html, /class="demo-actor-portrait ref-skeleton-portrait detail-skeleton-block"/);
  assert.match(html, /<h3>Cast &amp; crew<\/h3>/);
  assert.match(html, /class="ref-skeleton-cast-row"/);
  assert.doesNotMatch(html, /Loading from TVmaze/);
});

test("character loading uses the character profile and Appears in list placeholders", () => {
  const html = renderLoadingRef("character");
  assert.match(html, /Character profile/);
  assert.match(html, /<h3>Appears in<\/h3>/);
  assert.match(html, /detail-carousel ref-skeleton-cast/);
  assert.match(html, /role="status"[^>]*>Loading character from TVmaze/);
});

test("episode loading holds the still, synopsis, cast and saved-series guide positions", () => {
  const html = renderLoadingRef("episode", { id: "show-1", title: "Example series" });
  assert.match(html, /class="ep-still ref-skeleton-still detail-skeleton-block"/);
  assert.match(html, /class="ref-skeleton-episode-title"/);
  assert.match(html, /<h3>Synopsis<\/h3>/);
  assert.match(html, /<h3>Cast<\/h3>/);
  assert.match(html, /ref-skeleton-series ref-skeleton-section/);
  assert.match(html, /role="status"[^>]*>Loading episode details from TVmaze/);
});

test("episode detail hero uses the saved episode still and never the series cover", () => {
  const episode = { id: "kitsu-episode:ep1", title: "Pilot", season: 1, number: 1, image: "https://images.example/pilot.jpg", ref: { type: "episode", id: "ep1" } };
  const item = { id: "show-1", title: "Example series", category: "series", image: "https://images.example/series-poster.jpg",
    cachedDetails: { sections: [{ kind: "episodes", items: [episode] }] },
    localImageData: { "cachedDetails.episodesById.kitsu-episode:ep1.image": "blob:saved-episode-still" } };
  const window = { SplitAppDates: { text: value => String(value ?? "") },
    SplitAppLibrary: { episodeInfo: () => ({ eps: [episode], watched: new Set(), done: 0, total: 1, mark: () => "" }) } };
  const contextVm = vm.createContext({ window, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent });
  vm.runInContext(metadataSource, contextVm, { filename: "metadata.js" });
  vm.runInContext(pageSource, contextVm, { filename: "details.js" });
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const render = isLocalImageUrlAvailable => window.SplitAppPages.details({
    detailPreview: null, items: [item], detailItemId: item.id, detailReturnPage: "library", detailData: null, detailLoading: false,
    detailError: "", detailEditMode: false, category: () => null, labelCategory: value => value, prefs: {}, roles: {}, esc,
    detailRef: { type: "episode", id: "ep1", title: "Pilot", extra: { source: "kitsu" } }, detailRefOffset: 0,
    refData: { type: "episode", source: "Kitsu", title: "Pilot", subtitle: "Example series · Episode 1", image: "" },
    refLoading: false, refError: "", refItem: item, isLocalImageUrlAvailable
  });
  const html = render(() => true);
  assert.match(html, /data-detail-image-src="blob:saved-episode-still"/);
  assert.doesNotMatch(html, /data-detail-image-src="https:\/\/images\.example\/series-poster\.jpg"/);
  const afterEviction = render(url => url !== "blob:saved-episode-still");
  assert.match(afterEviction, /data-detail-image-src="https:\/\/images\.example\/pilot\.jpg"/, "a revoked cached URL falls back to the saved episode source URL");
  assert.doesNotMatch(afterEviction, /data-detail-image-src="blob:saved-episode-still"/);
});

test("detail renderer can validate blob URLs against the active session artwork caches", () => {
  const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
  const context = app.slice(app.indexOf("function pageContext()"), app.indexOf("// ---- Device artwork cache", app.indexOf("function pageContext()")));
  assert.match(app, /function localImageUrlAvailable\(url\)[\s\S]*?thumbUrlCache\.values\(\)[\s\S]*?nativeImageFallbacks\.values\(\)/);
  assert.match(context, /isLocalImageUrlAvailable: localImageUrlAvailable/);
});

function renderLoadedDetails(categoryKey, { castOnline, sections = [] }) {
  const window = { SplitAppDates: { text: value => String(value ?? "") }, SplitAppLibrary: { episodeInfo: () => null } };
  const contextVm = vm.createContext({ window, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent });
  vm.runInContext(metadataSource, contextVm, { filename: "metadata.js" });
  vm.runInContext(pageSource, contextVm, { filename: "details.js" });
  const item = { id: "i1", title: "Saved title", category: categoryKey, metadataSource: "tvmaze", providerId: "1", status: "Backlog", progress: 0, goal: 0, watchedEpisodeIds: [] };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return window.SplitAppPages.details({
    detailPreview: null, items: [item], detailItemId: item.id, detailReturnPage: "series", detailData: { title: item.title, sections, fields: [], facts: {} },
    detailLoading: false, detailError: "", detailEditMode: false, category: () => ({ statuses: ["Backlog", "Completed"], unit: "episodes" }), labelCategory: key => key,
    prefs: {}, roles: { queued: "Backlog", active: "Playing", hold: "On Hold", dropped: "Dropped", done: "Completed" }, esc, detailCastOnline: castOnline, detailTab: "cast", detailStackSize: 0
  });
}

test("Cast & Crew tab is a lazy placeholder while online and hidden while offline; cast is never needed in saved data", () => {
  const online = renderLoadedDetails("series", { castOnline: true });
  assert.match(online, /data-detail-tab="cast"/);
  assert.match(online, /data-cast-lazy/);
  const offline = renderLoadedDetails("series", { castOnline: false });
  assert.doesNotMatch(offline, /data-detail-tab="cast"/);
  assert.doesNotMatch(offline, /data-cast-lazy/);
  const cast = [{ kind: "people", title: "Cast", items: [{ title: "Actor", meta: "Role" }] }];
  const loaded = renderLoadedDetails("movie", { castOnline: true, sections: cast });
  assert.match(loaded, /data-detail-tab="cast"/);
  assert.doesNotMatch(loaded, /data-cast-lazy/);
  assert.match(loaded, /Actor/);
});

test("detail tab panels let horizontal rails shrink so cast & crew scrolls sideways", () => {
  const css = fs.readFileSync(path.join(__dirname, "../frontend/styles/demo-pages.css"), "utf8");
  assert.match(css, /\.detail-tab-panel \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.detail-tab-panel > \*[^{]*\{[^}]*min-width: 0/);
});

test("season check confirmation offers earlier seasons only when marking a later season watched", () => {
  const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
  const handler = app.slice(app.indexOf('const seasonButton = eventClosest(event, "[data-season-toggle]")'), app.indexOf('const caughtUp = eventClosest(event, "[data-watchlist-caught-up]")'));
  assert.match(handler, /Number\(row\.season\) < season/);
  assert.match(handler, /appConfirm\(`Also mark earlier seasons/);
  assert.match(handler, /then\(includeEarlier => applySeason\(includeEarlier\)\)/);
  assert.match(handler, /if \(!undo && earlierIds\.length\)/, "unchecking and first-season actions need no extra dialog");
  assert.match(handler, /\[\.\.\.new Set\(\[\.\.\.earlierIds, \.\.\.ids\]\)\]/, "yes adds previous season episode IDs without duplicates");
});

test("ScreenMark JSON export completion reports title count and never game wording", () => {
  const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
  const body = app.slice(app.indexOf("async function exportListBody"), app.indexOf("const fileName = ", app.indexOf("async function exportListBody")));
  assert.match(body, /Exported \$\{items\.length\} titles\./);
  assert.doesNotMatch(body, /Exported \$\{items\.length\} games/);
});

test("Discover category changes preserve the query and reload results for the selected type", () => {
  const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
  assert.doesNotMatch(app, /const discoverCategoryButton = eventClosest\(event, "\[data-discover-category\]"\)/, "category changes should have a single click handler");
  const typeHandler = app.slice(app.indexOf('$("#header-type").addEventListener("click"'), app.indexOf('$("#discover-top-search").addEventListener("submit"'));
  assert.match(typeHandler, /discoverQuery = \$\("#discover-query"\)\?\.value \?\? discoverQuery/);
  assert.match(typeHandler, /discoverSubmitted = ""/);
  assert.doesNotMatch(typeHandler, /discoverQuery\s*=\s*""/);
  const render = app.slice(app.indexOf("function render()"), app.indexOf("function renderPage"));
  assert.match(render, /discoverCache\.category === currentDiscoverCategory\(\)/);
  assert.match(render, /discoverQuery\.trim\(\) && discoverSubmitted !== discoverRequestKey\(\)\) submitDiscover\(\)/);
  assert.match(app, /function discoverRequestKey\(\)[\s\S]*?discoverQuery\.trim\(\)\.toLocaleLowerCase\(\)[\s\S]*?currentDiscoverCategory\(\)[\s\S]*?discoverSource/);
});

test("ScreenMark exports use title terminology and serialize one export at a time", () => {
  const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
  assert.match(app, /Exported \$\{items\.length\} titles\./);
  assert.doesNotMatch(app, /Exported \$\{items\.length\} games\./);
  assert.match(app, /async function exportNames\(format\)[\s\S]*?if \(exportRunning\)[\s\S]*?exportNamesBody/);
  assert.match(app, /async function exportList\(options = \{\}\)[\s\S]*?if \(exportRunning\)[\s\S]*?exportListBody/);
});
