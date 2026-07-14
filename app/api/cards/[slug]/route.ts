import { NextRequest, NextResponse } from "next/server";
import { lockedCard, sampleCard } from "@/lib/card-data";
import { getCardAvailability } from "@/lib/cards/availability";
import { resolveMedia, rowToCard, type CardRow } from "@/lib/db/cards";
import { accessCookieName, verifyAccessToken } from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const editorMode = request.nextUrl.searchParams.get("editor") === "1";

  if (editorMode) {
    if (!isSupabaseAdminConfigured())
      return NextResponse.json({ error: "云端环境尚未配置" }, { status: 503 });
    const { supabase, claims } = await requireUserClaims();
    if (!claims)
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)
      return NextResponse.json({ error: "没有找到这份礼物" }, { status: 404 });
    const row = data as CardRow;
    return NextResponse.json({
      card: await resolveMedia(rowToCard(row)),
      hasUnlockAnswer: Boolean(row.unlock_answer_hash),
      orderId: row.order_id,
      source: "supabase-owner",
    });
  }

  if (slug === "sample") {
    return NextResponse.json({
      card: lockedCard(sampleCard),
      locked: true,
      source: "sample",
    });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      card: { ...sampleCard, slug },
      locked: false,
      source: "local-fallback",
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cards")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: "这份礼物不存在或尚未发布" },
      { status: 404 },
    );

  const row = data as CardRow;
  const card = rowToCard(row);
  const availability = getCardAvailability(row);
  if (availability.state === "expired") {
    return NextResponse.json(
      {
        error: "这份礼物已经结束展示。",
        expired: true,
        expiresAt: availability.expiresAt,
      },
      { status: 410 },
    );
  }
  if (availability.state === "pending") {
    return NextResponse.json({
      card: lockedCard(card),
      locked: true,
      releasePending: true,
      availableAt: availability.releaseAt,
      source: "supabase-public",
    });
  }

  const token = request.cookies.get(accessCookieName(slug))?.value;
  const unlocked = !row.unlock_answer_hash || verifyAccessToken(token, row.id);

  if (unlocked) {
    await admin.rpc("increment_card_view", { target_card_id: row.id });
    await admin
      .from("collaboration_spaces")
      .update({ recipient_opened_at: new Date().toISOString() })
      .eq("card_id", row.id)
      .is("recipient_opened_at", null);
  }
  return NextResponse.json({
    card: unlocked ? await resolveMedia(card) : lockedCard(card),
    locked: !unlocked,
    source: "supabase-public",
  });
}
