/* 回归：真实调用路径（不注入报文）2026-10-28
 *
 * 为什么必须有这个测试：
 *   之前的测试全部走 parseDetail(payloadsOverride) —— **注入模式**。
 *   注入模式会跳过 capture/replay 一大段，等于没测到真实路径。
 *   于是「VARIARIANT_CAPTURE is not defined」（拼写多了个 RI）这个
 *   ReferenceError 逃过了全部测试，用户那边一采集就报「解析异常」。
 *
 * 这个测试模拟真实环境（无报文、无 DOM）调 parseDetail()，
 * 断言**不抛任何异常**且 raw 的关键诊断字段都在。
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

function makeSandbox() {
  const sandbox = {
    document: {
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {},
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      body: null, head: null, documentElement: { appendChild() {} },
      readyState: 'complete',
    },
    location: { href: 'https://detail.1688.com/offer/123456.html' },
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, status: 404, text: async () => '', json: async () => ({}) }),
    performance: { getEntriesByType: () => [] },
    XMLHttpRequest: function () {
      this.open = () => {}; this.send = () => {}
      this.setHeader = () => {}; this.addEventListener = () => {}
    },
    MutationObserver: function () { this.observe = () => {} },
    navigator: { userAgent: 'test' },
    Image: function () {},
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  vm.createContext(sandbox)
  return sandbox
}

;(async () => {
  console.log('\n[① 加载内核不抛错]')
  const sandbox = makeSandbox()
  try {
    vm.runInContext(code, sandbox)
    t('加载成功', !!sandbox.FF1688, 'no FF1688')
    t('版本号存在', !!sandbox.FF1688.__v, 'no __v')
  } catch (e) {
    t('加载成功', false, e.message)
  }

  console.log('\n[② parseDetail() 真实路径（无注入）不抛 ReferenceError]')
  try {
    const r = await sandbox.FF1688.parseDetail(undefined, { url: 'https://detail.1688.com/offer/123456.html' })
    t('返回 { payload, debug }', !!(r && r.payload), JSON.stringify(Object.keys(r || {})))
    const raw = r.payload.raw || {}
    t('raw 有 probePrices 字段', 'probePrices' in raw)
    t('raw 有 probePriceStat 字段', 'probePriceStat' in raw)
    t('raw 有 priceProbeDiag 字段', 'priceProbeDiag' in raw)
    t('raw 有 variantFilterStat 字段', 'variantFilterStat' in raw)
    t('raw 有 skuPrices 字段', 'skuPrices' in raw)
  } catch (e) {
    t('parseDetail 不抛错', false, e.message)
  }

  console.log('\n[③ 全文扫一遍常见拼写错（VARIANT_CAPTURE 之类）]')
  // 把内核里所有 VARI*CAPTURE 标识符列出来，必须只有 VARIANT_CAPTURE 一个
  const found = [...code.matchAll(/\bVARI[A-Z_]*CAPTURE\b/g)].map(m => m[0])
  const uniq = [...new Set(found)]
  t('只有 VARIANT_CAPTURE 一个标识符', uniq.length === 1 && uniq[0] === 'VARIANT_CAPTURE',
    JSON.stringify(uniq))

  console.log(`\n通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
