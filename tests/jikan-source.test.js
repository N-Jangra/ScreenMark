"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "../frontend/backend/features", file), "utf8");
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

// Fixtures follow the Jikan v4 response shapes (api.jikan.moe is unreachable from CI, so the live API cannot be probed here).
const images = { jpg: { image_url: "https://cdn.myanimelist.net/a.jpg", large_image_url: "https://cdn.myanimelist.net/a-l.jpg" }, webp: { image_url: "https://cdn.myanimelist.net/a.webp", large_image_url: "https://cdn.myanimelist.net/a-l.webp" } };
const anime = { mal_id: 1, url: "https://myanimelist.net/anime/1", title: "Cowboy Bebop", title_english: "Cowboy Bebop", type: "TV", episodes: 26, status: "Finished Airing", aired: { from: "1998-04-03T00:00:00+00:00", string: "Apr 3, 1998 to Apr 24, 1999" }, duration: "24 min per ep", score: 8.75, rank: 46, year: 1998, season: "spring", synopsis: "In the year 2071...", images, genres: [{ name: "Action" }], themes: [{ name: "Space" }], studios: [{ name: "Sunrise" }], producers: [], rating: "R - 17+" };

function fetchFor(calls, { down = false } = {}) {
  return async url => {
    const target = new URL(String(url)); calls.push(target.pathname + target.search);
    if (down) throw new TypeError("fetch failed");
    const p = target.pathname;
    if (p === "/v4/anime" ) return json({ data: [{ ...anime }, { ...anime, mal_id: 5, title: "Cowboy Bebop: The Movie", type: "Movie" }] });
    if (p === "/v4/anime/1/full") return json({ data: anime });
    if (p === "/v4/anime/1/characters") return json({ data: [{ role: "Main", character: { mal_id: 3, name: "Spike Spiegel", url: "https://myanimelist.net/character/3", images }, voice_actors: [{ language: "Japanese", person: { mal_id: 11, name: "Yamadera, Kouichi", images, url: "https://myanimelist.net/people/11" } }] }] });
    if (p === "/v4/anime/1/staff") return json({ data: [{ positions: ["Director"], person: { mal_id: 21, name: "Watanabe, Shinichiro", images, url: "https://myanimelist.net/people/21" } }] });
    if (p === "/v4/anime/1/pictures") return json({ data: [{ jpg: { large_image_url: "https://cdn.myanimelist.net/p1.jpg" }, webp: { large_image_url: "https://cdn.myanimelist.net/p1.webp" } }] });
    if (p === "/v4/anime/1/recommendations") return json({ data: [{ entry: { mal_id: 205, title: "Samurai Champloo", images } }] });
    if (p === "/v4/anime/1/episodes") return json({ data: [{ mal_id: 1, title: "Asteroid Blues", aired: "1998-04-03T00:00:00+00:00", score: 4.3 }, { mal_id: 2, title: "Stray Dog Strut", aired: "1998-04-10T00:00:00+00:00", score: 4.1 }], pagination: { has_next_page: false } });
    if (p === "/v4/people/11/full") return json({ data: { mal_id: 11, name: "Yamadera, Kouichi", url: "https://myanimelist.net/people/11", images, about: "Voice actor.", voices: [{ role: "Main", character: { mal_id: 3, name: "Spike Spiegel", images }, anime: { mal_id: 1, title: "Cowboy Bebop", images } }], anime: [] } });
    if (p === "/v4/characters/3/full") return json({ data: { mal_id: 3, name: "Spike Spiegel", url: "https://myanimelist.net/character/3", images, about: "A bounty hunter.", anime: [{ role: "Main", anime: { mal_id: 1, title: "Cowboy Bebop", images } }], voices: [{ language: "Japanese", person: { mal_id: 11, name: "Yamadera, Kouichi", images } }] } });
    if (p === "/v4/anime/1/episodes/1") return json({ data: { mal_id: 1, title: "Asteroid Blues", synopsis: "Spike and Jet chase a bounty.", aired: "1998-04-03T00:00:00+00:00", score: 4.3, duration: 1440 } });
    return json({ data: null }, 404);
  };
}

function load(fetchImpl) {
  const window = {};
  const ctx = vm.createContext({ window, location: { protocol: "https:", hostname: "t.test", href: "https://t.test/" }, fetch: fetchImpl, URL, URLSearchParams, Headers, Response, Blob, TextDecoder, AbortController, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, console, localStorage: { getItem: () => null, setItem() {} } });
  for (const file of ["metadata.js", "discover.js", "show-detail-controller.js", "show-detail.js"]) vm.runInContext(read(file), ctx, { filename: file });
  return window;
}
const settings = { metadataSources: { jikan: true }, apiKeys: {}, sourceOptions: {}, noCache: true };

test("Jikan search maps results and keeps movies out of the series tab", async () => {
  const calls = []; const window = load(fetchFor(calls));
  const series = await window.SplitAppDiscovery.searchSource("bebop", "series", settings, "jikan");
  assert.deepEqual(Array.from(series.map(row => row.title)), ["Cowboy Bebop"]);
  assert.equal(series[0].providerId, "1");
  assert.ok(!calls.some(call => call.includes("type=tv")), "ONA/OVA releases are not excluded");
  const movies = await window.SplitAppDiscovery.searchSource("bebop", "movie", settings, "jikan");
  assert.ok(movies.length >= 1);
  assert.ok(calls.some(call => call.includes("type=movie")));
});

