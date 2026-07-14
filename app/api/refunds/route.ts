import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { orderId?: string; reason?: string };
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ ok: true, demo: true });
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const orderId = body.orderId?.trim() || "";
  const reason = body.reason?.trim() || "";
  if (!orderId || reason.length < 8 || reason.length > 2000) {
    return NextResponse.json({ error: "退款原因应为 8–2000 个字符" }, { status: 400 });
  }
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order || !["paid", "in_progress", "fulfilled"].includes(order.status)) {
    return NextResponse.json({ error: "当前订单状态不能申请退款" }, { status: 403 });
  }
  const { data: pending } = await supabase
    .from("refund_requests")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) return NextResponse.json({ error: "该订单已有待处理的退款申请" }, { status: 409 });
  const { error } = await supabase.from("refund_requests").insert({
    order_id: orderId,
    owner_id: claims.sub,
    reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const admin = createAdminClient();
  await admin.from("order_events").insert({ order_id: orderId, event_type: "refund.requested", payload: { reason: reason.slice(0, 200) } });
  return NextResponse.json({ ok: true });
}
