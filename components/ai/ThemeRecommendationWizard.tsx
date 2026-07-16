"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/brand/SiteHeader";
import { galaxyDemo } from "@/lib/experience/galaxy-demo";
import { themeDefinitions, type ThemeKey } from "@/lib/experience/themes";

type Result = {
  primary: ThemeKey;
  secondary: ThemeKey;
  primaryFit: string;
  secondaryFit: string;
  primaryReason: string;
  secondaryReason: string;
  transformation: string;
  source: "deepseek" | "rules";
};

type Draft = {
  relationship: string;
  occasion: string;
  emotions: string[];
  story: string;
};

const relationshipOptions = ["恋人", "家人", "朋友", "同学", "同事", "其他重要的人"];
const occasionOptions = ["生日", "恋爱周年", "告白", "毕业", "感谢", "久别重逢", "人生里程碑", "其他"];
const emotionOptions = ["温暖", "浪漫", "惊喜", "感动", "怀念", "安心", "被理解", "对未来的期待"];

function previewClass(draft: Draft): ThemeKey {
  const text = `${draft.relationship}${draft.occasion}${draft.emotions.join("")}${draft.story}`;
  if (/求婚|周年|里程碑|告白|仪式|电影/u.test(text)) return "cinema";
  if (/恋人|异地|浪漫|星|距离|未来/u.test(text)) return "galaxy";
  return "film";
}

