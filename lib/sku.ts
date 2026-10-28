/* SKU 生成规则（2026-10-28）
 *
 * 用户需求：「产品SKU 生成规则：FCY + 日期（如 9月10号就写 0910）+ 1688 的原货号，
 *            如果没有原货号可以生成随机 5 位数」
 *
 * 例：
 *   原货号 ABC-123，2026-09-10 → FCY0910ABC-123
 *   无原货号，          2026-09-10 → FCY0910XXXXX（5 位随机数字）
 *
 * 时区：用 Asia/Shanghai（运营所在地），避免服务器在 UTC 时日期差一天。
 */

/** SKU 前缀 */
export const SKU_PREFIX = 'FCY'

/** 默认时区（运营所在地） */
export const SKU_TIMEZONE = 'Asia/Shanghai'

/** 取目标时区的 MMDD */
export function skuDatePart(d: Date = new Date(), timeZone: string = SKU_TIMEZONE): string {
  try {
    // en-CA 输出 YYYY-MM-DD
    const s = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (m) return m[2] + m[3]
  } catch (e) { /* 落到 UTC 兜底 */ }
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return mm + dd
}

/** 随机数字串（默认 5 位） */
export function randomSkuDigits(len = 5, rand: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < len; i++) out += String(Math.floor(rand() * 10) % 10)
  return out
}

/** 清洗原货号：只保留安全字符，去掉空格/中文/特殊符号 */
export function sanitizeSourceSku(s: unknown): string {
  const t = String(s == null ? '' : s).trim()
  if (!t) return ''
  return t.replace(/[^0-9A-Za-z._-]/g, '').slice(0, 40)
}

export interface SkuOptions {
  date?: Date
  timeZone?: string
  rand?: () => number
  prefix?: string
  /** 已有 SKU 时保留（默认不保留） */
  keepExisting?: boolean
}

/**
 * 生成 SKU。
 * @param sourceSku 1688 原货号（supplierProduct.sourceSkuId / 变体的 skuId）
 */
export function buildSku(sourceSku: unknown, opts: SkuOptions = {}): string {
  const prefix = opts.prefix ?? SKU_PREFIX
  const datePart = skuDatePart(opts.date ?? new Date(), opts.timeZone ?? SKU_TIMEZONE)
  const src = sanitizeSourceSku(sourceSku)
  if (src) return `${prefix}${datePart}${src}`
  return `${prefix}${datePart}${randomSkuDigits(5, opts.rand ?? Math.random)}`
}

/**
 * 批量生成**互不重复**的 SKU（变体用）。
 * 原货号重复时（同一 1688 商品多个 SKU 行货号相同）加 -2、-3 后缀。
 */
export function buildUniqueSkus(
  sourceSkus: Array<unknown>,
  opts: SkuOptions = {}
): string[] {
  const used = new Set<string>()
  return sourceSkus.map((src) => {
    const base = buildSku(src, opts)
    if (!used.has(base)) {
      used.add(base)
      return base
    }
    for (let i = 2; i < 1000; i++) {
      const cand = `${base}-${i}`
      if (!used.has(cand)) {
        used.add(cand)
        return cand
      }
    }
    return `${base}-${Date.now().toString(36)}`
  })
}

/**
 * 发布商品时决定最终 SKU。
 *
 * 坑（2026-10-28 用户报「商品 SKU 还是 1688-xxx 旧格式」）：
 *   后台发布弹窗以前会**预填** `1688-{sourceId}` 或 sourceSkuId，
 *   提交时 body.sku 非空 → 服务端 `body.sku || buildSku(...)` 直接用了旧值，
 *   新规则被完全盖掉。
 *   现在：这两类「旧版自动预填值」视为**没填**，按新规则重新生成；
 *   用户真正手填的其它值照旧优先。
 */
export function pickPublishSku(
  userSku: string | null | undefined,
  item: { sourceSkuId?: string | null; sourceId: string }
): string {
  const u = userSku ? String(userSku).trim() : ''
  const legacyAuto = !u || u === item.sourceSkuId || u === `1688-${item.sourceId}`
  return legacyAuto ? buildSku(item.sourceSkuId) : u
}

/**
 * 变体 SKU：**商品SKU + '-' + 2 位顺序号**
 *
 * 用户（2026-10-28 18:27）原话：
 *   「采集 变体SKU规则：商品SKU-(2位顺序数子)，
 *     某SKU 商品SKU为 FCY102840148，那么红色就是 FCY102840148-01，
 *     绿色：FCY102840148-02」
 *
 * 变体 SKU 挂在商品 SKU 下面，所以必须在**商品 SKU 定下来之后**生成
 * （发布时 / 批量重生成时），而不是采集时。
 */
export function buildVariantSkus(productSku: string | null | undefined, count: number): string[] {
  const base = String(productSku || '').trim() || buildSku(null)
  const n = Math.max(0, Number(count) || 0)
  return Array.from({ length: n }, (_, i) => `${base}-${String(i + 1).padStart(2, '0')}`)
}
