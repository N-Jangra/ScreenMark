# Changelog — ScreenMark

All notable changes are recorded here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [0.1.4] — 2026-11-09

### Added

- Quick setup wizard for fresh installs: pick series you already watched, series you want to watch, movies you already watched and movies you want to watch from trending titles or search. It is also available from Profile ⋮ → Quick setup.
- Edit profile page (pencil badge on the avatar): choose the profile photo and background cover from library posters/backdrops, your own photo or none, with random/newest picks, per-source filters and change intervals (every launch, hourly, daily, weekly or manual). Library pickers page and lazy-load.
- Discover Grid / List / Cards view toggle; Cards prefer landscape backdrops (TMDB, AniList, Kitsu, TVmaze background images) with posters as the fallback.
- Discover suggestion shelves from MyAnimeList (Jikan) and Kitsu, with the contributing source names shown when several sources supply a shelf.
- Favorites pages with no favorites open a quick-setup style picker that lists the titles already in your local library (series or movies) with local search; picked titles become favorites. The Profile favorites boxes are tall "Add favorites" boxes that open it, and Later returns to Profile.
- Favorites, Series and Movies collections load more titles automatically as you scroll.

### Changed

- Discover Shows / Movies tabs are always visible above the search bar, Shows first, styled like the Watchlist tabs.
- Watchlist tab limits: Watching shows the 50 most recent, Not started yet the 30 most recently added and Haven't watched for a long time the 20 most recent.
- Profile menu is a compact bottom sheet (Timeline, Quick setup, Sources, Settings, About); the "My Profile" heading and tracked-title count were removed.
- Nav bar background Solid, Glass and Transparent are now visibly distinct; Transparent starts at 30%.
- Discover grid text lines up with the posters, shelves share a 20 px inset, and tapping a title opens its details. "You might also like" is a left-aligned swipeable poster rail.
- Setting a movie to Completed fills its runtime (and Watchlist clears it); vertical episode-rating columns are compact.
- Statistics → Activity page and its Profile menu entry were removed; Timeline covers it.

### Fixed

- Mobile Watchlist swipe between tabs works from anywhere (including over tiles) and cast / crew rails scroll sideways.
- Quick setup's Next / Skip / Finish button stays pinned to the bottom of the screen.
- Faster first thumbnails on Watchlist pages (visible cards load at high priority and off-screen cards skip rendering).

## [0.1.3] — 2026-11-08

### Added

- Appearance now offers a charcoal Dark theme alongside System, Light and AMOLED. Bottom navigation adds filled-pill and minimal active states, names-only labels, and more per-destination icon choices.
- Settings → Animations adds Slow motion, Zoom page transitions, Scale sheets and dialogs, Fade tap feedback, Smooth/Snappy/Spring progress styles, and Shimmer/Soft pulse/Static placeholders. Choices persist, reset to defaults, and respect reduced-motion and low-resource settings.
- A Node test suite for every local HTTP route, built-in metadata search and detail dispatch, custom-source mapping, and IndexedDB/data-worker operations (`npm test`).
- Source-specific detail navigation for series, movies, episodes, cast and related titles, keeping supported content in ScreenMark's shared UI.
- AniList anime series load paginated episode data by AniList's MyAnimeList ID through Tenrai, with paced/retried requests and alternate-title, year-aware TVmaze fallback when no Tenrai guide is available.
- Bounded metadata refresh concurrency with automatic checks for saved titles and retry/resume handling.
- Metadata sync progress uses compact local records, resumes legacy interrupted entries, and preserves completed history when no refresh is due.
- IndexedDB thumbnail cleanup and bounded object URL caching.
- Thumbnail downloads enforce a streaming byte limit before buffering, cap both output dimensions, and release decoded bitmap resources after processing.
- Lazy image reads from the saved Android folder can request a 16 MB cap; archive and migration reads remain unbounded so large backup data is preserved.
- Library, collection, watchlist and detail posters now load local cached thumbnails on demand, with visible artwork placeholders until the image is ready or when it is unavailable.
- Lazy metadata, gallery, episode and match artwork uses asynchronous decoding and hides broken images while preserving the surrounding placeholder surface.
- Large collections and watchlist sections render in 100-title batches, with per-filter paging and cached collection sorting to keep large libraries responsive.
- Library ID lookups build their in-memory index once per array revision, avoiding repeated full scans for missing IDs during details and sync work.
- Startup reconciliation merges scoped item changes without serializing an extra full-library copy; IndexedDB upgrade blocking now fails clearly and releases stale connections on version changes.
- Removed obsolete animation and navigation preferences, kept the supported lightweight transition controls, and restored the Theme picker in Appearance.
- Fixed startup overriding the saved theme; new installs default to Light and Appearance choices now persist across reloads.
- Metadata sync progress counts now update incrementally instead of rescanning every queued title after each response, avoiding quadratic progress bookkeeping on large libraries.
- Large metadata refresh checkpoints are stored in 256-entry chunks and write only dirty chunks; the sync status page reads cached counters and the existing library index instead of rescanning the full queue and library on each progress render.
- Restored refresh entries whose metadata source was disabled are recorded as skipped, so restart recovery finishes cleanly without retrying a stale provider request indefinitely.
- Removed 806 CSS rules whose required class names no longer occur in the live HTML/JS, including retired home/collection, purchase-panel, and previous sync-status styles; runtime-generated detail/status classes remain protected. Removed unused discovery API exports and unused backend folder-helper wrappers.
- Metadata, saved-folder import, artwork hydration and folder-mirroring workers now claim queue jobs with constant-time cursors rather than repeated array front-removal.
- Concurrent workers recheck cursor bounds after idle/network waits to prevent duplicate or out-of-range claims at the end of a queue.
- Verified overlapping IndexedDB scoped/full write ordering in an isolated browser context; removed unused settings-template arguments and data.

