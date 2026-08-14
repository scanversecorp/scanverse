# ScanV — Application Flow Charts

**Version:** v5.5.3 · **Updated:** 14 Aug 2026 · DCore  
**Live:** [https://scanv-tau.vercel.app](https://scanv-tau.vercel.app)

> Canonical data-flow sequences: [APP-DATA-FLOW.md](./APP-DATA-FLOW.md) · System context: [ARCHITECTURE.md](./ARCHITECTURE.md)  
> **Browser view:** Admin hub → **Architecture** tab (PIN required)

Provider integrations may change — see Admin → Go-Live vendor toggles.

---

## 1. High-Level App States

```mermaid
stateDiagram-v2
    [*] --> boot: App load
    boot --> legal: /privacy /terms /refund /payment
    boot --> browse: default no login wall
    boot --> qr: ?qr=1 opens browse directly
    boot --> app: session restored
    boot --> admin: #admin #exec etc

    legal --> [*]
    qr --> browse: background visitor_sessions capture
    browse --> register: booking needs identity
    register --> app: OTP verified
    app --> browse: sign out
```

---

## 2. Browse-First Booking (Guest → Customer)

```mermaid
flowchart TD
    A[Open ScanV or scan QR] --> B[Silent GPS device IP capture]
    B --> C[Services grid live pricing]
    C --> D[Service detail]
    D --> E[Book date time location]
    E --> F[Verify name mobile terms]
    F --> G{OTP path}
    G -->|SMS| H[send-otp 2Factor then fallback]
    G -->|WhatsApp| I[whatsapp-verify if enabled]
    H --> J[Enter OTP verify]
    I --> J
    J --> K[Profile upsert GoTrue session]
    K --> L[Payment Vyapar UPI apps Razorpay backup]
    L --> M{Server check amount_ok}
    M -->|OK| N[Create booking trigger dispatch]
    N --> O[Track screen or app home]
```

---

## 3. QR Entry (v5.5.3)

```mermaid
flowchart LR
    Q[Printed QR scanv-qr.png] --> U["/?qr=1"]
    U --> B[Browse home immediately]
    U --> C[Background visitor_sessions plus geo]
    B --> D[Normal booking flow]
```

No “Add to Home Screen” gate — browser-first.

---

## 4. Payment Method Selection (Customer UI)

Controlled by `platform-config` vendor flags from Admin Go-Live.

```mermaid
flowchart TD
    P[Payment screen] --> V{vendor flags}
    V --> Vyapar[Vyapar dynamic QR if vyapar_upi ON]
    V --> Apps[UPI app buttons GPay PhonePe Paytm Navi BHIM]
    V --> Any[Pay via UPI generic if any ON]
    V --> RZ[Razorpay link if razorpay ON]
    Vyapar --> Poll[Poll payment check]
    Apps --> Poll
    Any --> Poll
    RZ --> Poll
    Poll --> Done[Continue booking]
```

---

## 5. Logged-In Navigation

```mermaid
flowchart TB
    subgraph BottomNav["Bottom nav"]
        H[Home]
        S[Services]
        B[Bookings]
        C[CRM partner admin only]
        P[Profile]
    end
    H --> Recent activity
    S --> Search book
    B --> History track
    C --> Partner CRM
    P --> Account legal sign out
```

---

## 6. Roles

| Role | Sign-up | Book & pay | CRM | Admin routes |
|------|---------|------------|-----|--------------|
| Customer | During first booking | ✓ | — | — |
| Service partner | `#vendor-onboard` | Assigned jobs | ✓ | `#vendor-admin` PIN |
| Support agent | Admin-created | — | Desk | `#customer-support` |
| Leader | Admin account | — | ✓ | `#admin` `#exec` `#pricing-admin` |

---

## 7. Service Categories (12 verticals)

`legal` · `cloud` · `vip` · `health` · `property` · `household` · `delivery` · `food` · `two-wheeler` · `four-wheeler` · plus sub-services from `service_pricing`.

Cash-on-service categories flagged in catalog (`household`, `delivery`, `food`, etc.).

---

## 8. Legal Routes

| Route | Page |
|-------|------|
| `/privacy` | Privacy Policy DPDP Act 2023 |
| `/terms` | Terms & Conditions |
| `/refund` | Refund Policy |
| `/payment` | Payment Policy |

---

*Updated for ScanV v5.5.3 · See [APP-DATA-FLOW.md](./APP-DATA-FLOW.md) for webhook and dispatch sequences.*
