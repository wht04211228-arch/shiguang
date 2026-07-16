"use client";

import Link from "next/link";
import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import {
  themeDefinitions,
  themeOrder,
  type ThemeKey,
} from "@/lib/experience/themes";

type SaveState = "saved" | "saving" | "offline";
type Panel =
  | "notifications"
  | "versions"
  | "themes"
  | "simulation"
  | "story-create"
  | "asset-editor"
  | "ai"
  | "collaboration"
  | "voice"
  | "transition"
  | "credits"
  | null;

type StoryItem = {
  id: string;
  title: string;
  date: string;
  text: string;
  status: "done" | "active" | "draft";
};
type StarNode = StoryItem & { x: number; y: number };
type TimelineScene = {
  id: string;
  title: string;
  duration: number;
  subtitle: string;
  type: "image" | "video" | "letter";
  transition?: string;
  voice?: string;
};
type PanelContext = { title?: string; targetId?: string; detail?: string };
type ToastState = { title: string; detail?: string } | null;
type NewStory = { title: string; date: string; location: string; detail: string };

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
  { id: "intro", title: "序章", duration: 8, subtitle: "有些故事，开始时看起来都很普通。", type: "image", transition: "淡入" },
  { id: "meet", title: "相遇", duration: 15, subtitle: "我们从一次朋友聚会开始。", type: "image", transition: "叠化" },
  { id: "cities", title: "两座城市", duration: 18, subtitle: "距离没有让生活停止被分享。", type: "video", transition: "滑动" },
  { id: "letter", title: "情书", duration: 22, subtitle: "谢谢你认真参与我的普通日夜。", type: "letter", transition: "淡入" },
  { id: "credits", title: "片尾", duration: 10, subtitle: "To Be Continued...", type: "image", transition: "淡出" },
];

function nowTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function useAutosave(theme: ThemeKey, payload: unknown) {
  const [state, setState] = useState<SaveState>("saved");
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    setState("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `shiguang-theme-studio:${theme}`,
          JSON.stringify(payload),
        );
        setState("saved");
        setTime(nowTime());
      } catch {
        setState("offline");
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [payload, theme]);
  return { state, time };
}

function StudioTopBar({
  theme,
  saveState,
  saveTime,
  panel,
  setPanel,
  reduceMotion,
  setReduceMotion,
}: {
  theme: ThemeKey;
  saveState: SaveState;
  saveTime: string;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}) {
  const definition = themeDefinitions[theme];
  return (
    <header className={`theme-studio-topbar theme-${theme}`}>
      <div className="theme-studio-topbar-ambient" aria-hidden="true"><i /><i /><span /></div>
      <div className="theme-studio-brand">
        <BrandLogo compact dark={theme !== "film"} href="/" />
        <span className="theme-studio-badge"><b>{definition.letter}</b>{definition.name}</span>
      </div>
      <div className="theme-studio-center-status">
        <span>{definition.name}制作中</span>
        <button type="button" onClick={() => setPanel("versions")}>
          {saveState === "saving" ? "正在保存……" : saveState === "offline" ? "已保存在当前设备" : `已安全保存 · ${saveTime}`}
        </button>
      </div>
      <nav>
        <label><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />减少动态效果</label>
        <button type="button" onClick={() => setPanel(panel === "notifications" ? null : "notifications")}>通知 <b>3</b></button>
        <button type="button" onClick={() => setPanel("themes")}>切换主题</button>
        <Link href="/dashboard">退出制作</Link>
      </nav>
    </header>
  );
}

function NotificationsPanel({
  act,
}: {
  act: (panel: Panel, context?: PanelContext) => void;
}) {
  const [resolved, setResolved] = useState<string[]>([]);
  const complete = (id: string, panel: Panel, context: PanelContext) => {
    setResolved((items) => [...items, id]);
    act(panel, context);
  };
  return (
    <div className="notification-list">
      <article className={`important ${resolved.includes("ai") ? "resolved" : ""}`}>
        <span>需要你处理</span><h3>检查 AI 为你整理的三周年情书</h3><p>核心内容仍处于“待确认”状态。</p>
        <button type="button" onClick={() => complete("ai", "ai", { title: "检查三周年情书" })}>{resolved.includes("ai") ? "已打开" : "立即查看"}</button>
      </article>
      <article><span>制作进展</span><h3>故事已自动保存</h3><p>最近一次云端同步完成。</p></article>
      <article className={resolved.includes("collab") ? "resolved" : ""}>
        <span>礼物动态</span><h3>新的朋友祝福等待确认</h3><p>打开后才会标记为已读。</p>
        <button type="button" onClick={() => complete("collab", "collaboration", { title: "朋友祝福审核" })}>{resolved.includes("collab") ? "已打开" : "查看投稿"}</button>
      </article>
    </div>
  );
}

