# ScreenMark change report

This report describes the current uncommitted ScreenMark worktree as inspected on 2026-11-08. “Before” describes the prior tracked implementation; it does not imply every previous behavior was broken. The changes span app behavior, persistence, Android storage, metadata transport, UI cleanup, styling, release metadata, and documentation.

## Scope and verification

- At initial report creation, the worktree contained 44 changed tracked files (including four deletions) and two untracked logo assets. The source-file entries below describe that captured diff; later follow-up edits and checks are recorded at the end.
- The work includes earlier changes already present in the tree plus lazy-image and dead-code cleanup, bounded large-library rendering, encrypted empty-backup restore, timer-overflow handling, and the final ID-index miss-path optimization. This report describes the combined diff against Git’s current `HEAD`.
- Verified during this work: JavaScript syntax checks, `git diff --check`, all 7 frontend CSS files parsed without errors, all 38 local script/stylesheet/icon references in `frontend/index.html` and CSS local URLs resolve, the 1,200-item collection smoke check rendered 100 cards initially and 200 after one batch, and isolated IndexedDB exercises wrote/read 10,000 and 20,000 lightweight records and then cleared the test rows. In the 10,000-row run, full write/read measured about 271/79 ms and a one-row update about 3 ms; these are headless desktop-browser timings, not Android performance guarantees.
- Android 13 device `JB7LZHZHXWV4AYON` (RMX3242) is connected and was visibly unlocked during the latest pass. The current debug build is installed and MainActivity is resumed. Route screenshots and WebView route checks were performed on-device; live provider sync could not be verified because Android reported no network connection.
- No files were staged or committed. The two `report.md` files are new reporting artifacts and are not application resources.

## Release and project documentation

### `CHANGELOG.md`

**Purpose:** User-facing history of released and planned changes.

**Before / addressed:** The current version had no 0.1.3 entry, leaving the storage, sync, security, UI, and cleanup work undocumented.

**Change:** Adds the 0.1.3 sections for source-specific detail navigation, bounded metadata refresh, incremental IndexedDB writes, thumbnail/object-URL cleanup, lazy posters and placeholders, 100-item collection/watchlist batches, safer backup handling, proxy restrictions, low-resource behavior, removed renderers, and fixes. The wording records features and fixes rather than claiming the overall audit is complete.

### `README.md`

**Purpose:** Project overview, app capabilities, setup, and release build instructions.

**Before / addressed:** It identified the app as 0.1.2 and did not explain the static reduced-motion startup behavior or link readers to the full current technical details.

**Change:** Updates the displayed release to 0.1.3, documents the static startup mark when motion is reduced/off, and points to the expanded storage/release documentation.

### `docs/README.md`

**Purpose:** Index for the documentation set.

**Before / addressed:** The index described the older app snapshot and omitted the updated storage/sync guide coverage.

**Change:** Refreshes the version/feature summary and links to the current guides and release notes.

### `docs/app-walkthrough.md`

**Purpose:** Explains routes, pages, interaction, motion, and settings to app users.

**Before / addressed:** It did not describe the current low-resource/reduced-motion startup behavior or lazy artwork placeholders.

**Change:** Documents those behaviors, 100-item paging for large collection and watchlist sections, and current route/page terminology so readers do not expect the removed Dashboard/Search screens.

### `docs/db-schema.md`

**Purpose:** Defines the portable JSON and IndexedDB records.

**Before / addressed:** It described a localStorage-centered library and described cast data as part of saved facts, which no longer matched the storage path and cast persistence policy.

**Change:** Documents IndexedDB `items`, `meta`, and `thumbs`; the small localStorage mirror; JSON shape validation; deferred migration persistence; thumbnail signatures; provider-specific item identity; local episode guides; and the rule that cast records are not persisted.

### `docs/storage.md`

**Purpose:** Describes browser and Android storage, refresh, image cache, export, and backup behavior.

**Before / addressed:** It omitted worker fallback/recovery, cache cleanup, automatic refresh scheduling, retention, and how lazy poster reads work.

**Change:** Explains IDB schema/index removals, ordered worker fallback, startup reconciliation, online refresh intervals/backoff, lazy Blob thumbnail lookup and placeholders, TAR/JSON/encrypted backup behavior, and cache namespace boundaries.

### `frontend/README.md`

**Purpose:** Maintainer map of the frontend modules and local packaging workflow.

**Before / addressed:** It listed removed Dashboard/Search modules, described `library.js` as a card renderer, omitted the sync page, and did not document current image-helper ownership.

**Change:** Updates module descriptions, removes deleted renderers from the map, describes the shared lazy poster helper, and records legacy hash aliases and the active app-shell script workflow.

## Version and Android build

### `frontend/app-config.js`

**Purpose:** Supplies app identity, categories, and displayed version to frontend code.

**Before / addressed:** Its version was 0.1.2 while the release files and changelog move to 0.1.3.

**Change:** Sets the app config version to 0.1.3.

### `package.json`

**Purpose:** Node package metadata and local serve/Capacitor scripts.

**Before / addressed:** Package version lagged at 0.1.2.

**Change:** Bumps the package version to 0.1.3. The existing scripts and runtime dependencies are retained.

### `package-lock.json`

**Purpose:** Locks npm dependency resolution.

**Before / addressed:** Root package metadata was still version 0.1.2.

**Change:** Synchronizes the root package and lockfile version to 0.1.3; this diff does not add a new npm runtime package.

### `android/app/build.gradle`

**Purpose:** Android application ID, build/version configuration, and native dependencies.

**Before / addressed:** Android still declared version 0.1.2/code 102, and the handwritten TAR implementation lacked robust PAX/long-path support.

**Change:** Bumps Android version to 0.1.3/code 103 and adds Apache Commons Compress for streaming PAX-compatible TAR archives.

## Android native files

### `android/app/src/main/java/com/cuemark/screenmark/BackupFolderPlugin.java`

**Purpose:** Android Storage Access Framework (SAF) bridge for choosing folders and reading/writing backup/database/image files.

**Before / addressed:** Several stream/cursor paths relied on manual closure; TAR generation was handwritten and buffered file contents; TAR restore did not expose a matching entry-read operation; and startup could not query the remembered folder URI through this plugin method.

**Change:** Uses try-with-resources for streams and cursors, closes failed/in-progress exports safely, exposes remembered-folder lookup, reads TAR entries, and creates TAR archives through Commons Compress with UTF-8/PAX long-name and large-number handling. File contents are copied in chunks rather than accumulated into another whole-file byte array where the TAR path is used.

### `android/app/src/main/java/com/cuemark/screenmark/BackupSchedulerPlugin.java`

**Purpose:** Schedules daily encrypted background backups with Android WorkManager.

**Before / addressed:** The scheduler did not retain a user-selected backup count for later cleanup.

**Change:** Saves a clamped retention setting (3–20, default 10) alongside the remembered backup-folder settings before scheduling work.

### `android/app/src/main/java/com/cuemark/screenmark/CacheManagerPlugin.java`

**Purpose:** Clears temporary Android/WebView cache data on request.

**Before / addressed:** Cache clearing removed the WebView cache but left app-owned staged share-image files behind.

**Change:** Also recursively removes the app’s `shared-images` cache directory. It remains scoped to temporary files; library and backup data are untouched.

### `android/app/src/main/java/com/cuemark/screenmark/EncryptedBackupWorker.java`

**Purpose:** Periodically copies encrypted app state to the selected SAF folder.

**Before / addressed:** Background backups accumulated without applying the configured retention count, and the worker had no safe listing/deletion pass.

**Change:** Reads the stored retention setting, lists only ScreenMark `.sqdb` backup files using a closed cursor, sorts newest first, and deletes files beyond the bounded retention count. Pruning failures are treated as best-effort so they do not invalidate a successfully written backup.

### `android/app/src/main/java/com/cuemark/screenmark/EncryptedStorePlugin.java`

**Purpose:** Stores encrypted per-title records and metadata and exports/restores the encrypted database format.

