"use client";

import Link from "next/link";
import { useState } from "react";

const steps = [
  {
    number: "01",
    title: "告诉拾光：礼物送给谁",
    summary: "选择关系、纪念场景与想表达的感受，不需要一开始就写完整文案。",
    detail: "示例：送给异地恋人，纪念三周年和生日，希望表达想念、坚定与对下一次见面的期待。",
    result: "得到一份清晰的故事需求草稿",
  },
  {
    number: "02",
    title: "AI 推荐表达方式",
    summary: "根据真实内容推荐最适合的主题和一个备选方向，不用盲选模板。",
    detail: "梦幻星空适合距离、日期和等待；温暖胶片适合生活细节；私人电影适合重要里程碑。",
    result: "确定主题与适合你的套餐",
  },
  {
    number: "03",
    title: "在主题制作台里完成故事",
    summary: "上传照片、声音和视频，AI 只在你需要时帮助整理文案。",
    detail: "三个制作台不是换颜色：相册整理桌、自由星座画布、私人电影剪辑台拥有不同的操作方式。",
    result: "形成一份可以真实互动的礼物",
  },
  {
    number: "04",
    title: "站在收件人的角度检查",
    summary: "模拟手机、电脑、声音、解锁和慢速网络，避免礼物发出去才发现问题。",
    detail: "关键错误会阻止发布；体验建议可以查看后自行决定是否优化。",
    result: "确认对方能够顺利打开和观看",
  },
  {
    number: "05",
    title: "发布、送出，并等待回应",
    summary: "生成正式链接与二维码，收件人可以打开、聆听、浏览并留下回复。",
    detail: "发布后的修改先进入草稿，不会突然改变对方正在观看的版本。",
    result: "获得一份可以继续生长的数字纪念礼物",
  },
];

const studios = [
  {
    key: "film",
    label: "C · 温暖胶片",
    name: "相册整理桌",
    promise: "像整理一本真实相册一样，把照片、票根、便签和手写信装订在一起。",
    bestFor: "家人、朋友、毕业、成长与长期关系",
    href: "/studio/theme/film",
  },
  {
    key: "galaxy",
    label: "B · 梦幻星空",
    name: "专属星座画布",
    promise: "把日期和回忆变成星点，自由拖动、连接，形成只属于两个人的星座。",
    bestFor: "恋人、异地、生日、周年与求婚",
    href: "/studio/theme/galaxy",
  },
  {
    key: "cinema",
    label: "A · 私人电影",
    name: "私人电影剪辑台",
    promise: "用分镜、字幕、旁白和时间线，把重要故事剪辑成一场私人首映。",
    bestFor: "周年、告白、求婚与重要里程碑",
    href: "/studio/theme/cinema",
  },
];

export default function HomeGuidedJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const step = steps[activeStep];

  return (
    <>
      <section className="v102-product-definition" id="what-is-it">
        <div className="v102-definition-copy">
          <p className="v10-kicker">WHAT IS SHIGUANG</p>
          <h2>它不是一张电子贺卡，也不只是一段视频。</h2>
          <p>拾光把你提供的真实回忆、照片、声音和想说的话，整理成一份可以被打开、聆听、探索和回应的私人数字礼物。</p>
          <div className="v102-definition-flow">
            <span><b>你提供</b>真实故事与素材</span>
            <i>→</i>
            <span><b>拾光帮助</b>主题、结构与文案</span>
            <i>→</i>
            <span><b>对方收到</b>专属互动礼物</span>
          </div>
        </div>
        <div className="v102-definition-output">
          <article><span>可以打开</span><strong>专属链接与解锁仪式</strong></article>
          <article><span>可以聆听</span><strong>语音、音乐与视频</strong></article>
          <article><span>可以探索</span><strong>相册、星座或私人电影</strong></article>
          <article><span>可以回应</span><strong>心情、文字与共同纪念</strong></article>
        </div>
      </section>

      <section className="v102-how-it-works" id="how-it-works">
        <div className="v10-section-heading">
          <p>HOW IT WORKS</p>
          <h2>从一句真实的小事开始，五步完成一份礼物。</h2>
          <p>每一步只处理当前最重要的任务，等待付款、AI 或朋友投稿时，系统会推荐可以并行完成的内容。</p>
        </div>
        <div className="v102-journey-shell">
          <div className="v102-step-list" role="tablist" aria-label="拾光制作步骤">
            {steps.map((item, index) => (
              <button
                className={index === activeStep ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={index === activeStep}
                key={item.number}
                onClick={() => setActiveStep(index)}
              >
                <span>{item.number}</span>
                <div><strong>{item.title}</strong><small>{item.summary}</small></div>
              </button>
            ))}
          </div>
          <article className="v102-step-detail" key={step.number}>
            <span>STEP {step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <div><small>完成后你会得到</small><strong>{step.result}</strong></div>
            <nav>
              <button type="button" disabled={activeStep === 0} onClick={() => setActiveStep((value) => Math.max(0, value - 1))}>上一步</button>
              {activeStep < steps.length - 1 ? <button type="button" onClick={() => setActiveStep((value) => Math.min(steps.length - 1, value + 1))}>下一步</button> : <Link href="/create">开始讲述我的故事</Link>}
            </nav>
          </article>
        </div>
      </section>

      <section className="v102-studio-overview" id="studio-overview">
        <div className="v10-section-heading">
          <p>THREE CREATIVE WORKSPACES</p>
          <h2>同一份真实内容，会进入三种完全不同的制作空间。</h2>
          <p>主题决定故事如何被观看，套餐只决定视频、AI、共创和保存能力，不限制主题选择。</p>
        </div>
        <div className="v102-studio-grid">
          {studios.map((studio) => (
            <article className={studio.key} key={studio.key}>
              <span>{studio.label}</span>
              <div className="v102-studio-art" aria-hidden="true"><i /><i /><i /></div>
              <h3>{studio.name}</h3>
              <p>{studio.promise}</p>
              <small>适合：{studio.bestFor}</small>
              <Link href={studio.href}>进入制作台体验 →</Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
