# Changelog — ScreenMark

All notable changes are recorded here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [0.1.6] — 2026-11-10

Version code 106. Release notes cover the current 0.1.6 worktree changes.

### Changed

- Compact in-memory details for very large libraries (off by default; switch on with the `splitapp_screenmark_v1_slim_min` setting in browser storage, e.g. `1500`). Titles keep only what list pages need (genres, fields, a short episode schedule) in memory; the full details stay in the database and are read back when a title is opened, and a save never overwrites stored details with the compact copy. In a 3,000-title dummy library (heavy details) the page heap dropped from about 640 MB to about 38 MB (compact titles are about 7 KB each against 200 KB). A huge library is also not re-read from the folder database at launch when that file is exactly the one this app last wrote (same title count and size).
- The folder database (`database.json`) is written title by title through new native stream calls (`openFolderStream` / `writeFolderStream` / `closeFolderStream`) for large or compact libraries, and snapshots, folder item files and backups read each title's full details back one at a time.
- Settings → Memory now offers Automatic, Low memory, Minimum and Full details. The choices control when library detail records are compacted and how many poster URLs are retained; full details remain in storage and are loaded on demand.
- Android folder reads and writes use bounded chunks. Completed database files are published through temporary files and rename where supported; large backups are parsed incrementally from their stream, including gzip content.
- Series, Movies and Favorites draw only rows close to the viewport while preserving the full scroll height. Poster URLs use a bounded cache; visible posters are kept while off-screen entries can be released and read again.
- Android launch state distinguishes a task dismissed from Recents from a process restored after ordinary backgrounding. A dismissed task starts at the home list; a background restore can keep its page and scroll position. WebView renderer exit is logged and the activity schedules recovery when resumed.
- Profile photo and cover editing includes drag, zoom and a crop preview. The cover frame follows the responsive profile hero shape used by the app; saved artwork fills the target region without leaving blank edges.
- Episodes after the last announced air date display TBD and cannot be marked watched. Undated gaps between dated episodes and wholly undated guides remain usable.
- Newly added metadata-backed movies and series enter a resumable library sync queue. Series fetch and save their complete episode guide without requiring a season to be opened; with **Save all images**, episode stills then download in small batches and Sync status shows episode and season progress. Work resumes while ScreenMark is open and online, and failed detail or artwork work can be retried.
- A compact sync overlay stays visible across screens, follows the active title
  and episode/season thumbnail progress, opens Sync status when tapped, and
  offers Retry for failed work. The main app and the Android `.test` package use
  the same frontend and queue behavior; the separate Kotlin package is not the
  load-test app.
