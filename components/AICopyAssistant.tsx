"use client";

import { useMemo, useState } from "react";
import type { CardData } from "@/lib/card-data";

export default function AICopyAssistant({
  card,
  orderId,
  onApply,
  onGenerated,
}: {
  card: CardData;
  orderId?: string;
  onGenerated?: () => void;
  onApply: (
    patch: Pick<
      CardData,
      "coverTitle" | "coverSubtitle" | "letter" | "futurePromises"
    >,
  ) => void;
}) {
  const defaultFacts = useMemo(
    () =>
      card.memories
        .map(
          (item) =>
            `${item.date} ${item.location || ""}：${item.title}，${item.text}`,
        )
        .join("\n"),
    [card.memories],
  );
  const [facts, setFacts] = useState(defaultFacts);
  const [tone, setTone] = useState("温暖、真实、克制，不使用网络套话");
  const [relationship, setRelationship] = useState("重要的人");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    "填写真实细节后，AI 会先整理成可修改的草稿。",
  );

  const generate = async () => {
    setBusy(true);
    setStatus("正在整理故事与语气…");
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
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "生成失败");
      onApply({
        coverTitle: body.coverTitle,
        coverSubtitle: body.coverSubtitle,
        letter: body.letter,
        futurePromises: body.futurePromises,
      });
      onGenerated?.();
      setStatus(
        body.provider === "deepseek"
          ? "已使用 DeepSeek 生成草稿并应用，可继续逐句修改。"
          : "已使用本地文案引擎生成草稿；配置 DeepSeek 后可启用智能生成。",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ai-assistant">
      <header>
        <div>
          <span>AI COPY STUDIO</span>
          <h3>把真实经历整理成不油腻的信</h3>
        </div>
        <em>辅助创作</em>
      </header>
      <div className="field-row">
        <label className="field">
          <span>双方关系</span>
          <input
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
          />
        </label>
        <label className="field">
          <span>表达语气</span>
          <input
            value={tone}
            onChange={(event) => setTone(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>真实细节与想说的话</span>
        <textarea
          rows={7}
          value={facts}
          onChange={(event) => setFacts(event.target.value)}
          placeholder="例如：第一次见面在哪里、对方做过什么小事、你一直记得哪句话……"
        />
      </label>
      <div className="ai-assistant-actions">
        <button
          type="button"
          className="button-primary"
          disabled={busy || !facts.trim()}
          onClick={() => void generate()}
        >
          {busy ? "正在生成…" : "生成并应用草稿"}
        </button>
        <small>{status}</small>
      </div>
    </section>
  );
}
