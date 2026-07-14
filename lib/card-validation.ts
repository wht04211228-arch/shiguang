import { normalizeSlug, type CardData, type CardTheme } from "@/lib/card-data";

const themes: CardTheme[] = ["cinema", "starlight", "film"];

function text(value: unknown, fallback = "", max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

export function parseCardData(input: unknown): CardData {
  if (!input || typeof input !== "object")
    throw new Error("贺卡数据格式不正确");
  const raw = input as Partial<CardData>;
  const theme = themes.includes(raw.theme as CardTheme)
    ? (raw.theme as CardTheme)
    : "film";
  const memories = Array.isArray(raw.memories)
    ? raw.memories.slice(0, 30).map((item, index) => ({
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
    ? raw.fragments.slice(0, 20).map((item, index) => ({
        id: text(item?.id, `fragment-${index + 1}`, 100),
        label: text(item?.label, `生活碎片 ${index + 1}`, 120),
        content: text(item?.content, "", 1000),
      }))
    : [];

  const card: CardData = {
    slug: normalizeSlug(text(raw.slug, "my-memory-gift", 100)),
    theme,
    senderName: text(raw.senderName, "送礼人", 80),
    recipientName: text(raw.recipientName, "收件人", 80),
    occasion: text(raw.occasion, "纪念礼物", 120),
    importantDate: text(raw.importantDate, "", 40),
    unlockQuestion: text(raw.unlockQuestion, "", 300),
    unlockAnswer: text(raw.unlockAnswer, "", 300),
    coverKicker: text(raw.coverKicker, "A PRIVATE MEMORY GIFT", 120),
    coverTitle: text(raw.coverTitle, "有一份礼物正在等你打开。", 500),
    coverSubtitle: text(raw.coverSubtitle, "", 500),
    memories,
    fragments,
    letter: Array.isArray(raw.letter)
      ? raw.letter.slice(0, 30).map((item) => text(item, "", 5000))
      : [],
    futurePromises: Array.isArray(raw.futurePromises)
      ? raw.futurePromises.slice(0, 30).map((item) => text(item, "", 500))
      : [],
    musicUrl: text(raw.musicUrl, "", 4000) || undefined,
    musicPath: text(raw.musicPath, "", 500) || undefined,
  };

  if (!card.recipientName || !card.senderName || !card.coverTitle) {
    throw new Error("收件人、送礼人和开场标题不能为空");
  }
  return card;
}
