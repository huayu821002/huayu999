/* 端到端：真实 DOM（规格表 + 色卡）→ 模拟点击探测 → 配图 → payload
 *
 * 验证用户实际流程：
 *   1. 页面有规格表（颜色/规格/价格）+ 色卡
 *   2. 用户点其中几个色卡
 *   3. 配图结果：
 *      - 点过的变体有图（image + imageSource='probe'）
 *      - 没点过的变体**没有图**（image='' + imageSource='none'）
 *      - 绝不出现「猜的」图
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
    _attrs: opts.attrs || {},
    _children: opts.children || [],
    _parent: null,
    style: {},
    get innerText() { return this._text },
    get textContent() { return this._text },
    get children() { return this._children },
    get parentElement() { return this._parent },
    setAttribute(k, v) { this._attrs[k] = v },
    getAttribute(k) { return this._attrs[k] == null ? null : this._attrs[k] },
    querySelector: sel => mkQuery(el, sel)[0] || null,
    querySelectorAll: sel => mkQuery(el, sel),
    closest: sel => mkClosest(el, sel),
    get naturalWidth() { return opts.w == null ? 200 : opts.w },
    get naturalHeight() { return opts.h == null ? 200 : opts.h },
    get width() { return opts.w == null ? 200 : opts.w },
    get height() { return opts.h == null ? 200 : opts.h },
    get offsetWidth() { return opts.w == null ? 200 : opts.w },
    get offsetHeight() { return opts.h == null ? 200 : opts.h },
    getBoundingClientRect: () => ({ width: opts.w || 200, height: opts.h || 200, top: 0, left: 0 }),
  }
  for (const c of el._children) c._parent = el
  return el
}

function mkQuery(root, sel) {
  const out = []
  const walk = (n) => {
    for (const c of n._children || []) {
      if (matchSel(c, sel)) out.push(c)
      walk(c)
    }
  }
  walk(root)
  return out
}

function matchSel(el, sel) {
  if (!sel) return false
  const parts = sel.split(',').map(s => s.trim()).filter(Boolean)
  return parts.some(p => {
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

function mkClosest(el, sel) {
  let n = el
  while (n) {
    if (matchSel(n, sel)) return n
    n = n._parent
  }
  return null
}

function makeSandbox(docOpts = {}) {
  const body = docOpts.body || mkEl('body')
  const doc = {
    getElementById: () => null,
    querySelector: sel => mkQuery(body, sel)[0] || null,
    querySelectorAll: sel => mkQuery(body, sel),
    documentElement: mkEl('html', { children: [body] }),
    body,
    createElement: () => mkEl('div'),
    addEventListener() {},
  }
  const listeners = {}
  doc.__listeners = listeners
  doc.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn) }
  doc.removeEventListener = (t, fn) => {
    if (!listeners[t]) return
    listeners[t] = listeners[t].filter(f => f !== fn)
  }
  const win = {
    document: doc,
    location: { href: 'https://detail.1688.com/offer/1059632648130.html' },
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }),
    console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
    __listeners: doc.__listeners,
  }
  win.window = win; win.self = win; win.globalThis = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return { sandbox, doc, body, listeners: doc.__listeners }
}

function specTable() {
  const th = (txt) => mkEl('th', { text: txt })
  const td = (txt) => mkEl('td', { text: txt })
  const head = mkEl('tr', { children: [th('颜色'), th('规格'), th('价格')] })
  const rows = [
    ['P064深灰', '均码', '12.50'],
    ['P064浅灰', '均码', '12.50'],
    ['P064粉色', '均码', '13.00'],
    ['P064黑色', '均码', '13.00'],
  ].map(r => mkEl('tr', { children: [td(r[0]), td(r[1]), td(r[2])] }))
  return mkEl('table', { children: [head, ...rows] })
}

function colorSwatches() {
  const mk = (label, img) => {
    const thumb = mkEl('img', { attrs: { src: img }, w: 40, h: 40 })
    const span = mkEl('span', { text: label })
    return mkEl('div', { className: 'x-offer-color-item', text: label, children: [thumb, span] })
  }
  return [
    mk('P064深灰', 'https://cbu01.alicdn.com/img/ibank/O1CN01DG!!1.jpg'),
    mk('P064浅灰', 'https://cbu01.alicdn.com/img/ibank/O1CN01LG!!1.jpg'),
    mk('P064粉色', 'https://cbu01.alicdn.com/img/ibank/O1CN01PK!!1.jpg'),
  ]
}

;(async () => {
  console.log('\n[E2E-1] 模拟用户点色卡 → 探测到图')
  const swatches = colorSwatches()
  const body = mkEl('body', { children: [specTable(), ...swatches] })
  const { sandbox, doc, listeners } = makeSandbox({ body })
  const FF = sandbox.FF1688
  t('内核加载成功', !!FF, 'FF1688 undefined')

  FF.startVariantCapture()
  for (const i of [0, 1]) {
    const opt = body._children[1 + i]
    const span = opt._children[1]
    for (const fn of (listeners.click || [])) fn({ target: span })
  }
  const cap = FF.getVariantCapture()
  console.log('  探测到:', JSON.stringify(cap.map))
  t('探测到 2 张', cap.hits === 2, JSON.stringify(cap.map))
  t('值是 P064深灰', 'P064深灰' in cap.map, JSON.stringify(Object.keys(cap.map)))
  t('值是 P064浅灰', 'P064浅灰' in cap.map, JSON.stringify(Object.keys(cap.map)))
  t('图是色卡自己的缩略图',
    cap.map['P064深灰'] === 'https://cbu01.alicdn.com/img/ibank/O1CN01DG!!1.jpg',
    String(cap.map['P064深灰']))

  console.log('\n[E2E-2] 规格表变体 + 探测图 → 配图结果')
  FF.setVariantCapture(cap.map, cap.dim || {})
  const vs = [
    { color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }, { name: '规格', value: '均码' }], image: '' },
    { color: 'P064浅灰', specs: [{ name: '颜色', value: 'P064浅灰' }, { name: '规格', value: '均码' }], image: '' },
    { color: 'P064粉色', specs: [{ name: '颜色', value: 'P064粉色' }, { name: '规格', value: '均码' }], image: '' },
    { color: 'P064黑色', specs: [{ name: '颜色', value: 'P064黑色' }, { name: '规格', value: '均码' }], image: '' },
  ]
  const st = FF.assignVariantImages(vs, ['https://cbu01.alicdn.com/img/ibank/O1CN01GALLERY!!1.jpg'])
  console.log('  stat =', JSON.stringify(st))
  t('配了 2 个', st.matched === 2, JSON.stringify(st))
  t('深灰配到自己的图', vs[0].image === 'https://cbu01.alicdn.com/img/ibank/O1CN01DG!!1.jpg', vs[0].image)
  t('浅灰配到自己的图', vs[1].image === 'https://cbu01.alicdn.com/img/ibank/O1CN01LG!!1.jpg', vs[1].image)
  t('★ 粉（没点）无图', vs[2].image === '', vs[2].image)
  t('★ 黑（没点）无图', vs[3].image === '', vs[3].image)
  t('来源 = probe,probe,none,none', vs.map(v => v.imageSource).join(',') === 'probe,probe,none,none', vs.map(v => v.imageSource).join(','))
  t('没有任何变体拿到图集里的图', !vs.some(v => v.image && v.image.includes('GALLERY')), JSON.stringify(vs.map(v => v.image)))

  console.log('\n[E2E-3] 色卡文字比规格表短时也能配上')
  {
    const body3 = mkEl('body', { children: [specTable(), ...colorSwatches()] })
    const sb3 = makeSandbox({ body: body3 })
    const FF3 = sb3.sandbox.FF1688
    FF3.startVariantCapture()
    for (const i of [0, 1, 2]) {
      const opt = body3._children[1 + i]
      const span = opt._children[1]
      for (const fn of (sb3.listeners.click || [])) fn({ target: span })
    }
    const cap3 = FF3.getVariantCapture()
    // 模拟：色卡上写的是短名「深灰」，规格表里是「P064深灰」
    FF3.setVariantCapture(
      { '深灰': cap3.map['P064深灰'], '浅灰': cap3.map['P064浅灰'] },
      { '深灰': '颜色', '浅灰': '颜色' },
    )
    const vs3 = [
      { color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }], image: '' },
      { color: 'P064浅灰', specs: [{ name: '颜色', value: 'P064浅灰' }], image: '' },
      { color: 'P064粉色', specs: [{ name: '颜色', value: 'P064粉色' }], image: '' },
    ]
    const st3 = FF3.assignVariantImages(vs3, [])
    console.log('  stat =', JSON.stringify(st3))
    t('短名也能配到 2 个', st3.matched === 2, JSON.stringify(st3))
    t('深灰图正确', vs3[0].image === cap3.map['P064深灰'], vs3[0].image)
    t('没点过的粉色无图', vs3[2].image === '', vs3[2].image)
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  process.exit(fail === 0 ? 0 : 1)
})()
