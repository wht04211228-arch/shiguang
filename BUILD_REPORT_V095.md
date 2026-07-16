# v0.9.5 构建与验收报告

## 自动检查

- `npm install --ignore-scripts`：通过
- `npm run typecheck`：通过
- `npm run build`：通过
- 静态页面生成：32 / 32
- `npm audit --omit=dev`：0 个已知漏洞

## API 降级链路

在未配置 `DEEPSEEK_API_KEY` 的本地环境中测试：

- `POST /api/ai/copy`：HTTP 200
- 返回结构化封面、信件和未来约定：通过
- `provider=local`：通过
- 明确提示未配置 DeepSeek：通过
- 不消耗套餐次数：通过

## 仍需生产环境验收

由于交付环境没有用户的 DeepSeek API Key，以下内容需要部署后验证：

- DeepSeek 真实模型返回；
- DeepSeek 账户余额与限流；
- 正式订单 AI 次数原子扣减；
- Vercel Production 环境变量；
- DeepSeek 生成中文文案的实际质量。
