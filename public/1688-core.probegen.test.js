/* 回归：接口/DOM 都没有 SKU 容器时，用探测记录生成变体（2026-10-28 15:09）
 *
 * 用户报障：offer 1051478424254（儿童饰品，只有颜色一个规格）
 *   → variantCount: 0，variants: []，但 variantDims 里有垃圾维度「材质」
 *   → 前台一个变体都没有。
 *
 * 诊断事实：
 *   - variantKeyUnion: ["model","priceInfoList","deliveryLimitTimeModel"]
 *     → 报文里**没有任何 SKU/规格容器**
 *   - offerList 是同店推荐位（不是本商品 SKU）
 *   - currentOffer.price = 1.7（单件价）；priceInfoList = [{"price":"2.2","text":"≥2件"}]
 *   - specTableRows: [] → DOM 也没有 <table> 规格表（规格是前端渲染的色卡按钮）
 *
 * 解法：用户点过的每个色卡都被探测记录了（值/维度/图/价），
 *   那是这类商品唯一可靠的变体来源 → variantsFromProbe()
 *
 * 同时修：变体被 dropAttributeNamedVariants 删光后，dims 却残留 →
 *   前台看到「材质」维度却没有变体。
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
    location: { href: 'https://detail.1688.com/offer/1051478424254.html' },
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

/** 「接口无 SKU 容器」的报文（复刻用户诊断里的真实结构） */
function noSkuPayloads() {
  return [
    {
      api: 'mtop.1688.mmga.offerdetail.service',
      url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
      data: {
        data: {
          data: {
            priceInfoList: [{ price: '2.2', text: '≥2件' }],
            currentOffer: {
              offerId: '1051478424254',
              offerUrl: 'https://detail.1688.com/offer/1051478424254.html',
              price: 1.7,
              saleText: '已售3100+件',
            },
            offerList: [
              { offerId: '999', offerUrl: '//x.1688.com/offer/999.html', price: '3.00', offerTitle: '别家商品' },
            ],
          },
        },
      },
    },
  ]
}
const OFFER = 'https://detail.1688.com/offer/1051478424254.html'

