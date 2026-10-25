/* 变体采集：颜色 / 规格 / 自定义维度 + 每个变体的价格与图片 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

function makeWin(href, payloads) {
  const win = {
    addEventListener() {},
    document: {
      getElementById: id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(payloads || []) } : null),
      querySelector: () => null, querySelectorAll: () => [],
      documentElement: { appendChild() {} }, body: { appendChild() {} },
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
    },
    location: { href: href || 'https://detail.1688.com/offer/1053022605528.html' },
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ json: async () => ({}), text: async () => '' }),
    console,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  }
  win.window = win; win.self = win; win.globalThis = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return win.FF1688
}

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const DETAIL_URL =
  '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service'

const IMG_RED = 'https://cbu01.alicdn.com/img/ibank/O1CN01AUkbyV1mJpKSH6BMN_!!221625003xx.jpg'
const IMG_BLUE = 'https://cbu01.alicdn.com/img/ibank/O1CN01KoUl2i1KbrdoFFvtB_!!2218616230xx.jpg'
const IMG_GREEN = 'https://cbu01.alicdn.com/img/ibank/O1CN01WhwMJ82JorTrPyj63_!!2207650138xx.jpg'
const OTHER_SHOP_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01gss6Yy2IUsZJFmuUN_!!2213099078xx.jpg'
const MAIN_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01MAIN_!!2220137013659-0-cib.jpg'

/* 场景 1：offerList 里的 SKU 行自带 specAttrs（最常见形态） */
function payloadRows() {
  return [{
    url: DETAIL_URL,
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        currentOffer: {
          offerId: '1053022605528',
          imageUrl: MAIN_IMG,
          title: '测试商品 针织开衫',
        },
        offerList: [
          {
            skuId: '5001',
            specAttrs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }],
            priceText: '12.50',
            imageUrl: IMG_RED,
          },
          {
            skuId: '5002',
            specAttrs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'L' }],
            priceText: '13.00',
            imageUrl: IMG_BLUE,
          },
        ],
        offerProps: [
          { propName: '品牌', propValue: '无品牌' },
          { propName: '材质', propValue: '棉' },
          { propName: '货号', propValue: 'AB-1001' },
        ],
      },
    },
  }]
}

/* 场景 2：skuMap 组合键形态 —— "颜色:红色;尺码:M" → skuId */
function payloadComboMap() {
  return [{
    url: DETAIL_URL,
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        currentOffer: { offerId: '1053022605528', imageUrl: MAIN_IMG, title: '测试商品' },
        skuMap: {
          '颜色:红色;尺码:M': '6001',
          '颜色:蓝色;尺码:L': '6002',
        },
        skuPriceMap: { '6001': 8.8, '6002': 9.9 },
      },
    },
  }]
}

/* 场景 3：自定义维度（材质），不是颜色也不是尺码 */
function payloadCustomDim() {
  return [{
    url: DETAIL_URL,
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        currentOffer: { offerId: '1053022605528', imageUrl: MAIN_IMG, title: '测试商品' },
        offerList: [
          { skuId: '7001', saleProp: [{ propName: '材质', propValue: '真丝' }], skuPrice: 45.5, imageUrl: IMG_GREEN },
          { skuId: '7002', saleProp: [{ propName: '材质', propValue: '亚麻' }], skuPrice: 46.5, imageUrl: IMG_GREEN },
        ],
      },
    },
  }]
}

