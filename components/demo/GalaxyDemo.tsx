"use client";

import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";
import { useEffect, useMemo, useState } from "react";
import { galaxyDemo } from "@/lib/experience/galaxy-demo";

const moods = ["被打动了", "想马上见到你", "我也有话想说"];

export default function GalaxyDemo({ initialSound = false }: { initialSound?: boolean }) {
  const [sound, setSound] = useState(initialSound);
  const [unlocked, setUnlocked] = useState(false);
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<"immersive" | "browse">("immersive");
  const [mood, setMood] = useState(moods[1]);
  const [reply, setReply] = useState("原来你一直记得这些小事。下一次见面，我们真的去看海吧。");
  const [submittedReply, setSubmittedReply] = useState(false);
  const [showStartChoice, setShowStartChoice] = useState(false);

  const scene = galaxyDemo.scenes[sceneIndex];
  const totalDuration = useMemo(
    () => galaxyDemo.scenes.reduce((sum, item) => sum + item.duration, 0),
    [],
  );
  const progressBefore = useMemo(
    () => galaxyDemo.scenes.slice(0, sceneIndex).reduce((sum, item) => sum + item.duration, 0),
    [sceneIndex],
  );
  const overallProgress = Math.min(100, ((progressBefore + elapsed) / totalDuration) * 100);

  useEffect(() => {
    if (!unlocked || !playing || mode !== "immersive") return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 0.25 >= scene.duration) {
          if (sceneIndex < galaxyDemo.scenes.length - 1) {
            setSceneIndex((index) => index + 1);
            return 0;
          }
          setPlaying(false);
          return scene.duration;
        }
        return current + 0.25;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, scene.duration, sceneIndex, unlocked, mode]);

  function unlock() {
    const normalized = answer.trim().toLowerCase();
    const correct = galaxyDemo.acceptedAnswers.some((item) => normalized.includes(item.toLowerCase()));
    if (correct) {
      setUnlocked(true);
      setPlaying(true);
      return;
    }
    setAttempts((value) => value + 1);
  }

  function moveScene(offset: number) {
    setSceneIndex((current) => Math.max(0, Math.min(galaxyDemo.scenes.length - 1, current + offset)));
    setElapsed(0);
  }

  if (!unlocked) {
    return (
      <main className="galaxy-demo-page galaxy-unlock-page">
        <div className="galaxy-demo-stars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        <section className="galaxy-unlock-card">
          <p>一份只属于林晚的礼物</p>
          <h1>{galaxyDemo.title}</h1>
          <div className="galaxy-unlock-question">
            <span>解锁问题</span>
            <strong>{galaxyDemo.unlockQuestion}</strong>
            <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="写下答案" />
            {attempts > 0 ? (
              <p className="galaxy-hint">
                {attempts === 1
                  ? "好像不是这段回忆。提示：那是一件即使相隔两座城市，也会一起做的事。"
                  : "还没想起来吗？可以直接使用演示答案继续体验。"}
              </p>
            ) : null}
            <div className="galaxy-answer-row">
              <span>演示答案：{galaxyDemo.unlockAnswer}</span>
              <button type="button" onClick={() => setAnswer(galaxyDemo.unlockAnswer)}>填入演示答案</button>
            </div>
            {attempts >= 2 ? <button className="galaxy-use-answer" type="button" onClick={() => { setAnswer(galaxyDemo.unlockAnswer); setUnlocked(true); setPlaying(true); }}>使用演示答案解锁</button> : null}
            <button className="galaxy-unlock-button" type="button" onClick={unlock}>解锁这份礼物</button>
          </div>
          <small>演示人物与故事均为虚构。</small>
        </section>
      </main>
    );
  }

  return (
    <main className="galaxy-demo-page">
      <div className="galaxy-demo-stars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      <header className="galaxy-demo-header">
        <div className="galaxy-demo-header-inner">
          <div className="galaxy-demo-brand">
            <BrandLogo compact dark href="/" />
            <span><b>B</b> 梦幻星空样片</span>
          </div>
          <div className="galaxy-demo-mode">
            <button className={mode === "immersive" ? "active" : ""} type="button" onClick={() => setMode("immersive")}>沉浸播放</button>
            <button className={mode === "browse" ? "active" : ""} type="button" onClick={() => { setMode("browse"); setPlaying(false); }}>自由浏览</button>
          </div>
          <div className="galaxy-demo-header-actions">
            <Link href="/#cases">退出样片</Link>
            <button type="button" onClick={() => setSound((value) => !value)}>{sound ? "声音已开启" : "静音"}</button>
          </div>
        </div>
      </header>

      <section className={`galaxy-stage scene-${scene.id}`}>
        <div className="galaxy-constellation" aria-hidden="true">
          {galaxyDemo.scenes.map((item, index) => (
            <button
              className={`${index === sceneIndex ? "active" : ""} ${index < sceneIndex ? "visited" : ""}`}
              style={{ left: `${10 + index * 13}%`, top: `${66 - (index % 3) * 19}%` }}
              key={item.id}
              type="button"
              aria-label={`查看${item.title}`}
              onClick={() => { if (mode === "browse") { setSceneIndex(index); setElapsed(0); } }}
            />
          ))}
          <svg viewBox="0 0 1000 520"><path d="M100 350 C220 220 310 360 420 170 C520 30 620 280 760 120 C840 45 900 155 940 80" /></svg>
        </div>

        <article className="galaxy-scene-card" key={scene.id}>
          <p>{scene.eyebrow}</p>
          <h1>{scene.title}</h1>
          <div className="galaxy-scene-copy">
            {scene.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          {scene.details ? <div className="galaxy-scene-details">{scene.details.map((item) => <span key={item}>{item}</span>)}</div> : null}
          {scene.id === "future" ? (
            <div className="galaxy-special-star">
              <strong>{galaxyDemo.starName}</strong>
              <span>{galaxyDemo.starCopy}</span>
            </div>
          ) : null}
        </article>

        {mode === "browse" ? (
          <aside className="galaxy-browse-nav">
            <span>自由浏览</span>
            {galaxyDemo.scenes.map((item, index) => (
              <button className={index === sceneIndex ? "active" : ""} key={item.id} type="button" onClick={() => { setSceneIndex(index); setElapsed(0); }}>{item.title}</button>
            ))}
          </aside>
        ) : null}
      </section>

      <div className="galaxy-progress"><i style={{ width: `${overallProgress}%` }} /></div>
      <div className="galaxy-controls">
        <span>{String(sceneIndex + 1).padStart(2, "0")} / {String(galaxyDemo.scenes.length).padStart(2, "0")}</span>
        <button type="button" disabled={sceneIndex === 0} onClick={() => moveScene(-1)}>上一幕</button>
        <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "暂停" : "继续"}</button>
        <button type="button" disabled={sceneIndex === galaxyDemo.scenes.length - 1} onClick={() => moveScene(1)}>下一幕</button>
      </div>

      {sceneIndex === galaxyDemo.scenes.length - 1 ? (
        <section className="galaxy-reply-section">
          <p>看到这里，你想留下些什么？</p>
          <div className="galaxy-moods">{moods.map((item) => <button className={mood === item ? "active" : ""} type="button" key={item} onClick={() => setMood(item)}>{item}</button>)}</div>
          <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={240} />
          <button type="button" onClick={() => setSubmittedReply(true)}>留下这句话</button>
          {submittedReply ? (
            <article className="galaxy-reply-card"><span>林晚 · {mood}</span><p>{reply}</p><small>刚刚 · 演示回复只在本次体验中显示</small></article>
          ) : null}
          <div className="galaxy-demo-end-actions">
            <button type="button" onClick={() => setShowStartChoice(true)}>用我的故事制作一份</button>
            <button type="button" onClick={() => { setSceneIndex(0); setElapsed(0); setPlaying(true); setSubmittedReply(false); }}>重新体验</button>
          </div>
        </section>
      ) : null}

      {showStartChoice ? (
        <div className="v10-modal-backdrop" role="dialog" aria-modal="true">
          <div className="galaxy-start-dialog">
            <p>你想怎样开始自己的礼物？</p>
            <h2>沿用这片星空，还是让 AI 重新理解你的故事？</h2>
            <div className="galaxy-start-options">
              <Link href="/plan-recommend?theme=galaxy">用梦幻星空开始<small>保留这种克制浪漫的表达方式</small></Link>
              <Link href="/create">让 AI 重新推荐<small>根据对象、场景和真实小事重新匹配</small></Link>
            </div>
            <button type="button" onClick={() => setShowStartChoice(false)}>返回礼物</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
