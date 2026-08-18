/** Application, infra, and smoke-test health checks for Admin Hub. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildGoLiveConfig } from "./go-live-config.ts";
import { getBusinessCommand } from "./business-command-admin.ts";
import { listServiceSchedulesAdmin } from "./service-schedule-admin.ts";
import adminDiagramSections from "./admin-diagrams-data.json" with { type: "json" };
import adminUrlIndex from "./admin-url-index-data.json" with { type: "json" };
import { validateUrlIndexSections } from "./url-index-validate.ts";

export type HealthCheckStatus = "pass" | "fail" | "warn";

export type HealthCheck = {
  id: string;
  name: string;
  category: "application" | "infra" | "ui" | "security";
  status: HealthCheckStatus;
  detail: string;
  manual?: string;
};

export type HealthRunResult = {
  suite: "application" | "infra" | "smoke" | "security";
  generated_at: string;
  app_url: string;
  checks: HealthCheck[];
  passed: number;
  failed: number;
  warned: number;
  total: number;
};

export type HealthCheckOptions = {
  /** Skip auth signup probe (scheduled reports — avoids test users). */
  skipAuthProbe?: boolean;
};

export type DailyHealthReport = {
  generated_at: string;
  app_url: string;
  slot: "morning" | "evening";
  application: HealthRunResult;
  infra: HealthRunResult;
  security: HealthRunResult;
  passed: number;
  failed: number;
  warned: number;
  total: number;
};

const EXPECTED_VENDORS = ["twofactor", "msg91", "twilio", "whatsapp", "razorpay", "vyapar_upi"];
const EXPECTED_UPI = ["gpay", "phonepe", "paytm", "navi", "bhim", "any"];
const EXPECTED_VENDOR_SWITCHES = [
  "vendor_enable_2factor", "vendor_enable_msg91", "vendor_enable_twilio",
  "vendor_enable_whatsapp", "vendor_enable_razorpay", "vendor_enable_vyapar_upi",
  "vendor_enable_upi_gpay", "vendor_enable_upi_phonepe", "vendor_enable_upi_paytm",
  "vendor_enable_upi_navi", "vendor_enable_upi_bhim", "vendor_enable_upi_any",
];
const EXPECTED_DIAGRAM_SECTIONS = ["Architecture", "Data flows", "User journeys", "Components"];
const EXPECTED_DIAGRAM_TOTAL = 31;

function appUrl(): string {
  return Deno.env.get("APP_URL") || "https://getscanv.com";
}

function sbUrl(): string {
  return Deno.env.get("SUPABASE_URL") || "";
}

function anonKey(): string {
  return Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SB_PUBLISHABLE_KEY") || "";
}

function summarize(suite: HealthRunResult["suite"], checks: HealthCheck[]): HealthRunResult {
  return {
    suite,
    generated_at: new Date().toISOString(),
    app_url: appUrl(),
    checks,
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
    warned: checks.filter((c) => c.status === "warn").length,
    total: checks.length,
  };
}

function tally(results: HealthRunResult[]): Pick<DailyHealthReport, "passed" | "failed" | "warned" | "total"> {
  return {
    passed: results.reduce((n, r) => n + r.passed, 0),
    failed: results.reduce((n, r) => n + r.failed, 0),
    warned: results.reduce((n, r) => n + r.warned, 0),
    total: results.reduce((n, r) => n + r.total, 0),
  };
}

