# ScanV — System Architecture

**Version:** v5.5.3 · **Updated:** 14 Aug 2026 · DCore  
**Production:** [https://scanv-tau.vercel.app](https://scanv-tau.vercel.app)

> **Integration note:** External service providers are pluggable via Admin Go-Live toggles. Diagrams may change as integrations are added.

> **Access:** Admin hub only — `#admin` → **Architecture** tab. Not published on the public website.

---

## 1. System Context

```mermaid
C4Context
    title ScanV System Context (v5.5.3)

    Person(customer, "Customer", "Books services via PWA — browse-first, no install gate")
    Person(partner, "Service partner", "Onboards, accepts jobs, live GPS")
    Person(agent, "Support agent", "Tickets & customer lookup")
    Person(leader, "Leader / Admin", "Admin hub, pricing, go-live toggles")

    System(scanv, "ScanV PWA", "React 18 SPA · Vercel CDN")
    System_Ext(supabase, "Supabase", "Postgres · Auth · Edge Functions · Realtime · pg_cron")
    System_Ext(twofactor, "2Factor.in", "Primary India SMS OTP")
    System_Ext(msg91, "MSG91", "SMS / WhatsApp fallback")
    System_Ext(twilio, "Twilio", "Intl SMS · voice OTP · dispatch notify")
    System_Ext(vyapar, "HDFC Vyapar UPI", "Merchant collect · Vyapar QR · webhooks")
    System_Ext(upiapps, "UPI apps", "Google Pay · PhonePe · Paytm · Navi · BHIM")
    System_Ext(razorpay, "Razorpay", "Payment links backup")
    System_Ext(digio, "Digio", "Partner eKYC optional")
    System_Ext(maps, "OSM Nominatim", "Reverse geocoding")

    Rel(customer, scanv, "Uses")
    Rel(partner, scanv, "Partner portal · job offers")
    Rel(agent, scanv, "Support desk")
    Rel(leader, scanv, "#admin hub")
    Rel(scanv, supabase, "REST · Realtime · Edge Functions")
    Rel(supabase, twofactor, "send-otp · vendor-onboard")
    Rel(supabase, msg91, "send-otp · whatsapp-verify")
    Rel(supabase, twilio, "send-otp · booking-dispatch")
    Rel(supabase, vyapar, "razorpay-payment vyapar_notify")
    Rel(supabase, razorpay, "razorpay-payment links + webhook")
    Rel(scanv, upiapps, "upi:// deep links")
    Rel(supabase, digio, "vendor-onboard eKYC")
    Rel(scanv, maps, "GPS to address")
```

---

## 2. Deployment Architecture

```mermaid
flowchart TB
    subgraph Client["Client (Browser / PWA)"]
        PWA["ScanV PWA<br/>React 18 · src/App.js"]
        SW["Service Worker · public/sw.js"]
        SS["sessionStorage<br/>Admin PIN sessions 24h"]
        PC["platform-config fetch<br/>vendor toggles for UI"]
    end

    subgraph Vercel["Vercel CDN"]
        CDN["Static assets PWA only — no public /docs/"]
        RW["SPA rewrites to index.html"]
        HC["no-cache index · immutable /static"]
    end

    subgraph Supabase["Supabase · rwlwrmmqtedugcreweut"]
        AUTH["GoTrue Auth"]
        DB[("PostgreSQL + RLS")]
        EF["Edge Functions x11"]
        RT["Realtime · pricing"]
        CRON["pg_cron dispatch tick"]
        PS["platform_settings<br/>go-live switches"]
    end

    subgraph External["External providers toggled in Admin Go-Live"]
        OTP["2Factor / MSG91 / Twilio"]
        PAY["Vyapar UPI · Razorpay"]
        UPI["GPay · PhonePe · Paytm · Navi · BHIM"]
        DG["Digio eKYC"]
    end

    PWA --> CDN
    SW --> CDN
    PWA --> PC
    PC --> EF
    PWA --> AUTH
    PWA --> DB
    PWA --> EF
    PWA --> RT
    EF --> DB
    EF --> PS
    EF --> OTP
    EF --> PAY
    PWA --> UPI
    EF --> DG
    CRON --> EF
    PAY -->|webhook| EF
    OTP -->|delivery report| EF
```

| Environment | URL |
|-------------|-----|
| Production PWA | https://scanv-tau.vercel.app |
| QR landing | https://scanv-tau.vercel.app/?qr=1 |
| Printable QR | https://scanv-tau.vercel.app/scanv-qr.png |
| Architecture diagrams | Admin only → `#admin` → Architecture tab |

---

## 3. Edge Functions Map

```mermaid
flowchart LR
    subgraph Public["Public anon key"]
        SO["send-otp"]
        RP["razorpay-payment"]
        VO["vendor-onboard"]
        ST["support-tickets create/track"]
        PC["platform-config vendors"]
        WA["whatsapp-verify"]
        ODR["otp-delivery-report"]
    end

    subgraph PIN["PIN protected"]
        PA["pricing-admin"]
        AH["admin-hub"]
        CS["customer-support"]
        ST2["support-tickets agent"]
        VO2["vendor-onboard admin"]
    end

    subgraph Secret["Secret header"]
        BD["booking-dispatch"]
    end

    Client["ScanV PWA"] --> Public
    Client --> PIN
    Cron["pg_cron"] --> BD
    Razorpay["Razorpay webhook"] --> RP
    Vyapar["Vyapar webhook"] --> RP
    TwoFactor["2Factor callback"] --> ODR
    Providers["MSG91 / Twilio inbound"] --> WA
```

---

## 4. Vendor & Provider Toggle Layer

Admin **Go-Live** stores flags in `platform_settings`. Edge functions and `platform-config` read them at runtime.

```mermaid
flowchart LR
    ADM["Admin Go-Live UI"] --> AH["admin-hub"]
    AH --> PS[("platform_settings")]
    PS --> SO["send-otp skip routes"]
    PS --> RP["razorpay-payment gates"]
    PS --> WA["whatsapp-verify gate"]
    PS --> PC["platform-config"]
    PC --> PWA["Payment buttons<br/>OTP UI paths"]
```

| Toggle key | Provider | Effect when OFF |
|------------|----------|-----------------|
| `vendor_enable_2factor` | 2Factor.in | Skip 2Factor OTP route |
| `vendor_enable_msg91` | MSG91 | Skip MSG91 SMS/WA |
| `vendor_enable_twilio` | Twilio | Skip Twilio SMS/voice |
| `vendor_enable_whatsapp` | WhatsApp verify | Block WA verification |
| `vendor_enable_razorpay` | Razorpay | Hide Razorpay; no links |
| `vendor_enable_vyapar_upi` | Vyapar QR | Hide Vyapar QR section |
| `vendor_enable_upi_*` | GPay, PhonePe, … | Hide matching UPI button |

---

## 5. Database Schema (Core)

```mermaid
erDiagram
    profiles ||--o{ bookings : places
    profiles ||--o{ service_requests : creates
    profiles ||--o{ notifications : receives
    profiles ||--o{ user_locations : logs
    bookings ||--o| booking_dispatch : triggers
    booking_dispatch ||--o{ booking_dispatch_attempts : logs
    booking_dispatch ||--o{ partner_job_offers : in_app_offers
    vendor_partners ||--o{ vendor_partner_services : offers
    vendor_partners ||--o{ vendor_live_locations : tracks
    support_tickets ||--o{ support_ticket_comments : has
    support_agents ||--o{ support_tickets : assigned
    payment_intents ||--|| bookings : verifies
    service_pricing ||--|| service_prices_public : publishes
    platform_settings ||--o{ go_live_checks : manual_ticks
    otp_delivery_reports ||--o{ send_otp : traces
    wa_verifications ||--o{ whatsapp_verify : tokens
```

---

## 6. Admin & Support Access Model

```mermaid
flowchart TD
    subgraph PINs["Supabase secrets"]
        AHP["ADMIN_HUB_PIN"]
        SAP["SUPPORT_ADMIN_PIN"]
        SGP["SUPPORT_AGENT_PIN"]
        PAP["PRICING_ADMIN_PIN"]
        VAP["VENDOR_ADMIN_PIN"]
    end

    subgraph Routes["Hash routes"]
        ADM["#admin · Go-Live · vendors"]
        EXE["#exec"]
        PRC["#pricing-admin"]
        SUP["#customer-support"]
        VAD["#vendor-admin"]
        OTPR["#otp-delivery-report"]
    end

    AHP --> ADM
    AHP --> EXE
    SAP --> ADM
    SAP --> SUP
    PAP --> ADM
    PAP --> PRC
    VAP --> ADM
    VAP --> VAD
    SGP --> SUP

    ADM --> AH["admin-hub EF"]
    EXE --> AH
    PRC --> PA["pricing-admin EF"]
    SUP --> CS["customer-support EF"]
```

---

## 7. Security Layers

```mermaid
flowchart TB
    L1["Layer 1: Vercel HTTPS CDN"]
    L2["Layer 2: Supabase RLS on tables"]
    L3["Layer 3: Edge fn auth PIN webhook sig dispatch secret"]
    L4["Layer 4: Payment amount_ok server check"]
    L5["Layer 5: Go-Live dev switches otp_dev_mode OFF in prod"]
    L6["Layer 6: Client sessionStorage 24h admin PIN cache"]

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

---

## 8. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 · single-file `src/App.js` |
| Hosting | Vercel · scanv-tau.vercel.app |
| Backend | Supabase Edge Functions Deno x11 |
| Database | PostgreSQL Supabase Mumbai |
| Auth | GoTrue mobile OTP synthetic email |
| Payments primary | HDFC Vyapar UPI · UPI deep links GPay PhonePe Paytm Navi BHIM |
| Payments backup | Razorpay payment links |
| SMS OTP primary | 2Factor.in |
| SMS OTP fallback | MSG91 Twilio voice optional |
| WhatsApp | whatsapp-verify outbound plus reply |
| Partner dispatch | In-app sequential offers plus SMS call WhatsApp backup |
| Realtime | Supabase Realtime pricing |
| Cron | pg_cron booking-dispatch tick |

---

## 9. Related Documentation

| Document | Purpose |
|----------|---------|
| [APP-DATA-FLOW.md](./APP-DATA-FLOW.md) | Sequence and flow diagrams |
| [ScanV-App-Flowcharts.md](./ScanV-App-Flowcharts.md) | User journeys and roles |
| [ALL-APIS-AND-WEBHOOKS.md](./ALL-APIS-AND-WEBHOOKS.md) | Endpoint inventory |
| [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md) | Production readiness |
| [BACKUP-AND-SCALE.md](./BACKUP-AND-SCALE.md) | Backup DR and load |
| [ADMIN-HUB.md](./ADMIN-HUB.md) | Admin hub tabs |

*Diagrams reflect ScanV v5.5.3. Update when adding service-provider integrations.*