async function main() {
  console.log('\n[① 无探测记录 → 0 变体（接口/DOM 都没有）]')
  {
    const K = loadKernel()
    const pr = (await K.parseDetail(noSkuPayloads(), { url: OFFER })).payload
    const v = (pr && pr.variants) || []
    t('确实 0 变体', v.length === 0, JSON.stringify(v))
    t('dims 也不残留垃圾维度「材质」', !((pr && pr.variantDims) || []).some(d => d.name === '材质'),
      JSON.stringify((pr && pr.variantDims) || []))
  }

  console.log('\n[② 有探测记录 → 生成变体]')
  {
    const K = loadKernel()
    K.__test_setProbeState({
      map: {
        '粉色': 'https://cbu01.alicdn.com/img/ibank/pink.jpg',
        '玫红': 'https://cbu01.alicdn.com/img/ibank/red.jpg',
        '米色': 'https://cbu01.alicdn.com/img/ibank/beige.jpg',
      },
      dim: { '粉色': '颜色', '玫红': '颜色', '米色': '颜色' },
      prices: { '粉色': 2.2, '玫红': 2.5, '米色': 2.3 },
    })
    const pr = (await K.parseDetail(noSkuPayloads(), { url: OFFER })).payload
    const v = (pr && pr.variants) || []
    t('生成了 3 个变体', v.length === 3, JSON.stringify(v.map(x => x.color + '@' + x.price)))
    t('维度是「颜色」', v.length > 0 && v[0].specs[0].name === '颜色', JSON.stringify(v[0]))
    t('价格取探测价 2.2', v.length > 0 && v[0].price === 2.2, JSON.stringify(v.map(x => x.price)))
    t('图片取探测图', v.length > 0 && v[0].image.includes('pink.jpg'), JSON.stringify(v[0]))
    t('dims 只有一个「颜色」维度', (pr.variantDims || []).length === 1 && pr.variantDims[0].name === '颜色',
      JSON.stringify(pr.variantDims))
    t('dims 的值是 3 个颜色', pr.variantDims[0] && pr.variantDims[0].values.length === 3,
      JSON.stringify(pr.variantDims))
  }

  console.log('\n[③ 探测没抓到价 → 用商品价兜底]')
  {
    const K = loadKernel()
    K.__test_setProbeState({
      map: { '粉色': 'https://cbu01.alicdn.com/img/ibank/pink.jpg' },
      dim: { '粉色': '颜色' },
      prices: {},
    })
    const pr = (await K.parseDetail(noSkuPayloads(), { url: OFFER })).payload
    const v = (pr && pr.variants) || []
    t('有变体', v.length === 1, JSON.stringify(v))
    t('价格非空（商品价兜底）', v.length === 1 && v[0].price != null && v[0].price > 0, JSON.stringify(v))
  }

  console.log('\n[④ 接口变体与探测项对得上 → 仍用接口变体（不覆盖）]')
  {
    const K = loadKernel()
    K.__test_setProbeState({
      map: { '红色': 'https://cbu01.alicdn.com/img/ibank/x.jpg' },
      dim: { '红色': '颜色' },
      prices: { '红色': 9.99 },
    })
    const withSku = [
      {
        api: 'mtop.1688.mmga.offerdetail.service',
        url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
        data: { data: { data: { skuList: [
          { skuId: '440', specAttrs: [{ name: '颜色', value: '红色' }], price: '2.20' },
        ] } } },
      },
    ]
    const pr = (await K.parseDetail(withSku, { url: OFFER })).payload
    const v = (pr && pr.variants) || []
    // 变体本身用接口的（skuId=440），但价格按既定优先级「探测价 > 接口价」→ 9.99
    t('仍用接口变体（skuId 440）',
      v.length === 1 && v[0].specs[0].value === '红色' && v[0].skuId === '440', JSON.stringify(v))
    t('价格按优先级取探测价 9.99', v.length === 1 && v[0].price === 9.99, JSON.stringify(v))
  }

  console.log('\n[④b 接口变体被探测全过滤 → 改用探针变体（符合「没点过的不出现」）]')
  {
    const K = loadKernel()
    K.__test_setProbeState({
      map: { '蓝色': 'https://cbu01.alicdn.com/img/ibank/blue.jpg' },
      dim: { '蓝色': '颜色' },
      prices: { '蓝色': 2.8 },
    })
    const withSku = [
      {
        api: 'mtop.1688.mmga.offerdetail.service',
        url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
        data: { data: { data: { skuList: [
          { skuId: '440', specAttrs: [{ name: '颜色', value: '红色' }], price: '2.20' },
        ] } } },
      },
    ]
    const pr = (await K.parseDetail(withSku, { url: OFFER })).payload
    const v = (pr && pr.variants) || []
    t('用探针变体「蓝色」', v.length === 1 && v[0].specs[0].value === '蓝色', JSON.stringify(v))
  }

  console.log('\n[⑤ variantsFromProbe 直接调用]')
  {
    const K = loadKernel()
    K.__test_setProbeState({
      map: { '蓝色': 'https://cbu01.alicdn.com/img/ibank/blue.jpg' },
      dim: { '蓝色': '颜色' },
      prices: { '蓝色': 3.1 },
    })
    const res = K.variantsFromProbe({ lo: 2.2, hi: 2.2 })
    t('产出 1 个变体', res.variants.length === 1, JSON.stringify(res))
    t('价格 3.1', res.variants[0] && res.variants[0].price === 3.1, JSON.stringify(res.variants))
    t('dims 正确', res.dims.length === 1 && res.dims[0].name === '颜色', JSON.stringify(res.dims))
  }

  console.log(`\n通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
}

main()
