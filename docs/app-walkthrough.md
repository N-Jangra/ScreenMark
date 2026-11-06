# ScreenMark app walkthrough

ScreenMark is a responsive, local-first tracker for **movies and TV series**. It is a single-page app that runs in a browser and, packaged with Capacitor, as an Android app. Every route is a hash URL, so each screen can be opened or refreshed directly.

## Types and statuses

Every title is a **Movie** (progress in minutes watched, total = runtime) or a **TV series** (progress in episodes watched, total = episode count). Statuses are Watchlist, In Progress, On Hold, Dropped and Completed. The shared interface refers to them through *status roles* (`statusRoles` in `app-config.js`): queued, active, hold, dropped, done.

## Screen sizes

| Width | Navigation | Layout |
|---|---|---|
| Phone (under 768px) | Bottom bar | One column; sheets slide up from the bottom. |
| Tablet (768–1079px) | Icon-only sidebar rail | Wider content, 2-column lists. |
| Desktop (1080px and up) | Sidebar with icons and labels | 2–3 column lists; sheets open as centred windows. |

**Settings → Appearance** has *Show sidebar* and *Show scrollbars* (off by default).

## Opening animation, motion and performance

A launch screen (ScreenMark clapperboard icon, name, dots) shows until the first page is drawn, for at least 1.2 s scaled by **Animation speed**. Pages slide in forward/back, sheets rise from the bottom, buttons have a press effect; only position and opacity are animated. Reduce motion or Animation speed *Off* disables it. Devices reporting 2 GB of memory or less, 2 or fewer cores or data-saver mode switch to a low-memory mode (no blur or shadows, solid headers, shorter animations).

## Navigation and back behaviour

- URLs: `#dashboard`, `#discover?source=<key>`, `#details?id=<item id>`, `#settings/<group>`, `#settings/custom-source?id=<id>`, `#mix`, `#statistics`, `#timeline`, `#add`.
- Opening a sheet or dialog adds a history entry: browser back or Android back closes it first; tapping outside also closes it. Android back then steps back through pages and only exits from Home.
- Back links on settings sub-pages return to where you came from (for example Explore → Metadata Sources → Back → Explore).
- Refreshing `#details?id=…` reopens that title.

## Main pages

- **Home:** titles grouped by status (or type, release year, none). Movies and Series filters, status chips with counts and collection search sit above the library. Dashboard layouts include List, Compact list, Posters, Posters+, Compact grid and Large poster grid. The floating plus opens Add.
- **Discover:** a Movies / Series switch and search across enabled sources. Results can be sorted and filtered by year and genre; saved results show that they are already in the library. With no query, suggestions include TV schedules, movie charts and anime picks where supported.
- **Add:** choose Movie or TV series, search sources to auto-fill poster, description, year and runtime or episode count, then set status, progress and total with steppers (10 minutes for movies, 1 episode for series) and a star rating. Saving a metadata-backed series opens its library details on Episodes when an episode guide is available.
- **Details:** hero with poster and backdrop, status and source facts, progress controls, overview, cast and crew, ratings and provider details. Series episode lists expand by season; season and episode checks update progress. Long vertical rating grids add rows as needed. Provider links use a shared Links heading and rounded pills on title, episode and cast/person pages.
- **Explore:** Timeline, Statistics, metadata sources and Mix fetch.
- **Timeline:** recent library and watched-episode activity grouped by day and month, with time-range filters.
- **Statistics:** movie and series views with watch time, activity, library breakdown, ratings and top titles.
- **Settings:** Appearance, Dashboard, Tracking, Backups, Metadata, Metadata & Storage, App Info, Logcat, bottom navigation customization and custom sources.

## Mix fetch (experimental)

**Explore → Beta → Mix fetch** searches every enabled source as one plain list (a type switch All / Movies / TV series; the same title from several sources is one row with a chip per source). Opening a title or adding it fetches details from all enabled sources and merges them (`metadataSource: "mix"`). Available title ratings appear as provider-labeled badges. Matching episode guides are merged by season and episode number, retaining one row per episode and combining details across providers. Adding a title that already exists from a single source offers to convert it to a Mix entry. See [metadata](metadata.md).

## Custom sources

**Settings → Metadata → Metadata Sources → Add custom source** is a guided page: *Connect* (name, which types it works for, search URL with `{query}`/`{apikey}`, optional key and header), *Read the results* (path to the list and fields for title, id, poster, year, description, rating, link, subtitle) and *More details* (suggestions URL, details URL and field mapping for genres, directors, cast, network, runtime, episodes, seasons and more). **Run test** shows sample results before saving.

## Backups

**Settings → Backups → Export List** saves the library and preferences to a backup file. Import can restore a ScreenMark backup or import title names from a text or CSV file. Android uses the system file picker and Save as flow.
