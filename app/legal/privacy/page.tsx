import LegalPage from "@/components/LegalPage";
export const metadata = { title: "隐私说明｜拾光" };
export default function PrivacyPage() {
  return <LegalPage eyebrow="PRIVACY NOTICE" title="隐私与素材处理说明" updated="2026年7月13日">
    <section><h2>1. 收集的信息</h2><p>为完成订单，我们可能处理账号邮箱、订单信息、制作问卷、上传素材、专属链接访问次数和收件人主动提交的回复。</p></section>
    <section><h2>2. 使用目的</h2><p>信息仅用于账号登录、支付履约、礼物制作、内容托管、售后支持、安全防护和匿名化转化分析。</p></section>
    <section><h2>3. 素材安全</h2><p>云端素材默认存放在私有存储中，通过短时签名地址访问。解锁答案以加盐哈希保存，服务端不会以明文存储答案。</p></section>
    <section><h2>4. 第三方服务</h2><p>根据配置，支付、数据库、邮件、AI文案与部署可能由 Stripe、Supabase、Resend、OpenAI 和 Vercel 等服务商处理。正式上线时应在此列明实际启用的供应商与地区。</p></section>
    <section><h2>5. AI处理</h2><p>仅在用户主动使用AI文案辅助时，将必要的文字事实发送给所配置的模型服务。避免把身份证件、账号密码、医疗记录等高度敏感信息写入提示。</p></section>
    <section><h2>6. 保留与删除</h2><p>订单和财务记录按经营与合规需要保留；礼物内容按照套餐保存周期处理。用户可申请删除非必要素材，但已发生的支付与审计记录可能依法保留。</p></section>
    <section><h2>7. 收件人权利</h2><p>收件人可以选择不回复，并可联系购买者或平台申请停止展示涉及自己的内容。平台会在核实身份和权利后处理。</p></section>
  </LegalPage>;
}
