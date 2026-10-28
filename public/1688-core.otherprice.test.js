/* 回归：抓到同店其它商品的价格当变体价（2026-10-28）
 *
 * 用户报障：offer 604497188808 采集的变体价格全是 **1**，
 *   而真实价是 2.65（priceInfoList: [{"price":"2.65","text":"1件价格"}]）。
 *
 * 根因（两处）：
 *   ① 「1件价格」是**价格说明文字**，不是价格。
 *      老代码 priceOfItem() 用 match(/(\d+)/) 直接抠出 1。
 *   ② offerdetail 报文里的 offerList 是**同店其它商品**的推荐位，
 *      每条带自己的 price（1 元的小商品）。
 *      pickVariants 的 A/B/C 三条路径都**没排除**推荐位卡片
 *      （isCardItem 检查 offerId/offerUrl/isCurrentOffer/behaviorTag）。
 *
 * 修复：
 *   - PRICE_TEXT_STRICT_RE：priceText 必须整体就是价格
 *   - pickVariants A/B/C 路径加 isCardItem 排除
 *   - 变体价合理性校验：必须落在商品价 [0.2x, 6x] 区间内
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

function loadKernel() {
  const sandbox = {
    document: { querySelectorAll: () => [], querySelector: () => null },
    location: { href: 'https://detail.1688.com/offer/604497188808.html' },
    console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setHeader = () => {} },
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.FF1688
}
const K = loadKernel()

/** 同店推荐位：每条是别的商品 */
const offerListPayload = {
  api: 'mtop.1688.mmga.offerdetail.service',
  url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
  data: {
    data: {
      data: {
        priceInfoList: [{ price: '2.65', text: '1件价格' }],
        offerList: [
          { offerId: '999000111', offerUrl: '//x.1688.com/offer/999000111.html', price: '1.00', imageUrl: 'https://cbu01.alicdn.com/img/ibank/a.jpg', offerTitle: '别家小商品' },
          { offerId: '999000222', offerUrl: '//x.1688.com/offer/999000222.html', price: '3.00', imageUrl: 'https://cbu01.alicdn.com/img/ibank/b.jpg', offerTitle: '别家商品2' },
        ],
      },
    },
  },
}

console.log('\n[① 推荐位的价格不能被当成变体价]')
{
  const r = K.pickVariants([offerListPayload], { lo: 2.65, hi: 2.65 })
  const list = r.variants || []
  const prices = list.map(v => v.price)
  t('推荐位不产生变体', list.length === 0, JSON.stringify(list))
  t('没有出现 1 这个价', !prices.includes(1), JSON.stringify(prices))
}

console.log('\n[② 变体价合理性校验]')
{
  // 本商品的 SKU 行，但价格离谱（1 元，商品价 2.65 → 低于 0.2x 下限）
  const p2 = {
    api: 'mtop.1688.mmga.offerdetail.service',
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: { data: { skuList: [
      { skuId: '111', specAttrs: [{ name: '颜色', value: '粉色' }], price: '1.00', imageUrl: 'https://cbu01.alicdn.com/img/ibank/c.jpg' },
      { skuId: '222', specAttrs: [{ name: '颜色', value: '玫红' }], price: '2.80', imageUrl: 'https://cbu01.alicdn.com/img/ibank/d.jpg' },
    ] } },
  }
  const r = K.pickVariants([p2], { lo: 2.65, hi: 2.65 })
  const list = r.variants || []
  t('离谱价 1 被拒', !list.some(v => v.price === 1), JSON.stringify(list.map(v => v.price)))
  t('合理价 2.8 被采信', list.some(v => v.price === 2.8), JSON.stringify(list.map(v => v.price)))
}

console.log('\n[③ 无商品价参照时不做校验]')
{
  const p2 = {
    api: 'mtop.1688.mmga.offerdetail.service',
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: { data: { skuList: [
      { skuId: '111', specAttrs: [{ name: '颜色', value: '粉色' }], price: '1.00' },
    ] } },
  }
  const r = K.pickVariants([p2], { lo: null, hi: null })
  t('没有商品价 → 不拦', (r.variants || []).length === 1, JSON.stringify(r.variants))
}

console.log('\n[④ 本商品的 SKU 行在 offerList 里 → 仍能采到]')
{
  // offerList 里放**本商品**的 SKU 行（没有 offerId/offerUrl）
  const p2 = {
    api: 'mtop.1688.mmga.offerdetail.service',
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: { data: { offerList: [
      { skuId: '4409028943968', specAttrs: [{ name: '颜色', value: '1 粉色' }], price: '2.65', imageUrl: 'https://cbu01.alicdn.com/img/ibank/e.jpg' },
    ] } },
  }
  const r = K.pickVariants([p2], { lo: 2.65, hi: 2.65 })
  const list = r.variants || []
  t('本商品的 offerList SKU 行仍被采到', list.length === 1, JSON.stringify(list))
  t('价格正确 2.65', list[0] && list[0].price === 2.65, JSON.stringify(list))
}

console.log('\n[⑤ 「1件价格」不被当成价格]')
{
  const p2 = {
    api: 'mtop.1688.mmga.offerdetail.service',
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: { data: { priceInfoList: [{ priceText: '1件价格' }] } },
  }
  const r = K.pickVariants([p2], { lo: 2.65, hi: 2.65 })
  const list = r.variants || []
  t('没有变体产生（说明文字不是价格）', list.length === 0, JSON.stringify(list))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
