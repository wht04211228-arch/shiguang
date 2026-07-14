import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import ReferralTracker from "@/components/ReferralTracker";
import { formatCny, giftPlans } from "@/lib/commerce/plans";

export const metadata = { title: "套餐与价格｜拾光" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; ref?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="commerce-page">
      <AnalyticsEvent name="pricing_viewed" metadata={{ referralCode: query.ref || null }} />
      <ReferralTracker code={query.ref} />
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/">
          <span>拾</span>
          <div>
            <strong>拾光</strong>
            <small>PRIVATE MEMORY GIFT</small>
          </div>
        </Link>
        <nav>
          <Link href="/card/sample">体验样片</Link>
          <Link href="/cases">案例</Link>
          <Link href="/orders">我的订单</Link>
          <Link className="nav-solid" href="/studio">
            制作台
          </Link>
        </nav>
      </header>
      <section className="commerce-hero">
        <p className="landing-kicker">PRICING · ONE-TIME PURCHASE</p>
        <h1>
          根据表达深度付费，
          <br />
          而不是根据动画数量付费。
        </h1>
        <p>
          三个套餐共享同一套安全、交付和长期保存能力；差异主要在故事容量、文案支持和定制深度。
        </p>
        {query.cancelled ? (
          <div className="commerce-alert">
            支付已取消，订单不会生效。你可以重新选择套餐。
          </div>
        ) : null}
      </section>
      <section className="pricing-grid">
        {giftPlans.map((plan) => (
          <article
            className={`pricing-card ${plan.badge ? "featured" : ""}`}
            key={plan.id}
          >
            {plan.badge ? (
              <span className="pricing-badge">{plan.badge}</span>
            ) : null}
            <p>{plan.name}</p>
            <h2>{formatCny(plan.priceCents)}</h2>
            {plan.compareAtCents ? (
              <del>{formatCny(plan.compareAtCents)}</del>
            ) : null}
            <h3>{plan.tagline}</h3>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <CheckoutButton
              planId={plan.id}
              label={plan.id === "deep" ? "选择主推套餐" : "选择这个套餐"}
              referralCode={query.ref}
            />
            <small>一次性购买，不自动续费</small>
          </article>
        ))}
      </section>
      <section className="pricing-notes">
        <article>
          <strong>支付后如何开始？</strong>
          <p>
            支付成功后进入订单页，点击“开始制作”即可进入制作台。云端模式下，订单和礼物都绑定到你的账号。
          </p>
        </article>
        <article>
          <strong>目前支持什么支付？</strong>
          <p>
            配置 Stripe 后进入真实托管收银台；本地开发可使用无扣款演示流程，生产环境默认禁止演示支付。
          </p>
        </article>
        <article>
          <strong>为什么不直接卖模板？</strong>
          <p>
            模板只能解决外观，真正的付费价值来自故事整理、专属细节和最终交付体验。
          </p>
        </article>
      </section>
    </main>
  );
}
