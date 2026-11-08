"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const listUi = fs.readFileSync(path.join(root, "frontend/components/share.js"), "utf8");
const titleUi = fs.readFileSync(path.join(root, "frontend/components/share-title.js"), "utf8");
const css = fs.readFileSync(path.join(root, "frontend/styles/ui-polish.css"), "utf8");

test("list and title share dialogs expose PDF view, theme and preview controls", () => {
  assert.match(listUi, /data-share-layout><option value="list">List<\/option><option value="grid">Poster grid/);
  assert.match(listUi, /data-share-theme><option value="app">App theme/);
  assert.match(listUi, /data-share-title-page/);
  assert.match(listUi, /data-share-preview-page/);
  assert.match(titleUi, /data-share-theme/);
  assert.match(titleUi, /value="compact"[\s\S]*?Compact report/);
  assert.match(titleUi, /data-share-preview/);
  assert.match(titleUi, /theme: snapshot\.theme, layout: snapshot\.layout/);
  assert.match(css, /\.share-list-preview-page\.is-grid/);
  assert.match(css, /\.share-title-preview img/);
});

test("list PDF builder generates list, poster-grid and optional title pages", async () => {
  const context = {
    window: {},
    document: { createElement: () => ({ getContext: () => ({ font: "", measureText: value => ({ width: String(value).length * 5 }) }) }) },
    performance: { now: () => 1 },
    Uint8Array, Map, Math, String, Number, Array, Set, Promise, Object, JSON
  };
  context.window.SplitAppPerf = {
    state: { level: 0 },
    tracker: () => ({ step() {}, advance() {}, shouldSwitch: () => false, switched() {} }),
    scale: () => 1,
    jpegBytes: async () => new Uint8Array()
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "frontend/components/share-list-pdf.js"), "utf8"), context);
  const entries = Array.from({ length: 10 }, (_, index) => ({ title: `Series ${index + 1}`, tags: "Drama", progress: "2 / 8" }));
  const base = { title: "My List", entries, covers: entries.map(() => null), theme: { page: "rgb(255,255,255)", text: "rgb(10,10,10)", muted: "rgb(90,90,90)", line: "rgb(220,220,220)", accent: "rgb(30,90,180)", card2: "rgb(245,245,245)" } };
  const list = await context.window.SplitAppListPdf.build({ ...base, layout: "list" });
  const grid = await context.window.SplitAppListPdf.build({ ...base, layout: "grid" });
  const titledGrid = await context.window.SplitAppListPdf.build({ ...base, layout: "grid", titlePage: true });
  assert.equal(list.pages, 1);
  assert.equal(grid.pages, 2);
  assert.equal(titledGrid.pages, 3);
  for (const result of [list, grid, titledGrid]) assert.match(new TextDecoder().decode(result.bytes), /%%EOF$/);
});
