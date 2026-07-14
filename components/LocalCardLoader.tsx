"use client";

import { useEffect, useState } from "react";
import MemoryGift from "@/components/MemoryGift";
import type { CardData } from "@/lib/card-data";

type LocalCardLoaderProps = {
  slug: string;
  fallback: CardData;
};

export default function LocalCardLoader({
  slug,
  fallback,
}: LocalCardLoaderProps) {
  const [card, setCard] = useState<CardData>(fallback);

  useEffect(() => {
    const saved = window.localStorage.getItem(`shiguang-card-${slug}`);
    if (!saved) return;
    try {
      setCard(JSON.parse(saved) as CardData);
    } catch {
      setCard(fallback);
    }
  }, [fallback, slug]);

  return <MemoryGift card={card} />;
}
