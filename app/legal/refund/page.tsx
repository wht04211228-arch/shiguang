import LegalPage from "@/components/LegalPage";
export const metadata = { title: "退款规则｜拾光" };
export default function RefundPage() {
  return <LegalPage eyebrow="REFUND POLICY" title="退款与售后规则" updated="2026年7月14日">
    <section><h2>1. 尚未开始制作</h2><p>订单支付后，如尚未提交制作需求、未使用AI额度且未产生人工沟通或策划工作，可申请全额退款；支付渠道收取且无法退回的手续费除外。</p></section>
    <section><h2>2. 已提交资料或开始策划</h2><p>需求问卷提交、文案整理、素材处理或页面制作开始后，退款将扣除已经发生的服务成本。具体金额根据套餐、已完成阶段和已交付成果审核。</p></section>
    <section><h2>3. 已交付数字内容</h2><p>专属链接已正式发布或可下载成果已经交付后，原则上不支持因个人偏好变化申请全额退款。若平台未按订单权益提供核心功能，应优先修复；无法修复时再协商部分或全部退款。</p></section>
    <section><h2>4. 不属于质量问题的情况</h2><p>用户提供错误资料、低清晰度素材、未及时反馈、收件人不喜欢某种主观表达、第三方设备或网络异常，不当然构成平台质量问题。</p></section>
    <section><h2>5. 申请方式</h2><p>在订单详情页提交原因，说明是否已经提交资料、收到初稿或完成发布。审核结果会通过订单邮箱和订单页面反馈。</p></section>
    <section><h2>6. 退款到账</h2><p>批准后由管理员在原人工收款渠道中核对并执行退款，退款结果、金额与时间会记录在订单页面。实际到账时间由微信、支付宝或相关收款渠道决定。</p></section>
  </LegalPage>;
}