function VersionsPanel({
  theme,
  restore,
  toast,
}: {
  theme: ThemeKey;
  restore: () => void;
  toast: (title: string, detail?: string) => void;
}) {
  const [detail, setDetail] = useState<string | null>(null);
  return (
    <div className="version-list">
      {detail ? <div className="version-diff"><strong>版本差异</strong><p>{detail}</p><button type="button" onClick={() => setDetail(null)}>返回版本列表</button></div> : null}
      {!detail ? <>
        <article><span>当前草稿</span><h3>刚刚自动保存</h3><button type="button" onClick={() => setDetail("当前草稿新增 1 段文字，调整 2 个节点位置，尚未发布。")}>查看差异</button></article>
        <article><span>关键版本</span><h3>V2 · 切换为{themeDefinitions[theme].name}</h3><button type="button" onClick={restore}>恢复为新草稿</button></article>
        <article><span>每日快照</span><h3>2026.07.16</h3><button type="button" onClick={() => toast("快照预览已打开", "每日快照仅用于恢复，不会覆盖当前正式版本。")}>查看快照</button></article>
      </> : null}
    </div>
  );
}

function ThemeSwitchPanel({
  theme,
  applyTheme,
}: {
  theme: ThemeKey;
  applyTheme: (theme: ThemeKey) => void;
}) {
  const [preview, setPreview] = useState<ThemeKey>(theme);
  return (
    <div className="theme-switch-panel">
      <div className={`theme-switch-preview ${preview}`}>
        <span>正在预览 · {themeDefinitions[preview].letter}</span>
        <h3>{themeDefinitions[preview].name}</h3>
        <p>{themeDefinitions[preview].promise}</p>
        <small>相同故事内容会自动映射为该主题的相册页、星座节点或电影分镜。</small>
      </div>
      <div className="theme-switch-grid">
        {themeOrder.map((item) => (
          <article className={`${item} ${item === theme ? "current" : ""} ${item === preview ? "previewing" : ""}`} key={item}>
            <span>{themeDefinitions[item].letter} · {themeDefinitions[item].name}</span>
            <h3>{themeDefinitions[item].shortName}</h3>
            <p>{item === theme ? "当前主题" : "先预览，不会立即改变当前礼物。"}</p>
            <button type="button" onClick={() => setPreview(item)}>{item === preview ? "正在预览" : "预览这个主题"}</button>
          </article>
        ))}
      </div>
      <div className="theme-switch-confirm">
        <span>{preview === theme ? "当前已经使用这个主题" : `确认后，制作台将切换为${themeDefinitions[preview].name}布局。`}</span>
        <button type="button" disabled={preview === theme} onClick={() => applyTheme(preview)}>确认应用{themeDefinitions[preview].name}</button>
      </div>
    </div>
  );
}

