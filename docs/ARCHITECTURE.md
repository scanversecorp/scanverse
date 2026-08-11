# ScanV — System Architecture

**Updated:** 12 Aug 2026 · DCORE Global Corporation

---

## 1. System Context

```mermaid
C4Context
    title ScanV System Context

    Person(customer, "Customer", "Books services via PWA")
    Person(partner, "Partner / Vendor", "Fulfils assigned jobs")
    Person(agent, "Support Agent", "Handles tickets")
    Person(leader, "Leader / Admin", "Platform administration")

    System(scanv, "ScanV PWA", "React 18 SPA on Vercel")
    System_Ext(supabase, "Supabase", "Auth · Postgres · Edge Functions · Realtime")
    System_Ext(razorpay, "Razorpay", "UPI & payment links")
    System_Ext(twofactor, "2Factor / MSG91 / Twilio", "OTP SMS & WhatsApp")
    System_Ext(digio, "Digio", "Vendor eKYC")
    System_Ext(maps, "OSM Nominatim", "Reverse geocoding")

    Rel(customer, scanv, "Uses")
    Rel(partner, scanv, "Onboards & accepts jobs")
    Rel(agent, scanv, "Support desk")
    Rel(leader, scanv, "Admin hub")
    Rel(scanv, supabase, "REST · Realtime · Edge Functions")
    Rel(supabase, twofactor, "send-otp · whatsapp-verify")
    Rel(supabase, razorpay, "razorpay-payment")
    Rel(supabase, digio, "vendor-onboard eKYC")
    Rel(scanv, maps, "GPS → address")
```

---

## 2. Deployment Architecture

```mermaid
flowchart TB
    subgraph Client["Client (Browser / PWA)"]
        PWA["ScanV PWA<br/>React 18 · src/App.js"]
        SW["Service Worker<br/>public/sw.js"]
        SS["sessionStorage<br/>Admin PIN sessions"]
    end

    subgraph Vercel["Vercel CDN"]
        CDN["Static assets"]
        RW["SPA rewrites → index.html"]
        HC["Cache: no-cache index · immutable /static"]
    end

    subgraph Supabase["Supabase · rwlwrmmqtedugcreweut"]
        AUTH["GoTrue Auth"]
        DB[("PostgreSQL")]
        EF["Edge Functions × 9"]
        RT["Realtime"]
        RLS["Row Level Security"]
        CRON["pg_cron dispatch tick"]
    end

    subgraph External["External Services"]
        RZ["Razorpay"]
        OTP["2Factor / MSG91 / Twilio"]
        DG["Digio eKYC"]
    end

    PWA --> CDN
    SW --> CDN
    CDN --> RW
    PWA --> AUTH
    PWA --> DB
    PWA --> EF
    PWA --> RT
    DB --> RLS
    EF --> DB
    EF --> RZ
    EF --> OTP
    EF --> DG
    CRON --> EF
    RZ -->|webhook| EF
    OTP -->|webhook| EF
```

---

## 3. Edge Functions Map

```mermaid
flowchart LR
    subgraph Public["Public (anon key)"]
        SO["send-otp"]
        RP["razorpay-payment"]
        VO["vendor-onboard"]
        ST["support-tickets<br/>create · track"]
    end

    subgraph PIN["PIN-protected"]
        PA["pricing-admin"]
        AH["admin-hub"]
        CS["customer-support"]
        ST2["support-tickets<br/>agent actions"]
        VA["vendor-onboard<br/>admin"]
    end

    subgraph Secret["Secret-protected"]
        BD["booking-dispatch"]
    end

    Client --> Public
    Client --> PIN
    Client --> Secret
    Razorpay --> RP
    Twilio --> BD
    MSG91 --> SO
```

---

## 4. Database Schema (Core)

```mermaid
erDiagram
    profiles ||--o{ bookings : places
    profiles ||--o{ service_requests : creates
    profiles ||--o{ notifications : receives
    profiles ||--o{ user_locations : logs
    bookings ||--o| booking_dispatch : triggers
    booking_dispatch ||--o{ booking_dispatch_attempts : logs
    vendor_partners ||--o{ vendor_partner_services : offers
    vendor_partners ||--o{ vendor_live_locations : tracks
    support_tickets ||--o{ support_ticket_comments : has
    support_agents ||--o{ support_tickets : assigned
    payment_intents ||--|| bookings : verifies
    service_pricing ||--|| service_prices_public : publishes
```

---

## 5. Admin & Support Access Model

```mermaid
flowchart TD
    subgraph PINs["Supabase Secrets"]
        AHP["ADMIN_HUB_PIN"]
        SAP["SUPPORT_ADMIN_PIN"]
        SGP["SUPPORT_AGENT_PIN"]
        PAP["PRICING_ADMIN_PIN"]
        VAP["VENDOR_ADMIN_PIN"]
    end

    subgraph Routes["Hash Routes"]
        ADM["#admin"]
        EXE["#exec"]
        PRC["#pricing-admin"]
        SUP["#customer-support"]
        VAD["#vendor-admin"]
    end

    AHP --> ADM
    AHP --> EXE
    SAP --> ADM
    SAP --> EXE
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
    VAD --> VO["vendor-onboard EF"]
```

| PIN | Hub | Exec | Pricing | Support Admin | Support Agent | Vendor |
|-----|-----|------|---------|---------------|---------------|--------|
| ADMIN_HUB_PIN | ✓ | ✓ | — | — | — | — |
| SUPPORT_ADMIN_PIN | ✓ | ✓ | — | ✓ | — | — |
| PRICING_ADMIN_PIN | ✓ | — | ✓ | — | — | — |
| VENDOR_ADMIN_PIN | ✓ | — | — | — | — | ✓ |
| SUPPORT_AGENT_PIN | — | — | — | — | ✓ | — |

---

## 6. Security Layers

```mermaid
flowchart TB
    L1["Layer 1: Vercel CDN<br/>HTTPS · static only"]
    L2["Layer 2: Supabase RLS<br/>Table-level access"]
    L3["Layer 3: Edge Function auth<br/>PIN · webhook sig · dispatch secret"]
    L4["Layer 4: Payment validation<br/>amount_ok server check"]
    L5["Layer 5: Client session<br/>sessionStorage 24h PIN cache"]

    L1 --> L2 --> L3 --> L4 --> L5
```

---

## 7. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, single-file App.js (~7K lines) |
| Hosting | Vercel (scanv-tau.vercel.app) |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase GoTrue (mobile OTP → fake email auth) |
| Payments | Razorpay payment links + UPI |
| SMS/WhatsApp | 2Factor, MSG91, Twilio |
| Realtime | Supabase Realtime (pricing updates) |

---

## 8. Migration Inventory

15 SQL migrations in `supabase/migrations/` (Aug 2026 batch):

| Migration | Purpose |
|-----------|---------|
| `20260811000000` | WhatsApp verifications |
| `20260811000001` | WA outbound |
| `20260811000002` | Payment intents |
| `20260811000003` | Service pricing + RLS |
| `20260812000004` | Sub-services pricing |
| `20260812000005` | Fill grid pricing |
| `20260812000006` | Vendors & dispatch + RLS |
| `20260812000007` | Live tracking & vehicle pricing |
| `20260812000008` | Dispatch cron |
| `20260812000009` | Vendor live locations RLS |
| `20260812000010` | Pricing realtime vehicle cards |
| `20260812000011` | Customer support roles |
| `20260812000012` | Support tickets |
| `20260812000013` | Ticket comment internal flag |
| `20260812000014` | Payer VPA |
