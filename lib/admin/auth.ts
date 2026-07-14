import { requireUserClaims } from "@/lib/supabase/auth";

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return configuredAdminEmails().has(email.toLowerCase());
}

export async function requireAdminClaims() {
  const { supabase, claims } = await requireUserClaims();
  const email = typeof claims?.email === "string" ? claims.email : null;
  return {
    supabase,
    claims: claims && isAdminEmail(email) ? claims : null,
    email,
    configured: configuredAdminEmails().size > 0,
  };
}
