"use client";

import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import { themeDefinitions, type ThemeKey } from "@/lib/experience/themes";

type HeaderTheme = ThemeKey | "brand";

type SiteHeaderProps = {
  active?: "cases" | "pricing" | "dashboard" | "studio" | "create" | "orders" | "help";
  compact?: boolean;
  theme?: HeaderTheme;
  transparent?: boolean;
};

export default function SiteHeader({
  active,
  compact = false,
  theme = "brand",
  transparent = false,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const themed = theme !== "brand";
  const definition = themed ? themeDefinitions[theme] : null;
  const studioHref = themed ? `/studio/theme/${theme}` : "/studio/theme/galaxy";

  return (
    <header
      className={`site-header-shell v10-site-header theme-aware-header theme-${theme} ${compact ? "is-compact" : ""} ${transparent ? "is-transparent" : ""}`}
      data-theme={theme}
    >
      <div className="theme-header-ambient" aria-hidden="true">
        <i /><i /><i /><span />
      </div>

      <div className="site-header-inner">
        <div className="site-header-brand-group">
          <BrandLogo dark={theme === "galaxy" || theme === "cinema"} subtitle="SHIGUANG" />
          {definition ? (
            <span className="site-header-theme-badge">
              <b>{definition.letter}</b>
              <span>{definition.name}</span>
            </span>
          ) : null}
        </div>

        <button
          className="site-header-menu-button"
          type="button"
          aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <i /><i /><i />
        </button>

        <nav className={menuOpen ? "is-open" : ""} aria-label="主导航">
          <Link href="/#what-is-it" onClick={() => setMenuOpen(false)}>它是什么</Link>
          <Link href="/#how-it-works" onClick={() => setMenuOpen(false)}>怎么制作</Link>
          <Link className={active === "cases" ? "active" : ""} href="/#cases" onClick={() => setMenuOpen(false)}>案例</Link>
          <Link href="/#themes" onClick={() => setMenuOpen(false)}>主题</Link>
          <Link className={active === "pricing" ? "active" : ""} href="/#pricing" onClick={() => setMenuOpen(false)}>套餐</Link>
          <Link className={active === "help" ? "active" : ""} href="/help" onClick={() => setMenuOpen(false)}>帮助</Link>
          <Link className={active === "studio" ? "active" : ""} href={studioHref} onClick={() => setMenuOpen(false)}>制作台</Link>
          <Link className={active === "orders" ? "active" : ""} href="/orders" onClick={() => setMenuOpen(false)}>我的订单</Link>
          <Link className={`nav-solid ${active === "create" ? "active" : ""}`} href="/create" onClick={() => setMenuOpen(false)}>开始制作</Link>
        </nav>
      </div>
    </header>
  );
}
