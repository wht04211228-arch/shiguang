# 人工付款版上线配置

## 1. 执行数据库迁移

Supabase → SQL Editor → New query，粘贴并运行：

```text
supabase/migrations/007_manual_payment_review.sql
```

执行后确认：

- Table Editor 中出现 `manual_payment_proofs`
- `orders` 表出现 `payment_review_status`
- Storage 中出现私有 Bucket `payment-proofs`

## 2. 上传私有收款码

Supabase → Storage → `merchant-assets`，上传：

```text
wechat.png
alipay.png
```

Bucket 必须保持 Private。建议使用清晰正方形图片，不要上传身份证件、API Key 或银行资料。

提交项目代码：

```bash
git add .
git commit -m "Enable manual payment review"
git push
```

## 3. 配置 Vercel

Vercel → Project → Settings → Environment Variables：

```env
MANUAL_WECHAT_QR_PATH=wechat.png
MANUAL_ALIPAY_QR_PATH=alipay.png
CUSTOMER_SERVICE_CONTACT=微信：你的客服号
MANUAL_PAYMENT_INSTRUCTIONS=付款时请备注订单号后8位\n付款后上传清晰截图并填写完整交易单号\n管理员核对真实到账后开通制作权限
```

以上变量选择 Production。修改后重新部署。

## 4. 测试完整流程

用普通用户账号：

1. 打开 `/pricing`
2. 创建最低价格套餐订单
3. 进入 `/pay/manual/[订单ID]`
4. 查看收款码和订单金额
5. 使用测试用截图提交凭证
6. 确认订单页显示“等待核对”

用管理员账号：

1. 打开 `/admin/payments`
2. 找到刚提交的凭证
3. 进入订单详情
4. 打开短时付款截图
5. 测试驳回流程
6. 用户重新提交
7. 在确认真实到账后点击“确认真实到账”
8. 检查订单变为已支付
9. 检查问卷和制作台是否开放

正式测试时必须使用真实小额付款，并在收款账户中核对。

## 5. 验收数据库

Supabase 中检查：

```text
manual_payment_proofs.review_status = approved
orders.status = paid
orders.payment_review_status = approved
orders.paid_at 不为空
order_events 包含 payment.succeeded 和 manual_payment.approved
```

## 6. 常见错误

### 找不到 `manual_payment_proofs`

迁移没有执行成功。重新运行 `007_manual_payment_review.sql`。

### 上传显示 Bucket not found

确认 Storage 中存在 `payment-proofs`，并重新执行迁移中的 Bucket 创建部分。

### 用户提交后管理员看不到

确认管理员邮箱与 `ADMIN_EMAILS` 完全一致，并在修改环境变量后重新部署。

### 管理员确认后订单仍未支付

查看 Vercel Functions Logs 中：

```text
PATCH /api/admin/orders/[id]
```

同时确认数据库函数 `approve_manual_payment` 已创建。

### 收款码不显示

检查 `MANUAL_WECHAT_QR_PATH` 与 `MANUAL_ALIPAY_QR_PATH` 是否和 `merchant-assets` Bucket 中的对象路径完全一致。
