# 1688 商品采集 → 铺货 使用说明

采集器在**你自己的浏览器**里运行（油猴脚本），1688 的风控（滑块验证 / IP 封禁）对真人浏览器环境基本无效，
所以不需要代理池、不需要打码平台，也不用担心账号被封。

## 一、安装采集脚本

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)（Chrome / Edge / Firefox 都有）
2. 打开 **https://fiestaflare.com/1688-collector** 安装引导页（含三种方案，推荐「方案 B 控制台」，无需装扩展）
3. 或直接安装：https://raw.githubusercontent.com/huayu821002/huayu999/master/scripts/1688-collector.user.js
   （若浏览器仍下载文件，改用引导页的方案 B）

## 二、准备 Token

1. 登录 Fiestaflare 后台（管理员账号）
2. 进入 **后台 → 采集品库**（也可从后台首页的「采集品库」卡片进入）
3. 点「**复制采集 Token**」，会复制你的管理员 JWT（有效期 365 天）

## 三、采集

1. 登录 [1688](https://www.1688.com)（你自己的账号）
2. 打开任意**商品详情页**（`detail.1688.com/offer/xxx.html`）或**搜索结果页**（`s.1688.com/selloffer/...`）
3. 页面右下角出现「**Fiestaflare 采集器**」面板：
   - 第一次：把 Token 粘贴进去 → 点「保存设置」
   - 商品页 → 「**采集当前商品**」（标题、价格、起订量、主图/详情图、SKU、供应商、描述）
   - 搜索页 → 「**采集本页列表**」（一次抓本页所有商品的基础信息）

## 四、审核与铺货

后台 → **采集品库**：

- 列表按「待审核 / 已上架 / 已忽略」筛选，可搜标题、offerId、供应商
- 点「审核 / 编辑」→ 改标题、供应商、成本价、MOQ、备注 → 「保存修改」
- 「**生成商品（草稿）**」：生成正式商品但不公开，之后可在 商品管理 里继续编辑/上架
- 「**生成并上架**」：直接生成并公开
- 「忽略」：丢弃该采集品

生成商品时自动处理：

| 来源 | 目标字段 |
|---|---|
| 1688 标题 | `name`（自动加 `-<offerId>` 后缀生成 slug） |
| 采集价（成本） | `costPrice`，`price` 默认等于成本价，可发布时改 |
| 起订量 MOQ | `minOrderQty` |
| 图片 | `images`（JSON 数组，最多 20 张） |
| 阶梯价 | `tieredPricing`（JSON） |
| 来源标记 | `tags` = `1688,采集品,<offerId>` |
| 合规占位 | `compliance` = 待补录欧盟责任方/制造商信息（GPSR） |

## 五、接口（供自动化调用）

```
POST /api/import/1688   （跨域采集用；鉴权同样要求管理员 Bearer Token）
Headers: Authorization: Bearer <管理员Token>
Body 单条: { "data": { "sourceId":"615063287157", "title":"...", "priceMin":1.2, "moq":2, "images":["https://..."] } }
Body 批量: { "items": [ {...}, {...} ] }
返回: { success:true, imported:n, failed:n, results:[...], errors:[...] }

GET    /api/admin/supplier-products?status=pending&search=&page=1&limit=50
GET    /api/admin/supplier-products/{id}
PATCH  /api/admin/supplier-products/{id}   { title, priceMin, moq, status, note, ... }
POST   /api/admin/supplier-products/{id}/publish  { price, isActive:true, categoryId, ... }
DELETE /api/admin/supplier-products/{id}
```

字段名：`sourceId`（1688 offer id，必填）、`sourceUrl`、`title`（必填）、`titleCn`、`description`、
`images[]`、`priceMin`、`priceMax`、`moq`、`unit`、`skuText`、`attributes{}`、`supplierName`、
`supplierUrl`、`shippingText`、`priceTiers[]`、`raw{}`

同一 `source + sourceId` 重复导入会**更新**而不是新增，且**只覆盖本次提供的字段**（不会清空已有图片/描述）。

## 六、注意事项

1. **图片版权**：1688 图片属于供应商，直接搬到独立站有版权风险，尤其欧盟站。
   建议：走 1688 分销商授权图，或采购后要求供应商书面授权，或自己拍图。
2. **GPSR**：采集数据里没有欧盟责任方/制造商信息，发布到欧盟市场前必须在商品里补录。
3. **不要在服务器上直连 1688 跑爬虫**：机房 IP 会被风控直接拦截（已实测，返回 punish 滑块页）。
4. 采集频率：真人手动点，一次几十条最稳；不要写循环自动翻页。
5. 脚本面板里的 Token 等同管理员权限，**不要外传**；泄露了就在后台改密码重新登录即可失效（旧 token 有效期到 365 天，注意）。
