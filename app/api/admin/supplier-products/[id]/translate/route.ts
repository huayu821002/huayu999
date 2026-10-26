import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable, parseJsonField } from '@/lib/supplier'
import { translateSupplierItem } from '@/lib/cn2en'
import { translateSupplierVariants } from '@/lib/variantTranslate'
import { compactTitle, compactShortDesc, compactDesc } from '@/lib/compact'

/**
 * POST /api/admin/supplier-products/[id]/translate
 * 把采集品（中文）翻译成英文，并生成 SEO 标题 / 关键词。
 */
/** 模块级缓存：同一个词只翻一次 */
const cache = new Map<string, string>()

async function translateOne(s: string): Promise<string> {
  const key = String(s || '').trim()
  if (!key) return s
  if (cache.has(key)) return cache.get(key)!
  try {
    const { translateToEnglish } = await import('@/lib/cn2en')
    const out = (await translateToEnglish(key) || key).trim() || key
    cache.set(key, out)
    return out
  } catch {
    return key
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSupplierProductTable()
    const item = await prisma.supplierProduct.findUnique({ where: { id: params.id } })
    if (!item) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const categoryHint = body?.categoryHint || ''

    const result = await translateSupplierItem({
      title: item.titleCn || item.title,
      description: item.description,
      attributes: parseJsonField<Record<string, any>>(item.attributes),
      supplierName: item.supplierName,
      categoryHint,
    })

    // ★ 变体规格也要翻译（维度名 + 维度值），并精简截取
    //   「一键翻译英文包括 变体规格名称。如果太长截取保留精简。」
    const supplierVariants = parseJsonField<any[]>(item.variants) || []
    const supplierDims = parseJsonField<any[]>(item.variantDims) || []
    let translatedVariants: any[] = []
    let translatedDims: any[] = []
    if (supplierVariants.length || supplierDims.length) {
      const r = await translateSupplierVariants(supplierVariants, supplierDims, translateOne)
      translatedVariants = r.variants
      translatedDims = r.dims
    }

    const updated = await prisma.supplierProduct.update({
      where: { id: params.id },
      data: {
        titleEn: compactTitle(result.titleEn) || null,
        seoTitle: result.seoTitle || null,
        shortDescEn: compactShortDesc(result.shortDescEn) || null,
        descriptionEn: compactDesc(result.descriptionEn) || null,
        keywords: result.keywords.join(', ') || null,
        // 变体英文化后写回（发布时会直接带到商品）
        ...(translatedVariants.length ? { variants: JSON.stringify(translatedVariants) } : {}),
        ...(translatedDims.length ? { variantDims: JSON.stringify(translatedDims) } : {}),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        titleEn: updated.titleEn,
        seoTitle: updated.seoTitle,
        shortDescEn: updated.shortDescEn,
        descriptionEn: updated.descriptionEn,
        keywords: updated.keywords,
        variants: translatedVariants,
        variantDims: translatedDims,
      },
    })
  } catch (error: any) {
    console.error('translate supplier product error:', error)
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
