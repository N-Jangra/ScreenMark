# ScreenMark app walkthrough

ScreenMark is a responsive, local-first tracker for **movies and TV series**. It is a single-page app that runs in a browser and, packaged with Capacitor, as an Android app. Every route is a hash URL, so each screen can be opened or refreshed directly.

## Types and statuses

Every title is a **Movie** (progress in minutes watched, total = runtime) or a **TV series** (progress in episodes watched, total = episode count). In Details, movies offer Watchlist, Dropped and Completed. Series with no watched episodes offer Watchlist and Completed; after tracking starts they offer In Progress, On Hold, Dropped and Completed. The shared interface refers to these through *status roles* (`statusRoles` in `app-config.js`): queued, active, hold, dropped and done.

Marking an episode watched moves its series to In Progress. Marking all known episodes watched completes it. An unfinished series with no episode progress for 7 days moves to On Hold, and after 30 days moves to Dropped. ScreenMark checks this on launch, when the app resumes, and hourly while it remains open.

## Screen sizes

| Width | Navigation | Layout |
|---|---|---|
| Phone (under 768px) | Bottom bar | One column; sheets slide up from the bottom. |
| Tablet (768–1079px) | Icon-only sidebar rail | Wider content, 2-column lists. |
| Desktop (1080px and up) | Sidebar with icons and labels | 2–3 column lists; sheets open as centred windows. |

**Settings → Appearance** has *Show sidebar* and *Show scrollbars* (off by default).

## Motion, scrolling and performance

The launch screen stays for at least 350 ms with the default Fast motion setting (500 ms at Normal), unless startup takes longer; Off or reduced motion removes the extra hold. **Settings → Animations** controls reduced motion, motion speed, screen transitions (slide, fade or none), sheet/dialog transitions, tap feedback, progress updates and optional loading placeholders. The default profile uses short transitions and leaves card entrance cascades, navigation bounce and loading shimmer off. The preview action replays the current screen transition.

ScreenMark honors the system reduced-motion preference. Android and detected low-resource devices also use a lighter profile: no decorative card entrance or shimmer, no backdrop blur, fewer shadows and shorter transitions. The app keeps normal vertical scrolling native. At the top of Discover and either watchlist, pull-to-refresh moves the page content beneath its sticky search or tab bar; on Details it refreshes the open title. Horizontal rails use native touch scrolling, and route changes avoid a forced layout pass.

## Navigation and back behaviour

- URLs: `#series`, `#movies`, `#series-watchlist`, `#movie-watchlist`, `#series-favorites`, `#movie-favorites`, `#discover?source=<key>`, `#details?id=<item id>`, `#settings/<group>`, `#settings/custom-source?id=<id>`, `#statistics`, `#timeline`, `#add`.
- Opening a sheet or dialog adds a history entry: browser back or Android back closes it first; tapping outside also closes it. Android back then steps back through pages before exiting the app.
- The Profile options menu links directly to Settings, Metadata Sources, Statistics, Activity, Timeline and App Info.
- Refreshing `#details?id=…` reopens that title.

## Main pages

- **Shows and Movies:** separate library pages with poster grids, progress bars, sorting and filters. Favorites have their own pages. The bottom navigation links directly to Shows and Movies.
- **Watchlists:** separate Shows and Movies pages have Watchlist and Upcoming tabs. Series tracking shows the next aired episode; checking it updates that title's next episode card and smoothly repositions nearby cards if its status changes. List, poster and card views are saved independently for Shows and Movies. Collection sharing exports every title in one PDF, with a contents preview and Save and Share actions.
- **Discover:** a search field expands the Movies / Shows selector in the sticky topbar. Search results are grouped by metadata source; each source has a View all route. Without a query, suggestions include schedules, charts and anime picks where supported; each catalog entry appears on at most one shelf.
- **Add:** choose Movie or TV series, search sources to auto-fill poster, description, year and runtime or episode count, then set status, progress and total with steppers (10 minutes for movies, 1 episode for series) and a star rating. Saving a metadata-backed series opens its library details on Episodes when an episode guide is available.
- **Details:** hero with poster and backdrop, status and source facts, progress controls, overview, cast and crew, ratings and provider details. Saved series with an episode guide open on Episodes. Series episode lists expand by season; season and episode checks update progress and status. Long vertical rating grids add rows as needed. Provider links use a shared Links heading and rounded pills on title, episode and cast/person pages.
- **Profile:** landscape library artwork can be used as a cover. Its options menu links to Settings, Metadata Sources, Statistics, Activity, Timeline and App Info. Stats are split into series time, episodes watched, movie time and movies watched.
- **Timeline:** recent library and watched-episode activity grouped by day and month, with time-range filters.
- **Statistics:** movie and series views with watch time, activity, library breakdown, ratings and top titles.
- **Settings:** Appearance, Animations, Backups, Metadata Sources, Metadata & Storage, App Info, Logcat and custom sources. Appearance offers a Default accent that matches Discover and watchlists for the active theme, alongside custom colors. Option sheets keep their headers visible while longer choices scroll inside the sheet. Animation controls match the screen and sheet transitions used across the app. Bottom navigation has a fixed order: Shows, Movies, Discover and Profile.

## Source-specific title identity

Discover keeps each provider's result separate. A saved title is identified by category, metadata source, normalized title and release year, so similarly named entries from different catalogs can coexist. Adding a result does not combine its metadata with another provider's entry. See [metadata](metadata.md) and [storage](storage.md).

## Custom sources

**Settings → Metadata → Metadata Sources → Add custom source** is a guided page: *Connect* (name, which types it works for, search URL with `{query}`/`{apikey}`, optional key and header), *Read the results* (path to the list and fields for title, id, poster, year, description, rating, link, subtitle) and *More details* (suggestions URL, details URL and field mapping for genres, directors, cast, network, runtime, episodes, seasons and more). **Run test** shows sample results before saving.

## Backups

**Settings → Backups → Export List** saves the library and preferences to a backup file. Import can restore a ScreenMark backup or import title names from a text or CSV file. Android uses the system file picker and Save as flow.
