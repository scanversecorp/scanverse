# ScanV — Regulatory & Private Approvals Roadmap (India)

**Updated:** 14 Aug 2026 · **Confidential — Admin / leadership only**  
**Purpose:** Map what comparable platforms hold so ScanV can plan its own approvals. Not legal advice — verify with CA + lawyer for your entity structure and cities.

**Comparable platforms referenced:** quick-commerce (inventory/marketplace model), food delivery marketplaces, home-services marketplaces (e.g. local cleaning apps), and goods transport / logistics apps.

---

## How to read this document

| Column | Meaning |
|--------|---------|
| **Approval** | Registration, licence, or compliance obligation |
| **Authority** | Government body or private gatekeeper |
| **Who typically holds it** | Platform vs partner vs both |
| **ScanV relevance** | Which ScanV verticals need it |

---

## A. Universal (almost every platform)

| # | Approval / compliance | Authority | Who holds | ScanV relevance |
|---|----------------------|-----------|-----------|-----------------|
| A1 | **Company incorporation** (Pvt Ltd / LLP) | ROC (MCA) | Platform (DCORE) | Required |
| A2 | **PAN** | Income Tax | Platform + partners (if registered) | Required |
| A3 | **GST registration** | GST department | Platform; partners if turnover threshold met | Required |
| A4 | **GSTIN on invoices** | GST | Platform for fees; partners for service supply | Required |
| A5 | **TCS u/s 52 CGST** (e-commerce operator) | GST | Platform when acting as ECO on third-party sales | If marketplace model |
| A6 | **TDS/TCS on payouts** to partners | Income Tax / GST | Platform | When paying partners |
| A7 | **Shop & Establishment** registration | State labour dept | Platform office + partner premises (where applicable) | Per city |
| A8 | **Professional Tax** (employer) | State | If employees on payroll | If hiring |
| A9 | **Labour law registrations** (PF, ESIC) | EPFO / ESIC | If employees above thresholds | If hiring |
| A10 | **DPDP Act 2023** privacy compliance | MeitY framework | Platform | Required — privacy policy, consent, data security |
| A11 | **IT Act 2000** + **IT Rules 2021** (intermediary) | MeitY | Platform | Terms, grievance officer, takedown process |
| A12 | **Grievance officer** (IT Rules) | MeitY | Platform | Required for intermediary status |
| A13 | **Digital Personal Data** consent & purpose limitation | DPDP | Platform | OTP, GPS, bookings data |
| A14 | **Contract templates** (customer, partner, vendor) | Private / legal | Platform | Required |
| A15 | **Bank current account** + merchant settlement | Bank | Platform | Required |
| A16 | **Payment aggregator / PG** agreement | Razorpay / bank / NPCI | Platform | UPI collect, payment links |
| A17 | **TRAI DLT** (SMS template + sender ID) | TRAI via telecom | Platform | OTP SMS (`SCANV` sender) |
| A18 | **FSSAI** (if any food listing) | FSSAI | Platform (central if pan-India food e-comm) + each food partner | **Food vertical only** |
| A19 | **MSME / Udyam** (optional) | MSME portal | Platform or partners | Optional benefit |
| A20 | **Trademark** “ScanV” | IP India | Platform | Recommended |
| A21 | **SEBI listing** | SEBI | Only if public company | N/A unless IPO |

---

## B. E-commerce / marketplace (Blinkit-style, Zomato marketplace, Swiggy Instamart)

| # | Approval / compliance | Authority | Who holds | Notes for ScanV |
|---|----------------------|-----------|-----------|-----------------|
| B1 | **Marketplace e-commerce model** (Press Note 2 / FDI) | DPIIT | Platform structure | 100% FDI allowed for marketplace; inventory-led B2C has FDI restrictions |
| B2 | **FSSAI Central Licence** (e-commerce food operator) | FSSAI | Platform if listing food pan-India | Mandatory for food delivery / grocery platforms |
| B3 | **FSSAI per seller verification** | FSSAI | Each restaurant/cloud kitchen | Platform must verify 14-digit FSSAI before listing |
| B4 | **FSSAI State licence per dark store** (inventory model) | State FDA | Platform per warehouse | If ScanV ever holds inventory |
| B5 | **Trade licence** per fulfilment point | Municipal corp | Platform or partner | Per dark store / hub |
| B6 | **Fire NOC** per warehouse | Fire dept | Platform | Per storage location |
| B7 | **GST multi-state registration / APOB** | GST | Platform or sellers | Inventory in multiple states |
| B8 | **Legal Metrology** (packaged goods) | Legal Metrology dept | Sellers / platform display rules | If selling pre-packed goods |
| B9 | **Weights & measures** on platform listings | LM Act | Sellers | Product quantity declarations |
| B10 | **Consumer Protection E-Commerce Rules 2020** | CCPA | Platform | Return/refund disclosures, seller details |
| B11 | **Country of origin** display | Legal Metrology / CCPA | Platform | For product listings |
| B12 | **Inventory-led retail licence** (if >25% single seller rule avoided via structure) | DPIIT / ED scrutiny | Related-party seller entities | Blinkit shifted to IOCC + inventory model 2025 |
| B13 | **Cold chain / storage** compliance | FSSAI / state FDA | Platform holding perishables | Food / pharma categories |
| B14 | **Plastic waste / EPR** | CPCB / PWM Rules | Brand owners / importers | If shipping packaged goods |
| B15 | **Advertising standards** (incl. “10-minute delivery” claims) | ASCI / consumer affairs | Platform marketing | Govt scrutiny on quick-commerce speed claims 2026 |

