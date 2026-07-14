import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";

export default function SiteHeader({
  active,
  compact = false,
}: {
  active?: "cases" | "pricing" | "dashboard" | "studio";
  compact?: boolean;
}) {
  return (
    <header className={`site-header ${compact ? "is-compact" : ""}`}>
      <BrandLogo subtitle="SHIGUANG" />
      <nav aria-label="主导航">
        <Link className={active === "cases" ? "active" : ""} href="/card/sample">
          体验样片
        </Link>
        <Link href="/cases">案例</Link>
        <Link className={active === "pricing" ? "active" : ""} href="/pricing">
          套餐价格
        </Link>
        <Link className={active === "dashboard" ? "active" : ""} href="/dashboard">
          我的礼物
        </Link>
        <Link className={`nav-solid ${active === "studio" ? "active" : ""}`} href="/studio">
          开始制作
        </Link>
      </nav>
    </header>
  );
}
