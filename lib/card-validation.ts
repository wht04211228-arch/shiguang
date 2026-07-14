import {
  normalizeSlug,
  type CardData,
  type CollaborationGiftItem,
  type CardQuiz,
  type CardSurprise,
  type CardTheme,
} from "@/lib/card-data";

const themes: CardTheme[] = ["cinema", "starlight", "film"];

function text(value: unknown, fallback = "", max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function optionalDate(value: unknown): string | undefined {
  const raw = text(value, "", 80);
  if (!raw) return undefined;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function parseQuiz(value: unknown): CardQuiz | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<CardQuiz>;
  const options = Array.isArray(raw.options)
    ? raw.options.slice(0, 6).map((item) => text(item, "", 160)).filter(Boolean)
    : [];
  if (options.length < 2) return undefined;
  const index = Number.isInteger(raw.answerIndex)
    ? Math.min(Math.max(Number(raw.answerIndex), 0), options.length - 1)
    : 0;
  return {
    enabled: Boolean(raw.enabled),
    question: text(raw.question, "关于我们的一个小问题", 500),
    options,
    answerIndex: index,
    successMessage: text(raw.successMessage, "答对了。", 500),
    retryMessage: text(raw.retryMessage, "再想想。", 500),
  };
}

function parseSurprise(value: unknown): CardSurprise | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<CardSurprise>;
  return {
    enabled: Boolean(raw.enabled),
    title: text(raw.title, "最后还有一个惊喜", 300),
    message: text(raw.message, "这份惊喜只属于你。", 2000),
    code: text(raw.code, "", 120) || undefined,
    buttonLabel: text(raw.buttonLabel, "打开惊喜", 120) || undefined,
    buttonUrl: text(raw.buttonUrl, "", 1000) || undefined,
  };
}

export function parseCardData(input: unknown): CardData {
  if (!input || typeof input !== "object")
    throw new Error("贺卡数据格式不正确");
  const raw = input as Partial<CardData>;
  const theme = themes.includes(raw.theme as CardTheme)
    ? (raw.theme as CardTheme)
    : "film";
  const memories = Array.isArray(raw.memories)
    ? raw.memories.slice(0, 60).map((item, index) => ({
        id: text(item?.id, `memory-${index + 1}`, 100),
        date: text(item?.date, "", 40),
        title: text(item?.title, `回忆 ${index + 1}`, 160),
        text: text(item?.text, "", 3000),
        location: text(item?.location, "", 160),
        image: text(item?.image, "", 4000) || undefined,
        imagePath: text(item?.imagePath, "", 500) || undefined,
      }))
    : [];
  const fragments = Array.isArray(raw.fragments)
    ? raw.fragments.slice(0, 30).map((item, index) => ({
        id: text(item?.id, `fragment-${index + 1}`, 100),
        label: text(item?.label, `生活碎片 ${index + 1}`, 120),
        content: text(item?.content, "", 1000),
      }))
    : [];
  const collaborations: CollaborationGiftItem[] = Array.isArray(raw.collaborations)
    ? raw.collaborations.slice(0, 100).map((item, index) => ({
        id: text(item?.id, `collaboration-${index + 1}`, 100),
        displayName: text(item?.displayName, "匿名祝福", 80),
        anonymousToRecipient: Boolean(item?.anonymousToRecipient),
        message: text(item?.message, "", 5000),
        media: Array.isArray(item?.media)
          ? item.media.slice(0, 5).map((media) => ({
              type: (media?.type === "audio" || media?.type === "video" ? media.type : "image") as "image" | "audio" | "video",
              path: text(media?.path, "", 500),
              url: text(media?.url, "", 4000) || undefined,
              name: text(media?.name, "", 160) || undefined,
              durationSeconds: Number.isFinite(Number(media?.durationSeconds)) ? Number(media?.durationSeconds) : undefined,
            })).filter((media) => media.path || media.url)
          : [],
      }))
    : [];

  const card: CardData = {
    slug: normalizeSlug(text(raw.slug, "my-memory-gift", 100)),
    theme,
    senderName: text(raw.senderName, "送礼人", 80),
    recipientName: text(raw.recipientName, "收件人", 80),
    occasion: text(raw.occasion, "纪念礼物", 120),
    importantDate: text(raw.importantDate, "", 40),
    relationshipStartDate: text(raw.relationshipStartDate, "", 40) || undefined,
    releaseAt: optionalDate(raw.releaseAt),
    expiresAt: optionalDate(raw.expiresAt),
    preReleaseTitle:
      text(raw.preReleaseTitle, "这份礼物还在等待最合适的时刻", 300) ||
      undefined,
    preReleaseMessage:
      text(raw.preReleaseMessage, "倒计时结束后，它会自动开启。", 800) ||
      undefined,
    unlockQuestion: text(raw.unlockQuestion, "", 300),
    unlockAnswer: text(raw.unlockAnswer, "", 300),
    coverKicker: text(raw.coverKicker, "A PRIVATE MEMORY GIFT", 120),
    coverTitle: text(raw.coverTitle, "有一份礼物正在等你打开。", 500),
    coverSubtitle: text(raw.coverSubtitle, "", 500),
    memories,
    fragments,
    collaborations,
    quiz: parseQuiz(raw.quiz),
    letter: Array.isArray(raw.letter)
      ? raw.letter.slice(0, 30).map((item) => text(item, "", 5000))
      : [],
    futurePromises: Array.isArray(raw.futurePromises)
      ? raw.futurePromises.slice(0, 30).map((item) => text(item, "", 500))
      : [],
    surprise: parseSurprise(raw.surprise),
    musicUrl: text(raw.musicUrl, "", 4000) || undefined,
    musicPath: text(raw.musicPath, "", 500) || undefined,
  };

  if (!card.recipientName || !card.senderName || !card.coverTitle) {
    throw new Error("收件人、送礼人和开场标题不能为空");
  }
  if (
    card.releaseAt &&
    card.expiresAt &&
    Date.parse(card.expiresAt) <= Date.parse(card.releaseAt)
  ) {
    throw new Error("失效时间必须晚于定时开启时间");
  }
  return card;
}
