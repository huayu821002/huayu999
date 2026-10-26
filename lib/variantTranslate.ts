/**
 * 变体规格中→英（采集品 + 商品都共用）
 *
 * 用户需求（2026-10-26 第 4 条）：「一键翻译英文包括 变体规格名称。
 * 如果太长截取保留精简。」
 *
 * 采集到的变体长这样：
 *   variants:    [{ specs:[{name:'颜色', value:'P064深灰'}, {name:'规格', value:'均码【双面锦纶】'}],
 *                  color, size, specText, price, image }]
 *   variantDims: [{ name:'颜色', kind:'color', values:['P064深灰', ...] }]
 *
 * 翻译后：
 *   specs:  [{name:'Color', value:'P064 Dark Gray'}, {name:'Size', value:'One Size'}]
 *   dims:   [{ name:'Color', kind:'color', values:['P064 Dark Gray', ...] }]
 *
 * ★ 值里的「型号前缀」（P064）必须保留 —— 那是货号的一部分，砍了客户对不上。
 * ★ 括号里的补充说明（【双面锦纶】）砍掉 —— 按钮上显示太长。
 */

import {
  DIM_NAME_EN,
  VALUE_EN,
  isSizingValue,
  hasCjk,
  translateDimName,
  translateDimValue,
  translateSpecs,
} from './variantI18n'
import { compactVariantName, compactVariantValue } from './compact'

export type Translator = (s: string) => Promise<string>

/**
 * 拆出型号前缀（如 "P064深灰" → { prefix: "P064", rest: "深灰" }）
 * 前缀规则：开头连续的字母+数字组合，且后面还跟着中文
 */
export function splitCodePrefix(value: string): { prefix: string; rest: string } {
  const t = String(value || '').trim()
  if (!t) return { prefix: '', rest: '' }
  const m = t.match(/^([A-Za-z]{0,4}[-_]?\d{2,6}[A-Za-z0-9]*)\s*(.*)$/)
  if (m && m[2] && hasCjk(m[2])) {
    return { prefix: m[1], rest: m[2].trim() }
  }
  return { prefix: '', rest: t }
}

/**
 * 翻译一个变体值：保留型号前缀 + 精简截断
 */
export async function translateVariantValue(
  value: string,
  translate: Translator
): Promise<string> {
  const t = String(value || '').trim()
  if (!t) return ''
  if (!hasCjk(t)) return compactVariantValue(t)

  // 整串命中字典（如 "红色"）
  if (VALUE_EN[t]) return VALUE_EN[t]

  // 拆型号前缀
  const { prefix, rest } = splitCodePrefix(t)
  if (prefix) {
    // 只翻中文部分
    const en = await translateValueCore(rest, translate)
    return compactVariantValue(prefix + (en ? ' ' + en : ''))
  }
  return compactVariantValue(await translateValueCore(t, translate))
}

/** 值翻译核心（字典 → 尺码保留 → API） */
async function translateValueCore(value: string, translate: Translator): Promise<string> {
  const t = String(value || '').trim()
  if (!t) return ''
  if (!hasCjk(t)) return t
  if (VALUE_EN[t]) return VALUE_EN[t]
  if (isSizingValue(t)) return t
  try {
    const en = await translate(t)
    return (en || t).trim() || t
  } catch {
    return t
  }
}

/**
 * 翻译一个变体维度名
 */
export async function translateVariantName(
  name: string,
  translate: Translator
): Promise<string> {
  const t = String(name || '').trim()
  if (!t) return ''
  if (!hasCjk(t)) return compactVariantName(t)
  const dict = translateDimName(t)
  if (dict !== t) return compactVariantName(dict)   // 字典命中
  // 字典没命中 → 走 API
  try {
    const en = await translate(t)
    return compactVariantName((en || t).trim() || t)
  } catch {
    return compactVariantName(t)
  }
}

/**
 * 翻译一组 specs（维度名 + 值）
 */
export async function translateVariantSpecs(
  specs: Array<{ name?: string; value?: string }>,
  translate: Translator
): Promise<Array<{ name: string; value: string }>> {
  const out: Array<{ name: string; value: string }> = []
  for (const s of specs || []) {
    if (!s) continue
    const name = String(s.name || '').trim()
    const value = String(s.value || '').trim()
    if (!name && !value) continue
    out.push({
      name: await translateVariantName(name, translate),
      value: await translateVariantValue(value, translate),
    })
  }
  return out
}

/**
 * 翻译整个采集品的变体 + 维度定义
 *
 * @param variants    采集变体数组
 * @param variantDims 采集维度定义
 * @param translate   异步翻译器
 *
 * 返回 { variants, dims } —— 两者都已英文化
 */
export async function translateSupplierVariants(
  variants: any[],
  variantDims: any[],
  translate: Translator
): Promise<{ variants: any[]; dims: any[] }> {
  const outVariants: any[] = []
  for (const v of variants || []) {
    if (!v || typeof v !== 'object') continue
    const specs = Array.isArray(v.specs) ? v.specs : []
    const newSpecs = await translateVariantSpecs(
      specs.map((s: any) => ({ name: String(s?.name || ''), value: String(s?.value || '') })),
      translate
    )

    // 展示值：优先用翻译后的 specs 拼（保持 "Red / M" 的连接形式）
    let display = ''
    if (newSpecs.length) {
      display = newSpecs.map((s) => s.value).filter(Boolean).join(' / ')
    } else {
      const raw = String(v.value || v.color || v.size || v.specText || '')
      display = await translateVariantValue(raw, translate)
    }

    // 维度名：多维度时用 " / " 连接
    let name = String(v.name || '')
    if (newSpecs.length) {
      const names = Array.from(new Set(newSpecs.map((s) => s.name).filter(Boolean)))
      name = names.join(' / ')
    } else if (name) {
      name = await translateVariantName(name, translate)
    }

    // 保留其它字段（price / image / skuId / inventory …），只改文字
    const next: any = { ...v, name, value: display }
    if (newSpecs.length) next.specs = newSpecs
    // color / size / specText 是冗余的展示字段，同步更新（前台老代码会读）
    if (typeof v.color === 'string' && v.color) {
      next.color = newSpecs[0]?.value ?? (await translateVariantValue(v.color, translate))
    }
    if (typeof v.size === 'string' && v.size) {
      next.size = newSpecs[1]?.value ?? next.specs?.[0]?.value ?? (await translateVariantValue(v.size, translate))
    }
    if (typeof v.specText === 'string' && v.specText) {
      next.specText = display
    }
    outVariants.push(next)
  }

  const outDims: any[] = []
  for (const d of variantDims || []) {
    if (!d || typeof d !== 'object') continue
    const name = await translateVariantName(String(d?.name || ''), translate)
    const values: string[] = []
    for (const val of (Array.isArray(d?.values) ? d.values : [])) {
      values.push(await translateVariantValue(String(val), translate))
    }
    outDims.push({ ...d, name, values })
  }

  return { variants: outVariants, dims: outDims }
}
