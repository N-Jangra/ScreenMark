# Changelog — ScreenMark

All notable changes are recorded here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Settings: Date format (device default, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, 29 Oct 2026) applied across pages; Icon style (inside boxes or inline); Image storage (save all images, posters and covers only, or online only).
- Pull to refresh on Details and drill-down pages (touch, or mouse drag from the top): arrow → "Release to refresh" → spinner → ✓ Updated. Replaces the Refresh source button.
- Favorites: heart any title from its Details page; a ♥ Favorites filter on Home (with count) and a heart on favorite cards.
- Home: "Continue watching" hero with a Resume button, an "Airing next" list, and series cards that show "S1 · E4 watched · 173 eps left" with a one-tap check for the next episode (from the CueMark mockups in `cm/`).
- Details: a favorite heart (any category), genres under the title, an episode summary with Mark all watched / next episode, Cast & Crew "Full list", and an Official trailer card (TMDB, AniList).
- Settings → Animations: speed (off/fast/normal/slow/custom), easing, page transition, card entrance, stagger, sheet style, press effect, hover lift, nav icon bounce, progress and shimmer toggles, preview and reset. Reduce motion and Animation speed moved here from Appearance.
- New metadata sources: The Movie Database (key), TheTVDB (key), IMDb and Rotten Tomatoes (unofficial, read from public pages).
- Per-source settings page (Settings → Metadata Sources → ⚙): enable, domain override, user agent, API key and cookies, with Clear cookies and Reset. The Android app sends the user agent and cookies; the local preview forwards them through its proxy; plain browsers cannot send them.

### Changed

