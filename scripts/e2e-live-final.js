/* 用「线上下载的真实 core」跑真实采集数据 → 推线上，验证 403 消失且无 PII */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const nodeFetch = globalThis.fetch
const CORE_PATH = process.argv[2] || '/tmp/live-core.js'
const code = fs.readFileSync(CORE_PATH, 'utf8')

const win = {
  addEventListener() {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: { appendChild() {} },
    body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    addEventListener() {},
  },
  location: { href: 'https://detail.1688.com/offer/1050723330804.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: (...a) => nodeFetch(...a),
  console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win
win.self = win
win.globalThis = win
const sandbox = vm.createContext(win)
vm.runInContext(code, sandbox, { filename: CORE_PATH })
const FF = win.FF1688

function mtopUrl(api, t, sign) {
  return '//h5api.m.1688.com/h5/' + api + '/1.0/?jsv=2.7.4&appKey=12574478&t=' + t +
    '&sign=' + sign + '&_bx-login=new&api=' + api + '&v=1.0&type=originaljson&timeout=20000&dataType=jsonp'
}

const captured = []

captured.push({
  url: mtopUrl('mtop.1688.moga.pc.shopcard', '1792816853421', '7933058490d8703a94e3b436ec41f72f'),
  data: {
    api: 'mtop.1688.moga.pc.shopcard',
    data: { model: { shopName: '义乌市尚芊饰日用百货有限公司', mainCategoryName: '项饰' } },
    ret: ['SUCCESS'],
    traceId: 'x',
    v: '1.0',
  },
})

captured.push({
  url: mtopUrl('mtop.1688.trade.receiveaddress.queryReceiveAddresses', '1792816853764', 'bc99931ac964cc4391818df5e54869e9'),
  data: {
    api: 'mtop.1688.trade.receiveaddress.queryReceiveAddresses',
    data: {
      model: {
        addressItems: [
          { address: '樊村98幢1单元303室', fullName: '崔元峰', mobilePhone: '13646898964', addressCodeText: '浙江省 金华市 义乌市' },
          { address: '永胜小区115栋3单元302', fullName: '李玲玉', mobilePhone: '13676845083' },
        ],
      },
    },
    ret: ['SUCCESS'],
    traceId: 'x',
    v: '1.0',
  },
})

captured.push({
  url: mtopUrl('mtop.1688.mmga.offerdetail.service', '1792816854475', 'c4d858cd72cf9269090f498550a9af6d'),
  data: {
    api: 'mtop.1688.mmga.offerdetail.service',
    data: {
      data: {
        priceInfoList: [{ preText: '2件起批', price: '2.5', text: '2.50' }],
        currentOffer: { price: 2.5, priceText: '¥2.5', title: '复古手链' },
      },
      success: true,
    },
    resultCode: 'ok',
  },
  ret: ['SUCCESS'],
  traceId: 'x',
  v: '1.0',
})

for (let i = 0; i < 26; i++) {
  captured.push({
    url: mtopUrl('mtop.1688.mmga.offerdetail.service', '179281685' + (4400 + i), 'a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d' + i),
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: { data: { x: i }, success: true },
      resultCode: 'ok',
    },
    ret: ['SUCCESS'],
    traceId: 'x',
    v: '1.0',
  })
}

win.document.getElementById = id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(captured) } : null)
win.document.querySelector = sel => (/title/i.test(sel) ? { textContent: '复古手链 跨境爆款' } : null)

;(async () => {
  console.log('测试 core：', CORE_PATH)
  console.log('core 版本：', FF.__v)
  const { payload } = await FF.parseDetail()
  const rawStr = JSON.stringify(payload.raw || {})

  const checks = [
    ['raw 不含 sign=', !/sign=/.test(rawStr)],
    ['raw 不含 timeout=20000', !/timeout=20000/.test(rawStr)],
    ['raw 不含 mtop 签名时间戳', !/[?&]t=\d{13}/.test(rawStr)],
    ['raw 不含手机号', !/13646898964|13676845083/.test(rawStr)],
    ['raw 不含姓名', !/崔元峰|李玲玉/.test(rawStr)],
    ['raw 不含详细地址', !/樊村98幢|永胜小区/.test(rawStr)],
    ['raw 保留 api 名（诊断仍可用）', /mtop\.1688\.mmga\.offerdetail\.service/.test(rawStr)],
    ['价格取到 2.5', payload.priceMin === 2.5],
  ]
  let fail = 0
  for (const [n, ok] of checks) {
    console.log((ok ? '  ✓ ' : '  ✗ ') + n)
    if (!ok) fail++
  }

  console.log('\n→ 推线上')
  const r = await FF.push(payload, 'x.y.z', 'https://fiestaflare.com/api/import/1688')
  console.log('  线上状态码 =', r.status)
  console.log('  响应:', String(r.text || '').slice(0, 110).replace(/\n/g, ' '))
  if (r.status === 403) { console.log('  ✗ 仍被 WAF 拦'); fail++ }
  else console.log('  ✓ 未被 WAF 拦（已到达应用层）')

  console.log('\n' + (fail ? '失败 ' + fail : '全部通过'))
  process.exit(fail ? 1 : 0)
})()
