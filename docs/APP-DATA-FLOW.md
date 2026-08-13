# ScanV — Application Data Flow

**Version:** v5.5.3 · **Updated:** 14 Aug 2026

> **Integration note:** Provider order and availability depend on Admin Go-Life vendor toggles and Supabase secrets. Diagrams show the current default path; alternate routes activate when primary providers are disabled or fail.

**View in browser:** [Data flow diagram](/docs/data-flow.html) · [Architecture](/docs/architecture.html)

---

## 1. Customer Booking Flow (End-to-End)

```mermaid
sequenceDiagram
    actor C as Customer
    participant PWA as ScanV PWA
    participant PC as platform-config
    participant SB as Supabase DB
    participant OTP as send-otp
    participant TF as 2Factor MSG91 Twilio
    participant PAY as razorpay-payment
    participant UPI as GPay PhonePe Vyapar QR
    participant RZ as Razorpay optional
    participant DISP as booking-dispatch
    participant P as Service partner

    C->>PWA: Open app or QR ?qr=1 browse home
    PWA->>PC: GET vendor flags
    PC-->>PWA: razorpay vyapar upi toggles
    PWA->>SB: fetchLivePricing Realtime
    C->>PWA: Select service book form
    PWA->>PWA: GPS address schedule
    C->>PWA: Mobile plus terms
    PWA->>OTP: send OTP
    OTP->>TF: SMS via enabled providers
    TF-->>C: 6-digit SMS
    C->>PWA: Verify OTP
    OTP-->>PWA: verified profile upsert
    C->>PWA: Payment screen
    alt Vyapar UPI enabled
        PWA->>UPI: QR or deep link txn ref
        UPI-->>PAY: webhook vyapar_notify
    else Razorpay enabled
        PWA->>PAY: register payment link
        PAY->>RZ: create link
        C->>RZ: pay
        RZ->>PAY: webhook
    end
    loop Poll every 3s
        PWA->>PAY: check txn amount_ok
        PAY-->>PWA: verified
    end
    PWA->>SB: INSERT booking
    PWA->>DISP: start booking_id lat lng
    DISP->>P: In-app job offer 60s then next partner
    DISP->>P: SMS call WhatsApp backup
    P->>DISP: accept in app or reply code
    DISP->>SB: booking_dispatch accepted
    C->>PWA: track screen live status
```

---

## 2. Payment Flow (Vyapar UPI + UPI Apps + Razorpay Backup)

```mermaid
flowchart TD
    A["Payment screen"] --> B["Load platform-config vendors"]
    B --> C["Generate TXN timestamp ref"]
    C --> D["amount_paise = price + 10% fee + 18% GST"]
    D --> E{"vendor_enable_vyapar_upi?"}
    E -->|ON| F["Vyapar dynamic QR + VPA copy"]
    E -->|OFF| G["Skip Vyapar section"]
    F --> H{"UPI app buttons enabled?"}
    G --> H
    H -->|GPay PhonePe etc| I["upi:// or intent deep link"]
    H --> I2["Generic Pay via UPI if any enabled"]
    I --> J["Customer pays in UPI app"]
    I2 --> J
    F --> J
    J --> K["Poll razorpay-payment check every 3s"]
    K --> L{"verified AND amount_ok?"}
    L -->|No| K
    L -->|Yes| M["Unlock continue booking"]
    D --> N{"vendor_enable_razorpay?"}
    N -->|ON| O["Razorpay payment link register"]
    O --> P["Customer pays Razorpay"]
    P --> Q["Webhook signature plus amount check"]
    Q --> K
    VyaparWH["Vyapar webhook vyapar_notify"] --> K
```

**Security:** Client never sets `paymentVerified` without server `check`. Underpaid amounts rejected `amount_ok false`.

---

## 3. OTP & Identity Flow

```mermaid
flowchart LR
    subgraph Browse["Guest browse"]
        B1["Home services no login wall"]
        B2["QR ?qr=1 direct browse"]
    end

    subgraph Verify["Identity"]
        V1["Mobile plus terms"]
        V2["send-otp edge fn"]
        V3["2Factor primary India"]
        V4["MSG91 Twilio fallback if enabled"]
        V5["Verify OTP"]
        V6["GoTrue signUp signIn"]
        V7["profiles upsert"]
    end

    subgraph Alt["WhatsApp backup if enabled"]
        W1["whatsapp-verify generate"]
        W2["Outbound WA user replies"]
        W3["check poll verified"]
    end

    B1 --> V1
    B2 --> B1
    V1 --> V2 --> V3 --> V4 --> V5 --> V6 --> V7
    V1 -.-> W1 --> W2 --> W3 --> V6
```

