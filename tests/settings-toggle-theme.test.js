"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "../frontend/styles/demo-pages.css"), "utf8");
const iosCss = fs.readFileSync(path.join(__dirname, "../frontend/styles/ios-ui.css"), "utf8");

test("all settings and subsettings switches share theme-token styling", () => {
  assert.match(css, /body\[data-page="settings"\] \.settings-page \.toggle input\[role="switch"\]/);
  assert.match(css, /background: var\(--surface-2\) !important/);
  assert.match(css, /border: 1px solid var\(--line\) !important/);
  assert.match(css, /background: var\(--accent\) !important/);
  assert.match(css, /:focus-visible[\s\S]*?outline: 2px solid var\(--accent\)/);
});

test("switch track and thumb dimensions remain consistent across themes", () => {
  assert.match(css, /width: 52px !important;\s*min-height: 34px !important/);
  assert.match(css, /width: 52px !important;\s*height: 32px !important/);
  assert.match(css, /width: 24px !important;\s*height: 24px !important/);
  assert.match(css, /transform: translateX\(20px\) !important/);
  assert.doesNotMatch(css + iosCss, /body\[data-theme="(?:dark|amoled)"\] \.toggle input\[role="switch"\].*(?:51px|#3f3f46)/);
  assert.doesNotMatch(iosCss, /body\[data-theme="(?:dark|amoled)"\] \.metadata-source-row \.toggle/);
  assert.doesNotMatch(iosCss, /\.source-enable-card \.toggle input\[role="switch"\]/);
});
