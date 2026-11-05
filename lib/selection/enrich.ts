/**
 * 选品 Agent —— 商品资料生成（"添加资料"）
 *
 * 选品跑出来的款，要变成能上架的完整资料，本模块负责：
 *   1. 中文标题 → 英文标题（跨境站 SEO 友好，不是直译）
 *   2. SEO 标题 + 关键词（Google/站内搜索优化）
 *   3. 卖点短描述（社媒/详情页头部）
 *   4. 详细描述（结构化卖点 + 规格 + 使用场景）
 *   5. 短视频脚本（口播稿，含前3秒钩子）
 *   6. 套装建议文案（若 bundle 分高）
 *
 * 设计：一次调用出全部字段（省 token），JSON 严格 schema。
 */

import { aiChat, extractJson, MODELS } from './ai.ts'

export type EnrichInput = {
  title: string
  cost?: number
  sellPrice?: number
  category?: string
  description?: string
  variants?: string[]
  colors?: string[]
  images?: string[]
  bundleNote?: string
}

export type Enriched = {
  titleEn: string
  seoTitle: string
  keywords: string[]
  shortDescEn: string
  descriptionEn: string
  highlights: string[]
  videoScript: string
  bundleCopy?: string
  faq: Array<{ q: string; a: string }>
}

const SYSTEM = `你是跨境电商（B2C 独立站 + 抖店/淘宝）的资深文案。
你在为「帽子 / 围巾 / 手套」类商品写上架资料。

要求：
- **英文文案要像母语者写的营销文案，不要机翻腔**，不要出现 "high quality" "best selling" "factory direct" 这类空话
- 描述里必须自然融入具体卖点（材质、工艺、尺寸、适用场景、季节），不要空泛形容词堆砌
- SEO 标题 60 字符以内、包含品类词 + 核心属性词
- keywords 给 8-12 个真实搜索词（长尾词为主）
- 短视频脚本要有前 3 秒钩子，口语化，能直接念，标注时长
- 不确定的规格（具体尺寸、成分比例）**不要编造**，用占位符 [需填写:xxx]

严格只输出 JSON，不要任何解释文字或 markdown 标记。字段：
{
  "titleEn": "英文标题",
  "seoTitle": "SEO标题",
  "keywords": ["词1","词2"],
  "shortDescEn": "一句话卖点，80字符内",
  "descriptionEn": "详细描述，3-5句，含具体卖点",
  "highlights": ["卖点1","卖点2","卖点3","卖点4"],
  "videoScript": "短视频口播稿，含前3秒钩子，标时长",
  "bundleCopy": "套装推荐文案（可选）",
  "faq": [{"q":"问题","a":"答案"}]
}`

export async function enrichProduct(
  input: EnrichInput,
  opts: { model?: string; maxTokens?: number } = {}
): Promise<Enriched> {
  const info = [
    `中文标题：${input.title}`,
    input.category ? `品类：${input.category}` : '',
    input.cost ? `采购价：${input.cost} 元` : '',
    input.sellPrice ? `建议零售价：${input.sellPrice} 元` : '',
    input.colors?.length ? `可用颜色：${input.colors.join('、')}` : '',
    input.variants?.length ? `规格：${input.variants.join('、')}` : '',
    input.description ? `供应商描述：${input.description.slice(0, 500)}` : '',
    input.bundleNote ? `套装建议：${input.bundleNote}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await aiChat(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: info + '\n\n请生成全套上架资料。' },
    ],
    { model: opts.model || MODELS.main, maxTokens: opts.maxTokens ?? 2500, temperature: 0.4 }
  )

  const j = extractJson<any>(raw)
  return {
    titleEn: str(j.titleEn, input.title),
    seoTitle: str(j.seoTitle, input.title).slice(0, 90),
    keywords: Array.isArray(j.keywords) ? j.keywords.map(String).slice(0, 12) : [],
    shortDescEn: str(j.shortDescEn, ''),
    descriptionEn: str(j.descriptionEn, ''),
    highlights: Array.isArray(j.highlights) ? j.highlights.map(String).slice(0, 6) : [],
    videoScript: str(j.videoScript, ''),
    bundleCopy: j.bundleCopy ? str(j.bundleCopy, '') : undefined,
    faq: Array.isArray(j.faq)
      ? j.faq.slice(0, 5).map((x: any) => ({ q: str(x?.q, ''), a: str(x?.a, '') }))
      : [],
  }
}

function str(v: any, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}
