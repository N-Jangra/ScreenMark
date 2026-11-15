"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");

test("metadata network workers do not wait for each debounced native/local persistence write", () => {
  const start = app.indexOf("async function startMetadataSync");
  const end = app.indexOf("let automaticMetadataCheckAt", start);
  assert.ok(start >= 0 && end > start);
  const source = app.slice(start, end);
  assert.match(source, /lastLibraryPersist = persist\(\{ ids: \[item\.id\] \}\)/);
  assert.match(source, /await lastLibraryPersist/);
  assert.doesNotMatch(source, /await persist\(\{ ids: \[item\.id\] \}\)/);
});
