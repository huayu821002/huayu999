/**
 * 英文文本精简截取
 *
 * 用户需求（2026-10-26 第 4 条）：「一键翻译英文包括 变体规格名称。
 * 如果太长截取保留精简。」
 *
 * 背景（实测数据）：
 *   "均码【双面锦纶】"  → "One size fits all [double-sided nylon]"  (38 字符，太长)
 *   "P064深灰"          → "P064 dark gray"                          (14 字符，OK)
 *   长标题              → 133 字符                                  (太长)
 *
 * 规则：
 *   1. **优先砍掉括号里的补充说明**（`[double-sided nylon]`）
 *      —— 变体值在按钮上显示，够用就行，括号内容是详情不是标签。
 *   2. 还超长 → 在**词边界**截断（不切半个单词），加省略号。
 *   3. 保留有意义的编号前缀（如 "P064"），别把型号砍了。
 *   4. 首字母大写（"P064 dark gray" → "P064 Dark Gray"）——
 *      翻译接口返回小写，商品页显示 "P064 dark gray" 很廉价。
 */

/** 变体值最大长度（按钮上显示，超过就难看了） */
export const MAX_VARIANT_VALUE_LEN = 24

/** 变体维度名最大长度 */
export const MAX_VARIANT_NAME_LEN = 20

/** 标题最大长度 */
export const MAX_TITLE_LEN = 120

/** 短描述最大长度 */
export const MAX_SHORT_DESC_LEN = 160

/** 描述最大长度 */
export const MAX_DESC_LEN = 2000

/**
 * 砍掉括号里的补充说明
 *   "One size fits all [double-sided nylon]" → "One size fits all"
 *   "均码【双面锦纶】"                        → "均码"
 */
export function stripBrackets(text: string): string {
  return String(text || '')
    .replace(/\s*[\[（(【][^\]）)】]*[\]）)】]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * 常见缩写（全大写）—— 翻译接口返回小写 "uv protection"，
 * 得还原成 "UV Protection" 才像正经商品文案。
 */
const ABBREVIATIONS = new Set([
  'uv', 'spf', 'paba', 'led', 'usb', 'pvc', 'abs', 'pet', 'nylon', 'spandex',
  'xl', 'xxl', 'xxxl', 'xs', 'ss', 'hd', 'dpi', 'ml', 'kg', 'cm', 'mm',
  'oz', 'lb', 'ac', 'dc', 'pp', 'pe', 'pu', 'rf', 'ir', 'hdmi',
])

/**
 * 首字母大写（每个词），但保留：
 *   - 全大写缩写（PVC / UV / LED / XL）不拆
 *   - 含数字的编号（P064 / 3M）保持原样
 */
export function titleCase(text: string): string {
  const t = String(text || '').trim()
  if (!t) return t
  return t
    .split(' ')
    .map(w => {
      if (!w) return w
      // 全大写缩写（≤4 字母）保持不变：PVC / UV / LED / XL
      if (/^[A-Z]{1,4}$/.test(w)) return w
      // 常见缩写 → 全大写（翻译接口返回小写 "uv" → "UV"）
      const bare = w.replace(/[^A-Za-z]/g, '').toLowerCase()
      if (bare && bare.length <= 4 && ABBREVIATIONS.has(bare)) return w.toUpperCase()
      // 含数字的编号段保持原样：P064 / 3M / A200
      if (/^[A-Za-z]*\d+[A-Za-z]*$/.test(w)) return w.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/**
 * 在词边界截断（不切半个单词）
 * "hello world foo bar" 截到 12 → "hello world…"
 */
export function truncateWords(text: string, max: number, ellipsis = '…'): string {
  const t = String(text || '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  // 词边界往前找（至少保留 60%）
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return (base.replace(/[\s,;:/|-]+$/, '') + ellipsis).trim()
}

/**
 * 变体值精简：先砍括号说明 → 再截断 → 首字母大写
 *   "One size fits all [double-sided nylon]" → "One Size Fits All"
 *   "P064 dark gray"                        → "P064 Dark Gray"
 */
export function compactVariantValue(value: string, max = MAX_VARIANT_VALUE_LEN): string {
  let t = stripBrackets(String(value || '')).trim()
  if (!t) return ''
  t = truncateWords(t, max)
  return titleCase(t)
}

/**
 * 变体维度名精简
 *   "颜色" → "Color"（字典命中）
 *   "double-sided nylon specification" → 截断
 */
export function compactVariantName(name: string, max = MAX_VARIANT_NAME_LEN): string {
  let t = stripBrackets(String(name || '')).trim()
  if (!t) return ''
  t = truncateWords(t, max)
  return titleCase(t)
}

/**
 * 标题精简：去掉营销噪声 → 截断
 */
export function compactTitle(text: string, max = MAX_TITLE_LEN): string {
  const t = String(text || '').replace(/\s{2,}/g, ' ').trim()
  if (!t) return ''
  return truncateWords(t, max)
}

/**
 * 短描述精简（不砍意思，只控长度）
 */
export function compactShortDesc(text: string, max = MAX_SHORT_DESC_LEN): string {
  const t = String(text || '').replace(/\s{2,}/g, ' ').trim()
  if (!t) return ''
  return truncateWords(t, max)
}

/**
 * 描述精简（按句截断，尽量保留完整句）
 */
export function compactDesc(text: string, max = MAX_DESC_LEN): string {
  const t = String(text || '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastStop = Math.max(
    cut.lastIndexOf('. '), cut.lastIndexOf('。'),
    cut.lastIndexOf('! '), cut.lastIndexOf('? '),
    cut.lastIndexOf('\n')
  )
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim()
  return truncateWords(cut, max)
}
