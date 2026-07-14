export type CardTheme = "cinema" | "starlight" | "film";

export type MemoryItem = {
  id: string;
  date: string;
  title: string;
  text: string;
  location?: string;
  image?: string;
  imagePath?: string;
};

export type StoryFragment = {
  id: string;
  label: string;
  content: string;
};

export type CardData = {
  slug: string;
  theme: CardTheme;
  senderName: string;
  recipientName: string;
  occasion: string;
  importantDate: string;
  unlockQuestion: string;
  unlockAnswer: string;
  coverKicker: string;
  coverTitle: string;
  coverSubtitle: string;
  memories: MemoryItem[];
  fragments: StoryFragment[];
  letter: string[];
  futurePromises: string[];
  musicUrl?: string;
  musicPath?: string;
};

export type CardSummary = {
  slug: string;
  recipientName: string;
  occasion: string;
  theme: CardTheme;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  viewCount: number;
  replyCount: number;
};

export const themeNames: Record<CardTheme, string> = {
  cinema: "A · 电影感高级浪漫",
  starlight: "B · 梦幻星空与童话感",
  film: "C · 温暖胶片与真实生活感",
};

export const sampleCard: CardData = {
  slug: "sample",
  theme: "film",
  senderName: "一个很在乎你的人",
  recipientName: "小满",
  occasion: "生日纪念",
  importantDate: "2024-05-20",
  unlockQuestion: "我们故事开始的月份是？",
  unlockAnswer: "5月",
  coverKicker: "A PRIVATE MEMORY GIFT",
  coverTitle: "我把我们一起经历过的时间，重新整理成了一份礼物。",
  coverSubtitle: "有些日子过去了，但并没有真正离开。",
  memories: [
    {
      id: "memory-1",
      date: "2024.05.20",
      title: "故事开始的那一天",
      location: "一条普通的街道",
      text: "那一天没有盛大的音乐，也没有提前写好的台词。只是从那之后，普通的日子开始有了值得记录的理由。",
    },
    {
      id: "memory-2",
      date: "2024.08.03",
      title: "第一次一起去看海",
      location: "海风很大的傍晚",
      text: "照片并不完美，但我很喜欢。因为它留下的不只是风景，还有当时站在我身边的你。",
    },
    {
      id: "memory-3",
      date: "2025.01.01",
      title: "一起跨过的新年",
      location: "零点之后的路灯下",
      text: "我们说了很多关于未来的话。后来我才明白，最珍贵的不是答案，而是那一刻我们都认真相信未来里会有彼此。",
    },
  ],
  fragments: [
    {
      id: "fragment-1",
      label: "一张票根",
      content: "那场电影的结局已经忘了，但记得散场后一起走了很久。",
    },
    {
      id: "fragment-2",
      label: "一句聊天记录",
      content: "“到家告诉我。”是最普通，也最让我安心的一句话。",
    },
    {
      id: "fragment-3",
      label: "一首歌",
      content: "每次前奏响起，都会想起同一段路和同一个人。",
    },
    {
      id: "fragment-4",
      label: "一张随手拍",
      content: "没有构图，没有滤镜，却比很多精心准备的照片更值得保存。",
    },
  ],
  letter: [
    "我记得很多看起来并不重要的瞬间。",
    "记得你笑起来的样子，记得一起走过的路，也记得那些没有拍下照片、却一直留在心里的日子。",
    "我把它们放在这里，不是为了回到过去，而是想告诉你：这些时间，因为有你，才变得值得珍藏。",
    "愿以后仍然有很多普通的日子，可以由我们一起把它们变成回忆。",
  ],
  futurePromises: [
    "一起去看一次海边日出",
    "拍更多不完美却真实的照片",
    "认真庆祝每一个值得纪念的小日子",
    "继续记录普通的每一天",
  ],
};

export function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "my-memory-gift";
}

export function cloneSampleCard(): CardData {
  return JSON.parse(JSON.stringify(sampleCard)) as CardData;
}

export function lockedCard(card: CardData): CardData {
  return {
    ...card,
    unlockAnswer: "",
    memories: [],
    fragments: [],
    letter: [],
    futurePromises: [],
    musicUrl: undefined,
    musicPath: undefined,
  };
}
