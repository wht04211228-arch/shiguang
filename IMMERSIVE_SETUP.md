# v0.8 沉浸惊喜功能升级教程

## 1. 执行数据库迁移

在 Supabase：

```text
SQL Editor → New query
```

复制并运行：

```text
supabase/migrations/008_immersive_experience.sql
```

运行后确认：

- `cards` 新增 `relationship_start_date`、`release_at`、`expires_at`
- `card_replies` 新增 `mood`
- 新增 `card_engagement_events`

## 2. 更新源代码

用 v0.8 文件覆盖现有项目后：

```bash
npm install
npm run check
git add -A
git commit -m "Upgrade to v0.8 immersive experience"
git push origin main
```

## 3. 等待 Vercel 部署

进入：

```text
Vercel → 项目 → Deployments
```

等待最新部署显示 `Ready`。

v0.8 不新增必需环境变量，因此原 v0.7 环境变量可以继续使用。

## 4. 测试定时开启

1. 登录制作台。
2. 打开“体验”标签。
3. 将开启时间设置为当前时间后 3～5 分钟。
4. 发布礼物。
5. 用无痕窗口打开专属链接。
6. 确认只能看到倒计时，不能看到回忆和信件。
7. 倒计时结束后刷新页面并完成解锁。

## 5. 测试展示失效

将失效时间设置为短期测试时间。超过该时间后打开礼物，应提示礼物已经结束展示。

失效时间必须晚于开启时间。

## 6. 测试互动问答与惊喜

- 问答选择错误时显示重试提示。
- 正确后才能继续进入信件。
- 惊喜页可显示约定码。
- 配置外部链接时，按钮只建议使用可信 HTTPS 地址。

## 7. 测试心情回应

收件人在最后一页选择心情并填写文字。制作人回到制作台，点击“查看当前礼物回复”，应看到心情标签和回复内容。

## 8. 测试体验数据

收件人完整体验一次后，制作人点击制作台顶部“体验数据”，应能看到独立会话、解锁、完成、回复和阶段浏览数据。

## 9. 隐私建议

对外销售时应在隐私页面说明：系统会记录匿名阶段浏览事件，用于判断礼物是否成功打开和完整观看。不要用这些数据进行隐蔽跟踪或推断收件人的私人行为。
