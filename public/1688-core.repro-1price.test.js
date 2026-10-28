/* 复现：offer 604497188808 变体价全变成 1（真实价 2.65）*/
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

// 真实报文片段（来自用户诊断输出）
const payloads = [
  {
    api: 'mtop.1688.mmga.offerdetail.service',
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: {
      data: {
        data: {
          priceInfoList: [{ price: '2.65', text: '1件价格' }],
        },
      },
    },
  },
]

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
const K = sandbox.FF1688

console.log('=== 真实报文：priceInfoList=[{price:"2.65",text:"1件价格"}] ===')
const vres = K.pickVariants ? K.pickVariants(payloads) : null
console.log('pickVariants:', JSON.stringify(vres, null, 2).slice(0, 1500))

console.log('\n=== 探测价回填 ===')
K.__test_setProbePrices({ '1 粉色': 1, '2 玫红': 1 })
const vs = [
  { color: '1 粉色', specs: [{ name: '颜色', value: '1 粉色' }], price: 2.65 },
]
console.log('applyProbePrices:', JSON.stringify(K.applyProbePrices(vs)))
console.log('结果:', JSON.stringify(vs))

console.log('\n=== SKU entries ===')
console.log(JSON.stringify(K.collectSkuEntries(payloads), null, 2).slice(0, 1200))
