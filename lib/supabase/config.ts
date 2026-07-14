export function isSupabasePublicConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseServerSecret(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabasePublicConfigured() && Boolean(getSupabaseServerSecret());
}
