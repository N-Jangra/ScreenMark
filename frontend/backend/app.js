// ScreenMark's app-specific state and Android encrypted-storage bridge.
(() => {
  "use strict";
  const app = window.APP_CONFIG;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isLibraryItem = value => isRecord(value) && value.id != null && String(value.id) !== "";
  const storageKey = `splitapp_${app.key}_v1`;
  const folderUriKey = `${storageKey}_folder_uri`;
  const databaseFileName = `${app.key}_database.json`;
  const folderTreeName = `${app.key}-db`;
  const folderLayoutMarker = "source-folders-v3.json";
  const folderItemHashKey = `${storageKey}_folder_item_hashes_v2`;
  const folderImageHashKey = `${storageKey}_folder_image_hashes_v2`;
  const folderArchiveHashKey = `${storageKey}_folder_archive_hashes_v2`;
  const itemIds = new Set();
  // In-memory titles can carry compact details (see idb-store.js). Anything written out (snapshots, folder files, backups)
  // must carry the full stored details, so those paths read them back from the database one title at a time.
  const isCompactItem = item => Boolean(item?.cachedDetails?.compact);
  async function detailedItem(item) {
    if (!isCompactItem(item)) return item;
    try {
      const full = await window.SplitAppIDB?.getDetails?.(item.id);
      if (full && !full.compact) return { ...item, cachedDetails: full };
    } catch (_) {}
    return item;
  }
  async function detailedItems(items) {
    if (window.SplitAppIDB?.getDetailsBatch) {
      const compactIndexes = [];
      items.forEach((item, index) => { if (isCompactItem(item)) compactIndexes.push(index); });
      if (!compactIndexes.length) return items;
      try {
        const details = await window.SplitAppIDB.getDetailsBatch(compactIndexes.map(index => items[index].id));
        return items.map((item, index) => {
          const position = compactIndexes.indexOf(index), full = position >= 0 ? details[position] : null;
          return full && !full.compact ? { ...item, cachedDetails: full } : item;
        });
      } catch (_) {}
    }
    return Promise.all(items.map(detailedItem));
  }
  // Compact in-memory details switch on at this many titles. Off (Infinity) unless set: localStorage `<app>_slim_min`.
  const slimMinItems = () => { try { const value = Number(localStorage.getItem(`${storageKey}_slim_min`)); return value > 0 ? value : Infinity; } catch (_) { return Infinity; } };
  const itemSnapshots = new Map(); // id -> compact fingerprint (never retain a second copy of every metadata record)
  let activeFolderUri = "";
  let activeFolderSnapshots = 0;
  let folderWriteQueue = Promise.resolve();
  let pendingFolderSync = null;
  let folderSyncDrain = null;

  function snapshotFingerprint(value) {
    let first = 0x811c9dc5, second = 0x9e3779b9;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ (code + index), 0x85ebca6b);
    }
    return `${value.length}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
  }
  const SNAPSHOT_FULL_DETAILS_LIMIT = 1500;
  async function writeItemSnapshots(rows, plugin, { includeDetails = true } = {}) {
    const saved = [];
    for (let offset = 0; offset < rows.length; offset += 16) {
      const batch = await Promise.all(rows.slice(offset, offset + 16).map(async item => {
        const id = String(item.id), snapshot = includeDetails ? await detailedItem(item) : item, portable = portableItem(snapshot);
        // The encrypted per-title store is a recovery index for very large
        // libraries. Keep those rows small; full details remain in IndexedDB,
        // the portable folder database and exports, and can be fetched again
        // if those primary stores need recovery.
        if (!includeDetails) delete portable.cachedDetails;
        const data = JSON.stringify(portable);
        return { id, data, fingerprint: snapshotFingerprint(data) };
      }));
      const changed = batch.filter(row => itemSnapshots.get(row.id) !== row.fingerprint);
      await Promise.all(changed.map(row => plugin.setItem({ id: row.id, data: row.data })));
      saved.push(...batch.map(row => [row.id, row.fingerprint]));
    }
    return saved;
  }
  async function deleteItemSnapshots(ids, plugin) {
    for (let offset = 0; offset < ids.length; offset += 64) {
      await Promise.all(ids.slice(offset, offset + 64).map(id => plugin.deleteItem({ id: String(id) })));
    }
  }

  function discardRemovedFields(data) {
    delete data.preferences.defaultCategory;
    return data;
  }

  // With IndexedDB healthy, localStorage keeps only the small boot-time mirror
  // (preferences + history); games live in IndexedDB.
  let idbHealthy = Boolean(window.SplitAppIDB);
  function writeMirror(data) {
    const mirror = idbHealthy ? { ...data, items: [] } : data;
    try { localStorage.setItem(storageKey, JSON.stringify(mirror)); }
    catch (error) { console.warn("Could not write the local mirror", error); }
  }

  function readMirror() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    catch (_) { return {}; }
  }

  function itemDirectoryName(item) {
    const id = String(item?.id || "").replace(/[^a-z0-9_-]/gi, "_").slice(0, 100);
    return id || `item_${String(item?.title || "untitled").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 70)}`;
  }

  function categoryFolderName(item) { return item?.category === "series" ? "series" : "movies"; }
  function itemSourceFolderName(item) {
    const raw = String(item?.metadataSource || item?.source || "manual").trim().toLowerCase();
    return raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "manual";
  }
  function itemFolderPath(item) {
    return [folderTreeName, categoryFolderName(item), itemSourceFolderName(item), itemDirectoryName(item)];
  }
  function itemFolderIndexKey(item) { return `${categoryFolderName(item)}/${itemSourceFolderName(item)}/${itemDirectoryName(item)}`; }
  function categoryFolderKind(name) { return name === "shows" || name === "series" ? "series" : name === "movies" ? "movie" : ""; }

  // Accept both the old category/<title> tree and the new category/<source>/<title> tree.
  async function listCategoryItemFolders(plugin, directory) {
    const children = (await plugin.listFiles({ uri: directory.uri }))?.files || [];
    const rows = [];
    for (const child of children.filter(file => file.uri)) {
      const childFiles = (await plugin.listFiles({ uri: child.uri }))?.files || [];
      if (childFiles.some(file => file.name === "index.json" && file.uri)) {
        rows.push({ folder: child, files: childFiles, categoryName: directory.name, sourceName: "", legacy: true });
        continue;
      }
      for (const titleFolder of childFiles.filter(file => file.uri)) {
        const files = (await plugin.listFiles({ uri: titleFolder.uri }))?.files || [];
        rows.push({ folder: titleFolder, files, categoryName: directory.name, sourceName: child.name, sourceFolder: child, legacy: false });
      }
    }
    return rows;
  }

  function portableItem(item, { includeImageData = false } = {}) {
    const copy = { ...item };
    if (!includeImageData) {
      delete copy.localThumbnailData;
      delete copy.localPortraitData;
      delete copy.localLandscapeData;
      delete copy.localImageData;
    }
    // Image bytes belong in adjacent files in the selected folder. Provider
    // detail payloads can contain data URLs several levels below `image`; strip
    // those too so database.json and index.json stay small and portable.
    const imageKey = /(image|thumbnail|backdrop|cover|poster|artwork)/i;
    const stripInlineImages = value => {
      if (Array.isArray(value)) return value.map(stripInlineImages);
      if (!value || typeof value !== "object") return value;
      const result = {};
      for (const [key, child] of Object.entries(value)) {
        if (!includeImageData && imageKey.test(key) && typeof child === "string" && /^data:image\//i.test(child)) {
          result[key] = "";
        } else {
          result[key] = stripInlineImages(child);
        }
      }
      return result;
    };
    Object.assign(copy, stripInlineImages(copy));
    // Cast is a live source view: keep it in the current in-memory response only.
    // Persist the overview and complete episode/season guide for offline use, but
    // never serialize people records (including nested raw provider payloads).
    if (copy.facts) {
      copy.facts = { ...copy.facts };
      delete copy.facts.cast;
    }
    if (copy.cachedDetails) {
      copy.cachedDetails = { ...copy.cachedDetails };
      delete copy.cachedDetails.raw;
      if (copy.cachedDetails.facts) {
        copy.cachedDetails.facts = { ...copy.cachedDetails.facts };
        delete copy.cachedDetails.facts.cast;
      }
      if (Array.isArray(copy.cachedDetails.sections)) {
        copy.cachedDetails.sections = copy.cachedDetails.sections
          // Keep an empty placeholder in the same section slot. localImageFiles
          // may still contain legacy positional paths, and removing people
          // sections would shift every following season's image indexes.
          .map(section => !section ? section
            : section.kind === "people" || /^(cast|characters|staff|crew|people|guest cast|guest crew)(?:\b|\s)/i.test(section.title || "")
              ? { ...section, items: [] }
              : section.kind === "episodes" ? { ...section, items: (section.items || []).map(({ raw, ...episode }) => episode) } : section);
      }
      if (Array.isArray(copy.cachedDetails.fields)) copy.cachedDetails.fields = copy.cachedDetails.fields.filter(field => !/^cast|^actors?$/i.test(String(field?.label || "").trim()));
    }
    if (!includeImageData && /^data:image\//i.test(copy.image || "")) copy.image = "";
    return copy;
  }

  function hasPersistedCast(item) {
    const details = item?.cachedDetails;
    if (Array.isArray(item?.facts?.cast) && item.facts.cast.length) return true;
    if (!details) return false;
    if (details.raw != null || (Array.isArray(details.facts?.cast) && details.facts.cast.length)) return true;
    if ((details.fields || []).some(field => /^cast|^actors?$/i.test(String(field?.label || "").trim()))) return true;
    return (details.sections || []).some(section => ((section?.kind === "people" || /^(cast|characters|staff|crew|people|guest cast|guest crew)(?:\b|\s)/i.test(section?.title || "")) && (section.items || []).length > 0) || (section?.kind === "episodes" && (section.items || []).some(row => row?.raw != null)));
  }

  // Settings → Metadata & Storage → Image storage: "all" saves every image, "posters" only covers and backdrops, "online" none.
  let imageStorage = "all";
  function setImageStorage(mode) { imageStorage = ["all", "posters", "online"].includes(mode) ? mode : "all"; }
  function collectImageCandidates(item) {
    if (imageStorage === "online") return [];
    const candidates = collectAllImageCandidates(item);
    return imageStorage === "posters" ? candidates.filter(candidate => candidate.paths.some(path => !path.includes("sections"))) : candidates;
  }
  function collectAllImageCandidates(item) {
    const candidates = [];
    const bySource = new Map();
    const add = (path, source) => {
      if (typeof source !== "string" || !source) return;
      if (!/^https?:\/\//i.test(source) && !/^data:image\//i.test(source)) return;
      let candidate = bySource.get(source);
      if (!candidate) {
        candidate = { source, paths: [] };
        bySource.set(source, candidate);
        candidates.push(candidate);
      }
      if (!candidate.paths.some(existing => existing.length === path.length && existing.every((part, index) => part === path[index]))) candidate.paths.push(path);
    };
    add(["image"], item.localPortraitData || item.localThumbnailData || item.image || item.cachedDetails?.portraitImage);
    add(["backdrop"], item.localLandscapeData || item.backdrop || item.cachedDetails?.landscapeImage || item.cachedDetails?.backgroundImage);
    const imageKey = /(image|thumbnail|backdrop|cover|poster|artwork)/i;
    const visit = (value, path = []) => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...path, index]));
        return;
      }
      if (!value || typeof value !== "object") return;
      Object.entries(value).forEach(([key, child]) => {
        if (["localThumbnailData", "localPortraitData", "localLandscapeData", "localImageData", "localImageFiles"].includes(key)) return;
        const childPath = [...path, key];
        if (key === "image" && path.length === 0) return;
        if (typeof child === "string" && imageKey.test(key)) {
          add(childPath, child);
          // Section indexes change when optional cast/people sections are
          // omitted from portable folder backups. Persist a second, stable key
          // for episode art so offline season rows survive that compaction.
          if (key === "image" && path[0] === "cachedDetails" && path[1] === "sections" && path[3] === "items") {
            const section = item.cachedDetails?.sections?.[Number(path[2])];
            const episode = section?.kind === "episodes" ? section.items?.[Number(path[4])] : null;
            if (episode?.id != null) add(["cachedDetails", "episodesById", String(episode.id), "image"], child);
          }
        }
        else if (child && typeof child === "object") visit(child, childPath);
      });
    };
    visit(item);
    return candidates;
  }

  function itemFingerprint(item) {
    // Portable JSON deliberately omits inline image bytes. Include their
    // sources separately so replacing an uploaded cover (whose `image` field
    // is also stripped from JSON) invalidates the folder mirror hash.
    const value = JSON.stringify({
      item: portableItem(item),
      images: collectImageCandidates(item).map(candidate => ({ paths: candidate.paths, source: candidate.source }))
    });
    let first = 0x811c9dc5, second = 0x9e3779b9;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ (code + index), 0x85ebca6b);
    }
    return `${value.length}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
  }

  function folderIndexItem(item) {
    const copy = portableItem(item);
    if (copy.cachedDetails && !copy.cachedDetails.compact) copy.cachedDetails = window.SplitAppIDB?.compactDetails?.(copy.cachedDetails) || copy.cachedDetails;
    return copy;
  }
  function hasSavedArtwork(item) {
    if (item?.thumbnailPath || (Array.isArray(item?.localImageFiles) && item.localImageFiles.length)) return true;
    return [item?.localThumbnailData, item?.localPortraitData, item?.localLandscapeData, item?.localImageData, item?.image, item?.backdrop]
      .some(value => typeof value === "string" && /^data:image\//i.test(value));
  }

  function imageFingerprint(candidates) {
    const value = JSON.stringify(candidates.map(candidate => ({ paths: candidate.paths, source: candidate.source })));
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
    return `${value.length}:${(hash >>> 0).toString(16)}`;
  }

  function readFolderImageHashes(uri) {
    try {
      const value = JSON.parse(localStorage.getItem(folderImageHashKey) || "{}");
      return value && typeof value === "object" && value[uri] && typeof value[uri] === "object" ? value[uri] : {};
    } catch (_) { return {}; }
  }

  function folderArchiveFingerprint(data) {
    // Incremental hash: the whole library is never turned into one string.
    let hash = 0x811c9dc5, length = 0;
    const feed = value => { length += value.length; for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193); };
    feed(String(folderLayoutMarker));
    for (const item of data.items || []) feed(`${String(item?.id || "")}:${itemFingerprint(item)};`);
    feed(JSON.stringify(Array.isArray(data.history) ? data.history : []));
    feed(JSON.stringify(data.preferences && typeof data.preferences === "object" ? data.preferences : {}));
    return `${length}:${(hash >>> 0).toString(16)}`;
  }

  function portableData(data) {
    return {
      items: Array.isArray(data.items) ? data.items.map(portableItem) : [],
      history: Array.isArray(data.history) ? data.history : [],
      preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : {}
    };
  }

  // The browser keeps a trimmed copy of saved details (localStorage is small); the Android database and folder keep everything.
  function trimDetails(details) {
    if (!details || !Array.isArray(details.sections)) return details;
    const limit = { screenshots: 6 };
    const sections = details.sections.filter(section => !/^(posters|you might also like|cast|characters|staff|crew|people|guest cast|guest crew)(?:\b|\s)/i.test(section.title || "") && section.kind !== "people").map(section => {
      const key = Object.keys(limit).find(name => new RegExp(`^${name}`, "i").test(section.title || ""));
      if (key) return { ...section, items: section.items.slice(0, limit[key]) };
      return section;
    });
    const copy = { ...details, sections, trimmed: true };
    delete copy.raw;
    if (copy.facts) { copy.facts = { ...copy.facts }; delete copy.facts.cast; }
    if (Array.isArray(copy.fields)) copy.fields = copy.fields.filter(field => !/^cast|^actors?$/i.test(String(field?.label || "").trim()));
    return copy;
  }
  function browserData(data) {
    return {
      items: Array.isArray(data.items) ? data.items.map(item => {
        const copy = { ...item };
        delete copy.localImageData;
        delete copy.localThumbnailData;
        if (copy.cachedDetails) copy.cachedDetails = trimDetails(copy.cachedDetails);
        if (copy.facts) { copy.facts = { ...copy.facts }; delete copy.facts.cast; }
        delete copy.localPortraitData;
        delete copy.localLandscapeData;
        return copy;
      }) : [],
      history: Array.isArray(data.history) ? data.history : [],
      preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : {}
    };
  }

  function readFolderHashes(uri) {
    try {
      const value = JSON.parse(localStorage.getItem(folderItemHashKey) || "{}");
      return value && typeof value === "object" && value[uri] && typeof value[uri] === "object" ? value[uri] : {};
    } catch (_) { return {}; }
  }

  async function listFolderTreeItems(uri, { hydrate = true } = {}) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!uri || !plugin?.listFiles) return [];
    const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
    const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
    if (!tree) return [];
    const treeFiles = (await plugin.listFiles({ uri: tree.uri }))?.files || [];
    const categoryDirs = treeFiles.filter(file => ["movies", "series", "shows", "titles"].includes(file.name) && file.uri);
    if (!categoryDirs.length) return [];
    const gameFolders = (await Promise.all(categoryDirs.map(directory => listCategoryItemFolders(plugin, directory)))).flat();
    const queue = gameFolders.filter(row => row.folder?.uri);
    const items = [];
    let queueIndex = 0;
    const worker = async () => {
      while (queueIndex < queue.length) {
        const row = queue[queueIndex++], folder = row.folder;
        try {
          const files = row.files || (await plugin.listFiles({ uri: folder.uri }))?.files || [];
          const index = files.find(file => file.name === "index.json" && file.uri);
          if (!index) continue;
          const parsed = JSON.parse((await plugin.readFile({ uri: index.uri })).content || "{}");
          if (!parsed || typeof parsed !== "object" || parsed.id == null) continue;
          const item = parsed;
          if (item.cachedDetails && !item.cachedDetails.compact) item.cachedDetails = window.SplitAppIDB?.compactDetails?.(item.cachedDetails) || item.cachedDetails;
          if (hydrate && typeof item.thumbnailPath === "string" && item.thumbnailPath) {
            const thumbnailName = item.thumbnailPath.split("/").pop();
            const thumbnail = files.find(file => file.name === thumbnailName && file.uri);
            if (thumbnail && plugin.readBinaryFile) {
              try {
                const { base64Content } = await plugin.readBinaryFile({ uri: thumbnail.uri, maxBytes: 16 * 1024 * 1024 });
                if (base64Content) item.localPortraitData = item.localThumbnailData = `data:${item.thumbnailMime || "image/webp"};base64,${base64Content}`;
              } catch (error) { console.warn(`Could not read local artwork for ${item.title || item.id}`, error); }
            }
          }
          items.push(item);
        } catch (error) { console.warn(`Could not read ScreenMark item folder ${folder.name}`, error); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
    const byId = new Map();
    items.forEach(item => { const key = String(item.id), old = byId.get(key); if (!old || (Number(item.updatedAt) || 0) > (Number(old.updatedAt) || 0)) byId.set(key, item); });
    return [...byId.values()];
  }

  // Listing the movie/show folders through Android's storage framework is slow (one call per
  // directory level, especially for large libraries), and every artwork batch used to repeat it. Cache the
  // index for a short time and drop it whenever we write to the folder.
  let gamesIndexCache = null;
  function invalidateGamesIndex() { gamesIndexCache = null; }
  function getGamesIndex(plugin, uri) {
    if (gamesIndexCache && gamesIndexCache.uri === uri && Date.now() - gamesIndexCache.at < 30000) return gamesIndexCache.promise;
    const promise = (async () => {
      const root = (await plugin.listFiles({ uri }))?.files || [];
      const tree = root.find(file => file.name === folderTreeName && file.uri);
      const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
      const categoryDirs = treeFiles.filter(file => ["movies", "series", "shows", "titles"].includes(file.name) && file.uri);
      const entries = (await Promise.all(categoryDirs.map(directory => listCategoryItemFolders(plugin, directory)))).flat();
      const index = new Map();
      entries.forEach(row => {
        const { folder, categoryName, sourceName, legacy } = row;
        if (!folder?.uri) return;
        const kind = categoryFolderKind(categoryName), category = kind === "series" ? "series" : kind === "movie" ? "movies" : "titles";
        if (sourceName && !legacy) index.set(`${category}/${sourceName}/${folder.name}`, folder);
        else {
          index.set(`${categoryName}/${folder.name}`, folder);
          if (kind) index.set(`${category}/${folder.name}`, folder);
          if (categoryName === "titles") { index.set(`titles/${folder.name}`, folder); index.set(folder.name, folder); }
        }
      });
      return index;
    })();
    gamesIndexCache = { uri, at: Date.now(), promise };
    promise.catch(() => { if (gamesIndexCache?.promise === promise) gamesIndexCache = null; });
    return promise;
  }

  // Resolve one current-layout title folder by its known path. Detail views
  // should not enumerate every provider/category folder just to open one image.
  async function findItemFolder(plugin, uri, item) {
    const root = (await plugin.listFiles({ uri }))?.files || [];
    let directory = root.find(file => file.name === folderTreeName && file.uri);
    if (directory) {
      for (const name of itemFolderPath(item).slice(1)) {
        const entries = (await plugin.listFiles({ uri: directory.uri }))?.files || [];
        directory = entries.find(file => file.name === name && file.uri);
        if (!directory) break;
      }
      if (directory?.uri) return directory;
    }
    // Older folder layouts do not include the metadata-source directory.
    const folders = await getGamesIndex(plugin, uri);
    const id = itemDirectoryName(item), category = categoryFolderName(item);
    return folders.get(itemFolderIndexKey(item)) || folders.get(`${category}/${id}`)
      || folders.get(`${category === "series" ? "shows" : "movies"}/${id}`)
      || folders.get(`titles/${id}`) || folders.get(id) || null;
  }

  // Fills in `localThumbnailData` for library items from the saved folder, so covers still show after the app/WebView cache is cleared or while offline.
  async function hydrateThumbnails(items, onBatch) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!Array.isArray(items) || !plugin?.listFiles || !plugin?.readBinaryFile) return 0;
    const uri = await getFolderUri({ prompt: false });
    if (!uri) return 0;
    const folders = await getGamesIndex(plugin, uri);
    if (!folders.size) return 0;
    const queue = items.filter(item => isLibraryItem(item) && ((!item.localPortraitData && !item.localThumbnailData) || (!item.localLandscapeData && (item.backdrop || item.cachedDetails?.landscapeImage))) && (item.thumbnailPath || (Array.isArray(item.localImageFiles) && item.localImageFiles.length)));
    let done = 0;
    let queueIndex = 0;
    const worker = async () => {
      while (queueIndex < queue.length) {
        const item = queue[queueIndex++], id = itemDirectoryName(item), category = categoryFolderName(item);
        const folder = folders.get(itemFolderIndexKey(item)) || folders.get(`${category}/${id}`) || folders.get(`${category === "series" ? "shows" : "movies"}/${id}`) || folders.get(`titles/${id}`) || folders.get(id);
        if (!folder) continue;
        try {
          const files = (await plugin.listFiles({ uri: folder.uri }))?.files || [];
          const name = item.thumbnailPath ? String(item.thumbnailPath).split("/").pop() : ".thumbnail";
          const thumbnail = files.find(file => file.name === name && file.uri);
          const { base64Content } = thumbnail ? await plugin.readBinaryFile({ uri: thumbnail.uri, maxBytes: 16 * 1024 * 1024 }) : {};
          if (base64Content) item.localPortraitData = item.localThumbnailData = `data:${item.thumbnailMime || "image/webp"};base64,${base64Content}`;
          const landscapeRef = (Array.isArray(item.localImageFiles) ? item.localImageFiles : []).find(image => (Array.isArray(image?.paths) ? image.paths : []).some(path => Array.isArray(path) && path.some(part => /backdrop|landscapeImage|backgroundImage/i.test(String(part)))));
          if (landscapeRef) {
            const landscapeFile = files.find(file => file.name === landscapeRef.fileName && file.uri);
            const landscape = landscapeFile ? await plugin.readBinaryFile({ uri: landscapeFile.uri, maxBytes: 16 * 1024 * 1024 }) : {};
            if (landscape.base64Content) item.localLandscapeData = `data:${landscapeRef.mimeType || "image/webp"};base64,${landscape.base64Content}`;
          }
          if (base64Content || item.localLandscapeData) { done += 1; if (done % 6 === 0) onBatch?.(done); }
        } catch (error) { console.warn(`Could not read saved artwork for ${item.title || item.id}`, error); }
      }
    };
    const lowMemory = Boolean(window.Capacitor?.isNativePlatform?.())
      || (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2);
    await Promise.all(Array.from({ length: lowMemory ? 2 : 4 }, () => worker()));
    return done;
  }

  async function loadItemImages(item) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    const uri = await getFolderUri({ prompt: false });
    if (!uri || !plugin?.listFiles || !plugin?.readBinaryFile || !Array.isArray(item?.localImageFiles)) return {};
    const folder = await findItemFolder(plugin, uri, item);
    const files = folder ? (await plugin.listFiles({ uri: folder.uri }))?.files || [] : [];
    const result = {};
    for (const image of item.localImageFiles) {
      const file = files.find(entry => entry.name === image.fileName && entry.uri);
      if (!file) continue;
      try {
        const value = await plugin.readBinaryFile({ uri: file.uri, maxBytes: 16 * 1024 * 1024 });
        if (!value?.base64Content) continue;
        const dataUrl = `data:${image.mimeType || "image/jpeg"};base64,${value.base64Content}`;
        for (const path of image.paths || []) result[path.join(".")] = dataUrl;
      } catch (error) { console.warn(`Could not read local image ${image.fileName}`, error); }
    }
    return result;
  }

  function decodeImageBlob(blob) {
    if (typeof createImageBitmap === "function") return createImageBitmap(blob);
    const objectUrl = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image could not be decoded")); };
      image.src = objectUrl;
    });
  }

  function blobAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
      reader.onerror = () => reject(reader.error || new Error("Image could not be encoded"));
      reader.readAsDataURL(blob);
    });
  }

  async function makeThumbnail(source) {
    if (typeof source !== "string" || !source) return null;
    if (/^http:\/\//i.test(source)) return null;
    if (!/^https:\/\//i.test(source) && !/^data:image\//i.test(source)) return null;
    try { const parsed = new URL(source); if (parsed.username || parsed.password) return null; } catch (_) { if (!/^data:image\//i.test(source)) return null; }
    let requestTimer;
    try {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      if (controller) requestTimer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(source, controller ? { signal: controller.signal, credentials: "omit", redirect: "error" } : { credentials: "omit", redirect: "error" });
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const maxBytes = 16 * 1024 * 1024;
      const responseType = String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (responseType && !responseType.startsWith("image/")) throw new Error("The source did not return an image.");
      const declaredSize = Number(response.headers.get("content-length")) || 0;
      if (declaredSize > maxBytes) throw new Error("Image response is too large.");
      let original;
      if (response.body?.getReader) {
        const reader = response.body.getReader(), chunks = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) { await reader.cancel(); throw new Error("Image response is too large."); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        original = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
      } else {
        original = await response.blob();
        if (original.size > maxBytes) throw new Error("Image response is too large.");
      }
      let output = original;
      try {
        const canvas = document.createElement("canvas");
        let bitmap;
        try {
          bitmap = await decodeImageBlob(original);
          const width = bitmap.width || bitmap.naturalWidth || 1;
          const height = bitmap.height || bitmap.naturalHeight || 1;
          const scale = Math.min(1, 500 / width, 500 / height);
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable");
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        } finally { if (typeof bitmap?.close === "function") bitmap.close(); }
        output = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.88)) || original;
      } catch (_) { output = original; }
      return { base64Content: await blobAsBase64(output), mimeType: output.type || original.type || "image/jpeg" };
    } catch (error) {
      const match = source.match(/^data:([^;,]+);base64,(.*)$/s);
      if (match) {
        if (match[2].length > Math.ceil(16 * 1024 * 1024 * 4 / 3) + 4) throw new Error("Image response is too large.");
        return { base64Content: match[2], mimeType: match[1] };
      }
      const plugin = window.Capacitor?.Plugins?.BackupFolder;
      if (/^https?:\/\//i.test(source) && plugin?.downloadImage) {
        const image = await plugin.downloadImage({ url: source, maxDimension: 500 });
        if (image?.base64Content) return image;
      }
      throw error;
    } finally { if (requestTimer) clearTimeout(requestTimer); }
  }

  // Cache every episode still from the saved guide, not just rows the user has
  // scrolled into view. The detail record remains the source of truth for the
  // remote URL; this image cache provides a persistent offline copy.
  const episodeImageJobs = new Map();
  const episodeThumbKey = (itemId, episodeId) => `${app.key}:episode:${String(itemId)}:${String(episodeId)}`;
  const comparableArtworkUrl = value => {
    try {
      const url = new URL(String(value || ""));
      url.hash = ""; url.search = "";
      if (url.hostname === "image.tmdb.org") url.pathname = url.pathname.replace(/\/t\/p\/(?:original|w\d+)\//, "/t/p/{size}/");
      return url.href;
    } catch (_) { return String(value || ""); }
  };
  async function cacheEpisodeThumbnails(item, onProgress = () => {}) {
    if (!item?.id || imageStorage !== "all" || !window.SplitAppIDB?.getThumbs || !window.SplitAppIDB?.putThumbs) return { cached: 0, skipped: true };
    const id = String(item.id), active = episodeImageJobs.get(id);
    if (active) { active.listeners.add(onProgress); return active.promise; }
    const urls = new Map(), episodeSeasons = new Map();
    const seriesArtwork = new Set([
      item.image, item.customCover, item.backdrop, item.cachedDetails?.image,
      item.cachedDetails?.portraitImage, item.cachedDetails?.landscapeImage,
      item.cachedDetails?.backgroundImage
    ].filter(value => /^https:\/\//i.test(String(value || ""))).map(comparableArtworkUrl));
    for (const section of item.cachedDetails?.sections || []) {
      if (section?.kind !== "episodes") continue;
      for (const episode of section.items || []) {
        const url = String(episode?.image || "");
        if (episode?.id != null && /^https:\/\//i.test(url) && !seriesArtwork.has(comparableArtworkUrl(url))) {
          const id = String(episode.id);
          urls.set(id, url);
          episodeSeasons.set(id, String(episode.season ?? section.season ?? section.title?.match(/season\s*(\d+)/i)?.[1] ?? "?"));
        }
      }
    }
    const listeners = new Set([onProgress]), report = value => listeners.forEach(listener => { try { listener(value); } catch (_) {} });
    const task = (async () => {
      let cached = 0, completed = 0, failed = 0;
      const seasonOf = episodeId => episodeSeasons.get(episodeId) || "?";
      const entries = [...urls].map(([episodeId, url]) => [episodeThumbKey(id, episodeId), url, episodeId]);
      const seasons = new Set(entries.map(([, , episodeId]) => seasonOf(episodeId)));
      const seasonsDone = new Set();
      report({ status: "images", total: entries.length, completed: 0, failed: 0, seasons: seasons.size, seasonsDone: 0, season: "", cached: 0 });
      for (let offset = 0; offset < entries.length; offset += 6) {
        const batch = entries.slice(offset, offset + 6);
        let already;
        try { already = new Map(await window.SplitAppIDB.getThumbs(batch.map(([key, url]) => [key, url]))); }
        catch (_) {
          failed += batch.length;
          completed += batch.length;
          report({ status: "images", total: entries.length, completed, failed, seasons: seasons.size, seasonsDone: seasonsDone.size, season: seasonOf(batch.at(-1)?.[2]), cached });
          continue;
        }
        const writes = [];
        let activeSeason = "";
        for (const [key, signature, episodeId] of batch) {
          activeSeason = seasonOf(episodeId);
          if (!already.has(key)) try {
              const image = await makeThumbnail(signature);
              if (image?.base64Content) {
                const binary = atob(image.base64Content), bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
                writes.push([key, signature, new Blob([bytes], { type: image.mimeType || "image/webp" })]);
              } else failed++;
            } catch (_) { failed++; }
          else cached++;
          completed++;
        }
        if (writes.length) {
          try { await window.SplitAppIDB.putThumbs(writes); cached += writes.length; }
          catch (_) { failed += writes.length; }
        }
        const remainingSeasons = new Set(entries.slice(offset + 6).map(([, , episodeId]) => seasonOf(episodeId)));
        new Set(batch.map(([, , episodeId]) => seasonOf(episodeId))).forEach(season => {
          if (!remainingSeasons.has(season)) seasonsDone.add(season);
        });
        report({ status: "images", total: entries.length, completed, failed, seasons: seasons.size, seasonsDone: seasonsDone.size, season: activeSeason, cached });
        if (offset + 6 < entries.length) await new Promise(resolve => setTimeout(resolve, 0));
      }
      return { cached, total: entries.length, failed };
    })().finally(() => episodeImageJobs.delete(id));
    episodeImageJobs.set(id, { promise: task, listeners });
    return task;
  }

  // Persist the rest of a title's artwork beside episode stills. Keys are
  // derived from the metadata path so detail pages can restore galleries and
  // backdrops without depending on WebView's disposable HTTP cache.
  async function cacheArtwork(item, onProgress = () => {}) {
    if (!item?.id || imageStorage !== "all" || !window.SplitAppIDB?.getThumbs || !window.SplitAppIDB?.putThumbs) return { cached: 0, skipped: true };
    const entries = artworkCacheEntries(item).map(({ key, signature }) => [key, signature]);
    let cached = 0, failed = 0;
    for (let offset = 0; offset < entries.length; offset += 6) {
      const batch = entries.slice(offset, offset + 6);
      let existing;
      try { existing = new Map(await window.SplitAppIDB.getThumbs(batch)); }
      catch (_) { failed += batch.length; continue; }
      const writes = [];
      for (const [key, signature] of batch) {
        if (existing.has(key)) { cached++; continue; }
        try {
          const image = await makeThumbnail(signature);
          if (!image?.base64Content) { failed++; continue; }
          const binary = atob(image.base64Content), bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
          writes.push([key, signature, new Blob([bytes], { type: image.mimeType || "image/webp" })]);
        } catch (_) { failed++; }
      }
      if (writes.length) {
        try { await window.SplitAppIDB.putThumbs(writes); cached += writes.length; }
        catch (_) { failed += writes.length; }
      }
      onProgress({ status: "artwork", total: entries.length, completed: Math.min(offset + batch.length, entries.length), cached, failed });
      if (offset + batch.length < entries.length) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { cached, total: entries.length, failed };
  }

  function artworkCacheEntries(item) {
    if (!item?.id) return [];
    const id = String(item.id), primary = String(item.customCover || item.localThumbnailData || item.localPortraitData || item.image || item.cachedDetails?.portraitImage || ""), used = new Set();
    return collectAllImageCandidates(item).filter(candidate => /^https:\/\//i.test(candidate.source)).map(candidate => {
      const hasImagePath = candidate.paths.some(path => path.length === 1 && path[0] === "image");
      const detailPath = candidate.paths.find(path => !(path.length === 1 && path[0] === "image"));
      let key = hasImagePath && candidate.source === primary ? `${id}:p`
        : `${app.key}:art:${id}:${(detailPath || ["alternate", candidate.source]).map(part => encodeURIComponent(String(part))).join(".")}`;
      if (used.has(key)) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < candidate.source.length; index++) hash = Math.imul(hash ^ candidate.source.charCodeAt(index), 0x01000193);
        key = `${key}:alt:${(hash >>> 0).toString(16)}`;
      }
      used.add(key);
      return { key, signature: candidate.source, paths: candidate.paths.filter(path => key === `${id}:p` || !(path.length === 1 && path[0] === "image")) };
    });
  }

  async function syncFolderTree(payload, uri) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!uri || !plugin?.writeNestedFile || !plugin?.writeNestedBinaryFile) return;
    const treePath = [folderTreeName];
    const hashes = readFolderHashes(uri);
    const imageHashes = readFolderImageHashes(uri);
    const markerKey = `${folderItemHashKey}_nomedia_v2`;
    if (localStorage.getItem(markerKey) !== uri) {
      try {
        await plugin.writeNestedFile({ uri, dirPath: treePath, fileName: ".nomedia", content: "" });
        const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
        const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
        const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
        for (const legacyMarker of treeFiles.filter(file => file.name === ".nomedia.json" && file.uri)) {
          try { await plugin.deleteFile?.({ uri: legacyMarker.uri }); } catch (_) {}
        }
        localStorage.setItem(markerKey, uri);
      } catch (_) {}
    }

    const pendingItems = payload.items.filter(item => item?.id);
    const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
    const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
    const oldTreeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
    const migrationPass = !oldTreeFiles.some(file => file.name === folderLayoutMarker && file.uri);
    const existingGameFolders = new Map();
    const categoryListings = (await Promise.all(oldTreeFiles.filter(file => ["movies", "series", "shows", "titles"].includes(file.name) && file.uri).map(directory => listCategoryItemFolders(plugin, directory)))).flat();
    for (const row of categoryListings) {
      const { categoryName, sourceName, folder } = row;
      if (!folder?.uri) continue;
      const kind = categoryFolderKind(categoryName), category = kind === "series" ? "series" : kind === "movie" ? "movies" : "titles";
      if (sourceName && !row.legacy) existingGameFolders.set(`${category}/${sourceName}/${folder.name}`, row);
      else {
        existingGameFolders.set(`${categoryName}/${folder.name}`, row);
        if (kind) existingGameFolders.set(`${category}/${folder.name}`, row);
        if (categoryName === "titles") { existingGameFolders.set(`titles/${folder.name}`, row); existingGameFolders.set(folder.name, row); }
      }
    }
    const syncedIds = new Set();
    const syncItem = async item => {
      const dirPath = itemFolderPath(item);
      const thumbnailPath = `${dirPath.join("/")}/.thumbnail`;
        let imageWritten = true, imageDeferred = false;
      try {
        const itemHash = itemFingerprint(folderIndexItem(item));
        const id = String(item.id), candidates = collectImageCandidates(item), imageHash = imageFingerprint(candidates);
        const targetKey = itemFolderIndexKey(item);
        const destinationItem = existingGameFolders.get(targetKey);
        // The streamed root database already contains every title and all its
        // metadata. Per-title mirror folders are for saved artwork; creating
        // 10,000 metadata-only directories adds SAF calls and memory without
        // making a poster more available offline.
        const hasExistingArtwork = (destinationItem?.files || []).some(file => file.name === ".thumbnail" || file.name.startsWith(".image-"));
        const hasInlineArtwork = candidates.some(candidate => /^data:image\//i.test(candidate.source));
        if (!hasSavedArtwork(item) && !hasInlineArtwork && !hasExistingArtwork) {
          syncedIds.add(id); hashes[id] = itemHash; return;
        }
        const itemId = itemDirectoryName(item), category = categoryFolderName(item);
        const legacyItem = existingGameFolders.get(`${category}/${itemId}`)
          || existingGameFolders.get(`${category === "series" ? "shows" : "movies"}/${itemId}`)
          || existingGameFolders.get(`titles/${itemId}`)
          || existingGameFolders.get(itemId);
        let existingFiles = [];
        let existingFilesLoaded = false;
        const loadExistingFiles = async () => {
          if (!existingFilesLoaded) {
            existingFiles = destinationItem ? destinationItem.files || (await plugin.listFiles({ uri: destinationItem.folder.uri }))?.files || [] : [];
            existingFilesLoaded = true;
          }
          return existingFiles;
        };
        const legacyFiles = !destinationItem && legacyItem ? legacyItem.files || (await plugin.listFiles({ uri: legacyItem.folder.uri }))?.files || [] : [];
        const existingNames = new Set();
        const cacheFilesExist = async files => {
          if (!Array.isArray(files)) return false;
          const present = new Set((await loadExistingFiles()).map(file => file.name));
          return files.every(file => present.has(file.fileName));
        };
        const cachedImages = imageHashes[id];
        // A persisted fingerprint proves ScreenMark wrote this unchanged item
        // successfully before. A destination folder with no legacy `titles/`
        // copy also proves the prior migration completed its index write:
        // legacy folders are removed only after a successful destination sync.
        // Trust either proof during a marker-only pass to avoid one SAF read
        // per item. If legacy data remains, keep verifying before deleting it.
        if (migrationPass && destinationItem && (!legacyItem || hashes[id] === itemHash)) {
          syncedIds.add(id);
          if (!legacyItem) hashes[id] = itemHash;
          return;
        }
        if (destinationItem && hashes[id] === itemHash && cachedImages?.fingerprint === imageHash && await cacheFilesExist(cachedImages.files)) { syncedIds.add(id); return; }
        await loadExistingFiles();
        existingFiles.forEach(file => existingNames.add(file.name));
        // Resume a migration interrupted after writing an item folder. Reuse its
        // verified index and artwork instead of downloading and rewriting them.
        if (migrationPass && destinationItem && plugin.readFile) {
          const indexFile = existingFiles.find(file => file.name === "index.json" && file.uri);
          if (indexFile) {
            try {
              const saved = JSON.parse((await plugin.readFile({ uri: indexFile.uri }))?.content || "null");
              const sameRevision = saved && String(saved.id) === id && saved.category === item.category
                && (Number(saved.updatedAt) || 0) === (Number(item.updatedAt) || 0)
                && saved.title === item.title && saved.status === item.status
                && Number(saved.progress) === Number(item.progress);
              if (sameRevision) {
                const savedImages = Array.isArray(saved.localImageFiles) ? saved.localImageFiles : [];
                if (savedImages.every(file => existingNames.has(file.fileName))) {
                  item.localImageFiles = savedImages;
                  item.thumbnailPath = saved.thumbnailPath || "";
                  item.thumbnailMime = saved.thumbnailMime || "";
                  if (saved.localImageFingerprint) item.localImageFingerprint = saved.localImageFingerprint;
                  else delete item.localImageFingerprint;
                  syncedIds.add(id);
                  hashes[id] = itemHash;
                  if (savedImages.length) imageHashes[id] = { fingerprint: imageHash, files: savedImages };
                  else delete imageHashes[id];
                  return;
                }
              }
            } catch (_) {}
          }
        }
        const localImageFiles = [];
        const usedFileNames = new Set();
        if (destinationItem && cachedImages?.fingerprint === imageHash && await cacheFilesExist(cachedImages.files)) {
          localImageFiles.push(...cachedImages.files);
          cachedImages.files.forEach(file => usedFileNames.add(file.fileName));
        } else if (destinationItem && item.localImageFingerprint === imageHash && cacheFilesExist(item.localImageFiles)) {
          localImageFiles.push(...item.localImageFiles);
          item.localImageFiles.forEach(file => usedFileNames.add(file.fileName));
        } else if (!destinationItem && legacyItem && item.localImageFiles?.length && plugin.readBinaryFile) {
          const refs = item.localImageFiles;
          const available = refs.every(ref => legacyFiles.some(file => file.name === ref.fileName && file.uri));
          if (available) {
            for (const ref of refs) {
              const sourceFile = legacyFiles.find(file => file.name === ref.fileName && file.uri);
              const image = await plugin.readBinaryFile({ uri: sourceFile.uri });
              if (!image?.base64Content) { imageWritten = false; break; }
              await plugin.writeNestedBinaryFile({ uri, dirPath, fileName: ref.fileName, base64Content: image.base64Content });
              localImageFiles.push(ref); usedFileNames.add(ref.fileName);
            }
          } else imageWritten = false;
        } else if (migrationPass
          && !existingFiles.some(file => file.name === ".thumbnail" || file.name.startsWith(".image-"))
          && !legacyFiles.some(file => file.name === ".thumbnail" || file.name.startsWith(".image-"))
          && candidates.some(candidate => /^https?:\/\//i.test(candidate.source))
          && !candidates.some(candidate => /^data:image\//i.test(candidate.source))) {
          // Existing catalogs may only reference online artwork. Do not
          // redownload hundreds of remote posters just to migrate metadata.
          imageDeferred = true;
        } else {
          for (const [candidateIndex, candidate] of candidates.entries()) {
            const fileName = candidate.paths.some(path => path.length === 1 && path[0] === "image")
              ? ".thumbnail"
              : `.image-${candidateIndex}`;
            usedFileNames.add(fileName);
            const image = await makeThumbnail(candidate.source);
            if (image?.base64Content) {
              await plugin.writeNestedBinaryFile({ uri, dirPath, fileName, base64Content: image.base64Content });
              localImageFiles.push({ paths: candidate.paths, fileName, mimeType: image.mimeType });
            } else {
              imageWritten = false;
            }
          }
        }
        if (!destinationItem && legacyItem && !imageWritten) throw new Error("Could not safely migrate saved artwork; the existing title folder was kept.");
        const thumbnail = localImageFiles.find(file => file.fileName === ".thumbnail");
        if (imageWritten && !imageDeferred) item.localImageFingerprint = imageHash;
        else delete item.localImageFingerprint;
        item.thumbnailPath = thumbnail ? thumbnailPath : "";
        item.thumbnailMime = thumbnail?.mimeType || "";
        item.localImageFiles = localImageFiles;
        for (const oldFile of existingFiles) {
          if ((oldFile.name.startsWith(".image-") || oldFile.name === ".thumbnail") && !usedFileNames.has(oldFile.name) && oldFile.uri) {
            try { await plugin.deleteFile?.({ uri: oldFile.uri }); } catch (_) {}
          }
        }
        // The root streamed database is authoritative. Per-title indexes are a
        // recovery/navigation aid, so keep only compact schedule metadata here;
        // duplicating cast, galleries and raw provider payloads per title
        // creates huge WebView bridge allocations on large libraries.
        const indexItem = folderIndexItem(item);
        await plugin.writeNestedFile({ uri, dirPath, fileName: "index.json", content: JSON.stringify(indexItem) }); invalidateGamesIndex();
        if (imageWritten) syncedIds.add(id);
        hashes[id] = itemHash;
        if (imageWritten && !imageDeferred && localImageFiles.length) imageHashes[id] = { fingerprint: imageHash, files: localImageFiles };
        else delete imageHashes[id];
      } catch (error) {
        delete hashes[String(item.id)];
        console.warn(`Could not sync ScreenMark item ${item.title || item.id} to the selected folder`, error);
      }
    };
    const itemQueue = [...pendingItems];
    const workerCount = Math.max(1, Math.min(6, Number(payload.preferences?.metadataWorkers) || 4, itemQueue.length || 1));
    // Folder mirroring is background work: hand the main thread back between games (image resizing and hashing
    // for ~1500 games otherwise freezes taps and scrolling), and pause while the app is hidden.
    const idle = () => new Promise(resolve => (window.requestIdleCallback ? window.requestIdleCallback(() => resolve(), { timeout: 800 }) : setTimeout(resolve, 20)));
    let itemQueueIndex = 0;
    await Promise.all(Array.from({ length: Math.min(workerCount, 3) }, async () => {
      let batch = 0;
      while (itemQueueIndex < itemQueue.length) {
        if (batch++ % 6 === 0) await idle();
        if (itemQueueIndex >= itemQueue.length) return;
        await syncItem(itemQueue[itemQueueIndex++]);
      }
    }));

    if (plugin.deleteFile) {
      try {
        const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
        const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
        const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
        const directories = treeFiles.filter(file => ["movies", "series", "shows", "titles"].includes(file.name) && file.uri);
        const liveById = new Map(payload.items.filter(item => item?.id).map(item => [itemDirectoryName(item), item]));
        for (const directory of directories) {
          const rows = await listCategoryItemFolders(plugin, directory);
          for (const row of rows) {
            const { folder, categoryName, sourceName, sourceFolder, legacy } = row;
            let item = liveById.get(folder.name);
            const deletedTitle = !item;
            // Only touch folders carrying a valid ScreenMark item index. This lets
            // synchronization remove orphaned titles without disturbing user files.
            if (!item) {
              const indexFile = (row.files || []).find(file => file.name === "index.json" && file.uri);
              if (!indexFile || !plugin.readFile) continue;
              try { item = JSON.parse((await plugin.readFile({ uri: indexFile.uri }))?.content || "null"); }
              catch (_) { continue; }
              if (!item?.id || itemDirectoryName(item) !== folder.name) continue;
            }
            const itemId = String(item.id);
            const desiredSource = itemSourceFolderName(item);
            const folderKind = categoryFolderKind(categoryName);
            const isDesired = !deletedTitle && !legacy && folderKind === item.category && sourceName === desiredSource;
            if (isDesired) continue;
            const isLegacyLocation = legacy && (categoryName === "titles" || folderKind === item.category);
            const isStaleSource = !legacy && folderKind === item.category && sourceName !== desiredSource;
            if (!deletedTitle && !(isLegacyLocation || isStaleSource)) continue;
            if (!deletedTitle && !syncedIds.has(itemId)) continue;
            try {
              for (const file of row.files || []) if (file.uri) await plugin.deleteFile({ uri: file.uri });
              await plugin.deleteFile({ uri: folder.uri });
              if (sourceFolder?.uri) {
                const remaining = (await plugin.listFiles({ uri: sourceFolder.uri }))?.files || [];
                if (!remaining.some(file => file.uri)) await plugin.deleteFile({ uri: sourceFolder.uri });
              }
              invalidateGamesIndex();
            } catch (error) { console.warn(`Could not remove old ScreenMark item folder ${folder.name}`, error); }
          }
        }
      } catch (error) { console.warn("Could not check for removed ScreenMark item folders", error); }
    }
    const liveIds = new Set(payload.items.filter(item => item?.id != null).map(item => String(item.id)));
    for (const id of Object.keys(hashes)) if (!liveIds.has(id)) delete hashes[id];
    for (const id of Object.keys(imageHashes)) if (!liveIds.has(id)) delete imageHashes[id];
    let allHashes = {};
    try { allHashes = JSON.parse(localStorage.getItem(folderItemHashKey) || "{}"); } catch (_) {}
    if (!allHashes || typeof allHashes !== "object") allHashes = {};
    allHashes[uri] = hashes;
    localStorage.setItem(folderItemHashKey, JSON.stringify(allHashes));
    let allImageHashes = {};
    try { allImageHashes = JSON.parse(localStorage.getItem(folderImageHashKey) || "{}"); } catch (_) {}
    if (!allImageHashes || typeof allImageHashes !== "object") allImageHashes = {};
    allImageHashes[uri] = imageHashes;
    localStorage.setItem(folderImageHashKey, JSON.stringify(allImageHashes));
    if (syncedIds.size === pendingItems.length) {
      try {
        const sourceCounts = {};
        payload.items.filter(item => item?.id).forEach(item => {
          const category = categoryFolderName(item), source = itemSourceFolderName(item);
          sourceCounts[`${category}/${source}`] = (sourceCounts[`${category}/${source}`] || 0) + 1;
        });
        await plugin.writeNestedFile({ uri, dirPath: treePath, fileName: folderLayoutMarker, content: JSON.stringify({ version: 3, movies: payload.items.filter(item => item?.id && item.category !== "series").length, series: payload.items.filter(item => item?.id && item.category === "series").length, sources: sourceCounts }) });
      } catch (error) { console.warn("Could not mark ScreenMark movie and show folders as migrated", error); }
    } else {
      const missingIds = pendingItems.map(item => String(item.id)).filter(id => !syncedIds.has(id));
      console.warn(`ScreenMark movie/show migration incomplete: ${syncedIds.size}/${pendingItems.length} titles synced; ${missingIds.length} missing (sample: ${missingIds.slice(0, 8).join(", ")})`);
    }
  }

  async function hasCurrentFolderLayout(uri) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!uri || !plugin?.listFiles) return true;
    try {
      const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
      const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
      if (!tree) return false;
      const treeFiles = (await plugin.listFiles({ uri: tree.uri }))?.files || [];
      return treeFiles.some(file => file.name === folderLayoutMarker && file.uri);
    } catch (_) { return false; }
  }

  function hasFolderPlugin() {
    return Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.BackupFolder);
  }

  async function getFolderUri({ prompt = true } = {}) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!hasFolderPlugin() || !plugin) return "";

    let uri = localStorage.getItem(folderUriKey) || "";
    if (!uri && plugin.getRememberedFolder) {
      try { uri = (await plugin.getRememberedFolder())?.uri || ""; } catch (_) {}
    }
    if (uri) {
      try {
        const result = await plugin.hasPersistedFolder({ uri });
        if (result?.valid) {
          activeFolderUri = uri;
          localStorage.setItem(folderUriKey, uri);
          return uri;
        }
      } catch (_) {}
      if (!prompt) throw new Error("The previously selected storage folder is unavailable. Choose it again in Settings → Backups.");
      uri = "";
    }
    if (!prompt) return "";

    const picked = await plugin.pickFolder();
    if (!picked?.uri) throw new Error("Choose a storage folder to continue.");
    uri = picked.uri;
    localStorage.setItem(folderUriKey, uri);
    activeFolderUri = uri;
    try { await plugin.rememberFolder?.({ uri }); } catch (_) {}
    return uri;
  }

  async function readFolderDatabase(uri) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    const listing = await plugin.listFiles({ uri });
    const files = listing?.files || [];
    const tree = files.find(entry => entry.name === folderTreeName && entry.uri);
    const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
    const backups = files.filter(entry => entry.uri && new RegExp(`^${app.key}(?:-backup-|_backup_)\\d{4}-\\d{2}-\\d{2}\\.json(?:\\.gz)?$`, "i").test(entry.name))
      .sort((a, b) => (Number(b.lastModified) || 0) - (Number(a.lastModified) || 0) || b.name.localeCompare(a.name));
    const candidates = [
      treeFiles.find(entry => entry.name === "database.json" && entry.uri),
      files.find(entry => entry.name === databaseFileName && entry.uri),
      treeFiles.find(entry => entry.name === "database.json.previous" && entry.uri),
      files.find(entry => entry.name === databaseFileName + ".previous" && entry.uri),
      ...backups
    ].filter((entry, index, all) => entry && all.findIndex(other => other?.uri === entry.uri) === index);
    for (const file of candidates) {
      try {
        let parsed;
        if (Number(file.size) >= 2 * 1024 * 1024 && plugin.openFolderReadStream && plugin.readFolderStream && window.SplitAppBackupStream && typeof ReadableStream === "function") {
          const streamId = `folder-read-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await plugin.openFolderReadStream({ uri: file.uri, id: streamId });
          let stream = new ReadableStream({
            async pull(controller) {
              try {
                const chunk = await plugin.readFolderStream({ id: streamId, length: 256 * 1024 });
                const binary = atob(chunk?.base64Content || ""), bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
                if (bytes.length) controller.enqueue(bytes);
                if (chunk?.done || !bytes.length) controller.close();
              } catch (error) { controller.error(error); }
            },
            async cancel() { try { await plugin.closeFolderReadStream({ id: streamId }); } catch (_) {} }
          });
          try {
            if (/\.gz$/i.test(file.name)) {
              if (typeof DecompressionStream !== "function") throw new Error("This device cannot open compressed backups.");
              stream = stream.pipeThrough(new DecompressionStream("gzip"));
            }
            parsed = await window.SplitAppBackupStream.parse(stream, { yieldEvery: 100 });
          } finally { await plugin.closeFolderReadStream({ id: streamId }).catch(() => {}); }
        } else {
          let content;
          if (/\.gz$/i.test(file.name) && plugin.readBinaryFile && typeof DecompressionStream === "function") {
          // Compressed backup copy: read the bytes and inflate them.
            const { base64Content } = await plugin.readBinaryFile({ uri: file.uri, maxBytes: 64 * 1024 * 1024 });
            const binary = atob(base64Content || ""), bytes = new Uint8Array(binary.length);
            for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
            content = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
          } else content = (await plugin.readFile({ uri: file.uri })).content;
          parsed = JSON.parse(content);
        }
        const items = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(items)) throw new Error("Database has no game list");
        return {
          items,
          history: Array.isArray(parsed.history) ? parsed.history : [],
          preferences: parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences : {}
        };
      } catch (error) {
        console.warn(`Could not read ScreenMark database file ${file.name}; trying the next recovery copy`, error);
      }
    }
    const tarBackups = files.filter(entry => entry.uri && new RegExp(`^${app.key}_backup_\\d{4}-\\d{2}-\\d{2}\\.tar$`, "i").test(entry.name))
      .sort((a, b) => (Number(b.lastModified) || 0) - (Number(a.lastModified) || 0) || b.name.localeCompare(a.name));
    for (const file of tarBackups) {
      try {
        if (!plugin.readTarEntry) break;
        const result = await plugin.readTarEntry({ uri: file.uri, entryName: databaseFileName });
        const parsed = JSON.parse(result.content);
        const items = Array.isArray(parsed) ? parsed : parsed?.items;
        if (!Array.isArray(items)) throw new Error("Archive database has no game list");
        return {
          items,
          history: Array.isArray(parsed.history) ? parsed.history : [],
          preferences: parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences : {}
        };
      } catch (error) {
        console.warn(`Could not restore ScreenMark database from ${file.name}; trying the next recovery copy`, error);
      }
    }
    const mirroredItems = await listFolderTreeItems(uri, { hydrate: false });
    return mirroredItems.length ? { items: mirroredItems, history: [], preferences: {}, fromItemTree: true } : null;
  }

  async function hydrateFolderData(data, uri) {
    if (!data || !Array.isArray(data.items)) return data;
    const mirroredItems = await listFolderTreeItems(uri, { hydrate: false });
    if (!mirroredItems.length) return data;
    const mirroredById = new Map(mirroredItems.map(item => [String(item.id), item]));
    return {
      ...data,
      items: data.items.map(item => {
        const mirrored = mirroredById.get(String(item.id));
        if (!mirrored) return item;
        const databaseIsNewer = (Number(item.updatedAt) || 0) >= (Number(mirrored.updatedAt) || 0);
        const freshest = databaseIsNewer ? item : mirrored;
        return {
          // Use the newest tracked record while taking portable artwork refs
          // and cached provider details from whichever copy has them.
          ...freshest,
          cachedDetails: freshest.cachedDetails || (databaseIsNewer ? mirrored.cachedDetails : item.cachedDetails),
          localImageFiles: mirrored.localImageFiles || item.localImageFiles,
          thumbnailPath: mirrored.thumbnailPath || item.thumbnailPath,
          thumbnailMime: mirrored.thumbnailMime || item.thumbnailMime,
          ...(mirrored.localThumbnailData ? { localThumbnailData: mirrored.localThumbnailData } : {})
        };
      })
    };
  }

  // Large libraries (or any with compact titles) are written to database.json title by title through the native stream
  // API instead of building one giant string.
  const STREAM_MIN_ITEMS = 1500;
  const shouldStreamDatabase = (payload, plugin) => Boolean(plugin?.openFolderStream && Array.isArray(payload.items) && (payload.items.length >= STREAM_MIN_ITEMS || payload.items.some(isCompactItem)));
  async function writeDatabaseStreamed(payload, uri, plugin, { batchSize = 8 } = {}) {
    const atomic = typeof plugin.renameFolderFile === "function";
    // Keep .json as the final suffix: some SAF providers append the MIME
    // extension when the temporary name itself ends in .tmp.
    const tempName = name => atomic ? name.replace(/\.json$/i, ".tmp.json") : name;
    const targets = [{ id: `db-tree-${Date.now()}`, dirPath: [folderTreeName], fileName: tempName("database.json"), finalName: "database.json" }, { id: `db-root-${Date.now()}`, fileName: tempName(databaseFileName), finalName: databaseFileName }];
    const opened = [];
    const write = text => Promise.all(opened.map(target => plugin.writeFolderStream({ id: target.id, content: text })));
    try {
      for (const target of targets) {
        await plugin.openFolderStream({ uri, id: target.id, dirPath: target.dirPath, fileName: target.fileName });
        opened.push(target);
      }
      const items = payload.items || [];
      let buffer = '{"items":[', first = true;
      for (let offset = 0; offset < items.length; offset += batchSize) {
        const batch = await detailedItems(items.slice(offset, offset + batchSize));
        for (const item of batch) { buffer += (first ? "" : ",") + JSON.stringify(portableItem(item)); first = false; }
        if (buffer.length >= 256 * 1024) { await write(buffer); buffer = ""; }
        // Let input and page rendering run after each small batch, even when
        // individual titles are compact and the output chunk is still small.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const history = Array.isArray(payload.history) ? payload.history : [], preferences = payload.preferences && typeof payload.preferences === "object" ? payload.preferences : {};
      buffer += `],"history":${JSON.stringify(history)},"preferences":${JSON.stringify(preferences)}}`;
      await write(buffer);
    } finally { await Promise.all(opened.map(target => plugin.closeFolderStream({ id: target.id }).catch(() => {}))); }
    if (atomic) await Promise.all(targets.map(target => plugin.renameFolderFile({ uri, dirPath: target.dirPath, fromName: target.fileName, toName: target.finalName })));
  }

  const folderStampKey = `${storageKey}_folder_stamp`;
  async function folderDatabaseSize(uri, plugin) {
    try { return Number(((await plugin.listFiles({ uri }))?.files || []).find(file => file.name === databaseFileName)?.size) || 0; } catch (_) { return 0; }
  }
  async function recordFolderStamp(uri, count, plugin) {
    const size = await folderDatabaseSize(uri, plugin);
    try { localStorage.setItem(folderStampKey, JSON.stringify(size ? { uri, count, size } : {})); } catch (_) {}
  }
  async function canSkipFolderRead(uri, count) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!plugin?.listFiles || !(count >= slimMinItems())) return false;
    try {
      const stamp = JSON.parse(localStorage.getItem(folderStampKey) || "{}");
      return Boolean(stamp.size) && stamp.uri === uri && stamp.count === count && stamp.size === await folderDatabaseSize(uri, plugin);
    } catch (_) { return false; }
  }

  let pendingFolderSnapshot = null, folderSnapshotDrain = null;
  function queueFolderDatabaseWrite(payload, uri = activeFolderUri, { syncTree = true, backup = true } = {}) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!uri || !plugin?.writeFile) return Promise.resolve();
    invalidateGamesIndex();
    // Keep one pending snapshot per folder. If another caller arrives before
    // its write starts, replace the older revision and share the same promise.
    // A caller arriving during a write schedules exactly one follow-up.
    if (pendingFolderSnapshot?.uri === uri) {
      pendingFolderSnapshot.payload = payload;
      pendingFolderSnapshot.syncTree ||= syncTree;
      pendingFolderSnapshot.backup ||= backup;
      const promise = new Promise((resolve, reject) => pendingFolderSnapshot.waiters.push({ resolve, reject }));
      return promise;
    }
    let resolveSnapshot, rejectSnapshot;
    const promise = new Promise((resolve, reject) => { resolveSnapshot = resolve; rejectSnapshot = reject; });
    const request = { payload, uri, plugin, syncTree, backup, promise, waiters: [{ resolve: resolveSnapshot, reject: rejectSnapshot }] };
    pendingFolderSnapshot = request;
    scheduleFolderSnapshotDrain();
    return request.promise;
  }

  function scheduleFolderSnapshotDrain() {
    if (folderSnapshotDrain || !pendingFolderSnapshot) return;
    const drain = (async () => {
      while (pendingFolderSnapshot) {
        const request = pendingFolderSnapshot;
        pendingFolderSnapshot = null;
        activeFolderSnapshots++;
        let failure = null;
        try {
          // Build the content only when this revision is actually selected for
          // writing, avoiding duplicate whole-library serialization at startup.
          const streamed = shouldStreamDatabase(request.payload, request.plugin);
          if (streamed) {
            await writeDatabaseStreamed(request.payload, request.uri, request.plugin);
            invalidateGamesIndex();
            await recordFolderStamp(request.uri, request.payload.items.length, request.plugin);
          } else {
            const content = JSON.stringify(portableData(request.payload));
            try { localStorage.removeItem(folderStampKey); } catch (_) {}
            if (request.plugin.writeNestedFile) await request.plugin.writeNestedFile({ uri: request.uri, dirPath: [folderTreeName], fileName: "database.json", content });
            invalidateGamesIndex();
            await request.plugin.writeFile({ uri: request.uri, fileName: databaseFileName, content });
          }
        } catch (error) { failure = error; }
        finally { activeFolderSnapshots = Math.max(0, activeFolderSnapshots - 1); }
        pendingFolderSync = { payload: request.payload, uri: request.uri, plugin: request.plugin, snapshotWrite: Promise.resolve(), syncTree: request.syncTree, backup: request.backup };
        scheduleFolderSyncDrain();
        if (!failure) await folderSyncDrain?.catch(() => {});
        request.waiters.forEach(waiter => failure ? waiter.reject(failure) : waiter.resolve());
      }
    })();
    folderSnapshotDrain = drain.finally(() => {
      folderSnapshotDrain = null;
      if (pendingFolderSnapshot) scheduleFolderSnapshotDrain();
    });
  }

  function scheduleFolderSyncDrain() {
    if (folderSyncDrain || !pendingFolderSync) return;
    const drain = folderWriteQueue.catch(() => {}).then(async () => {
      while (pendingFolderSync) {
        const next = pendingFolderSync;
        pendingFolderSync = null;
        try {
          await next.snapshotWrite;
          if (next.syncTree) await syncFolderTree(next.payload, next.uri);
          if (next.backup) await writeFolderBackup(next.payload, next.uri, next.plugin);
          if (activeFolderUri === next.uri) writeMirror(idbHealthy ? { items: [], history: next.payload.history || [], preferences: next.payload.preferences || {} } : portableData(next.payload));
        } catch (error) { console.warn("Could not finish syncing ScreenMark data to the selected folder", error); }
      }
    });
    folderSyncDrain = drain;
    folderWriteQueue = drain.finally(() => {
      folderSyncDrain = null;
      if (pendingFolderSync) scheduleFolderSyncDrain();
    });
  }

  async function writeFolderBackup(payload, uri, plugin) {
    if (payload.preferences?.backupSchedule !== "daily" || !plugin?.exportTarArchive) return;
    let hashes = {};
    try { hashes = JSON.parse(localStorage.getItem(folderArchiveHashKey) || "{}"); } catch (_) {}
    if (!hashes || typeof hashes !== "object") hashes = {};
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const fingerprint = folderArchiveFingerprint(payload);
    const datedHashes = hashes[uri] && typeof hashes[uri] === "object" ? hashes[uri] : {};
    if (datedHashes[date] === fingerprint) return;
    const prefix = `${app.key}_backup_`;
    const tarFileName = `${prefix}${date}.tar`;
    await plugin.exportTarArchive({
      uri,
      sourceDirPath: [folderTreeName],
      tarFileName,
      extraJsonFileName: databaseFileName
    });
    hashes[uri] = { ...datedHashes, [date]: fingerprint };
    localStorage.setItem(folderArchiveHashKey, JSON.stringify(hashes));

    const retention = Math.max(1, Number(payload.preferences?.backupRetention) || 10);
    try {
      const backups = ((await plugin.listFiles({ uri }))?.files || [])
        .filter(file => file.uri && new RegExp(`^${prefix}\\d{4}-\\d{2}-\\d{2}\\.tar$`, "i").test(file.name))
        .sort((a, b) => b.name.localeCompare(a.name));
      for (const oldBackup of backups.slice(retention)) await plugin.deleteFile?.({ uri: oldBackup.uri });
    } catch (error) { console.warn("Could not apply ScreenMark backup retention", error); }
  }

  // fast: return what IndexedDB already holds without touching the (slow) Android folder, or
  // `null` when there is nothing local yet so the caller falls back to the full restore.
  async function load({ fast = false } = {}) {
    const mirror = readMirror();
    let data = {
      items: Array.isArray(mirror.items) ? mirror.items : [],
      history: Array.isArray(mirror.history) ? mirror.history : [],
      preferences: mirror.preferences && typeof mirror.preferences === "object" ? mirror.preferences : {}
    };
    if (idbHealthy) {
      try {
        const stored = await window.SplitAppIDB.loadAll({ slim: true, slimMin: slimMinItems() });
        if (!stored.empty) {
          data = { items: stored.items, history: stored.history.length ? stored.history : data.history, preferences: { ...data.preferences, ...stored.preferences } };
        } else if (data.items.length) {
          // First run after upgrade: move the old localStorage library into IndexedDB.
          await window.SplitAppIDB.save(data);
          writeMirror(data);
        }
      } catch (error) { console.warn("IndexedDB load failed; using localStorage", error); idbHealthy = false; }
    }
    if (fast) {
      if (!data.items.length) return null;
      discardRemovedFields(data);
      const castIds = data.items.filter(hasPersistedCast).map(item => String(item.id));
      if (castIds.length) save(data, { ids: castIds }).catch(error => console.warn("Could not remove old cached cast records", error));
      return { ...data, loadedFromFolder: false, fast: true };
    }
    let folderData = null;
    const encryptedItemIds = new Set();
    let encryptedItems = [];
    // Startup never opens Android's document picker itself: the storage gate (see app.js) does that once the user taps Choose folder.
    const folderUri = await getFolderUri({ prompt: false });
    // In the Android app the library database lives in a folder you choose: with none chosen yet (or the old one gone) the storage gate asks for one before anything loads.
    if (!folderUri && hasFolderPlugin()) throw new Error("Choose a folder for your library database.");
    // A huge library is not re-read from the folder at every launch when the folder database is exactly the one this app last wrote
    // (same title count and file size): the local database is current. Anything else (another device, a restore) reads it as before.
    let folderSkipped = false;
    if (folderUri) {
      folderSkipped = await canSkipFolderRead(folderUri, data.items.length);
      if (!folderSkipped) folderData = await readFolderDatabase(folderUri);
    }

    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    if (plugin?.getItems && plugin?.getMeta) {
      try {
        // IndexedDB is the normal library source. Pulling the encrypted JSON over Capacitor on every launch
        // blocks other bridge calls; only fetch it to recover an empty local library.
        const [itemsResult, metaResult] = await Promise.all([data.items.length ? Promise.resolve(null) : plugin.getItems(), plugin.getMeta()]);
        if (!data.items.length && itemsResult?.exists && itemsResult.data) {
          const items = JSON.parse(itemsResult.data);
          if (Array.isArray(items)) {
            encryptedItems = items;
            data.items = items;
            items.forEach(item => { if (item?.id != null) encryptedItemIds.add(String(item.id)); });
          }
        }
        if (metaResult?.exists && metaResult.data) {
          const meta = JSON.parse(metaResult.data);
          if (Array.isArray(meta.history)) data.history = meta.history;
          if (meta.preferences && typeof meta.preferences === "object") data.preferences = { ...data.preferences, ...meta.preferences };
        }
      } catch (error) { console.warn(`${app.name} encrypted restore failed`, error); }
    }
    let folderNeedsPersist = false;
    if (folderData) {
      const localById = new Map((data.items || []).map(item => [String(item.id), item]));
      const fields = ["title", "category", "status", "progress", "updatedAt", "source", "metadataSource", "providerId", "thumbnailPath", "thumbnailMime", "episodeNotes", "episodeRatings"];
      folderNeedsPersist = (folderData.items || []).some(remote => {
        if (remote?.id == null) return false;
        const local = localById.get(String(remote.id));
        if (!local) return true;
        if ((Number(remote.updatedAt) || 0) > (Number(local.updatedAt) || 0)) return true;
        if (fields.some(key => JSON.stringify(remote[key]) !== JSON.stringify(local[key]))) return true;
        return (Number(remote.cachedDetails?.fetchedAt) || 0) > (Number(local.cachedDetails?.fetchedAt) || 0);
      }) || JSON.stringify(folderData.history || []) !== JSON.stringify(data.history || [])
        || JSON.stringify(folderData.preferences || {}) !== JSON.stringify(data.preferences || {});
    }
    // The selected folder is the portable source of truth when it already has
    // a ScreenMark database. Otherwise migrate this device's existing data into it.
    if (folderData) {
      const byId = new Map();
      for (const candidate of [...(data.items || []), ...(folderData.items || [])]) {
        if (!candidate || candidate.id == null) continue;
        const id = String(candidate.id), previous = byId.get(id);
        if (!previous) byId.set(id, candidate);
        else if ((Number(candidate.updatedAt) || 0) >= (Number(previous.updatedAt) || 0)) {
          byId.set(id, {
            ...previous,
            ...candidate,
            cachedDetails: candidate.cachedDetails || previous.cachedDetails,
            facts: candidate.facts || previous.facts,
            image: candidate.image || previous.image,
            backdrop: candidate.backdrop || previous.backdrop,
            description: candidate.description || previous.description,
            localImageFiles: candidate.localImageFiles || previous.localImageFiles,
            thumbnailPath: candidate.thumbnailPath || previous.thumbnailPath,
            thumbnailMime: candidate.thumbnailMime || previous.thumbnailMime
          });
        } else {
          if (!previous.cachedDetails && candidate.cachedDetails) previous.cachedDetails = candidate.cachedDetails;
          if (!previous.facts && candidate.facts) previous.facts = candidate.facts;
          if (!previous.localImageFiles && candidate.localImageFiles) previous.localImageFiles = candidate.localImageFiles;
          if (!previous.thumbnailPath && candidate.thumbnailPath) previous.thumbnailPath = candidate.thumbnailPath;
        }
      }
      const history = [...new Map([...(data.history || []), ...(folderData.history || [])].map(entry => [JSON.stringify(entry), entry])).values()];
      data = {
        items: [...byId.values()],
        history,
        preferences: folderData.fromItemTree ? { ...data.preferences, ...folderData.preferences } : folderData.preferences
      };
    }
    // database.json already carries every game's artwork refs; walking ~1500 game folders over the
    // storage framework (minutes) is only needed when the library itself came from that tree.
    if (folderUri && folderData?.fromItemTree) data = await hydrateFolderData(data, folderUri);
    discardRemovedFields(data);
    const castIds = data.items.filter(hasPersistedCast).map(item => String(item.id));
    if (castIds.length) save(data, { ids: castIds }).catch(error => console.warn("Could not remove old cached cast records", error));
    itemIds.clear();
    itemSnapshots.clear();
    // If the encrypted item copy was skipped, IndexedDB already represents this local snapshot.
    (encryptedItems.length ? encryptedItems : data.items).forEach(item => {
      if (item?.id == null) return;
      const id = String(item.id);
      itemIds.add(id);
      itemSnapshots.set(id, snapshotFingerprint(JSON.stringify(portableItem(item))));
    });
    // Avoid rewriting a large folder snapshot at every launch when its item set and timestamps already match.
    const folderStamp = new Map((folderData?.items || []).map(item => [String(item.id), Number(item.updatedAt) || 0]));
    const folderBehind = !folderSkipped && (!folderData || folderStamp.size !== data.items.length || (folderData.items || []).some(hasPersistedCast) || data.items.some(item => (Number(item.updatedAt) || 0) > (folderStamp.get(String(item.id)) ?? -1)));
    if (folderUri && (folderBehind || !(await hasCurrentFolderLayout(folderUri)))) {
      queueFolderDatabaseWrite(data, folderUri).then(() => { folderLastCount = data.items.length; }).catch(error => console.warn("Could not save or migrate the restored database folder", error));
    } else if (folderUri) folderLastCount = data.items.length;
    if (data.items.length >= slimMinItems() && window.SplitAppIDB?.compactDetails) data = { ...data, items: data.items.map(item => item?.cachedDetails && !item.cachedDetails.compact ? { ...item, cachedDetails: window.SplitAppIDB.compactDetails(item.cachedDetails) } : item) };
      return { ...data, loadedFromFolder: Boolean(folderData), folderNeedsPersist };
  }

  let appSaveQueue = Promise.resolve();
  const clone = value => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const hasEncryptedStore = () => Boolean(window.Capacitor?.Plugins?.EncryptedStore?.setItem);

  // Folder snapshots rewrite the whole library through Android's storage framework, so they
  // are coalesced (and the app's private encrypted store, written per game, stays the
  // durable copy). Deletions flush at once so a stale folder can never resurrect a game.
  let folderDelayMs = 8000; // Settings → Backups → Folder Sync Delay
  let folderTimer = 0, folderLatest = null, folderLastCount = -1;
  function runFolderWrite() {
    clearTimeout(folderTimer); folderTimer = 0;
    const latest = folderLatest; folderLatest = null;
    if (!latest) return Promise.resolve();
    const payload = latest.getPayload();
    folderLastCount = payload.items.length;
    // Tell the UI once the folder mirror is written: thumbnail paths and fingerprints exist only after this point.
    return queueFolderDatabaseWrite(payload, activeFolderUri, latest).finally(() => { try { window.dispatchEvent(new Event("screenmark:folder-written")); } catch (_) {} });
  }
  function scheduleFolderWrite(getPayload, count, urgent, options = {}) {
    if (!activeFolderUri) return Promise.resolve();
    folderLatest = { getPayload, syncTree: options.syncTree !== false, backup: options.backup !== false };
    if (urgent || folderDelayMs === 0 || !hasEncryptedStore() || (folderLastCount >= 0 && count < folderLastCount) || folderLastCount < 0) return runFolderWrite();
    clearTimeout(folderTimer); folderTimer = setTimeout(runFolderWrite, folderDelayMs);
    return Promise.resolve();
  }
  function flushFolderNow() { return folderLatest ? runFolderWrite() : Promise.resolve(); }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushFolderNow(); });
    window.addEventListener("pagehide", flushFolderNow);
  }

  // Capture each revision before waiting in the queue. Encrypted-store writes
  // must finish in the same order as user changes or an older snapshot can win.
  // scope: undefined/{full} rewrites by diffing everything; {ids, removed} touches only
  // those games; {meta} saves just preferences/history.
  function save(data, scope = { full: true }) {
    data = isRecord(data) ? data : {};
    scope = isRecord(scope) ? scope : { full: true };
    const items = Array.isArray(data.items) ? data.items.filter(isLibraryItem) : [];
    const history = Array.isArray(data.history) ? clone(data.history.filter(isRecord)) : [];
    const preferences = isRecord(data.preferences) ? clone(data.preferences) : {};
    data = { ...data, items, history, preferences };
    if (preferences.folderSyncDelay !== undefined && Number.isFinite(Number(preferences.folderSyncDelay))) folderDelayMs = Math.max(0, Number(preferences.folderSyncDelay)) * 1000;
    let payload;
    if (scope.full || !idbHealthy) {
      payload = { items: Array.isArray(data.items) ? clone(data.items) : [], history, preferences };
    } else {
      const wanted = new Set((Array.isArray(scope.ids) ? scope.ids : []).map(String));
      const changed = Array.isArray(data.changedItems)
        ? clone(data.changedItems.filter(item => isLibraryItem(item) && wanted.has(String(item.id))))
        : wanted.size ? clone(items.filter(item => wanted.has(String(item.id)))) : [];
      const removedIds = (Array.isArray(scope.removed) ? scope.removed : []).map(String);
      const live = items;
      payload = { scoped: true, changed, removedIds, history, preferences, live, count: Array.isArray(live) ? live.length : 0 };
    }
    const write = appSaveQueue.then(() => saveSnapshot(payload), () => saveSnapshot(payload));
    appSaveQueue = write.catch(() => {});
    return write;
  }

  // Persist a single title directly to IndexedDB for background sync. The
  // normal save queue also mirrors to native snapshots and folder storage; a
  // slow snapshot must not hold episode hydration behind the full-library
  // queue, so callers schedule that mirror separately with the app persist.
  async function saveLibraryItemToIDB(item, state = {}) {
    if (!isLibraryItem(item) || !window.SplitAppIDB?.saveSome) throw new Error("IndexedDB is unavailable for this library item.");
    const stored = activeFolderUri ? portableItem(item) : browserData({ items: [item] }).items[0];
    await window.SplitAppIDB.saveSome({ changed: [stored], history: state.history, preferences: state.preferences });
  }

  let lastMetaJson = "";
  async function saveScoped(payload) {
    const stored = payload.changed.map(item => (activeFolderUri ? portableItem(item) : browserData({ items: [item] }).items[0]));
    try { await window.SplitAppIDB.saveSome({ changed: stored, removedIds: payload.removedIds, history: payload.history, preferences: payload.preferences }); }
    catch (error) { console.warn("IndexedDB save failed; falling back to a full save", error); idbHealthy = false; throw error; }
    writeMirror({ items: [], history: payload.history, preferences: payload.preferences });
    const folderWrite = scheduleFolderWrite(
      // Large libraries stream one batch at a time below. Do not clone/strip
      // every title here on the UI thread when a single title is deleted.
      () => ({ items: payload.live, history: payload.history, preferences: payload.preferences }),
      payload.count,
      payload.removedIds.length > 0,
      // Destructive changes already use the explicit "Backup before changes"
      // export. Running the daily TAR fingerprint here hashes every title on
      // the UI thread on each deletion and can make the whole app unresponsive.
      { syncTree: payload.removedIds.length > 0, backup: false }
    );
    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    try {
      if (plugin?.setItem && plugin?.setMeta) {
        const changedSnapshots = await writeItemSnapshots(payload.changed, plugin, { includeDetails: payload.count < SNAPSHOT_FULL_DETAILS_LIMIT });
        await deleteItemSnapshots(payload.removedIds, plugin);
        const meta = JSON.stringify({ history: payload.history, preferences: payload.preferences });
        if (meta !== lastMetaJson) await plugin.setMeta({ data: meta });
        changedSnapshots.forEach(([id, fingerprint]) => { itemSnapshots.set(id, fingerprint); itemIds.add(id); });
        payload.removedIds.forEach(id => { itemSnapshots.delete(id); itemIds.delete(id); });
        lastMetaJson = meta;
      }
    } finally {
      await folderWrite;
    }
  }

  async function saveSnapshot(payload) {
    if (payload.scoped) {
      try { await saveScoped(payload); return; }
      catch (_) { /* fall through to a full save below */ }
      payload = { items: clone(payload.live || []), history: payload.history, preferences: payload.preferences };
    }
    const stored = activeFolderUri ? portableData(payload) : browserData(payload);
    if (idbHealthy) {
      try { await window.SplitAppIDB.save(stored); }
      catch (error) { console.warn("IndexedDB save failed; using localStorage", error); idbHealthy = false; }
    }
    writeMirror(stored);
    const folderWrite = scheduleFolderWrite(() => payload, payload.items.length, false);
    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    try {
      if (plugin?.setItem && plugin?.setMeta) {
        const nextIds = new Set(payload.items.map(item => String(item.id)));
        const changedSnapshots = await writeItemSnapshots(payload.items, plugin, { includeDetails: payload.items.length < SNAPSHOT_FULL_DETAILS_LIMIT });
        const removedIds = [...itemIds].filter(id => !nextIds.has(id));
        await deleteItemSnapshots(removedIds, plugin);
        const meta = JSON.stringify({ history: payload.history, preferences: payload.preferences });
        await plugin.setMeta({ data: meta }); lastMetaJson = meta;
        itemIds.clear(); nextIds.forEach(id => itemIds.add(id));
        itemSnapshots.clear();
        changedSnapshots.forEach(([id, fingerprint]) => itemSnapshots.set(id, fingerprint));
        // Unchanged records were already represented in itemSnapshots; retain their compact fingerprints.
        for (const [id, fingerprint] of [...itemSnapshots]) if (!nextIds.has(id)) itemSnapshots.delete(id);
      }
    } finally {
      await folderWrite;
    }
  }

  async function chooseFolder(currentData) {
    if (!hasFolderPlugin()) throw new Error("Folder storage is only available in the ScreenMark Android app.");
    await flushJournals();
    const previousUri = activeFolderUri;
    const plugin = window.Capacitor.Plugins.BackupFolder;
    const picked = await plugin.pickFolder();
    if (!picked?.uri) throw new Error("No storage folder was selected.");
    activeFolderUri = picked.uri;
    if (previousUri !== activeFolderUri) { Object.keys(journalCache).forEach(key => { delete journalCache[key]; journalReady[key] = false; }); }
    localStorage.setItem(folderUriKey, activeFolderUri);
    try { await plugin.rememberFolder?.({ uri: activeFolderUri }); } catch (_) {}
    let data = await readFolderDatabase(activeFolderUri);
    const loadedFromFolder = Boolean(data);
    if (!data) {
      data = {
        items: Array.isArray(currentData?.items) ? currentData.items : [],
        history: Array.isArray(currentData?.history) ? currentData.history : [],
        preferences: currentData?.preferences && typeof currentData.preferences === "object" ? currentData.preferences : {}
      };
      await queueFolderDatabaseWrite(data, activeFolderUri);
    }
    if (loadedFromFolder) data = await hydrateFolderData(data, activeFolderUri);
    return { ...data, loadedFromFolder };
  }

  async function inspectFolder() {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!hasFolderPlugin() || !plugin) return { configured: false, valid: false, databaseExists: false, unsupported: true };
    const uri = await getFolderUri({ prompt: false });
    if (!uri || !plugin) return { configured: false, valid: false, databaseExists: false };
    const result = await plugin.listFiles({ uri });
    const files = result?.files || [];
    const tree = files.find(file => file.name === folderTreeName && file.uri);
    const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
    const mediaFoldersReady = treeFiles.some(file => file.name === folderLayoutMarker && file.uri);
    const rootHasDatabase = files.some(file => file.name === databaseFileName
      || new RegExp(`^${app.key}_backup_\\d{4}-\\d{2}-\\d{2}\\.tar$`, "i").test(file.name)
      || new RegExp(`^${app.key}-backup-\\d{4}-\\d{2}-\\d{2}\\.json(?:\\.gz)?$`, "i").test(file.name));
    let itemTreeHasData = false;
    const categoryDirs = treeFiles.filter(file => ["movies", "series", "shows", "titles"].includes(file.name) && file.uri);
    // Listing every title folder is slow; skip it when a database file already proves the folder is in use.
    if (categoryDirs.length && !rootHasDatabase && !treeFiles.some(file => file.name === "database.json")) {
      const categoryContents = await Promise.all(categoryDirs.map(directory => plugin.listFiles({ uri: directory.uri })));
      itemTreeHasData = categoryContents.some(result => (result?.files || []).some(file => file.uri));
    }
    const databaseExists = rootHasDatabase || treeFiles.some(file => file.name === "database.json") || itemTreeHasData;
    return { configured: true, valid: true, databaseExists, mediaFoldersReady, uri };
  }

  // Streams the library to a file in small chunks, so a 1500-game export never builds one huge string
  // or sends one huge message across the Android bridge (that crashed the app).
  // mode "ask": Android's "Save as" screen. mode "folder": straight into the chosen backup folder.
  // Backups name where each title came from (source + source id) so a restore can match it exactly instead of guessing by title.
  const backupRefOf = item => ({ id: String(item?.id ?? ""), source: String(item?.metadataSource || item?.source || "manual"), providerId: String(item?.providerId ?? ""), category: String(item?.category || ""), title: String(item?.title || ""), year: String(item?.year || "") });
  // blob: links point at this page's memory and are dead after a restore, so they never go into a backup (the real files are re-fetched).
  const dropBlobUrls = value => {
    if (typeof value === "string") return /^blob:/i.test(value) ? "" : value;
    if (Array.isArray(value)) return value.map(dropBlobUrls);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) { const next = dropBlobUrls(child); if (!(typeof child === "string" && next === "" && child !== "")) out[key] = next; }
    return out;
  };
  const backupEntry = item => dropBlobUrls({ ...portableItem(item, { includeImageData: true }), backupRef: backupRefOf(item) });
  const backupIndex = items => items.map(item => backupRefOf(item));
  async function exportLibrary({ items, history, preferences }, { mode = "ask", onProgress } = {}) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    // Backups are gzip-compressed (about 10x smaller) when the WebView can compress; the importer opens both forms.
    const gzip = typeof CompressionStream === "function" && typeof TextEncoder === "function";
    const fileName = `${app.key}-backup-${new Date().toISOString().slice(0, 10)}.json${gzip ? ".gz" : ""}`;
    if (!plugin?.writeDocumentChunk) throw new Error("This build cannot save files. Update the app.");
    let opened;
    if (mode === "folder") {
      const uri = await getFolderUri({ prompt: false });
      if (!uri) throw new Error("No backup folder selected. Pick one in Settings → Backups.");
      opened = await plugin.beginFolderExport({ uri, fileName });
    } else opened = await plugin.createDocument({ fileName, mimeType: gzip ? "application/gzip" : "application/json" });
    let write = text => plugin.writeDocumentChunk({ content: text }), finishStream = async () => {}, pumpError = null;
    if (gzip) {
      const compressor = new CompressionStream("gzip"), writer = compressor.writable.getWriter(), reader = compressor.readable.getReader(), encoder = new TextEncoder();
      const toBase64 = bytes => { let binary = ""; for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 0x8000)); return btoa(binary); };
      // Compressed bytes are written as they come out, so nothing large is ever held in memory.
      const pump = (async () => { for (;;) { const { done, value } = await reader.read(); if (done) break; await plugin.writeDocumentChunk({ content: toBase64(value), base64: true }); } })()
        .catch(error => { pumpError = error; writer.abort(error).catch(() => {}); });
      write = async text => { if (pumpError) throw pumpError; await writer.write(encoder.encode(text)); };
      finishStream = async () => { if (!pumpError) await writer.close().catch(error => { pumpError = pumpError || error; }); await pump; if (pumpError) throw pumpError; };
    }
    try {
      const CHUNK = 256 * 1024;
      let buffer = `{"app":${JSON.stringify(app.name)},"version":2,"exportedAt":${JSON.stringify(new Date().toISOString())},"index":${JSON.stringify(backupIndex(items))},"items":[`;
      const BATCH_SIZE = 8;
      let first = true;
      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const batch = await detailedItems(items.slice(offset, offset + BATCH_SIZE));
        for (const item of batch) {
          buffer += (first ? "" : ",") + JSON.stringify(backupEntry(item));
          first = false;
          if (buffer.length >= CHUNK) {
            await write(buffer); buffer = "";
          }
        }
        onProgress?.(Math.min(offset + batch.length, items.length), items.length);
        // Batch detail reads through IndexedDB and yield after each small
        // batch. A 10k-title backup should not serialize thousands of bridge
        // transactions or hold the UI thread in a long run of title work.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      buffer += `],"history":${JSON.stringify(history || [])},"preferences":${JSON.stringify(preferences || {})}}`;
      await write(buffer);
      await finishStream();
      onProgress?.(items.length, items.length);
    } finally { await plugin.closeDocument().catch(() => {}); }
    return { fileName, uri: opened?.uri || "" };
  }

  // Name exports are small enough to pass to Android with the save-picker request itself.
  // This keeps the content available natively if the WebView is discarded while the picker is open.
  async function exportTextFile({ fileName, mimeType = "text/plain", content }) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!plugin?.writeDocumentChunk || !plugin?.createDocument) throw new Error("This build cannot save files. Update the app.");
    const opened = await plugin.createDocument({ fileName, mimeType, content });
    return { fileName, uri: opened?.uri || "" };
  }

  // Keep diagnostics and full library audit history alongside the selected ScreenMark database.
  const journalFiles = { logcat: "logcat.json", history: "library-history.json" };
  const journalLocalKeys = { logcat: `${storageKey}_log`, history: `${storageKey}_history` };
  const journalCache = {}, journalPending = { logcat: [], history: [] }, journalTimers = {};
  let journalQueue = Promise.resolve();
  const journalReady = { logcat: false, history: false };
  const readLocalJournal = kind => { try { const list = JSON.parse(localStorage.getItem(journalLocalKeys[kind]) || "[]"); return Array.isArray(list) ? list : []; } catch (_) { return []; } };
  async function journalTarget() {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    const uri = activeFolderUri || await getFolderUri({ prompt: false }).catch(() => "");
    if (!uri || !plugin?.listFiles || !plugin?.writeNestedFile) return null;
    return { plugin, uri };
  }
  async function readJournalFile(kind, target) {
    try {
      const root = (await target.plugin.listFiles({ uri: target.uri }))?.files || [];
      const tree = root.find(entry => entry.name === folderTreeName && entry.uri);
      if (!tree) return null;
      const file = ((await target.plugin.listFiles({ uri: tree.uri }))?.files || []).find(entry => entry.name === journalFiles[kind] && entry.uri);
      if (!file) return null;
      const rows = JSON.parse((await target.plugin.readFile({ uri: file.uri })).content || "[]");
      return Array.isArray(rows) ? rows : null;
    } catch (_) { return null; }
  }
  function flushJournal(kind) {
    journalQueue = journalQueue.catch(() => {}).then(async () => {
      const target = await journalTarget(); if (!target) return;
      if (!journalReady[kind]) {
        const saved = await readJournalFile(kind, target);
        journalCache[kind] = saved || readLocalJournal(kind);
        journalReady[kind] = true;
      }
      const fresh = journalPending[kind].splice(0);
      if (fresh.length) journalCache[kind] = [...fresh.reverse(), ...journalCache[kind]];
      journalCache[kind] = journalCache[kind].slice(0, 20000);
      await target.plugin.writeNestedFile({ uri: target.uri, dirPath: [folderTreeName], fileName: journalFiles[kind], content: JSON.stringify(journalCache[kind]) });
    }).catch(() => {});
    return journalQueue;
  }
  function appendJournal(kind, entry) {
    if (!journalFiles[kind]) return;
    journalPending[kind].push(entry); clearTimeout(journalTimers[kind]); journalTimers[kind] = setTimeout(() => flushJournal(kind), 2500);
  }
  async function readJournal(kind) {
    await flushJournal(kind);
    const target = await journalTarget();
    if (!target) return readLocalJournal(kind);
    if (!journalCache[kind]) journalCache[kind] = (await readJournalFile(kind, target)) || readLocalJournal(kind);
    return journalCache[kind];
  }
  async function clearJournal(kind) {
    if (!journalFiles[kind]) return;
    await journalQueue.catch(() => {});
    try { localStorage.removeItem(journalLocalKeys[kind]); } catch (_) {}
    journalPending[kind].length = 0; journalCache[kind] = [];
    journalReady[kind] = true;
    const target = await journalTarget(); if (target) await target.plugin.writeNestedFile({ uri: target.uri, dirPath: [folderTreeName], fileName: journalFiles[kind], content: "[]" }).catch(() => {});
  }
  async function flushJournals() { clearTimeout(journalTimers.logcat); clearTimeout(journalTimers.history); await Promise.all([flushJournal("logcat"), flushJournal("history")]); }

  window.SplitAppBackend = Object.freeze({
    appendJournal, readJournal, clearJournal, flushJournals,
    exportLibrary,
    backupItem: backupEntry,
    detailedItems,
    backupIndex,
    backupRefOf,
    exportTextFile,
    name: app.name,
    key: app.key,
    categories: app.categories.map(category => ({ ...category })),
    storageKey,
    folderUriKey,
    databaseFileName,
    load,
    save,
    saveLibraryItemToIDB,
    chooseFolder,
    loadItemImages,
    cacheEpisodeThumbnails,
    cacheArtwork,
    artworkCacheEntries,
    hydrateThumbnails,
    setImageStorage,
    inspectFolder,
    isNativeFolderStorageAvailable: hasFolderPlugin,
    isFolderSnapshotBusy: () => activeFolderSnapshots > 0
  });
})();
