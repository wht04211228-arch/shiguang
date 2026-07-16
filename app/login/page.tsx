import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Link className="landing-brand auth-brand" href="/">
        <span>拾</span>
        <div>
          <strong>拾光</strong>
          <small>PRIVATE MEMORY GIFT</small>
        </div>
      </Link>
      {isSupabaseAdminConfigured() ? (
        <Suspense fallback={<div className="auth-card">正在载入登录服务…</div>}>
          <AuthForm />
        </Suspense>
      ) : (
        <section className="auth-card">
          <p className="landing-kicker">LOCAL DEMO MODE</p>
          <h1>云端环境尚未配置</h1>
          <p>
            当前仍可使用浏览器本地制作模式。完成 README 中的 Supabase
            配置后，这里会自动启用账号登录。
          </p>
          <Link className="button-primary auth-submit" href="/studio/theme/galaxy">
            进入本地制作台
          </Link>
        </section>
      )}
    </main>
  );
}
