# ScanV social media launch

**Brand:** ScanV only (DCore = parent, not in social bios)  
**Handle:** `@scanvapp` on all platforms  
**App link:** https://scanv-tau.vercel.app  
**Support:** +91-9270194842 · connect@dcoreglobal.com

## Platforms

| Platform | Setup file | Posting tool |
|----------|------------|--------------|
| Facebook Page | `docs/social/facebook-page.txt` | Meta Business Suite |
| Instagram | `docs/social/instagram-profile.txt` | Meta Business Suite |
| TikTok | `docs/social/tiktok-profile.txt` | TikTok app / CapCut |
| YouTube + Shorts | `docs/social/youtube-channel.txt` | YouTube Studio |

Copy kit: `docs/social/` · Week plan: `node scripts/social_content_calendar.mjs`

## 30-minute setup (you)

1. **Meta** — [business.facebook.com](https://business.facebook.com) → Create Page **ScanV** → username `scanvapp` → connect Instagram
2. **YouTube** — Google account → YouTube Studio → Create channel **ScanV** → handle `@scanvapp`
3. **TikTok** — Sign up → Business account → username `scanvapp` → link website
4. Paste bios from `docs/social/*.txt`
5. Post Day 1 content from `first-week-posts.txt` (after 9:30 AM IST)

## Content rules

- Say **ScanV** only in captions (not DCore)
- Always link `scanv-tau.vercel.app` + UTM: `?utm_source=instagram&utm_medium=social`
- Marathi + Hindi hooks for Pune/PCMC; English optional subtitle
- Post **9:30 AM – 7 PM IST** only
- Repurpose one Short → Reel → TikTok (same video, crop 9:16)

## App integration

Footer social icons: `src/social-links.js` — update URLs if handles differ.

## What agent cannot do

Creating Meta/TikTok/YouTube accounts requires **your login + phone verification**. After you create `@scanvapp`, tell the agent — we can add verified links to admin URL index and run ad-ready UTM campaigns.
