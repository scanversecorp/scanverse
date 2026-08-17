# ScanV social accounts — setup runbook

**Handle target:** `@scanvapp` everywhere  
**Business email:** connect@dcoreglobal.com  
**Business phone:** +91-9270194842  
**Profile photo:** `docs/social/scanv-profile-picture.png`  
**Credentials file (local only, never commit):** `docs/social/credentials.env`

---

## Why the agent cannot create accounts for you

Facebook, Instagram, TikTok, and YouTube require **your** phone OTP, email inbox access, and sometimes ID verification. No API or script can bypass that. Follow this runbook once (~45 min), then paste details into `credentials.env`.

---

## Before you start

1. Copy template: `cp docs/social/credentials.template.env docs/social/credentials.env`
2. Use a **password manager** (1Password, Bitwarden, iCloud Keychain) for all passwords
3. Prefer **connect@dcoreglobal.com** for Meta + Google where possible
4. Use **9270194842** for SMS verification (business SIM, not personal if avoidable)
5. Save backup codes when each platform offers them → `credentials.env`

---

## 1. Meta — Facebook Page + Instagram (15 min)

| Step | Action |
|------|--------|
| 1 | Log in at [facebook.com](https://www.facebook.com) with a **personal** FB account you control (admin of the Page) |
| 2 | Open [facebook.com/pages/create](https://www.facebook.com/pages/create) |
| 3 | Category: **Local business** or **Product/service** |
| 4 | Page name: **ScanV** |
| 5 | Upload `docs/social/scanv-profile-picture.png` as profile photo |
| 6 | Set username: [facebook.com/scanvapp](https://www.facebook.com/scanvapp) (Settings → Page name → @username) |
| 7 | About → Website: `https://getscanv.com` · Phone: 9270194842 · Email: connect@dcoreglobal.com |
| 8 | Paste About text from `docs/social/facebook-page.txt` |
| 9 | Open [business.facebook.com](https://business.facebook.com) → add Page **ScanV** to Business Portfolio (create portfolio **ScanV** if needed) |
| 10 | Instagram: Settings → Account → Add new professional account **OR** link existing → username **scanvapp** |
| 11 | IG bio from `docs/social/instagram-profile.txt` · link in bio → app URL |
| 12 | Meta Business Suite: connect FB Page + IG → schedule posts |

**Save in credentials.env:** `META_PAGE_ID`, `META_PAGE_URL`, `INSTAGRAM_HANDLE`, `INSTAGRAM_URL`, admin FB login used

---

## 2. TikTok Business (10 min)

| Step | Action |
|------|--------|
| 1 | [tiktok.com/signup](https://www.tiktok.com/signup) — phone **9270194842** or email **connect@dcoreglobal.com** |
| 2 | Profile → **Switch to Business Account** → category Local Services |
| 3 | Username: **scanvapp** → [tiktok.com/@scanvapp](https://www.tiktok.com/@scanvapp) |
| 4 | Bio from `docs/social/tiktok-profile.txt` |
| 5 | Edit profile → Website: `https://getscanv.com` |
| 6 | Upload same profile photo |

**Save in credentials.env:** `TIKTOK_USERNAME`, `TIKTOK_URL`, login method (phone/email)

---

## 3. YouTube + Shorts (10 min)

| Step | Action |
|------|--------|
| 1 | Sign in to Google as **connect@dcoreglobal.com** (or create `scanvapp@gmail.com` dedicated account) |
| 2 | [studio.youtube.com](https://studio.youtube.com) → Create channel → name **ScanV** |
| 3 | Custom URL / handle: **@scanvapp** → [youtube.com/@scanvapp](https://www.youtube.com/@scanvapp) |
| 4 | Upload profile photo + banner (app screenshot + tagline from `youtube-channel.txt`) |
| 5 | Description from `docs/social/youtube-channel.txt` |
| 6 | Links: website + social links when live |

**Save in credentials.env:** `YOUTUBE_CHANNEL_ID`, `YOUTUBE_HANDLE`, `YOUTUBE_URL`, Google account email

---

## 4. Wire app + admin (5 min)

After handles are live, confirm URLs in `src/social-links.js` match. If handles differ, tell the agent to update.

Post Day 1 from `docs/social/genz-week-posts.txt` after **9:30 AM IST**. Track in `#admin?tab=social`.

---

## 5. Security checklist

- [ ] Unique strong password per platform (or Google + Meta SSO only where intended)
- [ ] 2FA enabled on Google + Meta personal admin account
- [ ] `credentials.env` **not** committed to git (already in `.gitignore`)
- [ ] Backup codes stored in password manager
- [ ] Page admins: only trusted people; no shared passwords in WhatsApp

---

## Quick open (Mac)

```bash
bash scripts/open-social-signup.sh
```

Opens Meta, TikTok signup, YouTube Studio, and credentials template in your browser.

---

## After setup — send agent (no passwords in chat)

Reply with **public URLs only**:

```
Facebook: https://www.facebook.com/scanvapp
Instagram: https://www.instagram.com/scanvapp
TikTok: https://www.tiktok.com/@scanvapp
YouTube: https://www.youtube.com/@scanvapp
```

Agent will verify links in footer + admin index. **Never paste passwords in Cursor chat.**
