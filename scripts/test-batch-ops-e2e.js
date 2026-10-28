/* 端到端：批量操作 API（2026-10-28）
 *
 * 真连数据库建临时商品 → 调 batch 逻辑 → 验证 DB 里的结果 → 清理。
 * 不走 HTTP（鉴权/构建依赖太多），直接测 lib/batchOps + prisma 写库逻辑。
 */
// ⚠️ 需要 DATABASE_URL 环境变量（不写死在脚本里）
//   DATABASE_URL=postgresql://... npm run test:batchops:e2e
//   连不上库会自动跳过（不制造假失败）
if (!process.env.DATABASE_URL) {
  console.log('⚠️ 未设置 DATABASE_URL，跳过 E2E')
  console.log('（纯函数单测请跑 npm run test:batchops）')
  process.exit(0)
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const path = require('path')
const { execSync } = require('child_process')

const OUT = '/tmp/batchops-test'
execSync(
  `npx tsc lib/batchOps.ts --outDir ${OUT} --module commonjs --target es2019 --esModuleInterop --skipLibCheck`,
  { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
)
const B = require(path.join(OUT, 'batchOps.js'))

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

const SUFFIX = 'batchtest' + Date.now()
const created = []

async function mkProduct(name, variants, dims, price, inventory) {
  const p = await prisma.product.create({
    data: {
      name,
      slug: `${SUFFIX}-${name}-${Math.random().toString(36).slice(2, 7)}`,
      sku: `${SUFFIX}-${name}-${Math.random().toString(36).slice(2, 7)}`,
      price,
      inventory,
      variants: JSON.stringify(variants),
      variantDims: dims ? JSON.stringify(dims) : null,
    },
  })
  created.push(p.id)
  return p
}

async function main() {
  // 生产 Supabase 直连通常不通（边缘层限制）→ 连不上就跳过，不要让 CI 假失败
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (e) {
    console.log('⚠️ 连不上数据库，跳过 E2E：' + (e?.message || e))
    console.log('（纯函数单测请跑 npm run test:batchops）')
    return
  }

  console.log('\n[① 批量加库存：商品 + 变体都加]')
  {
    const p = await mkProduct('inv', [
      { id: 'a', name: '颜色', value: '粉色', price: 5, inventory: 3, specs: [{ name: '颜色', value: '粉色' }] },
      { id: 'b', name: '颜色', value: '红色', price: 5, inventory: 7, specs: [{ name: '颜色', value: '红色' }] },
    ], [{ name: '颜色', kind: 'color', values: ['粉色', '红色'] }], 10, 20)

    const r = B.batchInventory(
      { id: p.id, name: p.name, price: p.price, inventory: p.inventory, variants: p.variants, variantDims: p.variantDims },
      { mode: 'add', value: 5, scope: 'both' }
    )
    await prisma.product.update({
      where: { id: p.id },
      data: { inventory: r.product.inventory, variants: r.product.variants },
    })
    const after = await prisma.product.findUnique({ where: { id: p.id } })
    const vs = B.parseVariants(after.variants)
    t('变体 3→8 / 7→12', vs[0].inventory === 8 && vs[1].inventory === 12, JSON.stringify(vs.map(v => v.inventory)))
    t('商品 20→25', after.inventory === 25, String(after.inventory))
  }

  console.log('\n[② 批量改价：百分比]')
  {
    const p = await mkProduct('price', [
      { id: 'a', name: '颜色', value: '粉色', price: 10, inventory: 1, specs: [{ name: '颜色', value: '粉色' }] },
      { id: 'b', name: '颜色', value: '红色', price: 20, inventory: 1, specs: [{ name: '颜色', value: '红色' }] },
    ], null, 10, 0)

    const r = B.batchPrice(
      { id: p.id, name: p.name, price: p.price, inventory: p.inventory, variants: p.variants, variantDims: p.variantDims },
      { mode: 'percent', value: 10, scope: 'both' }
    )
    await prisma.product.update({
      where: { id: p.id },
      data: { price: r.product.price, variants: r.product.variants },
    })
    const after = await prisma.product.findUnique({ where: { id: p.id } })
    const vs = B.parseVariants(after.variants)
    t('变体 10→11 / 20→22', vs[0].price === 11 && vs[1].price === 22, JSON.stringify(vs.map(v => v.price)))
    t('主价 10→11', after.price === 11, String(after.price))
  }

  console.log('\n[③ 批量改名：颜色+随机数字，三处同步]')
  {
    const p = await mkProduct('rename', [
      { id: 'a', name: '颜色', value: '粉色', price: 5, inventory: 1, specs: [{ name: '颜色', value: '粉色' }] },
      { id: 'b', name: '颜色', value: '红色', price: 5, inventory: 1, specs: [{ name: '颜色', value: '红色' }] },
    ], [{ name: '颜色', kind: 'color', values: ['粉色', '红色'] }], 5, 0)

    const r = B.batchRename(
      { id: p.id, name: p.name, price: p.price, inventory: p.inventory, variants: p.variants, variantDims: p.variantDims },
      { digits: 4, sep: ' ' }
    )
    await prisma.product.update({
      where: { id: p.id },
      data: { variants: r.product.variants, variantDims: r.product.variantDims },
    })
    const after = await prisma.product.findUnique({ where: { id: p.id } })
    const vs = B.parseVariants(after.variants)
    t('变体名 = 颜色+4位数字', /^粉色 \d{4}$/.test(vs[0].value), vs[0].value)
    t('★ specs 同步', vs[0].specs[0].value === vs[0].value, JSON.stringify(vs[0].specs))
    const dims = JSON.parse(after.variantDims)
    t('★ variantDims 同步', dims[0].values[0] === vs[0].value, after.variantDims)
    t('两个变体数字不同', vs[0].value !== vs[1].value, JSON.stringify(vs.map(v => v.value)))
  }

  console.log('\n[④ 改名不影响图片/sku/描述]')
  {
    const p = await mkProduct('keep', [
      { id: 'a', name: '颜色', value: '粉色', price: 5, inventory: 1, image: 'https://x/y.jpg', sku: 'SKU-1', specs: [{ name: '颜色', value: '粉色' }] },
    ], null, 5, 0)
    const r = B.batchRename(
      { id: p.id, name: p.name, price: p.price, inventory: p.inventory, variants: p.variants, variantDims: p.variantDims },
      { digits: 4 }
    )
    await prisma.product.update({ where: { id: p.id }, data: { variants: r.product.variants } })
    const after = await prisma.product.findUnique({ where: { id: p.id } })
    const vs = B.parseVariants(after.variants)
    t('图片保留', vs[0].image === 'https://x/y.jpg')
    t('sku 保留', vs[0].sku === 'SKU-1')
    t('价格保留', vs[0].price === 5)
  }

  console.log(`\n通过 ${pass} / 失败 ${fail}`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(async () => {
    // 清理
    try {
      await prisma.product.deleteMany({ where: { id: { in: created } } })
      console.log(`（已清理 ${created.length} 个测试商品）`)
    } catch (e) { console.log('清理失败', e.message) }
    await prisma.$disconnect()
    process.exit(fail ? 1 : 0)
  })
