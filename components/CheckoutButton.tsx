"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCny, getPlan, type PlanId } from "@/lib/commerce/plans";
import {
  computeAddonTotal,
  getInviteTier,
  getRetentionTier,
  inviteTiers,
  retentionTiers,
  type InviteTierId,
  type RetentionTierId,
} from "@/lib/collaboration/types";
import {
  getAnalyticsSessionId,
  trackConversionEvent,
} from "@/components/AnalyticsEvent";

type CheckoutResponse = {
  url?: string;
  error?: string;
  loginUrl?: string;
  requestId?: string;
};

async function readCheckoutResponse(
  response: Response,
): Promise<CheckoutResponse> {
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
  const [inviteTier, setInviteTier] = useState<InviteTierId>("none");
  const [retentionTier, setRetentionTier] =
    useState<RetentionTierId>("days30");

  const plan = getPlan(planId)!;
  const total = useMemo(
    () => plan.priceCents + computeAddonTotal(inviteTier, retentionTier),
    [inviteTier, plan.priceCents, retentionTier],
  );
  const invite = getInviteTier(inviteTier);
  const retention = getRetentionTier(retentionTier);

  const checkout = async () => {
    if (!accepted) {
      setStatus("请先阅读并同意服务条款与退款规则");
      return;
    }
    setBusy(true);
    setStatus("正在创建人工付款订单…");
    void trackConversionEvent("checkout_started", {
      planId,
      inviteTier,
      retentionTier,
      total,
    });
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          inviteTier,
          retentionTier,
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
        const requestHint = body.requestId
          ? `（错误编号：${body.requestId}）`
          : "";
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
    <div className="checkout-action checkout-configurator">
      <div className="checkout-addon-grid">
        <label>
          <span>多人秘密共创</span>
          <select
            value={inviteTier}
            onChange={(event) =>
              setInviteTier(event.target.value as InviteTierId)
            }
          >
            {inviteTiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
                {tier.priceCents ? `（+${formatCny(tier.priceCents)}）` : ""}
              </option>
            ))}
          </select>
          <small>{invite.description}</small>
        </label>
        <label>
          <span>保存期限</span>
          <select
            value={retentionTier}
            onChange={(event) =>
              setRetentionTier(event.target.value as RetentionTierId)
            }
          >
            {retentionTiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
                {tier.priceCents ? `（+${formatCny(tier.priceCents)}）` : ""}
              </option>
            ))}
          </select>
          <small>{retention.description}</small>
        </label>
      </div>
      <div className="checkout-total">
        <span>本次应付</span>
        <strong>{formatCny(total)}</strong>
        <small>基础套餐 {formatCny(plan.priceCents)}，增值权益按当前选择计入</small>
      </div>
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
        {busy ? "处理中…" : `${label} · ${formatCny(total)}`}
      </button>
      {status ? <small className="checkout-status">{status}</small> : null}
    </div>
  );
}
