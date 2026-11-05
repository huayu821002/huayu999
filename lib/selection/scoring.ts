/**
 * 选品 Agent —— 打分引擎
 *
 * 设计原则：**能用公式算的绝不让 AI 算**
 *   - 供给分、利润分 = 纯规则计算（可复现、可审计、零成本）
 *   - 需求分、竞争分 = AI 判断（需要语义理解，公式算不出来）
 *   - 套装分 = 规则聚类 + AI 复核配色是否真能成套
 *
 * 权重来自《义乌帽/围巾/手套 AI-Agent 电商运营方案 v2》3.2 节：
 *   总分 = 0.30×需求分 + 0.25×(10-竞争分) + 0.20×供给分 + 0.25×利润分 − 风险惩罚
 */

export type Candidate = {
  /** 内部 id */
  id: string
  title: string
  /** 1688 链接 */
  url?: string
  /** 批发价（元） */
  cost?: number
  /** 起批量 */
  moq?: number
  /** 供应商名 */
  supplier?: string
  /** 变体数 */
  variantCount?: number
  /** 主图 URL 列表 */
  images?: string[]
  /** 描述 */
  description?: string
  /** 1688 货号 */
  sourceSkuId?: string
  /** 类目（帽/围巾/手套/套装） */
  category?: string
}

export type RuleScores = {
  supply: number
  profit: number
  /** 单位经济明细（取最优渠道） */
  economics: {
    cost: number
    sellPrice: number
    shipping: number
    platformFee: number
    channelFee: number
    adCost: number
    returnLoss: number
    net: number
    margin: number
    /** 最优渠道 */
    channel: string
    /** 两个渠道对比 */
    byChannel: Array<{ key: string; label: string; net: number; margin: number }>
  }
  risks: string[]
  hardFail?: string
}

export type TotalScore = {
  demand: number
  competition: number
  supply: number
  profit: number
  bundle: number
  total: number
  risks: string[]
  hardFail?: string
  reasons: string[]
}

/** 平台参数（服饰类经验区间，实际以各平台后台公告为准） */
export const PLATFORM = {
  /** 抖店服饰类佣金 */
  commissionRate: 0.08,
  /** 精选联盟达人佣金（仅达人分销渠道） */
  affiliateRate: 0.25,
  /** 自投流占销售额（仅自播渠道） */
  adRate: 0.15,
  /** 尺码类退货率（服饰普遍高，尺码类取高值） */
  returnRate: 0.28,
  /** 快递成本（按品类：帽子轻、围巾手套重） */
  shipping: 6,
  /** 按品类细分的快递成本 */
  shippingByCategory: {
    帽子: 4,
    围巾: 6,
    手套: 5,
    套装: 8,
  } as Record<string, number>,
  /** 单件净利红线 */
  minNet: 8,
  /** 退货率红线 */
  maxReturnRate: 0.35,
  /** 投流占比红线 */
  maxAdRate: 0.25,
}

/**
 * ★ 关键修正（2026-11-05）
 * 原来的模型把「达人佣金 25% + 自投流 15% + 退货 28%」全叠在一笔订单上，
 * 结果所有款都是负净利 —— 这是模型错误，不是货不对。
 * 实际两种打法二选一：
 *   A. 达人分销（精选联盟）：佣金 25%，但**几乎不投流**，退货率略高
 *   B. 自播自投：投流 15%，**没有达人佣金**，退货率略低
 * 取两者净利更高的一档，这才是真实的「最优渠道」。
 */
export const CHANNELS = {
  affiliate: {
    key: 'affiliate',
    label: '达人分销',
    commissionRate: 0.25,
    adRate: 0.02,
    returnRate: 0.30,
  },
  self: {
    key: 'self',
    label: '自播自投',
    commissionRate: 0.0,
    adRate: 0.15,
    returnRate: 0.26,
  },
} as const

/** 目标零售价倍数（按品类定） */
const PRICE_MULTIPLE: Record<string, number> = {
  帽子: 3.2,
  围巾: 3.0,
  手套: 3.2,
  套装: 2.6, // 套装折扣，客单高但倍率低
}

export function priceMultiple(cat?: string): number {
  if (!cat) return 3.0
  for (const k of Object.keys(PRICE_MULTIPLE)) if (cat.includes(k)) return PRICE_MULTIPLE[k]
  return 3.0
}

/** 按品类取快递成本 */
export function shippingCost(cat?: string): number {
  if (!cat) return PLATFORM.shipping
  for (const k of Object.keys(PLATFORM.shippingByCategory)) {
    if (cat.includes(k)) return PLATFORM.shippingByCategory[k]
  }
  return PLATFORM.shipping
}

/**
 * 供给分（纯规则）
 * 起批量 / 变体丰富度 / 描述完整度 / 价格带
 */
