"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import BrandLogo from "@/components/brand/BrandLogo";

type InviteInfo = {
  allowed: boolean;
  reason?: string;
  invite: {
    id: string | null;
    type: string;
    label?: string | null;
    expectedName?: string | null;
    deadline?: string | null;
  };
  gift: {
    recipientName: string;
    occasion: string;
    coverTitle: string;
  };
  rules: {
    mode: "secret" | "wall";
    inviteLimit: number;
    remaining: number;
    photoLimit: number;
    audioLimit: number;
    videoCount: number;
    videoSeconds: number;
    planName: string;
  };
};

type UploadAsset = {
  type: "image" | "audio" | "video";
  path: string;
  url?: string;
  name?: string;
  durationSeconds?: number;
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

function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取视频时长，请更换常见 MP4 或 WebM 文件"));
    };
    video.src = url;
  });
}

export default function CollaborationSubmitForm({ token }: { token: string }) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("正在读取秘密邀请…");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [bindAccount, setBindAccount] = useState(false);
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    void fetch(`/api/collaboration/invite/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) throw new Error(body.error || "邀请读取失败");
        setInfo(body as InviteInfo);
        setDisplayName(body.invite?.expectedName || "");
        setStatus(body.allowed ? "邀请有效，可以开始投稿" : body.reason || "暂时不能投稿");
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "邀请读取失败"))
      .finally(() => setLoading(false));
  }, [token]);

  const counts = useMemo(
    () => ({
      images: assets.filter((item) => item.type === "image").length,
      audio: assets.filter((item) => item.type === "audio").length,
      video: assets.filter((item) => item.type === "video").length,
    }),
    [assets],
  );

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !info) return;
    setBusy(true);
    try {
      for (const file of files) {
        const isImage = file.type.startsWith("image/");
        const isAudio = file.type.startsWith("audio/");
        const isVideo = file.type.startsWith("video/");
        if (isImage && counts.images + files.filter((item) => item.type.startsWith("image/")).length > info.rules.photoLimit) {
          throw new Error(`每位参与者最多上传 ${info.rules.photoLimit} 张照片`);
        }
        if (isAudio && counts.audio >= info.rules.audioLimit) {
          throw new Error("每位参与者最多上传1段语音");
        }
        if (isVideo && !info.rules.videoCount) {
          throw new Error("当前礼物套餐暂不支持视频投稿");
        }
        if (isVideo && counts.video >= info.rules.videoCount) {
          throw new Error(`当前套餐最多支持 ${info.rules.videoCount} 段视频`);
        }
        const duration = isVideo ? await getVideoDuration(file) : 0;
        if (isVideo && duration > info.rules.videoSeconds + 0.5) {
          throw new Error(`每段视频不能超过 ${info.rules.videoSeconds} 秒`);
        }
        const form = new FormData();
        form.append("file", file);
        if (isVideo) form.append("durationSeconds", String(duration));
        setStatus(`正在上传 ${file.name}…`);
        const response = await fetch(
          `/api/collaboration/invite/${encodeURIComponent(token)}/upload`,
          { method: "POST", body: form },
        );
        const body = await readJson(response);
        if (!response.ok) throw new Error(body.error || "上传失败");
        setAssets((current) => [...current, body.asset as UploadAsset]);
      }
      setStatus("素材已上传，可以继续确认投稿");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const submit = async () => {
    if (!info?.allowed) return;
    if (!displayName.trim()) {
      setStatus("请先填写你的昵称或身份");
      return;
    }
    if (message.trim().length < 2) {
      setStatus("至少写下一句想对TA说的话");
      return;
    }
    setBusy(true);
    setStatus("正在进行文字安全检查并提交…");
    try {
      const response = await fetch(
        `/api/collaboration/invite/${encodeURIComponent(token)}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName,
            message,
            anonymousToRecipient: anonymous,
            bindAccount,
            media: assets.map(({ url: _url, ...item }) => item),
          }),
        },
      );
      const body = await readJson(response);
      if (!response.ok) {
        const reasons = Array.isArray(body.reasons) ? `：${body.reasons.join("；")}` : "";
        throw new Error(`${body.error || "提交失败"}${reasons}`);
      }
      if (body.editToken && body.contribution?.id) {
        window.localStorage.setItem(
          `shiguang-contribution-${body.contribution.id}`,
          body.editToken,
        );
      }
      setCompleted(true);
      setStatus(body.message || "投稿成功");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="collaboration-page">
        <div className="collaboration-loading"><BrandLogo /><p>{status}</p></div>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="collaboration-page">
        <section className="collaboration-card collaboration-state-card">
          <BrandLogo />
          <h1>这条邀请暂时无法打开</h1>
          <p>{status}</p>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="collaboration-page">
        <section className="collaboration-card collaboration-state-card success">
          <BrandLogo />
          <span className="collaboration-success-mark">✓</span>
          <p className="landing-kicker">CONTRIBUTION RECEIVED</p>
          <h1>你的祝福已经送达</h1>
          <p>{status}</p>
          <small>购买者可以预览、排序、隐藏、删除或退回修改，但不能直接篡改你的原文。</small>
        </section>
      </main>
    );
  }

  return (
    <main className="collaboration-page">
      <header className="collaboration-topbar">
        <BrandLogo />
        <span>{info.rules.mode === "secret" ? "秘密共创模式" : "共创留言墙模式"}</span>
      </header>
      <section className="collaboration-intro">
        <p className="landing-kicker">A SECRET INVITATION</p>
        <h1>一起为{info.gift.recipientName}留下一段值得珍藏的话。</h1>
        <p>{info.gift.occasion} · {info.gift.coverTitle}</p>
        <div className="collaboration-rule-row">
          <span>还可接收 {info.rules.remaining} 份投稿</span>
          <span>最多3张照片</span>
          <span>{info.rules.videoCount ? `视频最长${info.rules.videoSeconds}秒` : "当前不支持视频"}</span>
        </div>
      </section>

      <section className="collaboration-card">
        {!info.allowed ? <div className="commerce-alert">{info.reason || "当前不能投稿"}</div> : null}
        <div className="collaboration-steps">
          <span className="active">1 写一句话</span>
          <span className={assets.length ? "active" : ""}>2 加入素材</span>
          <span>3 确认投稿</span>
        </div>

        <label className="field">
          <span>你的昵称或身份</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例如：大学室友小林"
            disabled={!info.allowed || busy}
          />
          <em>购买者始终能看到真实身份；你可以选择对收件人匿名。</em>
        </label>
        <label className="field">
          <span>想对TA说的话</span>
          <textarea
            rows={8}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="写一个真实细节，会比通用祝福更让人记住。"
            disabled={!info.allowed || busy}
          />
          <em>{message.length}/5000</em>
        </label>

        <div className="collaboration-upload-zone">
          <div>
            <strong>添加照片、语音或视频</strong>
            <p>图片和视频不会被宣称为自动审核安全，发布前由购买者最终确认。</p>
          </div>
          <label className="button-secondary">
            选择文件
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,audio/*,video/mp4,video/webm,video/quicktime"
              onChange={(event) => void upload(event)}
              disabled={!info.allowed || busy}
              hidden
            />
          </label>
        </div>
        {assets.length ? (
          <div className="collaboration-assets">
            {assets.map((asset, index) => (
              <article key={`${asset.path}-${index}`}>
                {asset.type === "image" && asset.url ? <img src={asset.url} alt="投稿预览" /> : <span>{asset.type === "audio" ? "语音" : "视频"}</span>}
                <div><strong>{asset.name || `素材 ${index + 1}`}</strong><small>{asset.type}{asset.durationSeconds ? ` · ${Math.round(asset.durationSeconds)}秒` : ""}</small></div>
                <button type="button" onClick={() => setAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))}>移除</button>
              </article>
            ))}
          </div>
        ) : null}

        <div className="collaboration-options">
          <label><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />对收件人显示为“匿名祝福”</label>
          <label><input type="checkbox" checked={bindAccount} onChange={(event) => setBindAccount(event.target.checked)} />已登录时绑定账号，方便长期管理投稿</label>
        </div>
        <button
          type="button"
          className="landing-primary collaboration-submit"
          disabled={!info.allowed || busy}
          onClick={() => void submit()}
        >
          {busy ? "处理中…" : "确认并送出这份祝福"}
        </button>
        <p className="collaboration-status">{status}</p>
      </section>
    </main>
  );
}
