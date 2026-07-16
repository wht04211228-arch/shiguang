import Link from "next/link";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import SiteHeader from "@/components/brand/SiteHeader";
import { caseStudies } from "@/lib/cases";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "案例与评价｜拾光" };

type PublicReview = {
  order_id: string;
  rating: number;
  testimonial: string | null;
  display_name: string | null;
  created_at: string;
};

async function loadPublicReviews() {
  if (!isSupabaseAdminConfigured()) return [] as Array<PublicReview & { alias?: string | null }>;
  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from("customer_reviews")
    .select("order_id,rating,testimonial,display_name,created_at")
    .eq("status", "approved")
    .eq("public_consent", true)
    .not("testimonial", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);
  const rows = (reviews || []) as PublicReview[];
  if (!rows.length) return [];
  const { data: permissions } = await admin
    .from("case_permissions")
    .select("order_id,allow_quote,public_alias,revoked_at")
    .in("order_id", rows.map((row) => row.order_id))
    .eq("allow_quote", true)
    .is("revoked_at", null);
  const byOrder = new Map((permissions || []).map((row) => [row.order_id, row]));
  return rows
    .filter((row) => byOrder.has(row.order_id))
    .slice(0, 6)
    .map((row) => ({ ...row, alias: byOrder.get(row.order_id)?.public_alias || null }));
}

export default async function CasesPage() {
  const publicReviews = await loadPublicReviews();
  return (
    <main className="commerce-page cases-page">
      <AnalyticsEvent name="cases_viewed" />
      <SiteHeader active="cases" />
      <section className="commerce-hero cases-hero">
        <p className="landing-kicker">STORIES & VERIFIED FEEDBACK</p>
        <h1>真正让人愿意付钱的，不是特效，而是“这就是我们的故事”。</h1>
        <p>前三组为演示型案例结构；公开评价仅展示经过客户授权并由运营审核通过的内容。</p>
      </section>
      <section className="case-grid">
        {caseStudies.map((item, index) => (
          <article className={`case-card case-${item.theme}`} key={item.slug}>
            <div className="case-visual">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.theme === "film" ? "那些普通但珍贵的日子" : item.theme === "starlight" ? "在同一片星空下" : "A FILM FOR TWO"}</strong>
            </div>
            <div className="case-copy">
              <small>{item.tag}</small>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <ul>{item.highlights.map((value) => <li key={value}>{value}</li>)}</ul>
              <strong className="case-result">{item.result}</strong>
            </div>
          </article>
        ))}
      </section>
      {publicReviews.length ? (
        <section className="public-review-section">
          <div className="admin-section-heading"><div><p className="landing-kicker">CUSTOMER VOICES</p><h2>经过授权的真实评价</h2></div><span>{publicReviews.length} 条</span></div>
          <div className="public-review-grid">
            {publicReviews.map((review) => (
              <article key={review.order_id}>
                <span>{"★".repeat(review.rating)}</span>
                <blockquote>{review.testimonial}</blockquote>
                <small>{review.alias || review.display_name || "匿名用户"} · {new Date(review.created_at).toLocaleDateString("zh-CN")}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="landing-cta cases-cta">
        <p>YOUR STORY, NOT A TEMPLATE</p>
        <h2>先体验完整样片，再决定你想把哪段关系认真保存下来。</h2>
        <div><Link className="landing-primary" href="/demo/galaxy">体验完整样片</Link><Link className="landing-secondary" href="/pricing">查看套餐</Link></div>
      </section>
    </main>
  );
}
