# 拾光 Growth & Delivery MVP v0.6

“拾光”是一套面向私人定制互动式数字纪念礼物的全栈项目。v0.6 在 v0.5 正式售卖版之上，补齐了成交后的关键交付闭环：初稿确认、套餐修改次数、制作任务、自动提醒、客户评价、案例授权与推荐码追踪。

## 本版本完成的核心闭环

```text
支付并提交问卷
→ 自动生成基础制作任务
→ 运营分配负责人和截止时间
→ 制作台生成可审阅版本
→ 运营发起第 N 轮初稿确认
→ 客户批准或提出修改
→ 系统扣减套餐修改次数
→ 客户批准后正式交付
→ 提交评价与案例授权
→ 生成推荐码并追踪打开和付费转化
```

## 1. 初稿确认与修改次数

订单详情页会在运营发起初稿确认后显示确认面板。客户可以：

- 打开当前初稿预览；
- 确认并正式交付；
- 提交具体修改意见；
- 查看已使用和剩余的修改次数。

套餐修改额度直接读取 `giftPlans`：

- 轻定制：1 次；
- 深度定制：3 次；
- 私人策划：5 次。

制作台发布不再直接把订单标记为已交付。只有客户批准初稿后，订单才会进入 `fulfilled / delivered`。

## 2. 制作任务与分配

问卷正式提交时，如果订单尚无任务，系统会自动创建：

1. 核对问卷与素材完整性；
2. 整理故事结构与章节顺序；
3. 完成页面制作并内部校对。

运营后台可以继续新增任务、分配负责人、设置截止时间，并在以下状态间切换：

```text
todo → doing → blocked → done
```

## 3. 自动提醒

新增：

```text
GET /api/cron/reminders
```

`vercel.json` 默认每天触发一次，以兼容 Vercel Hobby 计划；付费计划可按需要调整为每 6 小时。提醒场景：

- 已付款超过 24 小时仍未提交问卷；
- 初稿发出超过 24 小时仍未确认；
- 订单将在 24 小时内到期但尚未交付。

用户提醒发送到订单邮箱；交付预警发送到 `OPERATIONS_NOTIFICATION_EMAIL`。`reminder_logs.dedupe_key` 会在发送前抢占唯一记录，即使平台重复触发同一批任务，也不会重复发送当日同类提醒。

## 4. 客户评价与案例授权

正式交付后，客户可以提交：

- 1–5 星评价；
- 真实文字评价；
- 公开展示名；
- 是否允许匿名整理案例；
- 是否允许引用文字；
- 是否允许使用媒体素材。

媒体授权文案明确说明：即使勾选允许，具体图片或录屏仍应再次确认后才可使用。

运营后台可以审核评价。只有同时满足以下条件的文字才会进入 `/cases`：

- 客户允许公开评价；
- 客户允许引用文字；
- 运营审核状态为 `approved`；
- 授权没有被撤回。

## 5. 推荐码与转化追踪

新增：

```text
/referrals
/api/referrals
/api/referrals/track
```

客户可以生成推荐码和推荐链接：

```text
https://你的域名/pricing?ref=SGXXXXXXXX
```

系统追踪：

- 不重复的推荐会话打开次数；
- 推荐订单归因；
- 成功支付订单数。

同一登录账号不能通过自己的推荐码给自己归因。当前版本只做数据追踪，不自动承诺现金返佣。

## 6. 运营后台增强

`/admin` 新增指标：

- 待确认初稿；
- 逾期制作任务；
- 推荐打开与付费转化；
- 待处理退款。

`/admin/order/[id]` 新增：

- 发起新一轮初稿确认；
- 查看客户修改意见；
- 创建、分配与更新制作任务；
- 查看客户评价与案例授权；
- 审核评价是否可以公开展示。

## 主要路由

```text
/                         品牌首页
/cases                    演示案例与已授权评价
/pricing                  套餐、优惠码与推荐归因
/orders                   用户订单中心
/order/[id]               问卷、初稿确认、评价与售后
/brief?order=[id]         制作需求问卷
/studio?order=[id]        礼物制作台
/card/[slug]              收件人专属礼物
/referrals                推荐码与转化数据
/admin                    运营仪表盘
/admin/order/[id]         订单制作工作台
/api/cron/reminders       自动提醒任务
```

## 无配置直接体验

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
http://localhost:3000/pricing?ref=SGDEMO88
http://localhost:3000/order/demo?plan=deep
http://localhost:3000/referrals
http://localhost:3000/admin
http://localhost:3000/card/sample
```

演示模式不会真实扣款，也不会写入真实数据库。

## Supabase 配置

新项目执行：

```text
supabase/schema.sql
```

从 v0.5 升级只执行：

```text
supabase/migrations/006_growth_delivery.sql
```

新增或变更：

- `orders.review_status`
- `orders.revision_count`
- `orders.review_requested_at`
- `orders.approved_at`
- `orders.referred_by_code`
- `order_reviews`
- `production_tasks`
- `customer_reviews`
- `case_permissions`
- `referral_codes`
- `referral_attributions`
- `reminder_logs`

## 新增环境变量

```env
OPERATIONS_NOTIFICATION_EMAIL=owner@example.com
CRON_SECRET=replace-with-a-long-random-cron-secret
```

已有变量仍按 `.env.example` 配置，包括 Supabase、Stripe、Resend、OpenAI、管理员邮箱和站点域名。

## Vercel Cron

项目内已包含：

```text
vercel.json
```

默认计划：

```text
0 1 * * *
```

正式部署时必须配置 `CRON_SECRET`，提醒接口只接受：

```text
Authorization: Bearer <CRON_SECRET>
```

## 构建检查

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```

上线前逐项执行 `DEPLOYMENT_CHECKLIST.md`。

## 尚未包含

- 微信支付与支付宝商户支付；
- 推荐奖励结算、提现与反作弊风控；
- 短信或微信模板消息；
- 素材批量下载与冷存储归档；
- 视频转码与内容审核；
- Stripe 自动退款；
- 多角色细粒度后台权限；
- 正式 SLA、发票、税务与跨地区消费者合规。
