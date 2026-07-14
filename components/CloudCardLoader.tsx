"use client";

import { useCallback, useEffect, useState } from "react";
import MemoryGift from "@/components/MemoryGift";
import { lockedCard, sampleCard, type CardData } from "@/lib/card-data";

export default function CloudCardLoader({ slug }: { slug: string }) {
  const [card, setCard] = useState<CardData>({
    ...lockedCard(sampleCard),
    slug,
  });
  const [locked, setLocked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/cards/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "读取礼物失败");
        if (active) {
          setCard(body.card as CardData);
          setLocked(Boolean(body.locked));
        }
      })
      .catch(
        (reason) =>
          active &&
          setError(reason instanceof Error ? reason.message : "读取礼物失败"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  const unlock = useCallback(
    async (answer: string) => {
      const response = await fetch(
        `/api/cards/${encodeURIComponent(slug)}/unlock`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );
      const body = await response.json();
      if (!response.ok) return { ok: false, error: body.error || "解锁失败" };
      setCard(body.card as CardData);
      setLocked(false);
      return { ok: true };
    },
    [slug],
  );

  const saveReply = useCallback(
    async (message: string) => {
      const response = await fetch(
        `/api/cards/${encodeURIComponent(slug)}/replies`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
      const body = await response.json();
      return response.ok
        ? { ok: true }
        : { ok: false, error: body.error || "保存回应失败" };
    },
    [slug],
  );

  if (loading)
    return (
      <main className="card-state-page">
        <div className="card-state-card">
          <span>拾</span>
          <h1>正在打开这份礼物…</h1>
        </div>
      </main>
    );
  if (error)
    return (
      <main className="card-state-page">
        <div className="card-state-card">
          <span>!</span>
          <h1>{error}</h1>
          <p>请确认链接是否正确，或联系送礼人重新发布。</p>
        </div>
      </main>
    );
  return (
    <MemoryGift
      card={card}
      onUnlock={locked ? unlock : undefined}
      onReply={saveReply}
    />
  );
}
