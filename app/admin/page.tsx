import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminClaims } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { formatCny, getPlan } from "@/lib/commerce/plans";

export const dynamic = "force-dynamic";

export const metadata = { title: "运营后台｜拾光" };

export default async function AdminPage() {
  if (!isSupabaseAdminConfigured()) {
    return <main className="commerce-page admin-page"><section className="commerce-hero compact"><p className="landing-kicker">ADMIN DEMO</p><h1>运营后台预览</h1><p>连接 Supabase 并配置 ADMIN_EMAILS 后，这里将展示真实订单、制作进度、退款申请和转化漏斗。</p></section><section className="admin-metric-grid"><article><span>今日成交</span><strong>3</strong><small>演示数据</small></article><article><span>待提交问卷</span><strong>5</strong><small>演示数据</small></article><article><span>制作中</span><strong>8</strong><small>演示数据</small></article><article><span>待处理退款</span><strong>1</strong><small>演示数据</small></article></section></main>;
  }
  const { claims, configured, email } = await requireAdminClaims();
  if (!configured) return <main className="card-state-page"><section className="card-state-card"><span>!</span><h1>尚未配置管理员</h1><p>在环境变量 ADMIN_EMAILS 中填写允许进入后台的登录邮箱，多个邮箱使用英文逗号分隔。</p></section></main>;
  if (!claims && !email) redirect("/login?next=/admin");
  if (!claims) return <main className="card-state-page"><section className="card-state-card"><span>×</span><h1>没有运营后台权限</h1><p>当前登录账号不在 ADMIN_EMAILS 白名单中。</p><Link className="button-primary" href="/">返回首页</Link></section></main>;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: orders }, { data: refunds }, { data: events }, { data: tasks }, { data: reviews }, { data: referrals }, { data: manualProofs }] = await Promise.all([
    admin.from("orders").select("id,plan_id,status,amount,customer_email,customer_name,service_stage,priority,due_at,assignee,created_at,order_briefs(status,recipient_name)").order("created_at", { ascending: false }).limit(100),
    admin.from("refund_requests").select("id,status,order_id,reason,requested_at").eq("status", "pending").order("requested_at", { ascending: false }).limit(20),
    admin.from("conversion_events").select("event_name,session_id,created_at").gte("created_at", since).limit(10000),
    admin.from("production_tasks").select("id,status,due_at,order_id").neq("status", "done").limit(500),
    admin.from("order_reviews").select("id,status,order_id,created_at").eq("status", "pending").limit(500),
    admin.from("referral_codes").select("click_count,paid_order_count,status").eq("status", "active").limit(500),
    admin.from("manual_payment_proofs").select("id,review_status,order_id,created_at").in("review_status", ["submitted", "reviewing"]).order("created_at", { ascending: false }).limit(200),
  ]);
  const orderRows = orders ?? [];
  const eventRows = events ?? [];
  const eventCount = (name: string) => eventRows.filter((event) => event.event_name === name).length;
  const paidRevenue = orderRows.filter((order) => ["paid", "in_progress", "fulfilled"].includes(order.status)).reduce((sum, order) => sum + order.amount, 0);
  const uniqueSessions = (name: string) => new Set(eventRows.filter((event) => event.event_name === name).map((event) => event.session_id)).size;
  const pricingSessions = uniqueSessions("pricing_viewed");
  const checkoutSessions = uniqueSessions("checkout_started");
  const paidEvents = uniqueSessions("payment_succeeded");
  const overdueTasks = (tasks ?? []).filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length;
  const referralClicks = (referrals ?? []).reduce((sum, row) => sum + Number(row.click_count || 0), 0);
  const referralPaid = (referrals ?? []).reduce((sum, row) => sum + Number(row.paid_order_count || 0), 0);

  return (
    <main className="commerce-page admin-page">
      <header className="landing-nav commerce-nav"><Link className="landing-brand" href="/"><span>拾</span><div><strong>拾光</strong><small>OPERATIONS</small></div></Link><nav><Link href="/admin/payments">付款审核</Link><Link href="/orders">用户订单页</Link><Link href="/cases">案例页</Link></nav></header>
      <section className="commerce-hero compact admin-hero"><p className="landing-kicker">OPERATIONS DASHBOARD</p><h1>从成交到交付，一眼看清哪里需要处理。</h1><p>当前管理员：{String(claims.email)}</p></section>
      <section className="admin-metric-grid">
        <article><span>订单收入</span><strong>{formatCny(paidRevenue)}</strong><small>最近 100 笔订单</small></article>
        <article><span>待核对付款</span><strong>{manualProofs?.length ?? 0}</strong><small><Link href="/admin/payments">进入审核队列</Link></small></article>
        <article><span>等待问卷</span><strong>{orderRows.filter((order) => order.service_stage === "waiting_brief").length}</strong><small>应主动提醒</small></article>
        <article><span>制作中</span><strong>{orderRows.filter((order) => ["planning", "producing", "reviewing"].includes(order.service_stage)).length}</strong><small>关注交付日期</small></article>
        <article><span>待确认初稿</span><strong>{reviews?.length ?? 0}</strong><small>客户尚未反馈</small></article>
        <article><span>逾期任务</span><strong>{overdueTasks}</strong><small>需要重新分配</small></article>
        <article><span>推荐转化</span><strong>{referralPaid}</strong><small>{referralClicks} 次打开</small></article>
        <article><span>待处理退款</span><strong>{refunds?.length ?? 0}</strong><small>需要人工审核</small></article>
      </section>
      <section className="admin-funnel">
        <div><p className="landing-kicker">30-DAY FUNNEL</p><h2>最近 30 天转化漏斗</h2></div>
        <div className="funnel-row"><article><span>套餐页访客</span><strong>{pricingSessions}</strong></article><i>→</i><article><span>发起结账</span><strong>{checkoutSessions}</strong><small>{pricingSessions ? Math.round(checkoutSessions / pricingSessions * 100) : 0}%</small></article><i>→</i><article><span>支付成功</span><strong>{paidEvents}</strong><small>{checkoutSessions ? Math.round(paidEvents / checkoutSessions * 100) : 0}%</small></article><i>→</i><article><span>提交问卷</span><strong>{eventCount("brief_submitted")}</strong></article></div>
      </section>
      <section className="admin-order-table">
        <div className="admin-section-heading"><div><p className="landing-kicker">ORDER QUEUE</p><h2>订单与制作队列</h2></div><span>{orderRows.length} 笔</span></div>
        <div className="admin-table-head"><span>客户与套餐</span><span>阶段</span><span>优先级</span><span>交付</span><span>金额</span></div>
        {orderRows.map((order) => {
          const briefs = Array.isArray(order.order_briefs) ? order.order_briefs : order.order_briefs ? [order.order_briefs] : [];
          const brief = briefs[0] as { status?: string; recipient_name?: string } | undefined;
          return <Link className="admin-order-row" href={`/admin/order/${order.id}`} key={order.id}><div><strong>{order.customer_name || order.customer_email}</strong><small>{getPlan(order.plan_id)?.name} · {brief?.recipient_name || "未填写收件人"}</small></div><span>{order.service_stage}</span><span className={`priority-${order.priority}`}>{order.priority}</span><span>{order.due_at ? new Date(order.due_at).toLocaleDateString("zh-CN") : "未安排"}</span><strong>{formatCny(order.amount)}</strong></Link>;
        })}
      </section>
      {(refunds?.length ?? 0) > 0 ? <section className="admin-refund-list"><p className="landing-kicker">PENDING AFTER-SALES</p><h2>待处理售后</h2>{refunds?.map((refund) => <Link href={`/admin/order/${refund.order_id}`} key={refund.id}><strong>{refund.order_id.slice(0, 8)}</strong><span>{refund.reason.slice(0, 80)}</span></Link>)}</section> : null}
    </main>
  );
}
