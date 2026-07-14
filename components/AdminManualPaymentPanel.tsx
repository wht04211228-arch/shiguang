"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCny } from "@/lib/commerce/plans";
import { manualPaymentChannelName, manualPaymentStatusName } from "@/lib/commerce/manual-payments";

export type AdminManualProof = {
  id: string;
  paymentChannel: string;
  amount: number;
  transactionReference: string;
  paidAt: string;
  reviewStatus: string;
  reviewNote: string | null;
  proofUrl: string | null;
};

export default function AdminManualPaymentPanel({ orderId, proof }: { orderId: string; proof: AdminManualProof | null }) {
  const router = useRouter();
  const [note, setNote] = useState(proof?.reviewNote || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const review = async (decision: "approved" | "rejected") => {
    if (!proof) return;
    if (decision === "rejected" && note.trim().length < 4) {
      setMessage("驳回时请填写至少 4 个字的原因");
      return;
    }
    setBusy(true);
    setMessage(decision === "approved" ? "正在确认真实到账…" : "正在驳回凭证…");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "manual_payment_review",
          proofId: proof.id,
          decision,
          reviewNote: note,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "审核失败");
      setMessage(decision === "approved" ? "已确认到账并开通制作权限" : "凭证已驳回，客户可重新提交");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel manual-payment-admin-panel">
      <p className="landing-kicker">MANUAL PAYMENT REVIEW</p>
      <h2>人工付款审核</h2>
      {!proof ? (
        <p>客户尚未提交付款凭证。请勿在未核对真实到账前手动把订单改为已支付。</p>
      ) : (
        <>
          <div className="manual-admin-status">
            <span>{manualPaymentStatusName(proof.reviewStatus)}</span>
            <strong>{formatCny(proof.amount)}</strong>
          </div>
          <dl className="manual-admin-details">
            <div><dt>付款方式</dt><dd>{manualPaymentChannelName(proof.paymentChannel)}</dd></div>
            <div><dt>交易单号</dt><dd>{proof.transactionReference}</dd></div>
            <div><dt>付款时间</dt><dd>{new Date(proof.paidAt).toLocaleString("zh-CN")}</dd></div>
            <div><dt>审核状态</dt><dd>{manualPaymentStatusName(proof.reviewStatus)}</dd></div>
          </dl>
          {proof.proofUrl ? (
            <a className="manual-proof-preview" href={proof.proofUrl} target="_blank" rel="noreferrer">
              <img src={proof.proofUrl} alt="客户上传的付款凭证" />
              <span>点击打开原图核对</span>
            </a>
          ) : <div className="commerce-alert">付款截图暂时无法生成安全预览地址。</div>}
          <div className="manual-audit-checklist">
            <strong>确认前必须逐项核对</strong>
            <ul>
              <li>实际收款账户中确实存在这笔交易；</li>
              <li>到账金额与订单金额完全一致；</li>
              <li>交易单号与截图一致且未用于其他订单；</li>
              <li>付款时间、付款渠道和订单信息合理。</li>
            </ul>
          </div>
          <label>
            <span>审核说明</span>
            <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="通过时可记录核对备注；驳回时必须说明原因" />
          </label>
          {proof.reviewStatus === "approved" ? (
            <div className="commerce-alert success">这笔付款已经确认到账，订单制作权限已开通。</div>
          ) : (
            <div className="manual-review-actions">
              <button className="button-secondary" disabled={busy} onClick={() => void review("rejected")}>驳回并要求重传</button>
              <button className="button-primary" disabled={busy} onClick={() => void review("approved")}>确认真实到账</button>
            </div>
          )}
        </>
      )}
      {message ? <p className="admin-save-message static">{message}</p> : null}
    </section>
  );
}