**Before / addressed:** Backup restore could update the legacy aggregate record without replacing all per-item keys, allowing deleted items absent from a backup to remain and reappear. The backup export also did not consistently package the current per-item store as a snapshot.

**Change:** Packs current encrypted records in the v2 backup envelope; validates/decrypts records before restore; reconstructs the library/meta response; and clears/replaces stored keys from the archive so records absent in the restore cannot survive. It preserves compatibility with the prior single-blob encrypted format and uses synchronous commit results to report persistence failure.

### `android/app/src/main/java/com/cuemark/screenmark/ShareIntentPlugin.java`

**Purpose:** Native bridge for saving/sharing generated PDFs and artwork, including chunked WebView transfers.

**Before / addressed:** Temporary chunk and staged image files could survive failed operations, accumulate across repeated share jobs, or remain after the staged list was cleared.

**Change:** Adds bounded pruning for old share files, centralizes chunk close/delete cleanup, deletes temporary source files after save/failure, and tracks staged image files so clear/failure paths can reclaim them. The bridge still returns the same share/save results to the UI.

## Local development server and security

### `dev-server.js`

**Purpose:** Serves the frontend locally and proxies allowlisted provider APIs for browser preview.

**Before / addressed:** CORS was wildcarded; proxy requests accepted broader forwarded headers; response bodies were read without a size cap or timeout; URL/path checks were weaker around ports, traversal, and symlinks; and proxy errors could expose raw upstream details.

**Change:** Restricts preview CORS to this local server’s loopback origin, validates HTTPS and allowlisted host/port/path/method combinations, limits which upstream hosts receive authorization/cookies, sets a 25-second abort timeout and 12 MiB response cap, removes upstream error detail from client responses, and checks resolved filesystem paths against the real root to reject traversal/symlink escape.

## Frontend runtime, persistence, and data sources

### `frontend/app.js`

**Purpose:** Main SPA state, routing, persistence coordination, metadata refresh, interactions, lazy image loading, and startup restore.

**Before / addressed:** It retained dead Dashboard/Search behavior and mixed/legacy state assumptions; malformed stored JSON could throw or be migrated/saved before canonical IndexedDB restore; sync retry/resume edge cases and worker count were not consistently bounded; and poster views did not share one deferred local-thumbnail path.

**Change:** Validates stored record shapes and nested preference objects; defers migration writes until restore; routes legacy hashes to active pages; removes dead Dashboard-specific rendering and an uncalled search rerender helper; adds bounded/visibility-aware metadata workers with retry scheduling; adds the shared poster helper, bounded deferred-image queue and object-URL cache cleanup; and reconnects resolved thumbnails to detail image viewing. The most recent pass also standardizes async decoding and broken-image fallbacks.

### `frontend/backend/app.js`

**Purpose:** Browser/Android persistence adapter, portable JSON handling, folder tree sync, encrypted storage bridge, and artwork hydration.

**Before / addressed:** Folder/encrypted and IDB data reconciliation had more full-snapshot work than necessary; malformed mirrors/records were trusted in some paths; thumbnail hydration could accept invalid image/path values; TAR restore/backup flow and item-tree paths were incomplete.

**Change:** Normalizes JSON objects and item/history arrays, filters malformed records, writes changed records incrementally when possible, preserves full snapshots for import/reset paths, serializes native writes, bounds image hydration and folder-sync workers, closes SAF operations through the plugin, restores TAR snapshots, and sanitizes thumbnail references/data URLs while keeping provider-specific title folders.

### `frontend/backend/features/discover.js`

**Purpose:** Provider request transport, Discover search/suggestions, image URL handling, and metadata Cache Storage.

**Before / addressed:** Network calls could hang; redirects and non-HTTPS destinations were not uniformly rejected; native HTTP compatibility had an extra fallback; cache failures could delay requests; and Cache Storage lacked bounded pruning.

**Change:** Validates endpoint schemes/credentials, rejects redirects, adds a 25-second abort timeout, narrows native transport selection, constrains localhost preview behavior, puts cache waits behind a timeout that always settles, and adds metadata cache pruning/limits. The server proxy provides the corresponding host and body restrictions.

### `frontend/backend/features/metadata.js`

**Purpose:** Registry and metadata-source descriptors used by search, details, and refresh.

**Before / addressed:** Source capability declarations and behaviors needed to align with the provider-specific detail/ref UI and current source registry.

**Change:** Updates source metadata/configuration used by the common source-specific routes and source enablement checks. This file remains the single registry used by UI and backend; it does not introduce a mixed-source merge layer.

### `frontend/backend/features/show-detail-controller.js`

**Purpose:** Loads provider-specific movie/series/episode/person details, guides, images, and linked references.

**Before / addressed:** Provider-specific follow-up fetches and pagination needed stronger bounds/error handling, and detail links needed to retain the provider identity when opening episode/person pages.

**Change:** Uses bounded `mapLimit` work for provider subrequests, adds safer pagination limits/failure messages, handles AniList GraphQL error payloads, and carries source identity through supported references so results render through the common in-app detail templates.

### `frontend/backend/idb-store.js`

**Purpose:** IndexedDB schema and worker-facing operations for library records, metadata, and thumbnail Blobs.

**Before / addressed:** The database maintained secondary indexes the app did not query, rewrote unchanged entries/meta, materialized thumbnail records via `getAll`, accepted weak thumbnail shapes, and worker failure could strand/drop queued operations.

**Change:** Removes unused indexes/share-cache store, performs signature-based incremental writes, validates history/preferences/items and Blob records, iterates thumbnail keys with a cursor, adds targeted thumbnail deletion, and retries pending worker operations in order via a warmed main-thread fallback with timeout/error handling.

## Frontend components and page templates

### `frontend/components/library.js`

**Purpose:** Shared episode-guide progress calculations used across tracking, profile, and Details.

**Before / addressed:** It also contained Dashboard/Search card and filtering renderers after those destinations had been discarded; episode summaries repeatedly sorted/scanned the same guide during rerenders.

**Change:** Removes the orphaned card/filter/list implementation, keeps the shared episode calculation API, and caches episode summaries/progress in WeakMaps keyed by item and guide/watched-list references. Computation remains recalculated when those source references change.

### `frontend/components/share-list-pdf.js`

**Purpose:** Builds a multi-title PDF document from list metadata and already loaded covers.

**Before / addressed:** It retained small unused canvas/blob/star helpers after the PDF rendering pipeline moved into the shared performance helper.

**Change:** Removes those unused helpers; current PDF composition and image encoding continue through the active rendering path.

### `frontend/components/share-title.js`

**Purpose:** Builds and opens a one-title share sheet.

**Before / addressed:** It duplicated native-share lookup and image/blob conversion helpers already provided by the shared performance/native bridge path.

**Change:** Removes those unused duplicate helpers and uses the common sharing implementation.

### `frontend/components/share.js`

**Purpose:** Builds collection PDFs and coordinates preview, save, and share actions.

**Before / addressed:** It depended on an IndexedDB PDF cache with no active readers/benefit and allowed the cover job map to grow without a bound.

**Change:** Removes cache get/put wiring and the corresponding cached render branch, bounds the in-memory cover-job reuse map to 64 entries with recency updates, and uses temporary native/browser share files managed by their owning platform paths.

### `frontend/index.html`

**Purpose:** The sole web app shell and the ordered script/style entry point for browser and Capacitor.

**Before / addressed:** It included the unreachable Dashboard script and unused default Capacitor/favicon resources; startup animation did not fully honor the static reduced-motion path.

**Change:** Removes those dead references, updates app-shell version/branding links, retains only active page modules, and selects the static mark/short startup path when reduced motion or Motion Off is active.

### `frontend/pages/dashboard.js` — deleted

**Purpose:** Former Dashboard page renderer.

**Before / addressed:** It was unreachable after the app navigation changed to separate Shows, Movies, Watchlists, and Discover, but remained as unused code.

**Change:** Deletes the renderer and removes its script include; legacy route hashes remain handled by the router.

### `frontend/pages/search.js` — deleted

**Purpose:** Former library Search page renderer.

