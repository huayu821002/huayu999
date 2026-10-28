/* 回归：探测值里混进非规格文案（2026-10-28）
 *
 * 生产数据实测（offer 1078546345348 / 1060633669649）：
 *   probePrices 里出现这些 key：
 *     "Fiestaflare 采集器 v2.47.0"   ← 采集器面板自己的标题
 *     "探测变体图"                    ← 采集器面板的按钮
 *     "已售500+对"                    ← 1688 销量文案
 *     "－"                            ← 页面上的分隔符
 *   真正的规格是 "藏蓝色（2个一包）"、"粉色（2个一包）" 这种。
 *
 * 修法：
 *  ① 点在采集器自己的 UI（#ff1688-panel / #ff1688-capture / #ff-core-nag）→ 忽略
 *  ② 值提取后过滤明显不是规格的文案
 */
const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

const sandbox = {
  document: {
    querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
    addEventListener: () => {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    body: null, head: null, documentElement: { appendChild() {} }, readyState: 'complete',
  },
  location: { href: 'https://detail.1688.com/offer/1078546345348.html' },
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ ok: false, status: 404, text: async () => '', json: async () => ({}) }),
  performance: { getEntriesByType: () => [] },
  XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setHeader = () => {}; this.addEventListener = () => {} },
  MutationObserver: function () { this.observe = () => {} },
  navigator: { userAgent: 'test' }, Image: function () {},
}
sandbox.window = sandbox; sandbox.self = sandbox
vm.createContext(sandbox)
vm.runInContext(code, sandbox)

console.log('\n[① 采集器自己的 UI 点击要能被识别]')
{
  const isUI = sandbox.FF1688.__test_isCollectorUI
  t('测试钩子存在', typeof isUI === 'function')
  if (typeof isUI === 'function') {
    // 构造一个「在 #ff1688-panel 里的元素」
    const panel = { id: 'ff1688-panel' }
    const inner = { closest: (sel) => (sel.includes('ff1688-panel') ? panel : null) }
    t('面板内的元素 → true', isUI(inner) === true, String(isUI(inner)))
    // 普通页面元素
    const normal = { closest: () => null }
    t('普通页面元素 → false', isUI(normal) === false, String(isUI(normal)))
  }
}

console.log('\n[② 明显不是规格的文案要被过滤]')
{
  const ok = sandbox.FF1688.__test_looksLikeSpecValue
  t('测试钩子存在', typeof ok === 'function')
  if (typeof ok === 'function') {
    const bad = ['Fiestaflare 采集器 v2.47.0', '探测变体图', '已售500+对', '－', '-', '…', '¥2.66', '包邮', '2件起批', '库存99', '']
    bad.forEach(v => t(`「${v}」被拒`, ok(v) === false, String(ok(v))))
    const good = ['藏蓝色（2个一包）', '粉色（2个一包）', '8B', '10C（10个一卡套opp袋）', 'Pinktulipbowhairpin', '5B', '红色', 'Black']
    good.forEach(v => t(`「${v}」被接受`, ok(v) === true, String(ok(v))))
  }
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