- Episode-artwork sync now reports failed image downloads and IndexedDB writes as incomplete, leaving the title available for retry instead of marking a partially cached guide as synced.
- The background sync popup uses SavePoint's radial progress indicator while retaining the active title, season and image count, plus retry and dismiss actions.
- A completed sync popup stays dismissed after its automatic hide, even when later progress updates repaint the status.
- Progress reads the thumbnail worker's actual season counters. A missing device thumbnail-cache API is reported as a retryable failure rather than a successful offline sync.
- New library rows and full episode guides are written to IndexedDB before thumbnail work begins, independent of the slower native snapshot queue. Library sync skips optional TVmaze recommendation pages while retaining the complete episode guide and episode stills. Season progress counts every season when an image batch crosses a season boundary.
- Episode stills from saved guides are downloaded into the persistent artwork cache after detail sync or when opening a saved series. Cached stills are linked back to episodes by stable episode ID, so episodes that have never been scrolled into view can still show their thumbnail offline. This follows the selected Image storage setting; Online only and Posters and covers only do not download stills.
- Related title, episode, cast, character and person detail pages now use a nested Back history, returning through the detail pages before leaving for the originating collection. The walkthrough documents the history and the difference between clearing temporary cache and clearing saved artwork.
- Timeline no longer shows the "Collection activity / Recent activity" summary block; the filters and the list start right under the header.
- Discover's empty state is presented as a centered, full-width card with a clear next action, matching the page's loading and results surfaces.
- Source health: a source that fails three times in a row is paused (2 minutes, growing to 15), so one dead catalog stops slowing searches; the Test button on a source page bypasses the pause.
- Grid posters stored in the app database are shrunk to a 420 px WebP (new covers only), so big grids read and decode faster; the detail page still uses the full artwork.
- Background poster caching yields between batches, and collection search reuses lowercase title keys.
- The detail delete dialog is moved into the visible document layer before opening, so a dialog rendered from a hidden tab can be seen and used. Confirming deletion waits for the dialog's navigation entry to close before returning to the collection.
- Folder database indexing avoids creating metadata-only per-title mirror folders when no artwork needs offline files. Episode artwork also gets a stable id-based lookup so removing optional cast sections does not shift its stored image path.
- `npm run test:browser` runs a headless Chrome load comparison using 3,000 generated dummy titles; focused coverage also lives in `tests/folder-stream.test.js`, `tests/backup-stream.test.js`, `tests/source-health.test.js`, and the browser/device fixtures.
- Metadata Sources drops its helper line ("Enable sources and drag to reorder.") so the list starts higher.
- Android now persists title posters, portrait covers, backdrops, screenshots, poster galleries, and episode stills in IndexedDB. Existing saved titles backfill missing art after startup; new titles save art in the background as part of sync.
- Android collection, watchlist, detail, profile, and episode views resolve saved image blobs before remote URLs, so cached artwork remains visible offline after the temporary WebView cache is cleared.
- **Clear all temporary cache** now preserves persistent IndexedDB artwork. **Clear image cache** remains the action that removes saved image blobs.
- The device offline validation added coverage for artwork key retention, gallery lookup, background backfill, and temporary-cache semantics.
- The background sync popup is now a small floating radial progress button (percentage ring that turns green when finished and red on failure) like SavePoint's; the Sync status page was rebuilt with a progress hero, Synced / Remaining / Failed cards, Retry and Clear finished actions, and a title list. The ring counts partly downloaded titles (episode stills done out of total) instead of showing 0% until a title finishes.
- Watchlist cards restore each series' next-episode still from the device cache (and download it in the background when it is missing, then redraw the card), including right after marking an episode watched.
- Episode detail pages with no still use the series backdrop (or the poster) behind the title; the episode list shows a quiet placeholder icon instead of an empty block.
- Backups no longer include temporary `blob:` image links, and the browser JSON export loads each title's full details before writing it.
- Source options pages drop the grey helper lines and get more even spacing under the header.

## [0.1.5] — 2026-11-09

Version code 105 (117 automated tests). Highlights: Quick setup that works on a fresh install and fills in full details, a sync status page, much more reliable backups and restore, a two-step profile picture picker, a lazy online-only Cast & Crew tab, gzip-compressed backups on browser and Android, a database artwork index, a full review of every metadata source (IMDb, Jikan, Kitsu, TheTVDB, TMDB, AniList), fixes to the bottom bar / default status / automatic completion settings, and performance work.

### Added

- Artwork catalog in the app database (IndexedDB `images` store, schema version 7): one row per poster, background, logo, thumbnail or screenshot, indexed by title, title + kind and source, so titles with hundreds of pictures are queried without loading the whole record. It is kept in sync on every save and filled from the existing library on upgrade.
- Backups (`version: 2`) now include a top-level `index` and a `backupRef` on every title with its source, source id, category, title and year. CSV exports gain `Source`, `SourceID` and `ID` columns.
- Edit profile: the library picker is a two-step flow. Choose **Picked below**, pick a series or movie (with search), then pick one of its posters, thumbnails, backgrounds or screenshots. The exact picture is remembered (`profileAvatarPinnedImage` / `profileCoverPinnedImage`) and prefers the on-device copy so it shows offline.
- Episode ratings, the rating breakdown and the rating count are saved explicitly in each title's `facts` (`episodeRatings`, `ratingBreakdown`, `ratingCount`) in IndexedDB, folder JSON and exports.

