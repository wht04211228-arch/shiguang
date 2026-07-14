import { NextRequest, NextResponse } from "next/server";
import { sampleCard } from "@/lib/card-data";
import { getCardAvailability } from "@/lib/cards/availability";
import { resolveMedia, rowToCard, type CardRow } from "@/lib/db/cards";
import {
  accessCookieName,
  createAccessToken,
  verifyAnswer,
} from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { answer?: string };
  const answer = typeof body.answer === "string" ? body.answer : "";

  if (slug === "sample") {
    if (
      answer.trim().toLocaleLowerCase("zh-CN") !==
      sampleCard.unlockAnswer.toLocaleLowerCase("zh-CN")
    ) {
      return NextResponse.json(
        { error: "答案还差一点，再想想属于你们的那一天。" },
        { status: 401 },
      );
    }
    return NextResponse.json({ card: sampleCard, unlocked: true });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ card: { ...sampleCard, slug }, unlocked: true });
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
  const availability = getCardAvailability(row);
  if (availability.state === "pending") {
    return NextResponse.json(
      { error: "还没有到开启时间。", availableAt: availability.releaseAt },
      { status: 423 },
    );
  }
  if (availability.state === "expired") {
    return NextResponse.json(
      { error: "这份礼物已经结束展示。" },
      { status: 410 },
    );
  }

  if (!verifyAnswer(answer, row.unlock_answer_hash)) {
    return NextResponse.json(
      { error: "答案还差一点，再想想属于你们的那一天。" },
      { status: 401 },
    );
  }

  const maxAge = 60 * 60 * 24 * 30;
  const response = NextResponse.json({
    card: await resolveMedia(rowToCard(row)),
    unlocked: true,
  });
  response.cookies.set(
    accessCookieName(slug),
    createAccessToken(row.id, maxAge),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    },
  );
  await admin.rpc("increment_card_view", { target_card_id: row.id });
  await admin
    .from("collaboration_spaces")
    .update({ recipient_opened_at: new Date().toISOString() })
    .eq("card_id", row.id)
    .is("recipient_opened_at", null);
  return response;
}
