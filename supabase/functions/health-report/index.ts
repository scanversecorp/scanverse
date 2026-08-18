/**
 * ScanV scheduled health report — invoked by pg_cron at 6:00 AM & 5:00 PM IST.
 * POST { "slot": "morning" | "evening" }
 * Auth: x-health-report-secret header OR Authorization Bearer service role
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  runDailyHealthReport,
  type DailyHealthReport,
  type HealthRunResult,
} from "../_shared/health-checks.ts";
import { sendEmailMany } from "../_shared/notify.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-health-report-secret",
};

const DEFAULT_RECIPIENTS = [
  "sam@getscanv.com",
  "jas@getscanv.com",
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminSb() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function healthReportAuthOk(req: Request): boolean {
  const secret = Deno.env.get("HEALTH_REPORT_SECRET") || "";
  const header = req.headers.get("x-health-report-secret") || "";
  if (secret.length >= 8 && header === secret) return true;
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return !!(serviceKey && token === serviceKey);
}

function reportRecipients(): string[] {
  const raw = Deno.env.get("HEALTH_REPORT_TO") || DEFAULT_RECIPIENTS.join(",");
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

function istLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSuiteSection(title: string, suite: HealthRunResult): string {
  const lines = [
    `=== ${title.toUpperCase()} ===`,
    `Passed: ${suite.passed} | Failed: ${suite.failed} | Warnings: ${suite.warned} | Total: ${suite.total}`,
    "",
  ];
  for (const c of suite.checks) {
    const tag = c.status.toUpperCase().padEnd(4, " ");
    lines.push(`${tag} ${c.name} — ${c.detail}`);
  }
  return lines.join("\n");
}

function formatEmailBody(report: DailyHealthReport): string {
  const slotLabel = report.slot === "morning" ? "6:00 AM IST (Morning)" : "5:00 PM IST (Evening)";
  const overallOk = report.failed === 0;
  const lines = [
    "ScanV Daily Health Check Report",
    "================================",
    `Schedule: ${slotLabel}`,
    `Generated: ${istLabel(report.generated_at)} IST`,
    `App: ${report.app_url}`,
    `Overall: ${report.passed}/${report.total} passed · ${report.failed} failed · ${report.warned} warnings`,
    overallOk ? "Status: ALL CLEAR ✓" : "Status: ATTENTION REQUIRED ✗",
    "",
    formatSuiteSection("Security", report.security),
    "",
    formatSuiteSection("Application", report.application),
    "",
    formatSuiteSection("Infra", report.infra),
    "",
    "Admin portal: https://getscanv.com/#admin?tab=health",
    "Full Playwright UI smoke: node scripts/smoke-test.mjs (local)",
    "",
    "— ScanV automated health monitor",
  ];
  return lines.join("\n");
}

function emailSubject(report: DailyHealthReport): string {
  const slot = report.slot === "morning" ? "6 AM" : "5 PM";
  const status = report.failed === 0 ? "OK" : `${report.failed} FAIL`;
  return `ScanV Health Report (${slot} IST) — ${status} — ${report.passed}/${report.total} passed`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!healthReportAuthOk(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const slotRaw = String(body.slot || "morning").toLowerCase();
  const slot = slotRaw === "evening" ? "evening" : "morning";

  try {
    const sb = adminSb();
    const report = await runDailyHealthReport(sb, slot);
    const recipients = reportRecipients();
    const subject = emailSubject(report);
    const text = formatEmailBody(report);
    const mail = await sendEmailMany(recipients, subject, text);

    return json({
      success: true,
      slot,
      generated_at: report.generated_at,
      passed: report.passed,
      failed: report.failed,
      warned: report.warned,
      total: report.total,
      recipients,
      email: mail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Health report failed";
    return json({ error: msg }, 500);
  }
});
