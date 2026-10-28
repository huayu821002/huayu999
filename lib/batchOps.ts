/**
 * 后台批量操作（2026-10-28）
 *
 * 三种批量操作，全部走这里，方便单测：
 *   ① batchInventory —— 批量加库存
 *   ② batchPrice     —— 批量改价
 *   ③ batchRename    —— 批量改名（规则：颜色 + 随机数字）
 *
 * 数据形状（Product 表）：
 *   inventory  Int              商品总库存
 *   price      Float            商品主价
 *   variants   String(JSON)     [{ id, name, value, sku, price, inventory, image, specs }]
 *   variantDims String(JSON)    [{ name, kind, values: [] }]
 *
 * ⚠️ 改名时 **value 和 specs 里的颜色值必须同步改**，
 *    否则前台多维度选择器显示的还是旧名字（选择器读的是 specs）。
 *    variantDims.values 也要跟着更新，否则维度面板对不上。
 */

export type BatchVariant = {
  id?: string
  name?: string
  value?: string
  sku?: string | null
  price?: number | string | null
  inventory?: number | string | null
  image?: string | null
  specs?: Array<{ name?: string; value?: string }>
}

export type BatchProduct = {
  id?: string
  name?: string
  price?: number
  comparePrice?: number | null
  inventory?: number
  variants?: string | BatchVariant[] | null
  variantDims?: string | Array<{ name?: string; kind?: string; values?: string[] }> | null
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

export function parseVariants(raw: unknown): BatchVariant[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as BatchVariant[]
  try {
    const v = JSON.parse(String(raw))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function parseDims(raw: unknown): Array<{ name?: string; kind?: string; values?: string[] }> {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as any
  try {
    const v = JSON.parse(String(raw))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** 变体的「颜色值」：优先取 specs 里颜色维度的值，其次取展示值本身 */
export function colorValueOf(v: BatchVariant): string {
  const specs = Array.isArray(v.specs) ? v.specs : []
  const colorSpec = specs.find(s => s && typeof s.name === 'string' && /颜色|色|color/i.test(s.name))
  if (colorSpec && colorSpec.value) return String(colorSpec.value).trim()
  // 没有 specs → 展示值里可能已经带了颜色（"1 粉色"）
  const val = String(v.value || '').trim()
  return val
}

/** 生成随机数字串（4 位，默认 1000-9999），用 0 补齐 */
export function randomDigits(n: number, rand: () => number = Math.random): string {
  const len = Math.max(1, Math.min(6, Math.floor(n) || 4))
  const lo = Math.pow(10, len - 1)
  const span = Math.pow(10, len) - lo
  const v = lo + Math.floor(rand() * span)
  return String(v).slice(0, len)
}

/* ------------------------------------------------------------------ */
/* ① 批量加库存                                                       */
/* ------------------------------------------------------------------ */

export type InventoryParams = {
  /** add = 在现有基础上加；set = 直接设为该值 */
  mode: 'add' | 'set'
  /** 数量 */
  value: number
  /** 作用范围 */
  scope: 'variant' | 'product' | 'both'
}

export function batchInventory(
  product: BatchProduct,
  params: InventoryParams
): { product: BatchProduct; variantCount: number; changed: boolean } {
  const mode = params.mode === 'set' ? 'set' : 'add'
  const value = Math.max(0, Math.floor(Number(params.value) || 0))
  const scope = params.scope || 'both'

  const out: BatchProduct = { ...product }
  const variants = parseVariants(product.variants)
  let variantCount = 0
  let changed = false

  if (scope === 'variant' || scope === 'both') {
    const next = variants.map(v => {
      const cur = v.inventory === null || v.inventory === undefined || v.inventory === ''
        ? 0
        : Number(v.inventory)
      const base = Number.isFinite(cur) ? cur : 0
      // ★ 库存为 null（1688 采集的未知库存）→ 从 0 起算，
      //   「加 N」= N，「设为 N」= N
      const nextInv = mode === 'set' ? value : base + value
      const inv = Math.max(0, Math.round(nextInv))
      if (inv !== cur) changed = true
      variantCount++
      return { ...v, inventory: inv }
    })
    if (next.length) out.variants = JSON.stringify(next)
  }

  if (scope === 'product' || scope === 'both') {
    const cur = Number(product.inventory) || 0
    const nextInv = mode === 'set' ? value : cur + value
    const inv = Math.max(0, Math.round(nextInv))
    if (inv !== cur) changed = true
    out.inventory = inv
  }

  return { product: out, variantCount, changed }
}

/* ------------------------------------------------------------------ */
/* ② 批量改价                                                         */
/* ------------------------------------------------------------------ */

export type PriceParams = {
  /** percent = 按百分比增减；set = 直接设为该值 */
  mode: 'percent' | 'set'
  /** 百分比（如 10 = +10%，-20 = -20%）或绝对值 */
  value: number
  /** 作用范围 */
  scope: 'variant' | 'product' | 'both'
  /** 是否同步改 comparePrice（划线价） */
  alsoCompare?: boolean
}

function applyPriceValue(
  cur: number | string | null | undefined,
  mode: 'percent' | 'set',
  value: number
): number | null {
  if (mode === 'set') {
    const v = Number(value)
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
  }
  const base = Number(cur)
  if (!Number.isFinite(base)) return null
  const pct = Number(value)
  if (!Number.isFinite(pct)) return null
  const next = base * (1 + pct / 100)
  return Math.max(0, Math.round(next * 100) / 100)
}

export function batchPrice(
  product: BatchProduct,
  params: PriceParams
): { product: BatchProduct; variantCount: number; changed: boolean } {
  const mode = params.mode === 'set' ? 'set' : 'percent'
  const scope = params.scope || 'both'
  const out: BatchProduct = { ...product }
  const variants = parseVariants(product.variants)
  let variantCount = 0
  let changed = false

  if (scope === 'variant' || scope === 'both') {
    const next = variants.map(v => {
      const p = applyPriceValue(v.price, mode, params.value)
      variantCount++
      if (p !== null && p !== Number(v.price)) changed = true
      return { ...v, price: p }
    })
    if (next.length) out.variants = JSON.stringify(next)
  }

  if (scope === 'product' || scope === 'both') {
    const p = applyPriceValue(product.price, mode, params.value)
    if (p !== null && p !== Number(product.price)) {
      out.price = p
      changed = true
    }
    if (params.alsoCompare && product.comparePrice != null) {
      const cp = applyPriceValue(product.comparePrice, mode, params.value)
      if (cp !== null) {
        out.comparePrice = cp
        changed = true
      }
    }
  }

  return { product: out, variantCount, changed }
}

/* ------------------------------------------------------------------ */
/* ③ 批量改名（颜色 + 随机数字）                                       */
/* ------------------------------------------------------------------ */

export type RenameParams = {
  /** 随机数字位数 */
  digits?: number
  /** 颜色与数字之间的分隔符 */
  sep?: string
  /** 前缀（可选），如 "F" */
  prefix?: string
  /** 作用范围：只改变体，还是也改商品名 */
  scope?: 'variant' | 'product' | 'both'
}

export function batchRename(
  product: BatchProduct,
  params: RenameParams,
  rand: () => number = Math.random
): { product: BatchProduct; variantCount: number; changed: boolean; names: string[] } {
  const digits = params.digits ?? 4
  const sep = params.sep ?? ' '
  const prefix = params.prefix ?? ''
  const scope = params.scope || 'variant'
  const out: BatchProduct = { ...product }
  const variants = parseVariants(product.variants)
  const names: string[] = []
  let changed = false

  // 同一商品内，随机数字不能重复
  const used = new Set<string>()

  if (scope === 'variant' || scope === 'both') {
    const next = variants.map(v => {
      const color = colorValueOf(v)
      if (!color) return v
      let num = randomDigits(digits, rand)
      let guard = 0
      while (used.has(num) && guard < 50) {
        num = randomDigits(digits, rand)
        guard++
      }
      used.add(num)
      const newValue = `${prefix}${color}${sep}${num}`.trim()
      names.push(newValue)
      if (newValue !== v.value) changed = true

      // ★ specs 里的颜色值必须同步，否则前台选择器还显示旧名
      const specs = Array.isArray(v.specs)
        ? v.specs.map(s => {
            if (!s || typeof s.name !== 'string') return s
            if (!/颜色|色|color/i.test(s.name)) return s
            return { ...s, value: newValue }
          })
        : v.specs
      return { ...v, value: newValue, specs }
    })
    if (next.length) out.variants = JSON.stringify(next)

    // ★ variantDims.values 也要同步（维度面板显示用）
    const dims = parseDims(product.variantDims)
    if (dims.length) {
      const newDims = dims.map(d => {
        const vals = Array.isArray(d.values) ? d.values : []
        const isColor = /颜色|色|color/i.test(String(d.name || ''))
        if (!isColor) return d
        // 用变体的旧 value → 新 value 做映射
        const map = new Map<string, string>()
        variants.forEach((v, i) => {
          if (next[i] && next[i].value !== v.value) map.set(String(v.value || ''), String(next[i].value || ''))
        })
        return {
          ...d,
          values: vals.map(x => map.get(String(x)) || String(x)),
        }
      })
      out.variantDims = JSON.stringify(newDims)
    }
  }

  if (scope === 'product' || scope === 'both') {
    // 商品名：取第一个变体的颜色（或商品名首词）+ 随机数字
    const color = variants.length ? colorValueOf(variants[0]) : String(product.name || '')
    if (color) {
      let num = randomDigits(digits, rand)
      let guard = 0
      while (used.has(num) && guard < 50) {
        num = randomDigits(digits, rand)
        guard++
      }
      used.add(num)
      const newName = `${prefix}${color}${sep}${num}`.trim()
      names.push(newName)
      if (newName !== product.name) {
        out.name = newName
        changed = true
      }
    }
  }

  return { product: out, variantCount: variants.length, changed, names }
}
