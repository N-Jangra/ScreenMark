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
