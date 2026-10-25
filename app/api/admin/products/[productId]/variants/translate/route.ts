import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'
import { translateToEnglish } from '@/lib/cn2en'
import { translateSpecs, translateDimName, translateDimValue } from '@/lib/variantI18n'

/**
 * POST /api/admin/products/[productId]/variants/translate
 *
 * 把商品变体的**规格信息中→英**（后台「一键转英文」）：
 *   维度名：颜色 → Color、尺码 → Size
 *   维度值：红色 → Red、蓝色 → Blue（尺码值 M/L/XL 原样保留）
 *
 * 改写三处，保证前后台一致：
 *   1. variant.name      （维度名，单维度时）
 *   2. variant.value     （展示值，多维度 "Red / M"）
 *   3. variant.specs     （维度明细，前台靠它拆选择器）
 *   + Product.variantDims（维度定义）
 *
 * Body: { }（可选 { onlyChinese: false }）
 */

type Variant = {
  id?: string
  name?: string
  value?: string
  specs?: Array<{ name?: string; value?: string }>
  [k: string]: any
}

/** 模块级缓存：同一个词只翻一次（进程级，重启失效，可接受） */
const cache = new Map<string, string>()

async function cachedTranslate(s: string): Promise<string> {
  const key = s.trim()
  if (!key) return s
  if (cache.has(key)) return cache.get(key)!
  try {
    const en = await translateToEnglish(key)
    const out = (en || key).trim() || key
    cache.set(key, out)
    return out
  } catch {
    return key
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))

    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, variants: true, variantDims: true },
    })
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    let variants: Variant[] = []
    try {
      const v = product.variants ? JSON.parse(product.variants) : []
      variants = Array.isArray(v) ? v : []
    } catch { variants = [] }

    if (!variants.length) {
      return NextResponse.json({ success: false, error: '该商品没有变体' }, { status: 400 })
    }

    const out: Variant[] = []
    for (const v of variants) {
      const specs = Array.isArray(v.specs) ? v.specs : []
      const newSpecs = await translateSpecs(
        specs.map((s) => ({ name: String(s?.name || ''), value: String(s?.value || '') })),
        cachedTranslate
      )

      // 展示值：优先用翻译后的 specs 拼（保持 "Red / M" 的连接形式）
      let display = ''
      if (newSpecs.length) {
        display = newSpecs.map((s) => s.value).filter(Boolean).join(' / ')
      } else {
        display = await translateDimValue(String(v.value || ''), cachedTranslate)
      }

      // 维度名：单维度时 name 就是维度名
      let name = String(v.name || '')
      if (newSpecs.length) {
        const names = Array.from(new Set(newSpecs.map((s) => s.name).filter(Boolean)))
        name = names.join(' / ') || name
      } else {
        name = translateDimName(name)
      }

      out.push({ ...v, name, value: display, specs: newSpecs })
    }

    // 维度定义同步翻译
    let dims: any[] = []
    try {
      const d = product.variantDims ? JSON.parse(product.variantDims) : []
      dims = Array.isArray(d) ? d : []
    } catch { dims = [] }

    const newDims: any[] = []
    for (const d of dims) {
      const name = translateDimName(String(d?.name || ''))
      const values: string[] = []
      for (const val of (Array.isArray(d?.values) ? d.values : [])) {
        values.push(await translateDimValue(String(val), cachedTranslate))
      }
      newDims.push({ ...d, name, values })
    }

    await prisma.product.update({
      where: { id: params.productId },
      data: {
        variants: JSON.stringify(out),
        ...(newDims.length ? { variantDims: JSON.stringify(newDims) } : {}),
      },
    })

    return NextResponse.json({ success: true, data: out, dims: newDims })
  } catch (error: any) {
    console.error('translate variants error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to translate variants' }, { status: 500 })
  }
}
