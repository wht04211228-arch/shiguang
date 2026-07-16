import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/brand/SiteHeader";
import { formatCny, getPlan } from "@/lib/commerce/plans";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

type OrderListItem = {
  id: string;
  plan_id: string;
  status: string;
  amount: number;
  payment_provider: string;
  created_at: string;
  cards?: Array<{
    slug: string;
    recipient_name: string;
    status: string;
  }> | null;
};

export const dynamic = "force-dynamic";

export const metadata = { title: "我的订单｜拾光" };

export default async function OrdersPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <main className="card-state-page">
        <section className="card-state-card">
          <span>单</span>
          <h1>当前是本地演示模式</h1>
          <p>配置 Supabase 后，订单会按照登录账号保存并显示在这里。</p>
          <Link className="button-primary" href="/pricing">
            体验套餐流程
          </Link>
        </section>
      </main>
    );
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login?next=/orders");
  const { data, error } = await supabase
    .from("orders")
    .select("*, cards(slug, recipient_name, status)")
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as OrderListItem[];

  return (
    <main className="commerce-page orders-page">
      <SiteHeader active="orders" />
      <section className="commerce-hero compact">
        <p className="landing-kicker">ORDER CENTER</p>
        <h1>我的订单</h1>
        <p>查看付款审核状态、制作进度和对应的专属礼物。</p>
      </section>
      {error ? <div className="commerce-alert">{error.message}</div> : null}
      <section className="order-list">
        {orders.length ? (
          orders.map((order) => {
            const plan = getPlan(order.plan_id);
            const card = Array.isArray(order.cards)
              ? order.cards[0]
              : order.cards;
            return (
              <Link
                className="order-row"
                href={`/order/${order.id}`}
                key={order.id}
              >
                <div>
                  <small>
                    {new Date(order.created_at).toLocaleString("zh-CN")}
                  </small>
                  <h2>{plan?.name ?? order.plan_id}</h2>
                  <p>
                    订单号 {order.id.slice(0, 8)} ·{" "}
                    {order.payment_provider === "demo" ? "演示订单" : order.payment_provider === "manual" ? "人工付款" : order.payment_provider}
                  </p>
                </div>
                <div>
                  <strong>{formatCny(order.amount)}</strong>
                  <span className={`status-pill status-${order.status}`}>
                    {order.status === "paid"
                      ? "已支付"
                      : order.status === "fulfilled"
                        ? "已交付"
                        : order.status}
                  </span>
                  {card ? (
                    <small>礼物：{card.recipient_name}</small>
                  ) : (
                    <small>尚未绑定礼物</small>
                  )}
                </div>
              </Link>
            );
          })
        ) : (
          <section className="empty-order">
            <h2>还没有订单</h2>
            <p>选择一个套餐，完成第一条从购买到交付的完整路径。</p>
            <Link className="landing-primary" href="/pricing">
              查看套餐
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
