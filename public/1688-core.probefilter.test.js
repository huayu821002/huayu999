/* 变体项按「用户点过的探测项」过滤
 *
 * 用户 2026-10-26 18:03 明确要求：
 *   「我点了颜色黄色。红色我没有点，变体里就不要出现红色。
 *     这个颜色变体项。不只是图包括整个红色变体就不要出来。」
 *
 * 核心：没点过的变体**整个消失**（不只是没图）。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

function mkSandbox() {
  const doc = {
    body: { tagName: 'BODY', children: [], querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
    documentElement: { tagName: 'HTML' },
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    addEventListener() {}, removeEventListener() {},
  }
  const win = {
    document: doc,
    location: { href: 'https://detail.1688.com/offer/828424453992.html' },
    navigator: { userAgent: 'test' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, text: async () => '' }),
    console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  }
  win.window = win; win.self = win; win.globalThis = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return sandbox.FF1688
}

const V = (name, value) => ({ skuId: '', specs: [{ name, value }], color: '', size: '', specText: value, price: 10, priceText: '10.00', image: '' })

console.log('\n[① 点了黄色 → 红色/蓝色整个消失]')
{
  const FF = mkSandbox()
  // 模拟用户点了「黄色」色卡
  FF.__setVariantCapture({ '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/yellow.jpg' } })
  const vs = [V('颜色', '黄色'), V('颜色', '红色'), V('颜色', '蓝色')]
  const r = FF.filterVariantsByProbe(vs)
  const vals = r.variants.map(v => v.specs[0].value)
  console.log('  结果 =', JSON.stringify(vals), '过滤掉', r.filtered)
  t('★ 只剩「黄色」', vals.length === 1 && vals[0] === '黄色', JSON.stringify(vals))
  t('过滤数 = 2', r.filtered === 2, String(r.filtered))
}

console.log('\n[② 点了黄色+红色 → 两个都留]')
{
  const FF = mkSandbox()
  FF.__setVariantCapture({
    '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/yellow.jpg' },
    '红色': { dim: '颜色', img: 'https://cbu01.alicdn.com/red.jpg' },
  })
  const vs = [V('颜色', '黄色'), V('颜色', '红色'), V('颜色', '蓝色')]
  const r = FF.filterVariantsByProbe(vs)
  const vals = r.variants.map(v => v.specs[0].value)
  console.log('  结果 =', JSON.stringify(vals))
  t('黄色+红色保留，蓝色消失', vals.length === 2 && vals.includes('黄色') && vals.includes('红色') && !vals.includes('蓝色'), JSON.stringify(vals))
}

console.log('\n[③ 没有探测记录 → 完全不过滤]')
{
  const FF = mkSandbox()
  const vs = [V('颜色', '黄色'), V('颜色', '红色'), V('颜色', '蓝色')]
  const r = FF.filterVariantsByProbe(vs)
  console.log('  结果 =', JSON.stringify(r.variants.map(v => v.specs[0].value)), 'active =', r.active)
  t('★ 三个全留', r.variants.length === 3, JSON.stringify(r.variants.length))
  t('active = false', r.active === false)
}

console.log('\n[④ 颜色×尺码：点了黄色，尺码没点 → 尺码维度不阻塞]')
{
  const FF = mkSandbox()
  FF.__setVariantCapture({ '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/yellow.jpg' } })
  const vs = [
    { skuId: '', specs: [{ name: '颜色', value: '黄色' }, { name: '尺码', value: 'M' }], color: '黄色', size: 'M', specText: '黄色 / M', price: 10, priceText: '10', image: '' },
    { skuId: '', specs: [{ name: '颜色', value: '黄色' }, { name: '尺码', value: 'L' }], color: '黄色', size: 'L', specText: '黄色 / L', price: 10, priceText: '10', image: '' },
    { skuId: '', specs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }], color: '红色', size: 'M', specText: '红色 / M', price: 10, priceText: '10', image: '' },
  ]
  const r = FF.filterVariantsByProbe(vs)
  const txt = r.variants.map(v => v.specText)
  console.log('  结果 =', JSON.stringify(txt))
  t('★ 黄色/M 与 黄色/L 保留，红色/M 消失',
    txt.length === 2 && txt.includes('黄色 / M') && txt.includes('黄色 / L'), JSON.stringify(txt))
}

console.log('\n[⑤ 探测值带前缀（P064深灰）也能对上]')
{
  const FF = mkSandbox()
  FF.__setVariantCapture({ '深灰': { dim: '颜色', img: 'https://cbu01.alicdn.com/dg.jpg' } })
  const vs = [V('颜色', 'P064深灰'), V('颜色', 'P064黑色')]
  const r = FF.filterVariantsByProbe(vs)
  const vals = r.variants.map(v => v.specs[0].value)
  console.log('  结果 =', JSON.stringify(vals))
  t('★ 深灰命中，黑色不命中', vals.length === 1 && vals[0] === 'P064深灰', JSON.stringify(vals))
}

console.log('\n[⑥ 精确优先：探测「深灰」→「深灰」留，「深灰蓝」丢]')
{
  const FF = mkSandbox()
  FF.__setVariantCapture({ '深灰': { dim: '颜色', img: 'https://cbu01.alicdn.com/dg.jpg' } })
  const vs = [V('颜色', '深灰'), V('颜色', '深灰蓝')]
  const r = FF.filterVariantsByProbe(vs)
  const vals = r.variants.map(v => v.specs[0].value)
  console.log('  结果 =', JSON.stringify(vals))
  t('★ 精确命中的「深灰」保留', vals.length === 1 && vals[0] === '深灰', JSON.stringify(vals))
  t('「深灰蓝」没被点过 → 消失', !vals.includes('深灰蓝'), JSON.stringify(vals))
}

console.log('\n[⑦ 弱匹配兜底：色卡文字比规格表短]')
{
  const FF = mkSandbox()
  FF.__setVariantCapture({ '深灰': { dim: '颜色', img: 'https://cbu01.alicdn.com/dg.jpg' } })
  // 规格表里只有「P064深灰」，色卡文字是「深灰」→ 必须靠弱匹配保下来
  const vs = [V('颜色', 'P064深灰'), V('颜色', 'P064黑色')]
  const r = FF.filterVariantsByProbe(vs)
  const vals = r.variants.map(v => v.specs[0].value)
  console.log('  结果 =', JSON.stringify(vals))
  t('★ 弱匹配唯一 → P064深灰保留', vals.length === 1 && vals[0] === 'P064深灰', JSON.stringify(vals))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
