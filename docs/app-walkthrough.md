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

The launch screen plays the 3.43-second Episode Stack intro once while the initial UI prepares. It then waits until the app is ready and leaves a 500 ms beat before revealing app data; a six-second image-load fail-safe prevents a stalled GIF load from holding it forever. Android's native system splash appears before this web intro. Motion Off, the app's Reduce motion setting, or the system reduced-motion preference uses the static app mark and removes the animation hold. Other motion-speed choices control the fade-out timing. **Settings → Animations** controls reduced motion and motion speed (Off, Fast, Normal or Slow); screen transitions (Slide, Fade, Zoom or None); sheet/dialog transitions (Slide up, Fade or Scale); tap feedback (Shrink, Fade or None); progress movement (Smooth, Snappy or Spring); and loading placeholders (Shimmer, Soft pulse or Static). New installs enable the lightweight detail shimmer by default. Reduced-motion preferences and low-resource settings limit decorative motion; Static placeholders remain available, and the preview action replays the current screen transition.

ScreenMark honors the system reduced-motion preference. Android and detected low-resource devices also use a lighter profile: no decorative card entrance or shimmer, no backdrop blur, fewer shadows and shorter transitions. Poster artwork in library grids, watchlists and detail heroes loads as it approaches the viewport, with a placeholder shown while the local thumbnail is read and if an image cannot load. Detail screens render before local image files finish restoring; visible episode and cast images are prioritized when their tab opens, while farther images remain lazy-loaded. Detail loading reserves shaped placeholders only for missing synopsis, facts, media or episode data, and the cold series view exposes its Episodes tab while that guide loads. Each placeholder section has one subtle shimmer sweep; existing local data prevents a duplicate placeholder from appearing. Episode stills continue to use their own provider image. The app keeps normal vertical scrolling native. At the top of Discover and either watchlist, pull-to-refresh moves the page content beneath its sticky search or tab bar; on Details it refreshes the open title. Android WebView edge stretching is disabled so the fixed bottom bar stays pinned during a pull; the app's own gesture still shifts only the refreshing content. Horizontal rails use native touch scrolling, and route changes avoid a forced layout pass.

Cast and character pages show a portrait and credit or appearances list skeleton while their source is loading. Episode pages reserve the still, synopsis, cast and (when the episode belongs to a saved series) series-guide positions. The loading announcement is exposed to assistive technology without adding a visible status banner that shifts the page layout.

## Navigation and back behaviour

- URLs: `#series`, `#movies`, `#series-watchlist`, `#movie-watchlist`, `#series-favorites`, `#movie-favorites`, `#discover?source=<key>`, `#details?id=<item id>`, `#settings/<group>`, `#settings/custom-source?id=<id>`, `#statistics`, `#timeline`, `#add`, `#setup` (Quick setup) and `#profile-cover` (Edit profile). Legacy `#dashboard` and `#search` URLs resolve to Discover; `#explore` opens Metadata Sources.
- Opening a sheet or dialog adds a history entry: browser back or Android back closes it first; tapping outside also closes it. Android back steps back through pages and exits from the Shows Watchlist home page.
- The Profile options menu links directly to Settings, Metadata Sources, Timeline, Quick setup, Sources, Settings and About; tapping outside the sheet closes it.
- Refreshing `#details?id=…` reopens that title.

## Main pages

