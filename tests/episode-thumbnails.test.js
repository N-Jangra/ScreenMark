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
  assert.deepEqual(result, { cached: 2, total: 2 });
});

test("cached episode stills are skipped on later sync and image storage preferences are respected", async () => {
  const saved = new Map(), first = makeCache({ saved });
  const item = { id: "show-2", cachedDetails: { sections: [{ kind: "episodes", items: [{ id: "ep", image: "https://img.test/ep.jpg" }] }] } };
  await first.cache(item);
  const second = makeCache({ saved });
  assert.deepEqual(await second.cache(item), { cached: 0, total: 1 });
  assert.deepEqual(second.downloads, []);
  const onlineOnly = makeCache({ imageStorage: "online" });
  assert.deepEqual(await onlineOnly.cache(item), { cached: 0, skipped: true });
  assert.deepEqual(onlineOnly.downloads, []);
});