- Sync status page (`#sync`) for newly added titles, Quick setup and backup restore: progress bar, per-title Queued / Syncing / Synced / Not synced list with errors, Retry failed and Clear finished; it survives restarts and resumes unfinished work. Series show episode-still and season progress while full image storage is enabled.
- Restore sync: restored titles with a source and id download through the queue, and names-only titles (TXT, CSV, old backups) are matched to a source by exact title and year first.
- Compressed backups: JSON can be saved as `.json.gz` in the browser and the importer opens `.json`, `.json.gz` and `.sqdb`. CSV exports carry year, status, progress, goal, favorite, review, source, source id, id and dates; TXT is `Title (Year)`.
- MyAnimeList (Jikan) mirror through AniList, new sections for Jikan (staff, pictures, recommendations, episode ratings) and a developer source probe (`tests/tools/`).

### Changed

- Newly added source-linked titles load full details (episodes, ratings, posters, backgrounds, screenshots) two at a time through the background queue and save their artwork. Series episode stills are cached after the episode guide is saved, without waiting for a season menu to open. Quick setup uses the same queue; finishing with more than 8 picks opens Sync status.
- Cast & Crew is lazy: the tab appears only while online (and the source is enabled), loads from the source when you tap it with a placeholder skeleton and a Try again button, and is never written to the database or backups. It disappears when offline.
- Opening a title that only has lightweight details refreshes it once automatically instead of needing pull-to-refresh.
- Restoring a backup matches titles by source + source id first (then by title) and rebuilds the metadata link from the backup, so restored titles sync with their source.
- Restore primes the device artwork cache directly from the restored data in one batched write, and the background artwork fill uses larger batches, so posters in Watchlist, Profile, Series/Movies and Favorites appear quickly.

### MyAnimeList (Jikan) unreachable

