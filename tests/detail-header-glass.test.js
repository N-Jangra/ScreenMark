"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const styles = fs.readFileSync(path.join(root, "frontend/styles/demo-pages.css"), "utf8");
const details = fs.readFileSync(path.join(root, "frontend/pages/details.js"), "utf8");

test("mobile title, movie, episode, cast and character controls float over the hero", () => {
  const mobileRules = styles.slice(styles.indexOf("/* On phones, keep title and provider controls"));
  assert.match(mobileRules, /@media\s*\(max-width:\s*767px\)/);
  assert.match(mobileRules, /demo-cinema-page\.demo-title-page\s+\.demo-detail-heading/);
  assert.match(mobileRules, /demo-cinema-page\.demo-ref-page\s*>\s*\.demo-detail-heading/);
  assert.match(mobileRules, /background:\s*transparent\s*!important/);
  assert.match(mobileRules, /min-height:\s*40px/);
  assert.match(mobileRules, /html\[data-lowend="true"\]/);
  assert.match(details, /demo-title-page \$\{item\.category === "series" \? "demo-show-page" : "demo-movie-page"\}/);
  assert.match(details, /demo-ref-page demo-\$\{esc\(kind \|\| "detail"\)\}-page/);
  assert.match(details, /data-detail-back/);
});
