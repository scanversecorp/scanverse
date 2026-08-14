/** External logistics providers — quote/create/track stubs until API keys are live. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type LogisticsProvider = "porter" | "borzo" | "shadowfax" | "qwqer" | "delhivery";

const SECRET_KEYS: Record<LogisticsProvider, string> = {
  porter: "PORTER_API_KEY",
  borzo: "BORZO_API_TOKEN",
  shadowfax: "SHADOWFAX_API_KEY",
  qwqer: "QWQER_API_KEY",
  delhivery: "DELHIVERY_API_TOKEN",
};

export function providerConfigured(provider: LogisticsProvider): boolean {
  const key = SECRET_KEYS[provider];
  const val = Deno.env.get(key) || "";
  return val.length >= 8;
}

export async function quoteExternalTrip(
  _sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const provider = String(body.provider || "porter") as LogisticsProvider;
  if (!providerConfigured(provider)) {
    return {
      configured: false,
      provider,
      message: `Set ${SECRET_KEYS[provider]} in Supabase secrets after ${provider} approves sandbox access.`,
    };
  }
  return { configured: true, provider, quote_paise: null, message: "API integration pending implementation" };
}

export async function createExternalTrip(
  sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const bookingId = String(body.booking_id || "").trim();
  const provider = String(body.provider || "porter") as LogisticsProvider;
  if (!bookingId) return { error: "booking_id required" };

  if (!providerConfigured(provider)) {
    return {
      error: `${provider} not configured — awaiting partner API credentials`,
      configured: false,
    };
  }

  const { data: booking } = await sb
    .from("bookings")
    .select("id, pickup_text, drop_text, location_text, customer_lat, customer_lng")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking not found" };

  return {
    error: `${provider} API client not yet wired — booking ${bookingId} ready for dispatch`,
    configured: true,
    booking,
  };
}
