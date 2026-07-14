import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const allowedConversionEvents = new Set([
  "home_viewed",
  "sample_opened",
  "cases_viewed",
  "pricing_viewed",
  "checkout_started",
  "checkout_created",
  "payment_succeeded",
  "brief_started",
  "brief_submitted",
  "studio_opened",
  "card_published",
  "refund_requested",
  "draft_review_opened",
  "draft_approved",
  "changes_requested",
  "feedback_submitted",
  "referral_opened",
  "referral_order_created",
]);

export async function recordConversionEvent(input: {
  sessionId: string;
  eventName: string;
  path?: string;
  referrer?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseAdminConfigured()) return;
  if (!allowedConversionEvents.has(input.eventName)) return;
  const admin = createAdminClient();
  const safeMetadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).slice(0, 20),
  );
  const { error } = await admin.from("conversion_events").insert({
    session_id: input.sessionId.slice(0, 100),
    user_id: input.userId ?? null,
    event_name: input.eventName,
    path: (input.path || "/").slice(0, 300),
    referrer: input.referrer?.slice(0, 500) || null,
    metadata: safeMetadata,
  });
  if (error) console.error("conversion event failed", error.message);
}
