"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CardData, CardTheme } from "@/lib/card-data";
import { themeNames } from "@/lib/card-data";

type AsyncResult = { ok: boolean; error?: string };

type MemoryGiftProps = {
  card: CardData;
  embedded?: boolean;
  allowThemeSwitch?: boolean;
  onUnlock?: (answer: string) => Promise<AsyncResult>;
  onReply?: (message: string) => Promise<AsyncResult>;
};

const stageLabels = ["封面", "拆礼物", "回忆", "碎片", "信件", "未来", "回应"];

export default function MemoryGift({
  card,
  embedded = false,
  allowThemeSwitch = false,
  onUnlock,
  onReply,
}: MemoryGiftProps) {
  const [theme, setTheme] = useState<CardTheme>(card.theme);
  const [stage, setStage] = useState(0);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [reply, setReply] = useState("");
  const [replySaved, setReplySaved] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [checkedPromises, setCheckedPromises] = useState<boolean[]>(() =>
    card.futurePromises.map(() => false),
  );
  const [musicPlaying, setMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setTheme(card.theme);
    setCheckedPromises(card.futurePromises.map(() => false));
  }, [card]);

  const activeMemory = card.memories[memoryIndex] ?? card.memories[0];
  const progress = useMemo(
    () => ((stage + 1) / stageLabels.length) * 100,
    [stage],
  );

  const nextStage = () =>
    setStage((current) => Math.min(stageLabels.length - 1, current + 1));
  const previousStage = () => setStage((current) => Math.max(0, current - 1));

  const unlock = async () => {
    setUnlockBusy(true);
    setUnlockError("");
    if (onUnlock) {
      const result = await onUnlock(answer);
      setUnlockBusy(false);
      if (!result.ok) {
        setUnlockError(result.error || "暂时无法打开这份礼物。");
        return;
      }
      setStage(1);
      return;
    }

    const expected = card.unlockAnswer.trim().toLowerCase();
    setUnlockBusy(false);
    if (!expected || answer.trim().toLowerCase() === expected) {
      setStage(1);
      return;
    }
    setUnlockError("答案还差一点，再想想属于你们的那一天。");
  };

  const toggleMusic = async () => {
    if (!audioRef.current || !card.musicUrl) return;
    if (musicPlaying) {
      audioRef.current.pause();
      setMusicPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setMusicPlaying(true);
    } catch {
      setMusicPlaying(false);
    }
  };

  const saveReply = async () => {
    if (!reply.trim()) return;
    setReplyBusy(true);
    setReplyError("");
    if (onReply) {
      const result = await onReply(reply.trim());
      setReplyBusy(false);
      if (!result.ok) {
        setReplyError(result.error || "回应保存失败，请稍后重试。");
        return;
      }
    } else {
      setReplyBusy(false);
    }
    setReplySaved(true);
  };

  return (
    <article
      className={`memory-gift theme-${theme} ${embedded ? "is-embedded" : ""}`}
    >
      <div className="gift-atmosphere" aria-hidden="true">
        <span className="glow glow-one" />
        <span className="glow glow-two" />
        <span className="star star-one" />
        <span className="star star-two" />
        <span className="star star-three" />
      </div>

      {card.musicUrl ? (
        <audio ref={audioRef} src={card.musicUrl} loop preload="metadata" />
      ) : null}

      <header className="gift-toolbar">
        <div>
          <span className="gift-brand-mark">拾</span>
          <div className="gift-toolbar-copy">
            <strong>拾光</strong>
            <small>{card.occasion}</small>
          </div>
        </div>
        <div className="gift-toolbar-actions">
          {allowThemeSwitch ? (
            <label className="theme-select-label">
              <span>视觉主题</span>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as CardTheme)}
              >
                {(Object.keys(themeNames) as CardTheme[]).map((key) => (
                  <option key={key} value={key}>
                    {themeNames[key]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {card.musicUrl ? (
            <button
              className="icon-button"
              type="button"
              onClick={toggleMusic}
              aria-label="播放或暂停背景音乐"
            >
              {musicPlaying ? "暂停音乐" : "播放音乐"}
            </button>
          ) : null}
        </div>
      </header>

      <div
        className="gift-progress"
        aria-label={`当前进度：${stageLabels[stage]}`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <main className="gift-stage-container">
        {stage === 0 ? (
          <section className="gift-stage gift-cover-stage">
            <p className="gift-kicker">{card.coverKicker}</p>
            <p className="recipient-chip">TO · {card.recipientName}</p>
            <h1>{card.coverTitle}</h1>
            <p className="gift-lead">{card.coverSubtitle}</p>
            <div className="unlock-card">
              <label htmlFor={`answer-${embedded ? "embedded" : "full"}`}>
                {card.unlockQuestion ||
                  (onUnlock ? "请输入解锁答案" : "点击打开这份礼物")}
              </label>
              {card.unlockQuestion || onUnlock ? (
                <input
                  id={`answer-${embedded ? "embedded" : "full"}`}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void unlock()}
                  placeholder="输入你的答案"
                />
              ) : null}
              {unlockError ? <p className="form-error">{unlockError}</p> : null}
              <button
                type="button"
                className="gift-primary-button"
                onClick={() => void unlock()}
                disabled={unlockBusy}
              >
                {unlockBusy ? "正在打开…" : "打开这份礼物"}
              </button>
            </div>
          </section>
        ) : null}

        {stage === 1 ? (
          <section className="gift-stage tabletop-stage">
            <div className="tabletop-scene">
              <div className="table-ticket">
                <small>MEMORY TICKET</small>
                <strong>{card.importantDate.replaceAll("-", " / ")}</strong>
              </div>
              <div className="table-note">
                给 {card.recipientName}
                <br />
                一份只属于你的时间
              </div>
              <button className="table-album" type="button" onClick={nextStage}>
                <span className="album-spine" />
                <span className="album-main-title">我们的故事</span>
                <small>THE DAYS WE SHARED</small>
                <em>点击翻开相册</em>
              </button>
              <div className="table-polaroid polaroid-a">
                <span />
              </div>
              <div className="table-polaroid polaroid-b">
                <span />
              </div>
            </div>
            <p className="stage-support-copy">
              从第一张照片开始，重新走一遍共同经历过的时间。
            </p>
          </section>
        ) : null}

        {stage === 2 && activeMemory ? (
          <section className="gift-stage memory-stage">
            <div className="memory-heading">
              <p className="gift-kicker">
                CHAPTER {String(memoryIndex + 1).padStart(2, "0")}
              </p>
              <time>{activeMemory.date}</time>
              <h2>{activeMemory.title}</h2>
              {activeMemory.location ? <p>📍 {activeMemory.location}</p> : null}
            </div>
            <div className="memory-layout">
              <div className="memory-photo-frame">
                {activeMemory.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeMemory.image} alt={activeMemory.title} />
                ) : (
                  <div className="memory-placeholder">
                    <span>PHOTO</span>
                    <small>一张真实照片，会让故事变得不可替代</small>
                  </div>
                )}
              </div>
              <div className="memory-story-card">
                <p>{activeMemory.text}</p>
              </div>
            </div>
            <div className="memory-pagination">
              <button
                type="button"
                onClick={() =>
                  setMemoryIndex((index) => Math.max(0, index - 1))
                }
                disabled={memoryIndex === 0}
              >
                上一段
              </button>
              <span>
                {memoryIndex + 1} / {card.memories.length}
              </span>
              {memoryIndex < card.memories.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setMemoryIndex((index) =>
                      Math.min(card.memories.length - 1, index + 1),
                    )
                  }
                >
                  下一段
                </button>
              ) : (
                <button type="button" onClick={nextStage}>
                  看看生活碎片
                </button>
              )}
            </div>
          </section>
        ) : null}

        {stage === 3 ? (
          <section className="gift-stage fragment-stage">
            <p className="gift-kicker">ORDINARY BUT PRECIOUS</p>
            <h2>真正留下来的，常常是很小的事情。</h2>
            <div className="fragment-grid">
              {card.fragments.map((fragment, index) => (
                <article
                  className={`fragment-card fragment-${(index % 4) + 1}`}
                  key={fragment.id}
                >
                  <small>{fragment.label}</small>
                  <p>{fragment.content}</p>
                </article>
              ))}
            </div>
            <button
              type="button"
              className="gift-primary-button"
              onClick={nextStage}
            >
              打开那封信
            </button>
          </section>
        ) : null}

        {stage === 4 ? (
          <section className="gift-stage letter-stage">
            <div className="letter-envelope" aria-hidden="true">
              <span />
            </div>
            <article className="letter-paper">
              <p className="letter-salutation">写给 {card.recipientName}：</p>
              {card.letter.map((paragraph, index) => (
                <p key={`${paragraph}-${index}`}>{paragraph}</p>
              ))}
              <p className="letter-signature">—— {card.senderName}</p>
            </article>
            <button
              type="button"
              className="gift-primary-button"
              onClick={nextStage}
            >
              一起写到未来
            </button>
          </section>
        ) : null}

        {stage === 5 ? (
          <section className="gift-stage future-stage">
            <p className="gift-kicker">TO BE CONTINUED</p>
            <h2>故事写到这里，但并没有结束。</h2>
            <p className="gift-lead">
              把未来想一起完成的事情留下来。以后每实现一件，就回来点亮一次。
            </p>
            <div className="promise-list">
              {card.futurePromises.map((promise, index) => (
                <label
                  className={checkedPromises[index] ? "is-checked" : ""}
                  key={`${promise}-${index}`}
                >
                  <input
                    type="checkbox"
                    checked={checkedPromises[index] ?? false}
                    onChange={() =>
                      setCheckedPromises((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? !item : item,
                        ),
                      )
                    }
                  />
                  <span>{promise}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="gift-primary-button"
              onClick={nextStage}
            >
              留下你的回应
            </button>
          </section>
        ) : null}

        {stage === 6 ? (
          <section className="gift-stage reply-stage">
            <p className="gift-kicker">A NEW PAGE</p>
            <h2>这一页，留给你来继续写。</h2>
            {replySaved ? (
              <div className="reply-success">
                <span>✓</span>
                <h3>你的回应已经留在这段故事里。</h3>
                <p>正式上线后，这段回应会仅对送礼人与收礼人可见。</p>
              </div>
            ) : (
              <div className="reply-card">
                <label htmlFor={`reply-${embedded ? "embedded" : "full"}`}>
                  此刻最想对 {card.senderName} 说什么？
                </label>
                <textarea
                  id={`reply-${embedded ? "embedded" : "full"}`}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="写下一句话、一段回忆，或者一个未来约定……"
                />
                {replyError ? <p className="form-error">{replyError}</p> : null}
                <button
                  type="button"
                  className="gift-primary-button"
                  onClick={() => void saveReply()}
                  disabled={!reply.trim() || replyBusy}
                >
                  {replyBusy ? "正在保存…" : "保存回应"}
                </button>
              </div>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setStage(0);
                setMemoryIndex(0);
                setAnswer("");
                setReplySaved(false);
              }}
            >
              重新体验
            </button>
          </section>
        ) : null}
      </main>

      {stage > 0 ? (
        <footer className="gift-stage-footer">
          <button type="button" onClick={previousStage}>
            ← 上一步
          </button>
          <span>{stageLabels[stage]}</span>
          <button
            type="button"
            onClick={nextStage}
            disabled={stage === stageLabels.length - 1}
          >
            下一步 →
          </button>
        </footer>
      ) : null}
    </article>
  );
}
