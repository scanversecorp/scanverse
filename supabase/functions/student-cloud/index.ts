/**
 * ScanV Student Cloud — AI / Cloud / Data Center admissions
 *
 * Public (OTP required):
 *   submit   — create/update admission after OTP
 *   confirm_sgr — mark ₹500 Skill Gap Review paid after Razorpay
 *   fee_view — course fee visibility for a student (by student_id)
 *
 * Admin PIN:
 *   list, update, record_payment, remind
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendSms, normalizeMobile } from "../_shared/notify.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

const SGR_SERVICE_ID = "cl-sgr";
const SGR_FEE_FALLBACK_PAISE = 50000;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SB_PUBLISHABLE_KEY") || "";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminSb() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function fmtRsPaise(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getSgrFeePaise(sb: ReturnType<typeof adminSb>): Promise<number> {
  const { data } = await sb
    .from("service_pricing")
    .select("new_amount_paise")
    .eq("service_id", SGR_SERVICE_ID)
    .maybeSingle();
  const p = Number(data?.new_amount_paise);
  return p >= 100 ? p : SGR_FEE_FALLBACK_PAISE;
}

function adminPinOk(req: Request): boolean {
  const pin = req.headers.get("x-admin-pin") || "";
  if (!pin || pin.length < 6) return false;
  for (const k of ["ADMIN_HUB_PIN", "SUPPORT_ADMIN_PIN", "PRICING_ADMIN_PIN", "VENDOR_ADMIN_PIN", "STUDENT_CLOUD_PIN"]) {
    const secret = Deno.env.get(k) || "";
    if (secret.length >= 6 && pin === secret) return true;
  }
  return false;
}

function digits10(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

function parseIsoDate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function ageFromDob(dobStr: string): number | null {
  const dt = parseIsoDate(dobStr);
  if (!dt) return null;
  const today = new Date();
  let age = today.getFullYear() - dt.getFullYear();
  const md = today.getMonth() - dt.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < dt.getDate())) age -= 1;
  return age >= 5 && age <= 120 ? age : null;
}

function validateScheduleInput(dateStr: string, timeStr: string): string | null {
  const dt = parseIsoDate(dateStr);
  if (!dt) return "Enter a valid schedule date — check day and month";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + 1);
  if (dt < today) return "Schedule date cannot be in the past";
  if (dt > max) return "Schedule date must be within the next 12 months";
  const tm = /^(\d{2}):(\d{2})$/.exec(String(timeStr || "").trim());
  if (!tm) return "Pick a valid schedule time";
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "Pick a valid schedule time";
  if (dt.getTime() === today.getTime()) {
    const slot = new Date(dt);
    slot.setHours(hh, mm, 0, 0);
    if (slot <= new Date()) return "Schedule time must be later today";
  }
  return null;
}

function isSgrPaid(row: Record<string, unknown>): boolean {
  const fee = Number(row.sgr_fee_paise || 0) >= 100 ? Number(row.sgr_fee_paise) : SGR_FEE_FALLBACK_PAISE;
  if (Number(row.sgr_paid_paise || 0) >= fee) return true;
  if (row.sgr_paid_at) return true;
  return ["sgr_paid", "enrolled", "fee_due", "completed"].includes(String(row.status || ""));
}

function pendingOf(row: Record<string, unknown>, catalogCourseFee?: number | null): number {
  const fee = Number(row.sgr_fee_paise || 0) >= 100 ? Number(row.sgr_fee_paise) : SGR_FEE_FALLBACK_PAISE;
  const sgrDue = isSgrPaid(row) ? 0 : Math.max(0, fee - Number(row.sgr_paid_paise || 0));
  const storedCourse = Number(row.course_fee_paise || 0);
  const courseFee = storedCourse > 0 ? storedCourse : (catalogCourseFee ?? 0);
  const courseDue = Math.max(
    0,
    courseFee - Number(row.discount_paise || 0) - Number(row.course_paid_paise || 0),
  );
  return sgrDue + courseDue;
}

function withPending(row: Record<string, unknown>, catalogCourseFee?: number | null) {
  const pending_paise = pendingOf(row, catalogCourseFee);
  const storedCourse = Number(row.course_fee_paise || 0);
  const catalog = catalogCourseFee ?? null;
  const effective_course_fee_paise = storedCourse > 0 ? storedCourse : (catalog ?? 0);
  return { ...row, pending_paise, pending_rs: pending_paise / 100, catalog_course_fee_paise: catalog, effective_course_fee_paise };
}

async function catalogCourseFeesById(sb: ReturnType<typeof adminSb>, courseIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(courseIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await sb.from("service_prices_public").select("service_id, price_paise").in("service_id", ids);
  const out: Record<string, number> = {};
  for (const row of data || []) {
    const p = Number(row.price_paise);
    if (p > 0) out[String(row.service_id)] = p;
  }
  return out;
}

async function verifyOtp(mobile: string, otp: string): Promise<boolean> {
  const code = String(otp || "").replace(/\D/g, "");
  if (code.length < 4) return false;
  const key = ANON_KEY || SERVICE_KEY;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mobile, otp: code, action: "verify" }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.success === true;
}

async function paymentCaptured(sb: ReturnType<typeof adminSb>, txnId: string, minPaise: number) {
  if (!txnId) return false;
  const { data } = await sb.from("payment_intents").select("status, amount_paise, verified_via").eq("txn_id", txnId).maybeSingle();
  if (!data) return false;
  const st = String(data.status || "").toLowerCase();
  if (st !== "paid") return false;
  const via = String(data.verified_via || "").toLowerCase();
  if (!["webhook", "api", "vyapar_webhook"].includes(via)) return false;
  return Number(data.amount_paise || 0) >= minPaise;
}

function sgrAlertMobile(): string {
  return (
    Deno.env.get("STUDENT_CLOUD_ALERT_MOBILE") ||
    Deno.env.get("ADMIN_OWNER_MOBILE") ||
    Deno.env.get("REFUND_APPROVAL_MOBILE") ||
    "8484850288"
  );
}

async function notifyOwnerSgrPaid(student: Record<string, unknown>, feePaise: number): Promise<void> {
  const to = normalizeMobile(sgrAlertMobile());
  if (!to) return;
  const name = `${String(student.first_name || "").trim()} ${String(student.last_name || "").trim()}`.trim() || "Student";
  const course = String(student.course_name || student.course_id || "Cloud course");
  const mobile = digits10(String(student.mobile || ""));
  const rs = fmtRsPaise(feePaise);
  const when = [student.schedule_date, student.schedule_time].filter(Boolean).join(" ");
  const msg = `ScanV SGR paid: ${name} · ${course} · ₹${rs} · +91${mobile}${when ? ` · ${when}` : ""}`;
  try {
    await sendSms(to, msg);
  } catch {
    /* non-blocking */
  }
}

