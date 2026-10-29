# Changelog — ScreenMark

All notable changes are recorded here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

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

### Changed

- Dashboard views reduced to List, Compact list, Poster grid, Detailed grid, Compact grid, Large poster grid and Timeline.
- Fresh installs start on the Light theme with TVmaze and AniList on (OMDb, TMDB and TheTVDB need a key; IMDb and Rotten Tomatoes start off).
- Wikidata is no longer a source.

### Fixed

- Backup import file picker being blocked; Discover rows clipped on tablets; Details header not spanning the page; empty Timeline text showing raw placeholders; Metadata & Storage missing from the Settings index; renamed titles keeping the old name on Details.

### Known limitations

- OMDb, TMDB and TheTVDB need your own API key. Browsers cannot send a custom user agent or cookies; they work in the Android app and the local preview server, and a custom domain works in the Android app only.
- Custom sources accept JSON only; in a PC browser the API must allow cross-origin requests.
- JSON import restores titles only. Exports and folder backups are not encrypted.
- Without a saved episode guide, a series falls back to a plain progress counter.
