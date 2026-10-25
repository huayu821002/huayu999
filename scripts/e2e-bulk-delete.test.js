/**
 * 端到端验证：后台批量删除商品
 *
 * 直接打生产库（只创建测试数据，结束后清理）
 *
 * 覆盖：
 *   1) 批量删多个商品 → 全删掉
 *   2) 不存在的 id → 记为失败，不影响其它
 *   3) **有订单记录的商品删不掉**（OrderItem 对 Product 是 Restrict 外键）
 *      → 逐个反馈原因，不能整批失败
 *   4) 删除后 SupplierProduct.productId 被置空（不留悬空引用）
 *
 * 做法：把 route.ts 转译后注入真实的 prisma（走生产库）+ 假的 next/server
 */
const fs = require('fs')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')

const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

// ---- 假的 next/server ----
class FakeResponse {
  constructor(body, init) { this.body = body; this.status = (init && init.status) || 200 }
  async json() { return this.body }
}
const NextResponse = {
  json: (body, init) => new FakeResponse(body, init),
}

// ---- 假的 require ----
const fakeRequire = (id) => {
  if (id === 'next/server') return { NextResponse, NextRequest: class {} }
  if (id === '@/lib/prisma') return { prisma }
  if (id === '@/lib/chatAuth') return { requireAdminOrDev: async () => null }
  return require(id)
}

function loadRoute() {
  const src = fs.readFileSync('/home/admin/Fiestaflare/app/api/admin/products/batch-delete/route.ts', 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', 'NextResponse', 'NextRequest', js)(
    mod, mod.exports, fakeRequire, NextResponse, class {}
  )
  return mod.exports
}

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

;(async () => {
  const route = loadRoute()
  const created = []
  let user = null, order = null, sp = null

  try {
    // ---------- 准备数据 ----------
    const mk = async (n) => {
      const out = []
      for (let i = 0; i < n; i++) {
        const p = await prisma.product.create({
          data: {
            name: `E2E 批量删除测试 ${Date.now().toString(36)}-${i}`,
            slug: `e2e-bulk-del-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            description: 'test', price: 9.99, sku: `E2E-BULK-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            images: JSON.stringify([]),
          },
        })
        out.push(p); created.push(p)
      }
      return out
    }

    const [p1, p2, p3] = await mk(3)
    console.log('① 已建 3 个测试商品')

    // 一个「有订单记录」的商品
    user = await prisma.user.create({
      data: {
        email: `e2e-bulk-del-${Date.now().toString(36)}@test.invalid`,
        password: 'x', name: 'E2E Bulk Del User', role: 'CUSTOMER',
      },
    })
    order = await prisma.order.create({
      data: {
        userId: user.id,
        orderNumber: 'E2E-BULK-DEL-' + Date.now().toString(36),
        status: 'PENDING',
        // items 是 JSON 字符串列（不是关系），真正的关联在 OrderItem 表
        items: JSON.stringify([{ productId: p3.id, quantity: 1, price: 9.99 }]),
        subtotal: 9.99,
        shippingCost: 0,
        tax: 0,
        total: 9.99,
        shippingAddress: JSON.stringify({ name: 'E2E', address: 'test' }),
      },
    })
    // OrderItem 对 Product 是 Restrict 外键（没有 onDelete: Cascade）→ 商品删不掉
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: p3.id,
        name: p3.name,
        sku: p3.sku,
        price: 9.99,
        quantity: 1,
      },
    })
    console.log('② 其中 1 个已挂订单（外键 Restrict，删不掉）')

    // 一个采集品指向 p1
    sp = await prisma.supplierProduct.create({
      data: {
        source: '1688', sourceId: `e2e-bulk-del-${Date.now().toString(36)}`,
        title: 'E2E 批量删除 采集品', productId: p1.id, status: 'published',
      },
    })

    // ---------- 1) 批量删除（含 1 个不存在的 id） ----------
    console.log('\n[批量删除]')
    const res = await route.POST({ json: async () => ({ ids: [p1.id, p2.id, p3.id, 'no-such-id-xxxx'] }) })
    const body = await res.json()
    t('接口返回 success 字段', body.success !== undefined)
    t('total = 4', body.total === 4, body.total)
    t('成功删了 2 个', body.deleted === 2, `deleted=${body.deleted} failed=${JSON.stringify(body.failed)}`)
    t('失败 2 个', body.failedCount === 2, body.failedCount)
    t('不存在的 id 报「商品不存在」',
      body.failed.some(f => f.id === 'no-such-id-xxxx' && /不存在/.test(f.reason)),
      JSON.stringify(body.failed))
    t('有订单的商品报外键原因',
      body.failed.some(f => f.id === p3.id && /订单|购物车/.test(f.reason)),
      JSON.stringify(body.failed))
    t('失败项带商品名（用户能看懂）', body.failed.find(f => f.id === p3.id)?.name === p3.name, JSON.stringify(body.failed))

    // ---------- 2) 数据库实际状态 ----------
    console.log('\n[落库校验]')
    const left1 = await prisma.product.findUnique({ where: { id: p1.id } })
    const left2 = await prisma.product.findUnique({ where: { id: p2.id } })
    const left3 = await prisma.product.findUnique({ where: { id: p3.id } })
    t('商品 1 已删除', left1 === null)
    t('商品 2 已删除', left2 === null)
    t('有订单的商品仍在（外键保护）', left3 !== null)

    // ---------- 3) 采集品悬空引用清理 ----------
    const spAfter = await prisma.supplierProduct.findUnique({ where: { id: sp.id } })
    t('采集品 productId 已置空', spAfter.productId === null, spAfter.productId)

    // ---------- 4) 空数组要报错 ----------
    const res2 = await route.POST({ json: async () => ({ ids: [] }) })
    t('空选中返回 400', res2.status === 400, res2.status)

    // ---------- 5) 重复 id 去重 ----------
    const [p4] = await mk(1)
    const res3 = await route.POST({ json: async () => ({ ids: [p4.id, p4.id, p4.id] }) })
    const b3 = await res3.json()
    t('重复 id 只算 1 个', b3.total === 1, b3.total)
    t('商品 4 已删除', (await prisma.product.findUnique({ where: { id: p4.id } })) === null)
    created.push(p4)

    console.log('\n已清理测试数据')
  } catch (e) {
    console.error('ERROR:', e)
    fail++
  } finally {
    for (const p of created) {
      try { await prisma.product.delete({ where: { id: p.id } }) } catch (e) { /* 有订单的清不掉，手动 */ }
    }
    try { if (sp) await prisma.supplierProduct.delete({ where: { id: sp.id } }) } catch (e) {}
    try { if (order) await prisma.order.delete({ where: { id: order.id } }) } catch (e) { console.error('cleanup order', e.message) }
    try { if (user) await prisma.user.delete({ where: { id: user.id } }) } catch (e) {}
    // 兜底：把带订单的测试商品连订单一起清掉
    try {
      const leftovers = await prisma.orderItem.findMany({
        where: { product: { name: { startsWith: 'E2E 批量删除测试' } } },
        include: { order: true },
      })
      for (const oi of leftovers) {
        await prisma.orderItem.delete({ where: { id: oi.id } })
        await prisma.order.delete({ where: { id: oi.orderId } })
      }
      const rest = await prisma.product.findMany({ where: { name: { startsWith: 'E2E 批量删除测试' } } })
      for (const p of rest) await prisma.product.delete({ where: { id: p.id } })
    } catch (e) { console.error('兜底清理失败', e.message) }
  }
  console.log('--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
