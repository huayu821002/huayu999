import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'

/**
 * POST /api/admin/products/batch-delete
 *
 * 批量删除商品。
 *
 * Body: { ids: string[] }
 *
 * 逐个删除并**逐个反馈**（不用 deleteMany）：
 *   - OrderItem / CartItem 对 Product 是 Restrict 外键 →
 *     **有订单/购物车记录的商品删不掉**，必须明确告诉用户是哪几个、为什么
 *   - deleteMany 遇到一个受限就会整批失败，用户完全不知道发生了什么
 *
 * 顺带把 SupplierProduct.productId 置空（那是普通字符串列，不是外键，
 * 不清理会留下悬空引用）。
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const rawIds: unknown[] = Array.isArray(body?.ids) ? (body.ids as unknown[]) : []
    // 去重 + 限长 + 只留字符串
    const ids: string[] = Array.from(
      new Set(rawIds.map(x => String(x ?? '').trim()).filter(Boolean))
    ).slice(0, 500)

    if (!ids.length) {
      return NextResponse.json({ success: false, error: '没有选中任何商品' }, { status: 400 })
    }

    const deleted: string[] = []
    const failed: Array<{ id: string; name?: string; reason: string }> = []

    for (const id of ids) {
      // 先查名字，失败时好告诉用户是哪个（要声明在 try 外面，catch 里要用）
      let p: { id: string; name: string } | null = null
      try {
        p = await prisma.product.findUnique({
          where: { id },
          select: { id: true, name: true },
        })
        if (!p) {
          failed.push({ id, reason: '商品不存在' })
          continue
        }
        await prisma.product.delete({ where: { id } })
        deleted.push(id)
      } catch (e: any) {
        const msg = String(e?.message || e)
        let reason = '删除失败'
        // Prisma 外键错误：P2003 = 外键约束失败
        if (e?.code === 'P2003' || /foreign key|violates/i.test(msg)) {
          reason = '该商品有订单/购物车记录，无法删除（可先下架 isActive=false）'
        } else if (e?.code === 'P2025') {
          reason = '商品不存在'
        }
        failed.push({ id, name: p?.name, reason })
      }
    }

    // 清理采集品里的悬空引用（productId 是普通字符串列，不是外键）
    try {
      await prisma.supplierProduct.updateMany({
        where: { productId: { in: deleted } },
        data: { productId: null },
      })
    } catch (e) {
      console.warn('清理 SupplierProduct.productId 失败:', e)
    }

    return NextResponse.json({
      success: failed.length === 0,
      total: ids.length,
      deleted: deleted.length,
      failedCount: failed.length,
      failed,
      data: { deleted, failed },
    })
  } catch (error: any) {
    console.error('batch delete products error:', error)
    return NextResponse.json({ success: false, error: error?.message || '批量删除失败' }, { status: 500 })
  }
}
