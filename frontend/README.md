# ScreenMark frontend structure

`index.html` is the app shell: it mounts navigation, dialogs, shared layout, and scripts. The app is a single-page app, so each screen renders into `#page-content` without a separate HTML document.

## Files

- `app.js` — app state, routing, interactions, persistence, page context, episode-driven status automation, and the shared poster image helper. Library thumbnails resolve from the bounded IndexedDB Blob cache near the viewport, with loading placeholders and failure fallback.
- `app-config.js` — app name, categories, labels, and app-specific defaults.
- `components/library.js` — shared episode progress calculations.
- `components/share.js` — collection PDF generation, preview, saving and sharing; `components/share-title.js` handles an individual title's share sheet.
- `pages/discover.js` — online Discover markup (type switch, suggestions).
- `pages/add.js` — Add / Edit page (Movie or TV series).
- `pages/profile.js` — profile, favorites collections and show/movie watchlists.
- The Profile header's **Add manually** button opens the shared Add page; there is no app-wide floating Add control.
- `pages/details.js` — source-backed Details markup.
- `pages/timeline.js` — activity Timeline markup.
- `pages/statistics.js` — Statistics markup.
- `pages/sync.js` — metadata refresh status and retry markup.
- `pages/settings.js` — Settings controls and sections.
- `styles.css` — shared responsive design and page styles.
- `styles/ui-polish.css` — Settings picker sheets, App Info and shared interface refinements.
- `styles/cuemark-legacy.css` — CueMark legacy dark palette, glass surfaces, typography, and navigation styling.
- `styles/ios-ui.css` — iOS-style look, multi-screen layout and component styles.
- `styles/motion.css` — page and sheet transitions, press feedback and the low-memory mode. Route transitions have one source of truth; reduced-motion and performance preferences remain respected.
- `styles/demo-pages.css` — shared Discover, watchlist, and source-backed details styling, including theme tokens for title, movie, episode, cast, and character pages.
- `styles/details.css` — media details, progress, episode guide, gallery, and source links.
- `lucide.min.js` — bundled icon set.
- `backend/` — maintained app-specific storage, metadata, and detail modules; this is the only copy and is packaged directly by Capacitor.

There is no Dashboard or Search renderer. Legacy `#dashboard` and `#search` URLs route to Discover. Dashboard-only styles were removed; shared styles for active pages remain in the current stylesheets.

Edit the relevant page template in `pages/`; use `app.js` for behavior and `components/library.js` for elements reused across screens. Keep every new frontend script referenced in `index.html` before `app.js` so the page renderers are available when routing starts.

## Running and packaging

Run `npm run serve` from the app root for a local browser preview. Browser preview uses local storage; Android uses the app-specific encrypted storage bridge with a local mirror. Run `npm run cap:sync` from the app root before building the APK; the source files are already inside Capacitor's `webDir`, so the command syncs them directly without a duplicate copy.
