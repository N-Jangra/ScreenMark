"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { IDBFactory } = require("fake-indexeddb");

const idbSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/idb-store.js"), "utf8");
const workerSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/data-worker.js"), "utf8");

const plain = value => JSON.parse(JSON.stringify(value));

function makeCore() {
  const indexedDB = new IDBFactory();
  const self = { indexedDB };
  const context = vm.createContext({ self, indexedDB, Blob, Promise, Map, Set, Object, Array, String, Math, JSON, Error, setTimeout, clearTimeout });
  vm.runInContext(idbSource, context, { filename: "idb-store.js" });
  return { core: self.SplitAppIDBCore, indexedDB, context, self };
}

function openRaw(indexedDB, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result, request.transaction);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function workerCall(context, self, message) {
  return new Promise(resolve => {
    self.postMessage = resolve;
    vm.runInContext("self.onmessage", context)( { data: message } );
  });
}

test("creates current stores, migrates old indexes and removes the retired share cache", async () => {
  const { core, indexedDB } = makeCore();
  const old = await openRaw(indexedDB, "screenmark_library", 4, db => {
    const items = db.createObjectStore("items", { keyPath: "id" });
    for (const index of ["status", "category", "updatedAt", "createdAt"]) items.createIndex(index, index);
    db.createObjectStore("meta", { keyPath: "key" });
    db.createObjectStore("thumbs", { keyPath: "key" });
    db.createObjectStore("share-cache", { keyPath: "key" });
  });
  old.close();
  await core.open();
  const db = await core.open();
  assert.equal(db.version, 7);
  assert.deepEqual(Array.from(db.objectStoreNames).sort(), ["images", "items", "meta", "thumbs"]);
  const items = db.transaction("items").objectStore("items");
  assert.deepEqual(Array.from(items.indexNames), ["sourceCategoryProvider"]);
  db.close();
});

test("loads empty state, saves changed rows, skips no-op writes and returns persisted metadata", async () => {
  const { core } = makeCore();
  assert.deepEqual(plain(await core.loadAll()), { items: [], history: [], preferences: {}, empty: true });
  const history = [{ id: "h1", kind: "added" }], preferences = { theme: "dark" };
  const first = { id: "a", title: "Alpha", category: "series", progress: 1 };
  await core.save({ items: [first], history, preferences });
  let loaded = await core.loadAll();
  assert.deepEqual(plain(loaded.items), [first]);
  assert.deepEqual(plain(loaded.history), history);
  assert.deepEqual(plain(loaded.preferences), preferences);
  assert.equal(loaded.empty, false);

  await core.save({ items: [{ ...first }], history, preferences });
  await core.save({ items: [{ ...first, title: "Alpha Updated" }], history, preferences });
  loaded = await core.loadAll();
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].title, "Alpha Updated");

  await core.save({ items: [], history: null, preferences: null });
  loaded = await core.loadAll();
  assert.deepEqual(plain(loaded.items), []);
  assert.deepEqual(plain(loaded.history), []);
  assert.deepEqual(plain(loaded.preferences), {});
});

test("saveSome inserts, updates and deletes only requested records", async () => {
  const { core } = makeCore();
  await core.save({ items: [{ id: "a", title: "A" }, { id: "b", title: "B" }], history: [], preferences: {} });
  await core.saveSome({ changed: [{ id: "b", title: "B2" }, { id: "c", title: "C" }], removedIds: ["a"], history: [{ id: "x" }], preferences: { compact: true } });
  const loaded = await core.loadAll();
  assert.deepEqual(plain(loaded.items), [{ id: "b", title: "B2" }, { id: "c", title: "C" }]);
  assert.deepEqual(plain(loaded.history), [{ id: "x" }]);
  assert.deepEqual(plain(loaded.preferences), { compact: true });

  await core.saveSome({ changed: [{ id: "ignored", title: "Ignored" }, { title: "Missing ID" }], removedIds: ["ignored"] });
  assert.deepEqual(plain((await core.loadAll()).items), plain(loaded.items));
});

test("repairs malformed metadata shapes when read and re-saved", async () => {
  const { core } = makeCore();
  const db = await core.open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put({ key: "state", history: { wrong: true }, preferences: [] });
    tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error);
  });
  const loaded = await core.loadAll();
  assert.deepEqual(plain(loaded.history), []);
  assert.deepEqual(plain(loaded.preferences), {});
  await core.save({ items: [], history: [], preferences: {} });
  const repaired = await core.loadAll();
  assert.deepEqual(plain(repaired.history), []);
  assert.deepEqual(plain(repaired.preferences), {});
  db.close();
});