async function anonFetch(path: string, opts: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const key = anonKey();
  const base = sbUrl();
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  const text = await r.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

function push(
  checks: HealthCheck[],
  category: HealthCheck["category"],
  id: string,
  name: string,
  ok: boolean,
  detail: string,
  manual?: string,
  warn = false,
): void {
  checks.push({
    id,
    name,
    category,
    status: ok ? "pass" : (warn ? "warn" : "fail"),
    detail,
    manual,
  });
}

/** RLS, auth gates, production safety switches, and public exposure checks. */
export async function runSecurityHealthChecks(sb: SupabaseClient): Promise<HealthRunResult> {
  const checks: HealthCheck[] = [];
  const url = sbUrl();
  const key = anonKey();
  const base = appUrl();

  if (!url || !key) {
    push(checks, "security", "env", "Supabase env", false, "SUPABASE_URL or anon key missing on edge function");
    return summarize("security", checks);
  }

  let r = await anonFetch("/rest/v1/profiles?select=id&limit=1");
  const profileRows = Array.isArray(r.body) ? r.body : [];
  push(checks, "security", "profiles-anon", "Profiles anon read blocked",
    profileRows.length === 0, `HTTP ${r.status}, rows=${profileRows.length}`);

  r = await anonFetch("/rest/v1/bookings?select=id&limit=1");
  const bookingRows = Array.isArray(r.body) ? r.body : [];
  push(checks, "security", "bookings-anon", "Bookings anon read blocked",
    bookingRows.length === 0, `HTTP ${r.status}, rows=${bookingRows.length}`);

  r = await anonFetch("/rest/v1/support_tickets?select=id&limit=1");
  const ticketRows = Array.isArray(r.body) ? r.body : [];
  push(checks, "security", "tickets-anon", "Support tickets anon read blocked",
    ticketRows.length === 0, `HTTP ${r.status}, rows=${ticketRows.length}`);

  r = await anonFetch("/rest/v1/payment_intents?select=txn_id&limit=1");
  const payRows = Array.isArray(r.body) ? r.body : [];
  push(checks, "security", "pay-intents-read", "Payment intents anon read blocked",
    payRows.length === 0, `HTTP ${r.status}, rows=${payRows.length}`);

  r = await anonFetch("/rest/v1/payment_intents", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ txn_id: `TXN-SEC-${Date.now()}`, amount_paise: 1, status: "paid" }),
  });
  push(checks, "security", "pay-intents-insert", "Payment intents anon insert blocked",
    r.status >= 400, `HTTP ${r.status}`);

  r = await anonFetch("/functions/v1/admin-hub", {
    method: "POST",
    body: JSON.stringify({ action: "ping" }),
  });
  push(checks, "security", "admin-no-pin", "Admin hub without PIN blocked",
    r.status === 401, `HTTP ${r.status}`);

  r = await anonFetch("/functions/v1/booking-dispatch", {
    method: "POST",
    body: JSON.stringify({ action: "tick" }),
  });
  push(checks, "security", "dispatch-no-secret", "Dispatch tick without secret blocked",
    r.status === 401, `HTTP ${r.status}`);

  r = await anonFetch("/functions/v1/admin-hub", {
    method: "POST",
    body: JSON.stringify({ action: "get_admin_url_index" }),
  });
  const unauthBody = r.body as { error?: string };
  push(checks, "security", "url-index-no-pin", "URL index without PIN blocked",
    r.status === 401 || unauthBody?.error === "Unauthorized", `HTTP ${r.status}`);

  r = await anonFetch("/functions/v1/health-report", {
    method: "POST",
    body: JSON.stringify({ slot: "morning" }),
  });
  push(checks, "security", "health-report-no-secret", "Health report cron endpoint protected",
    r.status === 401, `HTTP ${r.status}`);

  const otpReportSecret = Deno.env.get("OTP_REPORT_SECRET") || "";
  push(checks, "security", "otp-report-secret", "OTP_REPORT_SECRET configured",
    otpReportSecret.length >= 8, otpReportSecret ? "set" : "missing — delivery report webhook may fail-open", undefined, !otpReportSecret);

  try {
    const docsRes = await fetch(`${base}/docs/architecture.html`);
    const docsBody = await docsRes.text();
    const docsBlocked = docsBody.includes("Page not found") || docsBody.includes("not publicly available") || docsRes.status === 404;
    push(checks, "security", "docs-blocked", "/docs/architecture.html blocked",
      docsBlocked, `HTTP ${docsRes.status}`);

    const html = await (await fetch(base)).text();
    const mainMatch = html.match(/main\.([a-f0-9]+)\.js/);
    if (mainMatch) {
      const mainSrc = await (await fetch(`${base}/static/js/${mainMatch[0]}`)).text();
      push(checks, "security", "bundle-no-url-index", "Main bundle has no admin URL catalog",
        !mainSrc.includes("github.com/scanversecorp/scanverse"), "confidential catalog not in bundle");
      push(checks, "security", "bundle-no-mermaid", "Main bundle has no embedded Mermaid data",
        !mainSrc.includes("flowchart TB") && !mainSrc.includes("sequenceDiagram"), "diagram source not inlined");
    }
  } catch (e) {
    push(checks, "security", "frontend-security", "Frontend security fetch", false,
      e instanceof Error ? e.message : String(e));
  }

  try {
    const cfg = await buildGoLiveConfig(sb) as {
      sections?: Array<{ id?: string; items?: Array<{ setting?: string; enabled?: boolean }> }>;
    };
    const runtime = (cfg.sections || []).find((s) => s.id === "switches")?.items || [];
    const otpDev = runtime.find((s) => s.setting === "otp_dev_mode");
    const dispatch = runtime.find((s) => s.setting === "dispatch_open");
    const maintenance = runtime.find((s) => s.setting === "maintenance_mode");
    push(checks, "security", "otp-dev-mode", "otp_dev_mode OFF (production)",
      !otpDev?.enabled, otpDev?.enabled ? "ON — must be OFF" : "OFF");
    push(checks, "security", "dispatch-open", "dispatch_open OFF (production)",
      !dispatch?.enabled, dispatch?.enabled ? "ON — must be OFF" : "OFF");
    push(checks, "security", "maintenance-mode", "maintenance_mode OFF (public site live)",
      !maintenance?.enabled, maintenance?.enabled ? "ON — customers see maintenance page" : "OFF",
      undefined, !!maintenance?.enabled);
  } catch (e) {
    push(checks, "security", "go-live-security", "Go-Live security switches", false,
      e instanceof Error ? e.message : String(e));
  }

  return summarize("security", checks);
}

