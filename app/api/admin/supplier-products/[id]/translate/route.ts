import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable, parseJsonField } from '@/lib/supplier'
import { translateSupplierItem } from '@/lib/cn2en'

/**
 * POST /api/admin/supplier-products/[id]/translate
 * 把采集品（中文）翻译成英文，并生成 SEO 标题 / 关键词。
 */
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

    const updated = await prisma.supplierProduct.update({
      where: { id: params.id },
      data: {
        titleEn: result.titleEn || null,
        seoTitle: result.seoTitle || null,
        shortDescEn: result.shortDescEn || null,
        descriptionEn: result.descriptionEn || null,
        keywords: result.keywords.join(', ') || null,
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
      },
    })
  } catch (error: any) {
    console.error('translate supplier product error:', error)
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
