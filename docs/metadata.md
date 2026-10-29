# ScreenMark metadata sources

The registry in `frontend/backend/features/metadata.js` is the source of truth. Sources are enabled by default except OMDb (it needs a key); pasting a key into OMDb turns it on.

| Key | Source | Types | Key |
|---|---|---|---|
| `tvmaze` | TVmaze | TV series | No |
| `anilist` | AniList | TV series (anime), Movies (anime) | No |
| `tmdb` | The Movie Database | Movies, TV series | Yes |
| `tvdb` | TheTVDB | Movies, TV series | Yes |
| `imdb` | IMDb (unofficial) | Movies, TV series | No |
| `rottentomatoes` | Rotten Tomatoes (unofficial) | Movies, TV series | No |
| `omdb` | OMDb | Movies, TV series | Required — [get a key](https://www.omdbapi.com/apikey.aspx) |

Suggestions on Discover also use TVmaze schedules and the public iTunes top-movies chart (no key); chart titles are resolved through Mix fetch.

## What each source returns

- **TVmaze:** poster, summary, genres, status, network and country, schedule, runtime, language, season and episode counts, cast carousel, a full episode guide (tap to mark watched), links to the official site, TVmaze, IMDb and TheTVDB.
- **AniList:** cover and banner, description, format, status, studio, episodes and duration, score, popularity, tags, characters, staff, relations and recommendations, trailer and external links.
- **OMDb:** plot, poster, rated, runtime, genre, director, writer, cast, language, country, awards, Metascore, Rotten Tomatoes and IMDb ratings and votes, seasons, box office, production. An invalid key shows "OMDb rejected your API key".

Every loader returns the same detail shape (`schemaVersion: 2`) with `watch` (`runtimeMinutes`, `episodeCount`, `seasonCount`) and a derived `facts` summary saved with the title: runtime, episode and season counts, total minutes, genres, release date, directors, writers, cast, networks, languages, countries, status, age rating, rating, awards, box office, tags and alternative names.

## Custom sources

Stored in `preferences.customSources` and registered at runtime as `custom:<id>`:

```json
{
  "id": "a1b2c3d4", "name": "My movie database", "categories": ["movie", "series"],
  "searchUrl": "https://api.example.com/titles?search={query}&key={apikey}",
  "apiKey": "", "apiKeyHeader": "", "resultsPath": "data.results",
  "map": { "title": "name", "id": "id", "image": "poster", "year": "released", "description": "overview", "rating": "rating", "url": "url", "subtitle": "genre" },
  "imageTemplate": "https://img.example.com/{id}.jpg", "suggestionsUrl": "",
  "detailUrl": "https://api.example.com/titles/{id}", "detailRoot": "data",
  "detailMap": { "genres": "genres", "directors": "directors", "cast": "cast", "runtime": "runtime", "episodes": "episode_count" }
}
```

Paths use dots and `[index]`. Only `http(s)` URLs are used; nothing from a custom source is executed. In a PC browser the API must send CORS headers.

## Search, "All" and caching

Search runs enabled sources for the chosen type concurrently; **All** runs movies and series and merges. Sources that need a key and have none are skipped. Successful JSON GET responses are cached in Cache Storage (`splitapp_screenmark_metadata`) for six hours; the cache step can never stall a request. The local preview server (`dev-server.js`) proxies only the provider hosts: TVmaze, AniList (POST), OMDb and iTunes.

## Per-source options

Settings → Metadata Sources → a source's ⚙ page stores `preferences.sourceOptions[key] = { domain, userAgent, cookies }`. `SplitAppMetadata.resolve` swaps the host when `domain` is set and the request layer adds `User-Agent` / `Cookie` headers for every request to that source's default host. The Android app sends them natively; `dev-server.js` forwards `x-source-user-agent` / `x-source-cookie`; a plain browser drops them. IMDb and Rotten Tomatoes are read from public pages and may answer with a bot check.
