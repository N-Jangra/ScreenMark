"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "frontend/backend/app.js"), "utf8");
const start = source.indexOf("  const episodeImageJobs = new Map();");
const end = source.indexOf("  async function syncFolderTree(", start);

function makeCache({ imageStorage = "all", saved = new Map() } = {}) {
  const writes = [], downloads = [];
  const window = { SplitAppIDB: {
    getThumbs: async entries => entries.filter(([key, signature]) => saved.get(key)?.signature === signature).map(([key]) => [key, saved.get(key).blob]),
    putThumbs: async entries => { writes.push(...entries); entries.forEach(([key, signature, blob]) => saved.set(key, { signature, blob })); }
  } };
  const block = source.slice(start, end).replace(/\n  async function syncFolderTree\([\s\S]*$/, "");
  const code = `${block}\nreturn cacheEpisodeThumbnails;`;
  const cache = new Function("app", "imageStorage", "window", "makeThumbnail", "atob", "Blob", "Uint8Array", "setTimeout", code)(
    { key: "screenmark" }, imageStorage, window,
    async url => { downloads.push(url); return { base64Content: "AQID", mimeType: "image/webp" }; },
    value => global.atob(value), Blob, Uint8Array, setTimeout
  );
  return { cache, writes, downloads, saved };
}

test("metadata cache downloads every episode still without opening or scrolling the episode list", async () => {
  const { cache, writes, downloads } = makeCache();
  const item = { id: "show-1", cachedDetails: { sections: [
    { kind: "episodes", items: [
      { id: 1, image: "https://img.test/one.jpg" },
      { id: 2, image: "https://img.test/two.jpg" },
      { id: 3, image: "" }
    ] },
    { kind: "gallery", items: [{ id: "poster", image: "https://img.test/poster.jpg" }] }
  ] } };
  const result = await cache(item);
  assert.deepEqual(downloads, ["https://img.test/one.jpg", "https://img.test/two.jpg"]);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map(([key]) => key), ["screenmark:episode:show-1:1", "screenmark:episode:show-1:2"]);
  assert.deepEqual(result, { cached: 2, total: 2, failed: 0 });
});

test("cached episode stills are skipped on later sync and image storage preferences are respected", async () => {
  const saved = new Map(), first = makeCache({ saved });
  const item = { id: "show-2", cachedDetails: { sections: [{ kind: "episodes", items: [{ id: "ep", image: "https://img.test/ep.jpg" }] }] } };
  await first.cache(item);
  const second = makeCache({ saved });
  assert.deepEqual(await second.cache(item), { cached: 1, total: 1, failed: 0 });
  assert.deepEqual(second.downloads, []);
  const onlineOnly = makeCache({ imageStorage: "online" });
  assert.deepEqual(await onlineOnly.cache(item), { cached: 0, skipped: true });
  assert.deepEqual(onlineOnly.downloads, []);
});

test("series poster artwork is never downloaded into the episode thumbnail cache", async () => {
  const { cache, writes, downloads } = makeCache();
  const poster = "https://image.tmdb.org/t/p/w500/poster.jpg";
  const item = { id: "show-poster", image: poster, cachedDetails: {
    image: "https://image.tmdb.org/t/p/original/poster.jpg",
    sections: [{ kind: "episodes", items: [
      { id: "bad-episode", image: "https://image.tmdb.org/t/p/w342/poster.jpg" },
      { id: "real-episode", image: "https://image.tmdb.org/t/p/w500/still.jpg" }
    ] }]
  } };
  assert.deepEqual(await cache(item), { cached: 1, total: 1, failed: 0 });
  assert.deepEqual(downloads, ["https://image.tmdb.org/t/p/w500/still.jpg"]);
  assert.deepEqual(writes.map(([key]) => key), ["screenmark:episode:show-poster:real-episode"]);
});

test("episode image download failures are counted so sync can offer retry", async () => {
  const window = { SplitAppIDB: { getThumbs: async () => [], putThumbs: async () => {} } };
  const block = source.slice(start, end).replace(/\n  async function syncFolderTree\([\s\S]*$/, "");
  const cache = new Function("app", "imageStorage", "window", "makeThumbnail", "atob", "Blob", "Uint8Array", "setTimeout", `${block}\nreturn cacheEpisodeThumbnails;`)(
    { key: "screenmark" }, "all", window, async () => null, global.atob, Blob, Uint8Array, setTimeout
  );
  const result = await cache({ id: "show-failed", cachedDetails: { sections: [{ kind: "episodes", items: [{ id: "ep", image: "https://img.test/ep.jpg" }] }] } });
  assert.deepEqual(result, { cached: 0, total: 1, failed: 1 });
});

test("season progress counts every season when one image batch crosses the boundary", async () => {
  const { cache } = makeCache(), progress = [];
  const episodes = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `s1-${index + 1}`, season: 1, image: `https://img.test/s1-${index + 1}.jpg` })),
    ...Array.from({ length: 2 }, (_, index) => ({ id: `s2-${index + 1}`, season: 2, image: `https://img.test/s2-${index + 1}.jpg` }))
  ];
  await cache({ id: "show-season-progress", cachedDetails: { sections: [{ kind: "episodes", items: episodes }] } }, value => progress.push(value));
  assert.equal(progress.at(-1).seasons, 2);
  assert.equal(progress.at(-1).seasonsDone, 2);
});