**Delivery reporting:** 2Factor callback to `otp-delivery-report` when `OTP_REPORT_SECRET` configured.

---

## 4. Partner Dispatch Flow

Mode set in Admin Vendors tab: `both` in_app external disabled.

```mermaid
sequenceDiagram
    participant PWA as ScanV PWA
    participant DISP as booking-dispatch
    participant DB as PostgreSQL
    participant P1 as Partner 1 nearest
    participant P2 as Partner 2
    participant N as SMS call WhatsApp

    PWA->>DISP: start after paid booking
    DISP->>DB: nearest active vendors GPS match
    DISP->>DB: booking_dispatch plus partner_job_offers
    DISP->>P1: In-app offer 60s window
    DISP->>N: Backup alert to Partner 1
    alt Accept in app
        P1->>DISP: accept offer
        DISP->>DB: status accepted assign partner
    else Timeout
        DISP->>P2: Offer next partner plus backup
    end
    Note over DISP: pg_cron tick every minute
```

---

## 5. Admin Go-Live & Vendor Config Flow

```mermaid
flowchart TD
    L["Leader #admin Go-Live tab"] --> AH["admin-hub get_go_live_config"]
    AH --> R["Runtime switches otp_dev_mode voice dispatch_open"]
    AH --> V["Vendor toggles 12 providers"]
    AH --> S["Secret status OK MISSING"]
    AH --> M["Manual checklist ticks"]
    L --> U1["update_go_live_switch"]
    L --> U2["update_go_live_check"]
    U1 --> PS[("platform_settings")]
    U2 --> PS
    PS --> EF["Edge functions read flags"]
    PS --> PC["platform-config public"]
    PC --> PWA["Customer payment OTP UI"]
```

---

## 6. Support Ticket Flow

```mermaid
flowchart TD
    subgraph Public["Customer no PIN"]
        R1["#report form"]
        R2["support-tickets create"]
        R3["Ticket TKT id"]
        T1["#track-ticket"]
    end

    subgraph Agent["Support PIN"]
        A1["#customer-support or #admin Tickets"]
        A2["search timeline comments"]
        A3["resolve optional notify"]
    end

    R1 --> R2 --> R3
    T1 --> R2
    R3 -.-> A2
    A1 --> A2 --> A3
```

---

## 7. Pricing Admin Flow

```mermaid
flowchart LR
    A["#pricing-admin"] --> B{"PIN plus TOTP 2FA"}
    B -->|Fail| C["Lock screen"]
    B -->|OK| D["GET pricing rows"]
    D --> E["Edit in UI"]
    E --> F["POST pricing-admin save"]
    F --> G["service_pricing update"]
    G --> H["service_prices_public view"]
    H --> I["Realtime broadcast"]
    I --> J["All PWAs refetch pricing"]
```

---

## 8. Data Flow Summary

| Flow | Entry | Storage | Exit |
|------|-------|---------|------|
| Browse | PWA home QR | `service_prices_public` | Service selection |
| Vendor flags | App boot | `platform_settings` via `platform-config` | UI show hide providers |
| Register | OTP verify | `profiles` GoTrue | Logged-in state |
| Pay | Payment screen | `payment_intents` | Booking unlock |
| Book | Confirm | `bookings` `service_requests` | Dispatch trigger |
| Dispatch | Edge fn | `booking_dispatch` `partner_job_offers` | Partner assigned |
| Track | `#track` | bookings dispatch join | Customer UI |
| Support | `#report` | `support_tickets` | Resolution |
| Admin | `#admin` | all tables service role | KPIs go-live |
| OTP report | `#otp-delivery-report` | `otp_delivery_reports` | Delivery status |

---

## 9. Related Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system and deployment diagrams  
- [ScanV-App-Flowcharts.md](./ScanV-App-Flowcharts.md) — app states and roles  
- [ALL-APIS-AND-WEBHOOKS.md](./ALL-APIS-AND-WEBHOOKS.md) — webhook URLs  
