"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = { id: string; title: string; status: string; priority: string; assignee?: string | null; due_at?: string | null };

export default function AdminGrowthPanel({
  orderId,
  customerEmail,
  cardSlug,
  latestReview,
  tasks,
}: {
  orderId: string;
  customerEmail: string;
  cardSlug?: string | null;
  latestReview?: { round_no: number; status: string; customer_note?: string | null; admin_note?: string | null } | null;
  tasks: Task[];
}) {
  const router = useRouter();
  const [adminNote, setAdminNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (body: Record<string, unknown>) => {
    setBusy(true); setMessage("正在保存…");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败");
      setMessage("操作已完成"); setTaskTitle(""); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  };

  return (
    <section className="admin-panel growth-admin-panel">
      <p className="landing-kicker">REVIEW & TASKS</p>
      <h2>初稿确认与任务分配</h2>
      <div className="review-admin-summary">
        <strong>{latestReview ? `第 ${latestReview.round_no} 轮 · ${latestReview.status}` : "尚未发起初稿确认"}</strong>
        <small>客户：{customerEmail}</small>
        {latestReview?.customer_note ? <blockquote>{latestReview.customer_note}</blockquote> : null}
      </div>
      <label><span>给客户的初稿说明</span><textarea rows={3} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="例如：已根据问卷整理为 7 幕故事，请重点检查日期、称呼与第三幕照片顺序。" /></label>
      <button className="button-primary" disabled={busy || !cardSlug} onClick={() => void request({ type: "review_request", adminNote })}>{cardSlug ? "发送新一轮初稿确认" : "请先绑定礼物"}</button>

      <div className="task-create-box">
        <h3>新增制作任务</h3>
        <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="例如：整理 12 张照片并统一裁切" />
        <div className="form-grid two"><input value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} placeholder="负责人" /><input type="datetime-local" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></div>
        <button className="button-secondary" disabled={busy || taskTitle.trim().length < 2} onClick={() => void request({ type: "task_create", title: taskTitle, assignee: taskAssignee, dueAt: taskDue })}>添加任务</button>
      </div>
      <div className="task-list">
        {tasks.length ? tasks.map((task) => <article key={task.id}><div><strong>{task.title}</strong><small>{task.assignee || "未分配"}{task.due_at ? ` · ${new Date(task.due_at).toLocaleString("zh-CN")}` : ""}</small></div><select value={task.status} onChange={(event) => void request({ type: "task_update", taskId: task.id, status: event.target.value })}><option value="todo">待处理</option><option value="doing">进行中</option><option value="blocked">受阻</option><option value="done">已完成</option></select></article>) : <p>还没有制作任务。</p>}
      </div>
      {message ? <p className="admin-save-message">{message}</p> : null}
    </section>
  );
}
