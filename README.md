# 拾光 v0.9｜多人秘密共创纪念空间

拾光是一套可部署的私人数字纪念礼物平台。v0.9 在人工付款、订单、问卷、DeepSeek 文案、沉浸式礼物和体验数据基础上，加入完全自助制作、多人秘密共创、分层邀请收费、保存期限权益、收件人二次参与、共同管理与全新引导式视觉工作台。

## v0.9 核心能力

### 更清楚的用户路径

- 首页同时提供“体验样片”和“直接开始制作”
- 登录后进入“下一步操作中心”
- 首次制作按 10 步旅程引导，后续可以自由跳转
- 桌面端三栏工作台：礼物旅程、当前任务、手机实时预览
- 手机端使用单任务编辑和全屏预览
- 制作完成度、情感丰富度和情绪节奏建议
- 发布前检查清单明确区分必须项和建议项

### 多人秘密共创

- 公共群聊邀请和个人专属邀请同时支持
- 默认秘密模式，也可开启通过后的共创留言墙
- 参与者可免注册投稿，也可绑定账号长期管理
- 每位参与者可提交文字、最多 3 张照片、1 段语音和套餐允许的视频
- 允许对收件人匿名，但购买者始终可以看到真实投稿身份
- 购买者可以确认、排序、隐藏、删除和退回修改，但不能改写原文
- 截止后默认禁止新增投稿，已投稿者在发布前仍可修改
- 支持单独延长专属邀请期限、撤销链接和锁定投稿版本
- 发布后撤回会根据收件人是否已经打开分级处理

### 权益与补差价

邀请人数：

- 3 人：+¥9.9
- 10 人：+¥19.9
- 30 人：+¥39.9
- 最多 100 人：+¥69.9

保存期限：

- 30 天：套餐默认
- 1 年：+¥9.9
- 3 年：+¥19.9
- 长期纪念：+¥49.9

邀请人数和保存期限只允许补差价向上升级，不支持降级退款。长期纪念指产品持续运营期间长期保存，并提供数据导出能力。

### 收件人共同纪念空间

- 收件人可以继续添加新回忆、未来进度、照片和声音
- 收件人可以绑定账号，进入双方共同管理阶段
- 收件人可以申请继续邀请新成员
- 购买者批准后，收件人可在剩余人数额度内生成邀请链接
- 收件人新增内容由收件人控制；购买者可隐藏但不能修改原文
- 重大操作采用双方确认、分级等待与申诉机制
- 控制权转移等待 14 天，永久删除等待 30 天
- 隐私、安全和侵权风险可立即临时隐藏并进入复核

### 安全与内容治理

- 文字通过本地规则和可选 DeepSeek 审核
- 文件校验格式、大小、数量和视频时长
- 图片和视频不会被虚假宣称为已自动完成视觉安全审核
- 购买者需在发布前最终确认共创内容
- 提供收件人举报入口和管理员内容复核队列
- 私有素材通过短时签名地址访问
- 解锁答案使用加盐哈希保存

## 技术栈

- Next.js 16 / React 19 / TypeScript
- Supabase Auth / PostgreSQL / 私有 Storage
- DeepSeek 文案与文字安全辅助（可选）
- Resend 邮件通知（可选）
- Vercel 部署
- 人工微信/支付宝付款凭证审核

## 从 v0.8 升级

先在 Supabase SQL Editor 执行：

```text
supabase/migrations/009_collaboration_memory_space.sql
```

然后更新源代码：

```bash
npm install
npm run check
git add -A
git commit -m "Upgrade to v0.9 collaboration memory space"
git push origin main
```

新建 Supabase 项目时直接执行：

```text
supabase/schema.sql
```

完整升级步骤见 [COLLABORATION_SETUP.md](./COLLABORATION_SETUP.md)。

## 本地启动

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
http://localhost:3000/dashboard
http://localhost:3000/studio
http://localhost:3000/card/sample
http://localhost:3000/pricing
```

样片解锁答案：

```text
5月
```

## 主要页面

```text
/                         品牌首页
/dashboard                下一步操作中心
/pricing                  套餐与增值权益
/studio                   引导式自助制作台
/collaborate/[token]      参与者秘密投稿页
/card/[slug]              收件人礼物和共同纪念空间
/order/[id]               订单、付款、权益升级
/admin                    运营后台
/admin/payments           人工付款审核
/admin/reports            隐私与内容复核
```

## 必需环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
CARD_ACCESS_SECRET=长随机字符串
NEXT_PUBLIC_SITE_URL=https://你的正式域名
ADMIN_EMAILS=管理员邮箱
OPERATIONS_NOTIFICATION_EMAIL=运营通知邮箱
CRON_SECRET=长随机字符串
ALLOW_UNPAID_PUBLISH=false
```

人工付款：

```env
MANUAL_WECHAT_QR_PATH=wechat.png
MANUAL_ALIPAY_QR_PATH=alipay.png
CUSTOMER_SERVICE_CONTACT=你的客服联系方式
MANUAL_PAYMENT_INSTRUCTIONS=你的付款说明
```

可选服务：

```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_MODEL=你当前账号可用的模型名
DEEPSEEK_BASE_URL=https://api.deepseek.com
RESEND_API_KEY=re_xxx
NOTIFICATION_FROM_EMAIL=拾光 <notifications@你的域名>
```

## 完整检查

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```

正式上线前按 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) 完成双账号、跨设备、权限和付款验收。

## v0.9.5 DeepSeek 智能文案

制作台现已支持 DeepSeek 智能文案工作台：从真实经历生成完整初稿、润色现有内容、重构故事表达，并在应用前预览结果。配置方法见 `DEEPSEEK_SETUP.md`。
