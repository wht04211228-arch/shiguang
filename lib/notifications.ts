import { Resend } from "resend";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ] ?? char,
  );
}

export async function sendNotification(input: {
  to: string;
  subject: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_FROM_EMAIL) {
    console.info("[notification:demo]", input.subject, input.to);
    return { demo: true };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const action = input.actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:12px 20px;background:#6b4d3c;color:#fff;text-decoration:none;border-radius:999px">${escapeHtml(input.actionLabel || "查看详情")}</a></p>`
    : "";
  const { data, error } = await resend.emails.send({
    from: process.env.NOTIFICATION_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: `<div style="max-width:560px;margin:auto;padding:32px;font-family:system-ui;color:#292622;background:#fffaf3"><p style="letter-spacing:.16em;color:#9a6c50;font-size:12px">拾光 · PRIVATE MEMORY GIFT</p><h1 style="font-family:serif;font-size:28px">${escapeHtml(input.title)}</h1><p style="line-height:1.8;color:#665e57">${escapeHtml(input.body)}</p>${action}<p style="margin-top:36px;color:#9a9189;font-size:12px">这是一封由拾光系统发送的服务通知。</p></div>`,
  });
  if (error) throw new Error(error.message);
  return data;
}
