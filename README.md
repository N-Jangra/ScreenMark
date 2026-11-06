# ScreenMark 0.1.1

ScreenMark is a local-first tracker for **movies and TV series**. It runs as a browser single-page app and as a Capacitor Android app, with an iOS-style interface that adapts from phones to tablets and desktops, and keeps its library in an app-specific storage namespace.

## What it does

- Track movies (minutes watched) and TV series (episodes watched) with status, rating, progress and total.
- Home with type and status filters, a filter sheet and a quick-action sheet on every card.
- Discover movies and series across TVmaze, AniList, TMDB, TheTVDB, IMDb, Rotten Tomatoes and OMDb, with year, genre and sort filters plus suggestions when nothing is searched.
- Source-backed Details pages: season and episode guides, cast and crew, ratings, screenshots and provider links; shared Links pills appear on title, episode and cast/person pages. Episode tracking updates Timeline activity, and metadata-backed series open on Episodes after being added.
- Statistics: an overview with Watch time, Library breakdown, Activity and Ratings sub-pages (including a Not rated yet list), and a Timeline grouped by day.
- Favorites (♥) from Details or the ⋮ menu, with a Favorites filter on Home.
- **Mix fetch (beta):** one list across all sources, details and ratings merged from every enabled source; duplicate episodes are combined by season and episode number.
- **Custom sources:** add any JSON search API on a guided page.
- Export (Android Save as screen, chunked) and import a JSON library backup; the library lives in IndexedDB with a device cover cache, plus Android encrypted storage, an optional folder database and daily backups.

## Metadata providers

- TVmaze (series), AniList (anime series and movies), The Movie Database and TheTVDB (movies and series; free API key), OMDb (movies and series; free API key), IMDb and Rotten Tomatoes (movies and series; unofficial, no key, may be blocked).

The app lists them under **Settings → Metadata Sources**. TMDB, TheTVDB and OMDb need their own API keys. IMDb and Rotten Tomatoes use user-initiated provider pages and may ask for a session or block requests. Online discovery needs an internet connection.

## Project layout

- `frontend/index.html` — app shell and script/style entry point.
- `frontend/pages/` — one renderer per app screen.
- `frontend/components/` — shared frontend components.
- `frontend/styles/` — CueMark theme and detail-page styles.
- `frontend/backend/` — single maintained copy of the app storage, metadata, and detail modules; Capacitor packages it directly.
- `dev-server.js` — local preview server and restricted HTTPS metadata proxy.
- `android/` — Capacitor Android project.

## Documentation

- [Documentation index](docs/README.md) — guides and technical references.
- [App walkthrough](docs/app-walkthrough.md) — navigation, pages and settings.
- [Metadata sources](docs/metadata.md) — providers, API keys and fetching behavior.
- [Storage](docs/storage.md) — library persistence, image cache and backups.
- [Data schema](docs/db-schema.md) and [file layout](docs/file-schema.md).
- [Release notes](CHANGELOG.md) — changes for 0.1.1 and earlier versions.
- [Frontend module map](frontend/README.md).

## Run locally

From this directory:

```sh
npm install
npm run serve
```

Open the local URL printed by the server. For Android, run `npm run cap:sync` before opening or building the project. `capacitor.config.json` sets `frontend/` as the web directory, so the same source files power preview and Android.

## App identity

- Package: `screenmark`
- Storage key: `splitapp_screenmark_v1` (IndexedDB database `screenmark_library`)
- Android application ID: `com.cuemark.screenmark`

## Release build

`python3 compile_apk.py` builds a signed release APK into `dist/screenmark-<version>-release.apk` (signed when `android/keystore.properties` exists). Use `--version 0.1.1` to set the version or `--debug` for a debug APK next to the script. Without `--version` it keeps the version in `android/app/build.gradle`.
