# Budget Tracker

Personal expense, credit-card, travel and mutual-fund tracker for Android and iOS.
Built with React Native + Expo (TypeScript), local SQLite storage and a claymorphic UI.

- **Plan & roadmap:** [PLAN.md](PLAN.md)
- **App source:** [mobile/](mobile/)
- **Sync server:** [server/](server/) (Fastify + MongoDB Atlas)

## Run in development

```bash
cd mobile
npm install
npx expo start        # scan the QR code with Expo Go
```

## Checks

```bash
cd mobile
npm run typecheck
npx expo lint
npm test
```

## Build a test APK (Windows)

```bash
cd mobile
npx expo prebuild --platform android
# android/local.properties must point cmake.dir at CMake >= 3.31 (Windows long paths)
cd android
./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
# output: android/app/build/outputs/apk/release/app-release.apk
```

## Ship an update without a new APK (OTA)

```bash
cd server
npm run publish-update -- --message "What changed"
```

Phones download it the next time the app opens. See [server/README.md](server/README.md).