**Before / addressed:** It was not the active online Discover/search flow and no longer had a valid navigation target.

**Change:** Deletes the stale renderer; `#search` remains a route alias to Discover rather than a separate page.

### `frontend/pages/details.js`

**Purpose:** Shared title, episode, cast/person, and related-detail templates.

**Before / addressed:** Some provider references lost their source when opening a child item; some image links accepted unsafe credential-bearing or non-HTTPS URLs; detail hero posters bypassed the local deferred cache; and lazy image tags had inconsistent decode/error handling.

**Change:** Preserves source identity on references, requires safe HTTPS links, uses the shared deferred poster helper in detail heroes and updates the zoom trigger after cache resolution. Lazy media images decode asynchronously and hide broken artwork while leaving their slot background/fallback visible.

### `frontend/pages/discover.js`

**Purpose:** Discover search and source-separated catalog UI.

**Before / addressed:** One app interaction/render path needed to align with the current route and shared discovery/source page conventions.

**Change:** Small template/interaction adjustment in the active Discover page; the provider results remain grouped by source and use the shared internal detail flow.

### `frontend/pages/profile.js`

**Purpose:** Profile overview, series/movie collections, favorites, and watchlists.

**Before / addressed:** Artwork paths were rendered directly instead of consistently reading saved thumbnail Blobs lazily; some missing images lacked a visible fallback; and portrait-local art was omitted from one poster selector.

**Change:** Routes eligible posters through the app-wide deferred image helper, adds explicit placeholder siblings for failures/missing art, retains direct episode stills as episode images, marks images lazy/asynchronously decoded, and includes local portrait data in poster selection.

### `frontend/pages/settings.js`

**Purpose:** Settings overview and settings detail pages.

**Before / addressed:** The settings copy/icon metadata and route controls lagged current grouping and sync labels in a few places, and did not consistently describe the active features.

**Change:** Updates small settings labels/descriptions/icons and current page references for active animation, storage, and metadata refresh controls. It does not add Dashboard controls back into the UI.

### `frontend/pages/statistics.js`

**Purpose:** Statistics overview and subpages.

**Before / addressed:** Empty-state navigation linked to the removed Dashboard.

**Change:** Sends users to the current Shows Watchlist library route.

### `frontend/pages/sync.js`

**Purpose:** Shows progress, outcome, and retry actions for metadata refresh.

**Before / addressed:** The view counted only changed records as “done” and showed little identifying context for each refresh row.

**Change:** Separates changed/updated from unchanged/checked counts, displays a user-friendly status label, and includes source, category, provider ID, and last checked time when the corresponding local title is available. Failed rows keep per-title retry actions.

## Stylesheets

### `frontend/styles.css`

**Purpose:** Shared base layout and component styling.

**Before / addressed:** It retained selectors for deleted Explore/Dashboard layouts and stale collection status groups.

**Change:** Removes those no-longer-rendered rules while retaining common collection, share, detail, and responsive styling.

### `frontend/styles/demo-pages.css`

**Purpose:** Main active visual system for detail/profile/watchlist and demo-style page layouts.

**Before / addressed:** Large blocks of selectors targeted removed Dashboard/legacy surfaces; shared artwork and page rules were mixed with dead styles.

**Change:** Removes dead selector blocks and adjusts remaining active page layout/artwork styling. The active placeholder classes for profile/watchlist and detail slots remain styled.

### `frontend/styles/ios-ui.css`

**Purpose:** Shared iOS-style page and component presentation.

**Before / addressed:** It retained styles for pages/layouts no longer rendered and had overlapping selectors after navigation/page changes.

**Change:** Removes obsolete Dashboard/Explore styling and updates active common hero, page, and artwork rules.

### `frontend/styles/motion.css`

**Purpose:** Motion, transitions, and low-resource visual behavior.

**Before / addressed:** Motion rules still included effects associated with discarded pages and did not fully reflect the app’s reduced-motion/low-memory path.

**Change:** Cleans stale selectors and tunes active transition/animation rules to keep reduced-motion and low-resource presentation lighter.

### `frontend/styles/ui-polish.css`

**Purpose:** Refinements for settings sheets and shared interface controls.

**Before / addressed:** It included stale Dashboard/Explore-specific polish alongside active settings and common UI rules.

**Change:** Removes dead selectors and keeps styling attached to current controls/pages.

## Removed frontend resources

### `frontend/favicon.png` — deleted

**Purpose:** Prior raster favicon.

**Before / addressed:** The app shell now uses the branded SVG favicon, making this separate PNG unreferenced.

**Change:** Deletes the unreferenced duplicate resource.

### `frontend/icons/Capacitor.svg` — deleted

**Purpose:** Capacitor starter branding mark.

**Before / addressed:** It was default starter artwork with no active use in ScreenMark UI.

**Change:** Deletes the unused starter asset.

## New logo assets

### `logos/03-episode-stack-intro.gif` — untracked

**Purpose:** Source/design copy of the 512×512 Episode Stack intro animation.

**Before / addressed:** The artwork was already present under `frontend/icons`; there was no separate `logos/` source collection in the worktree.

**Change:** Adds the design/source copy. SHA-256 matches `frontend/icons/episode-stack-intro.gif`; it is not an additional runtime image payload.

### `logos/03-episode-stack.svg` — untracked

**Purpose:** Source/design copy of the ScreenMark Episode Stack SVG mark.

**Before / addressed:** The active frontend mark existed only at `frontend/icons/screenmark.svg`.

**Change:** Adds the design/source copy. SHA-256 matches the active frontend SVG; it is not separately referenced by `index.html`.

## Report files

- `z/report.md` is this detailed report at the requested `z/` location.
- `z/ScreenMark/logos/report.md` is a copy of this report at the requested `logos/` location. Neither is referenced by the app shell.

## Latest review and verification (2026-11-08)

- Removed disconnected statistics watch-time, runtime-lookup, genre/status-card, and playtime presentation logic, plus its unused CSS and animation selectors from the active, demo, iOS, and motion stylesheets. Active activity and rating UI remains.
- Rechecked that no removed statistics selectors remain in frontend styles/pages/app/components. `git diff --check` and `node --check` for `statistics.js`, `app.js`, `profile.js`, and `details.js` pass.
- Re-ran the synthetic 20,000-title statistics render in the local browser: overview rendered in about 24 ms and Activity in about 21 ms; no JavaScript exception was observed. This is desktop browser evidence, not a low-memory Android 20K dataset test.
- Latest `npm run cap:sync` and Android `assembleDebug` succeeded. Installed the resulting debug APK on ADB device `JB7LZHZHXWV4AYON` (RMX3242 / Android 13), force-stopped and relaunched it. `MainActivity` was resumed, app PID was present, and sampled total PSS was about 85 MB. No app fatal exception or WebView crash appeared in the inspected log window. Android emitted an unrelated Chromium variations-seed missing-file warning in an earlier launch; the final inspected window showed only vendor `ofbOpen/sysOpen` missing-file messages.

The app was launched and startup checked on-device. This pass did not automate every UI interaction on the physical device; route and large-library UI checks were performed in the local browser.


## Continued audit note (2026-11-08)

