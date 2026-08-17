/** Public vendor enable flags for customer PWA (payment buttons, OTP paths). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { loadClientVendorPayload } from "../_shared/vendor-providers.ts";

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

  return new Response(JSON.stringify({ vendors, app_url: Deno.env.get("APP_URL") || "https://getscanv.com" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
