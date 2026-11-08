"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "frontend/app.js"), "utf8");
const settings = fs.readFileSync(path.join(root, "frontend/pages/settings.js"), "utf8");
const motion = fs.readFileSync(path.join(root, "frontend/styles/motion.css"), "utf8");

test("Animation settings expose every implemented motion and loading style", () => {
  for (const option of [
    '"slow|Slow"', '"zoom|Zoom"', '"scale|Scale"', '"fade|Fade"',
    '"snappy|Snappy"', '"spring|Spring"', '"pulse|Soft pulse"', '"static|Static"'
  ]) assert.ok(settings.includes(option), `setting includes ${option}`);
  assert.match(settings, /"Progress style", "progressStyle", "select"/);
  assert.match(settings, /"Placeholder animation", "placeholderAnimation", "select"/);
  assert.match(settings, /sheetAnimation: "Choose how menus and dialogs open and close\."/);
});

test("Motion preference values are normalized, applied to CSS hooks and restored by reset", () => {
  for (const allowed of [
    '"off", "fast", "normal", "slow"', '"slide", "fade", "zoom", "none"',
    '"slide", "fade", "scale"', '"shrink", "fade", "none"',
    '"smooth", "snappy", "spring"', '"shimmer", "pulse", "static"'
  ]) assert.ok(app.includes(allowed), `runtime accepts ${allowed}`);
  assert.match(app, /progressStyle: "smooth"/);
  assert.match(app, /placeholderAnimation: "shimmer"/);
  assert.match(app, /progressStyle: prefs\.progressStyle/);
  assert.match(app, /placeholderAnim: placeholderAnimation/);
  assert.match(app, /"progressStyle", "skeletonShimmer", "placeholderAnimation"/);
});

test("CSS links each new animation choice and preserves accessibility/performance guards", () => {
  for (const selector of [
    "body[data-page-anim=zoom]", "body[data-sheet-anim=scale]", "body[data-press=fade]",
    "body[data-progress-style=snappy]", "body[data-progress-style=spring]", "body[data-placeholder-anim=pulse]"
  ]) assert.ok(motion.includes(selector), `motion CSS has ${selector}`);
  assert.match(motion, /body\[data-reduced-motion=true\][\s\S]*?animation:none!important;transition:none!important/);
  assert.match(motion, /html\[data-perf="low"\][^\n]*\[class\*=skeleton\][^\n]*animation:none!important/);
  assert.match(motion, /html\[data-perf=mid\]\[data-lowend=true\] body\[data-reduced-motion=false\]\[data-placeholder-anim=pulse\]/);
  assert.match(motion, /html\[data-lowend=true\] body\[data-nav-dir\] #page-content\.page-route-enter\{animation-duration:110ms\}/);
  assert.doesNotMatch(motion, /html\[data-lowend=true\] body\[data-nav-dir\] #page-content\.page-route-enter\{animation-name:sp-fade/);
});

test("new animation picker glyphs exist in the bundled Lucide library", () => {
  const icons = require(path.join(root, "frontend/lucide.min.js")).icons;
  for (const name of ["turtle", "zoom-in", "maximize-2", "scan-eye", "waves", "zap", "activity", "sparkles", "circle-dot", "pause"]) {
    const exportName = name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()).replace(/^./, char => char.toUpperCase());
    assert.ok(icons[exportName], `Lucide icon exists: ${name}`);
  }
});
