import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import { addOrderEvent } from "@/lib/commerce/orders";
import { getPlan } from "@/lib/commerce/plans";
import { sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    action?: "approve" | "changes";
    note?: string;
  };
  if (!body.orderId || !["approve", "changes"].includes(body.action || ""))
    return NextResponse.json({ error: "操作参数不完整" }, { status: 400 });
  const note = (body.note || "").trim().slice(0, 5000);
  if (body.action === "changes" && note.length < 8)
    return NextResponse.json({ error: "请具体说明需要修改的内容（至少 8 个字）" }, { status: 400 });
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ ok: true, demo: true, action: body.action });

  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,owner_id,plan_id,customer_email,revision_count,review_status")
    .eq("id", body.orderId)
    .eq("owner_id", claims.sub)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  const { data: review, error: reviewError } = await admin
    .from("order_reviews")
    .select("*")
    .eq("order_id", order.id)
    .eq("status", "pending")
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "当前没有等待确认的初稿" }, { status: 409 });

  const now = new Date().toISOString();
  if (body.action === "changes") {
    const plan = getPlan(order.plan_id);
    const used = Number(order.revision_count || 0);
    const limit = plan?.limits.revisions ?? 0;
    if (used >= limit) return NextResponse.json({ error: `当前套餐包含 ${limit} 次修改，已全部使用` }, { status: 409 });
    await admin.from("order_reviews").update({ status: "changes_requested", customer_note: note, responded_at: now }).eq("id", review.id);
    await admin.from("orders").update({
      review_status: "changes_requested",
      revision_count: used + 1,
      service_stage: "producing",
      status: "in_progress",
    }).eq("id", order.id);
    await addOrderEvent(order.id, "customer.changes_requested", { roundNo: review.round_no, revisionCount: used + 1 });
    await recordConversionEvent({ sessionId: `server-${order.id}`, eventName: "changes_requested", path: `/order/${order.id}`, userId: claims.sub, metadata: { orderId: order.id, roundNo: review.round_no } });
    const ops = process.env.OPERATIONS_NOTIFICATION_EMAIL;
    if (ops) await sendNotification({ to: ops, subject: `拾光客户提出修改｜${order.id.slice(0, 8)}`, title: "客户已提交修改意见", body: note, actionUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "")}/admin/order/${order.id}`, actionLabel: "查看订单" }).catch(console.error);
    return NextResponse.json({ ok: true, revisionCount: used + 1, revisionLimit: limit });
  }

  await admin.from("order_reviews").update({ status: "approved", customer_note: note || null, responded_at: now }).eq("id", review.id);
  await admin.from("orders").update({
    review_status: "approved",
    approved_at: now,
    service_stage: "delivered",
    status: "fulfilled",
    fulfilled_at: now,
  }).eq("id", order.id);
  await addOrderEvent(order.id, "customer.draft_approved", { roundNo: review.round_no });
  await recordConversionEvent({ sessionId: `server-${order.id}`, eventName: "draft_approved", path: `/order/${order.id}`, userId: claims.sub, metadata: { orderId: order.id, roundNo: review.round_no } });
  return NextResponse.json({ ok: true });
}
