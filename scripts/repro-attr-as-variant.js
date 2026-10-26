/* 复现：商品属性表被当成变体
 *
 * 用户 18:00 反馈（真实面板输出）：
 *   --- 变体 ---
 *    材质:风格 → 0.9 [图{align}]
 *    材质:发夹分类 → 0.9 [无图]
 *    材质:镶嵌材质 → 0.9 [无图]
 *    材质:样式 → 0.9 [无图]
 *    材质:主要下游平台 → 0.9 [无图]
 *    材质:有可授权的自有品牌 → 0.9 [无图]
 *    材质:上市年份/季节 → 4.5 [无图]
 *    ...
 *
 * 观察：name 全是「材质」，value 是各种**属性名**（风格/发夹分类/镶嵌材质…）
 *       → 属性表被当成了「规格维度 + 规格值」
 *
 * 本脚本用**用户 dump 里的真实报文片段**喂给 pickVariants，定位是哪个容器被误判。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

function makeSandbox() {
  const win = {
    document: {
      body: { tagName: 'BODY', children: [], querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
      documentElement: { tagName: 'HTML' },
      addEventListener() {}, removeEventListener() {},
    },
    location: { href: 'https://detail.1688.com/offer/828424453992.html' },
    navigator: { userAgent: 'test' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, text: async () => '' }),
    console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  }
  win.window = win; win.self = win; win.globalThis = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return sandbox.FF1688
}

/* ── 用户 dump 里的真实片段 ───────────────────────────── */
const PARAM_LIST = [
  { property: '材质', value: '仿金属' },
  { property: '流行元素', value: '蝴蝶结' },
  { property: '风格', value: '百搭风' },
  { property: '发夹分类', value: '抓夹' },
  { property: '处理工艺', value: '手工' },
  { property: '镶嵌材质', value: '非镶嵌' },
]

const offerDecisionAttrs = [
  { property: '材质', value: '仿金属' },
  { property: '流行元素', value: '蝴蝶结' },
]

const platformProductInfoMap = {
  PRODUCT_PARAMS: {
    linkUrl: 'https://air.1688.com/kapp/cpapp/des-info/home?offerId=828424453992',
    paramList: PARAM_LIST,
    type: 'PRODUCT_PARAMS',
  },
}

const priceInfoList = [{ price: '0.9', text: '1件价格' }]

function mkPayloads() {
  return [
    {
      url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?x=1',
      data: {
        api: 'mtop.1688.mmga.offerdetail.service',
        v: '4.0',
        ret: ['SUCCESS::调用成功'],
        data: {
          resultCode: '0',
          data: {
            offerDecisionAttrs,
            platformProductInfoMap,
            priceInfoList,
            title: '韩系新款女高级感小号发夹蝴蝶结刘海夹头饰侧边抓夹碎发发饰批发',
            utCustomMap: { offer_id: 828424453992 },
          },
        },
      },
    },
  ]
}

console.log('\n=== 复现 ===')
const FF = makeSandbox()
const res = FF.pickVariants(mkPayloads())
console.log('variants =', res.variants.length)
for (const v of res.variants.slice(0, 15)) {
  console.log('  ', (v.specs || []).map(s => s.name + ':' + s.value).join(' | '), '→', v.price)
}
console.log('dims =', JSON.stringify(res.dims))

const names = [...new Set(res.variants.flatMap(v => (v.specs || []).map(s => s.name)))]
const values = [...new Set(res.variants.flatMap(v => (v.specs || []).map(s => s.value)))]
console.log('\n维度名 =', JSON.stringify(names))
console.log('值 =', JSON.stringify(values))

const isAttr = res.variants.some(v => (v.specs || []).some(s =>
  ['风格', '发夹分类', '镶嵌材质', '材质', '流行元素', '处理工艺'].includes(s.value)))
console.log('\n★ 复现成功（属性被当成变体）=', isAttr)

process.exit(isAttr ? 0 : 1)
