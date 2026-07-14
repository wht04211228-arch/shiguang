import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GiftStudio from "@/components/GiftStudio";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "拾光制作台｜编辑私人数字纪念礼物" };

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  if (!isSupabaseAdminConfigured())
    return <GiftStudio cloudMode={false} orderId={order} />;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login?next=/studio");
  const email =
    typeof data.claims.email === "string" ? data.claims.email : "已登录制作人";
  return <GiftStudio cloudMode userEmail={email} orderId={order} />;
}
