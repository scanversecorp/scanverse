/** Per-service vendor dispatch exclusions — admin unchecks vendor in schedule tab. */

export async function getExcludedVendorIds(
  sb: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  serviceId: string,
): Promise<Set<string>> {
  if (!serviceId) return new Set();
  const { data, error } = await sb
    .from("service_vendor_exclusions")
    .select("vendor_id")
    .eq("service_id", serviceId);
  if (error) {
    console.warn("[service-vendor-exclusions]", error.message);
    return new Set();
  }
  return new Set((data || []).map((r: { vendor_id: string }) => String(r.vendor_id)));
}

export async function isVendorExcludedForService(
  sb: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.49.1").createClient>,
  vendorId: string,
  serviceId: string,
): Promise<boolean> {
  if (!vendorId || !serviceId) return false;
  const excluded = await getExcludedVendorIds(sb, serviceId);
  return excluded.has(String(vendorId));
}
