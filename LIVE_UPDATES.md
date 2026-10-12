# Patient Live Updates

The Patient Android app uses `@capgo/capacitor-updater` with the `production`
channel. It downloads a verified web bundle while the app is in the foreground
and applies it the next time the app moves to the background.

## One-time setup

1. Create a Capgo app for `com.oneminute.healthcare.patient`.
2. Create and set its `production` channel as the default channel.
3. Store the Capgo API key only in CI/CD secrets.
4. In CI, authenticate the upload command with:

```powershell
npx @capgo/cli@latest login $env:CAPGO_API_KEY
```

5. Build and publish web-only changes with:

```powershell
npm run live:update:patient
```

Do not publish a live bundle for native changes such as Android permissions,
Capacitor plugins, the Android manifest, or native SDK upgrades. Those changes
require a new APK or store release.

## CareGuard phone reminders need a new APK

CareGuard's on-phone reminders use `@capacitor/local-notifications` and the `POST_NOTIFICATIONS`
permission. That is a native change, so it cannot go out as a live update: build and release a new
patient APK (`npm run native:patient:sync:android`, then build in Gradle). Until the new APK is
installed, the web code from a live update still works, but phone reminders are simply not scheduled.
