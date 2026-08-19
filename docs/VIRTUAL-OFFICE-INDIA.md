# ScanV — Virtual Office (India)

**Updated:** 19 Aug 2026 · **Status:** ❌ Not registered yet

ScanV does **not** currently have an India **virtual office / registered office** on file in the repo, legal pages, or MCA/GST records referenced in code.

**What exists today**

| Item | Location |
|------|----------|
| US parent branding | Incorporation, San Francisco, CA (footer / meta) |
| Operating entity | DCore (`dcoreglobal.com`, HDFC Vyapar UPI) |
| Market city | Pune & PCMC (app copy, vendor outreach) |
| Contact | +91-9270194842 · `hello@getscanv.com` / `connect@dcoreglobal.com` |
| India company docs | Planned in [REGULATORY-APPROVALS-INDIA.md](./REGULATORY-APPROVALS-INDIA.md) (A1–A3: incorporation, PAN, GST) |

A **virtual office** is not the app — it is a **legal mailing + registered office address** used for:

- MCA (ROC) registered office on company incorporation
- GST registration (principal place of business or additional place)
- Bank KYC / Razorpay / Vyapar merchant address
- Shop & Establishment (state)
- Official letters, MCA filings, and display on invoices/website if required

---

## Recommended approach for ScanV

1. **Confirm entity** — Is ScanV India operating as:
   - Branch / liaison of US DCore, or
   - New **Pvt Ltd / LLP in India** (common for GST + UPI + marketplace)?

   Your CA should decide before buying a virtual office.

2. **Pick city** — **Pune (Wakad / PCMC)** matches your launch market and vendor base.

3. **Choose a provider** (examples — verify current pricing & MCA acceptance with your CA):

   | Provider type | Examples |
   |---------------|----------|
   | Virtual office + compliance bundles | IndiaFilings, Vakilsearch, RegisterKaro |
   | Coworking virtual office | InstaSpaces, Awfis, WeWork (registered office plans) |
   | CA-led setup | Local Pune CA firm bundled with incorporation |

4. **Documents typically required**

   - Director PAN, Aadhaar, photo
   - Proof of identity & address
   - Company name approval (RUN / SPICe+)
   - NOC from virtual office provider for registered office use
   - Rent agreement / utility bill from provider (for GST)

5. **After registration — update ScanV**

   - [ ] Terms / Privacy / Payment footers → registered office address
   - [ ] GSTIN on invoices & payment screens
   - [ ] `public/scanv-brand.html` + JSON-LD `address` field
   - [ ] Google Business Profile (see [GOOGLE-SEO-INDEXING.md](./GOOGLE-SEO-INDEXING.md))
   - [ ] HDFC Vyapar / Razorpay merchant profile address
   - [ ] Grievance officer address (IT Rules)

---

## Do not use a fake address

Until MCA/GST registration is complete, keep using **Pune, Maharashtra** (city-level) in marketing copy only — not a specific door number.

---

## Owner checklist (manual)

- [ ] CA consultation — entity structure + virtual office eligibility
- [ ] Purchase virtual office package (12 months typical)
- [ ] Complete Pvt Ltd / LLP incorporation with that address as registered office
- [ ] Apply GSTIN (if applicable)
- [ ] Share final address with engineering → update legal pages + schema.org

**Estimated timeline:** 7–21 business days with a bundled provider (incorporation + virtual office).

---

See also: [REGULATORY-APPROVALS-INDIA.md](./REGULATORY-APPROVALS-INDIA.md) · [GOOGLE-SEO-INDEXING.md](./GOOGLE-SEO-INDEXING.md)
