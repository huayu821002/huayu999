/* 商品属性表不能再冒充成变体
 *
 * 用户 2026-10-26 18:00 真实面板输出（offer 828424453992 发夹）：
 *   材质:风格 / 材质:发夹分类 / 材质:镶嵌材质 / 材质:样式 / 材质:主要下游平台 …
 *   → 这些「值」根本不是规格值，是**商品属性名**
 *     （材质、流行元素、风格、发夹分类、处理工艺、镶嵌材质…）
 *
 * 两层防御：
 *   ① DOM 层（domVariants）：值出现在表头里 → 那是「属性名」不是「属性值」→ 排除
 *   ② 通用层（dropAttributeNamedVariants）：规格值全部是属性表里的名字 → 丢弃
 *      这一层与变体来源无关（DOM / 接口都管得住）
 *
 * 注意：❌ 不能因为「一个维度只有一个取值」就排除 ——
 *   「尺码=均码」是合法规格（见 public/1688-core.domprice.test.js）
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

function mkEl(tag, opts = {}) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    className: opts.className || '',
    _text: opts.text || '',
    _children: opts.children || [],
    _parent: null,
    style: {},
    get innerText() { return this._text },
    get textContent() { return this._text },
    get children() { return this._children },
    get parentElement() { return this._parent },
    querySelector: sel => mkQuery(el, sel)[0] || null,
    querySelectorAll: sel => mkQuery(el, sel),
    closest: () => null,
    getAttribute: () => null,
    getBoundingClientRect: () => ({ width: 10, height: 10 }),
  }
  for (const c of el._children) c._parent = el
  return el
}

function matchSel(el, sel) {
  if (!sel) return false
  return sel.split(',').map(s => s.trim()).filter(Boolean).some(p => {
    if (p.includes('*=')) {
      const m = /\[class\*="([^"]+)"\]/.exec(p)
      if (!m) return false
      return String(el.className || '').includes(m[1])
    }
    if (p.startsWith('.')) return String(el.className || '').includes(p.slice(1))
    if (p === '*') return true
    return el.tagName === p.toUpperCase()
  })
}

function mkQuery(root, sel) {
  const out = []
  const walk = n => { for (const c of n._children || []) { if (matchSel(c, sel)) out.push(c); walk(c) } }
  walk(root)
  return out
}

function makeSandbox(body) {
  const doc = {
    body,
    documentElement: mkEl('html', { children: [body] }),
    querySelector: sel => mkQuery(body, sel)[0] || null,
    querySelectorAll: sel => mkQuery(body, sel),
    createElement: () => mkEl('div'),
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

function table(head, rows) {
  const trs = [mkEl('tr', { children: head.map(h => mkEl('th', { text: h })) })]
  for (const r of rows) trs.push(mkEl('tr', { children: r.map(c => mkEl('td', { text: c })) }))
  return mkEl('table', { children: trs })
}

/* 用户 dump 里的真实属性表 */
const ATTRS = {
  '材质': '仿金属',
  '流行元素': '蝴蝶结',
  '风格': '百搭风',
  '发夹分类': '抓夹',
  '处理工艺': '手工',
  '镶嵌材质': '非镶嵌',
  '上市年份/季节': '2026春季',
  '适用发型': '日常通勤',
  '功能效果': '装饰',
  '主要销售地区': '全球',
  '是否IP授权': '否',
  '主要下游平台': '电商',
  '有可授权的自有品牌': '否',
}

console.log('\n[① 属性名伪装成规格值 → 全部丢弃]')
{
  const FF = makeSandbox(mkEl('body', { children: [] }))
  const fake = [
    { skuId: '', specs: [{ name: '材质', value: '风格' }], color: '', size: '', specText: '风格', price: 0.9, priceText: '0.9', image: '' },
    { skuId: '', specs: [{ name: '材质', value: '发夹分类' }], color: '', size: '', specText: '发夹分类', price: 0.9, priceText: '0.9', image: '' },
    { skuId: '', specs: [{ name: '材质', value: '上市年份/季节' }], color: '', size: '', specText: '上市年份/季节', price: 4.5, priceText: '4.5', image: '' },
  ]
  const r = FF.dropAttributeNamedVariants(fake, ATTRS)
  console.log('  结果 =', JSON.stringify(r.variants.map(v => v.specs.map(s => s.name + ':' + s.value))))
  t('★ 属性名变体全部丢弃', r.variants.length === 0 && r.dropped === 3, JSON.stringify(r.variants.length))
}

