# ScreenMark metadata sources

The registry in `frontend/backend/features/metadata.js` is the source of truth. Source availability and API-key needs are shown in **Settings → Metadata Sources**.

| Key | Source | Types | Key |
|---|---|---|---|
| `tvmaze` | TVmaze | TV series | No |
| `anilist` | AniList | TV series (anime), Movies (anime) | No |
| `tmdb` | The Movie Database | Movies, TV series | Yes |
| `tvdb` | TheTVDB | Movies, TV series | Yes |
| `imdb` | IMDb (unofficial) | Movies, TV series | No |
| `rottentomatoes` | Rotten Tomatoes (unofficial) | Movies, TV series | No |
| `omdb` | OMDb | Movies, TV series | Required — [get a key](https://www.omdbapi.com/apikey.aspx) |

Suggestions on Discover also use TVmaze schedules and the public iTunes top-movies chart (no key). Search results remain grouped by their originating metadata source.

## What each source returns

- **TVmaze:** poster, summary, genres, status, network and country, schedule, runtime, language, season and episode counts, cast carousel, a full episode guide (tap to mark watched), links to the official site, TVmaze, IMDb and TheTVDB.
- **AniList:** cover and banner, description, format, status, studio, episodes and duration, score, popularity, tags, characters, staff, relations and recommendations, trailer and external links. For anime series, ScreenMark uses AniList's MyAnimeList ID to fetch titled episode records from Tenrai's read-only public anime catalogue, including paginated guides. Requests are serialized and paced, with one retry for transient failures. If no usable guide is returned, ScreenMark tries alternate AniList titles against TVmaze and accepts only exact, unambiguous matches, preferring the matching release year. Tenrai is an unofficial beta public service and can be unavailable; the AniList overview and episode count remain available when no guide provider responds.
- **OMDb:** plot, poster, rated, runtime, genre, director, writer, cast, language, country, awards, Metascore, Rotten Tomatoes and IMDb ratings and votes, seasons, box office, production. An invalid key shows "OMDb rejected your API key".
- **TMDB:** movie and series details, season and episode guides, cast and crew, episode stills, ratings and person credits. Add a TMDB API key in Metadata Sources.
- **IMDb:** title and episode structured data, cast and crew, ratings and season information where the page exposes it. IMDb person links open the profile when an IMDb ID is available and otherwise open a name search.
- **Rotten Tomatoes:** title and series, season and episode data, ratings, cast and crew where available. The public site may limit requests; Android source sessions let you complete a provider prompt yourself before retrying.
- **TheTVDB:** provider-backed movie and series metadata using your API key.

Every loader returns the same detail shape (`schemaVersion: 2`) with `watch` (`runtimeMinutes`, `episodeCount`, `seasonCount`) and a derived `facts` summary. Runtime, episode and season counts, total minutes, genres, release date, directors, writers, networks, languages, countries, status, age rating, rating, awards, box office, tags and alternative names may be saved with the title. Cast/person data is shown from the live provider response and is not persisted for offline use. Detail pages share a Links section with provider pills across titles, episodes and cast/person pages.

## Source-specific results

Each search source returns its own result set and source-specific View all page. Adding a result saves that provider's metadata on a distinct library entry. Same-name entries can coexist when they come from different sources or release years; detail records are not merged across library entries. AniList episode guides are supplemental episode data linked through the title's MyAnimeList ID; the app continues to store the guide with that AniList library record.

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

Paths use dots and `[index]`. Only `http(s)` URLs are used; nothing from a custom source is executed. In a PC browser the API must send CORS headers. Local preview calls a custom source endpoint directly and applies that same CORS policy; the fixed-provider proxy is used only for its allowlisted metadata APIs (including the internal Tenrai anime episode endpoint) and image hosts.

## Search, "All" and caching

Search runs enabled sources for the chosen type concurrently and displays each source's results separately. Sources that need a key and have none are skipped. Successful JSON GET responses are cached in Cache Storage (`splitapp_screenmark_metadata`) for six hours; the cache step can never stall a request. The local preview server (`dev-server.js`) proxies the allowlisted built-in metadata APIs and image hosts; user-configured custom endpoints are requested directly and must permit the preview origin through CORS.

## Per-source options

Settings → Metadata Sources → a source's ⚙ page stores `preferences.sourceOptions[key] = { domain, userAgent, cookies }`. The Android app can send source cookies and user-agent headers through its provider-session bridge; the local preview server forwards the corresponding headers. A plain browser may drop them. IMDb and Rotten Tomatoes are read from public pages and may answer with a bot check or require you to complete a prompt in the provider page before retrying.
