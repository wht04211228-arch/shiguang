"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextPath =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/studio";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      setBusy(false);
      if (error) return setStatus(error.message);
      if (!data.session) return setStatus("注册成功。请打开验证邮件完成登录。");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setBusy(false);
      if (error) return setStatus(error.message);
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <form className="auth-card" onSubmit={submit}>
      <p className="landing-kicker">CREATOR ACCOUNT</p>
      <h1>{mode === "signin" ? "登录拾光制作台" : "创建制作人账号"}</h1>
      <p>账号用于隔离订单、跨设备保存礼物和管理收件人的回复。</p>
      <label className="field">
        <span>邮箱</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          type="password"
          minLength={8}
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 8 位"
        />
      </label>
      {status ? <p className="auth-status">{status}</p> : null}
      <button
        type="submit"
        className="button-primary auth-submit"
        disabled={busy}
      >
        {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setStatus("");
        }}
      >
        {mode === "signin" ? "还没有账号？创建账号" : "已有账号？返回登录"}
      </button>
    </form>
  );
}
