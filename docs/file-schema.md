# ScreenMark file layout

```text
ScreenMark/
├── frontend/                          # complete app source and Capacitor webDir
│   ├── index.html                     # app shell and script entry point
│   ├── app.js                         # routing, state, and interactions
│   ├── app-config.js                  # app identity and categories
│   ├── pages/                         # render modules for library, watchlist, discovery, profile and settings screens
│   ├── styles/                        # ios-ui.css (look + multi-screen), motion.css (animations, low-memory mode)
│   ├── components/                    # shared frontend components
│   └── backend/                       # single source for metadata and storage modules
├── android/                           # Capacitor Android project
├── docs/                              # app-specific documentation
├── CHANGELOG.md                       # release notes
├── dev-server.js                      # local server and restricted source proxy
├── local-secrets.js                   # optional local-only API keys (ignored by Git)
├── capacitor.config.json             # app ID and frontend webDir
├── package.json
└── compile_apk.py
```

There is one maintained copy of each web module: `frontend/backend/` is packaged by Capacitor as-is. Native Android plugins under `android/app/src/main/java/` provide encrypted storage, backups, provider sessions and system scrollbar control.

Generated files such as Android build output, local SDK downloads, dependencies, APKs, local properties, and local environment files are excluded by the app-root `.gitignore`.

## Developer tools (0.1.5)

`tests/tools/probe-sources.js` loads the app's own metadata loaders against live APIs (search, details, cast, characters, episodes and linked pages; API keys come from environment variables only) and `tests/tools/probe-discover.js` checks every Discover shelf and search. New test files: `backup-compression.test.js`, `release-0-1-5.test.js`, `jikan-source.test.js`, `imdb-source.test.js`, `sources-review.test.js`.
