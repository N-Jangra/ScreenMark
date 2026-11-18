"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("0.2.0 changelog, docs and version metadata agree", () => {
  assert.equal(JSON.parse(read("package.json")).version, "0.2.0");
  assert.match(read("frontend/app-config.js"), /"version": "0\.2\.0"/);
  assert.match(read("android/app/build.gradle"), /versionName "0\.2\.0"/);
  assert.match(read("android/app/build.gradle"), /versionCode 200/);
  assert.match(read("CHANGELOG.md"), /## \[0\.2\.0\] — 2026-11-18/);
  assert.match(read("README.md"), /# ScreenMark 0\.2\.0/);
  assert.match(read("docs/README.md"), /ScreenMark 0\.2\.0/);
  assert.match(read("docs/storage.md"), /Profile sections, swipes and achievements \(0\.2\.0\)/);
});
