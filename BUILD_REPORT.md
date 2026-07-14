# 拾光 v0.6 构建与验收报告

验收日期：2026-07-14

## 工程检查

| 项目 | 结果 |
|---|---|
| `npm install --ignore-scripts` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| `npm audit --omit=dev` | 0 个已知漏洞 |
| Next.js 生产服务器启动 | 通过 |
| 真实凭据扫描 | 未写入任何真实密钥 |

生产构建使用：

```text
Next.js 16.2.10
React 19.2.7
TypeScript 5.9.x
```

## 构建路由

新增或强化的关键路由：

```text
/api/reviews
/api/feedback
/api/referrals
/api/referrals/track
/api/cron/reminders
/referrals
/admin/order/[id]
/order/[id]
/cases
```

## 本地运行验收

| 场景 | 预期 | 结果 |
|---|---:|---:|
| 首页 | HTTP 200 | 通过 |
| 带推荐码套餐页 | HTTP 200 | 通过 |
| 演示订单详情 | HTTP 200 | 通过 |
| 推荐中心 | HTTP 200 | 通过 |
| 运营后台演示模式 | HTTP 200 | 通过 |
| 收件人样片 | HTTP 200 | 通过 |
| 案例与评价页 | HTTP 200 | 通过 |
| 未同意条款下单 | HTTP 400 | 通过 |
| 同意条款并携带推荐码 | HTTP 200 | 通过 |
| 修改意见少于 8 字 | HTTP 400 | 通过 |
| 合法修改意见 | HTTP 200 | 通过 |
| 评分超出 1–5 | HTTP 400 | 通过 |
| 合法评价 | HTTP 200 | 通过 |
| 推荐数据演示接口 | HTTP 200 | 通过 |
| Cron 无授权 | HTTP 401 | 通过 |
| Cron 正确授权、无 Supabase | HTTP 200 演示降级 | 通过 |

## 安全与流程修正

- 制作台发布只进入制作中，不再提前把订单标记为已交付。
- 客户批准初稿后才写入 `fulfilled_at` 并进入正式交付。
- 修改次数在服务端按套餐额度校验。
- M6 数据表启用 RLS；普通登录用户仅获得必要的只读权限，写操作通过服务端 API 校验。
- 自动提醒使用 `CRON_SECRET` 验证请求。
- 自动提醒发送前创建每日唯一 `dedupe_key`，应对平台重复触发。
- 推荐打开按推荐码与匿名会话去重。
- 自己的推荐码不会归因到自己的订单。
- 公开评价必须同时满足客户授权和运营审核。

## 未执行的真实服务验收

当前环境没有用户的第三方凭据，因此以下项目只完成了代码、类型和生产构建检查：

- Supabase 迁移与真实 RLS 双账号测试；
- Resend 实际邮件投递；
- Vercel Cron 正式调度；
- Stripe 真实支付和 Webhook 推荐归因；
- 真实客户评价审核后在案例页展示；
- 多账号推荐转化统计。

正式上线前请按 `DEPLOYMENT_CHECKLIST.md` 逐项验收。
