"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trackConversionEvent } from "@/components/AnalyticsEvent";

export type BriefData = {
  recipientName: string;
  relationship: string;
  occasion: string;
  deliveryDate: string;
  preferredTheme: "cinema" | "starlight" | "film" | "unsure";
  tone: "warm" | "romantic" | "restrained" | "playful" | "solemn";
  storyFactsText: string;
  mustInclude: string;
  avoidContent: string;
  contactMethod: string;
  specialRequests: string;
};

const initial: BriefData = {
  recipientName: "",
  relationship: "恋人",
  occasion: "生日",
  deliveryDate: "",
  preferredTheme: "film",
  tone: "warm",
  storyFactsText: "",
  mustInclude: "",
  avoidContent: "",
  contactMethod: "",
  specialRequests: "",
};

export default function BriefForm({
  orderId,
  existing,
}: {
  orderId: string;
  existing?: Partial<BriefData> | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BriefData>({ ...initial, ...existing });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const storyCount = useMemo(
    () => form.storyFactsText.split("\n").map((v) => v.trim()).filter(Boolean).length,
    [form.storyFactsText],
  );

  const update = <K extends keyof BriefData>(key: K, value: BriefData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async (submit: boolean) => {
    if (!form.recipientName.trim() || !form.relationship.trim() || !form.occasion.trim()) {
      setMessage("请至少填写收件人、双方关系和使用场景");
      return;
    }
    if (submit && storyCount < 2) {
      setMessage("正式提交前请至少填写两条真实回忆，越具体越容易做出专属感");
      return;
    }
    setBusy(true);
    setMessage(submit ? "正在提交需求…" : "正在保存草稿…");
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          submit,
          recipientName: form.recipientName,
          relationship: form.relationship,
          occasion: form.occasion,
          deliveryDate: form.deliveryDate || null,
          preferredTheme: form.preferredTheme,
          tone: form.tone,
          storyFacts: form.storyFactsText
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          mustInclude: form.mustInclude,
          avoidContent: form.avoidContent,
          contactMethod: form.contactMethod,
          specialRequests: form.specialRequests,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      if (submit) {
        void trackConversionEvent("brief_submitted", { orderId });
        router.push(`/order/${orderId}?brief=submitted`);
        router.refresh();
      } else {
        setMessage("草稿已保存，你可以稍后继续填写");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="brief-form-card">
      <div className="brief-progress">
        <span className="active">1 关系与场景</span>
        <span>2 真实回忆</span>
        <span>3 风格与交付</span>
      </div>

      <div className="form-section">
        <p className="landing-kicker">01 · WHO & WHY</p>
        <h2>这份礼物要送给谁？</h2>
        <div className="form-grid two">
          <label>
            <span>收件人称呼 *</span>
            <input value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} placeholder="例如：小余、妈妈、阿辰" />
          </label>
          <label>
            <span>你们的关系 *</span>
            <input value={form.relationship} onChange={(e) => update("relationship", e.target.value)} placeholder="例如：恋人、闺蜜、母女" />
          </label>
          <label>
            <span>使用场景 *</span>
            <input value={form.occasion} onChange={(e) => update("occasion", e.target.value)} placeholder="生日、纪念日、表白、道歉" />
          </label>
          <label>
            <span>期望交付日期</span>
            <input type="date" value={form.deliveryDate} onChange={(e) => update("deliveryDate", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="form-section">
        <p className="landing-kicker">02 · TRUE DETAILS</p>
        <h2>请写下只有你们知道的真实细节</h2>
        <p className="form-help">每行一件事。不要追求文采，地点、日期、动作和一句原话比“我们很幸福”更有价值。</p>
        <label>
          <span>共同回忆（至少两条）</span>
          <textarea rows={9} value={form.storyFactsText} onChange={(e) => update("storyFactsText", e.target.value)} placeholder={"第一次见面是在学校东门，她迟到了十分钟\n去年冬天一起坐错了地铁，却意外找到一家小店\n她紧张时会反复整理衣角"} />
          <small>当前 {storyCount} 条</small>
        </label>
        <div className="form-grid two">
          <label>
            <span>一定要出现的内容</span>
            <textarea rows={4} value={form.mustInclude} onChange={(e) => update("mustInclude", e.target.value)} placeholder="称呼、承诺、某张照片或一句原话" />
          </label>
          <label>
            <span>不要出现的内容</span>
            <textarea rows={4} value={form.avoidContent} onChange={(e) => update("avoidContent", e.target.value)} placeholder="不希望提及的人、事情或表达方式" />
          </label>
        </div>
      </div>

      <div className="form-section">
        <p className="landing-kicker">03 · STYLE & DELIVERY</p>
        <h2>决定它最终呈现的感觉</h2>
        <div className="form-grid two">
          <label>
            <span>视觉方向</span>
            <select value={form.preferredTheme} onChange={(e) => update("preferredTheme", e.target.value as BriefData["preferredTheme"])}>
              <option value="film">C · 温暖胶片与真实生活感</option>
              <option value="cinema">A · 电影感高级浪漫</option>
              <option value="starlight">B · 梦幻星空与童话感</option>
              <option value="unsure">不确定，请帮我判断</option>
            </select>
          </label>
          <label>
            <span>文案语气</span>
            <select value={form.tone} onChange={(e) => update("tone", e.target.value as BriefData["tone"])}>
              <option value="warm">温暖真实</option>
              <option value="romantic">浪漫深情</option>
              <option value="restrained">克制高级</option>
              <option value="playful">轻松俏皮</option>
              <option value="solemn">郑重正式</option>
            </select>
          </label>
          <label>
            <span>方便联系的方式</span>
            <input value={form.contactMethod} onChange={(e) => update("contactMethod", e.target.value)} placeholder="邮箱、微信号或其他方式（选填）" />
          </label>
          <label>
            <span>其他特殊要求</span>
            <input value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} placeholder="例如：必须在晚上 8 点解锁" />
          </label>
        </div>
      </div>

      <div className="brief-actions">
        <button className="button-secondary" disabled={busy} onClick={() => void save(false)}>保存草稿</button>
        <button className="button-primary" disabled={busy} onClick={() => void save(true)}>提交制作需求</button>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
