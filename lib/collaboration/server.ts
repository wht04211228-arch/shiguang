import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getInviteTier,
  getRetentionTier,
  type CollaborationContribution,
  type CollaborationSpaceSummary,
  type InviteTierId,
  type RetentionTierId,
} from "@/lib/collaboration/types";

export function createOpaqueToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function hashCollaborationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTokenHint(token: string) {
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export async function getOwnedOrder(orderId: string, ownerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureCollaborationSpace(input: {
  orderId: string;
  ownerId: string;
  mode?: "secret" | "wall";
  deadline?: string | null;
}) {
  const admin = createAdminClient();
  const order = await getOwnedOrder(input.orderId, input.ownerId);
  if (!order) throw new Error("订单不存在或不属于当前账号");
  if (!["paid", "in_progress", "fulfilled"].includes(order.status)) {
    throw new Error("付款确认后才能开启多人共创");
  }
  const tier = getInviteTier(order.invite_tier);
  const { data: existing, error: readError } = await admin
    .from("collaboration_spaces")
    .select("*")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;

  const publicToken = tier.limit > 0 ? createOpaqueToken() : null;
  const { data, error } = await admin
    .from("collaboration_spaces")
    .insert({
      order_id: input.orderId,
      owner_id: input.ownerId,
      mode: input.mode ?? "secret",
      invite_tier: tier.id,
      invite_limit: tier.limit,
      public_token_hash: publicToken ? hashCollaborationToken(publicToken) : null,
      public_token_hint: publicToken ? safeTokenHint(publicToken) : null,
      contribution_deadline: input.deadline || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, publicToken };
}

export async function getSpaceSummary(orderId: string, ownerId: string) {
  const admin = createAdminClient();
  const { data: space, error } = await admin
    .from("collaboration_spaces")
    .select("*")
    .eq("order_id", orderId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!space) return null;
  const [{ count: contributionCount }, { count: approvedCount }, { count: openedCount }] =
    await Promise.all([
      admin
        .from("collaboration_contributions")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id)
        .not("status", "in", '("deleted","withdrawn")'),
      admin
        .from("collaboration_contributions")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id)
        .eq("status", "approved"),
      admin
        .from("collaboration_invites")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id)
        .in("status", ["opened", "submitted"]),
    ]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return {
    id: space.id,
    cardId: space.card_id,
    orderId: space.order_id,
    mode: space.mode,
    inviteTier: space.invite_tier,
    inviteLimit: space.invite_limit,
    contributionCount: contributionCount ?? 0,
    approvedCount: approvedCount ?? 0,
    openedCount: openedCount ?? 0,
    submissionsOpen: space.submissions_open,
    contributionDeadline: space.contribution_deadline,
    publicInviteUrl: undefined,
    siteUrl,
  } as CollaborationSpaceSummary & { siteUrl: string };
}

export async function findInviteByToken(token: string) {
  const admin = createAdminClient();
  const hash = hashCollaborationToken(token);
  const { data: invite, error } = await admin
    .from("collaboration_invites")
    .select("*, collaboration_spaces(*)")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (invite) return { invite, space: invite.collaboration_spaces };

  const { data: space, error: spaceError } = await admin
    .from("collaboration_spaces")
    .select("*")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (spaceError) throw spaceError;
  return space ? { invite: null, space } : null;
}

export function isInviteAccepting(input: {
  space: Record<string, any>;
  invite?: Record<string, any> | null;
  contributionExists?: boolean;
}) {
  const now = Date.now();
  if (!input.space.submissions_open || input.space.locked_at) {
    return { allowed: false, reason: "这次共创已经关闭" };
  }
  if (input.invite?.status === "revoked") {
    return { allowed: false, reason: "这条专属邀请已被撤销" };
  }
  const deadline = input.invite?.deadline_override || input.space.contribution_deadline;
  if (deadline && new Date(deadline).getTime() < now && !input.contributionExists) {
    return { allowed: false, reason: "新增投稿已经截止" };
  }
  return { allowed: true, reason: "" };
}

export async function listContributions(spaceId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("collaboration_contributions")
    .select("*, collaboration_invites(label)")
    .eq("space_id", spaceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const media = Array.isArray(row.media) ? row.media : [];
      const signed = await Promise.all(
        media.map(async (item: any) => {
          if (!item?.path) return item;
          const { data: urlData } = await admin.storage
            .from("collaboration-media")
            .createSignedUrl(item.path, 60 * 60);
          return { ...item, url: urlData?.signedUrl };
        }),
      );
      return {
        id: row.id,
        displayName: row.display_name,
        anonymousToRecipient: row.anonymous_to_recipient,
        message: row.message,
        media: signed,
        status: row.status,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        submitterUserId: row.submitter_user_id,
        inviteLabel: row.collaboration_invites?.label ?? null,
        moderationNote: row.moderation_note,
      } satisfies CollaborationContribution;
    }),
  );
}

export function normalizeEntitlements(input: {
  inviteTier?: string;
  retentionTier?: string;
}) {
  const invite = getInviteTier(input.inviteTier as InviteTierId);
  const retention = getRetentionTier(input.retentionTier as RetentionTierId);
  return { invite, retention };
}
