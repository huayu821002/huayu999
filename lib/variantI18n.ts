/**
 * 变体规格中→英（后台「一键转英文」用）
 *
 * 变体长这样：
 *   name: "颜色"            ← 维度名
 *   value: "红色 / M"        ← 展示值
 *   specs: [{name:'颜色', value:'红色'}, {name:'尺码', value:'M'}]
 *
 * 翻译后：
 *   name: "Color"
 *   value: "Red / M"
 *   specs: [{name:'Color', value:'Red'}, {name:'Size', value:'M'}]
 *
 * 策略（先查表，后调 API）：
 *   1. 常见颜色/尺码/维度名走**内置字典** —— 零延迟、零 API 调用、最准
 *   2. 尺码值（M/L/XL/XXL/均码/数字）**原样保留**，不翻译
 *   3. 剩下的中文值再走 translateToEnglish（Google gtx / MyMemory 兜底）
 *   4. 翻译结果进模块级缓存，同一个词只翻一次
 */

/** 维度名字典（中文 → 英文） */
export const DIM_NAME_EN: Record<string, string> = {
  颜色: 'Color', 色: 'Color', 颜色分类: 'Color', 主色: 'Color', 配色: 'Color',
  尺码: 'Size', 尺寸: 'Size', 大小: 'Size', 码数: 'Size', 规格尺码: 'Size',
  规格: 'Specification', 款式: 'Style', 型号: 'Model', 材质: 'Material',
  面料: 'Fabric', 包数: 'Pack Count', 重量: 'Weight', 容量: 'Capacity',
  图案: 'Pattern', 花色: 'Pattern', 风格: 'Style', 主题: 'Theme',
  口味: 'Flavor', 香型: 'Scent', 电压: 'Voltage', 版本: 'Version',
}

/** 值字典（中文 → 英文） */
export const VALUE_EN: Record<string, string> = {
  // 颜色
  红色: 'Red', 蓝色: 'Blue', 黑色: 'Black', 白色: 'White', 粉色: 'Pink',
  绿色: 'Green', 灰色: 'Gray', 黄色: 'Yellow', 紫色: 'Purple', 橙色: 'Orange',
  棕色: 'Brown', 咖色: 'Coffee', 咖啡色: 'Coffee', 米色: 'Beige', 米白: 'Off White',
  卡其: 'Khaki', 银色: 'Silver', 金色: 'Gold', 藏青: 'Navy', 军绿: 'Army Green',
  酒红: 'Burgundy', 香槟: 'Champagne', 浅蓝: 'Light Blue', 深蓝: 'Dark Blue',
  浅灰: 'Light Gray', 深灰: 'Dark Gray', 杏色: 'Apricot', 奶油: 'Cream',
  // 通用
  混色: 'Multicolor', 随机: 'Random', 默认: 'Default', 其它: 'Other', 其他: 'Other',
}

/**
 * 是否是「尺码类」值 —— 这类原样保留，不翻译
 * 覆盖：M/L/XL/XXL/2XL/均码/数字/XX码
 */
export function isSizingValue(v: string): boolean {
  const t = String(v || '').trim()
  if (!t) return false
  if (/^(xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|free\s*size|one\s*size|均码|均号|标准|加大|加大码|加大号|小码|中码|大码)$/i.test(t)) return true
  if (/^\d+(\.\d+)?\s*(xl|xxl|码|号|件|个|双|条|支|只|包|盒|杯|kg|g|ml|l|cm|m|寸|英寸|inch|in|ft|磅)$/i.test(t)) return true
  if (/^\d+$/.test(t)) return true
  return false
}

/** 值里是否含中文 */
export function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fa5]/.test(String(s || ''))
}

/** 维度名翻译（纯字典，命中不了就原样返回） */
export function translateDimName(name: string): string {
  const t = String(name || '').trim()
  if (!t) return t
  if (!hasCjk(t)) return t
  return DIM_NAME_EN[t] || t
}

/**
 * 翻译维度值：字典优先，尺码原样，其余含中文的交给 async 翻译器
 * @param translate 异步翻译兜底（通常是 lib/cn2en 的 translateToEnglish）
 */
export async function translateDimValue(
  value: string,
  translate: (s: string) => Promise<string>
): Promise<string> {
  const t = String(value || '').trim()
  if (!t) return t
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
 * 翻译一组规格（维度名 + 维度值）
 * @param specs [{name, value}]
 */
export async function translateSpecs(
  specs: Array<{ name: string; value: string }>,
  translate: (s: string) => Promise<string>
): Promise<Array<{ name: string; value: string }>> {
  const out: Array<{ name: string; value: string }> = []
  for (const s of specs || []) {
    if (!s) continue
    out.push({
      name: translateDimName(s.name),
      value: await translateDimValue(s.value, translate),
    })
  }
  return out
}
