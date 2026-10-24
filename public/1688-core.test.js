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
        skuMapReal: {
          '颜色分类:红色;尺码:M': { skuId: '5123456789012', amount: '12', price: '8.50' },
          '颜色分类:蓝色;尺码:M': { skuId: '5123456789013', amount: '5', price: '9.90' },
        },
        // 真实 1688 里每个 SKU 一条 price/priceText（这是「第一个规格的价格」的来源）
        skuModelList: [
          { skuId: '7001', skuName: '红色', price: '7', priceText: '¥7', amount: '20' },
          { skuId: '7002', skuName: '蓝色', price: '11', priceText: '¥11', amount: '8' },
          { skuId: '7003', skuName: '黑色', price: '12', priceText: '¥12', amount: '3' },
        ],
        // 曾经的坑：数量 + 总价被当成 min/max 价格（selectedStartQuantity=1, totalCost=5）
        selectedStartQuantity: 1,
        totalCost: 5,
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
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  decodeURIComponent,
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
sandbox.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ success: true, imported: 1 }) })

vm.createContext(sandbox)
vm.runInContext(CORE, sandbox)

;(async () => {
  const { payload, debug } = await sandbox.FF1688.parseDetail()
  const checks = [
    ['标题不是公司名', !/有限公司/.test(payload.title)],
    ['标题正确', /中国结/.test(payload.title)],
    ['价格取第一个规格价=7', payload.priceMin === 7],
    ['价格上限=第一个规格价', payload.priceMax === 7],
    ['没取到噪声 price=1', payload.priceMin !== 1],
    ['没把数量/总价当价格', payload.priceMin !== 1 && payload.priceMin !== 5],
    ['价格来源是 sku:first', /^sku:first/.test(payload.raw?.priceWhy || '')],
    ['各规格价格已采集', Array.isArray(payload.skuPrices) && payload.skuPrices.length >= 3],
    ['第一个规格价格=7', payload.skuPrices?.[0]?.price === 7],
    ['第一个规格名=红色', payload.skuPrices?.[0]?.spec === '红色'],
    ['MOQ=2', payload.moq === 2],
    ['图片含主图', payload.images.some(i => /O1CN01MAIN/.test(i))],
    ['主图排在第一张', /O1CN01MAIN/.test(payload.images[0] || '')],
    ['payload.mainImage 正确', /O1CN01MAIN/.test(payload.mainImage || '')],
    ['图片不含 logo svg', !payload.images.some(i => /\.svg/i.test(i))],
    ['图片不含 logo 命名', !payload.images.some(i => /logo/i.test(i))],
    ['供应商是公司名', /义乌市然航饰品有限公司/.test(payload.supplierName || '')],
    ['描述有内容', (payload.description || '').length > 20],
    // 老版本把**图片地址**当成了商品描述（key='url' 不在 neg 列表里，score=0 也拿第一）
    ['描述不是 URL', !/^https?:\/\//i.test(payload.description || '')],
    ['描述是商品正文', (payload.description || '').includes('中国结')],
    ['阶梯价有数据', !!payload.priceTiers],
    ['SKU 有数据', !!payload.skuText],
    ['阶梯价归一化', Array.isArray(JSON.parse(payload.priceLadder || '[]')) && JSON.parse(payload.priceLadder).length === 2],
    ['阶梯价首个=2件1.2', JSON.parse(payload.priceLadder || '[]')[0]?.minQty === 2 && JSON.parse(payload.priceLadder)[0]?.price === 1.2],
    ['批发价=采集价下限', payload.wholesalePrice === 7],
    ['首个规格/颜色已提取', !!payload.firstSku],
    ['首个规格不是乱码', !/[:：]/.test(payload.firstSku || '')],
  ]
  let pass = 0
  for (const [name, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
    if (ok) pass++
  }
  console.log('\n通过 ' + pass + '/' + checks.length)

  // 推送前 Token 角色自检（非 ADMIN 直接拦下并给出可执行提示）
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const badToken = b64({ alg: 'HS256' }) + '.' + b64({ role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.sig'
  const goodToken = b64({ alg: 'HS256' }) + '.' + b64({ role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.sig'
  const r1 = await sandbox.FF1688.push({ sourceId: '1' }, badToken, '')
  const r2 = await sandbox.FF1688.push({ sourceId: '1' }, '', '')
  const r3 = await sandbox.FF1688.push({ sourceId: '1' }, goodToken, '')
  const pushChecks = [
    ['非 ADMIN Token 被拦下', r1.status === 0 && /角色是 CUSTOMER/.test(r1.text || '')],
    ['提示要求重新登录', /重新登录/.test(r1.text || '')],
    ['空 Token 给出提示', r2.status === 0 && /没有填 Token/.test(r2.text || '')],
    ['ADMIN Token 会真的发请求', r3.status !== 0 && !/角色是/.test(r3.text || '')],
  ]
  let p2 = 0
  for (const [name, ok] of pushChecks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
    if (ok) p2++
  }
  console.log('\n推送自检通过 ' + p2 + '/' + pushChecks.length)
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
    mainImage: payload.mainImage,
    skuPrices: payload.skuPrices,
    wholesalePrice: payload.wholesalePrice,
    firstSku: payload.firstSku,
    sourceSkuId: payload.sourceSkuId,
    skuText: payload.skuText,
    descLen: (payload.description || '').length,
  }, null, 2))
  process.exit(pass === checks.length && p2 === pushChecks.length ? 0 : 1)
})()
