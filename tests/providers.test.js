"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const metadataSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/features/metadata.js"), "utf8");
const discoverySource = fs.readFileSync(path.join(__dirname, "../frontend/backend/features/discover.js"), "utf8");

function makeDiscovery(fetchImpl) {
  const window = {};
  const context = vm.createContext({
    window,
    location: { protocol: "https:", hostname: "screenmark.test", href: "https://screenmark.test/" },
    fetch: fetchImpl,
    URL, URLSearchParams, Headers, Response, Blob, TextDecoder, AbortController,
    Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout
  });
  vm.runInContext(metadataSource, context, { filename: "metadata.js" });
  vm.runInContext(discoverySource, context, { filename: "discover.js" });
  return window.SplitAppDiscovery;
}

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
}

test("each built-in metadata source calls its search endpoint and maps one result", async () => {
  const requests = [];
  const fetchMock = async (url, options = {}) => {
    const target = new URL(String(url));
    requests.push({ target, options });
    if (target.hostname === "api.tvmaze.com") return jsonResponse([{ show: { id: 10, name: "Test Series", type: "Scripted", premiered: "2020-01-01", genres: ["Drama"] } }]);
    if (target.hostname === "graphql.anilist.co") return jsonResponse({ data: { Page: { media: [{ id: 20, title: { english: "Test Anime" }, format: "TV", startDate: { year: 2021 }, episodes: 12 }] } } });
    if (target.hostname === "api.themoviedb.org") return jsonResponse({ results: [{ id: 30, title: "Test TMDB", release_date: "2022-02-03", poster_path: "/poster.jpg" }] });
    if (target.hostname === "api4.thetvdb.com" && target.pathname.endsWith("/login")) return jsonResponse({ data: { token: "tvdb-session" } });
    if (target.hostname === "api4.thetvdb.com") return jsonResponse({ data: [{ tvdb_id: "40", name: "Test TVDB", year: "2023" }] });
    if (target.hostname === "www.omdbapi.com") return jsonResponse({ Response: "True", Search: [{ imdbID: "tt0000050", Title: "Test OMDb", Year: "2024", Type: "movie" }] });
    if (target.hostname === "v3.sg.media-imdb.com") return jsonResponse({ d: [{ id: "tt0000060", l: "Test IMDb", qid: "movie", y: 2025 }] });
    if (target.hostname === "www.rottentomatoes.com") return new Response('<search-page-result type="movie"><search-page-media-row tomatometer-score="92" release-year="2020"><a href="https://www.rottentomatoes.com/m/test_film" data-qa="info-name">Test RT Film</a><img src="https://img.example/poster.jpg"></search-page-media-row></search-page-result>', { headers: { "content-type": "text/html" } });
    throw new Error(`Unexpected provider endpoint: ${target.href}`);
  };
  const discovery = makeDiscovery(fetchMock);
  const settings = { apiKeys: { tmdb: "tmdb-test-key", tvdb: "tvdb-test-key", omdb: "omdb-test-key" } };
  const cases = [
    ["tvmaze", "series", "Test Series", "10"],
    ["anilist", "series", "Test Anime", "20"],
    ["tmdb", "movie", "Test TMDB", "30"],
    ["tvdb", "movie", "Test TVDB", "40"],
    ["omdb", "movie", "Test OMDb", "tt0000050"],
    ["imdb", "movie", "Test IMDb", "tt0000060"],
    ["rottentomatoes", "movie", "Test RT Film", "/m/test_film"]
  ];
  for (const [source, category, title, providerId] of cases) {
    const rows = await discovery.searchSource("The Test", category, settings, source);
    assert.equal(rows.length, 1, source);
    assert.equal(rows[0].title, title, source);
    assert.equal(String(rows[0].providerId), providerId, source);
    assert.equal(rows[0].source, source, source);
  }

  const tvmaze = requests.find(row => row.target.hostname === "api.tvmaze.com");
  assert.equal(tvmaze.target.pathname, "/search/shows");
  assert.equal(tvmaze.target.searchParams.get("q"), "The Test");
  const anilist = requests.find(row => row.target.hostname === "graphql.anilist.co");
  assert.equal(anilist.options.method, "POST");
  assert.match(JSON.parse(anilist.options.body).query, /Page\(perPage:15\)/);
  const tmdb = requests.find(row => row.target.hostname === "api.themoviedb.org");
  assert.equal(tmdb.target.pathname, "/3/search/movie");
  assert.equal(tmdb.target.searchParams.get("api_key"), "tmdb-test-key");
  const tvdbSearch = requests.find(row => row.target.hostname === "api4.thetvdb.com" && row.target.pathname.endsWith("/search"));
  assert.equal(tvdbSearch.options.headers.Authorization, "Bearer tvdb-session");
  const omdb = requests.find(row => row.target.hostname === "www.omdbapi.com");
  assert.equal(omdb.target.searchParams.get("apikey"), "omdb-test-key");
  const imdb = requests.find(row => row.target.hostname === "v3.sg.media-imdb.com");
  assert.match(imdb.target.pathname, /\/suggestion\/t\/the%20test\.json$/);
  assert.equal(requests.find(row => row.target.hostname === "www.rottentomatoes.com").target.pathname, "/search");
});