/** Functional API + platform checks (mirrors scripts/smoke-test.mjs runApiTests). */
export async function runApplicationHealthChecks(opts: HealthCheckOptions = {}): Promise<HealthRunResult> {
  const checks: HealthCheck[] = [];
  const url = sbUrl();
  const key = anonKey();

  if (!url || !key) {
    push(checks, "application", "env", "Supabase env", false, "SUPABASE_URL or anon key missing on edge function");
    return summarize("application", checks);
  }

  let r = await anonFetch("/rest/v1/service_prices_public?select=service_id&limit=3");
  push(checks, "application", "pricing-public", "Public pricing readable",
    r.status === 200, `HTTP ${r.status}, rows=${Array.isArray(r.body) ? r.body.length : "?"}`);

  r = await anonFetch("/functions/v1/razorpay-payment", {
    method: "POST",
    body: JSON.stringify({ action: "register", txn_id: `TXN-HEALTH-${Date.now()}`, amount_paise: 100 }),
  });
  const rzBody = r.body as { url?: string; success?: boolean };
  push(checks, "application", "razorpay-register", "Razorpay payment link register",
    Boolean(rzBody?.url || rzBody?.success), `HTTP ${r.status} link=${Boolean(rzBody?.url)}`, undefined, true);

  r = await anonFetch("/functions/v1/send-otp", {
    method: "POST",
    body: JSON.stringify({ mobile: "9999999999", action: "send" }),
  });
  const otpBody = r.body as { success?: boolean; provider?: string };
  push(checks, "application", "send-otp", "Send OTP edge function reachable",
    Boolean(otpBody?.success), `HTTP ${r.status} provider=${otpBody?.provider || "?"}`);

  if (!opts.skipAuthProbe) {
    const email = Deno.env.get("HEALTH_CHECK_EMAIL") || "health-check@scanv.app";
    const password = Deno.env.get("HEALTH_CHECK_PASSWORD") || "ScanVHealthCheck1!";
    const authHeaders = { apikey: key, "Content-Type": "application/json" };
    const signinRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    });
    const signin = await signinRes.json() as { access_token?: string; error_description?: string };
    if (signin.access_token) {
      push(checks, "application", "auth-signup", "Auth signup/signin", true, "signin ok (health-check user)");
    } else {
      const signupRes = await fetch(`${url}/auth/v1/signup`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email, password }),
      });
      const signup = await signupRes.json() as { access_token?: string; msg?: string };
      const retrySignin = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email, password }),
      });
      const retry = await retrySignin.json() as { access_token?: string; error_description?: string };
      push(checks, "application", "auth-signup", "Auth signup/signin",
        Boolean(signup.access_token || retry.access_token),
        signup.access_token ? "signup session ok" : (retry.access_token ? "signin ok" : retry.error_description || signup.msg || "no session"));
    }
  } else {
    push(checks, "application", "auth-signup", "Auth signup/signin", true, "skipped (avoids test signups on refresh)");
  }

  const pcRes = await anonFetch("/functions/v1/platform-config");
  const pc = pcRes.body as { vendors?: Record<string, unknown> };
  push(checks, "application", "platform-config", "Platform config responds",
    pcRes.status === 200 && Boolean(pc?.vendors), `HTTP ${pcRes.status}`);

  for (const k of EXPECTED_VENDORS) {
    push(checks, "application", `pc-${k}`, `Platform config ${k} ON`,
      pc?.vendors?.[k] === true, String(pc?.vendors?.[k] ?? "missing"));
  }
  const upi = (pc?.vendors?.upi || {}) as Record<string, unknown>;
  for (const k of EXPECTED_UPI) {
    push(checks, "application", `pc-upi-${k}`, `Platform config upi.${k} ON`,
      upi[k] === true, String(upi[k] ?? "missing"));
  }

  return summarize("application", checks);
}

