# ScanV Business Ops — autonomous runbook

**Owner:** ScanV agent (you approve once; agent executes daily)

## Command center

| Surface | URL | Purpose |
|---------|-----|---------|
| Business HQ | `#admin?tab=business` | All 10 cards, readiness, strike list |
| Vendor Leads | `#admin?tab=vendor-leads` | Validate + Add to ScanV |
| Logistics API | `#admin?tab=logistics` | Porter/Borzo/Delhivery pipeline |

## Daily agent (no Mac mail needed)

**Outreach hours: 9:30 AM – 7:00 PM IST only.** Scripts and admin auto-send are blocked at night.

```bash
node scripts/business_growth_agent.mjs
node scripts/send_vendor_outreach.mjs    # ScanV MSG91 WhatsApp agent (daytime only)
bash scripts/open-vendor-whatsapp-links.sh   # Mac fallback — also daytime only
```

Cursor automation should run at **10:00 AM IST** (not overnight).

Reads `.env` for `ADMIN_HUB_PIN` / `SUPPORT_ADMIN_PIN`. Outputs:
- Top 5 household vendors to call/WhatsApp (Wakad/PCMC priority)
- Logistics follow-ups due
- Card priority queue

### ScanV WhatsApp outreach agent

When `MSG91_WHATSAPP_INTEGRATED_NUMBER` is set (already used for customer OTP):

```bash
node scripts/send_vendor_outreach.mjs
```

Or **Business HQ → Send all 5 via ScanV WA**. Marks leads `contacted` automatically. No personal Mac WhatsApp needed.

If MSG91 cold outbound fails, register a Meta template `scanv_vendor_outreach` in MSG91 dashboard.

Lightweight pulse:

```bash
node scripts/business_pulse.mjs
```

Post-deploy check:

```bash
node scripts/post-deploy-validate.mjs
```

## Revenue order (money first)

1. **Household** — 5 high-confidence Wakad/PCMC vendors → call → validate → Add to ScanV
2. **Delivery** — 3PL sandbox + 2 local couriers
3. **Food** — 2 tiffin + 1 restaurant Wakad
4. Remaining cards per Business HQ phase

## Outreach kits

| Channel | File |
|---------|------|
| WhatsApp (vendors) | `docs/whatsapp-vendor-household-plain.txt` |
| Call script | `docs/call-script-household-plain.txt` |
| Logistics partners | `docs/email-*-plain.txt` |
| Logistics follow-up | `docs/email-followup-plain.txt` |

Signatory: **ScanV · DCore** · connect@dcoreglobal.com · +91-9270194842

## Human-only (cannot automate)

- Zoho inbox replies from Porter/Borzo/etc. → forward to agent
- Phone calls (use call script above)
- Contracts, wallet funding, bar council / clinical regulatory sign-off

## When 3PL replies

1. Forward email to agent
2. Agent sets Supabase secrets (`PORTER_API_KEY`, `BORZO_API_TOKEN`, …)
3. Wire `external-logistics.ts` → payment → `create_external_trip` → `#track`

## Cursor automation

**ScanV Daily Business Ops** — scheduled 9:00 AM IST — runs growth agent and posts briefing. Open Automations in Cursor to enable.
