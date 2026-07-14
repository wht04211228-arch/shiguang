"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

type CopyTarget = "gift-link" | "gift-message" | "invite-link" | "invite-message" | null;

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {} as Record<string, any>;
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { error: `服务器返回了无法识别的内容（HTTP ${response.status}）` };
  }
}

export default function DeliveryPanel({
  slug,
  recipientName,
  senderName,
  orderId,
  inviteLimit = 0,
  justPublished = false,
  onClose,
}: {
  slug: string;
  recipientName: string;
  senderName?: string;
  orderId?: string;
  inviteLimit?: number;
  justPublished?: boolean;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [activeSection, setActiveSection] = useState<"recipient" | "friends">("recipient");

  const giftUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? `/card/${slug}`
        : `${window.location.origin}/card/${slug}`,
    [slug],
  );

  const giftMessage = useMemo(
    () =>
      [
        `我为你准备了一份只属于你的拾光礼物${recipientName ? `，${recipientName}` : ""}。`,
        "",
        `点击这里打开：${giftUrl}`,
        "",
        "建议使用手机打开，跟着页面提示一步步体验。这个链接是专属的，请不要随意转发。",
        senderName ? `—— ${senderName}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    [giftUrl, recipientName, senderName],
  );

  const inviteMessage = useMemo(
    () =>
      [
        `我正在为${recipientName || "一位重要的人"}准备一份秘密礼物，想邀请你一起留下祝福、照片或声音。`,
        "",
        inviteUrl ? `点击这里参与：${inviteUrl}` : "先点击下方按钮生成秘密共创链接。",
        "",
        "请先不要告诉TA，提交后我会统一整理进礼物。",
      ].join("\n"),
    [inviteUrl, recipientName],
  );

  useEffect(() => {
    void QRCode.toDataURL(giftUrl, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: "H",
    }).then(setQr);
  }, [giftUrl]);

  useEffect(() => {
    if (!orderId || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`shiguang-public-invite-${orderId}`);
    if (stored) setInviteUrl(stored);
  }, [orderId]);

  const copyText = async (value: string, target: CopyTarget) => {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const download = () => {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr;
    link.download = `拾光-${recipientName || slug}-二维码.png`;
    link.click();
  };

  const shareGift = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copyText(giftMessage, "gift-message");
      return;
    }
    await navigator.share({
      title: `送给${recipientName || "你"}的拾光礼物`,
      text: giftMessage,
      url: giftUrl,
    });
  };

  const ensurePublicInvite = async () => {
    if (!orderId) {
      setInviteError("当前礼物没有绑定订单，无法生成朋友共创链接。");
      return;
    }
    if (inviteLimit <= 0) {
      setInviteError("当前订单尚未开启多人共创，请先升级邀请人数权益。");
      return;
    }
    setInviteBusy(true);
    setInviteError("");
    try {
      const response = await fetch("/api/collaboration/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          type: "public",
          label: "发布后生成的朋友共创链接",
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "生成共创邀请失败");
      const nextUrl = String(body.url || "");
      if (!nextUrl) throw new Error("服务器没有返回共创邀请链接");
      setInviteUrl(nextUrl);
      window.localStorage.setItem(`shiguang-public-invite-${orderId}`, nextUrl);
      await copyText(nextUrl, "invite-link");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "生成共创邀请失败");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="delivery-overlay" role="dialog" aria-modal="true" aria-labelledby="delivery-title">
      <section className="delivery-panel delivery-center-panel">
        <button className="delivery-close" type="button" onClick={onClose}>
          关闭
        </button>

        <div className="delivery-success-mark" aria-hidden="true">✓</div>
        <p className="landing-kicker">DELIVERY CENTER</p>
        <h2 id="delivery-title">{justPublished ? "发布成功，下一步这样发送" : "专属链接与发送说明"}</h2>
        <p className="delivery-lead">
          礼物链接和朋友共创链接用途不同。请选择你现在要发送给谁，系统已经替你准备好链接和话术。
        </p>

        <div className="delivery-route-tabs" role="tablist" aria-label="选择发送对象">
          <button
            type="button"
            className={activeSection === "recipient" ? "active" : ""}
            onClick={() => setActiveSection("recipient")}
          >
            <span>1</span>
            发给收件人
            <small>让TA打开正式礼物</small>
          </button>
          <button
            type="button"
            className={activeSection === "friends" ? "active" : ""}
            onClick={() => setActiveSection("friends")}
          >
            <span>2</span>
            发给朋友 / 家人
            <small>邀请他们秘密共创</small>
          </button>
        </div>

        {activeSection === "recipient" ? (
          <div className="delivery-route-content" role="tabpanel">
            <div className="delivery-route-heading">
              <div>
                <strong>正式礼物专属链接</strong>
                <p>把这一项发给收件人。对方点击后会进入倒计时、解锁和完整礼物体验。</p>
              </div>
              <span className="delivery-purpose-chip">发给 TA</span>
            </div>

            <div className="delivery-recipient-grid">
              <div className="delivery-qr">
                {qr ? <img src={qr} alt="专属礼物二维码" /> : <span>正在生成二维码…</span>}
              </div>
              <div className="delivery-link-block">
                <label>专属礼物链接</label>
                <code>{giftUrl}</code>
                <div className="delivery-inline-actions">
                  <button type="button" className="button-secondary" onClick={() => void copyText(giftUrl, "gift-link")}>
                    {copied === "gift-link" ? "链接已复制" : "复制链接"}
                  </button>
                  <a className="button-secondary" href={giftUrl} target="_blank" rel="noreferrer">
                    打开测试 ↗
                  </a>
                  <button type="button" className="button-secondary" onClick={download}>下载二维码</button>
                </div>
              </div>
            </div>

            <div className="delivery-message-card">
              <header>
                <div><strong>可直接发给收件人的话</strong><small>你可以复制后再按自己的语气修改</small></div>
                <button type="button" onClick={() => void copyText(giftMessage, "gift-message")}>
                  {copied === "gift-message" ? "已复制" : "复制完整话术"}
                </button>
              </header>
              <pre>{giftMessage}</pre>
            </div>

            <div className="delivery-actions delivery-primary-actions">
              <button type="button" className="button-primary" onClick={() => void shareGift()}>
                {copied === "gift-message" ? "话术已复制" : "直接分享给收件人"}
              </button>
              <button type="button" className="button-secondary" onClick={() => setActiveSection("friends")}>
                我还要邀请朋友共创
              </button>
            </div>
          </div>
        ) : (
          <div className="delivery-route-content" role="tabpanel">
            <div className="delivery-route-heading">
              <div>
                <strong>秘密共创邀请链接</strong>
                <p>把这一项发给朋友或家人，让他们提交祝福、照片、语音或视频。不要把正式礼物链接发给共创者。</p>
              </div>
              <span className="delivery-purpose-chip friends">发给朋友</span>
            </div>

            {inviteLimit > 0 ? (
              <>
                <div className="delivery-invite-status">
                  <div>
                    <span>当前共创额度</span>
                    <strong>最多 {inviteLimit} 人</strong>
                  </div>
                  <button type="button" className="button-primary" disabled={inviteBusy} onClick={() => void ensurePublicInvite()}>
                    {inviteBusy ? "正在生成…" : inviteUrl ? "再生成一个共创链接" : "生成并复制共创链接"}
                  </button>
                </div>

                {inviteUrl ? (
                  <>
                    <div className="delivery-link-block delivery-invite-link">
                      <label>朋友共创链接</label>
                      <code>{inviteUrl}</code>
                      <div className="delivery-inline-actions">
                        <button type="button" className="button-secondary" onClick={() => void copyText(inviteUrl, "invite-link")}>
                          {copied === "invite-link" ? "链接已复制" : "复制共创链接"}
                        </button>
                        <a className="button-secondary" href={inviteUrl} target="_blank" rel="noreferrer">打开检查 ↗</a>
                      </div>
                    </div>
                    <div className="delivery-message-card friends-message">
                      <header>
                        <div><strong>可直接发到群聊的话</strong><small>已强调“不要告诉TA”与参与方式</small></div>
                        <button type="button" onClick={() => void copyText(inviteMessage, "invite-message")}>
                          {copied === "invite-message" ? "已复制" : "复制邀请话术"}
                        </button>
                      </header>
                      <pre>{inviteMessage}</pre>
                    </div>
                  </>
                ) : (
                  <div className="delivery-empty-guide">
                    <strong>还没有共创链接</strong>
                    <p>点击“生成并复制共创链接”后，把生成的话术发到朋友群或家人群即可。</p>
                  </div>
                )}
              </>
            ) : (
              <div className="delivery-empty-guide upgrade">
                <strong>当前套餐没有多人共创额度</strong>
                <p>你仍然可以把正式礼物链接发给收件人。需要朋友一起准备时，可前往共创步骤补差价开启邀请人数。</p>
                <button type="button" className="button-secondary" onClick={onClose}>返回制作台查看共创升级</button>
              </div>
            )}

            {inviteError ? <p className="delivery-error">{inviteError}</p> : null}

            <div className="delivery-note-list">
              <strong>发送前请确认</strong>
              <p><span>①</span>朋友收到的是“共创链接”，不是收件人的正式礼物链接。</p>
              <p><span>②</span>先邀请朋友投稿，确认内容后，再把正式礼物链接发给收件人。</p>
              <p><span>③</span>再次生成不会自动撤销旧链接；共创链接泄露时，请在“多人共创”步骤撤销旧链接。</p>
            </div>
          </div>
        )}

        <footer className="delivery-footer-tip">
          <strong>推荐顺序：</strong>先用无痕窗口测试礼物 → 邀请朋友完成投稿 → 最后把正式礼物链接发给收件人。
        </footer>
      </section>
    </div>
  );
}
