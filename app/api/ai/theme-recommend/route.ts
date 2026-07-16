import { NextResponse } from "next/server";
import type { ThemeKey } from "@/lib/experience/themes";

type Input = { relationship?: string; occasion?: string; emotions?: string[]; story?: string };
type Result = {
  primary: ThemeKey;
  secondary: ThemeKey;
  primaryFit: string;
  secondaryFit: string;
  primaryReason: string;
  secondaryReason: string;
  transformation: string;
  source: "deepseek" | "rules";
};

type DeepSeekResponse = { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

function rules(input: Input): Result {
  const text = `${input.relationship || ""}${input.occasion || ""}${(input.emotions || []).join("")}${input.story || ""}`;
  let primary: ThemeKey = "film";
  if (/恋人|异地|浪漫|星空|距离|未来/u.test(text)) primary = "galaxy";
  if (/求婚|里程碑|五周年|电影|高仪式|告白/u.test(text)) primary = "cinema";
  const secondary: ThemeKey = primary === "galaxy" ? "cinema" : primary === "cinema" ? "galaxy" : "galaxy";
  return {
    primary,
    secondary,
    primaryFit: "非常适合",
    secondaryFit: "比较适合",
    primaryReason: primary === "galaxy"
      ? "你的故事包含关系中的陪伴、距离或未来期待，用重要日期连接成专属星座会更自然。"
      : primary === "cinema"
        ? "你的场景具有明显的里程碑与仪式感，电影章节、旁白和片尾能够放大故事张力。"
        : "你的内容更强调真实生活与长期陪伴，纸张、照片和手写细节能保留自然温度。",
    secondaryReason: secondary === "cinema"
      ? "如果你希望突出纪念日的仪式感，可以把相遇、变化和未来剪辑成一部私人电影。"
      : "如果你希望表达更克制浪漫，可以把日期和回忆整理成一片专属星空。",
    transformation: input.story?.trim()
      ? `你写下的真实小事“${clean(input.story, 42)}${(input.story || "").length > 42 ? "…" : ""}”会成为主题中的核心故事节点。`
      : "你暂时没有填写真实小事，因此推荐更偏向关系与纪念场景，不会自动编造经历。",
    source: "rules",
  };
}

function isTheme(value: unknown): value is ThemeKey { return value === "film" || value === "galaxy" || value === "cinema"; }

export async function POST(request: Request) {
  const raw = (await request.json().catch(() => ({}))) as Input;
  const input: Input = {
    relationship: clean(raw.relationship, 50),
    occasion: clean(raw.occasion, 80),
    emotions: Array.isArray(raw.emotions) ? raw.emotions.filter((item): item is string => typeof item === "string").slice(0, 3) : [],
    story: clean(raw.story, 800),
  };
  const fallback = rules(input);
  if (!process.env.DEEPSEEK_API_KEY) return NextResponse.json(fallback);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/u, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          { role: "system", content: "你是拾光的主题推荐助手。只能根据用户提供的关系、场景、情绪和真实小事推荐 film、galaxy、cinema。不得编造经历。必须只输出合法 JSON。" },
          { role: "user", content: `请输出 JSON：{"primary":"galaxy","secondary":"cinema","primaryFit":"非常适合","secondaryFit":"比较适合","primaryReason":"...","secondaryReason":"...","transformation":"..."}\n关系：${input.relationship || "未填写"}\n场景：${input.occasion || "未填写"}\n情绪：${(input.emotions || []).join("、") || "未填写"}\n真实小事：${input.story || "未填写"}` },
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.45,
        max_tokens: 800,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = (await response.json()) as DeepSeekResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!response.ok || !content) return NextResponse.json(fallback);
    const parsed = JSON.parse(content) as Partial<Result>;
    if (!isTheme(parsed.primary) || !isTheme(parsed.secondary) || parsed.primary === parsed.secondary) return NextResponse.json(fallback);
    return NextResponse.json({
      primary: parsed.primary,
      secondary: parsed.secondary,
      primaryFit: clean(parsed.primaryFit, 16) || "非常适合",
      secondaryFit: clean(parsed.secondaryFit, 16) || "比较适合",
      primaryReason: clean(parsed.primaryReason, 220) || fallback.primaryReason,
      secondaryReason: clean(parsed.secondaryReason, 220) || fallback.secondaryReason,
      transformation: clean(parsed.transformation, 220) || fallback.transformation,
      source: "deepseek",
    } satisfies Result);
  } catch {
    return NextResponse.json(fallback);
  } finally {
    clearTimeout(timeout);
  }
}
