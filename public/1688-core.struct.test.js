/* 结构导出 + 店铺装修图过滤 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

const win = {
  addEventListener() {},
  document: {
    getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    documentElement: { appendChild() {} }, body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
  },
  location: { href: 'https://detail.1688.com/offer/1063529533354.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ json: async () => ({}), text: async () => '' }),
  console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win; win.self = win; win.globalThis = win
const sandbox = vm.createContext(win)
vm.runInContext(code, sandbox, { filename: '1688-core.js' })
const FF = win.FF1688

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const SHOP_BANNER = 'https://cbu01.alicdn.com/cms/upload/2016/790/696/2696097_1254399316.png'
const SHOP_BANNER2 = 'https://cbu01.alicdn.com/cms/upload/2015/797/334/2433797_1490276829.png'
const REAL_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01jq7Xoa1kCNfQ9A7Sj_!!2219520374647-0-cib.jpg'
const RATE_IMG = 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg'

const captured = [{
  url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
  data: {
    api: 'mtop.1688.mmga.offerdetail.service',
    data: {
      data: {
        priceInfoList: [{ preText: '2件起批', price: '2.5', text: '2.50' }],
        currentOffer: { price: 2.5, priceText: '¥2.5', title: '复古手链' },
        offerImgList: [{ url: REAL_IMG }, { url: SHOP_BANNER }, { url: RATE_IMG }],
        images: [SHOP_BANNER2],
        description: '<p>材质：网纱</p><p>风格：自然风</p>',
        offerDecisionAttrs: [{ property: '材质', value: '网纱' }],
      },
      success: true,
    },
    resultCode: 'ok',
  },
  ret: ['SUCCESS'],
  traceId: 'x',
  v: '1.0',
}]

win.document.getElementById = id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(captured) } : null)
win.document.querySelector = sel => (/title/i.test(sel) ? { textContent: '复古手链' } : null)
win.document.querySelectorAll = () => []

;(async () => {
  console.log('[1] 店铺装修图 / 评价图 过滤')
  const { payload } = await FF.parseDetail()
  console.log('  mainImage =', payload.mainImage)
  console.log('  images    =', JSON.stringify(payload.images))
  t('主图不是店铺装修图', !/\/cms\/upload\//.test(payload.mainImage || ''))
  t('主图不是评价图', !/-rate\./.test(payload.mainImage || ''))
  t('主图是真实商品图', (payload.mainImage || '').includes('cib.jpg'))
  t('图片列表里没有店铺装修图', !(payload.images || []).some(u => /\/cms\/upload\//.test(u)))
  t('图片列表里没有评价图', !(payload.images || []).some(u => /-rate\./.test(u)))

  console.log('\n[2] 结构导出（诊断用）')
  const struct = FF.dumpStructure(captured)
  console.log('  条数 =', struct.length)
  const txt = JSON.stringify(struct)
  console.log('  体积 =', txt.length, '字符')
  t('结构非空', struct.length > 0)
  t('体积可控（<25KB，粘贴不被截断）', txt.length < 25000, txt.length)
  t('含 description 路径', /description/i.test(txt))
  t('含图片路径', /img/i.test(txt))
  t('不含 mtop 签名参数', !/sign=/.test(txt))
  console.log('\n  样例：')
  console.log('  ' + JSON.stringify(struct[0] && struct[0].leaves.slice(0, 4), null, 2).split('\n').join('\n  '))

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
