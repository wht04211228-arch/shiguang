# 拾光 v0.7 人工付款审核版｜构建与验收报告

生成日期：2026-07-14

## 自动检查

| 检查 | 结果 |
|---|---|
| `npm ci --ignore-scripts` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| `npm audit --omit=dev` | 0 个已知漏洞 |
| 首页 `/` | HTTP 200 |
| 套餐页 `/pricing` | HTTP 200 |
| 订单演示页 `/order/demo?plan=deep` | HTTP 200 |
| 规则页面 | HTTP 200 |
| 未同意条款创建订单 | HTTP 400，符合预期 |
| 本地演示创建订单 | HTTP 200 |
| 未配置云端上传付款凭证 | HTTP 503，符合预期 |

## 生产构建路由

新增或替换的关键路由：

```text
/pay/manual/[id]
/order/[id]/payment-proof
/admin/payments
/api/manual-payments/proof
/api/admin/orders/[id]
/api/checkout
```

Stripe Checkout、Stripe Webhook 与 Stripe npm 依赖已经从运行代码中删除。

## 安全核对

- 付款凭证存放在私有 `payment-proofs` Bucket。
- 商户收款码建议存放在私有 `merchant-assets` Bucket。
- 用户仅有自己凭证记录的读取权限，没有直接写入权限。
- 凭证上传和审核通过服务端 API 完成。
- 管理员凭证预览使用 30 分钟签名地址。
- 商户收款码使用 15 分钟签名地址。
- 同一完整交易单号只能绑定一个订单。
- 人工付款通过数据库函数原子更新凭证和订单。
- 普通管理员订单状态操作不能绕过付款审核。
- 未确认到账时，问卷、素材上传、AI文案和云端发布均保持关闭。

## 尚未执行的真实环境测试

当前环境没有用户的 Supabase 与 Resend 凭据，因此以下项目需要部署后验证：

- 执行 `007_manual_payment_review.sql`
- 私有 Bucket 真实上传与签名预览
- 两个用户账号之间的 RLS 隔离
- 用户提交真实付款凭证
- 管理员通过／驳回
- 原子付款确认函数
- 付款通知邮件
- 真实小额到账核对

上线时按照 `MANUAL_PAYMENT_SETUP.md` 和 `DEPLOYMENT_CHECKLIST.md` 逐项完成。
