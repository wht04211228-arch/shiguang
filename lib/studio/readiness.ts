import type { CardData } from "@/lib/card-data";

export type StudioMetric = {
  score: number;
  nextAction: string;
  reason: string;
  checklist: Array<{
    key: string;
    label: string;
    done: boolean;
    required: boolean;
  }>;
};

function longEnough(value: string | undefined, min: number) {
  return Boolean(value && value.trim().length >= min);
}

export function calculateReadiness(card: CardData): StudioMetric {
  const checklist = [
    {
      key: "people",
      label: "收件人与送礼人信息完整",
      done: longEnough(card.recipientName, 1) && longEnough(card.senderName, 1),
      required: true,
    },
    {
      key: "occasion",
      label: "送礼场景和重要日期已设置",
      done: longEnough(card.occasion, 2) && longEnough(card.importantDate, 6),
      required: true,
    },
    {
      key: "cover",
      label: "封面文案已经完成",
      done: longEnough(card.coverTitle, 12) && longEnough(card.coverSubtitle, 6),
      required: true,
    },
    {
      key: "unlock",
      label: "礼物解锁方式已设置",
      done: longEnough(card.unlockQuestion, 4) && longEnough(card.unlockAnswer, 1),
      required: true,
    },
    {
      key: "memories",
      label: "至少准备3段真实回忆",
      done:
        card.memories.filter(
          (item) => longEnough(item.title, 2) && longEnough(item.text, 20),
        ).length >= 3,
      required: true,
    },
    {
      key: "letter",
      label: "专属信件包含真实表达",
      done: card.letter.join("").trim().length >= 80,
      required: true,
    },
    {
      key: "future",
      label: "至少留下2条未来约定",
      done: card.futurePromises.filter((item) => longEnough(item, 5)).length >= 2,
      required: false,
    },
    {
      key: "surprise",
      label: "已准备互动问答或隐藏惊喜",
      done: Boolean(card.quiz?.enabled || card.surprise?.enabled),
      required: false,
    },
  ];
  const weights = checklist.map((item) => (item.required ? 14 : 8));
  const totalWeight = weights.reduce((sum, item) => sum + item, 0);
  const completed = checklist.reduce(
    (sum, item, index) => sum + (item.done ? weights[index] : 0),
    0,
  );
  const score = Math.min(100, Math.round((completed / totalWeight) * 100));
  const next = checklist.find((item) => !item.done && item.required) ??
    checklist.find((item) => !item.done);
  return {
    score,
    nextAction: next ? next.label : "进行发布前检查并正式发布",
    reason: next?.required
      ? "这是礼物完整体验所需的关键内容。"
      : next
        ? "补充这一项会让礼物更有情绪层次。"
        : "核心内容已经齐全，可以检查手机端效果。",
    checklist,
  };
}

export function calculateEmotionalRichness(card: CardData) {
  let score = 0;
  const detailedMemories = card.memories.filter(
    (item) => item.text.trim().length >= 45,
  );
  score += Math.min(30, detailedMemories.length * 7);
  score += Math.min(15, card.memories.filter((item) => item.image).length * 5);
  score += Math.min(20, Math.floor(card.letter.join("").length / 60) * 4);
  score += Math.min(10, card.fragments.filter((item) => item.content.length >= 15).length * 3);
  score += Math.min(10, card.futurePromises.filter((item) => item.length >= 6).length * 3);
  if (card.musicUrl || card.musicPath) score += 5;
  if (card.quiz?.enabled) score += 5;
  if (card.surprise?.enabled) score += 5;
  return Math.min(100, score);
}

export function getPacingSuggestions(card: CardData) {
  const suggestions: string[] = [];
  const images = card.memories.filter((item) => item.image).length;
  const detailed = card.memories.filter((item) => item.text.length >= 35).length;
  if (card.coverTitle.length > 60) {
    suggestions.push("封面标题较长，建议控制在两行内，让第一幕更有停顿感。");
  }
  if (images >= 8 && detailed < Math.ceil(images / 2)) {
    suggestions.push("照片较多但真实故事偏少，建议为至少一半照片补充具体细节。");
  }
  if (card.letter.join("").length > 600) {
    suggestions.push("信件篇幅较长，可以拆成更短段落，让收件人更容易读完。");
  }
  if (!card.futurePromises.length) {
    suggestions.push("结尾缺少未来约定，建议留下一件可以一起完成的小事。");
  }
  if (!card.surprise?.enabled && !card.quiz?.enabled) {
    suggestions.push("当前叙事较平直，可以加入一个小问答或隐藏惊喜作为情绪转折。");
  }
  return suggestions.length
    ? suggestions
    : ["当前情绪节奏较完整，建议最后用手机全屏预览一次。"];
}
