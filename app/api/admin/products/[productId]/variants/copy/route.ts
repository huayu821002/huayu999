import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'
import { ensureSupplierProductTable, parseJsonField } from '@/lib/supplier'
import { toProductVariants, inferVariantDims } from '@/lib/variants'

/**
 * POST /api/admin/products/[productId]/variants/copy
 *
 * 从采集品（SupplierProduct）**一键复制**颜色/尺码等变体到商品（Product）。
 *
 * Body:
 *   { supplierProductId?: string, sourceId?: string, append?: boolean }
 *   - 不传 supplierProductId 时用 sourceId（1688 offerId）匹配最近的一条
 *   - append=true 追加到现有变体后面（默认 false = 覆盖）
 *
 * 转换规则与「发布到商城」完全一致（共用 lib/variants.toProductVariants）：
 *   - name = 维度名（颜色）、value = 值（红色）；多维度 value 用 " / " 连接
 *   - 保留 specs（前台要靠它拆多行选择器）
 *   - 价格 CNY → USD 走 markup/7.2
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  try {
    await ensureSupplierProductTable()
    const body = await request.json().catch(() => ({}))
    const supplierProductId = String(body?.supplierProductId || '').trim()
    const sourceId = String(body?.sourceId || '').trim()
    const append = body?.append === true
    const markup = Number.isFinite(Number(body?.markup)) ? Number(body.markup) : 3
    const rate = Number.isFinite(Number(body?.rate)) ? Number(body.rate) : 7.2

    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, variants: true, variantDims: true },
    })
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    // 找采集品
    let supplier: any = null
    if (supplierProductId) {
      supplier = await prisma.supplierProduct.findUnique({ where: { id: supplierProductId } })
    } else if (sourceId) {
      supplier = await prisma.supplierProduct.findFirst({
        where: { sourceId },
        orderBy: { createdAt: 'desc' },
      })
    }
    if (!supplier) {
      return NextResponse.json({ success: false, error: '采集品不存在' }, { status: 404 })
    }

    const rawVariants = parseJsonField<any[]>(supplier.variants) || []
    const rawDims = parseJsonField<any[]>(supplier.variantDims) || []
    if (!rawVariants.length) {
      return NextResponse.json(
        { success: false, error: '该采集品没有变体数据（采集时未抓到规格表）' },
        { status: 400 }
      )
    }

    const converted = toProductVariants(rawVariants, rawDims, { markup, rate })

    // 合并已有变体（append）或覆盖
    let existing: any[] = []
    try {
      const v = product.variants ? JSON.parse(product.variants) : []
      existing = Array.isArray(v) ? v : []
    } catch { existing = [] }

    const merged = append ? [...existing, ...converted] : converted
    const dims = append
      ? inferVariantDims([...existing, ...converted])
      : (rawDims.length
          ? rawDims.map((d: any) => ({
              name: String(d?.name || ''),
              kind: d?.kind || undefined,
              values: Array.isArray(d?.values) ? d.values.map((x: any) => String(x)) : [],
            }))
          : inferVariantDims(converted))

    await prisma.product.update({
      where: { id: params.productId },
      data: {
        variants: JSON.stringify(merged),
        variantDims: JSON.stringify(dims),
      },
    })

    return NextResponse.json({
      success: true,
      data: merged,
      dims,
      copied: converted.length,
      source: {
        id: supplier.id,
        title: supplier.titleCn || supplier.title,
        sourceId: supplier.sourceId,
      },
    })
  } catch (error: any) {
    console.error('copy variants error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to copy variants' }, { status: 500 })
  }
}
