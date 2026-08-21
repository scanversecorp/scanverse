/** Pre-launch cloud / SGR test row cleanup (bookings, intents, student_cloud). */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Aug 22 2026 00:00 IST */
export const CLOUD_LAUNCH_CUTOFF = "2026-08-21T18:30:00.000Z";
export const CLEAN_CLOUD_CONFIRM = "CLEAN_CLOUD_TEST_DATA";

function cloudServiceFilter(q: ReturnType<SupabaseClient["from"]>) {
  return q.or("service_id.like.cl-%,service_id.eq.cloud");
}

function cloudCourseFilter(q: ReturnType<SupabaseClient["from"]>) {
  return q.or("course_id.like.cl-%,course_id.eq.cloud");
}

async function listCloudBookings(sb: SupabaseClient, cutoff: string) {
  const { data, error } = await cloudServiceFilter(
    sb.from("bookings").select("id, txn_id, service_id, status, customer_id, created_at"),
  ).lt("created_at", cutoff);
  if (error) throw new Error(`bookings: ${error.message}`);
  return data || [];
}

async function listCloudIntents(sb: SupabaseClient, cutoff: string) {
  const { data, error } = await cloudServiceFilter(
    sb.from("payment_intents").select("txn_id, service_id, status, amount_paise, user_id, created_at"),
  ).lt("created_at", cutoff);
  if (error) throw new Error(`payment_intents: ${error.message}`);
  return data || [];
}

async function listStudentCloud(sb: SupabaseClient, cutoff: string) {
  const { data, error } = await cloudCourseFilter(
    sb.from("student_cloud").select("id, mobile_e164, course_id, status, created_at"),
  ).lt("created_at", cutoff);
  if (error) throw new Error(`student_cloud: ${error.message}`);
  return data || [];
}

async function listServiceRequests(sb: SupabaseClient, txnIds: string[]) {
  if (!txnIds.length) return [];
  const { data, error } = await sb
    .from("service_requests")
    .select("id, txn_id, service_name, status")
    .in("txn_id", txnIds);
  if (error) throw new Error(`service_requests: ${error.message}`);
  return data || [];
}

export async function previewCloudTestCleanup(
  sb: SupabaseClient,
  cutoff = CLOUD_LAUNCH_CUTOFF,
) {
  const bookings = await listCloudBookings(sb, cutoff);
  const intents = await listCloudIntents(sb, cutoff);
  const students = await listStudentCloud(sb, cutoff);
  const bookingIds = bookings.map((b) => b.id);
  const txnIds = [
    ...new Set([
      ...bookings.map((b) => b.txn_id).filter(Boolean) as string[],
      ...intents.map((i) => i.txn_id),
    ]),
  ];
  const serviceRequests = await listServiceRequests(sb, txnIds);

  let dispatch = 0;
  let dispatchAttempts = 0;
  if (bookingIds.length) {
    const { data: dispRows } = await sb
      .from("booking_dispatch")
      .select("id")
      .in("booking_id", bookingIds);
    const dispatchIds = (dispRows || []).map((d) => d.id);
    dispatch = dispatchIds.length;
    if (dispatchIds.length) {
      const { count: d2 } = await sb
        .from("booking_dispatch_attempts")
        .select("*", { count: "exact", head: true })
        .in("dispatch_id", dispatchIds);
      dispatchAttempts = d2 ?? 0;
    }
  }

  let payments = 0;
  if (txnIds.length) {
    const { count } = await sb
      .from("payments")
      .select("*", { count: "exact", head: true })
      .in("txn_id", txnIds);
    payments = count ?? 0;
  }

  return {
    cutoff,
    counts: {
      bookings: bookings.length,
      payment_intents: intents.length,
      service_requests: serviceRequests.length,
      student_cloud: students.length,
      payments,
      booking_dispatch: dispatch,
      booking_dispatch_attempts: dispatchAttempts,
    },
    bookings,
    payment_intents: intents,
    service_requests: serviceRequests,
    student_cloud: students,
  };
}

export async function cleanCloudTestDataAdmin(
  sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const cutoff = String(body.cutoff_at || CLOUD_LAUNCH_CUTOFF);
  const dryRun = body.dry_run !== false && body.confirm_execute !== true;
  const confirm = String(body.confirm || "").trim();

  const preview = await previewCloudTestCleanup(sb, cutoff);
  if (dryRun) {
    return {
      dry_run: true,
      ...preview,
      message: `Dry run — pre-cutoff cloud test rows before ${cutoff}. Pass confirm_execute: true and confirm: "${CLEAN_CLOUD_CONFIRM}" to delete.`,
    };
  }

  if (confirm !== CLEAN_CLOUD_CONFIRM) {
    return {
      error: `Set confirm_execute: true and confirm: "${CLEAN_CLOUD_CONFIRM}" to run live cleanup`,
      preview,
    };
  }

  const bookingIds = preview.bookings.map((b) => b.id);
  const txnIds = [
    ...new Set([
      ...preview.bookings.map((b) => b.txn_id).filter(Boolean) as string[],
      ...preview.payment_intents.map((i) => i.txn_id),
    ]),
  ];
  const studentIds = preview.student_cloud.map((s) => s.id);
  const deleted: Record<string, number> = {};

  if (bookingIds.length) {
    const { data: dispRows } = await sb
      .from("booking_dispatch")
      .select("id")
      .in("booking_id", bookingIds);
    const dispatchIds = (dispRows || []).map((d) => d.id);
    if (dispatchIds.length) {
      const { data: d1 } = await sb
        .from("booking_dispatch_attempts")
        .delete()
        .in("dispatch_id", dispatchIds)
        .select("id");
      deleted.booking_dispatch_attempts = d1?.length ?? 0;
    } else {
      deleted.booking_dispatch_attempts = 0;
    }
    const { data: d2 } = await sb.from("booking_dispatch").delete().in("booking_id", bookingIds).select("id");
    deleted.booking_dispatch = d2?.length ?? 0;
    const { data: d3 } = await sb.from("booking_cancellations").delete().in("booking_id", bookingIds).select("id");
    deleted.booking_cancellations = d3?.length ?? 0;
  }

  if (txnIds.length) {
    const { data: p1 } = await sb.from("payments").delete().in("txn_id", txnIds).select("id");
    deleted.payments = p1?.length ?? 0;
    const { data: sr } = await sb.from("service_requests").delete().in("txn_id", txnIds).select("id");
    deleted.service_requests = sr?.length ?? 0;
  }

  if (bookingIds.length) {
    const { data: bk } = await sb.from("bookings").delete().in("id", bookingIds).select("id");
    deleted.bookings = bk?.length ?? 0;
  }

  if (txnIds.length) {
    const { data: pi } = await sb.from("payment_intents").delete().in("txn_id", txnIds).select("txn_id");
    deleted.payment_intents = pi?.length ?? 0;
  }

  if (studentIds.length) {
    const { data: scp } = await sb.from("student_cloud_payments").delete().in("student_id", studentIds).select("id");
    deleted.student_cloud_payments = scp?.length ?? 0;
    const { data: sc } = await sb.from("student_cloud").delete().in("id", studentIds).select("id");
    deleted.student_cloud = sc?.length ?? 0;
  }

  return {
    success: true,
    dry_run: false,
    cutoff,
    deleted,
    preview_counts: preview.counts,
    message: "Pre-launch cloud test data removed. Post-cutoff rows untouched.",
  };
}
