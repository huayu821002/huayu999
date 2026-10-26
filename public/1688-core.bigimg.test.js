/* 图片 URL 归一化 —— 确保拿到**原图**而不是缩略图
 *
 * 真实实测（2026-10-26，线上商品）：
 *   xxx.jpg_sum.jpg  →  80x80   1896 B   ← _sum 就是缩略图
 *   xxx.jpg          → 800x800 87715 B   ← 去掉 _sum 即原图
 *   xxx.jpg_1200x1200.jpg → 钳回 800x800（源图就 800）
 *   xxx.jpg_1600x1600.jpg → 404
 */
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
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

const N = FF.normImage
t('normImage 已导出', typeof N === 'function')

if (typeof N === 'function') {
  console.log('\n[关键] _sum 缩略图 → 原图')
  const sum = 'https://cbu01.alicdn.com/img/ibank/O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib.jpg_sum.jpg'
  const orig = 'https://cbu01.alicdn.com/img/ibank/O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib.jpg'
  t('_sum.jpg 被剥掉', N(sum) === orig, N(sum))
  t('_sum 单独后缀也被剥掉', N(orig + '_sum') === orig, N(orig + '_sum'))
  t('结果不含 _sum', !/_sum/i.test(N(sum)), N(sum))

  console.log('\n[尺寸后缀] 全部剥掉')
  t('_100x100xz.jpg → .jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_100x100xz.jpg') === 'https://cbu01.alicdn.com/img/ibank/abc.jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_100x100xz.jpg'))
  t('_430x430.jpg → .jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_430x430.jpg') === 'https://cbu01.alicdn.com/img/ibank/abc.jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_430x430.jpg'))
  t('_1200x1200.jpg → .jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_1200x1200.jpg') === 'https://cbu01.alicdn.com/img/ibank/abc.jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_1200x1200.jpg'))
  t('多层后缀：_100x100xz.jpg_sum.jpg → .jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_100x100xz.jpg_sum.jpg') === 'https://cbu01.alicdn.com/img/ibank/abc.jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_100x100xz.jpg_sum.jpg'))

  console.log('\n[webp / 其它]')
  t('.jpg_.webp → .jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_.webp') === 'https://cbu01.alicdn.com/img/ibank/abc.jpg',
    N('https://cbu01.alicdn.com/img/ibank/abc.jpg_.webp'))

  console.log('\n[不能弄坏的]')
  t('原图 URL 不变',
    N(orig) === orig, N(orig))
  t('评价图 -rate 不被误改',
    N('https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg')
      === 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg')
  t('item_pic 保持不变',
    N('https://cbu01.alicdn.com/img/ibank/O1CN011xolav24XiPpmhFV5_!!4611686018427381081-0-item_pic.jpg')
      === 'https://cbu01.alicdn.com/img/ibank/O1CN011xolav24XiPpmhFV5_!!4611686018427381081-0-item_pic.jpg')
  t('非阿里域名被拒', N('https://example.com/a.jpg') === null, N('https://example.com/a.jpg'))
  t('空值返回 null', N('') === null)
  t('http 协议也能处理',
    N('http://cbu01.alicdn.com/img/ibank/abc.jpg_sum.jpg') === 'http://cbu01.alicdn.com/img/ibank/abc.jpg',
    N('http://cbu01.alicdn.com/img/ibank/abc.jpg_sum.jpg'))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
