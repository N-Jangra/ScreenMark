"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function loadPage(file, extra = {}) {
  const window = { ...extra };
  vm.runInContext(read(file), vm.createContext({ window, localStorage: { getItem: () => null, setItem() {} }, Intl, Date, Math, JSON, Map, Set, String, Number, Object, Array, RegExp }));
  return window;
}

test("sync page lists Quick setup downloads with synced / not synced counts and retry", () => {
  const window = loadPage("frontend/pages/sync.js", { SplitAppSources: { list: () => [{ key: "tvmaze", name: "TVmaze" }] } });
  const html = window.SplitAppPages.sync({ esc, itemById: () => null, setupDownloads: [
    { id: "1", title: "Done show", status: "done", source: "tvmaze", category: "series", providerId: "5" },
    { id: "2", title: "Broken show", status: "failed", error: "Offline", category: "series" },
    { id: "3", title: "Busy movie", status: "running", category: "movie" }
  ] });
  assert.match(html, /1 synced · 1 not synced · 1 remaining of 3/);
  assert.match(html, /Not synced/);
  assert.match(html, /data-setup-download-retry="2"/);
  assert.match(html, /data-setup-download-retry=""/);
  assert.ok(html.indexOf("Broken show") < html.indexOf("Done show"), "failed titles are listed first");
  assert.doesNotMatch(window.SplitAppPages.sync({ esc, itemById: () => null, setupDownloads: [] }), /Quick setup/);
});

test("Edit profile library picker is two steps and only opens for Picked below", () => {
  const window = loadPage("frontend/pages/profile.js");
  const items = [{ id: "1", title: "Alpha", category: "series", image: "https://x/p.jpg", backdrop: "https://x/b.jpg", cachedDetails: { sections: [{ kind: "gallery", title: "Screenshots (2)", items: [{ title: "a", image: "https://x/s1.jpg" }, { title: "b", image: "https://x/s2.jpg" }] }] } }];
  const prefs = { profileAvatarSource: "both", profileCoverSource: "pinned", profileCoverPinned: "1", profileCoverPinnedImage: "https://x/s2.jpg" };
  const page = () => window.SplitAppPages["profile-cover"]({ items, prefs, esc });
  assert.doesNotMatch(page(), /data-cover-title/);
  assert.match(page(), /Picked below/);
  window.SplitAppPages.setCoverTab("cover");
  assert.match(page(), /data-cover-title="cover" data-id="1"/);
  window.SplitAppPages.browseCover("cover", "1");
  const images = page();
  assert.equal((images.match(/data-cover-image="cover"/g) || []).length, 4);
  assert.match(images, /aria-pressed="true"/);
  assert.equal(window.SplitAppPages.coverCandidates(items[0], "cover")[0].value, "https://x/b.jpg");
});

test("backups record source and source id, and restore matches on them", () => {
  const backend = read("frontend/backend/app.js"), app = read("frontend/app.js");
  assert.match(backend, /"version":2,"exportedAt":[^]*?"index":\$\{JSON\.stringify\(backupIndex\(items\)\)\}/);
  assert.match(backend, /backupRefOf = item => \(\{ id:[^}]*source:[^}]*providerId:/);
  assert.match(app, /itemByProvider\(imported\.metadataSource, imported\.category, imported\.providerId\)/);
  assert.match(app, /"Source", "SourceID", "ID"/);
});

test("Quick setup opens on a fresh install and downloads full details through a queue", () => {
  const app = read("frontend/app.js");
  assert.match(app, /finishStartup\(full !== false\)/);
  assert.match(app, /Fresh install: once the storage folder is chosen/);
  assert.match(app, /hydrateActive < 2/);
  assert.doesNotMatch(app.slice(app.indexOf("async function hydrateOne")), /^[^]{0,400}background: true/);
  assert.match(app, /added > 8 \? "sync"/);
});

test("render falls back instead of throwing when a page module is missing", () => {
  assert.match(read("frontend/app.js"), /typeof window\.SplitAppPages\[page\] !== "function"/);
});

test("cast and crew is never persisted and full-list expansion has styles", () => {
  const backend = read("frontend/backend/app.js"), css = read("frontend/styles/demo-pages.css");
  assert.match(backend, /section\.kind !== "people"/);
  assert.match(css, /\.demo-cast-section \.detail-carousel\.expanded \{[^}]*display: grid !important/);
});

