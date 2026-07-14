import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerSecret } from "@/lib/supabase/config";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = getSupabaseServerSecret();
  if (!url || !secret) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
