"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "../frontend/backend/features", file), "utf8");
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

function load(handler, calls = []) {
  const fetchImpl = async (url, options = {}) => { const target = new URL(String(url)); calls.push({ target, options }); return handler(target, options) ?? json({}, 404); };
  const window = {};
  const ctx = vm.createContext({ window, location: { protocol: "https:", hostname: "t.test", href: "https://t.test/" }, fetch: fetchImpl, URL, URLSearchParams, Headers, Response, Blob, TextDecoder, AbortController, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, console, localStorage: { getItem: () => null, setItem() {} } });
  for (const file of ["metadata.js", "sources.js", "discover.js", "show-detail-controller.js", "show-detail.js"]) vm.runInContext(read(file), ctx, { filename: file });
  return window;
}
const base = { apiKeys: { tmdb: "k", tvdb: "k", omdb: "k" }, sourceOptions: {}, noCache: true };
const settings = { ...base, metadataSources: { kitsu: true, tvdb: true, tmdb: true, omdb: true, anilist: true } };

test("Kitsu requests never ask for more than its 20-row page limit", async () => {
  const calls = [];
  const window = load(target => {
    if (target.hostname === "kitsu.io") { const limit = Number(target.searchParams.get("page[limit]")); if (limit > 20) return json({ errors: [{ status: "400" }] }, 400); return json({ data: [{ id: "1", attributes: { canonicalTitle: "Show", posterImage: { large: "https://media.kitsu.app/a.jpg" }, startDate: "2020-01-01" } }] }); }
  }, calls);
  const sections = await window.SplitAppDiscovery.trending("series", settings, "kitsu");
  assert.ok(sections.length && sections.every(section => section.items.length === 1), "trending rows load");
  assert.ok(calls.filter(call => call.target.hostname === "kitsu.io").every(call => Number(call.target.searchParams.get("page[limit]") || 0) <= 20));
});

test("TheTVDB gets Top and New shelves from its filter endpoint and fixes relative artwork", async () => {
  const window = load(target => {
    if (target.pathname.endsWith("/login")) return json({ data: { token: "t" } });
    if (target.pathname === "/v4/movies/filter") return json({ data: [{ id: 231, name: "Titanic", slug: "titanic", image: "/banners/v4/movie/231/posters/a.jpg", score: 5, year: "1997" }] });
    if (target.pathname === "/v4/series/filter") return json({ data: [{ id: 1, name: "Show", slug: "show", image: "https://artworks.thetvdb.com/x.jpg", firstAired: "2016-07-15" }] });
  });
  const movies = await window.SplitAppDiscovery.trending("movie", settings, "tvdb");
  assert.match(movies[0].title, /Top movies/);
  assert.equal(movies[0].items[0].image, "https://artworks.thetvdb.com/banners/v4/movie/231/posters/a.jpg");
  const series = await window.SplitAppDiscovery.trending("series", settings, "tvdb");
  assert.equal(series[0].items[0].year, "2016");
});

test("TheTVDB titles drop a duplicated year suffix", async () => {
  const window = load(target => {
    if (target.pathname.endsWith("/login")) return json({ data: { token: "t" } });
    if (target.pathname === "/v4/search") return json({ data: [{ tvdb_id: "1", name: "ONE PIECE (2023)", year: "2023", image_url: "https://artworks.thetvdb.com/a.jpg" }] });
  });
  const rows = await window.SplitAppDiscovery.searchSource("one piece", "series", settings, "tvdb");
  assert.equal(rows[0].title, "ONE PIECE");
});

test("TMDB characters get their own page (played by / appears in) instead of opening the actor", async () => {
  const window = load(target => {
    if (target.pathname === "/3/tv/9") return json({ id: 9, name: "Show", first_air_date: "2008-01-01", overview: "x", poster_path: "/p.jpg", seasons: [], credits: { cast: [{ id: 5, name: "Actor", character: "Hero", profile_path: "/a.jpg" }], crew: [] }, genres: [], episode_run_time: [], last_episode_to_air: { runtime: 47 } });
  });
  const d = await window.SplitAppDetails.load({ metadataSource: "tmdb", providerId: "9", category: "series", title: "Show" }, settings);
  const hero = d.sections.find(section => section.title === "Characters").items[0];
  assert.equal(hero.ref.type, "character");
  assert.equal(d.facts.runtimeMinutes, 47, "series runtime falls back to the latest episode");
  const page = await window.SplitAppDetails.loadRef(hero.ref, settings);
  assert.equal(page.title, "Hero");
  assert.equal(page.sections[0].title, "Played by");
  assert.equal(page.sections[0].items[0].ref.id, "tmdb:5");
});

test("ratings tables with no ratings are dropped and covers become a Posters gallery", async () => {
  const window = load(target => {
    if (target.hostname === "www.omdbapi.com") return json({ Response: "True", Title: "Film", Year: "2010", imdbID: "tt1", Type: "movie", Plot: "p", Poster: "https://m.media-amazon.com/p.jpg", imdbRating: "8.0", Actors: "A, B", Runtime: "100 min", Genre: "Drama" });
  });
  const d = await window.SplitAppDetails.load({ metadataSource: "omdb", providerId: "tt1", category: "movie", title: "Film" }, settings);
  assert.ok(d.sections.some(section => section.kind === "gallery" && section.title === "Posters"));
  assert.ok(!d.sections.some(section => section.kind === "ratings"));
});

test("TheTVDB movies show no fake rating and series leave specials out of the episode guide", async () => {
  const window = load(target => {
    if (target.pathname.endsWith("/login")) return json({ data: { token: "t" } });
    if (target.pathname === "/v4/series/1/extended") return json({ data: { id: 1, name: "S", score: 999999, year: "2008", seasons: [], characters: [{ peopleId: 1, personName: "Dir", peopleType: "Director" }, { peopleId: 2, personName: "Act", name: "Role", peopleType: "Actor" }], episodes: [{ id: 1, seasonNumber: 0, number: 1, name: "Special" }, { id: 2, seasonNumber: 1, number: 1, name: "Pilot" }] } });
  });
  const d = await window.SplitAppDetails.load({ metadataSource: "tvdb", providerId: "1", category: "series", title: "S" }, settings);
  assert.equal(d.rating, 0);
  assert.equal(d.sections.find(section => /Episode guide/.test(section.title)).items.length, 1);
  assert.equal(d.sections.find(section => section.title === "Cast").items[0].title, "Act");
  assert.equal(d.sections.find(section => section.title === "Staff").items[0].title, "Dir");
});

test("redirects are refused unless a caller opts in (TVmaze's IMDb lookup)", async () => {
  const seen = [];
  const window = load((target, options) => { seen.push(options.redirect); return json({ id: 1 }); });
  await window.SplitAppDiscovery.requestJson("https://api.tvmaze.com/lookup/shows?imdb=tt1", { noCache: true });
  await window.SplitAppDiscovery.requestJson("https://api.tvmaze.com/lookup/shows?imdb=tt2", { noCache: true, followRedirect: true });
  assert.deepEqual(seen, ["error", "follow"]);
});
