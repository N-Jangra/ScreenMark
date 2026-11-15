"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function load() {
  const window = { SplitAppLibrary: { episodeInfo: item => ({ done: (item.watchedEpisodeIds || []).length, total: item.goal || 0 }) } };
  const context = vm.createContext({ window, Date, Map, Set, Object, Array, String, Number, Math, JSON });
  vm.runInContext(read("frontend/pages/achievements.js"), context);
  return window;
}
test("Achievements count local watched progress and expose linked badge detail pages", () => {
  const window = load(), items = [
    { id: "m", category: "movie", title: "A movie", status: "Completed", favorite: true, rating: 5 },
    { id: "s", category: "series", title: "A series", status: "Watching", goal: 25, watchedEpisodeIds: Array.from({ length: 25 }, (_, i) => `ep-${i}`) }
  ];
  const rows = window.SplitAppAchievements.entries(items, { done: "Completed" }), by = id => rows.find(row => row.id === id);
  assert.equal(by("first-title-t1").unlocked, true);
  assert.equal(by("first-title-t2").unlocked, false);
  assert.equal(by("movie-fan-5-t1").current, 1);
  assert.equal(by("episode-25-t1").unlocked, true);
  assert.equal(by("episode-25-t1").tier, "bronze");
  assert.equal(by("favorite-five-t1").current, 1);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, "every achievement has its own id");
  for (const row of rows) assert.match(read(`frontend/${row.asset}`), /<svg/);
  assert.equal(by("collect-1").unlocked, true, "badge-count achievements follow unlocked badges");
  assert.equal(by("medal-bronze-1").unlocked, true);
  assert.equal(by("medal-gold-3").unlocked, false);
  assert.equal(by("level-2").unlocked, window.SplitAppAchievements.progression(rows).level >= 2);
  const unlocked = rows.filter(row => row.unlocked);
  assert.equal(window.SplitAppAchievements.unlocks(items, { done: "Completed" }).length, unlocked.length);
  assert.equal(window.SplitAppAchievements.progression(rows).earned, unlocked.length);
  const home = window.SplitAppPages.achievements({ items, roles: { done: "Completed" }, esc, achievementId: "" });
  assert.match(home, /href="#achievements\/g-medals"[^>]*>View all/);
  const group = window.SplitAppPages.achievements({ items, roles: { done: "Completed" }, esc, achievementId: "g-watching" });
  assert.match(group, /ach-grid/);
  assert.match(group, /is-locked/);
  const detail = window.SplitAppPages.achievements({ items, roles: { done: "Completed" }, esc, achievementId: "a-episode-25-t1" });
  assert.match(detail, /Unlocked/);
  assert.match(detail, /Rarity/);
  assert.match(detail, /href="#achievements\/g-watching"/);
  assert.match(read("frontend/pages/profile.js"), /href="#achievements"[\s\S]*?Achievements/);
  assert.match(read("frontend/index.html"), /pages\/achievements\.js/);
  assert.match(read("frontend/app.js"), /achievements: "Achievements"/);
});

test("achievement baseline waits for successful startup restore and persists earned tier IDs", () => {
  const app = read("frontend/app.js"), finish = app.indexOf("async function finishStartup(success)"), guard = app.indexOf("if (!success)", finish), baseline = app.indexOf("initializeAchievementAwards();", guard);
  assert.ok(finish > 0 && guard > finish && baseline > guard);
  assert.match(app, /function initializeAchievementAwards\(\)\s*\{\s*if \(achievementAwardsReady\) return;/);
  assert.match(app, /function persist\(scope\)\s*\{\s*detectAchievementAwards\(\);/);
  assert.match(app, /localStorage\.setItem\(achievementAwardsKey, JSON\.stringify\(\[\.\.\.new Set\(\[\.\.\.seen, \.\.\.current\]\)\]\)\)/);
});
