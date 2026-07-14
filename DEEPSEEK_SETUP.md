# DeepSeek 接入步骤

1. 登录 DeepSeek 开放平台并创建 API Key。
2. 确认账户余额可用。
3. 在 Vercel 项目 Settings → Environment Variables 添加：

```env
DEEPSEEK_API_KEY=完整API密钥
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

4. 环境选择 Production，保存后 Redeploy。
5. 登录网站并进入制作台，打开 AI COPY STUDIO。
6. 填写真实细节，点击“生成并应用草稿”。
7. Vercel Logs 中出现 `[deepseek-copy]` 才表示调用异常；正常成功不会打印密钥或响应全文。

## 常见错误

- `Authentication Fails` / HTTP 401：API Key 错误、不完整或已撤销。
- `Insufficient Balance` / HTTP 402：DeepSeek 账户余额不足。
- HTTP 429：频率或并发超限，稍后重试。
- 页面显示本地草稿：检查是否配置了 `DEEPSEEK_API_KEY`、Supabase 是否启用、环境变量修改后是否重新部署。