async function voiceCallRupees(mobile: string, rupees: number): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("TWOFACTOR_API_KEY") || "";
  const d10 = digits10(mobile);
  if (!key || d10.length !== 10) return { ok: false, error: "Voice not configured" };
  const spoken = String(Math.max(0, Math.min(999999, Math.round(rupees)))).padStart(4, "0");
  const url = `https://2factor.in/API/V1/${key}/VOICE/${d10}/${spoken}`;
  const res = await fetch(url).catch(() => null);
  const text = await res?.text().catch(() => "") || "";
  if (res?.ok && /success/i.test(text)) return { ok: true };
  return { ok: false, error: text.slice(0, 120) || "Voice call failed" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "");
  const sb = adminSb();

  try {
    if (action === "submit") {
      const mobile = normalizeMobile(String(body.mobile || "")) || "";
      const otp = String(body.otp || "");
      if (!mobile) return json({ error: "Valid mobile required" }, 400);
      const ok = await verifyOtp(mobile, otp);
      if (!ok) return json({ error: "Verify mobile OTP first" }, 401);

      const firstName = String(body.first_name || "").trim();
      const lastName = String(body.last_name || "").trim();
      const experience = String(body.experience || "").trim();
      const dob = String(body.dob || "").trim() || null;
      const address = String(body.address || "").trim();
      const village = String(body.village || "").trim();
      const city = String(body.city || "").trim();
      const state = String(body.state || "").trim();
      const pincode = String(body.pincode || "").replace(/\D/g, "").slice(0, 6);
      if (!firstName) return json({ error: "First name required" }, 400);
      if (!lastName) return json({ error: "Last name required" }, 400);
      if (!experience) return json({ error: "Experience required" }, 400);
      if (!dob) return json({ error: "Date of birth required" }, 400);
      if (!parseIsoDate(dob) || ageFromDob(dob) == null) {
        return json({ error: "Enter a valid date of birth (age 5–120)" }, 400);
      }
      if (!address) return json({ error: "Address required" }, 400);
      if (!city) return json({ error: "City required" }, 400);
      if (!state) return json({ error: "State required" }, 400);
      const scheduleDate = String(body.schedule_date || "").trim();
      const scheduleTime = String(body.schedule_time || "").trim();
      if (!scheduleDate || !scheduleTime) return json({ error: "Schedule date and time required" }, 400);
      const scheduleErr = validateScheduleInput(scheduleDate, scheduleTime);
      if (scheduleErr) return json({ error: scheduleErr }, 400);

      const sgrFeePaise = await getSgrFeePaise(sb);

      const row = {
        mobile: digits10(mobile),
        mobile_e164: mobile,
        mobile_verified: true,
        first_name: firstName,
        last_name: lastName,
        experience,
        dob,
        address,
        village,
        city,
        state,
        pincode,
        lat: body.lat != null ? Number(body.lat) : null,
        lng: body.lng != null ? Number(body.lng) : null,
        course_id: String(body.course_id || "").trim() || null,
        course_name: String(body.course_name || "").trim() || null,
        schedule_date: scheduleDate,
        schedule_time: scheduleTime,
        sgr_fee_paise: sgrFeePaise,
        consultant_due_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      };

      const { data: existing } = await sb
        .from("student_cloud")
        .select("*")
        .eq("mobile_e164", mobile)
        .maybeSingle();

      let student;
      if (existing?.id) {
        const { data, error } = await sb.from("student_cloud").update(row).eq("id", existing.id).select("*").single();
        if (error) throw error;
        student = data;
      } else {
        const { data, error } = await sb.from("student_cloud").insert(row).select("*").single();
        if (error) throw error;
        student = data;
      }

      return json({ success: true, student: withPending(student), sgr_fee_paise: sgrFeePaise });
    }

    if (action === "confirm_sgr") {
      const studentId = String(body.student_id || "");
      const txnId = String(body.txn_id || "");
      if (!studentId || !txnId) return json({ error: "student_id and txn_id required" }, 400);
      const { data: student, error: se } = await sb.from("student_cloud").select("*").eq("id", studentId).maybeSingle();
      if (se || !student) return json({ error: "Student not found" }, 404);

      const expectedFee = Number(student.sgr_fee_paise) >= 100
        ? Number(student.sgr_fee_paise)
        : await getSgrFeePaise(sb);
      const paid = await paymentCaptured(sb, txnId, expectedFee);
      if (!paid) {
        return json({ error: `Razorpay payment of ₹${fmtRsPaise(expectedFee)} not confirmed yet` }, 400);
      }

      if (Number(student.sgr_paid_paise || 0) >= expectedFee) {
        return json({
          success: true,
          student: withPending(student),
          message: "Skill Gap Review (SGR) form submitted. One of our consultant will call you in next 72 hours",
        });
      }

      const { error: pe } = await sb.from("student_cloud_payments").insert({
        student_id: studentId,
        kind: "sgr",
        amount_paise: expectedFee,
        txn_id: txnId,
        status: "captured",
        note: "Skill Gap Review (SGR)",
        created_by: "student",
      });
      if (pe && !/duplicate/i.test(pe.message || "")) throw pe;

      const nextStatus = student.sgr_paid_paise >= expectedFee ? student.status : "sgr_paid";
      const { data: updated, error } = await sb.from("student_cloud").update({
        sgr_paid_paise: expectedFee,
        sgr_txn_id: txnId,
        sgr_paid_at: new Date().toISOString(),
        status: student.status === "sgr_pending" ? "sgr_paid" : nextStatus,
      }).eq("id", studentId).select("*").single();
      if (error) throw error;

      await notifyOwnerSgrPaid(updated as Record<string, unknown>, expectedFee);

      return json({
        success: true,
        student: withPending(updated),
        message: "Skill Gap Review (SGR) form submitted. One of our consultant will call you in next 72 hours",
      });
    }

    if (action === "fee_view") {
      const studentId = String(body.student_id || "").trim();
      const mobileRaw = String(body.mobile || body.mobile_e164 || "").trim();
      if (!studentId && !mobileRaw) return json({ error: "student_id or mobile required" }, 400);

      const selectCols =
        "id, course_id, course_name, sgr_fee_paise, sgr_paid_paise, course_fee_paise, discount_paise, status";
      let student: Record<string, unknown> | null = null;

      if (studentId) {
        const { data, error: se } = await sb.from("student_cloud").select(selectCols).eq("id", studentId).maybeSingle();
        if (se) throw se;
        student = data as Record<string, unknown> | null;
      } else {
        const d10 = digits10(mobileRaw);
        const e164 = normalizeMobile(mobileRaw) || (d10.length === 10 ? `+91${d10}` : null);
        if (e164) {
          const { data, error: se } = await sb.from("student_cloud").select(selectCols).eq("mobile_e164", e164).maybeSingle();
          if (se) throw se;
          student = data as Record<string, unknown> | null;
        }
        if (!student && d10.length === 10) {
          const { data, error: se } = await sb.from("student_cloud").select(selectCols).eq("mobile", d10).maybeSingle();
          if (se) throw se;
          student = data as Record<string, unknown> | null;
        }
      }

      if (!student) {
        return json({ sgr_paid: false, course_id: null, course_fee_paise: null, course_name: null, status: null, student_id: null });
      }
      const sgrPaid = isSgrPaid(student);
      const catalogFees = await catalogCourseFeesById(sb, [String(student.course_id || "")]);
      const catalogCourse = catalogFees[String(student.course_id || "")] ?? null;
      const storedCourse = Number(student.course_fee_paise || 0);
      const effectiveCourse = storedCourse > 0 ? storedCourse : (catalogCourse ?? 0);
      const netCourse = Math.max(0, effectiveCourse - Number(student.discount_paise || 0));
      return json({
        student_id: student.id || null,
        sgr_paid: sgrPaid,
        course_id: student.course_id || null,
        course_name: student.course_name || null,
        course_fee_paise: sgrPaid && netCourse > 0 ? netCourse : null,
        status: student.status || null,
      });
    }

    if (!adminPinOk(req)) return json({ error: "Admin PIN required" }, 401);

    if (action === "list") {
      const q = String(body.q || "").trim().toLowerCase();
      const { data, error } = await sb.from("student_cloud").select("*, student_cloud_payments(*)").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const raw = (data || []) as Record<string, unknown>[];
      const catalogFees = await catalogCourseFeesById(sb, raw.map((r) => String(r.course_id || "")));
      let rows = raw.map((r) => withPending(r, catalogFees[String(r.course_id || "")] ?? null));
      if (q) {
        rows = rows.filter((r) => {
          const hay = [r.first_name, r.last_name, r.mobile, r.course_name, r.city, r.status].join(" ").toLowerCase();
          return hay.includes(q);
        });
      }
      return json({ success: true, students: rows });
    }

    if (action === "update") {
      const id = String(body.student_id || "");
      if (!id) return json({ error: "student_id required" }, 400);
      const patch: Record<string, unknown> = {};
      for (const k of ["course_id", "course_name", "course_fee_paise", "discount_paise", "status", "notes", "schedule_date", "schedule_time"]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      if (patch.course_id && patch.course_fee_paise == null) {
        const catalogFees = await catalogCourseFeesById(sb, [String(patch.course_id)]);
        const catalogFee = catalogFees[String(patch.course_id)] ?? null;
        if (catalogFee != null) patch.course_fee_paise = catalogFee;
      }
      if (patch.course_fee_paise != null) patch.course_fee_paise = Math.max(0, Math.round(Number(patch.course_fee_paise) || 0));
      if (patch.discount_paise != null) patch.discount_paise = Math.max(0, Math.round(Number(patch.discount_paise) || 0));
      const { data, error } = await sb.from("student_cloud").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      const catalogFees = await catalogCourseFeesById(sb, [String(data.course_id || "")]);
      return json({ success: true, student: withPending(data, catalogFees[String(data.course_id || "")] ?? null) });
    }

    if (action === "record_payment") {
      const id = String(body.student_id || "");
      const kind = String(body.kind || "course") === "sgr" ? "sgr" : "course";
      const amount = Math.round(Number(body.amount_paise || 0));
      if (!id || amount <= 0) return json({ error: "student_id and amount_paise required" }, 400);
      const { data: student, error: se } = await sb.from("student_cloud").select("*").eq("id", id).maybeSingle();
      if (se || !student) return json({ error: "Student not found" }, 404);

      await sb.from("student_cloud_payments").insert({
        student_id: id,
        kind,
        amount_paise: amount,
        txn_id: String(body.txn_id || "") || null,
        status: "captured",
        note: String(body.note || "Partial payment") || "Partial payment",
        created_by: "admin",
      });

      const patch: Record<string, unknown> = {};
      if (kind === "sgr") {
        patch.sgr_paid_paise = Number(student.sgr_paid_paise || 0) + amount;
        if (Number(patch.sgr_paid_paise) >= Number(student.sgr_fee_paise || SGR_FEE_FALLBACK_PAISE) && student.status === "sgr_pending") {
          patch.status = "sgr_paid";
          patch.sgr_paid_at = new Date().toISOString();
        }
      } else {
        patch.course_paid_paise = Number(student.course_paid_paise || 0) + amount;
        const due = pendingOf({ ...student, ...patch });
        if (due <= 0) patch.status = "enrolled";
        else if (student.status === "sgr_paid") patch.status = "fee_due";
      }
      const { data, error } = await sb.from("student_cloud").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ success: true, student: withPending(data) });
    }

    if (action === "remind") {
      const id = String(body.student_id || "");
      const channel = String(body.channel || "sms") === "call" ? "call" : "sms";
      if (!id) return json({ error: "student_id required" }, 400);
      const { data: student, error: se } = await sb.from("student_cloud").select("*").eq("id", id).maybeSingle();
      if (se || !student) return json({ error: "Student not found" }, 404);
      const pending = pendingOf(student);
      if (pending <= 0) return json({ error: "No pending payment" }, 400);
      const rs = (pending / 100).toLocaleString("en-IN");
      const name = student.first_name || "Student";
      const course = student.course_name || "your Cloud course";
      const msg = `ScanV: Hi ${name}, ₹${rs} is pending for ${course} (SGR + course). Pay to continue. Call 9270194842.`;

      let ok = false;
      let err: string | undefined;
      if (channel === "sms") {
        const sms = await sendSms(student.mobile_e164 || student.mobile, msg);
        ok = !!sms.ok;
        err = sms.error;
      } else {
        const voice = await voiceCallRupees(student.mobile_e164 || student.mobile, pending / 100);
        ok = voice.ok;
        err = voice.error;
        if (!ok) {
          const sms = await sendSms(student.mobile_e164 || student.mobile, msg);
          ok = !!sms.ok;
          err = err || sms.error;
        }
      }

      await sb.from("student_cloud_reminders").insert({
        student_id: id,
        channel,
        message: msg,
        ok,
        error: err || null,
        pending_paise: pending,
      });
      await sb.from("student_cloud").update({
        last_reminder_at: new Date().toISOString(),
        last_reminder_channel: channel,
      }).eq("id", id);

      if (!ok) return json({ error: err || "Reminder failed" }, 502);
      return json({ success: true, channel, pending_paise: pending, tel: `tel:+91${digits10(student.mobile)}` });
    }

    return json({ error: `Unknown action ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return json({ error: msg }, 500);
  }
});
