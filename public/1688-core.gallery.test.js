/* 回归：图集 5 张上限 + 变体配图（A 序号对齐 + B 点击探测）
 *
 * 需求（2026-10-26）：
 *   ① 主图 1 张 + 图集共 5 张 → images 数组上限 5，且 images[0] === mainImage
 *   ② 变体图：A（序号对齐）+ B（用户点颜色探测）组合
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

const PICS = Array.from({ length: 12 }, (_, i) => `https://cbu01.alicdn.com/img/ibank/O1CN01PIC${i}!!123.jpg`)

function makeSandbox(capturePayloads = []) {
  const doc = {
    getElementById: id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(capturePayloads) } : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { appendChild() {} },
    body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    addEventListener() {},
  }
  const win = {
    addEventListener() {}, document: doc,
    location: { href: 'https://detail.1688.com/offer/1059632648130.html' },
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }),
    console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  }
  win.window = win; win.self = win; win.globalThis = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return sandbox
}

;(async () => {
  console.log('\n[1] 图集上限 5 张 + 主图在首位')
  const capture = [{
    url: 'https://h5api.m.1688.com/h5/mtop.alibaba.cbu.offerdetail/1.0/?api=offerdetail',
    data: { data: { offerImgList: PICS.map(u => ({ url: u })) } },
    from: 'hook',
  }]
  const sandbox = makeSandbox(capture)
  const FF = sandbox.FF1688
  const { payload } = await FF.parseDetail()
  console.log('  images.length =', payload.images.length)
  console.log('  mainImage     =', payload.mainImage)
  t('图集不超过 5 张', payload.images.length <= 5, payload.images.length)
  t('至少 1 张', payload.images.length >= 1, payload.images.length)
  t('主图在 images[0]', payload.images[0] === payload.mainImage, payload.images[0] + ' vs ' + payload.mainImage)
  t('图片不重复', new Set(payload.images).size === payload.images.length)

  console.log('\n[2] 变体配图 A：序号对齐')
  const sb2 = makeSandbox(capture)
  const FF2 = sb2.FF1688
  const gallery = PICS.slice(0, 6) // 未截断的图集
  const variants = [
    { color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' },
    { color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: '' },
    { color: '古巴砂', specs: [{ name: '颜色', value: '古巴砂' }], image: '' },
  ]
  const st1 = FF2.assignVariantImages(variants, gallery)
  console.log('  stat =', JSON.stringify(st1))
  t('对齐 3 个', st1.aligned === 3, JSON.stringify(st1))
  t('变体0 → 图集第1张', variants[0].image === gallery[0], variants[0].image)
  t('变体1 → 图集第2张', variants[1].image === gallery[1], variants[1].image)
  t('变体2 → 图集第3张', variants[2].image === gallery[2], variants[2].image)
  t('来源标记 align', variants[0].imageSource === 'align', variants[0].imageSource)

  console.log('\n[3] 变体配图 B：点击探测优先于对齐')
  const sb3 = makeSandbox(capture)
  const FF3 = sb3.FF1688
  FF3.setVariantCapture({ '艾青绿': PICS[9] }, { '艾青绿': '颜色' })
  const v3 = [
    { color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' },
    { color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: '' },
  ]
  const st3 = FF3.assignVariantImages(v3, gallery)
  console.log('  stat =', JSON.stringify(st3))
  t('探测命中 1 个', st3.matched === 1, JSON.stringify(st3))
  t('探测到的图生效', v3[1].image === PICS[9], v3[1].image)
  t('来源标记 probe', v3[1].imageSource === 'probe', v3[1].imageSource)
  t('未探测的仍走对齐', v3[0].image === gallery[0], v3[0].image)

  console.log('\n[4] 变体自带图优先，不被覆盖')
  const sb4 = makeSandbox(capture)
  const FF4 = sb4.FF1688
  FF4.setVariantCapture({ '艾青绿': PICS[9] }, { '艾青绿': '颜色' })
  const v4 = [{ color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: PICS[4] }]
  FF4.assignVariantImages(v4, gallery)
  t('自带图保留', v4[0].image === PICS[4], v4[0].image)

  console.log('\n[5] 探测值包含匹配（"BMZ160丁香紫" vs "丁香紫"）')
  const sb5 = makeSandbox(capture)
  const FF5 = sb5.FF1688
  FF5.setVariantCapture({ 'BMZ160丁香紫': PICS[7] }, { 'BMZ160丁香紫': '颜色' })
  const v5 = [{ color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' }]
  const st5 = FF5.assignVariantImages(v5, gallery)
  t('包含关系命中', st5.matched === 1, JSON.stringify(st5))
  t('图正确', v5[0].image === PICS[7], v5[0].image)

  console.log('\n[6] 图集顺序 = 报文原始顺序（不被路径分数打乱）')
  // 故意让「后出现」的图路径分数更高：若按分数排序，顺序会变成 PIC11 开头
  const tricky = [
    { url: 'https://h5api.m.1688.com/x?api=offerdetail', data: { data: { offerImgList: [
      { url: 'https://cbu01.alicdn.com/img/ibank/O1CN01AAA!!1.jpg' },
      { url: 'https://cbu01.alicdn.com/img/ibank/O1CN01BBB!!1.jpg' },
      { url: 'https://cbu01.alicdn.com/img/ibank/O1CN01CCC!!1.jpg' },
    ] } } },
    { url: 'https://h5api.m.1688.com/y?api=other', data: { currentOffer: { image: 'https://cbu01.alicdn.com/img/ibank/O1CN01CURRENT!!1.jpg' } } },
  ]
  const sb6 = makeSandbox(tricky)
  const FF6 = sb6.FF1688
  const p6 = (await FF6.parseDetail()).payload
  console.log('  images =', JSON.stringify(p6.images, null, 0))
  const idxA = p6.images.findIndex(u => u.includes('AAA'))
  const idxB = p6.images.findIndex(u => u.includes('BBB'))
  const idxC = p6.images.findIndex(u => u.includes('CCC'))
  t('AAA 在 BBB 前', idxA >= 0 && idxB >= 0 && idxA < idxB, `${idxA},${idxB}`)
  t('BBB 在 CCC 前', idxB >= 0 && idxC >= 0 && idxB < idxC, `${idxB},${idxC}`)

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
