"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const settings = fs.readFileSync(path.join(__dirname, "../frontend/pages/settings.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "../frontend/styles/ui-polish.css"), "utf8");

test("status manager uses accessible icon-only show/hide and add actions with one-pass title counts", () => {
  const line = settings.split("\n").find(row => row.includes('settingsGroup === "status-manager"'));
  assert.ok(line);
  assert.match(line, /status-icon-action/);
  assert.match(line, /aria-label="\$\{hidden\.includes\(name\) \? "Show" : "Hide"\} \$\{esc\(name\)\}"/);
  assert.match(line, /data-lucide="\$\{hidden\.includes\(name\) \? "eye" : "eye-off"\}"/);
  assert.match(line, /aria-label="Add status"/);
  assert.match(line, /data-lucide="plus"/);
  assert.ok(line.includes('aria-label="Save ${esc(name)}"'));
  assert.match(line, /data-lucide="save"/);
  assert.ok(line.includes('aria-label="Remove ${esc(name)}"'));
  assert.match(line, /data-lucide="trash-2"/);
  assert.match(line, /countByStatus = new Map\(\)/);
  assert.doesNotMatch(line, />\$\{hidden\.includes\(name\) \? "Show" : "Hide"\}<\/button>/);
  assert.doesNotMatch(line, />Add<\/button>/);
  assert.match(styles, /\.status-icon-action[^\n]*width:44px/);
});
