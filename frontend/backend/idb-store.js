// IndexedDB store for the library. One record per game, written incrementally,
// so a save touches only changed games instead of rewriting one huge JSON blob
// into localStorage (5 MB cap, synchronous, blocks the UI thread).
(root => {
  const DB_NAME = "screenmark_library", VERSION = 8;
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

  // ---- Compact (in-memory) details --------------------------------------------------------------------------------------
  // Stored records always keep the full details. In memory a title can hold a *compact* copy (cachedDetails.compact === true):
  // everything the list pages need, but not the cast, galleries, ratings and per-episode text. A compact copy is never written
  // back over the stored one: saves keep the stored details and only update the rest of the record.
  const compactEpisode = row => row && typeof row === "object" ? { id: row.id, title: row.title, name: row.name, season: row.season, number: row.number, airdate: row.airdate, airstamp: row.airstamp, runtime: row.runtime, type: row.type, kind: row.kind, image: row.image, url: row.url } : row;
  function compactDetails(details, item = {}) {
    if (!isRecord(details)) return details;
    const copy = { ...details, compact: true };
    delete copy.raw;
    if (Array.isArray(details.sections)) {
      copy.sections = details.sections
        .filter(section => isRecord(section) && section.kind === "episodes")
        .map(section => {
          const episodes = Array.isArray(section.items) ? section.items : [];
          const watched = new Set((Array.isArray(item.watchedEpisodeIds) ? item.watchedEpisodeIds : []).map(String));
          const airTime = episode => {
            const raw = String(episode?.airdate || "").trim(), dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
            if (dateOnly) { const [, y, m, d] = dateOnly.map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999).getTime(); }
            const time = Date.parse(raw); return Number.isFinite(time) ? time : 0;
          };
          const lastDated = episodes.reduce((last, episode, index) => airTime(episode) > 0 ? index : last, -1);
          const next = episodes.find(episode => !watched.has(String(episode?.id)));
          const lastWatched = [...episodes].reverse().find(episode => watched.has(String(episode?.id)));
          const upcoming = episodes.filter(episode => airTime(episode) > Date.now()).sort((a, b) => airTime(a) - airTime(b))[0];
          const unannounced = lastDated >= 0 ? episodes.find((episode, index) => index > lastDated && !airTime(episode)) : null;
          const selected = new Map();
          const add = (episode, marker = "") => {
            if (!episode || episode.id == null) return;
            const key = String(episode.id), row = { ...compactEpisode(episode) };
            if (marker) row.compactUpcoming = true;
            selected.set(key, { ...(selected.get(key) || {}), ...row });
          };
          add(next);
          add(lastWatched);
          add(upcoming, "upcoming");
          add(unannounced, "upcoming");
          const episodeCount = Math.max(Number(section.episodeCount) || 0, episodes.length, Number(item.goal) || 0, Number(item.facts?.episodeCount) || 0);
          return { ...section, episodeCount, items: [...selected.values()] };
        });
    }
    if (copy.facts) { copy.facts = { ...copy.facts }; delete copy.facts.cast; }
    delete copy.description; delete copy.links; delete copy.overview;
    return copy;
  }
  const withoutDetails = item => { const { cachedDetails, ...rest } = item; return rest; };
  const withoutStorageFields = item => {
    const { cachedDetails, listDetails, detailsStore, ...rest } = item;
    return rest;
  };
  const logicalItem = (record, fullDetails = null, compact = false) => {
    if (!isRecord(record)) return record;
    const item = withoutStorageFields(record);
    const details = fullDetails || record.listDetails || record.cachedDetails || null;
    if (details) item.cachedDetails = compact ? compactDetails(details, item) : details;
    return item;
  };
  const storedItem = (item, fullDetails = null) => {
    const record = withoutStorageFields(item);
    if (fullDetails && isRecord(fullDetails) && !fullDetails.compact) {
      record.listDetails = compactDetails(fullDetails, item);
      record.detailsStore = true;
    } else if (item?.cachedDetails) {
      record.listDetails = compactDetails(item.cachedDetails, item);
      record.detailsStore = false;
    }
    return record;
  };
  const knownSlim = new Map(); // id -> signature of the stored record without its details
  const slimSignature = (item, id) => itemSignature(withoutDetails(item), id);
  const isCompact = item => Boolean(item?.cachedDetails?.compact);

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
        // Version 8 adds a separate full-detail store. Existing rows migrate
        // later in small resumable batches; the schema upgrade copies nothing.
        if (!db.objectStoreNames.contains("details")) db.createObjectStore("details", { keyPath: "id" });
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
  async function loadAll({ slim = false, slimMin = Infinity } = {}) {
    const db = await open();
    const probe = db.transaction(["items", "meta"], "readonly"), probeDone = done(probe);
    const [count, meta] = await Promise.all([result(probe.objectStore("items").count()), result(probe.objectStore("meta").get("state"))]);
    await probeDone;
    const compact = slim && count >= slimMin;
    // Walk one record at a time. In compact mode immediately discard each
    // legacy cast/gallery payload instead of retaining a second full library.
    const tx = db.transaction("items", "readonly"), txFinished = done(tx);
    const rows = await new Promise((resolve, reject) => {
      const collected = [], request = tx.objectStore("items").openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(collected); return; }
        const record = cursor.value;
        if (isRecord(record) && record.id != null && String(record.id) !== "") collected.push(compact ? logicalItem(record, null, true) : record);
        cursor.continue();
      };
    });
    await txFinished;
    let fullDetails = new Map();
    if (!compact) {
      const detailsTx = db.transaction("details", "readonly"), detailsDone = done(detailsTx), detailsStore = detailsTx.objectStore("details");
      const requests = rows.filter(item => item.detailsStore).map(item => result(detailsStore.get(String(item.id))).then(row => [String(item.id), row?.cachedDetails || null]));
      fullDetails = new Map(await Promise.all(requests));
      await detailsDone;
    }
    const items = compact ? rows : rows.map(record => logicalItem(record, fullDetails.get(String(record.id)), false));
    const history = normalizeHistory(meta?.history), preferences = normalizePreferences(meta?.preferences);
    const metadataNeedsRepair = !Array.isArray(meta?.history) || history.length !== meta.history.length || !isRecord(meta?.preferences);
    known.clear(); knownSlim.clear();
    items.forEach(item => { const id = String(item.id); known.set(id, itemSignature(item, id)); knownSlim.set(id, slimSignature(item, id)); });
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
    return isRecord(match) ? logicalItem(match) : null;
  }

  // Writes only games whose content changed and deletes games that are gone.
  async function save({ items, history, preferences }) {
    history = normalizeHistory(history);
    preferences = normalizePreferences(preferences);
    const next = new Map(), writes = [];
    for (const item of items) {
      if (item?.id == null) continue;
      const id = String(item.id), compact = isCompact(item);
      const signature = compact ? known.get(id) || "" : itemSignature(item, id);
      next.set(id, signature);
      if (compact ? knownSlim.get(id) !== slimSignature(item, id) || !known.has(id) : known.get(id) !== signature) writes.push({ ...item, id });
    }
    const removed = [...known.keys()].filter(id => !next.has(id));
    const nextMeta = metadataSnapshot(history, preferences);
    if (!writes.length && !removed.length && knownMeta === nextMeta) return;
    const db = await open(), tx = db.transaction(["items", "meta", "images", "details"], "readwrite"), store = tx.objectStore("items");
    const pendingSigs = new Map();
    const written = await putRecords(store, writes, tx, pendingSigs);
    removed.forEach(id => { store.delete(id); tx.objectStore("details").delete(id); writeImageRows(tx, null, id, pendingSigs); knownSlim.delete(id); });
    if (knownMeta !== nextMeta) tx.objectStore("meta").put({ key: "state", history, preferences });
    await done(tx);
    commitImageSigs(pendingSigs);
    next.forEach((snapshot, id) => known.set(id, snapshot)); [...known.keys()].forEach(id => { if (!next.has(id)) known.delete(id); });
    written.forEach(({ id, full, slim }) => { known.set(id, full); knownSlim.set(id, slim); });
    knownMeta = nextMeta;
  }
  // Puts records; a compact in-memory copy keeps the stored details (read inside the same transaction). Resolves with the
  // signatures of what was stored.
  function putRecords(store, records, tx, pendingSigs) {
    const detailStore = tx.objectStore("details");
    return Promise.all(records.map(item => new Promise((resolve, reject) => {
      const id = String(item.id);
      const finish = (record, details = null) => {
        store.put(record);
        const logical = logicalItem(record, details, false);
        writeImageRows(tx, logical, id, pendingSigs);
        resolve({ id, full: itemSignature(logical, id), slim: slimSignature(logical, id) });
      };
      const request = detailStore.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const current = request.result?.cachedDetails || null;
        const legacyRequest = current ? null : store.get(id);
        const proceed = legacy => {
          const previous = current || legacy?.cachedDetails || null;
          const incoming = item.cachedDetails;
          let fullDetails = null;
          if (incoming && !incoming.compact) fullDetails = incoming;
          else if (previous && !previous.compact) fullDetails = previous;
          else if (incoming) fullDetails = incoming;
          if (fullDetails && !fullDetails.compact) detailStore.put({ id, cachedDetails: fullDetails });
          const record = storedItem(item, fullDetails);
          finish(record, fullDetails);
        };
        if (legacyRequest) { legacyRequest.onerror = () => reject(legacyRequest.error); legacyRequest.onsuccess = () => proceed(legacyRequest.result); }
        else proceed(null);
      };
    })));
  }

  // Touches only the given games (plus the small meta record). No scan of the library.
  async function saveSome({ changed = [], removedIds = [], history, preferences }) {
    history = normalizeHistory(history);
    preferences = normalizePreferences(preferences);
    const nextMeta = metadataSnapshot(history, preferences);
    const writes = [], removed = new Set(removedIds.map(id => String(id)));
    for (const item of changed) {
      if (item?.id == null) continue;
      const id = String(item.id), compact = isCompact(item);
      if (removed.has(id)) continue;
      if (compact ? knownSlim.get(id) === slimSignature(item, id) && known.has(id) : known.get(id) === itemSignature(item, id)) continue;
      writes.push({ ...item, id });
    }
    if (!writes.length && !removed.size && knownMeta === nextMeta) return;
    const db = await open();
    const tx = db.transaction(["items", "meta", "images", "details"], "readwrite"), store = tx.objectStore("items");
    const pendingSigs = new Map();
    const written = await putRecords(store, writes, tx, pendingSigs);
    removed.forEach(id => { store.delete(id); tx.objectStore("details").delete(id); writeImageRows(tx, null, id, pendingSigs); });
    if (knownMeta !== nextMeta) tx.objectStore("meta").put({ key: "state", history, preferences });
    await done(tx);
    commitImageSigs(pendingSigs);
    written.forEach(({ id, full, slim }) => { known.set(id, full); knownSlim.set(id, slim); });
    removed.forEach(id => { known.delete(id); knownSlim.delete(id); });
    knownMeta = nextMeta;
  }
  // Full details of one title (the stored copy), for the details page and exports.
  async function getDetails(id) {
    const db = await open();
    const key = String(id), tx = db.transaction(["items", "details"], "readonly"), finished = done(tx);
    const [details, record] = await Promise.all([result(tx.objectStore("details").get(key)), result(tx.objectStore("items").get(key))]);
    await finished;
    return details?.cachedDetails || (isRecord(record) ? record.listDetails || record.cachedDetails || null : null);
  }
  async function getDetailsBatch(ids = []) {
    const keys = ids.map(id => String(id)), db = await open(), tx = db.transaction(["items", "details"], "readonly"), finished = done(tx);
    const itemStore = tx.objectStore("items"), detailStore = tx.objectStore("details");
    const rows = await Promise.all(keys.map(key => new Promise((resolve, reject) => {
      const request = itemStore.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result;
        if (!isRecord(record)) { resolve(null); return; }
        if (!record.detailsStore) { resolve(record.listDetails || record.cachedDetails || null); return; }
        const detailRequest = detailStore.get(key);
        detailRequest.onerror = () => reject(detailRequest.error);
        detailRequest.onsuccess = () => resolve(detailRequest.result?.cachedDetails || record.listDetails || null);
      };
    })));
    await finished;
    return rows;
  }
  async function getMetaValue(key) {
    const db = await open(), row = await result(db.transaction("meta", "readonly").objectStore("meta").get(String(key)));
    return row?.value;
  }
  async function setMetaValue(key, value) {
    const db = await open(), tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put({ key: String(key), value });
    await done(tx);
  }
  async function getRecord(id) {
    const db = await open();
    const key = String(id), tx = db.transaction(["items", "details"], "readonly"), finished = done(tx);
    const [record, details] = await Promise.all([result(tx.objectStore("items").get(key)), result(tx.objectStore("details").get(key))]);
    await finished;
    return isRecord(record) ? logicalItem(record, details?.cachedDetails || null) : null;
  }
  // Stored records in id order, a page at a time (after = last id of the previous page), optionally with full details.
  // Used to stream the library out (folder database, backups) without holding it all in memory.
  async function readBatch(after = null, limit = 50) {
    const db = await open();
    const tx = db.transaction("items", "readonly"), finished = done(tx), store = tx.objectStore("items");
    const range = after == null ? null : IDBKeyRange.lowerBound(after, true);
    const records = await new Promise((resolve, reject) => {
      const rows = [], request = store.openCursor(range);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || rows.length >= limit) { finished.then(() => resolve(rows), reject); return; }
        rows.push(cursor.value); cursor.continue();
      };
    });
    const needingDetails = records.filter(record => record.detailsStore);
    if (!needingDetails.length) return records.map(record => logicalItem(record));
    const detailTx = db.transaction("details", "readonly"), detailDone = done(detailTx), detailStore = detailTx.objectStore("details");
    const details = new Map(await Promise.all(needingDetails.map(record => result(detailStore.get(String(record.id))).then(row => [String(record.id), row?.cachedDetails || null]))));
    await detailDone;
    return records.map(record => logicalItem(record, details.get(String(record.id)) || null));
  }

  // Resumable, small transactions move legacy inline details into the dedicated
  // store. Each batch commits its cursor position with the copied rows.
  async function migrateDetailsBatch(limit = 50) {
    const db = await open(), tx = db.transaction(["items", "details", "meta"], "readwrite"), items = tx.objectStore("items"), details = tx.objectStore("details"), meta = tx.objectStore("meta");
    const finished = done(tx), [progress, rowCount] = await Promise.all([result(meta.get("details-migration")), result(items.count())]);
    if (progress?.done) { await finished; return { migrated: 0, done: true, lastId: progress.lastId || "", total: progress.total || rowCount, completed: progress.completed || 0 }; }
    const total = Number(progress?.total) || rowCount;
    let migrated = 0, scanned = 0, lastId = progress?.lastId || "", complete = false;
    await new Promise((resolve, reject) => {
      const range = lastId ? IDBKeyRange.lowerBound(lastId, true) : null;
      const request = items.openCursor(range);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { complete = true; meta.put({ key: "details-migration", lastId, done: true, completed: (Number(progress?.completed) || 0) + migrated, total }); resolve(); return; }
        const row = cursor.value; lastId = String(row.id); scanned++;
        if (row.detailsStore || !row.cachedDetails || row.cachedDetails.compact) {
          if (scanned >= Math.max(1, limit)) { meta.put({ key: "details-migration", lastId, done: false, completed: Number(progress?.completed) || 0, total }); resolve(); }
          else cursor.continue();
          return;
        }
        const full = row.cachedDetails;
        details.put({ id: lastId, cachedDetails: full });
        const verify = details.get(lastId);
        verify.onerror = () => reject(verify.error);
        verify.onsuccess = () => {
          if (!isRecord(verify.result?.cachedDetails)) { reject(new Error("Detail migration verification failed for " + lastId)); return; }
          row.listDetails = compactDetails(full, row); row.detailsStore = true; delete row.cachedDetails;
          cursor.update(row); migrated++;
          const completed = (Number(progress?.completed) || 0) + migrated;
          meta.put({ key: "details-migration", lastId, done: false, completed, total });
          if (scanned >= Math.max(1, limit)) { resolve(); return; }
          cursor.continue();
        };
      };
    });
    await finished;
    return { migrated, done: complete, lastId, completed: (Number(progress?.completed) || 0) + migrated, total };
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
  const core = Object.freeze({ listImages, imageCounts, open, loadAll, findByProvider, save, saveSome, getDetails, getDetailsBatch, getMetaValue, setMetaValue, getRecord, readBatch, migrateDetailsBatch, compactDetails, getThumbs, putThumbs, listThumbKeys, clearThumbs, deleteThumbs });
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
    // Keep failure recovery safe for large libraries too: priming only needs
    // list fields/signatures, and must not deserialize every full detail blob
    // on the WebView thread after a worker failure.
    return core.loadAll({ slim: true, slimMin: 1 }).then(data => { fallbackPrimed = true; return data; });
  }
  function queueFallback(op, args) {
    const run = fallbackReady.catch(() => {}).then(async () => {
      if (op === "loadAll") return core.loadAll(...args);
      await primeFallback();
      return core[op](...args);
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
      const timeoutMs = op === "migrateDetailsBatch" ? 120000 : 30000;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        // A wedged worker must not leave later calls waiting behind it.
        failWorker(new Error("Database worker timed out; retry the operation."));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, op, args });
      try { target.postMessage({ id, op, args }); }
      catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  root.SplitAppIDB = Object.freeze({
    open: () => call("open").then(() => undefined),
    loadAll: options => call("loadAll", options),
    getDetails: id => call("getDetails", id),
    getDetailsBatch: ids => call("getDetailsBatch", ids),
    getMetaValue: key => call("getMetaValue", key),
    setMetaValue: (key, value) => call("setMetaValue", key, value),
    compactDetails: (details, item) => core.compactDetails(details, item),
    readBatch: (after, limit) => call("readBatch", after, limit),
    migrateDetailsBatch: limit => call("migrateDetailsBatch", limit),
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
