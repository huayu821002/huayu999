/**
 * 线上多维度变体验证：
 * 造一个「颜色 × 尺码」的商品 → 拉真实前台 API → 校验维度行/匹配/价格
 * 测完删除
 */
const fs = require('fs')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')

const vsrc = fs.readFileSync('/home/admin/Fiestaflare/lib/variants.ts', 'utf8')
const vjs = ts.transpileModule(vsrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const vmod = { exports: {} }
new Function('module', 'exports', 'require', vjs)(vmod, vmod.exports, require)
const { toProductVariants, buildVariantRows, matchVariant } = vmod.exports

const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const COLLECT = [
  { skuId: 'c1', specs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }], price: 10, image: 'https://img/red-m.jpg' },
  { skuId: 'c2', specs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'L' }], price: 11, image: 'https://img/red-l.jpg' },
  { skuId: 'c3', specs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'M' }], price: 12, image: 'https://img/blue-m.jpg' },
  { skuId: 'c4', specs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'L' }], price: 13, image: 'https://img/blue-l.jpg' },
]

;(async () => {
  const variants = toProductVariants(COLLECT, [], { markup: 3, rate: 7.2 })
  const slug = `e2e-multidim-${Date.now()}`
  const product = await prisma.product.create({
    data: {
      name: 'E2E Multi Dimension Test', slug, sku: `e2e-md-${Date.now()}`,
      description: '多维度测试', price: 4.17, inventory: 50, minOrderQty: 1,
      images: JSON.stringify(['https://img/main.jpg']),
      variants: JSON.stringify(variants), isActive: false, tags: 'e2e-test',
    },
  })
  await prisma.$disconnect()

  const res = await fetch(`https://fiestaflare.com/api/products/${slug}`)
  const j = await res.json()
  const apiVariants = j?.data?.variants || []
  console.log('HTTP', res.status, '| 变体数', apiVariants.length)

  console.log('\n[维度行]')
  const rows = buildVariantRows(apiVariants)
  t('2 行', rows.length === 2, JSON.stringify(rows))
  t('行1 = 颜色（2 值）', rows[0]?.name === '颜色' && rows[0].values.length === 2, JSON.stringify(rows[0]))
  t('行2 = 尺码（2 值）', rows[1]?.name === '尺码' && rows[1].values.length === 2, JSON.stringify(rows[1]))

  console.log('\n[匹配]')
  t('红+M', matchVariant(apiVariants, { 颜色: '红色', 尺码: 'M' })?.value === '红色 / M', matchVariant(apiVariants, { 颜色: '红色', 尺码: 'M' })?.value)
  t('蓝+L', matchVariant(apiVariants, { 颜色: '蓝色', 尺码: 'L' })?.value === '蓝色 / L')
  t('蓝+L 变体图', matchVariant(apiVariants, { 颜色: '蓝色', 尺码: 'L' })?.image === 'https://img/blue-l.jpg')
  t('红+M 价格 = 10*3/7.2 = 4.17', Math.abs(matchVariant(apiVariants, { 颜色: '红色', 尺码: 'M' })?.price - 4.17) < 0.01, String(matchVariant(apiVariants, { 颜色: '红色', 尺码: 'M' })?.price))
  t('specs 传到前台了', apiVariants[0]?.specs?.length === 2, JSON.stringify(apiVariants[0]?.specs))
  t('库存 null', apiVariants[0]?.inventory === null, String(apiVariants[0]?.inventory))

  // 清理
  const p2 = new PrismaClient({ datasources: { db: { url } } })
  await p2.product.delete({ where: { id: product.id } })
  await p2.$disconnect()
  console.log('\n已清理')
  console.log('--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
