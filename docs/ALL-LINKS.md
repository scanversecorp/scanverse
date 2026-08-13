# ScanV — All Links

**Updated:** 12 Aug 2026

---

## Production URLs

| Name | URL | Notes |
|------|-----|-------|
| **Primary PWA** | https://scanv-tau.vercel.app | Main ScanV deployment |
| Alternate alias | https://scanverse-tau.vercel.app | Same Vercel project |
| Legacy (wrong app) | https://scanverse.vercel.app | Old QR scanner — **not ScanV** |
| QR landing | https://scanv-tau.vercel.app?qr=1 | Print QR campaigns |
| Corporate site | https://www.dcoreglobal.com | DCORE Global Corporation (parent entity) |
| Parent engineering | https://www.vanguardnode.com | VanguardNode (Wix) |
| Beauty brand | https://www.richroyalscorp.com | Rich Royals Corp (Wix) |

---

## Hash Routes (Admin & Internal)

Not linked in public navigation. Bookmark-only access.

| Route | URL | Auth |
|-------|-----|------|
| Admin Control Center | https://scanv-tau.vercel.app/#admin | `ADMIN_HUB_PIN` or leader PINs |
| Admin alias | https://scanv-tau.vercel.app/#admin-hub | Same as above |
| Executive Dashboard | https://scanv-tau.vercel.app/#exec | Owner PIN only |
| Exec alias | https://scanv-tau.vercel.app/#exec-dashboard | Same as above |
| Pricing Admin | https://scanv-tau.vercel.app/#pricing-admin | `PRICING_ADMIN_PIN` |
| Customer Support | https://scanv-tau.vercel.app/#customer-support | `SUPPORT_AGENT_PIN` / admin PINs |
| Vendor Onboard | https://scanv-tau.vercel.app/#vendor-onboard | Public self-registration |
| Vendor Admin | https://scanv-tau.vercel.app/#vendor-admin | `VENDOR_ADMIN_PIN` |
| Booking Track | https://scanv-tau.vercel.app/#track?id=BK-… | Public (booking ID) |
| FAQ | https://scanv-tau.vercel.app/#faq | Public |
| Report Issue | https://scanv-tau.vercel.app/#report | Public |
| Track Ticket | https://scanv-tau.vercel.app/#track-ticket | Public (ticket # + mobile) |

---

## Legal & Policy Pages (Path Routes)

SPA rewrites to `index.html`; rendered by `LegalPage` component.

| Page | URL |
|------|-----|
| Privacy Policy | https://scanv-tau.vercel.app/privacy |
| Terms & Conditions | https://scanv-tau.vercel.app/terms |
| Refund Policy | https://scanv-tau.vercel.app/refund |
| Payment Policy | https://scanv-tau.vercel.app/payment |

---

## Documentation & diagrams

| Document | URL |
|----------|-----|
| **Architecture (HTML)** | https://scanv-tau.vercel.app/docs/architecture.html |
| **Data flow (HTML)** | https://scanv-tau.vercel.app/docs/data-flow.html |
| Architecture (markdown) | `docs/ARCHITECTURE.md` |
| Data flow (markdown) | `docs/APP-DATA-FLOW.md` |
| Docs index | `docs/README.md` |

Diagrams reflect v5.5.3. Provider integrations may change — see **Go-Live** vendor toggles.

---

## Infrastructure Dashboards

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut |
| Supabase SQL Editor | https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/sql |
| Supabase Edge Functions | https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/functions |
| Supabase Database | https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/editor |
| Vercel Dashboard | https://vercel.com/ (project: scanv-tau) |
| GitHub Repository | https://github.com/scanversecorp/scanverse |

---

## Supabase API Base

| Endpoint | URL |
|----------|-----|
| REST API | https://rwlwrmmqtedugcreweut.supabase.co/rest/v1/ |
| Auth | https://rwlwrmmqtedugcreweut.supabase.co/auth/v1/ |
| Realtime | wss://rwlwrmmqtedugcreweut.supabase.co/realtime/v1/ |
| Edge Functions | https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/ |

---

## Webhook URLs (Configure in External Dashboards)

| Provider | Webhook URL | Events |
|----------|-------------|--------|
| Razorpay | https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/razorpay-payment | `payment.captured`, `payment_link.paid` |
| WhatsApp (MSG91/Twilio) | https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify | Inbound messages |
| Twilio Voice (dispatch) | https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/booking-dispatch?action=call-status | Call status |
| Twilio SMS (dispatch) | https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/booking-dispatch?action=inbound-sms | SMS replies |

---

## External APIs Used

| Service | Purpose | Docs |
|---------|---------|------|
| OpenStreetMap Nominatim | Reverse geocoding | https://nominatim.openstreetmap.org/ |
| India Post PIN API | PIN lookup | https://api.postalpincode.in/ |
| 2Factor.in | OTP SMS (server) | https://2factor.in/ |
| MSG91 | SMS / WhatsApp | https://msg91.com/ |
| Twilio | SMS / Voice / WhatsApp fallback | https://twilio.com/ |
| Razorpay | UPI & payment links | https://razorpay.com/ |
| Digio | eKYC (vendor onboard) | https://digio.in/ |
| Resend | Support email | https://resend.com/ |

---

## Support Contact

| Channel | Value |
|---------|-------|
| Assist line | +91-90210-00000 (configured in App.js as `ASSIST`) |
