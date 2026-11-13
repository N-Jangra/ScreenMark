"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "frontend/backend/app.js"), "utf8");
const start = source.indexOf("  const isCompactItem = ");
const helpersEnd = source.indexOf("  const itemSnapshots = new Map();");
const streamStart = source.indexOf("  const STREAM_MIN_ITEMS");
const streamEnd = source.indexOf("  function queueFolderDatabaseWrite(");
const syncStart = source.indexOf("  let pendingFolderSnapshot = null, folderSnapshotDrain = null;");
const syncEnd = source.indexOf("  async function writeFolderBackup(", syncStart);

function build(plugin, store, { files = [], slimMin = 100, storage = new Map() } = {}) {
  const window = { SplitAppIDB: { getDetails: async id => store.get(String(id)) || null }, Capacitor: { Plugins: { BackupFolder: { listFiles: async () => ({ files }) } } } };
  storage.set("k_slim_min", String(slimMin));
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const code = `${source.slice(start, helpersEnd)}\n${source.slice(streamStart, streamEnd)}\nreturn { writeDatabaseStreamed, shouldStreamDatabase, detailedItem, canSkipFolderRead, recordFolderStamp };`;
  return new Function("window", "portableItem", "folderTreeName", "databaseFileName", "setTimeout", "storageKey", "localStorage", code)(window, item => ({ ...item }), "tree", "screenmark_database.json", setTimeout, "k", localStorage);
}
function makePlugin() {
  const files = new Map(), open = new Map();
  return {
    files,
    openFolderStream: async ({ id, dirPath, fileName }) => { open.set(id, { key: `${(dirPath || []).join("/")}/${fileName}`, text: "" }); },
    writeFolderStream: async ({ id, content }) => { open.get(id).text += content; },
    closeFolderStream: async ({ id }) => { const stream = open.get(id); files.set(stream.key, stream.text); open.delete(id); },
    renameFolderFile: async ({ dirPath, fromName, toName }) => {
      const prefix = (dirPath || []).join("/"), from = `${prefix}/${fromName}`, to = `${prefix}/${toName}`;
      if (!files.has(from)) throw new Error("temp is missing");
      files.set(to, files.get(from)); files.delete(from);
    }
  };
}

test("the streamed database holds every title with its full stored details and parses back", async () => {
  const stored = new Map(), items = [];
  for (let i = 0; i < 250; i++) {
    const full = { fetchedAt: 1, sections: [{ kind: "episodes", items: [{ id: `${i}-1`, summary: `long text ${i}` }] }] };
    stored.set(String(i), full);
    items.push({ id: String(i), title: `T${i}`, status: "Watchlist", cachedDetails: i % 5 === 0 ? { compact: true, sections: [] } : full });
  }
  const plugin = makePlugin(), { writeDatabaseStreamed } = build(plugin, stored);
  await writeDatabaseStreamed({ items, history: [{ id: "h" }], preferences: { theme: "dark" } }, "uri", plugin, { batchSize: 7 });
  assert.deepEqual([...plugin.files.keys()].sort(), ["/screenmark_database.json", "tree/database.json"]);
  const a = plugin.files.get("tree/database.json"), b = plugin.files.get("/screenmark_database.json");
  assert.equal(a, b, "both copies are identical");
  const parsed = JSON.parse(a);
  assert.equal(parsed.items.length, 250);
  assert.equal(parsed.items[0].cachedDetails.compact, undefined, "compact titles are written with their full details");
  assert.equal(parsed.items[0].cachedDetails.sections[0].items[0].summary, "long text 0");
  assert.equal(parsed.items[7].cachedDetails.sections[0].items[0].summary, "long text 7");
  assert.deepEqual(parsed.history, [{ id: "h" }]);
  assert.equal(parsed.preferences.theme, "dark");
});

