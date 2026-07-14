import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeReferralCode(value: string | null | undefined) {
  return (value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

export async function findActiveReferral(codeValue: string | null | undefined) {
  const code = normalizeReferralCode(codeValue);
  if (!code) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("referral_codes")
    .select("id,owner_id,code,status,click_count,paid_order_count")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureReferralCode(ownerId: string) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("referral_codes")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = `SG${randomBytes(4).toString("hex").toUpperCase()}`;
    const { data, error } = await admin
      .from("referral_codes")
      .insert({ owner_id: ownerId, code })
      .select("*")
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw error;
  }
  throw new Error("推荐码生成失败，请稍后重试");
}

export async function trackReferralClick(input: {
  code: string;
  sessionId: string;
}) {
  const referral = await findActiveReferral(input.code);
  if (!referral) return null;
  const admin = createAdminClient();
  const { error } = await admin.from("referral_attributions").insert({
    referral_code_id: referral.id,
    session_id: input.sessionId.slice(0, 100),
  });
  if (error?.code === "23505") return referral;
  if (error) throw error;
  await admin.rpc("increment_referral_click", { target_code_id: referral.id });
  return referral;
}

export async function attributeOrderReferral(input: {
  code: string | null | undefined;
  orderId: string;
  sessionId: string;
  purchaserOwnerId?: string;
}) {
  const referral = await findActiveReferral(input.code);
  if (!referral || (input.purchaserOwnerId && referral.owner_id === input.purchaserOwnerId)) return null;
  const admin = createAdminClient();
  await admin.from("orders").update({ referred_by_code: referral.code }).eq("id", input.orderId);
  const { data: existing } = await admin
    .from("referral_attributions")
    .select("id")
    .eq("referral_code_id", referral.id)
    .eq("session_id", input.sessionId.slice(0, 100))
    .is("order_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await admin.from("referral_attributions").update({ order_id: input.orderId }).eq("id", existing.id);
  } else {
    await admin.from("referral_attributions").insert({
      referral_code_id: referral.id,
      order_id: input.orderId,
      session_id: input.sessionId.slice(0, 100),
    });
  }
  return referral;
}

export async function markReferralConverted(orderId: string, codeValue: string | null | undefined) {
  const referral = await findActiveReferral(codeValue);
  if (!referral) return;
  const admin = createAdminClient();
  const convertedAt = new Date().toISOString();
  await admin
    .from("referral_attributions")
    .update({ converted_at: convertedAt })
    .eq("order_id", orderId)
    .is("converted_at", null);
  await admin.rpc("increment_referral_paid_order", { target_code_id: referral.id });
}
