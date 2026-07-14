"use client";

import { useMemo, useRef, useState } from "react";
import type {
  MemorySpaceSummary,
  RecipientEntry,
  RecipientEntryType,
  RecipientMediaAsset,
} from "@/lib/memory-space/types";

type AsyncResult<T = unknown> = { ok: boolean; error?: string; data?: T };

type Props = {
  slug: string;
  space: MemorySpaceSummary | null;
  loading?: boolean;
  onCreate: (
    entryType: RecipientEntryType,
    content: string,
    media: RecipientMediaAsset[],
  ) => Promise<AsyncResult<RecipientEntry>>;
  onUpload: (file: File) => Promise<AsyncResult<RecipientMediaAsset>>;
  onClaim: () => Promise<AsyncResult>;
  onRequestInvitePermission: () => Promise<AsyncResult>;
  onCreateRecipientInvite: (expectedName: string) => Promise<AsyncResult<{ url: string }>>;
};

const typeLabels: Record<RecipientEntryType, string> = {
  reply: "回信",
  memory: "新回忆",
  future_update: "未来进度",
  photo: "照片记录",
  audio: "声音记录",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "刚刚";
  }
}

export default function RecipientMemorySpace({
  slug,
  space,
  loading = false,
  onCreate,
  onUpload,
  onClaim,
  onRequestInvitePermission,
  onCreateRecipientInvite,
}: Props) {
  const [entryType, setEntryType] = useState<RecipientEntryType>("memory");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<RecipientMediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const phaseText = useMemo(() => {
    if (!space) return "正在准备共同纪念空间";
    if (space.managementPhase === "recipient_managed") return "由收件人主要管理";
    if (space.managementPhase === "co_managed") return "双方共同管理";
    return "暂由送礼人管理";
  }, [space]);

  const submit = async () => {
    if (!content.trim() && !media.length) {
      setStatus("请写下一段内容，或先添加照片与声音。");
      return;
    }
    setBusy(true);
    setStatus("正在把这一页保存进纪念空间…");
    const result = await onCreate(entryType, content.trim(), media);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "保存失败，请稍后重试。");
      return;
    }
    setContent("");
    setMedia([]);
    setStatus("已经保存。以后再回来时，它仍会在这里。");
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setStatus("正在安全上传素材…");
    const result = await onUpload(file);
    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus(result.error || "上传失败，请重新选择。");
      return;
    }
    setMedia((items) => [...items, result.data!].slice(0, 3));
    setStatus("素材已经加入，保存这一页后会进入纪念空间。");
    if (fileRef.current) fileRef.current.value = "";
  };

  const claim = async () => {
    setBusy(true);
    setStatus("正在绑定你的账号…");
    const result = await onClaim();
    setBusy(false);
    if (!result.ok) {
      if (result.error?.includes("登录")) {
        setStatus("需要先登录。登录后回到这条礼物链接即可继续绑定。");
        window.setTimeout(() => {
          window.location.href = `/login?next=${encodeURIComponent(`/card/${slug}`)}`;
        }, 900);
        return;
      }
      setStatus(result.error || "绑定失败");
      return;
    }
    setStatus("绑定完成。这里已经成为你们共同维护的纪念空间。");
  };

  const requestInvite = async () => {
    setBusy(true);
    setStatus("正在提交邀请权限申请…");
    const result = await onRequestInvitePermission();
    setBusy(false);
    setStatus(
      result.ok
        ? "申请已发给送礼人，批准后你可以继续邀请重要的人。"
        : result.error || "申请失败",
    );
  };


  const createRecipientInvite = async () => {
    setBusy(true);
    setStatus("正在生成新的秘密邀请…");
    const result = await onCreateRecipientInvite(inviteName.trim());
    setBusy(false);
    if (!result.ok || !result.data?.url) {
      setStatus(result.error || "创建邀请失败");
      return;
    }
    setInviteUrl(result.data.url);
    await navigator.clipboard.writeText(result.data.url).catch(() => undefined);
    setInviteName("");
    setStatus("邀请链接已经生成并复制，可以发给下一位重要的人。");
  };

  return (
    <section className="recipient-memory-space">
      <header className="recipient-space-heading">
        <div>
          <p className="gift-kicker">OUR MEMORY SPACE</p>
          <h3>把这份礼物继续写下去</h3>
          <p>
            你可以留下新的照片、声音、回忆和未来进度。这里不是一次性的回信，而是一段会继续生长的共同记录。
          </p>
        </div>
        <span>{loading ? "正在同步" : phaseText}</span>
      </header>

      {space?.entries.length ? (
        <div className="recipient-entry-timeline">
          {space.entries.map((entry) => (
            <article key={entry.id}>
              <div className="recipient-entry-meta">
                <strong>{typeLabels[entry.entryType]}</strong>
                <time>{formatDate(entry.createdAt)}</time>
              </div>
              {entry.content ? <p>{entry.content}</p> : null}
              {entry.media.length ? (
                <div className="recipient-entry-media">
                  {entry.media.map((asset, index) =>
                    asset.type === "image" && asset.url ? (
                      <img
                        key={`${asset.path}-${index}`}
                        src={asset.url}
                        alt={asset.name || "纪念照片"}
                      />
                    ) : asset.type === "audio" && asset.url ? (
                      <audio
                        key={`${asset.path}-${index}`}
                        src={asset.url}
                        controls
                        preload="metadata"
                      />
                    ) : null,
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="recipient-space-empty">
          <span>01</span>
          <div>
            <strong>这里还没有新的共同记录</strong>
            <p>写下第一段内容后，这份礼物会从“收到的惊喜”变成“共同维护的纪念空间”。</p>
          </div>
        </div>
      )}

      <div className="recipient-entry-composer">
        <div className="recipient-entry-type-tabs" role="tablist" aria-label="选择记录类型">
          {(["memory", "future_update", "reply"] as RecipientEntryType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={entryType === type ? "is-active" : ""}
              onClick={() => setEntryType(type)}
            >
              {typeLabels[type]}
            </button>
          ))}
        </div>
        <label>
          <span>这一页想记录什么？</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              entryType === "future_update"
                ? "例如：我们终于一起去了那片海。"
                : "写下一段新回忆、一句回应，或此刻想保留下来的话……"
            }
            maxLength={3000}
          />
        </label>
        {media.length ? (
          <div className="recipient-upload-list">
            {media.map((asset, index) => (
              <div key={`${asset.path}-${index}`}>
                <span>{asset.type === "image" ? "照片" : "声音"}</span>
                <strong>{asset.name || "已上传素材"}</strong>
                <button
                  type="button"
                  onClick={() => setMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="recipient-composer-actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
            hidden
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button
            type="button"
            className="button-quiet"
            disabled={busy || media.length >= 3}
            onClick={() => fileRef.current?.click()}
          >
            添加照片或声音
          </button>
          <button
            type="button"
            className="gift-primary-button"
            disabled={busy || (!content.trim() && !media.length)}
            onClick={() => void submit()}
          >
            {busy ? "正在处理…" : "保存到共同纪念空间"}
          </button>
        </div>
      </div>

      <div className="recipient-space-control">
        {!space?.recipientBound ? (
          <div>
            <div>
              <strong>绑定账号，长期管理自己的内容</strong>
              <p>绑定后，你可以管理自己新增的照片、声音和回忆，并与送礼人共同维护这份纪念空间。</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void claim()}>
              绑定为收件人
            </button>
          </div>
        ) : space.recipientIsCurrentUser ? (
          <div className="recipient-manager-tools">
            <div>
              <strong>你已拥有收件人管理身份</strong>
              <p>删除重大内容和控制权转移仍会遵循双方确认与分级等待规则。</p>
            </div>
            {space.invitePermissionApproved ? (
              <div className="recipient-invite-builder">
                <label>
                  <span>继续邀请谁参与？</span>
                  <input
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="对方昵称（可稍后确认）"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || space.inviteLimitRemaining <= 0}
                  onClick={() => void createRecipientInvite()}
                >
                  {space.inviteLimitRemaining > 0
                    ? `生成邀请 · 剩余${space.inviteLimitRemaining}人`
                    : "人数额度已用完"}
                </button>
                {inviteUrl ? (
                  <a href={inviteUrl} target="_blank" rel="noreferrer">
                    打开刚生成的邀请链接
                  </a>
                ) : null}
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => void requestInvite()}>
                申请继续邀请朋友
              </button>
            )}
          </div>
        ) : (
          <p>这份礼物已经绑定到收件人账号。当前浏览仍可新增内容，但账号管理功能只对已绑定收件人开放。</p>
        )}
      </div>
      {status ? <p className="recipient-space-status" role="status">{status}</p> : null}
    </section>
  );
}
