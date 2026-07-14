import type Stripe from "stripe";
import { recordConversionEvent } from "@/lib/analytics/events";
import { NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/commerce/orders";
import { getPlan } from "@/lib/commerce/plans";
import { sendNotification } from "@/lib/notifications";
import { createStripeClient } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 503 },
    );
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json(
      { error: "Missing Stripe-Signature" },
      { status: 400 },
    );

  const stripe = createStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 },
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (orderId) {
      const promotion = session.discounts?.[0]?.promotion_code;
      const promotionCode =
        typeof promotion === "string"
          ? promotion
          : promotion?.code || promotion?.id || null;
      const { order, changed } = await markOrderPaid(orderId, session.id, {
        amountTotal: session.amount_total,
        discountAmount: session.total_details?.amount_discount ?? 0,
        promotionCode,
      });
      if (!changed)
        return NextResponse.json({ received: true, duplicate: true });
      const plan = getPlan(order.plan_id);
      const siteUrl = (
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      ).replace(/\/$/, "");
      await recordConversionEvent({
        sessionId: `server-${order.id}`,
        eventName: "payment_succeeded",
        path: "/order/success",
        userId: order.owner_id,
        metadata: { orderId: order.id, planId: order.plan_id, amount: order.amount },
      });
      await sendNotification({
        to: order.customer_email,
        subject: `拾光支付成功｜${plan?.name ?? "数字礼物"}`,
        title: "支付成功，制作权益已经生效",
        body: "你的订单已经确认。进入订单页后即可开始制作并发布专属礼物。",
        actionUrl: `${siteUrl}/order/${order.id}`,
        actionLabel: "开始制作",
      }).catch(console.error);
    }
  }

  return NextResponse.json({ received: true });
}
