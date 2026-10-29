# ScreenMark frontend structure

`index.html` is the app shell: it mounts navigation, dialogs, shared layout, and scripts. The app is a single-page app, so each screen renders into `#page-content` without a separate HTML document.

## Files

- `app.js` — app state, routing, interactions, persistence, and page context.
- `app-config.js` — app name, categories, labels, and app-specific defaults.
- `components/library.js` — shared library cards and category controls.
- `pages/dashboard.js` — Dashboard markup.
- `pages/search.js` — library Search markup.
- `pages/discover.js` — online Discover markup (type switch, suggestions).
- `pages/add.js` — Add / Edit page (Movie or TV series).
- `pages/explore.js` — Explore hub (activity, sources, Beta).
- `pages/mix.js` — experimental Mix fetch page.
- `pages/details.js` — source-backed Details markup.
- `pages/timeline.js` — activity Timeline markup.
- `pages/statistics.js` — Statistics markup.
- `pages/settings.js` — Settings controls and sections.
- `styles.css` — shared responsive design and page styles.
- `styles/cuemark-legacy.css` — CueMark legacy dark palette, glass surfaces, typography, and navigation styling.
- `styles/ios-ui.css` — iOS-style look, multi-screen layout and component styles.
- `styles/motion.css` — animations, press feedback and the low-memory mode.
- `styles/details.css` — media details, progress, episode guide, gallery, and source links.
- `lucide.min.js` — bundled icon set.
- `backend/features/mix.js` — experimental Mix fetch (search, merge, runtime lookup).
- `backend/` — maintained app-specific storage, metadata, and detail modules; this is the only copy and is packaged directly by Capacitor.

Edit the relevant page template in `pages/`; use `app.js` for behavior and `components/library.js` for elements reused across screens. Keep every new frontend script referenced in `index.html` before `app.js` so the page renderers are available when routing starts.

## Running and packaging

Run `npm run serve` from the app root for a local browser preview. Browser preview uses local storage; Android uses the app-specific encrypted storage bridge with a local mirror. Run `npm run cap:sync` from the app root before building the APK; the source files are already inside Capacitor's `webDir`, so the command syncs them directly without a duplicate copy.
