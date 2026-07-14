import Link from "next/link";
import { redirect } from "next/navigation";
import { createStripeClient } from "@/lib/payments/stripe";

export const metadata = { title: "支付成功｜拾光" };

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) redirect("/orders");
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const orderId = session.metadata?.orderId || session.client_reference_id;
  return (
    <main className="card-state-page">
      <section className="card-state-card">
        <span>✓</span>
        <p className="landing-kicker">PAYMENT RECEIVED</p>
        <h1>支付已经完成</h1>
        <p>
          系统正在通过支付回调确认订单权益。通常刷新订单页即可看到“已支付”状态。
        </p>
        <div className="order-actions">
          {orderId ? (
            <Link className="button-primary" href={`/order/${orderId}`}>
              查看订单
            </Link>
          ) : (
            <Link className="button-primary" href="/orders">
              查看全部订单
            </Link>
          )}
          <Link className="button-secondary" href="/studio">
            进入制作台
          </Link>
        </div>
      </section>
    </main>
  );
}
