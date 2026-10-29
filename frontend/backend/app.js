// ScreenMark's app-specific state and Android encrypted-storage bridge.
(() => {
  "use strict";
  const app = window.APP_CONFIG;
  const storageKey = `splitapp_${app.key}_v1`;
  const folderUriKey = `${storageKey}_folder_uri`;
  const databaseFileName = `${app.key}_database.json`;
  const folderTreeName = `${app.key}-db`;
  const folderItemHashKey = `${storageKey}_folder_item_hashes`;
  const folderArchiveHashKey = `${storageKey}_folder_archive_hashes_v2`;
  const itemIds = new Set();
  let activeFolderUri = "";
  let folderWriteQueue = Promise.resolve();

  function discardRemovedFields(data) {
    delete data.preferences.defaultCategory;
    if (Array.isArray(data.items)) data.items.forEach(item => { if (item && typeof item === "object") delete item.notes; });
    return data;
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
    add(["image"], item.localThumbnailData || item.image);
    const imageKey = /(image|thumbnail|backdrop|cover|poster|artwork)/i;
    const visit = (value, path = []) => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...path, index]));
        return;
      }
      if (!value || typeof value !== "object") return;
      Object.entries(value).forEach(([key, child]) => {
        if (["localThumbnailData", "localImageData", "localImageFiles"].includes(key)) return;
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
    const items = [];
    for (const folder of gameFolders) {
      if (!folder.uri) continue;
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
              if (base64Content) item.localThumbnailData = `data:${item.thumbnailMime || "image/webp"};base64,${base64Content}`;
            } catch (error) { console.warn(`Could not read local artwork for ${item.title || item.id}`, error); }
          }
        }
        items.push(item);
      } catch (error) { console.warn(`Could not read ScreenMark item folder ${folder.name}`, error); }
    }
    return items;
  }

  // Fills in `localThumbnailData` for library items from the saved folder, so covers still show after the app/WebView cache is cleared or while offline.
  async function hydrateThumbnails(items, onBatch) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!Array.isArray(items) || !plugin?.listFiles || !plugin?.readBinaryFile) return 0;
    const uri = await getFolderUri({ prompt: false });
    if (!uri) return 0;
    const root = (await plugin.listFiles({ uri }))?.files || [];
    const tree = root.find(file => file.name === folderTreeName && file.uri);
    const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
    const titlesDir = treeFiles.find(file => file.name === "titles" && file.uri);
    if (!titlesDir) return 0;
    const folders = new Map(((await plugin.listFiles({ uri: titlesDir.uri }))?.files || []).filter(file => file.uri).map(file => [file.name, file]));
    const queue = items.filter(item => !item.localThumbnailData && (item.thumbnailPath || item.localImageFiles?.length));
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
          if (base64Content) { item.localThumbnailData = `data:${item.thumbnailMime || "image/webp"};base64,${base64Content}`; done += 1; if (done % 6 === 0) onBatch?.(done); }
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
    const root = (await plugin.listFiles({ uri }))?.files || [];
    const tree = root.find(file => file.name === folderTreeName && file.uri);
    const treeFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
    const games = treeFiles.find(file => file.name === "titles" && file.uri);
    const folders = games ? (await plugin.listFiles({ uri: games.uri }))?.files || [] : [];
    const folder = folders.find(file => file.name === itemDirectoryName(item) && file.uri);
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
    try {
      const response = await fetch(source);
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
    }
  }

  async function syncFolderTree(payload, uri) {
    const plugin = window.Capacitor?.Plugins?.BackupFolder;
    if (!uri || !plugin?.writeNestedFile || !plugin?.writeNestedBinaryFile) return;
    const treePath = [folderTreeName];
    const hashes = readFolderHashes(uri);
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

    for (const item of payload.items) {
      if (!item?.id) continue;
      const dirPath = itemFolderPath(item);
      const thumbnailPath = `${dirPath.join("/")}/.thumbnail`;
      let imageWritten = true;
      try {
        const itemHash = itemFingerprint(item);
        if (hashes[String(item.id)] === itemHash) continue;
        const localImageFiles = [];
        const candidates = collectImageCandidates(item);
        const usedFileNames = new Set();
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
        const thumbnail = localImageFiles.find(file => file.fileName === ".thumbnail");
        item.thumbnailPath = thumbnail ? thumbnailPath : "";
        item.thumbnailMime = thumbnail?.mimeType || "";
        item.localImageFiles = localImageFiles;
        const rootFiles = (await plugin.listFiles({ uri }))?.files || [];
        const tree = rootFiles.find(file => file.name === folderTreeName && file.uri);
        const oldFiles = tree ? (await plugin.listFiles({ uri: tree.uri }))?.files || [] : [];
        const existingGames = oldFiles.find(file => file.name === "titles" && file.uri);
        const existingItem = existingGames && (await plugin.listFiles({ uri: existingGames.uri }))?.files?.find(file => file.name === itemDirectoryName(item) && file.uri);
        const existingFiles = existingItem ? (await plugin.listFiles({ uri: existingItem.uri }))?.files || [] : [];
        for (const oldFile of existingFiles) {
          if ((oldFile.name.startsWith(".image-") || oldFile.name === ".thumbnail") && !usedFileNames.has(oldFile.name) && oldFile.uri) {
            try { await plugin.deleteFile?.({ uri: oldFile.uri }); } catch (_) {}
          }
        }
        await plugin.writeNestedFile({ uri, dirPath, fileName: "index.json", content: JSON.stringify(portableItem(item), null, 2) });
        if (imageWritten) hashes[String(item.id)] = itemFingerprint(item);
        else delete hashes[String(item.id)];
      } catch (error) {
        delete hashes[String(item.id)];
        console.warn(`Could not sync ScreenMark item ${item.title || item.id} to the selected folder`, error);
      }
    }

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
              await plugin.deleteFile({ uri: folder.uri });
              delete hashes[folder.name];
            } catch (error) { console.warn(`Could not remove old ScreenMark item folder ${folder.name}`, error); }
          }
        }
      } catch (error) { console.warn("Could not check for removed ScreenMark item folders", error); }
    }
    let allHashes = {};
    try { allHashes = JSON.parse(localStorage.getItem(folderItemHashKey) || "{}"); } catch (_) {}
    if (!allHashes || typeof allHashes !== "object") allHashes = {};
    allHashes[uri] = hashes;
    localStorage.setItem(folderItemHashKey, JSON.stringify(allHashes));
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
    const file = treeFiles.find(entry => entry.name === "database.json" && entry.uri)
      || files.find(entry => entry.name === databaseFileName && entry.uri)
      || files.filter(entry => entry.uri && new RegExp(`^${app.key}-backup-\\d{4}-\\d{2}-\\d{2}\\.json$`, "i").test(entry.name))
        .sort((a, b) => b.name.localeCompare(a.name))[0];
    if (!file) {
      const mirroredItems = await listFolderTreeItems(uri);
      return mirroredItems.length ? { items: mirroredItems, history: [], preferences: {}, fromItemTree: true } : null;
    }
    const result = await plugin.readFile({ uri: file.uri });
    const parsed = JSON.parse(result.content);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(items)) throw new Error("The ScreenMark database file is invalid.");
    return {
      items,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      preferences: parsed.preferences && typeof parsed.preferences === "object" ? parsed.preferences : {}
    };
  }

  async function hydrateFolderData(data, uri) {
    if (!data || !Array.isArray(data.items)) return data;
    const mirroredItems = await listFolderTreeItems(uri);
    if (!mirroredItems.length) return data;
    const mirroredById = new Map(mirroredItems.map(item => [String(item.id), item]));
    return {
      ...data,
      items: data.items.map(item => {
        const mirrored = mirroredById.get(String(item.id));
        if (!mirrored) return item;
        return {
          // The per-game JSON is the complete local record and also carries
          // image-file references. It is written before the central index, so
          // prefer it if an interrupted save left the index one step behind.
          ...item,
          ...mirrored,
          cachedDetails: mirrored.cachedDetails || item.cachedDetails,
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
    folderWriteQueue = folderWriteQueue.catch(() => {}).then(async () => {
      await syncFolderTree(payload, uri);
      const content = JSON.stringify(portableData(payload));
      if (plugin.writeNestedFile) {
        await plugin.writeNestedFile({ uri, dirPath: [folderTreeName], fileName: "database.json", content });
      }
      await plugin.writeFile({ uri, fileName: databaseFileName, content });
      await writeFolderBackup(payload, uri, plugin);
    });
    return folderWriteQueue;
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

  async function load() {
    const mirror = readMirror();
    let data = {
      items: Array.isArray(mirror.items) ? mirror.items : [],
      history: Array.isArray(mirror.history) ? mirror.history : [],
      preferences: mirror.preferences && typeof mirror.preferences === "object" ? mirror.preferences : {}
    };
    let folderData = null;
    const encryptedItemIds = new Set();
    // Do not launch Android's document picker from startup. The encrypted
    // app-private store is a usable local fallback until the user chooses a
    // shared folder from Settings → Backups.
    const folderUri = await getFolderUri({ prompt: false });
    if (folderUri) folderData = await readFolderDatabase(folderUri);

    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    if (plugin?.getItems && plugin?.getMeta) {
      try {
        const [itemsResult, metaResult] = await Promise.all([plugin.getItems(), plugin.getMeta()]);
        if (itemsResult?.exists && itemsResult.data) {
          const items = JSON.parse(itemsResult.data);
          if (Array.isArray(items)) {
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
      data = folderData.fromItemTree
        ? { ...data, ...folderData, history: folderData.history.length ? folderData.history : data.history, preferences: { ...data.preferences, ...folderData.preferences } }
        : folderData;
    }
    if (folderUri) data = await hydrateFolderData(data, folderUri);
    discardRemovedFields(data);
    itemIds.clear();
    (encryptedItemIds.size ? encryptedItemIds : data.items.map(item => String(item.id))).forEach(id => itemIds.add(id));
    if (folderUri) await queueFolderDatabaseWrite(data, folderUri);
    return { ...data, loadedFromFolder: Boolean(folderData) };
  }

  async function save(data) {
    const payload = {
      items: Array.isArray(data.items) ? data.items.map(item => ({ ...item })) : [],
      history: Array.isArray(data.history) ? data.history : [],
      preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : {}
    };
    localStorage.setItem(storageKey, JSON.stringify(activeFolderUri ? portableData(payload) : browserData(payload)));
    const folderWrite = queueFolderDatabaseWrite(payload);
    const plugin = window.Capacitor?.Plugins?.EncryptedStore;
    try {
      if (plugin?.setItem && plugin?.setMeta) {
        const nextIds = new Set(payload.items.map(item => String(item.id)));
        const writes = payload.items.map(item => plugin.setItem({ id: String(item.id), data: JSON.stringify(portableItem(item)) }));
        for (const id of itemIds) if (!nextIds.has(id)) writes.push(plugin.deleteItem({ id }));
        await Promise.all(writes);
        await plugin.setMeta({ data: JSON.stringify({ history: payload.history, preferences: payload.preferences }) });
        itemIds.clear(); nextIds.forEach(id => itemIds.add(id));
      }
    } finally {
      await folderWrite;
    }
    localStorage.setItem(storageKey, JSON.stringify(activeFolderUri ? portableData(payload) : browserData(payload)));
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
    const databaseExists = rootHasDatabase || treeFiles.some(file => file.name === "database.json");
    return { configured: true, valid: true, databaseExists, uri };
  }

  window.SplitAppBackend = Object.freeze({
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
    setImageStorage,
    inspectFolder,
    isNativeFolderStorageAvailable: hasFolderPlugin
  });
})();
