import { NextRequest, NextResponse } from "next/server";
import { moderateContributionText } from "@/lib/collaboration/moderation";
import { requirePublicCardAccess } from "@/lib/cards/public-access";
import type {
  MemorySpaceSummary,
  RecipientEntry,
  RecipientEntryType,
  RecipientMediaAsset,
} from "@/lib/memory-space/types";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

const validTypes = new Set<RecipientEntryType>([
  "reply",
  "photo",
  "audio",
  "future_update",
  "memory",
]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseMedia(value: unknown, cardId: string): RecipientMediaAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 3)
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const raw = item as Record<string, unknown>;
      const type = raw.type === "audio" ? "audio" : raw.type === "image" ? "image" : null;
      const path = clean(raw.path, 500);
      if (!type || !path || !path.includes(`/${cardId}/`)) return [];
      return [
        {
          type,
          path,
          name: clean(raw.name, 160) || undefined,
        } satisfies RecipientMediaAsset,
      ];
    });
}

async function resolveEntries(
  admin: ReturnType<(typeof import("@/lib/supabase/admin"))["createAdminClient"]>,
  rows: Array<Record<string, any>>,
  currentUserId?: string | null,
): Promise<RecipientEntry[]> {
  const paths = rows
    .flatMap((row) => (Array.isArray(row.media) ? row.media : []))
    .map((item: any) => (typeof item?.path === "string" ? item.path : ""))
    .filter(Boolean);
  const { data } = paths.length
    ? await admin.storage.from("recipient-media").createSignedUrls(paths, 60 * 60)
    : { data: [] as Array<{ path: string; signedUrl: string }> };
  const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
  return rows.map((row) => ({
    id: row.id,
    entryType: row.entry_type,
    content: row.content ?? "",
    media: (Array.isArray(row.media) ? row.media : []).map((item: any) => ({
      type: item.type === "audio" ? "audio" : "image",
      path: item.path,
      name: item.name,
      url: urls.get(item.path) || undefined,
    })),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownedByCurrentUser: Boolean(currentUserId && row.owner_user_id === currentUserId),
  }));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "sample" || !isSupabaseAdminConfigured()) {
    const demo: MemorySpaceSummary = {
      managementPhase: "creator_managed",
      recipientBound: false,
      recipientIsCurrentUser: false,
      canBindAccount: true,
      canRequestInvites: false,
      invitePermissionApproved: false,
      inviteLimitRemaining: 0,
      entries: [],
    };
    return NextResponse.json({ space: demo, demo: true });
  }
  try {
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const { claims } = await requireUserClaims();
    const currentUserId = claims?.sub ?? null;
    const [{ data, error }, { data: member }, { data: collaborationSpace }] = await Promise.all([
      access.admin
        .from("recipient_entries")
        .select("id,owner_user_id,entry_type,content,media,status,created_at,updated_at")
        .eq("card_id", access.card.id)
        .eq("status", "visible")
        .order("created_at", { ascending: true }),
      currentUserId
        ? access.admin
            .from("memory_space_members")
            .select("permissions")
            .eq("card_id", access.card.id)
            .eq("user_id", currentUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      access.card.order_id
        ? access.admin
            .from("collaboration_spaces")
            .select("id,invite_limit")
            .eq("order_id", access.card.order_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (error) throw error;
    const invitePermissionApproved = Boolean(
      (member?.permissions as Record<string, unknown> | null)?.invite_approved,
    );
    let usedInviteCount = 0;
    if (collaborationSpace?.id) {
      const { count } = await access.admin
        .from("collaboration_contributions")
        .select("id", { count: "exact", head: true })
        .eq("space_id", collaborationSpace.id)
        .not("status", "in", '("deleted","withdrawn")');
      usedInviteCount = count ?? 0;
    }
    const space: MemorySpaceSummary = {
      managementPhase: access.card.management_phase,
      recipientBound: Boolean(access.card.recipient_owner_id),
      recipientIsCurrentUser: Boolean(
        currentUserId && access.card.recipient_owner_id === currentUserId,
      ),
      canBindAccount: !access.card.recipient_owner_id,
      canRequestInvites: Boolean(
        currentUserId &&
          access.card.recipient_owner_id === currentUserId &&
          !invitePermissionApproved,
      ),
      invitePermissionApproved,
      inviteLimitRemaining: Math.max(
        0,
        Number(collaborationSpace?.invite_limit ?? 0) - usedInviteCount,
      ),
      entries: await resolveEntries(access.admin, data ?? [], currentUserId),
    };
    return NextResponse.json({ space });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取纪念空间失败" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    entryType?: RecipientEntryType;
    content?: string;
    media?: unknown;
  };
  const entryType = validTypes.has(body.entryType as RecipientEntryType)
    ? (body.entryType as RecipientEntryType)
    : "memory";
  const content = clean(body.content, 3000);
  if (!content && !Array.isArray(body.media)) {
    return NextResponse.json({ error: "请写下内容或添加一份素材" }, { status: 400 });
  }
  if (slug === "sample" || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ saved: true, demo: true });
  }
  try {
    const access = await requirePublicCardAccess(request, slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const media = parseMedia(body.media, access.card.id);
    if (!content && !media.length) throw new Error("请写下内容或添加一份素材");
    if (content) {
      const moderation = await moderateContributionText(content);
      if (!moderation.allowed) {
        return NextResponse.json(
          { error: "这段文字没有通过安全检查", reasons: moderation.reasons },
          { status: 422 },
        );
      }
    }
    const { claims } = await requireUserClaims();
    const ownerUserId =
      claims?.sub && access.card.recipient_owner_id === claims.sub ? claims.sub : null;
    const { data, error } = await access.admin
      .from("recipient_entries")
      .insert({
        card_id: access.card.id,
        owner_user_id: ownerUserId,
        entry_type: entryType,
        content: content || null,
        media,
        status: "visible",
      })
      .select("id,owner_user_id,entry_type,content,media,status,created_at,updated_at")
      .single();
    if (error) throw error;
    const [entry] = await resolveEntries(access.admin, [data], claims?.sub ?? null);
    return NextResponse.json({ saved: true, entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存纪念内容失败" },
      { status: 400 },
    );
  }
}
