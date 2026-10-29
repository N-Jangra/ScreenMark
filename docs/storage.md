# ScreenMark storage

- **Browser:** state is mirrored in `localStorage` at `splitapp_screenmark_v1`.
- **Android:** the app bridge uses the `EncryptedStore` Capacitor plugin to save library items and metadata. The local storage value is maintained as a browser-compatible mirror.
- **Metadata cache:** responses use the Cache Storage namespace `splitapp_screenmark_metadata`; API-key-bearing requests are not cached.
- **Secrets:** API keys are stored in this app's preferences. Do not commit personal API keys or `.env` files.

Opening a title's details (or **Fetch details** on Statistics) saves the provider response in `cachedDetails` and a compact `facts` summary on the item, so it is stored in the encrypted Android record, the localStorage mirror and the folder `index.json`. Images inside `cachedDetails` become thumbnails stored beside the item. On Android the folder database uses `<app-key>-db/titles/<item-id>/`.

The three apps use separate storage keys and separate cache names.