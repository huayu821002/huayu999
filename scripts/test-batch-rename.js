/* 批量改名：单维度 vs 多维度 的真实行为核对（2026-10-28）
 *
 * 背景：把生产真实数据拉下来核对时发现两个真 bug：
 *  ① 多维度变体（颜色+尺码）改名时，整个 value 被替换成「颜色+数字」，
 *     尺码部分（" / M"）被吃掉。
 *  ② 商品改名会变成 "5B 8697" —— 商品标题直接丢了。
 *
 * 正确策略：
 *  · 单维度 → value / specs / variantDims 三处全同步
 *  · 多维度 → **只改 value**（颜色片段加数字），specs 和 dims 一个字都不动
 *               （维度值是多个变体共享的，给它加数字会把维度撑坏）
 *  · 商品名 → 保留原标题，末尾加数字
 */
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

// 固定随机序列：1000,1001,1002...
let seq = 1000
const rand = () => { seq += 1; return (seq % 900) / 1000 }

console.log('\n[① 单维度：value / specs / dims 三处全同步]')
{
  const p = {
    id: 'p1', name: 'Hairpin Set 5141', price: 3, inventory: 10,
    variants: JSON.stringify([
      { id: 'v0', name: 'Color', value: '5B', sku: null, price: 2.9, inventory: 5, image: 'i.jpg', specs: [{ name: 'Color', value: '5B' }] },
      { id: 'v1', name: 'Color', value: '5C', sku: null, price: 3.1, inventory: 6, image: 'i2.jpg', specs: [{ name: 'Color', value: '5C' }] },
    ]),
    variantDims: JSON.stringify([{ name: 'Color', kind: 'color', values: ['5B', '5C'] }]),
  }
  const r = B.batchRename(p, { digits: 4, scope: 'variant' }, rand)
  const vs = B.parseVariants(r.product.variants)
  const dims = JSON.parse(r.product.variantDims)

  t('value 变成 颜色+数字', /^5B \d{4}$/.test(vs[0].value), vs[0].value)
  t('★ specs 同步', vs[0].specs[0].value === vs[0].value, JSON.stringify(vs[0].specs))
  t('★ dims 同步', dims[0].values[0] === vs[0].value, JSON.stringify(dims[0].values))
  t('两个变体数字不同', vs[0].value !== vs[1].value, JSON.stringify(vs.map(v => v.value)))
  t('图片保留', vs[0].image === 'i.jpg')
  t('price 保留', vs[0].price === 2.9)
  t('inventory 保留', vs[0].inventory === 5)
  t('id 保留', vs[0].id === 'v0')
}

console.log('\n[② 多维度：只改 value，尺码不能丢，specs/dims 一个字都不动]')
{
  const p = {
    id: 'p2', name: 'Multi 5141', price: 3, inventory: 10,
    variants: JSON.stringify([
      { id: 'v0', name: 'Color / Size', value: '粉色 / M', specs: [{ name: 'Color', value: '粉色' }, { name: 'Size', value: 'M' }] },
      { id: 'v1', name: 'Color / Size', value: '粉色 / L', specs: [{ name: 'Color', value: '粉色' }, { name: 'Size', value: 'L' }] },
      { id: 'v2', name: 'Color / Size', value: '蓝色 / M', specs: [{ name: 'Color', value: '蓝色' }, { name: 'Size', value: 'M' }] },
    ]),
    variantDims: JSON.stringify([
      { name: 'Color', kind: 'color', values: ['粉色', '蓝色'] },
      { name: 'Size', kind: 'size', values: ['M', 'L'] },
    ]),
  }
  const r = B.batchRename(p, { digits: 4, scope: 'variant' }, rand)
  const vs = B.parseVariants(r.product.variants)
  const dims = JSON.parse(r.product.variantDims)

  t('★ 尺码没丢（/ M 还在）', vs[0].value.endsWith(' / M'), vs[0].value)
  t('★ 颜色片段加了数字', /^粉色 \d{4} \/ M$/.test(vs[0].value), vs[0].value)
  t('★ specs 完全没动', JSON.stringify(vs[0].specs) === JSON.stringify([{ name: 'Color', value: '粉色' }, { name: 'Size', value: 'M' }]), JSON.stringify(vs[0].specs))
  t('★ dims 完全没动', JSON.stringify(dims) === JSON.stringify([
    { name: 'Color', kind: 'color', values: ['粉色', '蓝色'] },
    { name: 'Size', kind: 'size', values: ['M', 'L'] },
  ]), JSON.stringify(dims))
  t('三个变体 value 互不相同', new Set(vs.map(v => v.value)).size === 3, JSON.stringify(vs.map(v => v.value)))
  t('两个粉色变体颜色值相同（维度共享，正确）',
    vs[0].specs[0].value === vs[1].specs[0].value, JSON.stringify(vs.map(v => v.specs[0].value)))
}

