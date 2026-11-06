// IndexedDB store for the library. One record per game, written incrementally,
// so a save touches only changed games instead of rewriting one huge JSON blob
// into localStorage (5 MB cap, synchronous, blocks the UI thread).
(root => {
  const DB_NAME = "screenmark_library", VERSION = 3;
  let dbPromise = null;
  const known = new Map(); // id -> JSON snapshot last written/read

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("items")) {
          const items = db.createObjectStore("items", { keyPath: "id" });
          items.createIndex("status", "status");
          items.createIndex("category", "category");
          items.createIndex("updatedAt", "updatedAt");
          items.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        // Device-local artwork cache: one small Blob per game/artwork kind, read in one fast batch.
        if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs", { keyPath: "key" });
        if (!db.objectStoreNames.contains("share-cache")) db.createObjectStore("share-cache", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }
  const done = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
  const result = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

  // Returns { items, history, preferences, empty } or throws when IndexedDB is unusable.
  async function loadAll() {
    const db = await open();
    const tx = db.transaction(["items", "meta"], "readonly");
    const [items, meta] = await Promise.all([result(tx.objectStore("items").getAll()), result(tx.objectStore("meta").get("state"))]);
    known.clear();
    items.forEach(item => known.set(String(item.id), JSON.stringify(item)));
    return { items, history: meta?.history || [], preferences: meta?.preferences || {}, empty: !items.length && !meta };
  }

  // Writes only games whose content changed and deletes games that are gone.
  async function save({ items, history, preferences }) {
    const db = await open();
    const tx = db.transaction(["items", "meta"], "readwrite");
    const store = tx.objectStore("items");
    const next = new Map();
    for (const item of items) {
      if (item?.id == null) continue;
      const id = String(item.id), snapshot = JSON.stringify(item);
      next.set(id, snapshot);
      if (known.get(id) !== snapshot) store.put({ ...item, id });
    }
    for (const id of known.keys()) if (!next.has(id)) store.delete(id);
    tx.objectStore("meta").put({ key: "state", history, preferences });
    await done(tx);
    known.clear(); next.forEach((snapshot, id) => known.set(id, snapshot));
  }

  // Touches only the given games (plus the small meta record). No scan of the library.
  async function saveSome({ changed = [], removedIds = [], history, preferences }) {
    const db = await open();
    const tx = db.transaction(["items", "meta"], "readwrite");
    const store = tx.objectStore("items");
    const writes = [];
    for (const item of changed) {
      if (item?.id == null) continue;
      const id = String(item.id), snapshot = JSON.stringify(item);
      if (known.get(id) === snapshot) continue;
      store.put({ ...item, id }); writes.push([id, snapshot]);
    }
    for (const id of removedIds) { store.delete(String(id)); }
    tx.objectStore("meta").put({ key: "state", history, preferences });
    await done(tx);
    writes.forEach(([id, snapshot]) => known.set(id, snapshot));
    removedIds.forEach(id => known.delete(String(id)));
  }

  // Thumbnail cache. entries: [[key, sig]] -> returns [[key, blob]] for entries whose stored signature still matches.
  async function getThumbs(entries) {
    const db = await open();
    const store = db.transaction("thumbs", "readonly").objectStore("thumbs");
    const rows = await Promise.all(entries.map(([key]) => result(store.get(key)).catch(() => null)));
    const hits = [];
    rows.forEach((row, index) => { if (row?.blob && row.sig === entries[index][1]) hits.push([row.key, row.blob]); });
    return hits;
  }
  async function putThumbs(entries) {
    if (!entries.length) return;
    const db = await open();
    const tx = db.transaction("thumbs", "readwrite");
    const store = tx.objectStore("thumbs");
    entries.forEach(([key, sig, blob]) => store.put({ key, sig, blob }));
    await done(tx);
  }
  // Which artwork is already cached ([[key, sig]]), so background fill only touches what is missing.
  async function listThumbKeys() {
    const db = await open();
    const store = db.transaction("thumbs", "readonly").objectStore("thumbs");
    const rows = await result(store.getAll());
    return rows.map(row => [row.key, row.sig]);
  }
  async function clearThumbs() {
    const db = await open();
    const tx = db.transaction("thumbs", "readwrite");
    tx.objectStore("thumbs").clear();
    await done(tx);
  }
  async function getShareCache(key, sig) {
    const db = await open(), row = await result(db.transaction("share-cache", "readonly").objectStore("share-cache").get(key));
    return row?.sig === sig ? row.blob || null : null;
  }
  async function putShareCache(key, sig, blob) {
    const db = await open(), tx = db.transaction("share-cache", "readwrite");
    tx.objectStore("share-cache").put({ key, sig, blob, at: Date.now() }); await done(tx);
  }
  async function clearShareCache() {
    const db = await open(), tx = db.transaction("share-cache", "readwrite"); tx.objectStore("share-cache").clear(); await done(tx);
  }

  const core = Object.freeze({ open, loadAll, save, saveSome, getThumbs, putThumbs, listThumbKeys, clearThumbs, getShareCache, putShareCache, clearShareCache });
  root.SplitAppIDBCore = core;
  if (typeof window === "undefined") return; // inside the data worker: expose the core only

  // On the page, every call goes to the data worker so diffing, serialising and IndexedDB
  // transactions never block scrolling. If workers are unavailable, use the core in-thread.
  let worker = null, nextId = 1, usable = typeof Worker === "function";
  const pending = new Map();
  function ensureWorker() {
    if (!usable) return null;
    if (worker) return worker;
    try {
      worker = new Worker("backend/data-worker.js");
      worker.onmessage = event => {
        const { id, ok, result, error } = event.data || {};
        const job = pending.get(id); if (!job) return;
        pending.delete(id);
        if (ok) job.resolve(result); else job.reject(new Error(error || "Data worker failed"));
      };
      worker.onerror = () => {
        // Worker could not start (e.g. file:// preview): retry every pending call in-thread.
        usable = false; worker = null;
        const jobs = [...pending.values()]; pending.clear();
        jobs.forEach(job => (job.op === "merge" ? Promise.resolve().then(() => root.SplitAppMixMerge.merge(...job.args)) : core[job.op](...job.args)).then(job.resolve, job.reject));
      };
    } catch (_) { usable = false; worker = null; }
    return worker;
  }
  function call(op, ...args) {
    const target = ensureWorker();
    if (!target) return op === "merge" ? Promise.resolve().then(() => root.SplitAppMixMerge.merge(...args)) : core[op](...args);
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, op, args });
      target.postMessage({ id, op, args });
    });
  }
  root.SplitAppIDB = Object.freeze({
    open: () => call("open").then(() => undefined),
    loadAll: () => call("loadAll"),
    save: data => call("save", data),
    saveSome: data => call("saveSome", data),
    getThumbs: entries => call("getThumbs", entries),
    putThumbs: entries => call("putThumbs", entries),
    listThumbKeys: () => call("listThumbKeys"),
    clearThumbs: () => call("clearThumbs"),
    getShareCache: (key, sig) => call("getShareCache", key, sig),
    putShareCache: (key, sig, blob) => call("putShareCache", key, sig, blob),
    clearShareCache: () => call("clearShareCache"),
    // Merge providers' detail records in a worker so large episode and cast lists do not block scrolling.
    merge: (entries, title, item) => call("merge", entries, title, item)
  });
})(self);
