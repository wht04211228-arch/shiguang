import Link from "next/link";
import { redirect } from "next/navigation";
import BriefForm, { type BriefData } from "@/components/BriefForm";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const metadata = { title: "制作需求问卷｜拾光" };

export default async function BriefPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const query = await searchParams;
  const orderId = query.order || "demo";
  let existing: Partial<BriefData> | null = null;

  if (isSupabaseAdminConfigured()) {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) redirect(`/login?next=/brief?order=${encodeURIComponent(orderId)}`);
    const { data: order } = await supabase.from("orders").select("id,status").eq("id", orderId).maybeSingle();
    if (!order || !["paid", "in_progress", "fulfilled"].includes(order.status)) redirect("/orders");
    const { data } = await supabase.from("order_briefs").select("*").eq("order_id", orderId).maybeSingle();
    if (data) {
      existing = {
        recipientName: data.recipient_name,
        relationship: data.relationship,
        occasion: data.occasion,
        deliveryDate: data.delivery_date ?? "",
        preferredTheme: data.preferred_theme,
        tone: data.tone,
        storyFactsText: Array.isArray(data.story_facts) ? data.story_facts.join("\n") : "",
        mustInclude: data.must_include ?? "",
        avoidContent: data.avoid_content ?? "",
        contactMethod: data.contact_method ?? "",
        specialRequests: data.special_requests ?? "",
      };
    }
  }

  return (
    <main className="commerce-page brief-page">
      <AnalyticsEvent name="brief_started" metadata={{ orderId }} />
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/"><span>拾</span><div><strong>拾光</strong><small>CREATIVE BRIEF</small></div></Link>
        <nav><Link href={`/order/${orderId}`}>返回订单</Link><Link href="/legal/privacy">隐私说明</Link></nav>
      </header>
      <section className="commerce-hero compact brief-hero">
        <p className="landing-kicker">CUSTOMIZATION BRIEF</p>
        <h1>先把故事讲清楚，再把礼物做漂亮。</h1>
        <p>这些信息仅用于制作你的专属数字礼物。真实细节越具体，成品越不像模板。</p>
      </section>
      <BriefForm orderId={orderId} existing={existing} />
    </main>
  );
}