test("0.1.6 version and changelog are consistent", () => {
  const version = JSON.parse(read("package.json")).version;
  assert.equal(version, "0.1.6");
  assert.match(read("frontend/app-config.js"), /"version": "0\.1\.6"/);
  assert.match(read("android/app/build.gradle"), /versionName "0\.1\.6"/);
  assert.match(read("CHANGELOG.md"), /## \[0\.1\.6\]/);
});

test("Quick setup shows a wait message while sources load", () => {
  const window = loadPage("frontend/pages/setup.js");
  const html = window.SplitAppSetup.grid({ loading: true, rows: [], selected: new Map(), step: 0, query: "" }, esc);
  assert.match(html, /Please wait while the sources load data/);
  assert.match(html, /setup-skeleton/);
});

test("adding a discovered title matches an existing one by source id before title", () => {
  assert.match(read("frontend/app.js"), /itemByProvider\(result\.source, result\.category, result\.providerId\)[^]{0,80}itemByTitleIdentity/);
});

test("restored posters wait for the folder write before entering the thumbnail cache", () => {
  const app = read("frontend/app.js"), backend = read("frontend/backend/app.js");
  assert.match(backend, /screenmark:folder-written/);
  assert.match(app, /addEventListener\("screenmark:folder-written"/);
  assert.match(app, /primedThumbs\.size >= 300/);
  assert.doesNotMatch(app.slice(app.indexOf("async function primeThumbCache"), app.indexOf("let thumbRefillTimer")), /putThumbs/);
});

test("CSV and TXT exports carry what a restore needs and imports read it back", () => {
  const app = read("frontend/app.js");
  assert.match(app, /"Title", "Category", "Year", "Status", "Progress", "Goal", "Favorite", "Review", "Source", "SourceID", "ID", "Added", "Updated"/);
  assert.match(app, /\$\{title\}\$\{yearOf\(item\) \? ` \(\$\{yearOf\(item\)\}\)` : ""\}/);
  assert.match(app, /\(\(\?:19\|20\)\\d\{2\}\)/);
  assert.match(app, /csvSource && csvSource !== "manual" && csvSourceId \? \{ metadataSource: csvSource, providerId: csvSourceId \}/);
});

test("backups can be gzip-compressed and are read back transparently", async () => {
  const app = read("frontend/app.js");
  assert.match(app, /new CompressionStream\("gzip"\)/);
  assert.match(app, /new DecompressionStream\("gzip"\)/);
  assert.match(app, /head\[0\] === 0x1f && head\[1\] === 0x8b/);
  assert.match(read("frontend/pages/settings.js"), /accept="\.json,\.gz,/);
  const json = JSON.stringify({ app: "ScreenMark", version: 2, items: Array.from({ length: 200 }, (_, i) => ({ id: String(i), title: `Title ${i}`, metadataSource: "tvmaze", providerId: String(i) })) });
  const packed = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  assert.ok(packed.byteLength < json.length / 4);
  assert.equal(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip"))).text(), json);
});

test("restore syncs imported titles: linked ones download, names-only ones are matched to a source first", () => {
  const app = read("frontend/app.js");
  assert.match(app, /function syncImported\(list\)/);
  assert.match(app, /await matchTitleToSource\(item\)/);
  assert.match(app, /No exact match found in the enabled sources/);
  assert.match(app, /syncImported\(\[\.\.\.fresh, \.\.\.patches\.map\(row => row\.item\)\]\)/);
});

test("sync page shows only the download card (no empty-history box) and offers clear finished", () => {
  const window = loadPage("frontend/pages/sync.js", { SplitAppSources: { list: () => [] } });
  const html = window.SplitAppPages.sync({ esc, itemById: () => null, setupDownloads: [{ id: "1", title: "A", status: "done" }, { id: "2", title: "B", status: "queued" }] });
  assert.doesNotMatch(html, /No refresh history yet/);
  assert.match(html, /Sync status/);
  assert.match(html, /data-setup-download-clear/);
  assert.match(html, /href="#series-watchlist"/);
});

test("sync downloads persist across restarts and resume unfinished titles", () => {
  const app = read("frontend/app.js");
  assert.match(app, /DOWNLOADS_KEY = `\$\{storageKey\}_sync_downloads`/);
  assert.match(app, /function restoreDownloads\(\)/);
  assert.equal((app.match(/restoreDownloads\(\);/g) || []).length, 2);
  assert.match(app, /page === "sync" \? 400 : 1500/);
});

test("log and history rows are cached and flushed instead of re-parsed on every call or render", () => {
  const app = read("frontend/app.js");
  assert.match(app, /function pushRow\(suffix, limit, entry\)/);
  assert.match(app, /window\.addEventListener\("pagehide", flushRowStores\)/);
  assert.match(app, /needsLogs = page === "settings" && settingsGroup === "logcat"/);
  const recordLog = app.slice(app.indexOf("function recordLog"), app.indexOf("function recordLibraryChange"));
  assert.doesNotMatch(recordLog, /JSON\.parse/);
});

test("the frontend has no duplicate object keys in the settings icon map", () => {
  const app = read("frontend/app.js");
  assert.equal((app.match(/^      defaultStatus:/gm) || []).length, 1);
});

test("the bottom bar honors Bar background and Bar style on phones (low-end profile no longer forces it solid)", () => {
  const motion = read("frontend/styles/motion.css"), demo = read("frontend/styles/demo-pages.css");
  assert.doesNotMatch(motion, /html\[data-lowend=true\] \.bottom-bar[,{][^}]*background:var\(--surface\)!important/);
  assert.doesNotMatch(motion.match(/html\[data-lowend=true\] \.topbar[^{]*\{/)[0], /bottom-bar/);
  assert.match(motion, /html\[data-lowend=true\] \.bottom-bar\[data-bg="glass"\]\{backdrop-filter:blur/);
  assert.match(demo, /body \.bottom-bar\[data-bg="glass"\] \{ background: color-mix\(in srgb, var\(--surface\) calc\(var\(--bar-alpha\) \* 55%\)/);
  assert.match(demo, /body\[data-bar-style="underline"\] \.bottom-bar \.nav-button\.active::after/);
});

test("Tracking settings: default status only offers statuses a new title can keep, and series completion honors Automatic Completion", () => {
  const settings = read("frontend/pages/settings.js"), app = read("frontend/app.js");
  assert.match(settings, /\.filter\(status => status === \(context\.roles\?\.queued \|\| "Watchlist"\) \|\| status === \(context\.roles\?\.done \|\| "Completed"\)\)/);
  assert.match(app, /function finishSeriesIfComplete\(item, info\)/);
  assert.match(app, /mode === "ask" && item\.status !== roles\.done/);
  assert.equal((app.match(/finishSeriesIfComplete\(/g) || []).length >= 5, true);
  assert.doesNotMatch(app, /if \(seriesProgressComplete\(item, info, item\.progress\)\) item\.status = roles\.done;/);
  assert.match(read("frontend/pages/add.js"), /statuses\.includes\(prefs\.defaultStatus\)/);
});

test("Series / Movies / Favorites are not rebuilt by background syncs and downloads, and poster progress bars do not wait 4 s", () => {
  const app = read("frontend/app.js");
  assert.match(app, /\(page === "sync" \|\| page === "settings"\)\) metadataSyncRenderTimer = setTimeout/);
  assert.match(app, /else if \(page === "sync"\) scheduleHydrateRender\(\)/);
  assert.doesNotMatch(app, /"series-favorites", "movie-favorites", "profile", "sync"\]\.includes\(page\)\) scheduleHydrateRender/);
  const track = app.slice(app.indexOf("function trackPosterLoading"), app.indexOf("function discoverCatalogCard"));
  assert.match(track, /nothingToWaitFor/);
  assert.match(track, /\), 1500\);/);
  assert.doesNotMatch(track, /4000/);
});

test("the settings help text defines each setting once (a duplicate key silently hides the later text)", () => {
  const settings = read("frontend/pages/settings.js");
  for (const key of ["showSidebar", "defaultStatus", "automaticCompletion"]) {
    const help = settings.match(new RegExp(`\\b${key}: "[^"]{12,}"`, "g")) || [];
    assert.equal(help.length, 1, `${key} help text is defined ${help.length} times`);
  }
});

test("grid posters request smaller TMDB / TVmaze renditions with a one-time full-size fallback", () => {
  const app = read("frontend/app.js");
  const body = app.slice(app.indexOf("function smallArt"), app.indexOf("window.SplitAppImageMarkup = imageMarkup"));
  const fn = new Function(`${body.slice(0, body.indexOf("function imageMarkup"))}; return smallArt;`)();
  assert.equal(fn("https://image.tmdb.org/t/p/w500/abc.jpg"), "https://image.tmdb.org/t/p/w342/abc.jpg");
  assert.equal(fn("https://image.tmdb.org/t/p/original/abc.jpg"), "https://image.tmdb.org/t/p/w342/abc.jpg");
  assert.equal(fn("https://image.tmdb.org/t/p/w185/abc.jpg"), "https://image.tmdb.org/t/p/w185/abc.jpg", "already small");
  assert.equal(fn("https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg"), "https://static.tvmaze.com/uploads/images/medium_portrait/1/2.jpg");
  assert.equal(fn("https://example.com/x.jpg"), "https://example.com/x.jpg");
  assert.match(body, /className === "detail-image" \|\| !item \? source : smallArt\(source\)/);
  assert.match(body, /data-full-src/);
  assert.match(body, /this\.dataset\.fullSrc&&!this\.dataset\.fullTried/);
  assert.match(read("frontend/index.html"), /rel="preconnect" href="https:\/\/image\.tmdb\.org"/);
});
