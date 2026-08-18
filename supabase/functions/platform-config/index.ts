/** Public vendor enable flags for customer PWA (payment buttons, OTP paths). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { loadClientVendorPayload } from "../_shared/vendor-providers.ts";
import { getPlatformSettingValue, isPlatformFlagOn } from "../_shared/platform-settings.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(url, key);
  const vendors = await loadClientVendorPayload(sb);
  const maintenance_mode = await isPlatformFlagOn(sb, "maintenance_mode", {
    envFallbackKey: "MAINTENANCE_MODE",
  });
  const maintenance_message = await getPlatformSettingValue(sb, "maintenance_message");

  return new Response(JSON.stringify({
    vendors,
    app_url: Deno.env.get("APP_URL") || "https://getscanv.com",
    maintenance_mode,
    maintenance_message: maintenance_message || null,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
