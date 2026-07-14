import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminClaims } from "@/lib/admin/auth";
import { manualPaymentChannelName, manualPaymentStatusName } from "@/lib/commerce/manual-payments";
import { formatCny, getPlan } from "@/lib/commerce/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "付款审核｜拾光运营后台" };

export default async function AdminPaymentsPage() {
  if (!isSupabaseAdminConfigured()) redirect("/admin");
  const { claims, configured, email } = await requireAdminClaims();
  if (!configured) redirect("/admin");
  if (!claims && !email) redirect("/login?next=/admin/payments");
  if (!claims) redirect("/admin");

  const admin = createAdminClient();
  const { data: proofs, error } = await admin
    .from("manual_payment_proofs")
    .select("id,order_id,payment_channel,amount,transaction_reference,paid_at,review_status,created_at,orders(customer_email,customer_name,plan_id,status)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = proofs ?? [];
  const pendingCount = rows.filter((row) => ["submitted", "reviewing"].includes(row.review_status)).length;
  const approvedCount = rows.filter((row) => row.review_status === "approved").length;
  const rejectedCount = rows.filter((row) => row.review_status === "rejected").length;

  return (
    <main className="commerce-page admin-page">
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/admin"><span>拾</span><div><strong>运营后台</strong><small>PAYMENT REVIEW</small></div></Link>
        <nav><Link href="/admin">订单队列</Link><Link href="/orders">用户订单页</Link></nav>
      </header>
      <section className="commerce-hero compact admin-hero">
        <p className="landing-kicker">MANUAL PAYMENT QUEUE</p>
        <h1>只在核对真实到账后，确认订单已支付。</h1>
        <p>付款截图只是辅助材料，不能代替收款账户中的真实交易记录。</p>
      </section>
      <section className="admin-metric-grid manual-payment-metrics">
        <article><span>待核对</span><strong>{pendingCount}</strong><small>优先处理</small></article>
        <article><span>已通过</span><strong>{approvedCount}</strong><small>已开通制作权限</small></article>
        <article><span>已驳回</span><strong>{rejectedCount}</strong><small>等待客户重传</small></article>
      </section>
      <section className="admin-order-table manual-payment-table">
        <div className="admin-section-heading"><div><p className="landing-kicker">PAYMENT PROOFS</p><h2>付款凭证队列</h2></div><span>{rows.length} 条</span></div>
        {error ? <div className="commerce-alert">{error.message}</div> : null}
        <div className="manual-payment-table-head"><span>客户与套餐</span><span>付款方式</span><span>交易单号</span><span>付款时间</span><span>金额</span><span>状态</span></div>
        {rows.map((row) => {
          const orders = Array.isArray(row.orders) ? row.orders : row.orders ? [row.orders] : [];
          const order = orders[0] as { customer_email?: string; customer_name?: string; plan_id?: string; status?: string } | undefined;
          return (
            <Link className="manual-payment-row" href={`/admin/order/${row.order_id}`} key={row.id}>
              <div><strong>{order?.customer_name || order?.customer_email || "未知客户"}</strong><small>{getPlan(order?.plan_id || "")?.name || order?.plan_id}</small></div>
              <span>{manualPaymentChannelName(row.payment_channel)}</span>
              <code>{row.transaction_reference}</code>
              <span>{new Date(row.paid_at).toLocaleString("zh-CN")}</span>
              <strong>{formatCny(row.amount)}</strong>
              <span className={`manual-review-pill ${row.review_status}`}>{manualPaymentStatusName(row.review_status)}</span>
            </Link>
          );
        })}
        {!rows.length ? <div className="empty-admin-list">当前没有客户提交付款凭证。</div> : null}
      </section>
    </main>
  );
}