- When `api.jikan.moe` cannot be reached (connect timeout on some networks, including the phone's), searches, Discover shelves and title pages now fall back to AniList, which carries every title's MyAnimeList id: titles keep their MAL id and link, details show "MyAnimeList (via AniList)", and Source → Test explains that the host is unreachable and the mirror is used. Jikan requests time out after 8 seconds, and one failure pauses direct Jikan calls for 3 minutes so screens do not keep waiting. If AniList does not know the title either, the error says so plainly.

### Settings review (Appearance, Animations, Tracking)

- **Bottom bar on phones:** the low-end profile (always on in the Android app) forced the bar solid, so Bar background Glass / Transparent and the transparency slider did nothing on mobile. The bar now follows your choice; Glass keeps a light blur, and the slider sets the tint (Glass) or opacity (Transparent). Measured on a phone-sized low-end profile: Solid is opaque, Glass is a blurred 55% tint, Transparent follows the slider from 0 to 100%.
- **Bar style Underline** only removed the icon highlight; it now draws an accent line under the active item.
- **Show sidebar** says it applies to tablets and wide windows (phones always use the bottom bar).
- **Default Status** only offers Watchlist and Completed: a new title with no progress cannot stay In Progress, On Hold or Dropped, so the other options silently reverted. The manual Add form also ignores a saved default that does not exist for the chosen category.
- **Automatic Completion** now governs series as well as movies: Automatic completes a fully watched series, Ask prompts, Manual leaves the status alone (series were always completed regardless).
- Reviewed and confirmed working: text size, theme, date format, accent colour, bar labels, motion speed, reduce motion, screen / sheet transitions, tap feedback, progress animation and style, placeholder shimmer / pulse / off, preview and reset.

### Metadata sources (full review of every source)

- **IMDb:** the exact IMDb id now decides which TVmaze show supplies the episode guide (it used to search by title and could pick a different show), the short IMDb cast (a few names, no roles) is replaced by the full cast with roles, characters, crew and artwork from the catalogue that shares the id (TVmaze, TMDB or OMDb), and when IMDb answers with a bot check the title, episodes and cast still load from that catalogue. Blocked IMDb episode and person pages fall back to the saved guide / OMDb / TMDB.
- **MyAnimeList (Jikan):** adds staff, pictures, recommendations and episode ratings, a runtime, a request queue that respects the 3 requests/second limit, a fast failure with a clear message while `api.jikan.moe` is unreachable (it times out from some networks), and series search that includes ONA / OVA releases.
- **Kitsu:** characters and staff were never shown (the join records were read instead of the characters / people they point to); they now load with their roles. Trending and popular shelves were empty because Kitsu cut its page size to 20. Character and person pages list their anime credits. Runtime is read from the episode length.
- **TheTVDB:** the popularity score was shown as a rating (184.2 for Inception); it is gone. Directors / writers / producers are in Staff instead of Cast, specials no longer inflate the episode guide (80 instead of 62), person pages list their credits, empty rating tables are hidden, and Discover gets Top and New shelves from its filter endpoint.
- **TMDB:** series runtime falls back to the latest episode or the guide median, big films keep the 60 key crew instead of 700+, and characters get their own page (played by / appears in) instead of opening the actor.
- **AniList:** voice actor and staff pages list their voice roles and staff credits.
- **OMDb, Rotten Tomatoes, AniList, Kitsu:** titles with only a cover and banner get a Posters gallery; ratings tables with no ratings are hidden for every source.
- **All sources:** a dropped connection (`fetch failed`) is retried twice and one flaky TMDB season no longer fails a whole title; a developer probe (`tests/tools/probe-sources.js`) checks search, details, cast, characters, episodes and every linked page against live APIs with keys from the environment.

### Backup compression

- The Android app now compresses exports too: library exports and the automatic safety backups are written as streamed gzip (`.json.gz`, about 10x smaller, never held in memory) through the native plugin, which can now write binary chunks and picks a gzip file type. WebViews without compression keep writing plain `.json`.
- Import decides by content, not file name: a plain JSON called `.gz` or a gzip called `.json` both open, empty files and damaged / truncated compressed backups give clear messages, and the file picker lists gzip files. Folder recovery reads compressed backup copies and the backup detection recognises `.json.gz`.

### Performance

- Grid and list posters request smaller TMDB (`w342`) and TVmaze (`medium_portrait`) renditions instead of the full-size artwork, with a one-time fallback to the original if the host does not have it; detail pages, heroes and landscape art keep full size. Image hosts (TMDB, TVmaze, AniList) are preconnected.

- Series, Movies and Favorites (and Watchlist / Profile) were rebuilt every 300 ms during a background metadata refresh and every 1.5 s while Quick setup / restore downloads ran, which restarted every poster's image loading and made even 10 titles lag. Only the Sync status and Settings pages re-render during those jobs now.
- Poster progress bars on those pages no longer wait up to 4 seconds when a title has no picture yet or its picture is deferred: they show immediately, with a 1.5 s safety limit.

- Logs and library history are cached in memory and written once per burst (adding 30 titles used to parse and rewrite up to 2000 stored rows 30 times); the settings pages read the cache and nothing parses them on ordinary renders.
- Identical in-flight metadata requests share one network call, transient 429 / 502 / 503 / 504 responses retry once, and pull-to-refresh now refreshes the response cache (it used to skip writing it).
- Details pages no longer rebuild the watched-episode array on every render, and unused per-render work (per-season upcoming scans, unused statistics and timeline lookups, a document-wide DOM scan) was removed.
- The mutation-revision map no longer grows for the whole session; dead code and a duplicate settings key were removed after a static lint pass (no undefined variables remain).

### Fixed

- Discover search placeholders now look like the results that replace them: one shelf per source (source name header and a rail of cards) when searching all sources, and one three-column grid with the source name when a single source is selected. They used to be a generic grid unlike the page.
- Sync status page (new additions, Quick setup and restore): it updates as title and episode-artwork progress changes, keeps its list across navigation and restarts, resumes unfinished work on launch, hides the empty "No refresh history" box while downloads exist, goes back to the library, and has Retry failed and Clear finished buttons.
- Backup formats: **CSV** now exports year, status, progress, goal, favorite, review, source, source id, id and dates (not just names) and imports them back; **TXT** exports `Title (Year)` and reads that form; **JSON** can be saved gzip-compressed (`.json.gz`, about 10x smaller in browsers) and the importer opens `.json`, `.json.gz` and `.sqdb`.
- Restore now syncs: every restored title with a source and id is downloaded through the queue (progress on Metadata Sync → Refresh status), and names-only titles (TXT, CSV or old backups) are first matched to a source by an exact title (+ year) search, with a clear "No exact match" status and Retry when none is found.
- Quick setup shows "Please wait while the sources load data…" with a spinner above the loading placeholders.
- Thumbnails after a restore: posters kept in memory were written to the cache with an empty signature (ignored, then cleaned up as stale) because the folder write assigns the real one later. They are now held (up to 300) until the folder write finishes, then stored with the correct signature; no more slow re-reads of those files.
- The artwork catalog skips titles whose pictures did not change, so progress and status updates no longer delete and rewrite hundreds of image rows.
- Adding a title from Discover or Quick setup matches an existing title by source and source id first, so the same title is not added twice under a different spelling or year.
- The Quick setup wizard now opens on a fresh install, including after the first storage-folder choice, instead of only from Profile ⋮ → Quick setup.
- Cast / Characters / Staff **Full list** and **Collapse** now work: the expanded list wraps into a grid and Collapse returns to the sideways rail.
- A page whose script did not register no longer throws `SplitAppPages[page] is not a function`; the app logs it and falls back to Watchlist.
- Cast & Crew rails scroll sideways again: the tab panel grid stopped its children from shrinking, so the rail stretched to its full width instead of scrolling.

## [0.1.4] — 2026-11-09

### Added

- Quick setup wizard for fresh installs: pick series you already watched, series you want to watch, movies you already watched and movies you want to watch from trending titles or search. It is also available from Profile ⋮ → Quick setup.
- Edit profile page (pencil badge on the avatar): choose the profile photo and background cover from library posters/backdrops, your own photo or none, with random/newest picks, per-source filters and change intervals (every launch, hourly, daily, weekly or manual). Library pickers page and lazy-load.
- Discover Grid / List / Cards view toggle; Cards prefer landscape backdrops (TMDB, AniList, Kitsu, TVmaze background images) with posters as the fallback.
- Discover suggestion shelves from MyAnimeList (Jikan) and Kitsu, with the contributing source names shown when several sources supply a shelf.
- Favorites pages with no favorites open a quick-setup style picker that lists the titles already in your local library (series or movies) with local search; picked titles become favorites. The Profile favorites boxes are tall "Add favorites" boxes that open it, and Later returns to Profile.
- Favorites, Series and Movies collections load more titles automatically as you scroll.
- Library posters show a shimmer placeholder until the thumbnail is ready, then the progress bars animate up to their values; the animation replays when the status grouping (eye button) or filters change. Reduced motion turns it off.

### Changed

- Discover Shows / Movies tabs are always visible above the search bar, Shows first, styled like the Watchlist tabs.
- Watchlist tab limits: Watching shows the 50 most recent, Not started yet the 30 most recently added and Haven't watched for a long time the 20 most recent.
- Profile menu is a compact bottom sheet (Timeline, Quick setup, Sources, Settings, About); the "My Profile" heading and tracked-title count were removed.
- Nav bar background Solid, Glass and Transparent are now visibly distinct; Transparent starts at 30%.
- Discover grid text lines up with the posters, shelves share a 20 px inset, and tapping a title opens its details. "You might also like" is a left-aligned swipeable poster rail.
- Setting a movie to Completed fills its runtime (and Watchlist clears it); vertical episode-rating columns are compact.
- Statistics → Activity page and its Profile menu entry were removed; Timeline covers it.
- Opening a saved title refreshes it from its source at most once a day (pull-to-refresh or Refresh forces it), and a refresh now writes only the fields that changed, leaves your status, progress and notes alone, and shows an "Updated from …" note listing what changed.

### Fixed

- Mobile Watchlist swipe between tabs works from anywhere (including over tiles) and cast / crew rails scroll sideways.
- Quick setup's Next / Skip / Finish button stays pinned to the bottom of the screen.
- Animation settings now also drive the library poster placeholders and progress bars (Animate progress, Progress style, Loading placeholders, Placeholder animation) and the Profile ⋮ sheet (Sheets and dialogs).
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

- Episode thumbnail sync no longer copies the Jikan series cover onto every episode. Missing stills are filled only from one exact TVmaze title/year match and matching season/episode numbers; native stills keep priority. Synced local stills now appear on episode detail pages, including offline, instead of falling back to the series poster.
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