### Changed

- Background source refresh now omits cast, recommendation and gallery payloads and avoids recommendation fan-out; interactive detail pages retain those sections.
- Detail loading reserves correctly shaped synopsis, facts, artwork and episode placeholders only where data is missing; shimmer is enabled by default and respects motion and low-end settings.
- Movie details now group content into Overview, Details, Media, Ratings and Cast & Crew tabs when each section has data; the movie tab row scrolls horizontally on narrow screens instead of compressing labels.
- Detail screens no longer wait for Android folder-image reads before starting the provider load or rendering; local artwork merges in as a background update, and visible episode/cast images are prioritized when a detail panel opens.
- Cast, character and episode routes now render page-shaped loading skeletons immediately, preserving the portrait/credit list, character appearances, episode still/synopsis/cast and saved-series guide positions while provider data loads. Loading status remains available to assistive technology; placeholders honor the existing shimmer and reduced-motion settings.
- Fixed the JS Android launch intro replaying twice: the GIF now plays its 3.43-second sequence once, then waits for startup readiness and the existing 500 ms gap before revealing app data. Android's separate system launch splash remains unchanged.
- Discover now holds complete card-shaped placeholders through poster, type/rating badges, title, year, genre chips and add-control positions during both suggestions and search. Loaded cards show up to two available genres and keep a neutral artwork placeholder visible until each poster loads; failed requests clear skeletons instead of leaving placeholders stuck on screen.
- Watchlist Poster mode now uses a portrait poster grid like the Shows and Movies pages, with the next season/episode badge, watched count and progress bar over the series poster. It uses the title poster rather than the next episode still.
- Android's native WebView edge-stretch effect is disabled so fixed bottom navigation stays pinned during pull-to-refresh; the app's custom refresh gesture still moves only page content.
- Light theme now honors the selected Default or custom accent instead of replacing it with a fixed violet CSS value.
- Light theme Profile filters, season/episode cards, and Watchlist refresh indicators now use light surfaces and readable filter-chip contrast.
- Library edits compare only editable fields, retain the existing ID-to-position index on same-position replacement, and skip persistence for no-op edits. Metadata sync comparison no longer deep-clones the full provider payload before serializing it.
- Metadata provider responses and cached JSON are streamed and capped at 12 MB before parsing or caching, limiting oversized-payload memory spikes on low-memory devices.
- Startup reconciliation now tracks scoped item and preference mutations instead of serializing a duplicate copy of every library record on the UI thread; imports and history clearing use incremental persistence.
- Startup now waits for the initial library restore, plays the complete intro animation (including its configured repeat), and holds the finished mark for 500 ms before showing app data. A stalled GIF falls back to the static mark without bypassing the data-ready check.
- Detail skeletons now use one subtle animated sweep per placeholder section instead of animating every bar; cold series expose the Episodes tab and skeleton immediately, empty Synopsis placeholders do not duplicate the empty overview card, and shimmer-off/reduced-motion/low-resource settings suppress the sweep.
- Removed the app-wide floating Add button; manual entry now starts from the Add manually button in the Profile header, keeping library and detail pages clear.
- Library persistence writes changed records incrementally through a data worker, with smaller database indexes and bounded background artwork hydration.
- Removed the remaining dashboard-only CSS selectors and layout rules after removing the Dashboard renderer; shared Discover and details styling remains active.
- Removed a persisted share/PDF cache that had no reader; the IndexedDB upgrade reclaims its old blobs.
- Removed stale Search, Explore and mixed-fetch CSS hooks alongside the deleted page and fetch modules.
- Removed the unreferenced search-result rerender helper after confirming no active page calls it.
- Android storage operations close streams and cursors reliably; scheduled encrypted backups honor a configurable retention limit.
- Daily TAR backups use Apache Commons Compress for PAX-compatible long UTF-8 paths, stream each file, and can be restored from the archive through the native storage plugin.
- TAR backup creation no longer sends a second full database JSON string across the WebView bridge.
- Metadata requests enforce HTTPS, reject redirects, and use source-specific provider settings; the local preview proxy restricts origins, destinations, and response sizes.
- Custom metadata sources in localhost preview use their own HTTPS endpoint directly and its CORS policy instead of being sent to the fixed-provider proxy allowlist.
- Low-resource Android devices use shorter visual work and reduced metadata/artwork concurrency.
- Legacy Dashboard and Search hashes route directly to Discover; Android back uses Shows Watchlist as the app home.

