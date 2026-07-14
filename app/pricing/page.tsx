import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import ReferralTracker from "@/components/ReferralTracker";
import SiteHeader from "@/components/brand/SiteHeader";
import { formatCny, giftPlans } from "@/lib/commerce/plans";

export const metadata = { title: "套餐与价格" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="commerce-page pricing-page-v09">
      <AnalyticsEvent
        name="pricing_viewed"
        metadata={{ referralCode: query.ref || null, version: "0.9" }}
      />
      <ReferralTracker code={query.ref} />
      <SiteHeader active="pricing" />

      <section className="commerce-hero pricing-hero-v09">
        <p className="landing-kicker">BASE PLAN + OPTIONAL ADD-ONS</p>
        <h1>
          先选择制作深度，
          <br />
          共创人数和保存期限按需要增加。
        </h1>
        <p>
          套餐决定回忆容量、AI额度、主题与视频能力；多人共创和长期保存不会被强制捆绑，也可以之后补差价向上升级。
        </p>
        <div className="pricing-promise-row">
          <span>人工付款审核</span>
          <span>不自动续费</span>
          <span>邀请人数可补差价升级</span>
          <span>30天默认保存</span>
        </div>
      </section>

      <section className="pricing-grid pricing-grid-v09">
        {giftPlans.map((plan) => (
          <article
            className={`pricing-card ${plan.badge ? "featured" : ""}`}
            key={plan.id}
          >
            {plan.badge ? <span className="pricing-badge">{plan.badge}</span> : null}
            <p>{plan.name}</p>
            <h2>{formatCny(plan.priceCents)}</h2>
            {plan.compareAtCents ? <del>{formatCny(plan.compareAtCents)}</del> : null}
            <h3>{plan.tagline}</h3>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <CheckoutButton
              planId={plan.id}
              label={plan.id === "deep" ? "选择主推套餐" : "创建这份礼物"}
              referralCode={query.ref}
            />
            <small>一次性购买；后续升级只补档位差价</small>
          </article>
        ))}
      </section>

      <section className="pricing-addon-explainer">
        <div>
          <p className="landing-kicker">INVITE TIERS</p>
          <h2>多人秘密共创</h2>
          <p>3人 +¥9.9，10人 +¥19.9，30人 +¥39.9，最多100人 +¥69.9。</p>
        </div>
        <div>
          <p className="landing-kicker">RETENTION</p>
          <h2>保存期限</h2>
          <p>30天默认，1年 +¥9.9，3年 +¥19.9，长期纪念 +¥49.9。</p>
        </div>
        <div>
          <p className="landing-kicker">UPGRADE LATER</p>
          <h2>用到时再升级</h2>
          <p>邀请人数或保存期限不足时，从订单详情创建补差价订单，已有内容不会丢失。</p>
        </div>
      </section>

      <section className="pricing-notes">
        <article>
          <strong>付款后会发生什么？</strong>
          <p>创建人工付款订单，上传微信或支付宝付款凭证；管理员核对真实到账后立即开放自助制作。</p>
        </article>
        <article>
          <strong>完全自助意味着什么？</strong>
          <p>首次按步骤引导，之后可自由编辑；AI只帮助整理文字，不替代真实经历和最终确认。</p>
        </article>
        <article>
          <strong>“长期纪念”如何理解？</strong>
          <p>指产品持续运营期间长期保存并提供数据导出，不承诺任何公司或服务绝对永久存在。</p>
        </article>
      </section>

      <section className="pricing-bottom-cta">
        <h2>还不确定选择哪一档？</h2>
        <p>先体验样片，感受收件人真正看到的完整流程。</p>
        <Link className="landing-secondary" href="/card/sample">体验完整样片</Link>
      </section>
    </main>
  );
}
