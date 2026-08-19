# ScanV Instagram daily automation (@scanvapp)

**Schedule:** every day **10:00 AM IST** (04:30 UTC)  
**Method:** Meta Instagram Graph API (no browser automation)  
**Script:** `node scripts/instagram_daily_post.mjs`  
**Workflow:** `.github/workflows/instagram-daily-post.yml`

---

## What it does

1. Picks today's caption from a **14-day rotation** (`scripts/lib/social-daily-content.mjs`)
2. Uses admin dashboard caption when `ADMIN_HUB_PIN` is set and dashboard has content
3. Posts image from **https://getscanv.com/social/** (PNG assets in `public/social/`)
4. Publishes to **@scanvapp** via Graph API

**Dry run (no publish):**
```bash
node scripts/instagram_daily_post.mjs --dry-run
```

**Manual trigger:** GitHub → Actions → *Instagram daily post* → Run workflow → choose dry run if testing.

---

## One-time Meta setup (~20 min)

### 1. Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Type: **Business** → name: **ScanV Social**
3. Add product: **Instagram Graph API**
4. Add product: **Facebook Login** (for token tools)

### 2. Link Instagram to Facebook Page

1. Instagram app → Settings → Account → **Switch to professional account**
2. Link to Facebook Page **ScanV** (`facebook.com/scanvapp`)
3. Confirm @scanvapp shows in Meta Business Suite

### 3. Permissions (App Review may be needed for production)

Required scopes on the **Page access token**:

| Scope | Purpose |
|-------|---------|
| `instagram_basic` | Read IG account |
| `instagram_content_publish` | Publish feed posts |
| `pages_read_engagement` | Page ↔ IG link |
| `pages_show_list` | List pages |

For **your own** Page + IG you can often test in Development mode without full review.

### 4. Get Instagram User ID

**Option A — Graph API Explorer**

1. [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Select your app → Generate **Page** access token with scopes above
3. Query: `GET /{page-id}?fields=instagram_business_account`
4. Copy `instagram_business_account.id` → `META_IG_USER_ID`

**Option B — set `META_PAGE_ID` only**  
The script will resolve IG user ID from the Page automatically.

### 5. Long-lived Page access token

Short-lived tokens expire in ~1 hour. For cron you need a **long-lived Page token** (~60 days) or System User token (best for production).

**Quick path (Page token):**

1. Graph API Explorer → User token with `pages_show_list`, `instagram_content_publish`
2. `GET /me/accounts` → copy Page `access_token` for ScanV
3. Exchange for long-lived:
   ```
   GET /oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-token}
   ```
4. Store result as `META_PAGE_ACCESS_TOKEN`

**Production path:** Meta Business Manager → **System User** → assign Page + IG → generate permanent token.

---

## Secrets to add

### GitHub (repo → Settings → Secrets → Actions)

| Secret | Required | Example |
|--------|----------|---------|
| `META_PAGE_ACCESS_TOKEN` | ✅ | Long-lived Page token |
| `META_IG_USER_ID` | ✅* | Numeric IG business account ID |
| `META_PAGE_ID` | Optional | Facebook Page ID (fallback lookup) |
| `META_GRAPH_API_VERSION` | Optional | `v21.0` |
| `ADMIN_HUB_PIN` | Optional | Use admin social dashboard caption |

\*Or set `META_PAGE_ID` instead of `META_IG_USER_ID`.

### Local (`docs/social/credentials.env`)

Copy from `credentials.template.env` and fill:

```
META_IG_USER_ID=1234567890
META_PAGE_ID=9876543210
META_PAGE_ACCESS_TOKEN=EAAxx...
META_GRAPH_API_VERSION=v21.0
```

Never commit `credentials.env`.

---

## Deploy image assets

Images must be live at `https://getscanv.com/social/*.png` before cron runs.

Files in `public/social/`:

| File | Used for |
|------|----------|
| `coming-hot-post.png` | Most daily posts |
| `scanv-profile-picture.png` | Trust / how-it-works |
| `scanv-funny-insta-post-2026-08-19.png` | WhatsApp uncle meme |

After adding images, deploy to Vercel (push to `main`).

---

## Cron schedule

| When | Cron (UTC) | Notes |
|------|------------|-------|
| 10:00 AM IST | `30 4 * * *` | GitHub Actions schedule |

GitHub cron can drift ±15 min — acceptable for social posts.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing META_PAGE_ACCESS_TOKEN` | Add GitHub secret |
| `(190) Invalid OAuth` | Token expired — regenerate long-lived token |
| `(10) Permission denied` | Add `instagram_content_publish` scope |
| `(9007) Media not ready` | Script retries automatically |
| Image URL fetch failed | Deploy `public/social/` to production first |
| `(100) Invalid image url` | URL must be HTTPS and publicly reachable |

**Test token:**
```bash
curl "https://graph.facebook.com/v21.0/{IG_USER_ID}?fields=username&access_token={TOKEN}"
```

Should return `"username": "scanvapp"`.

---

## Content rotation

Edit `scripts/lib/social-daily-content.mjs` → `DAILY_POSTS` array.

Epoch: **2026-08-19** = cycle day 1. Same calendar day always gets same slot in the 14-day loop.

To override with admin dashboard: set `ADMIN_HUB_PIN` secret — uses `today_everywhere.caption` when available.

---

## Related

- Brand voice: `docs/social/genz-voice-guide.txt`
- Manual kit: `docs/social/README.txt`
- Config: `docs/social/scanv-social-config.json`
- Legacy browser script (manual only): `scripts/instagram_post.mjs`
