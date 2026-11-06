# ScreenMark storage

- **Library:** titles live in IndexedDB (`screenmark_library`: `items`, `meta` and `thumbs` stores) and are written per changed title by a data worker. `localStorage` (`splitapp_screenmark_v1`) keeps only a small startup mirror of preferences and history.
- **Startup:** the library appears straight from IndexedDB; the folder database and encrypted store are reconciled in the background and changes made meanwhile win.
- **Covers:** the device cover cache (IndexedDB) is tried first, then the online image; the saved folder only fills the cache in the background.
- **Export:** Settings → Backups streams the library in chunks to a file chosen on Android's Save as screen.
- **Android:** the app bridge uses the `EncryptedStore` Capacitor plugin to save library items and metadata. The local storage value is maintained as a browser-compatible mirror.
- **Metadata cache:** responses use the Cache Storage namespace `splitapp_screenmark_metadata`; API-key-bearing requests are not cached.
- **Secrets:** API keys are stored in this app's preferences. Do not commit personal API keys or `.env` files.

Opening a title's details (or **Fetch details** on Statistics) saves the provider response in `cachedDetails` and a compact `facts` summary on the item, so it is stored in the encrypted Android record, the localStorage mirror and the folder `index.json`. Images inside `cachedDetails` become thumbnails stored beside the item. On Android the folder database uses `<app-key>-db/titles/<item-id>/`.

The three apps use separate storage keys and separate cache names.