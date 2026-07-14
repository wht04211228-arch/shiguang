import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import { addOrderEvent } from "@/lib/commerce/orders";
import { manualPaymentChannels } from "@/lib/commerce/manual-payments";
import { sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

const maxBytes = 6 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const channels = new Set<string>(manualPaymentChannels);

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  }

  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const form = await request.formData();
  const orderId = String(form.get("orderId") || "").trim();
  const paymentChannel = String(form.get("paymentChannel") || "").trim();
  const transactionReference = String(form.get("transactionReference") || "").trim().replace(/\s+/gu, "").toUpperCase();
  const paidAtRaw = String(form.get("paidAt") || "").trim();
  const file = form.get("file");

  if (!orderId) return NextResponse.json({ error: "订单不存在" }, { status: 400 });
  if (!channels.has(paymentChannel)) {
    return NextResponse.json({ error: "请选择实际付款方式" }, { status: 400 });
  }
  if (transactionReference.length < 6 || transactionReference.length > 100) {
    return NextResponse.json({ error: "请填写 6～100 位完整交易单号" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传付款凭证截图" }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "付款凭证仅支持 JPG、PNG 或 WebP" }, { status: 415 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "付款凭证不能超过 6 MB" }, { status: 413 });
  }

  const paidAt = new Date(paidAtRaw);
  const now = Date.now();
  if (!paidAtRaw || Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "请选择真实付款时间" }, { status: 400 });
  }
  if (paidAt.getTime() > now + 10 * 60 * 1000 || paidAt.getTime() < now - 30 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "付款时间需要在最近 30 天内，且不能晚于当前时间" }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,status,payment_provider,amount,customer_email,plan_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "订单不存在或不属于当前账号" }, { status: 404 });
  if (order.payment_provider !== "manual") {
    return NextResponse.json({ error: "该订单不是人工付款订单" }, { status: 409 });
  }
  if (["paid", "in_progress", "fulfilled"].includes(order.status)) {
    return NextResponse.json({ error: "该订单已经确认到账，无需重复提交" }, { status: 409 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "当前订单状态不能提交付款凭证" }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("manual_payment_proofs")
    .select("id,proof_path,review_status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing && ["submitted", "reviewing", "approved"].includes(existing.review_status)) {
    return NextResponse.json({ error: "已有付款凭证正在审核或已经通过" }, { status: 409 });
  }

  const { data: duplicate } = await admin
    .from("manual_payment_proofs")
    .select("id,order_id")
    .eq("transaction_reference", transactionReference)
    .neq("order_id", orderId)
    .maybeSingle();
  if (duplicate) {
    return NextResponse.json({ error: "该交易单号已用于其他订单，请核对后重试" }, { status: 409 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const proofPath = `${claims.sub}/${orderId}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(proofPath, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const row = {
    order_id: orderId,
    owner_id: claims.sub,
    payment_channel: paymentChannel,
    amount: order.amount,
    transaction_reference: transactionReference,
    proof_path: proofPath,
    paid_at: paidAt.toISOString(),
    review_status: "submitted",
    reviewer_id: null,
    reviewed_at: null,
    review_note: null,
  };

  const operation = existing
    ? admin.from("manual_payment_proofs").update(row).eq("id", existing.id).select("id").single()
    : admin.from("manual_payment_proofs").insert(row).select("id").single();
  const { data: saved, error: saveError } = await operation;
  if (saveError) {
    await admin.storage.from("payment-proofs").remove([proofPath]).catch(() => undefined);
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  if (existing?.proof_path && existing.proof_path !== proofPath) {
    await admin.storage.from("payment-proofs").remove([existing.proof_path]).catch(() => undefined);
  }

  await admin
    .from("orders")
    .update({ payment_review_status: "submitted" })
    .eq("id", orderId);

  await addOrderEvent(orderId, "manual_payment.proof_submitted", {
    proofId: saved.id,
    paymentChannel,
    transactionReferenceTail: transactionReference.slice(-6),
  });

  await recordConversionEvent({
    sessionId: `server-${orderId}`,
    eventName: "payment_proof_submitted",
    path: `/pay/manual/${orderId}`,
    userId: claims.sub,
    metadata: { orderId, paymentChannel },
  });

  const operationsEmail = process.env.OPERATIONS_NOTIFICATION_EMAIL?.trim();
  if (operationsEmail) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/u, "");
    await sendNotification({
      to: operationsEmail,
      subject: `拾光待核对付款｜订单 ${orderId.slice(0, 8).toUpperCase()}`,
      title: "客户已提交付款凭证",
      body: `请核对实际到账、金额与交易单号。订单邮箱：${order.customer_email}。`,
      actionUrl: `${siteUrl}/admin/order/${orderId}`,
      actionLabel: "进入付款审核",
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, proofId: saved.id });
}
