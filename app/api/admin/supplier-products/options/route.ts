import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable } from '@/lib/supplier'

/**
 * GET /api/admin/supplier-products/options
 *
 * 「从采集品复制变体」选择器用的**轻量列表**：
 * 只返回 id / 标题 / 来源 id / 变体数量，不带 raw（raw 有 20KB，会把列表撑爆）。
 */
export async function GET(request: NextRequest) {
  try {
    await ensureSupplierProductTable()
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    const where: any = {}
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { titleCn: { contains: search } },
        { sourceId: { contains: search } },
      ]
    }

    const items = await prisma.supplierProduct.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        sourceId: true,
        sourceUrl: true,
        title: true,
        titleCn: true,
        variants: true,
        variantDims: true,
        productId: true,
        status: true,
      },
    })

    const data = items.map((i: any) => {
      let variantCount = 0
      let dimNames: string[] = []
      try {
        const v = i.variants ? JSON.parse(i.variants) : []
        variantCount = Array.isArray(v) ? v.length : 0
      } catch { variantCount = 0 }
      try {
        const d = i.variantDims ? JSON.parse(i.variantDims) : []
        dimNames = Array.isArray(d) ? d.map((x: any) => String(x?.name || '')).filter(Boolean) : []
      } catch { dimNames = [] }
      return {
        id: i.id,
        sourceId: i.sourceId,
        sourceUrl: i.sourceUrl,
        title: i.titleCn || i.title,
        titleCn: i.titleCn,
        variantCount,
        dimNames,
        productId: i.productId,
        status: i.status,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('supplier-product options error:', error)
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
