"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RecipientMemorySpace from "@/components/RecipientMemorySpace";
import ReportIssueButton from "@/components/ReportIssueButton";
import type {
  CardData,
  CardTheme,
  ReplyMood,
} from "@/lib/card-data";
import type { MemorySpaceSummary, RecipientEntry, RecipientEntryType, RecipientMediaAsset } from "@/lib/memory-space/types";
import {
  replyMoodLabels,
  themeNames,
} from "@/lib/card-data";

type AsyncResult = { ok: boolean; error?: string };
type EngagementPayload = {
  eventType: string;
  stageKey?: string;
  metadata?: Record<string, unknown>;
};

type MemoryGiftProps = {
  card: CardData;
  embedded?: boolean;
  allowThemeSwitch?: boolean;
  onUnlock?: (answer: string) => Promise<AsyncResult>;
  onReply?: (message: string, mood: ReplyMood) => Promise<AsyncResult>;
  onEngagement?: (payload: EngagementPayload) => void | Promise<void>;
  memorySpace?: MemorySpaceSummary | null;
  memorySpaceLoading?: boolean;
  onCreateMemoryEntry?: (
    entryType: RecipientEntryType,
    content: string,
    media: RecipientMediaAsset[],
  ) => Promise<{ ok: boolean; error?: string; data?: RecipientEntry }>;
  onUploadMemoryMedia?: (
    file: File,
  ) => Promise<{ ok: boolean; error?: string; data?: RecipientMediaAsset }>;
  onClaimMemorySpace?: () => Promise<AsyncResult>;
  onRequestInvitePermission?: () => Promise<AsyncResult>;
  onCreateRecipientInvite?: (expectedName: string) => Promise<{ ok: boolean; error?: string; data?: { url: string } }>;
};

type StageKey =
  | "cover"
  | "tabletop"
  | "memories"
  | "fragments"
  | "collaboration"
  | "quiz"
  | "letter"
  | "future"
  | "surprise"
  | "reply";

const stageLabels: Record<StageKey, string> = {
  cover: "封面",
  tabletop: "拆礼物",
  memories: "回忆",
  fragments: "碎片",
  collaboration: "祝福",
  quiz: "小问答",
  letter: "信件",
  future: "未来",
  surprise: "惊喜",
  reply: "回应",
};

