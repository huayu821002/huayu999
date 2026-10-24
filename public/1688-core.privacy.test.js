/* 隐私脱敏 + WAF URL 脱敏 回归测试 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const SRC = path.join(__dirname, '..', 'scripts', '1688-core.src.js')
const code = fs.readFileSync(SRC, 'utf8')

// 造一个最小 window 环境
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
  location: { href: 'https://detail.1688.com/offer/1234567890.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ json: async () => ({}), text: async () => '' }),
  console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win
win.self = win
win.globalThis = win
const sandbox = vm.createContext(win)
try {
  vm.runInContext(code, sandbox, { filename: '1688-core.src.js' })
} catch (e) {
  console.error('加载 core 失败:', e.message)
  process.exit(1)
}

let pass = 0, fail = 0
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : '') }
}

/* ---------- 1. URL 脱敏 ---------- */
console.log('\n[1] scrubUrl —— 去掉 mtop 签名参数（WAF 403 根因）')
const FF = win.FF1688
// scrubUrl / scrubUrls 没有导出，直接测 push 里的效果更真实；这里用 parseDetail 间接验证。
// 但我们至少要验证「core 里不再出现带 sign= 的 raw URL」。

const RAW = `{"api":"mtop.1688.moga.pc.shopcard","data":{},"ret":["FAIL_SYS_TOKEN_EMPTY::令牌为空"],"traceId":"2150432d17928168528815382e11b3","v":"1.0"}`

/* ---------- 2. 采集端丢弃地址簿报文 ---------- */
console.log('\n[2] pushCapture 丢弃个人地址簿报文')
// 模拟：调用 install 后 hook 会拦截 fetch；这里直接检查 capture 结果
;(async () => {
  // 触发 install
  try { FF.install && FF.install() } catch (e) {}

  // 构造一个假的 fetch 拦截环境来验证 pushCapture 过滤
  // core 内部通过 STORE 保存，我们通过 capture() 读取
  const before = FF.capture().length

  // 手动模拟 hook 收到两个响应
  const fakeUrls = [
    'https://h5api.m.1688.com/h5/mtop.1688.trade.receiveaddress.queryReceiveAddresses/1.0/?api=mtop.1688.trade.receiveaddress.queryReceiveAddresses',
    'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
  ]
  const fakeData = { api: 'x', data: { model: { addressItems: [{ fullName: '崔元峰', mobilePhone: '13646898964', address: '樊村98幢1单元303室' }] } }, ret: ['SUCCESS'], traceId: 'x', v: '1.0' }

  // 通过 capture 元素模拟（core 会优先读 DOM 元素）
  win.document.getElementById = id =>
    id === 'ff1688-capture'
      ? { textContent: JSON.stringify(fakeUrls.map(u => ({ url: u, data: fakeData }))) }
      : null

  const got = FF.capture()
  t('capture 能读到报文（测试前提）', got.length === 2, got.length)

  /* ---------- 3. parseDetail 的 raw 不含签名参数 ---------- */
  console.log('\n[3] parseDetail 产出的 raw 不含 mtop 签名参数')
  // 给 parseDetail 造一个最小 DOM + 报文环境
  const elem = {
    textContent: JSON.stringify([
      {
        url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?jsv=2.7.4&appKey=12574478&t=1792816854472&sign=5b5b600a8b124647ead055d458b2b4bb&api=mtop.1688.mmga.offerdetail.service&v=1.0&type=originaljson&timeout=20000&dataType=jsonp',
        data: {
          api: 'mtop.1688.mmga.offerdetail.service',
          data: {
            data: {
              priceInfoList: [{ preText: '2件起批', price: '2.5', text: '2.50' }],
              currentOffer: { price: 2.5, priceText: '¥2.5', title: '手链' },
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
        url: 'https://h5api.m.1688.com/h5/mtop.1688.trade.receiveaddress.queryReceiveAddresses/1.0/?api=mtop.1688.trade.receiveaddress.queryReceiveAddresses',
        data: {
          api: 'mtop.1688.trade.receiveaddress.queryReceiveAddresses',
          data: { model: { addressItems: [{ fullName: '崔元峰', mobilePhone: '13646898964', address: '樊村98幢1单元303室' }] } },
          ret: ['SUCCESS'],
          traceId: 'x',
          v: '1.0',
        },
      },
    ]),
  }
  win.document.getElementById = id => (id === 'ff1688-capture' ? elem : null)
  win.document.querySelector = sel => {
    if (/title/i.test(sel)) return { textContent: '复古手链 跨境爆款' }
    return null
  }
  win.document.querySelectorAll = () => []

  let payload = null
  try {
    const r = await FF.parseDetail()
    payload = r.payload
  } catch (e) {
    t('parseDetail 执行成功', false, e.message)
  }

  if (payload) {
    const rawStr = JSON.stringify(payload.raw || {})
    t('raw 里不含 sign=（签名参数已脱敏）', !/sign=/i.test(rawStr))
    t('raw 里不含 timeout=20', !/timeout=20000/i.test(rawStr))
    t('raw 里不含裸 t= 时间戳参数', !/[?&]t=\d{13}/.test(rawStr))
    t('raw 里不含手机号', !/13646898964/.test(rawStr))
    t('raw 里不含真实姓名', !/崔元峰/.test(rawStr))
    t('raw 里不含详细地址', !/樊村98幢/.test(rawStr))
    t('raw 仍保留诊断用 api 名', /mtop\.1688\.mmga\.offerdetail\.service/.test(rawStr))
    t('raw 仍保留 priceWhy', typeof (payload.raw || {}).priceWhy === 'string')
    t('raw 仍保留 skuLikePaths', Array.isArray((payload.raw || {}).skuLikePaths))
    console.log('    priceMin =', payload.priceMin, ' priceWhy =', (payload.raw || {}).priceWhy)
  }

  /* ---------- 4. push 的隐私脱敏（服务端兜底之前） ---------- */
  console.log('\n[4] push 前脱敏：payload 不含 PII')
  // 直接测内部函数不可达，改为构造含 PII 的 payload 走 push（token 空会提前返回，不发请求）
  // 用一个假 token 让它真的发请求会污染线上；这里改为验证 sanitizePayloadForPrivacy 效果：
  // 通过 parseDetail 得到的 raw 已脱敏（上面已验证），再补一条：snapshot 内容脱敏
  if (payload) {
    const snap = (payload.raw || {}).snapshot || []
    t('snapshot 不含手机号', !snap.some(s => /13646898964/.test(JSON.stringify(s))))
    t('snapshot 不含真实姓名', !snap.some(s => /崔元峰/.test(JSON.stringify(s))))
  }

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
