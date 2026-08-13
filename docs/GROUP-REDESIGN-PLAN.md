# Group website redesign — working plan (INTERNAL)

**Owner:** Sam + Cursor · **Started:** 13 Aug 2026  
**Status:** Prototypes on localhost · **Primary redesign: dcoreglobal.com** · Wix at 2FA in Cursor browser  
**Do not publish** parent/child hierarchy on live sites until Sam approves.

---

## Internal structure (do not call out publicly yet)

```
VanguardNode (vanguardnode.com) — parent holding / engineering & streaming IP
    └── DCORE Global (dcoreglobal.com) — India hub: datacenter, cloud, AI research, training
            └── ScanV (scanv-tau.vercel.app) — consumer & partner marketplace (PCMC/Pune)
Rich Royals Corp (richroyalscorp.com) — separate beauty brand (sibling portfolio)
```

**Possible 4th property to confirm with Sam:** ~~dcore.in~~ **Confirmed focus site: [dcoreglobal.com](https://www.dcoreglobal.com/)** · `scanverse.com` is unrelated US archiving company.

---

## Site audit summary

### vanguardnode.com (Wix · expires May 2027)

| Area | Current | Issues |
|------|---------|--------|
| Positioning | Offshore IT + video streaming products | Generic; typos ("Vanguardnode", "Resourceus"); weak India/AI story |
| Services (6) | Software dev, managed IT, app maintenance, pre/post support, cloud/DevOps, consulting | No explicit AI/automation lane; overlaps DCORE |
| Products (5) | Video hosting, OTT app, EdTech, exam proctoring, sports analytics | Strong differentiator — lead with these |
| Infrastructure | 10 Gbps, object storage, firewalls | Good proof — tie to DCORE datacenter story |
| Contact | Info@vanguardnode.com · Mayur Trade Center, PCMC | OK |

### dcoreglobal.com (Wix · expires May 2027)

| Area | Current | Issues |
|------|---------|--------|
| Positioning | Datacenter, cloud, AI research, training, incubation | Strong content but long homepage; email typo `decoreglobal.com` in footer |
| Pillars (8) | R&D, AI datacenters, education, incubation, consulting, managed IT, innovation partnerships, expert community | Missing link to **ScanV marketplace** (future) |
| Managed services (6) | Ops, cloud, DC, helpdesk, workforce, AI DC | Align with ScanV **AI, Cloud & Data Center** card |
| Training (3 courses) | DC fundamentals, cloud, AI/ML for IT | Add **Cursor + AI dev** track |
| Stats | 3+ DC, 1000+ trained, 20+ startups | Verify or soften claims |

### richroyalscorp.com (Wix · expires Sep 2027)

| Area | Current | Issues |
|------|---------|--------|
| Positioning | Premium natural beauty | Placeholder — "Nothing to book right now" |
| Products | None listed | Needs catalog + booking or Shopify/Wix Stores |
| Social proof | 1 generic review | Needs real products & photos |

### scanv-tau.vercel.app (Vercel · codebase)

| Area | Current | Notes |
|------|---------|-------|
| Positioning | Local services marketplace · DCORE operator | Recently updated home card titles |
| Cloud category | AI, Cloud & Data Center | Should mirror DCORE site services |
| Link to DCORE | Footer link only | Deeper cross-link later (not hierarchy callout) |

---

## Unified service map (what goes where)

| Capability | VanguardNode | DCORE | ScanV |
|------------|:------------:|:-----:|:-----:|
| Custom software / offshore dev | **Lead** | Partner | — |
| Video / OTT / EdTech / proctoring products | **Lead** | Co-sell | — |
| AI datacenter / GPU / HPC | Support | **Lead** | Cloud card |
| Cloud & managed IT (IaaS/PaaS/SaaS) | Support | **Lead** | Bookable (18 svcs) |
| Data Center consulting & build-run | — | **Lead** | Bookable |
| IT training & certification | — | **Lead** | Cloud training svc |
| Startup incubation / research | — | **Lead** | — |
| AI consulting & automation | Add | **Lead** | — |
| Cursor / AI-assisted engineering | Add | Add | Internal ops |
| Local marketplace (food, home, legal…) | — | Brand | **Lead** |
| Beauty / wellness products | — | — | Rich Royals |

---

## NEW services to add (AI + Sam & Cursor)

### VanguardNode — add pages/sections

1. **AI Engineering & Automation** — LLM integration, workflow automation, AI QA, document intelligence  
2. **Cursor-Accelerated Delivery** — "Build with AI pair-programming" (enterprise dev velocity)  
3. **Agentic Ops** — monitoring bots, support triage, dispatch assist (reference ScanV internally)  
4. **Responsible AI & Compliance** — model governance, data residency (India/DPDP)

### DCORE — add pages/sections

1. **AI Research Lab** — open-source, cost-efficient models, sovereign AI  
2. **AI Datacenter Operations** — GPU clusters, inference, fine-tuning (expand pillar 2)  
3. **Cursor for Teams Training** — dev productivity, AI coding standards, secure prompts  
4. **Digital India Services** — government/sovereign cloud (existing gov pillar)  
5. **ScanV for Enterprise** — white-label local services (future — no hierarchy on page yet)  
6. Fix footer email → `connect@dcoreglobal.com`

### ScanV — already in app; align copy with DCORE

- Cloud sub-services match DCORE managed services list  
- Add future: "Enterprise AI consulting" booking (from DCORE funnel)

### Rich Royals — minimum viable redesign

1. Product grid (5–8 SKUs placeholder)  
2. Book / shop CTA  
3. About + ingredients story  
4. Link from portfolio only when ready

---

## Parallel workstreams

| # | Stream | Owner | Tool | Status |
|---|--------|-------|------|--------|
| A | Content & IA (sitemap, copy) | Sam + Cursor | This doc + canvas | **In progress** |
| B | Wix VanguardNode redesign | Cursor (with access) | Wix Editor | **Blocked — need login** |
| C | Wix DCORE redesign | Cursor (with access) | Wix Editor | **Blocked — need login** |
| D | Wix Rich Royals redesign | Sam + Cursor | Wix Editor | **Blocked — need login** |
| E | ScanV app alignment | Cursor | scanverse repo | Ready when Sam picks priorities |
| F | Brand system (colors, typography) | Sam + Cursor | Figma or Wix theme | Not started |
| G | SEO / domains / email fixes | Sam | Namecheap + Wix + Google | Partial (reminders set) |

---

## Phased rollout

### Phase 1 — Foundation (week 1)
- [ ] Confirm 4th domain with Sam  
- [ ] Wix collaborator access for Cursor session  
- [ ] Fix DCORE email typo, broken "Know More" buttons audit  
- [ ] Approve unified sitemap (VN + DCORE)  
- [ ] VanguardNode: hero rewrite + AI section + product-led layout  

### Phase 2 — DCORE + service depth (week 2)
- [ ] DCORE: shorten homepage, 8 pillars → 4 customer journeys  
- [ ] Add AI + Cursor training pages  
- [ ] Cross-link ScanV footer only ("Local services in Pune") — no parent callout  
- [ ] Training enrollment form → connect@dcoreglobal.com  

### Phase 3 — Rich Royals + ScanV bridge (week 3)
- [ ] Rich Royals product catalog + booking  
- [ ] ScanV cloud services copy sync with DCORE  
- [ ] Case studies / blog stubs on VN + DCORE  

### Phase 4 — Polish (week 4)
- [ ] Mobile pass all sites  
- [ ] SEO titles/descriptions  
- [ ] Analytics (GA4 / Wix analytics)  
- [ ] Optional: hierarchy reveal on About pages (Sam approval)

---

## Access needed from Sam

| Access | Why | How |
|--------|-----|-----|
| **Wix** login or **Site collaborator** invite | Edit vanguardnode, dcoreglobal, richroyalscorp | Wix → Settings → Roles → invite OR share session |
| **Namecheap** (vanguardnode.com) | DNS if moving off Wix | Optional — only if DNS changes |
| **Brand assets** | Logos, photos, team shots | Drive / zip |
| **Approved claims** | Fortune 100, 1000+ trained, 3+ DC | Legal/comms sign-off |
| **Rich Royals products** | SKUs, prices, images | Sheet or photos |
| **Which site first?** | Parallel focus | Sam picks: VN vs DCORE vs Rich Royals |

---

## Next action (Cursor — waiting on Sam)

1. **Pick starting site:** VanguardNode or DCORE (recommended: **DCORE** — closest to ScanV)  
2. **Grant Wix access** or open Wix Editor beside this chat  
3. **Confirm 4th domain** — is it `dcore.in` or another?  
4. Cursor will then: rewrite hero + add AI services section directly in Wix (not just docs)

---

*Living document — update as pages ship.*