test("custom source search and detail use the configured endpoint and field mapping", async () => {
  const seen = [];
  const discovery = makeDiscovery(async (url, options = {}) => {
    const target = new URL(String(url)); seen.push({ target, options });
    if (target.pathname === "/search") return jsonResponse({ results: [{ id: "custom-1", name: "Custom Title", released: "2022-03-04", poster: "https://images.example/p.jpg", summary: "Mapped description" }] });
    if (target.pathname === "/detail/custom-1") return jsonResponse({ record: { name: "Custom Title", summary: "Custom details", cast: ["A Person"] } });
    throw new Error(`Unexpected custom endpoint ${target.href}`);
  });
  const config = {
    id: "catalog", name: "Custom Catalog", categories: ["movie"], apiKey: "key 1",
    searchUrl: "https://custom.example/search?q={query}&key={apikey}", resultsPath: "results",
    map: { id: "id", title: "name", year: "released", image: "poster", description: "summary" },
    detailUrl: "https://custom.example/detail/{id}", detailRoot: "record"
  };
  const rows = await discovery.testCustomSource(config, "A title");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, "custom:catalog");
  assert.equal(rows[0].title, "Custom Title");
  assert.equal(rows[0].year, "2022");
  assert.equal(seen[0].target.searchParams.get("q"), "A title");
  assert.equal(seen[0].target.searchParams.get("key"), "key 1");

  const detail = await discovery.loadCustomDetails(config, { providerId: "custom-1", title: "Custom Title" });
  assert.equal(detail.root.name, "Custom Title");
  assert.equal(detail.pickText(detail.root, "summary"), "Custom details");
  assert.deepEqual(detail.pickList(detail.root, "cast"), ["A Person"]);
});

test("metadata request helper enforces HTTPS, credential-free URLs, JSON validity and response limits", async () => {
  let response = jsonResponse({ ok: true });
  let requested;
  const discovery = makeDiscovery(async (url, options) => { requested = { url: String(url), options }; return response; });
  await assert.rejects(discovery.requestJson("http://provider.example/data", { noCache: true }), /must use HTTPS/);
  await assert.rejects(discovery.requestJson("https://user:pass@provider.example/data", { noCache: true }), /embedded credentials/);

  assert.deepEqual(await discovery.requestJson("https://provider.example/data", { noCache: true }), { ok: true });
  assert.equal(requested.options.redirect, "error");
  assert.equal(requested.options.referrerPolicy, "no-referrer");

  response = new Response("not json", { headers: { "content-type": "application/json" } });
  await assert.rejects(discovery.requestJson("https://provider.example/bad", { noCache: true }), /invalid JSON/);
  response = new Response("{}", { headers: { "content-type": "application/json", "content-length": String(12 * 1024 * 1024 + 1) } });
  await assert.rejects(discovery.requestJson("https://provider.example/large", { noCache: true }), /12 MB limit/);
});

test("identical in-flight requests share one fetch and transient failures retry once", async () => {
  let calls = 0, flaky = 0;
  const discovery = makeDiscovery(async url => {
    if (String(url).includes("flaky")) { flaky++; return flaky === 1 ? jsonResponse({}, 503) : jsonResponse({ ok: flaky }); }
    calls++; await new Promise(resolve => setTimeout(resolve, 20)); return jsonResponse({ n: 1 });
  });
  const [a, b] = await Promise.all([discovery.requestJson("https://provider.example/shared"), discovery.requestJson("https://provider.example/shared")]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  await discovery.requestJson("https://provider.example/shared");
  assert.equal(calls, 2, "finished requests are not kept in the share map");
  assert.deepEqual(await discovery.requestJson("https://provider.example/flaky", { noCache: true }), { ok: 2 });
  assert.equal(flaky, 2);
  flaky = 0;
  await assert.rejects(discovery.requestJson("https://provider.example/flaky-post", { method: "POST", body: "{}", noCache: true }), /503/);
});