- The app's ID map now builds once per immutable library-array revision, including missing-ID lookups. Details and metadata-parent resolution use this shared lookup, avoiding a full library scan on every stale ID. All ID-changing library operations replace the array and invalidate the map.
- Canonical-route smoke test: 14 routes (Discover, both watchlists, series/movies/favorites, Statistics and Activity, Timeline, Settings, Sync, Profile, Add) all rendered route content; no browser runtime exceptions were observed.
- Final Android source sync and debug build succeeded; the APK was installed and relaunched on `JB7LZHZHXWV4AYON`, with MainActivity resumed and ~84 MB sampled PSS.
- Hardened the local preview static-file streaming path against read failures and client disconnects so a file race does not leave an unhandled stream error; smoke checks returned 200 for existing assets, 404 for a missing asset, and 403 for a forbidden proxy destination.
- Thumbnail ingestion now rejects oversized streamed and inline responses before retaining them, caps output canvas width and height, and closes decoded bitmaps on success or failure. `node --check frontend/backend/app.js` passes.
- The ADB device is awake but showing the secure lock screen/notification shade; screenshots are black and the foreground is not visually exposed. Therefore device evidence confirms install, resumed Activity, live PID and memory only. Interactive UI validation is from the local browser, not the locked phone.
- All seven loaded stylesheets exposed readable CSSOM rule lists in Chromium; 38 local index references and all local CSS `url()` assets resolve.
- Thumbnail response handling also rejects explicit non-image content types instead of persisting HTML/error responses as corrupt artwork.
- Rechecked every frontend JavaScript file with `node --check`, the dev server separately, and `git diff --check`; all pass. Chromium exposed 3,275 CSS rules across the seven stylesheets with no CSSOM parsing exceptions.
- Android folder `readBinaryFile` now supports an optional streaming byte cap; saved-artwork reads use 16 MB while TAR/archive operations and legacy artwork migration keep their previous unlimited behavior. This limits base64 memory spikes without truncating backup/archive data.
- Share image fetches now have a 15-second timeout and 16 MB response cap; cover loading is limited to 2 concurrent images on low-memory devices and 4 otherwise, and ImageBitmap resources are disposed after rendering/dismissal.
- After sharing and native artwork-read changes, Android `assembleDebug` and ADB install/launch passed again; `MainActivity` resumed, PID was present, and latest sampled PSS was about 85 MB. No app fatal exception or WebView crash appeared in the inspected log window. The phone remains lock-screen protected, so this is startup evidence only.
- Headless Chromium exercised a one-title PDF share with a generated cover; it completed with “Saved to your device” and the dialog was removed afterward.
- Metadata sync persistence now stores compact tuples rather than repeating title/source fields, normalizes interrupted legacy `running` entries to `queued`, bounds saved error text, and preserves prior history when an automatic check finds no due titles. In an isolated Chromium profile, a 20,000-entry state (about 689 KB) restored and rendered the summary plus 200 visible rows; a legacy running entry migrated to compact version 2 and resumed as queued.
- A representative 20,000-entry old sync-state serialization was about 4.58 MB versus 1.28 MB compact (about 72% smaller). Latest post-sync-state Android build/install/startup also passed; MainActivity resumed and sampled PSS was about 86 MB.
- With the same 20,000-record IndexedDB fixture, Movies rendered its first 100 titles (show-more showed 100 of 20,000), Movie Watchlist rendered its bounded initial five-card section, Statistics showed 20,000 titles, and Profile rendered without a large-library DOM dump.

- Metadata transport now streams browser responses under a 12 MB cap and validates native text responses before JSON parsing; oversized cached records are rejected and oversized results are not added to cache. A headless browser smoke test confirmed normal JSON parsing and rejection of a 12 MB + 1 byte response.
- Latest `npm run cap:sync` completed. Android `assembleDebug` first failed because the system-selected JDK 21 installation lacks `jlink`; rerunning with the installed complete JDK 17 succeeded. Installed the APK on ADB device `JB7LZHZHXWV4AYON`; `MainActivity` resumed and a live process was present. Post-start sampled PSS was approximately 220 MB; no fatal exception or WebView crash appeared in the inspected log window. This is a launch check, not a full interactive test; the device's lock-screen restriction still prevents visual interaction.
- `node --check frontend/backend/features/discover.js` and `git diff --check` pass after the final metadata transport change. Nothing was staged or committed.

## Startup, reconciliation and IndexedDB lock follow-up (2026-11-08)

- The active splash had a 3.5-second minimum even after the first screen was ready. It now uses a 450 ms minimum so the fade remains visible without imposing a multi-second launch hold.
- Startup reconciliation previously JSON-serialized every current library record into a second full-sized map on the UI thread. It now snapshots only item IDs and uses scoped mutation revisions to merge only records changed during async restore. Preference-only settings writes and history clear are metadata-scoped; import persists only imported/patched IDs plus metadata.
- IndexedDB connections now close on `versionchange`, clear stale connection/signature state, and release the upgrade lock. A blocked open rejects with an actionable error and closes a connection if that request eventually succeeds after the caller has failed.
- Isolated browser IndexedDB checks confirmed both a blocked-upgrade error followed by successful reopen, and automatic release/reopen during a version change.
- Canonical-route browser smoke (14 routes) exposed no JavaScript exceptions. The isolated 20,000-record profile loaded 20,000 records and rendered collection/statistics/profile/sync routes without browser exceptions.

- A fresh disposable browser database with two stale TVmaze series exercised automatic refresh end to end. Both entries completed as `done`, provider details were saved locally (The Good Wife and Almost Human), and the compact sync-state recorded a finish time; this used live provider traffic from the host browser rather than the intended fetch stub, so it validates the real desktop metadata path.
- Latest source syntax checks passed for all frontend JavaScript files and `dev-server.js`; `git diff --check` passed. `npm run cap:sync` and Android `assembleDebug` succeeded after the final reconciliation change. ADB re-install/relaunch returned `MainActivity` resumed with a live PID; sampled PSS was about 218 MB and no fatal/WebView crash lines appeared in the inspected log window.
- The connected Android device had no active network in its reported network stats and remains lock-screen protected. The physical-device result therefore validates package/install/startup/memory only; live sync and route interaction were exercised in the host browser.
- Existing Android `testDebugUnitTest` task completed successfully (`BUILD SUCCESSFUL`). The repository has only a minimal sample unit test, so this is build/test-task evidence rather than broad native plugin behavioral coverage.

## Final settings and Android verification (2026-11-08)

- Removed obsolete animation and navigation-layout preferences from defaults and runtime application; old saved values are stripped during migration. Removed the unsupported “pop” settings-sheet CSS selectors while preserving the active slide/fade settings. The legacy progress step field is no longer used; detail editing follows the category's configured progress step.
- Fixed theme persistence: startup had forcibly reset the saved theme to AMOLED. Fresh installs now default to Light, saved valid choices survive restore, and invalid values fall back to the default. A browser test selected Light using the actual picker, reloaded the app, and confirmed Light remained active; Appearance and Animations controls also rendered.
- Re-ran `node --check` over every frontend JavaScript file and `dev-server.js`, `git diff --check`, `npm run cap:sync`, and Android `assembleDebug`; all completed successfully. A Gradle command first ran from the wrong directory and could not locate `gradlew`; rerunning from `android/` succeeded.
- Reinstalled the final built APK over the existing app on `JB7LZHZHXWV4AYON` and launched it. MainActivity resumed, PID 15931 was live, and sampled total PSS was 94,220 KB. No fatal exception, app ANR, or WebView crash appeared in the inspected recent log window; one Chromium variations-seed missing-file error was present and is unrelated to app process startup.
- This final pass verified the active settings routes in desktop Chromium and Android startup. It did not unlock or automate all physical-device screens, and the device reported no network connection; device-side metadata network sync was therefore not verified.

## Metadata refresh queue scalability follow-up (2026-11-08)

- The refresh UI previously filtered the full queue five times after each completed title to calculate total/done/failed/remaining counts. That creates quadratic main-thread bookkeeping for large libraries even though network requests are concurrency-limited.
- Counts now make one scan when a sync state is first viewed, then update in constant time at each `queued`/`running`/`done`/`checked`/`failed` transition. An execution check of the actual helper verified mixed transitions, and a 20,000-entry run completed all counter transitions in about 2 ms with `done=20,000` and `remaining=0` in the host Node runtime.
- Re-ran all frontend JS syntax checks, `dev-server.js`, `git diff --check`, Capacitor sync and Android debug build. Reinstalled and launched on the ADB device; MainActivity resumed (PID 16878), sampled PSS was 96,310 KB, and no app fatal exception or ANR appeared. One Chromium variations-seed file warning persists; Android network status is disconnected, so this does not verify live device sync.

## Large-queue work distribution and route recheck (2026-11-08)