console.log('\n[①b 维度名是属性名 → 也丢弃]')
{
  const FF = makeSandbox(mkEl('body', { children: [] }))
  const fake = [
    // 维度名「材质」是属性名，值「仿金属」也是属性表里的值
    { skuId: '', specs: [{ name: '材质', value: '仿金属' }], color: '', size: '', specText: '仿金属', price: 0.9, priceText: '0.9', image: '' },
  ]
  const r = FF.dropAttributeNamedVariants(fake, ATTRS)
  console.log('  结果 =', JSON.stringify(r.variants.map(v => v.specs.map(s => s.name + ':' + s.value))))
  t('★ 维度名是属性名 → 丢弃', r.variants.length === 0 && r.dropped === 1, JSON.stringify(r.variants.length))
}

console.log('\n[② 真变体不受影响]')
{
  const FF = makeSandbox(mkEl('body', { children: [] }))
  const real = [
    { skuId: '', specs: [{ name: '颜色', value: '黄色' }], color: '黄色', size: '', specText: '黄色', price: 10, priceText: '10', image: '' },
    { skuId: '', specs: [{ name: '颜色', value: '均码' }], color: '均码', size: '', specText: '均码', price: 10, priceText: '10', image: '' },
  ]
  const r = FF.dropAttributeNamedVariants(real, ATTRS)
  console.log('  结果 =', JSON.stringify(r.variants.map(v => v.specs[0].value)))
  t('★ 颜色变体保留', r.variants.length === 2, JSON.stringify(r.variants.length))
}

console.log('\n[③ 没有属性表 → 完全不过滤]')
{
  const FF = makeSandbox(mkEl('body', { children: [] }))
  const vs = [{ skuId: '', specs: [{ name: '材质', value: '风格' }], color: '', size: '', specText: '风格', price: 1, priceText: '1', image: '' }]
  const r = FF.dropAttributeNamedVariants(vs, undefined)
  t('★ 原样保留', r.variants.length === 1, JSON.stringify(r.variants.length))
}

console.log('\n[④ DOM 双层表头 → 0 个变体]')
{
  const body = mkEl('body', {
    children: [table(
      ['材质', '风格', '发夹分类', '价格'],
      [['风格', '发夹分类', '镶嵌材质', '4.5']]
    )]
  })
  const FF = makeSandbox(body)
  const vs = FF.domVariants({ lo: 4.5, hi: 4.5 })
  console.log('  结果 =', JSON.stringify(vs.map(v => v.specs.map(s => s.name + ':' + s.value))))
  t('★ 双层表头 → 0 个变体', vs.length === 0, JSON.stringify(vs.map(v => v.specs)))
}

console.log('\n[⑤ DOM 真规格表 → 保留]')
{
  const body = mkEl('body', {
    children: [table(
      ['颜色', '尺码', '价格'],
      [
        ['黑色', '成人女士均码', '12.50'],
        ['白色', '成人女士均码', '13.00'],
      ]
    )]
  })
  const FF = makeSandbox(body)
  const vs = FF.domVariants({ lo: 12.5, hi: 13 })
  console.log('  结果 =', JSON.stringify(vs.map(v => v.specs.map(s => s.name + ':' + s.value))))
  t('★ 颜色×尺码保留（尺码只有 1 个取值也不排除）', vs.length === 2, JSON.stringify(vs.map(v => v.specs)))
  t('每个变体 2 个维度', vs.every(v => v.specs.length === 2), JSON.stringify(vs.map(v => v.specs.length)))
}

console.log('\n[⑥ 单 SKU → 规格保留（不误伤）]')
{
  const body = mkEl('body', {
    children: [table(
      ['颜色', '尺码', '价格'],
      [['黑色', '均码', '12.50']]
    )]
  })
  const FF = makeSandbox(body)
  const vs = FF.domVariants({ lo: 12.5, hi: 12.5 })
  console.log('  结果 =', JSON.stringify(vs.map(v => v.specs.map(s => s.name + ':' + s.value))))
  t('★ 单 SKU 规格保留', vs.length === 1, JSON.stringify(vs.map(v => v.specs)))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