/** DB, deploy, go-live, and admin catalog checks (mirrors scripts/post-deploy-validate.mjs). */
export async function runInfraHealthChecks(sb: SupabaseClient): Promise<HealthRunResult> {
  const checks: HealthCheck[] = [];
  const base = appUrl();

  try {
    const html = await (await fetch(base)).text();
    const mainMatch = html.match(/main\.([a-f0-9]+)\.js/);
    push(checks, "infra", "frontend-bundle", "Production main bundle deployed",
      Boolean(mainMatch), mainMatch ? mainMatch[0] : "main.*.js not found in index.html");

    const manifestRes = await fetch(`${base}/asset-manifest.json`);
    if (manifestRes.ok) {
      const manifest = await manifestRes.json() as { files?: Record<string, string> };
      const chunk = Object.keys(manifest.files || {}).find((k) => k.includes(".chunk.js") && !k.endsWith(".map"));
      push(checks, "infra", "lazy-chunk", "Lazy chunk in asset manifest",
        Boolean(chunk), chunk || "no lazy chunk found", undefined, true);
    } else {
      push(checks, "infra", "lazy-chunk", "Asset manifest reachable", false, `HTTP ${manifestRes.status}`);
    }

    if (mainMatch) {
      const mainSrc = await (await fetch(`${base}/static/js/${mainMatch[0]}`)).text();
      push(checks, "infra", "bundle-diagrams-ref", "Main bundle references AdminDiagramsTab",
        mainSrc.includes("AdminDiagramsTab"), "AdminDiagramsTab string present");
      push(checks, "infra", "bundle-schedule-ui", "Main bundle includes service schedule UI",
        mainSrc.includes("list_service_schedules") && mainSrc.includes("AdminServiceSchedule"),
        "schedule booking UI symbols present");
    }
  } catch (e) {
    push(checks, "infra", "frontend-fetch", "Frontend fetch", false, e instanceof Error ? e.message : String(e));
  }

  const tables = [
    ["profiles", "Profiles table"],
    ["bookings", "Bookings table"],
    ["payments", "Payments table"],
    ["support_tickets", "Support tickets table"],
    ["vendor_partners", "Vendor partners table"],
  ] as const;
  for (const [table, label] of tables) {
    const { count, error } = await sb.from(table).select("id", { count: "exact", head: true });
    push(checks, "infra", `db-${table}`, `${label} queryable`, !error, error ? error.message : `count=${count ?? 0}`);
  }

  const schedRes = await anonFetch("/rest/v1/service_schedules?select=service_id&limit=1");
  const schedRows = Array.isArray(schedRes.body) ? schedRes.body : [];
  push(checks, "infra", "service-schedules", "Service schedules public read",
    schedRes.status === 200 && schedRows.length >= 1, `HTTP ${schedRes.status}, rows=${schedRows.length}`);

  try {
    const cfg = await buildGoLiveConfig(sb) as {
      progress?: { vendors?: { total?: number; done?: number } };
      sections?: Array<{ id?: string; items?: Array<{ type?: string; setting?: string; enabled?: boolean }> }>;
    };
    const p = cfg.progress?.vendors;
    push(checks, "infra", "go-live-vendors", "Go-Live vendors recommended state",
      p?.total === 12 && p?.done === 12, `${p?.done ?? "?"}/${p?.total ?? "?"} ON`);

    const vendorSection = (cfg.sections || []).find((s) => s.id === "vendors");
    const switches = (vendorSection?.items || []).filter((i) => i.type === "switch");
    push(checks, "infra", "go-live-switch-count", "Vendor switch board count",
      switches.length === 12, `${switches.length} switches`);

    for (const key of EXPECTED_VENDOR_SWITCHES) {
      const row = switches.find((s) => s.setting === key);
      push(checks, "infra", `switch-${key}`, `${key} ON`,
        Boolean(row?.enabled), row ? (row.enabled ? "ON" : "OFF") : "missing", undefined, true);
    }
  } catch (e) {
    push(checks, "infra", "go-live-config", "Go-Live config load", false, e instanceof Error ? e.message : String(e));
  }

  const urlIndexTotal = (Array.isArray(adminUrlIndex) ? adminUrlIndex : []).reduce(
    (n: number, s: { items?: unknown[] }) => n + (s.items?.length || 0), 0,
  );
  push(checks, "infra", "url-index-count", "Admin URL index catalog",
    urlIndexTotal >= 40, `${urlIndexTotal} links (PIN-gated at runtime)`);

  const urlIndexValidation = validateUrlIndexSections(
    Array.isArray(adminUrlIndex) ? adminUrlIndex : [],
  );
  push(checks, "infra", "url-index-routes", "URL index covers all app routes",
    urlIndexValidation.ok,
    urlIndexValidation.ok ? "manifest complete" : urlIndexValidation.missing.slice(0, 8).join(", ") + (urlIndexValidation.missing.length > 8 ? "…" : ""),
    undefined, !urlIndexValidation.ok);

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const isoStart = todayStart.toISOString();
    const [{ count: failedToday }, { count: deliveredToday }] = await Promise.all([
      sb.from("otp_delivery_reports").select("id", { count: "exact", head: true })
        .eq("status", "failed").gte("created_at", isoStart),
      sb.from("otp_delivery_reports").select("id", { count: "exact", head: true })
        .eq("status", "delivered").gte("created_at", isoStart),
    ]);
    const failed = failedToday ?? 0;
    const delivered = deliveredToday ?? 0;
    push(checks, "application", "otp-delivery-failed-today", "2Factor OTP SMS failures today",
      failed === 0,
      `failed=${failed} delivered=${delivered} (2Factor delivery callbacks)`,
      undefined,
      failed > 0);
  } catch (e) {
    push(checks, "application", "otp-delivery-stats", "2Factor OTP delivery stats", false,
      e instanceof Error ? e.message : String(e));
  }

  const diagramSections = Array.isArray(adminDiagramSections) ? adminDiagramSections : [];
  const diagramTotal = diagramSections.reduce(
    (n: number, s: { diagrams?: unknown[] }) => n + (s.diagrams?.length || 0), 0,
  );
  push(checks, "infra", "diagram-count", "Architecture diagram catalog",
    diagramTotal === EXPECTED_DIAGRAM_TOTAL, `${diagramTotal} (expected ${EXPECTED_DIAGRAM_TOTAL})`);
  for (const label of EXPECTED_DIAGRAM_SECTIONS) {
    const sec = diagramSections.find((s: { label?: string }) => s.label === label);
    push(checks, "infra", `diagram-${label}`, `Diagram section "${label}"`,
      Boolean(sec?.diagrams?.length), sec ? `${sec.diagrams.length} diagrams` : "missing");
  }

  try {
    const biz = await getBusinessCommand(sb);
    const cards = biz.cards || [];
    push(checks, "infra", "business-hq-cards", "Business HQ card pipelines",
      cards.length === 12, `${cards.length} cards`);
    push(checks, "infra", "business-readiness", "Business HQ readiness summary",
      typeof biz.summary?.overall_readiness_pct === "number",
      biz.summary?.overall_readiness_pct != null ? `${biz.summary.overall_readiness_pct}%` : "missing");
  } catch (e) {
    push(checks, "infra", "business-hq", "Business HQ load", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const list = await listServiceSchedulesAdmin(sb);
    const rows = list.services || [];
    push(checks, "infra", "schedules-admin", "list_service_schedules (admin)",
      rows.length > 0, `${rows.length} service(s)`);
  } catch (e) {
    push(checks, "infra", "schedules-admin", "list_service_schedules (admin)", false,
      e instanceof Error ? e.message : String(e));
  }

  const scheduleActions = [
    "list_service_schedules", "get_service_schedule", "update_service_schedule",
    "list_service_schedule_vendors", "update_service_schedule_vendors",
  ];
  for (const action of scheduleActions) {
    const r = await anonFetch("/functions/v1/admin-hub", {
      method: "POST",
      body: JSON.stringify({ action, service_id: "hh-kitchen" }),
    });
    const body = r.body as { error?: string };
    push(checks, "infra", `route-${action}`, `${action} routed`,
      body.error !== "Unknown action", body.error === "Unauthorized" ? "PIN required ✓" : (body.error || `HTTP ${r.status}`));
  }

  return summarize("infra", checks);
}

