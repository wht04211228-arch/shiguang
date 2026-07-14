import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PaymentProofForm from "@/components/PaymentProofForm";
import {
  getManualPaymentConfig,
  manualPaymentStatusName,
  type ManualPaymentProofRow,
} from "@/lib/commerce/manual-payments";
import { getOrderForOwner } from "@/lib/commerce/orders";
import { formatCny, getPlan } from "@/lib/commerce/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "人工付款｜拾光" };

export default async function ManualPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseAdminConfigured()) redirect(`/order/demo?plan=deep&demo=1`);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (!ownerId) redirect(`/login?next=/pay/manual/${id}`);

  const order = await getOrderForOwner(id, ownerId);
  if (!order) notFound();
  if (order.payment_provider !== "manual") redirect(`/order/${id}`);

  const { data: proof } = await supabase
    .from("manual_payment_proofs")
    .select("*")
    .eq("order_id", id)
    .maybeSingle();

  const plan = getPlan(order.plan_id);
  if (!plan) notFound();
  const config = getManualPaymentConfig();
  const admin = createAdminClient();
  let wechatQrUrl = config.wechatQrUrl;
  let alipayQrUrl = config.alipayQrUrl;
  if (config.wechatQrPath) {
    const { data } = await admin.storage.from("merchant-assets").createSignedUrl(config.wechatQrPath, 60 * 15);
    wechatQrUrl = data?.signedUrl || wechatQrUrl;
  }
  if (config.alipayQrPath) {
    const { data } = await admin.storage.from("merchant-assets").createSignedUrl(config.alipayQrPath, 60 * 15);
    alipayQrUrl = data?.signedUrl || alipayQrUrl;
  }
  const paid = ["paid", "in_progress", "fulfilled"].includes(order.status);
  const currentProof = proof as ManualPaymentProofRow | null;

  return (
    <main className="commerce-page manual-payment-page">
      <header className="landing-nav commerce-nav">
        <Link className="landing-brand" href="/"><span>拾</span><div><strong>拾光</strong><small>MANUAL PAYMENT</small></div></Link>
        <nav><Link href={`/order/${id}`}>返回订单</Link><Link href="/legal/refund">退款规则</Link></nav>
      </header>

      <section className="commerce-hero compact manual-payment-hero">
        <p className="landing-kicker">ORDER {id.slice(0, 8).toUpperCase()}</p>
        <h1>{paid ? "付款已确认，制作权限已开通。" : "完成付款后，上传凭证等待人工核对。"}</h1>
        <p>{plan.name} · 应付 {formatCny(order.amount)}。上传截图不会自动开通权限，管理员必须核对真实到账。</p>
      </section>

      <section className="manual-payment-layout">
        <div className="manual-payment-methods">
          <div className="manual-order-summary">
            <p className="landing-kicker">PAYMENT SUMMARY</p>
            <h2>订单付款信息</h2>
            <dl>
              <div><dt>订单编号</dt><dd>{id.toUpperCase()}</dd></div>
              <div><dt>购买套餐</dt><dd>{plan.name}</dd></div>
              <div><dt>应付金额</dt><dd>{formatCny(order.amount)}</dd></div>
              <div><dt>审核状态</dt><dd>{paid ? "已确认到账" : manualPaymentStatusName(currentProof?.review_status)}</dd></div>
            </dl>
          </div>

          {!paid ? (
            <>
              <div className="manual-qr-grid">
                <article>
                  <span>微信</span>
                  <h3>微信人工付款</h3>
                  {wechatQrUrl ? <img src={wechatQrUrl} alt="微信付款二维码" /> : <div className="manual-qr-placeholder">尚未配置微信收款码</div>}
                  <small>付款时请备注订单号后 8 位：{id.slice(-8).toUpperCase()}</small>
                </article>
                <article>
                  <span>支付宝</span>
                  <h3>支付宝人工付款</h3>
                  {alipayQrUrl ? <img src={alipayQrUrl} alt="支付宝付款二维码" /> : <div className="manual-qr-placeholder">尚未配置支付宝收款码</div>}
                  <small>付款后请从账单详情复制完整交易单号。</small>
                </article>
              </div>

              <div className="manual-payment-notice">
                <h3>付款与审核说明</h3>
                <ol>{config.instructions.map((item) => <li key={item}>{item}</li>)}</ol>
                <p><strong>客服联系方式：</strong>{config.customerService}</p>
              </div>
            </>
          ) : (
            <div className="commerce-alert success">付款已经由管理员核对通过。你可以返回订单页填写制作需求。</div>
          )}
        </div>

        <PaymentProofForm
          orderId={id}
          amount={order.amount}
          existing={currentProof ? {
            reviewStatus: currentProof.review_status,
            paymentChannel: currentProof.payment_channel,
            transactionReference: currentProof.transaction_reference,
            paidAt: currentProof.paid_at,
            reviewNote: currentProof.review_note,
          } : null}
        />
      </section>
    </main>
  );
}
