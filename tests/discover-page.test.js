"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../frontend/pages/discover.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(__dirname, "../frontend/index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
const discoverCss = fs.readFileSync(path.join(__dirname, "../frontend/styles/demo-pages.css"), "utf8");
const window = {};
vm.runInNewContext(source, vm.createContext({ window, String, Array, Number, Object }));

test("Discover result cards show available genre chips and preserve escaped card data", () => {
  const html = window.SplitAppDiscoverCards.card({
    category: "series", title: "A <show>", year: "2024-05-01", image: "https://img.example/poster.jpg",
    rating: 8.2, genres: ["Drama", "Comedy", "Drama"]
  }, 3, { saved: true });
  assert.match(html, /discover-catalog-type[^>]*>SHOW/);
  assert.match(html, /discover-catalog-rating[^>]*>★ 8\.2/);
  assert.match(html, /A &lt;show&gt;/);
  assert.match(html, /discover-catalog-genres[^>]*aria-label="Genres: Drama, Comedy"[^>]*><span>Drama<\/span><span>Comedy<\/span>/);
  assert.doesNotMatch(html, />Drama<\/span><span>Comedy<\/span><span>Drama</);
  assert.match(html, /discover-catalog-add is-saved/);
});

test("Discover loading cards reserve poster, badges, add control, title, year and genre-chip positions", () => {
  const html = window.SplitAppDiscoverCards.loading({ count: 6 });
  assert.match(html, /discover-catalog-grid discover-catalog-loading/);
  assert.equal((html.match(/class="discover-catalog-card"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-skeleton-poster"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-skeleton-type"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-skeleton-rating"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-skeleton-title"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-skeleton-year"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-catalog-genres"/g) || []).length, 6);
  assert.equal((html.match(/<i><\/i><i><\/i>/g) || []).length, 6);
  assert.equal((html.match(/class="discover-catalog-add"/g) || []).length, 6);
  assert.match(html, /aria-hidden="true"/);
});

test("Discover suggestion placeholders retain Latest and Trending shelf headings", () => {
  const html = window.SplitAppDiscoverCards.loading({ sections: [["Latest", 3], ["Trending", 3]] });
  assert.match(html, /discover-catalog-loading-sections/);
  assert.match(html, /<h2>Latest<\/h2>/);
  assert.match(html, /<h2>Trending<\/h2>/);
  assert.equal((html.match(/class="discover-catalog-section"/g) || []).length, 2);
  assert.equal((html.match(/class="discover-catalog-card"/g) || []).length, 6);
  assert.equal((html.match(/class="discover-catalog-genres"/g) || []).length, 6);
});

test("Discover input, keyboard action and Search button share the native form submit path", () => {
  assert.match(indexHtml, /<form[^>]*id="discover-top-search"[^>]*data-discover-search-form[^>]*role="search"/);
  assert.match(indexHtml, /id="discover-query"[^>]*type="search"[^>]*enterkeyhint="search"/);
  assert.match(indexHtml, /<button[^>]*type="button"[^>]*data-discover-clear/);
  assert.match(indexHtml, /<button[^>]*type="submit"[^>]*data-discover-submit/);
  assert.match(appSource, /\$\("#discover-top-search"\)\.addEventListener\("submit"/);
  assert.match(appSource, /event\.currentTarget\.querySelector\("#discover-query"\)\?\.blur\(\)/);
  assert.match(appSource, /requestKey = `\$\{discoverQuery\.trim\(\)\.toLocaleLowerCase\(\)\}\\u0000\$\{category\}\\u0000\$\{discoverSource\}`/);
  assert.doesNotMatch(appSource, /event\.target\.id === "discover-query" && \(event\.key === "Enter"/);
});

test("Discover search bar keeps its controls visible, sized, and focused on narrow screens", () => {
  assert.match(discoverCss, /\.topbar \.discover-top-search \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0,1fr\) auto;[^}]*min-width: 0;/s);
  assert.match(discoverCss, /\.discover-top-search\[hidden\] \{ display: none; \}/);
  assert.match(discoverCss, /\.discover-top-search \.discover-search-action:focus-visible \{ outline:/);
  assert.match(discoverCss, /\.discover-top-search \.discover-search-submit \{ display: inline-flex;[^}]*min-width: 96px;/);
});
