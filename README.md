# ScreenMark 0.1.3

ScreenMark is a local-first tracker for **movies and TV series**. It runs as a browser single-page app and as a Capacitor Android app, with an iOS-style interface that adapts from phones to tablets and desktops, and keeps its library in an app-specific storage namespace.

## What it does

- Track movies (minutes watched) and TV series (episodes watched) with status, rating, progress and total.
- Separate Shows and Movies libraries, Favorites pages, and Watchlist / Upcoming pages for each type; each library supports filters and progress indicators.
- Watchlists offer List, Posters and Cards views; Posters uses portrait cover art with a season/episode badge and a colored watched-progress bar for series.
- Discover movies and series across TVmaze, AniList, TMDB, TheTVDB, IMDb, Rotten Tomatoes and OMDb. Search results are grouped by source, with a dedicated View all results page for each provider.
- Without a search query, Discover shows suggestion shelves without repeating a catalog title across categories.
- Pull-to-refresh is available on Discover, Show and Movie watchlists, with content moving below the sticky controls during the drag. Android's native edge stretch is disabled so the fixed bottom bar stays in place. Watchlist status changes animate nearby cards into their new positions.
- Appearance includes System, Light, Dark and AMOLED themes, a gold Default accent, and custom colors applied throughout Shows, Movies, Details, Watchlists, Profile, Discover, Settings and shared navigation. Title, movie, episode, cast and character details use theme-aware text, surfaces, artwork fades and controls. Bottom navigation offers icon highlight, underline, filled pill and minimal styles, three label layouts, and expanded per-page icon choices. Long Settings option sheets scroll within the screen and follow the selected motion style.
- Source-backed Details pages: season and episode guides, cast and crew, ratings, screenshots and provider links; AniList anime episode guides use the AniList-to-MyAnimeList ID with Tenrai data and a title-matched TVmaze fallback. AniList cast and character profiles open in ScreenMark, with character biographies and related titles. Shared Links pills appear on title, episode and cast/person pages. Episode tracking updates Timeline activity, blocks tracking before air time and shows when a series is caught up.
- Details status choices follow episode progress: series offer Watchlist and Completed before tracking starts, then In Progress, On Hold, Dropped and Completed; movies offer Watchlist, Dropped and Completed. Unfinished series move to On Hold after 7 inactive days and Dropped after 30 days.
- Profile includes an **Add manually** action beside the profile identity, plus separate series time, episodes watched, movie time and movies watched cards. Statistics provides a Shows / Movies overview with watch-time, progress, genre and collection charts, a separate Activity page and a Timeline grouped by day.
- Lightweight motion controls for reduced motion and speed, Slide/Fade/Zoom page transitions, Slide/Fade/Scale sheets, Shrink/Fade tap feedback, Smooth/Snappy/Spring progress, and Shimmer/Soft pulse/Static loading placeholders. Detail skeletons reserve space only for missing sections; each section uses one subtle sweep, with the shimmer preference on by default for new installs. Motion Off, reduced-motion preferences and low-resource Android settings disable decorative animation and blur while keeping ordinary scrolling native.
- Watchlist and Upcoming artwork uses shared remote/local image handling, including local thumbnail cache reads, image proxy routing and placeholder fallback across list, poster and card views.
- Startup keeps the opening animation visible through its complete playback, waits until the initial library restore is ready, then holds the finished mark for 500 ms before revealing app data. Reduced-motion settings use the static mark.
- Favorites (♥) from Details or the ⋮ menu, with dedicated favorites pages.
- Metadata sources stay separate. Titles are identified by category, source, normalized name and year, so same-name entries from different catalogs can coexist.
- **Custom sources:** add any JSON search API on a guided page.
- Export (Android Save as screen, chunked) and import a JSON library backup; the library lives in IndexedDB with a device cover cache, plus Android encrypted storage, an optional folder database and daily backups. Folder title mirrors are grouped by media type and metadata source.

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
- [Release notes](CHANGELOG.md) — current 0.1.3 changes and earlier release notes.
- [Frontend module map](frontend/README.md).

## Run locally

From this directory:

```sh
npm install
npm run serve
```

Open the local URL printed by the server. For Android, run `npm run cap:sync` before opening or building the project. `capacitor.config.json` sets `frontend/` as the web directory, so the same source files power preview and Android.

## Tests

Run `npm test` for the Node test suite. It exercises the local static-file/CORS/proxy routes, mocked search and detail calls for each metadata provider, custom-source mapping, metadata request validation, cold movie/series placeholder placement, and every IndexedDB store and worker operation. Provider requests use fixtures; this suite does not contact live metadata services.

## App identity

- Package: `screenmark`
- Storage key: `splitapp_screenmark_v1` (IndexedDB database `screenmark_library`)
- Android application ID: `com.cuemark.screenmark`

## Release build

`python3 compile_apk.py` builds a signed release APK into `dist/screenmark-<version>-release.apk` (signed when `android/keystore.properties` exists). Use `--version 0.1.3` to set the version or `--debug` for a debug APK next to the script. Without `--version` it keeps the version in `android/app/build.gradle`.
