/* 端到端：真实 mtop 报文 → parseDetail → 变体
 *
 * 覆盖用户 2026-10-26 全天反馈的三件事，一次跑完：
 *   ① mtop 的 `data` 是**字符串形态** → 必须解包（否则整棵树看不见）
 *   ② 商品属性表（材质/流行元素/风格…）不能冒充成变体
 *   ③ 变体项本身按「用户点过的探测值」过滤 —— 没点过的整个消失
 *
 * 报文结构按用户 18:00 提供的 dump 还原（offer 828424453992 发夹）。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

const OFFER_ID = '828424453992'
const TITLE = '韩系新款女高级感小号发夹蝴蝶结刘海夹头饰侧边抓夹碎发发饰批发'

/* ── 商品属性表（真实结构：{property, value}） ── */
const PARAM_LIST = [
  { property: '材质', value: '仿金属' },
  { property: '流行元素', value: '蝴蝶结' },
  { property: '风格', value: '百搭风' },
  { property: '发夹分类', value: '抓夹' },
  { property: '处理工艺', value: '手工' },
  { property: '镶嵌材质', value: '非镶嵌' },
  { property: '上市年份/季节', value: '2026春季' },
  { property: '适用发型', value: '日常通勤' },
  { property: '功能效果', value: '装饰' },
  { property: '主要销售地区', value: '全球' },
  { property: '是否IP授权', value: '否' },
]

/* ── 真实 SKU 容器（颜色 3 档 × 尺码 1 档） ── */
const skuInfos = [
  { skuId: '5724803174356', attributes: [{ attributeName: '颜色', attributeValue: '黄色' }, { attributeName: '尺码', attributeValue: '均码' }], price: '10.50', image: 'https://cbu01.alicdn.com/img/ibank/yellow.jpg' },
  { skuId: '5724803174357', attributes: [{ attributeName: '颜色', attributeValue: '红色' }, { attributeName: '尺码', attributeValue: '均码' }], price: '10.50', image: '' },
  { skuId: '5724803174358', attributes: [{ attributeName: '颜色', attributeValue: '蓝色' }, { attributeName: '尺码', attributeValue: '均码' }], price: '11.00', image: '' },
]

const mkInner = (withImg) => ({
  resultCode: '0',
  data: {
    currentOffer: {
      offerId: OFFER_ID,
      title: TITLE,
      imageUrl: 'https://cbu01.alicdn.com/img/ibank/main.jpg',
      priceInfoList: [{ price: '10.50', text: '1件价格' }],
    },
    skuModel: {
      skuInfos: skuInfos.map(s => Object.assign({}, s, { image: withImg ? s.image : '' })),
    },
    platformProductInfoMap: {
      PRODUCT_PARAMS: {
        linkUrl: 'https://air.1688.com/kapp/cpapp/des-info/home?offerId=' + OFFER_ID,
        paramList: PARAM_LIST,
        type: 'PRODUCT_PARAMS',
      },
    },
    offerDecisionAttrs: [
      { property: '材质', value: '仿金属' },
      { property: '流行元素', value: '蝴蝶结' },
    ],
  },
})

/* ── mtop H5 信封：data 是**字符串**（真实形态） ── */
const payloads = [
  {
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      v: '4.0',
      ret: ['SUCCESS::调用成功'],
      traceId: 'abc123',
      data: JSON.stringify(mkInner(true)),
    },
  },
  {
    // 属性表在另一个接口（也是字符串 data）
    url: '//h5api.m.1688.com/h5/mtop.alibaba.cbu.cupid.resource.getresourcedata/1.0/?api=mtop.alibaba.cbu.cupid.resource.getResourceData',
    data: {
      api: 'mtop.alibaba.cbu.cupid.resource.getResourceData',
      ret: ['SUCCESS'],
      data: JSON.stringify({ productParams: { paramList: PARAM_LIST } }),
    },
  },
]

function makeFF(payloadData, href) {
  const win = {
    addEventListener() {},
    document: {
      getElementById: id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(payloadData) } : null),
      querySelector: () => null, querySelectorAll: () => [],
      documentElement: { appendChild() {} }, body: { appendChild() {} },
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
    },
    location: { href: href || ('https://detail.1688.com/offer/' + OFFER_ID + '.html') },
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ json: async () => ({}), text: async () => '' }),
    console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  }
  win.window = win; win.self = win; win.globalThis = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return win.FF1688
}

