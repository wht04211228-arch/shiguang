import { createClient } from "@/lib/supabase/server";

export async function requireUserClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { supabase, claims: null };
  return { supabase, claims };
}