---

## C. Food delivery (Zomato, Swiggy food)

| # | Approval / compliance | Authority | Who holds |
|---|----------------------|-----------|-----------|
| C1 | **FSSAI Central Licence** (e-commerce food business operator) | FSSAI | Platform |
| C2 | **FSSAI Basic / State / Central** per outlet | FSSAI | Each restaurant / cloud kitchen |
| C3 | **GST registration** per outlet (if applicable) | GST | Restaurant partners |
| C4 | **Eating house licence** | Municipal / police | Restaurant (city-specific) |
| C5 | **Health / trade licence** | Municipal | Restaurant |
| C6 | **Fire NOC** (seating / kitchen) | Fire dept | Restaurant |
| C7 | **Liquor licence** (if applicable) | Excise | Restaurant — not platform |
| C8 | **Packaging waste / hygiene audits** | FSSAI / FDA | Platform + restaurants — FDA inspections on dark stores |
| C9 | **Hyperpure / supply chain** (B2B) | FSSAI + GST | Separate entity if sourcing |

---

## D. Home services marketplace (Urban Company model, XeroDirt-scale local apps)

| # | Approval / compliance | Authority | Who holds | ScanV relevance |
|---|----------------------|-----------|-----------|-----------------|
| D1 | **Marketplace / aggregator** (not inventory) | — | Platform connects customers to professionals | **Household, health at home, etc.** |
| D2 | **GST Section 9(5)** — ECO liable for tax on notified services | GST / CBIC | Platform pays GST on partner payouts for notified categories | **Critical for home services** — housekeeping, plumbing, etc. disputed classification |
| D3 | **5% vs 18% GST** on partner payouts | GST | Platform (disputed for repair/painting vs housekeeping) | Urban Company litigation 2025–26 |
| D4 | **18% GST on platform fee / convenience fee** | GST | Platform | Commission income |
| D5 | **Partner GST registration** | GST | Service professionals above threshold | Partners |
| D6 | **Partner skill / trade licences** (electrician, plumber) | State municipal / labour | Individual partners | Platform verifies copies |
| D7 | **Police verification** of partners | Police | Partners (platform may facilitate) | Trust & safety |
| D8 | **Insurance** — partner accident / customer property | Private insurers | Platform or partners | Recommended |
| D9 | **Contract labour / gig classification** | Labour codes / courts | Platform legal structure | Partner agreements |
| D10 | **Professional tax** (partner) | State | Partners in some states | Partner obligation |
| D11 | **No FSSAI** unless food service | FSSAI | N/A for pure cleaning/repair | Unless food vertical |

**XeroDirt-type local cleaning apps** typically operate at smaller scale with: company registration, GST, platform terms, partner contracts, and local Shop Act — formal aggregator licences often come at scale.

---

## E. Logistics / goods transport (Porter model)

| # | Approval / compliance | Authority | Who holds | ScanV relevance |
|---|----------------------|-----------|-----------|-----------------|
| E1 | **Goods Transport Agency (GTA)** registration | GST / transport rules | Platform may register as GTA | **Delivery vertical** |
| E2 | **Motor Vehicle Aggregator licence** | State Transport / MoRTH guidelines 2025 | Platform per state | If app dispatches vehicles |
| E3 | **Aggregator licence fee** | State | Platform | ₹5 lakh + security deposit ₹10–50 lakh (2025 guidelines) |
| E4 | **Driver onboarding training** (40 hr induction) | MoRTH Aggregator Guidelines 2025 | Platform | Before partner drivers |
| E5 | **Vehicle permits** (goods carriage) | State RTO | Partner vehicle owners | Valid permit, fitness, insurance |
| E6 | **GPS / VLT device** on vehicles | MoRTH / AIS standards | Partner vehicles | Tracking compliance |
| E7 | **GST on GTA** — RCM for B2B registered customers | GST | Customer under reverse charge in many cases | B2B deliveries |
| E8 | **E-way bill** | GST / NIC | Consignor for goods > ₹50k | Inter-state goods |
| E9 | **National Permit / state permits** | RTO | Partner trucks | Inter-city |
| E10 | **Packers & movers** consumer protection | Consumer Protection Act | Platform terms + liability | If moving household goods |

