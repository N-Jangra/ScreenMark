"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const metadataSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/features/metadata.js"), "utf8");
const detailSource = fs.readFileSync(path.join(__dirname, "../frontend/backend/features/show-detail-controller.js"), "utf8");

function makeDetailController({ requestJson: overrideRequestJson } = {}) {
  const calls = [];
  const window = { SplitAppDiscovery: {
    encode: value => encodeURIComponent(String(value ?? "")),
    requestJson: async (url, options = {}) => {
      calls.push({ api: "requestJson", url: String(url), options });
      const target = new URL(String(url));
      const overridden = await overrideRequestJson?.(target, options);
      if (overridden !== undefined) return overridden;
      if (target.hostname === "api.tvmaze.com") return { id: 101, name: "TVmaze Show", type: "Scripted", _embedded: { episodes: [], seasons: [], cast: [], crew: [], images: [] } };
      if (target.hostname === "graphql.anilist.co") return { data: { Media: { id: 202, title: { english: "AniList Film" }, format: "MOVIE", startDate: { year: 2020 }, coverImage: {}, genres: [] } } };
      if (target.hostname === "www.omdbapi.com") return { Title: "OMDb Film", imdbID: "tt0000303", Type: "movie", Year: "2021", Response: "True" };
      throw new Error(`Unexpected JSON detail endpoint ${target.href}`);
    },
    tmdbGet: async (endpoint, settings) => { calls.push({ api: "tmdbGet", url: String(endpoint), settings }); return { id: 303, title: "TMDB Film", release_date: "2022-03-04", genres: [], credits: {}, images: {}, recommendations: {}, external_ids: {} }; },
    tvdbGet: async (endpoint, settings) => { calls.push({ api: "tvdbGet", url: String(endpoint), settings }); return { data: { id: 404, name: "TVDB Film", year: "2023", genres: [], remoteIds: [] } }; },
    sourceText: async (source, url, settings, extra) => {
      calls.push({ api: "sourceText", source, url: String(url), settings, extra });
      const title = source === "imdb" ? "IMDb Film" : "Rotten Tomatoes Film";
      const type = source === "imdb" ? "Movie" : "Movie";
      return `<script type="application/ld+json">${JSON.stringify({ "@type": type, name: title, datePublished: "2024-01-02", aggregateRating: { ratingValue: "8.1", ratingCount: "200" } })}</script>`;
    },
    loadCustomDetails: async () => null
  } };
  const context = vm.createContext({ window, URL, URLSearchParams, Promise, Map, Set, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout });
  vm.runInContext(metadataSource, context, { filename: "metadata.js" });
  vm.runInContext(detailSource, context, { filename: "show-detail-controller.js" });
  return { controller: window.SplitAppDetailController, calls, metadata: window.SplitAppMetadata };
}

test("each built-in metadata source dispatches its title detail endpoint and returns the shared schema", async () => {
  const { controller, calls } = makeDetailController();
  const settings = { background: true, apiKeys: { tmdb: "tmdb-key", tvdb: "tvdb-key", omdb: "omdb-key" } };
  const cases = [
    [{ metadataSource: "tvmaze", category: "series", providerId: "101", title: "TVmaze Show" }, "TVmaze Show", call => call.api === "requestJson" && call.url.includes("api.tvmaze.com/shows/101")],
    [{ metadataSource: "anilist", category: "movie", providerId: "202", title: "AniList Film" }, "AniList Film", call => call.api === "requestJson" && call.url === "https://graphql.anilist.co" && JSON.parse(call.options.body).variables.id === 202],
    [{ metadataSource: "tmdb", category: "movie", providerId: "303", title: "TMDB Film" }, "TMDB Film", call => call.api === "tmdbGet" && call.url.startsWith("/movie/303?")],
    [{ metadataSource: "tvdb", category: "movie", providerId: "404", title: "TVDB Film" }, "TVDB Film", call => call.api === "tvdbGet" && call.url === "/movies/404/extended"],
    [{ metadataSource: "omdb", category: "movie", providerId: "tt0000303", title: "OMDb Film" }, "OMDb Film", call => call.api === "requestJson" && new URL(call.url).searchParams.get("i") === "tt0000303"],
    [{ metadataSource: "imdb", category: "movie", providerId: "tt0000404", title: "IMDb Film" }, "IMDb Film", call => call.api === "sourceText" && call.source === "imdb" && call.url === "https://www.imdb.com/title/tt0000404/"],
    [{ metadataSource: "rottentomatoes", category: "movie", providerId: "/m/rt-film", title: "Rotten Tomatoes Film" }, "Rotten Tomatoes Film", call => call.api === "sourceText" && call.source === "rottentomatoes" && call.url === "https://www.rottentomatoes.com/m/rt-film"]
  ];
  for (const [item, title, endpoint] of cases) {
    const result = await controller.load(item, settings);
    assert.equal(result.title, title, item.metadataSource);
    assert.equal(result.schemaVersion, 2, item.metadataSource);
    assert.equal(result.source, item.metadataSource, item.metadataSource);
    assert.ok(calls.some(endpoint), `expected ${item.metadataSource} detail endpoint call`);
  }
});

