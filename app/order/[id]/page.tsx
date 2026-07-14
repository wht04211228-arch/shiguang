import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import RefundRequestForm from "@/components/RefundRequestForm";
import DraftReviewForm from "@/components/DraftReviewForm";
import FeedbackForm from "@/components/FeedbackForm";
import { formatCny, getPlan } from "@/lib/commerce/plans";
import { getOrderForOwner } from "@/lib/commerce/orders";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const metadata = { title: "订单详情｜拾光" };

const stageNames: Record<string, string> = {
  waiting_brief: "等待需求问卷",
  brief_submitted: "需求已提交",
  planning: "故事策划中",
  producing: "页面制作中",
  reviewing: "等待确认",
  delivered: "已交付",
  closed: "已结束",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string; demo?: string; brief?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (id === "demo" || !isSupabaseAdminConfigured()) {
    const plan = getPlan(query.plan) ?? getPlan("deep")!;
    return (
      <main className="card-state-page">
        <section className="card-state-card order-demo-card">
          <span>✓</span>
          <p className="landing-kicker">DEMO PAYMENT COMPLETE</p>
          <h1>演示订单已完成</h1>
          <p>{plan.name} · {formatCny(plan.priceCents)}。当前没有连接真实数据库与支付账号，因此不会产生真实扣款。</p>
          <div className="order-actions">
            <Link className="button-primary" href="/brief?order=demo">填写制作需求</Link>
            <Link className="button-secondary" href="/studio">直接体验制作台</Link>
          </div>
          <DraftReviewForm orderId="demo" previewUrl="/card/sample" roundNo={1} revisionCount={0} revisionLimit={plan.limits.revisions} />
          <FeedbackForm orderId="demo" />
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (!ownerId) redirect(`/login?next=/order/${id}`);
  const order = await getOrderForOwner(id, ownerId);
  if (!order) notFound();
  const [{ data: brief }, { data: refunds }, { data: reviews }, { data: customerReview }, { data: casePermission }] = await Promise.all([
    supabase.from("order_briefs").select("status,recipient_name,delivery_date,preferred_theme,updated_at").eq("order_id", id).maybeSingle(),
    supabase.from("refund_requests").select("status,admin_response,requested_at").eq("order_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("order_reviews").select("round_no,status,preview_url,admin_note,customer_note,created_at").eq("order_id", id).order("round_no", { ascending: false }).limit(10),
    supabase.from("customer_reviews").select("rating,testimonial,public_consent,display_name").eq("order_id", id).maybeSingle(),
    supabase.from("case_permissions").select("allow_anonymous_case,allow_quote,allow_media,public_alias").eq("order_id", id).maybeSingle(),
  ]);

  const plan = getPlan(order.plan_id)!;
  const cards = Array.isArray(order.cards) ? order.cards : order.cards ? [order.cards] : [];
  const card = cards[0] as { slug: string; recipient_name: string; status: string } | undefined;
  const latestRefund = refunds?.[0];
  const serviceStage = (order as { service_stage?: string }).service_stage || "waiting_brief";
  const discountAmount = (order as { discount_amount?: number }).discount_amount || 0;
  const latestReview = reviews?.[0];
  const revisionCount = Number((order as { revision_count?: number }).revision_count || 0);
  const reviewStatus = (order as { review_status?: string }).review_status || "not_ready";

  return (
    <main className="commerce-page order-detail-page">
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/"><span>拾</span><div><strong>拾光</strong><small>ORDER DETAIL</small></div></Link>
        <nav><Link href="/orders">全部订单</Link><Link href="/cases">案例</Link><Link className="nav-solid" href={`/studio?order=${order.id}`}>制作台</Link></nav>
      </header>
      <section className="order-detail-card">
        {query.brief === "submitted" ? <div className="commerce-alert success">制作需求已提交，我们会按照资料开始整理故事。</div> : null}
        <div className="order-detail-heading">
          <div>
            <p className="landing-kicker">ORDER {order.id.slice(0, 8).toUpperCase()}</p>
            <h1>{plan.name}</h1>
            <p>{plan.tagline}</p>
          </div>
          <div>
            <strong>{formatCny(order.amount)}</strong>
            {discountAmount ? <small>已优惠 {formatCny(discountAmount)}</small> : null}
            <span className={`status-pill status-${order.status}`}>{order.status === "paid" ? "已支付" : order.status}</span>
          </div>
        </div>

        <div className="service-stage-banner">
          <span>当前服务进度</span>
          <strong>{stageNames[serviceStage] ?? serviceStage}</strong>
          {(order as { due_at?: string | null }).due_at ? <small>计划交付：{new Date((order as { due_at: string }).due_at).toLocaleString("zh-CN")}</small> : <small>提交需求后将安排交付时间</small>}
        </div>

        <div className="order-progress">
          <article className="done"><span>1</span><strong>订单创建</strong><small>{new Date(order.created_at).toLocaleString("zh-CN")}</small></article>
          <article className={order.paid_at ? "done" : ""}><span>2</span><strong>支付确认</strong><small>{order.paid_at ? new Date(order.paid_at).toLocaleString("zh-CN") : "等待支付"}</small></article>
          <article className={brief?.status === "submitted" || brief?.status === "reviewed" ? "done" : ""}><span>3</span><strong>需求提交</strong><small>{brief ? `${brief.recipient_name} · ${brief.status === "draft" ? "草稿" : "已提交"}` : "尚未填写"}</small></article>
          <article className={card ? "done" : ""}><span>4</span><strong>内容制作</strong><small>{card ? `${card.recipient_name} · ${card.status}` : "尚未绑定礼物"}</small></article>
          <article className={order.fulfilled_at ? "done" : ""}><span>5</span><strong>正式交付</strong><small>{order.fulfilled_at ? new Date(order.fulfilled_at).toLocaleString("zh-CN") : "等待发布"}</small></article>
        </div>

        <section className="brief-summary-card">
          <div>
            <p className="landing-kicker">CREATIVE BRIEF</p>
            <h2>{brief ? "你的制作需求" : "先完成制作需求问卷"}</h2>
            <p>{brief ? `主题偏好：${brief.preferred_theme} · ${brief.delivery_date ? `希望 ${brief.delivery_date} 前交付` : "暂未设置日期"}` : "我们会根据真实经历、表达语气和禁忌内容整理故事，不让成品变成只替换姓名的模板。"}</p>
          </div>
          <Link className="button-primary" href={`/brief?order=${order.id}`}>{brief ? "查看或修改需求" : "填写制作需求"}</Link>
        </section>

        <section className="order-entitlements">
          <h2>当前权益</h2>
          <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        </section>

        <div className="order-actions">
          {card ? <Link className="button-primary" href={`/card/${card.slug}`}>打开已绑定礼物</Link> : <Link className="button-primary" href={`/studio?order=${order.id}`}>进入制作台</Link>}
          <Link className="button-secondary" href="/pricing">再购买一份</Link>
          <Link className="button-secondary" href="/referrals">我的推荐码</Link>
        </div>

        {latestReview?.status === "pending" && reviewStatus === "awaiting_review" ? <DraftReviewForm orderId={order.id} previewUrl={latestReview.preview_url || (card ? `/card/${card.slug}` : null)} roundNo={latestReview.round_no} revisionCount={revisionCount} revisionLimit={plan.limits.revisions} /> : null}
        {reviewStatus === "changes_requested" ? <div className="commerce-alert">修改意见已提交：{latestReview?.customer_note || "制作团队正在处理。"}</div> : null}
        {reviewStatus === "approved" || serviceStage === "delivered" || order.status === "fulfilled" ? <FeedbackForm orderId={order.id} existing={customerReview ? {
          rating: customerReview.rating,
          testimonial: customerReview.testimonial,
          publicConsent: customerReview.public_consent,
          displayName: customerReview.display_name,
          allowAnonymousCase: casePermission?.allow_anonymous_case,
          allowQuote: casePermission?.allow_quote,
          allowMedia: casePermission?.allow_media,
          publicAlias: casePermission?.public_alias,
        } : null} /> : null}

        {latestRefund ? (
          <div className="refund-status">
            <strong>售后申请：{latestRefund.status}</strong>
            <p>{latestRefund.admin_response || "正在审核中，处理结果会在此显示。"}</p>
          </div>
        ) : <RefundRequestForm orderId={order.id} />}

        <p className="order-footnote">支付服务：{order.payment_provider === "demo" ? "演示模式（无真实扣款）" : "Stripe Checkout"} · 订单邮箱：{order.customer_email}</p>
      </section>
    </main>
  );
}
