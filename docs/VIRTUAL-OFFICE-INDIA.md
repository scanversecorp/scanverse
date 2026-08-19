# ScanV — Virtual Office (India)

**Updated:** 19 Aug 2026 · **Status:** ⏳ Address identified — MCA/GST registration pending

ScanV’s intended **registered / virtual office** is at **Gera Imperium Gateway**, Kasarwadi / Bhosari, PCMC, Pune. The full postal address is now in site schema, `scanv-brand.html`, and [GOOGLE-BUSINESS-PROFILE.md](./GOOGLE-BUSINESS-PROFILE.md).

**What exists today**

| Item | Location |
|------|----------|
| US parent branding | Incorporation, San Francisco, CA (footer / meta) |
| Operating entity | DCore (`dcoreglobal.com`, HDFC Vyapar UPI) |
| Market city | Pune & PCMC (app copy, vendor outreach) |
| Contact | +91-9270194842 · `hello@getscanv.com` / `connect@dcoreglobal.com` |
| **Office address (target)** | Gera Imperium Gateway — see below |
| India company docs | Planned in [REGULATORY-APPROVALS-INDIA.md](./REGULATORY-APPROVALS-INDIA.md) (A1–A3: incorporation, PAN, GST) |

### Gera Imperium Gateway address

```
Gera Imperium Gateway
C.T.S. No. 2656(P), Nashik Phata Flyover
Opp. Bhosari Metro Station (Nashik Phata)
Bhosari, Pimpri-Chinchwad
Pune, Maharashtra 411034
India
```

| | |
|--|--|
| **Maps** | https://www.google.com/maps/search/?api=1&query=Gera+Imperium+Gateway,+Nashik+Phata,+Bhosari,+Pune,+411034 |
| **Coordinates** | 18.6094°N, 73.8201°E (adjacent Nashik Phata Metro) |
| **Developer** | Gera Developments Pvt. Ltd. · MahaRERA P52100030184 |
| **Code** | `src/business-address.js` · JSON-LD in `public/index.html` |

Add **suite / unit number** from your virtual-office provider once the rent agreement is signed.

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

   - [ ] Terms / Privacy / Payment footers → registered office address (partial: footer via `CopyrightLine`)
   - [x] JSON-LD `address` + geo on `public/index.html` and `scanv-brand.html`
   - [x] `src/business-address.js` shared constants
   - [ ] Suite / unit number when virtual-office contract is signed
   - [ ] GSTIN on invoices & payment screens
   - [ ] Google Business Profile — [GOOGLE-BUSINESS-PROFILE.md](./GOOGLE-BUSINESS-PROFILE.md)
   - [ ] HDFC Vyapar / Razorpay merchant profile address
   - [ ] Grievance officer address (IT Rules)

---

## Do not use a fake address

The **Gera Imperium Gateway** building address is documented for GBP and schema.org. Add your **specific suite / unit** only when the virtual-office provider confirms it on the rent agreement. Until MCA/GST registration is complete, marketing may use city-level “Pune & PCMC” copy; the full street address is on `scanv-brand.html` and JSON-LD for Google.

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
