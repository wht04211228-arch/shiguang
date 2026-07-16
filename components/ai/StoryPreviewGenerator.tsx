"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/brand/SiteHeader";
import { themeDefinitions, type ThemeKey } from "@/lib/experience/themes";

type Preview = { coverTitle: string; coverSubtitle: string; excerpt: string; source: "deepseek" | "fallback" };

type ThemeDraft = { relationship?: string; occasion?: string; emotions?: string[]; story?: string };

function newDraftKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function StoryPreviewGenerator({ theme, plan }: { theme: ThemeKey; plan: string }) {
  const [draft, setDraft] = useState<ThemeDraft>({});
  const [draftKey, setDraftKey] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const canGenerate = useMemo(() => Boolean(draftKey && !preview), [draftKey, preview]);

  useEffect(() => {
    const stored = window.localStorage.getItem("shiguang-theme-draft");
    if (stored) {
      try { setDraft(JSON.parse(stored) as ThemeDraft); } catch { /* ignore */ }
    }
    let key = window.localStorage.getItem("shiguang-preview-draft-key");
    if (!key) {
      key = newDraftKey();
      window.localStorage.setItem("shiguang-preview-draft-key", key);
    }
    setDraftKey(key);
    const savedPreview = window.localStorage.getItem(`shiguang-preview-result:${key}`);
    if (savedPreview) {
      try { setPreview(JSON.parse(savedPreview) as Preview); } catch { /* ignore */ }
    }
  }, []);

  async function generate() {
    if (!canGenerate) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftKey, theme, plan, ...draft }),
      });
      const payload = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(payload.error || "生成失败");
      setPreview(payload);
      window.localStorage.setItem(`shiguang-preview-result:${draftKey}`, JSON.stringify(payload));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "这次预览没有完成");
    } finally {
      setLoading(false);
    }
  }

  function update(field: keyof ThemeDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setEdited(true);
  }

  return (
    <main className={`story-preview-page ${theme}`}>
      <SiteHeader compact />
      <section className="story-preview-shell">
        <div className="story-preview-copy">
          <p>ONE REAL AI PREVIEW</p>
          <h1>先看看你的故事会变成什么样。</h1>
          <span>每个草稿只有一次免费真实 AI 预览。完整信件、故事章节与未来约定在付款确认后生成。</span>
          <label>送给谁 / 关系<input value={draft.relationship || ""} onChange={(event) => update("relationship", event.target.value)} placeholder="例如：恋人，目前处于异地状态" /></label>
          <label>纪念场景<input value={draft.occasion || ""} onChange={(event) => update("occasion", event.target.value)} placeholder="例如：生日和恋爱三周年" /></label>
          <label>一件真实的小事<textarea value={draft.story || ""} onChange={(event) => update("story", event.target.value.slice(0, 800))} placeholder="写下真实发生过的细节，AI 不会替你编造。" /></label>
          {edited && preview ? <p className="story-preview-note">你仍然可以修改资料。完整文案会在付款确认后根据最新内容重新生成，免费预览不会再次调用。</p> : null}
          {!preview ? <button className="story-preview-generate" type="button" disabled={!canGenerate || loading} onClick={generate}>{loading ? "正在整理你的故事……" : "生成一次免费故事预览"}</button> : null}
          {message ? <p className="story-preview-error">{message}</p> : null}
        </div>

        <aside className="story-preview-result">
          <span>{themeDefinitions[theme].letter} · {themeDefinitions[theme].name}</span>
          {preview ? (
            <>
              <h2>{preview.coverTitle}</h2>
              <h3>{preview.coverSubtitle}</h3>
              <p>{preview.excerpt}</p>
              <small>{preview.source === "deepseek" ? "由 DeepSeek 根据你的真实内容生成" : "当前使用本地安全预览，部署 API Key 后调用真实模型"}</small>
              <div className="story-preview-actions">
                <Link href={`/pricing?plan=${plan}&source=ai-preview`}>保存这份故事并继续</Link>
                <button type="button" onClick={() => document.querySelector<HTMLInputElement>(".story-preview-copy input")?.focus()}>修改我的答案</button>
              </div>
            </>
          ) : (
            <div className="story-preview-placeholder">
              <i /><i /><i />
              <p>封面标题、短副标题和一小段故事示例会出现在这里。</p>
            </div>
          )}
        </aside>
      </section>
      <footer className="story-preview-footer">当前是预览草稿 · 未登录保存在当前浏览器 7 天 · 登录后可云端保存 30 天</footer>
    </main>
  );
}