;(async () => {
  console.log('\n[① mtop 字符串 data 能被解包 → 抓到真实结构]')
  {
    const FF = makeFF(payloads)
    const { payload } = await FF.parseDetail()
    console.log('  标题 =', payload.title)
    console.log('  变体数 =', (payload.variants || []).length)
    console.log('  变体 =', JSON.stringify((payload.variants || []).map(v => (v.specs || []).map(s => s.name + ':' + s.value))))
    t('★ 字符串 data 被解开（抓到 SKU）', (payload.variants || []).length >= 3, JSON.stringify((payload.variants || []).length))
    const specTexts = (payload.variants || []).map(v => v.specText || '')
    t('★ 有颜色变体', specTexts.some(x => x.indexOf('黄色') >= 0), JSON.stringify(specTexts))
    t('★ 没有「材质:风格」这种属性变体',
      !specTexts.some(x => /风格|发夹分类|上市年份/.test(x)), JSON.stringify(specTexts))
  }

  console.log('\n[② 探测：只点黄色 → 只剩黄色]')
  {
    const FF = makeFF(payloads)
    FF.__setVariantCapture({ '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/img/ibank/yellow.jpg' } })
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    const specTexts = vs.map(v => v.specText || '')
    console.log('  变体 =', JSON.stringify(specTexts))
    console.log('  维度 =', JSON.stringify(payload.variantDims || []))
    t('★ 只剩黄色', specTexts.length === 1 && specTexts[0].indexOf('黄色') >= 0, JSON.stringify(specTexts))
    t('★ 红色消失', !specTexts.some(x => x.indexOf('红色') >= 0), JSON.stringify(specTexts))
    t('★ 蓝色消失', !specTexts.some(x => x.indexOf('蓝色') >= 0), JSON.stringify(specTexts))
    t('★ 黄色有图', !!(vs[0] && vs[0].image), JSON.stringify(vs[0]))
    t('★ 接口自带的图标记为 imageSource=api',
      vs[0] && vs[0].imageSource === 'api', JSON.stringify(vs[0] && vs[0].imageSource))
  }

  console.log('\n[②b 接口没给图 → 靠探测补图（imageSource=probe）]')
  {
    const noImg = JSON.parse(JSON.stringify(payloads))
    noImg[0].data.data = JSON.stringify(mkInner(false))
    const FF = makeFF(noImg)
    FF.__setVariantCapture({ '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/img/ibank/yellow.jpg' } })
    const { payload } = await FF.parseDetail()
    const vs = payload.variants || []
    console.log('  变体 =', JSON.stringify(vs.map(v => v.specText + ' → ' + v.imageSource + ' ' + v.image)))
    t('★ 探测补图成功', !!(vs[0] && vs[0].image), JSON.stringify(vs[0]))
    t('★ image 是合法 URL 字符串', vs[0] && typeof vs[0].image === 'string' && /^https?:/.test(vs[0].image), JSON.stringify(vs[0] && vs[0].image))
    t('★ imageSource=probe', vs[0] && vs[0].imageSource === 'probe', JSON.stringify(vs[0] && vs[0].imageSource))
  }

  console.log('\n[③ 探测：点黄色+蓝色 → 两个都在]')
  {
    const FF = makeFF(payloads)
    FF.__setVariantCapture({
      '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/img/ibank/yellow.jpg' },
      '蓝色': { dim: '颜色', img: 'https://cbu01.alicdn.com/img/ibank/blue.jpg' },
    })
    const { payload } = await FF.parseDetail()
    const specTexts = (payload.variants || []).map(v => v.specText || '')
    console.log('  变体 =', JSON.stringify(specTexts))
    t('★ 黄色+蓝色保留', specTexts.length === 2 && specTexts.some(x => x.indexOf('黄色') >= 0) && specTexts.some(x => x.indexOf('蓝色') >= 0), JSON.stringify(specTexts))
    t('★ 红色消失', !specTexts.some(x => x.indexOf('红色') >= 0), JSON.stringify(specTexts))
  }

  console.log('\n[④ 没开探测 → 三个变体都在（老行为不变）]')
  {
    const FF = makeFF(payloads)
    const { payload } = await FF.parseDetail()
    const specTexts = (payload.variants || []).map(v => v.specText || '')
    console.log('  变体 =', JSON.stringify(specTexts))
    t('★ 三个都在', specTexts.length === 3, JSON.stringify(specTexts))
    t('★ 没有属性变体', !specTexts.some(x => /风格|发夹分类/.test(x)), JSON.stringify(specTexts))
  }

  console.log('\n[⑤ 维度定义里的可选值也跟着过滤]')
  {
    const FF = makeFF(payloads)
    FF.__setVariantCapture({ '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/img/ibank/yellow.jpg' } })
    const { payload } = await FF.parseDetail()
    const dims = payload.variantDims || []
    console.log('  维度 =', JSON.stringify(dims))
    const colorDim = dims.find(d => /颜色/.test(d.name || ''))
    t('★ 颜色的可选值只剩黄色', colorDim && JSON.stringify(colorDim.values) === JSON.stringify(['黄色']), JSON.stringify(colorDim))
  }

  console.log('\n[⑥ 过滤统计能看到（面板要展示）]')
  {
    const FF = makeFF(payloads)
    FF.__setVariantCapture({ '黄色': { dim: '颜色', img: 'https://cbu01.alicdn.com/img/ibank/yellow.jpg' } })
    const { payload } = await FF.parseDetail()
    const fs = (payload.raw || {}).variantFilterStat
    console.log('  统计 =', JSON.stringify(fs))
    t('★ 统计存在', !!fs, JSON.stringify(fs))
    t('★ 剔除了 2 个未点过的变体', fs && fs.probeFiltered === 2, JSON.stringify(fs))
    t('★ 剩余 1 个', fs && fs.after === 1, JSON.stringify(fs))
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  process.exit(fail === 0 ? 0 : 1)
})()
