import { NextRequest, NextResponse } from "next/server";
import { accessCookieName, verifyAccessToken } from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type RouteContext = { params: Promise<{ slug: string }> };

const allowedEvents = new Set([
  "opened",
  "countdown_viewed",
  "unlocked",
  "stage_viewed",
  "quiz_completed",
  "surprise_opened",
  "completed",
  "reply_submitted",
]);

const publicEvents = new Set(["opened", "countdown_viewed"]);

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSupabaseAdminConfigured())
    return NextResponse.json({ ok: true, demo: true });
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    eventType?: string;
    stageKey?: string;
    metadata?: Record<string, unknown>;
  };
  if (
    !body.sessionId ||
    body.sessionId.length < 8 ||
    body.sessionId.length > 120 ||
    !body.eventType ||
    !allowedEvents.has(body.eventType)
  ) {
    return NextResponse.json({ error: "无效互动事件" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: card, error } = await admin
    .from("cards")
    .select("id, unlock_answer_hash")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!card)
    return NextResponse.json({ error: "没有找到这份礼物" }, { status: 404 });

  if (!publicEvents.has(body.eventType) && card.unlock_answer_hash) {
    const token = request.cookies.get(accessCookieName(slug))?.value;
    if (!verifyAccessToken(token, card.id)) {
      return NextResponse.json({ error: "请先解锁礼物" }, { status: 403 });
    }
  }

  const safeMetadata = Object.fromEntries(
    Object.entries(body.metadata ?? {})
      .slice(0, 12)
      .map(([key, value]) => [key.slice(0, 80), value]),
  );
  const { error: insertError } = await admin
    .from("card_engagement_events")
    .insert({
      card_id: card.id,
      session_id: body.sessionId,
      event_type: body.eventType,
      stage_key: body.stageKey?.slice(0, 80) || null,
      metadata: safeMetadata,
    });
  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
