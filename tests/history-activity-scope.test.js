"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "frontend", "app.js"), "utf8");
const timeline = fs.readFileSync(path.join(root, "frontend", "pages", "timeline.js"), "utf8");
const statistics = fs.readFileSync(path.join(root, "frontend", "pages", "statistics.js"), "utf8");

test("clearing library history explains that Timeline and Statistics Activity share those records", () => {
  assert.match(timeline, /const \{ history, items/);
  assert.match(statistics, /history: allHistory/);
  assert.match(app, /same events will disappear from Timeline and Statistics → Activity/);
  assert.match(app, /appConfirm\([\s\S]*?title: "Clear activity history"[\s\S]*?confirmLabel: "Clear history"/);
  assert.match(app, /historyJournalRevision \+= 1;[\s\S]*?history = \[\];[\s\S]*?clearJournal\?\.\("history"\)/);
  assert.match(app, /readRevision === historyJournalRevision/);
});
