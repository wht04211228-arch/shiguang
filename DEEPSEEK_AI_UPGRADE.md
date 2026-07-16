# v0.9.5 DeepSeek 智能文案升级说明

本版本将原有基础 AI 按钮升级为完整的 DeepSeek 文案工作台。

## 新增能力

- DeepSeek API 可在云端和本地开发环境中真实调用；
- 支持生成、润色和重构三种创作方式；
- 支持简洁、均衡和丰富三种文案长度；
- 将现有封面、信件和未来约定作为润色参考；
- 生成结果先进入预览区，不再直接覆盖用户内容；
- 用户确认后才应用到礼物；
- DeepSeek 调用失败时返回本地基础草稿；
- 失败时不消耗套餐 AI 次数；
- 只有模型成功返回后才原子扣减订单额度；
- 生成结果严格使用 JSON Output 解析；
- 禁止模型编造用户未提供的经历、日期、地点和承诺。

## 更新方式

当前项目为 v0.9.4 时，将补丁覆盖到项目根目录：

```powershell
npm install
npm run check
git add -A
git commit -m "Upgrade to v0.9.5 DeepSeek AI copy studio"
git push origin main
```

本版本不需要执行 Supabase 数据库迁移。
