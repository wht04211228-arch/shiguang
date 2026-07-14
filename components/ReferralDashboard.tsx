"use client";

import { useEffect, useState } from "react";

export default function ReferralDashboard() {
  const [data, setData] = useState<{ code: string | null; clickCount?: number; paidOrderCount?: number } | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => { const response = await fetch("/api/referrals"); const body = await response.json(); setData(body); };
  useEffect(() => { void load(); }, []);
  const create = async () => { setMessage("正在生成…"); const response = await fetch("/api/referrals", { method: "POST" }); const body = await response.json(); if (!response.ok) { setMessage(body.error || "生成失败"); return; } setData(body); setMessage("推荐码已生成"); };
  const link = data?.code && typeof window !== "undefined" ? `${window.location.origin}/pricing?ref=${data.code}` : "";
  return <section className="referral-dashboard growth-card"><p className="landing-kicker">REFERRAL</p><h2>把真正觉得有价值的体验分享给朋友</h2>{data?.code ? <><div className="referral-code-block"><strong>{data.code}</strong><code>{link}</code></div><div className="referral-metrics"><article><span>打开次数</span><strong>{data.clickCount || 0}</strong></article><article><span>完成购买</span><strong>{data.paidOrderCount || 0}</strong></article></div><button className="button-secondary" onClick={() => { void navigator.clipboard.writeText(link); setMessage("推荐链接已复制"); }}>复制推荐链接</button></> : <button className="button-primary" onClick={() => void create()}>生成我的推荐码</button>}{message ? <p className="form-message">{message}</p> : null}<small>当前版本只追踪打开与支付转化，不自动承诺现金返佣。后续可以接入优惠、积分或礼物升级权益。</small></section>;
}
