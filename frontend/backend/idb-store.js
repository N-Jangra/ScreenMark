// IndexedDB store for the library. One record per game, written incrementally,
// so a save touches only changed games instead of rewriting one huge JSON blob
// into localStorage (5 MB cap, synchronous, blocks the UI thread).
(root => {
  const DB_NAME = "screenmark_library", VERSION = 7;
  let dbPromise = null;
  const known = new Map(); // id -> compact content signature; avoid retaining another copy of each full record
  let knownMeta = null; // JSON snapshot of the small library metadata row
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const normalizeHistory = value => Array.isArray(value) ? value.filter(isRecord) : [];
  const normalizePreferences = value => isRecord(value) ? value : {};
  const metadataSnapshot = (history, preferences) => JSON.stringify({ history: normalizeHistory(history), preferences: normalizePreferences(preferences) });
  const itemSnapshot = (item, id) => JSON.stringify({ ...item, id });
  const itemSignature = (item, id) => {
    const value = itemSnapshot(item, id);
    let first = 0x811c9dc5, second = 0x9e3779b9;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ (code + index), 0x85ebca6b);
    }
    return `${value.length}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
  };

  // Artwork catalog: one small row per picture (poster, background, logo, screenshot, thumbnail ...) so a title with
  // hundreds of images can be filtered by title, kind or source without loading the whole record.
  const IMAGE_KINDS = [["poster", /poster|cover|portrait/i], ["background", /background|backdrop|fanart|banner/i], ["logo", /logo|clearart|typography/i], ["thumbnail", /thumb|still|episode/i], ["screenshot", /screenshot|image|scene|gallery|stills/i]];
  const imageKindOf = title => (IMAGE_KINDS.find(([, pattern]) => pattern.test(String(title || ""))) || ["other"])[0];
  function imageRowsOf(item, id = String(item?.id)) {
    const rows = [], seen = new Set(), source = String(item?.metadataSource || item?.source || "manual");
    const category = String(item?.category || "");
    const add = (kind, url, label, section, position) => {
      if (typeof url !== "string" || !/^https?:\/\//i.test(url) || seen.has(url)) return; seen.add(url);
      rows.push({ key: `${id}|${rows.length}`, itemId: id, kind, itemKind: [id, kind], source, category, url, label: String(label || ""), section: String(section || ""), position });
    };
    const details = item?.cachedDetails || {};
    add("poster", item?.customCover || details.portraitImage || details.image || item?.image, "Poster", "", 0);
    add("background", item?.backdrop || details.landscapeImage || details.backgroundImage, "Background", "", 0);
    (details.sections || []).forEach(section => {
      if (section?.kind !== "gallery") return;
      const title = String(section.title || "Images").replace(/\s*\(\d+\)\s*$/, ""), kind = imageKindOf(title);
      (section.items || []).forEach((row, index) => add(kind === "other" ? imageKindOf(row?.title) : kind, row?.image || row?.url, row?.title || title, title, index));
    });
    return rows;
  }
  // Progress ticks and status changes rewrite a title often; skip the artwork catalog when its pictures did not change.
  const knownImageSigs = new Map();
  const imageSig = rows => rows.map(row => `${row.kind}\u0001${row.url}\u0001${row.label}`).join("\u0002");
  function writeImageRows(tx, item, id, pending) {
    const store = tx.objectStore("images"), rows = item ? imageRowsOf(item, id) : [], sig = imageSig(rows);
    if (item && knownImageSigs.get(id) === sig) return;
    const old = store.index("itemId").getAllKeys(id);
    old.onsuccess = () => {
      (old.result || []).forEach(key => store.delete(key));
      rows.forEach(row => store.put(row));
    };
    pending.set(id, item ? sig : null);
  }
  const commitImageSigs = pending => pending.forEach((sig, id) => { if (sig === null) knownImageSigs.delete(id); else knownImageSigs.set(id, sig); });

  function open() {
    if (dbPromise) return dbPromise;
    const opening = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const request = indexedDB.open(DB_NAME, VERSION);
      let settled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("items")) {
          const items = db.createObjectStore("items", { keyPath: "id" });
        }
        // The app currently loads its library as a single in-memory collection;
        // none of these indexes is queried, so maintaining them only slows writes.
        const items = request.transaction.objectStore("items");
        ["status", "category", "updatedAt", "createdAt"].forEach(name => {
          if (items.indexNames.contains(name)) items.deleteIndex(name);
        });
        if (!items.indexNames.contains("sourceCategoryProvider")) {
          items.createIndex("sourceCategoryProvider", ["metadataSource", "category", "providerId"], { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        // Version 7: artwork catalog with indexes by title, kind and source; filled from the existing library once.
        if (!db.objectStoreNames.contains("images")) {
          const images = db.createObjectStore("images", { keyPath: "key" });
          images.createIndex("itemId", "itemId", { unique: false });
          images.createIndex("itemKind", "itemKind", { unique: false });
          images.createIndex("kind", "kind", { unique: false });
          images.createIndex("source", "source", { unique: false });
          const fill = request.transaction.objectStore("items").openCursor();
          fill.onsuccess = () => { const cursor = fill.result; if (!cursor) return; imageRowsOf(cursor.value, String(cursor.value.id)).forEach(row => images.put(row)); cursor.continue(); };
        }
        // Device-local artwork cache: one small Blob per game/artwork kind, read in one fast batch.
        if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs", { keyPath: "key" });
        // Version 5 removes the unused PDF/share cache to reclaim old blobs.
        if (db.objectStoreNames.contains("share-cache")) db.deleteObjectStore("share-cache");
      };
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        const connection = request.result;
        connection.onversionchange = () => {
          connection.close();
          if (dbPromise === opening) dbPromise = null;
          known.clear(); knownMeta = null; knownImageSigs.clear();
        };
        connection.onclose = () => { if (dbPromise === opening) dbPromise = null; };
        resolve(connection);
      };
      request.onerror = () => { if (!settled) { settled = true; reject(request.error); } };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new Error("The library database upgrade is blocked by another open ScreenMark window. Close the other window and retry."));
      };
    });
    dbPromise = opening;
    opening.catch(() => { if (dbPromise === opening) dbPromise = null; });
    return opening;
  }
  const done = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
  const result = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

  // Returns { items, history, preferences, empty } or throws when IndexedDB is unusable.
  async function loadAll() {
    const db = await open();
    const tx = db.transaction(["items", "meta"], "readonly");
    const [rows, meta] = await Promise.all([result(tx.objectStore("items").getAll()), result(tx.objectStore("meta").get("state"))]);
    const items = rows.filter(item => isRecord(item) && item.id != null && String(item.id) !== "");
    const history = normalizeHistory(meta?.history), preferences = normalizePreferences(meta?.preferences);
    const metadataNeedsRepair = !Array.isArray(meta?.history) || history.length !== meta.history.length || !isRecord(meta?.preferences);
    known.clear();
    items.forEach(item => known.set(String(item.id), itemSignature(item, String(item.id))));
    knownMeta = metadataNeedsRepair ? null : metadataSnapshot(history, preferences);
    return { items, history, preferences, empty: !items.length && !meta };
  }

  // Resolve a linked catalog record without loading and scanning the whole library.
  async function findByProvider(source, category, providerId) {
    if (!source || !category || providerId == null || String(providerId) === "") return null;
    const db = await open();
    const store = db.transaction("items", "readonly").objectStore("items");
    const key = [String(source), String(category), String(providerId)];
    const match = await result(store.index("sourceCategoryProvider").get(key));
    return isRecord(match) ? match : null;
  }

  // Writes only games whose content changed and deletes games that are gone.
  async function save({ items, history, preferences }) {
    history = normalizeHistory(history);
    preferences = normalizePreferences(preferences);
    const next = new Map(), writes = [];
    for (const item of items) {
      if (item?.id == null) continue;
      const id = String(item.id), signature = itemSignature(item, id);
      next.set(id, signature);
      if (known.get(id) !== signature) writes.push({ ...item, id });
    }
    const removed = [...known.keys()].filter(id => !next.has(id));
    const nextMeta = metadataSnapshot(history, preferences);
    if (!writes.length && !removed.length && knownMeta === nextMeta) return;
    const db = await open(), tx = db.transaction(["items", "meta", "images"], "readwrite"), store = tx.objectStore("items");
    const pendingSigs = new Map();
    writes.forEach(item => { store.put(item); writeImageRows(tx, item, String(item.id), pendingSigs); });
    removed.forEach(id => { store.delete(id); writeImageRows(tx, null, id, pendingSigs); });
    if (knownMeta !== nextMeta) tx.objectStore("meta").put({ key: "state", history, preferences });
    await done(tx);
    commitImageSigs(pendingSigs);
    known.clear(); next.forEach((snapshot, id) => known.set(id, snapshot));
    knownMeta = nextMeta;
  }

  // Touches only the given games (plus the small meta record). No scan of the library.
  async function saveSome({ changed = [], removedIds = [], history, preferences }) {
    history = normalizeHistory(history);
    preferences = normalizePreferences(preferences);
    const nextMeta = metadataSnapshot(history, preferences);
    const writes = [], removed = new Set(removedIds.map(id => String(id)));
    for (const item of changed) {
      if (item?.id == null) continue;
      const id = String(item.id), signature = itemSignature(item, id);
      if (removed.has(id) || known.get(id) === signature) continue;
      writes.push([{ ...item, id }, signature]);
    }
    if (!writes.length && !removed.size && knownMeta === nextMeta) return;
    const db = await open();
    const tx = db.transaction(["items", "meta", "images"], "readwrite"), store = tx.objectStore("items");
    const pendingSigs = new Map();
    writes.forEach(([item]) => { store.put(item); writeImageRows(tx, item, String(item.id), pendingSigs); });
    removed.forEach(id => { store.delete(id); writeImageRows(tx, null, id, pendingSigs); });
    if (knownMeta !== nextMeta) tx.objectStore("meta").put({ key: "state", history, preferences });
    await done(tx);
    commitImageSigs(pendingSigs);
    writes.forEach(([item, signature]) => known.set(String(item.id), signature));
    removed.forEach(id => known.delete(id));
    knownMeta = nextMeta;
  }

  // Thumbnail cache. entries: [[key, sig]] -> returns [[key, blob]] for entries whose stored signature still matches.
  async function getThumbs(entries) {
    const db = await open();
    const store = db.transaction("thumbs", "readonly").objectStore("thumbs");
    const rows = await Promise.all(entries.map(([key]) => result(store.get(key)).catch(() => null)));
    const hits = [];
    rows.forEach((row, index) => { if (typeof Blob !== "undefined" && row?.blob instanceof Blob && row.sig === entries[index][1]) hits.push([row.key, row.blob]); });
    return hits;
  }
  async function putThumbs(entries) {
    entries = entries.filter(entry => Array.isArray(entry) && entry.length >= 3 && entry[0] != null && typeof Blob !== "undefined" && entry[2] instanceof Blob);
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
    const tx = db.transaction("thumbs", "readonly"), store = tx.objectStore("thumbs"), rows = [];
    const finished = done(tx);
    await new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(); return; }
        // Cursor through one record at a time; unlike getAll(), this avoids
        // materializing the entire artwork Blob cache just to read key/signature.
        rows.push([cursor.key, cursor.value?.sig]);
        cursor.continue();
      };
    });
    await finished;
    return rows;
  }
  async function clearThumbs() {
    const db = await open();
    const tx = db.transaction("thumbs", "readwrite");
    tx.objectStore("thumbs").clear();
    await done(tx);
  }
  async function deleteThumbs(keys) {
    if (!keys.length) return;
    const db = await open();
    const tx = db.transaction("thumbs", "readwrite"), store = tx.objectStore("thumbs");
    keys.forEach(key => store.delete(key));
    await done(tx);
  }
  // Artwork lookups. listImages(itemId, kind?) -> rows; imageCounts(itemId) -> { kind: count }.
  async function listImages(itemId, kind) {
    const db = await open(), store = db.transaction("images", "readonly").objectStore("images");
    const rows = kind ? await result(store.index("itemKind").getAll([String(itemId), String(kind)])) : await result(store.index("itemId").getAll(String(itemId)));
    return rows.sort((a, b) => a.position - b.position);
  }
  async function imageCounts(itemId) {
    const rows = await listImages(itemId), counts = {};
    rows.forEach(row => { counts[row.kind] = (counts[row.kind] || 0) + 1; });
    return counts;
  }
  const core = Object.freeze({ listImages, imageCounts, open, loadAll, findByProvider, save, saveSome, getThumbs, putThumbs, listThumbKeys, clearThumbs, deleteThumbs });
  root.SplitAppIDBCore = core;
  if (typeof window === "undefined") return; // inside the data worker: expose the core only

  // On the page, every call goes to the data worker so diffing, serialising and IndexedDB
  // transactions never block scrolling. If workers are unavailable, use the core in-thread.
  // Firefox and Chromium reject workers loaded from file:// because file URLs have opaque origins.
  // Use the same IndexedDB implementation on the page in that preview mode.
  let worker = null, nextId = 1, usable = typeof Worker === "function" && root.location?.protocol !== "file:";
  const pending = new Map();
  let fallbackReady = Promise.resolve(), fallbackPrimed = false;
  function primeFallback() {
    if (fallbackPrimed) return Promise.resolve(null);
    return core.loadAll().then(data => { fallbackPrimed = true; return data; });
  }
  function queueFallback(op, args) {
    const run = fallbackReady.catch(() => {}).then(async () => {
      const primed = await primeFallback();
      return op === "loadAll" && primed ? primed : core[op](...args);
    });
    // Keep the queue usable after a transient failure; the caller still receives
    // the rejection, while the next operation retries initialization in order.
    fallbackReady = run.catch(() => {});
    return run;
  }
  const failWorker = error => {
    usable = false;
    const failedWorker = worker; worker = null;
    if (failedWorker) {
      failedWorker.onmessage = failedWorker.onerror = failedWorker.onmessageerror = null;
      failedWorker.terminate();
    }
    const jobs = [...pending.values()]; pending.clear();
    jobs.forEach(job => clearTimeout(job.timer));
    // Prime the main-thread diff cache before it accepts future writes. In-flight
    // worker writes may commit; IndexedDB serializes this read after those writes.
    // Replaying these operations is safe: writes use stable keys and deletes / clears
    // are idempotent. Preserve request order so later writes cannot overtake earlier ones.
    const replay = fallbackReady.catch(() => {}).then(async () => {
      await primeFallback();
      for (const job of jobs) {
        try {
          const value = await core[job.op](...job.args);
          job.resolve(value);
        } catch (fallbackError) {
          job.reject(fallbackError || error);
        }
      }
    }).catch(loadError => {
      jobs.forEach(job => job.reject(loadError || error));
    });
    fallbackReady = replay.catch(() => {});
  };
  function ensureWorker() {
    if (!usable) return null;
    if (worker) return worker;
    try {
      worker = new Worker("backend/data-worker.js");
      worker.onmessage = event => {
        const { id, ok, result, error } = event.data || {};
        const job = pending.get(id); if (!job) return;
        pending.delete(id);
        clearTimeout(job.timer);
        if (ok) job.resolve(result); else job.reject(new Error(error || "Data worker failed"));
      };
      worker.onerror = () => failWorker(new Error("Database worker stopped; retry the operation."));
      worker.onmessageerror = () => failWorker(new Error("Database worker returned unreadable data; retry the operation."));
    } catch (_) { usable = false; worker = null; }
    return worker;
  }
  function call(op, ...args) {
    const target = ensureWorker();
    if (!target) return queueFallback(op, args);
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        // A wedged worker must not leave later calls waiting behind it.
        failWorker(new Error("Database worker timed out; retry the operation."));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      try { target.postMessage({ id, op, args }); }
      catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  root.SplitAppIDB = Object.freeze({
    open: () => call("open").then(() => undefined),
    loadAll: () => call("loadAll"),
    findByProvider: (source, category, providerId) => call("findByProvider", source, category, providerId),
    save: data => call("save", data),
    saveSome: data => call("saveSome", data),
    getThumbs: entries => call("getThumbs", entries),
    putThumbs: entries => call("putThumbs", entries),
    listThumbKeys: () => call("listThumbKeys"),
    clearThumbs: () => call("clearThumbs"),
    deleteThumbs: keys => call("deleteThumbs", keys),
    listImages: (itemId, kind) => call("listImages", itemId, kind),
    imageCounts: itemId => call("imageCounts", itemId)
  });
})(self);
