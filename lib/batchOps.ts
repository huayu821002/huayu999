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
  const nextNum = () => {
    let num = randomDigits(digits, rand)
    let guard = 0
    while (used.has(num) && guard < 50) {
      num = randomDigits(digits, rand)
      guard++
    }
    used.add(num)
    return num
  }

  // 颜色维度在 specs 里的下标；-1 = 没有颜色维度
  const colorIdxOf = (v: BatchVariant) => {
    const specs = Array.isArray(v.specs) ? v.specs : []
    return specs.findIndex(
      s => s && typeof s.name === 'string' && /颜色|色|color/i.test(s.name)
    )
  }

  if (scope === 'variant' || scope === 'both') {
    const next = variants.map(v => {
      const specs = Array.isArray(v.specs) ? v.specs : []
      const colorIdx = colorIdxOf(v)
      const oldColor = colorValueOf(v)
      if (!oldColor) return v

      const num = nextNum()
      const newColor = `${prefix}${oldColor}${sep}${num}`.trim()
      names.push(newColor)

      // ★ 单维度 vs 多维度，策略完全不同：
      //
      // 单维度（specs.length <= 1）：value / specs / dims 全部同步。
      //   前台单维度路径显示 variant.value，多维度路径显示 specs 派生的行，
      //   两种显示都得是新名，所以三处必须一起改。
      //
      // 多维度（specs.length > 1）：**只改 variant.value，绝不动 specs / dims**。
      //   因为维度值是多个变体共享的 —— 「粉色」被 粉色/M、粉色/L 共用，
      //   给它加随机数会把它撑成 3 个维度值，维度结构直接坏掉。
      //   随机数加在 value 的颜色片段上：「粉色 / M」→「粉色 8697 / M」，
      //   变体本身唯一，维度结构完好。
      if (specs.length <= 1) {
        const newSpecs = specs.length
          ? [{ ...specs[0], value: newColor }]
          : specs
        if (newColor !== v.value) changed = true
        return { ...v, value: newColor, specs: newSpecs }
      }

      // 多维度：替换 value 里对应颜色维度的那一段
      const parts = String(v.value || '').split(' / ')
      let newValue: string
      if (colorIdx >= 0 && parts.length === specs.length) {
        parts[colorIdx] = newColor
        newValue = parts.join(' / ')
      } else {
        // 兜底：value 的片段数和 specs 对不上 → 整体追加
        newValue = `${prefix}${String(v.value || '').trim()}${sep}${num}`.trim()
      }
      if (newValue !== v.value) changed = true
      return { ...v, value: newValue, specs }
    })
    if (next.length) out.variants = JSON.stringify(next)

    // ★ variantDims 也要同步（后台维度面板 / 复制变体时用；前台不用这个字段）
    //
    //   注意：不能简单做「旧值 → 新值」一对一替换。
    //   真实生产数据里存在**多个变体共享同一个颜色值**的情况
    //   （如两个变体颜色都是 "Rhinestone Bow Hairpin…"），
    //   一对一 map 会被后者覆盖 → dims 里两个值都变成同一个新值，
    //   和变体的 value 对不上。
    //   所以改成：**用变体新的颜色值集合重建**（去重、保序）。
    //
    //   只在「所有变体都是单规格」时重建 —— 多规格时维度值本来没变。
    const dims = parseDims(product.variantDims)
    const allSingleSpec = variants.every(v => (Array.isArray(v.specs) ? v.specs.length : 0) <= 1)
    if (dims.length && allSingleSpec && next.length) {
      const oldColorSet = new Set(variants.map(v => String(colorValueOf(v) || '')))
      const newDims = dims.map(d => {
        const vals = Array.isArray(d.values) ? d.values : []
        const isColor = /颜色|色|color/i.test(String(d.name || ''))
        if (!isColor) return d
        // 用变体新的颜色值重建（去重、保序）
        const rebuilt: string[] = []
        next.forEach(v => {
          const c = String(v.value || '').trim()
          if (c && !rebuilt.includes(c)) rebuilt.push(c)
        })
        if (!rebuilt.length) return d
        // 变体没覆盖到的历史值保留在后面，不丢数据
        const extra = vals.filter(x => !oldColorSet.has(String(x)))
        return { ...d, values: [...rebuilt, ...extra] }
      })
      out.variantDims = JSON.stringify(newDims)
    }
  }

  if (scope === 'product' || scope === 'both') {
    // 商品名：**保留原标题**，末尾加随机数字。
    // （不能只拿颜色 —— 那样商品名会变成 "5B 8697"，标题全丢，前台列表没法看）
    const base = String(product.name || '').trim()
    if (base) {
      const num = nextNum()
      const newName = `${base}${sep}${num}`.trim()
      names.push(newName)
      if (newName !== product.name) {
        out.name = newName
        changed = true
      }
    }
  }

  return { product: out, variantCount: variants.length, changed, names }
}
