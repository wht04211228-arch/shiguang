"use client";

import { useState } from "react";

export default function ReportIssueButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("privacy");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setStatus("正在提交…");
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, category, detail }),
    });
    const text = await response.text();
    const body = text.trim() ? JSON.parse(text) : {};
    setBusy(false);
    if (!response.ok) {
      setStatus(body.error || "提交失败");
      return;
    }
    setStatus("已经提交。隐私与安全问题会优先进入复核。");
    setDetail("");
  };

  return (
    <div className="gift-report-control">
      <button type="button" className="icon-button" onClick={() => setOpen((value) => !value)}>
        报告问题
      </button>
      {open ? (
        <div className="gift-report-popover">
          <strong>报告隐私、安全或侵权问题</strong>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="privacy">隐私泄露</option>
            <option value="copyright">版权或肖像权</option>
            <option value="harassment">骚扰或攻击</option>
            <option value="unsafe">安全风险</option>
            <option value="illegal">疑似违法内容</option>
            <option value="other">其他问题</option>
          </select>
          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="请说明具体内容和所在位置，至少8个字。"
          />
          <div>
            <button type="button" onClick={() => setOpen(false)}>取消</button>
            <button type="button" disabled={busy || detail.trim().length < 8} onClick={() => void submit()}>
              {busy ? "提交中…" : "提交复核"}
            </button>
          </div>
          {status ? <p>{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
