import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureSupplierProductTable,
  upsertSupplierProduct,
  parseImagesField,
} from '@/lib/supplier'

/**
 * 临时自检端点（部署验证用，验证后立即删除）
 * 只操作自己的测试数据，跑完即清理；不返回任何真实业务数据。
 */
export async function POST() {
  const report: any = { steps: [] }
  const testId = 'setup-selftest-' + Date.now().toString(36)

  try {
    await ensureSupplierProductTable()
    report.steps.push('ensure table: OK')

    const rec = await upsertSupplierProduct({
      source: '1688',
      sourceId: testId,
      sourceUrl: 'https://detail.1688.com/offer/000000000.html',
      title: '【自检】测试商品 ' + testId,
      description: '<p>self test</p>',
      images: ['https://c.1688.com/img/test.jpg'],
      priceMin: 1.23,
      priceMax: 4.56,
      moq: 50,
      supplierName: 'self-test supplier',
      attributes: { color: 'red' },
      raw: { test: true },
    })
    report.steps.push('upsert: OK id=' + rec.id)

    const again = await upsertSupplierProduct({
      source: '1688',
      sourceId: testId,
      title: '【自检】测试商品 updated',
      priceMin: 2.0,
    })
    report.steps.push('re-upsert (idempotent): ' + (again.id === rec.id ? 'OK' : 'FAIL'))

    const found = await prisma.supplierProduct.findUnique({ where: { id: rec.id } })
    const imgCount = parseImagesField(found?.images || null).length
    report.steps.push(
      'read: ' +
        (found && found.title.includes('updated') ? 'OK' : 'FAIL') +
        ' images=' + imgCount +
        (imgCount === 1 ? ' (保留 OK)' : ' (图片被覆盖 FAIL)')
    )

    const updated = await prisma.supplierProduct.update({
      where: { id: rec.id },
      data: { status: 'approved', note: 'selftest' },
    })
    report.steps.push('update status: ' + updated.status)

    // 商品创建 / 读取 / 删除
    const product = await prisma.product.create({
      data: {
        name: '【自检】' + testId,
        slug: `selftest-${testId}`,
        sku: `SELFTEST-${testId}`,
        price: 9.99,
        images: JSON.stringify(['https://c.1688.com/img/test.jpg']),
        minOrderQty: 1,
        isActive: false,
        tags: 'selftest',
      },
    })
    report.steps.push('product create: OK id=' + product.id)

    const linked = await prisma.supplierProduct.update({
      where: { id: rec.id },
      data: { status: 'published', productId: product.id, publishedAt: new Date() },
    })
    report.steps.push('link published: ' + linked.status)

    await prisma.product.delete({ where: { id: product.id } })
    report.steps.push('product cleanup: OK')

    await prisma.supplierProduct.delete({ where: { id: rec.id } })
    report.steps.push('supplier cleanup: OK')

    report.success = true
  } catch (e: any) {
    report.success = false
    report.error = e?.message || String(e)
    report.code = e?.code
    report.meta = e?.meta ? JSON.stringify(e.meta).slice(0, 300) : undefined
    // 清理残留
    try {
      await prisma.supplierProduct.deleteMany({ where: { sourceId: { startsWith: 'setup-selftest-' } } })
      await prisma.product.deleteMany({ where: { sku: { startsWith: 'SELFTEST-' } } })
    } catch {}
  }

  return NextResponse.json(report)
}
