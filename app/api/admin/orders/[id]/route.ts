import { NextResponse } from "next/server";
import { addOrderEvent } from "@/lib/commerce/orders";
import { requireAdminClaims } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { sendNotification } from "@/lib/notifications";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: "云端未配置" }, { status: 503 });
  const { claims, configured } = await requireAdminClaims();
  if (!configured) return NextResponse.json({ error: "请先配置 ADMIN_EMAILS" }, { status: 503 });
  if (!claims) return NextResponse.json({ error: "无运营后台权限" }, { status: 403 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = createAdminClient();

  if (body.type === "order") {
    const allowedStatus = new Set(["pending", "paid", "in_progress", "fulfilled", "cancelled", "refunded"]);
    const allowedStage = new Set(["waiting_brief", "brief_submitted", "planning", "producing", "reviewing", "delivered", "closed"]);
    const allowedPriority = new Set(["low", "normal", "high", "urgent"]);
    const status = typeof body.status === "string" && allowedStatus.has(body.status) ? body.status : "in_progress";
    const serviceStage = typeof body.serviceStage === "string" && allowedStage.has(body.serviceStage) ? body.serviceStage : "producing";
    const priority = typeof body.priority === "string" && allowedPriority.has(body.priority) ? body.priority : "normal";
    const update = {
      status,
      service_stage: serviceStage,
      priority,
      due_at: typeof body.dueAt === "string" && body.dueAt ? new Date(body.dueAt).toISOString() : null,
      assignee: typeof body.assignee === "string" ? body.assignee.trim().slice(0, 150) || null : null,
      internal_notes: typeof body.internalNotes === "string" ? body.internalNotes.slice(0, 10000) || null : null,
      ...(status === "fulfilled" ? { fulfilled_at: new Date().toISOString() } : {}),
    };
    const { error } = await admin.from("orders").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await addOrderEvent(id, "admin.order_updated", { status, serviceStage, priority, admin: claims.email });
    return NextResponse.json({ ok: true });
  }

  if (body.type === "refund") {
    const refundId = typeof body.refundId === "string" ? body.refundId : "";
    const allowed = new Set(["pending", "approved", "rejected", "refunded", "cancelled"]);
    const status = typeof body.status === "string" && allowed.has(body.status) ? body.status : "pending";
    if (!refundId) return NextResponse.json({ error: "退款申请不存在" }, { status: 400 });
    const response = typeof body.adminResponse === "string" ? body.adminResponse.slice(0, 5000) : null;
    const { error } = await admin.from("refund_requests").update({
      status,
      admin_response: response,
      resolved_at: status === "pending" ? null : new Date().toISOString(),
    }).eq("id", refundId).eq("order_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (status === "refunded") await admin.from("orders").update({ status: "refunded", service_stage: "closed" }).eq("id", id);
    await addOrderEvent(id, "admin.refund_updated", { status, admin: claims.email });
    return NextResponse.json({ ok: true });
  }


  if (body.type === "review_request") {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,owner_id,customer_email,cards(slug)")
      .eq("id", id)
      .maybeSingle();
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    const cards = Array.isArray(order.cards) ? order.cards : order.cards ? [order.cards] : [];
    const card = cards[0] as { slug?: string } | undefined;
    if (!card?.slug) return NextResponse.json({ error: "请先为订单绑定礼物" }, { status: 409 });
    const { data: latest } = await admin
      .from("order_reviews")
      .select("round_no,status")
      .eq("order_id", id)
      .order("round_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.status === "pending") return NextResponse.json({ error: "上一轮初稿仍在等待客户确认" }, { status: 409 });
    const roundNo = Number(latest?.round_no || 0) + 1;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 5000) : "";
    const previewUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "")}/card/${card.slug}`;
    const { error: reviewError } = await admin.from("order_reviews").insert({
      order_id: id,
      owner_id: order.owner_id,
      round_no: roundNo,
      status: "pending",
      preview_url: previewUrl,
      admin_note: adminNote || null,
    });
    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
    await admin.from("orders").update({ review_status: "awaiting_review", review_requested_at: new Date().toISOString(), service_stage: "reviewing", status: "in_progress" }).eq("id", id);
    await addOrderEvent(id, "admin.review_requested", { roundNo, admin: claims.email });
    await sendNotification({
      to: order.customer_email,
      subject: `拾光初稿已完成｜第 ${roundNo} 轮确认`,
      title: "你的数字礼物初稿已经准备好",
      body: adminNote || "请打开订单页完整查看初稿，并选择确认交付或提交具体修改意见。",
      actionUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "")}/order/${id}`,
      actionLabel: "查看并确认初稿",
    }).catch(console.error);
    return NextResponse.json({ ok: true, roundNo });
  }

  if (body.type === "task_create") {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    if (title.length < 2) return NextResponse.json({ error: "任务标题太短" }, { status: 400 });
    const { error } = await admin.from("production_tasks").insert({
      order_id: id,
      title,
      assignee: typeof body.assignee === "string" ? body.assignee.trim().slice(0, 150) || null : null,
      due_at: typeof body.dueAt === "string" && body.dueAt ? new Date(body.dueAt).toISOString() : null,
      priority: "normal",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await addOrderEvent(id, "admin.task_created", { title, admin: claims.email });
    return NextResponse.json({ ok: true });
  }

  if (body.type === "task_update") {
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    const allowed = new Set(["todo", "doing", "blocked", "done"]);
    const status = typeof body.status === "string" && allowed.has(body.status) ? body.status : "todo";
    if (!taskId) return NextResponse.json({ error: "任务不存在" }, { status: 400 });
    const { error } = await admin.from("production_tasks").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", taskId).eq("order_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await addOrderEvent(id, "admin.task_updated", { taskId, status, admin: claims.email });
    return NextResponse.json({ ok: true });
  }


  if (body.type === "feedback_moderate") {
    const reviewId = typeof body.reviewId === "string" ? body.reviewId : "";
    const allowed = new Set(["pending", "approved", "rejected"]);
    const status = typeof body.status === "string" && allowed.has(body.status) ? body.status : "pending";
    if (!reviewId) return NextResponse.json({ error: "评价不存在" }, { status: 400 });
    const { error } = await admin.from("customer_reviews").update({ status }).eq("id", reviewId).eq("order_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await addOrderEvent(id, "admin.feedback_moderated", { status, admin: claims.email });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}
