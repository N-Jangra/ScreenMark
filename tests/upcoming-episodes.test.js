"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

test("episode release dates keep date-only episodes upcoming for the whole local day", () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, "frontend/components/library.js"), "utf8"), vm.createContext({ window, Date, Map, Set, WeakMap, Object, Array, String, Number, Math, Intl }));
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const oldDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  assert.equal(window.SplitAppLibrary.isUpcoming({ airdate: localDate }), true);
  assert.equal(window.SplitAppLibrary.isUpcoming({ airdate: oldDate }), false);
  assert.equal(window.SplitAppLibrary.isUpcoming({ airdate: "" }), false);
  assert.equal(window.SplitAppLibrary.isUpcoming({ airdate: "not-a-date" }), false);
});

test("Upcoming tab removes a watched future episode and stays empty when all are watched", () => {
  const window = {
    SplitAppLibrary: {
      isUpcoming: episode => episode.future,
      episodeInfo: item => ({ next: null, done: item.watchedEpisodeIds.length, total: 2 })
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "frontend/pages/profile.js"), "utf8"), vm.createContext({ window, Intl, Map, Set, Date, Math, String, Number, Object, Array }));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const item = {
    id: "show-1", title: "Example Show", category: "series", status: "In Progress", progress: 1,
    watchedEpisodeIds: ["ep-1"], image: "https://img.example/poster.jpg",
    cachedDetails: { sections: [{ kind: "episodes", items: [
      { id: "ep-1", title: "Already marked", future: true, airdate: "2099-01-01" },
      { id: "ep-2", title: "Next week", future: true, airdate: "2099-01-08" }
    ] }] }
  };
  const render = () => window.SplitAppPages["series-watchlist"]({
    items: [item], esc, roles: { active: "In Progress", done: "Completed", queued: "Watchlist", hold: "On Hold" }, watchlistTab: "upcoming"
  });
  let html = render();
  assert.match(html, /Next week/);
  assert.doesNotMatch(html, /Already marked/);
  assert.doesNotMatch(html, /data-episode-toggle/);
  item.watchedEpisodeIds.push("ep-2");
  html = render();
  assert.match(html, /watchlist-empty/);
  assert.doesNotMatch(html, /Next week/);
});

test("future episode detail and tracking checks are disabled", () => {
  const metadataSource = fs.readFileSync(path.join(root, "frontend/backend/features/metadata.js"), "utf8");
  const pageSource = fs.readFileSync(path.join(root, "frontend/pages/details.js"), "utf8");
  const window = {
    SplitAppDates: { text: value => String(value ?? "") },
    SplitAppLibrary: { episodeInfo: () => null, isUpcoming: episode => episode.airdate === "2099-01-01" },
    SplitAppMetadata: { providers: [] }
  };
  const ctx = vm.createContext({ window, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, localStorage: { getItem: () => "" } });
  vm.runInContext(metadataSource, ctx, { filename: "metadata.js" });
  vm.runInContext(pageSource, ctx, { filename: "details.js" });
  const item = { id: "show-1", title: "Example", category: "series", status: "In Progress", progress: 0, goal: 2, watchedEpisodeIds: [], cachedDetails: { source: "TVmaze", sections: [{ kind: "episodes", title: "Episodes", items: [{ id: "future-1", season: 1, number: 1, title: "Future", airdate: "2099-01-01" }] }] } };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const html = window.SplitAppPages.details({
    detailPreview: null, items: [item], itemById: id => id === item.id ? item : null, detailItemId: item.id, detailReturnPage: "series-watchlist",
    detailData: item.cachedDetails, detailLoading: false, detailError: "", detailEditMode: false, category: () => ({ unit: "episodes", step: 1 }), labelCategory: key => key,
    prefs: {}, roles: { queued: "Watchlist", active: "In Progress", hold: "On Hold", done: "Completed", dropped: "Dropped" }, esc
  });
  assert.match(html, /data-episode-id="future-1"[^>]*disabled/);
  assert.match(html, /Future has not aired yet/);
});
