import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminClaims } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "内容与隐私复核｜拾光" };

export default async function AdminReportsPage() {
  if (!isSupabaseAdminConfigured()) {
    return <main className="commerce-page"><section className="commerce-hero compact"><h1>内容复核队列</h1><p>连接 Supabase 后显示真实举报。</p></section></main>;
  }
  const { claims, configured, email } = await requireAdminClaims();
  if (!configured) return <main className="card-state-page"><section className="card-state-card"><h1>尚未配置管理员</h1></section></main>;
  if (!claims && !email) redirect("/login?next=/admin/reports");
  if (!claims) return <main className="card-state-page"><section className="card-state-card"><h1>没有权限</h1></section></main>;
  const admin = createAdminClient();
  const { data: reports } = await admin
    .from("content_reports")
    .select("id,card_id,contribution_id,recipient_entry_id,category,detail,status,temporary_hidden,created_at,cards(slug,recipient_name)")
    .in("status", ["submitted", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <main className="commerce-page admin-page">
      <header className="landing-nav commerce-nav"><Link href="/admin">← 运营后台</Link><strong>内容与隐私复核</strong></header>
      <section className="commerce-hero compact"><p className="landing-kicker">TRUST & SAFETY</p><h1>先保护隐私，再判断内容。</h1><p>隐私、安全和疑似违法类别会优先临时隐藏；普通争议不会自动删除整份礼物。</p></section>
      <section className="admin-report-list">
        {(reports ?? []).length ? (reports ?? []).map((report: any) => (
          <article key={report.id}>
            <div><span>{report.category}</span><strong>{report.cards?.recipient_name || "未知礼物"}</strong><small>{new Date(report.created_at).toLocaleString("zh-CN")}</small></div>
            <p>{report.detail}</p>
            <footer><span>{report.temporary_hidden ? "已临时隐藏" : "等待复核"}</span>{report.cards?.slug ? <Link href={`/card/${report.cards.slug}`}>打开礼物</Link> : null}</footer>
          </article>
        )) : <p>当前没有待处理举报。</p>}
      </section>
    </main>
  );
}
