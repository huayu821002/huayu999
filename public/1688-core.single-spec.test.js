/* 回归：单维度规格表把「库存/数量」列当成价格（2026-10-28）
 *
 * 用户报障：offer 604497188808（只有颜色一个规格）采集的变体价格全是 **1**，
 *   真实价 2.65。
 *   「前面测试成功的都是二种变体（颜色+尺码）」——**单规格才有问题**。
 *
 * 根因：domSkuPrices() 用 cells.slice(1).join(' ').match(/\d+/) 取价：
 *   | 颜色 | 库存 | 价格 | / | 1 粉色 | 1 | 2.65 |  → 先匹配到**库存的 1**
 *   | 颜色 | 尺码 | 价格 | / | 红色  | M  | 12.5 | → 尺码无数字，碰巧抓到 12.5
 *   多维度碰巧对、单维度必错 —— 完美对应用户观察。
 *
 * 而且 skuPrices[0].price 会直接覆盖商品价 pr.lo → 全链路价格都错。
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

/** 造一个最小的 DOM 环境 */
function makeDom(tableSpec) {
  const cell = txt => ({ innerText: txt, textContent: txt, querySelectorAll: () => [] })
  const row = cells => ({
    innerText: cells.join(' '),
    textContent: cells.join(' '),
    querySelectorAll: () => cells.map(cell),
  })
  const rows = tableSpec.map(row)
  const table = { querySelectorAll: () => rows }
  return {
    querySelectorAll: sel => (sel === 'table' ? [table] : []),
    querySelector: () => null,
  }
}

function loadKernel(dom) {
  const sandbox = {
    document: dom,
    location: { href: 'https://detail.1688.com/offer/604497188808.html' },
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

console.log('\n[① 单维度表：| 颜色 | 库存 | 价格 |]')
{
  const dom = makeDom([
    ['颜色', '库存', '价格'],
    ['1 粉色', '1', '2.65'],
    ['2 玫红', '1', '2.65'],
    ['3 红色', '1', '2.65'],
  ])
  const K = loadKernel(dom)
  const list = K.__test_domSkuPrices()
  t('skuPrices 非空', list.length > 0, JSON.stringify(list))
  t('价格是 2.65 不是 1', list.every(x => x.price === 2.65), JSON.stringify(list))
  t('规格是 "1 粉色"', list[0] && list[0].spec.includes('粉色'), JSON.stringify(list[0]))
}

console.log('\n[② 单维度表：| 颜色 | 数量 | 价格 |]')
{
  const dom = makeDom([
    ['颜色', '数量', '价格'],
    ['1 粉色', '100', '2.65'],
  ])
  const K = loadKernel(dom)
  const list = K.__test_domSkuPrices()
  t('价格是 2.65（不是数量 100）', list.length === 1 && list[0].price === 2.65, JSON.stringify(list))
}

console.log('\n[③ 多维度表：| 颜色 | 尺码 | 价格 |] 仍然正常]')
{
  const dom = makeDom([
    ['颜色', '尺码', '价格'],
    ['红色', 'M', '12.5'],
    ['蓝色', 'L', '13.0'],
  ])
  const K = loadKernel(dom)
  const list = K.__test_domSkuPrices()
  t('两条都抓到', list.length === 2, JSON.stringify(list))
  t('价格 12.5 / 13.0', list[0] && list[0].price === 12.5 && list[1] && list[1].price === 13, JSON.stringify(list))
}

console.log('\n[④ 表头没写「价格」列时，右往左找纯价格格]')
{
  const dom = makeDom([
    ['颜色', '库存', '售价'],
    ['1 粉色', '1', '2.65'],
  ])
  const K = loadKernel(dom)
  const list = K.__test_domSkuPrices()
  t('价格 2.65', list.length === 1 && list[0].price === 2.65, JSON.stringify(list))
}

console.log('\n[⑤ 表头没有价格列也没有纯价格格 → 不瞎猜]')
{
  const dom = makeDom([
    ['颜色', '库存'],
    ['1 粉色', '1'],
  ])
  const K = loadKernel(dom)
  const list = K.__test_domSkuPrices()
  t('不产生价格（宁缺勿错）', list.length === 0, JSON.stringify(list))
}

console.log('\n[⑥ 阶梯价表不受影响]')
{
  const dom = makeDom([
    ['起订量', '价格'],
    ['2', '2.50'],
    ['100', '2.00'],
  ])
  const K = loadKernel(dom)
  const list = K.__test_domSkuPrices()
  t('阶梯价 2.50 / 2.00', list.length >= 1 && list[0].price === 2.5, JSON.stringify(list))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
