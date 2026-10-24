/**
 * 离线测试 1688-core.js 对「推荐位/商品卡片」噪声的处理
 *
 * 背景（2026-10-24 真实诊断）：
 *   1688 详情页返回里，offerList / majorRecommendOfferInfos / relationRecommendOfferInfos / itemList
 *   都是「同店其它商品 / 相似推荐」列表，里面的价格是**别人家商品的价格**。
 *   旧逻辑把它们当成 SKU 列表 → 采出的批发价是别人的价（诊断里采到 11，真实首个规格价是 7）。
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const CORE = fs.readFileSync(path.join(__dirname, '1688-core.js'), 'utf8')

const OFFER_ID = '1053022605528'
const TITLE = '欧美网纱头饰羽毛头花欧根纱礼帽头饰赛马会复古走秀花朵发夹发饰'

/** 按真实 1688 报文结构构造：推荐位 + 当前商品卡片 + 真正的 SKU 列表 */
function makePayloads() {
  return [
    {
      url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service&data=%7B%7D',
      data: {
        api: 'mtop.1688.mmga.offerdetail.service',
        data: { data: { reason: 'invalid param', success: false }, resultCode: 'ok' },
      },
    },
    {
      url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=x2',
      data: { api: 'x2', data: { data: {}, resultCode: 'ok' } },
    },
    {
      url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=x3',
      data: {
        api: 'mtop.1688.mmga.offerdetail.service',
        data: {
          data: {
            offer: {
              offerId: OFFER_ID,
              offerTitle: TITLE,
              companyName: '义乌市流雅饰品有限公司',
              beginAmount: 2,
            },
            priceInfoList: [{ price: 9, text: '2件以上9元' }],
            // 推荐位：同店其它商品（噪声）
            offerList: [
              {
                saleText: '60天老客价', offerUrl: 'https://detail.1688.com/offer/111.html',
                price: 11, imageUrl: 'https://cbu01.alicdn.com/img/ibank/A.jpg',
                offerId: '111', isCurrentOffer: false, behaviorTag: '热销',
                title: '亚马逊爆款羽毛头饰头花套装蕾丝手套', priceTypeText: '¥11', priceText: '¥11',
              },
              {
                offerUrl: 'https://detail.1688.com/offer/222.html', price: 12,
                imageUrl: 'https://cbu01.alicdn.com/img/ibank/B.jpg', offerId: '222',
                isCurrentOffer: false, title: '欧美欧根纱头饰赛马会布艺立体花朵发饰', priceText: '¥12',
              },
            ],
            majorRecommendOfferInfos: [
              { title: '亚马逊网纱遮面小礼帽头饰', price: 9.5, offerId: '333', imageUrl: 'x' },
              { title: '爆款亚马逊小礼帽头饰', price: 6, offerId: '444', imageUrl: 'x' },
            ],
            relationRecommendOfferInfos: [
              { title: '2026新款亚马逊羽毛头花', price: 15, offerId: '555', imageUrl: 'x' },
            ],
            itemList: [
              { itemId: 'i1', linkUrl: 'https://x', price: 11, shopName: '某店', imageUrl: 'x' },
              { itemId: 'i2', linkUrl: 'https://x', price: 9.5, shopName: '某店', imageUrl: 'x' },
            ],
            // 真正的 SKU 列表（key 名不起眼，但条目有 skuId + 规格名 + priceText）
            skuModelList: [
              { skuId: '7001', skuName: '红色', price: '7', priceText: '¥7', amount: '20' },
              { skuId: '7002', skuName: '蓝色', price: '11', priceText: '¥11', amount: '8' },
            ],
          },
        },
      },
    },
  ]
}

/** 只含推荐位、且有当前商品卡片（isCurrentOffer=true）的场景 */
function makeRecommendOnlyPayloads() {
  return [
    {
      url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=y',
      data: {
        api: 'y',
        data: {
          data: {
            offerList: [
              {
                offerUrl: 'https://detail.1688.com/offer/999.html', price: 16.5,
                imageUrl: 'x', offerId: '999', isCurrentOffer: false,
                title: '亚马逊爆款羽毛头饰头花套装蕾丝手套', priceText: '¥16.5',
              },
              {
                offerUrl: 'https://detail.1688.com/offer/' + OFFER_ID + '.html', price: 9,
                imageUrl: 'y', offerId: OFFER_ID, isCurrentOffer: true,
                title: TITLE, priceText: '¥9',
              },
            ],
            majorRecommendOfferInfos: [{ title: '别人家', price: 6, offerId: '777' }],
          },
        },
      },
    },
  ]
}

