# v0.7 正式部署验收清单

## 数据库

- [ ] 已执行 `007_manual_payment_review.sql`
- [ ] `manual_payment_proofs` 表存在
- [ ] `orders.payment_review_status` 列存在
- [ ] `approve_manual_payment` 函数存在
- [ ] `payment-proofs` Bucket 为 private
- [ ] `merchant-assets` Bucket 为 private，且已上传微信／支付宝收款码
- [ ] RLS 已启用，普通用户只能读取自己的凭证状态

## Vercel 环境变量

- [ ] Supabase URL、Publishable Key、Secret Key 正确
- [ ] `CARD_ACCESS_SECRET` 已配置
- [ ] `NEXT_PUBLIC_SITE_URL` 使用正式 HTTPS 域名
- [ ] `ADMIN_EMAILS` 使用真实管理员账号
- [ ] `OPERATIONS_NOTIFICATION_EMAIL` 已配置
- [ ] `MANUAL_WECHAT_QR_PATH` 已配置或付款页明确显示联系客服
- [ ] `MANUAL_ALIPAY_QR_PATH` 已配置或付款页明确显示联系客服
- [ ] `CUSTOMER_SERVICE_CONTACT` 已替换示例值
- [ ] 所有 Secret 均未提交到 GitHub

## 用户侧

- [ ] 创建订单后进入人工付款页
- [ ] 用户不能访问他人的付款页
- [ ] 付款页金额与套餐一致
- [ ] 凭证只允许 JPG、PNG、WebP，最大 6 MB
- [ ] 完整交易单号少于 6 位会被拒绝
- [ ] 同一交易单号不能用于两个订单
- [ ] 提交凭证后不能重复提交
- [ ] 驳回后可以重新上传
- [ ] 未确认到账时不能提交问卷、上传素材或发布礼物

## 管理员侧

- [ ] `/admin/payments` 显示待审核凭证
- [ ] 非管理员无法进入审核页面
- [ ] 付款截图通过短时签名地址打开
- [ ] 驳回必须填写原因
- [ ] 普通订单状态编辑不能绕过人工付款审核
- [ ] 确认到账后凭证和订单同时更新
- [ ] 支付成功转化事件与推荐转化正常增加
- [ ] 客户收到通过或驳回通知

## 最终业务验收

- [ ] 用两台设备完成订单、付款凭证、审核、问卷、制作和交付
- [ ] 用一笔真实小额付款核对到账
- [ ] 手工退款流程已测试并记录
- [ ] 服务条款、退款规则和隐私说明已更新
- [ ] 管理员明确知道截图不能代替真实到账记录
