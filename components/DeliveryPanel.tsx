"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

export default function DeliveryPanel({
  slug,
  recipientName,
  onClose,
}: {
  slug: string;
  recipientName: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = useMemo(
    () =>
      typeof window === "undefined"
        ? `/card/${slug}`
        : `${window.location.origin}/card/${slug}`,
    [slug],
  );

  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: "H",
    }).then(setQr);
  }, [url]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr;
    link.download = `拾光-${recipientName || slug}-二维码.png`;
    link.click();
  };

  return (
    <div className="delivery-overlay" role="dialog" aria-modal="true">
      <section className="delivery-panel">
        <button className="delivery-close" type="button" onClick={onClose}>
          关闭
        </button>
        <p className="landing-kicker">DELIVERY KIT</p>
        <h2>把礼物交到对方手中</h2>
        <p>
          发布成功后，将专属链接或二维码发送给收件人。二维码本身不包含礼物内容，只指向专属页面。
        </p>
        <div className="delivery-qr">
          {qr ? (
            <img src={qr} alt="专属礼物二维码" />
          ) : (
            <span>正在生成二维码…</span>
          )}
        </div>
        <code>{url}</code>
        <div className="delivery-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => void copy()}
          >
            {copied ? "已复制" : "复制专属链接"}
          </button>
          <button type="button" className="button-secondary" onClick={download}>
            下载二维码
          </button>
        </div>
        <small>建议先用无痕窗口测试解锁问题，再正式发送。</small>
      </section>
    </div>
  );
}
