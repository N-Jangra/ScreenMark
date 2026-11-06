# Changelog — ScreenMark

All notable changes are recorded here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [0.1.1] — 2026-11-07

Follow-up release focused on provider detail pages, discovery, library tracking and settings.

### Added

- Expanded TMDB, OMDb, IMDb and Rotten Tomatoes title and episode details, including season and episode guides, per-episode ratings, cast and crew, and source screenshots where available.
- IMDb cast and crew links now open the matching IMDb profile, with IMDb search as a fallback when a profile ID is missing.
- Rotten Tomatoes and IMDb source sessions on Android, plus image proxy support for additional provider hosts in local preview.
- Discover catalogue filters for sort order, year and genre, with add buttons that reflect titles already in the library.
- Compact shared cast and crew rows with portraits, names and roles.
- Mix fetch preserves each matched source's title rating and displays available ratings as provider-labeled badges.
- Adding a series through metadata search or Discover now opens its library details on the Episodes tab when a guide is available.

### Changed

- Updated detail pages with a merged season and episode list, easier season and episode tracking, and lazy-loaded long episode rating grids.
- Refreshed dashboard, Discover, Timeline, Statistics and settings layouts; improved empty-state colors and saved-title indicators.
- Reduced motion friction in the tracking episode rail and made metadata source ordering usable by drag and drop on Android.
- Updated appearance, navigation, backup, metadata and dashboard settings to match current app behavior.
- Unified provider links across title, episode, cast and person pages as a Links heading with rounded source pills.
- Mix detail merging now combines duplicate episode guides by season and episode number while keeping unmatched episodes and filling missing episode data from other sources.
- Tightened Export, Import, metadata source and custom-source settings layouts for mobile; removed repeated add-form actions when the sticky header already provides them.

### Fixed

- IMDb cast and crew links with absolute URLs no longer get a duplicated IMDb domain.
- Episode pages from IMDb, TMDB and Rotten Tomatoes now use provider episode details and the shared episode layout.
- Timeline activity now includes watched-episode changes, and long vertical rating grids load additional rows as needed.
- Discover add actions correctly identify titles already saved to the library.
- Corrected several narrow-screen settings and import/export layout issues.

See the [app walkthrough](docs/app-walkthrough.md), [metadata guide](docs/metadata.md) and [storage guide](docs/storage.md) for current behavior.

## [0.1.0] — 2026-10-29

First tracked release: a local-first tracker for **movies and TV series** that runs in a browser and as an Android app (Capacitor), built on the interface and metadata work first made for SavePoint.

### How the app works

- **Library:** each title is a *Movie* (progress in minutes) or a *TV series* (progress in episodes) with status, rating, notes and favorite. For a series with a saved episode guide, the watched ✓ boxes are the progress.
- **Screens:** Home, Discover, Explore (Timeline, Statistics, sources, Mix fetch), Details, Add, Settings — see [docs/app-walkthrough.md](docs/app-walkthrough.md). Deep links for every screen, including `#details?id=<id>`, `#details/<source>/<id>/<name>` and `&ref=episode|person|character/<id>`.
- **Data:** JSON under `splitapp_screenmark_v1`; on Android items and metadata also live in an encrypted native store with an optional shared-folder database and daily TAR backups. The browser keeps a trimmed copy of saved details.

### Added

