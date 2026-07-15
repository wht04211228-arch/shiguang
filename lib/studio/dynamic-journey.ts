import type { CardData } from "@/lib/card-data";
import type { CollaborationSpaceSummary } from "@/lib/collaboration/types";
import type { StudioMetric } from "@/lib/studio/readiness";

export type StudioPanel =
  | "basic"
  | "theme"
  | "memories"
  | "letter"
  | "collaboration"
  | "media"
  | "future"
  | "experience"
  | "publish";

export type StudioFeatureKey =
  | "purpose"
  | "theme"
  | "cover"
  | "memories"
  | "letter"
  | "collaboration"
  | "media"
  | "future"
  | "surprise"
  | "timing"
  | "publish";

export type JourneyTaskState = "done" | "active" | "waiting" | "optional";

export type JourneyAction =
  | { type: "feature"; feature: StudioFeatureKey }
  | { type: "simulation" }
  | { type: "publish" }
  | { type: "delivery" }
  | { type: "test-published" }
  | { type: "replies" }
  | { type: "insights" };

export type DynamicJourneyTask = {
  key: string;
  label: string;
  hint: string;
  reason: string;
  estimate: string;
  outcome: string;
  cta: string;
  state: JourneyTaskState;
  required: boolean;
  action: JourneyAction;
};

export type DynamicJourney = {
  phase: "making" | "delivery";
  phaseLabel: string;
  tasks: DynamicJourneyTask[];
  primary: DynamicJourneyTask;
  alternatives: DynamicJourneyTask[];
};

export const studioFeatures: Array<{
  key: StudioFeatureKey;
  panel: StudioPanel;
  label: string;
  hint: string;
}> = [
  { key: "purpose", panel: "basic", label: "用途与人物", hint: "确认送给谁、为什么送" },
  { key: "theme", panel: "theme", label: "视觉主题", hint: "选择礼物的表达气质" },
  { key: "cover", panel: "basic", label: "封面与解锁", hint: "设置第一眼和私密入口" },
  { key: "memories", panel: "memories", label: "回忆故事", hint: "整理照片、日期和真实细节" },
  { key: "letter", panel: "letter", label: "专属信件", hint: "写下真正想说的话" },
  { key: "collaboration", panel: "collaboration", label: "多人共创", hint: "邀请朋友秘密留下祝福" },
  { key: "media", panel: "media", label: "声音与视频", hint: "加入更真实的声音表达" },
  { key: "future", panel: "future", label: "未来约定", hint: "留下可以再次回来的理由" },
  { key: "surprise", panel: "experience", label: "互动与惊喜", hint: "设置问答、彩蛋与惊喜" },
  { key: "timing", panel: "experience", label: "开放时间", hint: "确认何时开启和保存多久" },
  { key: "publish", panel: "publish", label: "预览与发布", hint: "完成最后检查并正式送达" },
];

function checklistDone(readiness: StudioMetric, key: string) {
  return Boolean(readiness.checklist.find((item) => item.key === key)?.done);
}

function task(
  value: Omit<DynamicJourneyTask, "state"> & { state?: JourneyTaskState },
): DynamicJourneyTask {
  return { ...value, state: value.state ?? "active" };
}

