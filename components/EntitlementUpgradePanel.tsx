"use client";

import { useMemo, useState } from "react";
import { formatCny } from "@/lib/commerce/plans";
import {
  computeUpgradeDifference,
  getInviteTier,
  getRetentionTier,
  inviteTiers,
  retentionTiers,
  type InviteTierId,
  type RetentionTierId,
} from "@/lib/collaboration/types";

export default function EntitlementUpgradePanel({
  orderId,
  currentInviteTier = "none",
  currentRetentionTier = "days30",
}: {
  orderId: string;
  currentInviteTier?: InviteTierId;
  currentRetentionTier?: RetentionTierId;
}) {
  const [inviteTier, setInviteTier] = useState<InviteTierId>(currentInviteTier);
  const [retentionTier, setRetentionTier] =
    useState<RetentionTierId>(currentRetentionTier);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const difference = useMemo(() => {
    try {
      return computeUpgradeDifference(
        { inviteTier: currentInviteTier, retentionTier: currentRetentionTier },
        { inviteTier, retentionTier },
      );
    } catch {
      return -1;
    }
  }, [currentInviteTier, currentRetentionTier, inviteTier, retentionTier]);
  const currentInvite = getInviteTier(currentInviteTier);
  const currentRetention = getRetentionTier(currentRetentionTier);

  const upgrade = async () => {
    if (difference <= 0) {
      setStatus("请选择更高的邀请人数或保存期限");
      return;
    }
    setBusy(true);
    setStatus("正在创建补差价订单…");
    try {
      const response = await fetch("/api/upgrades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, inviteTier, retentionTier }),
      });
      const body = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !body.url) throw new Error(body.error || "创建升级订单失败");
      window.location.href = body.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建升级订单失败");
      setBusy(false);
    }
  };

  return (
    <section className="entitlement-upgrade-panel">
      <div>
        <p className="landing-kicker">UPGRADE WHEN NEEDED</p>
        <h2>按需要补差价升级</h2>
        <p>
          当前为 {currentInvite.label}、保存 {currentRetention.label}。升级只补新旧档位差价，不支持降级退款。
        </p>
      </div>
      <div className="upgrade-select-grid">
        <label className="field">
          <span>邀请人数</span>
          <select value={inviteTier} onChange={(event) => setInviteTier(event.target.value as InviteTierId)}>
            {inviteTiers
              .filter((tier) => tier.limit >= currentInvite.limit)
              .map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>保存期限</span>
          <select value={retentionTier} onChange={(event) => setRetentionTier(event.target.value as RetentionTierId)}>
            {retentionTiers
              .filter((tier) => retentionTiers.findIndex((item) => item.id === tier.id) >= retentionTiers.findIndex((item) => item.id === currentRetentionTier))
              .map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
          </select>
        </label>
      </div>
      <div className="upgrade-action-row">
        <div><span>需补差价</span><strong>{difference > 0 ? formatCny(difference) : "无需补款"}</strong></div>
        <button type="button" className="button-primary" disabled={busy || difference <= 0} onClick={() => void upgrade()}>
          {busy ? "处理中…" : "创建升级付款订单"}
        </button>
      </div>
      {status ? <small>{status}</small> : null}
    </section>
  );
}
