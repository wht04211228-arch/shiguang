import { NextResponse } from "next/server";
import { ensureReferralCode } from "@/lib/growth/referrals";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ code: "SGDEMO88", clickCount: 12, paidOrderCount: 2, demo: true });
  }
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { data, error } = await supabase
    .from("referral_codes")
    .select("code,click_count,paid_order_count,status,created_at")
    .eq("owner_id", claims.sub)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ? {
    code: data.code,
    clickCount: data.click_count,
    paidOrderCount: data.paid_order_count,
    status: data.status,
  } : { code: null });
}

export async function POST() {
  if (!isSupabaseAdminConfigured()) return NextResponse.json({ code: "SGDEMO88", demo: true });
  const { claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const code = await ensureReferralCode(claims.sub);
    return NextResponse.json({ code: code.code, clickCount: code.click_count, paidOrderCount: code.paid_order_count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "推荐码生成失败" }, { status: 400 });
  }
}
