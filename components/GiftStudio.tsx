"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import MemoryGift from "@/components/MemoryGift";
import AICopyAssistant from "@/components/AICopyAssistant";
import DeliveryPanel from "@/components/DeliveryPanel";
import BrandLogo from "@/components/brand/BrandLogo";
import CollaborationManager from "@/components/collaboration/CollaborationManager";
import { calculateEmotionalRichness, calculateReadiness, getPacingSuggestions } from "@/lib/studio/readiness";
import {
  cloneSampleCard,
  normalizeSlug,
  replyMoodLabels,
  themeNames,
  type CardData,
  type CardInsights,
  type CardSummary,
  type CardTheme,
  type MemoryItem,
  type ReplyMood,
} from "@/lib/card-data";

const draftKey = "shiguang-studio-draft-v3";

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

type GiftStudioProps = {
  cloudMode?: boolean;
  userEmail?: string;
  orderId?: string;
  initialStep?: string;
};

type StudioPanel =
  | "basic"
  | "theme"
  | "memories"
  | "letter"
  | "collaboration"
  | "media"
  | "future"
  | "experience"
  | "publish";

type JourneyKey =
  | "purpose"
  | "theme"
  | "cover"
  | "memories"
  | "letter"
  | "collaboration"
  | "media"
  | "surprise"
  | "timing"
  | "publish";

const journeySteps: Array<{ key: JourneyKey; panel: StudioPanel; label: string; hint: string }> = [
  { key: "purpose", panel: "basic", label: "用途与人物", hint: "送给谁、为什么送" },
  { key: "theme", panel: "theme", label: "视觉主题", hint: "选择表达气质" },
  { key: "cover", panel: "basic", label: "封面与解锁", hint: "第一眼和私密入口" },
  { key: "memories", panel: "memories", label: "回忆故事", hint: "照片、日期与细节" },
  { key: "letter", panel: "letter", label: "专属信件", hint: "真正想说的话" },
  { key: "collaboration", panel: "collaboration", label: "多人共创", hint: "邀请朋友秘密投稿" },
  { key: "media", panel: "media", label: "声音与视频", hint: "让表达更真实" },
  { key: "surprise", panel: "experience", label: "未来与惊喜", hint: "问答、约定和彩蛋" },
  { key: "timing", panel: "experience", label: "开放时间", hint: "倒计时和展示期限" },
  { key: "publish", panel: "publish", label: "预览与发布", hint: "最后检查并送达" },
];

