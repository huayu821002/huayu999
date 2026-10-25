import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'

/**
 * DELETE /api/admin/products/[productId]/variants/[variantId]
 *
 * 后台产品页用的是路径参数形式（/variants/{id}），
 * 另一个路由用的是查询参数形式（/variants?id=xxx），两边都支持。
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { productId: string; variantId: string } }
) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, variants: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })

    let list: any[] = []
    try {
      const raw = product.variants ? JSON.parse(product.variants) : []
      if (Array.isArray(raw)) list = raw
    } catch {
      list = []
    }
    const next = list.filter(v => v?.id !== params.variantId)
    if (next.length === list.length) {
      return NextResponse.json({ success: false, error: 'Variant not found' }, { status: 404 })
    }
    await prisma.product.update({
      where: { id: params.productId },
      data: { variants: JSON.stringify(next) },
    })
    return NextResponse.json({ success: true, data: next })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete variant' }, { status: 500 })
  }
}