test("streaming is used for large or compact libraries only, and always closes its files", async () => {
  const plugin = makePlugin(); plugin.openFolderStream = plugin.openFolderStream.bind(plugin);
  const { shouldStreamDatabase, writeDatabaseStreamed } = build(plugin, new Map());
  assert.equal(shouldStreamDatabase({ items: [{ id: "1" }] }, plugin), false);
  assert.equal(shouldStreamDatabase({ items: [{ id: "1", cachedDetails: { compact: true } }] }, plugin), true);
  assert.equal(shouldStreamDatabase({ items: Array.from({ length: 1500 }, (_, i) => ({ id: String(i) })) }, plugin), true);
  assert.equal(shouldStreamDatabase({ items: [{ id: "1", cachedDetails: { compact: true } }] }, {}), false, "no native stream API: fall back to the normal writer");
  // a failing write still closes both streams
  const closed = [], broken = { openFolderStream: async () => {}, writeFolderStream: async () => { throw new Error("disk full"); }, closeFolderStream: async ({ id }) => { closed.push(id); } };
  const built = build(broken, new Map());
  await assert.rejects(() => built.writeDatabaseStreamed({ items: [{ id: "1" }], history: [], preferences: {} }, "uri", broken), /disk full/);
  assert.equal(closed.length, 2);
});

test("the folder database is only skipped at launch when it is exactly the one this app last wrote", async () => {
  const storage = new Map(), files = [{ name: "screenmark_database.json", size: 5000 }];
  const built = build(makePlugin(), new Map(), { files, storage });
  const plugin = { listFiles: async () => ({ files }) };
  assert.equal(await built.canSkipFolderRead("uri", 2000), false, "no stamp yet: read the folder");
  await built.recordFolderStamp("uri", 2000, plugin);
  assert.equal(await built.canSkipFolderRead("uri", 2000), true);
  assert.equal(await built.canSkipFolderRead("uri", 2001), false, "different title count");
  assert.equal(await built.canSkipFolderRead("other", 2000), false, "different folder");
  files[0].size = 5001;
  assert.equal(await built.canSkipFolderRead("uri", 2000), false, "the file changed (another device / restore)");
  files[0].size = 5000;
  assert.equal(await build(makePlugin(), new Map(), { files, storage, slimMin: 5000 }).canSkipFolderRead("uri", 2000), false, "small libraries always read the folder");
});

test("folder snapshot requests coalesce to one latest follow-up while a write is active", async () => {
  const queueCode = source.slice(syncStart, syncEnd).replace("  let pendingFolderSnapshot = null, folderSnapshotDrain = null;", "");
  let unblock;
  const blocked = new Promise(resolve => { unblock = resolve; });
  const writes = [];
  let first = true;
  const plugin = {
    writeFile: async ({ content }) => { if (first) { first = false; await blocked; } writes.push(JSON.parse(content).items[0].id); },
    writeNestedFile: async () => {}
  };
  const window = { Capacitor: { Plugins: { BackupFolder: plugin } } };
  const localStorage = { removeItem() {}, setItem() {}, getItem() { return null; } };
  const code = `let activeFolderSnapshots = 0, folderWriteQueue = Promise.resolve(), pendingFolderSync = null, folderSyncDrain = null; const portableData = value => value;\n${source.slice(start, helpersEnd)}\n${source.slice(streamStart, streamEnd)}\n${queueCode}\nreturn queueFolderDatabaseWrite;`;
  const queue = new Function("window", "portableItem", "folderTreeName", "databaseFileName", "setTimeout", "storageKey", "localStorage", "syncFolderTree", "writeFolderBackup", "invalidateGamesIndex", "activeFolderUri", "idbHealthy", "writeMirror", "code", code)(
    window, item => ({ ...item }), "tree", "screenmark_database.json", setTimeout, "k", localStorage, async () => {}, async () => {}, () => {}, "uri", true, () => {}
  );
  const a = queue({ items: [{ id: "first" }], history: [], preferences: {} }, "uri", { syncTree: false, backup: false });
  await new Promise(resolve => setImmediate(resolve));
  const b = queue({ items: [{ id: "old-follow-up" }], history: [], preferences: {} }, "uri", { syncTree: false, backup: false });
  const c = queue({ items: [{ id: "latest-follow-up" }], history: [], preferences: {} }, "uri", { syncTree: false, backup: false });
  unblock();
  await Promise.all([a, b, c]);
  assert.deepEqual(writes, ["first", "latest-follow-up"]);
});