export default function ThemeRecommendationWizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ relationship: "", occasion: "", emotions: [], story: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [microTheme, setMicroTheme] = useState<ThemeKey | null>(null);
  const [microProgress, setMicroProgress] = useState(0);
  const previewTheme = useMemo(() => previewClass(draft), [draft]);

  useEffect(() => {
    const stored = window.localStorage.getItem("shiguang-theme-draft");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Draft;
      setDraft(parsed);
    } catch {
      // Ignore malformed local drafts.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("shiguang-theme-draft", JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    if (!microTheme) return;
    setMicroProgress(0);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(100, ((Date.now() - started) / 10_000) * 100);
      setMicroProgress(progress);
      if (progress >= 100) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [microTheme]);

  function toggleEmotion(value: string) {
    setDraft((current) => {
      if (current.emotions.includes(value)) return { ...current, emotions: current.emotions.filter((item) => item !== value) };
      if (current.emotions.length >= 3) return current;
      return { ...current, emotions: [...current.emotions, value] };
    });
  }

  function fillDemo() {
    setDraft({
      relationship: "恋人",
      occasion: "生日和恋爱三周年",
      emotions: [...galaxyDemo.demoAnswers.emotions],
      story: galaxyDemo.demoAnswers.story,
    });
  }

  async function analyze() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/theme-recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as Result & { error?: string };
      if (!response.ok) throw new Error(payload.error || "推荐失败");
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      setResult(payload);
    } catch {
      setResult({
        primary: previewTheme,
        secondary: previewTheme === "galaxy" ? "cinema" : previewTheme === "cinema" ? "film" : "galaxy",
        primaryFit: "非常适合",
        secondaryFit: "比较适合",
        primaryReason: "系统根据关系、纪念场景、情绪和真实小事完成了稳定规则匹配。",
        secondaryReason: "这是另一种能够保留同样真实内容、但节奏与仪式感不同的表达方式。",
        transformation: "你写下的真实小事会被转换为主题中的核心故事节点。",
        source: "rules",
      });
    } finally {
      setLoading(false);
    }
  }

  function chooseTheme(theme: ThemeKey) {
    const next = { ...draft, theme };
    window.localStorage.setItem("shiguang-theme-draft", JSON.stringify(next));
    window.location.href = `/plan-recommend?theme=${theme}`;
  }

  const questions = [
    {
      title: "这份礼物要送给谁？",
      note: "先从关系开始，系统会调整后面的场景与故事建议。",
      content: <div className="ai-choice-grid">{relationshipOptions.map((item) => <button className={draft.relationship === item ? "active" : ""} key={item} type="button" onClick={() => setDraft((current) => ({ ...current, relationship: item }))}>{item}</button>)}</div>,
    },
    {
      title: "你想纪念什么？",
      note: "主题本身不决定价格，先找到最适合的表达方式。",
      content: <div className="ai-choice-grid">{occasionOptions.map((item) => <button className={draft.occasion === item ? "active" : ""} key={item} type="button" onClick={() => setDraft((current) => ({ ...current, occasion: item }))}>{item}</button>)}</div>,
    },
    {
      title: "你希望 TA 感受到什么？",
      note: "最多选择三个最重要的感受。",
      content: <div className="ai-choice-grid emotions">{emotionOptions.map((item) => <button className={draft.emotions.includes(item) ? "active" : ""} key={item} type="button" onClick={() => toggleEmotion(item)}>{item}</button>)}</div>,
    },
    {
      title: "写下一件真实的小事",
      note: "一次见面、一顿饭、一张车票，甚至一句一直记得的话都可以。暂时想不到也能跳过，但推荐会更泛化。",
      content: <textarea value={draft.story} onChange={(event) => setDraft((current) => ({ ...current, story: event.target.value.slice(0, 800) }))} placeholder="例如：我们生活在两座城市，会分享同一天的晚霞……" />,
    },
  ];

  return (
    <main className={`ai-theme-page ${previewTheme}`}>
      <SiteHeader active="create" compact theme={previewTheme} />
      <section className="ai-theme-shell">
        <div className="ai-theme-form">
          <div className="ai-theme-progress"><span>故事助手</span><b>{Math.min(step + 1, 4)} / 4</b><i style={{ width: `${((Math.min(step, 3) + 1) / 4) * 100}%` }} /></div>

          {!result && !loading ? (
            <>
              <button className="ai-demo-fill" type="button" onClick={fillDemo}>不知道怎么填写？使用演示故事体验</button>
              <p className="ai-step-label">STEP {String(step + 1).padStart(2, "0")}</p>
              <h1>{questions[step].title}</h1>
              <p className="ai-step-note">{questions[step].note}</p>
              {questions[step].content}
              <div className="ai-form-actions">
                <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>上一步</button>
                {step < 3 ? <button className="primary" type="button" onClick={() => setStep((value) => Math.min(3, value + 1))}>继续</button> : <button className="primary" type="button" onClick={analyze}>让 AI 推荐主题</button>}
              </div>
              {step === 3 && !draft.story.trim() ? <p className="ai-skip-note">你选择了跳过真实故事。系统仍会推荐，但结果会更偏向关系和场景，不会替你编造经历。</p> : null}
            </>
          ) : null}

          {loading ? (
            <div className="ai-analysis-state">
              <div className={`ai-analysis-symbol ${previewTheme}`}><i /><i /><i /></div>
              <h1>正在理解你想表达的感受……</h1>
              <p>正在匹配故事节奏，并准备两种视觉表达。</p>
            </div>
          ) : null}

          {result ? (
            <div className="ai-result-list">
              <p className="ai-step-label">AI THEME MATCH</p>
              <h1>你的故事更适合这样被记住。</h1>
              <article className={`ai-result-card primary ${result.primary}`}>
                <span>最适合你的故事 · {result.primaryFit}</span>
                <h2>{themeDefinitions[result.primary].name}</h2>
                <p>{result.primaryReason}</p>
                <em>{result.transformation}</em>
                <button type="button" onClick={() => chooseTheme(result.primary)}>采用{themeDefinitions[result.primary].name}</button>
              </article>
              <article className={`ai-result-card secondary ${result.secondary}`}>
                <span>另一个适合的方向 · {result.secondaryFit}</span>
                <h2>{themeDefinitions[result.secondary].name}</h2>
                <p>{result.secondaryReason}</p>
                <button type="button" onClick={() => setMicroTheme(result.secondary)}>体验 10 秒效果</button>
              </article>
              <div className="ai-result-footer"><button type="button" onClick={() => setResult(null)}>修改我的答案</button><Link href="/#themes">查看全部主题</Link></div>
            </div>
          ) : null}
        </div>

        <aside className={`ai-live-preview ${previewTheme}`}>
          <p>当前故事气质</p>
          <h2>{themeDefinitions[previewTheme].name}</h2>
          <div className="ai-live-art" aria-hidden="true"><i /><i /><i /><span /></div>
          <dl>
            <div><dt>关系</dt><dd>{draft.relationship || "尚未选择"}</dd></div>
            <div><dt>场景</dt><dd>{draft.occasion || "尚未选择"}</dd></div>
            <div><dt>情绪</dt><dd>{draft.emotions.join("、") || "等待你的答案"}</dd></div>
          </dl>
          <small>最终推荐会在全部问题完成后给出。</small>
        </aside>
      </section>

      {microTheme ? (
        <div className={`theme-microexperience ${microTheme}`} role="dialog" aria-modal="true">
          <div className="microexperience-content">
            <span>{themeDefinitions[microTheme].letter} · {themeDefinitions[microTheme].name}</span>
            {microTheme === "cinema" ? <><h2>Chapter 01</h2><p>我们从一次普通聚会开始。</p><strong>To Be Continued...</strong></> : microTheme === "galaxy" ? <><h2>两座城市，一片星空</h2><p>重要日期正在连接成专属星座。</p><strong>第1095号星</strong></> : <><h2>那些普通却珍贵的日子</h2><p>照片、日期和手写信正在被装订成册。</p><strong>2026 · 写给重要的人</strong></>}
            <div className="micro-progress"><i style={{ width: `${microProgress}%` }} /></div>
            {microProgress >= 100 ? <div className="micro-actions"><button type="button" onClick={() => chooseTheme(microTheme)}>改用{themeDefinitions[microTheme].name}</button><button type="button" onClick={() => setMicroTheme(null)}>继续原推荐</button></div> : <button type="button" onClick={() => setMicroTheme(null)}>提前退出</button>}
          </div>
        </div>
      ) : null}
    </main>
  );
}
