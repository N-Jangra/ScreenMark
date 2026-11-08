"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const gif = fs.readFileSync(path.join(root, "frontend/icons/episode-stack-intro.gif"));
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");

test("launch intro has no GIF repeat extension and keeps the single-play delay", () => {
  assert.equal(gif.toString("latin1").includes("NETSCAPE2.0"), false);
  assert.match(html, /introMs\s*=\s*reducedMotion\s*\?\s*0\s*:\s*3430/);
  assert.match(html, /readyGapMs\s*=\s*500/);
});