test("thumbnail queries validate signatures, ignore invalid blobs and support delete/clear", async () => {
  const { core } = makeCore();
  const cover = new Blob(["cover"], { type: "image/webp" });
  const portrait = new Blob(["portrait"], { type: "image/jpeg" });
  await core.putThumbs([["movie:1", "v1", cover], ["series:2", "v2", portrait], ["bad", "v", "not a blob"], null]);
  assert.equal((await core.getThumbs([["movie:1", "v1"], ["movie:1", "old"], ["series:2", "v2"], ["missing", "v"]])).length, 2);
  const keys = (await core.listThumbKeys()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  assert.deepEqual(plain(keys), [["movie:1", "v1"], ["series:2", "v2"]]);
  await core.deleteThumbs(["movie:1"]);
  assert.deepEqual(plain(await core.listThumbKeys()), [["series:2", "v2"]]);
  await core.deleteThumbs([]);
  await core.clearThumbs();
  assert.deepEqual(plain(await core.listThumbKeys()), []);
});

test("data worker dispatches every database operation and rejects unknown operations", async () => {
  const { core, context, self } = makeCore();
  self.SplitAppIDBCore = core;
  self.postMessage = () => {};
  context.importScripts = () => {};
  vm.runInContext(workerSource, context, { filename: "data-worker.js" });

  const call = async (id, op, args = []) => workerCall(context, self, { id, op, args });
  assert.deepEqual(plain(await call(1, "open")), { id: 1, ok: true, result: null });
  assert.equal((await call(2, "loadAll")).result.empty, true);
  assert.equal((await call(3, "save", [{ items: [{ id: "w", title: "Worker" }], history: [], preferences: {} }])).ok, true);
  assert.equal((await call(4, "saveSome", [{ changed: [{ id: "w", title: "Worker 2" }] }])).ok, true);
  const blob = new Blob(["thumb"]);
  assert.equal((await call(5, "putThumbs", [[["w", "sig", blob]]])).ok, true);
  assert.equal((await call(6, "getThumbs", [[["w", "sig"]]])).result.length, 1);
  assert.equal((await call(7, "listThumbKeys")).result.length, 1);
  assert.equal((await call(8, "deleteThumbs", [["w"]])).ok, true);
  assert.deepEqual(plain((await call(9, "listThumbKeys")).result), []);
  assert.equal((await call(10, "clearThumbs")).ok, true);
  assert.equal((await call(11, "removeEverything")).ok, false);
  assert.match((await call(11, "removeEverything")).error, /Unknown data worker op/);
});

test("reports a blocked schema upgrade promptly instead of hanging", async () => {
  const { core, indexedDB } = makeCore();
  const held = await openRaw(indexedDB, "screenmark_library", 4, db => {
    db.createObjectStore("items", { keyPath: "id" });
    db.createObjectStore("meta", { keyPath: "key" });
    db.createObjectStore("thumbs", { keyPath: "key" });
  });
  try {
    await assert.rejects(core.open(), /upgrade is blocked/);
  } finally { held.close(); }
});

test("public IndexedDB facade supports all operations when workers are unavailable", async () => {
  const indexedDB = new IDBFactory();
  const window = { indexedDB, location: { protocol: "file:" } };
  const context = vm.createContext({ window, self: window, indexedDB, Blob, Promise, Map, Set, Object, Array, String, Math, JSON, Error, setTimeout, clearTimeout });
  vm.runInContext(idbSource, context, { filename: "idb-store-fallback.js" });
  const db = window.SplitAppIDB;
  assert.equal(typeof db, "object");
  await db.open();
  assert.equal((await db.loadAll()).empty, true);
  await db.save({ items: [{ id: "fallback", title: "Fallback" }], history: [], preferences: {} });
  await db.saveSome({ changed: [{ id: "fallback", title: "Fallback updated" }] });
  assert.equal((await db.loadAll()).items[0].title, "Fallback updated");
  await db.putThumbs([["fallback", "sig", new Blob(["art"])] ]);
  assert.equal((await db.getThumbs([["fallback", "sig"]])).length, 1);
  assert.equal((await db.listThumbKeys()).length, 1);
  await db.deleteThumbs(["fallback"]);
  assert.deepEqual(plain(await db.listThumbKeys()), []);
  await db.clearThumbs();
});

test("artwork catalog indexes posters, backgrounds and screenshots per title and follows updates and deletes", async () => {
  const { core } = makeCore();
  const show = { id: "s1", title: "Show", category: "series", metadataSource: "tvmaze", providerId: "9", image: "https://img/p.jpg", backdrop: "https://img/b.jpg", cachedDetails: { sections: [{ kind: "gallery", title: "Screenshots (2)", items: [{ title: "One", image: "https://img/s1.jpg" }, { title: "Two", image: "https://img/s2.jpg" }] }, { kind: "gallery", title: "Logos", items: [{ image: "https://img/l.png" }] }] } };
  await core.save({ items: [show], history: [], preferences: {} });
  assert.deepEqual(plain(await core.imageCounts("s1")), { poster: 1, background: 1, screenshot: 2, logo: 1 });
  assert.deepEqual((await core.listImages("s1", "screenshot")).map(row => row.url), ["https://img/s1.jpg", "https://img/s2.jpg"]);
  await core.saveSome({ changed: [{ ...show, cachedDetails: { sections: [] } }], history: [], preferences: {} });
  assert.deepEqual(plain(await core.imageCounts("s1")), { poster: 1, background: 1 });
  await core.saveSome({ removedIds: ["s1"], history: [], preferences: {} });
  assert.deepEqual(plain(await core.imageCounts("s1")), {});
});

test("artwork catalog is untouched by saves that do not change a title's pictures and updates when they do", async () => {
  const { core } = makeCore();
  const show = { id: "p1", title: "Show", category: "series", image: "https://img/p.jpg", progress: 0, cachedDetails: { sections: [{ kind: "gallery", title: "Screenshots", items: [{ image: "https://img/a.jpg" }] }] } };
  await core.save({ items: [show], history: [], preferences: {} });
  const before = await core.listImages("p1");
  await core.saveSome({ changed: [{ ...show, progress: 3 }], history: [], preferences: {} });
  assert.deepEqual(plain(await core.listImages("p1")), plain(before));
  await core.saveSome({ changed: [{ ...show, progress: 3, cachedDetails: { sections: [{ kind: "gallery", title: "Screenshots", items: [{ image: "https://img/a.jpg" }, { image: "https://img/b.jpg" }] }] } }], history: [], preferences: {} });
  assert.equal((await core.listImages("p1", "screenshot")).length, 2);
});
