/* 重复对照：修复前/后 core 各推 N 次，统计 403 比例 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { execSync } = require('child_process')

const nodeFetch = globalThis.fetch
const REPO = path.join(__dirname, '..')
const N = Number(process.argv[2] || 4)

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
    console: { log() {}, warn() {}, error() {}, info() {} },
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
            { address: '樊村98幢1单元303室', fullName: '崔元峰', mobilePhone: '13646898964' },
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

  for (let i = 0; i < 26; i++) {
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

async function once(coreCode) {
  const win = makeWin()
  const sandbox = vm.createContext(win)
  vm.runInContext(coreCode, sandbox, { filename: 'core' })
  const FF = win.FF1688
  const captured = buildCaptured()
  win.document.getElementById = id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(captured) } : null)
  win.document.querySelector = sel => (/title/i.test(sel) ? { textContent: '复古手链' } : null)
  const { payload } = await FF.parseDetail()
  const r = await FF.push(payload, 'x.y.z', 'https://fiestaflare.com/api/import/1688')
  return r.status
}

;(async () => {
  const oldCore = execSync('git show f90baf5:public/1688-core.js', { cwd: REPO, maxBuffer: 20e6 }).toString()
  const newCore = fs.readFileSync(path.join(REPO, 'public', '1688-core.js'), 'utf8')

  let old403 = 0, new403 = 0
  console.log('轮次 | 修复前状态码 | 修复后状态码')
  for (let i = 0; i < N; i++) {
    const a = await once(oldCore)
    const b = await once(newCore)
    if (a === 403) old403++
    if (b === 403) new403++
    console.log('  %d  |     %s     |     %s', i + 1, a, b)
    await new Promise(r => setTimeout(r, 1200))
  }
  console.log('')
  console.log('修复前 403: %d/%d', old403, N)
  console.log('修复后 403: %d/%d', new403, N)
  process.exit(new403 === 0 ? 0 : 1)
})()
