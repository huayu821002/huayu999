import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CURRENCY_RATES, CURRENCY_SYMBOLS, CURRENCY_DECIMALS, type Currency } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ★ 2026-10-30 币种口径统一（方案 i：全站内部统一存 USD，只在展示层换算）
 *
 * 约定（全站唯一口径）：
 *   - **所有内部金额值（state / API payload / 数据库 / PayPal 金额）都是 USD 原值**
 *   - `formatCurrency(usdAmount, currency)` 是**唯一的展示层换算入口**：
 *     入参必须是 USD 原值，内部乘一次汇率得到目标币种展示串。
 *   - **禁止** `formatCurrency(convertPrice(x, currency), currency)` —— 那是双重换算
 *     （多币种功能 76706b7 引入后一直存在，导致 KRW/IDR 金额膨胀上千倍）。
 */
export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const rate = CURRENCY_RATES[currency]
  const converted = amount * rate
  const decimals = CURRENCY_DECIMALS[currency]
  
  return `${symbol}${converted.toFixed(decimals)}`
}

/**
 * 格式化一个**已经是目标币种**的金额（只加符号 + 小数位，**不乘汇率**）。
 *
 * 用于：订单记录（Order.currency 就是金额本身的币种，金额已按该币种存库）、
 * 后台订单列表、订单邮件等「值已经是该币种」的场合。
 * 切勿与 formatCurrency 混用：formatCurrency 的入参是 USD 原值。
 */
export function formatAmount(amount: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency as Currency] || '$'
  const decimals = CURRENCY_DECIMALS[currency as Currency] ?? 2
  return `${symbol}${(Number(amount) || 0).toFixed(decimals)}`
}

/**
 * 把 USD 原值换算成目标币种的**数值**（不是字符串）。
 * 仅在确实需要「目标币种数值」时使用（如 PayPal 金额 —— 本项目 PayPal 固定 USD，
 * 所以结算链路现在不需要它）。展示请一律用 formatCurrency。
 */
export function convertPrice(priceUSD: number, toCurrency: Currency): number {
  return priceUSD * CURRENCY_RATES[toCurrency]
}

/**
 * 反向换算：把「已经是某币种」的金额折回 USD。
 * 用于历史订单（当时存的是已换算值 + 对应 currency）重新支付时回算 USD。
 */
export function toUSD(amount: number, fromCurrency: string): number {
  const rate = CURRENCY_RATES[fromCurrency as Currency] || 1
  return rate === 0 ? amount : amount / rate
}

/**
 * 按数量档位算价。**返回 USD 原值**（不再内部换算）——
 * 调用方需要展示时自己调 formatCurrency(price, currency) 换算一次。
 */
export function getPriceByTier(
  price: number,
  quantity: number
): { tier: string; price: number; total: number } {
  let tier: string
  let multiplier: number

  if (quantity <= 10) {
    tier = 'RETAIL'
    multiplier = 1
  } else if (quantity <= 100) {
    tier = 'WHOLESALE'
    multiplier = 0.9 // 10% off
  } else {
    tier = 'VIP'
    multiplier = 0.85 // 15% off
  }

  const unitPrice = price * multiplier
  return {
    tier,
    price: unitPrice,
    total: unitPrice * quantity,
  }
}

export interface TierPrice {
  minQty: number
  maxQty: number | null // null means unlimited
  price: number
}

/**
 * 安全解析 tags 字段。
 *
 * 踩坑（2026-10-25）：发布路由之前把 tags 存成**逗号串**（"1688,采集品,1059632648130"），
 * 而前台 `JSON.parse(product.tags)` → 直接抛异常 → 整页
 * "Application error: a client-side exception has occurred"。
 * → 解析必须容错：JSON 数组 / JSON 对象 / 逗号串 都要能吃。
 */
export function parseTags(tags: string | null | undefined): string[] {
  const raw = String(tags || '').trim()
  if (!raw) return []
  // 1) JSON 数组
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        return arr
          .map((t: any) => (t && typeof t === 'object' ? String(t.name || t.value || '') : String(t || '')))
          .filter(Boolean)
      }
    } catch {
      /* 落到下面按逗号切 */
    }
  }
  // 2) 逗号串（老数据）
  if (raw.includes(',')) {
    return raw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  }
  // 3) 单个值
  return [raw]
}

