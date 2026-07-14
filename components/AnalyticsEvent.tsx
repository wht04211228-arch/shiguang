"use client";

import { useEffect } from "react";

export function getAnalyticsSessionId() {
  const key = "shiguang_analytics_session";
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export async function trackConversionEvent(
  eventName: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: getAnalyticsSessionId(),
        eventName,
        path: window.location.pathname,
        referrer: document.referrer || null,
        metadata,
      }),
    });
  } catch {
    // 埋点失败不应影响购买或制作流程。
  }
}

export default function AnalyticsEvent({
  name,
  metadata = {},
}: {
  name: string;
  metadata?: Record<string, unknown>;
}) {
  useEffect(() => {
    void trackConversionEvent(name, metadata);
  }, [name, metadata]);
  return null;
}
