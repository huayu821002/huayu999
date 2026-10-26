/* 回归：B 方案（逐个点击探测）在**不依赖固定选择器**的前提下也能录到图
 *
 * 背景（2026-10-26）：线上实测 4.2.0 的 B 方案「探不到图」——
 * 因为我猜的 1688 DOM 选择器（[class*="sku-item"] 等）根本不是真实结构。
 * 4.3.0 改成：
 *   ① 优先用「选项块自带的缩略图」→ 不依赖任何容器选择器
 *   ② 找不到就「向上找文字短 + 有同类兄弟 + 带图/类名像选项」的元素
 *   ③ 都没有 → 记点击前后的图片快照差异（新出现的 URL = 刚点出来的图）
 *   ④ 大图不再按容器类名找，取「可见 img 里面积最大的那张」
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

/* ---------- 迷你 DOM：够内核跑就行 ---------- */
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
    // 注意：这里用 el 而不是 this（对象字面量里的箭头函数拿不到 el 的 this）
    querySelector: sel => mkQuery(el, sel)[0] || null,
    querySelectorAll: sel => mkQuery(el, sel),
    closest: sel => mkClosest(el, sel),
    get naturalWidth() { return opts.w == null ? 200 : opts.w },
    get naturalHeight() { return opts.h == null ? 200 : opts.h },
    get width() { return opts.w == null ? 200 : opts.w },
    get height() { return opts.h == null ? 200 : opts.h },
  }
  for (const c of el._children) c._parent = el
  return el
}

function mkQuery(root, sel) {
  // 只支持我们用到的选择器：*通配* class 匹配 / 标签
  const out = []
  const walk = n => {
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

;(async () => {
  console.log('\n[B-1] 选项块自带缩略图 → 直接录到（不依赖类名选择器）')
  {
    // 结构：完全陌生的类名，1688 真实结构我还没拿到
    const thumb = mkEl('img', { attrs: { src: 'https://cbu01.alicdn.com/img/ibank/O1CN01PURPLE!!1.jpg' }, w: 40, h: 40 })
    const label = mkEl('span', { text: '丁香紫' })
    const opt = mkEl('div', { className: 'x-offer-color-item-xyz', text: '丁香紫', children: [thumb, label] })
    const wrap = mkEl('div', { className: 'x-sku-wrap', children: [opt] })
    const body = mkEl('body', { children: [wrap] })
    const { sandbox, doc } = makeSandbox({ body })
    const FF = sandbox.FF1688
    FF.startVariantCapture()
    // 模拟点击（capture 阶段监听）
    for (const fn of doc.__listeners.click || []) {
      fn({ target: label })
    }
    const cap = FF.getVariantCapture()
    console.log('  map =', JSON.stringify(cap.map), 'log =', JSON.stringify(cap.log))
    t('录到 1 张', cap.hits === 1, JSON.stringify(cap))
    t('值 = 丁香紫', cap.map['丁香紫'] === 'https://cbu01.alicdn.com/img/ibank/O1CN01PURPLE!!1.jpg', JSON.stringify(cap.map))
  }

  console.log('\n[B-2] 无自带图 → 点选后页面出现新图（快照差异路径）')
  {
    const big1 = mkEl('img', { attrs: { src: 'https://cbu01.alicdn.com/img/ibank/O1CN01MAIN!!1.jpg' }, w: 800, h: 800 })
    const body = mkEl('body', { children: [big1] })
    const { sandbox, doc } = makeSandbox({ body })
    const FF = sandbox.FF1688
    FF.startVariantCapture()
    const opt = mkEl('div', { className: 'x-color', text: '艾青绿' })
    body._children.push(opt)
    for (const fn of doc.__listeners.click || []) fn({ target: opt })
    // 模拟点完颜色后页面换出一张新图
    const big2 = mkEl('img', { attrs: { src: 'https://cbu01.alicdn.com/img/ibank/O1CN01GREEN!!1.jpg' }, w: 800, h: 800 })
    body._children.push(big2)
    await new Promise(r => setTimeout(r, 700))
    const cap = FF.getVariantCapture()
    console.log('  map =', JSON.stringify(cap.map), 'log =', JSON.stringify(cap.log))
    t('值 = 艾青绿', '艾青绿' in cap.map, JSON.stringify(cap.map))
    t('图 = 新出的那张', cap.map['艾青绿'] === 'https://cbu01.alicdn.com/img/ibank/O1CN01GREEN!!1.jpg', JSON.stringify(cap.map))
  }

  console.log('\n[B-3] 大图识别不依赖容器类名 → 取面积最大的可见 img')
  {
    const small = mkEl('img', { attrs: { src: 'https://cbu01.alicdn.com/img/ibank/O1CN01SMALL!!1.jpg' }, w: 60, h: 60 })
    const big = mkEl('img', { attrs: { src: 'https://cbu01.alicdn.com/img/ibank/O1CN01BIG!!1.jpg' }, w: 1200, h: 1200 })
    const body = mkEl('body', { children: [small, big] })
    const { sandbox } = makeSandbox({ body })
    const FF = sandbox.FF1688
    const d = FF.dumpVariantDom()
    console.log('  bigImages[0] =', d.bigImages[0] && d.bigImages[0].url)
    t('最大面积那张排第一', d.bigImages[0] && d.bigImages[0].url.includes('BIG'), JSON.stringify(d.bigImages[0]))
  }

  console.log('\n[B-4] 探测结果仍能匹配到变体（probe 优先于 align）')
  {
    const body = mkEl('body')
    const { sandbox } = makeSandbox({ body })
    const FF = sandbox.FF1688
    FF.setVariantCapture({ '丁香紫': 'https://cbu01.alicdn.com/img/ibank/O1CN01PURPLE!!1.jpg' }, { '丁香紫': '颜色' })
    const variants = [{ color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' }]
    const st = FF.assignVariantImages(variants, ['https://cbu01.alicdn.com/img/ibank/O1CN01A!!1.jpg'])
    t('probe 命中', st.matched === 1, JSON.stringify(st))
    t('图正确', variants[0].image.includes('PURPLE'), variants[0].image)
    t('来源 = probe', variants[0].imageSource === 'probe', variants[0].imageSource)
  }

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
