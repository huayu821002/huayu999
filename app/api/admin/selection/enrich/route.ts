import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, isAuthError } from '@/lib/apiAuth'
import { ensureSupplierProductTable, parseJsonField } from '@/lib/supplier'
import { enrichProduct } from '@/lib/selection/enrich'
import { MODELS } from '@/lib/selection/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/admin/selection/enrich
 *
 * 选品 Agent —— 「添加资料」环节：给选出来的款生成整套上架资料。
 *
 * body:
 *   {
 *     "id": "supplierProductId",   // 单个
 *     "ids": ["id1","id2"],          // 或批量
 *     "model": "MiniMax-M3",
 *     "write": true,                 // true=直接写回数据库；false=只返回预览
 *     "bundleNote": "可与深灰针织围巾成套"
 *   }
 *
 * 返回：每个 id 的 { titleEn, seoTitle, keywords, shortDescEn, descriptionEn,
 *                   highlights, videoScript, bundleCopy, faq }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (isAuthError(auth)) return auth

    await ensureSupplierProductTable()

    const body = await request.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.map(String)
      : body?.id
        ? [String(body.id)]
        : []
    if (!ids.length) {
      return NextResponse.json({ success: false, error: '缺少 id 或 ids' }, { status: 400 })
    }

    const model = body?.model || MODELS.main
    const write = body?.write === true
    const bundleNote = body?.bundleNote ? String(body.bundleNote) : undefined

    const items = await prisma.supplierProduct.findMany({ where: { id: { in: ids } } })
    if (!items.length) {
      return NextResponse.json({ success: false, error: '未找到对应商品' }, { status: 404 })
    }

    const results: any[] = []
    for (const it of items) {
      const variants = parseJsonField<any[]>(it.variants) || []
      const dims = parseJsonField<any[]>(it.variantDims) || []
      const colors = Array.from(
        new Set(
          (variants || [])
            .map((v: any) => v?.value)
            .filter((v: any) => typeof v === 'string' && v)
        )
      ).slice(0, 12) as string[]
      const specs = Array.from(
        new Set(
          (dims || [])
            .flatMap((d: any) => (d?.values || []).map((v: any) => `${d?.name}:${v?.value ?? v}`))
        )
      ).slice(0, 12) as string[]

      try {
        const enriched = await enrichProduct(
          {
            title: it.titleCn || it.title,
            cost: it.priceMin ?? it.wholesalePrice ?? undefined,
            sellPrice: it.priceMin ? Math.round(it.priceMin * 3.2 * 100) / 100 : undefined,
            category: body?.categoryHint || undefined,
            description: it.description || undefined,
            variants: specs,
            colors,
            bundleNote,
          },
          { model }
        )

        if (write) {
          await prisma.supplierProduct.update({
            where: { id: it.id },
            data: {
              titleEn: enriched.titleEn,
              seoTitle: enriched.seoTitle,
              keywords: enriched.keywords.join(', ') || null,
              shortDescEn: enriched.shortDescEn,
              descriptionEn: enriched.descriptionEn,
              note: enriched.bundleCopy
                ? `${it.note ? it.note + '\n' : ''}【套装文案】${enriched.bundleCopy}`
                : it.note,
              updatedAt: new Date(),
            },
          })
        }

        results.push({ id: it.id, title: it.titleCn || it.title, written: write, ...enriched })
      } catch (e: any) {
        results.push({ id: it.id, title: it.titleCn || it.title, error: String(e?.message || e).slice(0, 200) })
      }
    }

    return NextResponse.json({
      success: true,
      written: write,
      model,
      count: results.length,
      results,
    })
  } catch (error: any) {
    console.error('selection enrich error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to enrich' }, { status: 500 })
  }
}
