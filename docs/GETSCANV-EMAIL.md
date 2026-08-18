# getscanv.com email (Cloudflare Email Routing)

**Provider:** Cloudflare Email Routing (free) — receive/forward only.  
**DNS:** MX → `route1/2/3.mx.cloudflare.net`  
**Upgrade path:** Zoho Mail free (5 users) if you need real inboxes + send without Resend.

## Active aliases

| Address | Forwards to | Status |
|---------|-------------|--------|
| `hello@getscanv.com` | jasmeen.workmail@gmail.com | ✅ Active |
| `connect@getscanv.com` | jasmeen.workmail@gmail.com | ✅ Active |
| `support@getscanv.com` | jasmeen.workmail@gmail.com | ✅ Active |
| `partners@getscanv.com` | jasmeen.workmail@gmail.com | ✅ Active |
| `jas@getscanv.com` | jasmeen.workmail@gmail.com | ✅ Active |
| `sam@getscanv.com` | samir.workmail@gmail.com | ✅ Active |
| `payments@getscanv.com` | samir.workmail@gmail.com | ✅ Active |
| `reports@getscanv.com` | samir.workmail@gmail.com | ✅ Active |

## Finish Samir destination (one-time)

Cloudflare sent a verification email to **samir.workmail@gmail.com**. Click the link, then run:

```bash
# After samir.workmail@gmail.com shows "verified" in Cloudflare → Email Routing → Destination addresses
CLOUDFLARE_API_TOKEN=xxx node scripts/setup-getscanv-email-routing.mjs
```

Or add rules manually in [Cloudflare Email Routing](https://dash.cloudflare.com/?to=/:account/getscanv.com/email/routing/routes).

## Sending as @getscanv.com (automated)

Cloudflare routing is **inbound only**. For health reports and ticket emails from Supabase edge functions:

1. Add domain on [Resend](https://resend.com) (free tier)
2. Add Resend SPF/DKIM in Cloudflare DNS (keep Cloudflare MX for inbound)
3. Set Supabase secrets:
   ```bash
   npx supabase secrets set \
     RESEND_API_KEY=re_xxxx \
     SUPPORT_EMAIL_FROM=support@getscanv.com \
     HEALTH_REPORT_FROM=reports@getscanv.com \
     HEALTH_REPORT_TO='sam@getscanv.com,jas@getscanv.com'
   ```

## Gmail “Send mail as” (optional, manual replies)

In Gmail → Settings → Accounts → **Send mail as** → add `support@getscanv.com` etc. using SMTP or “Treat as alias” after Resend/domain verify.

## Health report schedule

Daily at **6:00 AM** and **5:00 PM IST** → `sam@getscanv.com` + `jas@getscanv.com`.

**Cron:** pg_cron jobs `scanv-health-report-am` / `scanv-health-report-pm` call `health-report` edge function.  
**Vault setup (one-time):** `scripts/setup-health-report-vault.sql` — match `HEALTH_REPORT_SECRET` edge secret.
