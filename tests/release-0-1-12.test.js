"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function loadPages(files, extra = {}) {
  const window = { SplitAppDates: { text: value => String(value ?? "") }, SplitAppLibrary: { episodeInfo: () => null }, ...extra };
  const context = vm.createContext({ window, URL, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, Intl, console, setTimeout, clearTimeout });
  for (const file of files) vm.runInContext(read(file), context, { filename: file });
  return window;
}

test("0.1.12 changelog, docs and version metadata agree", () => {
  assert.equal(JSON.parse(read("package.json")).version, "0.1.12");
  assert.match(read("frontend/app-config.js"), /"version": "0\.1\.12"/);
  assert.match(read("android/app/build.gradle"), /versionName "0\.1\.12"/);
  assert.match(read("android/app/build.gradle"), /versionCode 112/);
  assert.match(read("CHANGELOG.md"), /## \[0\.1\.12\] — 2026-11-17/);
  assert.match(read("docs/README.md"), /ScreenMark 0\.1\.12/);
  assert.match(read("docs/storage.md"), /Transfers: progress, notifications and images \(0\.1\.12\)/);
  assert.match(read("docs/metadata.md"), /Cast, crew and character pages by source \(0\.1\.12\)/);
});

test("a TVMaze person page with guest appearances renders instead of throwing", () => {
  const window = loadPages(["frontend/backend/features/metadata.js", "frontend/pages/details.js"]);
  const html = window.SplitAppPages.details({
    detailPreview: null, items: [], detailItemId: "", detailReturnPage: "series", detailData: null, detailLoading: false,
    detailError: "", detailEditMode: false, category: () => null, labelCategory: key => key, prefs: {}, roles: {}, esc,
    detailRef: { type: "person", id: 14245, title: "Bryan Cranston", extra: null }, detailRefOffset: 0, refLoading: false, refError: "", refItem: null,
    refData: { type: "person", source: "TVmaze", title: "Bryan Cranston", image: "", url: "https://www.tvmaze.com/people/14245/bryan-cranston", facts: [["Born", "1956-03-07"], ["Country", "United States"]],
      sections: [{ title: "Guest appearances (1)", kind: "episodes-list", items: [{ id: 9, title: "Show · S1E1 · Pilot", meta: "as Walter", image: "https://x/e.jpg", ref: { type: "episode", id: 9, title: "Pilot" } }] }] }
  });
  assert.match(html, /TVmaze cast profile/);
  assert.match(html, /Show · S1E1 · Pilot/);
  assert.match(html, /demo-fact-pills/);
});

test("person and character references gate on the source named by their id", () => {
  const app = read("frontend/app.js");
  assert.match(app, /"kitsu-person": "kitsu"/);
  assert.match(app, /"jikan-person": "jikan"/);
  assert.match(app, /const referenceSourceKey = idSource \|\| parent\?\.metadataSource/);
});

test("IMDb profiles that cannot load fall back to a basic profile rather than an error", () => {
  const controller = read("frontend/backend/features/show-detail-controller.js");
  assert.match(controller, /basic profile \(name \+ IMDb link\)/);
  assert.match(controller, /add a TMDB API key in Metadata Sources to load it here/);
});

test("the image viewer offers rotate, download, copy, share and close in both detail layouts", () => {
  const page = read("frontend/pages/details.js");
  for (const control of ["data-detail-image-rotate", "data-detail-image-download", "data-detail-image-copy", "data-detail-image-share", "data-detail-image-close"]) {
    assert.equal(page.split(`<button type="button" ${control}`).length - 1 + page.split(`class="detail-image-modal-close" ${control}`).length - 1 >= 2, true, `${control} is in both viewers`);
  }
  const app = read("frontend/app.js");
  for (const fn of ["rotateDetailImage", "downloadDetailImage", "copyDetailImage", "shareDetailImage"]) assert.match(app, new RegExp(`function ${fn}`));
  assert.match(read("frontend/styles/details.css"), /\.detail-image-modal\.is-rotated figure img/);
});

test("Change cover lists on-device copies and works offline", () => {
  const app = read("frontend/app.js");
  assert.match(app, /function coverCandidates\(item, local = \{\}\)/);
  assert.match(app, /return navigator\.onLine \? rows : rows\.filter\(row => row\.src !== row\.url\)/);
  assert.match(app, /No saved pictures yet\. Open this title once online/);
  assert.match(read("frontend/styles/ui-polish.css"), /\.cover-picker-grid\{display:flex;flex-wrap:wrap/);
});

test("detail tags have no box and profile fact pills share one style", () => {
  const css = read("frontend/styles/ui-polish.css");
  assert.match(css, /body \.detail-chips span\{[^}]*border:0;[^}]*background:transparent/);
  assert.match(css, /demo-actor-hero \.demo-actor-copy \.demo-fact-pills span:first-child/);
  assert.match(css, /\.detail-section\.detail-tags-section \{ overflow: visible !important;[^}]*padding: 0 !important[^}]*background: transparent !important/);
  assert.match(css, /\.detail-tags-section \.detail-chips span \{[^}]*border: 1px solid var\(--d-line2\)[^}]*border-radius: 999px/, "tags are outlined pills like the Links");
  assert.match(read("frontend/pages/details.js"), /class="detail-section detail-tags-section"><h3>Tags/);
});

