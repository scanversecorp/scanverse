# ScanV — Google Search & Brand Indexing

**Goal:** When someone searches **“ScanV”** or **“getscanv”**, `https://getscanv.com` should be result #1.

**Updated:** 19 Aug 2026

---

## Why Google shows “ScanV coming to?” (snippet issue)

**Root cause:** The website HTML does **not** say “coming soon” — but your **pre-launch social copy** does, heavily:

- Instagram/Facebook bios and posts: “🚀 Coming soon everywhere in Pune & PCMC”, “Coming Hot”, “Pune, I'm coming HOT”
- Google often **rewrites snippets** from indexed social profiles, linked pages, or visible page text — not just `<meta description>`

Because the homepage is a **JavaScript SPA** with almost no static body text, Google had little on-page copy to use and may pull from Instagram `@scanvapp` instead. That gets truncated to something like **“ScanV coming to?”**.

**Competing names** also dilute brand search: Scanova, Scanva, Scany (Play Store / Chrome) rank for fuzzy “ScanV” queries.

**Fixes shipped in code (19 Aug 2026):**

| Change | File | Why |
|--------|------|-----|
| Title → “ScanV — Official App \| getscanv.com” | `index.html` | Brand-first, definitive (not pre-launch) |
| Meta + OG + Twitter → “official booking app” | `index.html`, `scanv-brand.html` | Consistent snippet candidates |
| Rich `<noscript>` + loader text | `index.html` | Crawlable copy without JS |
| WebApplication JSON-LD + social `sameAs` | `index.html` | Brand ↔ domain ↔ Instagram/Facebook link |
| Manifest name/description | `manifest.json` | PWA install label matches brand |

**Manual actions still required:**

1. **Update Instagram/Facebook bio** — replace “Coming soon…” with:  
   `ScanV — Official app · getscanv.com · Pune & PCMC`
2. **GSC** → Sitemaps → submit `sitemap.xml` (retry now that XML is live)
3. **GSC** → URL inspection → Request indexing for `/` and `/scanv-brand.html` after deploy
4. **Google Business Profile** — business name exactly `ScanV`, website `getscanv.com`
5. **Link getscanv.com** from dcoreglobal.com footer

**Timeline for #1 on “ScanV”:** 2–6 weeks after deploy + GSC re-crawl, assuming social bios updated and no stronger trademark conflict. Exact brand match + verified domain usually wins once authority signals align.

---

## What we shipped in code

| Asset | Path | Purpose |
|-------|------|---------|
| `robots.txt` | `/robots.txt` | Allow crawl; point to sitemap |
| `sitemap.xml` | `/sitemap.xml` | Homepage, brand page, legal URLs |
| Brand landing (static HTML) | `/scanv-brand.html` | Crawlable “ScanV official site” page |
| JSON-LD Organization + WebSite | `public/index.html`, `scanv-brand.html` | Tells Google the brand ↔ domain link |
| Canonical + title | `public/index.html` | Brand-first title with `getscanv.com` |
| Vercel rewrite fix | `vercel.json` | Stop serving SPA HTML for `robots.txt` / sitemap |

**Verify after deploy:**

```bash
curl -sI https://getscanv.com/robots.txt | head -5
curl -s https://getscanv.com/robots.txt | head -3
curl -s https://getscanv.com/sitemap.xml | head -5
```

You should see plain text / XML — **not** the React app shell.

---

## Step 1 — Google Search Console (required)

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sign in as **`connect@dcoreglobal.com`** or a dedicated Google account
3. **Add property** → choose **Domain** → `getscanv.com` (covers www + https)
4. Verify via **DNS TXT record** in Cloudflare (recommended):
   - Cloudflare → getscanv.com → DNS → Add TXT
   - Name: `@` · Value: `google-site-verification=XXXX` (from GSC)
5. After verify, uncomment and set in `public/index.html`:

   ```html
   <meta name="google-site-verification" content="YOUR_TOKEN"/>
   ```

6. **Sitemaps** → Submit: `https://getscanv.com/sitemap.xml`
7. **URL inspection** → Request indexing for:
   - `https://getscanv.com/`
   - `https://getscanv.com/scanv-brand.html`
   - `https://getscanv.com/privacy`
   - `https://getscanv.com/terms`

Data usually appears in 24–72 hours.

---

## Step 2 — Google Business Profile (strong for “ScanV” local brand)

1. [business.google.com](https://business.google.com) → Create profile
2. **Business name:** `ScanV` (exact brand)
3. **Category:** Software company / Internet marketing service (pick closest)
4. **Website:** `https://getscanv.com`
5. **Phone:** +91-9270194842
6. **Service area:** Pune, Pimpri-Chinchwad (not a fake storefront unless you have one)
7. **Address:** Use **registered / virtual office address** once India entity is live ([VIRTUAL-OFFICE-INDIA.md](./VIRTUAL-OFFICE-INDIA.md))
8. Verify by postcard or video per Google’s prompt

---

## Step 3 — Brand signals (off-site)

Link **getscanv.com** from every profile (same URL, same spelling **ScanV**):

| Channel | Action |
|---------|--------|
| Instagram / Facebook / LinkedIn | Website = getscanv.com |
| YouTube | Channel link + video descriptions |
| dcoreglobal.com | Prominent link to ScanV |
| Email signatures | Already use connect@ — add getscanv.com |
| App stores (future) | Developer website = getscanv.com |

Add social URLs to JSON-LD `sameAs` in `scanv-brand.html` once accounts are live.

---

## Step 4 — Trademark (optional but helps disambiguation)

Apply **“ScanV”** word mark via [IP India](https://ipindia.gov.in/) — Class 42 (software) + Class 35 (marketplace). See [REGULATORY-APPROVALS-INDIA.md](./REGULATORY-APPROVALS.md) A20.

---

## Step 5 — Monitor branded queries

In GSC → **Performance** → filter queries containing:

- `scanv`
- `getscanv`
- `scan v`

Track impressions, average position, and CTR weekly. Position 1 for exact brand usually stabilizes within 2–4 weeks after indexing if no stronger homonym exists.

---

## SPA limitation (honest note)

Most of the app renders in JavaScript. Legal pages (`/privacy`, etc.) and `scanv-brand.html` are the best crawl targets today. For broader SEO (e.g. “deep cleaning Pune”), consider prerender or a small marketing site later.

---

## Regenerate sitemap

```bash
node scripts/generate-sitemap.mjs
```

---

## Checklist

- [x] Deploy robots.txt + sitemap + brand page
- [x] GSC domain verified (DNS TXT)
- [ ] Sitemap submitted (retry in GSC → `sitemap.xml`)
- [ ] Top 4 URLs requested for indexing (after official-app meta deploy)
- [ ] Google Business Profile created
- [ ] Social bios updated — **remove “Coming soon”**, use “Official app · getscanv.com”
- [ ] India registered address added to schema when available
