/* 用 1688 真实报文（2026-10-24 用户提供的结构）验证图片/描述选择 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

// ---------- 真实报文（按用户贴的结构还原） ----------
const CUR_OFFER_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01AUkbyV1mJpKSH6BMN_!!221625003xx.jpg'
const SKU_IMG_1 = 'https://cbu01.alicdn.com/img/ibank/O1CN01KoUl2i1KbrdoFFvtB_!!2218616230xx.jpg'
const SKU_IMG_2 = 'https://cbu01.alicdn.com/img/ibank/O1CN01WhwMJ82JorTrPyj63_!!2207650138xx.jpg'
const OTHER_SHOP_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01gss6Yy2IUsZJFmuUN_!!2213099078xx.jpg'
const RATE_PIC = 'https://cbu01.alicdn.com/i3/O1CN014Xhu9EADLlE2BxV2_!!46116860184273804xx.jpg'
const RATE_IMG2 = 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg'
const BADGE_IMG = 'https://gw.alicdn.com/imgextra/i1/O1CN01VTxqDc1J9AoUBqPOA_!!6000000000xx.jpg'
const SHOP_ICON = 'https://img.alicdn.com/imgextra/i4/6000000000191/O1CN01JK9tipfk7vfGSWnxx.png'
const MEMBER_ICON = 'https://cbu01.alicdn.com/cms/upload/member/club/buy_2_star.gif'
const RESOURCE_IMG = 'https://img.alicdn.com/imgextra/i3/O1CN01AN3p4jDpr9F3DOi0_!!6000000006xx.jpg'

const payloads = [
  {
    // 当前商品：currentOffer + SKU 列表 offerList
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        currentOffer: { offerId: '1050723330804', imageUrl: CUR_OFFER_IMG, title: '合金手链' },
        offerList: [
          { offerId: '1', imageUrl: SKU_IMG_1, priceTypeText: '2件起批', priceText: '2.5' },
          { offerId: '2', imageUrl: SKU_IMG_2, priceTypeText: '10件起批', priceText: '2.2' },
        ],
        result: {
          offerRateInfo: {
            model: {
              ratePics: [{ picUrl: RATE_PIC, source: '1688' }],
              commentList: [{ images: [{ url: RATE_IMG2 }], imgCnt: '3' }],
            },
          },
        },
        downstreamPerformance: { highPerfectLgtRateList: [{ image: BADGE_IMG }] },
        protectionInfoList: [{ description: '通过官方退货仓将全网售后包裹转寄1688商家，提升售后效率，降低快递成本，开通服务即可使用。' }],
        operateButtonList: [{ imgUrl: '' }, { imgUrl: '' }],
        deliveryLimitTimeModel: { limitTimeDesc: '常发圆通快递', expectTimeDesc: '承诺后天送达，晚到必赔' },
        memberIdentityAttrModel: { memberIcon: MEMBER_ICON, buyerLevel: 'L0' },
        tips: { membertip: '在线采购金额等级，展示采购商在线采购实力', commtip: '非认证会员' },
        success: true,
      },
      ret: ['SUCCESS'],
    },
  },
  {
    // 其他店家的货源：itemList（带 shopIconUrl）
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        itemList: [
          { imageUrl: OTHER_SHOP_IMG, shopIconUrl: SHOP_ICON, price: 3.2 },
          { imageUrl: OTHER_SHOP_IMG.replace('gss6Yy', 'gss6Zx'), shopIconUrl: SHOP_ICON, price: 3.3 },
        ],
      },
    },
  },
  {
    // 评价接口：全是买家秀
    url: '//h5api.m.1688.com/h5/mtop.1688.trade.service.mtoprateservice.queryitemratedlistv2/1.0/?api=mtop.1688.trade.service.MtopRateService.queryItemRatedListV2',
    data: {
      api: 'mtop.1688.trade.service.MtopRateService.queryItemRatedListV2',
      model: { images: [{ url: RATE_IMG2, position: 0, status: 1 }] },
    },
  },
  {
    // 页面装修资源
    url: '//h5api.m.1688.com/h5/mtop.alibaba.cbu.cupid.resource.getresourcedata/1.0/?api=mtop.alibaba.cbu.cupid.resource.getResourceData',
    data: { api: 'mtop.alibaba.cbu.cupid.resource.getResourceData', data: { 73877310: { data: { image: RESOURCE_IMG } } } },
  },
]

// ---------- 跑 core ----------
const win = {
  addEventListener() {},
  document: {
    getElementById: id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(payloads) } : null),
    querySelector: () => null, querySelectorAll: () => [],
    documentElement: { appendChild() {} }, body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
  },
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
  console.log('[1] 图片选择（真实报文）')
  const { payload } = await FF.parseDetail()
  console.log('  mainImage =', payload.mainImage)
  console.log('  images    =', JSON.stringify(payload.images, null, 2))

  t('主图 = currentOffer 的图', payload.mainImage === CUR_OFFER_IMG, payload.mainImage)
  t('图片列表不含其他店家的货源图', !payload.images.includes(OTHER_SHOP_IMG))
  t('图片列表不含评价图 ratePics', !payload.images.includes(RATE_PIC))
  t('图片列表不含评价图 -rate', !payload.images.includes(RATE_IMG2))
  t('图片列表不含完好率徽章', !payload.images.includes(BADGE_IMG))
  t('图片列表不含店铺图标', !payload.images.includes(SHOP_ICON))
  t('图片列表不含会员图标', !payload.images.includes(MEMBER_ICON))
  t('图片列表不含装修资源图', !payload.images.includes(RESOURCE_IMG))
  t('图片列表含本商品 SKU 图', payload.images.includes(SKU_IMG_1) && payload.images.includes(SKU_IMG_2))

  console.log('\n[2] 描述选择（真实报文）')
  console.log('  description =', JSON.stringify((payload.description || '').slice(0, 200)))
  const d = payload.description || ''
  t('描述不是「退货仓说明」', !d.includes('退货仓'))
  t('描述不是「常发圆通快递」', !d.includes('圆通'))
  t('描述不是「在线采购金额等级」', !d.includes('在线采购金额等级'))
  t('描述不是「非认证会员」', !d.includes('非认证会员'))

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
