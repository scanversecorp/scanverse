#!/usr/bin/env node
/**
 * ScanV ops health review — trigger health-report and print failures for agent/human triage.
 *
 * Usage:
 *   HEALTH_REPORT_SECRET=xxx node scripts/ops-health-review.mjs
 *   node scripts/ops-health-review.mjs --slot evening
 *
 * Exit code: 0 if no failures, 1 if any check failed, 2 if request error.
 */
const SLOT = process.argv.includes("--slot")
  ? (process.argv[process.argv.indexOf("--slot") + 1] || "morning")
  : "morning";

const SECRET = process.env.HEALTH_REPORT_SECRET || "";
const URL = process.env.HEALTH_REPORT_URL
  || "https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/health-report";

async function main() {
  if (!SECRET || SECRET.length < 8) {
    console.error("Set HEALTH_REPORT_SECRET (same as Supabase edge secret / vault).");
    process.exit(2);
  }

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-health-report-secret": SECRET,
    },
    body: JSON.stringify({ slot: SLOT === "evening" ? "evening" : "morning" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Health report request failed:", res.status, data);
    process.exit(2);
  }

  const { passed, failed, warned, total, failures = [], warnings = [], email } = data;
  console.log(`ScanV Health Review (${SLOT})`);
  console.log(`  ${passed}/${total} passed · ${failed} failed · ${warned} warnings`);
  console.log(`  Email: ${email?.ok ? `${email.provider} → ${email.sent} recipient(s)` : email?.error || "?"}`);

  if (failures.length) {
    console.log("\nFAILURES (action required):");
    for (const f of failures) {
      console.log(`  [${f.category}] ${f.name} (${f.id})`);
      console.log(`    ${f.detail}`);
    }
  }

  if (warnings.length) {
    console.log("\nWARNINGS (review):");
    for (const w of warnings) {
      console.log(`  [${w.category}] ${w.name}: ${w.detail}`);
    }
  }

  if (!failures.length && !warnings.length) {
    console.log("\nAll clear.");
  }

  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
