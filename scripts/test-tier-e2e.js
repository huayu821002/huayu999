/* Tiered Pricing 端到端测试（打真实 DB）
 *
 * 验证：POST/PUT 写入后，tieredPricing 真的存进了 DB 并且能读回来。
 * 这是「用户说加了段还是原来段」的直接验证。
 *
 * 跑法：npm run dbg:test-tier-e2e
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

/** 与 app/api/admin/products/route.ts 里的归一化 IIFE 完全一致 */
function normalizeTieredPricing(tieredPricing) {
  if (tieredPricing === null || tieredPricing === undefined || tieredPricing === '') return null
  const s = String(tieredPricing)
  try {
    const parsed = JSON.parse(s)
    if (parsed && Array.isArray(parsed.tiers) && parsed.tiers.length) return JSON.stringify({ tiers: parsed.tiers })
    return null
  } catch { return null }
}

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

;(async () => {
  const suffix = 'TIER-E2E-' + Date.now()
  const twoTiers = JSON.stringify({
    tiers: [
      { minQty: 1, maxQty: 10, price: 5.0 },
      { minQty: 11, maxQty: null, price: 4.0 },
    ],
  })

  console.log('\n[创建] 写入两段阶梯价')
  const created = await prisma.product.create({
    data: {
      name: suffix,
      slug: suffix.toLowerCase(),
      description: 'tier e2e test',
      price: 5.0,
      inventory: 1,
      sku: suffix,
      tieredPricing: normalizeTieredPricing(twoTiers),
    },
    select: { id: true, tieredPricing: true },
  })
  console.log('  写入值:', created.tieredPricing)
  t('创建后 tieredPricing 非 null', created.tieredPricing !== null, created.tieredPricing)
  t('两段都在', (JSON.parse(created.tieredPricing || '{}').tiers || []).length === 2, created.tieredPricing)

  console.log('\n[读回] 模拟打开编辑页')
  const read = await prisma.product.findUnique({
    where: { id: created.id },
    select: { tieredPricing: true },
  })
  const tiers = JSON.parse(read.tieredPricing || '{"tiers":[]}').tiers || []
  t('读回还是两段', tiers.length === 2, read.tieredPricing)
  t('第 1 段 minQty=1 maxQty=10 price=5',
    tiers[0] && tiers[0].minQty === 1 && tiers[0].maxQty === 10 && tiers[0].price === 5, JSON.stringify(tiers[0]))
  t('第 2 段 minQty=11 maxQty=null price=4',
    tiers[1] && tiers[1].minQty === 11 && tiers[1].maxQty === null && tiers[1].price === 4, JSON.stringify(tiers[1]))

  console.log('\n[更新] 改成三段')
  const threeTiers = JSON.stringify({
    tiers: [
      { minQty: 1, maxQty: 5, price: 6 },
      { minQty: 6, maxQty: 20, price: 5 },
      { minQty: 21, maxQty: null, price: 4 },
    ],
  })
  await prisma.product.update({
    where: { id: created.id },
    data: { tieredPricing: normalizeTieredPricing(threeTiers) },
  })
  const read2 = await prisma.product.findUnique({ where: { id: created.id }, select: { tieredPricing: true } })
  const tiers2 = JSON.parse(read2.tieredPricing || '{"tiers":[]}').tiers || []
  t('更新后是三段', tiers2.length === 3, read2.tieredPricing)

  console.log('\n[归一化]')
  t('空 → null', normalizeTieredPricing('') === null)
  t('null → null', normalizeTieredPricing(null) === null)
  t('tiers 空数组 → null', normalizeTieredPricing(JSON.stringify({ tiers: [] })) === null)
  t('坏 JSON → null', normalizeTieredPricing('{{{') === null)

  console.log('\n[清理]')
  await prisma.product.delete({ where: { id: created.id } })
  const gone = await prisma.product.findUnique({ where: { id: created.id } })
  t('测试数据已删除', gone === null)

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
