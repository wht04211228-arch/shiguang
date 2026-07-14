import type { PlanId } from "@/lib/commerce/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { markReferralConverted } from "@/lib/growth/referrals";

export type OrderStatus =
  "pending" | "paid" | "in_progress" | "fulfilled" | "cancelled" | "refunded";
export type PaymentProvider = "demo" | "stripe" | "manual";

export type OrderRow = {
  id: string;
  owner_id: string;
  plan_id: PlanId;
  status: OrderStatus;
  payment_provider: PaymentProvider;
  payment_session_id: string | null;
  amount: number;
  currency: string;
  customer_email: string;
  customer_name: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
  service_stage?: string;
  review_status?: string;
  revision_count?: number;
  review_requested_at?: string | null;
  approved_at?: string | null;
  referred_by_code?: string | null;
};

export async function createOrder(input: {
  ownerId: string;
  planId: PlanId;
  amount: number;
  email: string;
  name?: string;
  provider: PaymentProvider;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .insert({
      owner_id: input.ownerId,
      plan_id: input.planId,
      amount: input.amount,
      currency: "cny",
      customer_email: input.email,
      customer_name: input.name?.trim() || null,
      payment_provider: input.provider,
      status: "pending",
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  await addOrderEvent(data.id, "order.created", {
    provider: input.provider,
    planId: input.planId,
  });
  return data as OrderRow;
}

export async function addOrderEvent(
  orderId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_events")
    .insert({ order_id: orderId, event_type: eventType, payload });
  if (error) throw error;
}

export async function markOrderPaid(
  orderId: string,
  sessionId?: string | null,
  settlement?: { amountTotal?: number | null; discountAmount?: number | null; promotionCode?: string | null },
) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("Order not found.");
  if (
    current.paid_at &&
    ["paid", "in_progress", "fulfilled"].includes(current.status)
  ) {
    return { order: current as OrderRow, changed: false };
  }

  const { data, error } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      ...(sessionId ? { payment_session_id: sessionId } : {}),
      ...(typeof settlement?.amountTotal === "number"
        ? { amount: settlement.amountTotal }
        : {}),
      ...(typeof settlement?.discountAmount === "number"
        ? { discount_amount: settlement.discountAmount }
        : {}),
      ...(settlement?.promotionCode
        ? { promotion_code: settlement.promotionCode }
        : {}),
    })
    .eq("id", orderId)
    .select("*")
    .single();
  if (error) throw error;
  await addOrderEvent(orderId, "payment.succeeded", {
    sessionId: sessionId ?? null,
    amountTotal: settlement?.amountTotal ?? null,
    discountAmount: settlement?.discountAmount ?? null,
    promotionCode: settlement?.promotionCode ?? null,
  });
  await markReferralConverted(orderId, (data as OrderRow).referred_by_code).catch(console.error);
  return { order: data as OrderRow, changed: true };
}


export async function finalizeManualPayment(input: {
  orderId: string;
  proofId: string;
  reviewerId: string;
  reviewNote?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("approve_manual_payment", {
    target_proof_id: input.proofId,
    target_order_id: input.orderId,
    target_reviewer_id: input.reviewerId,
    target_review_note: input.reviewNote || null,
  });
  if (error) throw error;
  const order = data as {
    id: string;
    owner_id: string;
    plan_id: PlanId;
    amount: number;
    customer_email: string;
    referred_by_code: string | null;
    changed: boolean;
  };
  if (order.changed) {
    await markReferralConverted(order.id, order.referred_by_code).catch(console.error);
  }
  return { order, changed: order.changed };
}

export async function setOrderPaymentSession(
  orderId: string,
  sessionId: string,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ payment_session_id: sessionId })
    .eq("id", orderId);
  if (error) throw error;
}

export async function getOrderForOwner(orderId: string, ownerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("*, cards(slug, recipient_name, status)")
    .eq("id", orderId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
