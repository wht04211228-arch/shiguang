"use client";

import Link from "next/link";
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import { themeDefinitions, themeOrder, type ThemeKey } from "@/lib/experience/themes";

type SaveState = "saved" | "saving" | "offline";
type Panel = "notifications" | "versions" | "themes" | "simulation" | null;

type StoryItem = { id: string; title: string; date: string; text: string; status: "done" | "active" | "draft" };
type StarNode = StoryItem & { x: number; y: number };

type TimelineScene = { id: string; title: string; duration: number; subtitle: string; type: "image" | "video" | "letter" };

const initialStories: StoryItem[] = [
  { id: "meet", title: "第一次见面", date: "2023 年 8 月", text: "一张拍立得合照，成为第一次聊天的理由。", status: "done" },
  { id: "cities", title: "两座城市的晚霞", date: "2025 年夏天", text: "18:42 与 18:47，我们分享了同一天的天空。", status: "active" },
  { id: "reunion", title: "每一次见面", date: "记得每一张车票", text: "出口旁的等待，是正在靠近彼此的证明。", status: "draft" },
  { id: "letter", title: "三周年情书", date: "2026.08.12", text: "谢谢你认真参与我的每一个普通日夜。", status: "draft" },
  { id: "future", title: "未来约定", date: "To be continued", text: "一起看海、生活在同一座城市、养一只猫。", status: "draft" },
];

const initialStars: StarNode[] = initialStories.map((item, index) => ({
  ...item,
  x: [18, 37, 57, 72, 84][index],
  y: [63, 34, 61, 27, 55][index],
}));

const initialScenes: TimelineScene[] = [
  { id: "intro", title: "序章", duration: 8, subtitle: "有些故事，开始时看起来都很普通。", type: "image" },
  { id: "meet", title: "相遇", duration: 15, subtitle: "我们从一次朋友聚会开始。", type: "image" },
  { id: "cities", title: "两座城市", duration: 18, subtitle: "距离没有让生活停止被分享。", type: "video" },
  { id: "letter", title: "情书", duration: 22, subtitle: "谢谢你认真参与我的普通日夜。", type: "letter" },
  { id: "credits", title: "片尾", duration: 10, subtitle: "To Be Continued...", type: "image" },
];

function useAutosave(theme: ThemeKey, payload: unknown) {
  const [state, setState] = useState<SaveState>("saved");
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    setState("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`shiguang-theme-studio:${theme}`, JSON.stringify(payload));
        setState("saved");
        setTime(new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));
      } catch {
        setState("offline");
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [payload, theme]);
  return { state, time };
}

function StudioTopBar({ theme, saveState, saveTime, panel, setPanel, reduceMotion, setReduceMotion }: {
  theme: ThemeKey;
  saveState: SaveState;
  saveTime: string;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}) {
  return (
    <header className="theme-studio-topbar">
      <BrandLogo compact href="/" />
      <div className="theme-studio-center-status">
        <span>{themeDefinitions[theme].name}制作中</span>
        <button type="button" onClick={() => setPanel("versions")}>
          {saveState === "saving" ? "正在保存……" : saveState === "offline" ? "已保存在当前设备" : `已安全保存 · ${saveTime}`}
        </button>
      </div>
      <nav>
        <label><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />减少动态效果</label>
        <button type="button" onClick={() => setPanel(panel === "notifications" ? null : "notifications")}>通知 <b>3</b></button>
        <button type="button" onClick={() => setPanel("themes")}>切换主题</button>
        <Link href="/">退出制作</Link>
      </nav>
    </header>
  );
}

