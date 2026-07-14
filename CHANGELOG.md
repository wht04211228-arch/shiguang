# Changelog

## 0.6.0 - 2026-07-14

### Added

- `order_reviews` 初稿确认轮次与客户响应
- 套餐修改次数强制校验
- `production_tasks` 制作任务、负责人、截止时间和状态
- 问卷提交后的默认任务模板
- `/api/cron/reminders` 自动提醒与 `reminder_logs`
- `customer_reviews` 客户评分与文字评价
- `case_permissions` 匿名案例、文字和媒体授权
- 运营评价审核与案例页授权评价
- `/referrals` 推荐中心
- `referral_codes` 和 `referral_attributions`
- 推荐链接打开和成功付费追踪
- Vercel Cron 配置与每日提醒唯一键，防止重复触发造成重复通知

### Changed

- 发布礼物不再自动结单；客户批准初稿后才正式交付。
- 订单详情加入初稿确认、修改意见、评价和推荐入口。
- 运营后台增加初稿、任务、评价授权和推荐指标。
- 案例页从纯演示结构升级为“演示案例 + 已授权评价”。
- 套餐页支持 `?ref=` 推荐参数。

### Security

- 自动提醒接口要求 `CRON_SECRET`。
- 推荐打开按推荐码和匿名会话去重。
- 自我推荐不会产生订单归因。
- 案例页只展示客户授权且运营审核通过的文字。
- 制作任务与提醒日志仅允许服务端管理员访问。
