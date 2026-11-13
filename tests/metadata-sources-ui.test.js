"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const settings = fs.readFileSync(path.join(root, "frontend/pages/settings.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/styles/demo-pages.css"), "utf8");

const renderSources = settings.slice(settings.indexOf("function renderMetadataSources()"), settings.indexOf("function formatBytes(", settings.indexOf("function renderMetadataSources()")));
const themeStyles = styles.slice(styles.indexOf("/* Metadata source manager and provider options"), styles.indexOf("/* Custom source form", styles.indexOf("/* Metadata source manager and provider options")));

test("Metadata Sources page keeps only concise, actionable helper text", () => {
  assert.ok(renderSources.includes('pageHeader("Metadata Sources", "metadata", "")'));
  assert.doesNotMatch(renderSources, /Enable sources and drag to reorder/);
  assert.doesNotMatch(renderSources, /Choose which catalogs to search|Enable catalogs for discovery|Your order is used by the source picker|<h2 class="settings-section-title">Sources<\/h2>/);
  assert.ok(renderSources.includes("No custom sources"));
  assert.doesNotMatch(renderSources, /Add any website or API that returns JSON and use it for search/);
});

test("Metadata source cards and controls use active theme tokens", () => {
  for (const token of ["var(--legacy-text,#111827)", "var(--surface)", "var(--surface-2)", "var(--line)", "var(--muted)", "var(--accent)"]) {
    assert.ok(themeStyles.includes(token), `theme styles include ${token}`);
  }
  assert.doesNotMatch(themeStyles, /color:\s*var\(--text\)/);
  assert.match(themeStyles, /metadata-source-filter\.active[\s\S]*?background: var\(--accent\)/);
});