- **Interface:** iOS-style cards, sheets and pills; phone bottom bar, tablet rail, desktop sidebar; Light, Dark and other themes with per-theme text contrast; in-app confirmation sheets; pull to refresh; new ScreenMark logo and launch screen.
- **Home:** All / Movies / TV series toggle with counts, status pills, ♥ Favorites filter, "Continue watching" hero with Resume, "Airing next", and series cards with an episode-aware line and one-tap ✓.
- **Details:** tabs (Episodes, Overview, Ratings, Cast & Crew); one progress card (count, time left, Mark all watched, Next, quick adjust); season pills with a per-episode checklist (watching an episode checks the earlier ones; season and whole-series checks ask first); episode ratings grid (horizontal or vertical); screenshots, posters, trailer card or YouTube search; Edit / Favorite / Delete in the header; "You might also like".
- **In-app TVmaze pages:** person, character and episode pages with Back — a person's series and guest appearances, Prev / Next episode, Watched toggle, and your own star rating and reaction per episode.
- **Metadata:** TVmaze, AniList, OMDb, TMDB, TheTVDB, IMDb and Rotten Tomatoes (IMDb and Rotten Tomatoes are unofficial and may be blocked). Per-source options page: enable, domain and alternative domains, user agent, cookies, API key. Custom JSON sources and Mix fetch (beta).
- **Settings:** Animations page (speed, easing, transitions, card entrance, sheets, press and hover effects, preview, reset); Date format; Icon style (inside boxes or inline); Image storage (save all, covers only, or online only); Metadata & Storage; Backups & sync; Logcat.
- **Discover / Explore / Timeline / Statistics:** restyled with sub-page headers, a "sources active" chip, subtitles and a "Manage all" link; Statistics shows watch time, activity and ratings.
- **Storage:** IndexedDB library store with a data worker; the library appears straight from IndexedDB at launch and the folder sync runs in the background. Saves write only the titles that changed.
- **Artwork:** on-device cover cache (IndexedDB) with online-first fallback; the saved folder only fills the cache in the background.
- **Export:** Android's Save as screen with chunked writes, so large libraries export without crashing; Backup Before Destructive Actions saves quietly into the backup folder.
- **Statistics:** an overview plus four sub-pages — Watch time, Library breakdown, Activity (selectable days) and Ratings (histogram, highest rated, and a Not rated yet list you can rate from).
- **Timeline:** rebuilt with All time / This week / This month filters, month sections and one card per day.
- **Discover:** source chips (All sources, each source, manage) and a "sources active" chip that opens Metadata Sources.
- **App Info:** redesigned page showing the installed version, stat tiles and grouped lists; ⋮ menu gains Edit entry, which opens the title's details in edit mode.

### Changed

- Dashboard views reduced to List, Compact list, Poster grid, Detailed grid, Compact grid, Large poster grid and Timeline.
- Fresh installs start on the Light theme with TVmaze and AniList on (OMDb, TMDB and TheTVDB need a key; IMDb and Rotten Tomatoes start off).
- Wikidata is no longer a source.
- Import List keeps the backup's dates and writes history so imported titles show on Timeline and Statistics.
- Removed settings that did nothing: Backup Password Reminder, Maximum Backup Size, Validate Backup Location, Restore Preview, Metadata Retry Limit, Metadata Sync Frequency, Metadata Sync Workers, Thumbnail Cleanup, Thumbnail Quality, Metadata Thumbnails, Image Cache Limit, Storage Warning Limit and Backup Storage Limit.
- Content now ends just above the bottom bar instead of leaving dead space; the Statistics top bar says "Statistics".
- Settings and Storage pages use a sampled size estimate and remembered cache sizes instead of serialising the whole library.

### Fixed

- Android: startup now asks for the storage folder whenever none is chosen (or the old one is gone) instead of silently running without one.
- Covers saved in the chosen storage folder now load on start, so they still show offline after the app cache is cleared (previously they only came from the cache or the internet).
- Backup import file picker being blocked; Discover rows clipped on tablets; Details header not spanning the page; empty Timeline text showing raw placeholders; Metadata & Storage missing from the Settings index; renamed titles keeping the old name on Details.
- A change made while the storage folder was still loading at startup could be overwritten; it now wins.
- ⋮ → View Details no longer fails intermittently; Add no longer opens pre-filled from the last edited title and its results collapse after a match is used.

### Known limitations

- OMDb, TMDB and TheTVDB need your own API key. Browsers cannot send a custom user agent or cookies; they work in the Android app and the local preview server, and a custom domain works in the Android app only.
- Custom sources accept JSON only; in a PC browser the API must allow cross-origin requests.
- JSON import restores titles only. Exports and folder backups are not encrypted.
- Without a saved episode guide, a series falls back to a plain progress counter.
