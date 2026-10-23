/**
 * 离线测试 1688-core.js 的字段选择逻辑
 * 模拟 1688 接口返回（含干扰项：供应商名、price=1、logo svg）
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const CORE = fs.readFileSync(path.join(__dirname, '1688-core.js'), 'utf8')

const payloads = [
  {
    url: 'https://h5api.m.1688.com/h5/mtop.detail.getdetail/1.0/?api=mtop.detail.getdetail&offerId=1022060080982',
    data: {
      data: {
        offer: {
          offerId: '1022060080982',
          offerTitle: '手工编织中国结流苏挂件民族风车挂饰汽车钥匙扣',
          companyName: '义乌市然航饰品有限公司',
          sellerNick: '然航饰品',
          priceRange: '1.20-3.50',
          beginAmount: 2,
          offerImgList: [
            { url: 'https://cbu01.alicdn.com/img/ibank/O1CN01MAIN_!!2220137013659-0-cib.jpg' },
            { url: 'https://cbu01.alicdn.com/img/ibank/O1CN01SEC_!!2220137013660-0-cib.jpg' },
          ],
          images: [
            { url: 'https://img.alicdn.com/imgextra/i2/O1CN01LOGO_!!6000000003082-55-tps-15-8.svg' },
          ],
          description: '<p>纯手工编织中国结，民族风设计，适合做车挂、包包挂件，支持一件代发。</p>',
        },
        company: { companyName: '义乌市然航饰品有限公司' },
        noise: { price: 1, discount: 1, freight: 0, count: 1, name: '义乌市然航饰品有限公司' },
        priceTierList: [
          { beginAmount: 2, price: '1.20' },
          { beginAmount: 100, price: '0.95' },
        ],
        skuMap: { 颜色: ['红色', '蓝色'], 规格: ['单个', '10个装'] },
        skuMapReal: { '颜色分类:红色;尺码:M': { skuId: '5123456789012', amount: '12' } },
        skuProps: [
          { name: '颜色', value: '红色' },
          { name: '尺码', value: 'M' },
        ],
      },
    },
  },
]

// 伪造浏览器环境
const fakeEl = { textContent: JSON.stringify(payloads) }
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
  document: {
    getElementById: id => (id === 'ff1688-capture' ? fakeEl : null),
    createElement: () => ({ set textContent(v) {}, get textContent() { return '' } }),
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild: () => {} },
    documentElement: { appendChild: () => {} },
    body: { appendChild: () => {} },
  },
}
sandbox.window = sandbox
sandbox.location = { href: 'https://detail.1688.com/offer/1022060080982.html' }
sandbox.fetch = async () => ({ ok: false })

vm.createContext(sandbox)
vm.runInContext(CORE, sandbox)

;(async () => {
  const { payload, debug } = await sandbox.FF1688.parseDetail()
  const checks = [
    ['标题不是公司名', !/有限公司/.test(payload.title)],
    ['标题正确', /中国结/.test(payload.title)],
    ['价格下限=1.2', payload.priceMin === 1.2],
    ['价格上限=3.5', payload.priceMax === 3.5],
    ['没取到噪声 price=1', payload.priceMin !== 1],
    ['MOQ=2', payload.moq === 2],
    ['图片含主图', payload.images.some(i => /O1CN01MAIN/.test(i))],
    ['图片不含 logo svg', !payload.images.some(i => /\.svg/i.test(i))],
    ['供应商是公司名', /义乌市然航饰品有限公司/.test(payload.supplierName || '')],
    ['描述有内容', (payload.description || '').length > 20],
    ['阶梯价有数据', !!payload.priceTiers],
    ['SKU 有数据', !!payload.skuText],
    ['阶梯价归一化', Array.isArray(JSON.parse(payload.priceLadder || '[]')) && JSON.parse(payload.priceLadder).length === 2],
    ['阶梯价首个=2件1.2', JSON.parse(payload.priceLadder || '[]')[0]?.minQty === 2 && JSON.parse(payload.priceLadder)[0]?.price === 1.2],
    ['批发价=采集价下限', payload.wholesalePrice === 1.2],
    ['首个规格/颜色已提取', !!payload.firstSku],
    ['首个规格不是乱码', !/[:：]/.test(payload.firstSku || '')],
  ]
  let pass = 0
  for (const [name, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
    if (ok) pass++
  }
  console.log('\n通过 ' + pass + '/' + checks.length)
  console.log('\n解析结果：')
  console.log(JSON.stringify({
    title: payload.title,
    priceMin: payload.priceMin,
    priceMax: payload.priceMax,
    moq: payload.moq,
    supplierName: payload.supplierName,
    images: payload.images,
    priceTiers: payload.priceTiers,
    priceLadder: payload.priceLadder,
    wholesalePrice: payload.wholesalePrice,
    firstSku: payload.firstSku,
    sourceSkuId: payload.sourceSkuId,
    skuText: payload.skuText,
    descLen: (payload.description || '').length,
  }, null, 2))
  process.exit(pass === checks.length ? 0 : 1)
})()
