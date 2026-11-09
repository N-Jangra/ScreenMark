"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const iosStyles = fs.readFileSync(path.join(root, "frontend/styles/ios-ui.css"), "utf8");
const demoStyles = fs.readFileSync(path.join(root, "frontend/styles/demo-pages.css"), "utf8");
const polishStyles = fs.readFileSync(path.join(root, "frontend/styles/ui-polish.css"), "utf8");
const app = fs.readFileSync(path.join(root, "frontend/app.js"), "utf8");

test("theme CSS does not override the selected light or dark accent", () => {
  for (const theme of ["light", "dark"]) {
    const rule = iosStyles.match(new RegExp(`body\\[data-theme=${theme}\\]\\s*\\{([^}]*)\\}`))?.[1] || "";
    assert.doesNotMatch(rule, /--accent\s*:/);
    assert.doesNotMatch(rule, /--accent-soft\s*:/);
  }
  assert.match(app, /const defaultAccentColor = "#f5c518"/);
  assert.match(app, /prefs\.mainColor === "default" \? defaultAccentColor/);
  assert.doesNotMatch(app, /palette\.mode === "light" \? "#6366f1"/);
  assert.match(app, /document\.body\.style\.setProperty\("--accent", accentColor\)/);
  assert.match(app, /light:\["Clean white surfaces with warm gold accents\.","#f8fafc",defaultAccentColor/);
  assert.match(app, /system:\["Match your device's light or dark appearance\.","#f8fafc",defaultAccentColor/);
});

test("settings picker heading shares the options surface in every theme", () => {
  assert.match(polishStyles, /#setting-picker-dialog\s*>\s*\.choice-dialog-header\s*\{[^}]*background:\s*var\(--surface\)!important/);
  assert.match(polishStyles, /#setting-picker-dialog\s*>\s*\.choice-dialog-header\s*\{[^}]*backdrop-filter:\s*none/);
  assert.match(fs.readFileSync(path.join(root, "frontend/styles.css"), "utf8"), /\.setting-picker-option\s*\{[^}]*background:var\(--surface-2\)/);
});

test("the selected accent drives branded page tokens, controls, progress and navigation gradients", () => {
  assert.match(app, /document\.body\.style\.setProperty\("--d-gold", accentColor\)/);
  assert.match(app, /document\.body\.style\.setProperty\("--d-gold-fg", accentForeground\)/);
  assert.match(app, /document\.body\.style\.setProperty\("--d-gold-soft"/);
  assert.match(app, /document\.body\.style\.setProperty\("--legacy-accent", accentColor\)/);
  assert.match(app, /document\.body\.style\.setProperty\("--legacy-glow"/);
  assert.match(app, /document\.documentElement\.style\.setProperty\("--ios-grad"/);
  assert.match(app, /const accentForeground = contrast\(toRgb\(accentColor\), \[255, 255, 255\]\)/);
  assert.match(demoStyles, /\.demo-poster-progress i \{[^}]*background: var\(--d-gold\)/);
  assert.match(demoStyles, /\.season-row-progress i \{[^}]*background: var\(--d-gold\)/);
  assert.match(demoStyles, /\.discover-catalog-artwork \.discover-catalog-add \{[^}]*border: 2px solid var\(--d-gold\)[^}]*color: var\(--d-gold\)/);
  assert.match(demoStyles, /\.stats-subpage \.stats-activity-track i \{ background: var\(--accent\)/);
  assert.doesNotMatch(demoStyles, /\.stats-(?:overview|subpage)\s*\{[^}]*--d-gold\s*:/s);
  assert.doesNotMatch(demoStyles, /\.stats-subpage\s*\{[^}]*--accent\s*:/s);
  const statsSubpageStyles = demoStyles.slice(demoStyles.indexOf('body[data-page="statistics"] .stats-subpage {'), demoStyles.indexOf("/* Keep the Statistics overview", demoStyles.indexOf('body[data-page="statistics"] .stats-subpage {')));
  assert.doesNotMatch(statsSubpageStyles, /#(?:818cf8|6366f1)|rgba\(99,102,241/i);
  assert.match(fs.readFileSync(path.join(root, "frontend/styles/cuemark-legacy.css"), "utf8"), /linear-gradient\(135deg, var\(--accent\), color-mix\(in srgb, var\(--accent\)/);
  const legacyStyles = fs.readFileSync(path.join(root, "frontend/styles/cuemark-legacy.css"), "utf8");
  assert.doesNotMatch(legacyStyles, /linear-gradient\(135deg, var\(--accent\), #[0-9a-f]{3,8}/i);
  assert.match(legacyStyles, /radial-gradient\(circle at top, color-mix\(in srgb, var\(--accent\)/);
});

test("Appearance offers distinct Dark and AMOLED themes plus expanded navigation controls", () => {
  const settings = fs.readFileSync(path.join(root, "frontend/pages/settings.js"), "utf8");
  assert.match(settings, /\["Theme", "theme", "select", \["system\|System", "light\|Light", "dark\|Dark", "amoled\|AMOLED"\]\]/);
  assert.match(app, /dark: \{ mode:"dark", background:"#111827"/);
  assert.match(app, /!\["system", "light", "dark", "amoled"\]\.includes\(prefs\.theme\)/);
  assert.match(settings, /"pill\|Filled pill"/);
  assert.match(settings, /"minimal\|Minimal"/);
  assert.match(settings, /"labels-only\|Names only"/);
  assert.match(app, /body\.dataset\.barStyle = prefs\.bottomBarStyle/);
  assert.ok(settings.includes('"movie-watchlist": ["clapperboard"') && settings.includes('"circle-dot", "star"'));
  const styles = fs.readFileSync(path.join(root, "frontend/styles.css"), "utf8");
  assert.match(styles, /data-bar-labels=labels-only[^}]*display:none/);
  assert.match(styles, /data-bar-style=pill[^}]*background:var\(--accent\)/);
  assert.match(app, /settingPreviewDescriptions\.bottomBarStyle\?\.\[option\.value\]/);
  assert.match(app, /bottomBarStyle: \{ "icon-color": "Tint the selected icon with a soft accent tile\.", underline:/);
});


test("every additional bottom bar icon choice exists in the bundled Lucide set", () => {
  const settings = fs.readFileSync(path.join(root, "frontend/pages/settings.js"), "utf8");
  const block = settings.match(/const choicesByKey = \{([\s\S]*?)\n      \};/)?.[1];
  assert.ok(block, "icon picker choice map exists");
  const icons = require(path.join(root, "frontend/lucide.min.js")).icons;
  const groups = [...block.matchAll(/(?:"([^"]+)"|([a-z-]+)):\s*\[([^\]]+)\]/g)];
  const names = groups.flatMap(match => [...match[3].matchAll(/"([^"]+)"/g)].map(entry => entry[1]));
  assert.ok(names.length >= 100, "expanded choices are available across destinations");
  for (const name of names) {
    const exportName = name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()).replace(/^./, char => char.toUpperCase());
    assert.ok(icons[exportName], `Lucide icon exists: ${name}`);
  }
});
