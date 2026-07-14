"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import MemoryGift from "@/components/MemoryGift";
import AICopyAssistant from "@/components/AICopyAssistant";
import DeliveryPanel from "@/components/DeliveryPanel";
import {
  cloneSampleCard,
  normalizeSlug,
  themeNames,
  type CardData,
  type CardSummary,
  type CardTheme,
  type MemoryItem,
} from "@/lib/card-data";

const draftKey = "shiguang-studio-draft-v2";

type GiftStudioProps = {
  cloudMode?: boolean;
  userEmail?: string;
  orderId?: string;
};

export default function GiftStudio({
  cloudMode = false,
  userEmail,
  orderId,
}: GiftStudioProps) {
  const [card, setCard] = useState<CardData>(() => cloneSampleCard());
  const [status, setStatus] = useState(
    cloudMode ? "云端已连接" : "本地演示模式",
  );
  const [activePanel, setActivePanel] = useState<
    "basic" | "memories" | "letter" | "future"
  >("basic");
  const [cloudCards, setCloudCards] = useState<CardSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [hasStoredAnswer, setHasStoredAnswer] = useState(false);
  const [replyViewerOpen, setReplyViewerOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(
    orderId,
  );
  const [replies, setReplies] = useState<
    Array<{ id: string; message: string; created_at: string }>
  >([]);
  const [planInfo, setPlanInfo] = useState<{
    id: string;
    name: string;
    limits: { memories: number; aiDrafts: number };
    aiDraftsUsed: number;
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
    setStatus(publish ? "已发布，可跨设备打开" : "云端草稿已保存");
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
          <a className="studio-brand" href="/">
            <span>拾</span>
            <strong>拾光制作台</strong>
          </a>
          <p>
            {cloudMode
              ? "账号、数据库与私有素材存储已启用。"
              : "本地演示：无需配置即可体验完整编辑。"}
          </p>
        </div>
        <div className="studio-header-actions">
          <span className="save-status">{status}</span>
          <a className="button-secondary" href="/orders">
            我的订单
          </a>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setDeliveryOpen(true)}
          >
            交付二维码
          </button>
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
                {planInfo.name} · 回忆 {card.memories.length}/
                {planInfo.limits.memories} · AI {planInfo.aiDraftsUsed}/
                {planInfo.limits.aiDrafts}
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
          onClose={() => setDeliveryOpen(false)}
        />
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

      <div className={`studio-layout ${cloudMode ? "has-cloud-strip" : ""}`}>
        <aside className="editor-panel">
          <nav className="editor-tabs" aria-label="编辑区域">
            <button
              className={activePanel === "basic" ? "active" : ""}
              onClick={() => setActivePanel("basic")}
            >
              基础
            </button>
            <button
              className={activePanel === "memories" ? "active" : ""}
              onClick={() => setActivePanel("memories")}
            >
              回忆
            </button>
            <button
              className={activePanel === "letter" ? "active" : ""}
              onClick={() => setActivePanel("letter")}
            >
              信件
            </button>
            <button
              className={activePanel === "future" ? "active" : ""}
              onClick={() => setActivePanel("future")}
            >
              未来
            </button>
          </nav>
          <div className="editor-scroll-area">
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

        <section className="preview-panel">
          <div className="preview-toolbar">
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
