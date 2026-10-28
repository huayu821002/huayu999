/* 回归：探测价差分 + 几何距离（2026-10-28 15:40）
 *
 * 用户报障：「变体价格还是统一了。没有根据规格采集准确的不同价格。」
 *
 * 根因（生产库实证）：
 *   skuCount: 0              → 接口里没有 SKU 容器
 *   variantImageCapture.hits: 32 → 探测抓到了 32 个色卡（变体来源正常）
 *   probePrices: null        → 但探测价一个都没抓到 → 所有变体共用商品价
 *
 * 旧 captureCurrentPrice 的致命限制：
 *   NUM = /[¥￥]\s*(\d+...)/ —— 要求文本里**必须**有 ¥/￥
 *   但 1688 常把 ¥ 和数字拆成两个 <span>，叶子元素 textContent 只有 "2.65"
 *   → 一个价格都抓不到
 *
 * 新方案（captureCurrentPrice2）：
 *   ① 差分：点击前后价格集合对比 → 新出现/变了的那个 = 当前 SKU 价
 *   ② 几何：离被点击色卡最近的价格元素
 *   ③ 退回旧的带 ¥ 逻辑
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

/** 造 DOM：leafs = [{txt, cls, x, y}] */
function makeDom(leafs) {
  const els = leafs.map(l => ({
    innerText: l.txt,
    textContent: l.txt,
    className: l.cls || 'x',
    children: [],
    getBoundingClientRect: () => ({ x: l.x || 0, y: l.y || 0, width: l.w || 10, height: l.h || 10 }),
  }))
  return {
    querySelectorAll: sel => (sel === '*' ? els : []),
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

console.log('\n[① parsePriceText：无 ¥ 的纯数字（小数）也要能解析]')
{
  const K = loadKernel(makeDom([]))
  const p = K.__test_parsePriceText
  t('¥2.65 → 2.65', p('¥2.65').v === 2.65, JSON.stringify(p('¥2.65')))
  t('￥2.65 → 2.65', p('￥2.65').v === 2.65, JSON.stringify(p('￥2.65')))
  t('2.65（无符号）→ 2.65', p('2.65').v === 2.65, JSON.stringify(p('2.65')))
  t('2.65元 → 2.65', p('2.65元').v === 2.65, JSON.stringify(p('2.65元')))
  t('132（整数）→ 拒绝', p('132') === null, JSON.stringify(p('132')))
  t('2件 → 拒绝', p('2件') === null, JSON.stringify(p('2件')))
  t('券后价2.65 → 拒绝', p('券后价2.65') === null, JSON.stringify(p('券后价2.65')))
}

console.log('\n[② 差分：点击后新出现的价 = 当前 SKU 价]')
{
  // 点击前：商品价 2.65 在 (600,300)
  const domBefore = makeDom([
    { txt: '¥2.65', cls: 'price', x: 600, y: 300 },
    { txt: '¥3.50', cls: 'other', x: 900, y: 700 },
  ])
  const K1 = loadKernel(domBefore)
  const before = K1.__test_priceSnapshot()

  // 点击后：色卡旁的价格变成 12.50
  const domAfter = makeDom([
    { txt: '¥12.50', cls: 'price', x: 600, y: 300 },
    { txt: '¥3.50', cls: 'other', x: 900, y: 700 },
  ])
  const K2 = loadKernel(domAfter)
  const r = K2.__test_captureCurrentPrice2(before, { x: 620, y: 320 })
  t('抓到 12.50', r && r.price === 12.5, JSON.stringify(r))
  t('来源是 diff', r && r.source === 'diff', JSON.stringify(r))
}

console.log('\n[③ 无变化时 → 几何最近（离点击点最近的那个）]')
{
  const domBefore = makeDom([
    { txt: '¥2.65', cls: 'price', x: 600, y: 300 },
    { txt: '¥99.00', cls: 'far', x: 1900, y: 1600 },
  ])
  const K1 = loadKernel(domBefore)
  const before = K1.__test_priceSnapshot()

  const domAfter = makeDom([
    { txt: '¥2.65', cls: 'price', x: 600, y: 300 },
    { txt: '¥99.00', cls: 'far', x: 1900, y: 1600 },
  ])
  const K2 = loadKernel(domAfter)
  const r = K2.__test_captureCurrentPrice2(before, { x: 600, y: 300 })
  t('取到近处的 2.65', r && r.price === 2.65, JSON.stringify(r))
  t('来源是 near', r && r.source === 'near', JSON.stringify(r))
}

console.log('\n[④ 远到离谱的价格不会被选（>600px）]')
{
  const dom = makeDom([
    { txt: '¥2.65', cls: 'price', x: 3000, y: 3000 },
  ])
  const K = loadKernel(dom)
  const r = K.__test_captureCurrentPrice2(new Map(), { x: 0, y: 0 })
  t('不返回 2.65（太远）', !r || r.price !== 2.65, JSON.stringify(r))
}

console.log('\n[⑤ 无符号价格也能被差分抓到]')
{
  const domBefore = makeDom([{ txt: '2.65', cls: 'price', x: 600, y: 300 }])
  const K1 = loadKernel(domBefore)
  const before = K1.__test_priceSnapshot()

  const domAfter = makeDom([{ txt: '12.50', cls: 'price', x: 600, y: 300 }])
  const K2 = loadKernel(domAfter)
  const r = K2.__test_captureCurrentPrice2(before, { x: 600, y: 300 })
  t('抓到 12.50（无 ¥）', r && r.price === 12.5, JSON.stringify(r))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
