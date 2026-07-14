import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import ReferralTracker from "@/components/ReferralTracker";
import { formatCny, giftPlans } from "@/lib/commerce/plans";

export const metadata = { title: "套餐与价格｜拾光" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
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
              label={plan.id === "deep" ? "创建主推套餐订单" : "创建订单"}
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
            创建订单后进入人工付款页。付款完成后上传截图和完整交易单号，管理员核对真实到账后开放制作问卷与制作台。
          </p>
        </article>
        <article>
          <strong>目前支持什么支付？</strong>
          <p>
            当前采用微信或支付宝人工付款审核。付款截图仅作为辅助，必须由管理员在真实收款记录中核对到账。
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
