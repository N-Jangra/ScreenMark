# ScreenMark data schema

The app stores one JSON object under local storage key `splitapp_screenmark_v1`; the native encrypted store keeps item records individually and history/preferences in its metadata record.

```json
{
  "items": [],
  "history": [],
  "preferences": {}
}
```

`items` contains this app's categories only: `movie` (movies), `series` (TV series). Metadata-backed items may include `metadataSource` and `providerId`; these identify one of this app's providers. Preferences contain source toggles under `metadataSources` and required API keys under `apiKeys`. No other app's source keys are retained after metadata preferences are normalized.

## Library item

| Field | Meaning |
|---|---|
| `id`, `title`, `category` | UUID, title, `movie` or `series`. |
| `status` | Watchlist, In Progress, On Hold, Dropped or Completed. |
| `progress`, `goal` | Minutes watched / runtime for movies; episodes watched / episode count for series. |
| `rating` | 1–5 (or 1–10 by preference); 0 = none. |
| `image`, `description`, `year`, `url` | Poster, summary, release year, source link. |
| `metadataSource`, `providerId` | Registry key (or `mix`, `custom:<id>`) and provider ID. |
| `cachedDetails`, `facts` | Last provider details and the derived summary (runtime, episodes, cast, ratings) used by Statistics. |
| `watchedEpisodeIds` | Episodes marked watched in the episode guide. |
| `createdAt`, `updatedAt` | Epoch milliseconds. |

History records are `{ itemId, title, action, status, at }`; the timeline joins them to saved titles for posters. Preferences also hold `customSources`, `showSidebar`, `showScrollbars`, `animationSpeed` and `reduceMotion`.
