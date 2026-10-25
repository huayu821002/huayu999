/**
 * 变体转换：1688 采集变体 → 商品变体
 *
 * 采集变体长这样（来自 1688 采集器）：
 *   { skuId, specs:[{name:'颜色',value:'红色'}], color, size, specText, price(CNY), image }
 *
 * 商品变体长这样（前台 /api/products/[slug] 返回）：
 *   { id, name(维度名), value(展示值), sku, price(USD), inventory, image, specs }
 *
 * 关键约定：
 * - name = **维度名**（"颜色"），value = **值**（"红色"）—— 前台按这个渲染按钮
 * - 多维度时 value 用 " / " 连接（"红色 / M"）
 * - 每个变体保留 specs，前台才能拆解成多行选择器
 * - 价格 CNY → USD 走统一的加价/汇率
 */

export type SupplierVariant = {
  skuId?: string
  specs?: Array<{ name?: string; value?: string }>
  color?: string
  size?: string
  specText?: string
  price?: number | string | null
  image?: string
}

export type VariantDim = {
  name: string
  kind?: 'color' | 'size' | 'custom'
  values?: string[]
}

export type ProductVariant = {
  id: string
  name: string
  value: string
  sku: string | null
  price: number | null
  /** null = 库存未知（1688 不给可靠库存），前台此时不显示 “N left” */
  inventory: number | null
  image: string | null
  /** 维度取值明细，前台用于拆多行选择器 */
  specs: Array<{ name: string; value: string }>
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** CNY → USD */
export function cnyToUsd(cny: number | null, markup = 3, rate = 7.2): number | null {
  if (cny === null) return null
  return Math.round(((cny * markup) / rate) * 100) / 100
}

/**
 * 采集变体 → 商品变体
 * @param supplierVariants 采集到的变体数组
 * @param variantDims      采集到的维度定义（采集变体没有 specs 时用它兜底）
 */
export function toProductVariants(
  supplierVariants: SupplierVariant[],
  variantDims: VariantDim[] = [],
  opts: { markup?: number; rate?: number } = {}
): ProductVariant[] {
  const markup = opts.markup ?? 3
  const rate = opts.rate ?? 7.2
  const stamp = Date.now().toString(36).slice(-4)

  return (supplierVariants || [])
    .filter(v => v && typeof v === 'object')
    .map((v, i) => {
      const specs: Array<{ name: string; value: string }> = Array.isArray(v.specs)
        ? v.specs
            .filter((s: any) => s && (s.name || s.value))
            .map((s: any) => ({ name: String(s.name || '').trim(), value: String(s.value || '').trim() }))
            .filter(s => s.name && s.value)
        : []

      // 维度名：有 specs 用 specs 的，否则用维度定义
      const dimNames = specs.length
        ? Array.from(new Set(specs.map(s => s.name)))
        : (variantDims || []).map(d => String(d?.name || '')).filter(Boolean)

      // 展示值：单维度直接是值；多维度用 " / " 连接
      const displayValue = specs.length
        ? specs.map(s => s.value).join(' / ')
        : String(v.color || v.size || v.specText || '').trim()

      const cny = numOrNull(v.price)
      return {
        id: `${String(v.skuId || 'v')}-${i}-${stamp}`,
        name: (dimNames.join(' / ') || '选项').slice(0, 40),
        value: (displayValue || `变体 ${i + 1}`).slice(0, 80),
        sku: v.skuId ? String(v.skuId).slice(0, 80) : null,
        price: cnyToUsd(cny, markup, rate),
        inventory: null,
        image: v.image ? String(v.image).slice(0, 500) : null,
        specs,
      }
    })
    .filter(v => v.value)
}

/** 从商品变体里反推维度定义（前台/后台展示用） */
export function inferVariantDims(variants: ProductVariant[]): VariantDim[] {
  const map = new Map<string, { name: string; kind?: 'color' | 'size' | 'custom'; values: string[] }>()
  for (const v of variants || []) {
    for (const s of v?.specs || []) {
      if (!s?.name || !s?.value) continue
      if (!map.has(s.name)) map.set(s.name, { name: s.name, kind: inferKind(s.name), values: [] })
      const d = map.get(s.name)!
      if (!d.values.includes(s.value)) d.values.push(s.value)
    }
  }
  return Array.from(map.values())
}

function inferKind(name: string): 'color' | 'size' | 'custom' {
  if (/颜色|色|color/i.test(name)) return 'color'
  if (/尺码|尺寸|大小|size/i.test(name)) return 'size'
  return 'custom'
}

/* ------------------------------------------------------------------ *
 * 多维度选择器辅助（前台用）
 * ------------------------------------------------------------------ */

export type VariantSpec = { name: string; value: string }

/**
 * 从商品变体反推「维度行」：
 *   [{ name:'颜色', values:['红色','蓝色'] }, { name:'尺码', values:['M','L'] }]
 *
 * 没有 specs 的变体（旧数据/手填）→ 退化成单行，用 variant.name / variant.value
 */
export function buildVariantRows(variants: ProductVariant[]): Array<{ name: string; values: string[] }> {
  const rows: Array<{ name: string; values: string[] }> = []
  for (const v of variants || []) {
    const specs = v?.specs || []
    if (!specs.length) {
      // 旧格式：用 name/value 当唯一维度
      const name = v?.name || '选项'
      let row = rows.find(r => r.name === name)
      if (!row) { row = { name, values: [] }; rows.push(row) }
      if (v.value && !row.values.includes(v.value)) row.values.push(v.value)
      continue
    }
    for (const s of specs) {
      let row = rows.find(r => r.name === s.name)
      if (!row) { row = { name: s.name, values: [] }; rows.push(row) }
      if (s.value && !row.values.includes(s.value)) row.values.push(s.value)
    }
  }
  return rows
}

/**
 * 根据各维度的选中值，匹配出对应的变体。
 * 选了部分维度时，匹配「所有已选维度都符合」的变体（取第一个）。
 */
export function matchVariant(
  variants: ProductVariant[],
  selection: Record<string, string>
): ProductVariant | null {
  if (!variants?.length) return null
  const picked = Object.entries(selection).filter(([, v]) => v)
  if (!picked.length) return variants[0]
  for (const v of variants) {
    const specs = v?.specs || []
    const ok = picked.every(([name, value]) => {
      const hit = specs.find(s => s.name === name)
      // 旧格式变体：拿 name/value 当维度
      if (hit) return hit.value === value
      if ((v?.name || '') === name) return (v?.value || '') === value
      return false
    })
    if (ok) return v
  }
  return null
}
