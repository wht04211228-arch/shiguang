import Link from "next/link";
import SiteHeader from "@/components/brand/SiteHeader";

export const metadata = { title: "使用帮助｜拾光" };

const steps = [
  ["1", "先体验样片", "从收件人的角度完整看一遍解锁、故事、声音与回复流程。", "/demo/galaxy"],
  ["2", "让 AI 推荐主题", "填写关系、场景和一件真实小事，获得最适合主题与一个备选方向。", "/create"],
  ["3", "选择制作能力", "根据视频、多人共创、保存时间和 AI 修改需求选择套餐。", "/plan-recommend?theme=galaxy"],
  ["4", "进入主题制作台", "照片、文字、语音和视频会在相册、星座或电影工作区中完成。", "/studio/theme/galaxy"],
  ["5", "检查并发布", "先完成收件人视角模拟，再生成正式链接和二维码送给对方。", "/dashboard"],
];

export default function HelpPage() {
  return (
    <main className="help-page-v102">
      <SiteHeader active="help" />
      <section className="help-hero-v102">
        <p>SHIGUANG GUIDE</p>
        <h1>第一次使用拾光，从这里开始。</h1>
        <p>你不需要会设计，也不需要先写好完整文案。准备一件真实小事、几张照片或一句想说的话，就可以开始。</p>
        <div><Link href="/demo/galaxy">先体验完整样片</Link><Link href="/create">开始制作我的礼物</Link></div>
      </section>
      <section className="help-step-grid-v102">
        {steps.map(([number, title, detail, href]) => (
          <article key={number}>
            <span>{number}</span><h2>{title}</h2><p>{detail}</p><Link href={href}>进入这一步 →</Link>
          </article>
        ))}
      </section>
      <section className="help-faq-v102">
        <h2>常见问题</h2>
        <details open><summary>拾光到底是什么？</summary><p>它是一份私人数字纪念礼物。你提供真实内容，系统帮助整理成可以打开、聆听、探索和回应的互动体验。</p></details>
        <details><summary>AI 会不会编造我们的经历？</summary><p>不会。AI 只整理你允许使用的真实信息；生成内容会标记为待确认，发布前必须由你检查核心内容。</p></details>
        <details><summary>三个主题有什么区别？</summary><p>温暖胶片像整理相册，梦幻星空把日期连接成星座，私人电影用分镜和时间线讲述故事。三个主题都可以选择。</p></details>
        <details><summary>发布以后还能修改吗？</summary><p>可以。修改先进入草稿，重新检查和发布后才更新正式礼物，不会突然打断收件人正在进行的观看。</p></details>
      </section>
    </main>
  );
}