---

## F. Payments & telecom (ScanV already in progress)

| # | Approval / compliance | Authority | Status for ScanV |
|---|----------------------|-----------|------------------|
| F1 | **UPI merchant / VPA** (Vyapar / bank) | NPCI / HDFC | In progress — Vyapar KYC |
| F2 | **Razorpay payment gateway** KYC | Razorpay / RBI PA ecosystem | Live mode checklist |
| F3 | **2Factor.in** SMS OTP | TRAI DLT + telecom | Go-live checklist A |
| F4 | **MSG91 / Twilio** fallback | TRAI DLT / telecom | Optional fallback |
| F5 | **WhatsApp Business API** | Meta / MSG91 | whatsapp-verify |
| F6 | **PA license** (if becoming payment aggregator) | RBI | **Not required** if using Razorpay/Vyapar only |
| F7 | **PCI-DSS** | PCI SSC | Razorpay handles card vault — ScanV does not store cards |

---

## G. Data, security & app stores

| # | Approval / compliance | Authority | ScanV |
|---|----------------------|-----------|-------|
| G1 | **CERT-In directions** (log retention, incident reporting) | CERT-In | Security policy |
| G2 | **App Store / Play Store** developer accounts | Apple / Google | Future Capacitor apps |
| G3 | **Google Play Data safety** form | Google | App listing |
| G4 | **Apple App Privacy** labels | Apple | App listing |
| G5 | **ISO 27001** (optional) | Private certification | Enterprise customers |

---

## H. ScanV priority matrix (recommended order)

### Phase 1 — Go-live (current)

- [x] Company + PAN + GST (verify active)
- [ ] Vyapar UPI merchant live (HDFC)
- [ ] Razorpay live + webhooks
- [ ] TRAI DLT + 2Factor OTP
- [ ] DPDP privacy policy + terms + grievance officer
- [ ] Partner onboarding agreement + KYC fields
- [ ] TCS/TDS process for partner payouts (CA sign-off)

### Phase 2 — Scale (multi-city)

- [ ] GST Section 9(5) analysis for each service category (household, delivery, etc.)
- [ ] Shop & Establishment per operating city
- [ ] Motor Vehicle Aggregator licence — **only if** ScanV dispatches owned/attached vehicles at scale
- [ ] FSSAI Central — **only if** food vertical goes live
- [ ] Professional verification pipeline (electrician/plumber licences)

### Phase 3 — Enterprise / inventory (if ever)

- [ ] FSSAI per fulfilment node
- [ ] DPIIT / FDI structure review if inventory-led
- [ ] Legal Metrology for packaged goods
- [ ] Competition / predatory pricing compliance review

---

## I. What competitors publicly disclose (SEBI / news — not exhaustive)

| Platform type | Publicly known compliance themes |
|---------------|----------------------------------|
| **Quick commerce** | FSSAI central + per dark store; GST multi-state; inventory-led restructuring (IOCC); FDA state inspections; TCS; consumer protection |
| **Food delivery** | FSSAI platform + restaurant licences; GST 9(5) on food delivery in some models; eating house licences locally |
| **Home services** | GST Section 9(5) housekeeping classification; 5% vs 18% disputes; platform fee 18% GST; partner independent GST |
| **Logistics (Porter)** | GTA; state aggregator licences (2025 guidelines); partner vehicle permits; driver training |
| **Local cleaning apps** | Typically basic company + GST + partner contracts at small scale; scale triggers same as Urban Company |

---

## J. ScanV-specific notes

1. **ScanV is multi-vertical** — you need **category-specific** approvals, not one blanket licence.
2. **Marketplace model** (partners fulfil) differs from **inventory model** (Blinkit BCPL) — most ScanV services today are marketplace.
3. **Do not copy competitor tax positions** — Urban Company’s 5% housekeeping GST is **under challenge** (₹51–56 cr demands).
4. **Architecture / internal diagrams** — Admin PIN only; not on public website.
5. **Engage:** Chartered Accountant (GST 9(5)), FSSAI consultant (if food), transport lawyer (if delivery fleet), DPDP counsel.

---

## References (public sources)

- FSSAI e-commerce food operator rules — FoSCoS portal
- Motor Vehicle Aggregator Guidelines 2025 — MoRTH / Parivahan
- Press Note 2 (2018) — DPIIT marketplace FDI
- CGST Section 9(5) — notified services via e-commerce operator
- Consumer Protection (E-Commerce) Rules 2020
- DPDP Act 2023

*This document is internal planning material. Verify every item with qualified advisors before go-live or expansion.*
