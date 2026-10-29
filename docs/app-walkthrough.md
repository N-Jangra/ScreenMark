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

- **Home:** titles grouped by status (or type, release year, none). A **type** row (All / Movies / TV series) and **status chips with counts** sit under the search box. The filter sheet sets sort, status, layout, group-by, theme, density and display switches. Each card's three-dot button opens an action sheet (Mark as In Progress, Mark as Completed, View Full Details, Remove). The floating plus opens Add.
- **Discover:** a type switch (**All**, Movies, TV series) and search across enabled sources. When nothing is searched it shows suggestion rows: TVmaze (streaming today, on TV today, streaming tomorrow), the iTunes top-movies chart, AniList (trending and popular anime and anime movies) and any custom source that has a suggestions URL. Opened from Explore, search is limited to one source and the types it supports.
- **Add:** choose Movie or TV series, search sources to auto-fill poster, description, year and runtime or episode count, then set status, progress and total with steppers (10 minutes for movies, 1 episode for series) and a star rating.
- **Details:** hero with poster and backdrop, source and type, status and age-rating badges, **Watch progress** card (−/＋ buttons sized per type, % watched and time left), status pills and star rating, then provider data: trailers/images, overview, tags, ratings, details table, cast/characters/staff carousels, a collapsible **Episode guide** (tap to mark episodes watched; progress follows), links, related titles.
- **Explore:** Timeline, Statistics, **all four metadata sources** (off or key-less ones show *Off* / *Setup* and link to settings) and a **Beta** group with **Mix fetch**.
- **Timeline:** status changes grouped by month with posters; filter by week, month, month/year or title.
- **Statistics:** completion rate, status cards (tap to open Home filtered), **Time to watch** (watched so far, length of titles with data, left to watch, episodes watched, longest titles; buttons *Fetch details* and *Find runtimes*), status breakdown, an Activity chart with Week / Month switch and counts on every bar, top ratings.
- **Settings:** Appearance, Dashboard, Tracking, Backups & sync, Metadata, Metadata & Storage, a standalone **Storage** page, **App Info**, **Logcat**, Bottom Menu Icons, Bottom Bar Layout and custom sources.

## Mix fetch (experimental)

**Explore → Beta → Mix fetch** searches every enabled source as one plain list (a type switch All / Movies / TV series; the same title from several sources is one row with a chip per source). Opening a title or adding it fetches details from all enabled sources and merges them (`metadataSource: "mix"`). Adding a title that already exists from a single source offers to convert it to a Mix entry. See [metadata](metadata.md).

## Custom sources

**Settings → Metadata → Metadata Sources → Add custom source** is a guided page: *Connect* (name, which types it works for, search URL with `{query}`/`{apikey}`, optional key and header), *Read the results* (path to the list and fields for title, id, poster, year, description, rating, link, subtitle) and *More details* (suggestions URL, details URL and field mapping for genres, directors, cast, network, runtime, episodes, seasons and more). **Run test** shows sample results before saving.

## Backups

**Settings → Backups & sync → Export List** downloads JSON with items, history and preferences. Import adds titles and skips duplicates by type and title; it does not restore history or preferences.