export function scoreSupply(c: Candidate): { score: number; risks: string[] } {
  const risks: string[] = []
  let s = 5

  const moq = c.moq ?? 0
  if (moq <= 0) {
    s += 1
  } else if (moq <= 50) {
    s += 3
  } else if (moq <= 100) {
    s += 2
  } else if (moq <= 300) {
    s += 0.5
    risks.push(`起批量偏高(${moq})，压库存风险`)
  } else {
    s -= 2
    risks.push(`起批量过高(${moq})，不适合新手`)
  }

  const vc = c.variantCount ?? 0
  if (vc >= 6) s += 1.5
  else if (vc >= 3) s += 1
  else if (vc === 0) {
    s -= 0.5
    risks.push('无变体信息，规格不明易产生退货纠纷')
  }

  const hasDesc = (c.description || '').length > 40
  if (hasDesc) s += 0.5

  const imgs = c.images?.length ?? 0
  if (imgs >= 4) s += 1
  else if (imgs === 0) {
    s -= 1
    risks.push('无图片，详情页无法做')
  }

  const cost = c.cost ?? 0
  if (cost > 0 && cost <= 30) s += 0.5

  return { score: clamp(s, 0, 10), risks }
}

/**
 * 利润分（纯规则，单位经济模型）
 * 两种渠道各算一遍，取净利高的一档作为最优渠道。
 */
export function scoreProfit(c: Candidate): {
  score: number
  economics: RuleScores['economics']
  risks: string[]
  hardFail?: string
} {
  const risks: string[] = []
  const cost = c.cost ?? 0
  const mult = priceMultiple(c.category)
  const sellPrice = round2(cost * mult)
  const shipping = shippingCost(c.category)
  const platformFee = round2(sellPrice * PLATFORM.commissionRate)

  if (cost <= 0) {
    risks.push('无采购价，无法算利润')
    return {
      score: 0,
      economics: {
        cost: 0, sellPrice: 0, shipping, platformFee, channelFee: 0, adCost: 0,
        returnLoss: 0, net: 0, margin: 0, channel: '-', byChannel: [],
      },
      risks,
      hardFail: '缺采购价',
    }
  }

  // 两个渠道各算一遍
  const byChannel = Object.values(CHANNELS).map((ch) => {
    const channelFee = round2(sellPrice * ch.commissionRate)
    const adCost = round2(sellPrice * ch.adRate)
    const returnLoss = round2(sellPrice * ch.returnRate * 0.5)
    const net = round2(sellPrice - cost - shipping - platformFee - channelFee - adCost - returnLoss)
    const margin = sellPrice > 0 ? round2((net / sellPrice) * 100) : 0
    return { key: ch.key, label: ch.label, net, margin, channelFee, adCost, returnLoss }
  })

  const best = byChannel.slice().sort((a, b) => b.net - a.net)[0]

  let score = 0
  if (best.net >= 20) score = 9.5
  else if (best.net >= 15) score = 8.5
  else if (best.net >= 12) score = 7.5
  else if (best.net >= PLATFORM.minNet) score = 6
  else if (best.net >= 5) score = 4
  else if (best.net >= 0) score = 2
  else score = 0

  if (best.margin >= 45) score += 1
  else if (best.margin >= 35) score += 0.5
  else if (best.margin < 25) {
    score -= 1
    risks.push(`最优渠道净利率仅${best.margin}%，投流一超就亏`)
  }

  if (best.net < PLATFORM.minNet) {
    risks.push(`最优渠道单件净利${best.net}元 < 红线${PLATFORM.minNet}元`)
  }
  // 两渠道差距大 = 渠道依赖严重
  const spread = Math.abs(byChannel[0].net - byChannel[1].net)
  if (spread >= 8) risks.push(`渠道依赖重：达人分销${byChannel[0].net} vs 自播${byChannel[1].net}`)

  const economics: RuleScores['economics'] = {
    cost,
    sellPrice,
    shipping,
    platformFee,
    channelFee: best.channelFee,
    adCost: best.adCost,
    returnLoss: best.returnLoss,
    net: best.net,
    margin: best.margin,
    channel: best.label,
    byChannel: byChannel.map((b) => ({ key: b.key, label: b.label, net: b.net, margin: b.margin })),
  }

  return {
    score: clamp(score, 0, 10),
    economics,
    risks,
    hardFail: best.net < PLATFORM.minNet ? `单件净利不足(${best.net}元)` : undefined,
  }
}

/**
 * 总分合成
 */
export function composeScore(
  c: Candidate,
  ai: { demand: number; competition: number; bundle?: number; reasons?: string[]; risks?: string[] },
  rule: RuleScores
): TotalScore {
  const demand = clamp(ai.demand ?? 5, 0, 10)
  const competition = clamp(ai.competition ?? 5, 0, 10)
  const bundle = clamp(ai.bundle ?? 0, 0, 10)
  const risks = [...(rule.risks || []), ...(ai.risks || [])]
  const hardFail = rule.hardFail

  let total =
    0.3 * demand +
    0.25 * (10 - competition) +
    0.2 * rule.supply +
    0.25 * rule.profit +
    (bundle > 0 ? 0.5 : 0) * bundle - // 套装分额外加权，最多 +0.5
    risks.length * 0.3

  total = round2(clamp(total, 0, 10))

  const reasons = ai.reasons || []
  if (bundle >= 7) reasons.unshift(`套装潜力强(+${round2(bundle * 0.5)})`)
  if (hardFail) reasons.unshift(`硬性否决：${hardFail}`)

  return { demand, competition, supply: rule.supply, profit: rule.profit, bundle, total, risks, hardFail, reasons }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number(v) || 0))
}
export function round2(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100
}
