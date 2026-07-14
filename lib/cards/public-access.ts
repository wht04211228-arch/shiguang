import type { NextRequest } from "next/server";
import { getCardAvailability } from "@/lib/cards/availability";
import { accessCookieName, verifyAccessToken } from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicCardAccessRow = {
  id: string;
  owner_id: string;
  order_id: string | null;
  recipient_owner_id: string | null;
  primary_manager_id: string | null;
  management_phase: "creator_managed" | "co_managed" | "recipient_managed";
  slug: string;
  status: "draft" | "published" | "archived";
  unlock_answer_hash: string | null;
  release_at: string | null;
  expires_at: string | null;
  recipient_name: string;
  sender_name: string;
};

export async function requirePublicCardAccess(request: NextRequest, slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cards")
    .select(
      "id,owner_id,order_id,recipient_owner_id,primary_manager_id,management_phase,slug,status,unlock_answer_hash,release_at,expires_at,recipient_name,sender_name",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false as const, status: 404, error: "没有找到这份礼物" };
  const card = data as PublicCardAccessRow;
  const availability = getCardAvailability(card);
  if (availability.state === "pending") {
    return { ok: false as const, status: 423, error: "礼物尚未开启" };
  }
  if (availability.state === "expired") {
    return { ok: false as const, status: 410, error: "礼物已经结束展示" };
  }
  if (card.unlock_answer_hash) {
    const token = request.cookies.get(accessCookieName(slug))?.value;
    if (!verifyAccessToken(token, card.id)) {
      return { ok: false as const, status: 403, error: "请先解锁这份礼物" };
    }
  }
  return { ok: true as const, card, admin };
}
