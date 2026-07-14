# 拾光 v0.7｜人工付款审核版

这是面向没有微信支付／支付宝商户号的早期售卖版本。项目不再创建 Stripe 收银台，而是使用“创建订单 → 人工付款 → 上传凭证 → 管理员核对真实到账 → 开通制作权限”的流程。

## 核心流程

```text
选择套餐
→ 登录并创建待付款订单
→ 查看微信／支付宝人工付款说明
→ 上传付款截图和完整交易单号
→ 管理员在真实收款记录中核对
→ 通过后订单变为已支付
→ 开放需求问卷、素材上传、DeepSeek 文案和制作台
→ 初稿确认、交付、评价与推荐
```

付款截图不会自动判定订单已支付。管理员必须核对真实到账金额、时间和交易单号。

## v0.7 新增

- `/pay/manual/[id]` 人工付款说明与凭证提交页
- `/order/[id]/payment-proof` 兼容跳转地址
- `/admin/payments` 付款凭证审核队列
- 私有 `payment-proofs` Storage Bucket
- 完整交易单号重复校验
- 管理员通过／驳回与邮件通知
- 付款审核原子数据库函数，避免订单与凭证状态不一致
- 未确认到账时禁止问卷、素材上传、AI额度、发布和制作台订单入口
- 管理员不能绕过付款审核直接把人工付款订单改为已支付
- 删除 Stripe 运行依赖和 Webhook 路由

## 运行环境

- Next.js 16
- React 19
- TypeScript
- Supabase Auth / PostgreSQL / Storage
- DeepSeek 文案辅助
- Resend 通知
- Vercel 部署

## 本地启动

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
http://localhost:3000/pricing
http://localhost:3000/order/demo?plan=deep
```

未配置 Supabase 时使用本地演示模式，不会真实创建订单或上传付款凭证。

## 从 v0.6.2 升级

在 Supabase SQL Editor 执行：

```text
supabase/migrations/007_manual_payment_review.sql
```

然后将 v0.7 代码推送到 GitHub，并在 Vercel 重新部署。

新建 Supabase 项目时可以直接执行：

```text
supabase/schema.sql
```

## 必需环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
CARD_ACCESS_SECRET=长随机字符串
NEXT_PUBLIC_SITE_URL=https://你的正式域名
ADMIN_EMAILS=你的管理员登录邮箱
OPERATIONS_NOTIFICATION_EMAIL=接收付款审核提醒的邮箱
CRON_SECRET=长随机字符串
```

### 人工付款配置

推荐在 Supabase Storage 的私有 `merchant-assets` Bucket 中上传：

```text
wechat.png
alipay.png
```

然后在 Vercel 添加：

```env
MANUAL_WECHAT_QR_PATH=wechat.png
MANUAL_ALIPAY_QR_PATH=alipay.png
CUSTOMER_SERVICE_CONTACT=微信：你的客服号
MANUAL_PAYMENT_INSTRUCTIONS=付款时请备注订单号后8位\n付款后上传清晰截图并填写完整交易单号\n管理员核对真实到账后开通制作权限
```

服务器会为订单所有者生成 15 分钟短时二维码地址。也支持 `MANUAL_WECHAT_QR_URL` 和 `MANUAL_ALIPAY_QR_URL` 作为公开 HTTPS 图片后备方案。

### 可选服务

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=你的可用模型名
DEEPSEEK_BASE_URL=https://api.deepseek.com
RESEND_API_KEY=re_xxx
NOTIFICATION_FROM_EMAIL=拾光 <notifications@你的域名>
```

## 管理员审核步骤

1. 登录 `ADMIN_EMAILS` 中配置的账号。
2. 打开 `/admin/payments`。
3. 进入待审核订单。
4. 在真实微信或支付宝账单中查找交易。
5. 核对金额、付款时间和完整交易单号。
6. 确认无误后点击“确认真实到账”。
7. 系统原子更新付款凭证和订单，并开放制作权限。

不得仅凭截图确认到账。

## 安全设计

- 付款截图存放在私有 Bucket 中。
- 用户只能查看自己的审核状态，不能直接写数据库。
- 管理员预览使用 30 分钟短时签名地址。
- 同一交易单号只能对应一笔订单。
- 付款确认通过数据库函数原子完成。
- 人工付款订单未审核通过时，后台普通状态编辑不能绕过付款闸门。
- Secret Key、二维码原图和敏感环境变量不得提交到公开仓库。

## 完整检查

```bash
npm run check
npm audit --omit=dev
```

详细上线步骤见 [MANUAL_PAYMENT_SETUP.md](./MANUAL_PAYMENT_SETUP.md)。
