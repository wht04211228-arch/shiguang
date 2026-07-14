"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  initial: {
    status: string;
    serviceStage: string;
    priority: string;
    dueAt: string;
    assignee: string;
    internalNotes: string;
  };
  refund?: { id: string; status: string; reason: string; adminResponse: string } | null;
};

export default function AdminOrderPanel({ orderId, initial, refund }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [refundStatus, setRefundStatus] = useState(refund?.status || "pending");
  const [refundResponse, setRefundResponse] = useState(refund?.adminResponse || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage("正在保存…");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panels">
      <section className="admin-panel">
        <p className="landing-kicker">PRODUCTION CONTROL</p>
        <h2>制作与交付控制</h2>
        <div className="form-grid two">
          <label><span>订单状态</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="paid">已支付</option><option value="in_progress">制作中</option><option value="fulfilled">已交付</option><option value="cancelled">已取消</option><option value="refunded">已退款</option></select></label>
          <label><span>服务阶段</span><select value={form.serviceStage} onChange={(e) => setForm({ ...form, serviceStage: e.target.value })}><option value="waiting_brief">等待问卷</option><option value="brief_submitted">需求已提交</option><option value="planning">故事策划中</option><option value="producing">页面制作中</option><option value="reviewing">等待确认</option><option value="delivered">已交付</option><option value="closed">已结束</option></select></label>
          <label><span>优先级</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
          <label><span>计划交付时间</span><input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></label>
          <label><span>负责人</span><input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="运营或制作人名称" /></label>
        </div>
        <label><span>内部备注（用户不可见）</span><textarea rows={6} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} /></label>
        <button className="button-primary" disabled={busy} onClick={() => void request({ type: "order", ...form })}>保存制作状态</button>
      </section>

      {refund ? (
        <section className="admin-panel refund-admin-panel">
          <p className="landing-kicker">AFTER-SALES</p>
          <h2>退款申请</h2>
          <blockquote>{refund.reason}</blockquote>
          <label><span>处理结果</span><select value={refundStatus} onChange={(e) => setRefundStatus(e.target.value)}><option value="pending">待审核</option><option value="approved">批准（等待原渠道操作）</option><option value="rejected">拒绝</option><option value="refunded">已完成退款</option><option value="cancelled">用户撤销</option></select></label>
          <label><span>给用户的说明</span><textarea rows={5} value={refundResponse} onChange={(e) => setRefundResponse(e.target.value)} placeholder="说明审核依据、退款金额或后续操作" /></label>
          <button className="button-secondary" disabled={busy} onClick={() => void request({ type: "refund", refundId: refund.id, status: refundStatus, adminResponse: refundResponse })}>保存售后结果</button>
          <small>“已完成退款”仅记录结果；实际资金操作应在 Stripe Dashboard 或支付渠道完成并核对。</small>
        </section>
      ) : null}
      {message ? <p className="admin-save-message">{message}</p> : null}
    </div>
  );
}
