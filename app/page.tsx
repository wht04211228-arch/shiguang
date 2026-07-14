import Link from "next/link";
import AnalyticsEvent from "@/components/AnalyticsEvent";

const themes = [
  {
    key: "A",
    className: "landing-theme-cinema",
    name: "电影感高级浪漫",
    title: "像观看一部只属于两个人的私人电影",
    detail: "深夜蓝、宽银幕、电影字幕和克制光影，适合高仪式感表达。",
  },
  {
    key: "B",
    className: "landing-theme-star",
    name: "梦幻星空与童话感",
    title: "像进入一个只属于彼此的秘密宇宙",
    detail: "星云、月光与纪念星座，负责制造第一眼的惊喜与传播感。",
  },
  {
    key: "C",
    className: "landing-theme-film",
    name: "温暖胶片与真实生活感",
    title: "像重新翻阅两个人共同生活过的时间",
    detail: "相册、日记、票根和真实细节，是当前正式产品主线。",
    active: true,
  },
];

export default function HomePage() {
  return (
    <main className="landing-page">
      <AnalyticsEvent name="home_viewed" />
      <header className="landing-nav">
        <Link className="landing-brand" href="/">
          <span>拾</span>
          <div>
            <strong>拾光</strong>
            <small>PRIVATE MEMORY GIFT</small>
          </div>
        </Link>
        <nav>
          <a href="#value">为什么付费</a>
          <a href="#themes">视觉方案</a>
          <Link href="/cases">真实案例</Link>
          <Link href="/pricing">套餐价格</Link>
          <Link className="nav-solid" href="/studio">
            开始制作
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">PRIVATE · INTERACTIVE · MEMORABLE</p>
          <h1>
            不是发出一句祝福，
            <br />
            <span>而是送出一段只属于彼此的时间。</span>
          </h1>
          <p>
            把照片、声音、共同回忆和没有说出口的话，整理成一份可以拆开、互动、回应并再次打开的私人数字纪念礼物。
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/card/sample">
              体验完整样片
            </Link>
            <Link className="landing-secondary" href="/pricing">
              查看套餐价格
            </Link>
          </div>
          <div className="landing-proof">
            <span>无需下载应用</span>
            <span>手机沉浸式打开</span>
            <span>三套主题共用内容</span>
          </div>
        </div>
        <div className="landing-hero-art" aria-label="温暖胶片相册场景">
          <div className="landing-desk" />
          <div className="landing-cup" />
          <div className="landing-ticket">
            <small>MEMORY TICKET</small>
            <strong>TO THE DAYS WE SHARED</strong>
          </div>
          <div className="landing-photo photo-left">
            <span />
          </div>
          <div className="landing-photo photo-right">
            <span />
          </div>
          <Link className="landing-album" href="/card/sample">
            <i />
            <strong>我们的故事</strong>
            <small>THE DAYS WE SHARED</small>
            <em>点击翻开</em>
          </Link>
        </div>
      </section>

      <section className="landing-section value-section" id="value">
        <div className="landing-section-heading">
          <p>WHY PEOPLE PAY</p>
          <h2>用户付费的不是网页，而是一次省心、专属、有结果的情感表达。</h2>
        </div>
        <div className="value-grid">
          <article>
            <span>01</span>
            <h3>专属感</h3>
            <p>
              真实经历、私有称呼、重要日期与双方才理解的细节，让成品无法被另一段关系复制。
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>仪式感</h3>
            <p>
              不是打开后一次性看完，而是通过解锁、翻相册、读信和回应逐步完成“拆礼物”。
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>省心表达</h3>
            <p>
              购买者只提供素材与事实，系统帮助整理结构、顺序与呈现，不要求学习设计工具。
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>长期价值</h3>
            <p>
              它可以被再次打开、继续补写和保存，不是一段看完即消失的临时动画。
            </p>
          </article>
        </div>
      </section>

      <section className="landing-section theme-section" id="themes">
        <div className="landing-section-heading">
          <p>THREE VISUAL DIRECTIONS</p>
          <h2>同一段故事，三种表达；内容只需编辑一次。</h2>
        </div>
        <div className="landing-theme-grid">
          {themes.map((theme) => (
            <article
              className={`landing-theme-card ${theme.className} ${theme.active ? "active" : ""}`}
              key={theme.key}
            >
              <div className="landing-theme-preview">
                <span>{theme.key}</span>
                <strong>
                  {theme.key === "A"
                    ? "未完待续"
                    : theme.key === "B"
                      ? "只为你点亮的一颗星"
                      : "那些普通但珍贵的日子"}
                </strong>
                {theme.active ? <em>主线方案</em> : null}
              </div>
              <div>
                <small>{theme.name}</small>
                <h3>{theme.title}</h3>
                <p>{theme.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section flow-section" id="flow">
        <div className="landing-section-heading align-left">
          <p>THE EXPERIENCE</p>
          <h2>它不是一张页面，而是一段被慢慢打开的礼物。</h2>
        </div>
        <div className="flow-list">
          {[
            "用专属问题打开礼物",
            "翻开按照时间编排的共同回忆",
            "看见生活碎片与没有说出口的话",
            "点亮未来约定并留下双向回应",
          ].map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <p>THE FIRST WORKING PRODUCT</p>
        <h2>
          现在已经可以登录账号、上传私有素材并发布可跨设备打开的专属链接。
        </h2>
        <div>
          <Link className="landing-primary" href="/pricing">
            选择制作套餐
          </Link>
          <Link className="landing-secondary" href="/card/sample">
            先体验样片
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>拾光</strong>
          <span>把共同经历过的时间，重新送给重要的人一次。</span>
        </div>
        <small>Next.js · Supabase · 人工付款审核 · DeepSeek · Resend</small>
      </footer>
    </main>
  );
}
