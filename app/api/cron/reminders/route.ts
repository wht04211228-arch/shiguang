import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ ok: true, demo: true, sent: 0 });
  const admin = createAdminClient();
  const now = Date.now();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const { data: orders, error } = await admin
    .from("orders")
    .select("id,customer_email,status,service_stage,due_at,review_requested_at,created_at,order_briefs(status)")
    .in("status", ["paid", "in_progress", "fulfilled"])
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const order of orders || []) {
    const candidates: Array<{ type: string; subject: string; title: string; body: string; to: string }> = [];
    const briefs = Array.isArray(order.order_briefs) ? order.order_briefs : order.order_briefs ? [order.order_briefs] : [];
    if (order.service_stage === "waiting_brief" && new Date(order.created_at).getTime() < now - 24 * 60 * 60 * 1000 && !briefs.some((b: { status?: string }) => b.status === "submitted" || b.status === "reviewed")) {
      candidates.push({ type: "brief_pending", to: order.customer_email, subject: "拾光提醒｜还差一步即可开始制作", title: "请补充你的制作需求", body: "订单已经生效，但制作问卷尚未提交。填写真实回忆后，我们才能开始整理专属故事。" });
    }
    if (order.service_stage === "reviewing" && order.review_requested_at && new Date(order.review_requested_at).getTime() < now - 24 * 60 * 60 * 1000) {
      candidates.push({ type: "review_pending", to: order.customer_email, subject: "拾光提醒｜初稿正在等待确认", title: "你的数字礼物初稿已经准备好", body: "请打开订单页查看初稿，并选择确认交付或提出具体修改意见。" });
    }
    if (order.due_at && new Date(order.due_at).getTime() < now + 24 * 60 * 60 * 1000 && !["delivered", "closed"].includes(order.service_stage)) {
      const ops = process.env.OPERATIONS_NOTIFICATION_EMAIL;
      if (ops) candidates.push({ type: "delivery_due", to: ops, subject: `拾光交付预警｜${order.id.slice(0, 8)}`, title: "订单将在 24 小时内到期", body: `订单 ${order.id.slice(0, 8)} 尚未交付，请检查负责人、素材与客户确认状态。` });
    }
    for (const item of candidates) {
      const dayBucket = new Date().toISOString().slice(0, 10);
      const dedupeKey = `${order.id}:${item.type}:${item.to}:${dayBucket}`;
      const { data: claimed, error: claimError } = await admin
        .from("reminder_logs")
        .insert({ order_id: order.id, reminder_type: item.type, recipient: item.to, status: "processing", dedupe_key: dedupeKey })
        .select("id")
        .maybeSingle();
      if (claimError?.code === "23505") continue;
      if (claimError || !claimed) continue;
      try {
        await sendNotification({ to: item.to, subject: item.subject, title: item.title, body: item.body, actionUrl: item.type === "delivery_due" ? `${siteUrl}/admin/order/${order.id}` : `${siteUrl}/order/${order.id}`, actionLabel: "查看详情" });
        await admin.from("reminder_logs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", claimed.id);
        sent += 1;
      } catch (sendError) {
        await admin.from("reminder_logs").update({ status: "failed", error_message: sendError instanceof Error ? sendError.message.slice(0, 1000) : "unknown", sent_at: new Date().toISOString() }).eq("id", claimed.id);
      }
    }
  }
  return NextResponse.json({ ok: true, sent, scanned: orders?.length || 0 });
}