- **Shows and Movies:** separate library pages with poster grids, progress bars, sorting and filters. Posters show a shimmer placeholder until their thumbnail loads, then progress bars animate up to their values (replayed when the eye/grouping button or filters change; off with reduced motion). Large collections reveal 100 titles at a time and load the next batch as you scroll; the count resets when filters change. Favorites have their own pages. The bottom navigation links directly to Shows and Movies.
- **Watchlists:** separate Shows and Movies pages have Watchlist and Upcoming tabs. Long sections reveal 100 cards at a time. Series tracking shows the next aired episode; when the next episode has not aired, its check is replaced by a “Caught up” control. Unaired episodes cannot be marked watched through season or progress controls, and watched entries leave Upcoming immediately. Checking an aired episode updates that title's next episode card and smoothly repositions nearby cards if its status changes. List, poster and card views are saved independently for Shows and Movies. Poster mode uses the same portrait artwork treatment as the library, with a season/episode badge and watched-progress count/bar on series posters. Upcoming countdowns show the remaining day count.
- **Discover:** Shows / Movies tabs sit at the top (Shows first); a toggle beside the search field cycles Grid, List and Cards views (Cards use landscape backdrops when a source has them, otherwise posters). A search field expands the Movies / Shows selector in the sticky topbar. Submit with the Search button or the keyboard's Search/Enter action; both use the same search path and dismiss the keyboard. Search results are grouped by metadata source; each source has a View all route. Catalog cards show available genre chips and keep a neutral artwork placeholder visible until each poster loads. While suggestions or a search are loading, full card placeholders reserve the poster, type/rating badges, title, year, genres and add control; unavailable requests clear the placeholders and show an error instead. Without a query, suggestions include schedules, charts and anime picks where supported; each catalog entry appears on at most one shelf.
- **Add:** choose Movie or TV series, search sources to auto-fill poster, description, year and runtime or episode count, then set status, progress and total with steppers (10 minutes for movies, 1 episode for series) and a star rating. Saving a metadata-backed series opens its library details on Episodes when an episode guide is available.
- **Details:** hero with poster and backdrop, status and source facts, progress controls, overview, cast and crew, ratings and provider details. Movie pages group information into Overview, Details, Media, Ratings and Cast & Crew tabs when those sections are available; the tabs scroll horizontally on narrow screens. Saved series with an episode guide open on Episodes. Series episode lists expand by season; aired episode checks update progress and status, while future episodes show a countdown and cannot be checked. Long vertical rating grids add rows as needed. Provider links use a shared Links heading and rounded pills on title, episode and cast/person pages. AniList cast biographies render Markdown links and emphasis, and AniList character links open in-app character pages with appearances.
- **Profile:** use **Add manually** beside the profile identity to open the Add page. Landscape library artwork can be used as a cover. The pencil badge on the avatar opens **Edit profile**: Profile and Background tabs choose the photo and cover from library posters or backdrops (paged, lazy-loaded), your own photo, or nothing, with source, random/newest and change-interval options. The ⋮ menu links to Timeline, Quick setup, Sources, Settings and About. Empty favorites boxes open the favorites picker. Stats are split into series time, episodes watched, movie time and movies watched.
- **Quick setup:** a four-step first-run wizard (series you watched, series to watch, movies you watched, movies to watch) with trending titles, search and a tick to select; the button reads Skip until something is selected. Titles are added as Completed or Watchlist. Reopen it from Profile ⋮ → Quick setup. With no favorites, the Favorites pages open a one-step picker that lists the series or movies already in your local library (searchable, no network) and marks the picked ones as favorites; Later returns to Profile.
- **Timeline:** recent library and watched-episode activity grouped by day and month, with time-range filters.
- **Statistics:** movie and series views with watch time, activity, library breakdown, ratings and top titles.
- **Settings:** Appearance, Animations, Backups, Metadata Sources, Metadata & Storage, App Info, Logcat and custom sources. Appearance offers System, Light, Dark and AMOLED themes, a gold Default accent, and custom colors that carry through Shows, Movies, Details, Watchlists, Profile, Discover, Settings and shared navigation. Bottom navigation has icon highlight, underline, filled pill and minimal styles, Icons + name, Icons only and Names only layouts, and expanded per-destination icon choices. Option popups use a consistent theme surface for their heading and options while longer choices scroll inside the sheet. Settings switches share a consistent thumb and track size, with off/on colors, focus rings and disabled states drawn from the active theme. Animation controls match the screen and sheet transitions used across the app. Bottom navigation has a fixed order: Shows, Movies, Discover and Profile.
- On phones, title/movie detail, Episode, Cast and Character pages put Back and available title actions over the hero artwork as individual, theme-matched controls; they do not reserve a separate solid toolbar strip.

## Light theme surfaces

Profile filter controls, season and episode cards, and the Watchlist pull-to-refresh indicator use the selected Light theme surface colors. Detail artwork fades into light surfaces, while episode copy and accent-colored labels use readable theme-aware colors. Floating hero controls use a restrained surface tint and shadow for contrast.

## Source-specific title identity

Discover keeps each provider's result separate. A saved title is identified by category, metadata source, normalized title and release year, so similarly named entries from different catalogs can coexist. Adding a result does not combine its metadata with another provider's entry. See [metadata](metadata.md) and [storage](storage.md).

## Custom sources

**Settings → Metadata → Metadata Sources** lists provider toggles, categories, ordering and source options. Its All / Enabled / Disabled filters apply to built-in catalogs; custom sources can be added or edited below.

**Settings → Metadata → Metadata Sources → Add custom source** is a guided page: *Connect* (name, which types it works for, search URL with `{query}`/`{apikey}`, optional key and header), *Read the results* (path to the list and fields for title, id, poster, year, description, rating, link, subtitle) and *More details* (suggestions URL, details URL and field mapping for genres, directors, cast, network, runtime, episodes, seasons and more). **Run test** shows sample results before saving.

## Backups

**Settings → Backups → Export List** saves the library and preferences to a backup file. Import can restore a ScreenMark backup or import title names from a text or CSV file. Android uses the system file picker and Save as flow.
