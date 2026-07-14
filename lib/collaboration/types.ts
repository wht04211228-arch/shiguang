import type { PlanId } from "@/lib/commerce/plans";

export type InviteTierId = "none" | "three" | "ten" | "thirty" | "hundred";
export type RetentionTierId = "days30" | "year1" | "years3" | "longterm";
export type CollaborationMode = "secret" | "wall";
export type ContributionStatus =
  | "submitted"
  | "approved"
  | "changes_requested"
  | "hidden"
  | "withdrawal_pending"
  | "withdrawn"
  | "deleted";

export type InviteTier = {
  id: InviteTierId;
  label: string;
  limit: number;
  priceCents: number;
  description: string;
};

export type RetentionTier = {
  id: RetentionTierId;
  label: string;
  days: number | null;
  priceCents: number;
  description: string;
};

export const inviteTiers: InviteTier[] = [
  {
    id: "none",
    label: "暂不邀请",
    limit: 0,
    priceCents: 0,
    description: "先完成自己的内容，之后仍可补差价开启共创。",
  },
  {
    id: "three",
    label: "基础共创 · 3人",
    limit: 3,
    priceCents: 990,
    description: "适合邀请最亲近的朋友或家人。",
  },
  {
    id: "ten",
    label: "聚会共创 · 10人",
    limit: 10,
    priceCents: 1990,
    description: "适合宿舍、好友群和小型聚会。",
  },
  {
    id: "thirty",
    label: "大型共创 · 30人",
    limit: 30,
    priceCents: 3990,
    description: "适合班级、社团、婚礼与毕业纪念。",
  },
  {
    id: "hundred",
    label: "大型纪念 · 最多100人",
    limit: 100,
    priceCents: 6990,
    description: "适合大型集体祝福；系统仍保留100人安全上限。",
  },
];

export const retentionTiers: RetentionTier[] = [
  {
    id: "days30",
    label: "30天",
    days: 30,
    priceCents: 0,
    description: "套餐默认包含，适合短期送礼与体验。",
  },
  {
    id: "year1",
    label: "1年",
    days: 365,
    priceCents: 990,
    description: "适合下一次生日或纪念日再次打开。",
  },
  {
    id: "years3",
    label: "3年",
    days: 1095,
    priceCents: 1990,
    description: "适合毕业、婚礼和长期关系纪念。",
  },
  {
    id: "longterm",
    label: "长期纪念",
    days: null,
    priceCents: 4990,
    description: "在产品持续运营期间长期保存，并提供数据导出能力。",
  },
];

export function getInviteTier(id: string | null | undefined): InviteTier {
  return inviteTiers.find((tier) => tier.id === id) ?? inviteTiers[0];
}

export function getRetentionTier(
  id: string | null | undefined,
): RetentionTier {
  return retentionTiers.find((tier) => tier.id === id) ?? retentionTiers[0];
}

export function collaborationVideoLimit(planId: PlanId) {
  if (planId === "light") return { count: 0, seconds: 0 };
  if (planId === "deep") return { count: 3, seconds: 30 };
  return { count: 10, seconds: 60 };
}

export function computeRetentionExpiry(
  tierId: RetentionTierId,
  from = new Date(),
): string | null {
  const tier = getRetentionTier(tierId);
  if (tier.days === null) return null;
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + tier.days);
  return expires.toISOString();
}

export function computeAddonTotal(
  inviteTierId: InviteTierId,
  retentionTierId: RetentionTierId,
) {
  return (
    getInviteTier(inviteTierId).priceCents +
    getRetentionTier(retentionTierId).priceCents
  );
}

export function computeUpgradeDifference(
  current: { inviteTier: InviteTierId; retentionTier: RetentionTierId },
  target: { inviteTier: InviteTierId; retentionTier: RetentionTierId },
) {
  const currentInvite = getInviteTier(current.inviteTier);
  const targetInvite = getInviteTier(target.inviteTier);
  const currentRetention = getRetentionTier(current.retentionTier);
  const targetRetention = getRetentionTier(target.retentionTier);
  if (targetInvite.limit < currentInvite.limit) {
    throw new Error("邀请人数只能向上升级，不能降级");
  }
  const retentionRank = retentionTiers.findIndex(
    (item) => item.id === current.retentionTier,
  );
  const targetRetentionRank = retentionTiers.findIndex(
    (item) => item.id === target.retentionTier,
  );
  if (targetRetentionRank < retentionRank) {
    throw new Error("保存期限只能向上升级，不能降级");
  }
  return Math.max(
    0,
    targetInvite.priceCents +
      targetRetention.priceCents -
      currentInvite.priceCents -
      currentRetention.priceCents,
  );
}

export type CollaborationSpaceSummary = {
  id: string;
  cardId: string | null;
  orderId: string;
  mode: CollaborationMode;
  inviteTier: InviteTierId;
  inviteLimit: number;
  contributionCount: number;
  approvedCount: number;
  openedCount: number;
  submissionsOpen: boolean;
  contributionDeadline: string | null;
  publicInviteUrl?: string;
};

export type CollaborationContribution = {
  id: string;
  displayName: string;
  anonymousToRecipient: boolean;
  message: string;
  media: Array<{
    type: "image" | "audio" | "video";
    path: string;
    url?: string;
    name?: string;
    durationSeconds?: number;
  }>;
  status: ContributionStatus;
  sortOrder: number;
  createdAt: string;
  submitterUserId?: string | null;
  inviteLabel?: string | null;
  moderationNote?: string | null;
};
