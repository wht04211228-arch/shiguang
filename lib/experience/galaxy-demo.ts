export type DemoScene = {
  id: string;
  eyebrow: string;
  title: string;
  body: string[];
  duration: number;
  details?: string[];
};

export const galaxyDemo = {
  title: "距离之外，我们仍在同一片星空",
  subtitle: "写给林晚的三周年生日礼物",
  creator: "陈默",
  recipient: "林晚",
  unlockQuestion: "我们第一次因为哪一件事聊了很久？",
  unlockAnswer: "一部都喜欢的电影",
  acceptedAnswers: ["一部都喜欢的电影", "同一部电影", "喜欢的电影", "电影"],
  starName: "第1095号星",
  starCopy: "代表我们认真分享生活的第1095个普通日夜。",
  scenes: [
    {
      id: "prologue",
      eyebrow: "PROLOGUE",
      title: "有些距离，只是地图上的两座城市。",
      body: ["而有些陪伴，从来没有被距离真正隔开。"],
      duration: 6,
    },
    {
      id: "constellation",
      eyebrow: "OUR CONSTELLATION",
      title: "三个日期，连成只属于我们的星座。",
      body: ["2023.08 · 朋友家的生日聚会", "2026.08.12 · 我们认真相爱的第三年", "2026.08.26 · 属于你的生日星光"],
      duration: 8,
    },
    {
      id: "meeting",
      eyebrow: "CHAPTER 01",
      title: "故事从一次普通的朋友聚会开始",
      body: [
        "那天朋友拿出拍立得，让大家站在一起合照。",
        "聚会结束后，我以询问照片为理由给你发了第一条消息。",
        "我们聊到一部都很喜欢的电影，也从那天开始，有了很多没有真正结束的话题。",
      ],
      duration: 15,
      details: ["暖黄色客厅灯光", "第一张拍立得合照", "第一次主动发出的消息"],
    },
    {
      id: "cities",
      eyebrow: "CHAPTER 02",
      title: "后来，我们的日常发生在两座城市",
      body: [
        "我们会分享同一天看到的晚霞，也会在视频通话里同时按下电影的播放键。",
        "距离没有让生活停止被分享，反而让普通的小事，都变成值得保存的回忆。",
      ],
      duration: 18,
      details: ["18:42 · 她的城市", "18:47 · 他的城市", "距离下一次见面还有 23 天"],
    },
    {
      id: "reunion",
      eyebrow: "CHAPTER 03",
      title: "每一次靠近，都有一张车票",
      body: [
        "我们记得车次、站台和出口的位置，也记得见面以前一次又一次确认：到了吗？还有几站？",
        "一张普通的车票，不只是一段路程，也是我正在认真靠近你的证明。",
      ],
      duration: 15,
      details: ["站台", "行李箱", "出口旁的等待"],
    },
    {
      id: "letter",
      eyebrow: "A LETTER FOR YOU",
      title: "给林晚",
      body: [
        "三年以前，我没有想过，一个人会慢慢成为我每天最想分享生活的人。",
        "我们隔着两座城市，有时只能在很短的通话里说一句晚安，可是你从来没有真正缺席过我的生活。",
        "生日快乐。谢谢你和我一起，把散落在不同城市里的日子，连成了属于我们的星空。",
      ],
      duration: 18,
    },
    {
      id: "future",
      eyebrow: "TO BE CONTINUED",
      title: "下一次见面，我们一起去看海",
      body: ["我们正在努力的未来：生活在同一座城市。", "一个小小的生活愿望：在普通的家里一起养一只猫。"],
      duration: 10,
      details: ["第1095号星", "记录认真分享生活的第1095个普通日夜"],
    },
  ] satisfies DemoScene[],
  demoAnswers: {
    relationship: "恋人，目前处于异地状态",
    occasion: "恋爱三周年，同时也是她的生日",
    emotions: ["浪漫", "被理解", "对未来的期待"],
    story:
      "我们生活在两座城市，会分享同一天的晚霞，一起远程看电影，也会记录距离下一次见面还有多少天。",
  },
};
