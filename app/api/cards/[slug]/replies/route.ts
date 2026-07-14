import { NextRequest, NextResponse } from "next/server";
import { getCardAvailability } from "@/lib/cards/availability";
import { replyMoodLabels, type ReplyMood } from "@/lib/card-data";
import { accessCookieName, verifyAccessToken } from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { requireUserClaims } from "@/lib/supabase/auth";
import { sendNotification } from "@/lib/notifications";

type RouteContext = { params: Promise<{ slug: string }> };

const validMoods = new Set<ReplyMood>([
  "touched",
  "happy",
  "surprised",
  "teary",
  "calm",
]);

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseAdminConfigured())
    return NextResponse.json({ replies: [], cloudMode: false });
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { slug } = await context.params;
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
    .from("card_replies")
    .select("id, message, mood, created_at")
    .eq("card_id", card.id)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data ?? [] });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    mood?: ReplyMood;
  };
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 1500) : "";
  const mood = validMoods.has(body.mood as ReplyMood)
    ? (body.mood as ReplyMood)
    : "touched";
  if (!message)
    return NextResponse.json({ error: "请先写下回应" }, { status: 400 });
  if (slug === "sample" || !isSupabaseAdminConfigured())
    return NextResponse.json({ saved: true, demo: true });

  const admin = createAdminClient();
  const { data: card, error } = await admin
    .from("cards")
    .select(
      "id, owner_id, recipient_name, unlock_answer_hash, release_at, expires_at",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!card)
    return NextResponse.json({ error: "没有找到这份礼物" }, { status: 404 });

  const availability = getCardAvailability(card);
  if (availability.state !== "available") {
    return NextResponse.json(
      { error: availability.state === "pending" ? "礼物尚未开启" : "礼物已失效" },
      { status: availability.state === "pending" ? 423 : 410 },
    );
  }

  if (card.unlock_answer_hash) {
    const token = request.cookies.get(accessCookieName(slug))?.value;
    if (!verifyAccessToken(token, card.id)) {
      return NextResponse.json({ error: "请先解锁这份礼物" }, { status: 403 });
    }
  }

  const { error: insertError } = await admin
    .from("card_replies")
    .insert({ card_id: card.id, message, mood });
  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: ownerData } = await admin.auth.admin.getUserById(card.owner_id);
  const ownerEmail = ownerData.user?.email;
  if (ownerEmail) {
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    ).replace(/\/$/, "");
    await sendNotification({
      to: ownerEmail,
      subject: `拾光收到新回复｜${card.recipient_name}`,
      title: `你的数字礼物收到了一条新回应 · ${replyMoodLabels[mood]}`,
      body: message.length > 120 ? `${message.slice(0, 120)}…` : message,
      actionUrl: `${siteUrl}/studio`,
      actionLabel: "查看完整回复",
    }).catch(console.error);
  }
  return NextResponse.json({ saved: true });
}