async function run() {
  console.log('--- 场景 1：SKU 行自带 specAttrs ---')
  {
    const FF = makeWin(undefined, payloadRows())
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    t('提取到 2 个变体', vs.length === 2, JSON.stringify(vs))
    t('颜色维度被识别为 color', (payload.variantDims || []).some(d => d.name === '颜色' && d.kind === 'color'), JSON.stringify(payload.variantDims))
    t('尺码维度被识别为 size', (payload.variantDims || []).some(d => d.name === '尺码' && d.kind === 'size'))
    t('变体带价格 12.5', vs.some(v => Math.abs(v.price - 12.5) < 1e-6), JSON.stringify(vs.map(v => v.price)))
    t('变体带价格 13', vs.some(v => Math.abs(v.price - 13) < 1e-6))
    t('变体带图片', vs.every(v => !!v.image), JSON.stringify(vs.map(v => v.image)))
    t('红色变体颜色字段=红色', vs.some(v => v.color === '红色'))
    t('specText 拼接了维度值', vs.some(v => v.specText && v.specText.includes('红色')))
    t('描述来自属性表', /品牌: 无品牌/.test(payload.description || ''), payload.description)
    t('描述含材质属性', /材质: 棉/.test(payload.description || ''))
    t('主图=currentOffer 的图', payload.mainImage === MAIN_IMG, payload.mainImage)
    t('images[0] 是主图', payload.images[0] === MAIN_IMG, JSON.stringify(payload.images.slice(0, 2)))
  }

  console.log('--- 场景 2：skuMap 组合键 ---')
  {
    const FF = makeWin(undefined, payloadComboMap())
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    t('提取到 2 个变体', vs.length === 2, JSON.stringify(vs))
    t('从 skuPriceMap 取到价格 8.8', vs.some(v => Math.abs(v.price - 8.8) < 1e-6), JSON.stringify(vs.map(v => v.price)))
    t('维度含颜色', (payload.variantDims || []).some(d => d.name === '颜色'))
    t('维度值含红色', (payload.variantDims || []).some(d => d.values && d.values.includes('红色')))
  }

  console.log('--- 场景 3：自定义维度（材质） ---')
  {
    const FF = makeWin(undefined, payloadCustomDim())
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    t('提取到 2 个变体', vs.length === 2, JSON.stringify(vs))
    t('材质维度 kind=custom', (payload.variantDims || []).some(d => d.name === '材质' && d.kind === 'custom'), JSON.stringify(payload.variantDims))
    t('变体价格 45.5', vs.some(v => Math.abs(v.price - 45.5) < 1e-6))
  }

  console.log('--- 噪声隔离 ---')
  {
    // 推荐位里的 SKU 不能被当成本商品的变体
    const p = payloadRows()
    p[0].data.data.majorRecommendOfferInfos = {
      offerList: [
        { skuId: '9999', specAttrs: [{ name: '颜色', value: '推荐色' }], priceText: '1.00', imageUrl: IMG_GREEN },
      ],
    }
    const FF = makeWin(undefined, p)
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    t('推荐位变体被排除', !vs.some(v => v.specs && v.specs.some(s => s.value === '推荐色')), JSON.stringify(vs))
  }
  {
    // "2件起批" 不是价格
    const p = [{
      url: DETAIL_URL,
      data: {
        api: 'mtop.1688.mmga.offerdetail.service',
        data: {
          currentOffer: { offerId: '1', imageUrl: MAIN_IMG, title: 'x' },
          offerList: [{ skuId: '8001', specAttrs: [{ name: '颜色', value: '红' }], priceText: '2件起批' }],
        },
      },
    }]
    const FF = makeWin(undefined, p)
    const { payload } = await FF.parseDetail()
    t('"2件起批" 不被当作价格', !(payload.variants || []).some(v => v.price === 2), JSON.stringify(payload.variants))
  }
  {
    // 没有变体数据时不应报错
    const FF = makeWin(undefined, [{
      url: DETAIL_URL,
      data: { api: 'x', data: { currentOffer: { offerId: '1', imageUrl: MAIN_IMG, title: 'x' } } },
    }])
    const { payload } = await FF.parseDetail()
    t('无变体数据时 variants 为空', !payload.variants || payload.variants.length === 0)
  }

  console.log('--- 诊断接口 ---')
  {
    const FF = makeWin(undefined, payloadRows())
    const struct = FF.dumpVariants(FF.capture())
    t('dumpVariants 返回数组', Array.isArray(struct))
    t('dumpVariants 命中 sku 路径', JSON.stringify(struct).includes('offerList'), JSON.stringify(struct).slice(0, 300))
  }

  console.log('--- DOM 规格价格表兜底 ---')
  {
    // 模拟 1688 页面上渲染的规格价格表（接口没给 SKU 容器的情况）
    function makeEl(tag, attrs = {}) {
      return {
        tagName: tag, className: attrs.className || '', id: attrs.id || '',
        innerHTML: attrs.innerHTML || '', innerText: attrs.innerText || '', textContent: attrs.textContent || '',
        attrs,
        getAttribute: k => (attrs[k] !== undefined ? attrs[k] : null),
        querySelectorAll: sel => (attrs._qsa && attrs._qsa[sel]) || [],
        querySelector: sel => (attrs._qs && attrs._qs[sel]) || null,
        closest: sel => (attrs._closest && attrs._closest[sel]) || null,
        parentElement: attrs.parentElement || null,
        children: attrs.children || [],
      }
    }
    const cell = txt => makeEl('td', { innerText: txt })
    const headCell = txt => makeEl('th', { innerText: txt })
    const headRow = makeEl('tr', {})
    headRow.querySelectorAll = sel => (sel === 'td,th' ? [headCell('颜色'), headCell('尺码'), headCell('价格')] : [])
    const row1 = makeEl('tr', {})
    row1.querySelectorAll = sel => (sel === 'td,th' ? [cell('红色'), cell('M'), cell('12.50')] : [])
    const row2 = makeEl('tr', {})
    row2.querySelectorAll = sel => (sel === 'td,th' ? [cell('蓝色'), cell('L'), cell('13.00')] : [])
    const table = makeEl('table', {})
    table.querySelectorAll = sel => (sel === 'tr' ? [headRow, row1, row2] : [])
    const tierHead = makeEl('tr', {})
    tierHead.querySelectorAll = sel => (sel === 'td,th' ? [headCell('起订数量'), headCell('价格')] : [])
    const tierRow = makeEl('tr', {})
    tierRow.querySelectorAll = sel => (sel === 'td,th' ? [cell('2'), cell('1.20')] : [])
    const tierTable = makeEl('table', {})
    tierTable.querySelectorAll = sel => (sel === 'tr' ? [tierHead, tierRow] : [])

    const win = {
      addEventListener() {},
      document: {
        getElementById: id => (id === 'ff1688-capture' ? { textContent: '[]' } : null),
        querySelector: () => null,
        querySelectorAll: sel => (sel === 'table' ? [table, tierTable] : []),
        documentElement: { appendChild() {} }, body: { appendChild() {} },
        createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
      },
      location: { href: 'https://detail.1688.com/offer/1081258035891.html' },
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
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    t('DOM 兜底提取到 2 个变体', vs.length === 2, JSON.stringify(vs))
    t('颜色维度 kind=color', (payload.variantDims || []).some(d => d.name === '颜色' && d.kind === 'color'), JSON.stringify(payload.variantDims))
    t('尺码维度 kind=size', (payload.variantDims || []).some(d => d.name === '尺码' && d.kind === 'size'))
    t('红色/M 变体价格 12.5', vs.some(v => v.color === '红色' && v.size === 'M' && Math.abs(v.price - 12.5) < 1e-6), JSON.stringify(vs))
    t('蓝色/L 变体价格 13', vs.some(v => v.color === '蓝色' && v.size === 'L' && Math.abs(v.price - 13) < 1e-6))
    t('阶梯价表不被当变体', !vs.some(v => v.specText === '2'), JSON.stringify(vs))
  }

  console.log('--- 主图准确性（硬保障）---')
  {
    // 场景：页面上同时有本商品主图、SKU 图、评价图、店铺装修图、别家货源图
    const p = [{
      url: DETAIL_URL,
      data: {
        api: 'mtop.1688.mmga.offerdetail.service',
        data: {
          currentOffer: { offerId: '1', imageUrl: MAIN_IMG, title: 'x' },
          offerList: [
            { skuId: '5001', specAttrs: [{ name: '颜色', value: '红色' }], priceText: '12.50', imageUrl: IMG_RED },
          ],
          result: {
            offerRateInfo: {
              model: {
                ratePics: [{ picUrl: 'https://cbu01.alicdn.com/i3/O1CN014Xhu9EADLlE2BxV2_!!46116860184273804xx.jpg' }],
                commentList: [{ images: [{ url: 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg' }] }],
              },
            },
          },
          downstreamPerformance: { highPerfectLgtRateList: [{ image: 'https://gw.alicdn.com/imgextra/i1/O1CN01VTxDcJ9AoUBqPOA_!!6000000000xx.jpg' }] },
          memberIdentityAttrModel: { memberIcon: 'https://cbu01.alicdn.com/cms/upload/member/club/buy_2_star.gif' },
        },
      },
    }, {
      url: DETAIL_URL,
      data: {
        api: 'mtop.1688.mmga.offerdetail.service',
        data: {
          itemList: [
            { imageUrl: OTHER_SHOP_IMG, shopIconUrl: 'https://img.alicdn.com/imgextra/i4/6000000000191/O1CN01JK9tipfk7vfGSWnxx.png', price: 3.2 },
          ],
        },
      },
    }]
    const FF = makeWin(undefined, p)
    const { payload } = await FF.parseDetail()
    t('主图 = currentOffer 的图', payload.mainImage === MAIN_IMG, payload.mainImage)
    t('images[0] 就是主图', payload.images[0] === MAIN_IMG, JSON.stringify(payload.images))
    t('图片不含评价图 ratePics', !payload.images.includes('https://cbu01.alicdn.com/i3/O1CN014Xhu9EADLlE2BxV2_!!46116860184273804xx.jpg'))
    t('图片不含评价图 -rate', !payload.images.some(u => /-rate\.jpg/.test(u)))
    t('图片不含完好率徽章', !payload.images.some(u => /gw\.alicdn\.com\/imgextra/.test(u)))
    t('图片不含会员图标', !payload.images.some(u => /buy_2_star\.gif/.test(u)))
    t('图片不含别家货源图', !payload.images.includes(OTHER_SHOP_IMG), JSON.stringify(payload.images))
    t('图片含本商品 SKU 图', payload.images.includes(IMG_RED), JSON.stringify(payload.images))
    t('变体图不含评价图', !(payload.variants || []).some(v => /rate|gw\.alicdn/.test(v.image || '')))
  }
  {
    // 没有 currentOffer 时，图集数组第一张应为��图
    const p = [{
      url: DETAIL_URL,
      data: {
        api: 'x',
        data: {
          offerImgList: [
            { url: IMG_RED },
            { url: IMG_BLUE },
          ],
        },
      },
    }]
    const FF = makeWin(undefined, p)
    const { payload } = await FF.parseDetail()
    t('无 currentOffer 时主图 = 图集首张', payload.mainImage === IMG_RED, payload.mainImage)
    t('无 currentOffer 时 images[0] = 主图', payload.images[0] === IMG_RED, JSON.stringify(payload.images))
  }
  {
    // 主图绝不能是评价图
    const p = [{
      url: DETAIL_URL,
      data: {
        api: 'x',
        data: {
          offerRateInfo: {
            model: { ratePics: [{ picUrl: 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg' }] },
          },
        },
      },
    }]
    const FF = makeWin(undefined, p)
    const { payload } = await FF.parseDetail()
    t('主图不是评价图', !/-rate\.jpg/.test(payload.mainImage || ''), payload.mainImage)
  }

  console.log(`\n${pass} 通过, ${fail} 失败`)
  if (fail) process.exit(1)
}

run().catch(e => { console.error(e); process.exit(1) })
