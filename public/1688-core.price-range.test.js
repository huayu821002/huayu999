/* 回归：阶梯价（区间价）解析（2026-10-28）
 *
 * 用户报：「这下采集价格都乱了」
 * 真实数据（offer 980211315599）：
 *   6 个变体价格 = 2.5 / 7.31 / 7.31 / 3.66 / 3.66 / 7.31
 *   规格：10C（10个一卡套opp袋）→ 2.5   ← 第一个，明显偏低
 *         10D（10个一卡套opp袋）→ 7.31  ← 同包装应该是同一个价
 *         8B（8个一包）→ 3.66   ← 8 个比 10 个贵？不可能
 *
 * 根因：1688 阶梯价显示成 "¥2.50-7.31"（左=大数量档便宜价，右=1 件价）。
 * 旧 parsePriceText 用 /[¥￥]\s*(\d+...)/ 取**第一个**数字 → 拿到 2.50。
 * 只有第一次点击时价格区还是区间态 → 只有**第一个**变体价格错。
 *
 * 修法：识别区间 → 取**上限**（1 件实付价）。
 * 修正后期望：8B/8C=3.66，10C/10D/10E=7.31，16B=7.31 —— 数量越多越便宜，成立。
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

const sandbox = {
  document: {
    querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
    addEventListener: () => {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    body: null, head: null, documentElement: { appendChild() {} }, readyState: 'complete',
  },
  location: { href: 'https://detail.1688.com/offer/980211315599.html' },
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

const P = sandbox.FF1688.__test_parsePriceText

console.log('\n[① 区间价取上限（核心修复）]')
t('¥2.50-7.31 → 7.31', (P('¥2.50-7.31') || {}).v === 7.31, JSON.stringify(P('¥2.50-7.31')))
t('￥2.50-7.31 → 7.31', (P('￥2.50-7.31') || {}).v === 7.31, JSON.stringify(P('￥2.50-7.31')))
t('¥2.50~7.31 → 7.31', (P('¥2.50~7.31') || {}).v === 7.31, JSON.stringify(P('¥2.50~7.31')))
t('¥2.50～7.31 → 7.31', (P('¥2.50～7.31') || {}).v === 7.31, JSON.stringify(P('¥2.50～7.31')))
t('¥ 2.50 - 7.31 → 7.31', (P('¥ 2.50 - 7.31') || {}).v === 7.31, JSON.stringify(P('¥ 2.50 - 7.31')))
t('无符号 2.50-7.31 → 7.31', (P('2.50-7.31') || {}).v === 7.31, JSON.stringify(P('2.50-7.31')))
t('标记了 range', (P('¥2.50-7.31') || {}).range === true, JSON.stringify(P('¥2.50-7.31')))
t('记录了区间上下限', (P('¥2.50-7.31') || {}).rangeLo === 2.5 && (P('¥2.50-7.31') || {}).rangeHi === 7.31)

console.log('\n[② 单一价格不受影响]')
t('¥3.25 → 3.25', (P('¥3.25') || {}).v === 3.25, JSON.stringify(P('¥3.25')))
t('¥ 7.31 → 7.31', (P('¥ 7.31') || {}).v === 7.31, JSON.stringify(P('¥ 7.31')))
t('3.25 → 3.25', (P('3.25') || {}).v === 3.25, JSON.stringify(P('3.25')))
t('3.25元 → 3.25', (P('3.25元') || {}).v === 3.25, JSON.stringify(P('3.25元')))

console.log('\n[③ 不能把数量/文案误当价格]')
t('10-20 → null（无符号整数区间不算价）', P('10-20') === null, JSON.stringify(P('10-20')))
t('10-20个 → null', P('10-20个') === null, JSON.stringify(P('10-20个')))
t('132 → null（无符号整数不采）', P('132') === null, JSON.stringify(P('132')))
t('¥132 → 132（有符号整数可采）', (P('¥132') || {}).v === 132, JSON.stringify(P('¥132')))
t('2件起批 → null', P('2件起批') === null, JSON.stringify(P('2件起批')))
t('已售400+件 → null', P('已售400+件') === null, JSON.stringify(P('已售400+件')))
t('库存 199 → null', P('库存199') === null, JSON.stringify(P('库存199')))

console.log('\n[④ 端到端：修正后 6 个变体的价格应该自洽]')
{
  // 模拟：只有第一个色卡点的时候页面显示区间，其余显示单值
  const sim = [
    { spec: '10C（10个一卡套opp袋）', txt: '¥2.50-7.31' },  // 区间 → 取上限
    { spec: '10D（10个一卡套opp袋）', txt: '¥7.31' },
    { spec: '10E（10个一卡套opp袋）', txt: '¥7.31' },
    { spec: '8B（8个一包）', txt: '¥3.66' },
    { spec: '8C（8个一包）', txt: '¥3.66' },
    { spec: '16B（16个一包）', txt: '¥7.31' },
  ]
  const prices = sim.map(s => (P(s.txt) || {}).v)
  console.log('  修正后:', JSON.stringify(prices))
  t('第一个不再取到 2.5', prices[0] === 7.31, String(prices[0]))
  t('同包装同价（10C=10D=10E）', prices[0] === prices[1] && prices[1] === prices[2], JSON.stringify(prices))
  t('8个一包=3.66 < 10个=7.31（数量越多越便宜，自洽）', prices[3] < prices[1], JSON.stringify(prices))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