test("Jikan details load overview, rating, runtime, cast, characters, staff, pictures, episodes, ratings and suggestions", async () => {
  const window = load(fetchFor([]));
  const d = await window.SplitAppDetails.load({ metadataSource: "jikan", providerId: "1", category: "series", title: "Cowboy Bebop" }, settings);
  assert.equal(d.title, "Cowboy Bebop");
  assert.equal(d.rating, 8.75);
  assert.equal(d.facts.runtimeMinutes, 24);
  assert.equal(d.facts.episodeCount, 26);
  const kinds = Object.fromEntries(d.sections.map(section => [section.title.replace(/ \(\d+\)$/, ""), section.items.length]));
  assert.equal(kinds.Cast, 1); assert.equal(kinds.Characters, 1); assert.equal(kinds.Staff, 1); assert.equal(kinds.Pictures, 1);
  assert.equal(kinds["Episode guide"], 2); assert.equal(kinds["Episode ratings"], 2); assert.equal(kinds["You might also like"], 1);
  assert.ok(d.sections.find(section => section.kind === "episodes").items.every(row => row.image !== images.webp.large_image_url), "series cover must not be copied onto episode records");
  assert.equal(d.facts.episodeRatings.length, 2);
});

test("Jikan person, character and episode pages load", async () => {
  const window = load(fetchFor([]));
  const person = await window.SplitAppDetails.loadRef({ type: "person", id: "jikan-person:11", title: "Yamadera" }, settings);
  assert.equal(person.type, "person"); assert.ok(person.sections.some(section => section.items.length));
  const character = await window.SplitAppDetails.loadRef({ type: "character", id: "jikan-character:3", title: "Spike", extra: { source: "jikan" } }, settings);
  assert.equal(character.title, "Spike Spiegel"); assert.ok(character.sections.some(section => /Voice actors/.test(section.title)));
  const episode = await window.SplitAppDetails.loadRef({ type: "episode", id: 1, title: "Asteroid Blues", extra: { source: "jikan", animeId: "1", number: 1, series: "Cowboy Bebop", category: "series" } }, settings);
  assert.equal(episode.title, "Asteroid Blues"); assert.match(episode.description, /bounty/);
});

test("while api.jikan.moe is unreachable, search and details come from AniList by MAL id and the breaker stops repeated waits", async () => {
  const calls = [];
  const anilistMedia = { id: 16, idMal: 1, title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop" }, coverImage: { large: "https://s4.anilist.co/a.jpg" }, startDate: { year: 1998 }, averageScore: 86, episodes: 26, format: "TV", genres: ["Action"], siteUrl: "https://anilist.co/anime/16" };
  const handler = async (url, options = {}) => {
    const target = new URL(String(url)); calls.push(target.hostname);
    if (target.hostname === "api.jikan.moe") throw new TypeError("fetch failed");
    if (target.hostname === "graphql.anilist.co") {
      const body = JSON.parse(options.body || "{}");
      if (/idMal:\$m/.test(body.query)) return json({ data: { Media: { id: 16 } } });
      if (/search:/.test(body.query)) return json({ data: { Page: { media: [anilistMedia, { ...anilistMedia, id: 99, idMal: null, title: { romaji: "No MAL id" } }] } } });
      return json({ data: { Media: { ...anilistMedia, description: "In 2071", bannerImage: "", duration: 24, status: "FINISHED", genres: ["Action"], characters: { edges: [] }, staff: { edges: [] }, recommendations: { nodes: [] }, relations: { edges: [] } } } });
    }
    return json({}, 404);
  };
  const window = load(handler);
  const rows = await window.SplitAppDiscovery.searchSource("bebop", "series", settings && { ...settings, metadataSources: { jikan: true, anilist: true } }, "jikan");
  assert.equal(rows.length, 1, "only titles with a MyAnimeList id are offered");
  assert.equal(rows[0].source, "jikan"); assert.equal(rows[0].providerId, "1"); assert.equal(rows[0].via, "AniList");
  const before = calls.filter(host => host === "api.jikan.moe").length;
  const again = await window.SplitAppDiscovery.searchSource("bebop", "series", { ...settings, metadataSources: { jikan: true, anilist: true } }, "jikan");
  assert.equal(again.length, 1);
  assert.equal(calls.filter(host => host === "api.jikan.moe").length, before, "the breaker keeps later calls off the dead host");
  const d = await window.SplitAppDetails.load({ metadataSource: "jikan", providerId: "1", category: "series", title: "Cowboy Bebop" }, { ...settings, metadataSources: { jikan: true, anilist: true } });
  assert.equal(d.title, "Cowboy Bebop");
  assert.equal(d.source, "MyAnimeList (via AniList)");
  assert.ok(d.links.some(link => link.label === "MyAnimeList" && link.url.endsWith("/anime/1")));
});

test("Jikan fails with a clear message when the host is down and AniList does not know the title either", async () => {
  const window = load(async url => { const target = new URL(String(url)); if (target.hostname === "api.jikan.moe") throw new TypeError("fetch failed"); return json({ data: { Media: null } }); });
  await assert.rejects(window.SplitAppDetails.load({ metadataSource: "jikan", providerId: "123", category: "series", title: "X" }, { ...settings, metadataSources: { jikan: true, anilist: true } }), /unreachable from this network/);
});
