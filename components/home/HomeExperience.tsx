"use client";

import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/brand/BrandLogo";

const memories = [
  {
    date: "2023.08",
    title: "第一张合照",
    text: "朋友家的生日聚会上，一张拍立得成为了第一次聊天的理由。",
  },
  {
    date: "18:42 / 18:47",
    title: "同一天的晚霞",
    text: "生活在两座城市，也会认真分享同一片天空的颜色。",
  },
  {
    date: "23 DAYS",
    title: "下一次见面",
    text: "倒计时不是等待的证明，而是我们正在靠近彼此的方式。",
  },
];

export default function HomeExperience() {
  const [memory, setMemory] = useState(0);
  const [soundPrompt, setSoundPrompt] = useState(false);

  return (
    <>
      <section className="v10-hero">
        <div className="v10-hero-copy">
          <p className="v10-kicker">拾光 SHIGUANG · 私人数字纪念礼物</p>
          <h1>
            把那些普通却珍贵的日子，
            <span>重新装订成一份只属于彼此的礼物。</span>
          </h1>
          <p className="v10-subtitle">为重要的人，制作一份可以被打开、聆听和回应的礼物。</p>
          <div className="v10-hero-actions">
            <button className="v10-primary" type="button" onClick={() => setSoundPrompt(true)}>
              体验一份真实样片
            </button>
            <Link className="v10-secondary" href="/create">
              开始制作我的礼物
            </Link>
          </div>
          <p className="v10-trustline">人物与故事均为虚构，正式作品将使用你的真实内容。</p>
        </div>

        <div className="v10-hero-visual" aria-label="梦幻星空官方主样片预览">
          <div className="v10-paper-stage">
            <div className="v10-galaxy-window">
              <div className="v10-nebula" />
              <div className="v10-stars" aria-hidden="true">
                <i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /><i className="s5" />
                <svg viewBox="0 0 500 360" role="presentation">
                  <path d="M86 232 C150 160 216 190 270 110 C326 32 390 98 428 60" />
                </svg>
              </div>
              <div className="v10-demo-heading">
                <small>写给林晚的三周年生日礼物</small>
                <strong>距离之外，我们仍在同一片星空</strong>
              </div>
              <button className="v10-memory-card first" type="button" onClick={() => setMemory(0)}>
                <span>2023.08</span><b>第一张合照</b>
              </button>
              <button className="v10-memory-card second" type="button" onClick={() => setMemory(1)}>
                <span>18:42 / 18:47</span><b>同一天的晚霞</b>
              </button>
              <button className="v10-memory-card third" type="button" onClick={() => setMemory(2)}>
                <span>23 DAYS</span><b>下一次见面</b>
              </button>
            </div>
            <div className="v10-ticket">TWO CITIES · ONE SKY · 2026.08.26</div>
            <div className="v10-memory-note" key={memory}>
              <span>{memories[memory].date}</span>
              <strong>{memories[memory].title}</strong>
              <p>{memories[memory].text}</p>
            </div>
          </div>
        </div>
      </section>

      {soundPrompt ? (
        <div className="v10-modal-backdrop" role="dialog" aria-modal="true" aria-label="选择样片声音">
          <div className="v10-sound-dialog">
            <BrandLogo compact href="/" />
            <p className="v10-kicker">完整体验包含声音</p>
            <h2>是否开启星空氛围音？</h2>
            <p>你可以在样片中随时暂停、关闭声音或切换为自由浏览。</p>
            <div>
              <Link className="v10-primary" href="/demo/galaxy?sound=on">开启声音进入</Link>
              <Link className="v10-secondary" href="/demo/galaxy?sound=off">静音进入</Link>
            </div>
            <button className="v10-text-button" type="button" onClick={() => setSoundPrompt(false)}>暂不体验</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
