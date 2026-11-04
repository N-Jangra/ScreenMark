// ScreenMark's app-specific state and Android encrypted-storage bridge.
(() => {
  "use strict";
  const app = window.APP_CONFIG;
  const storageKey = `splitapp_${app.key}_v1`;
  const folderUriKey = `${storageKey}_folder_uri`;
  const databaseFileName = `${app.key}_database.json`;
  const folderTreeName = `${app.key}-db`;
  const folderItemHashKey = `${storageKey}_folder_item_hashes`;
  const folderImageHashKey = `${storageKey}_folder_image_hashes`;
  const folderArchiveHashKey = `${storageKey}_folder_archive_hashes_v2`;
  const itemIds = new Set();
  const itemSnapshots = new Map();
  let activeFolderUri = "";
  let folderSnapshotQueue = Promise.resolve();
  let folderWriteQueue = Promise.resolve();
  let pendingFolderSync = null;
  let folderSyncDrain = null;

  function discardRemovedFields(data) {
    delete data.preferences.defaultCategory;
    if (Array.isArray(data.items)) data.items.forEach(item => { if (item && typeof item === "object") delete item.notes; });
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
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
    catch (_) { return {}; }
  }

  function itemDirectoryName(item) {
    const id = String(item?.id || "").replace(/[^a-z0-9_-]/gi, "_").slice(0, 100);
    return id || `item_${String(item?.title || "untitled").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 70)}`;
  }

  function itemFolderPath(item) {
    return [folderTreeName, "titles", itemDirectoryName(item)];
  }

  function portableItem(item) {
    const copy = { ...item };
    delete copy.notes;
    delete copy.localThumbnailData;
    delete copy.localPortraitData;
    delete copy.localLandscapeData;
    delete copy.localImageData;
    // Image bytes belong in adjacent files in the selected folder. Provider
    // detail payloads can contain data URLs several levels below `image`; strip
    // those too so database.json and index.json stay small and portable.
    const imageKey = /(image|thumbnail|backdrop|cover|poster|artwork)/i;
    const stripInlineImages = value => {
      if (Array.isArray(value)) return value.map(stripInlineImages);
      if (!value || typeof value !== "object") return value;
      const result = {};
      for (const [key, child] of Object.entries(value)) {
        if (imageKey.test(key) && typeof child === "string" && /^data:image\//i.test(child)) {
          result[key] = "";
        } else {
          result[key] = stripInlineImages(child);
        }
      }
      return result;
    };
    Object.assign(copy, stripInlineImages(copy));
    if (/^data:image\//i.test(copy.image || "")) copy.image = "";
    return copy;
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
        if (typeof child === "string" && imageKey.test(key)) add(childPath, child);
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
    const value = JSON.stringify({
      data: portableData(data),
      itemImages: (data.items || []).map(item => [String(item?.id || ""), itemFingerprint(item)])
    });
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
    return `${value.length}:${(hash >>> 0).toString(16)}`;
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
    const limit = { cast: 12, characters: 12, staff: 12, screenshots: 6 };
    const sections = details.sections.filter(section => !/^(posters|you might also like)/i.test(section.title || "")).map(section => {
      const key = Object.keys(limit).find(name => new RegExp(`^${name}`, "i").test(section.title || ""));
      if (key) return { ...section, items: section.items.slice(0, limit[key]) };
      if (section.kind === "episodes") return { ...section, seasons: undefined, items: section.items.map(({ description, image, ...rest }) => rest) };
      return section;
    });
    return { ...details, sections, trimmed: true };
  }
  function browserData(data) {
    return {
      items: Array.isArray(data.items) ? data.items.map(item => {
        const copy = { ...item };
        delete copy.localImageData;
        delete copy.localThumbnailData;
        if (copy.cachedDetails) copy.cachedDetails = trimDetails(copy.cachedDetails);
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
    const games = treeFiles.find(file => file.name === "titles" && file.uri);
    if (!games) return [];
    const gameFolders = (await plugin.listFiles({ uri: games.uri }))?.files || [];
    const queue = gameFolders.filter(folder => folder.uri);
    const items = [];
    const worker = async () => {
      while (queue.length) {
        const folder = queue.shift();
        try {
          const files = (await plugin.listFiles({ uri: folder.uri }))?.files || [];
          const index = files.find(file => file.name === "index.json" && file.uri);
          if (!index) continue;
          const parsed = JSON.parse((await plugin.readFile({ uri: index.uri })).content || "{}");
          if (!parsed || typeof parsed !== "object" || parsed.id == null) continue;
          const item = parsed;
          if (hydrate && item.thumbnailPath) {
            const thumbnailName = item.thumbnailPath.split("/").pop();
            const thumbnail = files.find(file => file.name === thumbnailName && file.uri);
            if (thumbnail && plugin.readBinaryFile) {
              try {
                const { base64Content } = await plugin.readBinaryFile({ uri: thumbnail.uri });
                if (base64Content) item.localPortraitData = item.localThumbnailData = `data:${item.thumbnailMime || "image/webp"};base64,${base64Content}`;
              } catch (error) { console.warn(`Could not read local artwork for ${item.title || item.id}`, error); }
            }
          }
          items.push(item);
        } catch (error) { console.warn(`Could not read ScreenMark item folder ${folder.name}`, error); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
    return items;
  }

  // Listing the games folder through Android's storage framework is slow (one call per
  // directory level, ~1000 entries), and every artwork batch used to repeat it. Cache the
  // index for a short time and drop it whenever we write to the folder.
  let gamesIndexCache = null;
  function invalidateGamesIndex() { gamesIndexCache = null; }
  function getGamesIndex(plugin, uri) {
    if (gamesIndexCache && gamesIndexCache.uri === uri && Date.now() - gamesIndexCache.at < 30000) return gamesIndexCache.promise;
    const promise = (async () => {
      const root = (await plugin.listFiles({ uri }))?.files || [];
      const tree = root.find(file => file.name === folderTreeName && file.uri);
      const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
      const titlesDir = treeFiles.find(file => file.name === "titles" && file.uri);
      if (!titlesDir) return new Map();
      return new Map(((await plugin.listFiles({ uri: titlesDir.uri }))?.files || []).filter(file => file.uri).map(file => [file.name, file]));
    })();
    gamesIndexCache = { uri, at: Date.now(), promise };
    promise.catch(() => { if (gamesIndexCache?.promise === promise) gamesIndexCache = null; });
    return promise;
  }

  // Fills in `localThumbnailData` for library items from the saved folder, so covers still show after the app/WebView cache is cleared or while offline.
  async function hydrateThumbnails(items, onBatch) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!Array.isArray(items) || !plugin?.listFiles || !plugin?.readBinaryFile) return 0;
    const uri = await getFolderUri({ prompt: false });
    if (!uri) return 0;
    const folders = await getGamesIndex(plugin, uri);
    if (!folders.size) return 0;
    const queue = items.filter(item => ((!item.localPortraitData && !item.localThumbnailData) || (!item.localLandscapeData && (item.backdrop || item.cachedDetails?.landscapeImage))) && (item.thumbnailPath || item.localImageFiles?.length));
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift(), folder = folders.get(itemDirectoryName(item));
        if (!folder) continue;
        try {
          const files = (await plugin.listFiles({ uri: folder.uri }))?.files || [];
          const name = item.thumbnailPath ? String(item.thumbnailPath).split("/").pop() : ".thumbnail";
          const thumbnail = files.find(file => file.name === name && file.uri);
          const { base64Content } = thumbnail ? await plugin.readBinaryFile({ uri: thumbnail.uri }) : {};
          if (base64Content) item.localPortraitData = item.localThumbnailData = `data:${item.thumbnailMime || "image/webp"};base64,${base64Content}`;
          const landscapeRef = item.localImageFiles?.find(image => (image.paths || []).some(path => path.some(part => /backdrop|landscapeImage|backgroundImage/i.test(String(part)))));
          if (landscapeRef) {
            const landscapeFile = files.find(file => file.name === landscapeRef.fileName && file.uri);
            const landscape = landscapeFile ? await plugin.readBinaryFile({ uri: landscapeFile.uri }) : {};
            if (landscape.base64Content) item.localLandscapeData = `data:${landscapeRef.mimeType || "image/webp"};base64,${landscape.base64Content}`;
          }
          if (base64Content || item.localLandscapeData) { done += 1; if (done % 6 === 0) onBatch?.(done); }
        } catch (error) { console.warn(`Could not read saved artwork for ${item.title || item.id}`, error); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return done;
  }

  async function loadItemImages(item) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    const uri = await getFolderUri({ prompt: false });
    if (!uri || !plugin?.listFiles || !plugin?.readBinaryFile || !Array.isArray(item?.localImageFiles)) return {};
    const folder = (await getGamesIndex(plugin, uri)).get(itemDirectoryName(item));
    const files = folder ? (await plugin.listFiles({ uri: folder.uri }))?.files || [] : [];
    const result = {};
    for (const image of item.localImageFiles) {
      const file = files.find(entry => entry.name === image.fileName && entry.uri);
      if (!file) continue;
      try {
        const value = await plugin.readBinaryFile({ uri: file.uri });
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
    let requestTimer;
    try {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      if (controller) requestTimer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(source, controller ? { signal: controller.signal } : undefined);
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const original = await response.blob();
      let output = original;
      try {
        const bitmap = await decodeImageBlob(original);
        const width = bitmap.width || bitmap.naturalWidth || 1;
        const height = bitmap.height || bitmap.naturalHeight || 1;
        const scale = Math.min(1, 500 / width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        if (typeof bitmap.close === "function") bitmap.close();
        output = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.88)) || original;
      } catch (_) { output = original; }
      return { base64Content: await blobAsBase64(output), mimeType: output.type || original.type || "image/jpeg" };
    } catch (error) {
      const match = source.match(/^data:([^;,]+);base64,(.*)$/s);
      if (match) return { base64Content: match[2], mimeType: match[1] };
      const plugin = window.Capacitor?.Plugins?.BackupFolder;
      if (/^https?:\/\//i.test(source) && plugin?.downloadImage) {
        const image = await plugin.downloadImage({ url: source, maxDimension: 500 });
        if (image?.base64Content) return image;
      }
      throw error;
    } finally { if (requestTimer) clearTimeout(requestTimer); }
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
    const existingGames = oldTreeFiles.find(file => file.name === "titles" && file.uri);
    const existingGameFolders = new Map(existingGames
      ? ((await plugin.listFiles({ uri: existingGames.uri }))?.files || []).filter(file => file.uri).map(file => [file.name, file])
      : []);
    const syncItem = async item => {
      const dirPath = itemFolderPath(item);
      const thumbnailPath = `${dirPath.join("/")}/.thumbnail`;
      let imageWritten = true;
      try {
        const itemHash = itemFingerprint(item);
        const id = String(item.id), candidates = collectImageCandidates(item), imageHash = imageFingerprint(candidates);
        const cachedImages = imageHashes[id];
        if (hashes[id] === itemHash && cachedImages?.fingerprint === imageHash) return;
        const localImageFiles = [];
        const usedFileNames = new Set();
        if (cachedImages?.fingerprint === imageHash && Array.isArray(cachedImages.files)) {
          localImageFiles.push(...cachedImages.files);
          cachedImages.files.forEach(file => usedFileNames.add(file.fileName));
        } else if (item.localImageFingerprint === imageHash && Array.isArray(item.localImageFiles)) {
          localImageFiles.push(...item.localImageFiles);
          item.localImageFiles.forEach(file => usedFileNames.add(file.fileName));
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
        const thumbnail = localImageFiles.find(file => file.fileName === ".thumbnail");
        if (imageWritten) item.localImageFingerprint = imageHash;
        else delete item.localImageFingerprint;
        item.thumbnailPath = thumbnail ? thumbnailPath : "";
        item.thumbnailMime = thumbnail?.mimeType || "";
        item.localImageFiles = localImageFiles;
        const existingItem = existingGameFolders.get(itemDirectoryName(item));
        const existingFiles = existingItem ? (await plugin.listFiles({ uri: existingItem.uri }))?.files || [] : [];
        for (const oldFile of existingFiles) {
          if ((oldFile.name.startsWith(".image-") || oldFile.name === ".thumbnail") && !usedFileNames.has(oldFile.name) && oldFile.uri) {
            try { await plugin.deleteFile?.({ uri: oldFile.uri }); } catch (_) {}
          }
        }
        await plugin.writeNestedFile({ uri, dirPath, fileName: "index.json", content: JSON.stringify(portableItem(item), null, 2) }); invalidateGamesIndex();
        hashes[id] = itemFingerprint(item);
        if (imageWritten) imageHashes[id] = { fingerprint: imageHash, files: localImageFiles };
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
    await Promise.all(Array.from({ length: Math.min(workerCount, 3) }, async () => {
      while (itemQueue.length) { await idle(); await syncItem(itemQueue.shift()); }
    }));

    if (plugin.deleteFile) {
      try {
        const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
        const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
        const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
        const games = treeFiles.find(file => file.name === "titles" && file.uri);
        const liveDirectories = new Set(payload.items.filter(item => item?.id).map(item => itemDirectoryName(item)));
        if (games) {
          for (const folder of (await plugin.listFiles({ uri: games.uri }))?.files || []) {
            if (!folder.uri || liveDirectories.has(folder.name)) continue;
            try {
              const files = (await plugin.listFiles({ uri: folder.uri }))?.files || [];
              for (const file of files) if (file.uri) await plugin.deleteFile({ uri: file.uri });
              await plugin.deleteFile({ uri: folder.uri }); invalidateGamesIndex();
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
    const backups = files.filter(entry => entry.uri && new RegExp(`^${app.key}(?:-backup-|_backup_)\\d{4}-\\d{2}-\\d{2}\\.json$`, "i").test(entry.name))
      .sort((a, b) => (Number(b.lastModified) || 0) - (Number(a.lastModified) || 0) || b.name.localeCompare(a.name));
    const candidates = [
      treeFiles.find(entry => entry.name === "database.json" && entry.uri),
      files.find(entry => entry.name === databaseFileName && entry.uri),
      ...backups
    ].filter((entry, index, all) => entry && all.findIndex(other => other?.uri === entry.uri) === index);
    for (const file of candidates) {
      try {
        const result = await plugin.readFile({ uri: file.uri });
        const parsed = JSON.parse(result.content);
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

  function queueFolderDatabaseWrite(payload, uri = activeFolderUri) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!uri || !plugin?.writeFile) return Promise.resolve();
    invalidateGamesIndex();
    // Commit the portable database snapshot immediately. Artwork downloads and
    // per-game mirrors can be slow; the library's status/details must survive
    // an app being closed while those files are syncing.
    const content = JSON.stringify(portableData(payload));
    const snapshotWrite = folderSnapshotQueue.catch(() => {}).then(async () => {
      if (plugin.writeNestedFile) await plugin.writeNestedFile({ uri, dirPath: [folderTreeName], fileName: "database.json", content }); invalidateGamesIndex();
      await plugin.writeFile({ uri, fileName: databaseFileName, content });
    });
    // Keep portable snapshots ordered by save revision. Concurrent SAF writes
    // to the same document can otherwise finish out of order and restore stale data.
    folderSnapshotQueue = snapshotWrite.catch(() => {});
    pendingFolderSync = { payload, uri, plugin, snapshotWrite };
    scheduleFolderSyncDrain();
    return snapshotWrite;
  }

  function scheduleFolderSyncDrain() {
    if (folderSyncDrain || !pendingFolderSync) return;
    const drain = folderWriteQueue.catch(() => {}).then(async () => {
      while (pendingFolderSync) {
        const next = pendingFolderSync;
        pendingFolderSync = null;
        try {
          await next.snapshotWrite;
          await syncFolderTree(next.payload, next.uri);
          await writeFolderBackup(next.payload, next.uri, next.plugin);
          if (activeFolderUri === next.uri) writeMirror(portableData(next.payload));
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
      extraJsonFileName: databaseFileName,
      extraJsonContent: JSON.stringify(portableData(payload), null, 2)
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
        const stored = await window.SplitAppIDB.loadAll();
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
      return { ...data, loadedFromFolder: false, fast: true };
    }
    let folderData = null;
    const encryptedItemIds = new Set();
    let encryptedItems = [];
    // Startup never opens Android's document picker itself: the storage gate (see app.js) does that once the user taps Choose folder.
    const folderUri = await getFolderUri({ prompt: false });
    // In the Android app the library database lives in a folder you choose: with none chosen yet (or the old one gone) the storage gate asks for one before anything loads.
    if (!folderUri && hasFolderPlugin()) throw new Error("Choose a folder for your library database.");
    if (folderUri) folderData = await readFolderDatabase(folderUri);

    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    if (plugin?.getItems && plugin?.getMeta) {
      try {
        const [itemsResult, metaResult] = await Promise.all([plugin.getItems(), plugin.getMeta()]);
        if (itemsResult?.exists && itemsResult.data) {
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
    itemIds.clear();
    itemSnapshots.clear();
    encryptedItems.forEach(item => {
      if (item?.id == null) return;
      const id = String(item.id);
      itemIds.add(id);
      itemSnapshots.set(id, JSON.stringify(portableItem(item)));
    });
    if (folderUri) queueFolderDatabaseWrite(data, folderUri).catch(error => console.warn("Could not save the restored database snapshot", error));
    return { ...data, loadedFromFolder: Boolean(folderData) };
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
    const payload = latest();
    folderLastCount = payload.items.length;
    return queueFolderDatabaseWrite(payload);
  }
  function scheduleFolderWrite(getPayload, count, urgent) {
    if (!activeFolderUri) return Promise.resolve();
    folderLatest = getPayload;
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
    const history = Array.isArray(data.history) ? clone(data.history) : [];
    const preferences = data.preferences && typeof data.preferences === "object" ? clone(data.preferences) : {};
    if (preferences.folderSyncDelay !== undefined && Number.isFinite(Number(preferences.folderSyncDelay))) folderDelayMs = Math.max(0, Number(preferences.folderSyncDelay)) * 1000;
    let payload;
    if (scope.full || !idbHealthy) {
      payload = { items: Array.isArray(data.items) ? clone(data.items) : [], history, preferences };
    } else {
      const wanted = new Set([...(scope.ids || [])].map(String));
      const changed = wanted.size ? clone((data.items || []).filter(item => wanted.has(String(item.id)))) : [];
      const removedIds = [...(scope.removed || [])].map(String);
      const live = data.items;
      payload = { scoped: true, changed, removedIds, history, preferences, live, count: Array.isArray(live) ? live.length : 0 };
    }
    const write = appSaveQueue.then(() => saveSnapshot(payload), () => saveSnapshot(payload));
    appSaveQueue = write.catch(() => {});
    return write;
  }

  let lastMetaJson = "";
  async function saveScoped(payload) {
    const stored = payload.changed.map(item => (activeFolderUri ? portableItem(item) : browserData({ items: [item] }).items[0]));
    try { await window.SplitAppIDB.saveSome({ changed: stored, removedIds: payload.removedIds, history: payload.history, preferences: payload.preferences }); }
    catch (error) { console.warn("IndexedDB save failed; falling back to a full save", error); idbHealthy = false; throw error; }
    writeMirror({ items: [], history: payload.history, preferences: payload.preferences });
    const folderWrite = scheduleFolderWrite(() => portableData({ items: payload.live, history: payload.history, preferences: payload.preferences }), payload.count, payload.removedIds.length > 0);
    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    try {
      if (plugin?.setItem && plugin?.setMeta) {
        const writes = [];
        const changedSnapshots = [];
        for (const item of payload.changed) {
          const id = String(item.id), snapshot = JSON.stringify(portableItem(item));
          if (itemSnapshots.get(id) !== snapshot) { writes.push(plugin.setItem({ id, data: snapshot })); changedSnapshots.push([id, snapshot]); }
        }
        for (const id of payload.removedIds) writes.push(plugin.deleteItem({ id }));
        const meta = JSON.stringify({ history: payload.history, preferences: payload.preferences });
        if (meta !== lastMetaJson) writes.push(plugin.setMeta({ data: meta }));
        await Promise.all(writes);
        changedSnapshots.forEach(([id, snapshot]) => { itemSnapshots.set(id, snapshot); itemIds.add(id); });
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
        const snapshots = new Map();
        const writes = [];
        for (const item of payload.items) {
          const id = String(item.id);
          const snapshot = JSON.stringify(portableItem(item));
          snapshots.set(id, snapshot);
          if (itemSnapshots.get(id) !== snapshot) writes.push(plugin.setItem({ id, data: snapshot }));
        }
        for (const id of itemIds) if (!nextIds.has(id)) writes.push(plugin.deleteItem({ id }));
        await Promise.all(writes);
        const meta = JSON.stringify({ history: payload.history, preferences: payload.preferences });
        await plugin.setMeta({ data: meta }); lastMetaJson = meta;
        itemIds.clear(); nextIds.forEach(id => itemIds.add(id));
        itemSnapshots.clear(); snapshots.forEach((snapshot, id) => itemSnapshots.set(id, snapshot));
      }
    } finally {
      await folderWrite;
    }
  }

  async function chooseFolder(currentData) {
    if (!hasFolderPlugin()) throw new Error("Folder storage is only available in the ScreenMark Android app.");
    const plugin = window.Capacitor.Plugins.BackupFolder;
    const picked = await plugin.pickFolder();
    if (!picked?.uri) throw new Error("No storage folder was selected.");
    activeFolderUri = picked.uri;
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
    const rootHasDatabase = files.some(file => file.name === databaseFileName
      || new RegExp(`^${app.key}_backup_\\d{4}-\\d{2}-\\d{2}\\.tar$`, "i").test(file.name)
      || new RegExp(`^${app.key}-backup-\\d{4}-\\d{2}-\\d{2}\\.json$`, "i").test(file.name));
    let itemTreeHasData = false;
    const games = treeFiles.find(file => file.name === "titles" && file.uri);
    // Listing ~1500 game folders through the storage framework is slow; skip it when a database file already proves the folder is in use.
    if (games && !rootHasDatabase && !treeFiles.some(file => file.name === "database.json")) {
      const folders = (await plugin.listFiles({ uri: games.uri }))?.files || [];
      itemTreeHasData = folders.some(file => file.uri);
    }
    const databaseExists = rootHasDatabase || treeFiles.some(file => file.name === "database.json") || itemTreeHasData;
    return { configured: true, valid: true, databaseExists, uri };
  }

  // Streams the library to a file in small chunks, so a 1500-game export never builds one huge string
  // or sends one huge message across the Android bridge (that crashed the app).
  // mode "ask": Android's "Save as" screen. mode "folder": straight into the chosen backup folder.
  async function exportLibrary({ items, history, preferences }, { mode = "ask", onProgress } = {}) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    const fileName = `${app.key}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (!plugin?.writeDocumentChunk) throw new Error("This build cannot save files. Update the app.");
    let opened;
    if (mode === "folder") {
      const uri = await getFolderUri({ prompt: false });
      if (!uri) throw new Error("No backup folder selected. Pick one in Settings → Backups.");
      opened = await plugin.beginFolderExport({ uri, fileName });
    } else opened = await plugin.createDocument({ fileName, mimeType: "application/json" });
    try {
      const CHUNK = 256 * 1024;
      let buffer = `{"app":${JSON.stringify(app.name)},"version":1,"exportedAt":${JSON.stringify(new Date().toISOString())},"items":[`;
      for (let index = 0; index < items.length; index++) {
        buffer += (index ? "," : "") + JSON.stringify(portableItem(items[index]));
        if (buffer.length >= CHUNK) {
          await plugin.writeDocumentChunk({ content: buffer }); buffer = "";
          onProgress?.(index + 1, items.length);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      buffer += `],"history":${JSON.stringify(history || [])},"preferences":${JSON.stringify(preferences || {})}}`;
      await plugin.writeDocumentChunk({ content: buffer });
      onProgress?.(items.length, items.length);
    } finally { await plugin.closeDocument().catch(() => {}); }
    return { fileName, uri: opened?.uri || "" };
  }

  window.SplitAppBackend = Object.freeze({
    exportLibrary,
    name: app.name,
    key: app.key,
    categories: app.categories.map(category => ({ ...category })),
    storageKey,
    folderUriKey,
    databaseFileName,
    load,
    save,
    chooseFolder,
    getFolderUri: () => getFolderUri({ prompt: false }),
    loadItemImages,
    hydrateThumbnails,
    flushFolderWrites: () => Promise.all([flushFolderNow(), folderSnapshotQueue, folderWriteQueue]),
    setImageStorage,
    inspectFolder,
    isNativeFolderStorageAvailable: hasFolderPlugin
  });
})();
