import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";

export default function SiteHeader({
  active,
  compact = false,
}: {
  active?: "cases" | "pricing" | "dashboard" | "studio" | "create";
  compact?: boolean;
}) {
  return (
    <header className={`site-header v10-site-header ${compact ? "is-compact" : ""}`}>
      <BrandLogo subtitle="SHIGUANG" />
      <nav aria-label="主导航">
        <Link className={active === "cases" ? "active" : ""} href="/#cases">案例</Link>
        <Link href="/#themes">主题</Link>
        <Link className={active === "pricing" ? "active" : ""} href="/#pricing">套餐</Link>
        <Link href="/legal/terms">帮助</Link>
        <Link className={active === "studio" ? "active" : ""} href="/studio/theme/galaxy">制作台</Link>
        <Link href="/orders">我的订单</Link>
        <Link className={`nav-solid ${active === "create" ? "active" : ""}`} href="/create">开始制作</Link>
      </nav>
    </header>
  );
}
