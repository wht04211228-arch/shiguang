import Link from "next/link";
import ReferralDashboard from "@/components/ReferralDashboard";

export const metadata = { title: "推荐与分享｜拾光" };

export default function ReferralsPage() {
  return (
    <main className="commerce-page referrals-page">
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/"><span>拾</span><div><strong>拾光</strong><small>REFERRAL CENTER</small></div></Link>
        <nav><Link href="/orders">我的订单</Link><Link href="/cases">案例</Link><Link className="nav-solid" href="/pricing">再制作一份</Link></nav>
      </header>
      <section className="commerce-hero compact">
        <p className="landing-kicker">SHARE A MEANINGFUL GIFT</p>
        <h1>只推荐你真正认可的体验。</h1>
        <p>推荐链接会记录打开与成功购买，用于判断口碑传播效果。当前版本不自动承诺现金返佣。</p>
      </section>
      <ReferralDashboard />
    </main>
  );
}
