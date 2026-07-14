"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanId } from "@/lib/commerce/plans";
import { getAnalyticsSessionId, trackConversionEvent } from "@/components/AnalyticsEvent";

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
    setStatus("正在创建订单…");
    void trackConversionEvent("checkout_started", { planId });
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          acceptedTerms: true,
          referralCode: referralCode || window.localStorage.getItem("shiguang_referral_code") || undefined,
          referralSessionId: getAnalyticsSessionId(),
        }),
      });
      const body = await response.json();
      if (response.status === 401 && body.loginUrl) {
        window.location.href = body.loginUrl;
        return;
      }
      if (!response.ok) throw new Error(body.error || "创建订单失败");
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
