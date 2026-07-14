# Changelog

## 0.7.0 — 2026-07-14

### Added

- 人工付款说明页 `/pay/manual/[id]`
- 付款凭证提交 API
- 私有 `payment-proofs` Bucket
- `manual_payment_proofs` 数据表
- 管理员付款审核队列 `/admin/payments`
- 管理员付款审核面板
- 通过、驳回和重新提交流程
- 付款审核邮件通知
- 原子数据库函数 `approve_manual_payment`

### Changed

- 套餐结账改为创建人工付款订单
- 付款确认后才开放问卷、AI、素材上传和制作发布
- 隐私、服务和退款文本改为人工付款模式
- 首页与套餐页移除 Stripe 文案

### Removed

- Stripe Checkout 创建逻辑
- Stripe Webhook 路由
- Stripe npm 依赖
- OpenAI npm 依赖（DeepSeek 使用原生 fetch）

### Security

- 付款截图不公开
- 用户不能直接写付款审核表
- 同一交易单号全局唯一
- 管理员不能通过普通状态编辑绕过付款审核
