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
- **Gen-Z voice:** happy, cheeky double meaning, relatable — see `docs/social/genz-voice-guide.txt`
- Full week captions: `docs/social/genz-week-posts.txt`
- Profile photo: `docs/social/scanv-profile-picture.png` (all platforms)
- Always link `scanv-tau.vercel.app` + UTM: `?utm_source=social&utm_medium=genz`
- Marathi + Hindi + Hinglish hooks for Pune/PCMC
- Post **9:30 AM – 7 PM IST** only
- Repurpose one Short → Reel → TikTok (same video, crop 9:16)

## App integration

Footer social icons: `src/social-links.js` — update URLs if handles differ.

## Daily tracking dashboard

**Admin tab:** `#admin?tab=social` — **Post everywhere today** panel (5-platform checklist).

| Feature | Detail |
|---------|--------|
| Post everywhere | One caption → Facebook, Instagram, TikTok, YouTube, Shorts |
| Platform checklist | Mark each platform posted + save URL |
| Streak | Counts when 5/5 platforms done that day |
| Rolling calendar | Week 1 themes repeat every 7 days |
| Stories / emotional | Extra items tracked separately |

**CLI:** `node scripts/social_pulse.mjs` — today's caption + 5-platform checklist.

**Guide:** `docs/social/daily-post-everywhere.txt`

Set **Week 1 start date** in dashboard when you begin posting (defaults to today on migration).

## What agent cannot do

Creating Meta/TikTok/YouTube accounts requires **your login + phone verification**. Agent cannot receive OTP or store passwords.

**You:** follow `docs/social/ACCOUNT-SETUP-RUNBOOK.md` · run `bash scripts/open-social-signup.sh` · save secrets in `docs/social/credentials.env` (gitignored, never commit).

After accounts exist, send **public profile URLs only** — agent updates `src/social-links.js` and admin index.