function SharedDrawer({ panel, theme, setPanel, applyTheme }: { panel: Panel; theme: ThemeKey; setPanel: (panel: Panel) => void; applyTheme: (theme: ThemeKey) => void }) {
  if (!panel || panel === "simulation") return null;
  return (
    <aside className={`theme-shared-drawer ${panel}`}>
      <header><strong>{panel === "notifications" ? "通知中心" : panel === "versions" ? "版本与保存" : "预览其他主题"}</strong><button type="button" onClick={() => setPanel(null)}>关闭</button></header>
      {panel === "notifications" ? (
        <div className="notification-list">
          <article className="important"><span>需要你处理</span><h3>检查 AI 为你整理的三周年情书</h3><p>核心内容仍处于“待确认”状态。</p><button type="button">立即查看</button></article>
          <article><span>制作进展</span><h3>故事已自动保存</h3><p>最近一次云端同步完成。</p></article>
          <article><span>礼物动态</span><h3>新的朋友祝福等待确认</h3><p>打开后才会标记为已读。</p><button type="button">查看投稿</button></article>
        </div>
      ) : null}
      {panel === "versions" ? (
        <div className="version-list">
          <article><span>当前草稿</span><h3>刚刚自动保存</h3><button type="button">查看差异</button></article>
          <article><span>关键版本</span><h3>V2 · 切换为{themeDefinitions[theme].name}</h3><button type="button">恢复为新草稿</button></article>
          <article><span>每日快照</span><h3>2026.07.16</h3><button type="button">查看快照</button></article>
        </div>
      ) : null}
      {panel === "themes" ? (
        <div className="theme-switch-grid">
          {themeOrder.map((item) => (
            <article className={`${item} ${item === theme ? "current" : ""}`} key={item}>
              <span>{themeDefinitions[item].letter} · {themeDefinitions[item].name}</span>
              <h3>{themeDefinitions[item].promise}</h3>
              <p>{item === theme ? "当前主题" : "右侧将实时比较相同内容在新主题中的呈现。"}</p>
              {item !== theme ? <button type="button" onClick={() => applyTheme(item)}>应用{themeDefinitions[item].name}</button> : null}
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function RecipientSimulation({ theme, close }: { theme: ThemeKey; close: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const names = {
    film: ["翻开成品相册", "收件人视角模拟"],
    galaxy: ["进入星空体验", "收件人视角模拟"],
    cinema: ["进入首映检查", "收件人视角模拟"],
  } as const;
  return (
    <div className={`recipient-simulation-modal ${theme}`} role="dialog" aria-modal="true">
      <div className="recipient-simulation-card">
        <header><div><span>{names[theme][1]}</span><h2>{names[theme][0]}</h2></div><button type="button" onClick={close}>关闭</button></header>
        <div className="simulation-devices"><button className="active" type="button">手机</button><button type="button">电脑</button><button type="button">声音开启</button><button type="button">自由浏览</button></div>
        <div className="simulation-screen">
          <small>基础检查</small>
          <h3>{themeDefinitions[theme].promise}</h3>
          <p>封面、解锁、故事章节、声音开关与收件人回复均可在这里完整测试。</p>
        </div>
        <button className="advanced-toggle" type="button" onClick={() => setAdvanced((value) => !value)}>更多真实情况测试</button>
        {advanced ? <div className="simulation-tests"><button type="button">模拟慢速网络</button><button type="button">错误解锁</button><button type="button">媒体加载失败</button><button type="button">开放时间限制</button></div> : null}
        <div className="simulation-report"><strong>检查结果</strong><span>✓ 核心流程正常</span><span>△ 慢速网络下建议压缩 1 段视频</span></div>
      </div>
    </div>
  );
}

function FilmStudio({ stories, setStories, openSimulation }: { stories: StoryItem[]; setStories: (items: StoryItem[]) => void; openSimulation: () => void }) {
  const [page, setPage] = useState(1);
  const current = stories[Math.min(page - 1, stories.length - 1)];
  const [selectedAsset, setSelectedAsset] = useState("photo");
  return (
    <div className="film-studio-layout">
      <aside className="film-material-drawer">
        <p>素材抽屉</p>
        {["photo", "story", "letter", "ticket", "voice", "friends"].map((item) => <button className={selectedAsset === item ? "active" : ""} type="button" key={item} onClick={() => setSelectedAsset(item)}>{({ photo: "照片", story: "回忆", letter: "信件", ticket: "票根", voice: "语音", friends: "朋友祝福" } as Record<string, string>)[item]}</button>)}
        <article><span>新增故事</span><strong>你想记录哪一种时刻？</strong><small>第一次见面 · 普通小事 · 未来约定</small><button type="button">打开故事创建面板</button></article>
      </aside>
      <section className="film-album-workspace">
        <div className="film-sunlight" />
        <button className="album-turn left" type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
        <div className="open-album">
          <div className="album-page left-page">
            <div className="polaroid main-photo"><span>生活照片</span><small>{current?.date}</small></div>
            <div className="paper-tape" />
            <button className="floating-edit-card" type="button">替换 · 旋转 · 置顶 · 更多设置</button>
          </div>
          <div className="album-spine" />
          <div className="album-page right-page">
            <span className="handwritten-date">{current?.date}</span>
            <h2>{current?.title}</h2>
            <textarea value={current?.text || ""} onChange={(event) => setStories(stories.map((item) => item.id === current?.id ? { ...item, text: event.target.value } : item))} />
            <div className="album-signature">写给重要的人 · 亲手装订</div>
          </div>
        </div>
        <button className="album-turn right" type="button" disabled={page >= stories.length} onClick={() => setPage((value) => Math.min(stories.length, value + 1))}>›</button>
        <div className="album-thumbnails">{stories.map((item, index) => <button className={`${page === index + 1 ? "active" : ""} ${item.status}`} type="button" key={item.id} onClick={() => setPage(index + 1)}><span>{index + 1}</span><small>{item.title}</small></button>)}</div>
      </section>
      <aside className="film-recipient-preview">
        <span>收件人预览</span>
        <div className="film-phone-preview"><small>{current?.date}</small><h3>{current?.title}</h3><p>{current?.text}</p></div>
        <button type="button" onClick={openSimulation}>翻开成品相册<small>收件人视角模拟</small></button>
      </aside>
      <footer className="theme-journey-bar"><div><span>当前主推荐</span><strong>完善“{stories.find((item) => item.status === "active")?.title}”</strong><small>预计 3 分钟 · 完成后相册情绪会更完整</small></div><div><button type="button">备选：添加日期</button><button type="button">备选：录制一句话</button></div></footer>
    </div>
  );
}

function GalaxyStudio({ stars, setStars, openSimulation }: { stars: StarNode[]; setStars: (items: StarNode[]) => void; openSimulation: () => void }) {
  const [selected, setSelected] = useState(stars[1].id);
  const [connections, setConnections] = useState<Array<[string, string]>>([["meet", "cities"], ["cities", "reunion"], ["reunion", "letter"], ["letter", "future"]]);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const current = stars.find((item) => item.id === selected) || stars[0];

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const x = Math.max(5, Math.min(95, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(8, Math.min(92, ((moveEvent.clientY - rect.top) / rect.height) * 100));
      setStars(stars.map((item) => item.id === id ? { ...item, x, y } : item));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function connect(id: string) {
    if (!connectFrom) { setConnectFrom(id); return; }
    if (connectFrom !== id && !connections.some(([a, b]) => (a === connectFrom && b === id) || (a === id && b === connectFrom))) {
      setConnections((items) => [...items, [connectFrom, id]]);
    }
    setConnectFrom(null);
  }

  return (
    <div className="galaxy-studio-layout">
      <aside className="galaxy-node-editor">
        <span>当前星点内容</span>
        <h2>{current.title}</h2>
        <label>日期<input value={current.date} onChange={(event) => setStars(stars.map((item) => item.id === current.id ? { ...item, date: event.target.value } : item))} /></label>
        <label>故事标题<input value={current.title} onChange={(event) => setStars(stars.map((item) => item.id === current.id ? { ...item, title: event.target.value } : item))} /></label>
        <label>回忆文字<textarea value={current.text} onChange={(event) => setStars(stars.map((item) => item.id === current.id ? { ...item, text: event.target.value } : item))} /></label>
        <button type="button">上传照片与声音</button><button type="button">AI 帮我调整</button>
        <p>{connectFrom ? `已选择“${stars.find((item) => item.id === connectFrom)?.title}”，再点一个星点完成连接。` : "可拖线或依次选择两个星点建立故事连线。"}</p>
      </aside>
      <section className="galaxy-canvas-area" ref={canvasRef}>
        <div className="galaxy-canvas-nebula" />
        <svg className="galaxy-connection-layer" viewBox="0 0 1000 600" preserveAspectRatio="none">
          {connections.map(([from, to]) => {
            const a = stars.find((item) => item.id === from); const b = stars.find((item) => item.id === to);
            if (!a || !b) return null;
            return <line key={`${from}-${to}`} x1={a.x * 10} y1={a.y * 6} x2={b.x * 10} y2={b.y * 6} />;
          })}
        </svg>
        {stars.map((item) => <button
          className={`galaxy-node ${item.status} ${selected === item.id ? "selected" : ""} ${connectFrom === item.id ? "connecting" : ""}`}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          type="button"
          key={item.id}
          onPointerDown={(event) => pointerDown(event, item.id)}
          onDoubleClick={() => connect(item.id)}
          onClick={() => setSelected(item.id)}
        ><i /><span>{item.title}</span></button>)}
        <div className="galaxy-canvas-actions"><button type="button">−</button><button type="button">+</button><button type="button">回到完整星座</button><button type="button" onClick={() => setConnectFrom(selected)}>连接星点</button><button type="button">自动整理预览</button></div>
      </section>
      <aside className="galaxy-effect-preview">
        <span>效果预览</span><div><small>{current.date}</small><h3>{current.title}</h3><p>{current.text}</p></div>
        <button type="button" onClick={openSimulation}>进入星空体验<small>收件人视角模拟</small></button>
      </aside>
      <footer className="theme-journey-bar galaxy"><div><span>当前最值得点亮的星</span><strong>三周年情书</strong><small>完成后，星座的情感主线会连接完整</small></div><div><button type="button">备选：上传晚霞</button><button type="button">备选：设置倒计时</button></div></footer>
    </div>
  );
}

function CinemaStudio({ scenes, setScenes, openSimulation }: { scenes: TimelineScene[]; setScenes: (items: TimelineScene[]) => void; openSimulation: () => void }) {
  const [selected, setSelected] = useState(2);
  const [professional, setProfessional] = useState(false);
  const current = scenes[selected];
  const total = scenes.reduce((sum, item) => sum + item.duration, 0);
  return (
    <div className="cinema-studio-layout">
      <aside className="cinema-storyboards">
        <span>分镜卡片</span>
        {scenes.map((item, index) => <button className={index === selected ? "active" : ""} type="button" key={item.id} onClick={() => setSelected(index)}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item.title}</strong><em>{item.duration} 秒</em></button>)}
        <button className="add-scene" type="button">+ 新增一幕</button>
      </aside>
      <section className="cinema-preview-workspace">
        <div className="cinema-screen"><span>CHAPTER {String(selected + 1).padStart(2, "0")}</span><h2>{current.title}</h2><p>{current.subtitle}</p><small>00:{String(scenes.slice(0, selected).reduce((sum, item) => sum + item.duration, 0)).padStart(2, "0")} / 01:{String(total).padStart(2, "0")}</small></div>
        <div className="cinema-storyboard-strip">{scenes.map((item, index) => <button className={index === selected ? "active" : ""} key={item.id} type="button" onClick={() => setSelected(index)}><span>{item.type}</span><strong>{item.title}</strong></button>)}</div>
        <div className="cinema-film-progress">{scenes.map((item, index) => <button style={{ flexGrow: item.duration }} className={index === selected ? "active" : ""} type="button" key={item.id} onClick={() => setSelected(index)}><i /><span>{item.duration}s</span></button>)}</div>
        <button className="professional-toggle" type="button" onClick={() => setProfessional((value) => !value)}>{professional ? "收起专业轨道" : "展开专业轨道"}</button>
        {professional ? <div className="professional-tracks"><div><span>画面轨道</span><i style={{ width: "88%" }} /></div><div><span>字幕轨道</span><i style={{ width: "68%" }} /></div><div><span>旁白轨道</span><i style={{ width: "42%" }} /></div><div><span>背景音乐</span><i style={{ width: "100%" }} /></div><small>素材吸附已开启 · 按住 Alt 临时关闭</small></div> : null}
      </section>
      <aside className="cinema-scene-settings">
        <span>当前镜头设置</span><h2>{current.title}</h2>
        <label>字幕<textarea value={current.subtitle} onChange={(event) => setScenes(scenes.map((item, index) => index === selected ? { ...item, subtitle: event.target.value } : item))} /></label>
        <label>持续时长<input type="number" min="2" max="120" value={current.duration} onChange={(event) => setScenes(scenes.map((item, index) => index === selected ? { ...item, duration: Number(event.target.value) } : item))} /></label>
        <button type="button">设置转场</button><button type="button">添加旁白</button><button type="button">AI 调整字幕</button>
        <button className="premiere" type="button" onClick={openSimulation}>进入首映检查<small>收件人视角模拟</small></button>
      </aside>
      <footer className="theme-journey-bar cinema"><div><span>下一幕建议</span><strong>完成片尾旁白</strong><small>目前电影已有完整故事，但结尾还缺一句面向未来的话</small></div><div><button type="button">备选：自动整理节奏</button><button type="button">备选：添加片尾署名</button></div></footer>
    </div>
  );
}

export default function ThemeStudioExperience({ initialTheme }: { initialTheme: ThemeKey }) {
  const [theme, setTheme] = useState(initialTheme);
  const [panel, setPanel] = useState<Panel>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [stories, setStories] = useState(initialStories);
  const [stars, setStars] = useState(initialStars);
  const [scenes, setScenes] = useState(initialScenes);
  const payload = useMemo(() => ({ theme, stories, stars, scenes }), [theme, stories, stars, scenes]);
  const { state, time } = useAutosave(theme, payload);

  function applyTheme(next: ThemeKey) {
    setTheme(next);
    setPanel(null);
    window.history.replaceState(null, "", `/studio/theme/${next}`);
  }

  return (
    <main className={`theme-studio-page ${theme} ${reduceMotion ? "reduce-motion" : ""}`}>
      <StudioTopBar theme={theme} saveState={state} saveTime={time} panel={panel} setPanel={setPanel} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} />
      <div className="page-notification-summary"><strong>当前最值得处理：检查 AI 初稿</strong><span>另外还有 2 条消息</span></div>
      {theme === "film" ? <FilmStudio stories={stories} setStories={setStories} openSimulation={() => setPanel("simulation")} /> : null}
      {theme === "galaxy" ? <GalaxyStudio stars={stars} setStars={setStars} openSimulation={() => setPanel("simulation")} /> : null}
      {theme === "cinema" ? <CinemaStudio scenes={scenes} setScenes={setScenes} openSimulation={() => setPanel("simulation")} /> : null}
      <SharedDrawer panel={panel} theme={theme} setPanel={setPanel} applyTheme={applyTheme} />
      {panel === "simulation" ? <RecipientSimulation theme={theme} close={() => setPanel(null)} /> : null}
    </main>
  );
}
