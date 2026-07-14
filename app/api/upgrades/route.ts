import { NextResponse } from "next/server";
import { createOrder } from "@/lib/commerce/orders";
import { requireUserClaims } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeRetentionExpiry,
  computeUpgradeDifference,
  getInviteTier,
  getRetentionTier,
  type InviteTierId,
  type RetentionTierId,
} from "@/lib/collaboration/types";

export async function POST(request: Request) {
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = (await request.json()) as {
      orderId?: string;
      inviteTier?: InviteTierId;
      retentionTier?: RetentionTierId;
    };
    if (!body.orderId) throw new Error("缺少原订单编号");
    const admin = createAdminClient();
    const { data: parent, error } = await admin
      .from("orders")
      .select("*")
      .eq("id", body.orderId)
      .eq("owner_id", claims.sub)
      .maybeSingle();
    if (error) throw error;
    if (!parent) throw new Error("原订单不存在或不属于当前账号");
    if (!["paid", "in_progress", "fulfilled"].includes(parent.status)) {
      throw new Error("原订单付款确认后才能升级权益");
    }
    const current = {
      inviteTier: (parent.invite_tier || "none") as InviteTierId,
      retentionTier: (parent.retention_tier || "days30") as RetentionTierId,
    };
    const target = {
      inviteTier: body.inviteTier || current.inviteTier,
      retentionTier: body.retentionTier || current.retentionTier,
    };
    const difference = computeUpgradeDifference(current, target);
    if (!difference) throw new Error("目标权益与当前权益相同，无需补款");
    const invite = getInviteTier(target.inviteTier);
    const retention = getRetentionTier(target.retentionTier);
    const start = new Date(parent.paid_at || parent.created_at);
    const retentionExpiresAt = computeRetentionExpiry(retention.id, start);
    const order = await createOrder({
      ownerId: claims.sub,
      planId: parent.plan_id,
      amount: difference,
      email: parent.customer_email,
      name: parent.customer_name || undefined,
      provider: "manual",
      orderKind: "upgrade",
      parentOrderId: parent.id,
      inviteTier: invite.id,
      inviteLimit: invite.limit,
      retentionTier: retention.id,
      retentionExpiresAt,
      entitlementSnapshot: {
        upgradeFrom: current,
        upgradeTo: target,
        invite,
        retention,
      },
      metadata: {
        paymentFlow: "manual_review",
        upgradeFromOrderId: parent.id,
        upgradeFrom: current,
        upgradeTo: target,
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: difference,
      url: `/pay/manual/${order.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建升级订单失败" },
      { status: 400 },
    );
  }
}
