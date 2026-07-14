# 拾光 v0.9 构建与验收报告

生成日期：2026-07-14

## 项目信息

```text
name: shiguang-digital-memory-gift
version: 0.9.0
framework: Next.js 16.2.10
react: 19.2.7
typescript: 5.9.x
```

## 自动检查

| 检查 | 结果 |
|---|---|
| `npm install` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| 生产路由生成 | 32 个静态/动态页面组，全部完成 |
| `npm audit --omit=dev` | 0 个已知漏洞 |
| 内部 npm 地址扫描 | 未发现 |
| 常见真实密钥格式扫描 | 未发现 |

## 本地 HTTP 验收

| 路径或接口 | 结果 |
|---|---|
| `/` | HTTP 200 |
| `/dashboard` | HTTP 200 |
| `/pricing` | HTTP 200 |
| `/studio` | HTTP 200 |
| `/card/sample` | HTTP 200 |
| `/login` | HTTP 200 |
| `/admin` 演示降级 | HTTP 200 |
| `/admin/reports` 演示降级 | HTTP 200 |
| `/legal/terms` | HTTP 200 |
| 错误样片答案 | HTTP 401，符合预期 |
| 正确样片答案 | HTTP 200 |
| 样片共同纪念空间 | HTTP 200 |
| 演示举报提交 | HTTP 200 |

## v0.9 新增路由

```text
/dashboard
/collaborate/[token]
/admin/reports
/api/collaboration/*
/api/upgrades
/api/cards/[slug]/space
/api/cards/[slug]/space/upload
/api/cards/[slug]/space/claim
/api/cards/[slug]/space/invites
/api/cards/[slug]/space/requests
/api/memory-space/requests
/api/reports
```

## 已实现安全控制

- 共创和收件人素材使用私有 Bucket 与短时签名地址。
- 共创邀请只保存 Token 哈希，原始 Token 只在创建时返回。
- 文件类型、体积、数量和视频时长在服务端检查。
- 文字通过本地规则与可选 DeepSeek 检查。
- 未付款订单不能开启正式云端权益。
- 未解锁、未到开放时间或已经失效的礼物不能写入收件人内容。
- 投稿撤回后立即隐藏；收件人已打开时进入待处理撤回流程。
- 隐私、安全和疑似违法举报可以触发临时隐藏。
- 管理员和普通用户的读取范围通过服务端鉴权与 RLS 隔离。

## 仍需真实云端验收

当前环境没有用户的 Supabase、Vercel、DeepSeek、Resend 与正式域名凭据，因此下列项目只能在用户生产环境中完成：

- `009_collaboration_memory_space.sql` 的真实执行结果
- 两个真实账号之间的 RLS 隔离
- 私有图片、语音和视频跨设备上传
- 人工付款审核后权益同步
- 共创人数达到上限和补差价升级
- 收件人账号绑定与共同管理申请
- DeepSeek 真实文字检查
- Resend 真实邮件投递
- Vercel 正式域名和移动端浏览器验收

上线前请逐项执行 `DEPLOYMENT_CHECKLIST.md`。