test("the sync page offers Clear updated, Clear failed and Clear all", () => {
  const window = loadPages(["frontend/pages/sync.js"]);
  const entries = [{ id: "a", title: "A", status: "done" }, { id: "b", title: "B", status: "checked" }, { id: "c", title: "C", status: "failed", error: "x" }];
  const html = window.SplitAppPages.sync({ metadataSyncState: { entries }, metadataSyncCounts: { changed: 1, unchanged: 1, failed: 1, skipped: 0, remaining: 0 }, itemById: () => null, esc, setupDownloads: [] });
  assert.match(html, /data-metadata-sync-action="clear-updated"[^>]*>Clear updated \(2\)/);
  assert.match(html, /data-metadata-sync-action="clear-failed"[^>]*>Clear failed \(1\)/);
  assert.match(html, /data-metadata-sync-action="clear"[^>]*>Clear all/);
  const clean = window.SplitAppPages.sync({ metadataSyncState: { entries: [entries[0]] }, metadataSyncCounts: { changed: 1, unchanged: 0, failed: 0, skipped: 0, remaining: 0 }, itemById: () => null, esc, setupDownloads: [] });
  assert.doesNotMatch(clean, /clear-failed/);
});

test("clearing updated rows keeps failed and queued rows (handler)", () => {
  const app = read("frontend/app.js");
  assert.match(app, /const drop = kind === "failed" \? new Set\(\["failed"\]\) : new Set\(\["done", "checked"\]\)/);
  assert.match(app, /metadataSyncCounters = null;/);
});

test("importing writes the grid poster cache row so posters survive a restart", () => {
  const app = read("frontend/app.js");
  assert.match(app, /if \(path === "image"\) writes\.push\(\[thumbKeyOf\(item\), thumbSigOf\(item\), blob\]\)/);
  assert.match(app, /async function mapPool\(list, limit, worker\)/);
});

