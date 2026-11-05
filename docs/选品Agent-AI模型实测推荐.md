# 选品 Agent —— AI 模型实测推荐

> 实测时间：2026-11-05　环境：本机（1.8G 内存）　任务：真实商品图 + 真实选品 prompt
> 所有结论都是本机实跑出来的，不是抄的参数表。

## 一、结论先说

| 用途 | 推荐模型 | 理由 |
|---|---|---|
| **选品主判断（看图打分）** | `MiniMax-M3` | 实测能准确读图（含颜色/图案/材质），速度 3.7s/款 |
| **大批量粗筛** | `MiniMax-M3.1-Flash` | 也支持视觉；但实测不比 M3 快，仅作成本备选 |
| **文案/资料生成** | `MiniMax-M3` | 英文文案质量高，SEO/关键词/脚本一次成型 |
| **纯文本活（翻译/格式化）** | `MiniMax-M2.7` | 快、便宜，但**不能用于看图** |

> ⚠️ 本机目前只有 MiniMax 一个能用的真实 API key（其它供应商的 key 在 openclaw 配置里是占位符 `$api-key`）。
> 详见「五、想换更强的模型怎么办」。

## 二、关键实测数据

### 视觉能力验证（最重要的一个测试）

给模型一张真实的深蓝白星星针织帽图，连续问两个问题：

```
                              Q1「什么颜色？有什么图案？」      Q2「针织还是梭织？」
MiniMax-M3                 → 深蓝色帽子，白色星星和飞机图案    是针织的
MiniMax-M3.1-Flash         → 蓝底配白色星星图案              是针织的
MiniMax-M2.7               → 未收到图片，无法判断            图片未显示，无法判断
MiniMax-M2.5               → 未收到图片，无法判断            看起来是针织的  ⚠️
```

**M2.7 / M2.5 看不到图。** 注意 M2.5 那一行：它一边说「未收到图片」，一边又答「看起来是针织的」——纯靠猜。选品场景绝对不能用它们，否则模型输出「这不是针织帽」的时候，你以为是它在否定商品，其实它压根没看见图。

（还有个细节：M3 能认出「飞机图案」，说明它看的是像素而不是在复述标题。）

### 选品打分实测（同一条商品 + 同一张图）

```
MiniMax-M3                3.7s  1262 tok  JSON✅  需7.2 竞8.1 套6.4
MiniMax-M3.1-Flash       21.5s  1934 tok  JSON✅  需6.8 竞8.4 套5.2
MiniMax-M2.7              19.9s   633 tok  JSON✅  需7.2 竞8.4 套4.6  ⚠️ 分数是猜的
MiniMax-M2.5               4.7s   621 tok  JSON✅  需7.0 竞8.5 套6.5  ⚠️ 分数是猜的
MiniMax-M2.7-highspeed    7.8s   632 tok  JSON✅  ⚠️ 分数是猜的
MiniMax-M2.5-highspeed    4.0s   684 tok  JSON✅  ⚠️ 分数是猜的
MiniMax-M2.1 / M2 / M2.1-highspeed → not_found_error（已下线）
```

三个反直觉的点：
1. **M3.1-Flash 不快**（21.5s，比 M3 慢 6 倍）——名字叫 fast 但实际慢
2. **M2.7 便宜（633 tok）是因为它没处理图**，不是因为它高效
3. M3 token 用得多（1262）恰恰因为它真在分析图像

**所以：只用 M3。要省成本就减图数/减候选量，不要换模型。**

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

⚠️ 但代码里目前按模型名分流 thinking 参数（`M3.1-Flash` 要 adaptive，其余 disabled）。
Qwen 系列用 `enable_thinking: false`（顶层字段），**换 Qwen 时要在 `ai.ts` 里补一条分支**，
否则 JSON 会被思考过程挤掉（同坑 1）。

### 值得考虑的三个替代方案

| 方案 | 强在哪 | 适配成本 |
|---|---|---|
| **Qwen3-VL-Plus**（阿里百炼） | 中文选品语感最好，淘宝/1688 生态原生语料多 | 低，改 baseUrl + 模型名 + thinking 分支 |
| **Kimi K2.5**（Moonshot） | 长文本推理强，适合做「全店选品报告」这种长分析 | 低，同样是 OpenAI 兼容 |
| **Gemini 3 Pro**（Google AI Studio） | 视觉理解上限最高，细节/做工/材质判断最准 | 中，需处理 Gemini 的 `contents` 格式，要多写一个 provider |

**我的建议**：如果只跑一个，选 M3（已验证可用、零适配成本）。
如果要做得更精细，**上 Qwen3-VL-Plus 做主力 + M3 做兜底**——两个视觉模型交叉打分，
同一商品给分差 > 2 分就标记为「需人工复核」，这比单模型更稳。

### 交叉打分怎么加（建议的后续动作）

`score` 路由里的 `judgeOne()` 是唯一的打分入口，改成并发跑两个 provider、
两份结果取均值、差值 >2 时打 `needsReview: true` 就行。评分权重和输出结构不用动。

## 六、已知限制

1. **本机没有生产库连接**（Supabase 直连被拒），所以 Agent 目前跑在「读 JSON 文件」模式。
   接入生产库后走 `POST /api/admin/selection/score`，它直接读 `SupplierProduct` 表。
2. **需求分和竞争分目前是 AI 主观判断**，没有接入罗盘/生意参谋的真实大盘数据。
   真实做法应该是：平台数据喂给 AI 当上下文，AI 只做解读和综合判断。
3. **套装分目前单款独立打分**，没有做全局配色矩阵聚类。
   `run.ts` 里已经写好了 `buildBundlePrompt` 的框架，等接入完整候选池再做。
4. **1688 防盗链**：图片必须**不带 Referer** 直连才是 200，带了反而 403。代码里已处理。
