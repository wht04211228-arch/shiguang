import { NextRequest, NextResponse } from "next/server";
import { requirePublicCardAccess } from "@/lib/cards/public-access";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  }
  try {
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { claims } = await requireUserClaims();
    if (!claims?.sub) {
      return NextResponse.json(
        { error: "请先登录或注册，再绑定这份礼物" },
        { status: 401 },
      );
    }
    if (
      access.card.recipient_owner_id &&
      access.card.recipient_owner_id !== claims.sub
    ) {
      return NextResponse.json(
        { error: "这份礼物已经绑定到另一个收件人账号" },
        { status: 409 },
      );
    }
    const { error } = await access.admin
      .from("cards")
      .update({
        recipient_owner_id: claims.sub,
        management_phase: "co_managed",
      })
      .eq("id", access.card.id)
      .or(`recipient_owner_id.is.null,recipient_owner_id.eq.${claims.sub}`);
    if (error) throw error;
    await access.admin.from("memory_space_members").upsert(
      {
        card_id: access.card.id,
        user_id: claims.sub,
        role: "recipient",
        status: "active",
        accepted_at: new Date().toISOString(),
        permissions: {
          create_entries: true,
          request_invites: true,
          request_management_changes: true,
        },
      },
      { onConflict: "card_id,user_id" },
    );
    await access.admin.from("memory_space_members").upsert(
      {
        card_id: access.card.id,
        user_id: access.card.owner_id,
        role: "creator",
        status: "active",
        accepted_at: new Date().toISOString(),
        permissions: { manage_content: true, manage_invites: true },
      },
      { onConflict: "card_id,user_id" },
    );
    return NextResponse.json({ bound: true, managementPhase: "co_managed" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "绑定失败" },
      { status: 400 },
    );
  }
}
