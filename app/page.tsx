import Link from "next/link";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import BrandLogo from "@/components/brand/BrandLogo";
import SiteHeader from "@/components/brand/SiteHeader";

const themes = [
  {
    key: "C",
    name: "温暖胶片",
    title: "把真实生活重新整理成一本可以打开的相册",
    detail: "奶油纸张、拍立得、票根和日记细节，是当前正式产品主线。",
    className: "landing-theme-film",
    active: true,
  },
  {
    key: "B",
    name: "梦幻星空",
    title: "把重要日期连成只属于两个人的秘密星座",
    detail: "克制星光与月色，适合年轻、异地和充满想象力的关系。",
    className: "landing-theme-star",
  },
  {
    key: "A",
    name: "私人电影",
    title: "像观看一部只属于彼此、未完待续的电影",
    detail: "深夜蓝、宽银幕与电影字幕，适合周年、告白和高仪式感表达。",
    className: "landing-theme-cinema",
  },
];

export default function HomePage() {
  return (
    <main className="landing-page landing-page-v09">
      <AnalyticsEvent name="home_viewed" metadata={{ version: "0.9" }} />
      <SiteHeader />

      <section className="landing-hero landing-hero-v09">
        <div className="landing-hero-copy">
          <p className="landing-kicker">PRIVATE · CO-CREATED · LONG-TERM</p>
          <h1>
            把共同经历过的时间，
            <br />
            <span>重新送给重要的人一次。</span>
          </h1>
          <p>
            照片、声音、真实回忆和多人祝福，组成一份可以被打开、回应、继续补写并长期保存的数字礼物。
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/card/sample">
              体验一份完整样片
            </Link>
            <Link className="landing-secondary" href="/pricing">
              直接开始制作
            </Link>
          </div>
          <div className="landing-proof">
            <span>不用学习设计</span>
            <span>邀请朋友秘密共创</span>
            <span>手机打开，无需下载</span>
          </div>
        </div>

        <div className="hero-product-demo" aria-label="拾光手机礼物与制作步骤预览">
          <div className="hero-journey-card">
            <span>你的礼物准备度</span>
            <strong>62%</strong>
            <div><i style={{ width: "62%" }} /></div>
            <small>下一步：邀请至少1位朋友写下祝福</small>
          </div>
          <div className="hero-phone-shell">
            <div className="hero-phone-screen">
              <BrandLogo compact href="" />
              <p>我把我们一起经历过的时间</p>
              <h2>重新整理成了一份礼物</h2>
              <div className="hero-polaroids"><span /><span /><span /></div>
              <button type="button">打开我们的故事</button>
            </div>
          </div>
          <div className="hero-invite-card">
            <span>秘密共创</span>
            <div><i>林</i><i>周</i><i>陈</i><b>+7</b></div>
            <small>5人已投稿 · 2人已打开邀请</small>
          </div>
        </div>
      </section>

      <section className="landing-section landing-how-it-works">
        <div className="landing-section-heading">
          <p>THREE SIMPLE STEPS</p>
          <h2>你只需要完成三件事，系统会告诉你每一步接下来做什么。</h2>
        </div>
        <div className="how-grid">
          <article>
            <span>01</span><h3>收集真实回忆</h3>
            <p>按照引导填写人物、日期、照片和故事；右侧实时看到收件人最终效果。</p>
            <small>预计 10–20 分钟</small>
          </article>
          <article>
            <span>02</span><h3>邀请重要的人参与</h3>
            <p>生成公共或专属秘密链接，朋友无需注册即可提交祝福、照片、语音或视频。</p>
            <small>邀请人数按需要选择</small>
          </article>
          <article>
            <span>03</span><h3>在合适的时间送达</h3>
            <p>完成发布检查，设置倒计时、解锁问题和隐藏惊喜，再分享链接或二维码。</p>
            <small>跨设备打开</small>
          </article>
        </div>
      </section>

      <section className="landing-section guided-value-section">
        <div className="guided-value-copy">
          <p className="landing-kicker">ALWAYS KNOW WHAT TO DO NEXT</p>
          <h2>不是把你丢进复杂编辑器，而是每次只告诉你一件最重要的事。</h2>
          <p>登录后，“下一步中心”会根据付款、资料、回忆、共创投稿和开放时间，自动推荐当前最需要完成的任务。</p>
          <Link className="landing-secondary" href="/dashboard">查看下一步中心</Link>
        </div>
        <div className="guided-value-board">
          <header><BrandLogo compact href="" /><span>今天最应该完成的事情</span></header>
          <article>
            <small>下一步建议 · 约2分钟</small>
            <h3>邀请至少1位朋友提交祝福</h3>
            <p>当前礼物只有你的内容，加入他人的真实声音后会更完整。</p>
            <button type="button">复制邀请链接</button>
          </article>
          <div className="guided-mini-tasks">
            <span className="done">✓ 基础信息</span>
            <span className="done">✓ 回忆故事</span>
            <span className="active">→ 多人共创</span>
            <span>○ 发布检查</span>
          </div>
        </div>
      </section>

      <section className="landing-section theme-section" id="themes">
        <div className="landing-section-heading">
          <p>THREE VISUAL DIRECTIONS</p>
          <h2>内容只需编辑一次，再选择最适合这段关系的表达方式。</h2>
        </div>
        <div className="landing-theme-grid">
          {themes.map((theme) => (
            <article className={`landing-theme-card ${theme.className} ${theme.active ? "active" : ""}`} key={theme.key}>
              <div className="landing-theme-preview">
                <span>{theme.key}</span>
                <strong>{theme.key === "C" ? "那些普通但珍贵的日子" : theme.key === "B" ? "只为你点亮的一颗星" : "未完待续"}</strong>
                {theme.active ? <em>主线方案</em> : null}
              </div>
              <div><small>{theme.name}</small><h3>{theme.title}</h3><p>{theme.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section co-create-section">
        <div className="co-create-visual">
          <div className="co-create-ring"><BrandLogo compact href="" /><span className="person p1">林</span><span className="person p2">周</span><span className="person p3">陈</span><span className="person p4">匿名</span></div>
        </div>
        <div className="co-create-copy">
          <p className="landing-kicker">SECRET CO-CREATION</p>
          <h2>一份礼物，也可以由很多重要的人一起完成。</h2>
          <ul>
            <li>公共群聊链接与每人专属链接同时支持</li>
            <li>默认秘密投稿，也可以开启共创留言墙</li>
            <li>购买者能确认、排序、隐藏和退回，但不能篡改原文</li>
            <li>参与者可对收件人匿名，并保留撤回与隐私权</li>
          </ul>
          <Link className="landing-primary" href="/pricing">选择共创人数</Link>
        </div>
      </section>

      <section className="landing-section value-section" id="value">
        <div className="landing-section-heading">
          <p>WHY PEOPLE PAY</p>
          <h2>用户购买的不是一张网页，而是一种更容易被感受到的表达。</h2>
        </div>
        <div className="value-grid">
          <article><span>01</span><h3>专属</h3><p>真实经历、称呼、日期和只有双方理解的细节，无法被另一段关系复制。</p></article>
          <article><span>02</span><h3>省心</h3><p>首次制作按步骤引导，之后可以自由编辑；系统始终提示下一步。</p></article>
          <article><span>03</span><h3>共同参与</h3><p>朋友与家人无需注册即可秘密投稿，让礼物拥有更多真实声音。</p></article>
          <article><span>04</span><h3>继续生长</h3><p>收件人可以回应、上传新内容、完成未来清单，并在以后再次打开。</p></article>
        </div>
      </section>

      <section className="landing-cta">
        <BrandLogo dark href="" />
        <p>START WITH THE RECIPIENT EXPERIENCE</p>
        <h2>先打开一份完整样片，再决定你想为谁留下这段时间。</h2>
        <div>
          <Link className="landing-primary" href="/card/sample">体验完整样片</Link>
          <Link className="landing-secondary" href="/pricing">直接开始制作</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <BrandLogo subtitle="把共同经历过的时间，重新送给重要的人一次。" />
        <div><Link href="/legal/terms">服务条款</Link><Link href="/legal/privacy">隐私说明</Link><Link href="/legal/refund">退款规则</Link></div>
      </footer>
    </main>
  );
}