test("import progress reports bytes, stages and an Android notification", () => {
  const app = read("frontend/app.js");
  assert.match(app, /onBytes: \(done, total\) => importProgress/);
  assert.match(app, /importNotify\("startExportNotification"/);
  assert.match(app, /className = "sync-fab import-fab"/);
  assert.match(app, /function openImportDetails\(\)/);
  assert.match(app, /RESTORING YOUR LIBRARY/);
  assert.match(read("frontend/components/backup-stream.js"), /options\.onBytes/);
});

test("the export card is quiet (no import notification) and only reports finished after progress", () => {
  const app = read("frontend/app.js");
  assert.match(app, /importProgress\("Exporting backup…", total \? done \/ total : null, \{ quiet: true \}\)/);
  assert.match(app, /if \(exportCardShown\)/);
});

test("achievement badge share is a top-bar icon", () => {
  const page = read("frontend/pages/achievements.js");
  assert.match(page, /class="ach-share-icon" data-share-badge/);
  assert.doesNotMatch(page, /Share badge image<\/button>/);
});

test("the export notification is cancelled with the app and can expire on its own", () => {
  const java = read("android/app/src/main/java/com/cuemark/screenmark/ShareIntentPlugin.java");
  assert.match(java, /protected void handleOnDestroy\(\)/);
  assert.match(java, /public void load\(\)/);
  assert.match(java, /setTimeoutAfter\(EXPORT_PROGRESS_TIMEOUT_MS\)/);
  assert.match(java, /"import"\.equals\(call\.getString\("kind", "export"\)\)/);
});

test("load more and fast scrolling stay ahead of the viewport", () => {
  const app = read("frontend/app.js");
  assert.match(app, /const buffer = viewport \* 2\.5/);
  assert.match(app, /const lead = Math\.max\(2, Math\.ceil\(viewport \/ metrics\.row\)\)/);
  assert.equal((app.match(/rootMargin: "1800px 0px"/g) || []).length, 2);
  assert.match(app, /image\.decoding = "sync"; activateDeferredImage\(image\)/);
});

test("identical list renders are skipped but virtual grids always redraw", () => {
  const app = read("frontend/app.js");
  assert.match(app, /STABLE_RENDER_PAGES = new Set\(\["profile", "series", "movies"/);
  assert.match(app, /!content\.querySelector\("\[data-virtual-grid\]"\)/);
});

test("Rotten Tomatoes cast link to their celebrity page and load full profiles", async () => {
  const celebrityHtml = `<script type="application/ld+json">${JSON.stringify({ "@type": "Person", name: "Peter Dinklage", birthDate: "1969-06-11", birthPlace: { name: "Morristown, New Jersey, USA" },
    itemListElement: [{ "@type": "ItemList", name: "Movies", itemListElement: [{ "@type": "Movie", name: "The Station Agent", dateCreated: "2003", url: "https://www.rottentomatoes.com/m/station_agent", aggregateRating: { ratingValue: "94" }, image: "https://images.fandango.com/x--rtvideodefault.jpg" }, { "@type": "Movie", name: "Unknown Film", url: "https://www.rottentomatoes.com/m/unknown", image: "https://images.fandango.com/y--rtvideodefault.jpg" }] }] })}</script>
    <rt-img class="celebrity-bio__hero-img" src="https://img.example/portrait.jpg" alt="Portrait photo of Peter Dinklage"></rt-img>
    <p class="celebrity-bio__item" data-qa="celebrity-bio-highest-rated"><rt-text context="label">Highest Rated:</rt-text><span>94% <rt-link>The Station Agent (2003)</rt-link></span></p>
    <tile-photo slot="tile"><span class="sr-only">Season 4 cast</span><rt-img slot="image" src="https://resizing.flixster.com/a=/352x330/v2/https://resizing.flixster.com/orig.jpg,https://resizing.flixster.com/b=/240x135/v2/https://resizing.flixster.com/orig.jpg"></rt-img></tile-photo>
    <tile-photo slot="tile"><span class="sr-only">Insecure original</span><rt-img slot="image" src="https://resizing.flixster.com/c=/352x330/v2/http://media.example/full.jpg"></rt-img></tile-photo>
    <rt-img alt="The Station Agent poster image" slot="image" src="https://resizing.flixster.com/poster-sa.jpg"></rt-img>
    <p class="celebrity-bio__item" data-qa="celebrity-bio-summary">American actor Peter Dinklage overcame every obstacle.</p>`;
  const showHtml = `<script type="application/ld+json">${JSON.stringify({ "@type": "TVSeries", name: "Game of Thrones", actor: [{ "@type": "Person", name: "Peter Dinklage", sameAs: "https://www.rottentomatoes.com/celebrity/peter_dinklage" }] })}</script>`;
  const window = { SplitAppDiscovery: { encode: v => encodeURIComponent(String(v ?? "")), requestJson: async () => ({}), tmdbGet: async () => ({}), tvdbGet: async () => ({}), loadCustomDetails: async () => null,
    sourceText: async (source, url) => /\/celebrity\//.test(url) ? celebrityHtml : showHtml } };
  const context = vm.createContext({ window, URL, URLSearchParams, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout });
  vm.runInContext(read("frontend/backend/features/metadata.js"), context);
  vm.runInContext(read("frontend/backend/features/show-detail-controller.js"), context);
  const controller = window.SplitAppDetailController;
  const title = await controller.load({ metadataSource: "rottentomatoes", category: "series", providerId: "/tv/game_of_thrones", title: "Game of Thrones" }, {});
  const cast = title.sections.find(section => /^Cast/.test(section.title)).items[0];
  assert.equal(cast.ref.id, "rt-celebrity:peter_dinklage");
  const profile = await controller.loadRef(JSON.parse(JSON.stringify(cast.ref)), {});
  assert.equal(profile.source, "Rotten Tomatoes");
  assert.equal(profile.title, "Peter Dinklage");
  assert.equal(profile.image, "https://img.example/portrait.jpg");
  assert.match(profile.description, /overcame every obstacle/);
  assert.deepEqual(JSON.parse(JSON.stringify(profile.facts.map(([label]) => label))), ["Born", "Birthplace", "Highest rated"]);
  const photos = profile.sections.find(section => /^Photos/.test(section.title));
  assert.equal(photos.kind, "gallery");
  assert.equal(photos.items[0].image, "https://resizing.flixster.com/orig.jpg");
  assert.match(photos.items[1].image, /^https:\/\/resizing\.flixster\.com\/c=/, "plain-http originals fall back to the https resized copy");
  assert.equal(photos.items[0].title, "Season 4 cast");
  assert.match(read("frontend/pages/details.js"), /section\.kind === "gallery"\s*\? `<div class="detail-gallery">\$\{rows\.map/);
  const credit = profile.sections.find(section => /^Movies/.test(section.title)).items[0];
  assert.equal(credit.ref.id, "/m/station_agent");
  assert.equal(credit.meta, "2003 · 94%");
  assert.equal(credit.image, "https://resizing.flixster.com/poster-sa.jpg", "placeholder art is replaced by the real poster when the page has one");
  assert.equal(profile.sections.find(section => /^Movies/.test(section.title)).items[1].image, "", "no placeholder logo when there is no poster");
  assert.equal(profile.sections[0].kind, "gallery", "photos come before the credits");
  const details = read("frontend/pages/details.js");
  assert.match(details, /filter\(section => section\.kind !== "gallery"\)\.reduce/);
  assert.match(details, /isPhotos && refPage > 0/);
  assert.match(read("frontend/app.js"), /"rt-celebrity": "rottentomatoes"/);
});

test("IMDb titles keep IMDb profile links for cast the catalogue enriches, with the catalogue profile as fallback", () => {
  const controller = read("frontend/backend/features/show-detail-controller.js");
  assert.match(controller, /Keep IMDb's own profile link for everyone IMDb lists/);
  assert.match(controller, /extra: \{ \.\.\.\(imdbRow\.ref\.extra \|\| \{\}\), \.\.\.\(row\.ref\?\.id \? \{ alt: row\.ref \} : \{\}\) \}/);
  assert.match(controller, /if \(ref\.extra\?\.alt\?\.id\) \{ try \{ const alt = await loadRef/);
  assert.match(controller, /source: `IMDb \(via \$\{alt\.source \|\| "catalogue"\}\)`/);
});

test("OMDb cast and crew open profiles resolved by name (TVmaze, or TMDB when a key is saved)", async () => {
  const calls = [];
  const makeController = tmdb => {
    const window = { SplitAppDiscovery: { encode: v => encodeURIComponent(String(v ?? "")), loadCustomDetails: async () => null, sourceText: async () => "", tvdbGet: async () => ({}),
      tmdbGet: async endpoint => { calls.push(endpoint); return endpoint.startsWith("/search/person") ? { results: [{ id: 9, name: "Emilia Clarke" }] } : { id: 9, name: "Emilia Clarke", biography: "Actor.", combined_credits: {}, images: {}, external_ids: {} }; },
      requestJson: async url => {
        calls.push(String(url));
        const target = new URL(String(url));
        if (target.hostname === "www.omdbapi.com") return { Response: "True", Title: "Game of Thrones", imdbID: "tt0944947", Type: "series", Year: "2011", Actors: "Emilia Clarke, Kit Harington", Director: "N/A", Writer: "David Benioff" };
        if (target.pathname === "/search/people") return [{ score: 1, person: { id: 77, name: "Emilia Clarke" } }];
        if (target.pathname === "/people/77") return { id: 77, name: "Emilia Clarke", country: { name: "UK" }, url: "https://www.tvmaze.com/people/77" };
        return [];
      } } };
    const context = vm.createContext({ window, URL, URLSearchParams, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout });
    vm.runInContext(read("frontend/backend/features/metadata.js"), context);
    vm.runInContext(read("frontend/backend/features/show-detail-controller.js"), context);
    return { controller: window.SplitAppDetailController, settings: { apiKeys: { omdb: "k", ...(tmdb ? { tmdb: "t" } : {}) } } };
  };
  const { controller, settings } = makeController(false);
  const title = await controller.load({ metadataSource: "omdb", category: "series", providerId: "tt0944947", title: "Game of Thrones" }, settings);
  const cast = title.sections.find(section => section.title === "Cast").items[0];
  assert.equal(cast.ref.id, "omdb-person:Emilia%20Clarke");
  const staff = title.sections.find(section => section.title === "Staff").items.find(row => row.title === "David Benioff");
  assert.equal(staff.ref.extra.role, "Writer");
  const viaTvmaze = await controller.loadRef(JSON.parse(JSON.stringify(cast.ref)), settings);
  assert.equal(viaTvmaze.source, "OMDb (via TVmaze)");
  assert.equal(viaTvmaze.title, "Emilia Clarke");
  const withKey = makeController(true);
  const viaTmdb = await withKey.controller.loadRef(JSON.parse(JSON.stringify(cast.ref)), withKey.settings);
  assert.equal(viaTmdb.source, "OMDb (via TMDB)");
  assert.ok(calls.some(call => String(call).startsWith("/search/person")));
});

test("people on an IMDb title opened through the catalogue still resolve to their IMDb profile", async () => {
  const window = { SplitAppDiscovery: { encode: v => encodeURIComponent(String(v ?? "")), loadCustomDetails: async () => null, tmdbGet: async () => ({}), tvdbGet: async () => ({}),
    sourceText: async () => { const error = new Error("blocked"); error.status = 403; throw error; },
    requestJson: async url => {
      const target = new URL(String(url));
      if (target.hostname === "v2.sg.media-imdb.com") return { d: [{ id: "tt1", l: "Peter Dinklage" }, { id: "nm0227759", l: "Peter Dinklage" }] };
      if (target.pathname === "/people/14072") return { id: 14072, name: "Peter Dinklage", url: "https://www.tvmaze.com/people/14072" };
      return [];
    } } };
  const context = vm.createContext({ window, URL, URLSearchParams, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout });
  vm.runInContext(read("frontend/backend/features/metadata.js"), context);
  vm.runInContext(read("frontend/backend/features/show-detail-controller.js"), context);
  const profile = await window.SplitAppDetailController.loadRef({ type: "person", id: 14072, title: "Peter Dinklage", extra: { via: "imdb" } }, {});
  assert.equal(profile.source, "IMDb (via TVmaze)");
  assert.equal(profile.url, "https://www.imdb.com/name/nm0227759/");
  assert.equal(profile.title, "Peter Dinklage");
});

test("grouped Shows/Movies order is In Progress, On Hold, Completed, Dropped, Watchlist", () => {
  const window = loadPages(["frontend/pages/profile.js"], { SplitAppLibrary: { episodeInfo: () => null } });
  const statuses = ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"];
  const config = { categories: [{ key: "series", label: "TV series", singular: "TV series", unit: "episodes", statuses }, { key: "movie", label: "Movies", singular: "Movie", unit: "minutes", statuses }] };
  const items = statuses.map((status, index) => ({ id: String(index), title: `${status} show`, category: "series", status, createdAt: index, updatedAt: index }));
  const html = window.SplitAppPages.series({ items, esc, config, roles: { queued: "Watchlist", active: "In Progress", hold: "On Hold", dropped: "Dropped", done: "Completed" }, profileStatusGroups: true, profileStatusFilter: "all", category: key => config.categories.find(row => row.key === key), labelCategory: key => key, imageMarkup: () => "", prefs: {} });
  const order = [...html.matchAll(/<section class="profile-status-group"><h3>([^<]+)<\/h3>/g)].map(match => match[1]);
  assert.deepEqual(order, ["In Progress", "On Hold", "Completed", "Dropped", "Watchlist"]);
});
