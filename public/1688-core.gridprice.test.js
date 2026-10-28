/* 回归：div 网格形态的规格价格表 + 只按值匹配的降级（2026-10-28 15:27）
 *
 * 用户报障：「有的产品变体规格价格不一样。但是采集后变体价格都是一个价格。」
 *
 * 原因：1688 的逐 SKU 价格表**很多商品不是 <table>**，而是 div 网格：
 *   <div class="sku-item"><div>1 粉色</div><div>¥12.50</div></div>
 * domVariants / domSkuPrices 都只查 <table> → 抓不到 →
 * 所有变体只能共用商品级兜底价。
 *
 * 修法：
 *   ① 新增 domSkuPriceGrid()：扫「规格文本 + 价格同格」的元素，
 *      同一父容器下 ≥2 条才认定为 SKU 列表（不依赖 class 名）
 *   ② domVariants / domSkuPrices 各加一条 grid 兜底
 *   ③ backfillVariantPrices 加「只按规格值匹配」的降级
 *      （DOM 侧维度名是「规格」、变体侧是「颜色」，严格匹配对不上）
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

/** 造一个 div 网格形态的 SKU 价格表 */
function makeGridDom(rows) {
  // <div class="sku-list">
  //   <div class="sku-item"><span>1 粉色</span><span>¥12.50</span></div>
  //   ...
  // </div>
  const item = (spec, price) => {
    const leaf = txt => ({ innerText: txt, textContent: txt, tagName: 'SPAN', children: [], className: 'x' })
    const span1 = leaf(spec)
    const span2 = leaf('¥' + price)
    const el = {
      innerText: spec + ' ¥' + price,
      textContent: spec + ' ¥' + price,
      tagName: 'DIV',
      className: 'sku-item',
      children: [span1, span2],
      parentElement: null,
    }
    span1.parentElement = el
    span2.parentElement = el
    return el
  }
  const items = rows.map(r => item(r[0], r[1]))
  const list = {
    innerText: rows.map(r => r[0] + ' ¥' + r[1]).join(' '),
    textContent: '',
    tagName: 'DIV',
    className: 'sku-list',
    children: items,
    parentElement: null,
  }
  items.forEach(i => { i.parentElement = list })

  return {
    querySelectorAll: sel => {
      if (sel === 'table') return []
      if (sel === 'div, li, td, span, a, p') return [list, ...items]
      return []
    },
    querySelector: () => null,
  }
}

function loadKernel(dom) {
  const sandbox = {
    document: dom,
    location: { href: 'https://detail.1688.com/offer/x.html' },
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

console.log('\n[① domSkuPriceGrid：div 网格能解析出规格→价格]')
{
  const dom = makeGridDom([['1 粉色', '12.50'], ['2 玫红', '13.00'], ['3 红色', '12.80']])
  const K = loadKernel(dom)
  const res = K.__test_domSkuPriceGrid({ lo: 10, hi: 20 })
  t('解析出 3 条', res.length === 3, JSON.stringify(res))
  t('价格 12.50 / 13.00 / 12.80',
    res[0] && res[0].price === 12.5 && res[1] && res[1].price === 13 && res[2] && res[2].price === 12.8,
    JSON.stringify(res))
  t('规格是「1 粉色」', res[0] && res[0].spec === '1 粉色', JSON.stringify(res[0]))
}

console.log('\n[② 只有一个元素 → 不认定是 SKU 列表（避免把商品价当规格价）]')
{
  const dom = makeGridDom([['1 粉色', '12.50']])
  const K = loadKernel(dom)
  const res = K.__test_domSkuPriceGrid({ lo: 10, hi: 20 })
  t('不产出', res.length === 0, JSON.stringify(res))
}

console.log('\n[③ backfillVariantPrices：维度名不同也能按值回填]')
{
  const K = loadKernel({ querySelectorAll: () => [], querySelector: () => null })
  const variants = [
    { specs: [{ name: '颜色', value: '1 粉色' }], price: 2.2, color: '1 粉色' },
    { specs: [{ name: '颜色', value: '2 玫红' }], price: 2.2, color: '2 玫红' },
    { specs: [{ name: '颜色', value: '3 红色' }], price: 2.2, color: '3 红色' },
  ]
  // DOM 侧维度名是「规格」（div 网格解析结果）
  const domVars = [
    { specs: [{ name: '规格', value: '1 粉色' }], price: 12.5 },
    { specs: [{ name: '规格', value: '2 玫红' }], price: 13.0 },
    { specs: [{ name: '规格', value: '3 红色' }], price: 12.8 },
  ]
  const r = K.backfillVariantPrices(variants, domVars)
  t('回填了 3 个', r.filled === 3, JSON.stringify(r))
  t('价格 12.5 / 13 / 12.8',
    r.variants[0].price === 12.5 && r.variants[1].price === 13 && r.variants[2].price === 12.8,
    JSON.stringify(r.variants.map(v => v.price)))
}

console.log('\n[④ 值不唯一 → 不降级匹配（宁缺勿错）]')
{
  const K = loadKernel({ querySelectorAll: () => [], querySelector: () => null })
  const variants = [
    { specs: [{ name: '颜色', value: '粉色' }], price: 2.2 },
    { specs: [{ name: '尺码', value: '粉色' }], price: 2.2 },
  ]
  const domVars = [
    { specs: [{ name: '规格', value: '粉色' }], price: 12.5 },
    { specs: [{ name: '规格', value: '粉色' }], price: 13.0 },
  ]
  const r = K.backfillVariantPrices(variants, domVars)
  t('不填（值重复）', r.filled === 0, JSON.stringify(r))
}

console.log('\n[⑤ 变体价本来就不同时不动]')
{
  const K = loadKernel({ querySelectorAll: () => [], querySelector: () => null })
  const variants = [
    { specs: [{ name: '颜色', value: '粉色' }], price: 1 },
    { specs: [{ name: '颜色', value: '玫红' }], price: 2 },
  ]
  const r = K.backfillVariantPrices(variants, [{ specs: [{ name: '颜色', value: '粉色' }], price: 9 }])
  t('skipped=prices-already-differ', r.skipped === 'prices-already-differ', JSON.stringify(r))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
