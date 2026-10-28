/* 回归：SKU 生成规则（2026-10-28）
 *
 * 用户需求：「产品SKU 生成规则：FCY + 日期（如 9月10号，就写 0910）+ 1688的原货号，
 *            如果没有原货号可以生成随机5位数」
 *
 * 例：
 *   原货号 ABC-123，9月10号 → FCY0910ABC-123
 *   无原货号，          9月10号 → FCY0910XXXXX（5 位随机数字）
 *
 * 服务端在 lib/sku.ts（scripts/test-sku.js 覆盖），
 * 这里覆盖**采集端**的同一套逻辑（scripts/1688-core.src.js 里的 buildSkuJs）。
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
    addEventListener: () => {}, removeEventListener: () => {}, body: { appendChild: () => {}, contains: () => false },
    createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } }),
    head: { appendChild: () => {} },
  },
  window: { location: { href: 'https://detail.1688.com/offer/123.html' } },
  location: { href: 'https://detail.1688.com/offer/123.html' },
  navigator: { userAgent: 'node', language: 'zh-CN' },
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  console, fetch: () => Promise.reject(new Error('no net')), XMLHttpRequest: function () {},
  Intl, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Set, Map,
}
sandbox.self = sandbox
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(code, sandbox)

const api = sandbox.__ff1688 || sandbox.FF1688 || sandbox.window.FF1688

console.log('\n[① 采集端 SKU 生成器存在]')
t('__test_buildSkuJs 钩子存在', !!(api && api.__test_buildSkuJs))
t('__test_assignVariantSkus 钩子存在', !!(api && api.__test_assignVariantSkus))
if (!api || !api.__test_buildSkuJs) { console.log('\n无法继续'); process.exit(1) }

const build = api.__test_buildSkuJs
const assign = api.__test_assignVariantSkus
const datePart = api.__test_skuDatePart ? api.__test_skuDatePart() : ''

console.log('\n[② 日期部分]')
t('MMDD 格式（4 位）', /^\d{4}$/.test(datePart), datePart)
t('月 01-12', Number(datePart.slice(0, 2)) >= 1 && Number(datePart.slice(0, 2)) <= 12, datePart)
t('日 01-31', Number(datePart.slice(2)) >= 1 && Number(datePart.slice(2)) <= 31, datePart)

console.log('\n[③ 有原货号 → FCY+日期+原货号]')
{
  const s = build('ABC123')
  t('格式 FCY{MMDD}ABC123', s === `FCY${datePart}ABC123`, s)
  t('带横杠保留', build('AB-12') === `FCY${datePart}AB-12`, build('AB-12'))
  t('空格被去掉', build('AB 12') === `FCY${datePart}AB12`, build('AB 12'))
  t('中文被去掉', build('原货号ABC') === `FCY${datePart}ABC`, build('原货号ABC'))
}

console.log('\n[④ 无原货号 → 随机 5 位数]')
{
  const s = build(null)
  t('格式 FCY{MMDD}+5位', new RegExp(`^FCY${datePart}\\d{5}$`).test(s), s)
  t('长度 12', s.length === 12, String(s.length))
  const s2 = build('')
  t('空字符串同样处理', new RegExp(`^FCY${datePart}\\d{5}$`).test(s2), s2)
}

console.log('\n[⑤ 变体批量：互不重复 + 保留已有]')
{
  const list = assign([
    { skuId: 'A1', color: '红色' },
    { skuId: 'A1', color: '蓝色' },
    { sku: 'KEEP-ME', color: '绿色' },
    { color: '黄色' },
  ])
  console.log('  ', list.map(v => v.sku).join(' | '))
  t('全部互不重复', new Set(list.map(v => v.sku)).size === list.length, JSON.stringify(list.map(v => v.sku)))
  t('已有 sku 原样保留', list[2].sku === 'KEEP-ME', list[2].sku)
  t('重复货号加后缀', /^FCY\d{4}A1-2$/.test(list[1].sku), list[1].sku)
  t('无货号的是随机 5 位', new RegExp(`^FCY${datePart}\\d{5}$`).test(list[3].sku), list[3].sku)
  t('原有字段没丢', list[0].color === '红色', JSON.stringify(list[0]))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
