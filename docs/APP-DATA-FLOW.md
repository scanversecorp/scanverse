# ScanV — Application Data Flow

**Updated:** 12 Aug 2026

---

## 1. Customer Booking Flow (End-to-End)

```mermaid
sequenceDiagram
    actor C as Customer
    participant PWA as ScanV PWA
    participant SB as Supabase
    participant OTP as send-otp
    participant PAY as razorpay-payment
    participant RZ as Razorpay
    participant DISP as booking-dispatch
    participant V as Vendor

    C->>PWA: Browse services (no login wall)
    PWA->>SB: fetchLivePricing() + Realtime subscribe
    C->>PWA: Select service → book
    PWA->>PWA: GPS / address / schedule
    C->>PWA: Enter mobile + accept terms
    PWA->>OTP: send OTP
    OTP-->>PWA: OTP sent (SMS)
    C->>PWA: Verify OTP
    PWA->>OTP: verify OTP
    OTP-->>PWA: verified
    PWA->>PWA: Create/update profile (Supabase auth)
    C->>PWA: Payment screen
    PWA->>PAY: register(txn_id, amount_paise)
    PAY->>RZ: Create payment link
    PAY-->>PWA: payment_link_url + UPI deep link
    C->>RZ: Pay via UPI / Razorpay
    loop Poll every 3s
        PWA->>PAY: check(txn_id, amount_paise)
        PAY-->>PWA: verified + amount_ok
    end
    RZ->>PAY: webhook payment.captured
    PAY->>SB: mark payment_intents paid
    PWA->>SB: INSERT booking
    PWA->>DISP: start(booking_id, lat, lng, service)
    DISP->>V: SMS/WhatsApp/Call nearest vendor
    V->>DISP: ACCEPT code
    DISP->>SB: Update booking_dispatch status
    C->>PWA: #track?id=BK-… live status
```

---

## 2. Payment Flow with Amount Validation

```mermaid
flowchart TD
    A["Customer reaches payment screen"] --> B["Generate TXN-{timestamp}"]
    B --> C["Calculate amount_paise<br/>price + 10% fee + 18% GST"]
    C --> D["POST razorpay-payment<br/>action: register"]
    D --> E{"RAZORPAY_KEY_SECRET<br/>configured?"}
    E -->|Yes| F["Create Razorpay payment link"]
    E -->|No| G["UPI deep link only"]
    F --> H["Show UPI + Razorpay buttons"]
    G --> H
    H --> I["Customer pays"]
    I --> J["Poll check every 3s"]
    J --> K{"verified AND<br/>amount_ok?"}
    K -->|No| J
    K -->|Yes| L["Unlock Confirm booking"]
    I --> M["Razorpay webhook"]
    M --> N{"Signature valid?"}
    N -->|No| O["Reject"]
    N -->|Yes| P{"paid ≥ expected?"}
    P -->|No| Q["Stay pending<br/>amount_ok: false"]
    P -->|Yes| R["Mark payment_intents paid<br/>Store payer_vpa"]
    R --> J
    L --> S["Create booking in DB"]
```

**Security rules:**
- Client never sets `paymentVerified` without server `check`
- Underpaid amounts rejected (`amount_ok: false`)
- Webhook requires HMAC signature when secret configured

---

## 3. OTP & Registration Flow

```mermaid
flowchart LR
    subgraph Browse["Guest Browse"]
        B1["Home / Services"]
        B2["Select service"]
    end

    subgraph Verify["Identity"]
        V1["Mobile + terms"]
        V2["send-otp edge fn"]
        V3["SMS via 2Factor/MSG91"]
        V4["Verify OTP"]
        V5["Supabase signUp/signIn<br/>fake email + password"]
        V6["profiles table upsert"]
    end

    subgraph Alt["WhatsApp Alt"]
        W1["whatsapp-verify"]
        W2["Inbound webhook confirm"]
    end

    B1 --> B2 --> V1 --> V2 --> V3 --> V4 --> V5 --> V6
    V1 -.-> W1 --> W2 --> V5
```

---

## 4. Vendor Dispatch Flow

```mermaid
sequenceDiagram
    participant PWA as ScanV PWA
    participant DISP as booking-dispatch
    participant DB as PostgreSQL
    participant V1 as Vendor 1
    participant V2 as Vendor 2
    participant TW as Twilio/MSG91

    PWA->>DISP: start(booking_id, service, lat, lng)
    DISP->>DB: Find nearest active vendors
    DISP->>DB: Create booking_dispatch row
    DISP->>TW: SMS/WhatsApp to Vendor 1
    DISP->>TW: Outbound call (optional)
    alt Vendor accepts
        V1->>DISP: respond(accept_code, accept)
        DISP->>DB: status = accepted
    else No response (2 min)
        DISP->>TW: Retry Vendor 1 (max 2)
        DISP->>TW: Contact Vendor 2
    end
    Note over DISP,DB: pg_cron tick every N minutes
    DISP->>DISP: tick (cron or manual)
```

---

## 5. Support Ticket Flow

```mermaid
flowchart TD
    subgraph Public["Customer (no PIN)"]
        R1["#report form"]
        R2["POST support-tickets create"]
        R3["Ticket TKT-{timestamp}"]
        T1["#track-ticket"]
        T2["POST support-tickets track"]
    end

    subgraph Agent["Support Agent PIN"]
        A1["#customer-support or #admin Tickets tab"]
        A2["search · detail · timeline"]
        A3["add_comment · update_status"]
        A4["resolve → SMS + email"]
    end

    R1 --> R2 --> R3
    T1 --> T2
    A1 --> A2 --> A3 --> A4
    R3 -.-> A2
```

---

## 6. Pricing Admin Flow

```mermaid
flowchart LR
    A["#pricing-admin"] --> B{"x-pricing-pin valid?"}
    B -->|No| C["PIN gate UI"]
    B -->|Yes| D["GET pricing rows"]
    D --> E["Edit prices in UI"]
    E --> F["POST pricing-admin save"]
    F --> G["Update service_pricing"]
    G --> H["Trigger → service_prices_public view"]
    H --> I["Realtime broadcast"]
    I --> J["All clients refetch pricing"]
```

---

## 7. Live Tracking Flow

```mermaid
flowchart LR
    V["Vendor app / GPS"] --> VL["vendor_live_locations"]
    C["Customer #track"] --> B["bookings + dispatch status"]
    B --> UI["Track screen<br/>status · ETA · map placeholder"]
    VL -.-> UI
```

---

## 8. Data Flow Summary Table

| Flow | Entry | Storage | Exit |
|------|-------|---------|------|
| Browse | PWA home | `service_prices_public` (read) | Service selection |
| Register | OTP verify | `profiles`, GoTrue auth | Logged-in state |
| Pay | Payment screen | `payment_intents` | Booking unlock |
| Book | Confirm | `bookings`, `service_requests` | Dispatch trigger |
| Dispatch | Edge function | `booking_dispatch`, attempts | Vendor assignment |
| Track | `#track` | bookings + dispatch join | Customer UI |
| Support | `#report` | `support_tickets`, comments | Resolution notify |
| Admin | `#admin` | All tables via service role | Dashboard KPIs |
