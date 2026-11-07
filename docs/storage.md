# ScreenMark storage

- **Library:** titles live in IndexedDB (`screenmark_library`: `items`, `meta` and `thumbs` stores) and are written per changed title by a data worker. `localStorage` (`splitapp_screenmark_v1`) keeps only a small startup mirror of preferences and history.
- **Startup:** the library appears straight from IndexedDB; the folder database and encrypted store are reconciled in the background and changes made meanwhile win. If the selected Android folder is missing, ScreenMark asks you to choose a folder again.
- **Images:** **Settings → Metadata & Storage → Image storage** controls folder copies: save all images, save title covers and backdrops, or keep images online only. The IndexedDB image cache is used for fast display; saved-folder images can restore it after a cache clear.
- **Export:** Settings → Backups streams the library in chunks to a file chosen on Android's Save as screen.
- **Android:** the app bridge uses the `EncryptedStore` Capacitor plugin to save library items and metadata. The local storage value is maintained as a browser-compatible mirror.
- **Metadata cache:** responses use the Cache Storage namespace `splitapp_screenmark_metadata`; API-key-bearing requests are not cached.
- **Secrets:** API keys are stored in this app's preferences. Do not commit personal API keys or `.env` files.

Opening a title's details (or refreshing metadata) saves the provider response in `cachedDetails` and a compact `facts` summary on the item. The portable folder tree stores movies at `<app-key>-db/movies/<metadata-source>/<item-id>/` and series at `<app-key>-db/series/<metadata-source>/<item-id>/`. The source folder uses the provider key (such as `tmdb` or `tvmaze`), or `manual` for entries without a metadata source. Each title folder contains an `index.json` and any saved images, keeping entries from different providers separate. Existing `shows/`, direct category folders, and `titles/` folders are recognized during startup sync and migrated after the new copy is safely written. The root database JSON and TAR backup remain complete portable snapshots.

The three apps use separate storage keys and separate cache names.
