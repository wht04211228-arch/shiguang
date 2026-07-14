"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackConversionEvent } from "@/components/AnalyticsEvent";

export default function DraftReviewForm({
  orderId,
  previewUrl,
  roundNo,
  revisionCount,
  revisionLimit,
}: {
  orderId: string;
  previewUrl?: string | null;
  roundNo: number;
  revisionCount: number;
  revisionLimit: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "changes" | "">("");
  const [message, setMessage] = useState("");

  const submit = async (action: "approve" | "changes") => {
    if (action === "changes" && note.trim().length < 8) {
      setMessage("请具体写出需要调整的文字、照片、顺序或氛围（至少 8 个字）");
      return;
    }
    setBusy(action);
    setMessage(action === "approve" ? "正在确认交付…" : "正在提交修改意见…");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action, note }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "提交失败");
      void trackConversionEvent(action === "approve" ? "draft_approved" : "changes_requested", { orderId, roundNo });
      setMessage(action === "approve" ? "已确认交付，感谢你的认真查看。" : "修改意见已提交，制作团队会开始处理。" );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="growth-card draft-review-card">
      <div className="growth-heading">
        <div>
          <p className="landing-kicker">DRAFT REVIEW · ROUND {roundNo}</p>
          <h2>初稿已经准备好，请你做最后判断</h2>
        </div>
        <span>{revisionCount}/{revisionLimit} 次修改已使用</span>
      </div>
      <p>建议完整查看文字、照片顺序、音乐、称呼和重要日期。确认后将进入正式交付；需要调整时，请把意见写得具体。</p>
      {previewUrl ? <a className="button-primary" href={previewUrl} target="_blank" rel="noreferrer">打开初稿预览</a> : null}
      <label>
        <span>修改意见（仅提出修改时必填）</span>
        <textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：第二段照片顺序调换；信件第三段不要出现‘永远’，改得克制一些；结尾音乐从 00:42 开始播放。" />
      </label>
      <div className="growth-actions">
        <button className="button-secondary" disabled={Boolean(busy) || revisionCount >= revisionLimit} onClick={() => void submit("changes")}>{busy === "changes" ? "提交中…" : revisionCount >= revisionLimit ? "修改次数已用完" : "提出修改"}</button>
        <button className="button-primary" disabled={Boolean(busy)} onClick={() => void submit("approve")}>{busy === "approve" ? "确认中…" : "确认并正式交付"}</button>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
