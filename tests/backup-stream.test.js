"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const source = fs.readFileSync(path.join(__dirname, "..", "frontend/components/backup-stream.js"), "utf8");
const cryptoSource = fs.readFileSync(path.join(__dirname, "..", "frontend/components/transfer-crypto.js"), "utf8");
function load() {
  const window = {};
  const context = vm.createContext({ window, crypto: webcrypto, TextEncoder, TextDecoder, TextDecoderStream, DecompressionStream, ReadableStream, setTimeout, Uint8Array, DataView, Error, JSON, RegExp, Promise });
  vm.runInContext(cryptoSource, context);
  vm.runInContext(source, context);
  return window.SplitAppBackupStream;
}
const streamOf = (text, size = 7) => new ReadableStream({ start(controller) { const bytes = new TextEncoder().encode(text); for (let at = 0; at < bytes.length; at += size) controller.enqueue(bytes.slice(at, at + size)); controller.close(); } });

const sample = { app: "ScreenMark", version: 2, exportedAt: "2026-01-01", index: [{ id: "1", source: "tvmaze" }], items: [
  { id: "1", title: "Brace } and \"quote\" [ ] inside", nested: { a: [1, { b: "}" }] }, backupRef: { id: "1", source: "tvmaze", providerId: "9" } },
  { id: "2", title: "Second \\ backslash", year: "2020" }
], history: [{ id: "h1", at: 1 }], preferences: { theme: "dark", items: "not the list" } };

test("streams items out of a backup split into tiny chunks, with strings that contain braces and quotes", async () => {
  const result = await load().parse(streamOf(JSON.stringify(sample), 5));
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, sample.items[0].title);
  assert.deepEqual(JSON.parse(JSON.stringify(result.items[0].nested)), sample.items[0].nested);
  assert.equal(result.items[1].title, sample.items[1].title);
  assert.equal(result.history.length, 1);
  assert.equal(result.preferences.theme, "dark");
  assert.equal(result.version, 2);
});

test("reads a gzip-compressed backup and a bare item list wrapped in an object", async () => {
  const gz = await new Response(new Blob([JSON.stringify(sample)]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const file = new Blob([gz]);
  const result = await load().parseFile(file);
  assert.equal(result.items.length, 2);
  const bare = await load().parse(streamOf('{"items":[{"title":"A"},{"title":"B"},{"title":"C"}]}'));
  assert.deepEqual([...bare.items].map(item => item.title), ["A", "B", "C"]);
});

test("password transfer encrypts and imports in chunks, and rejects a wrong password", async () => {
  const backup = JSON.stringify(sample), gzip = new Blob([backup]).stream().pipeThrough(new CompressionStream("gzip"));
  const encrypted = await windowCrypto().encryptStream(gzip, "correct horse battery staple");
  const file = new Blob([await new Response(encrypted).arrayBuffer()]);
  const streamReader = load();
  const parsed = await streamReader.parseFile(file, { password: "correct horse battery staple" });
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.preferences.theme, "dark");
  await assert.rejects(streamReader.parseFile(file, { password: "incorrect password" }), /Wrong password or damaged/);
});

function windowCrypto() {
  const window = {}, context = vm.createContext({ window, crypto: webcrypto, TextEncoder, Uint8Array, DataView, ReadableStream, Error, Promise });
  vm.runInContext(cryptoSource, context);
  return window.SplitAppTransferCrypto;
}

test("handles thousands of items and rejects files that are not backups", async () => {
  const many = { index: [], items: Array.from({ length: 6000 }, (_, i) => ({ id: String(i), title: `Title ${i}`, cachedDetails: { text: "x".repeat(50) } })), history: [] };
  const result = await load().parse(streamOf(JSON.stringify(many), 4096), { yieldEvery: 1000 });
  assert.equal(result.items.length, 6000);
  assert.equal(result.items[5999].title, "Title 5999");
  await assert.rejects(() => load().parse(streamOf('{"hello":"world"}'.repeat(200000), 65536)));
  await assert.rejects(() => load().parse(streamOf('{"items":[{"title":"cut off"')));
});