- Replaced front-removal (`Array.shift`) in metadata refresh, folder import, artwork hydration and folder mirroring work queues with shared cursor reads. Concurrent workers now claim each next job in constant time instead of moving the remaining array on every dequeue. `Array.shift` remains only on the intentionally capped 50-entry detail navigation stack.
- A 20,000-job/three-worker check assigned every job exactly once in about 0.62 ms in the host Node runtime. All 15 primary routes (Discover, watchlists, collections, favorites, Statistics, Timeline, Settings, Appearance, Animations, Sync, Profile and Add) rendered text in Chromium with no runtime exceptions; all seven CSS sheets exposed valid rule lists.
- A local URL scan confirmed active index and CSS assets resolve. It also detected `../local-secrets.js`, an intentionally optional, Git-ignored file used only when opening `file://` previews; that conditional developer integration is documented in `docs/file-schema.md` and is not an app runtime asset.
- Rebuilt and reinstalled the final cursor-queue APK. MainActivity resumed on `JB7LZHZHXWV4AYON` (PID 17616), sampled PSS 99,919 KB; no app fatal exception or ANR appeared. The device remains disconnected from the network, so provider sync validation remains browser-only.
- Final race review found workers could all pass the pre-wait cursor check before an idle/request-delay await, then over-claim the queue tail. Sync and folder-mirroring workers now recheck the cursor after their wait and before claiming a job. An async stress check with 1, 2, 3, 4 and 20,000 jobs confirmed exactly-once claims across three workers.
- Rebuilt and reinstalled that race fix; MainActivity resumed (PID 18238), sampled PSS 100,002 KB, with no app fatal exception or ANR in the inspected log window. `node --check` for all frontend scripts, `dev-server.js`, `git diff --check`, Capacitor sync and Android build all passed.

## IndexedDB overlap and settings template follow-up (2026-11-08)

- In a disposable Chromium browser context, exercised the real data-worker facade with overlapping `saveSome` requests for one record and confirmed version 2 won. Then applied a full save followed by a scoped save and confirmed version 4 remained. This checks same-key IndexedDB write ordering without modifying the regular browser profile.
- Removed an unused `themeOptions` array and unused icon/open parameters from the active custom-source settings step helper. The live custom-source form still renders its two numbered setup steps plus its optional third details step.
- Latest frontend JS syntax checks and `git diff --check` pass; Capacitor sync and Android `assembleDebug` succeeded. Reinstalled/launched on ADB: MainActivity resumed (PID 19633), sampled PSS 214,844 KB. No app fatal exception or ANR appeared in the inspected log window. Android reported no network; device sync remains unverified.

## Background metadata request payload follow-up (2026-11-08)

- Background TVmaze detail loads now request episodes/seasons/aliases only; they no longer embed cast, crew and image collections or fetch four full TVmaze show-catalog pages for suggestions. Interactive details continue to request and display those sections.
- Background AniList GraphQL omits staff, characters, relations, recommendations and trailer fields; interactive detail queries keep them. Background TMDB requests only the core title, external IDs and ratings/certifications, and skips recommendation pages; interactive TMDB detail still has cast, images, recommendations and other UI data.
- Saved-title hydration is now explicitly marked background so newly added library entries use the reduced query shape. Metadata sync already used this flag.
- Mocked provider integration verified background TVmaze and TMDB each use one request (previous foreground behavior used five and three respectively), while foreground requests retained cast/suggestion sections. AniList query assertions verified background excludes cast/recommendation fields and foreground includes them. No provider network access was needed for these checks.
- All frontend JS syntax checks, `dev-server.js`, `git diff --check`, Capacitor sync and Android debug build passed. Reinstalled/launched on `JB7LZHZHXWV4AYON`: MainActivity resumed (PID 21723), PSS 213,707 KB. No app fatal exception or ANR appeared in the inspected buffer. The Android device remained disconnected from network, so live device provider requests were not tested.

## Detail loading placeholders and motion follow-up (2026-11-08)

- Detail pages now reserve space only for source data that is still missing: synopsis lines, production fact rows, an artwork strip, and (for series) episode rows. Existing cached/local data suppresses its corresponding placeholder, so populated sections do not get duplicated with generic skeleton cards.
- Replaced the visible redundant “Loading full details…” line with an accessible live status while the shaped placeholders preserve the page layout. Shimmer is enabled by default for new users; saved preference, Reduced Motion, system reduced-motion, and low-end performance settings can still disable animation.
- `node --check` on `frontend/pages/details.js` and `frontend/app.js`, `git diff --check`, Capacitor sync, and Android debug build passed. Installed and launched the final accessibility-adjusted build on `JB7LZHZHXWV4AYON`; MainActivity resumed (PID 23884) and no app fatal exception or ANR appeared in the inspected log window. Device network is disconnected, so live provider loading remains unverified on-device.

## Movie detail section layout follow-up (2026-11-08)

- Movie metadata previously placed production facts, media and other provider sections together in Overview. Movie pages now group content into Overview, Details, Media, Ratings and Cast & Crew tabs, showing Media, Ratings and Cast only when the corresponding source data exists. The Details tab always includes saved/source facts and other available metadata. Series tab routing and episode behavior remain unchanged.
- Movie tabs use a horizontally scrolling row on narrow screens. Headless Chrome rendered the actual app CSS at 360 px: the row was 332 px wide with 351 px of tab content, so labels remain at intrinsic width and can be reached by horizontal scrolling rather than being compressed.
- Targeted renderer smoke checks confirmed movie synopsis, director, trailer, and the Overview/Details/Media/Ratings panels land in their intended sections. A separate series renderer smoke check confirmed the Episodes panel, episode row and series tab styling remain intact.
- Frontend syntax and `git diff --check` passed. Capacitor sync and Android debug build succeeded; the APK was installed/launched on `JB7LZHZHXWV4AYON`, MainActivity resumed (PID 25094), sampled PSS was 170,114 KB, and no app fatal exception or ANR appeared in the checked log window. The device remained offline, so live provider responses and a real library movie screen were not verified on-device.

## Episode and cast artwork delayed-load follow-up (2026-11-08)

- `loadDetails()` previously awaited Android folder image reads before it even started source detail loading or rendered its loading state. Local file access could therefore delay the episode/cast UI, and images restored after a full refresh could appear to be refresh-dependent. Local detail images now hydrate asynchronously, merge into existing per-title image data, and trigger a rerender only if the same title is still open; provider requests and initial rendering proceed immediately.
- The active detail panel now promotes only nearby lazy images (up to 36 candidates, bounded by the viewport) to eager loading. This applies on initial render and after changing tabs, so hidden cast/episode images get prioritized when their panel becomes visible while offscreen images remain lazy. Geometry is read as a batch before changing loading hints to avoid per-image layout read/write churn.
- All frontend JS files and `dev-server.js` passed `node --check`, and `git diff --check` passed. Capacitor sync and Android debug build succeeded. Reinstalled/launched on `JB7LZHZHXWV4AYON`: MainActivity resumed (PID 25854); no app fatal exception or ANR appeared in the inspected log window. Device network remains disconnected, so remote image delivery/provider loading could not be exercised on-device.

## JSON and single-title database hot-path follow-up (2026-11-08)

- Editing a title previously used `JSON.stringify(old) !== JSON.stringify(entry)` to detect changes, repeatedly walking potentially large cached episodes and provider metadata on the UI thread. It now compares the 11 editable fields directly, preserves `updatedAt` and skips database writes for an unchanged form. The ID index maps IDs to array positions, so replacing an existing title at the same position reuses the map rather than scanning all titles or forcing an O(n) rebuild.
- Metadata refresh comparison previously deep-cloned provider details with JSON parse/stringify and then serialized the normalized object again. It now shallow-copies only the nested facts it edits and performs one normalized serialization. Verification against the prior normalization confirmed volatile `fetchedAt`, raw/cast records and excess screenshots remain ignored while episode changes are detected.
- A synthetic 3 MiB cached-detail edit benchmark in Node took 21.7 ms for three full-record equality checks versus 0.1 ms for three editable-field checks. A 20,000-item position-index check confirmed replacement lookup stays constant-time without invalidating the index. These are host algorithm checks, not Android-device timing claims.
- All frontend JS files and `dev-server.js` passed syntax checks; `git diff --check` passed. Capacitor sync and Android debug build succeeded. Reinstalled/launched on `JB7LZHZHXWV4AYON`: MainActivity resumed (PID 26902), sampled PSS was 198,434 KB, and no app fatal exception or ANR appeared in the inspected log window. The device was offline, so this confirms startup only, not live source sync.

