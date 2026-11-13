"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const settings = fs.readFileSync(path.join(__dirname, "../frontend/pages/settings.js"), "utf8");
const sourceOptions = settings.slice(settings.indexOf("function renderSourceOptions()"), settings.indexOf("function renderMetadataSources()"));

test("source options omit helper text and empty help rows", () => {
  assert.ok(sourceOptions.includes('${help ? `<small>${help}</small>` : ""}'));
  for (const text of [
    "Leave blank for the default. Choose a mirror below if needed.",
    "Tap a host to use it as the domain.",
    "Sent with requests. Leave blank for the device default.",
    "Only needed if this source requires a session.",
    "Browsers ignore custom User-Agent and cookies. Use Android or local preview."
  ]) assert.ok(!sourceOptions.includes(text), `unexpected helper text: ${text}`);
});

test("source options do not expose the full device User-Agent in its placeholder", () => {
  assert.ok(sourceOptions.includes('input("userAgent", "User-Agent header", "Default User-Agent"'));
  assert.doesNotMatch(sourceOptions, /Default: \\$\{navigator\.userAgent\}/);
  assert.ok(sourceOptions.includes('data-source-option="${esc(source.key)}|${field}" value="${esc(options[field] || "")}"'));
});
