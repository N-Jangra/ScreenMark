# ScreenMark data schema

The canonical library is stored in IndexedDB database `screenmark_library`, with `items`, `meta` and `thumbs` object stores. `localStorage` key `splitapp_screenmark_v1` is a small startup mirror of preferences and history, not the full database. Android also keeps encrypted per-item records and metadata through the native `EncryptedStore` plugin. Folder JSON files and exports are portable snapshots.

Schema version 6 adds the `sourceCategoryProvider` compound index on `items` (`metadataSource`, `category`, `providerId`). Linked-title lookups can use this index directly instead of scanning the library; the in-memory ID and provider maps remain the synchronous fast path while the app is open.

IndexedDB operations normally run in `backend/data-worker.js`. If the worker stops or times out, pending operations are retried in order on the main thread after reloading the compact change-detection cache. The fallback uses stable item keys and idempotent deletes and clears so a worker operation that committed just before failure can be safely replayed.

Single-title edits write through the ID-to-array-position index and compare only the editable title fields; they do not serialize cached provider details to detect changes. No-op edits skip persistence. Metadata refresh comparison shallow-copies only the fields it normalizes and serializes the normalized payload once.

Startup treats the localStorage mirror and IndexedDB metadata as untrusted JSON: the top-level value must be an object, history must be an array of records, preferences must be an object, and library entries must have an ID. Legacy migrations are saved only after the canonical library has loaded, so a damaged mirror cannot overwrite valid IndexedDB records. Thumbnail blobs are stored separately under `<item-id>:p` with the artwork path or fingerprint as a signature; mismatched signatures are ignored and stale blobs are removed during background cleanup.

Metadata refresh progress is stored separately from library records. Its version-3 header lives at `<storage-key>_metadata_sync`, with queue entries in 256-row localStorage chunks. Entry statuses are `queued`, `running`, `done` (changed), `checked` (unchanged), `failed`, and `skipped` (the saved title no longer has an enabled, usable source). A status change rewrites only the affected chunk; legacy monolithic queue records are normalized and checkpointed in the chunk format. The queue remains a resumable UI/progress record, while library metadata is committed through the regular IndexedDB/native per-item paths.

```json
{
  "items": [],
  "history": [],
  "preferences": {}
}
```

The portable snapshot has `items`, `history` and `preferences`. `items` contains this app's categories only: `movie` (movies), `series` (TV series). Metadata-backed items include `metadataSource` and `providerId`; provider data is kept per entry rather than merged across sources. Library duplicate checks use category, metadata source, normalized title and release year, so the same title from different providers remains a distinct entry. Preferences contain source toggles under `metadataSources` and required API keys under `apiKeys`.

## Library item

| Field | Meaning |
|---|---|
| `id`, `title`, `category` | UUID, title, `movie` or `series`. |
| `status` | Status role such as Watchlist, In Progress, On Hold, Dropped or Completed. Details-page choices vary by media type and watched-episode progress. |
| `progress`, `goal` | Minutes watched / runtime for movies; episodes watched / episode count for series. |
| `rating` | 1–5 (or 1–10 by preference); 0 = none. |
| `image`, `description`, `year`, `url` | Poster, summary, release year, source link. |
| `metadataSource`, `providerId` | Registry key (or `custom:<id>`) and provider ID. |
| `cachedDetails`, `facts` | Saved provider details and compact summary (runtime, episodes and ratings). Episode guides may be stored locally. Cast data is not persisted. |
| `watchedEpisodeIds` | Episodes marked watched in the episode guide. |
| `createdAt`, `updatedAt` | Epoch milliseconds. |
| `lastProgressAt` | Epoch milliseconds for the latest episode progress on a series; used for automatic idle status transitions. Older records derive this from episode history or their existing update timestamp. |

History records are `{ itemId, title, action, status, at }`, with episode changes also carrying `type: "episode"`; the timeline joins them to saved titles for posters. Preferences also hold `customSources`, `showSidebar`, `showScrollbars`, and motion controls including `animationSpeed`, `pageTransition`, `sheetAnimation`, `pressEffect`, `progressAnimation`, `skeletonShimmer` and `reduceMotion`. A motion profile version normalizes older animation choices to the current lightweight options.
