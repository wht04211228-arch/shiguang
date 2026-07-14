import { NextResponse } from "next/server";
import { requireUserClaims } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseAdminConfigured())
    return NextResponse.json({ orders: [], cloudMode: false });
  const { supabase, claims } = await requireUserClaims();
  if (!claims?.sub)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { data, error } = await supabase
    .from("orders")
    .select("*, cards(slug, recipient_name, status)")
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [], cloudMode: true });
}