- Details: Edit sits beside Favorite and Delete in the header (swapping to Cancel / Save while editing); the redundant Next episode button is gone; a renamed title now shows its new name.
- Fixed the "Metadata & Storage" settings page disappearing from the Settings index after the Animations page was added.
- Details hero restyled: clearer backdrop, source badge on the banner, larger title and coloured status / year / rating chips. Settings option pickers (Dashboard view, Default category, Sort, Default status, …) now show proper icons instead of dots.
- Details: purple "‹ Back" like the Settings sub-pages; "You might also like" now ends both the Episodes and Overview tabs.
- Home header restyled (CueMark reference): clearer All / Movies / TV series toggle, search with an icon, larger status pills over a divider, and a "Tap ✓ for +1 ep" hint.
- Metadata Sources: a source's API key box only shows while the source is switched on (it stays on the source's options page). Source options page: visible toggle on the Enable card and aligned sections.
- Timeline and Statistics: the same top bar as the settings sub-pages (purple ‹ Back to Explore, centred title, icon tile; search sits in the Timeline bar) with no extra space above it; fixed the empty Timeline text showing raw `${...}` placeholders.
- Discover, Explore and Settings → Metadata Sources (plus each source's options page) restyled to the CueMark reference: "N sources active" chip, full-width type toggle and larger search, subtitles and a "Manage all" link on Explore with icon tiles and an On/Off state for Mix fetch, roomier source cards, a gradient Enable card and a grouped actions card on the options page.
- Confirmations (delete, clear data, factory reset, mark all / whole season, Mix convert) now use an in-app sheet instead of the browser's popup.
- Theme contrast pass: accent, warning, danger, success and info text are tuned per theme so they stay readable on every theme's surfaces.
- Details: heart and delete buttons share one size; sources with a trailer link (TMDB, AniList, TheTVDB, IMDb, Rotten Tomatoes) show a Trailer card, others get a "Find the trailer on YouTube" link.
- Details redesign (from the CueMark mockup): one progress card (count, time left, Mark all watched, Next, quick adjust); Episodes / Overview / Ratings / Cast & Crew tabs; season pills showing one season at a time; the episode page gains a Watched toggle, Prev/Next episode, and your own star rating and reaction per episode (stored with the title as `episodeNotes`).
- Watch progress and the episode checklist are now one: for a series with a saved episode guide, the ✓ boxes drive the count, and ±1ep / +5ep / the quick ✓ move the checks. Older entries that only had a counter are converted to the first N episodes watched.
- Details URLs now identify the page: `#details/<source>/<id>/<name>` for Discover/Explore titles and `&ref=episode/<id>/<name>` (or person/character) for drill-down pages; they restore on reload and browser Back steps out of a drill-down.
- Removed the Wikidata metadata source (search, details, settings and proxy allow-list).
- Details: episode guide now follows episode ratings, links sit at the end, drill-down pages open scrolled to the top, and opening another title no longer reopens the previous cast/character/episode page.
- Discover suggestion rows now span the full width on tablets and desktops instead of sharing a two-column grid.
- New ScreenMark logo: aligned clapperboard with a clipped striped bar; app icons regenerated.
- TVmaze details: season-by-season episode checklist with thumbnails and ratings, an episode-ratings grid after the overview, screenshots, posters, characters, staff, alternate titles and "You might also like".
- Cast, characters, staff, episodes and suggestions open in the app (person, character and episode pages with Back), including a person's series and guest-appearance episodes.

## [0.1.0] — 2026-10-29

ScreenMark's first tracked release, bringing the interface, navigation and metadata work first built for SavePoint to movies and TV series.

### How the app works

- **Library:** every title is a *Movie* (progress in minutes, total = runtime) or a *TV series* (progress in episodes, total = episode count) with status (Watchlist, In Progress, On Hold, Dropped, Completed), rating and notes.
- **Home, Discover, Add, Details, Timeline, Statistics, Explore, Settings** — see [docs/app-walkthrough.md](docs/app-walkthrough.md).
- **Data:** JSON under `splitapp_screenmark_v1`; on Android items and metadata are also stored in an encrypted native store with an optional shared-folder database and daily TAR backups.

### Added

- iOS-style interface (grouped cards, frosted headers, pill filters, bottom sheets, violet accent, Light/Dark) and a multi-screen layout: phone bottom bar, tablet icon rail, desktop sidebar, centred sheets.
- Launch screen with the ScreenMark clapperboard icon; direction-aware page and sheet animations; low-memory mode (≤2 GB, ≤2 cores or data saver).
- **Home:** type row (All / Movies / TV series), status chips with counts, filter sheet with pill and segmented controls, three-dot action sheet (Mark as In Progress / Completed, details, remove), rating and status on one row.
- **Add:** Movie / TV series switch, auto-fill search, poster and description, status pills, progress and total steppers sized per type, star rating; runtime or episode count fill in from the source.
- **Details:** Watch progress card (−/＋ buttons per type, % watched, time left), status pills and animated star rating, tags, ratings, details table, cast / characters / staff carousels, collapsible episode guide with per-episode watched toggles, links, related titles; fixed section order.
- **Discover:** All / Movies / TV series switch; suggestion rows from TVmaze schedules, the iTunes top-movies chart and AniList trending; search across all enabled sources.
- **Explore:** lists all four sources (Off / Setup shown for inactive ones), Timeline, Statistics, and a Beta group with **Mix fetch**.
- **Statistics:** *Time to watch* (watched so far, length of titles with data, left to watch, episodes watched, longest titles) with **Fetch details** and **Find runtimes**; Activity chart with Week / Month switch and visible counts.
- **Timeline** with posters; **Settings** reorganised (Storage, App Info and Logcat reachable from the index), Bottom Menu Icons carousels, Show sidebar / Show scrollbars toggles, App Info and Logcat redesigned.
- **Custom sources:** add any JSON search API on a guided page with a Test button; choose whether it serves movies, series or both.
- **Mix fetch (beta):** one list across all sources; opening or adding a title merges details from every enabled source; converting existing single-source titles is offered.
- Deep links for every screen (including `#details?id=<id>`), Android back closes sheets then pages, tapping outside a sheet closes it, back links return to where you came from.

### Metadata

- Rich loaders for TVmaze (cast, full episode guide, schedule, links), AniList (characters, staff, relations, recommendations, trailer), Wikidata (people, companies, runtime, episodes with labels resolved) and OMDb (ratings, awards, box office) returning one common shape with a saved `facts` summary.
- AniList now serves anime **movies** as well as series and uses valid GraphQL types; Wikidata search keeps only films or TV series.
- Sources that need a key and have none are skipped instead of failing the whole search; an invalid OMDb key is reported clearly; pasting a key into a disabled source turns it on.
- Cache Storage can no longer stall a request.

### Changed

- Fresh installs start on the Light theme, with a Home / Discover / Explore / Settings bottom bar, scrollbars hidden, and TVmaze, AniList and Wikidata on (OMDb off until a key is added).
- Version set to 0.1.0.

### Known limitations

- OMDb needs your own API key. Movie suggestions come from the iTunes chart and AniList; series suggestions from TVmaze schedules and AniList.
- Custom sources accept JSON only; in a PC browser the API must allow cross-origin requests.
- JSON import restores titles only. Exports and folder backups are not encrypted.
- Titles previewed from Discover cannot be reopened after a page refresh.
