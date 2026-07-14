import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import { ensureReferralCode } from "@/lib/growth/referrals";
import { addOrderEvent } from "@/lib/commerce/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    rating?: number;
    testimonial?: string;
    displayName?: string;
    publicConsent?: boolean;
    allowAnonymousCase?: boolean;
    allowQuote?: boolean;
    allowMedia?: boolean;
    publicAlias?: string;
  };
  if (!body.orderId || !Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5)
    return NextResponse.json({ error: "请选择 1 到 5 星评价" }, { status: 400 });
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ ok: true, referralCode: "SGDEMO88", demo: true });
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from("orders").select("id,owner_id,status,service_stage").eq("id", body.orderId).eq("owner_id", claims.sub).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order || !["fulfilled", "delivered", "closed"].includes(order.status) && !["delivered", "closed"].includes(order.service_stage))
    return NextResponse.json({ error: "礼物交付后才能提交评价" }, { status: 409 });

  const reviewPayload = {
    order_id: order.id,
    owner_id: claims.sub,
    rating: Number(body.rating),
    testimonial: (body.testimonial || "").trim().slice(0, 2000) || null,
    display_name: (body.displayName || "").trim().slice(0, 100) || null,
    public_consent: Boolean(body.publicConsent),
    status: "pending",
  };
  const permissionPayload = {
    order_id: order.id,
    owner_id: claims.sub,
    allow_anonymous_case: Boolean(body.allowAnonymousCase),
    allow_quote: Boolean(body.allowQuote),
    allow_media: Boolean(body.allowMedia),
    public_alias: (body.publicAlias || "").trim().slice(0, 100) || null,
    granted_at: body.allowAnonymousCase || body.allowQuote || body.allowMedia ? new Date().toISOString() : null,
    revoked_at: null,
  };
  const [{ error: reviewError }, { error: permissionError }] = await Promise.all([
    admin.from("customer_reviews").upsert(reviewPayload, { onConflict: "order_id" }),
    admin.from("case_permissions").upsert(permissionPayload, { onConflict: "order_id" }),
  ]);
  if (reviewError || permissionError) return NextResponse.json({ error: reviewError?.message || permissionError?.message }, { status: 500 });
  const referral = await ensureReferralCode(claims.sub);
  await addOrderEvent(order.id, "customer.feedback_submitted", { rating: body.rating, publicConsent: Boolean(body.publicConsent) });
  await recordConversionEvent({ sessionId: `server-${order.id}`, eventName: "feedback_submitted", path: `/order/${order.id}`, userId: claims.sub, metadata: { orderId: order.id, rating: body.rating } });
  return NextResponse.json({ ok: true, referralCode: referral.code });
}
