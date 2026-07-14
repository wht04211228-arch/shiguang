"use client";

import { useState } from "react";
import Link from "next/link";

export default function FeedbackForm({
  orderId,
  existing,
}: {
  orderId: string;
  existing?: {
    rating: number;
    testimonial?: string | null;
    publicConsent?: boolean;
    displayName?: string | null;
    allowAnonymousCase?: boolean;
    allowQuote?: boolean;
    allowMedia?: boolean;
    publicAlias?: string | null;
  } | null;
}) {
  const [rating, setRating] = useState(existing?.rating || 5);
  const [testimonial, setTestimonial] = useState(existing?.testimonial || "");
  const [displayName, setDisplayName] = useState(existing?.displayName || "");
  const [publicConsent, setPublicConsent] = useState(Boolean(existing?.publicConsent));
  const [anonymousCase, setAnonymousCase] = useState(Boolean(existing?.allowAnonymousCase));
  const [allowQuote, setAllowQuote] = useState(Boolean(existing?.allowQuote));
  const [allowMedia, setAllowMedia] = useState(Boolean(existing?.allowMedia));
  const [alias, setAlias] = useState(existing?.publicAlias || "");
  const [message, setMessage] = useState(existing ? "评价已经提交，你仍可更新内容。" : "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMessage("正在保存评价与授权…");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          rating,
          testimonial,
          displayName,
          publicConsent,
          allowAnonymousCase: anonymousCase,
          allowQuote,
          allowMedia,
          publicAlias: alias,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      setCode(body.referralCode || "");
      setMessage("感谢你的反馈。案例授权可随时联系运营撤回；推荐码已经为你准备好。" );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="growth-card feedback-card">
      <p className="landing-kicker">AFTER DELIVERY</p>
      <h2>这份礼物最终有没有帮你表达出来？</h2>
      <div className="rating-row" aria-label="评分">
        {[1,2,3,4,5].map((value) => <button key={value} type="button" className={value <= rating ? "active" : ""} onClick={() => setRating(value)}>★</button>)}
      </div>
      <label><span>真实评价</span><textarea rows={4} value={testimonial} onChange={(event) => setTestimonial(event.target.value)} placeholder="可以写制作是否省心、收件人的反应、哪些细节最打动你。" /></label>
      <div className="form-grid two">
        <label><span>公开展示名（选填）</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：林同学、匿名用户" /></label>
        <label><span>案例中的匿名称呼（选填）</span><input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="例如：小满与阿辰" /></label>
      </div>
      <div className="consent-grid">
        <label><input type="checkbox" checked={publicConsent} onChange={(event) => setPublicConsent(event.target.checked)} /><span>允许公开展示这段评价</span></label>
        <label><input type="checkbox" checked={anonymousCase} onChange={(event) => setAnonymousCase(event.target.checked)} /><span>允许匿名整理成案例</span></label>
        <label><input type="checkbox" checked={allowQuote} onChange={(event) => setAllowQuote(event.target.checked)} /><span>允许引用部分文字</span></label>
        <label><input type="checkbox" checked={allowMedia} onChange={(event) => setAllowMedia(event.target.checked)} /><span>允许在再次确认后使用部分图片或录屏</span></label>
      </div>
      <button className="button-primary" disabled={busy} onClick={() => void submit()}>{busy ? "保存中…" : "提交评价并生成推荐码"}</button>
      {code ? <div className="referral-result"><strong>你的推荐码：{code}</strong><code>{typeof window !== "undefined" ? `${window.location.origin}/pricing?ref=${code}` : `/pricing?ref=${code}`}</code><Link href="/referrals">查看推荐数据</Link></div> : null}
      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
