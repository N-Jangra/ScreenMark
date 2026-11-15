"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const styles = fs.readFileSync(path.join(__dirname, "..", "frontend", "styles", "demo-pages.css"), "utf8");
const addPage = fs.readFileSync(path.join(__dirname, "..", "frontend", "pages", "add.js"), "utf8");
const start = styles.indexOf("/* Let the Add header bleed through");
const end = styles.indexOf("body[data-page=\"settings\"] .cs-page", start);
const addHeader = styles.slice(start, end);

test("Add header stretches past the shared child max-width and matches settings subpage geometry", () => {
  assert.ok(start >= 0 && end > start, "Add header override exists");
  assert.match(addHeader, /width:\s*calc\(100% \+ var\(--gutter,16px\) \* 2\)/);
  assert.match(addHeader, /max-width:\s*none/);
  assert.match(addHeader, /min-height:\s*64px/);
  assert.match(addHeader, /grid-template-columns:\s*minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(addHeader, /padding:\s*calc\(8px \+ env\(safe-area-inset-top\)\)/);
});

test("Add page always renders bottom Cancel and Save actions, with Delete only while editing", () => {
  assert.match(addPage, /<div class="add-entry-footer">\$\{editingItem \? `[^`]*Delete title[^`]*` : ""\}<button[^>]*data-cancel-add[^>]*>Cancel<\/button><button[^>]*data-save-item[^>]*>\$\{editingItem \? "Save changes" : "Save title"\}/);
  assert.match(styles, /body\[data-page="add"\] \.add-entry-footer \{ position: sticky; bottom: calc\(64px \+ env\(safe-area-inset-bottom\)\)/);
});