function StoryCreatePanel({
  theme,
  create,
}: {
  theme: ThemeKey;
  create: (story: NewStory) => void;
}) {
  const [step, setStep] = useState(0);
  const [story, setStory] = useState<NewStory>({ title: "第一次见面", date: "", location: "", detail: "" });
  const types = ["第一次见面", "一件普通的小事", "一次旅行", "一次分别或重逢", "一个重要日期", "一个未来约定"];
  const fillDemo = () => setStory({ title: "第一次站在彼此身边", date: "2023 年 8 月", location: "朋友家的生日聚会", detail: "一张拍立得合照，成为第一次聊天的理由。我们聊到一部都喜欢的电影，那次聊天持续了很久。" });
  return (
    <div className="story-create-panel">
      <div className="story-create-progress"><span>新增故事</span><strong>{step + 1} / 3</strong><i style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
      {step === 0 ? <>
        <h2>这一段，你想记录什么？</h2>
        <p>系统先理解故事类型，再推荐适合当前主题的照片、文字、声音或视频组合。</p>
        <div className="story-type-grid">{types.map((item) => <button className={story.title === item ? "active" : ""} type="button" key={item} onClick={() => setStory((value) => ({ ...value, title: item }))}>{item}</button>)}</div>
      </> : null}
      {step === 1 ? <>
        <h2>补充 2～3 个真实细节</h2>
        <button className="fill-demo-answer" type="button" onClick={fillDemo}>填入演示答案</button>
        <label>大概是什么时候？<input value={story.date} placeholder="例如：2023 年夏天" onChange={(event) => setStory((value) => ({ ...value, date: event.target.value }))} /></label>
        <label>发生在哪里？<input value={story.location} placeholder="例如：朋友家的生日聚会" onChange={(event) => setStory((value) => ({ ...value, location: event.target.value }))} /></label>
        <label>最难忘的一个细节<textarea value={story.detail} placeholder="一个动作、一句话、一个物件，或者当时最先注意到的画面。" onChange={(event) => setStory((value) => ({ ...value, detail: event.target.value }))} /></label>
      </> : null}
      {step === 2 ? <>
        <h2>确认故事卡</h2>
        <article className={`story-card-preview ${theme}`}>
          <span>{story.date || "时间待补充"}</span><h3>{story.title}</h3><small>{story.location || "地点仅用于整理"}</small><p>{story.detail || "还没有填写细节，可以先创建后补充。"}</p>
          <div>{theme === "film" ? "将创建：相册跨页 + 手写日期" : theme === "galaxy" ? "将创建：日期星点 + 故事连线" : "将创建：分镜卡片 + 推荐时长"}</div>
        </article>
      </> : null}
      <div className="story-create-actions">
        <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>上一步</button>
        {step < 2 ? <button type="button" onClick={() => setStep((value) => Math.min(2, value + 1))}>继续</button> : <button type="button" onClick={() => create(story)}>确认创建</button>}
      </div>
    </div>
  );
}

function ActionPanel({
  kind,
  context,
  close,
  toast,
}: {
  kind: Exclude<Panel, "notifications" | "versions" | "themes" | "simulation" | "story-create" | null>;
  context: PanelContext;
  close: () => void;
  toast: (title: string, detail?: string) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState("");
  const [recording, setRecording] = useState(false);
  const [transition, setTransition] = useState("叠化");
  const [director, setDirector] = useState("陈默");
  const [thanks, setThanks] = useState("所有见证我们故事的人");
  const headings: Record<string, string> = {
    "asset-editor": "素材与版式设置",
    ai: "AI 故事助手",
    collaboration: "朋友祝福审核",
    voice: "录制一句想说的话",
    transition: "镜头转场设置",
    credits: "片尾署名",
  };
  const save = (title: string, detail?: string) => { toast(title, detail); close(); };
  return (
    <div className={`studio-action-panel ${kind}`}>
      <p>{context.title || headings[kind]}</p><h2>{headings[kind]}</h2>
      {kind === "asset-editor" ? <>
        <label className="file-drop">选择照片、语音或视频<input type="file" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} /><span>{fileName || "点击选择文件"}</span></label>
        <div className="quick-option-grid"><button type="button" onClick={() => setPreview("已选择轻微左旋 3°")}>轻微旋转</button><button type="button" onClick={() => setPreview("已放到内容顶层")}>置于顶层</button><button type="button" onClick={() => setPreview("已应用自然胶片颗粒")}>胶片质感</button><button type="button" onClick={() => setPreview("已设置为章节主画面")}>设为主画面</button></div>
        {preview ? <p className="action-preview">{preview}</p> : null}
        <button className="action-primary" type="button" onClick={() => save("素材设置已应用", fileName ? `已选择：${fileName}` : "当前使用演示素材")}>保存设置</button>
      </> : null}
      {kind === "ai" ? <>
        <div className="quick-option-grid">{["更温暖", "更克制", "更简短", "更具体", "更有画面感", "更像日常说话"].map((item) => <button type="button" key={item} onClick={() => setInstruction(item)}>{item}</button>)}</div>
        <label>自定义修改要求<textarea maxLength={300} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：保留晚霞和车票细节，减少网络情话。" /></label>
        <button type="button" onClick={() => setPreview(`调整预览：${instruction || "更克制地保留真实细节"}。距离没有让你缺席我的日常，反而让每一次分享都更值得保存。`)}>生成调整预览</button>
        {preview ? <div className="ai-compare"><span>修改版</span><p>{preview}</p><button className="action-primary" type="button" onClick={() => save("AI 修改版已应用", "旧版本仍保存在版本历史中。")}>采用修改版</button></div> : null}
      </> : null}
      {kind === "collaboration" ? <div className="collaboration-review-list">
        {["林夏 · 语音祝福", "周宁 · 两张照片", "小乔 · 一段文字"].map((item, index) => <article key={item}><div><span>{index === 0 ? "等待确认" : "已查看"}</span><strong>{item}</strong></div><button type="button" onClick={() => toast("投稿已确认", `${item}会在正式礼物中展示。`)}>确认采用</button></article>)}
        <button className="action-primary" type="button" onClick={() => save("共创审核已完成", "已确认的内容进入当前草稿。")}>完成审核</button>
      </div> : null}
      {kind === "voice" ? <>
        <div className={`voice-recorder ${recording ? "recording" : ""}`}><i /><strong>{recording ? "正在录音 · 00:08" : "准备录制"}</strong><small>正式版本支持试听、重录和删除。</small></div>
        <button type="button" onClick={() => setRecording((value) => !value)}>{recording ? "停止录音" : "开始模拟录音"}</button>
        <button className="action-primary" type="button" disabled={recording} onClick={() => save("语音草稿已保存", "背景音乐播放时会自动降低音量。")}>保存语音</button>
      </> : null}
      {kind === "transition" ? <>
        <div className="transition-options">{["淡入", "叠化", "滑动", "光漏", "淡出"].map((item) => <button className={transition === item ? "active" : ""} type="button" key={item} onClick={() => setTransition(item)}>{item}</button>)}</div>
        <div className="transition-preview"><span>当前预览</span><strong>{transition}</strong></div>
        <button className="action-primary" type="button" onClick={() => save("转场已更新", `当前镜头使用“${transition}”。`)}>应用转场</button>
      </> : null}
      {kind === "credits" ? <>
        <label>Director<input value={director} onChange={(event) => setDirector(event.target.value)} /></label>
        <label>Special Thanks<textarea value={thanks} onChange={(event) => setThanks(event.target.value)} /></label>
        <div className="credits-preview"><span>DIRECTED BY</span><strong>{director}</strong><small>SPECIAL THANKS · {thanks}</small></div>
        <button className="action-primary" type="button" onClick={() => save("片尾署名已保存", "署名将在片尾与导出纪念册中显示。")}>保存片尾</button>
      </> : null}
    </div>
  );
}

