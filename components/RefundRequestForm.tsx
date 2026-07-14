"use client";

import { useState } from "react";
import Link from "next/link";
import { trackConversionEvent } from "@/components/AnalyticsEvent";

export default function RefundRequestForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (reason.trim().length < 8) {
      setMessage("请说明至少 8 个字的退款原因");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "提交失败");
      void trackConversionEvent("refund_requested", { orderId });
      setMessage("退款申请已提交，我们会根据制作进度审核并通过订单邮箱反馈");
      setReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="refund-box">
      <button type="button" className="text-button" onClick={() => setOpen((value) => !value)}>
        {open ? "收起售后申请" : "需要取消或申请退款？"}
      </button>
      {open ? (
        <div>
          <p>定制服务开始后会产生策划和制作成本，退款金额将按照实际进度审核。提交前请阅读 <Link href="/legal/refund">退款规则</Link>。</p>
          <textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="请说明申请原因，以及是否已经提交资料或收到初稿" />
          <button type="button" className="button-secondary" disabled={busy} onClick={() => void submit()}>
            {busy ? "正在提交…" : "提交售后申请"}
          </button>
          {message ? <small>{message}</small> : null}
        </div>
      ) : null}
    </section>
  );
}