console.log('\n[③ 商品改名：保留原标题]')
{
  const p = {
    id: 'p3', name: 'Kids Hairpin Set Plaid Floral 5141', price: 3, inventory: 1,
    variants: JSON.stringify([{ id: 'v0', name: 'Color', value: '5B', specs: [{ name: 'Color', value: '5B' }] }]),
    variantDims: JSON.stringify([{ name: 'Color', kind: 'color', values: ['5B'] }]),
  }
  const r = B.batchRename(p, { digits: 4, scope: 'product' }, rand)
  t('★ 标题保留', r.product.name.startsWith('Kids Hairpin Set Plaid Floral 5141'), r.product.name)
  t('★ 末尾加 4 位数字', /^Kids Hairpin Set Plaid Floral 5141 \d{4}$/.test(r.product.name), r.product.name)
  t('变体没被动', B.parseVariants(r.product.variants)[0].value === '5B')
}

console.log('\n[④ scope=both：商品名和变体名都改]')
{
  const p = {
    id: 'p4', name: 'Product ABC', price: 3, inventory: 1,
    variants: JSON.stringify([{ id: 'v0', name: 'Color', value: '5B', specs: [{ name: 'Color', value: '5B' }] }]),
    variantDims: JSON.stringify([{ name: 'Color', kind: 'color', values: ['5B'] }]),
  }
  const r = B.batchRename(p, { digits: 4, scope: 'both' }, rand)
  t('商品名变了', r.product.name !== 'Product ABC', r.product.name)
  t('变体名变了', B.parseVariants(r.product.variants)[0].value !== '5B')
  t('数字不重复（商品名 vs 变体名）',
    r.product.name.split(' ').pop() !== B.parseVariants(r.product.variants)[0].value.split(' ').pop(),
    `${r.product.name} vs ${B.parseVariants(r.product.variants)[0].value}`)
}

console.log('\n[⑤ 无 specs 的老格式变体]')
{
  const p = {
    id: 'p5', name: 'Legacy', price: 3, inventory: 1,
    variants: JSON.stringify([{ id: 'v0', name: '颜色', value: '1 粉色', specs: [] }]),
    variantDims: null,
  }
  const r = B.batchRename(p, { digits: 4, scope: 'variant' }, rand)
  const v = B.parseVariants(r.product.variants)[0]
  t('value 变成 颜色+数字', /^1 粉色 \d{4}$/.test(v.value), v.value)
}

console.log('\n[⑥ 真实场景：多个变体共享同一个颜色值]')
{
  // 生产真实数据：两个变体的颜色值都是 "Rhinestone Bow Hairpin…"（截断后同名），
  // 旧实现用「旧值→新值」一对一 map，后写覆盖先写 →
  // dims 里两个值都变成同一个新值，和变体 value 对不上。
  const p = {
    id: 'p6', name: 'Bow Hairpin', price: 3, inventory: 1,
    variants: JSON.stringify([
      { id: 'v0', name: 'Color', value: 'Rhinestone Bow Hairpin…', specs: [{ name: 'Color', value: 'Rhinestone Bow Hairpin…' }] },
      { id: 'v1', name: 'Color', value: 'Rhinestone Bow Hairpin…', specs: [{ name: 'Color', value: 'Rhinestone Bow Hairpin…' }] },
    ]),
    variantDims: JSON.stringify([
      { name: 'Material', kind: 'custom', values: ['Style', 'Hairpin Classification'] },
      { name: 'Color', kind: 'color', values: ['Rhinestone Bow Hairpin…', 'Rhinestone Bow Hairpin…'] },
    ]),
  }
  const r = B.batchRename(p, { digits: 4, scope: 'variant' }, rand)
  const vs = B.parseVariants(r.product.variants)
  const dims = JSON.parse(r.product.variantDims)

  t('两个变体拿到不同数字', vs[0].value !== vs[1].value, JSON.stringify(vs.map(v => v.value)))
  t('★ specs 各自同步', vs[0].specs[0].value === vs[0].value && vs[1].specs[0].value === vs[1].value,
    JSON.stringify(vs.map(v => v.specs[0].value)))
  const colorDim = dims.find(d => d.name === 'Color')
  t('★ dims 用去重后的新值集合重建', JSON.stringify(colorDim.values) === JSON.stringify([vs[0].value, vs[1].value]),
    JSON.stringify(colorDim.values))
  const matDim = dims.find(d => d.name === 'Material')
  t('非颜色维度不动', JSON.stringify(matDim.values) === JSON.stringify(['Style', 'Hairpin Classification']),
    JSON.stringify(matDim.values))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
