/* 对照实验：同一份 payload，用修复前/后的 core 各推一次线上 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { execSync } = require('child_process')

const nodeFetch = globalThis.fetch

function makeWin() {
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
  return win
}

function mtopUrl(api, t, sign) {
  return '//h5api.m.1688.com/h5/' + api + '/1.0/?jsv=2.7.4&appKey=12574478&t=' + t +
    '&sign=' + sign + '&_bx-login=new&api=' + api + '&v=1.0&type=originaljson&timeout=20000&dataType=jsonp'
}

function buildCaptured() {
  const c = []
  c.push({
    url: mtopUrl('mtop.1688.moga.pc.shopcard', '1792816853421', '7933058490d8703a94e3b436ec41f72f'),
    data: {
      api: 'mtop.1688.moga.pc.shopcard',
      data: { model: { shopName: '义乌市尚芊饰日用百货有限公司' } },
      ret: ['SUCCESS'],
      traceId: 'x',
      v: '1.0',
    },
  })
  c.push({
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
  c.push({
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
  for (let i = 0; i < 20; i++) {
    c.push({
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
  return c
}

async function run(label, coreCode) {
  const win = makeWin()
  const sandbox = vm.createContext(win)
  vm.runInContext(coreCode, sandbox, { filename: label })
  const FF = win.FF1688
  const captured = buildCaptured()
  win.document.getElementById = id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(captured) } : null)
  win.document.querySelector = sel => (/title/i.test(sel) ? { textContent: '复古手链' } : null)
  const { payload } = await FF.parseDetail()
  const rawStr = JSON.stringify(payload.raw || {})
  const r = await FF.push(payload, 'x.y.z', 'https://fiestaflare.com/api/import/1688')
  console.log('%s' % label)
  console.log('   线上状态码 = %s   %s', r.status, r.status === 403 ? '❌ 被 WAF 拦' : '✅ 通过')
  console.log('   含手机号 = %s   含详细地址 = %s   含 sign= = %s',
    /13646898964|13676845083/.test(rawStr),
    /樊村98幢|永胜小区/.test(rawStr),
    /sign=/.test(rawStr))
  console.log('')
  return r.status
}

;(async () => {
  const oldCore = execSync('git show f90baf5:public/1688-core.js', { cwd: path.join(__dirname, '..'), maxBuffer: 20e6 }).toString()
  const newCore = fs.readFileSync(path.join(__dirname, '..', 'public', '1688-core.js'), 'utf8')

  const s1 = await run('【修复前】core 3.5.0 (commit f90baf5)', oldCore)
  const s2 = await run('【修复后】core 3.6.0 (当前产物)', newCore)

  console.log('结论：', s1 === 403 && s2 !== 403 ? '✅ 修复有效（403 → ' + s2 + '）' : '⚠️ 需复查')
  process.exit(s1 === 403 && s2 !== 403 ? 0 : 1)
})()
