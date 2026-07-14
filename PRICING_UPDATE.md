# v0.9.3 套餐价格更新

基础套餐价格已统一调整：

- 轻定制：¥5.20（520 分）
- 深度定制：¥13.14（1314 分）
- 私人策划：¥29.90（2990 分）

价格的唯一配置源为 `lib/commerce/plans.ts`。套餐页、订单接口、人工付款页、订单详情与管理员后台均读取订单金额或该配置，因此无需数据库迁移。

## 更新

覆盖补丁后执行：

```powershell
npm install
npm run check
git add -A
git commit -m "Upgrade to v0.9.3 pricing"
git push origin main
```

本次更新不修改已创建订单的历史金额。新价格只应用于更新部署后新创建的订单。
