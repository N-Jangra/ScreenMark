# Automated backend tests

Run from the ScreenMark repository root:

```sh
npm test
```

The test runner uses Node's built-in `node:test`, plus `fake-indexeddb` to run the app's real IndexedDB implementation without a browser. Provider and proxy upstreams are mocked; the suite makes no live metadata requests.

## Coverage

- `frontend-integrity.test.js`: every local asset referenced by `index.html` exists, every linked script plus the IndexedDB worker parses, and all frontend runtime files are reachable from the app shell or an explicit worker/manifest reference.
- `server.test.js`: app-shell/static-file routes, content types, 404s, traversal and symlink protection, localhost CORS preflight, proxy URL/host/method validation, allowed GET and provider-specific POST forwarding, request/response byte caps, and upstream failures.
- `providers.test.js`: search request/response mapping for TVmaze, AniList, TMDB, TheTVDB, OMDb, IMDb and Rotten Tomatoes; custom-source search/details mapping; HTTPS, credentials, invalid JSON and response-size validation.
- `details.test.js`: title detail dispatch and shared response schema for each built-in provider, plus invalid, unsupported and disabled source identities.
- `details-page.test.js`: cold movie/series skeleton placement, duplicate Synopsis avoidance and initial Episodes-tab visibility, plus loading layouts for cast, character and episode reference pages.
- `discover-page.test.js`: genre-chip mapping, escaped result cards, full card-shaped loading placeholders, and native form submission shared by the Search button and Android keyboard with responsive control styling.
- `splash.test.js`: the launch GIF has no repeat extension and the one-play delay retains the 500 ms post-animation gap.
- `android-splash.test.js`: Android uses a blank matching-color system splash with no animated app icon, leaving the JS intro as the only branded opening animation.
- `android-overscroll.test.js`: the Android WebView edge-stretch is disabled, root overscroll chaining is blocked, and app pull-to-refresh still moves only its content.
- `theme-colors.test.js`: Light and AMOLED CSS do not override the dynamic Default or custom accent selected in Appearance.
- `watchlist-poster.test.js`: poster-grid markup, portrait art, episode/progress overlays and responsive poster CSS.
- `upcoming-episodes.test.js`: date-only air-date handling, immediate Upcoming filtering after marking, and disabled watch controls for unaired episodes.
- `database.test.js`: version 6 schema migration, load/save/saveSome behavior, changed and removed records, malformed metadata repair, blocked-upgrade recovery, thumbnail Blob/signature queries and cleanup, data-worker dispatch, and the public API fallback when workers are unavailable.
- `share-pdf-options.test.js`: list and title share option controls plus generated PDF page counts for list, poster-grid and optional title-page layouts.

The fixture tests verify request shapes and app-side mapping. They do not establish current availability, credentials, rate limits or response compatibility of live external providers.
