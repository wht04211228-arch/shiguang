import OpenAI from "openai";
import { NextResponse } from "next/server";
import { addOrderEvent } from "@/lib/commerce/orders";
import { getPlan } from "@/lib/commerce/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type CopyInput = {
  recipientName?: string;
  occasion?: string;
  facts?: string;
  tone?: string;
  relationship?: string;
  orderId?: string;
};

function clean(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

const fallback = (input: CopyInput) => {
  const recipient = input.recipientName || "你";
  const occasion = input.occasion || "这个重要的日子";
  const fact = (
    input.facts || "那些看起来普通、却一直被记得的时刻"
  ).replace(/[。！？!?，,；;：:…]+$/u, "");
  return {
    coverTitle: `我把与${recipient}有关的时间，重新整理成了一份礼物。`,
    coverSubtitle: `${occasion}不只是一个日期，也是重新认真表达一次的理由。`,
    letter: [
      `写下这些话时，我想到的是${fact}。`,
      "很多真正重要的事情，并不一定发生在盛大的时刻。它们藏在一次等待、一句关心和那些习以为常的陪伴里。",
      "我想把这些细节留下来，也想让你知道：你的出现，让许多普通日子变得值得记住。",
      "愿以后的时间里，我们仍然有新的故事可以慢慢补进这份礼物。",
    ],
    futurePromises: [
      "一起完成一件一直想做的事",
      "认真记录更多普通的日子",
      "在下一个重要日期再次打开这份礼物",
    ],
    provider: "local",
  };
};

export async function POST(request: Request) {
  const raw = (await request.json().catch(() => ({}))) as CopyInput;
  if (typeof raw.facts === "string" && raw.facts.length > 6000) {
    return NextResponse.json(
      { error: "真实细节请控制在 6000 字以内" },
      { status: 413 },
    );
  }
  const input: CopyInput = {
    recipientName: clean(raw.recipientName, 60),
    occasion: clean(raw.occasion, 80),
    facts: clean(raw.facts, 6000),
    tone: clean(raw.tone, 160),
    relationship: clean(raw.relationship, 80),
    orderId: clean(raw.orderId, 80),
  };

  if (isSupabaseAdminConfigured()) {
    const { supabase, claims } = await requireUserClaims();
    if (!claims?.sub)
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (!input.orderId) {
      return NextResponse.json(
        { error: "AI 文案功能需要已支付订单", pricingUrl: "/pricing" },
        { status: 402 },
      );
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, plan_id")
      .eq("id", input.orderId)
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (
      !order ||
      !["paid", "in_progress", "fulfilled"].includes(order.status)
    ) {
      return NextResponse.json(
        { error: "订单尚未支付或不属于当前账号" },
        { status: 403 },
      );
    }
    const plan = getPlan(order.plan_id);
    if (!plan)
      return NextResponse.json({ error: "订单套餐配置异常" }, { status: 500 });

    const admin = createAdminClient();
    const { data: nextUsed, error: quotaError } = await admin.rpc(
      "consume_order_ai_draft",
      {
        target_order_id: order.id,
        maximum_drafts: plan.limits.aiDrafts,
      },
    );
    if (quotaError)
      return NextResponse.json({ error: quotaError.message }, { status: 500 });
    if (typeof nextUsed !== "number") {
      return NextResponse.json(
        { error: `当前套餐最多生成 ${plan.limits.aiDrafts} 次 AI 草稿` },
        { status: 429 },
      );
    }
    await addOrderEvent(order.id, "ai.copy.generated", {
      used: nextUsed,
    }).catch(console.error);
  }

  if (!process.env.OPENAI_API_KEY || !isSupabaseAdminConfigured()) {
    return NextResponse.json(fallback(input));
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: `你是私人纪念礼物的中文文案策划师。请根据真实细节写克制、具体、不油腻的文案。\n收件人：${input.recipientName || "未填写"}\n关系：${input.relationship || "重要的人"}\n场景：${input.occasion || "纪念日"}\n语气：${input.tone || "温暖真实"}\n真实细节：${input.facts || "未填写"}\n只输出严格 JSON，不要 markdown。格式：{"coverTitle":"...","coverSubtitle":"...","letter":["...","...","...","..."],"futurePromises":["...","...","..."]}`,
    });
    const text = response.output_text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "");
    const parsed = JSON.parse(text) as {
      coverTitle: string;
      coverSubtitle: string;
      letter: string[];
      futurePromises: string[];
    };
    return NextResponse.json({ ...parsed, provider: "openai" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      ...fallback(input),
      warning: "AI 服务暂时不可用，已返回本地草稿",
    });
  }
}
