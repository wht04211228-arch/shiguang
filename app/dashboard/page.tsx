import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLogo from "@/components/brand/BrandLogo";
import SiteHeader from "@/components/brand/SiteHeader";
import { formatCny, getPlan } from "@/lib/commerce/plans";
import { getInviteTier, getRetentionTier } from "@/lib/collaboration/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const metadata = { title: "下一步中心｜拾光" };

function demoDashboard() {
  return (
    <main className="dashboard-page">
      <SiteHeader active="dashboard" />
      <section className="dashboard-welcome">
        <div><p className="landing-kicker">YOUR NEXT BEST ACTION</p><h1>先完成一件最重要的事。</h1><p>连接 Supabase 后，这里会根据订单、付款、内容和投稿状态自动推荐下一步。</p></div>
        <Link className="landing-primary" href="/pricing">创建第一份礼物</Link>
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-next-card"><span>演示下一步</span><h2>体验一份完整样片</h2><p>先站在收件人的角度打开礼物，再决定自己需要准备哪些素材。</p><Link href="/demo/galaxy">立即体验样片 →</Link></article>
        <article className="dashboard-metric-card"><BrandLogo compact href="/" /><strong>0%</strong><span>礼物准备度</span></article>
      </section>
    </main>
  );
}

export default async function DashboardPage() {
  if (!isSupabaseAdminConfigured()) return demoDashboard();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login?next=/dashboard");

  const { data: orders } = await supabase
    .from("orders")
    .select("*, cards(slug,recipient_name,status,updated_at)")
    .neq("order_kind", "upgrade")
    .order("created_at", { ascending: false })
    .limit(12);
  const active = (orders ?? []).find((order) => !["cancelled", "refunded"].includes(order.status));
  if (!active) return demoDashboard();
  const cards = Array.isArray(active.cards) ? active.cards : active.cards ? [active.cards] : [];
  const card = cards[0] as { slug?: string; recipient_name?: string; status?: string } | undefined;
  const paid = ["paid", "in_progress", "fulfilled"].includes(active.status);
  const { data: brief } = await supabase
    .from("order_briefs")
    .select("status")
    .eq("order_id", active.id)
    .maybeSingle();
  const { data: space } = await supabase
    .from("collaboration_spaces")
    .select("id,invite_limit,submissions_open,contribution_deadline")
    .eq("order_id", active.id)
    .maybeSingle();
  const { count: contributionCount } = space
    ? await supabase
        .from("collaboration_contributions")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id)
        .not("status", "in", '("deleted","withdrawn")')
    : { count: 0 };

  let nextTitle = "完成付款并提交凭证";
  let nextReason = "管理员核对真实到账后，问卷、上传和制作权限才会开放。";
  let nextHref = `/pay/manual/${active.id}`;
  let estimated = "约3分钟";
  let readiness = 12;
  if (paid && !brief) {
    nextTitle = "填写礼物基础资料";
    nextReason = "先告诉系统送给谁、为什么送，以及有哪些真实回忆。";
    nextHref = `/brief?order=${active.id}`;
    estimated = "约8分钟";
    readiness = 25;
  } else if (paid && brief && !card) {
    nextTitle = "开始制作第一幕";
    nextReason = "先完成封面、收件人称呼和解锁问题，右侧会实时预览。";
    nextHref = `/studio?order=${active.id}`;
    estimated = "约5分钟";
    readiness = 38;
  } else if (card && active.invite_limit > 0 && (contributionCount ?? 0) === 0) {
    nextTitle = "邀请至少1位朋友提交祝福";
    nextReason = "加入他人的真实声音后，这份礼物会从个人相册变成共同准备的惊喜。";
    nextHref = `/studio?order=${active.id}&step=collaboration`;
    estimated = "约2分钟";
    readiness = 62;
  } else if (card?.status !== "published") {
    nextTitle = "完成发布前检查";
    nextReason = "检查手机端效果、投稿状态、开放时间和隐藏惊喜。";
    nextHref = `/studio?order=${active.id}&step=publish`;
    estimated = "约4分钟";
    readiness = 82;
  } else {
    nextTitle = "查看收件人体验数据";
    nextReason = "礼物已经发布，可以查看是否打开、看完、回应或打开隐藏惊喜。";
    nextHref = `/studio?order=${active.id}`;
    estimated = "约1分钟";
    readiness = 100;
  }

  const plan = getPlan(active.plan_id)!;
  const invite = getInviteTier(active.invite_tier);
  const retention = getRetentionTier(active.retention_tier);

  return (
    <main className="dashboard-page">
      <SiteHeader active="dashboard" />
      <section className="dashboard-welcome">
        <div><p className="landing-kicker">YOUR NEXT BEST ACTION</p><h1>今天最应该完成的事情。</h1><p>系统只推荐一件当前最重要的任务，完成后再告诉你下一步。</p></div>
        <div className="dashboard-account"><span>{typeof claimsData.claims?.email === "string" ? claimsData.claims.email : "已登录"}</span><Link href="/orders">查看全部订单</Link></div>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-next-card">
          <div className="dashboard-next-meta"><span>下一步建议</span><small>{estimated}</small></div>
          <h2>{nextTitle}</h2><p>{nextReason}</p>
          <div className="dashboard-progress-label"><span>礼物准备度</span><strong>{readiness}%</strong></div>
          <div className="dashboard-progress"><span style={{ width: `${readiness}%` }} /></div>
          <Link className="landing-primary" href={nextHref}>现在完成这一步</Link>
        </article>
        <article className="dashboard-gift-card">
          <header><div><span>当前礼物</span><h2>{card?.recipient_name ? `送给 ${card.recipient_name}` : plan.name}</h2></div><BrandLogo compact href="/" /></header>
          <dl>
            <div><dt>订单金额</dt><dd>{formatCny(active.amount)}</dd></div>
            <div><dt>共创权益</dt><dd>{invite.label}</dd></div>
            <div><dt>已收投稿</dt><dd>{contributionCount ?? 0} / {invite.limit}</dd></div>
            <div><dt>保存期限</dt><dd>{retention.label}</dd></div>
          </dl>
          <div className="dashboard-gift-actions"><Link href={`/order/${active.id}`}>订单详情</Link>{card?.slug ? <Link href={`/card/${card.slug}`}>打开礼物</Link> : null}</div>
        </article>
      </section>

      <section className="dashboard-task-list">
        <header><p className="landing-kicker">YOUR GIFT JOURNEY</p><h2>礼物旅程</h2></header>
        {[
          ["付款确认", paid, paid ? "已开通制作权益" : "等待管理员核对"],
          ["基础资料", Boolean(brief), brief ? "资料已保存" : "尚未填写"],
          ["礼物制作", Boolean(card), card ? "已创建礼物" : "尚未开始"],
          ["多人共创", (contributionCount ?? 0) > 0, invite.limit ? `${contributionCount ?? 0}/${invite.limit}人已投稿` : "未购买共创人数"],
          ["正式发布", card?.status === "published", card?.status === "published" ? "已发布" : "等待发布检查"],
        ].map(([label, done, detail], index) => (
          <article key={String(label)} className={done ? "done" : index === 0 || (index > 0 && [paid, Boolean(brief), Boolean(card), (contributionCount ?? 0) > 0][index - 1]) ? "active" : ""}>
            <span>{done ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{label}</strong><small>{detail}</small></div>
          </article>
        ))}
      </section>
    </main>
  );
}
