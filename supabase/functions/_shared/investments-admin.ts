import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function escIlike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

export async function listInvestmentRequests(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const status = String(body.status || "open").toLowerCase();
  const q = String(body.q || "").trim();
  const limit = Math.min(Number(body.limit) || 50, 100);

  let query = sb
    .from("investment_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "open") {
    query = query.in("status", ["new", "in_progress"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    const like = `%${escIlike(q)}%`;
    query = query.or(
      `request_number.ilike.${like},customer_name.ilike.${like},customer_mobile.ilike.${like},investment_type.ilike.${like},customer_email.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function respondInvestmentRequest(
  sb: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  actor: string,
) {
  const id = String(body.id || body.request_id || "").trim();
  const response = String(body.agent_response || body.response || "").trim();
  const newStatus = String(body.status || "responded").toLowerCase();

  if (!id) throw new Error("id required");
  if (!response) throw new Error("Response text required");
  if (!["in_progress", "responded", "closed"].includes(newStatus)) {
    throw new Error("Invalid status");
  }

  const { data, error } = await sb
    .from("investment_requests")
    .update({
      agent_response: response,
      status: newStatus,
      responded_by: actor,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
