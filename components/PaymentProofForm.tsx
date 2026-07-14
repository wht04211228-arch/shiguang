"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCny } from "@/lib/commerce/plans";

export type ExistingManualProof = {
  reviewStatus: string;
  paymentChannel: string;
  transactionReference: string;
  paidAt: string;
  reviewNote: string | null;
};

export default function PaymentProofForm({
  orderId,
  amount,
  existing,
}: {
  orderId: string;
  amount: number;
  existing?: ExistingManualProof | null;
}) {
  const router = useRouter();
  const defaultTime = useMemo(() => {
    const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return date.toISOString().slice(0, 16);
  }, []);
  const [channel, setChannel] = useState(existing?.paymentChannel || "wechat");
  const [reference, setReference] = useState(existing?.reviewStatus === "rejected" ? existing.transactionReference : "");
  const [paidAt, setPaidAt] = useState(defaultTime);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const locked = existing && ["submitted", "reviewing", "approved"].includes(existing.reviewStatus);

  const submit = async () => {
    if (locked) return;
    if (!file) {
      setMessage("请先选择付款凭证截图");
      return;
    }
    if (reference.trim().length < 6) {
      setMessage("请填写完整交易单号，不能只填后四位");
      return;
    }

    setBusy(true);
    setMessage("正在安全上传付款凭证…");
    try {
      const form = new FormData();
      form.set("orderId", orderId);
      form.set("paymentChannel", channel);
      form.set("transactionReference", reference.trim());
      form.set("paidAt", new Date(paidAt).toISOString());
      form.set("file", file);
      const response = await fetch("/api/manual-payments/proof", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "提交失败");
      setMessage("凭证已提交。管理员核对实际到账后会自动开放制作权限。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  };

  if (locked) {
    return (
      <section className="manual-proof-status">
        <p className="landing-kicker">PAYMENT REVIEW</p>
        <h2>{existing?.reviewStatus === "approved" ? "付款已经确认" : "付款凭证正在审核"}</h2>
        <p>
          {existing?.reviewStatus === "approved"
            ? "制作权限已经开通，请返回订单页填写需求问卷。"
            : "请勿重复付款或重复提交。管理员会对照真实到账记录、金额和交易单号逐项核对。"}
        </p>
        <dl>
          <div><dt>订单金额</dt><dd>{formatCny(amount)}</dd></div>
          <div><dt>交易单号</dt><dd>{existing?.transactionReference}</dd></div>
          <div><dt>付款时间</dt><dd>{existing?.paidAt ? new Date(existing.paidAt).toLocaleString("zh-CN") : "—"}</dd></div>
        </dl>
      </section>
    );
  }

  return (
    <section className="manual-proof-form">
      <p className="landing-kicker">SUBMIT PAYMENT PROOF</p>
      <h2>{existing?.reviewStatus === "rejected" ? "重新提交付款凭证" : "完成付款后提交凭证"}</h2>
      {existing?.reviewStatus === "rejected" ? (
        <div className="commerce-alert">
          上次凭证未通过：{existing.reviewNote || "请核对付款金额、交易单号和截图后重新提交。"}
        </div>
      ) : null}
      <div className="form-grid two">
        <label>
          <span>实际付款方式</span>
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="wechat">微信</option>
            <option value="alipay">支付宝</option>
            <option value="other">其他人工收款方式</option>
          </select>
        </label>
        <label>
          <span>付款时间</span>
          <input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        </label>
      </div>
      <label>
        <span>完整交易单号</span>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="请从微信或支付宝账单详情复制完整交易单号"
          maxLength={100}
        />
        <small>交易单号会进行重复校验，同一笔付款不能用于多个订单。</small>
      </label>
      <label>
        <span>付款凭证截图</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <small>仅支持 JPG、PNG、WebP，最大 6 MB。截图需要清楚显示金额、时间和交易单号。</small>
      </label>
      <div className="manual-proof-summary">
        <span>应付金额</span>
        <strong>{formatCny(amount)}</strong>
        <small>上传截图不代表付款成功，必须以管理员核对实际到账为准。</small>
      </div>
      <button type="button" className="button-primary" disabled={busy} onClick={() => void submit()}>
        {busy ? "正在提交…" : "提交付款凭证"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
