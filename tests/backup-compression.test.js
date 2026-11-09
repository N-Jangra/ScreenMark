"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backendSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/app.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");

const gzipBlob = async text => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
const gunzipText = async bytes => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

function loadBackend({ compress = true } = {}) {
  const chunks = [], calls = [];
  const plugin = {
    createDocument: async options => { calls.push(["createDocument", options]); return { uri: "content://doc" }; },
    beginFolderExport: async options => { calls.push(["beginFolderExport", options]); return { uri: "content://folder-doc" }; },
    writeDocumentChunk: async ({ content, base64 }) => { chunks.push({ content, base64: Boolean(base64) }); },
    closeDocument: async () => { calls.push(["closeDocument"]); }
  };
  const window = { APP_CONFIG: { key: "screenmark", name: "ScreenMark", categories: [{ key: "series", statuses: ["Watchlist"] }, { key: "movie", statuses: ["Watchlist"] }] }, Capacitor: { Plugins: { BackupFolder: plugin } }, addEventListener() {}, SplitAppIDB: {} };
  const ctx = vm.createContext({ window, document: { addEventListener() {}, visibilityState: "visible" }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, structuredClone, atob, btoa, TextEncoder, TextDecoder, Response, Blob, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, setTimeout, clearTimeout, console, Uint8Array, CompressionStream: compress ? CompressionStream : undefined, DecompressionStream });
  vm.runInContext(backendSource, ctx, { filename: "backend/app.js" });
  return { backend: window.SplitAppBackend, chunks, calls };
}
const library = count => Array.from({ length: count }, (_, i) => ({ id: `id-${i}`, title: `Title ${i} é 日本`, category: i % 2 ? "movie" : "series", status: "Watchlist", metadataSource: "tvmaze", providerId: String(i), cachedDetails: { sections: [{ kind: "episodes", title: "Episodes", items: Array.from({ length: 30 }, (_, n) => ({ id: `e${i}-${n}`, title: `Episode ${n}` })) }] } }));

test("native export streams a valid gzip file as base64 chunks and it restores to the same library", async () => {
  const { backend, chunks, calls } = loadBackend();
  const items = library(120), progress = [];
  const result = await backend.exportLibrary({ items, history: [{ itemId: "id-1", action: "x", at: 1 }], preferences: { theme: "dark" } }, { onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(result.fileName.endsWith(".json.gz"), true);
  assert.equal(calls[0][1].mimeType, "application/gzip");
  assert.ok(chunks.length >= 1 && chunks.every(chunk => chunk.base64), "every chunk is binary (base64)");
  assert.deepEqual(progress.at(-1), [120, 120]);
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk.content, "base64")));
  assert.equal(bytes[0], 0x1f); assert.equal(bytes[1], 0x8b);
  const parsed = JSON.parse(await gunzipText(bytes));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.items.length, 120);
  assert.equal(parsed.index.length, 120);
  assert.equal(parsed.items[5].title, "Title 5 é 日本");
  assert.equal(parsed.items[5].backupRef.providerId, "5");
  assert.equal(parsed.history[0].itemId, "id-1");
  assert.equal(parsed.preferences.theme, "dark");
  assert.ok(bytes.length < JSON.stringify(parsed).length / 5, "compressed to under a fifth of the JSON size");
  assert.deepEqual(calls.at(-1), ["closeDocument"]);
});

test("silent folder backups use the same compressed writer and the native side picks a gzip mime type", () => {
  assert.match(backendSource, /plugin\.beginFolderExport\(\{ uri, fileName \}\)/);
  assert.match(backendSource, /const fileName = `\$\{app\.key\}-backup-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.json\$\{gzip \? "\.gz" : ""\}`/);
  assert.match(fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/BackupFolderPlugin.java"), "utf8"), /endsWith\("\.gz"\) \? "application\/gzip"/);
});

test("without CompressionStream the export falls back to plain text chunks and a .json name", async () => {
  const { backend, chunks } = loadBackend({ compress: false });
  const result = await backend.exportLibrary({ items: library(3), history: [], preferences: {} }, {});
  assert.equal(result.fileName.endsWith(".json"), true);
  assert.ok(chunks.every(chunk => !chunk.base64));
  assert.equal(JSON.parse(chunks.map(chunk => chunk.content).join("")).items.length, 3);
});

test("a failing native write aborts the compressed export instead of hanging", async () => {
  const failing = loadBackend();
  failing.chunks.push = () => { throw new Error("disk full"); };
  await assert.rejects(failing.backend.exportLibrary({ items: library(400), history: [], preferences: {} }, {}), /disk full/);
  assert.deepEqual(failing.calls.at(-1), ["closeDocument"], "the document is still closed");
});

function importReader() {
  const start = appSource.indexOf("async function readBackupText"), end = appSource.indexOf("async function importList");
  return new Function("Response", "DecompressionStream", `return ${appSource.slice(start, end).replace("async function readBackupText", "async function")}`)(Response, DecompressionStream);
}
const named = (blob, name) => Object.assign(blob, { name });

test("importing reads plain, gzip, mislabeled and unicode backups by content", async () => {
  const read = importReader();
  const json = JSON.stringify({ items: [{ title: "é ü 日本語" }] });
  assert.equal(await read(named(new Blob([json]), "a.json")), json);
  assert.equal(await read(named(await gzipBlob(json), "a.json.gz")), json);
  assert.equal(await read(named(await gzipBlob(json), "renamed.json")), json, "gzip detected by magic bytes");
  assert.equal(await read(named(new Blob([json]), "wrong.json.gz")), json, "plain JSON named .gz still opens");
  const big = JSON.stringify({ items: Array.from({ length: 60000 }, (_, i) => ({ id: i, title: `T${i}` })) });
  assert.equal(await read(named(await gzipBlob(big), "big.json.gz")), big);
});

test("importing gives clear messages for empty, truncated and corrupt compressed backups", async () => {
  const read = importReader();
  await assert.rejects(read(named(new Blob([]), "a.json")), /empty/);
  const packed = await gzipBlob(JSON.stringify({ items: Array.from({ length: 500 }, (_, i) => ({ id: i })) }));
  await assert.rejects(read(named(packed.slice(0, 20), "a.json.gz")), /damaged or incomplete/);
  await assert.rejects(read(named(new Blob([new Uint8Array([0x1f, 0x8b, 1, 2, 3, 4, 5, 6, 7, 8, 9])]), "a.json.gz")), /damaged or incomplete/);
});

test("folder recovery reads compressed backup copies and the file picker accepts gzip", () => {
  assert.match(backendSource, /\\\.json\(\?:\\\\\.gz\)\?\$/);
  assert.match(backendSource, /plugin\.readBinaryFile\(\{ uri: file\.uri, maxBytes: 64 \* 1024 \* 1024 \}\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../frontend/pages/settings.js"), "utf8"), /accept="\.json,\.gz,\.txt,\.csv,\.sqdb,application\/gzip,application\/x-gzip/);
  assert.match(fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/BackupFolderPlugin.java"), "utf8"), /Base64\.decode\(content, android\.util\.Base64\.DEFAULT\)/);
});