test("app calls the exported backend cache worker and hydrates local episode Blobs before network checks", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  assert.doesNotMatch(app, /(?<![.\w])cacheEpisodeThumbnails\s*\(/);
  assert.match(app, /window\.SplitAppBackend\?\.cacheEpisodeThumbnails\?\./);
  const loadDetails = app.slice(app.indexOf("async function loadDetails("), app.indexOf("// ----", app.indexOf("async function loadDetails(")));
  assert.ok(loadDetails.indexOf("hydrateEpisodeThumbnailCache(item)") < loadDetails.indexOf("if (prefs.metadataMode === \"offline\" || !navigator.onLine"));
  const resume = app.slice(app.indexOf("function resumeArtworkCaching()"), app.indexOf("function updateArtworkProgress(", app.indexOf("function resumeArtworkCaching()")));
  assert.match(resume, /if \(!needsArtwork\) continue;[\s\S]*cacheEpisodeThumbnails/);
});

test("Discover saves a new row before sync and saves full details before episode images", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  const backend = fs.readFileSync(path.join(__dirname, "..", "frontend/backend/app.js"), "utf8");
  assert.match(backend, /async function saveLibraryItemToIDB\(item, state = \{\}\)[\s\S]{0,300}SplitAppIDB\.saveSome\(\{ changed: \[stored\]/);
  const add = app.slice(app.indexOf("function addDiscoverResult("), app.indexOf("// Keep the best value per fact", app.indexOf("function addDiscoverResult(")));
  assert.match(add, /const initialWrite = saveLibraryItemToIDB\(item\);[\s\S]{0,400}hydrateSavedItem\(item\)/);
  const hydrate = app.slice(app.indexOf("async function hydrateOne("), app.indexOf("// Restore sync:", app.indexOf("async function hydrateOne(")));
  assert.match(hydrate, /if \(initialWrite\) await initialWrite;[\s\S]{0,300}await window\.SplitAppDetails\.load/);
  assert.match(hydrate, /SplitAppDetails\.load\(item, \{ \.\.\.detailSettings\(\), librarySync: true \}\)/);
  assert.match(hydrate, /applyLoadedMetadata\(item, loaded, \{ queueArtwork: false \}\);\s*await saveLibraryItemToIDB\(item\);\s*item\.fullDetailsAt = Date\.now\(\)/);
  assert.match(hydrate, /await window\.SplitAppIDB\.getDetails\(item\.id\)[\s\S]{0,100}Title details could not be saved on this device/);
  assert.ok(hydrate.indexOf("await saveLibraryItemToIDB(item)") < hydrate.indexOf("cacheEpisodeThumbnails?.(item"), "episode artwork starts only after full details are persisted");
});


test("thumbnail cache read failures are counted for retry instead of treated as uncached rows", async () => {
  const window = { SplitAppIDB: { getThumbs: async () => { throw new Error("database unavailable"); }, putThumbs: async () => {} } };
  const block = source.slice(start, end).replace(/\n  async function syncFolderTree\([\s\S]*$/, "");
  const cache = new Function("app", "imageStorage", "window", "makeThumbnail", "atob", "Blob", "Uint8Array", "setTimeout", `${block}\nreturn cacheEpisodeThumbnails;`)(
    { key: "screenmark" }, "all", window, async () => ({ base64Content: "AQID", mimeType: "image/webp" }), global.atob, Blob, Uint8Array, setTimeout
  );
  const result = await cache({ id: "show-db-failed", cachedDetails: { sections: [{ kind: "episodes", items: [{ id: "ep", image: "https://img.test/ep.jpg" }] }] } });
  assert.deepEqual(result, { cached: 0, total: 1, failed: 1 });
});


test("overlay Retry is handled outside the page-content click delegate", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  assert.match(app, /#sync-overlay \[data-setup-download-retry\][\s\S]{0,100}retryDownloadButton\(overlayRetry\)/);
  assert.match(app, /function retryDownloadButton\(button\)/);
});

test("startup thumbnail cleanup preserves episode blobs for live library titles and prunes deleted titles", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  const block = app.match(/const isLiveEpisodeThumbKey = \(key, liveItemIds\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(block, "cleanup predicate is present");
  const predicate = new Function("window", "config", `${block}; return isLiveEpisodeThumbKey;`)({ SplitAppBackend: { key: "screenmark" } }, { key: "screenmark" });
  const live = new Set(["show-live"]);
  assert.equal(predicate("screenmark:episode:show-live:ep:with:colons", live), true);
  assert.equal(predicate("screenmark:episode:show-deleted:ep-1", live), false);
  assert.equal(predicate("show-live:p", live), false, "ordinary poster entries keep their existing live-key check");
  assert.match(app, /filter\(key => !liveKeys\.has\(key\) && !isLiveEpisodeThumbKey\(key, liveItemIds\) && !isLiveArtworkThumbKey\(key, liveItemIds\)\)/);
});

test("artwork sync persists poster, backdrop, and detail gallery images with stable paths", async () => {
  const collectStart = source.indexOf("  function collectAllImageCandidates(item) {");
  const collectEnd = source.indexOf("\n  function itemFingerprint(", collectStart);
  const artworkStart = source.indexOf("  async function cacheArtwork(");
  const artworkEnd = source.indexOf("\n  async function syncFolderTree(", artworkStart);
  const writes = [], saved = new Map();
  const window = { SplitAppIDB: {
    getThumbs: async entries => entries.filter(([key, sig]) => saved.get(key)?.sig === sig).map(([key]) => [key, saved.get(key).blob]),
    putThumbs: async entries => { writes.push(...entries); entries.forEach(([key, sig, blob]) => saved.set(key, { sig, blob })); }
  } };
  const code = `${source.slice(collectStart, collectEnd)}\n${source.slice(artworkStart, artworkEnd)}\nreturn { cacheArtwork, artworkCacheEntries };`;
  const { cacheArtwork, artworkCacheEntries } = new Function("app", "imageStorage", "window", "makeThumbnail", "atob", "Blob", "Uint8Array", "setTimeout", code)(
    { key: "screenmark" }, "all", window, async () => ({ base64Content: "AQID", mimeType: "image/webp" }), global.atob, Blob, Uint8Array, setTimeout
  );
  const item = { id: "show-1", image: "https://img.test/poster.jpg", backdrop: "https://img.test/backdrop.jpg", cachedDetails: { sections: [{ kind: "gallery", title: "Screenshots", items: [{ image: "https://img.test/shot.jpg" }] }] } };
  const result = await cacheArtwork(item);
  const entries = artworkCacheEntries(item);
  assert.deepEqual(result, { cached: 3, total: 3, failed: 0 });
  assert.equal(writes.length, 3);
  assert.ok(entries.some(row => row.key === "show-1:p"));
  assert.ok(entries.some(row => row.paths.some(path => path.join(".") === "backdrop")));
  assert.ok(entries.some(row => row.paths.some(path => path.join(".").endsWith("items.0.image"))));
});

test("temporary cache clear preserves persistent IndexedDB artwork; explicit image clear removes it", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  const clear = app.slice(app.indexOf("async function clearAppCaches(kind)"), app.indexOf("async function clearLogcat()"));
  assert.match(clear, /if \(kind === "images" \|\| kind === "temporary"\)[\s\S]*thumbUrlCache\.clear\(\)/);
  assert.match(clear, /if \(kind === "images"\)\s*\{\s*await window\.SplitAppIDB\?\.clearThumbs/);
  assert.doesNotMatch(clear.slice(clear.indexOf("if (kind === \"temporary\")")), /clearThumbs/);
});

test("Android watchlist images request their persistent poster or episode cache key", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  const profile = fs.readFileSync(path.join(__dirname, "..", "frontend/pages/profile.js"), "utf8");
  assert.match(app, /function imageMarkup\(item, source, alt = "", fallback = "", className = "", episode = null, cacheOwner = item\)/);
  assert.match(app, /data-local-episode-id=.*data-local-cache-signature=/);
  assert.match(app, /style="visibility:hidden"/);
  assert.doesNotMatch(app, /useLocalThumb \? " hidden"/);
  assert.match(app, /const episodeThumbKeyOf = \(item, episodeId\) => `\$\{window\.SplitAppBackend\?\.key \|\| config\.key\}:episode:/);
  assert.match(profile, /imageMarkup\(item, thumb, "", fallback, "", episode\)/);
  assert.match(app, /cachedThumbUrls\(batch\.map\(record => \[record\.key, record\.signature\]\)\)/);
});

test("startup backfills missing title artwork for previously saved movies and series", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "frontend/app.js"), "utf8");
  const sync = app.slice(app.indexOf("function resumeArtworkCaching()"), app.indexOf("function updateArtworkProgress(", app.indexOf("function resumeArtworkCaching()")));
  assert.match(sync, /const cachedGuides = items\.filter\(item => item\.cachedDetails\)/);
  assert.match(sync, /artworkEntries = window\.SplitAppBackend\?\.artworkCacheEntries/);
  assert.match(sync, /window\.SplitAppBackend\?\.cacheArtwork\?\.\(item/);
  assert.match(sync, /if \(item\.category !== "series"\) \{ markDownload\(item, "done"\); continue; \}/);
  assert.match(sync, /cacheEpisodeThumbnails\?\.\(item/);
});
