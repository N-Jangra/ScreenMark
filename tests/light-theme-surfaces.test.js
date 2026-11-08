"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pages = fs.readFileSync(path.join(root, "frontend/styles/demo-pages.css"), "utf8");
const details = fs.readFileSync(path.join(root, "frontend/styles/details.css"), "utf8");

test("Light theme profile controls and detail cards use light surface tokens", () => {
  const lightRules = pages.slice(pages.indexOf('body[data-theme="light"] {'), pages.indexOf('body[data-page="discover"] .app-shell'));
  assert.match(lightRules, /body\[data-theme="light"\] \.profile-filter-bar[\s\S]*?background:\s*rgba\(255,255,255/);
  assert.match(lightRules, /body\[data-theme="light"\] \.profile-filter-icon[\s\S]*?background:\s*var\(--d-elev\)/);
  assert.match(lightRules, /body\[data-theme="light"\] \.profile-filter-genres button[\s\S]*?text-shadow:\s*none/);
  assert.match(lightRules, /body\[data-theme="light"\] \.demo-cinema-page \.season-accordion-row[\s\S]*?background:\s*var\(--d-surface\)/);
});

test("Light theme watchlist refresh indicator uses a light surface", () => {
  assert.match(details, /body\[data-theme="light"\]:is\(\[data-page="series-watchlist"\],\[data-page="movie-watchlist"\]\) \.ptr\s*\{[^}]*background:\s*linear-gradient\(145deg,var\(--d-surface\),var\(--d-elev\)\)/);
});
