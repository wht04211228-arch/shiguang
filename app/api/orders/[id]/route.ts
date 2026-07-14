import { NextResponse } from "next/server";
import { getPlan } from "@/lib/commerce/plans";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ order: null, cloudMode: false });
  }
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("orders")
    .select("id, plan_id, status, amount, ai_drafts_used, created_at, paid_at, fulfilled_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  const plan = getPlan(data.plan_id);
  if (!plan) return NextResponse.json({ error: "套餐配置异常" }, { status: 500 });
  return NextResponse.json({ order: data, plan });
}
