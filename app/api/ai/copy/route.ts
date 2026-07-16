import { NextResponse } from "next/server";
import { addOrderEvent } from "@/lib/commerce/orders";
import { getPlan } from "@/lib/commerce/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type GenerationMode = "compose" | "polish" | "rewrite";
type CopyLength = "short" | "balanced" | "rich";

type CopyDraft = {
  coverTitle: string;
  coverSubtitle: string;
  letter: string[];
  futurePromises: string[];
};

type CopyInput = {
  recipientName?: string;
  occasion?: string;
  facts?: string;
  tone?: string;
  relationship?: string;
  orderId?: string;
  mode?: GenerationMode;
  length?: CopyLength;
  currentDraft?: Partial<CopyDraft>;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

type OrderQuotaContext = {
  orderId: string;
  maximumDrafts: number;
  currentUsed: number;
};

function clean(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value || "https://api.deepseek.com").replace(/\/+$/u, "");
}

function parseMode(value: unknown): GenerationMode {
  return value === "polish" || value === "rewrite" ? value : "compose";
}

function parseLength(value: unknown): CopyLength {
  return value === "short" || value === "rich" ? value : "balanced";
}

function normalizeStringArray(value: unknown, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, maximumItems)
    .map((item) => clean(item, maximumLength))
    .filter(Boolean);
}

function normalizeCurrentDraft(value: unknown): Partial<CopyDraft> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const draft = value as Partial<CopyDraft>;
  return {
    coverTitle: clean(draft.coverTitle, 120),
    coverSubtitle: clean(draft.coverSubtitle, 180),
    letter: normalizeStringArray(draft.letter, 8, 800),
    futurePromises: normalizeStringArray(draft.futurePromises, 8, 180),
  };
}

function isCopyDraft(value: unknown): value is CopyDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<CopyDraft>;
  return (
    typeof draft.coverTitle === "string" &&
    typeof draft.coverSubtitle === "string" &&
    Array.isArray(draft.letter) &&
    draft.letter.length >= 4 &&
    draft.letter.every((item) => typeof item === "string") &&
    Array.isArray(draft.futurePromises) &&
    draft.futurePromises.length >= 3 &&
    draft.futurePromises.every((item) => typeof item === "string")
  );
}

function tidyDraft(draft: CopyDraft): CopyDraft {
  return {
    coverTitle: clean(draft.coverTitle, 120),
    coverSubtitle: clean(draft.coverSubtitle, 180),
    letter: draft.letter.slice(0, 6).map((item) => clean(item, 800)).filter(Boolean),
    futurePromises: draft.futurePromises
      .slice(0, 5)
      .map((item) => clean(item, 180))
      .filter(Boolean),
  };
}

function fallback(input: CopyInput): CopyDraft {
  const recipient = input.recipientName || "你";
  const occasion = input.occasion || "这个重要的日子";
  const fact = (input.facts || "那些看起来普通、却一直被记得的时刻")
    .replace(/[。！？!?，,；;：:…]+$/u, "")
    .slice(0, 180);

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
  };
}

function modeInstruction(mode: GenerationMode): string {
  if (mode === "polish") {
    return "润色现有文案：保留全部真实事实、称呼和核心意思，改善节奏与表达，不擅自新增经历。";
  }
  if (mode === "rewrite") {
    return "重新组织现有资料：允许改变句子顺序和叙事结构，但不得编造任何用户未提供的事实。";
  }
  return "根据真实资料生成一套完整初稿：优先使用具体细节，不写空泛套话，不编造经历。";
}

function lengthInstruction(length: CopyLength): string {
  if (length === "short") return "整体简洁：每段约45到75个中文字符。";
  if (length === "rich") return "内容较丰富：每段约110到170个中文字符，但保持克制。";
  return "长度均衡：每段约75到120个中文字符。";
}

