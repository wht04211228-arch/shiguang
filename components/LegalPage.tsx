import Link from "next/link";

export default function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="commerce-page legal-page">
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/"><span>拾</span><div><strong>拾光</strong><small>POLICIES</small></div></Link>
        <nav><Link href="/legal/terms">服务条款</Link><Link href="/legal/refund">退款规则</Link><Link href="/legal/privacy">隐私说明</Link></nav>
      </header>
      <article className="legal-document">
        <p className="landing-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <small>最近更新：{updated}</small>
        <div className="legal-body">{children}</div>
        <div className="legal-note">本页面是产品上线用的基础文本，不构成针对特定经营主体或地区的法律意见。正式收款前，应根据注册主体、实际服务流程和销售地区交由专业人士复核。</div>
      </article>
    </main>
  );
}
