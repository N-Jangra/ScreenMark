"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");

test("launch intro plays once as video and keeps the single-play delay", () => {
  for (const file of ["icons/episode-stack-intro", "splash/stack-draw", "splash/fan-flip", "splash/card-deal"]) {
    for (const ext of ["mp4", "webm", "jpg"]) assert.ok(fs.existsSync(path.join(root, "frontend", `${file}.${ext}`)), `${file}.${ext}`);
  }
  assert.doesNotMatch(html, /video\.loop\s*=\s*true/);
  assert.match(html, /a:\s*3430/);
  assert.match(html, /introMs\s*=\s*reducedMotion\s*\?\s*0\s*:\s*SPLASH_MS\[style\]/);
  assert.match(html, /readyGapMs\s*=\s*500/);
});
