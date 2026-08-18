/** API & flow transaction monitoring — latency probes for Ops Dashboard. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ApiProbeResult = {
  id: string;
  name: string;
  flow?: string;
  direction: "incoming" | "outgoing";
  scope: "internal" | "external";
  vendor: string;
  method: string;
  endpoint: string;
  status: number | null;
  ok: boolean;
  warn: boolean;
  latency_ms: number;
  request_summary: string;
  response_summary: string;
};

export type FlowTransaction = {
  id: string;
  name: string;
  description: string;
  steps: ApiProbeResult[];
  total_ms: number;
  avg_step_ms: number;
  ok: boolean;
};

export type ApiMonitoringSummary = {
  total_probes: number;
  passed: number;
  failed: number;
  warned: number;
  avg_latency_ms: number;
  internal_avg_ms: number;
  external_avg_ms: number;
  incoming_avg_ms: number;
  outgoing_avg_ms: number;
  by_vendor: Record<string, { count: number; avg_ms: number; failed: number; warned: number }>;
};

export type ApiMonitoringResult = {
  generated_at: string;
  app_url: string;
  probes: ApiProbeResult[];
  flows: FlowTransaction[];
  summary: ApiMonitoringSummary;
};

const WARN_MS_INTERNAL = 1500;
const WARN_MS_EXTERNAL = 3000;

function appUrl(): string {
  return Deno.env.get("APP_URL") || "https://getscanv.com";
}

function sbUrl(): string {
  return Deno.env.get("SUPABASE_URL") || "";
}

function anonKey(): string {
  return Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SB_PUBLISHABLE_KEY") || "";
}

function trunc(s: string, max = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function summarizeBody(body: unknown, status: number): string {
  if (body == null) return `HTTP ${status}`;
  if (typeof body === "string") return trunc(body);
  if (Array.isArray(body)) return `HTTP ${status} · ${body.length} rows`;
  if (typeof body === "object") {
    const o = body as Record<string, unknown>;
    const keys = ["error", "success", "url", "provider", "message", "enrolled", "ok", "count"];
    for (const k of keys) {
      if (o[k] !== undefined) return trunc(`HTTP ${status} · ${k}=${String(o[k])}`);
    }
    return trunc(`HTTP ${status} · ${JSON.stringify(body)}`);
  }
  return String(body);
}

type ProbeOpts = {
  id: string;
  name: string;
  flow?: string;
  direction: ApiProbeResult["direction"];
  scope: ApiProbeResult["scope"];
  vendor: string;
  method: string;
  endpoint: string;
  request_summary: string;
  run: () => Promise<{ ok: boolean; status: number | null; body: unknown; warn?: boolean }>;
};

async function timedProbe(opts: ProbeOpts): Promise<ApiProbeResult> {
  const t0 = performance.now();
  let status: number | null = null;
  let body: unknown = null;
  let ok = false;
  let warn = false;
  try {
    const result = await opts.run();
    status = result.status;
    body = result.body;
    ok = result.ok;
    warn = result.warn ?? false;
  } catch (e) {
    ok = false;
    body = e instanceof Error ? e.message : String(e);
  }
  const latency_ms = Math.round(performance.now() - t0);
  const threshold = opts.scope === "internal" ? WARN_MS_INTERNAL : WARN_MS_EXTERNAL;
  if (ok && latency_ms >= threshold) warn = true;
  return {
    id: opts.id,
    name: opts.name,
    flow: opts.flow,
    direction: opts.direction,
    scope: opts.scope,
    vendor: opts.vendor,
    method: opts.method,
    endpoint: opts.endpoint,
    status,
    ok,
    warn,
    latency_ms,
    request_summary: opts.request_summary,
    response_summary: summarizeBody(body, status ?? 0),
  };
}

function sbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = anonKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function buildSummary(probes: ApiProbeResult[]): ApiMonitoringSummary {
  const avg = (items: ApiProbeResult[]) =>
    items.length ? Math.round(items.reduce((n, p) => n + p.latency_ms, 0) / items.length) : 0;

  const internal = probes.filter((p) => p.scope === "internal");
  const external = probes.filter((p) => p.scope === "external");
  const incoming = probes.filter((p) => p.direction === "incoming");
  const outgoing = probes.filter((p) => p.direction === "outgoing");

  const by_vendor: ApiMonitoringSummary["by_vendor"] = {};
  for (const p of probes) {
    if (!by_vendor[p.vendor]) by_vendor[p.vendor] = { count: 0, avg_ms: 0, failed: 0, warned: 0 };
    by_vendor[p.vendor].count += 1;
    if (!p.ok) by_vendor[p.vendor].failed += 1;
    if (p.warn) by_vendor[p.vendor].warned += 1;
  }
  for (const v of Object.keys(by_vendor)) {
    const items = probes.filter((p) => p.vendor === v);
    by_vendor[v].avg_ms = avg(items);
  }

  return {
    total_probes: probes.length,
    passed: probes.filter((p) => p.ok && !p.warn).length,
    failed: probes.filter((p) => !p.ok).length,
    warned: probes.filter((p) => p.ok && p.warn).length,
    avg_latency_ms: avg(probes),
    internal_avg_ms: avg(internal),
    external_avg_ms: avg(external),
    incoming_avg_ms: avg(incoming),
    outgoing_avg_ms: avg(outgoing),
    by_vendor,
  };
}

function buildFlow(
  id: string,
  name: string,
  description: string,
  steps: ApiProbeResult[],
): FlowTransaction {
  const total_ms = steps.reduce((n, s) => n + s.latency_ms, 0);
  return {
    id,
    name,
    description,
    steps,
    total_ms,
    avg_step_ms: steps.length ? Math.round(total_ms / steps.length) : 0,
    ok: steps.every((s) => s.ok),
  };
}

async function runSequentialFlow(
  flowId: string,
  flowName: string,
  description: string,
  runners: Array<() => Promise<ApiProbeResult>>,
): Promise<FlowTransaction> {
  const steps: ApiProbeResult[] = [];
  for (const run of runners) {
    const step = await run();
    steps.push({ ...step, flow: flowId });
  }
  return buildFlow(flowId, flowName, description, steps);
}

export async function runApiMonitoring(_sb: SupabaseClient): Promise<ApiMonitoringResult> {
  const base = appUrl();
  const url = sbUrl();
  const key = anonKey();
  const fn = `${url}/functions/v1`;

  const standalone: ProbeOpts[] = [
    {
      id: "ext-vercel-home",
      name: "Production SPA (Vercel)",
      direction: "incoming",
      scope: "external",
      vendor: "vercel",
      method: "GET",
      endpoint: base,
      request_summary: "GET / (customer homepage)",
      run: async () => {
        const r = await fetch(base);
        const text = await r.text();
        return { ok: r.ok && text.includes("ScanV"), status: r.status, body: `bytes=${text.length}` };
      },
    },
    {
      id: "ext-cloudflare-cdn",
      name: "Cloudflare edge (cf-ray)",
      direction: "incoming",
      scope: "external",
      vendor: "cloudflare",
      method: "GET",
      endpoint: base,
      request_summary: "GET / · check CF-Cache-Status / CF-Ray headers",
      run: async () => {
        const r = await fetch(base, { method: "HEAD" });
        const ray = r.headers.get("cf-ray") || r.headers.get("CF-RAY");
        const cache = r.headers.get("cf-cache-status") || r.headers.get("CF-Cache-Status");
        return {
          ok: r.ok,
          status: r.status,
          body: { cf_ray: ray || "none", cache: cache || "unknown" },
          warn: !ray,
        };
      },
    },
    {
      id: "int-supabase-rest",
      name: "Supabase PostgREST",
      direction: "incoming",
      scope: "internal",
      vendor: "supabase",
      method: "GET",
      endpoint: "/rest/v1/service_prices_public",
      request_summary: "GET service_prices_public?limit=3",
      run: async () => {
        const r = await fetch(`${url}/rest/v1/service_prices_public?select=service_id&limit=3`, {
          headers: sbHeaders(),
        });
        const body = await r.json().catch(() => []);
        return { ok: r.ok && Array.isArray(body), status: r.status, body };
      },
    },
    {
      id: "int-supabase-auth",
      name: "Supabase Auth",
      direction: "incoming",
      scope: "internal",
      vendor: "supabase",
      method: "GET",
      endpoint: "/auth/v1/health",
      request_summary: "GET auth health",
      run: async () => {
        const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
        const text = await r.text().catch(() => "");
        return { ok: r.status < 500, status: r.status, body: text || r.statusText };
      },
    },
    {
      id: "int-edge-platform-config",
      name: "platform-config edge fn",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "GET",
      endpoint: "/functions/v1/platform-config",
      request_summary: "GET platform-config (vendor switches)",
      run: async () => {
        const r = await fetch(`${fn}/platform-config`, { headers: sbHeaders() });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok && Boolean((body as { vendors?: unknown }).vendors), status: r.status, body };
      },
    },
    {
      id: "int-edge-send-otp",
      name: "send-otp edge fn",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/send-otp",
      request_summary: "POST { mobile, action: send } (test number)",
      run: async () => {
        const r = await fetch(`${fn}/send-otp`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ mobile: "9999999999", action: "send" }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: Boolean((body as { success?: boolean }).success), status: r.status, body };
      },
    },
    {
      id: "int-edge-razorpay",
      name: "razorpay-payment edge fn",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/razorpay-payment",
      request_summary: "POST register test payment link",
      run: async () => {
        const r = await fetch(`${fn}/razorpay-payment`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ action: "register", txn_id: `TXN-MON-${Date.now()}`, amount_paise: 100 }),
        });
        const body = await r.json().catch(() => ({}));
        const b = body as { url?: string; success?: boolean };
        return { ok: Boolean(b.url || b.success), status: r.status, body, warn: true };
      },
    },
    {
      id: "int-edge-admin-hub",
      name: "admin-hub PIN gate",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/admin-hub",
      request_summary: "POST whoami without PIN (expect 401)",
      run: async () => {
        const r = await fetch(`${fn}/admin-hub`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ action: "whoami" }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.status === 401, status: r.status, body };
      },
    },
    {
      id: "int-edge-health-report",
      name: "health-report cron gate",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/health-report",
      request_summary: "POST without secret (expect 401)",
      run: async () => {
        const r = await fetch(`${fn}/health-report`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ slot: "morning" }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.status === 401, status: r.status, body };
      },
    },
    {
      id: "int-edge-customer-support",
      name: "customer-support PIN gate",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/customer-support",
      request_summary: "POST whoami without PIN (expect 401)",
      run: async () => {
        const r = await fetch(`${fn}/customer-support`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ action: "whoami" }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.status === 401, status: r.status, body };
      },
    },
    {
      id: "int-edge-vendor-onboard",
      name: "vendor-onboard PIN gate",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/vendor-onboard",
      request_summary: "POST whoami without PIN (expect 401)",
      run: async () => {
        const r = await fetch(`${fn}/vendor-onboard`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ action: "whoami" }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.status === 401, status: r.status, body };
      },
    },
    {
      id: "int-edge-booking-dispatch",
      name: "booking-dispatch secret gate",
      direction: "incoming",
      scope: "internal",
      vendor: "scanv",
      method: "POST",
      endpoint: "/functions/v1/booking-dispatch",
      request_summary: "POST tick without dispatch secret (expect 401)",
      run: async () => {
        const r = await fetch(`${fn}/booking-dispatch`, {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ action: "tick" }),
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.status === 401, status: r.status, body };
      },
    },
  ];

  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  if (resendKey) {
    standalone.push({
      id: "ext-resend-domains",
      name: "Resend API (domains)",
      direction: "outgoing",
      scope: "external",
      vendor: "resend",
      method: "GET",
      endpoint: "https://api.resend.com/domains",
      request_summary: "GET /domains (email delivery)",
      run: async () => {
        const r = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${resendKey}` },
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
      },
    });
  }

  const rzKey = Deno.env.get("RAZORPAY_KEY_ID") || "";
  const rzSecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
  if (rzKey && rzSecret) {
    standalone.push({
      id: "ext-razorpay-api",
      name: "Razorpay REST API",
      direction: "outgoing",
      scope: "external",
      vendor: "razorpay",
      method: "GET",
      endpoint: "https://api.razorpay.com/v1/payments",
      request_summary: "GET /v1/payments?count=1",
      run: async () => {
        const auth = btoa(`${rzKey}:${rzSecret}`);
        const r = await fetch("https://api.razorpay.com/v1/payments?count=1", {
          headers: { Authorization: `Basic ${auth}` },
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body };
      },
    });
  }

  const twoFactorKey = Deno.env.get("TWOFACTOR_API_KEY") || "";
  if (twoFactorKey) {
    standalone.push({
      id: "ext-2factor-balance",
      name: "2Factor.in balance",
      direction: "outgoing",
      scope: "external",
      vendor: "twofactor",
      method: "GET",
      endpoint: "https://2factor.in/API/V1/…/BALANCE",
      request_summary: "GET SMS balance (OTP vendor)",
      run: async () => {
        const r = await fetch(`https://2factor.in/API/V1/${twoFactorKey}/BALANCE/SMS`);
        const text = await r.text().catch(() => "");
        let body: unknown = text;
        try { body = JSON.parse(text); } catch { /* text */ }
        const ok = r.ok || /success/i.test(text);
        return { ok, status: r.status, body };
      },
    });
  }

  const msg91Key = Deno.env.get("MSG91_AUTH_KEY") || "";
  if (msg91Key) {
    standalone.push({
      id: "ext-msg91-balance",
      name: "MSG91 balance",
      direction: "outgoing",
      scope: "external",
      vendor: "msg91",
      method: "GET",
      endpoint: "https://control.msg91.com/api/balance.php",
      request_summary: "GET SMS balance",
      run: async () => {
        const r = await fetch(`https://control.msg91.com/api/balance.php?authkey=${encodeURIComponent(msg91Key)}&type=4`);
        const text = await r.text().catch(() => "");
        return { ok: r.ok && !/invalid/i.test(text), status: r.status, body: text.slice(0, 80) };
      },
    });
  }

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  if (twilioSid && twilioToken) {
    standalone.push({
      id: "ext-twilio-account",
      name: "Twilio account",
      direction: "outgoing",
      scope: "external",
      vendor: "twilio",
      method: "GET",
      endpoint: `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`,
      request_summary: "GET account status (SMS/voice fallback)",
      run: async () => {
        const auth = btoa(`${twilioSid}:${twilioToken}`);
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        const body = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, body: (body as { status?: string }).status || body };
      },
    });
  }

  const probeResults = await Promise.all(standalone.map((p) => timedProbe(p)));

  const flowBrowse = await runSequentialFlow(
    "flow-browse",
    "Customer browse",
    "Homepage → platform config → public pricing",
    [
      () => timedProbe({
        id: "flow-browse-home",
        name: "Load homepage",
        flow: "flow-browse",
        direction: "incoming",
        scope: "external",
        vendor: "vercel",
        method: "GET",
        endpoint: base,
        request_summary: "GET /",
        run: async () => {
          const r = await fetch(base);
          const text = await r.text();
          return { ok: r.ok, status: r.status, body: `html ${text.length}b` };
        },
      }),
      () => timedProbe({
        id: "flow-browse-config",
        name: "Platform config",
        flow: "flow-browse",
        direction: "incoming",
        scope: "internal",
        vendor: "scanv",
        method: "GET",
        endpoint: "/functions/v1/platform-config",
        request_summary: "GET platform-config",
        run: async () => {
          const r = await fetch(`${fn}/platform-config`, { headers: sbHeaders() });
          const body = await r.json().catch(() => ({}));
          return { ok: r.ok, status: r.status, body };
        },
      }),
      () => timedProbe({
        id: "flow-browse-pricing",
        name: "Public pricing",
        flow: "flow-browse",
        direction: "incoming",
        scope: "internal",
        vendor: "supabase",
        method: "GET",
        endpoint: "/rest/v1/service_prices_public",
        request_summary: "GET service_prices_public",
        run: async () => {
          const r = await fetch(`${url}/rest/v1/service_prices_public?select=service_id&limit=5`, {
            headers: sbHeaders(),
          });
          const body = await r.json().catch(() => []);
          return { ok: r.ok, status: r.status, body };
        },
      }),
    ],
  );

  const flowOtp = await runSequentialFlow(
    "flow-otp",
    "OTP delivery",
    "send-otp edge fn → outbound SMS vendor (2Factor/MSG91/Twilio)",
    [
      () => timedProbe({
        id: "flow-otp-send",
        name: "Send OTP request",
        flow: "flow-otp",
        direction: "incoming",
        scope: "internal",
        vendor: "scanv",
        method: "POST",
        endpoint: "/functions/v1/send-otp",
        request_summary: "POST send-otp",
        run: async () => {
          const r = await fetch(`${fn}/send-otp`, {
            method: "POST",
            headers: sbHeaders(),
            body: JSON.stringify({ mobile: "9999999999", action: "send" }),
          });
          const body = await r.json().catch(() => ({}));
          return { ok: Boolean((body as { success?: boolean }).success), status: r.status, body };
        },
      }),
    ],
  );

  const flowPayment = await runSequentialFlow(
    "flow-payment",
    "Payment register",
    "Razorpay payment link creation via edge fn",
    [
      () => timedProbe({
        id: "flow-pay-register",
        name: "Register payment link",
        flow: "flow-payment",
        direction: "incoming",
        scope: "internal",
        vendor: "scanv",
        method: "POST",
        endpoint: "/functions/v1/razorpay-payment",
        request_summary: "POST register TXN-MON-*",
        run: async () => {
          const r = await fetch(`${fn}/razorpay-payment`, {
            method: "POST",
            headers: sbHeaders(),
            body: JSON.stringify({ action: "register", txn_id: `TXN-FLOW-${Date.now()}`, amount_paise: 100 }),
          });
          const body = await r.json().catch(() => ({}));
          const b = body as { url?: string };
          return { ok: Boolean(b.url), status: r.status, body, warn: true };
        },
      }),
    ],
  );

  const flowAdmin = await runSequentialFlow(
    "flow-admin",
    "Admin security gates",
    "Protected endpoints reject unauthenticated calls",
    [
      () => timedProbe({
        id: "flow-admin-hub",
        name: "admin-hub unauthorized",
        flow: "flow-admin",
        direction: "incoming",
        scope: "internal",
        vendor: "scanv",
        method: "POST",
        endpoint: "/functions/v1/admin-hub",
        request_summary: "POST whoami no PIN",
        run: async () => {
          const r = await fetch(`${fn}/admin-hub`, {
            method: "POST",
            headers: sbHeaders(),
            body: JSON.stringify({ action: "whoami" }),
          });
          const body = await r.json().catch(() => ({}));
          return { ok: r.status === 401, status: r.status, body };
        },
      }),
      () => timedProbe({
        id: "flow-health-report",
        name: "health-report unauthorized",
        flow: "flow-admin",
        direction: "incoming",
        scope: "internal",
        vendor: "scanv",
        method: "POST",
        endpoint: "/functions/v1/health-report",
        request_summary: "POST no secret",
        run: async () => {
          const r = await fetch(`${fn}/health-report`, {
            method: "POST",
            headers: sbHeaders(),
            body: JSON.stringify({ slot: "morning" }),
          });
          const body = await r.json().catch(() => ({}));
          return { ok: r.status === 401, status: r.status, body };
        },
      }),
    ],
  );

  const flows = [flowBrowse, flowOtp, flowPayment, flowAdmin];
  const flowProbeIds = new Set(flows.flatMap((f) => f.steps.map((s) => s.id)));
  const probes = [
    ...probeResults.filter((p) => !flowProbeIds.has(p.id)),
    ...flows.flatMap((f) => f.steps),
  ];

  return {
    generated_at: new Date().toISOString(),
    app_url: base,
    probes,
    flows,
    summary: buildSummary(probes),
  };
}