## Large metadata sync queue follow-up (2026-11-08)

- The progress screen previously performed four full status filters and rebuilt a complete ID-to-item map on every render. The app now supplies its incrementally maintained counters and O(1) library lookup; the view resolves only the first 200 visible queue entries.
- Sync progress persistence now uses a small version-3 header and 256-entry chunks. Entry status changes dirty only their containing chunk, so checkpoint cost is bounded by one chunk rather than serializing the full queue repeatedly. Existing monolithic state is normalized at startup and marked for migration; interrupted `running` entries return to `queued`.
- `docs/db-schema.md` and `CHANGELOG.md` describe this format and behavior.
- A Node VM stress check (20,000 queue entries) observed 79 initial chunk writes, 2 storage writes for a one-entry checkpoint (entry chunk plus header), and successful reconstruction of all 20,000 entries with the updated status. All 25 frontend JavaScript files plus `dev-server.js` passed `node --check`; `git diff --check` passed. Capacitor sync and Gradle `assembleDebug` succeeded. The APK installed and `MainActivity` resumed on RMX3242 / Android 13; measured process memory was 87,649 KB PSS. Recent logs contained no app fatal exception or ANR; the only Chromium error was a missing optional variations-seed file. Device networking was unavailable, so live provider fetch behavior was not exercised in this run.

## Frontend/backend/CSS dead-code review (2026-11-08)

- Traced `frontend/index.html` script and stylesheet links to the registered renderers and actual `SplitAppDiscovery`, `SplitAppBackend`, and `SplitAppIDB` consumers. Dashboard/search renderers are already removed/unlinked; legacy hash routes intentionally redirect into current pages.
- Removed two unused backend facade wrappers (`getFolderUri`, `flushFolderWrites`) and narrowed the discovery facade to methods consumed by the app and detail controller. Provider parsing helpers remain private but available internally where used.
- Parsed all linked stylesheets and removed 806 qualified rules whose required CSS classes have no references in current HTML/JS. Preserved computed status classes and the dynamic episode/person/character detail-page classes. Also removed the obsolete home mockup selector from an AMOLED grouped rule.
- All seven linked CSS files parsed with zero CSS syntax errors; all 25 frontend JavaScript files and `dev-server.js` passed `node --check`. The corrected HTML graph scan found all 38 local linked assets and all eight page renderer registrations. Capacitor sync and Gradle `assembleDebug` succeeded, and the APK installed with `MainActivity` resumed. Android is currently protected by its lock screen (`mInputRestricted=true`); ADB could not unlock it without device credentials, so a visible in-app screenshot/visual regression check was not possible. The recent logs showed no app fatal exception or ANR.

- CSS cleanup size: 806 rules removed; linked CSS source shrank by approximately 85.5 KB. Parser checks report zero errors. The runtime-generated detail/status selectors were preserved in the scan. The ADB device remained locked during visual verification, and live provider sync was not tested because the device has no network connection.


## Current follow-up verification (2026-11-08)

- Reviewed the persisted metadata refresh recovery path. If a queued item now has a disabled or unavailable source/provider match, it is recorded as `skipped` and the queue advances instead of repeatedly retrying a request that cannot succeed. The status is restored across app launches and shown separately from failures. The sync history note now accurately says it displays the first 200 of the records.
- Re-ran `node --check` for every frontend JavaScript file and `dev-server.js`; all seven frontend CSS files parsed with zero syntax errors; `git diff --check` passed.
- Re-ran `npm run cap:sync` and Android `assembleDebug` successfully, installed the resulting debug APK over the existing app without clearing its library, and relaunched it. `MainActivity` resumed; a clean-start sample reported about 228 MB PSS. This is a single-device sample, not a 1 GB device guarantee.
- On the installed Android WebView, the shows watchlist, detail page for the saved Stranger Things entry, sync status, profile, movies/series lists, Discover, Timeline, Statistics, Add and Settings routes all rendered content. WebView exception capture returned zero current exceptions, and inspected logcat contained no app fatal exception or ANR. Image placeholders without a `src` were waiting for lazy activation; visible loaded images rendered.
- Provider fetch/sync remains unverified in this pass because the connected device has no network. The previous report entries describing a locked device are historical snapshots from those earlier attempts; the latest device state and checks are recorded here.
- The ScreenMark worktree currently has 47 changed tracked paths and three untracked files under `logos/`. Nothing was staged or committed.

- Additional path review found the TAR reader’s fallback only matched the nested database entry when callers requested `database.json`; the app requests its root name (`screenmark_database.json`). The reader now accepts the nested `screenmark-db/database.json` alias as well as the root file. This protects restore from archives that contain the folder tree but lack the duplicated root entry.
- Local preview custom-source requests previously went through the fixed provider allowlist and were rejected. They now call the configured HTTPS endpoint directly in localhost preview and remain governed by the endpoint’s CORS policy; fixed providers continue to use the proxy.
- Rebuilt and reinstalled after both follow-up fixes. The final build starts to MainActivity; the on-device WebView route checks still show populated watchlist/details/profile/sync pages and zero current JS exceptions. Provider network sync remains unavailable on this disconnected device.
- Local preview checks returned HTTP 200 for the app shell, 404 for a missing asset, 403 for a disallowed proxy target, and 204 with the exact localhost origin for an allowed preflight.
- The newest Android rebuild after the SAF TAR alias and native export-label cleanup also installed and launched successfully; the sync-status and saved-detail routes returned non-empty UI, and DevTools observed zero JavaScript exceptions.
- The native SAF exporter was also checked against live callers; its worker and default filename fallbacks still used the former SavePoint label. Those defaults now use ScreenMark. Removed the last orphan Dashboard-only CSS comment and collapsed its empty rule gaps without changing selectors.

- Documentation was cross-checked against the current startup/provider code: corrected the splash minimum from 3.5 seconds to 450 ms plus readiness/fail-safe behavior, documented skipped sync-entry states and TAR database fallback, and clarified custom-source CORS routing and AniList's optional exact-match TVmaze episode guide. The 0.1.3 changelog now records that AniList episode-guide behavior.
- Added a Node test suite under `tests/` with 25 passing tests covering every local HTTP route/proxy branch, each built-in metadata source's mocked search and title-detail dispatch, custom-source mapping, request validation, IndexedDB schema migration and every database/data-worker operation. `npm test` runs the suite; provider calls are fixtures and do not contact live services.
- Added cold movie/series detail-render regression tests. A series without cached guide data now exposes the Episodes tab with its skeleton immediately; cold movies keep Synopsis, facts and image placeholders under their matching tabs, and the empty Synopsis message is no longer duplicated beside the skeleton.
- Detail placeholder bars are static and each placeholder section uses one subtle sweep animation, reducing simultaneous animation work. The setting still honors shimmer-off and reduced-motion preferences.
- Rebuilt and installed the debug APK on the connected RMX3242 (Android 13) without clearing its library. On-device WebView rendering showed the cold-series Episodes tab and skeleton; computed style uses `detail-skeleton-sweep` when shimmer is enabled. This device had shimmer disabled and low-end mode enabled by its saved settings, so the app retained that preference during normal use. No fatal exception or ANR appeared after relaunch.
- Made `dev-server.js` importable with injected frontend root, fetch and logger dependencies so its HTTP routes can be tested on an ephemeral localhost port. The first suite run exposed that CORS still compared against the former global port; CORS now receives the active server instance port.
- Added `fake-indexeddb` as a development dependency, documented test coverage in the README/docs/test README, and added the suite to the 0.1.3 changelog.
- Removed the app-wide floating Add button and its shell event listener, global positioning/animation/low-end CSS hooks and obsolete page-hiding rules. Replaced the disabled Profile Edit placeholder with an accessible compact Add manually button wired to the existing Add route; updated the README, walkthrough, frontend module map and 0.1.3 changelog.
- UI verification: checked the source has no remaining floating-add references; `node --check` and `git diff --check` passed. `npm run cap:sync` and Android `assembleDebug` succeeded, then the APK was installed over the existing app without clearing its library. On-device inspection showed the Add manually button beside My Profile, no floating button, and tapping it opened the existing Add title form; no fatal exception or ANR appeared in the inspected logs.

