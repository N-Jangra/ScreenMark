"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const html = fs.readFileSync(path.join(frontend, "index.html"), "utf8");
const localAsset = value => value.split(/[?#]/, 1)[0];
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [path.relative(frontend, absolute).split(path.sep).join("/")];
});

test("all local script, stylesheet, icon, and manifest links in index.html resolve", () => {
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  const missing = references
    .filter(reference => !/^(?:[a-z]+:|\/\/|#)/i.test(reference))
    .map(localAsset)
    .filter(reference => reference && !fs.existsSync(path.join(frontend, reference)));
  assert.deepEqual(missing, []);
});

test("all linked frontend scripts and the database worker parse as JavaScript", () => {
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)].map(match => localAsset(match[1]));
  scripts.push("backend/data-worker.js");
  const failures = [];
  for (const relative of new Set(scripts)) {
    const filename = path.join(frontend, relative);
    try { new vm.Script(fs.readFileSync(filename, "utf8"), { filename }); }
    catch (error) { failures.push(`${relative}: ${error.message}`); }
  }
  assert.deepEqual(failures, []);
});

test("every frontend runtime file is linked or has an explicit worker/manifest role", () => {
  const references = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(reference => !/^(?:[a-z]+:|\/\/|#)/i.test(reference))
    .map(localAsset));
  const manifestPath = path.join(frontend, "manifest.webmanifest");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  references.add("manifest.webmanifest");
  for (const icon of manifest.icons || []) references.add(localAsset(icon.src));
  for (const cssPath of [...references].filter(reference => reference.endsWith(".css"))) {
    const css = fs.readFileSync(path.join(frontend, cssPath), "utf8");
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const resource = match[1].trim();
      if (!/^(?:[a-z]+:|\/\/|data:|#)/i.test(resource)) references.add(path.posix.normalize(path.posix.join(path.posix.dirname(cssPath), localAsset(resource))));
    }
  }
  references.add("backend/data-worker.js");
  const intentionalDocs = new Set(["README.md", "index.html"]);
  const orphaned = walk(frontend).filter(filename => !references.has(filename) && !intentionalDocs.has(filename));
  assert.deepEqual(orphaned, []);
});