### Fixed

- Add/Edit title now uses a full-width, safe-area-aware sticky header aligned with Settings subpages.
- Clearing Library history now explains that Timeline and Statistics → Activity use the same saved activity records and asks for confirmation; a late journal read can no longer restore cleared entries.
- Simplified per-source options hints, removed blank helper rows, and replaced the full device User-Agent placeholder with a short default label.

- Cleaned up Metadata Sources by removing repeated instructions, tightening the empty custom-source state, and using the app’s active theme text, surface, border and accent colors.

- Unified settings and subsettings switches across Light, Dark and AMOLED: matched track/thumb sizing, theme-token off/on colors, and consistent focus/disabled states. Removed the superseded source-specific and dark-only switch overrides.

- Light theme controls now use light surfaces for Profile filters, season/episode cards, and the Watchlist pull-to-refresh indicator; profile filter text no longer uses a dark-only shadow.

- Light theme's Default accent now uses the same gold as AMOLED instead of switching to indigo; the Light, System and AMOLED theme previews match.
- Appearance option popups now give the heading and unselected options the same theme surface; the low-memory Android header override no longer makes the heading a different shade.
- Mobile series/movie details and Episode, Cast and Character pages place Back and action controls over the hero artwork in theme-matched floating surfaces, including Android low-end styling.
- Discover search now uses a real search form: the on-screen Search button and Android keyboard action submit through the same handler and the keyboard closes after submission. Improved narrow-width control sizing and input focus feedback, and made duplicate-submit protection specific to query, type, and source.
- Appearance accent colors now carry through Shows, Movies, Details, Watchlists, Profile, Discover, Statistics and Settings. Legacy page tokens, selected controls, progress indicators and gradients follow the chosen accent in both Light and dark themes.
- Removed an unreferenced legacy Backups redirect page. The frontend integrity tests now verify local app-shell assets, script syntax, and runtime-file reachability.
- Upcoming episodes can no longer be marked watched from detail, season, or progress controls; earlier-episode auto-marking skips unaired episodes, and the Upcoming tab filters watched episodes immediately without a refresh.
- Startup now validates persisted JSON shapes and waits for IndexedDB restoration before saving migrations, preserving the library when the local mirror is malformed; thumbnail cache reads reject stale signatures and non-Blob records.
- TAR restore accepts both the root-level ScreenMark database entry and the mirrored `database.json` inside the current folder tree.
- Pending IndexedDB operations are replayed in order through the main-thread fallback when the data worker fails or times out, instead of being dropped.
- Reduced Motion and Motion Off use the static app mark and skip animated playback while retaining the startup data-ready check.
- Restoring an encrypted backup replaces the previous item set so deleted titles cannot reappear from stale records.
- Empty-library encrypted backups restore correctly, and monthly automatic metadata refresh timers are split below the browser timeout limit instead of overflowing.
- Background sync resumes safely after connectivity, visibility or metadata-mode changes.
- The empty Statistics state now links to the current Shows Watchlist route.
- Details and episode loading use local cached records and safe placeholders while source requests are pending or unavailable.
- Watchlist and Upcoming cards use shared image handling for remote URL routing, local thumbnail cache hydration and image failure placeholders across list, poster and card layouts; local artwork begins loading earlier near the viewport.
- Route transitions no longer compete between base and motion stylesheets; route, sheet, press and progress motion use consistent easing while honoring reduced-motion and low-resource preferences.
- Detail-page Light theme styling keeps title, movie, episode, cast and character screens consistent: artwork fades blend into light surfaces, episode overlay copy and badges remain legible, portrait framing uses restrained shadows, and floating controls follow active theme tokens.
- Device review improved Light theme contrast for accent-colored text on Upcoming and detail pages by using the theme's contrast-adjusted accent text color while preserving accent fills.
- AniList character links in staff biographies open an in-app character profile with an overview and related titles; biography links and emphasis render as formatted content.
- Unaired next episodes show a “Caught up” control on watchlists, and unaired episode rows show a day countdown instead of a tracking checkbox. Tapping “Caught up” explains that the next episode has not aired.
- Discover search input and submit controls now share a consistent height, and the search field no longer shows a nested browser-default border.
- Removed stale frontend page and icon references no longer included in the app shell.