export default function GiftStudio({
  cloudMode = false,
  userEmail,
  orderId,
  initialStep,
}: GiftStudioProps) {
  const [card, setCard] = useState<CardData>(() => cloneSampleCard());
  const [status, setStatus] = useState(
    cloudMode ? "云端已连接" : "本地演示模式",
  );
  const initialJourney = journeySteps.some((step) => step.key === initialStep) ? (initialStep as JourneyKey) : "purpose";
  const [activeJourneyStep, setActiveJourneyStep] = useState<JourneyKey>(initialJourney);
  const activeJourneyIndex = journeySteps.findIndex((step) => step.key === activeJourneyStep);
  const activePanel = journeySteps[activeJourneyIndex]?.panel ?? "basic";
  const [cloudCards, setCloudCards] = useState<CardSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasStoredAnswer, setHasStoredAnswer] = useState(false);
  const [replyViewerOpen, setReplyViewerOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryJustPublished, setDeliveryJustPublished] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insights, setInsights] = useState<CardInsights | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(
    orderId,
  );
  const [replies, setReplies] = useState<
    Array<{ id: string; message: string; mood?: ReplyMood; created_at: string }>
  >([]);
  const [planInfo, setPlanInfo] = useState<{
    id: string;
    name: string;
    limits: { memories: number; aiDrafts: number; videoCount: number; videoSeconds: number };
    aiDraftsUsed: number;
    inviteTier?: string;
    inviteLimit?: number;
    retentionTier?: string;
  } | null>(null);

  const refreshCards = async () => {
    if (!cloudMode) return;
    const response = await fetch("/api/cards", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setCloudCards(body.cards ?? []);
  };

  useEffect(() => {
    if (!cloudMode || !activeOrderId) {
      setPlanInfo(null);
      return;
    }
    void fetch(`/api/orders/${encodeURIComponent(activeOrderId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "订单读取失败");
        setPlanInfo({
          id: body.plan.id,
          name: body.plan.name,
          limits: body.plan.limits,
          aiDraftsUsed: body.order.ai_drafts_used ?? 0,
          inviteTier: body.order.invite_tier ?? "none",
          inviteLimit: body.order.invite_limit ?? 0,
          retentionTier: body.order.retention_tier ?? "days30",
        });
        if (body.plan.id === "light") {
          setCard((current) => ({ ...current, theme: "film" }));
        }
      })
      .catch((error) =>
        setStatus(error instanceof Error ? error.message : "订单读取失败"),
      );
  }, [cloudMode, activeOrderId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      try {
        setCard(JSON.parse(saved) as CardData);
        setStatus(
          cloudMode ? "已恢复本机草稿，可发布到云端" : "已恢复本机草稿",
        );
      } catch {
        setStatus("草稿读取失败，已载入示例内容");
      }
    }
    void refreshCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode]);

  const publicPath = useMemo(
    () => `/card/${normalizeSlug(card.slug)}`,
    [card.slug],
  );
  const currentCloudSummary = useMemo(
    () => cloudCards.find((item) => item.slug === normalizeSlug(card.slug)),
    [card.slug, cloudCards],
  );
  const isCurrentPublished = currentCloudSummary?.status === "published";
  const readiness = useMemo(() => calculateReadiness(card), [card]);
  const emotionalRichness = useMemo(() => calculateEmotionalRichness(card), [card]);
  const pacingSuggestions = useMemo(() => getPacingSuggestions(card), [card]);
  const activeJourney = journeySteps[activeJourneyIndex] ?? journeySteps[0];
  const updateField = <K extends keyof CardData>(
    key: K,
    value: CardData[K],
  ) => {
    setCard((current) => ({ ...current, [key]: value }));
    setStatus("有未保存修改");
  };

  const persistLocal = (next: CardData) => {
    window.localStorage.setItem(draftKey, JSON.stringify(next));
    window.localStorage.setItem(
      `shiguang-card-${next.slug}`,
      JSON.stringify(next),
    );
  };

  const save = async (publish: boolean) => {
    const normalized = { ...card, slug: normalizeSlug(card.slug) };
    setCard(normalized);
    persistLocal(normalized);
    if (!cloudMode) {
      setStatus("已保存并发布到本机预览");
      return;
    }

    setBusy(true);
    setStatus(publish ? "正在发布到云端…" : "正在保存云端草稿…");
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        card: normalized,
        status: publish ? "published" : "draft",
        orderId: activeOrderId,
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(body.error || "保存失败");
      return;
    }
    setStatus(publish ? "发布成功：请在交付中心复制专属链接和发送话术" : "云端草稿已保存");
    if (publish) {
      setDeliveryJustPublished(true);
      setDeliveryOpen(true);
      setActiveJourneyStep("publish");
    }
    setHasStoredAnswer(hasStoredAnswer || Boolean(normalized.unlockAnswer));
    if (normalized.unlockAnswer)
      setCard((current) => ({ ...current, unlockAnswer: "" }));
    await refreshCards();
  };

  const loadCloudCard = async (slug: string) => {
    if (!slug) return;
    setBusy(true);
    setStatus("正在读取云端礼物…");
    const response = await fetch(
      `/api/cards/${encodeURIComponent(slug)}?editor=1`,
      { cache: "no-store" },
    );
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(body.error || "读取失败");
      return;
    }
    setCard(body.card as CardData);
    setActiveOrderId(body.orderId || undefined);
    setHasStoredAnswer(Boolean(body.hasUnlockAnswer));
    setStatus("已载入云端礼物；解锁答案留空会保留原设置");
  };

  const loadReplies = async () => {
    setReplyViewerOpen(true);
    setStatus("正在读取收件人回复…");
    const response = await fetch(
      `/api/cards/${encodeURIComponent(normalizeSlug(card.slug))}/replies`,
      { cache: "no-store" },
    );
    const body = await response.json();
    if (!response.ok) {
      setReplies([]);
      setStatus(body.error || "读取回复失败");
      return;
    }
    setReplies(body.replies ?? []);
    setStatus(
      body.replies?.length
        ? `已读取 ${body.replies.length} 条回复`
        : "这份礼物还没有收到回复",
    );
  };

  const loadInsights = async () => {
    if (!cloudMode) {
      setStatus("云端模式下才能查看真实互动数据");
      return;
    }
    setInsightsOpen(true);
    setStatus("正在读取收件人体验数据…");
    const response = await fetch(
      `/api/cards/${encodeURIComponent(normalizeSlug(card.slug))}/insights`,
      { cache: "no-store" },
    );
    const body = await response.json();
    if (!response.ok) {
      setInsights(null);
      setStatus(body.error || "体验数据读取失败");
      return;
    }
    setInsights(body.insights as CardInsights);
    setStatus("体验数据已更新");
  };

  const signOut = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    window.location.href = "/login";
  };

  const resetDraft = () => {
    const next = cloneSampleCard();
    setCard(next);
    setHasStoredAnswer(false);
    window.localStorage.removeItem(draftKey);
    setStatus("已恢复示例内容");
  };

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ ...card, slug: normalizeSlug(card.slug) }, null, 2)],
      { type: "application/json" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${normalizeSlug(card.slug)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const updateMemory = (id: string, patch: Partial<MemoryItem>) =>
    updateField(
      "memories",
      card.memories.map((memory) =>
        memory.id === id ? { ...memory, ...patch } : memory,
      ),
    );

  const uploadAsset = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("slug", normalizeSlug(card.slug));
    if (activeOrderId) form.append("orderId", activeOrderId);
    const response = await fetch("/api/uploads", {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "上传失败");
    return body as { path: string; url: string; type: "image" | "audio" };
  };

  const uploadMemoryImage = async (
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const source = event.target.files?.[0];
    if (!source) return;
    try {
      setStatus("正在压缩照片以提升手机加载速度…");
      const { default: imageCompression } =
        await import("browser-image-compression");
      const file = await imageCompression(source, {
        maxSizeMB: 1.6,
        maxWidthOrHeight: 1800,
        useWebWorker: true,
        fileType: "image/webp",
      });
      if (!cloudMode) {
        const reader = new FileReader();
        reader.onload = () => {
          updateMemory(id, {
            image: String(reader.result),
            imagePath: undefined,
          });
          setStatus(
            `照片已压缩：${Math.round(source.size / 1024)} KB → ${Math.round(file.size / 1024)} KB`,
          );
        };
        reader.readAsDataURL(file);
        return;
      }
      setStatus("正在上传压缩后的照片…");
      const asset = await uploadAsset(file);
      updateMemory(id, { image: asset.url, imagePath: asset.path });
      setStatus(
        `照片已压缩并上传：${Math.round(source.size / 1024)} KB → ${Math.round(file.size / 1024)} KB`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    }
  };

  const uploadMusic = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!cloudMode) {
      setStatus("本地模式请填写可访问的音乐 URL");
      return;
    }
    try {
      setStatus("正在上传背景音乐…");
      const asset = await uploadAsset(file);
      updateField("musicPath", asset.path);
      updateField("musicUrl", asset.url);
      setStatus("背景音乐已上传");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    }
  };

  const addMemory = () => {
    if (planInfo && card.memories.length >= planInfo.limits.memories) {
      setStatus(`${planInfo.name}最多支持 ${planInfo.limits.memories} 段回忆`);
      return;
    }
    updateField("memories", [
      ...card.memories,
      {
        id: `memory-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10).replaceAll("-", "."),
        title: "新的回忆",
        text: "写下这一段回忆为什么值得被留下。",
        location: "",
      },
    ]);
  };
  const removeMemory = (id: string) =>
    card.memories.length > 1 &&
    updateField(
      "memories",
      card.memories.filter((memory) => memory.id !== id),
    );

  return (
    <main className="studio-page">
      <header className="studio-header">
        <div>
          <BrandLogo className="studio-brand-logo" subtitle="制作台 · STUDIO" />
          <p>
            {cloudMode
              ? "账号、数据库与私有素材存储已启用。"
              : "本地演示：无需配置即可体验完整编辑。"}
          </p>
        </div>
        <div className="studio-header-actions">
          <span className="save-status">{status}</span>
          <a className="button-secondary" href="/dashboard">下一步中心</a>
          <a className="button-secondary" href="/orders">
            我的订单
          </a>
          <button type="button" className="button-secondary studio-mobile-preview-button" onClick={() => setMobilePreviewOpen(true)}>全屏预览</button>
          <button
            type="button"
            className="button-secondary"
            disabled={!isCurrentPublished && !deliveryJustPublished}
            title={!isCurrentPublished && !deliveryJustPublished ? "正式发布后即可获取专属链接和发送话术" : "打开交付中心"}
            onClick={() => {
              setDeliveryJustPublished(false);
              setDeliveryOpen(true);
            }}
          >
            专属链接 / 交付
          </button>
          {cloudMode ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => void loadInsights()}
            >
              体验数据
            </button>
          ) : null}
          <button
            type="button"
            className="button-secondary"
            onClick={exportJson}
          >
            导出 JSON
          </button>
          {cloudMode ? (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => void save(false)}
            >
              存为草稿
            </button>
          ) : null}
          <button
            type="button"
            className="button-primary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            {cloudMode ? "发布到云端" : "保存本机预览"}
          </button>
        </div>
      </header>

      {cloudMode ? (
        <section className="cloud-strip">
          <div>
            <strong>我的云端礼物</strong>
            <select
              defaultValue=""
              onChange={(event) => void loadCloudCard(event.target.value)}
            >
              <option value="">选择一份礼物进行编辑</option>
              {cloudCards.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.recipientName} · {item.occasion} ·{" "}
                  {item.status === "published" ? "已发布" : "草稿"} ·{" "}
                  {item.replyCount} 回复
                </option>
              ))}
            </select>
          </div>
          <div>
            {planInfo ? (
              <span className="plan-entitlement">
                {planInfo.name} · 回忆 {card.memories.length}/{planInfo.limits.memories} · 共创 {planInfo.inviteLimit ?? 0}人 · 视频 {planInfo.limits.videoCount}段 · AI {planInfo.aiDraftsUsed}/{planInfo.limits.aiDrafts}
              </span>
            ) : null}
            <button type="button" onClick={() => void loadReplies()}>
              查看当前礼物回复
            </button>
            <span>{userEmail}</span>
            <button type="button" onClick={() => void signOut()}>
              退出登录
            </button>
          </div>
        </section>
      ) : null}

      {deliveryOpen ? (
        <DeliveryPanel
          slug={normalizeSlug(card.slug)}
          recipientName={card.recipientName}
          senderName={card.senderName}
          orderId={activeOrderId}
          inviteLimit={planInfo?.inviteLimit ?? 0}
          justPublished={deliveryJustPublished}
          onClose={() => {
            setDeliveryOpen(false);
            setDeliveryJustPublished(false);
          }}
        />
      ) : null}

      {cloudMode && insightsOpen ? (
        <section className="reply-viewer insights-viewer">
          <header>
            <div>
              <strong>收件人体验数据</strong>
              <span>/card/{normalizeSlug(card.slug)}</span>
            </div>
            <button type="button" onClick={() => setInsightsOpen(false)}>
              关闭
            </button>
          </header>
          {insights ? (
            <>
              <div className="insights-grid">
                <article><strong>{insights.uniqueSessions}</strong><span>独立体验人数</span></article>
                <article><strong>{insights.unlocks}</strong><span>成功解锁</span></article>
                <article><strong>{insights.completions}</strong><span>完整看完</span></article>
                <article><strong>{insights.replies}</strong><span>提交回应</span></article>
                <article><strong>{insights.surpriseOpens}</strong><span>打开惊喜</span></article>
                <article><strong>{insights.totalEvents}</strong><span>互动事件</span></article>
              </div>
              <div className="stage-insights-list">
                {Object.entries(insights.stageViews).length ? (
                  Object.entries(insights.stageViews).map(([key, value]) => (
                    <div key={key}><span>{key}</span><strong>{value}</strong></div>
                  ))
                ) : (
                  <p>暂时还没有阶段浏览数据。</p>
                )}
              </div>
            </>
          ) : (
            <p className="empty-replies">正在读取数据…</p>
          )}
        </section>
      ) : null}

      {cloudMode && replyViewerOpen ? (
        <section className="reply-viewer">
          <header>
            <div>
              <strong>收件人回复</strong>
              <span>/card/{normalizeSlug(card.slug)}</span>
            </div>
            <button type="button" onClick={() => setReplyViewerOpen(false)}>
              关闭
            </button>
          </header>
          {replies.length ? (
            <div>
              {replies.map((item) => (
                <article key={item.id}>
                  <time>
                    {new Date(item.created_at).toLocaleString("zh-CN")}
                  </time>
                  {item.mood ? (
                    <small className="reply-mood-chip">
                      {replyMoodLabels[item.mood]}
                    </small>
                  ) : null}
                  <p>{item.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-replies">
              暂时还没有回复。礼物成功解锁后，收件人可以在最后一页留下内容。
            </p>
          )}
        </section>
      ) : null}

      {cloudMode && isCurrentPublished ? (
        <section className="published-share-reminder" aria-live="polite">
          <div className="published-share-icon" aria-hidden="true">✓</div>
          <div>
            <small>这份礼物已经发布</small>
            <strong>下一步：把正确的链接发给正确的人</strong>
            <p>礼物链接发给收件人；秘密共创链接发给朋友或家人。交付中心已经准备好链接、二维码和可直接复制的话术。</p>
          </div>
          <div className="published-share-actions">
            <a className="button-secondary" href={publicPath} target="_blank" rel="noreferrer">先测试礼物 ↗</a>
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setDeliveryJustPublished(false);
                setDeliveryOpen(true);
              }}
            >
              打开交付中心
            </button>
          </div>
        </section>
      ) : null}

      <section className="studio-guidance-strip">
        <div className="studio-score-group">
          <article><span>制作完成度</span><strong>{readiness.score}%</strong><div><i style={{ width: `${readiness.score}%` }} /></div></article>
          <article><span>情感丰富度</span><strong>{emotionalRichness}%</strong><div><i style={{ width: `${emotionalRichness}%` }} /></div></article>
        </div>
        <div className="studio-next-action">
          <small>当前步骤 · {activeJourneyIndex + 1}/{journeySteps.length}</small>
          <strong>{activeJourney.label}</strong>
          <p>{activeJourney.hint}。下一项关键任务：{readiness.nextAction}</p>
        </div>
      </section>

      <div className={`studio-layout ${cloudMode ? "has-cloud-strip" : ""}`}>
        <aside className="studio-journey" aria-label="礼物制作步骤">
          <div className="studio-journey-heading"><span>礼物旅程</span><strong>{activeJourneyIndex + 1}/{journeySteps.length}</strong></div>
          <nav>
            {journeySteps.map((step, index) => {
              const done = index < activeJourneyIndex || (step.key === "publish" && readiness.score >= 85);
              return (
                <button
                  type="button"
                  key={step.key}
                  className={activeJourneyStep === step.key ? "active" : done ? "done" : ""}
                  onClick={() => setActiveJourneyStep(step.key)}
                >
                  <span>{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{step.label}</strong><small>{step.hint}</small></div>
                </button>
              );
            })}
          </nav>
          <div className="studio-journey-help"><strong>不知道该写什么？</strong><p>先写真实事实，再使用 AI 帮你整理，不要让文案替代真实经历。</p></div>
        </aside>
        <aside className="editor-panel">
          <div className="editor-scroll-area">
            {activePanel === "theme" ? (
              <section className="editor-section">
                <div className="editor-section-heading">
                  <span>02</span>
                  <div><h2>选择这段关系的表达气质</h2><p>内容只编辑一次，主题决定光影、排版和转场方式。</p></div>
                </div>
                <div className="studio-theme-picker">
                  {(Object.keys(themeNames) as CardTheme[]).map((theme) => (
                    <button
                      type="button"
                      key={theme}
                      disabled={planInfo?.id === "light" && theme !== "film"}
                      className={`${theme === card.theme ? "active" : ""} theme-${theme}`}
                      onClick={() => updateField("theme", theme)}
                    >
                      <span>{theme === "film" ? "C" : theme === "starlight" ? "B" : "A"}</span>
                      <strong>{themeNames[theme].split("·").pop()}</strong>
                      <small>{theme === "film" ? "真实、温暖、适合大多数照片" : theme === "starlight" ? "梦幻、轻盈、适合惊喜表达" : "高级、克制、适合纪念与告白"}</small>
                    </button>
                  ))}
                </div>
                <label className="field"><span>开场主标题</span><textarea rows={3} value={card.coverTitle} onChange={(event) => updateField("coverTitle", event.target.value)} /></label>
                <label className="field"><span>开场副标题</span><input value={card.coverSubtitle} onChange={(event) => updateField("coverSubtitle", event.target.value)} /></label>
                <div className="next-action-card"><strong>这一页完成标准</strong><p>收件人第一眼能看懂“这是谁送的、为什么现在打开、接下来会发生什么”。</p></div>
              </section>
            ) : null}

            {activePanel === "basic" ? (
              <section className="editor-section">
                <div className="editor-section-heading">
                  <span>01</span>
                  <div>
                    <h2>礼物基础信息</h2>
                    <p>决定专属链接、收件人称呼与开场情绪。</p>
                  </div>
                </div>
                <label className="field">
                  <span>视觉主题</span>
                  <select
                    value={card.theme}
                    disabled={planInfo?.id === "light"}
                    onChange={(event) =>
                      updateField("theme", event.target.value as CardTheme)
                    }
                  >
                    {(Object.keys(themeNames) as CardTheme[]).map((theme) => (
                      <option key={theme} value={theme}>
                        {themeNames[theme]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>收件人</span>
                    <input
                      value={card.recipientName}
                      onChange={(event) =>
                        updateField("recipientName", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>送礼人</span>
                    <input
                      value={card.senderName}
                      onChange={(event) =>
                        updateField("senderName", event.target.value)
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>专属链接标识</span>
                  <div className="slug-field">
                    <small>/card/</small>
                    <input
                      value={card.slug}
                      onChange={(event) =>
                        updateField("slug", event.target.value)
                      }
                    />
                  </div>
                  <em>公开地址：{publicPath}</em>
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>送礼场景</span>
                    <input
                      value={card.occasion}
                      onChange={(event) =>
                        updateField("occasion", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>重要日期</span>
                    <input
                      type="date"
                      value={card.importantDate}
                      onChange={(event) =>
                        updateField("importantDate", event.target.value)
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>关系开始日期（用于纪念天数）</span>
                  <input
                    type="date"
                    value={card.relationshipStartDate ?? ""}
                    onChange={(event) =>
                      updateField("relationshipStartDate", event.target.value || undefined)
                    }
                  />
                </label>
                <label className="field">
                  <span>开场主标题</span>
                  <textarea
                    rows={3}
                    value={card.coverTitle}
                    onChange={(event) =>
                      updateField("coverTitle", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>开场副标题</span>
                  <input
                    value={card.coverSubtitle}
                    onChange={(event) =>
                      updateField("coverSubtitle", event.target.value)
                    }
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>解锁问题</span>
                    <input
                      value={card.unlockQuestion}
                      onChange={(event) =>
                        updateField("unlockQuestion", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>正确答案</span>
                    <input
                      value={card.unlockAnswer}
                      onChange={(event) =>
                        updateField("unlockAnswer", event.target.value)
                      }
                      placeholder={
                        hasStoredAnswer ? "留空则保留原答案" : "设置答案"
                      }
                    />
                    <em>
                      {hasStoredAnswer
                        ? "数据库只保存加密摘要，不会显示原答案。"
                        : "答案不会下发到收件人页面。"}
                    </em>
                  </label>
                </div>
                <label className="field">
                  <span>背景音乐 URL（可选）</span>
                  <input
                    value={card.musicUrl ?? ""}
                    onChange={(event) => {
                      updateField("musicUrl", event.target.value);
                      updateField("musicPath", undefined);
                    }}
                    placeholder="https://.../music.mp3"
                  />
                </label>
                <label className="upload-field">
                  <span>或上传背景音乐</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => void uploadMusic(event)}
                  />
                  <small>
                    {cloudMode
                      ? "私有存储，单文件不超过 6 MB。"
                      : "配置云端后启用。"}
                  </small>
                </label>
              </section>
            ) : null}

            {activePanel === "memories" ? (
              <section className="editor-section">
                <div className="editor-section-heading">
                  <span>02</span>
                  <div>
                    <h2>共同回忆</h2>
                    <p>每段回忆由日期、地点、照片和一个真实细节组成。</p>
                  </div>
                </div>
                <div className="memory-editor-list">
                  {card.memories.map((memory, index) => (
                    <article className="memory-editor-card" key={memory.id}>
                      <header>
                        <strong>第 {index + 1} 段回忆</strong>
                        <button
                          type="button"
                          onClick={() => removeMemory(memory.id)}
                          disabled={card.memories.length <= 1}
                        >
                          删除
                        </button>
                      </header>
                      <div className="field-row">
                        <label className="field">
                          <span>日期</span>
                          <input
                            value={memory.date}
                            onChange={(event) =>
                              updateMemory(memory.id, {
                                date: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>地点</span>
                          <input
                            value={memory.location ?? ""}
                            onChange={(event) =>
                              updateMemory(memory.id, {
                                location: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <label className="field">
                        <span>章节标题</span>
                        <input
                          value={memory.title}
                          onChange={(event) =>
                            updateMemory(memory.id, {
                              title: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>真实故事</span>
                        <textarea
                          rows={5}
                          value={memory.text}
                          onChange={(event) =>
                            updateMemory(memory.id, {
                              text: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="upload-field">
                        <span>{memory.image ? "更换照片" : "上传照片"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            void uploadMemoryImage(memory.id, event)
                          }
                        />
                        <small>
                          {cloudMode
                            ? "进入私有存储并通过限时地址展示，最大 6 MB。"
                            : "保存在当前浏览器，建议小于 2.5 MB。"}
                        </small>
                      </label>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="add-button"
                  onClick={addMemory}
                  disabled={Boolean(
                    planInfo &&
                    card.memories.length >= planInfo.limits.memories,
                  )}
                >
                  ＋ 添加一段回忆
                  {planInfo
                    ? `（${card.memories.length}/${planInfo.limits.memories}）`
                    : ""}
                </button>
              </section>
            ) : null}

            {activePanel === "collaboration" ? (
              <CollaborationManager cloudMode={cloudMode} orderId={activeOrderId} onStatus={setStatus} />
            ) : null}

            {activePanel === "letter" ? (
              <section className="editor-section">
                <div className="editor-section-heading">
                  <span>03</span>
                  <div>
                    <h2>写给对方的信</h2>
                    <p>每一段只表达一个真实意思，避免堆砌套话。</p>
                  </div>
                </div>
                <AICopyAssistant
                  card={card}
                  orderId={activeOrderId}
                  onGenerated={() =>
                    setPlanInfo((current) =>
                      current
                        ? { ...current, aiDraftsUsed: current.aiDraftsUsed + 1 }
                        : current,
                    )
                  }
                  onApply={(patch) => {
                    setCard((current) => ({ ...current, ...patch }));
                    setStatus("AI 草稿已应用，建议继续加入真实细节。");
                  }}
                />
                {card.letter.map((paragraph, index) => (
                  <label className="field" key={`letter-${index}`}>
                    <span>第 {index + 1} 段</span>
                    <textarea
                      rows={4}
                      value={paragraph}
                      onChange={(event) =>
                        updateField(
                          "letter",
                          card.letter.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() =>
                      updateField("letter", [
                        ...card.letter,
                        "写下下一段想说的话。",
                      ])
                    }
                  >
                    添加段落
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() =>
                      card.letter.length > 1 &&
                      updateField("letter", card.letter.slice(0, -1))
                    }
                  >
                    删除最后一段
                  </button>
                </div>
              </section>
            ) : null}

            {activePanel === "media" ? (
              <section className="editor-section">
                <div className="editor-section-heading"><span>07</span><div><h2>加入真实声音与短视频</h2><p>声音比通用文字更容易被记住；视频额度由当前套餐控制。</p></div></div>
                <div className="media-entitlement-card">
                  <div><span>当前视频权益</span><strong>{planInfo ? `${planInfo.limits.videoCount}段 · 每段${planInfo.limits.videoSeconds}秒` : "本地演示"}</strong></div>
                  {planInfo?.limits.videoCount === 0 ? <a href={activeOrderId ? `/order/${activeOrderId}` : "/pricing"}>升级后开启视频投稿 →</a> : <small>视频主要通过多人共创邀请提交，购买者可以在共创步骤审核。</small>}
                </div>
                <label className="field"><span>背景音乐 URL（可选）</span><input value={card.musicUrl ?? ""} onChange={(event) => { updateField("musicUrl", event.target.value); updateField("musicPath", undefined); }} placeholder="https://.../music.mp3" /></label>
                <label className="upload-field"><span>上传背景音乐</span><input type="file" accept="audio/*" onChange={(event) => void uploadMusic(event)} /><small>{cloudMode ? "私有存储，单文件不超过6MB。" : "配置云端后启用。"}</small></label>
                <div className="next-action-card"><strong>更有温度的做法</strong><p>不要只上传一首歌。邀请送礼人或朋友录一段10–20秒的真实声音，会明显提升礼物的专属感。</p></div>
              </section>
            ) : null}

            {activePanel === "future" ? (
              <section className="editor-section">
                <div className="editor-section-heading">
                  <span>04</span>
                  <div>
                    <h2>未来清单</h2>
                    <p>为礼物留下可以再次回来的理由。</p>
                  </div>
                </div>
                {card.futurePromises.map((promise, index) => (
                  <label className="field" key={`promise-${index}`}>
                    <span>未来约定 {index + 1}</span>
                    <input
                      value={promise}
                      onChange={(event) =>
                        updateField(
                          "futurePromises",
                          card.futurePromises.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <div className="inline-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() =>
                      updateField("futurePromises", [
                        ...card.futurePromises,
                        "一起完成一件新的事情",
                      ])
                    }
                  >
                    添加约定
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() =>
                      card.futurePromises.length > 1 &&
                      updateField(
                        "futurePromises",
                        card.futurePromises.slice(0, -1),
                      )
                    }
                  >
                    删除最后一项
                  </button>
                </div>
              </section>
            ) : null}

            {activePanel === "experience" ? (
              <section className="editor-section">
                <div className="editor-section-heading">
                  <span>05</span>
                  <div>
                    <h2>惊喜与开放规则</h2>
                    <p>设置定时开启、互动问答、隐藏惊喜与展示期限。</p>
                  </div>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>定时开启（按当前设备时区）</span>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocal(card.releaseAt)}
                      onChange={(event) =>
                        updateField("releaseAt", fromDateTimeLocal(event.target.value))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>展示失效时间（可选）</span>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocal(card.expiresAt)}
                      onChange={(event) =>
                        updateField("expiresAt", fromDateTimeLocal(event.target.value))
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>倒计时标题</span>
                  <input
                    value={card.preReleaseTitle ?? ""}
                    onChange={(event) => updateField("preReleaseTitle", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>倒计时说明</span>
                  <textarea
                    rows={3}
                    value={card.preReleaseMessage ?? ""}
                    onChange={(event) => updateField("preReleaseMessage", event.target.value)}
                  />
                </label>

                <div className="experience-card">
                  <label className="switch-field">
                    <input
                      type="checkbox"
                      checked={Boolean(card.quiz?.enabled)}
                      onChange={(event) =>
                        updateField("quiz", {
                          enabled: event.target.checked,
                          question: card.quiz?.question || "关于我们的一个小问题",
                          options: card.quiz?.options?.length ? card.quiz.options : ["选项一", "选项二", "选项三"],
                          answerIndex: card.quiz?.answerIndex ?? 0,
                          successMessage: card.quiz?.successMessage || "答对了。",
                          retryMessage: card.quiz?.retryMessage || "再想想。",
                        })
                      }
                    />
                    <span>启用回忆小问答</span>
                  </label>
                  {card.quiz ? (
                    <>
                      <label className="field"><span>问题</span><input value={card.quiz.question} onChange={(event) => updateField("quiz", { ...card.quiz!, question: event.target.value })} /></label>
                      {card.quiz.options.map((option, index) => (
                        <label className="field" key={`quiz-option-${index}`}>
                          <span>选项 {index + 1}</span>
                          <input value={option} onChange={(event) => updateField("quiz", { ...card.quiz!, options: card.quiz!.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />
                        </label>
                      ))}
                      <label className="field">
                        <span>正确答案</span>
                        <select value={card.quiz.answerIndex} onChange={(event) => updateField("quiz", { ...card.quiz!, answerIndex: Number(event.target.value) })}>
                          {card.quiz.options.map((option, index) => <option key={`${option}-${index}`} value={index}>选项 {index + 1}</option>)}
                        </select>
                      </label>
                      <div className="field-row">
                        <label className="field"><span>答对提示</span><input value={card.quiz.successMessage} onChange={(event) => updateField("quiz", { ...card.quiz!, successMessage: event.target.value })} /></label>
                        <label className="field"><span>答错提示</span><input value={card.quiz.retryMessage} onChange={(event) => updateField("quiz", { ...card.quiz!, retryMessage: event.target.value })} /></label>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="experience-card">
                  <label className="switch-field">
                    <input
                      type="checkbox"
                      checked={Boolean(card.surprise?.enabled)}
                      onChange={(event) =>
                        updateField("surprise", {
                          enabled: event.target.checked,
                          title: card.surprise?.title || "最后还有一个惊喜",
                          message: card.surprise?.message || "这份惊喜只属于你。",
                          code: card.surprise?.code || "",
                          buttonLabel: card.surprise?.buttonLabel || "打开惊喜",
                          buttonUrl: card.surprise?.buttonUrl || "",
                        })
                      }
                    />
                    <span>启用隐藏惊喜页</span>
                  </label>
                  {card.surprise ? (
                    <>
                      <label className="field"><span>惊喜标题</span><input value={card.surprise.title} onChange={(event) => updateField("surprise", { ...card.surprise!, title: event.target.value })} /></label>
                      <label className="field"><span>惊喜内容</span><textarea rows={4} value={card.surprise.message} onChange={(event) => updateField("surprise", { ...card.surprise!, message: event.target.value })} /></label>
                      <label className="field"><span>约定码 / 兑换码（可选）</span><input value={card.surprise.code ?? ""} onChange={(event) => updateField("surprise", { ...card.surprise!, code: event.target.value })} /></label>
                      <div className="field-row">
                        <label className="field"><span>外部按钮文字</span><input value={card.surprise.buttonLabel ?? ""} onChange={(event) => updateField("surprise", { ...card.surprise!, buttonLabel: event.target.value })} /></label>
                        <label className="field"><span>外部链接（可选）</span><input value={card.surprise.buttonUrl ?? ""} onChange={(event) => updateField("surprise", { ...card.surprise!, buttonUrl: event.target.value })} placeholder="https://" /></label>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activePanel === "publish" ? (
              <section className="editor-section publish-check-section">
                <div className="editor-section-heading"><span>10</span><div><h2>发布前最后检查</h2><p>明确哪些必须解决，哪些只是让礼物更完整的建议。</p></div></div>
                <div className="publish-score-grid"><article><strong>{readiness.score}%</strong><span>制作完成度</span></article><article><strong>{emotionalRichness}%</strong><span>情感丰富度</span></article></div>
                <div className="publish-checklist">
                  {readiness.checklist.map((item) => <article key={item.key} className={item.done ? "done" : item.required ? "required" : "suggested"}><span>{item.done ? "✓" : item.required ? "!" : "○"}</span><div><strong>{item.label}</strong><small>{item.done ? "已完成" : item.required ? "发布前建议完成" : "可选增强项"}</small></div></article>)}
                </div>
                <div className="pacing-suggestions"><h3>情绪节奏建议</h3>{pacingSuggestions.map((item) => <p key={item}>{item}</p>)}</div>
                <div className="publish-final-actions"><button type="button" className="button-secondary" disabled={busy} onClick={() => void save(false)}>保存草稿</button><a className="button-secondary" href={publicPath} target="_blank" rel="noreferrer">手机全屏预览 ↗</a><button type="button" className="button-primary" disabled={busy || readiness.score < 55} onClick={() => void save(true)}>{busy ? "发布中…" : "确认并正式发布"}</button></div>
                {readiness.score < 55 ? <p className="form-error">核心内容尚不完整，完成度达到55%后才能发布。</p> : null}
              </section>
            ) : null}

            <div className="studio-step-actions">
              <button type="button" className="button-secondary" disabled={activeJourneyIndex === 0} onClick={() => setActiveJourneyStep(journeySteps[Math.max(0, activeJourneyIndex - 1)].key)}>返回上一步</button>
              <button type="button" className="button-primary" disabled={activeJourneyIndex === journeySteps.length - 1} onClick={() => setActiveJourneyStep(journeySteps[Math.min(journeySteps.length - 1, activeJourneyIndex + 1)].key)}>保存当前内容并继续</button>
            </div>

            <div className="editor-danger-zone">
              <button type="button" onClick={resetDraft}>
                恢复示例内容
              </button>
              <p>
                {cloudMode
                  ? "草稿与已发布礼物按账号隔离；上传素材位于私有存储桶。"
                  : "当前数据仅保存在浏览器本机。"}
              </p>
            </div>
          </div>
        </aside>

        <section className={`preview-panel ${mobilePreviewOpen ? "mobile-open" : ""}`}>
          <div className="preview-toolbar">
            <button type="button" className="preview-mobile-close" onClick={() => setMobilePreviewOpen(false)}>返回编辑</button>
            <div>
              <span className="preview-dot" />
              <strong>实时预览</strong>
              <small>390 × 844 手机视口</small>
            </div>
            <a href={publicPath} target="_blank" rel="noreferrer">
              打开专属页面 ↗
            </a>
          </div>
          <div className="phone-shell">
            <div className="phone-speaker" />
            <div className="phone-screen">
              <MemoryGift card={card} embedded allowThemeSwitch />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
