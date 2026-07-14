import type { CardData, CardSummary } from "@/lib/card-data";
import { createAdminClient } from "@/lib/supabase/admin";

type CardRow = {
  id: string;
  owner_id: string;
  order_id: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  theme: CardData["theme"];
  sender_name: string;
  recipient_name: string;
  occasion: string;
  important_date: string | null;
  relationship_start_date: string | null;
  release_at: string | null;
  expires_at: string | null;
  unlock_question: string;
  unlock_answer_hash: string | null;
  cover_kicker: string;
  cover_title: string;
  cover_subtitle: string;
  content: {
    memories?: CardData["memories"];
    fragments?: CardData["fragments"];
    collaborations?: CardData["collaborations"];
    quiz?: CardData["quiz"];
    letter?: string[];
    futurePromises?: string[];
    surprise?: CardData["surprise"];
    preReleaseTitle?: string;
    preReleaseMessage?: string;
    musicUrl?: string;
    musicPath?: string;
  } | null;
  updated_at: string;
  view_count: number | null;
  reply_count: number | null;
};

export function rowToCard(row: CardRow): CardData {
  const content = row.content ?? {};
  return {
    slug: row.slug,
    theme: row.theme,
    senderName: row.sender_name,
    recipientName: row.recipient_name,
    occasion: row.occasion,
    importantDate: row.important_date ?? "",
    relationshipStartDate: row.relationship_start_date ?? undefined,
    releaseAt: row.release_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    preReleaseTitle: content.preReleaseTitle,
    preReleaseMessage: content.preReleaseMessage,
    unlockQuestion: row.unlock_question,
    unlockAnswer: "",
    coverKicker: row.cover_kicker,
    coverTitle: row.cover_title,
    coverSubtitle: row.cover_subtitle,
    memories: content.memories ?? [],
    fragments: content.fragments ?? [],
    collaborations: content.collaborations ?? [],
    quiz: content.quiz,
    letter: content.letter ?? [],
    futurePromises: content.futurePromises ?? [],
    surprise: content.surprise,
    musicUrl: content.musicUrl,
    musicPath: content.musicPath,
  };
}

export function cardToRow(
  card: CardData,
  ownerId: string,
  status: CardRow["status"],
  orderId?: string | null,
) {
  return {
    owner_id: ownerId,
    ...(orderId ? { order_id: orderId } : {}),
    slug: card.slug,
    status,
    theme: card.theme,
    sender_name: card.senderName.trim(),
    recipient_name: card.recipientName.trim(),
    occasion: card.occasion.trim(),
    important_date: card.importantDate || null,
    relationship_start_date: card.relationshipStartDate || null,
    release_at: card.releaseAt || null,
    expires_at: card.expiresAt || null,
    unlock_question: card.unlockQuestion.trim(),
    cover_kicker: card.coverKicker.trim(),
    cover_title: card.coverTitle.trim(),
    cover_subtitle: card.coverSubtitle.trim(),
    content: {
      memories: card.memories.map(({ image, ...memory }) => ({
        ...memory,
        ...(memory.imagePath
          ? { imagePath: memory.imagePath }
          : image?.startsWith("http")
            ? { image }
            : {}),
      })),
      fragments: card.fragments,
      collaborations: card.collaborations ?? [],
      quiz: card.quiz,
      letter: card.letter,
      futurePromises: card.futurePromises,
      surprise: card.surprise,
      preReleaseTitle: card.preReleaseTitle,
      preReleaseMessage: card.preReleaseMessage,
      ...(card.musicPath
        ? { musicPath: card.musicPath }
        : card.musicUrl?.startsWith("http")
          ? { musicUrl: card.musicUrl }
          : {}),
    },
    published_at: status === "published" ? new Date().toISOString() : null,
  };
}

export async function resolveMedia(card: CardData): Promise<CardData> {
  const admin = createAdminClient();
  const paths = [
    ...card.memories.map((memory) => memory.imagePath).filter(Boolean),
    card.musicPath,
  ].filter(Boolean) as string[];
  const collaborationPaths = (card.collaborations ?? [])
    .flatMap((item) => item.media.map((media) => media.path))
    .filter(Boolean);

  if (!paths.length && !collaborationPaths.length) return card;
  const { data } = paths.length
    ? await admin.storage.from("card-media").createSignedUrls(paths, 60 * 60 * 24)
    : { data: [] };
  const { data: collaborationData } = collaborationPaths.length
    ? await admin.storage.from("collaboration-media").createSignedUrls(collaborationPaths, 60 * 60 * 24)
    : { data: [] };
  const urlByPath = new Map(
    (data ?? []).map((item) => [item.path, item.signedUrl]),
  );
  const collaborationUrlByPath = new Map(
    (collaborationData ?? []).map((item) => [item.path, item.signedUrl]),
  );

  return {
    ...card,
    memories: card.memories.map((memory) => ({
      ...memory,
      image: memory.imagePath
        ? (urlByPath.get(memory.imagePath) ?? memory.image)
        : memory.image,
    })),
    musicUrl: card.musicPath
      ? (urlByPath.get(card.musicPath) ?? card.musicUrl)
      : card.musicUrl,
    collaborations: (card.collaborations ?? []).map((item) => ({
      ...item,
      media: item.media.map((media) => ({
        ...media,
        url: media.path ? (collaborationUrlByPath.get(media.path) ?? media.url) : media.url,
      })),
    })),
  };
}

export function rowToSummary(row: CardRow): CardSummary {
  return {
    slug: row.slug,
    recipientName: row.recipient_name,
    occasion: row.occasion,
    theme: row.theme,
    status: row.status,
    updatedAt: row.updated_at,
    viewCount: row.view_count ?? 0,
    replyCount: row.reply_count ?? 0,
    releaseAt: row.release_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

export type { CardRow };