## Documentation alignment follow-up (2026-11-08)

- Updated the README and app walkthrough to explain section-specific detail placeholders, the cold-series Episodes tab, the single shimmer sweep per section, and how low-resource/reduced-motion settings affect it. Corrected the walkthrough’s prior statement that shimmer was off by default; the code defaults it on for new installs.
- Updated the docs index and changelog wording to point to renderer coverage and state that shimmer-off, reduced-motion and low-resource preferences suppress the sweep. The README and test guide continue to document `npm test` and its 25 fixture-based checks.
- Re-ran `npm test`: all 25 tests passed. The connected Android device was present; this documentation-only follow-up did not rebuild or reinstall the APK. The prior on-device build/render verification is documented above. No files were staged or committed.
- AniList episode lookup review (2026-11-08): AniList provides the MAL cross-reference and episode count but not a complete titled episode guide. The previous fallback searched only the preferred display title and silently discarded non-exact/ambiguous TVmaze matches, causing many AniList anime to have no episode section. AniList series now request the matching Tenrai public catalogue guide, page through up to 1,200 entries, pace shared requests across concurrent sync work and retry transient failures once. Episode rows open through ScreenMark's own episode detail route. If Tenrai has no guide, TVmaze fallback checks AniList English, romaji, native, saved and synonym titles, prefers release-year matches and rejects unresolved ambiguity. Tenrai's documented Jikan-compatible API is used because Jikan's public service was discontinued on 2026-10-01.
- Added focused regressions for paginated AniList episode guides, transient retry, in-app episode details and the Tenrai-only preview proxy allowlist. `npm test` passes all 27 tests; JavaScript syntax and whitespace checks pass. The updated JS Capacitor app built, installed over the existing package without clearing its data, and launched on RMX3242 / Android 13. A read-only evaluation in its live WebView loaded Chainsaw Man's 12 Tenrai episodes and opened “Dog and Chainsaw” as an in-app episode page with a 25-minute runtime and artwork. No fatal exception or ANR appeared in the inspected logcat window. No Kotlin files were changed and nothing was staged or committed.
- Cast, character and episode loading placeholders now follow each destination layout: cast profiles hold the portrait and credit rows, character profiles hold the portrait and “Appears in” rows, and episode pages hold the still, synopsis, cast and saved-series guide when available. Loading text is announced accessibly without a visible banner shift, and shimmer remains governed by the existing low-resource and reduced-motion settings. Added focused renderer regressions; all 30 JS tests pass, with JS syntax and `git diff --check` clean. Rebuilt and installed the JS Android APK over the existing RMX3242 app without clearing data; launch succeeded and the inspected logcat window showed no fatal exception or ANR. Live provider loading on the device was not exercised in this placeholder pass. No Kotlin files were changed and nothing was staged or committed.
- Fixed duplicate JS launch animation: the Episode Stack GIF had a Netscape loop value of 1 (one repeat, so it played twice). Removed only that loop extension from the original frame-preserving GIF, kept the runtime and logo copies identical, and changed the startup gate from 6.86 seconds to one 3.43-second play plus the 500 ms ready gap. The Android native launch splash remains separate and unchanged. Added a regression test; all 31 JS tests, JavaScript syntax checks and `git diff --check` pass. Verified the APK's embedded GIF still has 53 frames / 3,430 ms with no repeat extension. Rebuilt, installed over the existing app without clearing data, and launched on RMX3242; MainActivity resumed and no fatal exception or ANR appeared in the inspected log window. Timestamped ADB screenshots show the native launch splash, one animated web intro, its completed mark held while startup finishes, then the library. `screenrecord` is unavailable on this device, so verification used screenshots rather than video. Nothing was staged or committed.
- Discover loading review found the empty state displayed six image-only rectangles even though loaded cards include artwork badges, title, year and add controls; available provider genre metadata was also never shown on suggestion/search cards. Both search and suggestion waits now use full card-shaped skeletons, including genre-chip silhouettes; suggestions preserve their Latest and Trending shelves, and loaded cards render up to two available genres. Poster artwork retains a neutral fallback until image load. Search failures clear loading UI. Added renderer tests for genre normalization/escaping and all skeleton slots; all 34 JS tests, syntax checks and `git diff --check` pass. On the connected RMX3242, the pre-fix screenshot confirmed bare poster rectangles. The final APK was rebuilt, installed over the existing app without clearing data and launched. The rendered suggestions screenshot showed Latest/Trending shelves and genre chips (Comedy, Drama, Romance, Action); a DevTools-injected one-time loading state in the live WebView showed both shelves, six cards, 12 genre-chip slots and a fixed bottom bar. No fatal app exception or ANR appeared in the checked logs; one Android Chromium variations-seed warning is unrelated. The live device has external network access during the check, so suggestions loaded; the skeleton view was verified through the same runtime renderer in WebView. Nothing was staged or committed.

### Watchlist poster layout (2026-11-08)

Poster mode previously used the base watchlist list-card layout and could display the next episode still as the cover. It now has a responsive 2:3 poster grid consistent with library posters, uses each title's own cover, and overlays its season/episode label, title, watched/total count and colored progress bar. Upcoming cards show the release countdown. Added renderer/CSS regression tests; all 37 Node tests pass. Rebuilt and installed on RMX3242 after using JDK 17 (the environment's JDK 21 install has no `jlink`), then visually verified loaded posters and overlays in the Android app. No fatal error/ANR appeared in the checked log window. Nothing staged or committed.

### Fixed mobile bottom navigation during pull (2026-11-08)

Android's WebView native edge-stretch visually shifted fixed UI when a page was pulled downward. MainActivity now disables the WebView overscroll effect and the root page blocks overscroll chaining; the JS pull-to-refresh still translates only page content. Added regression checks and updated test docs. All 39 tests pass; debug APK builds with JDK 17 and is installed on RMX3242. During a live slow pull, CDP showed the bottom bar retaining its pre-pull fixed geometry while content moved and refresh entered loading; a pull starting on sticky tabs also caused no content transform or bar movement. Recent logs show no app fatal exception/ANR. No staging or commit.

### Appearance Light accent mismatch (2026-11-08)

A live WebView showed `--accent` as `#6366f1` at the root but `#7c3aed` on the body because iOS theme CSS hard-coded an accent. Removed the theme overrides, now apply the chosen accent inline to `body`, and aligned the Light theme selection preview to default indigo `#6366f1`. This also ensures page-scoped styles cannot mask the selected accent. Added a regression test and test documentation; all 40 tests pass. Built and installed on RMX3242 without clearing data; verified Light Default `#6366f1` → Carnation Pink `#f472b6` → restored Default `#6366f1` using the actual Appearance picker. No startup fatal/ANR in checked logs; no staging/commit.
- Upcoming episode fix (2026-11-08): the app now blocks marking an episode watched before its air time across episode rows, episode detail/check-in controls, season/series bulk checks, quick progress steppers, and implicit earlier-episode marking. Upcoming list rendering excludes any already-watched episode and recalculates on render, so it no longer requires a page refresh. Date-only air dates remain upcoming through the local release day. Added `tests/upcoming-episodes.test.js`; all 43 tests pass. Rebuilt and installed over the existing RMX3242 app without clearing data; the app resumed on device with no fatal exception or ANR in the inspected logs. No files staged or committed.
- Frontend reachability audit (2026-11-08): checked all files under `frontend/` against the current `index.html`, manifest icons, CSS asset URLs, and the explicitly loaded IndexedDB worker. Removed `frontend/static/pages/settings/manage-backups.html`, a standalone redirect with no references; Settings already routes directly to Backups. Added `tests/frontend-integrity.test.js` to verify asset existence, parse every linked JS file and worker, and catch future orphan runtime files. All 46 tests pass. Capacitor copy and Android debug build succeeded and the APK installed without clearing data. The Android process remained alive with no fatal exception/ANR; startup presented Android's storage-folder picker, so I dismissed it without changing the saved folder. Nothing staged or committed.
- Discover search fix (2026-11-08): replaced the generic search container and global Enter-key special case with a semantic form; the Search button and Android keyboard submission now invoke one submit path, while Clear remains a non-submit control. Preserved the existing `discover-top-search` ID so the app's visibility and clear handlers remain connected. Search submission dismisses the keyboard. Added input normalization, query/type/source-aware rapid duplicate suppression, responsive flex sizing and visible focus styling. Regression tests cover markup, handler and CSS. All 48 tests pass; Capacitor copy and Android debug build succeed. On RMX3242, “The Office” submitted by button rendered source-grouped results; keyboard Search submitted a new query, closed the keyboard, and rendered results. The app remains foreground with no JS error, fatal exception or ANR in checked logs. No files staged or committed.