test("library background sync keeps the TVmaze episode guide without loading recommendation pages", async () => {
  const { controller, calls } = makeDetailController({ requestJson: async target => {
    if (target.hostname !== "api.tvmaze.com") return undefined;
    if (target.pathname.startsWith("/shows/101")) return { id: 101, name: "TVmaze Show", premiered: "2024-01-01", genres: ["Drama"], image: { medium: "https://images.example/poster.jpg" }, _embedded: {
      episodes: [{ id: 7001, season: 1, number: 1, name: "Pilot", image: { medium: "https://images.example/episode-1.jpg" } }],
      seasons: [{ number: 1, name: "Season 1" }], cast: [], crew: [], akas: [], images: []
    } };
    if (target.pathname === "/shows" && target.searchParams.has("page")) return [];
    return undefined;
  } });
  const loaded = await controller.load({ metadataSource: "tvmaze", category: "series", providerId: "101", title: "TVmaze Show" }, { librarySync: true });
  const guide = loaded.sections.find(section => section.kind === "episodes");
  assert.equal(guide.items[0].image, "https://images.example/episode-1.jpg");
  assert.equal(calls.filter(call => call.url.includes("/shows?page=")).length, 0, "background sync skips four optional catalogue pages");
});

test("AniList series loads its episode guide from the MAL cross-reference and opens episodes in app", async () => {
  let failedFirstPageOnce = false;
  const { controller, calls } = makeDetailController({ requestJson: async (target, options) => {
    if (target.hostname === "graphql.anilist.co") return { data: { Media: { id: 202, idMal: 5114, title: { english: "Fullmetal Alchemist: Brotherhood", romaji: "Hagane no Renkinjutsushi" }, synonyms: [], format: "TV", episodes: 101, startDate: { year: 2009 }, coverImage: {}, genres: [], siteUrl: "https://anilist.co/anime/202" } } };
    if (target.hostname === "api.tenrai.org" && /\/episodes\?/.test(target.pathname + target.search)) {
      const page = target.searchParams.get("page");
      if (page === "1" && !failedFirstPageOnce) { failedFirstPageOnce = true; throw Object.assign(new Error("Temporary provider error"), { status: 503 }); }
      return page === "1"
        ? { data: [{ mal_id: 1, title: "To the Finals", aired: { from: "2009-04-05T00:00:00+00:00" }, duration: 1440, images: { jpg: { image_url: "https://images.example/episode.jpg" } }, score: 8.9, synopsis: "The journey begins." }], pagination: { has_next_page: true } }
        : { data: [{ mal_id: 2, title: "The First Day", synopsis: "The next episode." }], pagination: { has_next_page: false } };
    }
    if (target.hostname === "api.tenrai.org") return { data: { mal_id: 1, title: "To the Finals", aired: { from: "2009-04-05T00:00:00+00:00" }, duration: 1440, images: { jpg: { image_url: "https://images.example/episode.jpg" } }, score: 8.9, synopsis: "Full episode synopsis." } };
    return undefined;
  } });
  const loaded = await controller.load({ metadataSource: "anilist", category: "series", providerId: "202", title: "FMA Brotherhood" });
  const guide = loaded.sections.find(section => section.kind === "episodes");
  assert.ok(guide, "episode guide is present");
  assert.equal(guide.items.length, 2);
  assert.equal(guide.items[0].title, "To the Finals");
  assert.equal(guide.items[0].number, 1);
  assert.equal(guide.items[0].runtime, 24);
  assert.equal(guide.items[0].image, "https://images.example/episode.jpg");
  assert.equal(guide.items[1].title, "The First Day");
  assert.ok(calls.some(call => call.url.includes("api.tenrai.org") && call.url.endsWith("page=2")), "later episode pages are loaded");
  assert.equal(calls.filter(call => call.url.includes("api.tenrai.org") && call.url.endsWith("page=1")).length, 2, "transient 503 is retried once");
  assert.equal(guide.items[0].ref.extra.source, "tenrai");
  assert.match(calls.find(call => call.url.includes("api.tenrai.org"))?.url || "", /anime\/5114\/episodes\?page=1/);
  const episode = await controller.loadRef(guide.items[0].ref);
  assert.equal(episode.type, "episode");
  assert.equal(episode.title, "To the Finals");
  assert.equal(episode.description, "Full episode synopsis.");
  assert.equal(episode.image, "https://images.example/episode.jpg");
  assert.ok(episode.facts.some(([label, value]) => label === "Runtime" && value === "24 min"));
  assert.ok(episode.sections.some(section => section.title === "Series"));
});

