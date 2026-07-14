import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminOrderPanel from "@/components/AdminOrderPanel";
import AdminManualPaymentPanel from "@/components/AdminManualPaymentPanel";
import AdminGrowthPanel from "@/components/AdminGrowthPanel";
import AdminFeedbackModeration from "@/components/AdminFeedbackModeration";
import { requireAdminClaims } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { formatCny, getPlan } from "@/lib/commerce/plans";

export const metadata = { title: "运营订单｜拾光" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseAdminConfigured()) notFound();
  const { claims, configured, email } = await requireAdminClaims();
  if (!configured) notFound();
  if (!claims && !email) redirect(`/login?next=/admin/order/${id}`);
  if (!claims) return <main className="card-state-page"><section className="card-state-card"><span>×</span><h1>没有运营后台权限</h1><p>当前登录账号不在管理员白名单中。</p><Link className="button-primary" href="/">返回首页</Link></section></main>;
  const admin = createAdminClient();
  const [{ data: order }, { data: brief }, { data: refunds }, { data: events }, { data: reviews }, { data: tasks }, { data: customerReview }, { data: casePermission }, { data: manualProof }] = await Promise.all([
    admin.from("orders").select("*,cards(slug,recipient_name,status,view_count,reply_count)").eq("id", id).maybeSingle(),
    admin.from("order_briefs").select("*").eq("order_id", id).maybeSingle(),
    admin.from("refund_requests").select("*").eq("order_id", id).order("created_at", { ascending: false }).limit(1),
    admin.from("order_events").select("event_type,payload,created_at").eq("order_id", id).order("created_at", { ascending: false }).limit(30),
    admin.from("order_reviews").select("round_no,status,customer_note,admin_note,created_at").eq("order_id", id).order("round_no", { ascending: false }).limit(10),
    admin.from("production_tasks").select("id,title,status,priority,assignee,due_at").eq("order_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    admin.from("customer_reviews").select("id,rating,testimonial,display_name,public_consent,status").eq("order_id", id).maybeSingle(),
    admin.from("case_permissions").select("allow_anonymous_case,allow_quote,allow_media,public_alias,granted_at,revoked_at").eq("order_id", id).maybeSingle(),
    admin.from("manual_payment_proofs").select("id,payment_channel,amount,transaction_reference,paid_at,review_status,review_note,proof_path").eq("order_id", id).maybeSingle(),
  ]);
  if (!order) notFound();
  const plan = getPlan(order.plan_id);
  const refund = refunds?.[0];
  const cards = Array.isArray(order.cards) ? order.cards : order.cards ? [order.cards] : [];
  const card = cards[0];
  const dueLocal = order.due_at ? new Date(order.due_at).toISOString().slice(0, 16) : "";
  const latestReview = reviews?.[0] ?? null;
  let manualProofUrl: string | null = null;
  if (manualProof?.proof_path) {
    const { data: signed } = await admin.storage.from("payment-proofs").createSignedUrl(manualProof.proof_path, 60 * 30);
    manualProofUrl = signed?.signedUrl || null;
  }

  return (
    <main className="commerce-page admin-order-detail">
      <header className="landing-nav commerce-nav"><Link className="landing-brand" href="/admin"><span>拾</span><div><strong>运营后台</strong><small>ORDER WORKSPACE</small></div></Link><nav><Link href="/admin">返回队列</Link>{card ? <Link href={`/card/${card.slug}`}>打开礼物</Link> : null}</nav></header>
      <section className="admin-order-header"><div><p className="landing-kicker">ORDER {id.slice(0, 8).toUpperCase()}</p><h1>{order.customer_name || order.customer_email}</h1><p>{plan?.name} · {formatCny(order.amount)} · {order.customer_email}</p></div><span className={`status-pill status-${order.status}`}>{order.status}</span></section>
      <section className="admin-workspace-grid">
        <div>
          <section className="admin-panel brief-review"><p className="landing-kicker">CUSTOMER BRIEF</p><h2>{brief ? `${brief.recipient_name} · ${brief.occasion}` : "客户尚未提交问卷"}</h2>{brief ? <><dl><div><dt>关系</dt><dd>{brief.relationship}</dd></div><div><dt>风格</dt><dd>{brief.preferred_theme} / {brief.tone}</dd></div><div><dt>交付日期</dt><dd>{brief.delivery_date || "未指定"}</dd></div><div><dt>联系方式</dt><dd>{brief.contact_method || "未填写"}</dd></div></dl><h3>真实回忆</h3><ol>{(Array.isArray(brief.story_facts) ? brief.story_facts : []).map((fact: string) => <li key={fact}>{fact}</li>)}</ol><h3>必须包含</h3><p>{brief.must_include || "无"}</p><h3>避免内容</h3><p>{brief.avoid_content || "无"}</p><h3>特殊要求</h3><p>{brief.special_requests || "无"}</p></> : <p>订单页会引导用户填写关系、场景、回忆、禁忌与交付偏好。</p>}</section>
          <section className="admin-panel event-timeline"><p className="landing-kicker">AUDIT TRAIL</p><h2>订单事件</h2>{events?.map((event, index) => <article key={`${event.created_at}-${index}`}><span /><div><strong>{event.event_type}</strong><small>{new Date(event.created_at).toLocaleString("zh-CN")}</small></div></article>)}</section>
        </div>
        <div className="admin-panels">
          <AdminManualPaymentPanel orderId={id} proof={manualProof ? { id: manualProof.id, paymentChannel: manualProof.payment_channel, amount: manualProof.amount, transactionReference: manualProof.transaction_reference, paidAt: manualProof.paid_at, reviewStatus: manualProof.review_status, reviewNote: manualProof.review_note, proofUrl: manualProofUrl } : null} />
          <AdminOrderPanel orderId={id} initial={{ status: order.status, serviceStage: order.service_stage || "waiting_brief", priority: order.priority || "normal", dueAt: dueLocal, assignee: order.assignee || "", internalNotes: order.internal_notes || "" }} refund={refund ? { id: refund.id, status: refund.status, reason: refund.reason, adminResponse: refund.admin_response || "" } : null} />
          <AdminGrowthPanel orderId={id} customerEmail={order.customer_email} cardSlug={card?.slug || null} latestReview={latestReview ? { round_no: latestReview.round_no, status: latestReview.status, customer_note: latestReview.customer_note, admin_note: latestReview.admin_note } : null} tasks={tasks ?? []} />
          <AdminFeedbackModeration
            orderId={id}
            review={customerReview ? {
              id: customerReview.id,
              rating: customerReview.rating,
              testimonial: customerReview.testimonial,
              displayName: customerReview.display_name,
              publicConsent: customerReview.public_consent,
              status: customerReview.status,
            } : null}
            permission={casePermission ? {
              allowAnonymousCase: casePermission.allow_anonymous_case,
              allowQuote: casePermission.allow_quote,
              allowMedia: casePermission.allow_media,
              publicAlias: casePermission.public_alias,
            } : null}
          />
        </div>
      </section>
    </main>
  );
}
