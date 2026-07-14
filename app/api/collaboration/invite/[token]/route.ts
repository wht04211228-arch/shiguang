import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findInviteByToken, isInviteAccepting } from "@/lib/collaboration/server";
import { getPlan } from "@/lib/commerce/plans";
import { collaborationVideoLimit } from "@/lib/collaboration/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const result = await findInviteByToken(token);
    if (!result) return NextResponse.json({ error: "邀请链接不存在" }, { status: 404 });
    const { invite, space } = result;
    const acceptance = isInviteAccepting({ space, invite });
    const admin = createAdminClient();
    const [{ data: order }, { data: card }, { count: contributions }] = await Promise.all([
      admin.from("orders").select("plan_id,invite_limit,retention_tier").eq("id", space.order_id).maybeSingle(),
      admin.from("cards").select("recipient_name,occasion,cover_title").eq("order_id", space.order_id).maybeSingle(),
      admin
        .from("collaboration_contributions")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id)
        .not("status", "in", '("deleted","withdrawn")'),
    ]);
    if (!order) return NextResponse.json({ error: "邀请订单不存在" }, { status: 404 });
    const plan = getPlan(order.plan_id);
    const video = collaborationVideoLimit(order.plan_id);
    if (invite && invite.status === "active") {
      await admin
        .from("collaboration_invites")
        .update({ status: "opened", opened_at: invite.opened_at || new Date().toISOString() })
        .eq("id", invite.id);
    }
    return NextResponse.json({
      allowed: acceptance.allowed && (contributions ?? 0) < space.invite_limit,
      reason:
        (contributions ?? 0) >= space.invite_limit
          ? "共创人数已经达到当前档位上限"
          : acceptance.reason,
      invite: invite
        ? {
            id: invite.id,
            type: invite.invite_type,
            label: invite.label,
            expectedName: invite.expected_name,
            deadline: invite.deadline_override || space.contribution_deadline,
          }
        : {
            id: null,
            type: "public",
            label: "公共邀请",
            expectedName: null,
            deadline: space.contribution_deadline,
          },
      gift: {
        recipientName: card?.recipient_name || "一位重要的人",
        occasion: card?.occasion || "一份秘密礼物",
        coverTitle: card?.cover_title || "一起为TA留下一段值得珍藏的话",
      },
      rules: {
        mode: space.mode,
        inviteLimit: space.invite_limit,
        remaining: Math.max(0, space.invite_limit - (contributions ?? 0)),
        photoLimit: 3,
        audioLimit: 1,
        videoCount: video.count,
        videoSeconds: video.seconds,
        planName: plan?.name || order.plan_id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取邀请失败" },
      { status: 400 },
    );
  }
}
