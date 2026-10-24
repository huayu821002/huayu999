/* 打印「当前线上 core 实际会发什么给服务器」，字段级透明化 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = process.argv[2] || path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

const win = {
  addEventListener() {},
  document: {
    getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    documentElement: { appendChild() {} }, body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
  },
  location: { href: 'https://detail.1688.com/offer/1050723330804.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ json: async () => ({}), text: async () => '' }),
  console: { log() {}, warn() {}, error() {}, info() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win; win.self = win; win.globalThis = win
const sandbox = vm.createContext(win)
vm.runInContext(code, sandbox, { filename: CORE })
const FF = win.FF1688

function mtopUrl(api, t, sign) {
  return '//h5api.m.1688.com/h5/' + api + '/1.0/?jsv=2.7.4&appKey=12574478&t=' + t +
    '&sign=' + sign + '&_bx-login=new&api=' + api + '&v=1.0&type=originaljson&timeout=20000&dataType=jsonp'
}

// 模拟一个「页面会返回的一切」，含地址簿、账号信息、评价图等非商品内容
const captured = [
  {
    url: mtopUrl('mtop.1688.moga.pc.shopcard', '1792816853421', '7933058490d8703a94e3b436ec41f72f'),
    data: { api: 'mtop.1688.moga.pc.shopcard', data: { model: { shopName: '义乌市尚芊饰日用百货有限公司', qualitySatisfactionRate: '99.8%' } }, ret: ['SUCCESS'], traceId: 'x', v: '1.0' },
  },
  {
    url: mtopUrl('mtop.1688.trade.receiveaddress.queryReceiveAddresses', '1792816853764', 'bc99931ac964cc4391818df5e54869e9'),
    data: { api: 'mtop.1688.trade.receiveaddress.queryReceiveAddresses', data: { model: { addressItems: [
      { address: '樊村98幢1单元303室', fullName: '崔元峰', mobilePhone: '13646898964', addressCodeText: '浙江省 金华市 义乌市' },
      { address: '永胜小区115栋3单元302', fullName: '李玲玉', mobilePhone: '13676845083' },
      { address: '义乌市飞凤路36号', fullName: '崔先生', mobilePhone: '13646898964' },
      { address: '大江东产业聚集区 纬二路88号-杭州2仓 (杭州2仓6304)', fullName: '庄薇转嘉云(杭州2仓6304)', mobilePhone: '19883152794', phone: '0571-22896626' },
    ] } }, ret: ['SUCCESS'], traceId: 'x', v: '1.0' },
  },
  {
    url: mtopUrl('mtop.1688.mmga.offerdetail.service', '1792816854475', 'c4d858cd72cf9269090f498550a9af6d'),
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        data: {
          priceInfoList: [{ preText: '2件起批', price: '2.5', text: '2.50' }],
          currentOffer: { price: 2.5, priceText: '¥2.5', title: '复古手链' },
          offerImgList: [{ url: 'https://cbu01.alicdn.com/img/ibank/O1CN01jq7Xoa1kCNfQ9A7Sj_!!2219520374647-0-cib.jpg' }],
          offerDecisionAttrs: [{ property: '材质', value: '网纱' }],
        },
        success: true,
      },
      resultCode: 'ok',
    },
    ret: ['SUCCESS'],
    traceId: 'x',
    v: '1.0',
  },
  {
    url: mtopUrl('mtop.user.getUserSimple', '1792816854500', 'aa11bb22cc33dd44ee55ff6600112233'),
    data: {
      api: 'mtop.user.getUserSimple',
      data: {
        user: {
          loginId: 'cuimengke',
          nick: '崔先生',
          mobile: '13646898964',
          email: 'cuimengke@xx.com',
          realName: '崔元峰',
        },
      },
      ret: ['SUCCESS'],
      traceId: 'x',
      v: '1.0',
    },
  },
  {
    url: mtopUrl('mtop.1688.mmga.offerdetail.service', '1792816854600', 'bb22cc33dd44ee55ff66001122334455'),
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        data: {
          reviewImages: [{ url: 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg' }],
          priceInfoList: [{ preText: '2件起批', price: '2.5', text: '2.50' }],
        },
        success: true,
      },
      resultCode: 'ok',
    },
    ret: ['SUCCESS'],
    traceId: 'x',
    v: '1.0',
  },
]

win.document.getElementById = id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(captured) } : null)
win.document.querySelector = sel => (/title/i.test(sel) ? { textContent: '复古手链 跨境爆款' } : null)
win.document.querySelectorAll = () => []

;(async () => {
  const { payload } = await FF.parseDetail()
  const body = JSON.stringify(payload)

  console.log('=== 会发给服务器的顶层字段 ===')
  console.log(Object.keys(payload).sort().join(', '))
  console.log('')
  console.log('=== raw（诊断用）里的字段 ===')
  console.log(Object.keys(payload.raw || {}).sort().join(', '))
  console.log('')

  console.log('=== 隐私扫描：这些敏感内容有没有混进去？ ===')
  const leak = [
    ['手机号 13646898964', /13646898964/],
    ['手机号 13676845083', /13676845083/],
    ['手机号 19883152794', /19883152794/],
    ['座机 0571-22896626', /0571-22896626/],
    ['姓名 崔元峰', /崔元峰/],
    ['姓名 李玲玉', /李玲玉/],
    ['姓名 崔先生', /崔先生/],
    ['邮箱', /cuimengke@/],
    ['详细住址 樊村98幢', /樊村98幢/],
    ['详细住址 永胜小区', /永胜小区/],
    ['详细住址 飞凤路', /飞凤路/],
    ['详细住址 杭州2仓', /杭州2仓/],
    ['账号 memberId b2b-', /b2b-\d+/],
    ['账号 loginId', /cuimengke/],
    ['评价图 -rate', /-0-rate\./],
  ]
  let bad = 0
  for (const [n, re] of leak) {
    const hit = re.test(body)
    if (hit) bad++
    console.log((hit ? '  ✗ 泄漏: ' : '  ✓ 未出现: ') + n)
  }

  console.log('')
  console.log('保留的商品信息：')
  console.log('  标题 =', payload.title)
  console.log('  价格 =', payload.priceMin, '~', payload.priceMax, '(' + (payload.raw || {}).priceWhy + ')')
  console.log('  主图 =', payload.mainImage)
  console.log('  供应商 =', payload.supplierName)
  console.log('')
  console.log(bad === 0 ? '结论：✅ 无任何隐私数据外发' : '结论：❌ 仍有 ' + bad + ' 项泄漏')
  process.exit(bad ? 1 : 0)
})()