function countdownParts(target?: string) {
  if (!target) return null;
  const diff = Math.max(0, Date.parse(target) - Date.now());
  return {
    total: diff,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function relationshipDays(value?: string) {
  if (!value) return null;
  const start = Date.parse(value);
  if (!Number.isFinite(start)) return null;
  return Math.max(1, Math.floor((Date.now() - start) / 86_400_000) + 1);
}

export default function MemoryGift({
  card,
  embedded = false,
  allowThemeSwitch = false,
  onUnlock,
  onReply,
  onEngagement,
  memorySpace = null,
  memorySpaceLoading = false,
  onCreateMemoryEntry,
  onUploadMemoryMedia,
  onClaimMemorySpace,
  onRequestInvitePermission,
  onCreateRecipientInvite,
}: MemoryGiftProps) {
  const [theme, setTheme] = useState<CardTheme>(card.theme);
  const [stageIndex, setStageIndex] = useState(0);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [reply, setReply] = useState("");
  const [replyMood, setReplyMood] = useState<ReplyMood>("touched");
  const [replySaved, setReplySaved] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [checkedPromises, setCheckedPromises] = useState<boolean[]>(() =>
    card.futurePromises.map(() => false),
  );
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<"idle" | "correct" | "wrong">(
    "idle",
  );
  const surpriseTracked = useRef(false);
  const lastTrackedStage = useRef("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const releasePending = useMemo(() => {
    if (embedded || !card.releaseAt) return false;
    return Date.parse(card.releaseAt) > clock;
  }, [card.releaseAt, clock, embedded]);

  const expired = useMemo(() => {
    if (embedded || !card.expiresAt) return false;
    return Date.parse(card.expiresAt) <= clock;
  }, [card.expiresAt, clock, embedded]);

  const stages = useMemo<StageKey[]>(() => {
    const items: StageKey[] = ["cover", "tabletop"];
    if (card.memories.length) items.push("memories");
    if (card.fragments.length) items.push("fragments");
    if (card.collaborations?.length) items.push("collaboration");
    if (card.quiz?.enabled && card.quiz.options.length >= 2) items.push("quiz");
    if (card.letter.length) items.push("letter");
    if (card.futurePromises.length || card.relationshipStartDate)
      items.push("future");
    if (card.surprise?.enabled) items.push("surprise");
    items.push("reply");
    return items;
  }, [card]);

  const stage = stages[Math.min(stageIndex, stages.length - 1)] ?? "cover";
  const activeMemory = card.memories[memoryIndex] ?? card.memories[0];
  const progress = ((stageIndex + 1) / stages.length) * 100;
  const countdown = countdownParts(card.releaseAt);
  const daysTogether = relationshipDays(card.relationshipStartDate);

  useEffect(() => {
    setTheme(card.theme);
    setCheckedPromises(card.futurePromises.map(() => false));
    setStageIndex(0);
    setMemoryIndex(0);
    setQuizChoice(null);
    setQuizResult("idle");
  }, [card]);

  useEffect(() => {
    if (!card.releaseAt && !card.expiresAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [card.expiresAt, card.releaseAt]);

  useEffect(() => {
    if (releasePending || expired || stage === "cover") return;
    const key = `${card.slug}:${stage}`;
    if (lastTrackedStage.current === key) return;
    lastTrackedStage.current = key;
    void onEngagement?.({ eventType: "stage_viewed", stageKey: stage });
    if (stage === "reply") void onEngagement?.({ eventType: "completed" });
  }, [card.slug, expired, onEngagement, releasePending, stage]);

  const nextStage = () =>
    setStageIndex((current) => Math.min(stages.length - 1, current + 1));
  const previousStage = () =>
    setStageIndex((current) => Math.max(0, current - 1));

  const unlock = async () => {
    if (releasePending || expired) return;
    setUnlockBusy(true);
    setUnlockError("");
    if (onUnlock) {
      const result = await onUnlock(answer);
      setUnlockBusy(false);
      if (!result.ok) {
        setUnlockError(result.error || "暂时无法打开这份礼物。");
        return;
      }
      setStageIndex(1);
      return;
    }

    const expected = card.unlockAnswer.trim().toLowerCase();
    setUnlockBusy(false);
    if (!expected || answer.trim().toLowerCase() === expected) {
      setStageIndex(1);
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

  const submitQuiz = () => {
    if (!card.quiz || quizChoice === null) return;
    if (quizChoice === card.quiz.answerIndex) {
      setQuizResult("correct");
      void onEngagement?.({
        eventType: "quiz_completed",
        stageKey: "quiz",
        metadata: { correct: true },
      });
    } else {
      setQuizResult("wrong");
    }
  };

  const openSurprise = () => {
    if (surpriseTracked.current) return;
    surpriseTracked.current = true;
    void onEngagement?.({ eventType: "surprise_opened", stageKey: "surprise" });
  };

  const saveReply = async () => {
    if (!reply.trim()) return;
    setReplyBusy(true);
    setReplyError("");
    if (onReply) {
      const result = await onReply(reply.trim(), replyMood);
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

  if (expired) {
    return (
      <article className={`memory-gift theme-${theme}`}>
        <main className="gift-stage-container">
          <section className="gift-stage gift-cover-stage expiry-stage">
            <p className="gift-kicker">A MEMORY KEPT WITH CARE</p>
            <h1>这份礼物已经结束展示。</h1>
            <p className="gift-lead">
              它曾在约定的时间里为你打开。需要重新查看时，请联系送礼人延长展示时间。
            </p>
          </section>
        </main>
      </article>
    );
  }

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
          {!embedded ? <ReportIssueButton slug={card.slug} /> : null}
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

      <div className="gift-progress" aria-label={`当前进度：${stageLabels[stage]}`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <main className="gift-stage-container">
        {stage === "cover" ? (
          <section className="gift-stage gift-cover-stage">
            {releasePending && countdown ? (
              <div className="release-countdown-card">
                <p className="gift-kicker">OPEN AT THE RIGHT MOMENT</p>
                <p className="recipient-chip">TO · {card.recipientName}</p>
                <h1>{card.preReleaseTitle || "这份礼物还在等待最合适的时刻"}</h1>
                <p className="gift-lead">
                  {card.preReleaseMessage || "倒计时结束后，它会自动开启。"}
                </p>
                <div className="countdown-grid" aria-label="礼物开启倒计时">
                  <span><strong>{countdown.days}</strong><small>天</small></span>
                  <span><strong>{String(countdown.hours).padStart(2, "0")}</strong><small>时</small></span>
                  <span><strong>{String(countdown.minutes).padStart(2, "0")}</strong><small>分</small></span>
                  <span><strong>{String(countdown.seconds).padStart(2, "0")}</strong><small>秒</small></span>
                </div>
                <small className="release-time-copy">
                  开启时间：{new Date(card.releaseAt || "").toLocaleString("zh-CN")}
                </small>
              </div>
            ) : card.releaseAt && countdown?.total === 0 && !embedded && !card.memories.length ? (
              <div className="release-countdown-card">
                <p className="gift-kicker">THE MOMENT HAS ARRIVED</p>
                <h1>时间到了，这份礼物已经可以打开。</h1>
                <button
                  type="button"
                  className="gift-primary-button"
                  onClick={() => window.location.reload()}
                >
                  重新加载并打开
                </button>
              </div>
            ) : (
              <>
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
              </>
            )}
          </section>
        ) : null}

        {stage === "tabletop" ? (
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
              <div className="table-polaroid polaroid-a"><span /></div>
              <div className="table-polaroid polaroid-b"><span /></div>
            </div>
            <p className="stage-support-copy">
              从第一张照片开始，重新走一遍共同经历过的时间。
            </p>
          </section>
        ) : null}

        {stage === "memories" && activeMemory ? (
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
              <div className="memory-story-card"><p>{activeMemory.text}</p></div>
            </div>
            <div className="memory-pagination">
              <button
                type="button"
                onClick={() => setMemoryIndex((index) => Math.max(0, index - 1))}
                disabled={memoryIndex === 0}
              >
                上一段
              </button>
              <span>{memoryIndex + 1} / {card.memories.length}</span>
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
                <button type="button" onClick={nextStage}>继续</button>
              )}
            </div>
          </section>
        ) : null}

        {stage === "fragments" ? (
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
            <button type="button" className="gift-primary-button" onClick={nextStage}>
              继续打开故事
            </button>
          </section>
        ) : null}

        {stage === "collaboration" && card.collaborations?.length ? (
          <section className="gift-stage collaboration-gift-stage">
            <p className="gift-kicker">WORDS COLLECTED FOR YOU</p>
            <h2>还有一些重要的人，也想把话留在这里。</h2>
            <p className="gift-lead">这些内容通过秘密邀请共同完成，并由送礼人确认后进入礼物。</p>
            <div className="gift-collaboration-grid">
              {card.collaborations.map((item) => (
                <article key={item.id}>
                  <header><span>{item.anonymousToRecipient ? "匿" : item.displayName.slice(0, 1)}</span><div><strong>{item.anonymousToRecipient ? "匿名祝福" : item.displayName}</strong><small>共同准备这份礼物的人</small></div></header>
                  <p>{item.message}</p>
                  {item.media.length ? (
                    <div className="gift-collaboration-media">
                      {item.media.map((media, index) =>
                        media.type === "image" && media.url ? (
                          <img key={`${media.path}-${index}`} src={media.url} alt="共同祝福照片" />
                        ) : media.type === "audio" && media.url ? (
                          <audio key={`${media.path}-${index}`} src={media.url} controls preload="metadata" />
                        ) : media.type === "video" && media.url ? (
                          <video key={`${media.path}-${index}`} src={media.url} controls preload="metadata" playsInline />
                        ) : null,
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <button type="button" className="gift-primary-button" onClick={nextStage}>
              继续打开这份礼物
            </button>
          </section>
        ) : null}

        {stage === "quiz" && card.quiz ? (
          <section className="gift-stage quiz-stage">
            <p className="gift-kicker">A QUESTION ONLY FOR US</p>
            <h2>{card.quiz.question}</h2>
            <div className="quiz-options">
              {card.quiz.options.map((option, index) => (
                <button
                  type="button"
                  className={quizChoice === index ? "is-selected" : ""}
                  key={`${option}-${index}`}
                  onClick={() => {
                    setQuizChoice(index);
                    setQuizResult("idle");
                  }}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              ))}
            </div>
            {quizResult !== "idle" ? (
              <p className={`quiz-result is-${quizResult}`}>
                {quizResult === "correct"
                  ? card.quiz.successMessage
                  : card.quiz.retryMessage}
              </p>
            ) : null}
            {quizResult === "correct" ? (
              <button type="button" className="gift-primary-button" onClick={nextStage}>
                打开那封信
              </button>
            ) : (
              <button
                type="button"
                className="gift-primary-button"
                onClick={submitQuiz}
                disabled={quizChoice === null}
              >
                确认答案
              </button>
            )}
          </section>
        ) : null}

        {stage === "letter" ? (
          <section className="gift-stage letter-stage">
            <div className="letter-envelope" aria-hidden="true"><span /></div>
            <article className="letter-paper">
              <p className="letter-salutation">写给 {card.recipientName}：</p>
              {card.letter.map((paragraph, index) => (
                <p key={`${paragraph}-${index}`}>{paragraph}</p>
              ))}
              <p className="letter-signature">—— {card.senderName}</p>
            </article>
            <button type="button" className="gift-primary-button" onClick={nextStage}>
              一起写到未来
            </button>
          </section>
        ) : null}

        {stage === "future" ? (
          <section className="gift-stage future-stage">
            <p className="gift-kicker">TO BE CONTINUED</p>
            <h2>故事写到这里，但并没有结束。</h2>
            {daysTogether ? (
              <div className="relationship-counter">
                <small>从故事开始到今天</small>
                <strong>{daysTogether}</strong>
                <span>天</span>
              </div>
            ) : null}
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
            <button type="button" className="gift-primary-button" onClick={nextStage}>
              {card.surprise?.enabled ? "打开最后的惊喜" : "留下你的回应"}
            </button>
          </section>
        ) : null}

        {stage === "surprise" && card.surprise ? (
          <section className="gift-stage surprise-stage">
            <div className="surprise-box" onAnimationStart={openSurprise}>
              <span className="surprise-ribbon" aria-hidden="true" />
              <p className="gift-kicker">ONE LAST SURPRISE</p>
              <h2>{card.surprise.title}</h2>
              <p>{card.surprise.message}</p>
              {card.surprise.code ? (
                <div className="surprise-code">
                  <small>专属约定码</small>
                  <strong>{card.surprise.code}</strong>
                </div>
              ) : null}
              {card.surprise.buttonUrl ? (
                <a
                  className="gift-primary-button"
                  href={card.surprise.buttonUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={openSurprise}
                >
                  {card.surprise.buttonLabel || "打开惊喜"}
                </a>
              ) : null}
            </div>
            <button type="button" className="gift-primary-button" onClick={nextStage}>
              留下你的回应
            </button>
          </section>
        ) : null}

        {stage === "reply" ? (
          <section className="gift-stage reply-stage">
            <p className="gift-kicker">A NEW PAGE</p>
            <h2>这一页，留给你来继续写。</h2>
            {replySaved ? (
              <div className="reply-success">
                <span>✓</span>
                <h3>你的回应已经留在这段故事里。</h3>
                <p>送礼人会看到你的心情与文字，但不会公开展示。</p>
              </div>
            ) : (
              <div className="reply-card">
                <fieldset className="mood-picker">
                  <legend>打开这份礼物时，你的心情是？</legend>
                  <div>
                    {(Object.keys(replyMoodLabels) as ReplyMood[]).map((mood) => (
                      <button
                        key={mood}
                        type="button"
                        className={replyMood === mood ? "is-selected" : ""}
                        onClick={() => setReplyMood(mood)}
                      >
                        {replyMoodLabels[mood]}
                      </button>
                    ))}
                  </div>
                </fieldset>
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
            {!embedded &&
            onCreateMemoryEntry &&
            onUploadMemoryMedia &&
            onClaimMemorySpace &&
            onRequestInvitePermission &&
            onCreateRecipientInvite ? (
              <RecipientMemorySpace
                slug={card.slug}
                space={memorySpace}
                loading={memorySpaceLoading}
                onCreate={onCreateMemoryEntry}
                onUpload={onUploadMemoryMedia}
                onClaim={onClaimMemorySpace}
                onRequestInvitePermission={onRequestInvitePermission}
                onCreateRecipientInvite={onCreateRecipientInvite}
              />
            ) : null}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setStageIndex(0);
                setMemoryIndex(0);
                setAnswer("");
                setReplySaved(false);
                setQuizChoice(null);
                setQuizResult("idle");
              }}
            >
              重新体验
            </button>
          </section>
        ) : null}
      </main>

      {stageIndex > 0 ? (
        <footer className="gift-stage-footer">
          <button type="button" onClick={previousStage}>← 上一步</button>
          <span>{stageLabels[stage]}</span>
          <button
            type="button"
            onClick={nextStage}
            disabled={stageIndex === stages.length - 1}
          >
            下一步 →
          </button>
        </footer>
      ) : null}
    </article>
  );
}
