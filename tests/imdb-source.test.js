"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "../frontend/backend/features", file), "utf8");
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const html = body => new Response(body, { status: 200, headers: { "content-type": "text/html" } });

const ld = { "@type": "TVSeries", name: "Example Show", datePublished: "2020-01-01", description: "An example.", image: "https://m.media-amazon.com/p.jpg", aggregateRating: { ratingValue: 8.4, ratingCount: 1000 }, genre: ["Drama"], actor: [{ "@type": "Person", name: "Only One", url: "https://www.imdb.com/name/nm1/" }] };
const page = `<html><script type="application/ld+json">${JSON.stringify(ld)}</script></html>`;
const show = { id: 77, name: "Example Show", premiered: "2020-01-01", url: "https://www.tvmaze.com/shows/77", externals: { imdb: "tt123" }, image: { medium: "https://static.tvmaze.com/a.jpg", original: "https://static.tvmaze.com/a-o.jpg" }, genres: ["Drama"], runtime: 45, summary: "<p>An example.</p>", rating: { average: 8.1 }, _embedded: { episodes: [{ id: 1, season: 1, number: 1, name: "Pilot", airdate: "2020-01-01", runtime: 45, rating: { average: 8 }, summary: "<p>First.</p>", externals: { imdb: "tt900" } }], seasons: [{ number: 1, name: "Season 1" }], cast: [{ person: { id: 1, name: "Actor One", image: {} }, character: { id: 11, name: "Hero", image: {} } }, { person: { id: 2, name: "Actor Two", image: {} }, character: { id: 12, name: "Sidekick", image: {} } }], crew: [], akas: [], images: [] } };

function load({ blocked = false, calls = [] } = {}) {
  const fetchImpl = async url => {
    const target = new URL(String(url)); calls.push(target.hostname + target.pathname + target.search);
    if (target.hostname === "www.imdb.com") return blocked ? new Response("denied", { status: 403 }) : html(page);
    if (target.hostname === "api.tvmaze.com" && target.pathname === "/lookup/shows") return json(show); // fetch follows the 301 in real use
    if (target.hostname === "api.tvmaze.com" && /^\/shows\/77/.test(target.pathname)) return json(show);
    if (target.hostname === "api.tvmaze.com" && target.pathname === "/search/shows") return json([{ show: { ...show, id: 999, name: "Example Show" } }]);
    return json({}, 404);
  };
  const window = {};
  const ctx = vm.createContext({ window, location: { protocol: "https:", hostname: "t.test", href: "https://t.test/" }, fetch: fetchImpl, URL, URLSearchParams, Headers, Response, Blob, TextDecoder, AbortController, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, console, localStorage: { getItem: () => null, setItem() {} } });
  for (const file of ["metadata.js", "discover.js", "show-detail-controller.js", "show-detail.js"]) vm.runInContext(read(file), ctx, { filename: file });
  return window;
}
const settings = { metadataSources: { imdb: true, tvmaze: true }, apiKeys: {}, sourceOptions: {}, noCache: true };
const item = { metadataSource: "imdb", providerId: "tt123", category: "series", title: "Example Show" };
const names = d => Object.fromEntries(d.sections.map(section => [section.title.replace(/ \(\d+\)$/, ""), section.items.length]));

test("IMDb details use the exact TVmaze match for its IMDb id and fill the full cast from it", async () => {
  const calls = []; const window = load({ calls });
  const d = await window.SplitAppDetails.load(item, settings);
  assert.equal(d.title, "Example Show");
  assert.equal(d.rating, 8.4, "IMDb keeps its own rating");
  assert.ok(calls.some(call => call.includes("/lookup/shows?imdb=tt123")), "exact id lookup");
  assert.ok(!calls.some(call => call.includes("/search/shows")), "no title search that could pick another show");
  const counts = names(d);
  assert.equal(counts.Cast, 2, "cast replaced by the longer TVmaze cast (was 1)");
  assert.equal(counts.Characters, 2);
  assert.ok(d.sections.find(section => section.title === "Cast").items[0].meta.startsWith("as "), "roles are shown");
  assert.equal(counts["Episode guide"], 1);
});

test("a blocked IMDb page still loads the title from the catalogue with the same IMDb id", async () => {
  const window = load({ blocked: true });
  const d = await window.SplitAppDetails.load(item, settings);
  assert.equal(d.title, "Example Show");
  assert.match(d.source, /IMDb \(via/);
  assert.ok(d.links.some(link => link.label === "IMDb" && link.url.endsWith("/tt123/")));
  assert.equal(names(d).Cast, 2);
});

test("a blocked IMDb episode page falls back to the saved guide data", async () => {
  const window = load({ blocked: true });
  const page = await window.SplitAppDetails.loadRef({ type: "episode", id: "imdb-episode:tt900", title: "Pilot", extra: { source: "imdb", imdbId: "tt900", series: "Example Show", season: 1, number: 1, episode: { airdate: "2020-01-01", runtime: 45, rating: 8, description: "First." } } }, settings);
  assert.equal(page.title, "Pilot");
  assert.equal(page.description, "First.");
  assert.match(page.subtitle, /Example Show · S1E1/);
});
