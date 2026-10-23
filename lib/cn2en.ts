/**
 * 中文 → 英文 翻译 + 批发站 SEO 标题生成
 *
 * 通道（都免密钥）：
 *   1) Google translate gtx（质量最好）
 *   2) MyMemory（兜底）
 *
 * 场景是 1688 批发商品：标题/描述中夹杂大量营销词（爆款、跨境、外贸、批发…），
 * 直接翻译出来不符合 B2B 站点的 SEO 习惯，所以这里做了：
 *   - 噪声词过滤（年份、爆款、热卖、跨境、外贸、工厂直销、一件代发…）
 *   - SEO 标题重写：主体词前置 + 品类词补齐 + 控制长度
 */

const GOOGLE_TXT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q='
const MYMEMORY = 'https://api.mymemory.translated.net/get?q='

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** B2B 标题里要剔除的营销噪声词（中英） */
const NOISE_ZH = [
  '爆款', '热卖', '新款', '新品', '跨境', '外贸', '批发', '厂家直销', '工厂直销',
  '一件代发', '支持代发', '现货', '包邮', '特价', '促销', '折扣', '旗舰', '正品',
  '厂家', '源头', '实力', '品质', '精选', '推荐', '热销', '爆单', '新品上市',
  '跨境欧美', '欧美', '全球', '热销爆款', '源头工厂', '支持一件代发', '厂家定制',
]
const NOISE_EN = [
  'hot sale', 'hot selling', 'new arrival', 'new arrivals', 'best selling', 'bestseller',
  'fashion trend', 'trending', 'wholesale', 'dropshipping', 'drop shipping', 'factory direct',
  'in stock', 'free shipping', 'hot sale 2021', '2021', '2022', '2023', '2024', '2025',
  'high quality', 'top quality', 'best quality', 'super', 'perfect',
]

/** 从原文里抽「主体词」：去掉噪声词与年份后的中文串 */
export function stripNoise(text: string): string {
  let t = String(text || '')
  for (const w of NOISE_ZH) t = t.split(w).join(' ')
  t = t.replace(/20\d{2}\s*年?/g, ' ').replace(/\b20\d{2}\b/g, ' ')
  t = t.replace(/[【】\[\]（）()、,，。:：|｜\-—_~"'`!?！？*#]/g, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

function cleanEn(text: string): string {
  let t = String(text || '')
  for (const w of NOISE_EN) {
    t = t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  }
  t = t.replace(/\s*[-–—|,]\s*$/g, '')
  t = t.replace(/\s{2,}/g, ' ').trim()
  return t
}

async function httpGet(url: string, timeout = 15000): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** 单段翻译 */
async function translateChunk(text: string): Promise<string> {
  const t = text.trim()
  if (!t) return ''
  if (!/[一-龥]/.test(t)) return t

  // 1) Google gtx
  try {
    const body = await httpGet(GOOGLE_TXT + encodeURIComponent(t))
    const j = JSON.parse(body)
    if (Array.isArray(j?.[0])) {
      const out = j[0].map((seg: any) => seg?.[0] || '').join('').trim()
      if (out) return out
    }
  } catch {}

  // 2) MyMemory
  try {
    const body = await httpGet(
      MYMEMORY + encodeURIComponent(t) + '&langpair=zh-CN|en'
    )
    const j = JSON.parse(body)
    const out = j?.responseData?.translatedText
    if (out) return out
  } catch {}

  return t
}

/** 长文本分段翻译（按句号切分，每段 < 450 字符） */
export async function translateToEnglish(text: string): Promise<string> {
  const src = String(text || '').trim()
  if (!src) return ''
  if (!/[一-龥]/.test(src)) return src

  const parts = src
    .split(/(?<=[。！？；!?;\n])/)
    .flatMap(p => (p.length > 450 ? p.match(/[\s\S]{1,450}/g) || [p] : [p]))
    .map(p => p.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const p of parts) {
    out.push(await translateChunk(p))
    await new Promise(r => setTimeout(r, 150))
  }
  return out.join(' ').replace(/\s{2,}/g, ' ').trim()
}

/** 关键词：取标题里的实词（英文 3-8 字母以上） */
export function extractKeywords(enTitle: string, limit = 8): string[] {
  const words = cleanEn(enTitle)
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(w => w.length >= 3 && !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are'].includes(w))
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 生成 SEO 标题：主体词 + 品类补齐 + 长度控制
 * 例：Women's High-Waist Yoga Leggings with Side Pocket Slim Fit Sports Leggings
 */
export function buildSeoTitle(enTitle: string, categoryHint = ''): string {
  let t = cleanEn(enTitle)
  if (!t) return ''

  // 首字母大写
  t = t.charAt(0).toUpperCase() + t.slice(1)

  // 去掉重复词
  const words = t.split(' ')
  const seen = new Set<string>()
  t = words
    .filter(w => {
      const k = w.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .join(' ')

  // 长度控制：SEO 标题建议 ≤ 90 字符
  if (t.length > 90) {
    const cut = t.slice(0, 90)
    const lastSpace = cut.lastIndexOf(' ')
    t = (lastSpace > 50 ? cut.slice(0, lastSpace) : cut).trim()
  }

  // 批发站惯例：品类后缀
  const hint = cleanEn(categoryHint)
  if (hint && !t.toLowerCase().includes(hint.toLowerCase())) {
    t = `${t} ${hint}`
  }
  return t.trim()
}

export interface TranslateResult {
  titleEn: string
  seoTitle: string
  shortDescEn: string
  descriptionEn: string
  keywords: string[]
}

/** 采集品 → 英文 + SEO 素材 */
export async function translateSupplierItem(params: {
  title: string
  description?: string | null
  attributes?: Record<string, any> | null
  supplierName?: string | null
  categoryHint?: string | null
}): Promise<TranslateResult> {
  const { title, description, attributes, supplierName, categoryHint } = params

  const cleanTitle = stripNoise(title)
  const titleEn = cleanEn(await translateChunk(cleanTitle || title))
  const seoTitle = buildSeoTitle(titleEn, categoryHint || '')

  // 属性翻译（面料名称、适用人群…）
  let attrText = ''
  if (attributes && typeof attributes === 'object') {
    const pairs = Object.entries(attributes).slice(0, 10)
    if (pairs.length) {
      const zh = pairs.map(([k, v]) => `${k}: ${v}`).join('；')
      attrText = await translateChunk(zh)
    }
  }

  const descSrc = String(description || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const descriptionEn = descSrc ? cleanEn(await translateToEnglish(descSrc.slice(0, 1200))) : ''

  const shortDescEn = (seoTitle || titleEn || '').slice(0, 160)

  return {
    titleEn: titleEn || '',
    seoTitle: seoTitle || '',
    shortDescEn,
    descriptionEn: [descriptionEn, attrText].filter(Boolean).join('\n\n'),
    keywords: extractKeywords(seoTitle || titleEn),
  }
}
