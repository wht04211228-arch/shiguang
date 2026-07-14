import { NextResponse } from "next/server";
import { trackReferralClick } from "@/lib/growth/referrals";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ ok: true, demo: true });
  const body = (await request.json().catch(() => ({}))) as { code?: string; sessionId?: string };
  if (!body.code || !body.sessionId || body.sessionId.length < 8)
    return NextResponse.json({ error: "推荐参数不完整" }, { status: 400 });
  try {
    const referral = await trackReferralClick({ code: body.code, sessionId: body.sessionId });
    return NextResponse.json({ ok: true, valid: Boolean(referral) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "推荐记录失败" }, { status: 400 });
  }
}
