"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/brand/SiteHeader";
import { isThemeKey, themeDefinitions, type ThemeKey } from "@/lib/experience/themes";

type Needs = {
  video: "none" | "few" | "many";
  collaboration: "solo" | "small" | "large";
  storage: "30d" | "1y" | "long";
  ai: "basic" | "more" | "planning";
};

type PlanKey = "light" | "deep" | "private";

const plans: Record<PlanKey, { name: string; price: number; description: string }> = {
  light: { name: "轻定制", price: 5.2, description: "适合照片与文字为主、只需要一版基础 AI 初稿的礼物。" },
  deep: { name: "深度定制", price: 13.14, description: "支持 3 段视频、多次 AI 调整与更完整的互动表达。" },
  private: { name: "私人策划", price: 29.9, description: "适合重要里程碑、多人参与、更多视频与深入文案策划。" },
};

function recommend(needs: Needs): PlanKey {
  if (needs.video === "many" || needs.collaboration === "large" || needs.ai === "planning") return "private";
  if (needs.video === "few" || needs.collaboration === "small" || needs.ai === "more") return "deep";
  return "light";
}

export default function PlanRecommendationWizard({ theme }: { theme: ThemeKey }) {
  const [needs, setNeeds] = useState<Needs>({ video: "none", collaboration: "solo", storage: "30d", ai: "basic" });
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const recommendation = useMemo(() => recommend(needs), [needs]);
  const storageFee = needs.storage === "1y" ? 9.9 : needs.storage === "long" ? 49.9 : 0;

  useEffect(() => {
    const saved = window.localStorage.getItem("shiguang-plan-needs");
    if (saved) {
      try { setNeeds(JSON.parse(saved) as Needs); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("shiguang-plan-needs", JSON.stringify(needs));
  }, [needs]);

  function continueWith(plan: PlanKey) {
    window.localStorage.setItem("shiguang-selected-plan", plan);
    window.location.href = `/story-preview?theme=${theme}&plan=${plan}`;
  }

  return (
    <main className={`plan-recommend-page ${theme}`}>
      <SiteHeader active="pricing" compact />
      <section className="plan-recommend-shell">
        <div className="plan-recommend-heading">
          <p>THEME CONFIRMED</p>
          <h1>你已经选择了{themeDefinitions[theme].name}。</h1>
          <span>接下来只判断你需要多少创作能力，主题本身不加价。</span>
        </div>

        <div className="plan-needs-grid">
          <fieldset>
            <legend>是否需要视频？</legend>
            {[{ k: "none", t: "不需要视频" }, { k: "few", t: "需要 1～3 段视频" }, { k: "many", t: "需要更多视频" }].map((item) => <button className={needs.video === item.k ? "active" : ""} type="button" key={item.k} onClick={() => setNeeds((value) => ({ ...value, video: item.k as Needs["video"] }))}>{item.t}</button>)}
          </fieldset>
          <fieldset>
            <legend>是否邀请别人共同制作？</legend>
            {[{ k: "solo", t: "只由我自己完成" }, { k: "small", t: "邀请少数朋友或家人" }, { k: "large", t: "邀请较多人一起参与" }].map((item) => <button className={needs.collaboration === item.k ? "active" : ""} type="button" key={item.k} onClick={() => setNeeds((value) => ({ ...value, collaboration: item.k as Needs["collaboration"] }))}>{item.t}</button>)}
          </fieldset>
          <fieldset>
            <legend>希望保存多久？</legend>
            {[{ k: "30d", t: "30 天即可" }, { k: "1y", t: "保存 1 年 · +¥9.90" }, { k: "long", t: "长期纪念 · +¥49.90" }].map((item) => <button className={needs.storage === item.k ? "active" : ""} type="button" key={item.k} onClick={() => setNeeds((value) => ({ ...value, storage: item.k as Needs["storage"] }))}>{item.t}</button>)}
          </fieldset>
          <fieldset>
            <legend>需要多少 AI 帮助？</legend>
            {[{ k: "basic", t: "只需要一版初稿" }, { k: "more", t: "希望能够多次调整" }, { k: "planning", t: "希望获得深入文案策划" }].map((item) => <button className={needs.ai === item.k ? "active" : ""} type="button" key={item.k} onClick={() => setNeeds((value) => ({ ...value, ai: item.k as Needs["ai"] }))}>{item.t}</button>)}
          </fieldset>
        </div>

        <section className="plan-recommend-result">
          <div>
            <p>推荐套餐</p>
            <h2>{plans[recommendation].name}</h2>
            <strong>¥{plans[recommendation].price.toFixed(2)}</strong>
            <span>{plans[recommendation].description}</span>
            {storageFee ? <small>所选保存服务 +¥{storageFee.toFixed(2)}，预计合计 ¥{(plans[recommendation].price + storageFee).toFixed(2)}</small> : null}
          </div>
          <button type="button" onClick={() => continueWith(recommendation)}>采用推荐并预览我的故事</button>
        </section>

        <div className="plan-alternatives">
          <p>你也可以自行选择：</p>
          {Object.entries(plans).map(([key, plan]) => (
            <button className={selected === key ? "active" : ""} type="button" key={key} onClick={() => setSelected(key as PlanKey)}>
              <span>{plan.name}</span><b>¥{plan.price.toFixed(2)}</b><small>{plan.description}</small>
            </button>
          ))}
          {selected ? <button className="plan-selected-next" type="button" onClick={() => continueWith(selected)}>使用{plans[selected].name}继续</button> : null}
        </div>

        <Link className="plan-back-link" href="/create">返回修改主题推荐</Link>
      </section>
    </main>
  );
}
