"use client";

import { useEffect } from "react";
import { getAnalyticsSessionId, trackConversionEvent } from "@/components/AnalyticsEvent";

export default function ReferralTracker({ code }: { code?: string | null }) {
  useEffect(() => {
    if (!code) return;
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    window.localStorage.setItem("shiguang_referral_code", normalized);
    void fetch("/api/referrals/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: normalized, sessionId: getAnalyticsSessionId() }),
    });
    void trackConversionEvent("referral_opened", { code: normalized });
  }, [code]);
  return null;
}