export function buildDynamicJourney(input: {
  card: CardData;
  readiness: StudioMetric;
  plan?: {
    id: string;
    name: string;
    videoCount: number;
    inviteLimit: number;
  } | null;
  collaboration?: CollaborationSpaceSummary | null;
  isPublished: boolean;
  replyCount: number;
  simulationCompleted: boolean;
  publishedTested: boolean;
  deliveryCenterVisited: boolean;
  hasStoredAnswer: boolean;
  hasBrief: boolean;
}): DynamicJourney {
  const {
    card,
    readiness,
    plan,
    collaboration,
    isPublished,
    replyCount,
    simulationCompleted,
    publishedTested,
    deliveryCenterVisited,
    hasStoredAnswer,
    hasBrief,
  } = input;

  if (isPublished) {
    const targetContributionCount = Math.min(3, plan?.inviteLimit ?? 0);
    const collaborationEnough =
      !targetContributionCount ||
      (collaboration?.approvedCount ?? 0) >= targetContributionCount;

    const tasks: DynamicJourneyTask[] = [
      task({
        key: "test-published",
        label: "检查正式礼物",
        hint: "用真实专属链接完整打开一次",
        reason: "正式页面与制作台预览的网络、解锁和媒体加载环境不同，发送前应再确认一次。",
        estimate: "约 3 分钟",
        outcome: "确认收件人收到的页面可以正常打开和观看。",
        cta: publishedTested ? "再次检查正式礼物" : "现在检查正式礼物",
        state: publishedTested ? "done" : "active",
        required: true,
        action: { type: "test-published" },
      }),
      task({
        key: "delivery",
        label: "获取并发送专属链接",
        hint: "礼物链接发给收件人，共创链接发给朋友",
        reason: "交付中心已经准备好链接、二维码和可直接复制的发送话术。",
        estimate: "约 1 分钟",
        outcome: "把正确的链接发送给正确的人。",
        cta: deliveryCenterVisited ? "再次打开交付中心" : "打开交付中心",
        state: deliveryCenterVisited ? "done" : "active",
        required: true,
        action: { type: "delivery" },
      }),
    ];

    if ((plan?.inviteLimit ?? 0) > 0) {
      tasks.push(
        task({
          key: "post-collaboration",
          label: collaborationEnough ? "共创内容已经达到建议数量" : "继续收集朋友祝福",
          hint: collaboration
            ? `已确认 ${collaboration.approvedCount}/${targetContributionCount || plan?.inviteLimit || 0} 份建议投稿`
            : "共创空间尚未建立",
          reason: collaborationEnough
            ? "已经有足够的共同祝福，可以继续关注收件人的反馈。"
            : "礼物已经发布，但仍可以邀请朋友补充内容并更新正式版本。",
          estimate: collaborationEnough ? "已完成" : "等待朋友参与",
          outcome: "让礼物拥有不止一个人的真实声音。",
          cta: "查看共创进度",
          state: collaborationEnough
            ? "done"
            : collaboration?.openedCount
              ? "waiting"
              : "active",
          required: false,
          action: { type: "feature", feature: "collaboration" },
        }),
      );
    }

    tasks.push(
      task({
        key: "responses",
        label: replyCount > 0 ? `查看 ${replyCount} 条收件人回复` : "等待收件人打开并回应",
        hint: replyCount > 0 ? "对方已经留下新的内容" : "系统会在收到回复后提醒你",
        reason: replyCount > 0
          ? "及时查看回应，决定是否继续补充共同纪念空间。"
          : "礼物交付后不需要一直停留在页面，可以先完成其他礼物或等待通知。",
        estimate: replyCount > 0 ? "约 1 分钟" : "等待中",
        outcome: "了解收件人的真实感受和后续互动。",
        cta: replyCount > 0 ? "查看回复" : "查看回复状态",
        state: replyCount > 0 ? "active" : "waiting",
        required: false,
        action: { type: "replies" },
      }),
      task({
        key: "insights",
        label: "查看礼物体验数据",
        hint: "了解打开、解锁和完整观看情况",
        reason: "体验数据可以帮助判断礼物是否顺利送达，但不会影响收件人的观看。",
        estimate: "约 1 分钟",
        outcome: "快速发现是否有人打开，以及在哪一幕停留。",
        cta: "查看体验数据",
        state: "optional",
        required: false,
        action: { type: "insights" },
      }),
    );

    const requiredUndone = tasks.find((item) => item.required && item.state !== "done");
    const actionable = tasks.find((item) => item.state === "active");
    const waiting = tasks.find((item) => item.state === "waiting");
    const primary = requiredUndone ?? actionable ?? waiting ?? tasks[0];
    const alternatives = tasks
      .filter((item) => item.key !== primary.key && item.state !== "done")
      .sort((a, b) => {
        const rank = { active: 0, optional: 1, waiting: 2, done: 3 } as const;
        return rank[a.state] - rank[b.state];
      })
      .slice(0, 2);

    return {
      phase: "delivery",
      phaseLabel: "交付与回应",
      tasks,
      primary,
      alternatives,
    };
  }

  const peopleDone = checklistDone(readiness, "people");
  const occasionDone = checklistDone(readiness, "occasion");
  const coverDone = checklistDone(readiness, "cover");
  const unlockDone = checklistDone(readiness, "unlock") || hasStoredAnswer;
  const memoriesDone = checklistDone(readiness, "memories");
  const letterDone = checklistDone(readiness, "letter");
  const futureDone = checklistDone(readiness, "future");
  const coreDone = peopleDone && occasionDone && coverDone && unlockDone;
  const collaborationTarget = Math.min(3, plan?.inviteLimit ?? 0);
  const collaborationEnough =
    !collaborationTarget ||
    (collaboration?.approvedCount ?? 0) >= collaborationTarget;
  const hasMedia = Boolean(card.musicUrl || card.musicPath);
  const hasSurprise = Boolean(card.quiz?.enabled || card.surprise?.enabled);
  const timingConfirmed = Boolean(card.releaseAt || card.expiresAt);

  const tasks: DynamicJourneyTask[] = [
    task({
      key: "confirm",
      label: hasBrief ? "检查自动导入的制作需求" : "填写礼物用途与人物",
      hint: coreDone ? "人物、场景、封面和解锁方式已经确认" : "先确认收件人、场景、封面和解锁方式",
      reason: hasBrief
        ? "问卷内容已经自动带入制作台，确认无误后再继续整理故事。"
        : "这些信息决定礼物封面、称呼和后续内容的表达方式。",
      estimate: coreDone ? "已完成" : "约 3 分钟",
      outcome: "让后续故事、信件和专属页面使用正确的信息。",
      cta: coreDone ? "再次检查基础内容" : "检查制作需求",
      state: coreDone ? "done" : "active",
      required: true,
      action: { type: "feature", feature: "purpose" },
    }),
  ];

  if (!plan || plan.id !== "light") {
    tasks.push(
      task({
        key: "theme",
        label: "确认视觉主题",
        hint: card.theme === "film" ? "当前为温暖胶片" : card.theme === "cinema" ? "当前为电影浪漫" : "当前为梦幻星空",
        reason: "主题已经有默认值，只需确认它是否符合这份礼物的关系与气质。",
        estimate: "约 1 分钟",
        outcome: "统一整份礼物的颜色、排版和转场气质。",
        cta: "查看视觉主题",
        state: "done",
        required: false,
        action: { type: "feature", feature: "theme" },
      }),
    );
  }

  tasks.push(
    task({
      key: "memories",
      label: "整理真实回忆",
      hint: memoriesDone ? `${card.memories.length} 段回忆已经达到发布建议` : "至少准备 3 段有具体细节的回忆",
      reason: "真实细节是这份礼物区别于普通模板的核心。",
      estimate: memoriesDone ? "已完成" : "约 8 分钟",
      outcome: "让收件人看到只有你们才拥有的共同故事。",
      cta: memoriesDone ? "继续完善回忆" : "现在整理回忆",
      state: memoriesDone ? "done" : "active",
      required: true,
      action: { type: "feature", feature: "memories" },
    }),
    task({
      key: "letter",
      label: "完善专属信件",
      hint: letterDone ? "信件已经包含足够的真实表达" : "把想说却不容易当面说的话写下来",
      reason: "信件负责把前面的回忆收束成明确的情感表达。",
      estimate: letterDone ? "已完成" : "约 5 分钟",
      outcome: "让礼物在结尾真正说清楚你想表达的内容。",
      cta: letterDone ? "继续润色信件" : "现在完善信件",
      state: letterDone ? "done" : "active",
      required: true,
      action: { type: "feature", feature: "letter" },
    }),
  );

  if ((plan?.inviteLimit ?? 0) > 0) {
    const state: JourneyTaskState = collaborationEnough
      ? "done"
      : collaboration?.openedCount
        ? "waiting"
        : "active";
    tasks.push(
      task({
        key: "collaboration",
        label: collaborationEnough ? "朋友祝福已经达到建议数量" : collaboration?.contributionCount ? "审核朋友提交的祝福" : collaboration?.openedCount ? "等待朋友提交祝福" : "邀请朋友一起准备",
        hint: collaboration
          ? `已打开 ${collaboration.openedCount} 人 · 已投稿 ${collaboration.contributionCount} 份 · 已确认 ${collaboration.approvedCount} 份`
          : `当前共创额度 ${plan?.inviteLimit ?? 0} 人`,
        reason: state === "waiting"
          ? "朋友正在准备内容，你不需要停在这里，可以同时完成信件、音乐或开放时间。"
          : "多人真实祝福会让礼物更有层次，但不会阻止你继续制作其他部分。",
        estimate: state === "waiting" ? "等待中" : collaborationEnough ? "已完成" : "约 2 分钟发出邀请",
        outcome: "让礼物汇集来自不同人的真实回忆和声音。",
        cta: state === "waiting" ? "查看共创进度" : collaborationEnough ? "管理共创内容" : "生成邀请链接",
        state,
        required: false,
        action: { type: "feature", feature: "collaboration" },
      }),
    );
  }

  if (!plan || plan.videoCount > 0 || hasMedia) {
    tasks.push(
      task({
        key: "media",
        label: hasMedia ? "声音内容已经加入" : "添加声音或视频",
        hint: plan?.videoCount ? `当前可使用 ${plan.videoCount} 段视频` : "加入一段真实声音会更有温度",
        reason: "声音与视频是可选增强项，不会阻止发布，但能明显提升真实感。",
        estimate: hasMedia ? "已完成" : "约 3 分钟",
        outcome: "让收件人听到真实的语气，而不只是阅读文字。",
        cta: hasMedia ? "管理声音内容" : "添加声音与视频",
        state: hasMedia ? "done" : "optional",
        required: false,
        action: { type: "feature", feature: "media" },
      }),
    );
  }

  tasks.push(
    task({
      key: "future",
      label: futureDone ? "未来约定已经准备好" : "留下一些未来约定",
      hint: futureDone ? "结尾已经有继续回来的理由" : "至少写下 2 件以后想一起完成的事",
      reason: "未来约定能让礼物不只停留在回忆，也指向之后的共同生活。",
      estimate: futureDone ? "已完成" : "约 3 分钟",
      outcome: "形成温柔、向前的结尾。",
      cta: futureDone ? "继续完善未来约定" : "添加未来约定",
      state: futureDone ? "done" : "optional",
      required: false,
      action: { type: "feature", feature: "future" },
    }),
  );

  if (!plan || plan.id !== "light" || hasSurprise) {
    tasks.push(
      task({
        key: "surprise",
        label: hasSurprise ? "互动与惊喜已经设置" : "设计一个隐藏惊喜",
        hint: hasSurprise ? "问答或彩蛋会成为观看中的情绪转折" : "可以加入问答、约定码或隐藏链接",
        reason: "这是可选增强项，适合在信件之后形成一次小高潮。",
        estimate: hasSurprise ? "已完成" : "约 3 分钟",
        outcome: "让收件人在观看过程中获得一次意外惊喜。",
        cta: hasSurprise ? "管理互动与惊喜" : "添加隐藏惊喜",
        state: hasSurprise ? "done" : "optional",
        required: false,
        action: { type: "feature", feature: "surprise" },
      }),
    );
  }

  tasks.push(
    task({
      key: "timing",
      label: timingConfirmed ? "开放规则已经设置" : "确认礼物开放方式",
      hint: timingConfirmed ? "定时开放或展示期限已经保存" : "可以立即开放，也可以设置倒计时",
      reason: "开放时间不是强制项，但发布前需要确认收件人什么时候能够看到。",
      estimate: timingConfirmed ? "已完成" : "约 1 分钟",
      outcome: "避免礼物提前被打开，或在错误时间失效。",
      cta: timingConfirmed ? "检查开放规则" : "确认开放方式",
      state: timingConfirmed ? "done" : "optional",
      required: false,
      action: { type: "feature", feature: "timing" },
    }),
    task({
      key: "simulation",
      label: simulationCompleted ? "收件人视角模拟已经完成" : "以收件人视角完整体验一次",
      hint: simulationCompleted ? "已经检查手机端观看流程" : "隐藏制作工具，按真实顺序体验礼物",
      reason: "发布前模拟能发现文字过长、媒体加载和观看节奏等问题。",
      estimate: simulationCompleted ? "已完成" : "约 4 分钟",
      outcome: "确认收件人能够顺利打开、观看和回应。",
      cta: simulationCompleted ? "再次进行收件人模拟" : "开始收件人视角模拟",
      state: simulationCompleted ? "done" : "active",
      required: true,
      action: { type: "simulation" },
    }),
    task({
      key: "publish",
      label: "正式发布礼物",
      hint: `当前制作完成度 ${readiness.score}%`,
      reason: readiness.score >= 55
        ? "核心内容已经达到发布条件，发布后系统会自动准备专属链接和二维码。"
        : "仍有关键内容未完成，先处理主推荐任务再发布。",
      estimate: "约 1 分钟",
      outcome: "生成可跨设备打开的正式礼物和交付中心。",
      cta: readiness.score >= 55 ? "进入发布检查" : "查看未完成内容",
      state: "active",
      required: true,
      action: { type: "publish" },
    }),
  );

  const requiredOrder = ["confirm", "memories", "letter", "simulation", "publish"];
  const requiredUndone = requiredOrder
    .map((key) => tasks.find((item) => item.key === key))
    .find((item) => item && item.state !== "done");
  const primary = requiredUndone ?? tasks.find((item) => item.state === "active") ?? tasks[0];

  const coreTasksComplete = coreDone && memoriesDone && letterDone;
  const alternativeCandidates = tasks
    .filter((item) => {
      if (item.key === primary.key || item.state === "done") return false;
      if (!coreTasksComplete && ["simulation", "publish"].includes(item.key)) return false;
      return true;
    })
    .sort((a, b) => {
      const rank = { active: 0, optional: 1, waiting: 2, done: 3 } as const;
      const stateDifference = rank[a.state] - rank[b.state];
      if (stateDifference) return stateDifference;
      return Number(b.required) - Number(a.required);
    });

  return {
    phase: "making",
    phaseLabel: "动态制作旅程",
    tasks,
    primary,
    alternatives: alternativeCandidates.slice(0, 2),
  };
}
