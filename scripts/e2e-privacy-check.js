/* 用构建后的真实 core 跑完整推送链路，验证线上不再 403 + 不含 PII */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

const nodeFetch = globalThis.fetch
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
vm.runInContext(code, sandbox, { filename: '1688-core.js' })
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
          { address: '义乌市飞凤路36号', fullName: '崔先生', mobilePhone: '13646898964' },
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
        offerDecisionAttrs: [{ property: '材质', value: '网纱' }],
      },
      success: true,
    },
    resultCode: 'ok',
  },
  ret: ['SUCCESS'],
  traceId: 'x',
  v: '1.0',
})

captured.push({
  url: mtopUrl('mtop.1688.mmga.offerdetail.service', '1792816854477', 'bea1e475fe9b3f4d1a1c2e3f4a5b6c7d8'),
  data: {
    api: 'mtop.1688.mmga.offerdetail.service',
    data: {
      data: {
        currentOffer: { price: 2.5, priceText: '¥2.5', title: '复古手链' },
        offerList: [
          { offerId: '999', price: 21, priceText: '¥21', title: '别家手链', isCurrentOffer: false, offerUrl: '//x' },
        ],
      },
      success: true,
    },
    resultCode: 'ok',
  },
  ret: ['SUCCESS'],
  traceId: 'x',
  v: '1.0',
})

for (let i = 0; i < 20; i++) {
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
  const { payload } = await FF.parseDetail()
  console.log('采集结果:')
  console.log('  priceMin =', payload.priceMin, ' priceMax =', payload.priceMax)
  console.log('  priceWhy =', payload.raw && payload.raw.priceWhy)
  console.log('  raw 字节 =', JSON.stringify(payload.raw).length)

  const rawStr = JSON.stringify(payload.raw)
  const checks = [
    ['raw 不含 sign=', !/sign=/.test(rawStr)],
    ['raw 不含 timeout=20000', !/timeout=20000/.test(rawStr)],
    ['raw 不含 mtop 签名时间戳', !/[?&]t=\d{13}/.test(rawStr)],
    ['raw 不含手机号', !/13646898964|13676845083/.test(rawStr)],
    ['raw 不含姓名', !/崔元峰|李玲玉/.test(rawStr)],
    ['raw 不含详细地址', !/樊村98幢|永胜小区|飞凤路/.test(rawStr)],
    ['raw 保留 api 名', /mtop\.1688\.mmga\.offerdetail\.service/.test(rawStr)],
    ['价格取到 2.5', payload.priceMin === 2.5],
  ]
  let fail = 0
  for (const [n, ok] of checks) {
    console.log((ok ? '  ✓ ' : '  ✗ ') + n)
    if (!ok) fail++
  }

  console.log('\n→ 实推线上（应返回 401 token 校验失败，而不是 403）')
  const r = await FF.push(payload, 'x.y.z', 'https://fiestaflare.com/api/import/1688')
  console.log('  status =', r.status)
  console.log('  text   =', String(r.text || '').slice(0, 120))
  if (r.status === 403) {
    console.log('  ✗ 仍被 WAF 拦')
    fail++
  } else {
    console.log('  ✓ 未被 WAF 拦（请求到达应用层）')
  }

  console.log('\n' + (fail ? '失败 ' + fail : '全部通过'))
  process.exit(fail ? 1 : 0)
})()
