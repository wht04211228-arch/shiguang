"use client";

import { useMemo, useState } from "react";
import type { CardData } from "@/lib/card-data";

type CopyPatch = Pick<
  CardData,
  "coverTitle" | "coverSubtitle" | "letter" | "futurePromises"
>;

type GeneratedDraft = CopyPatch & {
  provider: "deepseek" | "local";
  model?: string;
  warning?: string;
  quotaUsed?: boolean;
};

export default function AICopyAssistant({
  card,
  orderId,
  onApply,
  onGenerated,
}: {
  card: CardData;
  orderId?: string;
  onGenerated?: (details: { quotaUsed: boolean }) => void;
  onApply: (patch: CopyPatch) => void;
}) {
  const cardFacts = useMemo(
    () =>
      card.memories
        .map(
          (item) =>
            `${item.date} ${item.location || ""}：${item.title}，${item.text}`,
        )
        .join("\n"),
    [card.memories],
  );

  const [facts, setFacts] = useState(cardFacts);
  const [tone, setTone] = useState("温暖、真实、克制，不使用网络套话");
  const [relationship, setRelationship] = useState("重要的人");
  const [mode, setMode] = useState<"compose" | "polish" | "rewrite">("compose");
  const [length, setLength] = useState<"short" | "balanced" | "rich">("balanced");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<GeneratedDraft | null>(null);
  const [status, setStatus] = useState(
    "先填写真实细节。AI 会生成可预览的草稿，不会直接覆盖现有内容。",
  );

  const generate = async () => {
    setBusy(true);
    setStatus("DeepSeek 正在整理真实细节、叙事节奏和表达语气…");
    try {
      const response = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientName: card.recipientName,
          occasion: card.occasion,
          relationship,
          tone,
          facts,
          orderId,
          mode,
          length,
          currentDraft: {
            coverTitle: card.coverTitle,
            coverSubtitle: card.coverSubtitle,
            letter: card.letter,
            futurePromises: card.futurePromises,
          },
        }),
      });

      const text = await response.text();
      const body = text ? (JSON.parse(text) as GeneratedDraft & { error?: string }) : null;
      if (!response.ok || !body) throw new Error(body?.error || "生成失败");

      setPreview(body);
      onGenerated?.({ quotaUsed: Boolean(body.quotaUsed) });
      setStatus(
        body.provider === "deepseek"
          ? `DeepSeek ${body.model || ""} 已生成草稿。请先预览，再决定是否应用。`
          : body.warning || "已生成本地基础草稿；配置 DeepSeek 后可启用智能生成。",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  const applyPreview = () => {
    if (!preview) return;
    onApply({
      coverTitle: preview.coverTitle,
      coverSubtitle: preview.coverSubtitle,
      letter: preview.letter,
      futurePromises: preview.futurePromises,
    });
    setStatus("AI 草稿已应用到礼物。建议继续补充只有你们知道的真实细节。");
    setPreview(null);
  };

  return (
    <section className="ai-assistant">
      <header>
        <div>
          <span>DEEPSEEK COPY STUDIO</span>
          <h3>把真实经历整理成不油腻的专属文案</h3>
        </div>
        <em>AI 辅助创作</em>
      </header>

      <div className="ai-assistant-notice">
        AI 只负责整理表达，不应替你编造经历。生成结果会先进入预览区，不会自动覆盖当前内容。
      </div>

      <div className="field-row ai-copy-options">
        <label className="field">
          <span>创作方式</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="compose">从真实经历生成完整初稿</option>
            <option value="polish">润色现有文案，保留原意</option>
            <option value="rewrite">重新组织故事结构</option>
          </select>
        </label>
        <label className="field">
          <span>文案长度</span>
          <select value={length} onChange={(event) => setLength(event.target.value as typeof length)}>
            <option value="short">简洁</option>
            <option value="balanced">均衡</option>
            <option value="rich">丰富</option>
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>双方关系</span>
          <input
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            placeholder="例如：恋人、朋友、母女、同学"
          />
        </label>
        <label className="field">
          <span>表达语气</span>
          <input
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            placeholder="例如：温暖、克制、带一点幽默"
          />
        </label>
      </div>

      <label className="field">
        <span>真实细节与想说的话</span>
        <textarea
          rows={8}
          value={facts}
          onChange={(event) => setFacts(event.target.value)}
          placeholder="例如：第一次见面在哪里、对方做过什么小事、你一直记得哪句话、这次最想表达什么……"
        />
      </label>

      <div className="ai-facts-tools">
        <button type="button" className="button-quiet" onClick={() => setFacts(cardFacts)}>
          重新读取当前回忆
        </button>
        <small>{facts.trim().length} / 10000 字</small>
      </div>

      <div className="ai-assistant-actions">
        <button
          type="button"
          className="button-primary"
          disabled={busy || facts.trim().length < 12}
          onClick={() => void generate()}
        >
          {busy ? "DeepSeek 正在生成…" : preview ? "重新生成一版" : "生成智能文案草稿"}
        </button>
        <small>{status}</small>
      </div>

      {preview ? (
        <div className="ai-copy-preview" aria-live="polite">
          <div className="ai-copy-preview-heading">
            <div>
              <span>生成结果预览</span>
              <h4>{preview.provider === "deepseek" ? "DeepSeek 智能草稿" : "本地基础草稿"}</h4>
            </div>
            <button type="button" className="button-quiet" onClick={() => setPreview(null)}>
              放弃这版
            </button>
          </div>

          {preview.warning ? <p className="ai-copy-warning">{preview.warning}</p> : null}

          <article>
            <span>封面标题</span>
            <strong>{preview.coverTitle}</strong>
            <p>{preview.coverSubtitle}</p>
          </article>

          <article>
            <span>专属信件</span>
            {preview.letter.map((paragraph, index) => (
              <p key={`ai-letter-${index}`}>{paragraph}</p>
            ))}
          </article>

          <article>
            <span>未来约定</span>
            <ul>
              {preview.futurePromises.map((promise, index) => (
                <li key={`ai-promise-${index}`}>{promise}</li>
              ))}
            </ul>
          </article>

          <div className="ai-copy-preview-actions">
            <button type="button" className="button-primary" onClick={applyPreview}>
              应用到礼物
            </button>
            <button type="button" className="button-secondary" onClick={() => void generate()} disabled={busy}>
              再生成一版
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
