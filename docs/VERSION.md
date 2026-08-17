# ScanV Version Registry

## Live production — v5.5.2

| Field | Value |
|-------|-------|
| **Version** | `5.5.2` (build stamp `1786395600000`) |
| **Status** | Deployed on Vercel |
| **URL** | [https://getscanv.com](https://getscanv.com) |
| **Git commit** | `8fbfd930b86e3a9abad87ebecb13439ef3e74584` |
| **Commit message** | Change commitments tagline to Global Happiness. |
| **Branch** | `main` |
| **Deployed** | 2026-08-13T22:09:35Z (Vercel `last-modified`) |
| **JS bundle** | `main.434947e8.js` |
| **Package `_deployed`** | 2026-08-10T00:32:58.221Z |

### What’s in v5.5.2 (production)

- Full-bleed mobile layout (edge-to-edge, no side gutters)
- Trust pills: 5-column grid, commitment pages linked
- GPS header shows real city + PIN (not “Local Communities” placeholder)
- Copyright footer scrolls with content; Incorporation SF origin line
- Home commitments: **Local Community** · **Local Support** · **Global Happiness...!**
- Mobile content zoom +8% (nav excluded)
- PWA manifest + service worker; **iOS “Add to Home Screen” install gate still shown**
- QR scan (`?qr=1`) → loading screen → **registration wall**
- Admin hub reports `app_version: 5.5.2`

### QR URL (production behavior)

```
https://getscanv.com/?qr=1&utm_source=qr&utm_medium=print
```

Opens QR landing → register flow (not direct browse).

---

## Next release — v5.5.3 (local, not yet pushed)

| Field | Value |
|-------|-------|
| **Version** | `5.5.3.1786665000000` |
| **Git commit** | `6625e82` (tag `v5.5.3`) |
| **Status** | Committed locally · awaiting `git push` |
| **JS bundle (local build)** | `main.d1387dad.js` |
| **Built** | 2026-08-14 |

### Changes in v5.5.3

| Area | Change |
|------|--------|
| QR flow | Scan opens **services home immediately** — no registration wall |
| Install UX | **Removed** iOS “Add to Home Screen” gate |
| QR capture | Device/GPS saved in **background** to `qr_scans` |
| QR asset | `public/scanv-qr.png` — printable 512×512 PNG |
| QR constant | `SCANV_QR_URL` in `src/App.js` |
| Store roadmap | `docs/APP-STORE-ROADMAP.md` — Play Store + App Store via Capacitor |

### QR URL (v5.5.3 behavior)

```
https://getscanv.com/?qr=1&utm_source=qr&utm_medium=print
```

Same URL — after deploy, scan goes straight to browse; `?qr=` params stripped from address bar after capture.

---

## Stack (both versions)

| Layer | Detail |
|-------|--------|
| Frontend | React 18 · single-file `src/App.js` · CRA 5.0.1 |
| Backend | Supabase `rwlwrmmqtedugcreweut` |
| Payments | Razorpay + Vyapar UPI |
| Hosting | Vercel (auto-deploy on `main` push) |
| PWA | `public/manifest.json`, `public/sw.js` |

## Git tags

| Tag | Points to | Notes |
|-----|-----------|-------|
| `v5.5.2` | `8fbfd93` | Last production deploy before QR/install changes |
| `v5.5.3` | `6625e82` | QR direct-open + no install gate |

## Verify production

```bash
curl -sI https://getscanv.com/ | grep -i last-modified
curl -s https://getscanv.com/ | grep -o 'main\.[a-f0-9]*\.js'
```

## Deploy v5.5.3

```bash
git push origin main
git push origin v5.5.3
```

Vercel rebuilds automatically (~1–2 min).

---

*DCore · ScanV · [scanversecorp/scanverse](https://github.com/scanversecorp/scanverse)*
