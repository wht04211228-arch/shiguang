# 拾光 v0.9 升级与配置教程

## 1. 运行数据库迁移

已部署 v0.8 时，在 Supabase SQL Editor 执行：

```text
supabase/migrations/009_collaboration_memory_space.sql
```

只执行一次。新项目直接执行 `supabase/schema.sql`，无需再单独执行历史迁移。

迁移完成后应出现：

```text
collaboration_spaces
collaboration_invites
collaboration_contributions
contribution_versions
contribution_withdrawals
memory_space_members
recipient_entries
management_requests
content_reports
```

Storage 中应出现两个私有 Bucket：

```text
collaboration-media
recipient-media
```

## 2. 更新本地源码

建议先备份旧项目，再用 v0.9 文件覆盖项目根目录。保留旧项目的 `.git` 与 `.env.local`。

```powershell
npm install
npm run check
```

确认通过后：

```powershell
git add -A
git commit -m "Upgrade to v0.9 collaboration memory space"
git push origin main
```

## 3. Vercel 环境变量

v0.9 不新增强制密钥。保留现有 Supabase、人工付款、管理员和安全密钥配置。

DeepSeek 仅用于文案和文字安全辅助。未配置或调用失败时，系统会使用本地规则进行基础检查，不影响制作和投稿主流程。

## 4. 真实验收顺序

1. 普通账号购买带共创人数的套餐并完成付款审核。
2. 在制作台开启多人共创。
3. 分别生成公共邀请和专属邀请。
4. 使用无痕窗口免注册提交文字与照片。
5. 再使用登录账号绑定一份投稿。
6. 购买者确认、退回、隐藏、排序和删除投稿。
7. 达到人数上限后确认系统阻止新增投稿。
8. 创建补差价升级订单，审核付款后确认额度增加。
9. 发布礼物并由另一台设备解锁。
10. 收件人添加新回忆并绑定账号。
11. 收件人申请邀请权限，购买者在制作台批准。
12. 收件人生成新邀请，确认仍受剩余人数额度限制。
13. 提交隐私举报，确认进入 `/admin/reports`。
14. 检查私有素材不能使用永久公开 URL 直接访问。

## 5. 关键规则

- 购买者不能直接修改投稿者原文。
- 匿名只影响收件人展示，不影响购买者管理身份识别。
- 发布后撤回会立即隐藏；恢复需要投稿者再次同意。
- “长期纪念”不等于承诺企业或服务永久存在。
- 图片和视频第一版没有接入第三方视觉审核，发布前由购买者最终确认。
