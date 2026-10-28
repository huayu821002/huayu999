/* 回归：探测时抓「当前显示价」回填逐变体价格（2026-10-28）
 *
 * 为什么需要这个：
 *   1688 的 offerdetail 报文里**没有**逐 SKU 价格容器
 *   （skuInfos / skuModel / skuMap / skuPriceMap / skuList / skuProps / saleProp 全都没有），
 *   DOM 规格表也常常没有价格列 —— 于是所有变体被统一兜底成同一个商品价。
 *
 *   但用户**点某个颜色**时，页面会实时显示该 SKU 的价格。
 *   采集器在探测（点击）时顺手把那个价抓下来，采集结束时回填到变体上。
 *
 * 测试点：
 *   ① 价格元素能被读到
 *   ② 探测价按规格值回填到对应变体
 *   ③ 匹配歧义 → 不填（猜错比没价更糟）
 *   ④ 多个规格命中不同价 → 放弃
 *   ⑤ 没有探测记录 → 不动
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

/** 造一个带价格显示的页面 */
function makeDoc(priceText, extra = {}) {
  const priceEl = {
    children: [],
    innerText: priceText,
    textContent: priceText,
    className: 'price',
  }
  const body = {
    innerText: priceText,
    textContent: priceText,
    className: 'detail-price',
  }
  return {
    body,
    priceEl,
    doc: {
      querySelectorAll: sel => {
        if (sel === '[class*="price"]' || sel === '[id*="price"]') {
          return extra.noPrice ? [] : [priceEl, body]
        }
        if (sel === '*') return extra.leaves || []
        return []
      },
      querySelector: () => null,
      addEventListener: () => {},
    },
  }
}

function loadKernel(doc) {
  const sandbox = {
    document: doc,
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

console.log('\n[① 读取页面当前显示价]')
{
  const { doc } = makeDoc('¥12.80')
  const K = loadKernel(doc)
  const r = K.captureCurrentPrice()
  t('读到 ¥12.80', r && r.price === 12.8, JSON.stringify(r))
  t('来源标记为 container', r && r.source === 'container', JSON.stringify(r))
}
{
  const { doc } = makeDoc('￥  8.50 起')
  const K = loadKernel(doc)
  const r = K.captureCurrentPrice()
  t('全角￥ + 空格 + 「起」也能读', r && r.price === 8.5, JSON.stringify(r))
}
{
  const { doc } = makeDoc('no price here')
  const K = loadKernel(doc)
  const r = K.captureCurrentPrice()
  t('没有价格 → 返回 null', r === null, JSON.stringify(r))
}

console.log('\n[② 探测价回填到变体]')
{
  const { doc } = makeDoc('¥12.80')
  const K = loadKernel(doc)
  // 模拟探测结果
  K.api // noop
  const variants = [
    { color: '爱马仕橙', specs: [{ name: '颜色', value: '爱马仕橙' }], price: 5.83 },
    { color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], price: 5.83 },
  ]
  // 模拟探测结果：直接注入 VARIANT_CAPTURE.prices
  const injected = K.__test_setProbePrices
    ? K.__test_setProbePrices({ 爱马仕橙: 12, 丁香紫: 18 })
    : null
  if (!injected) {
    console.log('  (跳过：无测试注入钩子)')
  } else {
    const st = K.applyProbePrices(variants)
    t('回填了 2 个变体', st.filled === 2, JSON.stringify(st))
    t('价格逐个不同', variants[0].price === 12 && variants[1].price === 18,
      JSON.stringify(variants.map(v => v.price)))
  }
}

console.log('\n[③ 匹配歧义 → 不填]')
{
  const { doc } = makeDoc('¥12.80')
  const K = loadKernel(doc)
  K.__test_setProbePrices({ 深灰: 12, 灰: 18 })
  const variants = [
    { color: '深灰', specs: [{ name: '颜色', value: '深灰' }], price: 5.83 },
  ]
  const st = K.applyProbePrices(variants)
  t('两个探测值都弱匹配 → 不填', st.filled === 0, JSON.stringify(st))
  t('价格保持原样', variants[0].price === 5.83, JSON.stringify(variants))
}

console.log('\n[④ 多个规格命中不同价 → 放弃]')
{
  const { doc } = makeDoc('¥12.80')
  const K = loadKernel(doc)
  K.__test_setProbePrices({ 红: 12, 大: 18 })
  const variants = [
    { color: '红', specs: [{ name: '颜色', value: '红' }, { name: '尺码', value: '大' }], price: 5.83 },
  ]
  const st = K.applyProbePrices(variants)
  t('命中两个不同价 → 不填', st.filled === 0, JSON.stringify(st))
}

console.log('\n[⑤ 没有探测记录 → 不动]')
{
  const { doc } = makeDoc('¥12.80')
  const K = loadKernel(doc)
  K.__test_setProbePrices({})
  const variants = [{ color: '红', specs: [{ name: '颜色', value: '红' }], price: 5.83 }]
  const st = K.applyProbePrices(variants)
  t('没有探测价 → skipped=no-probe-prices', st.skipped === 'no-probe-prices', JSON.stringify(st))
  t('价格不变', variants[0].price === 5.83)
}

console.log('\n[⑥ 双向唯一时才填]')
{
  const { doc } = makeDoc('¥12.80')
  const K = loadKernel(doc)
  K.__test_setProbePrices({ 'P064 深灰': 12 })
  const variants = [
    { color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }], price: 5.83 },
  ]
  const st = K.applyProbePrices(variants)
  t('包含关系且唯一 → 填上', st.filled === 1, JSON.stringify(st))
  t('价格正确', variants[0].price === 12, JSON.stringify(variants))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
