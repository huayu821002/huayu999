/* 评价图（-rate）不应被当商品主图 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

const win = {
  addEventListener() {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: { appendChild() {} },
    body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    addEventListener() {},
  },
  location: { href: 'https://detail.1688.com/offer/1050723330804.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ json: async () => ({}), text: async () => '' }),
  console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win
win.self = win
win.globalThis = win
const sandbox = vm.createContext(win)
vm.runInContext(code, sandbox, { filename: '1688-core.js' })
const FF = win.FF1688

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const RATE_IMG = 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg'
const RATE_IMG2 = 'https://img.alicdn.com/imgextra/i3/O1CN01ZiBZDvvvQJD37MRc_!!4611686018427386256-0-rate.jpg'
const REAL_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01jq7Xoa1kCNfQ9A7Sj_!!2219520374647-0-cib.jpg'

function run(images, label, expectMain) {
  const captured = [{
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        data: {
          offerImgList: images.map(u => ({ url: u })),
          priceInfoList: [{ preText: '2件起批', price: '2.5', text: '2.50' }],
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
  return FF.parseDetail().then(r => {
    const p = r.payload
    console.log('\n' + label)
    console.log('  mainImage =', p.mainImage)
    console.log('  images    =', JSON.stringify(p.images))
    t('主图不是评价图', !/-rate\./i.test(p.mainImage || ''))
    t('图片列表里没有评价图', !(p.images || []).some(u => /-rate\./i.test(u)))
    if (expectMain) t('主图取到真实商品图', (p.mainImage || '').includes(expectMain))
    return p
  })
}

;(async () => {
  console.log('图片选择测试（评价图 vs 商品图）')

  await run([RATE_IMG, RATE_IMG2], '场景1：接口只返回评价图', null)
  await run([RATE_IMG, REAL_IMG], '场景2：评价图 + 真实商品图', 'cib.jpg')
  await run([REAL_IMG, RATE_IMG], '场景3：商品图在前', 'cib.jpg')

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
