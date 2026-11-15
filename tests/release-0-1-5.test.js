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
  assert.match(html, /sync-hero/);
  assert.match(html, /<strong>1<\/strong><span>Synced<\/span>/);
  assert.match(html, /<strong>1<\/strong><span>Remaining<\/span>/);
  assert.match(html, /<strong>1<\/strong><span>Failed<\/span>/);
  assert.match(html, /<b>67%<\/b>/, "the percentage counts done and failed titles as resolved attempts");
  assert.match(html, /data-setup-download-retry="2"/);
  assert.match(html, /data-setup-download-retry=""/);
  assert.ok(html.indexOf("Broken show") < html.indexOf("Done show"), "failed titles are listed before finished ones");
  assert.doesNotMatch(window.SplitAppPages.sync({ esc, itemById: () => null, setupDownloads: [] }), /Quick setup/);
});

test("sync overlay and status page use the same weighted percentage with two active workers and a failure", () => {
  const app = read("frontend/app.js"), start = app.indexOf("  function setupDownloadProgress("), end = app.indexOf("\n  function updateSyncOverlay", start);
  assert.ok(start >= 0 && end > start, "shared sync progress calculator exists");
  const progress = new Function("setupDownloads", `${app.slice(start, end)}; return setupDownloadProgress;`)(new Map());
  const downloads = [
    { status: "done" },
    { status: "failed" },
    { status: "running", total: 4, completed: 2 },
    { status: "running", total: 4, completed: 1 }
  ];
  const summary = progress(downloads);
  assert.equal(summary.percent, 69);
  assert.deepEqual({ done: summary.done, failed: summary.failed, remaining: summary.remaining }, { done: 1, failed: 1, remaining: 2 });
  const window = loadPage("frontend/pages/sync.js");
  const html = window.SplitAppPages.sync({ esc, itemById: () => null, setupDownloads: downloads, setupDownloadProgress: summary });
  assert.match(html, /<b>69%<\/b>/);
});

