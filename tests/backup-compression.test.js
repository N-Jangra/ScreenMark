"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backendSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/app.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../frontend/app.js"), "utf8");
const nativeStoreSource = fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/EncryptedStorePlugin.java"), "utf8");

const gzipBlob = async text => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
const gunzipText = async bytes => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

function loadBackend({ compress = true, idb = {} } = {}) {
  const chunks = [], calls = [];
  const plugin = {
    createDocument: async options => { calls.push(["createDocument", options]); return { uri: "content://doc" }; },
    beginFolderExport: async options => { calls.push(["beginFolderExport", options]); return { uri: "content://folder-doc" }; },
    writeDocumentChunk: async ({ content, base64 }) => { chunks.push({ content, base64: Boolean(base64) }); },
    closeDocument: async () => { calls.push(["closeDocument"]); }
  };
  const window = { APP_CONFIG: { key: "screenmark", name: "ScreenMark", categories: [{ key: "series", statuses: ["Watchlist"] }, { key: "movie", statuses: ["Watchlist"] }] }, Capacitor: { Plugins: { BackupFolder: plugin } }, addEventListener() {}, SplitAppIDB: idb };
  const ctx = vm.createContext({ window, navigator: { onLine: false }, document: { addEventListener() {}, visibilityState: "visible" }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, structuredClone, atob, btoa, TextEncoder, TextDecoder, Response, Blob, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, setTimeout, clearTimeout, console, Uint8Array, CompressionStream: compress ? CompressionStream : undefined, DecompressionStream, FileReader: class { readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`; this.onload(); }); } } });
  vm.runInContext(backendSource, ctx, { filename: "backend/app.js" });
  return { backend: window.SplitAppBackend, chunks, calls };
}
const library = count => Array.from({ length: count }, (_, i) => ({ id: `id-${i}`, title: `Title ${i} é 日本`, category: i % 2 ? "movie" : "series", status: "Watchlist", metadataSource: "tvmaze", providerId: String(i), cachedDetails: { sections: [{ kind: "episodes", title: "Episodes", items: Array.from({ length: 30 }, (_, n) => ({ id: `e${i}-${n}`, title: `Episode ${n}` })) }] } }));

test("Android encrypted records have an atomic app-specific files mirror and empty-store recovery", () => {
  assert.match(nativeStoreSource, /getExternalFilesDir\(null\)/);
  assert.match(nativeStoreSource, /CueMark\/ScreenMark\/records/);
  assert.match(nativeStoreSource, /Os\.rename\(/);
  assert.match(nativeStoreSource, /Map<String, JSONObject> byId/);
  assert.match(nativeStoreSource, /getMirrorLocation/);
  assert.match(nativeStoreSource, /ensureMirror/);
  assert.match(nativeStoreSource, /syncMirrorBatch/);
  assert.match(nativeStoreSource, /finishLibraryMirrorSync/);
  assert.match(backendSource, /syncMirrorBatch\(\{ items: batch \}\)/);
  assert.match(backendSource, /EncryptedStore\?\.ensureMirror/);
  assert.match(nativeStoreSource, /deleteMirror\(\)/);
});

test("Android registers chunked sharing and grants FileProvider access from the chooser", () => {
  const shareSource = fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/ShareIntentPlugin.java"), "utf8");
  const activitySource = fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/MainActivity.java"), "utf8");
  assert.match(activitySource, /registerPlugin\(ShareIntentPlugin\.class\)/);
  assert.match(shareSource, /public void beginFile\(PluginCall call\)/);
  assert.match(shareSource, /public void appendFileChunk\(PluginCall call\)/);
  assert.match(shareSource, /public void shareChunkedFile\(PluginCall call\)/);
  assert.match(shareSource, /send\.setClipData\(ClipData\.newUri/);
  assert.match(shareSource, /chooser\.setClipData\(ClipData\.newUri/);
  assert.match(shareSource, /FLAG_GRANT_READ_URI_PERMISSION/);
});

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

test("native export preserves a 1,000-title library and reports complete progress", async () => {
  const { backend, chunks, calls } = loadBackend();
  let state = 0x12345678;
  const noise = () => Array.from({ length: 512 }, () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return String.fromCharCode(32 + ((state >>> 0) % 94));
  }).join("");
  const items = Array.from({ length: 1000 }, (_, index) => ({
    id: `large-${index}`, title: `Large export ${index}`, category: index % 2 ? "movie" : "series",
    status: "Watchlist", metadataSource: "tvmaze", providerId: String(index), review: noise()
  }));
  const progress = [];
  const result = await backend.exportLibrary({ items, history: [], preferences: {} }, { onProgress: (done, total) => progress.push([done, total]) });
  assert.match(result.fileName, /\.json\.gz$/);
  assert.deepEqual(calls.at(-1), ["closeDocument"]);
  assert.deepEqual(progress.at(-1), [1000, 1000]);
  assert.ok(progress.length >= 126, "the exporter reports progress after each small item batch");
  assert.ok(chunks.length > 1, "the native writer receives multiple compressed chunks instead of one oversized payload");
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk.content, "base64")));
  assert.equal(bytes[0], 0x1f); assert.equal(bytes[1], 0x8b);
  const parsed = JSON.parse(await gunzipText(bytes));
  assert.equal(parsed.items.length, 1000);
  assert.equal(parsed.index.length, 1000);
  assert.equal(parsed.items[999].title, "Large export 999");
  assert.equal(parsed.items[500].review.length, 512);
});

test("native export packages artwork from the IndexedDB image store", async () => {
  const item = { id: "art-1", title: "Cached art", category: "movie", image: "https://example.test/poster.jpg", cachedDetails: { sections: [] } };
  const imageBytes = Buffer.from("cached-image-bytes");
  const key = "art-1:p";
  const idb = { getThumbs: async entries => entries.some(([entryKey]) => entryKey === key) ? [[key, new Blob([imageBytes], { type: "image/jpeg" })]] : [] };
  const { backend, chunks } = loadBackend({ idb });
  await backend.exportLibrary({ items: [item], history: [], preferences: {} }, {});
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk.content, "base64")));
  const parsed = JSON.parse(await gunzipText(bytes));
  assert.equal(parsed.items[0].transferImages.image, `data:image/jpeg;base64,${imageBytes.toString("base64")}`);
});

test("native export includes artwork stored under the current per-image IndexedDB keys", async () => {
  const item = {
    id: "idb-only", title: "IndexedDB only artwork", category: "series", image: "https://example.test/poster.jpg",
    cachedDetails: { sections: [{ kind: "episodes", title: "Episodes", items: [{ id: "ep-7", image: "https://example.test/still.jpg" }] }] }
  };
  const imageBytes = Buffer.from("idb-only-artwork");
  const hash = value => {
    const text = String(value || ""); let result = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) result = Math.imul(result ^ text.charCodeAt(index), 0x01000193);
    return `${text.length}:${(result >>> 0).toString(16)}`;
  };
  const imageKeys = new Set([
    `${item.id}:image:${hash(JSON.stringify(["image"]))}`,
    `${item.id}:image:${hash(JSON.stringify(["cachedDetails", "sections", 0, "items", 0, "image"]))}`,
    `${item.id}:image:${hash(JSON.stringify(["cachedDetails", "episodesById", "ep-7", "image"]))}`
  ]);
  const idb = {
    getImages: async entries => entries.filter(([key]) => imageKeys.has(key)).map(([key]) => [key, new Blob([imageBytes], { type: "image/jpeg" })]),
    getThumbs: async () => []
  };
  const { backend, chunks } = loadBackend({ idb });
  await backend.exportLibrary({ items: [item], history: [], preferences: {} }, {});
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk.content, "base64")));
  const parsed = JSON.parse(await gunzipText(bytes));
  assert.equal(parsed.items[0].transferImages.image, `data:image/jpeg;base64,${imageBytes.toString("base64")}`);
  assert.equal(parsed.items[0].transferImages["cachedDetails.sections.0.items.0.image"], `data:image/jpeg;base64,${imageBytes.toString("base64")}`);
  assert.equal(parsed.items[0].transferImages["cachedDetails.episodesById.ep-7.image"], `data:image/jpeg;base64,${imageBytes.toString("base64")}`);
});

test("mobile transfer export overlaps bounded IndexedDB artwork reads", async () => {
  let active = 0, maximum = 0;
  const idb = {
    getImages: async () => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 8));
      active--; return [];
    }
  };
  const items = Array.from({ length: 12 }, (_, index) => ({ id: `parallel-${index}`, title: `Title ${index}`, image: `https://example.test/${index}.jpg`, category: "movie" }));
  const { backend } = loadBackend({ idb });
  await backend.exportLibrary({ items, history: [], preferences: {} }, {});
  assert.ok(maximum > 1, "IndexedDB reads for several titles overlap instead of running serially");
  assert.ok(maximum <= 4, `mobile artwork read concurrency stays bounded (observed ${maximum})`);
});

test("transfer import keeps source URLs and restores artwork into ScreenMark's thumbs cache", () => {
  const start = appSource.indexOf("function restoreTransferImages"), end = appSource.indexOf("async function importList", start);
  const source = appSource.slice(start, end);
  assert.doesNotMatch(source, /target\[leaf\] = value/);
  assert.match(source, /artworkCacheEntries\?\.\(item\)/);
  assert.match(source, /putThumbs\?\.\(writes\)/);
  assert.match(source, /episodesById/);
  assert.doesNotMatch(source, /putImages\?\.\(writes\)/);
});

test("silent folder backups use the same compressed writer and the native side picks a gzip mime type", () => {
  assert.match(backendSource, /plugin\.beginFolderExport\(\{ uri, fileName \}\)/);
  assert.match(backendSource, /encrypted \? `\$\{app\.key\}-transfer-.*\.sqx` : `\$\{app\.key\}-backup-.*\.json\$\{gzip \? "\.gz" : ""\}`/);
  assert.match(fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/BackupFolderPlugin.java"), "utf8"), /endsWith\("\.sqx"\).*application\/octet-stream.*endsWith\("\.gz"\) \? "application\/gzip"/s);
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
  const settingsSource = fs.readFileSync(path.join(__dirname, "../frontend/pages/settings.js"), "utf8");
  assert.equal((settingsSource.match(/type="file" accept="\*\/\*" data-setting-action="import"/g) || []).length, 2, "Android must receive a generic picker MIME type so JSON, gzip, TXT and CSV selections reach the importer");
  assert.match(appSource, /Library import started: \$\{file\.name/);
  assert.match(appSource, /Library import failed: \$\{error\.message/);
  assert.match(appSource, /if \(importPickerPending\) \{\s*\/\/ Android resumes the WebView before delivering the file-input change event\./);
  assert.match(appSource, /if \(input\.matches\("\[data-setting-action=import\]"\)\) \{\s*const file = input\.files\?\.\[0\];\s*importPickerPending = false;/);
  assert.doesNotMatch(appSource, /event\.target\.matches\?\.\("\[data-setting-action=import\]"\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/cuemark/screenmark/BackupFolderPlugin.java"), "utf8"), /Base64\.decode\(content, android\.util\.Base64\.DEFAULT\)/);
});
