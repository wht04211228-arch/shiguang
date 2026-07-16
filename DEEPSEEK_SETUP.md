# DeepSeek 智能文案配置

## 1. 创建 API Key

登录 DeepSeek 开放平台创建 API Key，并确认账户存在可用余额。

API Key 只能放在 Vercel 服务端环境变量中，不能写入前端代码、截图或 GitHub。

## 2. 配置 Vercel

进入：

```text
Vercel → 项目 → Settings → Environment Variables
```

添加：

```env
DEEPSEEK_API_KEY=你的完整API密钥
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

建议：

- 日常智能文案使用 `deepseek-v4-flash`；
- 需要更高质量时可改为 `deepseek-v4-pro`；
- 三个变量选择 Production；
- 保存后必须 Redeploy。

## 3. 使用方式

登录网站，进入制作台的“专属信件”区域。

AI 文案工作台支持：

- 从真实经历生成完整初稿；
- 润色现有内容并保留原意；
- 重新组织故事结构；
- 简洁、均衡、丰富三种长度；
- 生成前读取现有回忆；
- 先预览，再决定是否应用；
- 不会自动覆盖当前礼物内容。

## 4. 套餐次数

云端正式模式会按照订单套餐限制 AI 草稿次数。

只有 DeepSeek 成功返回文案后才消耗一次额度；DeepSeek 调用失败并返回本地草稿时，不扣除 AI 次数。

未配置 Supabase 的本地开发环境，只要配置了 `DEEPSEEK_API_KEY`，也可以直接测试真实 DeepSeek 调用。

## 5. 常见问题

### 页面提示“尚未配置 DeepSeek”

检查：

- `DEEPSEEK_API_KEY` 是否完整；
- 环境变量是否选择 Production；
- 修改后是否重新部署；
- 当前访问的是否为最新 Production 部署。

### HTTP 401

API Key 错误、不完整、被撤销或复制了多余空格。

### 余额不足

为 DeepSeek 开放平台账户充值后重试。

### HTTP 429

请求频率或并发超限，稍后重试。

### 返回本地草稿

查看 Vercel Logs 中的：

```text
[deepseek-copy]
```

系统不会记录完整 API Key，也不会在日志中打印用户的完整生成结果。
