import { NextRequest, NextResponse } from "next/server";
import {
  createOpaqueToken,
  hashCollaborationToken,
  safeTokenHint,
} from "@/lib/collaboration/server";
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
    if (!claims?.sub || access.card.recipient_owner_id !== claims.sub) {
      return NextResponse.json({ error: "只有已绑定的收件人可以创建邀请" }, { status: 403 });
    }
    const { data: member } = await access.admin
      .from("memory_space_members")
      .select("permissions")
      .eq("card_id", access.card.id)
      .eq("user_id", claims.sub)
      .maybeSingle();
    const approved = Boolean(
      (member?.permissions as Record<string, unknown> | null)?.invite_approved,
    );
    if (!approved) {
      return NextResponse.json({ error: "邀请权限仍在等待送礼人批准" }, { status: 403 });
    }
    if (!access.card.order_id) throw new Error("礼物没有关联订单");
    const { data: space } = await access.admin
      .from("collaboration_spaces")
      .select("id,invite_limit,submissions_open,contribution_deadline,locked_at")
      .eq("order_id", access.card.order_id)
      .maybeSingle();
    if (!space) throw new Error("共创空间尚未开启");
    if (!space.submissions_open || space.locked_at) throw new Error("当前共创投稿已经关闭");
    const { count } = await access.admin
      .from("collaboration_contributions")
      .select("id", { count: "exact", head: true })
      .eq("space_id", space.id)
      .not("status", "in", '("deleted","withdrawn")');
    if ((count ?? 0) >= space.invite_limit) {
      return NextResponse.json({ error: "共创人数额度已经用完，请让送礼人补差价升级" }, { status: 409 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      expectedName?: string;
      deadline?: string | null;
    };
    const token = createOpaqueToken();
    const expectedName =
      typeof body.expectedName === "string" ? body.expectedName.trim().slice(0, 80) : "";
    const { data, error } = await access.admin
      .from("collaboration_invites")
      .insert({
        space_id: space.id,
        token_hash: hashCollaborationToken(token),
        token_hint: safeTokenHint(token),
        invite_type: "recipient_granted",
        label: expectedName ? `收件人邀请 ${expectedName}` : "收件人新增邀请",
        expected_name: expectedName || null,
        deadline_override: body.deadline || space.contribution_deadline || null,
      })
      .select("id,status,expected_name,deadline_override")
      .single();
    if (error) throw error;
    const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
    return NextResponse.json({ invite: data, url: `${base}/collaborate/${token}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建邀请失败" },
      { status: 400 },
    );
  }
}
