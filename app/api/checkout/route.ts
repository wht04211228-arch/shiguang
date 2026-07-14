import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import {
  createOrder,
  markOrderPaid,
  setOrderPaymentSession,
} from "@/lib/commerce/orders";
import { getPlan } from "@/lib/commerce/plans";
import { sendNotification } from "@/lib/notifications";
import { attributeOrderReferral, normalizeReferralCode } from "@/lib/growth/referrals";
import {
  createStripeClient,
  isDemoPaymentEnabled,
  isStripeConfigured,
} from "@/lib/payments/stripe";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    planId?: string;
    customerName?: string;
    acceptedTerms?: boolean;
    referralCode?: string;
    referralSessionId?: string;
  };
  if (body.acceptedTerms !== true)
    return NextResponse.json({ error: "请先同意服务条款与退款规则" }, { status: 400 });
  const plan = getPlan(body.planId);
  if (!plan) return NextResponse.json({ error: "套餐不存在" }, { status: 400 });

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      url: `/order/demo?plan=${plan.id}&demo=1`,
      demo: true,
    });
  }

  const { claims } = await requireUserClaims();
  if (!claims?.sub)
    return NextResponse.json(
      { error: "请先登录", loginUrl: `/login?next=/pricing` },
      { status: 401 },
    );
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email)
    return NextResponse.json({ error: "账号缺少可用邮箱" }, { status: 400 });

  const provider = isStripeConfigured()
    ? "stripe"
    : isDemoPaymentEnabled()
      ? "demo"
      : null;
  if (!provider) {
    return NextResponse.json(
      { error: "支付服务尚未配置，请联系管理员" },
      { status: 503 },
    );
  }
  const referralCode = normalizeReferralCode(body.referralCode);
  const referralSessionId = typeof body.referralSessionId === "string" && body.referralSessionId.length >= 8
    ? body.referralSessionId
    : `checkout-${crypto.randomUUID()}`;

  const order = await createOrder({
    ownerId: claims.sub,
    planId: plan.id,
    amount: plan.priceCents,
    email,
    name: body.customerName,
    provider,
    metadata: {
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: "2026-07-13",
      referralCode: referralCode || null,
    },
  });

  if (referralCode) {
    await attributeOrderReferral({ code: referralCode, orderId: order.id, sessionId: referralSessionId, purchaserOwnerId: claims.sub }).catch(console.error);
  }

  await recordConversionEvent({
    sessionId: `server-${order.id}`,
    eventName: "checkout_created",
    path: "/pricing",
    userId: claims.sub,
    metadata: { orderId: order.id, planId: plan.id, provider, referralCode: referralCode || null },
  });

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  ).replace(/\/$/, "");

  if (provider === "demo") {
    const { order: paidOrder } = await markOrderPaid(
      order.id,
      `demo_${order.id}`,
    );
    await recordConversionEvent({
      sessionId: `server-${paidOrder.id}`,
      eventName: "payment_succeeded",
      path: `/order/${paidOrder.id}`,
      userId: claims.sub,
      metadata: { orderId: paidOrder.id, planId: plan.id, demo: true },
    });
    await sendNotification({
      to: email,
      subject: `拾光订单已确认｜${plan.name}`,
      title: "你的数字礼物制作权益已经生效",
      body: `订单 ${paidOrder.id.slice(0, 8)} 已在演示支付模式中完成。你现在可以进入制作台开始整理故事。`,
      actionUrl: `${siteUrl}/order/${paidOrder.id}`,
      actionLabel: "查看订单",
    }).catch(console.error);
    return NextResponse.json({
      url: `/order/${paidOrder.id}?demo=1`,
      demo: true,
    });
  }

  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: order.id,
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cny",
          unit_amount: plan.priceCents,
          product_data: {
            name: `拾光｜${plan.name}`,
            description: plan.tagline,
          },
        },
      },
    ],
    metadata: { orderId: order.id, ownerId: claims.sub, planId: plan.id, referralCode: referralCode || "" },
    allow_promotion_codes: true,
    success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/pricing?cancelled=1`,
  });
  await setOrderPaymentSession(order.id, session.id);
  if (!session.url)
    return NextResponse.json({ error: "支付页面创建失败" }, { status: 500 });
  return NextResponse.json({ url: session.url });
}
