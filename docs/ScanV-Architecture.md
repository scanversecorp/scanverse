# ScanV — System Architecture

**Version:** v5.5.3 · **Updated:** 14 Aug 2026

> This file is kept for legacy links. **Canonical architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)  
> **Data flows:** [APP-DATA-FLOW.md](./APP-DATA-FLOW.md) · **HTML:** [/docs/architecture.html](/docs/architecture.html)

The full system context, deployment, edge-function, vendor-toggle, and security diagrams live in **ARCHITECTURE.md** (single source of truth).

---

## Quick reference

| Item | Value |
|------|-------|
| Production | https://scanv-tau.vercel.app |
| Supabase project | `rwlwrmmqtedugcreweut` |
| Edge functions | 11 — see ARCHITECTURE.md §3 |
| Payments | Vyapar UPI primary · GPay PhonePe Paytm Navi BHIM · Razorpay backup |
| OTP | 2Factor primary · MSG91 Twilio fallback · WhatsApp verify |
| Admin go-live | `#admin` → Go-Live tab · vendor toggles |
| QR | `/?qr=1` direct browse · `/scanv-qr.png` print asset |

Integration boundaries change as service providers are onboarded — update diagrams when adding providers.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for all mermaid diagrams.