/** Lightweight UI route checks via HTTP fetch (full Playwright smoke is local CLI). */
export async function runUiSmokeChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const base = appUrl();

  try {
    const homeRes = await fetch(base);
    const homeHtml = await homeRes.text();
    const titleMatch = homeHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "";
    push(checks, "ui", "ui-home", "Production app loads",
      homeRes.ok && title.length > 0, `HTTP ${homeRes.status} title="${title}"`);
    push(checks, "ui", "ui-root", "SPA root mount point",
      homeHtml.includes('id="root"') || homeHtml.includes("id='root'"), "root div present");

    for (const [path, label, needle] of [
      ["/privacy", "Privacy policy", "Privacy"],
      ["/terms", "Terms page", "Terms"],
    ] as const) {
      const res = await fetch(`${base}${path}`);
      const body = await res.text();
      push(checks, "ui", `ui-${path.slice(1)}`, label,
        res.ok && body.includes(needle), `HTTP ${res.status}`);
    }

    push(checks, "ui", "ui-playwright-note", "Full UI smoke (Playwright)",
      true,
      "Run locally: node scripts/smoke-test.mjs",
      "Booking flow, OTP UI, PIN gates, and screenshots require Playwright — not runnable from edge function.");
  } catch (e) {
    push(checks, "ui", "ui-fetch", "UI fetch checks", false, e instanceof Error ? e.message : String(e));
  }

  return checks;
}