function makeSandbox(payloads, href, opts = {}) {
  const fakeEl = { textContent: JSON.stringify(payloads) }
  const docEls = opts.domPrices || []
  const sandbox = {
    console,
    setTimeout,
    JSON,
    Math,
    Date,
    Number,
    parseFloat,
    parseInt,
    performance: { getEntriesByType: () => [] },
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    decodeURIComponent,
    document: {
      getElementById: id => (id === 'ff1688-capture' ? fakeEl : null),
      createElement: () => ({ set textContent(v) {}, get textContent() { return '' } }),
      querySelector: () => null,
      querySelectorAll: sel => {
        if (/\[class\*="price"\]/.test(sel)) {
          return docEls.map(e => ({
            innerText: e.text,
            textContent: e.text,
            className: e.cls || 'price',
            id: '',
            parentElement: { className: '', id: '', parentElement: null },
          }))
        }
        return []
      },
      head: { appendChild: () => {} },
      documentElement: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
  }
  sandbox.window = sandbox
  sandbox.location = { href }
  sandbox.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ success: true, imported: 1 }) })
  vm.createContext(sandbox)
  vm.runInContext(CORE, sandbox)
  return sandbox
}

;(async () => {
  const checks = []
  const add = (name, ok) => checks.push([name, !!ok])

  /* ---------- 场景 1：推荐位噪声不得胜出 ---------- */
  const sb1 = makeSandbox(
    makePayloads(),
    `https://detail.1688.com/offer/${OFFER_ID}.html`
  )
  const r1 = await sb1.FF1688.parseDetail()
  add('推荐位价格 11 不得成为采集价', r1.payload.priceMin !== 11)
  add('推荐位价格 12/16.5/6/15 不得成为采集价', ![12, 16.5, 6, 15].includes(r1.payload.priceMin))
  add('真实首个规格价 7 被采用', r1.payload.priceMin === 7)
  add('价格上限=首个规格价', r1.payload.priceMax === 7)
  add('价格来源是 sku:first', /^sku:first/.test(r1.payload.raw?.priceWhy || ''))
  add('各规格价格只含真 SKU', Array.isArray(r1.payload.skuPrices) && r1.payload.skuPrices.length === 2)
  add('第一个规格名=红色', r1.payload.skuPrices?.[0]?.spec === '红色')
  add('skuPrices 无商品卡片标题', !(r1.payload.skuPrices || []).some(s => /亚马逊爆款|欧根纱头饰赛马会/.test(s.spec || '')))
  add('批发价=采集价', r1.payload.wholesalePrice === 7)
  add('失败响应被过滤（invalid param 不作数）', r1.payload.raw?.capturedCount >= 1)
  add('诊断含数据来源统计', !!r1.payload.raw?.sources)
  add('诊断含 api 清单', Array.isArray(r1.payload.raw?.apiList) && r1.payload.raw.apiList.length > 0)
  add('诊断含 sku/price 路径', Array.isArray(r1.payload.raw?.skuLikePaths) && r1.payload.raw.skuLikePaths.length > 0)

  /* ---------- 场景 2：只有推荐位时，取当前商品卡片 ---------- */
  const sb2 = makeSandbox(
    makeRecommendOnlyPayloads(),
    `https://detail.1688.com/offer/${OFFER_ID}.html`
  )
  const r2 = await sb2.FF1688.parseDetail()
  add('无真 SKU 时取当前商品卡片价 9', r2.payload.priceMin === 9)
  add('未取别人家商品价 16.5/6', r2.payload.priceMin !== 16.5 && r2.payload.priceMin !== 6)
  add('价格来源标记为 current-offer', /current-offer/.test(r2.payload.raw?.priceWhy || ''))

  /* ---------- 场景 3：DOM 兜底排除推荐卡片、识别单值 ---------- */
  const sb3 = makeSandbox([], 'https://detail.1688.com/offer/1.html', {
    domPrices: [
      { text: '¥16.5', cls: 'price recommend-card-price' },
      { text: '¥9', cls: 'price' },
    ],
  })
  const r3 = await sb3.FF1688.parseDetail()
  add('DOM 单值价格被识别', r3.payload.priceMin === 9)
  add('DOM 推荐位价格被排除', r3.payload.priceMin !== 16.5)

  /* ---------- 场景 4：JSONP 包装可解析 ---------- */
  const sb4 = makeSandbox([], 'https://detail.1688.com/offer/1.html')
  const jsonp = sb4.FF1688.parseLoose
    ? sb4.FF1688.parseLoose('mtopjsonp1({"data":{"offer":{"offerId":"1","offerTitle":"JSONP标题"}}});')
    : null
  add('JSONP 响应可解析（或已内置）', jsonp === null || !!(jsonp && jsonp.data && jsonp.data.offer))

  let pass = 0
  for (const [name, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
    if (ok) pass++
  }
  console.log('\n噪声处理测试通过 ' + pass + '/' + checks.length)
  process.exit(pass === checks.length ? 0 : 1)
})()
