"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminFeedbackModeration({
  orderId,
  review,
  permission,
}: {
  orderId: string;
  review?: {
    id: string;
    rating: number;
    testimonial?: string | null;
    displayName?: string | null;
    publicConsent: boolean;
    status: string;
  } | null;
  permission?: {
    allowAnonymousCase: boolean;
    allowQuote: boolean;
    allowMedia: boolean;
    publicAlias?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const moderate = async (status: "approved" | "rejected" | "pending") => {
    if (!review?.id) return;
    setBusy(true);
    setMessage("正在保存审核结果…");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "feedback_moderate", reviewId: review.id, status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      setMessage("审核结果已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel">
      <p className="landing-kicker">FEEDBACK & CONSENT</p>
      <h2>评价与案例授权</h2>
      {review ? (
        <>
          <strong>{"★".repeat(review.rating)} · {review.status}</strong>
          <p>{review.testimonial || "未填写文字评价"}</p>
          <small>展示名：{review.displayName || "未填写"} · 公开评价：{review.publicConsent ? "允许" : "不允许"}</small>
          {permission ? (
            <dl className="consent-summary">
              <div><dt>匿名案例</dt><dd>{permission.allowAnonymousCase ? "允许" : "不允许"}</dd></div>
              <div><dt>引用文字</dt><dd>{permission.allowQuote ? "允许" : "不允许"}</dd></div>
              <div><dt>使用媒体</dt><dd>{permission.allowMedia ? "允许（具体素材仍需再次确认）" : "不允许"}</dd></div>
            </dl>
          ) : null}
          <div className="growth-actions">
            <button className="button-secondary" disabled={busy} onClick={() => void moderate("rejected")}>不公开</button>
            <button className="button-primary" disabled={busy || !review.publicConsent || !permission?.allowQuote} onClick={() => void moderate("approved")}>审核通过并允许案例页引用</button>
          </div>
          {(!review.publicConsent || !permission?.allowQuote) ? <small>客户未同时授权公开评价与文字引用，因此不能审核为公开内容。</small> : null}
        </>
      ) : <p>客户尚未提交评价。</p>}
      {message ? <p className="admin-save-message">{message}</p> : null}
    </section>
  );
}