test("AniList TVmaze episode fallback searches alternate titles when MAL episode data is unavailable", async () => {
  const { controller, calls } = makeDetailController({ requestJson: async target => {
    if (target.hostname === "graphql.anilist.co") return { data: { Media: { id: 202, idMal: null, title: { english: "English Anime Title", romaji: "Kaze no Tabi" }, synonyms: ["Wind Journey"], format: "TV", episodes: 2, startDate: { year: 2020 }, coverImage: {}, genres: [] } } };
    if (target.hostname === "api.tvmaze.com" && target.pathname === "/search/shows") {
      if (target.searchParams.get("q") === "Kaze%20no%20Tabi") return [];
      if (target.searchParams.get("q") === "Kaze no Tabi") return [{ show: { id: 991, name: "Kaze no Tabi", premiered: "2020-01-01" } }];
    }
    if (target.hostname === "api.tvmaze.com" && target.pathname === "/shows/991") return { _embedded: { episodes: [{ id: 992, season: 1, number: 1, name: "First Wind" }], seasons: [{ number: 1, name: "Season 1" }] } };
    return undefined;
  } });
  const loaded = await controller.load({ metadataSource: "anilist", category: "series", providerId: "202", title: "English Anime Title" });
  const guide = loaded.sections.find(section => section.kind === "episodes");
  assert.equal(guide?.items[0]?.title, "First Wind");
  assert.ok(calls.some(call => call.url.includes("q=Kaze%20no%20Tabi")), "romaji title was searched");
});

test("Kitsu episode rows keep only episode thumbnails and never substitute the series poster", async () => {
  const { controller } = makeDetailController({ requestJson: async target => {
    if (target.hostname === "api.tvmaze.com" && target.pathname === "/search/shows") return [{ show: { id: 700, name: "Anime Show", premiered: "2020-01-01" } }];
    if (target.hostname === "api.tvmaze.com" && target.pathname === "/shows/700") return { _embedded: { episodes: [
      { season: 1, number: 1, image: { original: "https://tvmaze.test/episode-one.jpg" } },
      { season: 1, number: 2, image: { original: "https://tvmaze.test/episode-two.jpg" } }
    ] } };
    if (target.hostname !== "kitsu.io") return undefined;
    if (target.pathname === "/api/edge/anime/77") return { data: { id: "77", attributes: {
      canonicalTitle: "Anime Show", subtype: "TV", episodeCount: 2,
      posterImage: { large: "https://media.test/series-poster.jpg" }, startDate: "2020-01-01"
    } } };
    if (target.pathname === "/api/edge/anime/77/episodes") return { data: [
      { id: "ep1", attributes: { number: 1, canonicalTitle: "One", thumbnail: {} } },
      { id: "ep2", attributes: { number: 2, canonicalTitle: "Two", thumbnail: { large: "https://media.test/episode-two.jpg" } } }
    ], links: { next: null } };
    if (target.pathname === "/api/edge/anime/77/genres") return { data: [] };
    return undefined;
  } });
  const loaded = await controller.load({ metadataSource: "kitsu", category: "series", providerId: "77", title: "Anime Show" });
  const guide = loaded.sections.find(section => section.kind === "episodes");
  assert.equal(loaded.image, "https://media.test/series-poster.jpg");
  assert.equal(guide.items[0].image, "https://tvmaze.test/episode-one.jpg", "missing Kitsu still is resolved from an exact TVmaze episode match");
  assert.equal(guide.items[1].image, "https://media.test/episode-two.jpg", "Kitsu's native still remains preferred");
});

test("detail dispatch rejects missing, unsupported and disabled source identities", async () => {
  const { controller } = makeDetailController();
  await assert.rejects(controller.load({ title: "No source" }), /no source ID/);
  await assert.rejects(controller.load({ metadataSource: "retired", category: "movie", providerId: "1", title: "Old" }), /does not support/);
  await assert.rejects(controller.load({ metadataSource: "tvmaze", category: "movie", providerId: "1", title: "Wrong type" }), /does not support/);
  await assert.rejects(controller.load({ metadataSource: "tvmaze", category: "series", providerId: "1", title: "Disabled" }, { metadataSources: { tvmaze: false } }), /disabled/);
});
