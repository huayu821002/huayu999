/* DOM 兜底：商品描述 + 商品图集（1688 真实页面结构） */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const CUR_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01AUkbyV1mJpKSH6BMN_!!221625003xx.jpg'
const GAL_IMG2 = 'https://cbu01.alicdn.com/img/ibank/O1CN01KoUl2i1KbrdoFFvtB_!!2218616230xx.jpg'
const RECO_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01RECOMMENDEDxxx.jpg'
const RATE_IMG = 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg'
const SHOP_ICON = 'https://img.alicdn.com/imgextra/i4/6000000000191/O1CN01JK9tipfk7vfGSWnxx.png'

// 造一个接近 1688 详情页的 DOM
function makeEl(tag, attrs = {}, children = []) {
  return {
    tagName: tag, className: attrs.className || '', id: attrs.id || '',
    innerHTML: attrs.innerHTML || '', innerText: attrs.innerText || '', textContent: attrs.textContent || '',
    attrs,
    getAttribute: k => (attrs[k] !== undefined ? attrs[k] : null),
    querySelectorAll: sel => (attrs._qsa && attrs._qsa[sel]) || [],
    querySelector: sel => (attrs._qs && attrs._qs[sel]) || null,
    closest: sel => (attrs._closest && attrs._closest[sel]) || null,
    parentElement: attrs.parentElement || null,
    children,
  }
}

// 商品图集区
const galImg1 = makeEl('img', { src: CUR_IMG })
const galImg2 = makeEl('img', { src: GAL_IMG2 })
const galRoot = makeEl('div', { className: 'detail-gallery' })
galRoot.querySelectorAll = sel => (sel === 'img' ? [galImg1, galImg2] : [])
galImg1.closest = sel => (sel.includes('gallery') ? galRoot : null)

// 描述区（1688 的 .desc-lazyload-container）
const descRoot = makeEl('div', {
  className: 'desc-lazyload-container',
  innerHTML: '<script>alert(1)</script><p>复古风格 合金手链</p><img data-lazyload="https://cbu01.alicdn.com/img/ibank/DESC_IMG1.jpg" onclick="x()">',
})

const doc = {
  getElementById: id => (id === 'ff1688-capture' ? { textContent: '[]' } : null),
  querySelector: sel => {
    if (sel.includes('desc-lazyload-container')) return descRoot
    if (sel.includes('gallery')) return galImg1
    if (sel === 'h1.d-title, .title-text, .offer-title, h1') return null
    return null
  },
  querySelectorAll: sel => {
    if (sel === 'img') return [galImg1, galImg2] // 全页 img —— 应该只被图集区用到
    return []
  },
  documentElement: { appendChild() {} }, body: { appendChild() {} },
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
}

const win = {
  addEventListener() {}, document: doc,
  location: { href: 'https://detail.1688.com/offer/1050723330804.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ json: async () => ({}), text: async () => '' }),
  console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win; win.self = win; win.globalThis = win
const sandbox = vm.createContext(win)
vm.runInContext(code, sandbox, { filename: '1688-core.js' })
const FF = win.FF1688

;(async () => {
  console.log('[1] DOM 商品描述')
  const { payload } = await FF.parseDetail()
  const d = payload.description || ''
  console.log('  description =', JSON.stringify(d))
  t('描述非空', d.length > 20, d.length)
  t('描述含正文文字', d.includes('复古风格'))
  t('描述不含 <script>', !/<script/i.test(d))
  t('描述不含 on* 事件属性', !/\son\w+=/i.test(d))
  t('懒加载图已转成 src', d.includes('src="https://cbu01.alicdn.com/img/ibank/DESC_IMG1.jpg"'))

  console.log('\n[2] DOM 商品图集')
  console.log('  mainImage =', payload.mainImage)
  console.log('  images    =', JSON.stringify(payload.images))
  t('主图 = 图集区第一张', payload.mainImage === CUR_IMG, payload.mainImage)
  t('图片含图集第二张', payload.images.includes(GAL_IMG2))
  t('图片不含评价图', !payload.images.includes(RATE_IMG))
  t('图片不含店铺图标', !payload.images.includes(SHOP_ICON))

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
