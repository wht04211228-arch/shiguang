type ModerationResult = {
  allowed: boolean;
  reasons: string[];
  provider: "local" | "deepseek";
};

const dangerousPatterns = [
  /javascript\s*:/iu,
  /data\s*:\s*text\/html/iu,
  /<\s*script/iu,
  /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|t\.co)\//iu,
];

const severeLocalPatterns = [
  /身份证.{0,8}\d{15,18}/u,
  /银行卡.{0,8}\d{12,19}/u,
  /(?:威胁|勒索|报复).{0,30}(?:伤害|杀|曝光)/u,
];

export function localTextSafetyCheck(text: string): ModerationResult {
  const reasons: string[] = [];
  if (dangerousPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("内容包含不安全链接或可执行代码");
  }
  if (severeLocalPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("内容可能包含高风险隐私信息或威胁表达");
  }
  return { allowed: reasons.length === 0, reasons, provider: "local" };
}

export async function moderateContributionText(
  text: string,
): Promise<ModerationResult> {
  const local = localTextSafetyCheck(text);
  if (!local.allowed || !process.env.DEEPSEEK_API_KEY) return local;

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/u, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content:
              "你是中文用户投稿安全检查器。只判断文字是否含明显违法、威胁、骚扰、隐私泄露、恶意链接或严重不适合用于私人纪念礼物的内容。不要判断普通情感冲突。只输出JSON。",
          },
          {
            role: "user",
            content: `检查以下投稿：\n${text.slice(0, 5000)}\n输出：{"allowed":true或false,"reasons":["简短原因"]}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 300,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return local;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return local;
    const parsed = JSON.parse(content.replace(/^```json\s*/iu, "").replace(/```$/u, "")) as {
      allowed?: boolean;
      reasons?: unknown;
    };
    return {
      allowed: parsed.allowed !== false,
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.filter((item): item is string => typeof item === "string").slice(0, 4)
        : [],
      provider: "deepseek",
    };
  } catch (error) {
    console.error("[collaboration-moderation]", error);
    return local;
  } finally {
    clearTimeout(timeout);
  }
}
