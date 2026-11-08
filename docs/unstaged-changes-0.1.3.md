# Unstaged changes report — ScreenMark 0.1.3

Point-in-time inventory of the working tree relative to `HEAD`. The listed paths are unstaged; this report does not stage, commit, or change them. Untracked paths are intentionally included so reviewers can see new files alongside modified and deleted files. Run `git status --short` again before relying on this snapshot because working-tree status can change.

The 0.1.3 work represented here spans release and technical documentation, Android storage and backup handling, frontend/provider and IndexedDB behavior, detail/watchlist/theme/motion UI, tests, and logo assets. Consult source diffs for implementation details.

## Modified (46)

- `CHANGELOG.md`
- `README.md`
- `android/app/build.gradle`
- `android/app/src/main/java/com/cuemark/screenmark/BackupFolderPlugin.java`
- `android/app/src/main/java/com/cuemark/screenmark/BackupSchedulerPlugin.java`
- `android/app/src/main/java/com/cuemark/screenmark/CacheManagerPlugin.java`
- `android/app/src/main/java/com/cuemark/screenmark/EncryptedBackupWorker.java`
- `android/app/src/main/java/com/cuemark/screenmark/EncryptedStorePlugin.java`
- `android/app/src/main/java/com/cuemark/screenmark/MainActivity.java`
- `android/app/src/main/java/com/cuemark/screenmark/ShareIntentPlugin.java`
- `android/app/src/main/res/values/styles.xml`
- `dev-server.js`
- `docs/README.md`
- `docs/app-walkthrough.md`
- `docs/db-schema.md`
- `docs/metadata.md`
- `docs/storage.md`
- `frontend/README.md`
- `frontend/app-config.js`
- `frontend/app.js`
- `frontend/backend/app.js`
- `frontend/backend/features/discover.js`
- `frontend/backend/features/metadata.js`
- `frontend/backend/features/show-detail-controller.js`
- `frontend/backend/idb-store.js`
- `frontend/components/library.js`
- `frontend/components/share-list-pdf.js`
- `frontend/components/share-title.js`
- `frontend/components/share.js`
- `frontend/icons/episode-stack-intro.gif`
- `frontend/index.html`
- `frontend/pages/details.js`
- `frontend/pages/discover.js`
- `frontend/pages/profile.js`
- `frontend/pages/settings.js`
- `frontend/pages/statistics.js`
- `frontend/pages/sync.js`
- `frontend/styles.css`
- `frontend/styles/cuemark-legacy.css`
- `frontend/styles/demo-pages.css`
- `frontend/styles/details.css`
- `frontend/styles/ios-ui.css`
- `frontend/styles/motion.css`
- `frontend/styles/ui-polish.css`
- `package-lock.json`
- `package.json`

## Deleted (16)

- `android/app/src/main/res/drawable-land-hdpi/splash.png`
- `android/app/src/main/res/drawable-land-mdpi/splash.png`
- `android/app/src/main/res/drawable-land-xhdpi/splash.png`
- `android/app/src/main/res/drawable-land-xxhdpi/splash.png`
- `android/app/src/main/res/drawable-land-xxxhdpi/splash.png`
- `android/app/src/main/res/drawable-port-hdpi/splash.png`
- `android/app/src/main/res/drawable-port-mdpi/splash.png`
- `android/app/src/main/res/drawable-port-xhdpi/splash.png`
- `android/app/src/main/res/drawable-port-xxhdpi/splash.png`
- `android/app/src/main/res/drawable-port-xxxhdpi/splash.png`
- `android/app/src/main/res/drawable/splash.png`
- `frontend/favicon.png`
- `frontend/icons/Capacitor.svg`
- `frontend/pages/dashboard.js`
- `frontend/pages/search.js`
- `frontend/static/pages/settings/manage-backups.html`

## Untracked (28)

- `docs/unstaged-changes-0.1.3.md`
- `logos/03-episode-stack-intro.gif`
- `logos/03-episode-stack.svg`
- `logos/report.md`
- `tests/README.md`
- `tests/add-header-layout.test.js`
- `tests/android-overscroll.test.js`
- `tests/android-splash.test.js`
- `tests/animation-settings.test.js`
- `tests/custom-source-theme.test.js`
- `tests/database.test.js`
- `tests/detail-header-glass.test.js`
- `tests/details-page.test.js`
- `tests/details.test.js`
- `tests/discover-page.test.js`
- `tests/frontend-integrity.test.js`
- `tests/history-activity-scope.test.js`
- `tests/light-theme-surfaces.test.js`
- `tests/metadata-sources-ui.test.js`
- `tests/providers.test.js`
- `tests/server.test.js`
- `tests/settings-toggle-theme.test.js`
- `tests/share-pdf-options.test.js`
- `tests/source-options-ui.test.js`
- `tests/splash.test.js`
- `tests/theme-colors.test.js`
- `tests/upcoming-episodes.test.js`
- `tests/watchlist-poster.test.js`

## Staging state

No staged changes were present when this snapshot was generated.
