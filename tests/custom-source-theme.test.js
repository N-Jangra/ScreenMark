"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const styles = fs.readFileSync(path.join(__dirname, "..", "frontend", "styles", "demo-pages.css"), "utf8");
const start = styles.indexOf("/* Custom source form: reserve clear space");
const themeStyles = styles.slice(start);

test("custom source page controls and cards follow the active theme", () => {
  assert.ok(start >= 0, "custom source page style block exists");
  for (const selector of [".cs-page .cs-step", ".cs-page .cs-field input", ".cs-page .cs-types .ios-pill", ".cs-page .cs-bar", ".cs-page .cs-test:not(:empty)", ".cs-page .cs-hero-icon"]) {
    assert.ok(themeStyles.includes(selector), `theme styles include ${selector}`);
  }
  for (const token of ["var(--legacy-text", "var(--surface)", "var(--surface-2)", "var(--line)", "var(--muted)", "var(--accent)"]) {
    assert.ok(themeStyles.includes(token), `theme styles use ${token}`);
  }
  assert.match(themeStyles, /\.cs-types \.ios-pill\.active[\s\S]*?background: var\(--accent-soft\)/);
  assert.match(themeStyles, /\.cs-hero-icon \{ color: var\(--accent-foreground/);
  assert.match(themeStyles, /\.cs-bar \.button\.primary \{ background: var\(--accent\); color: var\(--accent-foreground/);
  assert.match(themeStyles, /\.cs-bar \.button\.secondary[\s\S]*?color: var\(--legacy-text/);
});
