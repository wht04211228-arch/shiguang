"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CollaborationContribution,
  CollaborationSpaceSummary,
} from "@/lib/collaboration/types";

type InviteRow = {
  id: string;
  invite_type: "public" | "personal" | "recipient_granted";
  label: string | null;
  expected_name: string | null;
  status: string;
  deadline_override: string | null;
  opened_at: string | null;
  submitted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  token_hint: string;
};

type ManagementRequestRow = {
  id: string;
  requester_id: string;
  target_user_id: string | null;
  request_type: string;
  status: string;
  response_deadline: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type Props = {
  orderId?: string;
  cloudMode: boolean;
  onStatus?: (status: string) => void;
};

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { error: `服务器返回了无法识别的内容（HTTP ${response.status}）` };
  }
}

function toLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function CollaborationManager({
  orderId,
  cloudMode,
  onStatus,
}: Props) {
  const [space, setSpace] = useState<CollaborationSpaceSummary | null>(null);
  const [contributions, setContributions] = useState<CollaborationContribution[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"secret" | "wall">("secret");
  const [deadline, setDeadline] = useState("");
  const [personalName, setPersonalName] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [managementRequests, setManagementRequests] = useState<ManagementRequestRow[]>([]);

  const notify = (message: string) => {
    setStatus(message);
    onStatus?.(message);
  };

  const load = async () => {
    if (!cloudMode || !orderId) return;
    const [spaceResponse, inviteResponse, requestResponse] = await Promise.all([
      fetch(`/api/collaboration/spaces?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      }),
      fetch(`/api/collaboration/invites?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      }),
      fetch(`/api/memory-space/requests?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      }),
    ]);
    const spaceBody = await readJson(spaceResponse);
    const inviteBody = await readJson(inviteResponse);
    const requestBody = await readJson(requestResponse);
    if (!spaceResponse.ok) throw new Error(spaceBody.error || "读取共创空间失败");
    setSpace((spaceBody.space as CollaborationSpaceSummary | null) ?? null);
    setContributions((spaceBody.contributions as CollaborationContribution[]) ?? []);
    setInvites((inviteBody.invites as InviteRow[]) ?? []);
    setManagementRequests((requestBody.requests as ManagementRequestRow[]) ?? []);
    if (spaceBody.space) {
      setMode(spaceBody.space.mode);
      setDeadline(toLocal(spaceBody.space.contributionDeadline));
    }
  };

  useEffect(() => {
    void load().catch((error) => notify(error instanceof Error ? error.message : "读取共创空间失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, orderId]);

  const progress = useMemo(() => {
    if (!space?.inviteLimit) return 0;
    return Math.min(100, Math.round((space.contributionCount / space.inviteLimit) * 100));
  }, [space]);

  const saveSettings = async (patch?: Record<string, unknown>) => {
    if (!orderId) return;
    setBusy(true);
    notify("正在保存共创设置…");
    try {
      const response = await fetch("/api/collaboration/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          mode,
          deadline: toIso(deadline),
          ...patch,
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "保存失败");
      notify("共创设置已保存");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async (type: "public" | "personal") => {
    if (!orderId) return;
    if (type === "personal" && !personalName.trim()) {
      notify("请先填写参与者昵称");
      return;
    }
    setBusy(true);
    notify("正在生成秘密邀请链接…");
    try {
      const response = await fetch("/api/collaboration/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          type,
          label: type === "public" ? "公共群聊邀请" : `邀请 ${personalName.trim()}`,
          expectedName: type === "personal" ? personalName.trim() : undefined,
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "创建邀请失败");
      setLastInviteUrl(body.url || "");
      if (body.url) {
        await navigator.clipboard.writeText(body.url).catch(() => undefined);
        notify("邀请链接已生成并复制，可以直接发送");
      }
      setPersonalName("");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "创建邀请失败");
    } finally {
      setBusy(false);
    }
  };

  const updateInvite = async (inviteId: string, action: "revoke" | "extend") => {
    if (!orderId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/collaboration/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inviteId,
          orderId,
          action,
          deadline: action === "extend" ? toIso(deadline) : undefined,
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "更新邀请失败");
      notify(action === "revoke" ? "邀请链接已撤销" : "已为参与者延长截止时间");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "更新邀请失败");
    } finally {
      setBusy(false);
    }
  };

  const moderate = async (
    id: string,
    action: "approve" | "hide" | "request_changes" | "delete" | "reorder" | "approve_withdrawal",
    extra: Record<string, unknown> = {},
  ) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/collaboration/contributions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "管理投稿失败");
      notify(
        action === "approve"
          ? "投稿已确认，可进入正式礼物"
          : action === "approve_withdrawal"
            ? "撤回申请已确认，内容将保持永久隐藏"
          : action === "request_changes"
            ? "已退回投稿者修改"
            : action === "hide"
              ? "投稿已隐藏"
              : action === "delete"
                ? "投稿已删除"
                : "顺序已更新",
      );
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "管理投稿失败");
    } finally {
      setBusy(false);
    }
  };

  const respondManagementRequest = async (requestId: string, action: "approve" | "reject") => {
    if (!orderId) return;
    setBusy(true);
    notify(action === "approve" ? "正在批准共同管理申请…" : "正在拒绝申请…");
    try {
      const response = await fetch("/api/memory-space/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, requestId, action }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "处理申请失败");
      notify(action === "approve" ? "申请已批准并立即生效" : "申请已拒绝");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "处理申请失败");
    } finally {
      setBusy(false);
    }
  };

  if (!cloudMode) {
    return (
      <section className="collaboration-manager empty">
        <div className="editor-section-heading">
          <span>06</span>
          <div>
            <h2>多人秘密共创</h2>
            <p>连接 Supabase 并使用已付款订单后，可以生成真实邀请链接。</p>
          </div>
        </div>
        <div className="next-action-card">
          <strong>演示下一步</strong>
          <p>发布到云端后，邀请朋友通过秘密链接提交文字、最多3张照片、语音和套餐允许的视频。</p>
        </div>
      </section>
    );
  }

  if (!orderId) {
    return (
      <section className="collaboration-manager empty">
        <div className="editor-section-heading">
          <span>06</span>
          <div><h2>多人秘密共创</h2><p>先从已付款订单进入制作台，系统才能确定邀请人数权益。</p></div>
        </div>
        <a className="button-primary" href="/orders">选择一张已付款订单</a>
      </section>
    );
  }

  return (
    <section className="collaboration-manager">
      <div className="editor-section-heading">
        <span>06</span>
        <div>
          <h2>邀请重要的人，一起完成这份礼物</h2>
          <p>参与者默认只看到自己的投稿；购买者可以确认、排序、隐藏、删除或退回修改，但不能改写原文。</p>
        </div>
      </div>

      {!space ? (
        <div className="collaboration-onboarding">
          <div><strong>还没有开启共创空间</strong><p>创建后可以生成公共群聊链接和每位参与者的专属链接。</p></div>
          <button type="button" className="button-primary" disabled={busy} onClick={() => void saveSettings()}>
            开启多人共创
          </button>
        </div>
      ) : (
        <>
          <div className="collaboration-overview">
            <article><strong>{space.contributionCount}</strong><span>已投稿 / {space.inviteLimit}人</span></article>
            <article><strong>{space.approvedCount}</strong><span>已确认进入礼物</span></article>
            <article><strong>{space.openedCount}</strong><span>已打开邀请</span></article>
            <article><strong>{space.submissionsOpen ? "开放" : "关闭"}</strong><span>投稿状态</span></article>
          </div>
          <div className="collaboration-progress"><span style={{ width: `${progress}%` }} /></div>

          <div className="collaboration-settings-grid">
            <label className="field">
              <span>参与者可见模式</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as "secret" | "wall")}>
                <option value="secret">秘密共创：只能看到自己的投稿</option>
                <option value="wall">共创留言墙：通过后可互相查看</option>
              </select>
            </label>
            <label className="field">
              <span>统一投稿截止时间</span>
              <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </label>
          </div>
          <div className="inline-actions">
            <button type="button" className="button-secondary" disabled={busy} onClick={() => void saveSettings()}>
              保存共创设置
            </button>
            <button
              type="button"
              className="button-quiet"
              disabled={busy}
              onClick={() => void saveSettings({ submissionsOpen: !space.submissionsOpen })}
            >
              {space.submissionsOpen ? "停止新增投稿" : "重新开放投稿"}
            </button>
            <button type="button" className="button-quiet" disabled={busy} onClick={() => void saveSettings({ lock: true })}>
              锁定全部投稿版本
            </button>
          </div>

          <div className="invite-builder">
            <div>
              <p className="landing-kicker">PUBLIC INVITE</p>
              <h3>发到群聊的公共邀请</h3>
              <p>任何拿到链接的人都能进入，但仍受人数上限、截止时间和随时关闭控制。</p>
              <button type="button" className="button-primary" disabled={busy} onClick={() => void createInvite("public")}>
                生成公共邀请链接
              </button>
            </div>
            <div>
              <p className="landing-kicker">PERSONAL INVITE</p>
              <h3>为重要参与者生成专属链接</h3>
              <label className="field"><span>参与者昵称</span><input value={personalName} onChange={(event) => setPersonalName(event.target.value)} placeholder="例如：大学室友小林" /></label>
              <button type="button" className="button-secondary" disabled={busy} onClick={() => void createInvite("personal")}>
                创建并复制专属链接
              </button>
            </div>
          </div>
          {lastInviteUrl ? (
            <div className="generated-invite">
              <input readOnly value={lastInviteUrl} />
              <button type="button" onClick={() => void navigator.clipboard.writeText(lastInviteUrl)}>再次复制</button>
            </div>
          ) : null}

          <div className="invite-list-section">
            <header><div><p className="landing-kicker">INVITE RADAR</p><h3>共创雷达</h3></div><span>{invites.length} 条邀请链接</span></header>
            {invites.length ? (
              <div className="invite-list">
                {invites.map((invite) => (
                  <article key={invite.id}>
                    <div>
                      <strong>{invite.label || invite.expected_name || "邀请链接"}</strong>
                      <small>{invite.invite_type === "public" ? "公共链接" : "专属链接"} · {invite.status} · {invite.token_hint}</small>
                    </div>
                    <div>
                      {invite.opened_at ? <span>已打开</span> : <span>未打开</span>}
                      {invite.submitted_at ? <span>已投稿</span> : <span>未投稿</span>}
                    </div>
                    <div>
                      <button type="button" disabled={busy || invite.status === "revoked"} onClick={() => void updateInvite(invite.id, "extend")}>延长期限</button>
                      <button type="button" disabled={busy || invite.status === "revoked"} onClick={() => void updateInvite(invite.id, "revoke")}>撤销</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty-replies">尚未生成邀请链接。</p>}
          </div>

          {managementRequests.length ? (
            <div className="management-request-section">
              <header>
                <div><p className="landing-kicker">SHARED CONTROL</p><h3>共同管理申请</h3></div>
                <span>{managementRequests.filter((item) => item.status === "pending").length} 项待处理</span>
              </header>
              <div className="management-request-list">
                {managementRequests.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.request_type === "recipient_invite_permission" ? "收件人申请继续邀请朋友" : item.request_type === "transfer_primary_manager" ? "主要管理权转移" : item.request_type === "permanent_delete" ? "永久删除申请" : item.request_type === "permanent_close" ? "永久关闭申请" : "纪念空间管理申请"}</strong>
                      <small>状态：{item.status} · 确认期限 {new Date(item.response_deadline).toLocaleDateString("zh-CN")}</small>
                    </div>
                    {item.status === "pending" ? (
                      <div>
                        <button type="button" className="button-primary" disabled={busy} onClick={() => void respondManagementRequest(item.id, "approve")}>同意并应用</button>
                        <button type="button" className="button-quiet" disabled={busy} onClick={() => void respondManagementRequest(item.id, "reject")}>拒绝</button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="contribution-review-section">
            <header><div><p className="landing-kicker">CONTRIBUTION REVIEW</p><h3>确认共创投稿</h3></div><span>{contributions.length} 份内容</span></header>
            {contributions.length ? (
              <div className="contribution-list">
                {contributions.map((item, index) => (
                  <article className={`contribution-card status-${item.status}`} key={item.id}>
                    <header>
                      <div><strong>{item.displayName}</strong>{item.anonymousToRecipient ? <span>对收件人匿名</span> : null}<small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {item.status}</small></div>
                      <label>顺序<input type="number" min={1} value={item.sortOrder || index + 1} onChange={(event) => void moderate(item.id, "reorder", { sortOrder: Number(event.target.value) })} /></label>
                    </header>
                    <p>{item.message}</p>
                    {item.media.length ? <div className="contribution-media">{item.media.map((media, mediaIndex) => media.type === "image" && media.url ? <img key={`${media.path}-${mediaIndex}`} src={media.url} alt="共创投稿" /> : <a key={`${media.path}-${mediaIndex}`} href={media.url} target="_blank" rel="noreferrer">打开{media.type === "audio" ? "语音" : "视频"}</a>)}</div> : null}
                    {item.moderationNote ? <small>{item.moderationNote}</small> : null}
                    <div className="inline-actions">
                      {item.status === "withdrawal_pending" ? (
                        <button type="button" className="button-primary" disabled={busy} onClick={() => void moderate(item.id, "approve_withdrawal", { note: "已尊重投稿者撤回申请" })}>确认永久撤回</button>
                      ) : (
                        <button type="button" className="button-primary" disabled={busy || item.status === "approved"} onClick={() => void moderate(item.id, "approve")}>确认进入礼物</button>
                      )}
                      <button type="button" className="button-secondary" disabled={busy} onClick={() => void moderate(item.id, "request_changes", { note: "请根据购买者的建议修改后重新提交" })}>退回修改</button>
                      <button type="button" className="button-quiet" disabled={busy} onClick={() => void moderate(item.id, "hide")}>隐藏</button>
                      <button type="button" className="button-quiet danger" disabled={busy} onClick={() => void moderate(item.id, "delete")}>删除</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty-replies">还没有收到投稿。先复制一条邀请链接发给朋友。</p>}
          </div>
        </>
      )}
      {status ? <p className="collaboration-manager-status">{status}</p> : null}
    </section>
  );
}
