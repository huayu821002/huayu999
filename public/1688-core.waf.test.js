/**
 * 离线测试 1688-core.js 的「边缘层 WAF 消毒」逻辑
 *
 * 真实故障（2026-10-24，用户推送得到 403 Forbidden）：
 *   采集到的商品描述是一大段从 1688 页面复制的 HTML；当它同时含有
 *   <script> / javascript: / eval( / ../ / union select 等片段时，
 *   Hostinger 边缘层（hcdn，ModSecurity 异常分）会直接返回 403 Forbidden，
 *   text/plain，且不带 X-FF-Origin 头 —— 请求根本没到我们的应用。
 *
 *   本测试锁定：
 *   1) 可疑片段被中和（推出去的正文不再含这些模式）；
 *   2) 正常商品文案 / HTML 一字不改（不能误伤）。
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const CORE = fs.readFileSync(path.join(__dirname, '1688-core.js'), 'utf8')

const checks = []
const add = (name, ok) => checks.push([name, !!ok])

/** 造一个 sandbox，注入假的 GM_xmlhttpRequest（记录发出去的正文） */
function makeSandbox() {
  const sent = { body: '' }
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
      getElementById: () => null,
      createElement: () => ({ set textContent(v) {}, get textContent() { return '' } }),
      querySelector: () => null,
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
      documentElement: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
  }
  sandbox.window = sandbox
  sandbox.location = { href: 'https://detail.1688.com/offer/1053022605528.html' }
  sandbox.fetch = async () => {
    throw new Error('不应走 fetch')
  }
  sandbox.GM_xmlhttpRequest = function (opts) {
    sent.body = opts.data
    const r = { status: 200, responseText: '{"success":true,"imported":1}', responseHeaders: 'server: hcdn\n' }
    if (opts && typeof opts.onload === 'function') opts.onload(r)
  }
  vm.createContext(sandbox)
  vm.runInContext(CORE, sandbox)
  return { sandbox, sent }
}

function adminToken() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: 'ADMIN', exp: 4102444800 }) + '.sig'
}

;(async () => {
  /* ---------- 场景 1：可疑描述被中和 ---------- */
  const { sandbox, sent } = makeSandbox()
  const nasty =
    '<div><script>alert(1)</script> union select 1,2,3 -- eval( ) ../../etc/passwd ' +
    'javascript:alert(1) <img src=x onerror=alert(1)></div>'
  await sandbox.FF1688.push(
    { sourceId: '1053022605528', title: '测试商品', description: nasty },
    adminToken(),
    'https://fiestaflare.com'
  )
  const out = sent.body
  const low = out.toLowerCase()
  add('推出去的正文不再含 <script>', !/<script/i.test(out))
  add('推出去的正文不再含 javascript:', !/javascript\s*:/i.test(out))
  add('推出去的正文不再含 eval(', !/\beval\s*\(/i.test(out))
  add('推出去的正文不再含 ../../', !/\.\.\//.test(out))
  add('推出去的正文不再含 union select', !/union\s+(all\s+)?select/i.test(out))
  add('推出去的正文不再含 onerror=', !/\bonerror\s*=/i.test(out))
  add('商品标题仍完整', /测试商品/.test(out))
  add('sourceId 未被破坏', /1053022605528/.test(out))

  /* ---------- 场景 2：正常文案一字不改 ---------- */
  const KEEP = [
    '欧美网纱头饰羽毛头花欧根纱礼帽头饰赛马会复古走秀花朵发夹发饰',
    '<div style="width:790px"><img src="https://cbu01.alicdn.com/img/ibank/O1CN01.jpg"/></div>',
    '2件以上9元',
    '义乌市流雅饰品有限公司',
    '颜色:红色;规格:10个装',
    'https://detail.1688.com/offer/1053022605528.html',
    'Made in China, OEM/ODM welcome, MOQ 2 pieces',
    '<p>Party &amp; wedding headwear, feather flower hair clip.</p>',
    '<table border="1"><tr><td>Size</td><td>M</td></tr></table>',
    '产品名称：网纱头花  品牌：流雅  货号：LY-2024-001',
    'Free shipping for orders over 100 pcs, delivery in 7-15 days.',
    'Please select from our wide range of colors and sizes.',
    'Update your browser to the latest version for the best experience.',
  ]
  let unchanged = true
  for (const t of KEEP) {
    const { sandbox: sb2, sent: s2 } = makeSandbox()
    await sb2.FF1688.push({ sourceId: '1', title: 't', description: t }, adminToken(), 'https://fiestaflare.com')
    // 正文是 JSON 序列化过的，要先解析回来再比对（否则引号等会被转义）
    let got = ''
    try {
      const parsed = JSON.parse(s2.body)
      const item = parsed.items ? parsed.items[0] : parsed.data
      got = (item && item.description) || ''
    } catch (e) {
      got = '<JSON 解析失败>'
    }
    if (got !== t) {
      unchanged = false
      console.log('    被改动:\n      期望 ' + JSON.stringify(t) + '\n      实际 ' + JSON.stringify(got))
    }
  }
  add('正常商品文案/HTML 一字不改', unchanged)

  /* ---------- 场景 3：嵌套结构也被消毒 ---------- */
  const { sandbox: sb3, sent: s3 } = makeSandbox()
  await sb3.FF1688.push(
    {
      sourceId: '1',
      title: 't',
      raw: { snapshot: [{ note: '<script>alert(1)</script>' }] },
      skuPrices: [{ spec: '红色', note: 'eval(1)' }],
    },
    adminToken(),
    'https://fiestaflare.com'
  )
  add('嵌套字段也被消毒', !/<script/i.test(s3.body) && !/\beval\s*\(/i.test(s3.body))
  add('嵌套结构保留', /红色/.test(s3.body) && /snapshot/.test(s3.body))

  let pass = 0
  for (const [name, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
    if (ok) pass++
  }
  console.log('\nWAF 消毒测试通过 ' + pass + '/' + checks.length)
  process.exit(pass === checks.length ? 0 : 1)
})()
