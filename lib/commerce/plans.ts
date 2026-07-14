export type PlanId = "light" | "deep" | "private";

export type GiftPlan = {
  id: PlanId;
  name: string;
  tagline: string;
  priceCents: number;
  compareAtCents?: number;
  badge?: string;
  features: string[];
  limits: {
    memories: number;
    revisions: number;
    aiDrafts: number;
    retentionDays: number | null;
  };
};

export const giftPlans: GiftPlan[] = [
  {
    id: "light",
    name: "轻定制",
    tagline: "快速完成一份有仪式感的专属礼物",
    priceCents: 2900,
    features: [
      "C · 温暖胶片主线主题",
      "最多 8 段回忆",
      "照片与背景音乐",
      "专属链接与二维码",
      "收件人私密回复",
    ],
    limits: { memories: 8, revisions: 1, aiDrafts: 3, retentionDays: 365 },
  },
  {
    id: "deep",
    name: "深度定制",
    tagline: "适合生日、纪念日和重要关系表达",
    priceCents: 9900,
    compareAtCents: 12900,
    badge: "主推",
    features: [
      "A/B/C 三主题切换",
      "最多 20 段回忆",
      "AI 文案整理与润色",
      "声音、未来约定与双向回复",
      "长期链接与自主修改",
    ],
    limits: { memories: 20, revisions: 3, aiDrafts: 12, retentionDays: null },
  },
  {
    id: "private",
    name: "私人策划",
    tagline: "一对一梳理故事，完成独一无二的数字礼物",
    priceCents: 29900,
    features: [
      "专属故事结构设计",
      "最多 60 段回忆",
      "人工文案策划",
      "专属视觉与复杂交互",
      "优先交付与人工修改服务",
    ],
    limits: { memories: 60, revisions: 5, aiDrafts: 30, retentionDays: null },
  },
];

export function getPlan(
  planId: string | null | undefined,
): GiftPlan | undefined {
  return giftPlans.find((plan) => plan.id === planId);
}

export function formatCny(cents: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}