function SharedDrawer({
  panel,
  theme,
  context,
  setPanel,
  applyTheme,
  restore,
  createStory,
  toast,
}: {
  panel: Panel;
  theme: ThemeKey;
  context: PanelContext;
  setPanel: (panel: Panel, context?: PanelContext) => void;
  applyTheme: (theme: ThemeKey) => void;
  restore: () => void;
  createStory: (story: NewStory) => void;
  toast: (title: string, detail?: string) => void;
}) {
  if (!panel || panel === "simulation") return null;
  const title = panel === "notifications" ? "通知中心" : panel === "versions" ? "版本与保存" : panel === "themes" ? "预览其他主题" : panel === "story-create" ? "新增一段故事" : context.title || "内容设置";
  const actionKinds = ["asset-editor", "ai", "collaboration", "voice", "transition", "credits"] as const;
  return (
    <aside className={`theme-shared-drawer ${panel}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><strong>{title}</strong><button type="button" onClick={() => setPanel(null)}>关闭</button></header>
      {panel === "notifications" ? <NotificationsPanel act={setPanel} /> : null}
      {panel === "versions" ? <VersionsPanel theme={theme} restore={restore} toast={toast} /> : null}
      {panel === "themes" ? <ThemeSwitchPanel theme={theme} applyTheme={applyTheme} /> : null}
      {panel === "story-create" ? <StoryCreatePanel theme={theme} create={createStory} /> : null}
      {actionKinds.includes(panel as typeof actionKinds[number]) ? <ActionPanel kind={panel as typeof actionKinds[number]} context={context} close={() => setPanel(null)} toast={toast} /> : null}
    </aside>
  );
}

function RecipientSimulation({ theme, close }: { theme: ThemeKey; close: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [sound, setSound] = useState(true);
  const [mode, setMode] = useState<"immersive" | "browse">("immersive");
  const [tests, setTests] = useState<string[]>([]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const names = {
    film: ["翻开成品相册", "收件人视角模拟"],
    galaxy: ["进入星空体验", "收件人视角模拟"],
    cinema: ["进入首映检查", "收件人视角模拟"],
  } as const;
  const toggleTest = (name: string) => setTests((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
  return (
    <div className={`recipient-simulation-modal ${theme}`} role="dialog" aria-modal="true">
      <div className="recipient-simulation-card">
        <header><div><span>{names[theme][1]}</span><h2>{names[theme][0]}</h2></div><button type="button" onClick={close}>关闭</button></header>
        <div className="simulation-devices">
          <button className={device === "mobile" ? "active" : ""} type="button" onClick={() => setDevice("mobile")}>手机</button>
          <button className={device === "desktop" ? "active" : ""} type="button" onClick={() => setDevice("desktop")}>电脑</button>
          <button className={sound ? "active" : ""} type="button" onClick={() => setSound((value) => !value)}>{sound ? "声音开启" : "静音"}</button>
          <button className={mode === "browse" ? "active" : ""} type="button" onClick={() => setMode((value) => value === "browse" ? "immersive" : "browse")}>{mode === "immersive" ? "沉浸播放" : "自由浏览"}</button>
        </div>
        <div className={`simulation-screen ${device}`}>
          <small>{device === "mobile" ? "手机端" : "电脑端"} · {mode === "immersive" ? "沉浸播放" : "自由浏览"} · {sound ? "有声" : "静音"}</small>
          <h3>{["封面与解锁", "故事章节", "专属信件", "未来约定"][sceneIndex]}</h3>
          <p>{sceneIndex === 0 ? themeDefinitions[theme].promise : sceneIndex === 1 ? "检查照片、文字、日期与主题转场是否能够顺畅呈现。" : sceneIndex === 2 ? "检查长文阅读、语音音量和背景音乐自动降低是否正常。" : "检查结尾、回复入口与重新观看路径是否清晰。"}</p>
          <div className="simulation-demo-controls"><button type="button" disabled={sceneIndex === 0} onClick={() => setSceneIndex((value) => Math.max(0, value - 1))}>上一幕</button><button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "暂停" : "继续"}</button><button type="button" disabled={sceneIndex === 3} onClick={() => setSceneIndex((value) => Math.min(3, value + 1))}>下一幕</button></div>
        </div>
        <button className="advanced-toggle" type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? "收起真实情况测试" : "更多真实情况测试"}</button>
        {advanced ? <div className="simulation-tests">{["模拟慢速网络", "错误解锁", "媒体加载失败", "开放时间限制"].map((item) => <button className={tests.includes(item) ? "active" : ""} type="button" key={item} onClick={() => toggleTest(item)}>{tests.includes(item) ? `✓ ${item}` : item}</button>)}</div> : null}
        <div className="simulation-report"><strong>检查结果</strong><span>✓ 核心流程正常</span><span>{tests.length ? `✓ 已完成 ${tests.length} 项异常场景测试` : "△ 尚未运行高级异常场景"}</span></div>
      </div>
    </div>
  );
}

function FilmStudio({
  stories,
  setStories,
  openSimulation,
  openPanel,
  toast,
}: {
  stories: StoryItem[];
  setStories: (items: StoryItem[]) => void;
  openSimulation: () => void;
  openPanel: (panel: Panel, context?: PanelContext) => void;
  toast: (title: string, detail?: string) => void;
}) {
  const [page, setPage] = useState(1);
  const current = stories[Math.min(page - 1, stories.length - 1)];
  const [selectedAsset, setSelectedAsset] = useState("photo");
  const assets: Record<string, string[]> = {
    photo: ["朋友聚会合照", "两座城市晚霞", "车站重逢"],
    story: stories.map((item) => item.title),
    letter: ["三周年情书", "生日祝福"],
    ticket: ["2026.08.12 车票", "看海行程票根"],
    voice: ["陈默的生日语音"],
    friends: ["林夏的祝福", "周宁的合照"],
  };
  const labels = { photo: "照片", story: "回忆", letter: "信件", ticket: "票根", voice: "语音", friends: "朋友祝福" } as Record<string, string>;
  return (
    <div className="film-studio-layout">
      <aside className="film-material-drawer">
        <p>素材抽屉</p>
        <div className="film-material-tabs">{Object.keys(labels).map((item) => <button className={selectedAsset === item ? "active" : ""} type="button" key={item} onClick={() => setSelectedAsset(item)}>{labels[item]}</button>)}</div>
        <div className="film-material-list">{assets[selectedAsset].map((item) => <button type="button" key={item} onClick={() => openPanel("asset-editor", { title: item })}><span>{labels[selectedAsset]}</span><strong>{item}</strong></button>)}</div>
        <article><span>新增故事</span><strong>你想记录哪一种时刻？</strong><small>第一次见面 · 普通小事 · 未来约定</small><button type="button" onClick={() => openPanel("story-create")}>打开故事创建面板</button></article>
      </aside>
      <section className="film-album-workspace">
        <div className="film-sunlight" />
        <button className="album-turn left" type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
        <div className="open-album">
          <div className="album-page left-page">
            <div className="polaroid main-photo"><span>生活照片</span><small>{current?.date}</small></div>
            <div className="paper-tape" />
            <button className="floating-edit-card" type="button" onClick={() => openPanel("asset-editor", { title: `${current?.title} · 主照片` })}>替换 · 旋转 · 置顶 · 更多设置</button>
          </div>
          <div className="album-spine" />
          <div className="album-page right-page">
            <span className="handwritten-date">{current?.date}</span>
            <h2>{current?.title}</h2>
            <textarea aria-label="当前故事正文" value={current?.text || ""} onChange={(event) => setStories(stories.map((item) => item.id === current?.id ? { ...item, text: event.target.value, status: "active" } : item))} />
            <div className="album-signature">写给重要的人 · 亲手装订</div>
          </div>
        </div>
        <button className="album-turn right" type="button" disabled={page >= stories.length} onClick={() => setPage((value) => Math.min(stories.length, value + 1))}>›</button>
        <div className="album-thumbnails">{stories.map((item, index) => <button className={`${page === index + 1 ? "active" : ""} ${item.status}`} type="button" key={item.id} onClick={() => setPage(index + 1)}><span>{index + 1}</span><small>{item.title}</small></button>)}</div>
      </section>
      <aside className="film-recipient-preview">
        <span>收件人预览</span><div><small>{current?.date}</small><h3>{current?.title}</h3><p>{current?.text}</p></div>
        <button type="button" onClick={openSimulation}>翻开成品相册<small>收件人视角模拟</small></button>
      </aside>
      <footer className="theme-journey-bar"><div><span>当前主推荐</span><strong>完善“{stories.find((item) => item.status === "active")?.title || current?.title}”</strong><small>预计 3 分钟 · 完成后相册情绪会更完整</small></div><div><button type="button" onClick={() => toast("日期编辑已定位", `正在编辑“${current?.title}”的手写日期。`)}>备选：添加日期</button><button type="button" onClick={() => openPanel("voice", { title: current?.title })}>备选：录制一句话</button></div></footer>
    </div>
  );
}

function GalaxyStudio({
  stars,
  setStars,
  openSimulation,
  openPanel,
  toast,
}: {
  stars: StarNode[];
  setStars: (items: StarNode[]) => void;
  openSimulation: () => void;
  openPanel: (panel: Panel, context?: PanelContext) => void;
  toast: (title: string, detail?: string) => void;
}) {
  const [selected, setSelected] = useState(stars[1]?.id || stars[0].id);
  const [connections, setConnections] = useState<Array<[string, string]>>([["meet", "cities"], ["cities", "reunion"], ["reunion", "letter"], ["letter", "future"]]);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const current = stars.find((item) => item.id === selected) || stars[0];

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const x = Math.max(5, Math.min(95, ((moveEvent.clientX - rect.left - pan.x) / rect.width / zoom) * 100));
      const y = Math.max(8, Math.min(92, ((moveEvent.clientY - rect.top - pan.y) / rect.height / zoom) * 100));
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
      toast("星点已连接", `“${stars.find((item) => item.id === connectFrom)?.title}”与“${stars.find((item) => item.id === id)?.title}”已建立故事连线。`);
    }
    setConnectFrom(null);
  }

  function arrange() {
    const count = stars.length;
    setStars(stars.map((item, index) => ({ ...item, x: 50 + Math.cos((index / count) * Math.PI * 2 - Math.PI / 2) * 32, y: 50 + Math.sin((index / count) * Math.PI * 2 - Math.PI / 2) * 28 })));
    setZoom(1); setPan({ x: 0, y: 0 });
    toast("星座已自动整理", "故事顺序没有改变，你仍可继续自由拖动星点。" );
  }

  return (
    <div className="galaxy-studio-layout">
      <aside className="galaxy-node-editor">
        <span>当前星点内容</span><h2>{current.title}</h2>
        <label>日期<input value={current.date} onChange={(event) => setStars(stars.map((item) => item.id === current.id ? { ...item, date: event.target.value } : item))} /></label>
        <label>故事标题<input value={current.title} onChange={(event) => setStars(stars.map((item) => item.id === current.id ? { ...item, title: event.target.value } : item))} /></label>
        <label>回忆文字<textarea value={current.text} onChange={(event) => setStars(stars.map((item) => item.id === current.id ? { ...item, text: event.target.value, status: "active" } : item))} /></label>
        <button type="button" onClick={() => openPanel("asset-editor", { title: `${current.title} · 照片与声音` })}>上传照片与声音</button><button type="button" onClick={() => openPanel("ai", { title: current.title })}>AI 帮我调整</button>
        <p>{connectFrom ? `已选择“${stars.find((item) => item.id === connectFrom)?.title}”，再点一个星点完成连接。` : "可拖线或依次选择两个星点建立故事连线。"}</p>
      </aside>
      <section className="galaxy-canvas-area" ref={canvasRef}>
        <div className="galaxy-canvas-nebula" />
        <div className="galaxy-canvas-content" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
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
            type="button" key={item.id}
            onPointerDown={(event) => pointerDown(event, item.id)}
            onDoubleClick={() => connect(item.id)}
            onClick={() => { if (connectFrom && connectFrom !== item.id) connect(item.id); else setSelected(item.id); }}
          ><i /><span>{item.title}</span></button>)}
        </div>
        <div className="galaxy-canvas-actions"><button type="button" onClick={() => setZoom((value) => Math.max(.65, value - .1))}>−</button><button type="button" onClick={() => setZoom((value) => Math.min(1.65, value + .1))}>+</button><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>回到完整星座</button><button type="button" className={connectFrom ? "active" : ""} onClick={() => setConnectFrom(connectFrom ? null : selected)}>{connectFrom ? "取消连接" : "连接星点"}</button><button type="button" onClick={arrange}>自动整理预览</button></div>
      </section>
      <aside className="galaxy-effect-preview">
        <span>效果预览</span><div><small>{current.date}</small><h3>{current.title}</h3><p>{current.text}</p></div>
        <button type="button" onClick={openSimulation}>进入星空体验<small>收件人视角模拟</small></button>
      </aside>
      <footer className="theme-journey-bar galaxy"><div><span>当前最值得点亮的星</span><strong>三周年情书</strong><small>完成后，星座的情感主线会连接完整</small></div><div><button type="button" onClick={() => openPanel("asset-editor", { title: "上传两座城市的晚霞" })}>备选：上传晚霞</button><button type="button" onClick={() => toast("倒计时设置已打开", "演示倒计时：距离下一次见面还有 23 天。")}>备选：设置倒计时</button></div></footer>
    </div>
  );
}

function CinemaStudio({
  scenes,
  setScenes,
  openSimulation,
  openPanel,
  toast,
}: {
  scenes: TimelineScene[];
  setScenes: (items: TimelineScene[]) => void;
  openSimulation: () => void;
  openPanel: (panel: Panel, context?: PanelContext) => void;
  toast: (title: string, detail?: string) => void;
}) {
  const [selected, setSelected] = useState(Math.min(2, scenes.length - 1));
  const [professional, setProfessional] = useState(false);
  const current = scenes[selected];
  const total = scenes.reduce((sum, item) => sum + item.duration, 0);
  const addScene = () => {
    const next: TimelineScene = { id: `scene-${Date.now()}`, title: "新的一幕", duration: 8, subtitle: "点击右侧填写这一幕的字幕。", type: "image", transition: "叠化" };
    setScenes([...scenes, next]);
    setSelected(scenes.length);
    toast("已新增一幕", "新分镜已加入时间线末尾。" );
  };
  const autoRhythm = () => {
    setScenes(scenes.map((item, index) => ({ ...item, duration: [8, 14, 16, 20, 10][index] || Math.max(8, item.duration) })));
    toast("节奏建议已应用", "你仍可在简化时间线或专业轨道中精确调整。" );
  };
  const addCredits = () => {
    const index = scenes.findIndex((item) => item.id === "credits");
    if (index >= 0) { setSelected(index); openPanel("credits", { title: "片尾署名" }); return; }
    const next: TimelineScene = { id: "credits", title: "片尾", duration: 10, subtitle: "To Be Continued...", type: "image" };
    setScenes([...scenes, next]); setSelected(scenes.length); openPanel("credits", { title: "片尾署名" });
  };
  return (
    <div className="cinema-studio-layout">
      <aside className="cinema-storyboards">
        <span>分镜卡片</span>
        {scenes.map((item, index) => <button className={index === selected ? "active" : ""} type="button" key={item.id} onClick={() => setSelected(index)}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item.title}</strong><em>{item.duration} 秒</em></button>)}
        <button className="add-scene" type="button" onClick={addScene}>+ 新增一幕</button>
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
        <button type="button" onClick={() => openPanel("transition", { title: current.title })}>设置转场</button><button type="button" onClick={() => openPanel("voice", { title: `${current.title} · 旁白` })}>添加旁白</button><button type="button" onClick={() => openPanel("ai", { title: `${current.title} · 字幕` })}>AI 调整字幕</button>
        <button className="premiere" type="button" onClick={openSimulation}>进入首映检查<small>收件人视角模拟</small></button>
      </aside>
      <footer className="theme-journey-bar cinema"><div><span>下一幕建议</span><strong>完成片尾旁白</strong><small>目前电影已有完整故事，但结尾还缺一句面向未来的话</small></div><div><button type="button" onClick={autoRhythm}>备选：自动整理节奏</button><button type="button" onClick={addCredits}>备选：添加片尾署名</button></div></footer>
    </div>
  );
}

export default function ThemeStudioExperience({ initialTheme }: { initialTheme: ThemeKey }) {
  const [theme, setTheme] = useState(initialTheme);
  const [panel, setPanelState] = useState<Panel>(null);
  const [panelContext, setPanelContext] = useState<PanelContext>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const [stories, setStories] = useState(initialStories);
  const [stars, setStars] = useState(initialStars);
  const [scenes, setScenes] = useState(initialScenes);
  const [toastState, setToastState] = useState<ToastState>(null);
  const payload = useMemo(() => ({ theme, stories, stars, scenes }), [theme, stories, stars, scenes]);
  const { state, time } = useAutosave(theme, payload);

  useEffect(() => {
    const timer = toastState ? window.setTimeout(() => setToastState(null), 3600) : null;
    return () => { if (timer) window.clearTimeout(timer); };
  }, [toastState]);

  const toast = (title: string, detail?: string) => setToastState({ title, detail });
  const openPanel = (next: Panel, context: PanelContext = {}) => { setPanelContext(context); setPanelState(next); };

  function applyTheme(next: ThemeKey) {
    setTheme(next);
    setPanelState(null);
    window.history.replaceState(null, "", `/studio/theme/${next}`);
    toast(`已切换为${themeDefinitions[next].name}`, "相同内容已经映射到新的主题制作台。" );
  }

  function restoreSnapshot() {
    setStories(initialStories); setStars(initialStars); setScenes(initialScenes);
    setPanelState(null);
    toast("历史版本已恢复为新草稿", "当前正式礼物没有被覆盖。" );
  }

  function createStory(story: NewStory) {
    const id = `story-${Date.now()}`;
    const text = story.detail || "这段故事暂时只保存了基本信息，可以稍后继续补充。";
    setStories((items) => [...items, { id, title: story.title, date: story.date || "时间待补充", text, status: "active" }]);
    const index = stars.length;
    setStars((items) => [...items, { id, title: story.title, date: story.date || "时间待补充", text, status: "active", x: 20 + (index * 14) % 65, y: 25 + (index * 17) % 55 }]);
    setScenes((items) => [...items, { id, title: story.title, duration: 10, subtitle: text, type: "image", transition: "叠化" }]);
    setPanelState(null);
    toast("故事已创建", `“${story.title}”已加入${themeDefinitions[theme].name}制作台。`);
  }

  return (
    <main className={`theme-studio-page ${theme} ${reduceMotion ? "reduce-motion" : ""}`}>
      <StudioTopBar theme={theme} saveState={state} saveTime={time} panel={panel} setPanel={(next) => openPanel(next)} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} />
      <button className="page-notification-summary" type="button" onClick={() => openPanel("notifications")}><strong>当前最值得处理：检查 AI 初稿</strong><span>另外还有 2 条消息 →</span></button>
      {theme === "film" ? <FilmStudio stories={stories} setStories={setStories} openSimulation={() => openPanel("simulation")} openPanel={openPanel} toast={toast} /> : null}
      {theme === "galaxy" ? <GalaxyStudio stars={stars} setStars={setStars} openSimulation={() => openPanel("simulation")} openPanel={openPanel} toast={toast} /> : null}
      {theme === "cinema" ? <CinemaStudio scenes={scenes} setScenes={setScenes} openSimulation={() => openPanel("simulation")} openPanel={openPanel} toast={toast} /> : null}
      <SharedDrawer panel={panel} theme={theme} context={panelContext} setPanel={openPanel} applyTheme={applyTheme} restore={restoreSnapshot} createStory={createStory} toast={toast} />
      {panel === "simulation" ? <RecipientSimulation theme={theme} close={() => setPanelState(null)} /> : null}
      {toastState ? <div className="studio-toast" role="status"><strong>{toastState.title}</strong>{toastState.detail ? <span>{toastState.detail}</span> : null}<button type="button" onClick={() => setToastState(null)}>关闭</button></div> : null}
    </main>
  );
}