/** Combined application + infra + security + UI fetch smoke test. */
export async function runSmokeTest(sb: SupabaseClient, opts: HealthCheckOptions = {}): Promise<HealthRunResult> {
  const [app, infra, security, ui] = await Promise.all([
    runApplicationHealthChecks(opts),
    runInfraHealthChecks(sb),
    runSecurityHealthChecks(sb),
    runUiSmokeChecks(),
  ]);
  const checks = [...app.checks, ...infra.checks, ...security.checks, ...ui];
  return summarize("smoke", checks);
}

/** Daily report payload for scheduled email (Application + Infra + Security). */
export async function runDailyHealthReport(
  sb: SupabaseClient,
  slot: "morning" | "evening",
  opts: HealthCheckOptions = { skipAuthProbe: true },
): Promise<DailyHealthReport> {
  const scheduledOpts = { skipAuthProbe: true, ...opts };
  const [application, infra, security] = await Promise.all([
    runApplicationHealthChecks(scheduledOpts),
    runInfraHealthChecks(sb),
    runSecurityHealthChecks(sb),
  ]);
  const totals = tally([application, infra, security]);
  return {
    generated_at: new Date().toISOString(),
    app_url: appUrl(),
    slot,
    application,
    infra,
    security,
    ...totals,
  };
}
