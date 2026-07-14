"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanId } from "@/lib/commerce/plans";
import { getAnalyticsSessionId, trackConversionEvent } from "@/components/AnalyticsEvent";

type CheckoutResponse = {
  url?: string;
  error?: string;
  loginUrl?: string;
  requestId?: string;
};

async function readCheckoutResponse(response: Response): Promise<CheckoutResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      error: `订单接口没有返回内容（HTTP ${response.status}）。请检查 Vercel Functions Logs。`,
    };
  }

  try {
    return JSON.parse(text) as CheckoutResponse;
  } catch {
    return {
      error: `订单接口返回了非 JSON 内容（HTTP ${response.status}）。请检查 Vercel Functions Logs。`,
    };
  }
}

export default function CheckoutButton({
  planId,
  label = "选择这个套餐",
  referralCode,
}: {
  planId: PlanId;
  label?: string;
  referralCode?: string;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const checkout = async () => {
    if (!accepted) {
      setStatus("请先阅读并同意服务条款与退款规则");
      return;
    }

    setBusy(true);
    setStatus("正在创建人工付款订单…");
    void trackConversionEvent("checkout_started", { planId });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          acceptedTerms: true,
          referralCode:
            referralCode ||
            window.localStorage.getItem("shiguang_referral_code") ||
            undefined,
          referralSessionId: getAnalyticsSessionId(),
        }),
      });

      const body = await readCheckoutResponse(response);

      if (response.status === 401 && body.loginUrl) {
        window.location.href = body.loginUrl;
        return;
      }

      if (!response.ok) {
        const requestHint = body.requestId ? `（错误编号：${body.requestId}）` : "";
        throw new Error(`${body.error || "创建订单失败"}${requestHint}`);
      }

      if (!body.url) {
        throw new Error("订单接口没有返回跳转地址，请检查 Vercel Functions Logs。");
      }

      window.location.href = body.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建订单失败");
      setBusy(false);
    }
  };

  return (
    <div className="checkout-action">
      <label className="checkout-consent">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          我已阅读并同意 <Link href="/legal/terms">服务条款</Link>、
          <Link href="/legal/refund">退款规则</Link>与
          <Link href="/legal/privacy">隐私说明</Link>
        </span>
      </label>
      <button
        type="button"
        className="landing-primary"
        disabled={busy}
        onClick={() => void checkout()}
      >
        {busy ? "处理中…" : label}
      </button>
      {status ? <small>{status}</small> : null}
    </div>
  );
}
