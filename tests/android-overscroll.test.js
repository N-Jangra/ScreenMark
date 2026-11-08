"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const activity = fs.readFileSync(path.join(root, "android/app/src/main/java/com/cuemark/screenmark/MainActivity.java"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "frontend/app.js"), "utf8");
const ptrStyles = fs.readFileSync(path.join(root, "frontend/styles/details.css"), "utf8");

test("Android disables whole-WebView edge stretching while leaving normal scrolling available", () => {
  assert.match(activity, /setOverScrollMode\(View\.OVER_SCROLL_NEVER\)/);
  assert.match(styles, /html\s*\{[^}]*overscroll-behavior-y\s*:\s*none/s);
  assert.match(styles, /\.bottom-bar\s*\{[^}]*position:\s*fixed/s);
});

test("custom pull-to-refresh still moves content and consumes the gesture in app pages", () => {
  assert.match(app, /if \(event\.cancelable\) event\.preventDefault\(\)/);
  assert.match(app, /target\.style\.setProperty\("--ptr-push", `\$\{offset\}px`\)/);
  assert.match(ptrStyles, /\.ptr-content\s*\{\s*transform:\s*translate3d\(0,var\(--ptr-push,0px\),0\)/);
});
