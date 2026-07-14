"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MemoryGift from "@/components/MemoryGift";
import type { MemorySpaceSummary, RecipientEntry, RecipientEntryType, RecipientMediaAsset } from "@/lib/memory-space/types";
import {
  lockedCard,
  sampleCard,
  type CardData,
  type ReplyMood,
} from "@/lib/card-data";

type EngagementPayload = {
  eventType: string;
  stageKey?: string;
  metadata?: Record<string, unknown>;
};

function getSessionId() {
  const key = "shiguang-recipient-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, created);
  return created;
}

export default function CloudCardLoader({ slug }: { slug: string }) {
  const [card, setCard] = useState<CardData>({
    ...lockedCard(sampleCard),
    slug,
  });
  const [locked, setLocked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memorySpace, setMemorySpace] = useState<MemorySpaceSummary | null>(null);
  const [memorySpaceLoading, setMemorySpaceLoading] = useState(false);
  const sessionIdRef = useRef("");

  const track = useCallback(
    async (payload: EngagementPayload) => {
      if (!sessionIdRef.current) sessionIdRef.current = getSessionId();
      await fetch(`/api/cards/${encodeURIComponent(slug)}/engagement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          ...payload,
        }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [slug],
  );


  const loadMemorySpace = useCallback(async () => {
    setMemorySpaceLoading(true);
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/space`, { cache: "no-store" });
      const text = await response.text();
      const body = text.trim() ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(body.error || "读取共同纪念空间失败");
      setMemorySpace((body.space as MemorySpaceSummary) ?? null);
    } catch {
      setMemorySpace(null);
    } finally {
      setMemorySpaceLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let active = true;
    sessionIdRef.current = getSessionId();
    void track({ eventType: "opened" });
    fetch(`/api/cards/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "读取礼物失败");
        if (active) {
          setCard(body.card as CardData);
          setLocked(Boolean(body.locked));
          if (!body.locked) void loadMemorySpace();
          if (body.releasePending) {
            void track({
              eventType: "countdown_viewed",
              metadata: { availableAt: body.availableAt },
            });
          }
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
  }, [loadMemorySpace, slug, track]);

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
      void loadMemorySpace();
      void track({ eventType: "unlocked" });
      return { ok: true };
    },
    [loadMemorySpace, slug, track],
  );

  const saveReply = useCallback(
    async (message: string, mood: ReplyMood) => {
      const response = await fetch(
        `/api/cards/${encodeURIComponent(slug)}/replies`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, mood }),
        },
      );
      const body = await response.json();
      if (response.ok) void track({ eventType: "reply_submitted" });
      return response.ok
        ? { ok: true }
        : { ok: false, error: body.error || "保存回应失败" };
    },
    [slug, track],
  );


  const createMemoryEntry = useCallback(
    async (entryType: RecipientEntryType, content: string, media: RecipientMediaAsset[]) => {
      const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/space`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryType, content, media }),
      });
      const text = await response.text();
      const body = text.trim() ? JSON.parse(text) : {};
      if (!response.ok) return { ok: false, error: body.error || "保存失败" };
      if (body.entry) {
        setMemorySpace((current) =>
          current
            ? { ...current, entries: [...current.entries, body.entry as RecipientEntry] }
            : current,
        );
      } else {
        void loadMemorySpace();
      }
      return { ok: true, data: body.entry as RecipientEntry | undefined };
    },
    [loadMemorySpace, slug],
  );

  const uploadMemoryMedia = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/space/upload`, {
        method: "POST",
        body: form,
      });
      const text = await response.text();
      const body = text.trim() ? JSON.parse(text) : {};
      return response.ok
        ? { ok: true, data: body.asset as RecipientMediaAsset }
        : { ok: false, error: body.error || "上传失败" };
    },
    [slug],
  );

  const claimMemorySpace = useCallback(async () => {
    const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/space/claim`, { method: "POST" });
    const text = await response.text();
    const body = text.trim() ? JSON.parse(text) : {};
    if (response.ok) void loadMemorySpace();
    return response.ok ? { ok: true } : { ok: false, error: body.error || "绑定失败" };
  }, [loadMemorySpace, slug]);

  const requestInvitePermission = useCallback(async () => {
    const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/space/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestType: "recipient_invite_permission" }),
    });
    const text = await response.text();
    const body = text.trim() ? JSON.parse(text) : {};
    return response.ok ? { ok: true } : { ok: false, error: body.error || "申请失败" };
  }, [slug]);


  const createRecipientInvite = useCallback(
    async (expectedName: string) => {
      const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/space/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedName }),
      });
      const text = await response.text();
      const body = text.trim() ? JSON.parse(text) : {};
      if (response.ok) void loadMemorySpace();
      return response.ok
        ? { ok: true, data: { url: body.url as string } }
        : { ok: false, error: body.error || "创建邀请失败" };
    },
    [loadMemorySpace, slug],
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
      onEngagement={track}
      memorySpace={memorySpace}
      memorySpaceLoading={memorySpaceLoading}
      onCreateMemoryEntry={createMemoryEntry}
      onUploadMemoryMedia={uploadMemoryMedia}
      onClaimMemorySpace={claimMemorySpace}
      onRequestInvitePermission={requestInvitePermission}
      onCreateRecipientInvite={createRecipientInvite}
    />
  );
}
