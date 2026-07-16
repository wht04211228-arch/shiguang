"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import MemoryGift from "@/components/MemoryGift";
import AICopyAssistant from "@/components/AICopyAssistant";
import DeliveryPanel from "@/components/DeliveryPanel";
import BrandLogo from "@/components/brand/BrandLogo";
import CollaborationManager from "@/components/collaboration/CollaborationManager";
import { calculateEmotionalRichness, calculateReadiness, getPacingSuggestions } from "@/lib/studio/readiness";
import {
  buildDynamicJourney,
  studioFeatures,
  type JourneyAction,
  type StudioFeatureKey,
} from "@/lib/studio/dynamic-journey";
import type { CollaborationSpaceSummary } from "@/lib/collaboration/types";
import {
  getBriefToneLabel,
  mergeBriefIntoCard,
  type StudioBriefContext,
} from "@/lib/studio/brief-import";
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
  initialCard?: CardData;
  initialHasStoredAnswer?: boolean;
  briefContext?: StudioBriefContext;
  briefJustImported?: boolean;
};

export default function GiftStudio({
  cloudMode = false,
  userEmail,
  orderId,
  initialStep,
  initialCard,
  initialHasStoredAnswer = false,
  briefContext,
  briefJustImported = false,
}: GiftStudioProps) {
  const localDraftKey = useMemo(
    () => (orderId ? `${draftKey}-${orderId}` : draftKey),
    [orderId],
  );
  const [card, setCard] = useState<CardData>(() => initialCard ?? cloneSampleCard());
  const [status, setStatus] = useState(
    cloudMode ? "云端已连接" : "本地演示模式",
  );
  const initialJourney = studioFeatures.some((step) => step.key === initialStep)
    ? (initialStep as StudioFeatureKey)
    : "purpose";
  const [activeJourneyStep, setActiveJourneyStep] = useState<StudioFeatureKey>(initialJourney);
  const activeFeature = studioFeatures.find((step) => step.key === activeJourneyStep) ?? studioFeatures[0];
  const activePanel = activeFeature.panel;
  const [cloudCards, setCloudCards] = useState<CardSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasStoredAnswer, setHasStoredAnswer] = useState(initialHasStoredAnswer);
  const [replyViewerOpen, setReplyViewerOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryJustPublished, setDeliveryJustPublished] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insights, setInsights] = useState<CardInsights | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [collaborationSummary, setCollaborationSummary] = useState<CollaborationSpaceSummary | null>(null);
  const [briefDetailsOpen, setBriefDetailsOpen] = useState(briefJustImported);
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
  const flowStateKey = useMemo(() => `${localDraftKey}-journey`, [localDraftKey]);
  const [flowState, setFlowState] = useState({
    simulationCompleted: false,
    publishedTested: false,
    deliveryCenterVisited: false,
  });

  const updateFlowState = (patch: Partial<typeof flowState>) => {
    setFlowState((current) => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(flowStateKey, JSON.stringify(next));
      return next;
    });
  };

  const refreshCards = async () => {
    if (!cloudMode) return;
    const response = await fetch("/api/cards", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setCloudCards(body.cards ?? []);
  };

  const refreshCollaborationSummary = async () => {
    if (!cloudMode || !activeOrderId || !(planInfo?.inviteLimit ?? 0)) {
      setCollaborationSummary(null);
      return;
    }
    const response = await fetch(
      `/api/collaboration/spaces?orderId=${encodeURIComponent(activeOrderId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const body = await response.json();
    setCollaborationSummary(body.space ?? null);
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
    const savedFlow = window.localStorage.getItem(flowStateKey);
    if (!savedFlow) return;
    try {
      setFlowState((current) => ({ ...current, ...JSON.parse(savedFlow) }));
    } catch {
      window.localStorage.removeItem(flowStateKey);
    }
  }, [flowStateKey]);

  useEffect(() => {
    void refreshCollaborationSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, activeOrderId, planInfo?.inviteLimit]);

  useEffect(() => {
    const saved = window.localStorage.getItem(localDraftKey);
    if (saved) {
      try {
        const savedCard = JSON.parse(saved) as CardData;
        const nextCard = briefJustImported && briefContext
          ? mergeBriefIntoCard(savedCard, briefContext)
          : savedCard;
        setCard(nextCard);
        window.localStorage.setItem(localDraftKey, JSON.stringify(nextCard));
        setStatus(
          briefJustImported && briefContext
            ? "制作需求已同步到现有草稿，原有照片和手动内容已保留"
            : cloudMode
              ? "已恢复这份订单的本机草稿，可继续发布到云端"
              : "已恢复本机草稿",
        );
      } catch {
        setCard(initialCard ?? cloneSampleCard());
        setStatus("草稿读取失败，已重新载入订单内容");
      }
    } else if (initialCard) {
      setCard(initialCard);
      window.localStorage.setItem(localDraftKey, JSON.stringify(initialCard));
      setStatus(
        briefJustImported
          ? "制作需求已自动导入，接下来只需补充日期、照片和解锁方式"
          : "已载入这份订单的云端礼物",
      );
    }
    void refreshCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, localDraftKey]);

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
  const dynamicJourney = useMemo(
    () =>
      buildDynamicJourney({
        card,
        readiness,
        plan: planInfo
          ? {
              id: planInfo.id,
              name: planInfo.name,
              videoCount: planInfo.limits.videoCount,
              inviteLimit: planInfo.inviteLimit ?? 0,
            }
          : null,
        collaboration: collaborationSummary,
        isPublished: Boolean(isCurrentPublished),
        replyCount: currentCloudSummary?.replyCount ?? replies.length,
        simulationCompleted: flowState.simulationCompleted,
        publishedTested: flowState.publishedTested,
        deliveryCenterVisited: flowState.deliveryCenterVisited,
        hasStoredAnswer,
        hasBrief: Boolean(briefContext),
      }),
    [
      card,
      readiness,
      planInfo,
      collaborationSummary,
      isCurrentPublished,
      currentCloudSummary?.replyCount,
      replies.length,
      flowState,
      hasStoredAnswer,
      briefContext,
    ],
  );
  const updateField = <K extends keyof CardData>(
    key: K,
    value: CardData[K],
  ) => {
    setCard((current) => ({ ...current, [key]: value }));
    setStatus("有未保存修改");
  };

  const syncBriefToStudio = () => {
    if (!briefContext) return;
    setCard((current) => {
      const next = mergeBriefIntoCard(current, briefContext);
      window.localStorage.setItem(localDraftKey, JSON.stringify(next));
      return next;
    });
    setActiveJourneyStep("purpose");
    setBriefDetailsOpen(true);
    setStatus("已重新同步制作需求：人物、场景、主题、回忆和信件重点已更新");
  };

  const persistLocal = (next: CardData) => {
    window.localStorage.setItem(localDraftKey, JSON.stringify(next));
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
      updateFlowState({ deliveryCenterVisited: true });
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

  const openDeliveryCenter = () => {
    setDeliveryJustPublished(false);
    setDeliveryOpen(true);
    updateFlowState({ deliveryCenterVisited: true });
  };

  const openRecipientSimulation = () => {
    setSimulationMode(true);
    setMobilePreviewOpen(true);
    setStatus("正在以收件人视角模拟礼物；完整体验后点击“完成模拟”返回");
  };

  const closePreview = (completed = false) => {
    if (simulationMode && completed) {
      updateFlowState({ simulationCompleted: true });
      setStatus("收件人视角模拟已完成，可以继续发布前检查");
    }
    setSimulationMode(false);
    setMobilePreviewOpen(false);
  };

  const testPublishedGift = () => {
    updateFlowState({ publishedTested: true });
    window.open(publicPath, "_blank", "noopener,noreferrer");
    setStatus("已打开正式礼物页面，请检查解锁、媒体和完整观看流程");
  };

  const runJourneyAction = (action: JourneyAction) => {
    setProgressOpen(false);
    setAllFeaturesOpen(false);
    if (action.type === "feature") {
      setActiveJourneyStep(action.feature);
      return;
    }
    if (action.type === "simulation") {
      openRecipientSimulation();
      return;
    }
    if (action.type === "publish") {
      setActiveJourneyStep("publish");
      return;
    }
    if (action.type === "delivery") {
      openDeliveryCenter();
      return;
    }
    if (action.type === "test-published") {
      testPublishedGift();
      return;
    }
    if (action.type === "replies") {
      void loadReplies();
      return;
    }
    if (action.type === "insights") {
      void loadInsights();
    }
  };

  const signOut = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    window.location.href = "/login";
  };

  const resetDraft = () => {
    const next = initialCard ?? cloneSampleCard();
    setCard(next);
    setHasStoredAnswer(initialHasStoredAnswer);
    window.localStorage.removeItem(localDraftKey);
    window.localStorage.removeItem(flowStateKey);
    setFlowState({ simulationCompleted: false, publishedTested: false, deliveryCenterVisited: false });
    setStatus(initialCard ? "已恢复订单与制作需求的初始内容" : "已恢复示例内容");
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
          <button type="button" className="button-secondary studio-mobile-preview-button" onClick={() => { setSimulationMode(false); setMobilePreviewOpen(true); }}>全屏预览</button>
          <button
            type="button"
            className="button-secondary"
            disabled={!isCurrentPublished && !deliveryJustPublished}
            title={!isCurrentPublished && !deliveryJustPublished ? "正式发布后即可获取专属链接和发送话术" : "打开交付中心"}
            onClick={openDeliveryCenter}
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

      {progressOpen ? (
        <div className="studio-sheet-backdrop" role="presentation" onMouseDown={() => setProgressOpen(false)}>
          <section className="studio-sheet journey-sheet" role="dialog" aria-modal="true" aria-label="完整制作旅程" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>{dynamicJourney.phaseLabel}</small>
                <h2>{isCurrentPublished ? "交付与回应的完整路径" : "这份礼物接下来会经历什么"}</h2>
                <p>旅程会根据套餐、已购买权益和当前状态自动调整；等待中的任务不会阻止你继续完成其他内容。</p>
              </div>
              <button type="button" onClick={() => setProgressOpen(false)}>关闭</button>
            </header>
            <div className="journey-sheet-list">
              {dynamicJourney.tasks.map((item, index) => (
                <button
                  type="button"
                  key={item.key}
                  className={`journey-sheet-item state-${item.state} ${item.key === dynamicJourney.primary.key ? "is-primary" : ""}`}
                  onClick={() => runJourneyAction(item.action)}
                >
                  <span className="journey-sheet-index">
                    {item.state === "done" ? "✓" : String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <small>{item.required ? "关键任务" : item.state === "waiting" ? "等待中" : "可选增强"}</small>
                    <strong>{item.label}</strong>
                    <p>{item.hint}</p>
                  </div>
                  <em>{item.estimate}</em>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {allFeaturesOpen ? (
        <div className="studio-sheet-backdrop" role="presentation" onMouseDown={() => setAllFeaturesOpen(false)}>
          <section className="studio-sheet features-sheet" role="dialog" aria-modal="true" aria-label="全部制作功能" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>全部功能</small>
                <h2>随时进入任意制作模块</h2>
                <p>动态旅程只负责推荐，不会隐藏你已经拥有的功能。</p>
              </div>
              <button type="button" onClick={() => setAllFeaturesOpen(false)}>关闭</button>
            </header>
            <div className="studio-feature-grid">
              {studioFeatures.map((feature) => {
                const needsCollaborationUpgrade = feature.key === "collaboration" && cloudMode && !(planInfo?.inviteLimit ?? 0);
                const videoRestricted = feature.key === "media" && planInfo?.limits.videoCount === 0;
                const themeRestricted = feature.key === "theme" && planInfo?.id === "light";
                return (
                  <button
                    type="button"
                    key={feature.key}
                    className={activeJourneyStep === feature.key ? "active" : ""}
                    onClick={() => { setActiveJourneyStep(feature.key); setAllFeaturesOpen(false); }}
                  >
                    <span>{feature.label.slice(0, 1)}</span>
                    <div>
                      <strong>{feature.label}</strong>
                      <p>{feature.hint}</p>
                      {needsCollaborationUpgrade ? <small>当前未购买共创人数，可进入查看升级方式</small> : null}
                      {videoRestricted ? <small>背景音乐可用，视频需要升级套餐</small> : null}
                      {themeRestricted ? <small>轻定制固定使用温暖胶片主题</small> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
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
            <button type="button" className="button-secondary" onClick={testPublishedGift}>先测试礼物 ↗</button>
            <button
              type="button"
              className="button-primary"
              onClick={openDeliveryCenter}
            >
              打开交付中心
            </button>
          </div>
        </section>
      ) : null}

      <div className={`studio-layout ${cloudMode ? "has-cloud-strip" : ""}`}>
        <aside className="studio-journey dynamic-journey" aria-label="动态制作旅程">
          <div className="dynamic-journey-heading">
            <div>
              <small>{dynamicJourney.phaseLabel}</small>
              <strong>{isCurrentPublished ? "礼物已经进入交付阶段" : "系统会根据当前状态推荐下一步"}</strong>
            </div>
            <span>{readiness.score}%</span>
          </div>

          <article className={`journey-primary-card state-${dynamicJourney.primary.state}`}>
            <div className="journey-task-label">
              <span>{dynamicJourney.primary.state === "waiting" ? "等待中" : "主推荐"}</span>
              <small>{dynamicJourney.primary.estimate}</small>
            </div>
            <h2>{dynamicJourney.primary.label}</h2>
            <p>{dynamicJourney.primary.reason}</p>
            <div className="journey-task-outcome">
              <small>完成后</small>
              <strong>{dynamicJourney.primary.outcome}</strong>
            </div>
            <button
              type="button"
              className="button-primary"
              onClick={() => runJourneyAction(dynamicJourney.primary.action)}
            >
              {dynamicJourney.primary.cta}
            </button>
          </article>

          {dynamicJourney.alternatives.length ? (
            <div className="journey-alternatives">
              <header>
                <strong>也可以同时完成</strong>
                <small>不会因为等待而停住</small>
              </header>
              {dynamicJourney.alternatives.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={`journey-alternative state-${item.state}`}
                  onClick={() => runJourneyAction(item.action)}
                >
                  <span>{item.state === "waiting" ? "…" : item.state === "optional" ? "+" : "→"}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.estimate} · {item.hint}</small>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <div className="dynamic-journey-footer">
            <button type="button" onClick={() => setProgressOpen(true)}>查看完整旅程</button>
            <button type="button" onClick={() => setAllFeaturesOpen(true)}>查看全部功能</button>
          </div>
        </aside>
        <aside className="editor-panel">
          <div className="studio-compact-progress">
            <button
              type="button"
              className="studio-progress-main"
              aria-expanded={progressOpen}
              onClick={() => setProgressOpen(true)}
            >
              <span className="studio-progress-ring" aria-hidden="true">
                <svg viewBox="0 0 36 36">
                  <path className="ring-track" d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" />
                  <path className="ring-value" strokeDasharray={`${readiness.score}, 100`} d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" />
                </svg>
                <strong>{readiness.score}</strong>
              </span>
              <span className="studio-progress-copy">
                <small>{dynamicJourney.phaseLabel}</small>
                <strong>{dynamicJourney.primary.label}</strong>
                <em>{dynamicJourney.primary.hint}</em>
              </span>
            </button>
            <div className="studio-progress-actions">
              <span>情感丰富度 {emotionalRichness}%</span>
              <button type="button" onClick={() => setProgressOpen(true)}>完整旅程</button>
              <button type="button" onClick={() => setAllFeaturesOpen(true)}>全部功能</button>
            </div>
          </div>

          {briefContext ? (
            <section className={`brief-import-notice ${briefJustImported ? "just-imported" : ""}`}>
              <div className="brief-import-heading">
                <span aria-hidden="true">✓</span>
                <div>
                  <small>{briefJustImported ? "制作需求已自动导入" : "已连接制作需求问卷"}</small>
                  <strong>{briefContext.recipientName} · {briefContext.occasion}</strong>
                  <p>已带入收件人、使用场景、视觉主题、{briefContext.storyFacts.length} 条真实回忆和信件重点，无需重复填写。</p>
                </div>
              </div>
              <div className="brief-import-actions">
                <button type="button" onClick={() => setBriefDetailsOpen((current) => !current)}>{briefDetailsOpen ? "收起需求" : "查看需求"}</button>
                <button type="button" onClick={syncBriefToStudio}>重新同步问卷</button>
              </div>
              {briefDetailsOpen ? (
                <div className="brief-import-details">
                  <dl>
                    <div><dt>双方关系</dt><dd>{briefContext.relationship}</dd></div>
                    <div><dt>文案语气</dt><dd>{getBriefToneLabel(briefContext.tone)}</dd></div>
                    <div><dt>希望交付</dt><dd>{briefContext.deliveryDate || "未设置"}</dd></div>
                    <div><dt>联系方式</dt><dd>{briefContext.contactMethod || "未填写"}</dd></div>
                  </dl>
                  {briefContext.mustInclude ? <article><strong>一定要出现</strong><p>{briefContext.mustInclude}</p></article> : null}
                  {briefContext.avoidContent ? <article className="private-warning"><strong>避免出现（仅制作人可见）</strong><p>{briefContext.avoidContent}</p></article> : null}
                  {briefContext.specialRequests ? <article><strong>其他要求</strong><p>{briefContext.specialRequests}</p></article> : null}
                </div>
              ) : null}
            </section>
          ) : null}

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
              <CollaborationManager
                cloudMode={cloudMode}
                orderId={activeOrderId}
                onStatus={setStatus}
                onSummaryChange={setCollaborationSummary}
              />
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
                  onGenerated={({ quotaUsed }) => {
                    if (!quotaUsed) return;
                    setPlanInfo((current) =>
                      current
                        ? { ...current, aiDraftsUsed: current.aiDraftsUsed + 1 }
                        : current,
                    );
                  }}
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
              <button type="button" className="button-secondary" onClick={() => setAllFeaturesOpen(true)}>查看全部功能</button>
              <button type="button" className="button-primary" onClick={() => runJourneyAction(dynamicJourney.primary.action)}>{dynamicJourney.primary.cta}</button>
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
            <button
              type="button"
              className="preview-mobile-close"
              onClick={() => closePreview(simulationMode)}
            >
              {simulationMode ? "完成模拟并返回" : "返回编辑"}
            </button>
            <div>
              <span className="preview-dot" />
              <strong>{simulationMode ? "收件人视角模拟" : "实时预览"}</strong>
              <small>{simulationMode ? "请按真实顺序完整体验一次" : "390 × 844 手机视口"}</small>
            </div>
            {isCurrentPublished ? (
              <button type="button" onClick={testPublishedGift}>打开正式页面 ↗</button>
            ) : (
              <button type="button" onClick={() => closePreview(simulationMode)}>返回制作台</button>
            )}
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