export function getTieredPricing(tieredPricingStr: string | null | undefined, basePrice: number): TierPrice[] {
  // Default tiers if no tiered pricing is set
  const defaultTiers: TierPrice[] = [
    { minQty: 1, maxQty: 10, price: basePrice },
    { minQty: 11, maxQty: 100, price: basePrice * 0.9 },
    { minQty: 101, maxQty: null, price: basePrice * 0.85 },
  ]

  if (!tieredPricingStr) {
    return defaultTiers
  }

  try {
    const parsed = JSON.parse(tieredPricingStr)
    if (parsed && Array.isArray(parsed.tiers) && parsed.tiers.length > 0) {
      return parsed.tiers.map((t: any) => {
        // 老格式（采集直接塞进来的阶梯价）：{ spec, price(CNY), skuId }
        // 没有 minQty/maxQty，且 price 是**人民币原价** → 不能直接当 USD 显示
        const isLegacy = t.minQty === undefined && t.maxQty === undefined && t.spec !== undefined
        return {
          minQty: t.minQty ?? 1,
          maxQty: t.maxQty ?? null,
          price: isLegacy ? basePrice : (t.price ?? basePrice),
        }
      })
    }
  } catch {
    // Invalid JSON, return defaults
  }

  return defaultTiers
}

export function getPriceFromTieredPricing(
  tieredPricing: TierPrice[],
  quantity: number
): { tier: string; price: number; total: number } {
  // ★ 2026-10-28 修：档位匹配必须**优先选区间明确包含数量的那档**。
  //   采集写入的阶梯价形状是 {minQty:1,maxQty:null} / {minQty:5,maxQty:null} / {minQty:10,maxQty:null}
  //   —— 每一档 maxQty 都是 null（旧 find 逻辑下 minQty:1 那档永远命中，
  //   于是「买 10 件」和「买 1 件」显示同一个价，量价折扣完全失效）。
  //   正确语义：maxQty=null 表示「直到下一档的 minQty - 1」。
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  const sorted = [...(tieredPricing || [])].sort((a, b) => a.minQty - b.minQty)

  // 1) 区间明确包含数量的档（maxQty 有值）
  const ranged = sorted.find(
    t => t.maxQty !== null && qty >= t.minQty && qty <= t.maxQty
  )
  // 2) 否则取「minQty <= qty 的最后一档」（maxQty=null 的开区间档）
  const openEnded = [...sorted].reverse().find(t => qty >= t.minQty)

  const tier = ranged || openEnded || sorted[0]

  if (!tier) {
    return { tier: 'RETAIL', price: 0, total: 0 }
  }

  return {
    tier: tier.minQty >= 101 ? 'VIP' : tier.minQty >= 11 ? 'WHOLESALE' : 'RETAIL',
    price: tier.price,
    total: tier.price * qty,
  }
}

/**
 * 变体感知的阶梯价（2026-10-28）
 *
 * 背景：发布时写入的 tieredPricing 是**商品级**阶梯价
 *   {"tiers":[{"minQty":1,"maxQty":null,"price":5.83}]}
 * 前台主价格取的是 tiers[0].price → 选任何变体都是 5.83，
 * 变体价（currentVariant.price）虽然算出来了却没参与显示。
 *
 * 修复思路：阶梯价的**档位结构**（minQty/maxQty 和相对折扣比例）来自数据库，
 * 但**每档的绝对价格**要跟着当前变体价走。
 *   ratio = 变体价 / 商品基准价（tieredPricing 里 minQty 最小那档的价格）
 *   每档新价 = 原价 × ratio
 * 这样：
 *   - 单档商品（minQty:1 一个档）→ 新价 = 变体价，完全跟随变体
 *   - 多档商品 → 各档按同比例缩放，保留量价折扣结构
 *
 * @param tieredPricingStr  数据库里的阶梯价 JSON
 * @param basePrice         商品基准价（product.price）
 * @param variantPrice      当前选中变体的价（没有变体时传 null）
 */
