# 选品 Agent —— AI 模型实测推荐

> 实测时间：2026-11-05　环境：本机（1.8G 内存）　任务：真实商品图 + 真实选品 prompt
> 所有结论都是本机实跑出来的，不是抄的参数表。

## 一、结论先说

| 用途 | 推荐模型 | 理由 |
|---|---|---|
| **选品主判断（看图打分）** | `MiniMax-M3` | 实测能准确读图，给出可执行结论，速度 2.5s/款 |
| **大批量粗筛** | `MiniMax-M3.1-Flash` | 也支持视觉，便宜快；需特殊参数（见下） |
| **文案/资料生成** | `MiniMax-M3` | 英文文案质量高，SEO/关键词/脚本一次成型 |
| **纯文本活（翻译/格式化）** | `MiniMax-M2.7` | 快、便宜，但**不能用于看图** |

## 二、关键实测数据

### 视觉能力验证（最重要的一个测试）

给模型一张真实的深蓝白星星针织帽图，问「图里是什么、什么颜色」：

```
MiniMax-M3          → 深蓝色白星星针织帽        ✅ 真读图
MiniMax-M3.1-Flash  → 蓝色带白色星星的针织帽    ✅ 真读图
MiniMax-M2.7        → "no image attached"      ❌ 看不到图
MiniMax-M2.5        → 猜"白色棒球帽"           ❌ 看不到图，在瞎编
```

**M2.7 / M2.5 会假装看了图然后编答案。** 选品场景绝对不能用它们——模型输出「这不是针织帽」的时候，你以为是它在否定商品，其实它根本没看见图。这是最容易踩的坑。

### 选品打分实测（同一条商品 + 同一张图）

```
MiniMax-M3       2.5s  1201 tok  需求6.8 竞争7.9 套装5.2
MiniMax-M3.1-Flash  ERR (需 thinking.type=adaptive)
MiniMax-M2.7     3.2s   562 tok  ⚠️ 分数是猜的
MiniMax-M2.5     5.9s   546 tok  ⚠️ 分数是猜的
```

M3 慢一点但 token 用得多（因为它真的在分析图）；M2.7 便宜是因为它压根没处理图。

## 三、三个必须知道的调用坑

### 坑 1：必须关 thinking，否则 JSON 被截断

M3 默认会先输出一段 `<think>…</think>`，把 `max_tokens` 吃光，导致 JSON 解析失败。

```js
// ✅ 正确
{ model: "MiniMax-M3", thinking: { type: "disabled" }, max_tokens: 900 }

// ❌ 错误：JSON 被 think 挤掉
{ model: "MiniMax-M3", max_tokens: 900 }
```

实测：不关 thinking 时模型输出 300 字思考 + JSON 开头 → 解析直接失败。

### 坑 2：M3.1-Flash 强制要求 adaptive thinking

传 `disabled` 会直接 400 报错：

```
invalid params, model "MiniMax-M3.1-Flash" requires adaptive thinking
```

```js
// ✅ 正确
{ model: "MiniMax-M3.1-Flash", thinking: { type: "adaptive", effort: "low" } }
```

所以代码里按模型名分流（见 `lib/selection/ai.ts`）。

### 坑 3：多模态的 system prompt 不能塞进 content

MiniMax 要求**图片在文本之前**，且 system 提示词必须作为独立 message 传。
之前把 system 拼到 user content 里 → 模型完全无视格式要求，输出一大篇散文而不是 JSON。

```js
// ✅ 正确
messages = [
  { role: "system", content: JUDGE_SYSTEM },
  { role: "user", content: [
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } },
      { type: "text", text: prompt },        // 文本在图后
  ]},
]
```

## 四、通道选择

| 通道 | 成本 | 上下文开销 | 适用 |
|---|---|---|---|
| **MiniMax 直连**（本 Agent 默认） | 按 token | 0 | ✅ 批量选品首选 |
| OpenClaw 网关（127.0.0.1:12904） | 按 token | **41k 系统提示/次** | 只作兜底，批量场景太贵 |

**直连 key 的坑**（实测踩过）：
- `minimax:global` 这个 key → `insufficient_balance`（余额不足）
- `minimax:cn` 这个 key → 打 `api.minimax.io` 是 `invalid api key`
- ✅ **唯一可用组合：`minimax:cn` + `api.minimaxi.com`**

代码里已按这个组合写死，并支持环境变量覆盖（生产用）：

```bash
SELECTION_AI_KEY=sk-xxx              # 或 MINIMAX_API_KEY
SELECTION_AI_BASE_URL=https://api.minimaxi.com
SELECTION_AI_MODEL=MiniMax-M3
```

## 五、想换更强的模型怎么办

`lib/selection/ai.ts` 是唯一需要改的地方。它的接口很薄：

```ts
interface AiProvider {
  name: string
  vision: boolean
  chat(messages, opts) => Promise<string>
}
```

只要新供应商支持 OpenAI 兼容协议（`/v1/chat/completions` + `messages[].content[]` 里放 `image_url`），加一个 provider 就行，**选品逻辑、评分模型、API 路由全都不用动**。

想换 Qwen（阿里百炼）就改这两个环境变量：
```bash
SELECTION_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
SELECTION_AI_MODEL=qwen3-vl-plus
```
（Qwen 系列需要 `thinking` 参数不传或用 `enable_thinking:false`，代码里目前按模型名分流，加 Qwen 时要补一条。）

## 六、已知限制

1. **本机没有生产库连接**（Supabase 直连被拒），所以 Agent 目前跑在「读 JSON 文件」模式。
   接入生产库后走 `POST /api/admin/selection/score`，它直接读 `SupplierProduct` 表。
2. **需求分和竞争分目前是 AI 主观判断**，没有接入罗盘/生意参谋的真实大盘数据。
   真实做法应该是：平台数据喂给 AI 当上下文，AI 只做解读和综合判断。
3. **套装分目前单款独立打分**，没有做全局配色矩阵聚类。
   `run.ts` 里已经写好了 `buildBundlePrompt` 的框架，等接入完整候选池再做。
4. **1688 防盗链**：图片必须**不带 Referer** 直连才是 200，带了反而 403。代码里已处理。
