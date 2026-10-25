import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'
import { ensureSupplierProductTable } from '@/lib/supplier'

/**
 * POST /api/admin/supplier-products/batch-delete
 *
 * 批量删除**采集品**（后台「产品采集库」）。
 * Body: { ids: string[] }
 *
 * 采集品（SupplierProduct）没有外键指向它，所以基本都能删；
 * 但仍逐个处理并反馈（并发删/表缺失/连接问题都不该整批失败）。
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  try {
    await ensureSupplierProductTable()
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const rawIds: unknown[] = Array.isArray(body?.ids) ? (body.ids as unknown[]) : []
    const ids: string[] = Array.from(
      new Set(rawIds.map(x => String(x ?? '').trim()).filter(Boolean))
    ).slice(0, 500)

    if (!ids.length) {
      return NextResponse.json({ success: false, error: '没有选中任何采集品' }, { status: 400 })
    }

    const deleted: string[] = []
    const failed: Array<{ id: string; title?: string; reason: string }> = []

    // 先批量查名字（失败提示要显示标题，用户才认得出是哪个）
    let titleMap = new Map<string, string>()
    try {
      const rows = await prisma.supplierProduct.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      })
      titleMap = new Map(rows.map(r => [r.id, r.title]))
    } catch (e) {
      console.warn('批量查采集品标题失败:', e)
    }

    for (const id of ids) {
      try {
        await prisma.supplierProduct.delete({ where: { id } })
        deleted.push(id)
      } catch (e: any) {
        const msg = String(e?.message || e)
        let reason = '删除失败'
        if (e?.code === 'P2025') reason = '采集品不存在'
        else if (e?.code === 'P1008' || /timeout/i.test(msg)) reason = '数据库超时，请重试'
        failed.push({ id, title: titleMap.get(id), reason })
      }
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
    console.error('batch delete supplier products error:', error)
    return NextResponse.json({ success: false, error: error?.message || '批量删除失败' }, { status: 500 })
  }
}
