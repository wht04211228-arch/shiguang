import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GiftStudio from "@/components/GiftStudio";
import type { CardData } from "@/lib/card-data";
import { rowToCard, resolveMedia, type CardRow } from "@/lib/db/cards";
import {
  buildCardFromBrief,
  type StudioBriefContext,
} from "@/lib/studio/brief-import";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "拾光制作台｜编辑私人数字纪念礼物" };

type StudioSearchParams = {
  order?: string;
  step?: string;
  brief?: string;
};

function toBriefContext(
  orderId: string,
  data: Record<string, unknown>,
): StudioBriefContext {
  return {
    orderId,
    recipientName: String(data.recipient_name ?? "").trim(),
    relationship: String(data.relationship ?? "").trim(),
    occasion: String(data.occasion ?? "").trim(),
    deliveryDate: data.delivery_date ? String(data.delivery_date) : undefined,
    preferredTheme: (data.preferred_theme ?? "film") as StudioBriefContext["preferredTheme"],
    tone: (data.tone ?? "warm") as StudioBriefContext["tone"],
    storyFacts: Array.isArray(data.story_facts)
      ? data.story_facts.filter((item): item is string => typeof item === "string")
      : [],
    mustInclude: data.must_include ? String(data.must_include) : undefined,
    avoidContent: data.avoid_content ? String(data.avoid_content) : undefined,
    contactMethod: data.contact_method ? String(data.contact_method) : undefined,
    specialRequests: data.special_requests ? String(data.special_requests) : undefined,
    submittedAt: data.submitted_at ? String(data.submitted_at) : undefined,
  };
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<StudioSearchParams>;
}) {
  const { order, step, brief } = await searchParams;
  if (!isSupabaseAdminConfigured()) {
    return (
      <GiftStudio
        cloudMode={false}
        orderId={order}
        initialStep={step}
        briefJustImported={brief === "imported"}
      />
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login?next=/studio");

  let briefContext: StudioBriefContext | undefined;
  let initialCard: CardData | undefined;
  let initialHasStoredAnswer = false;

  if (order) {
    const [{ data: orderRow }, { data: briefRow }, { data: cardRow }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,status")
        .eq("id", order)
        .maybeSingle(),
      supabase
        .from("order_briefs")
        .select("*")
        .eq("order_id", order)
        .maybeSingle(),
      supabase
        .from("cards")
        .select("*")
        .eq("order_id", order)
        .maybeSingle(),
    ]);

    if (!orderRow) redirect("/orders");
    if (!["paid", "in_progress", "fulfilled"].includes(orderRow.status)) {
      redirect(`/order/${order}`);
    }

    if (briefRow && ["submitted", "reviewed"].includes(String(briefRow.status))) {
      briefContext = toBriefContext(order, briefRow as Record<string, unknown>);
    }

    if (cardRow) {
      initialCard = await resolveMedia(rowToCard(cardRow as CardRow));
      initialHasStoredAnswer = Boolean((cardRow as { unlock_answer_hash?: string | null }).unlock_answer_hash);
    } else if (briefContext) {
      initialCard = buildCardFromBrief(briefContext);
    }
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "已登录制作人";

  return (
    <GiftStudio
      cloudMode
      userEmail={email}
      orderId={order}
      initialStep={step}
      initialCard={initialCard}
      initialHasStoredAnswer={initialHasStoredAnswer}
      briefContext={briefContext}
      briefJustImported={brief === "imported"}
    />
  );
}
