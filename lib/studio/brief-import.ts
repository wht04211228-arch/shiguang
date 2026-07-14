import {
  cloneSampleCard,
  normalizeSlug,
  type CardData,
  type CardTheme,
  type MemoryItem,
} from "@/lib/card-data";

export type StudioBriefContext = {
  orderId: string;
  recipientName: string;
  relationship: string;
  occasion: string;
  deliveryDate?: string;
  preferredTheme: "cinema" | "starlight" | "film" | "unsure";
  tone: "warm" | "romantic" | "restrained" | "playful" | "solemn";
  storyFacts: string[];
  mustInclude?: string;
  avoidContent?: string;
  contactMethod?: string;
  specialRequests?: string;
  submittedAt?: string;
};

const toneLabels: Record<StudioBriefContext["tone"], string> = {
  warm: "温暖真实",
  romantic: "浪漫深情",
  restrained: "克制高级",
  playful: "轻松俏皮",
  solemn: "郑重正式",
};

export function getBriefToneLabel(tone: StudioBriefContext["tone"]) {
  return toneLabels[tone];
}

function themeFromBrief(theme: StudioBriefContext["preferredTheme"]): CardTheme {
  return theme === "unsure" ? "film" : theme;
}

function factTitle(fact: string, index: number) {
  const compact = fact.replace(/\s+/g, " ").trim();
  if (!compact) return `第 ${index + 1} 段回忆`;
  const firstClause = compact.split(/[，。！？；,.!?;]/)[0]?.trim() || compact;
  return firstClause.length <= 18 ? firstClause : `${firstClause.slice(0, 17)}…`;
}

function briefMemories(storyFacts: string[]): MemoryItem[] {
  return storyFacts.map((fact, index) => ({
    id: `brief-memory-${index + 1}`,
    date: "",
    title: factTitle(fact, index),
    text: fact,
    location: "",
  }));
}

function coverCopy(brief: StudioBriefContext) {
  switch (brief.tone) {
    case "romantic":
      return {
        title: `想把一路走来的心动与陪伴，再认真送给${brief.recipientName}一次。`,
        subtitle: `写给我的${brief.relationship}，在这个${brief.occasion}。`,
      };
    case "restrained":
      return {
        title: `关于我们，有些时间值得被郑重保存。`,
        subtitle: `这是一份写给${brief.recipientName}的${brief.occasion}纪念。`,
      };
    case "playful":
      return {
        title: `给${brief.recipientName}准备了一份小小惊喜，请按顺序打开。`,
        subtitle: `里面装着一些只有我们才懂的日子。`,
      };
    case "solemn":
      return {
        title: `谨以这份礼物，纪念我们共同经历的重要时刻。`,
        subtitle: `写给${brief.recipientName}，也写给一路走来的我们。`,
      };
    case "warm":
    default:
      return {
        title: `我把与你有关的那些日子，整理成了一份礼物。`,
        subtitle: `写给我的${brief.relationship}，愿这个${brief.occasion}被认真记住。`,
      };
  }
}

function letterFromBrief(brief: StudioBriefContext) {
  const paragraphs = (brief.mustInclude ?? "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length) {
    return [
      `这是一份写给${brief.recipientName}的${brief.occasion}礼物。`,
      ...paragraphs.slice(0, 6),
      `我把这些话放在这里，是希望你能慢慢看完，也知道它们都来自真实的在意。`,
    ];
  }

  return [
    `这是一份写给${brief.recipientName}的${brief.occasion}礼物。`,
    `我想把那些值得记住的时刻重新整理一次，也把平时没有好好说出口的话留在这里。`,
    `愿你打开它的时候，能感受到这份准备背后的认真。`,
  ];
}

export function buildCardFromBrief(brief: StudioBriefContext): CardData {
  const base = cloneSampleCard();
  const copy = coverCopy(brief);
  const memories = briefMemories(brief.storyFacts);

  return {
    ...base,
    slug: normalizeSlug(`${brief.recipientName}-${brief.occasion}-${brief.orderId.slice(-6)}`),
    theme: themeFromBrief(brief.preferredTheme),
    senderName: "我",
    recipientName: brief.recipientName,
    occasion: brief.occasion,
    importantDate: "",
    relationshipStartDate: undefined,
    releaseAt: undefined,
    expiresAt: undefined,
    unlockQuestion: `只有${brief.recipientName}知道的问题`,
    unlockAnswer: "",
    coverKicker: "A PRIVATE MEMORY GIFT",
    coverTitle: copy.title,
    coverSubtitle: copy.subtitle,
    memories: memories.length ? memories : [],
    fragments: [],
    collaborations: [],
    quiz: {
      enabled: false,
      question: "关于我们的一个小问题",
      options: ["陪伴", "幸运"],
      answerIndex: 0,
      successMessage: "答对了。",
      retryMessage: "再想想那些最熟悉的细节。",
    },
    letter: letterFromBrief(brief),
    futurePromises: [],
    surprise: {
      enabled: false,
      title: "最后还有一个惊喜",
      message: "这份惊喜只属于你。",
      code: "",
      buttonLabel: "打开惊喜",
      buttonUrl: "",
    },
    musicUrl: undefined,
    musicPath: undefined,
  };
}

export function mergeBriefIntoCard(current: CardData, brief: StudioBriefContext): CardData {
  const mapped = buildCardFromBrief(brief);
  const nonBriefMemories = current.memories.filter((item) => !item.id.startsWith("brief-memory-"));

  return {
    ...current,
    theme: mapped.theme,
    recipientName: mapped.recipientName,
    occasion: mapped.occasion,
    coverTitle: mapped.coverTitle,
    coverSubtitle: mapped.coverSubtitle,
    memories: [...mapped.memories, ...nonBriefMemories],
    letter: mapped.letter,
  };
}
