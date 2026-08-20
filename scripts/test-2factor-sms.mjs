#!/usr/bin/env node
/**
 * Test 2Factor SMS routes for a +91 number (does NOT send voice).
 *
 * Usage:
 *   TWOFACTOR_API_KEY=xxx node scripts/test-2factor-sms.mjs 8484850288
 *   TWOFACTOR_OTP_TEMPLATE="ScanV OTP" TWOFACTOR_API_KEY=xxx node scripts/test-2factor-sms.mjs 8484850288
 */
const key = process.env.TWOFACTOR_API_KEY || process.env.TWOFACTOR_KEY || "";
const phone = (process.argv[2] || "").replace(/\D/g, "").slice(-10);
const template = (process.env.TWOFACTOR_OTP_TEMPLATE || "ScanV OTP").trim();
const otp = String(Math.floor(100000 + Math.random() * 900000));
const sender = process.env.TWOFACTOR_SMS_SENDER || "SCANV";

if (!key || phone.length !== 10) {
  console.error("Usage: TWOFACTOR_API_KEY=xxx node scripts/test-2factor-sms.mjs <10-digit-mobile>");
  process.exit(2);
}

function parse(bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const ok = String(data?.Status || "").toLowerCase() === "success";
    return { ok, detail: data?.Details || data?.Status || bodyText };
  } catch {
    return { ok: /success/i.test(bodyText), detail: bodyText };
  }
}

async function tryRoute(label, url) {
  const res = await fetch(url);
  const body = await res.text();
  const parsed = parse(body);
  console.log(`\n[${label}] HTTP ${res.status}`);
  console.log(`  ${parsed.ok ? "OK" : "FAIL"}: ${String(parsed.detail).slice(0, 200)}`);
  return parsed.ok;
}

async function main() {
  console.log(`Testing 2Factor SMS → +91${phone} (OTP ${otp}, template "${template}")`);

  const routes = [
    ["template", `https://2factor.in/API/V1/${key}/SMS/${phone}/${otp}/${encodeURIComponent(template)}`],
    ["default", `https://2factor.in/API/V1/${key}/SMS/${phone}/${otp}`],
    [
      "trans_sms",
      `https://2factor.in/API/R1/?module=TRANS_SMS&apikey=${encodeURIComponent(key)}` +
        `&to=${phone}&from=${encodeURIComponent(sender)}` +
        `&msg=${encodeURIComponent(`ScanV OTP: ${otp}. Valid 10 min. Do not share.`)}`,
    ],
  ];

  let anyOk = false;
  for (const [label, url] of routes) {
    if (await tryRoute(label, url)) anyOk = true;
  }

  console.log(anyOk ? "\nAt least one SMS route succeeded — check the phone for SMS." : "\nAll SMS routes failed — fix DLT template/sender in 2Factor panel.");
  process.exit(anyOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