test("persistent sync overlay shows season episode progress, opens Sync, and retries failures", () => {
  const html = read("frontend/index.html"), css = read("frontend/styles/ui-polish.css"), app = read("frontend/app.js");
  assert.match(html, /id="sync-overlay"[^]*data-sync-overlay-open/);
  assert.match(html, /data-sync-overlay-progress/);
  assert.match(html, /data-sync-overlay-retry/);
  assert.match(css, /\.sync-overlay\s*\{\s*position:fixed/);
  assert.match(app, /function updateSyncOverlay\(\)/);
  assert.match(app, /const summary = setupDownloadProgress\(rows\)/);
  assert.match(app, /setupDownloadProgress: setupDownloadProgress\(\[\.\.\.setupDownloads\.values\(\)\]\)/);
  assert.match(app, /if \(page === "sync"\) \{ overlay\.hidden = true; return; \}/);
  assert.match(app, /createIcons\(\{ root: content, attrs: \{ "aria-hidden": "true" \} \}\);\s*updateSyncOverlay\(\)/);
  assert.match(app, /const imageStage = running\?\.stage === "images"/);
  assert.match(app, /\$\{running\.title \|\| "Title"\} · S\$\{running\.season \|\| "…"\} · \$\{epDone\}\/\$\{epTotal\} images/);
  assert.match(css, /\.sync-overlay-open \{[^}]*width:58px[^}]*border-radius:50%/);
  assert.match(app, /result\?\.skipped\) throw new Error\("Episode thumbnails could not be saved on this device\."\)/);
  assert.match(app, /eventClosest\(event, "\[data-sync-overlay-open\]"\)\) \{ goto\("sync"\); return; \}/);
  assert.match(app, /#sync-overlay \[data-setup-download-retry\][\s\S]{0,100}retryDownloadButton\(overlayRetry\)/);
  assert.match(app, /saveDownloads\(\); updateSyncOverlay\(\)/);
  assert.match(app, /needsArtworkSync = prefs\.imageStorage === "all"/);
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

test("profile picture pickers skip titles without usable pictures and discard stale pinned art", () => {
  const window = loadPage("frontend/pages/profile.js"), items = [
    { id: "empty", title: "No pictures", category: "series", thumbnailPath: "legacy-folder-path" },
    { id: "gallery", title: "Gallery only", category: "series", cachedDetails: { sections: [{ kind: "gallery", title: "Screenshots", items: [{ image: "https://x/shot.jpg" }] }] } }
  ];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  window.SplitAppPages.setCoverTab("cover");
  const html = window.SplitAppPages["profile-cover"]({ items, esc, prefs: { profileCoverSource: "pinned" } });
  assert.match(html, /Gallery only/);
  assert.doesNotMatch(html, /data-cover-title="cover" data-id="empty"/);
  assert.doesNotMatch(html, /src=""/);
  window.SplitAppPages.setCoverTab("avatar");
  const stalePinned = window.SplitAppPages["profile-cover"]({ items, esc, prefs: { profileAvatarSource: "pinned", profileAvatarPinned: "empty", profileAvatarPinnedImage: "https://old.invalid/missing.jpg" } });
  assert.doesNotMatch(stalePinned, /old\.invalid/);
  assert.equal(window.SplitAppPages.coverCandidates(items[0], "cover").length, 0);
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

test("quick setup keeps a completed title completed when the same title is picked in a later step", () => {
  const window = loadPage("frontend/pages/setup.js"), resolve = window.SplitAppSetup.resolveStatus;
  assert.equal(resolve("Watchlist", "Completed"), "Completed");
  assert.equal(resolve("Completed", "Watchlist"), "Completed");
  assert.equal(resolve("Watchlist", "Watchlist"), "Watchlist");
});

test("Quick Setup carries earlier picks as checked and locked through later steps", () => {
  const window = loadPage("frontend/pages/setup.js"), setup = window.SplitAppSetup;
  const result = { title: "A watched show", source: "tvmaze", providerId: "42", image: "https://example.test/poster.jpg" };
  const state = { mode: "", step: 1, query: "", loading: false, error: "", rows: [result], selected: new Map(), picks: [new Map([["tvmaze:42", result]]), new Map(), new Map(), new Map()] };
  const html = setup.grid(state, esc);
  assert.match(html, /class="setup-tile selected"[^>]*aria-pressed="true" data-setup-locked="true"/);
  assert.match(html, /already selected in another step/);
  assert.match(html, /class="setup-mark" aria-hidden="true"/);
  assert.match(read("frontend/app.js"), /setupToggle\.dataset\.setupLocked === "true"/);
  assert.equal(setup.resolveStatus("queued", "done", "done"), "done", "the earlier completed pick remains the final status");
});

test("Quick Setup recognizes the same title from another provider across steps", () => {
  const setup = loadPage("frontend/pages/setup.js").SplitAppSetup;
  const state = { mode: "", step: 1, query: "", loading: false, error: "", selected: new Map(), picks: [new Map([["tvmaze:42", { title: "The Crown", year: "2016", category: "series", source: "tvmaze", providerId: "42" }]]), new Map(), new Map(), new Map()], rows: [
    { title: "The Crown", year: "2016", category: "series", source: "imdb", providerId: "tt4786824" },
    { title: "The Crown", year: "2010", category: "series", source: "imdb", providerId: "tt-old" },
    { title: "The Crown", year: "2016", category: "movie", source: "imdb", providerId: "tt-film" }
  ] };
  const html = setup.grid(state, esc);
  assert.match(html, /class="setup-tile selected"[^>]*aria-pressed="true" data-setup-locked="true"/);
  assert.match(html, /data-setup-toggle="1" aria-pressed="false" aria-label="The Crown \(2010\)"/);
  assert.match(html, /data-setup-toggle="2" aria-pressed="false" aria-label="The Crown \(2016\)"/);
});

test("Quick Setup keeps Later available on later steps and invalidates pending searches when leaving", () => {
  const window = loadPage("frontend/pages/setup.js"), state = { mode: "", step: 2, query: "", loading: false, error: "", rows: [], selected: new Map(), picks: [new Map(), new Map(), new Map(), new Map()] };
  assert.match(window.SplitAppPages.setup({ setup: state, esc }), /data-setup-skip>Later<\/button>/);
  const app = read("frontend/app.js");
  assert.match(app, /function finishSetup\(save = true\)\s*\{\s*\/\/ Invalidate provider responses[\s\S]*?clearTimeout\(setupSearchTimer\); setupSearchTimer = 0; setupRequest\+\+; setupState\.loading = false;/);
});

test("Quick Setup badges titles already in the library and disables them so they cannot be picked", () => {
  const setup = loadPage("frontend/pages/setup.js").SplitAppSetup;
  const items = [{ id: "saved", title: "The Crown", category: "series", metadataSource: "tvmaze", providerId: "42", year: "2016" }];
  const rows = setup.withLibraryStatus([
    { title: "Renamed source result", category: "series", source: "tvmaze", providerId: "42", year: "2016" },
    { title: "The Crown", category: "series", source: "imdb", providerId: "tt123", year: "2016" },
    { title: "The Crown", category: "series", source: "imdb", providerId: "tt456", year: "2010" },
    { title: "The Crown", category: "movie", source: "imdb", providerId: "tt789", year: "2016" }
  ], items);
  assert.deepEqual(rows.map(row => row.inLibrary), [true, true, false, false]);
  const html = setup.grid({ mode: "", step: 0, query: "", loading: false, error: "", rows: [rows[0]], selected: new Map(), picks: [new Map(), new Map(), new Map(), new Map()] }, esc);
  assert.match(html, /class="setup-tile is-in-library" disabled aria-disabled="true"/);
  assert.doesNotMatch(html, /data-setup-toggle/);
  assert.match(html, /aria-label="Already in library">✓ In library/);
  assert.doesNotMatch(html, /data-setup-locked/);
  assert.match(read("frontend/app.js"), /SplitAppSetup\.withLibraryStatus\(\(rows \|\| \[\]\)\.slice\(0, 60\), items, step\.category\)/);
  assert.match(read("frontend/styles/demo-pages.css"), /\.setup-library-indicator\s*\{/);
});

test("Quick Setup paints early source results while slower sources are still loading", async () => {
  const setup = loadPage("frontend/pages/setup.js").SplitAppSetup;
  const partial = { title: "Fast catalog result", category: "series", source: "tvmaze", providerId: "7", image: "https://example.test/7.jpg" };
  const html = setup.grid({ mode: "", step: 0, query: "karate", loading: true, error: "", rows: [partial], selected: new Map(), picks: [new Map(), new Map(), new Map(), new Map()] }, esc);
  assert.match(html, /More matches are loading/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Fast catalog result/);
  assert.doesNotMatch(html, /setup-skeleton/);
  let resolveSlow;
  const slow = new Promise(resolve => { resolveSlow = resolve; }), partials = [];
  const pending = setup.searchIncrementally("karate", "series", {}, ["tvmaze", "imdb"], async (_query, _category, _settings, source) => {
    if (source === "tvmaze") return [partial, { ...partial, title: "Duplicate provider result" }];
    return slow;
  }, rows => partials.push(Array.from(rows, row => row.source)));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(partials, [["tvmaze"]], "the first source is published before the second source resolves");
  resolveSlow([{ ...partial, source: "imdb", providerId: "tt7" }]);
  const merged = await pending;
  assert.deepEqual(Array.from(merged, row => row.source), ["tvmaze", "imdb"]);
  const app = read("frontend/app.js");
  assert.match(app, /SplitAppSetup\.searchIncrementally\(query, step\.category, settings, sourceOrder/);
  assert.match(app, /setupState\.rows = withLibraryStatus\(partial\);\s*setGrid\(\)/);
  assert.match(read("frontend/pages/setup.js"), /await Promise\.all\(sourceOrder\.map\(async source =>/);
});

test("render falls back instead of throwing when a page module is missing", () => {
  assert.match(read("frontend/app.js"), /typeof window\.SplitAppPages\[page\] !== "function"/);
});

test("cast and crew is never persisted and full-list expansion has styles", () => {
  const backend = read("frontend/backend/app.js"), css = read("frontend/styles/demo-pages.css");
  assert.match(backend, /section\.kind !== "people"/);
  assert.match(css, /\.demo-cast-section \.detail-carousel\.expanded \{[^}]*display: grid !important/);
});

test("0.1.9 version and changelog are consistent", () => {
  const version = JSON.parse(read("package.json")).version;
  assert.equal(version, "0.1.9");
  assert.match(read("frontend/app-config.js"), /"version": "0\.1\.9"/);
  assert.match(read("android/app/build.gradle"), /versionName "0\.1\.9"/);
  assert.match(read("CHANGELOG.md"), /## \[0\.1\.9\]/);
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
  const refill = app.slice(app.indexOf("async function fillThumbCache"), app.indexOf("let exportRunning"));
  assert.match(refill, /const replacements = new Set\(primedEntries\.map\(\(\[key\]\) => key\)\)/);
  assert.match(refill, /if \(!replacements\.has\(key\)\) continue;[^]*?if \(imageUrlIsLive\(url\)\) continue;[^]*?URL\.revokeObjectURL\(url\)[^]*?thumbUrlCache\.delete\(cacheKey\)/,
    "folder restore revokes only detached URLs for replaced titles and preserves unrelated / live posters");
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
  assert.match(read("frontend/pages/settings.js"), /type="file" accept="\*\/\*" data-setting-action="import"/);
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

test("native image fallback cache keeps visible blobs alive and trims detached blobs", () => {
  const app = read("frontend/app.js");
  const start = app.indexOf("function trimNativeImageFallbacks()");
  const end = app.indexOf('window.addEventListener("pagehide"', start);
  const body = app.slice(start, end);
  const cache = new Map(), visible = new Set(), revoked = [];
  const trim = new Function("nativeImageFallbacks", "imageUrlIsLive", "URL", `${body}; return trimNativeImageFallbacks;`)(
    cache, url => visible.has(url), { revokeObjectURL: url => revoked.push(url) }
  );
  for (let index = 0; index < 25; index++) { cache.set(`remote:${index}`, `blob:${index}`); visible.add(`blob:${index}`); }
  trim();
  assert.equal(cache.size, 25, "all live image URLs remain cached, even temporarily above the cap");
  assert.ok(cache.has("remote:24"));
  assert.deepEqual(revoked, []);
  visible.clear();
  trim();
  assert.equal(cache.size, 24);
  assert.deepEqual(revoked, ["blob:0"]);
  assert.match(app, /for \(const url of nativeImageFallbacks\.values\(\)\) URL\.revokeObjectURL\(url\);\s*nativeImageFallbacks\.clear\(\)/);
});

test("watchlist episode thumbnail hydration retries stale revoked object URLs", () => {
  const app = read("frontend/app.js");
  assert.match(app, /function localImageUrlAvailable\(url\)[\s\S]*?thumbUrlCache\.values\(\)[\s\S]*?nativeImageFallbacks\.values\(\)/);
  assert.match(app, /isLocalImageUrlAvailable: localImageUrlAvailable/);
  assert.match(app, /const savedUrl = item\.localImageData\?\.\[path\];\s*if \(savedUrl && localImageUrlAvailable\(savedUrl\)\) return;\s*if \(savedUrl\) delete item\.localImageData\[path\];/);
});

test("an offline poster-cache miss hydrates the selected folder before using its remote URL", () => {
  const app = read("frontend/app.js");
  const drain = app.slice(app.indexOf("async function drainDeferredImages"), app.indexOf("function activateDeferredImage"));
  assert.match(drain, /else if \(\/\^https\?:\/i\.test\(record\.online\) && navigator\.onLine\) finishDeferredImage/);
  assert.match(drain, /else slow\.push\(record\)/);
  assert.match(drain, /const folderBacked = slow\.filter\(record => !record\.episodeId && record\.key === thumbKeyOf\(record\.item\)\)/);
  assert.match(drain, /await hydrate\(clones\)/);
  assert.match(drain, /finishDeferredImage\(record\.image, local \|\| record\.online\)/);
});
