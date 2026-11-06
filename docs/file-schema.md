# ScreenMark file layout

```text
ScreenMark/
├── frontend/                          # complete app source and Capacitor webDir
│   ├── index.html                     # app shell and script entry point
│   ├── app.js                         # routing, state, and interactions
│   ├── app-config.js                  # app identity and categories
│   ├── pages/                         # one render module per screen (incl. explore, mix, add)
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
