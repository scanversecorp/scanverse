# ScanV — App Store & Play Store Roadmap

ScanV is live as a **web app** at [https://scanv-tau.vercel.app](https://scanv-tau.vercel.app).  
The customer QR opens that URL directly — **no “Add to Home Screen” step**.

| QR URL | Purpose |
|--------|---------|
| `https://scanv-tau.vercel.app/?qr=1&utm_source=qr&utm_medium=print` | Print / share QR — opens browse home, captures scan analytics in background |
| Printable PNG | `public/scanv-qr.png` (same URL encoded) |

---

## Phase 1 — Done (web + QR)

- [x] Remove iOS “Add to Home Screen” install gate
- [x] QR scan → services home immediately (not registration wall)
- [x] Background device/GPS capture to `qr_scans`
- [x] Vercel deploy on push to `main`

---

## Phase 2 — Wrap web app for stores (Capacitor)

**Recommended:** [Capacitor](https://capacitorjs.com/) — wraps the existing React build in a native shell for iOS and Android without rewriting the UI.

### Prerequisites

| Item | Android (Play Store) | iOS (App Store) |
|------|----------------------|-----------------|
| Developer account | [Google Play Console](https://play.google.com/console) — $25 one-time | [Apple Developer Program](https://developer.apple.com/programs/) — $99/year |
| Machine | Any OS | macOS + Xcode for signing & upload |
| Privacy policy | Required — already at `/privacy` on production | Same |
| App icons | 512×512 Play + adaptive icon | 1024×1024 App Store icon set |

### Setup (one-time)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init ScanV com.scanverse.scanv --web-dir build
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

Point Capacitor `server.url` at production during dev, or ship the `build/` folder for offline-first.

### Native features to add later

- Push notifications (booking alerts for vendors) — `@capacitor/push-notifications` + FCM / APNs
- Deep links — `scanv://` or `https://scanv-tau.vercel.app` universal links
- GPS — already works in WebView; Capacitor Geolocation optional for tighter control

---

## Phase 3 — Google Play Store

1. **Build signed AAB**
   ```bash
   npm run build && npx cap sync android
   cd android && ./gradlew bundleRelease
   ```
2. **Play Console** → Create app → Production track
3. **Store listing:** title *ScanV*, short description, screenshots (phone 1080×1920), feature graphic 1024×500
4. **Content rating** questionnaire (IARC)
5. **Data safety** form — declare location, device info (matches `qr_scans` / booking flows)
6. **Upload** `app-release.aab`, roll out staged (internal → closed → production)

**Alternative (Android only):** [Trusted Web Activity (TWA)](https://developer.chrome.com/docs/android/trusted-web-activity/) — lighter wrapper if you only need the PWA in Play; Capacitor is better if you need push and store branding.

---

## Phase 4 — Apple App Store

1. **Xcode:** open `ios/App`, set bundle ID `com.scanverse.scanv`, signing team
2. **Archive** → Upload to App Store Connect
3. **App Store Connect:** metadata, screenshots (6.7" + 6.5" iPhone), age rating, privacy nutrition labels
4. **Review notes:** explain location use for nearby services and QR onboarding
5. Submit for review (typically 1–3 days)

Apple **does not** accept “install our PWA” as the primary product — the Capacitor shell with native navigation and (optionally) push satisfies guidelines.

---

## Phase 5 — Optional production hardening

| Task | Why |
|------|-----|
| Custom domain `app.scanv.com` | Cleaner QR + store links |
| `assetlinks.json` (Android) + Apple Associated Domains | Verified links / TWA |
| Firebase Cloud Messaging + APNs | Vendor booking alerts |
| Store badges on marketing site | “Get it on Google Play” / “Download on the App Store” |

---

## Current deploy

Push to `main` → Vercel builds and deploys automatically.  
After code changes in this repo, verify QR flow on a real phone:

1. Scan `public/scanv-qr.png` or admin **ScanV QR Code** screen
2. Confirm: services home loads with no install sheet
3. Confirm: location appears in header after GPS permission

---

## Support

Technical owner: DCORE Global Corporation · [scanversecorp/scanverse](https://github.com/scanversecorp/scanverse)
