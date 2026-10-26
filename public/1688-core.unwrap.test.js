/* mtop 字符串 data 解包 + 诊断输出增强
 *
 * 背景（2026-10-26 17:53 用户反馈「这个明显不对」+ 57 报文 dump）：
 *   那份 dump 的 contentKeyUnion / allKeyUnion 里 **一个 sku/spec/props 容器都没有**。
 *   根因：mtop 的 `data` 字段**常常是 JSON 字符串**，而 walk() 只处理 object
 *   → 整棵真实结构对 collect/pickVariants/dumpVariants 完全不可见。
 *
 * 本测试验证：
 *   ① 字符串 data 被解开后，SKU 容器能被 collect 找到
 *   ② 解开前确实找不到（对照组）
 *   ③ 普通文本字符串不会被误解
 *   ④ 诊断输出带上 url（能看到 mtop 的 fields= 分片）
 *   ⑤ 诊断输出带上每层的 keys
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

/* 真实 mtop 信封：data 是 JSON 字符串 */
const SKU_INNER = {
  resultCode: '0',
  data: {
    skuModel: {
      skuBaseInfo: { props: [{ name: '颜色', value: '黑色' }, { name: '颜色', value: '粉色' }] },
      skuList: [
        { skuId: '111', skuName: '黑色', price: '1.20', priceText: '¥1.20' },
        { skuId: '222', skuName: '粉色', price: '1.50', priceText: '¥1.50' },
      ],
    },
    title: '韩系新款女高级感小号发夹',
  },
}
const MTOP_STRING_DATA = {
  api: 'mtop.1688.mmga.offerdetail.service',
  v: '4.0',
  ret: ['SUCCESS::调用成功'],
  traceId: 'abc123',
  data: JSON.stringify(SKU_INNER),
  retCode: '0',
}

console.log('\n[① 字符串 data 解包后，SKU 容器能被找到]')
{
  const FF = makeSandbox()
  const expanded = FF.expandJsonStrings(JSON.parse(JSON.stringify(MTOP_STRING_DATA)))
  t('data 从字符串变成对象', typeof expanded.data === 'object', typeof expanded.data)
  t('内层 data 也在', !!expanded.data && !!expanded.data.data, JSON.stringify(Object.keys(expanded || {})))
  const sku = expanded.data && expanded.data.data && expanded.data.data.skuModel
  t('skuModel 解出来了', !!sku, JSON.stringify(expanded.data && Object.keys(expanded.data)))
  t('skuList 有 2 条', sku && sku.skuList && sku.skuList.length === 2, JSON.stringify(sku && sku.skuList))
  t('props 有 2 个', sku && sku.skuBaseInfo && sku.skuBaseInfo.props.length === 2, JSON.stringify(sku && sku.skuBaseInfo))
}

console.log('\n[② 对照组：不解包就找不到 SKU]')
{
  const FF = makeSandbox()
  const raw = JSON.parse(JSON.stringify(MTOP_STRING_DATA))
  // 模拟旧的 walk：只处理 object，字符串直接跳过
  let found = null
  const walkOld = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 14) return
    if (Array.isArray(node)) { for (const i of node) walkOld(i, depth + 1); return }
    for (const k of Object.keys(node)) {
      if (k === 'skuModel') { found = node[k]; return }
      walkOld(node[k], depth + 1)
    }
  }
  walkOld(raw)
  t('★ 不解包 → 找不到 skuModel', found === null, JSON.stringify(found))
}

console.log('\n[③ 普通文本不会被误解]')
{
  const FF = makeSandbox()
  const o = FF.expandJsonStrings({
    title: '韩系发夹',
    desc: '这不是 JSON',
    num: '123',
    url: 'https://cbu01.alicdn.com/x.jpg',
    json: '{"a":1}',
    arr: '[1,2,3]',
  })
  t('title 原样', o.title === '韩系发夹', o.title)
  t('desc 原样', o.desc === '这不是 JSON', o.desc)
  t('num 原样', o.num === '123', o.num)
  t('url 原样', o.url === 'https://cbu01.alicdn.com/x.jpg', o.url)
  t('json 字符串被解成对象', typeof o.json === 'object' && o.json.a === 1, typeof o.json)
  t('数组字符串被解成数组', Array.isArray(o.arr) && o.arr.length === 3, JSON.stringify(o.arr))
}

console.log('\n[④ 诊断输出带 url（能看到 mtop fields 分片）]')
{
  const FF = makeSandbox()
  const url = 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?jsv=2.7&data=%7B%22fields%22%3A%22skuModel%22%7D&sign=xxx'
  const st = FF.dumpVariants([
    { url, data: FF.expandJsonStrings(JSON.parse(JSON.stringify(MTOP_STRING_DATA))) },
  ])
  const p0 = st.payloads[0]
  t('payload 里有 url', typeof p0.url === 'string' && p0.url.length > 0, JSON.stringify(p0.url))
  t('url 里能看到 fields 分片参数', p0.url.includes('fields'), p0.url.slice(0, 120))
  t('api 名正确', p0.api === 'mtop.1688.mmga.offerdetail.service', p0.api)
  t('★ variantKeyUnion 里有 skuModel', (st.variantKeyUnion || []).includes('skuModel'), JSON.stringify(st.variantKeyUnion))
}

console.log('\n[⑤ 诊断输出带每层的 keys]')
{
  const FF = makeSandbox()
  const st = FF.dumpVariants([
    { url: 'https://h5api.m.1688.com/x?api=mtop.1688.mmga.offerdetail.service', data: FF.expandJsonStrings(JSON.parse(JSON.stringify(MTOP_STRING_DATA))) },
  ])
  const p0 = st.payloads[0]
  t('layers 有多层', Array.isArray(p0.layers) && p0.layers.length >= 2, JSON.stringify(p0.layers && p0.layers.map(l => l.path)))
  t('第 1 层是信封', p0.layers[0].keys.includes('api') && p0.layers[0].keys.includes('traceId'), JSON.stringify(p0.layers[0]))
  const last = p0.layers[p0.layers.length - 1]
  t('最后一层能看到 skuModel', last.keys.includes('skuModel'), JSON.stringify(last))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
