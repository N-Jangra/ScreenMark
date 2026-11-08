"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const window = {
  SplitAppLibrary: {
    episodeInfo: () => ({
      next: { id: "ep-205", season: 2, number: 5, title: "Next episode", image: "https://img.example/episode.jpg", airdate: "2020-01-01" },
      done: 4,
      total: 10
    })
  }
};
vm.runInNewContext(fs.readFileSync(path.join(root, "frontend/pages/profile.js"), "utf8"), vm.createContext({ window }));

test("watchlist poster view renders portrait series art with episode and progress overlays", () => {
  const html = window.SplitAppPages["series-watchlist"]({
    items: [{ id: "show-1", title: "Example Show", category: "series", status: "In Progress", progress: 4, image: "https://img.example/poster.jpg" }],
    esc: value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    roles: { active: "In Progress", done: "Completed", queued: "Watchlist", hold: "On Hold" },
    watchlistView: "posters"
  });

  assert.match(html, /watchlist-content is-posters/);
  assert.match(html, /watchlist-card is-poster-view/);
  assert.match(html, /src="https:\/\/img\.example\/poster\.jpg"/);
  assert.doesNotMatch(html, /src="https:\/\/img\.example\/episode\.jpg"/);
  assert.match(html, /watchlist-poster-episode[^>]*>S02 · E05</);
  assert.match(html, /watchlist-poster-title[^>]*>Example Show</);
  assert.match(html, /watchlist-poster-progress-count[^>]*>4 \/ 10 eps</);
  assert.match(html, /watchlist-poster-progress[^>]*><i[^>]*width:40%/);
});

test("watchlist poster CSS defines a portrait grid and overlays instead of list rows", () => {
  const css = fs.readFileSync(path.join(root, "frontend/styles/demo-pages.css"), "utf8");
  assert.match(css, /\.watchlist-content\.is-posters \.watchlist-section \{ grid-template-columns: repeat\(auto-fill,minmax\(108px,1fr\)\)/);
  assert.match(css, /\.watchlist-card\.is-poster-view \{[^}]*aspect-ratio: 2 \/ 3/s);
  assert.match(css, /\.watchlist-poster-episode/);
  assert.match(css, /\.watchlist-poster-progress > i/);
});