export function getVariantAwareTiers(
  tieredPricingStr: string | null | undefined,
  basePrice: number,
  variantPrice: number | null | undefined
): TierPrice[] {
  const base = Number(basePrice)
  const vp = Number(variantPrice)

  // 没变体 / 变体价无效 → 用商品基准价算（保持原行为）
  if (!Number.isFinite(vp) || vp <= 0) {
    return getTieredPricing(tieredPricingStr, base)
  }

  // 先按商品基准价拿到「原始档位结构」
  const tiers = getTieredPricing(tieredPricingStr, base)
  if (!tiers.length) return tiers

  // 缩放基准 = 档位里最小 minQty 那档的价格（发布时它就是商品基准价）
  const anchorTier = tiers.reduce((a, b) => (b.minQty < a.minQty ? b : a))
  const anchorPrice = Number(anchorTier?.price)

  // 基准不可用（0 / NaN）→ 退化成「变体价作为第一档，其余按原比例」
  if (!Number.isFinite(anchorPrice) || anchorPrice <= 0) {
    return tiers.map(t => ({
      ...t,
      price:
        t.minQty === anchorTier.minQty
          ? Math.round(vp * 100) / 100
          : Math.round(Number(t.price) * 100) / 100,
    }))
  }

  const ratio = vp / anchorPrice
  // 比例几乎为 1 → 不动，避免无意义的浮点扰动
  if (Math.abs(ratio - 1) < 1e-9) return tiers

  return tiers.map(t => ({
    ...t,
    // 第一档（minQty 最小）直接等于变体价，避免四舍五入误差
    price:
      t.minQty === anchorTier.minQty
        ? Math.round(vp * 100) / 100
        : Math.round(t.price * ratio * 100) / 100,
  }))
}

export function getCurrencyFromTimezone(timezone: string): Currency {
  const currencyMap: Record<string, Currency> = {
    // Americas
    'America/New_York': 'USD',
    'America/Los_Angeles': 'USD',
    'America/Chicago': 'USD',
    'America/Denver': 'USD',
    'America/Phoenix': 'USD',
    'America/Toronto': 'USD',
    'America/Vancouver': 'USD',
    // Asia Pacific
    'Australia/Sydney': 'AUD',
    'Australia/Melbourne': 'AUD',
    'Australia/Brisbane': 'AUD',
    'Australia/Perth': 'AUD',
    'Australia/Adelaide': 'AUD',
    'Pacific/Auckland': 'AUD',
    'Asia/Seoul': 'KRW',
    'Asia/Tokyo': 'JPY',
    'Asia/Jakarta': 'IDR',
    'Asia/Shanghai': 'SGD',
    'Asia/Singapore': 'SGD',
    'Asia/Kuala_Lumpur': 'MYR',
  }

  return currencyMap[timezone] || 'AUD'
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function formatOrderNumber(orderNumber: string): string {
  return `#${orderNumber}`
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `JH-${timestamp}-${random}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function calculateShipping(
  subtotal: number,
  zone: 'NORTH_AMERICA' | 'SOUTH_AMERICA'
): { cost: number; free: boolean } {
  const zones = {
    NORTH_AMERICA: { price: 12.99, freeThreshold: 299 },
    SOUTH_AMERICA: { price: 18.99, freeThreshold: 499 },
  }
  
  const { price, freeThreshold } = zones[zone]
  return {
    cost: subtotal >= freeThreshold ? 0 : price,
    free: subtotal >= freeThreshold,
  }
}

export function getWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  const encodedMessage = message ? encodeURIComponent(message) : ''
  return `https://wa.me/${cleanPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`
}

export function getTikTokShareLink(url: string, text?: string): string {
  const encodedUrl = encodeURIComponent(url)
  const encodedText = text ? encodeURIComponent(text) : ''
  return `https://www.tiktok.com/share/item?url=${encodedUrl}&text=${encodedText}`
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function parseSearchParams(searchParams: URLSearchParams) {
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const sort = searchParams.get('sort') || 'featured'
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  const inStock = searchParams.get('inStock') === 'true'
  
  return { category, search, sort, minPrice, maxPrice, inStock }
}