### Removed

- The unreachable legacy Dashboard renderer and its script include; Dashboard and Search hashes remain supported aliases to Discover.
- Collection and title sharing controls, PDF generation, and the Android ShareIntent bridge.

## [0.1.2] — 2026-11-07

### Added

- Dedicated Shows and Movies library pages, favorites pages, and separate watchlist/upcoming pages for each media type.
- Search results grouped by metadata source, with a source-specific View all page.
- Profile shortcuts for settings, metadata sources, statistics, activity, timeline and app information.
- Pull-to-refresh on Discover and both watchlists, with content that follows the drag beneath the sticky search or watchlist tabs.

### Changed

- Shows and Movies are available directly from the bottom navigation; the old Dashboard and Explore destinations were removed.
- Discover now keeps its type selector in the expanding search header and marks source headings with the same accent used for category headings.
- Unsearched Discover suggestions no longer repeat the same catalog title across Latest, Trending and genre shelves.
- Watchlists distinguish currently watching titles from titles that have not been started, show the next aired episode to track, and keep each page's view choice separate.
- Collection sharing from Shows and Movies now creates one PDF for the full collection, with a short contents preview and Save and Share actions; image pages and page-count controls were removed.
- Details status choices now follow media type and episode progress: series offer Watchlist and Completed before tracking starts, then In Progress, On Hold, Dropped and Completed; movies offer Watchlist, Dropped and Completed.
- Watching an episode moves its series to In Progress, completing all known episodes marks it Completed, and inactivity moves unfinished series to On Hold after 7 days and Dropped after 30 days.
- Profile statistics use four separate cards, and the stats rail spacing and card sizing were refined.
- App Info and collection share sheets now use the current dark surfaces, accent color and compact mobile layout.
- Folder-backed libraries now store title mirrors under `movies/<source>/<item-id>/` and `series/<source>/<item-id>/`. Sync, artwork indexing and archive fingerprints use layout version 3; older `shows/`, direct-category and `titles/` folders migrate after a successful write.
- Library title identity keeps category, metadata source, normalized title and year distinct, allowing same-name entries from different sources.
- Streamlined Settings → Animations around current page, sheet and dialog transitions, tap feedback, progress updates and optional loading motion.
- Replaced the web, PWA and Android launcher branding and splash artwork with the selected Episode Stack icon; the startup overlay now plays its matching intro animation and falls back to the static mark for reduced motion.
- Reduced default and low-end-device motion work: card entrance cascades, navigation bounce and shimmer are off by default; low-end Android skips decorative motion and blur, and page transitions avoid a forced layout pass.
- Added a theme-aware Default accent choice that matches Discover and watchlists: gold on dark themes and indigo on light themes.
- Refined Settings option sheets so long lists scroll within the sheet, keep the header visible, and use a matching close animation.
- Smoothed watchlist episode updates with position-aware movement when titles change status groups.
- Watchlist poster view shows watched/total episode counts and a progress strip for series.
- Watchlist pages open on Watchlist by default; horizontal swipes in blank content space switch between Watchlist and Upcoming.

### Removed

- Mix fetch and its merged cross-source detail flow; metadata sources now remain separate throughout discovery and tracking.

### Fixed

- Saved series details open on Episodes when an episode guide is available, instead of defaulting to Overview.
- Statistics Activity returns to Profile from its back control.
- Watchlist details links continue to work after an episode is marked watched and the card updates in place.
- Pull-to-refresh feedback stays below the sticky tabs while the content moves with the pull, reports restore failures accurately, and returns the content to its resting position after refresh.
- Discover search places the clear control before the Search button.
- Aligned Statistics overview and Activity headers with a shared topbar layout.
- Replaced fallback circle icons on Metadata sync settings with refresh icons and clarified their descriptions.
- Reduced compositing overhead on the episode tracking carousel by removing persistent per-card GPU layer hints.
- Fixed Settings picker options extending below the visible sheet on smaller screens.

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
