import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import { createOrder } from "@/lib/commerce/orders";
import { getPlan } from "@/lib/commerce/plans";
import { computeAddonTotal, computeRetentionExpiry, getInviteTier, getRetentionTier, type InviteTierId, type RetentionTierId } from "@/lib/collaboration/types";
import { attributeOrderReferral, normalizeReferralCode } from "@/lib/growth/referrals";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

async function handleCheckout(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    planId?: string;
    customerName?: string;
    acceptedTerms?: boolean;
    referralCode?: string;
    referralSessionId?: string;
    inviteTier?: InviteTierId;
    retentionTier?: RetentionTierId;
  };

  if (body.acceptedTerms !== true) {
    return NextResponse.json({ error: "请先同意服务条款与退款规则" }, { status: 400 });
  }

  const plan = getPlan(body.planId);
  if (!plan) return NextResponse.json({ error: "套餐不存在" }, { status: 400 });
  const invite = getInviteTier(body.inviteTier);
  const retention = getRetentionTier(body.retentionTier);
  const amount = plan.priceCents + computeAddonTotal(invite.id, retention.id);
  const retentionExpiresAt = computeRetentionExpiry(retention.id);

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      url: `/order/demo?plan=${plan.id}&demo=1&invite=${invite.id}&retention=${retention.id}`,
      demo: true,
    });
  }

  const { claims } = await requireUserClaims();
  if (!claims?.sub) {
    return NextResponse.json(
      { error: "请先登录", loginUrl: "/login?next=/pricing" },
      { status: 401 },
    );
  }

  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email) return NextResponse.json({ error: "账号缺少可用邮箱" }, { status: 400 });

  const referralCode = normalizeReferralCode(body.referralCode);
  const referralSessionId =
    typeof body.referralSessionId === "string" && body.referralSessionId.length >= 8
      ? body.referralSessionId
      : `checkout-${crypto.randomUUID()}`;

  const order = await createOrder({
    ownerId: claims.sub,
    planId: plan.id,
    amount,
    email,
    name: body.customerName,
    provider: "manual",
    inviteTier: invite.id,
    inviteLimit: invite.limit,
    retentionTier: retention.id,
    retentionExpiresAt,
    entitlementSnapshot: { invite, retention, planLimits: plan.limits },
    metadata: {
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: "2026-07-14-manual-payment",
      referralCode: referralCode || null,
      paymentFlow: "manual_review",
      inviteTier: invite.id,
      inviteLimit: invite.limit,
      retentionTier: retention.id,
      retentionExpiresAt,
    },
  });

  if (referralCode) {
    await attributeOrderReferral({
      code: referralCode,
      orderId: order.id,
      sessionId: referralSessionId,
      purchaserOwnerId: claims.sub,
    }).catch(console.error);
  }

  await recordConversionEvent({
    sessionId: `server-${order.id}`,
    eventName: "checkout_created",
    path: "/pricing",
    userId: claims.sub,
    metadata: {
      orderId: order.id,
      planId: plan.id,
      provider: "manual",
      referralCode: referralCode || null,
      inviteTier: invite.id,
      retentionTier: retention.id,
      amount,
    },
  });

  return NextResponse.json({ url: `/pay/manual/${order.id}` });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    return await handleCheckout(request);
  } catch (error) {
    console.error(`[checkout:${requestId}]`, error);
    return NextResponse.json(
      {
        error: "创建人工付款订单失败，请检查 Vercel Functions Logs",
        requestId,
      },
      { status: 500 },
    );
  }
}