### Cross-page accent color propagation (2026-11-08)

- Updated the shared accent tokens so the Appearance choice reaches Shows, Movies, Details, Watchlists, Profile, Discover, Statistics, Settings and the bottom bar. Legacy gradients and page glow now derive from the selected accent; demo page active controls and progress indicators use the shared accent and accessible foreground tokens.
- Added regression coverage for shared tokens and CSS consumers. All 49 tests pass; JavaScript syntax and diff checks pass. Android Capacitor copy/build succeeded and the APK was installed over the existing RMX3242 app without clearing its data. Startup returned to the populated Shows Watchlist with artwork and bottom navigation; no fatal exception or ANR was found in the checked log window. No files staged or committed.

### Light theme Default accent correction (2026-11-08)

- Changed Default from indigo in Light mode to the same gold (`#f5c518`) used at night. Light, System and AMOLED previews now agree. User-selected custom accent colors are preserved.
- Updated the test, README, walkthrough and changelog. All 49 tests pass; JS syntax and diff checks pass. Built and installed on RMX3242 without clearing app data. The real Appearance picker switched to Light and WebView computed `--accent` as `#f5c518`; its screen showed the gold accent preview. Restored the original AMOLED/Default preference and verified it remained intact. No fatal exception or ANR was found; no files staged or committed.

### Settings subpage popup surface consistency (2026-11-08)

- Fixed the shared Settings picker so its heading and unselected option rows use the same theme surface. The low-memory Android header rule had overridden the heading to the primary surface while the dialog/options used the secondary surface; the targeted override now wins, and the selected accent highlight remains distinct.
- Added regression coverage. All 50 tests pass and diff checks pass. Rebuilt and installed on RMX3242. Live computed styles in low-end mode matched exactly in AMOLED (dialog/header/options `rgb(26,26,26)`) and Light (`rgb(241,245,249)`). Restored original AMOLED/Default settings. No fatal exception or ANR; no staging/commit.

### Mobile hero controls for title and reference pages (2026-11-08)

- The mobile series/movie detail and Episode/Cast/Character screens now overlay Back and title actions on the hero artwork as glossy individual controls instead of a solid full-width toolbar. A targeted rule overrides Android's low-end header background; blur may be disabled on low-resource devices while the glass gradient and highlights stay visible.
- Added regression coverage; 51 tests pass. Rebuilt and installed on RMX3242 without clearing data. Live checks and screenshots covered title, movie, episode, cast/person and an AniList character detail in low-end mode; each had a transparent header and glossy 40px controls. No fatal exception or ANR was found; no staging/commit.


### Light theme control and surface pass (2026-11-08)

- Updated Profile filter bar and icon surfaces, genre chip contrast, season accordion and tracking episode card backgrounds, and Watchlist pull-to-refresh indicator for Light theme. Hero-over-art controls retain their contrasting glass treatment.
- Added targeted CSS regression coverage. `npm test` passes 53/53. Clean Android debug build and install succeeded on RMX3242; the app launched into the populated Light Watchlist and artwork/navigation rendered. Android logs contained no fatal exception or ANR. WebView remote debugging was unavailable in this build, so live computed-style inspection was not possible. No files staged or committed.


### Expanded Appearance theme and navigation options (2026-11-08)

- Added a charcoal Dark palette distinct from AMOLED and included it in validation, persistence, reset-safe selection, and theme previews. Expanded bottom-bar styles (icon highlight, underline, filled pill, minimal), label modes (icons and names, icons only, names only), and per-destination Lucide options. All 117 offered icon glyphs were validated against the bundled library.
- Added regression tests for available options and icon validity. `npm test` passes 55/55; JavaScript syntax and diff checks pass. The updated APK clean-built and installed on RMX3242. The Theme picker showed all four choices; selecting Dark rendered charcoal surfaces and restoring Light retained the user’s prior setting. No fatal Android exception or ANR found in inspected logs. No staging or commit.

### Expanded Animation options (2026-11-08)

- Added Slow motion, Zoom page transitions, Scale sheets/dialogs, Fade tap feedback, three progress movement styles and Shimmer/Soft pulse/Static placeholder styles. Preferences are normalized, persisted through the existing settings flow and included in Reset animations. Reduced-motion and low-resource CSS guards remain active; low-end devices retain the selected route transition at a short duration, while low-performance devices keep decorative animation off.
- Added focused regression tests for options, preference application, CSS guards and bundled icon availability. Full `npm test` passes 59/59; JavaScript syntax and `git diff --check` pass. Capacitor sync and Android debug build succeeded; the APK installed over the existing app on RMX3242 without clearing data. The Animations screen and transition picker rendered, Zoom could be selected, and the prior Fade preference was restored. Progress and placeholder controls rendered in their section. No fatal exception or ANR appeared in inspected logs. No files staged or committed.

### Theme-aware Settings switches (2026-11-08)

- Unified switches across Settings, metadata source lists and source options pages. Tracks and thumbs now use one consistent size; off tracks follow the current surface/border, checked tracks use the selected accent, and focus/disabled states remain visible. Removed older hard-coded dark and provider-specific toggle overrides.
- Added regression coverage for the shared selectors, geometry and removal of conflicting rules. Full `npm test` passes 61/61 and `git diff --check` passes. Android debug build installed over existing app data on RMX3242. Light, Dark and AMOLED switch rendering checked on device; original Light theme restored. No fatal exception or ANR in inspected logs. No files staged or committed.

### Metadata Sources UI cleanup (2026-11-08)

- Removed duplicated “Sources” heading and repeated catalog-order instructions, leaving one concise “Enable sources and drag to reorder” subtitle. Removed the long empty custom-source explanation while retaining the add action. Tightened the empty state.
- Fixed theme text styling to use the actual `--legacy-text` token (instead of undefined `--text`) and kept cards, filters, borders and controls on theme surface/accent variables. Added regression tests for copy and theme tokens.
- Full `npm test` passes 63/63; JavaScript syntax and `git diff --check` pass. Capacitor sync and Android debug build succeeded, then the APK was installed over existing app data on RMX3242. Metadata Sources was visually checked in Light and Dark; the saved Light theme was restored and the app left on that page. No fatal exception or ANR appeared in inspected logs. No files staged or committed.

### Provider source-options UI (2026-11-08)

- Shortened Domain, alternative host, User-Agent and cookie guidance; empty helper text no longer creates a blank row. The User-Agent field now shows “Default User-Agent” instead of the full Android/WebView string. Existing domain, user-agent, cookie and enabled preference bindings are unchanged.
- Added focused UI regression tests. Full `npm test` passes 65/65; page/template syntax and `git diff --check` pass. Capacitor sync and Android debug build succeeded; the APK was installed over existing data on RMX3242. TVmaze source options were opened and the revised form fields and concise hints rendered in Light theme. No fatal exception or ANR was found in the inspected logs. No files staged or committed.