async function requestDeepSeek(input: CopyInput): Promise<{
  draft: CopyDraft;
  model: string;
  usage?: DeepSeekResponse["usage"];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  const currentDraft = input.currentDraft
    ? JSON.stringify(input.currentDraft, null, 2)
    : "未提供现有文案";

  try {
    const response = await fetch(
      `${normalizeBaseUrl(process.env.DEEPSEEK_BASE_URL)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: [
                "你是‘拾光’私人数字纪念礼物的中文文案策划师。",
                "必须遵守：只依据用户提供的事实创作；不编造地点、日期、事件、承诺或人物关系；不使用油腻网络套话；不制造道德压力；不用夸张承诺。",
                "写作风格应真实、具体、克制、有画面感，适合生日、纪念日、友情、亲情或重要关系。",
                "你必须只输出合法 JSON，不要输出 Markdown、解释或代码块。",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                "请生成电子纪念礼物文案，并严格输出 JSON。",
                `创作方式：${modeInstruction(input.mode || "compose")}`,
                `长度要求：${lengthInstruction(input.length || "balanced")}`,
                `收件人：${input.recipientName || "未填写"}`,
                `关系：${input.relationship || "重要的人"}`,
                `场景：${input.occasion || "纪念日"}`,
                `语气：${input.tone || "温暖、真实、克制"}`,
                `真实细节：\n${input.facts || "未填写"}`,
                `现有文案：\n${currentDraft}`,
                "输出结构必须完全符合：",
                '{"coverTitle":"不超过40字","coverSubtitle":"不超过70字","letter":["第1段","第2段","第3段","第4段"],"futurePromises":["约定1","约定2","约定3"]}',
                "letter 至少4段；futurePromises 至少3条；所有内容必须是中文字符串。",
              ].join("\n\n"),
            },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          temperature: 0.72,
          max_tokens: 2200,
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    const text = await response.text();
    let payload: DeepSeekResponse = {};

    if (text.trim()) {
      try {
        payload = JSON.parse(text) as DeepSeekResponse;
      } catch {
        throw new Error(`DeepSeek 返回了非 JSON 响应（HTTP ${response.status}）`);
      }
    }

    if (!response.ok) {
      const message = payload.error?.message || `HTTP ${response.status}`;
      throw new Error(`DeepSeek 请求失败：${message}`);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("DeepSeek 没有返回文案内容");

    const parsed = JSON.parse(
      content.replace(/^```json\s*/iu, "").replace(/```$/u, ""),
    ) as unknown;

    if (!isCopyDraft(parsed)) {
      throw new Error("DeepSeek 返回的文案结构不完整");
    }

    return { draft: tidyDraft(parsed), model, usage: payload.usage };
  } finally {
    clearTimeout(timeout);
  }
}

async function authorizeOrder(input: CopyInput): Promise<OrderQuotaContext | null | NextResponse> {
  if (!isSupabaseAdminConfigured()) return null;

  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!input.orderId) {
    return NextResponse.json(
      { error: "AI 文案功能需要已付款订单", pricingUrl: "/pricing" },
      { status: 402 },
    );
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, plan_id, ai_drafts_used")
    .eq("id", input.orderId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!order || !["paid", "in_progress", "fulfilled"].includes(order.status)) {
    return NextResponse.json(
      { error: "订单尚未付款或不属于当前账号" },
      { status: 403 },
    );
  }

  const plan = getPlan(order.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "订单套餐配置异常" }, { status: 500 });
  }

  const currentUsed = Number(order.ai_drafts_used || 0);
  if (currentUsed >= plan.limits.aiDrafts) {
    return NextResponse.json(
      { error: `当前套餐最多生成 ${plan.limits.aiDrafts} 次 AI 草稿` },
      { status: 429 },
    );
  }

  return {
    orderId: order.id,
    maximumDrafts: plan.limits.aiDrafts,
    currentUsed,
  };
}

async function consumeQuota(context: OrderQuotaContext): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_order_ai_draft", {
    target_order_id: context.orderId,
    maximum_drafts: context.maximumDrafts,
  });

  if (error) throw new Error(error.message);
  if (typeof data !== "number") {
    throw new Error(`当前套餐最多生成 ${context.maximumDrafts} 次 AI 草稿`);
  }
  return data;
}

export async function POST(request: Request) {
  const raw = (await request.json().catch(() => ({}))) as CopyInput;
  if (typeof raw.facts === "string" && raw.facts.length > 10_000) {
    return NextResponse.json(
      { error: "真实细节请控制在 10000 字以内" },
      { status: 413 },
    );
  }

  const input: CopyInput = {
    recipientName: clean(raw.recipientName, 60),
    occasion: clean(raw.occasion, 80),
    facts: clean(raw.facts, 10_000),
    tone: clean(raw.tone, 200),
    relationship: clean(raw.relationship, 80),
    orderId: clean(raw.orderId, 80),
    mode: parseMode(raw.mode),
    length: parseLength(raw.length),
    currentDraft: normalizeCurrentDraft(raw.currentDraft),
  };

  if (!input.facts || input.facts.length < 12) {
    return NextResponse.json(
      { error: "请至少填写一段真实经历或想说的话，再让 AI 帮你整理" },
      { status: 400 },
    );
  }

  const authorized = await authorizeOrder(input);
  if (authorized instanceof NextResponse) return authorized;

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({
      ...fallback(input),
      provider: "local",
      configured: false,
      quotaUsed: false,
      warning: "尚未配置 DeepSeek API Key，当前返回本地基础草稿。",
    });
  }

  try {
    const result = await requestDeepSeek(input);
    let nextUsed: number | undefined;

    if (authorized) {
      nextUsed = await consumeQuota(authorized);
      await addOrderEvent(authorized.orderId, "ai.copy.generated", {
        used: nextUsed,
        provider: "deepseek",
        model: result.model,
        mode: input.mode,
        length: input.length,
      }).catch(console.error);
    }

    return NextResponse.json({
      ...result.draft,
      provider: "deepseek",
      configured: true,
      model: result.model,
      quotaUsed: Boolean(authorized),
      quotaNextUsed: nextUsed,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[deepseek-copy]", error);
    return NextResponse.json(
      {
        ...fallback(input),
        provider: "local",
        configured: true,
        quotaUsed: false,
        warning:
          error instanceof Error
            ? `DeepSeek 暂时不可用：${error.message}。已返回本地草稿，未扣除 AI 次数。`
            : "DeepSeek 暂时不可用，已返回本地草稿，未扣除 AI 次数。",
      },
      { status: 200 },
    );
  }
}
