"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const launchTheme = fs.readFileSync(path.join(root, "android/app/src/main/res/values/styles.xml"), "utf8");

test("Android launch theme leaves the icon animation to the JS intro", () => {
  assert.match(launchTheme, /name="windowSplashScreenAnimatedIcon">@android:color\/transparent/);
  assert.match(launchTheme, /name="windowSplashScreenBackground">#08090c/);
  assert.match(launchTheme, /name="postSplashScreenTheme">@style\/AppTheme\.NoActionBar/);
  assert.doesNotMatch(launchTheme, /@drawable\/splash/);
});
