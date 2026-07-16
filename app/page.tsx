import Link from "next/link";
import AnalyticsEvent from "@/components/AnalyticsEvent";
import BrandLogo from "@/components/brand/BrandLogo";
import SiteHeader from "@/components/brand/SiteHeader";
import HomeExperience from "@/components/home/HomeExperience";

const plans = [
  { name: "轻定制", price: "5.20", text: "照片与文字为主，适合完成一份简洁但完整的礼物。" },
  { name: "深度定制", price: "13.14", text: "支持视频、多次 AI 调整与更完整的故事互动。", featured: true },
  { name: "私人策划", price: "29.90", text: "适合重要纪念、多人参与与高仪式感场景。" },
];

export default function HomePage() {
  return (
    <main className="v10-page">
      <AnalyticsEvent name="home_viewed" metadata={{ version: "1.0-visual" }} />
      <SiteHeader />
      <HomeExperience />

      <section className="v10-section v10-demo-section" id="cases">
        <div className="v10-section-heading">
          <p>OFFICIAL INTERACTIVE DEMO</p>
          <h2>先体验一份真正可以打开、聆听和回应的礼物。</h2>
          <p>主样片采用真实感虚构人物，互动逻辑与正式作品一致。</p>
        </div>
        <article className="v10-main-demo-card">
          <div>
            <span className="v10-theme-tag">B · 梦幻星空</span>
            <h3>《距离之外，我们仍在同一片星空》</h3>
            <p>陈默写给林晚的异地恋三周年生日礼物。90 秒沉浸播放，包含解锁、星座、情书、语音、未来约定与收件人回复。</p>
            <div className="v10-feature-chips"><span>沉浸播放</span><span>自由浏览</span><span>演示答案</span><span>回复体验</span></div>
            <Link className="v10-primary" href="/demo/galaxy">进入完整样片</Link>
          </div>
          <div className="v10-main-demo-constellation" aria-hidden="true">
            <i /><i /><i /><i /><i />
            <svg viewBox="0 0 560 320"><path d="M70 240 C140 185 190 210 248 120 C315 20 390 150 492 65" /></svg>
            <strong>第1095号星</strong>
            <span>记录认真分享生活的普通日夜</span>
          </div>
        </article>

        <div className="v10-mini-demo-grid">
          <article className="v10-mini-demo cinema">
            <small>A · 私人电影</small>
            <h3>我们的第五年：未完待续</h3>
            <p>宽银幕、分镜、旁白与片尾名单，适合周年、告白与重要里程碑。</p>
            <Link href="/studio/theme/cinema">体验电影制作台</Link>
          </article>
          <article className="v10-mini-demo film">
            <small>C · 温暖胶片</small>
            <h3>妈妈，我想把时间送还给你</h3>
            <p>奶油纸张、拍立得、票根与手写信，适合家人、朋友、毕业与长期关系。</p>
            <Link href="/studio/theme/film">体验相册制作台</Link>
          </article>
        </div>
      </section>

      <section className="v10-section v10-ai-entry" id="themes">
        <div className="v10-ai-copy">
          <p>AI STORY DIRECTOR</p>
          <h2>不知道怎样表达，也没关系。</h2>
          <p>告诉拾光这份礼物要送给谁、纪念什么，以及一件真实的小事。AI 会推荐最合适的主题与一个备选方向，不替你编造经历。</p>
          <Link className="v10-primary" href="/create">让 AI 推荐表达方式</Link>
        </div>
        <div className="v10-ai-process">
          <div><span>01</span><strong>理解关系与场景</strong><small>恋人 · 异地 · 三周年生日</small></div>
          <div><span>02</span><strong>提取真实细节</strong><small>晚霞 · 远程电影 · 见面倒计时</small></div>
          <div><span>03</span><strong>匹配视觉叙事</strong><small>最适合：梦幻星空</small></div>
        </div>
      </section>

      <section className="v10-section v10-values">
        <div className="v10-section-heading"><p>WHY SHIGUANG</p><h2>不是套模板，而是把真实内容变成可以被感受到的故事。</h2></div>
        <div className="v10-value-grid">
          <article><span>01</span><h3>真实，而不是空泛</h3><p>AI 只整理你提供的事实，人物、日期与经历始终由你确认。</p></article>
          <article><span>02</span><h3>三种完全不同的创作空间</h3><p>相册整理桌、自由星座画布与私人电影剪辑台，不只是换颜色。</p></article>
          <article><span>03</span><h3>发布前真正看一遍</h3><p>模拟手机、电脑、声音、错误解锁、慢速网络与媒体失败。</p></article>
          <article><span>04</span><h3>礼物可以继续生长</h3><p>收件人回复、版本更新、纪念档案与完整导出，让故事不止打开一次。</p></article>
        </div>
      </section>

      <section className="v10-section v10-pricing" id="pricing">
        <div className="v10-section-heading">
          <p>CHOOSE AFTER YOU FEEL IT</p>
          <h2>三个主题全部开放，套餐只决定你需要多少创作能力。</h2>
        </div>
        <div className="v10-plan-grid">
          {plans.map((plan) => (
            <article className={plan.featured ? "featured" : ""} key={plan.name}>
              {plan.featured ? <em>最适合完整表达</em> : null}
              <h3>{plan.name}</h3>
              <strong><small>¥</small>{plan.price}</strong>
              <p>{plan.text}</p>
              <Link href="/create">先让 AI 推荐</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="v10-final-cta">
        <BrandLogo dark href="" />
        <p>有些礼物会被打开一次，有些礼物会被记住很多年。</p>
        <h2>把你们的故事，留在拾光。</h2>
        <div><Link className="v10-primary" href="/demo/galaxy">体验样片</Link><Link className="v10-secondary" href="/create">开始制作</Link></div>
      </section>

      <footer className="v10-footer">
        <BrandLogo subtitle="私人数字纪念礼物" />
        <div><Link href="/legal/terms">服务条款</Link><Link href="/legal/privacy">隐私说明</Link><Link href="/legal/refund">退款规则</Link></div>
      </footer>
    </main>
  );
}
