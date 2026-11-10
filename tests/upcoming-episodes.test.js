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
  // Unaired episodes get a countdown instead of a check button, so they cannot be marked watched.
  assert.match(html, /class="episode-countdown"/);
  assert.doesNotMatch(html, /data-episode-id="future-1"/);
  assert.doesNotMatch(html, /data-episode-toggle="future-1"/);
});

test("episodes after the last announced date are TBD (not watchable); undated gaps and fully undated series stay watchable", () => {
  const source = fs.readFileSync(path.join(root, "frontend/components/library.js"), "utf8");
  const window = {};
  vm.runInContext(source, vm.createContext({ window, WeakMap, WeakSet, Date, Number, String, Math, Set, Array, Object }));
  const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const mk = (n, airdate) => ({ id: `e${n}`, season: 1, number: n, airdate });
  const eps = [...[1, 2, 3, 4, 5, 6].map(n => mk(n, day(-60 + n))), ...[7, 8, 9, 10].map(n => mk(n, day((n - 6) * 7))), mk(11, ""), mk(12, "")];
  const item = { id: "s", cachedDetails: { sections: [{ kind: "episodes", items: eps }] }, watchedEpisodeIds: [] };
  window.SplitAppLibrary.episodeInfo(item);
  assert.deepEqual(eps.map(e => window.SplitAppLibrary.isUpcoming(e)), [false, false, false, false, false, false, true, true, true, true, true, true]);
  assert.equal(window.SplitAppLibrary.isUnannounced(eps[10]), true);
  assert.equal(window.SplitAppLibrary.isUnannounced(eps[8]), false, "a dated future episode is upcoming, not TBD");
  const gap = [mk(1, day(-30)), mk(2, ""), mk(3, day(-20))];
  window.SplitAppLibrary.annotateEpisodes(gap);
  assert.deepEqual(gap.map(e => window.SplitAppLibrary.isUpcoming(e)), [false, false, false]);
  const undated = [mk(1, ""), mk(2, ""), mk(3, "")];
  window.SplitAppLibrary.annotateEpisodes(undated);
  assert.deepEqual(undated.map(e => window.SplitAppLibrary.isUpcoming(e)), [false, false, false]);
  const details = fs.readFileSync(path.join(root, "frontend/pages/details.js"), "utf8");
  assert.match(details, /return "TBD"/);
  assert.match(details, /annotateEpisodes\?\.\(rows\)/);
});

test("session poster cache is bounded, never revokes a poster that is on screen, and is O(1)", () => {
  const app = fs.readFileSync(path.join(root, "frontend/app.js"), "utf8");
  const body = app.slice(app.indexOf("const thumbKeyIndex = new Map()"), app.indexOf("async function cachedThumbUrls"));
  assert.doesNotMatch(body.slice(body.indexOf("function rememberThumbUrl")), /for \(const \[[^\]]*\] of thumbUrlCache\)/, "no scan over the whole cache per insert");
  const revoked = [], cache = new Map(), index = new Map();
  const onScreen = new Set(["blob:0", "blob:1"]);
  const remember = new Function("thumbUrlCache", "URL", "document", `${body.slice(0, body.indexOf("window.addEventListener"))}; return rememberThumbUrl;`)(cache, { revokeObjectURL: url => revoked.push(url) }, { images: [...onScreen].map(src => ({ src })) });
  // thousands of posters: the cache stays bounded and posters that are on screen are never released
  for (let i = 0; i < 5000; i++) remember(`${i}:p`, "sig", `blob:${i}`);
  assert.ok(cache.size <= 900, `cache bounded (${cache.size})`);
  assert.ok(cache.has("0:p|sig") && cache.has("1:p|sig"), "on-screen posters survive eviction");
  assert.ok(!revoked.includes("blob:0") && !revoked.includes("blob:1"));
  assert.ok(revoked.length > 4000);
  revoked.length = 0;
  // two reads of the same poster finish together: the URL already handed out survives, the extra one is dropped
  assert.equal(remember("4999:p", "sig", "blob:duplicate"), "blob:4999");
  assert.deepEqual(revoked, ["blob:duplicate"]);
  // the artwork itself changed (new signature): the old URL is released and replaced
  assert.equal(remember("4999:p", "sig2", "blob:new"), "blob:new");
  assert.ok(revoked.includes("blob:4999"));
  assert.equal(cache.has("4999:p|sig"), false);
  assert.match(app, /window\.addEventListener\("pagehide", \(\) => \{ for \(const url of thumbUrlCache\.values\(\)\) URL\.revokeObjectURL/);
});

test("large collections are windowed: the page draws a placeholder grid and only the rows near the screen", () => {
  const profile = fs.readFileSync(path.join(root, "frontend/pages/profile.js"), "utf8"), app = fs.readFileSync(path.join(root, "frontend/app.js"), "utf8");
  assert.match(profile, /VIRTUAL_MIN = 80/);
  assert.match(profile, /data-virtual-grid="\$\{id\}" data-virtual-total=/);
  assert.doesNotMatch(profile, /filtered\.slice\(0, visibleCount\)/, "the whole filtered list is windowed, not truncated");
  assert.match(profile, /const more = ""/);
  for (const piece of ["function mountVirtualGrids", "function updateVirtualGrid", "gridAutoRows", "paddingTop", "paddingBottom", "window.addEventListener(\"scroll\", scheduleVirtualUpdate", "mountVirtualGrids(content)"]) assert.ok(app.includes(piece), piece);
});
