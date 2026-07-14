import { NextResponse } from "next/server";
import type { CardInsights } from "@/lib/card-data";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type RouteContext = { params: Promise<{ slug: string }> };

type EventRow = {
  session_id: string;
  event_type: string;
  stage_key: string | null;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseAdminConfigured()) {
    const demo: CardInsights = {
      totalEvents: 0,
      uniqueSessions: 0,
      unlocks: 0,
      completions: 0,
      replies: 0,
      surpriseOpens: 0,
      stageViews: {},
    };
    return NextResponse.json({ insights: demo, demo: true });
  }
  const { slug } = await context.params;
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (cardError)
    return NextResponse.json({ error: cardError.message }, { status: 500 });
  if (!card)
    return NextResponse.json({ error: "没有找到这份礼物" }, { status: 404 });

  const { data, error } = await supabase
    .from("card_engagement_events")
    .select("session_id, event_type, stage_key")
    .eq("card_id", card.id)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as EventRow[];
  const stageViews: Record<string, number> = {};
  for (const row of rows) {
    if (row.event_type === "stage_viewed" && row.stage_key) {
      stageViews[row.stage_key] = (stageViews[row.stage_key] ?? 0) + 1;
    }
  }
  const insights: CardInsights = {
    totalEvents: rows.length,
    uniqueSessions: new Set(rows.map((item) => item.session_id)).size,
    unlocks: rows.filter((item) => item.event_type === "unlocked").length,
    completions: rows.filter((item) => item.event_type === "completed").length,
    replies: rows.filter((item) => item.event_type === "reply_submitted").length,
    surpriseOpens: rows.filter((item) => item.event_type === "surprise_opened").length,
    stageViews,
  };
  return NextResponse.json({ insights });
}
