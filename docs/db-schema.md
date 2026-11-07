# ScreenMark data schema

The app stores one JSON object under local storage key `splitapp_screenmark_v1`; the native encrypted store keeps item records individually and history/preferences in its metadata record.

```json
{
  "items": [],
  "history": [],
  "preferences": {}
}
```

`items` contains this app's categories only: `movie` (movies), `series` (TV series). Metadata-backed items include `metadataSource` and `providerId`; provider data is kept per entry rather than merged across sources. Library duplicate checks use category, metadata source, normalized title and release year, so the same title from different providers remains a distinct entry. Preferences contain source toggles under `metadataSources` and required API keys under `apiKeys`.

## Library item

| Field | Meaning |
|---|---|
| `id`, `title`, `category` | UUID, title, `movie` or `series`. |
| `status` | Status role such as Watchlist, In Progress, On Hold, Dropped or Completed. Details-page choices vary by media type and watched-episode progress. |
| `progress`, `goal` | Minutes watched / runtime for movies; episodes watched / episode count for series. |
| `rating` | 1–5 (or 1–10 by preference); 0 = none. |
| `image`, `description`, `year`, `url` | Poster, summary, release year, source link. |
| `metadataSource`, `providerId` | Registry key (or `custom:<id>`) and provider ID. |
| `cachedDetails`, `facts` | Last provider details and the derived summary (runtime, episodes, cast, ratings) used by Statistics. |
| `watchedEpisodeIds` | Episodes marked watched in the episode guide. |
| `createdAt`, `updatedAt` | Epoch milliseconds. |
| `lastProgressAt` | Epoch milliseconds for the latest episode progress on a series; used for automatic idle status transitions. Older records derive this from episode history or their existing update timestamp. |

History records are `{ itemId, title, action, status, at }`, with episode changes also carrying `type: "episode"`; the timeline joins them to saved titles for posters. Preferences also hold `customSources`, `showSidebar`, `showScrollbars`, and motion controls including `animationSpeed`, `pageTransition`, `sheetAnimation`, `pressEffect`, `progressAnimation`, `skeletonShimmer` and `reduceMotion`. A motion profile version normalizes older animation choices to the current lightweight options.
