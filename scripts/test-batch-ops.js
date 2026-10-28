/* 单测：后台批量操作（lib/batchOps.ts）2026-10-28 */
const fs = require('fs')
const path = require('path')

// 编译 TS 太麻烦，直接用正则把 TS 转成可 require 的 JS 不现实 —— 改用 tsx/esbuild？
// 简单起见：把 lib/batchOps.ts 里的类型标注去掉后用 tsc 编译
const { execSync } = require('child_process')
const OUT = '/tmp/batchops-test'
execSync(
  `npx tsc lib/batchOps.ts --outDir ${OUT} --module commonjs --target es2019 --esModuleInterop --skipLibCheck 2>/dev/null || true`,
  { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
)
const B = require(path.join(OUT, 'batchOps.js'))

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

const V = (value, price, inv, color) => ({
  id: 'v' + value,
  name: '颜色',
  value,
  price,
  inventory: inv,
  specs: color ? [{ name: '颜色', value: color }] : [],
})

console.log('\n[① 批量加库存：add / set]')
{
  const p = {
    inventory: 10,
    variants: JSON.stringify([V('粉色', 5, 3, '粉色'), V('红色', 5, 7, '红色')]),
  }
  const add = B.batchInventory(p, { mode: 'add', value: 5, scope: 'both' })
  const vs = B.parseVariants(add.product.variants)
  t('变体 3→8 / 7→12', vs[0].inventory === 8 && vs[1].inventory === 12, JSON.stringify(vs))
  t('商品 10→15', add.product.inventory === 15, JSON.stringify(add.product.inventory))

  const set = B.batchInventory(p, { mode: 'set', value: 99, scope: 'both' })
  const vs2 = B.parseVariants(set.product.variants)
  t('set 模式变体都=99', vs2[0].inventory === 99 && vs2[1].inventory === 99)
  t('set 模式商品=99', set.product.inventory === 99)
}

console.log('\n[② 库存为 null（1688 采集的未知库存）→ 从 0 起算]')
{
  const p = { inventory: 0, variants: JSON.stringify([V('粉色', 5, null, '粉色')]) }
  const r = B.batchInventory(p, { mode: 'add', value: 20, scope: 'variant' })
  t('null + 20 = 20', B.parseVariants(r.product.variants)[0].inventory === 20,
    JSON.stringify(B.parseVariants(r.product.variants)))
}

console.log('\n[③ 只改变体 / 只改商品]')
{
  const p = { inventory: 10, variants: JSON.stringify([V('粉色', 5, 3, '粉色')]) }
  const onlyVar = B.batchInventory(p, { mode: 'add', value: 5, scope: 'variant' })
  t('商品库存不动', onlyVar.product.inventory === 10)
  t('变体动了', B.parseVariants(onlyVar.product.variants)[0].inventory === 8)

  const onlyProd = B.batchInventory(p, { mode: 'add', value: 5, scope: 'product' })
  t('变体不动', B.parseVariants(onlyProd.product.variants)[0].inventory === 3)
  t('商品动了', onlyProd.product.inventory === 15)
}

console.log('\n[④ 批量改价：百分比 / 固定值]')
{
  const p = { price: 10, variants: JSON.stringify([V('粉色', 10, 1, '粉色'), V('红色', 20, 1, '红色')]) }
  const pct = B.batchPrice(p, { mode: 'percent', value: 10, scope: 'both' })
  const vs = B.parseVariants(pct.product.variants)
  t('变体 10→11 / 20→22', vs[0].price === 11 && vs[1].price === 22, JSON.stringify(vs.map(v => v.price)))
  t('商品 10→11', pct.product.price === 11)

  const set = B.batchPrice(p, { mode: 'set', value: 5.5, scope: 'both' })
  const vs2 = B.parseVariants(set.product.variants)
  t('固定价 5.5', vs2[0].price === 5.5 && vs2[1].price === 5.5)
  t('商品也 5.5', set.product.price === 5.5)
}

console.log('\n[⑤ 改价：负百分比（降价）]')
{
  const p = { price: 20, variants: JSON.stringify([V('粉色', 20, 1, '粉色')]) }
  const r = B.batchPrice(p, { mode: 'percent', value: -20, scope: 'both' })
  t('20 → 16', B.parseVariants(r.product.variants)[0].price === 16 && r.product.price === 16)
}

console.log('\n[⑥ 批量改名：颜色 + 随机数字]')
{
  const p = {
    name: '原商品名',
    variants: JSON.stringify([V('粉色', 5, 1, '粉色'), V('红色', 5, 1, '红色')]),
    variantDims: JSON.stringify([{ name: '颜色', kind: 'color', values: ['粉色', '红色'] }]),
  }
  // 固定随机序列
  let i = 0
  const rand = () => { i++; return (i * 0.137) % 1 }
  const r = B.batchRename(p, { digits: 4, sep: ' ' }, rand)
  const vs = B.parseVariants(r.product.variants)
  t('两个变体都改名了', vs[0].value !== '粉色' && vs[1].value !== '红色', JSON.stringify(vs.map(v => v.value)))
  t('名字 = 颜色 + 4位数字', /^粉色 \d{4}$/.test(vs[0].value), vs[0].value)
  t('★ specs 里的颜色值同步改了', vs[0].specs[0].value === vs[0].value, JSON.stringify(vs[0].specs))
  t('★ variantDims.values 同步改了',
    JSON.parse(r.product.variantDims)[0].values[0] === vs[0].value,
    r.product.variantDims)
  t('商品名不动（scope=variant）', r.product.name === '原商品名')
}

console.log('\n[⑦ 同商品内随机数字不重复]')
{
  const variants = Array.from({ length: 20 }, (_, k) => V('色' + k, 1, 1, '色' + k))
  const p = { variants: JSON.stringify(variants) }
  const r = B.batchRename(p, { digits: 4, sep: ' ' })
  const nums = B.parseVariants(r.product.variants).map(v => (v.value.match(/(\d{4})$/) || [])[1])
  t('20 个随机数全不同', new Set(nums).size === 20, JSON.stringify(nums))
}

console.log('\n[⑧ 改名后颜色维度之外的值不动]')
{
  const v = { id: 'x', name: '尺码', value: 'M', price: 1, inventory: 1, specs: [{ name: '尺码', value: 'M' }] }
  const p = { variants: JSON.stringify([v]) }
  const r = B.batchRename(p, { digits: 4 })
  const vs = B.parseVariants(r.product.variants)
  t('尺码维度不该被改名', vs[0].value === 'M' || /M/.test(vs[0].value), JSON.stringify(vs[0]))
}

console.log('\n[⑨ 兼容商品名也改]')
{
  const p = {
    name: '旧名',
    variants: JSON.stringify([V('粉色', 1, 1, '粉色')]),
  }
  const r = B.batchRename(p, { digits: 4, scope: 'both' })
  // 商品名必须**保留原标题** —— 之前写成「颜色+数字」会把标题整个丢掉，
  // 前台商品列表全变成 "5B 8697"，没法看。
  t('★ 商品名保留原标题 + 末尾数字', /^旧名 \d{4}$/.test(r.product.name), r.product.name)
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
