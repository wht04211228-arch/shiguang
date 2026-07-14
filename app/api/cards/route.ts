import { NextResponse } from "next/server";
import { recordConversionEvent } from "@/lib/analytics/events";
import { cardToRow, rowToSummary, type CardRow } from "@/lib/db/cards";
import { parseCardData } from "@/lib/card-validation";
import { hashAnswer } from "@/lib/security/secrets";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan } from "@/lib/commerce/plans";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ cards: [], cloudMode: false });
  }
  const { supabase, claims } = await requireUserClaims();
  if (!claims) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    cards: (data as CardRow[]).map(rowToSummary),
    cloudMode: true,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
  }
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      card?: unknown;
      status?: string;
      orderId?: string;
    };
    let card = parseCardData(body.card);
    const status = body.status === "draft" ? "draft" : "published";

    const { data: existing, error: selectError } = await supabase
      .from("cards")
      .select("id, unlock_answer_hash, order_id")
      .eq("slug", card.slug)
      .maybeSingle();
    if (selectError) throw selectError;

    let entitlementOrder: { id: string; status: string; plan_id: string; retention_expires_at?: string | null } | null = null;
    let orderId =
      typeof body.orderId === "string" && body.orderId
        ? body.orderId
        : ((existing?.order_id as string | null | undefined) ?? null);
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, status, plan_id, retention_expires_at")
        .eq("id", orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (
        !order ||
        !["paid", "in_progress", "fulfilled"].includes(order.status)
      ) {
        return NextResponse.json(
          { error: "该订单尚未支付或不属于当前账号" },
          { status: 403 },
        );
      }
      entitlementOrder = order;
      const plan = getPlan(order.plan_id);
      if (!plan) {
        return NextResponse.json(
          { error: "订单套餐配置异常" },
          { status: 500 },
        );
      }
      if (card.memories.length > plan.limits.memories) {
        return NextResponse.json(
          { error: `${plan.name}最多支持 ${plan.limits.memories} 段回忆` },
          { status: 400 },
        );
      }
      if (order.plan_id === "light" && card.theme !== "film") {
        return NextResponse.json(
          { error: "轻定制套餐仅支持 C · 温暖胶片主题" },
          { status: 400 },
        );
      }
    } else if (
      status === "published" &&
      process.env.ALLOW_UNPAID_PUBLISH !== "true"
    ) {
      return NextResponse.json(
        {
          error: "发布云端礼物前需要选择并支付一个套餐",
          pricingUrl: "/pricing",
        },
        { status: 402 },
      );
    }

    if (orderId) {
      const admin = createAdminClient();
      const { data: space } = await admin
        .from("collaboration_spaces")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (space) {
        const { data: contributions, error: contributionError } = await admin
          .from("collaboration_contributions")
          .select("id,display_name,anonymous_to_recipient,message,media,sort_order")
          .eq("space_id", space.id)
          .eq("status", "approved")
          .order("sort_order", { ascending: true });
        if (contributionError) throw contributionError;
        card = {
          ...card,
          collaborations: (contributions ?? []).map((item) => ({
            id: item.id,
            displayName: item.anonymous_to_recipient ? "匿名祝福" : item.display_name,
            anonymousToRecipient: item.anonymous_to_recipient,
            message: item.message,
            media: Array.isArray(item.media) ? item.media : [],
          })),
        };
      }
    }

    const baseRow = {
      ...cardToRow(card, claims.sub, status, orderId),
      ...(entitlementOrder?.retention_expires_at
        ? { retention_expires_at: entitlementOrder.retention_expires_at }
        : {}),
      primary_manager_id: claims.sub,
    };
    const answerHash = card.unlockAnswer
      ? hashAnswer(card.unlockAnswer)
      : ((existing?.unlock_answer_hash as string | null | undefined) ?? null);

    const operation = existing?.id
      ? supabase
          .from("cards")
          .update({ ...baseRow, unlock_answer_hash: answerHash })
          .eq("id", existing.id)
          .select("*")
          .single()
      : supabase
          .from("cards")
          .insert({ ...baseRow, unlock_answer_hash: answerHash })
          .select("*")
          .single();

    const { data, error } = await operation;
    if (error?.code === "23505") {
      const message = error.message.includes("cards_order_id_unique_idx")
        ? "这个订单已经绑定了另一份礼物"
        : "这个专属链接已被占用，请更换链接标识";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (error) throw error;

    if (orderId) {
      const admin = createAdminClient();
      await admin
        .from("collaboration_spaces")
        .update({ card_id: data.id })
        .eq("order_id", orderId);
      await admin
        .from("orders")
        .update(
          status === "published"
            ? { status: "in_progress", service_stage: "producing", review_status: "not_ready", fulfilled_at: null }
            : { status: "in_progress", service_stage: "producing" },
        )
        .eq("id", orderId);
    }

    if (status === "published") {
      await recordConversionEvent({
        sessionId: `server-${data.id}`,
        eventName: "card_published",
        path: `/card/${card.slug}`,
        userId: claims.sub,
        metadata: { orderId, theme: card.theme },
      });
    }

    return NextResponse.json({
      card: rowToSummary(data as CardRow),
      publicPath: `/card/${card.slug}`,
      orderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
