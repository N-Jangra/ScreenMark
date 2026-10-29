# ScreenMark requirements

## Browser preview

- Node.js 18 or newer
- npm

Run `npm install` and `npm run serve` from the app directory.

## Android packaging

- JDK 17
- Android SDK and platform tools
- Android Gradle Plugin and Gradle wrapper supplied by the project
- Capacitor Android dependencies installed by npm

Run `npm run cap:sync` after frontend or backend changes, then build using Android Studio or Gradle. Online discovery requires an internet connection. The providers and API key requirements are listed in [metadata.md](metadata.md).
