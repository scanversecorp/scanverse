# ScanV v5.4 — Application Flow Charts

**DCORE Global Corporation · PCMC, Pune**  
Stack: React PWA · Supabase · Vercel · Razorpay/UPI  
Live: https://scanv-tau.vercel.app

---

## 1. High-Level App States

```mermaid
stateDiagram-v2
    [*] --> boot: App load
    boot --> legal: /privacy /terms /refund /payment
    boot --> qr: ?qr=1 in URL
    boot --> browse: default (no login wall)
    boot --> app: session restored

    legal --> [*]: Back / navigate away
    qr --> register: Continue after scan capture
    register --> app: Profile complete
    browse --> app: OTP verify during booking
    app --> browse: Sign out (optional)
```

---

## 2. Browse-First Booking Flow (Guest → Customer)

No registration wall. Users browse services first; identity is collected at checkout.

```mermaid
flowchart TD
    A[Open ScanV] --> B[Silent GPS + device capture]
    B --> C[Services list — 8 categories]
    C --> D[Service detail]
    D --> E[Book — date, time, location]
    E --> F[Verify — name + mobile]
    F --> G{OTP method}
    G -->|SMS| H[send-otp edge function]
    G -->|WhatsApp| I[WhatsApp token verify]
    H --> J[Enter 6-digit OTP]
    I --> J
    J --> K[Create/update profile]
    K --> L[Insert booking + service_request]
    L --> M[Payment — platform fee 10% + GST]
    M --> N[Logged-in app — Home tab]
```

---

## 3. OTP Verification Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as ScanV PWA
    participant EF as Supabase send-otp
    participant MSG as MSG91 / Twilio
    participant SB as Supabase DB

    U->>App: Enter mobile + accept terms
    App->>EF: invoke send-otp {mobile}
    EF->>MSG: Deliver OTP SMS
    MSG-->>U: 6-digit code
    U->>App: Enter OTP
    App->>EF: invoke send-otp {mobile, otp, action: verify}
    EF-->>App: success
    App->>SB: auth.signUp + profiles.upsert
    App->>SB: bookings.insert (if booking in progress)
```

---

## 4. QR Scan Entry Flow

Triggered by `?qr=1` or printed QR linking to scanv-tau.vercel.app/?qr=1

```mermaid
flowchart LR
    Q[Scan QR code] --> C[Capture device, IP, GPS]
    C --> S[Store visitor_sessions]
    S --> R[Registration / browse continue]
    R --> B[Normal booking flow]
```

**Leader (admin)** can generate printable QR from Home → ScanV QR Code.

---

## 5. Logged-In App Navigation

```mermaid
flowchart TB
    subgraph Bottom Nav
        H[Home]
        S[Services]
        B[Bookings]
        C[CRM — partner/admin only]
        P[Profile]
    end

    H --> Recent bookings + service grid
    S --> Search + detail + book
    B --> Booking history + status
    C --> CRM dashboard
    P --> Account, legal links, sign out
```

---

## 6. Role-Based Access

```mermaid
flowchart TD
    subgraph Roles
        CU[Customer]
        CA[Candidate]
        PA[Partner]
        LE[Leader / admin]
    end

    CU --> Browse & book
    CU --> Own bookings
    CA --> Badge display only
    PA --> CRM + assigned jobs
    LE --> CRM + QR + platform stats
```

| Role | Sign-up | Bottom nav | CRM | QR generator |
|------|---------|------------|-----|--------------|
| Customer | During first booking | Home, Services, Bookings, Profile | — | — |
| Candidate | Not implemented | Same as customer | — | — |
| Partner | Admin-assigned | + CRM tab | ✓ | — |
| Leader | Admin account | + CRM tab | ✓ | ✓ |

---

## 7. Payment Flow

```mermaid
flowchart TD
    BK[Booking confirmed] --> PF[Platform fee 10% online]
    PF --> GST[GST 18% on subtotal]
    GST --> UPI[UPI / Razorpay link]
    UPI --> SF[Service fee to Partner]
    SF -->|Cash categories| CASH[Cash on service]
    SF -->|Other| ONLINE[UPI to Partner]
```

**Pricing:** Default ₹500 service (50000 paise) unless overridden per service.

---

## 8. Legal & Compliance Pages

| Route | Page |
|-------|------|
| `/privacy` | Privacy Policy — DPDP Act 2023 |
| `/terms` | Terms & Conditions |
| `/refund` | Refund Policy |
| `/payment` | Payment Policy |

Footer links on browse screen and profile. Served by `LegalPage` component with early route detection.

---

## 9. Service Categories

| ID | Category | Cash on service |
|----|----------|-----------------|
| legal | Legal services | No |
| cloud | Cloud training | No |
| vip | VIP appointments | No |
| health | Health care | No |
| property | Property & rentals | No |
| household | Household services | Yes |
| delivery | Deliveries | Yes |
| food | Food | Yes |

---

## 10. Data Captured (Silent + Explicit)

**Silent on load:** IP, device type, OS, browser, timezone, language, battery, canvas fingerprint, GPS (if permitted)

**Explicit at booking:** Name, mobile (OTP), address, village, city, pincode, booking notes

**Stored in:** `visitor_sessions`, `profiles`, `bookings`, `service_requests`, `notifications`

---

*Updated: 11 August 2026 · ScanV v5.4*
