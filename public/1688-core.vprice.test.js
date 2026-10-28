/* 回归：逐变体价格回填（2026-10-28）
 *
 * 真实 bug：offer 1053718496164（UPF50 遮阳帽）22 个变体价格全是 5.83，
 *   前台选哪个颜色/尺码都是同一个价。
 *
 * 根因：offerdetail 报文里**没有**逐 SKU 价格容器
 *   （无 skuInfos / skuMap / skuPriceMap / skuList / skuProps / saleProp），
 *   pickVariants 出来的变体价格全是商品级兜底价。
 *   而 DOM 上渲染的规格表其实一行一个真实价。
 *
 * 修复：backfillVariantPrices() —— 接口变体价去重后只有 1 个时，
 *   用 DOM 规格表按「维度名+规格值」集合逐行匹配回填。
 *   匹配不上 → 保留原值，不猜。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

function loadKernel() {
  const sandbox = {
    document: { querySelectorAll: () => [], querySelector: () => null },
    location: { href: 'https://detail.1688.com/offer/1053718496164.html' },
    console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setHeader = () => {} },
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.FF1688
}

const K = loadKernel()
const bf = K.backfillVariantPrices

console.log('\n[① 接口变体价全相同 → DOM 表回填]')
{
  // 22 个变体全 5.83（兜底价），DOM 表逐行真实价
  const variants = [
    { specs: [{ name: '颜色', value: '爱马仕橙' }, { name: '尺码', value: '儿童' }], price: 5.83 },
    { specs: [{ name: '颜色', value: '爱马仕橙' }, { name: '尺码', value: '成人' }], price: 5.83 },
    { specs: [{ name: '颜色', value: '丁香紫' }, { name: '尺码', value: '儿童' }], price: 5.83 },
    { specs: [{ name: '颜色', value: '丁香紫' }, { name: '尺码', value: '成人' }], price: 5.83 },
  ]
  const domVars = [
    { specs: [{ name: '颜色', value: '爱马仕橙' }, { name: '尺码', value: '儿童' }], price: 12 },
    { specs: [{ name: '颜色', value: '爱马仕橙' }, { name: '尺码', value: '成人' }], price: 15 },
    { specs: [{ name: '颜色', value: '丁香紫' }, { name: '尺码', value: '儿童' }], price: 18 },
    { specs: [{ name: '颜色', value: '丁香紫' }, { name: '尺码', value: '成人' }], price: 21 },
  ]
  const r = bf(variants, domVars)
  t('回填了 4 个变体', r.filled === 4, JSON.stringify(r))
  t('价格逐个不同', new Set(r.variants.map(v => v.price)).size === 4,
    JSON.stringify(r.variants.map(v => v.price)))
  t('价格对应正确（12/15/18/21）',
    r.variants.map(v => v.price).join(',') === '12,15,18,21',
    JSON.stringify(r.variants.map(v => v.price)))
}

console.log('\n[② 接口变体价已有差异 → 不动]')
{
  const variants = [
    { specs: [{ name: '颜色', value: '红' }], price: 10 },
    { specs: [{ name: '颜色', value: '蓝' }], price: 20 },
  ]
  const domVars = [
    { specs: [{ name: '颜色', value: '红' }], price: 99 },
    { specs: [{ name: '颜色', value: '蓝' }], price: 99 },
  ]
  const r = bf(variants, domVars)
  t('已有差异时不回填', r.filled === 0 && r.skipped === 'prices-already-differ', JSON.stringify(r))
  t('价格保持原样', r.variants[0].price === 10 && r.variants[1].price === 20)
}

console.log('\n[③ DOM 匹配不上 → 保留原值，不猜]')
{
  const variants = [
    { specs: [{ name: '颜色', value: '红' }], price: 5.83 },
    { specs: [{ name: '颜色', value: '蓝' }], price: 5.83 },
  ]
  const domVars = [
    { specs: [{ name: '颜色', value: '绿' }], price: 30 },
  ]
  const r = bf(variants, domVars)
  t('匹配不上不改价', r.variants.every(v => v.price === 5.83), JSON.stringify(r.variants))
  t('filled 为 0', r.filled === 0, JSON.stringify(r))
}

console.log('\n[④ 规格名不同 → 不匹配]')
{
  const variants = [
    { specs: [{ name: '颜色', value: '红' }], price: 5.83 },
    { specs: [{ name: '颜色', value: '蓝' }], price: 5.83 },
  ]
  const domVars = [
    { specs: [{ name: '款式', value: '红' }], price: 30 },
  ]
  const r = bf(variants, domVars)
  t('维度名不同不算同一个 SKU', r.filled === 0, JSON.stringify(r))
}

console.log('\n[⑤ 归一化：空格/括号/大小写不影响匹配]')
{
  const variants = [
    { specs: [{ name: '颜色', value: 'P064 深灰' }, { name: '规格', value: '均码【双面锦纶】' }], price: 5.83 },
    { specs: [{ name: '颜色', value: 'P064 浅灰' }, { name: '规格', value: '均码【双面锦纶】' }], price: 5.83 },
  ]
  const domVars = [
    { specs: [{ name: '颜色', value: 'P064深灰' }, { name: '规格', value: '均码双面锦纶' }], price: 12 },
    { specs: [{ name: '颜色', value: 'p064 浅灰' }, { name: '规格', value: '均码双面锦纶' }], price: 18 },
  ]
  const r = bf(variants, domVars)
  t('空格/括号/大小写归一后能匹配', r.filled === 2, JSON.stringify(r))
  t('回填后价格正确', r.variants[0].price === 12 && r.variants[1].price === 18,
    JSON.stringify(r.variants.map(v => v.price)))
}

console.log('\n[⑥ 边界情况不炸]')
{
  t('空数组 → 不炸', bf([], []).filled === 0)
  t('只有 1 个变体 → 不回填', bf([{ specs: [], price: 1 }], []).skipped === 'too-few-variants')
  t('DOM 无价格 → 不回填', bf(
    [{ specs: [{ name: 'a', value: 'x' }], price: 1 }, { specs: [{ name: 'a', value: 'y' }], price: 1 }],
    [{ specs: [{ name: 'a', value: 'x' }], price: null }]
  ).filled === 0)
  t('变体全无价 → no-prices', bf(
    [{ specs: [{ name: 'a', value: 'x' }] }, { specs: [{ name: 'a', value: 'y' }] }],
    [{ specs: [{ name: 'a', value: 'x' }], price: 5 }]
  ).skipped === 'no-prices')
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
