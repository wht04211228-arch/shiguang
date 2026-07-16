import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { isThemeKey, type ThemeKey } from "@/lib/experience/themes";

type Input = {
  draftKey?: string;
  theme?: string;
  plan?: string;
  relationship?: string;
  occasion?: string;
  emotions?: string[];
  story?: string;
};

type Preview = { coverTitle: string; coverSubtitle: string; excerpt: string; source: "deepseek" | "fallback" };
type DeepSeekResponse = { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } };

const localUsedDrafts = new Set<string>();
const localResults = new Map<string, Preview>();

function clean(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function fallback(theme: ThemeKey, input: Input): Preview {
  const relationship = clean(input.relationship, 60) || "重要的人";
  const occasion = clean(input.occasion, 80) || "这个重要的日子";
  const story = clean(input.story, 260) || "那些看起来普通、却一直被认真分享的日子";
  if (theme === "galaxy") {
    return {
      coverTitle: "距离之外，我们仍在同一片星空",
      coverSubtitle: `写给${relationship}的${occasion}礼物，把分散的日常连接成专属星座。`,
      excerpt: `我想从一件真实的小事开始写起：${story}。有些陪伴不一定发生在同一个地点，却会在每一次分享里，慢慢成为彼此生活的一部分。`,
      source: "fallback",
    };
  }
  if (theme === "cinema") {
    return {
      coverTitle: "我们的故事，仍在下一幕继续",
      coverSubtitle: `一部写给${relationship}的私人电影，为${occasion}重新剪辑共同经历。`,
      excerpt: `Chapter 01。故事不是从宏大的场景开始，而是从这件被记住的小事开始：${story}。后来回头看，才发现很多重要时刻，在发生时都很普通。`,
      source: "fallback",
    };
  }
  return {
    coverTitle: "把普通却珍贵的日子，重新装订成册",
    coverSubtitle: `写给${relationship}的${occasion}礼物，让真实照片与手写文字慢慢展开。`,
    excerpt: `我想先把这件一直记得的小事放进相册：${story}。它可能并不盛大，却是时间走过去以后，仍然会让人想起温度的画面。`,
    source: "fallback",
  };
}

function validPreview(value: unknown): value is Omit<Preview, "source"> {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Preview>;
  return typeof item.coverTitle === "string" && typeof item.coverSubtitle === "string" && typeof item.excerpt === "string";
}

async function getStored(draftKey: string): Promise<Preview | null> {
  if (!isSupabaseAdminConfigured()) return localResults.get(draftKey) || null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("ai_preview_drafts").select("result").eq("draft_key", draftKey).maybeSingle();
  const result = data?.result as Preview | undefined;
  return result || null;
}

async function markUsed(draftKey: string, input: Input, result: Preview): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    localUsedDrafts.add(draftKey);
    localResults.set(draftKey, result);
    return;
  }
  const supabase = createAdminClient();
  await supabase.from("ai_preview_drafts").upsert({
    draft_key: draftKey,
    input: input,
    result,
    used_count: 1,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "draft_key" });
}

export async function POST(request: Request) {
  const raw = (await request.json().catch(() => ({}))) as Input;
  const draftKey = clean(raw.draftKey, 120);
  const theme = clean(raw.theme, 20);
  if (!draftKey) return NextResponse.json({ error: "缺少草稿标识，请刷新页面后重试" }, { status: 400 });
  if (!isThemeKey(theme)) return NextResponse.json({ error: "主题无效" }, { status: 400 });

  const existing = await getStored(draftKey);
  if (existing) return NextResponse.json(existing);
  if (!isSupabaseAdminConfigured() && localUsedDrafts.has(draftKey)) {
    return NextResponse.json({ error: "这个草稿已经使用过一次免费 AI 预览" }, { status: 409 });
  }

  const input: Input = {
    draftKey,
    theme,
    plan: clean(raw.plan, 20),
    relationship: clean(raw.relationship, 80),
    occasion: clean(raw.occasion, 100),
    emotions: Array.isArray(raw.emotions) ? raw.emotions.filter((item): item is string => typeof item === "string").slice(0, 3) : [],
    story: clean(raw.story, 800),
  };
  let result = fallback(theme, input);

  if (process.env.DEEPSEEK_API_KEY) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/u, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
          messages: [
            {
              role: "system",
              content: "你是拾光私人数字纪念礼物的中文文案策划师。只依据用户提供的真实信息生成短预览，不得编造地点、日期、事件、人物关系或承诺。表达真实、克制、具体。只输出合法 JSON。",
            },
            {
              role: "user",
              content: [
                `主题：${theme}`,
                `关系：${input.relationship || "未填写"}`,
                `场景：${input.occasion || "未填写"}`,
                `情绪：${(input.emotions || []).join("、") || "未填写"}`,
                `真实小事：${input.story || "未填写"}`,
                "请只生成一次付款前短预览，JSON 结构：",
                '{"coverTitle":"不超过36字","coverSubtitle":"不超过70字","excerpt":"一小段故事示例，120至220字"}',
              ].join("\n"),
            },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          temperature: 0.65,
          max_tokens: 900,
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = (await response.json()) as DeepSeekResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (response.ok && content) {
        const parsed = JSON.parse(content) as unknown;
        if (validPreview(parsed)) {
          result = {
            coverTitle: clean(parsed.coverTitle, 80),
            coverSubtitle: clean(parsed.coverSubtitle, 160),
            excerpt: clean(parsed.excerpt, 600),
            source: "deepseek",
          };
        }
      }
    } catch {
      // Use safe local fallback without consuming a broken API result.
    } finally {
      clearTimeout(timeout);
    }
  }

  await markUsed(draftKey, input, result);
  return NextResponse.json(result);
}
