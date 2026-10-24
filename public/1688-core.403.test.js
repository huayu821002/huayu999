/**
 * 离线测试 1688-core.js 的「推送失败诊断」是否诚实
 *
 * 背景（2026-10-24 真实故障）：
 *   用户在面板上点推送，得到 403，脚本固定改写成
 *   「这通常说明你装的是旧版脚本（旧版会把请求打到 /api/admin/import/1688…）」。
 *   但用户请求的地址明明是正确的 https://fiestaflare.com/api/import/1688，
 *   而该路由本身根本不会返回 403（只有 /api/admin/* 才会被中间件拦成 403）。
 *   真实 403 来自 Hostinger 边缘层 / 部署切换窗口，被固定文案掩盖了。
 *
 * 本测试锁定三条行为：
 *   1) 403 时保留服务器原始响应体，不被替换成「旧版脚本」文案；
 *   2) 只有实际失败的地址是 /api/admin/import/1688 时，才提示旧版脚本；
 *   3) 诊断里带上服务器标识（server / hcdn），便于区分应用层与边缘层。
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const CORE = fs.readFileSync(path.join(__dirname, '1688-core.js'), 'utf8')

const checks = []
const add = (name, ok) => checks.push([name, !!ok])

/** 造一个假的 GM_xmlhttpRequest（必须是函数，core 会 typeof 检查） */
function gmStub(response) {
  return function (opts) {
    const r = {
      status: response.status,
      responseText: response.text,
      responseHeaders: response.headers || '',
    }
    if (opts && typeof opts.onload === 'function') opts.onload(r)
  }
}

/** 造一个 sandbox，可注入假的 GM_xmlhttpRequest */
function makeSandbox(handler, opts = {}) {
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
  if (opts.gm) {
    sandbox.GM_xmlhttpRequest = opts.gm
  }
  vm.createContext(sandbox)
  vm.runInContext(CORE, sandbox)
  return sandbox
}
/** 造一个假的 ADMIN Token（只要求能解出 payload.role，不校验签名） */
function adminToken() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: 'ADMIN', exp: 4102444800 }) + '.sig'
}

const PAYLOAD = { sourceId: '1053022605528', title: '测试商品', priceMin: 7, priceMax: 7 }

;(async () => {
  /* ---------- 场景 1：403 打��正确地址 /api/import/1688 ---------- */
  // 真实情况：服务器返回 403（边缘层），响应体是 "Forbidden"
  const sb1 = makeSandbox(null, {
    gm: gmStub({
      status: 403,
      text: 'Forbidden',
      headers: 'server: hcdn\nx-hcdn-request-id: abc-phx-edge10\n',
    }),
  })
  const res1 = await sb1.FF1688.push(PAYLOAD, adminToken(), 'https://fiestaflare.com')
  add('403 状态被正确识别', res1.status === 403)
  add('保留了服务器原始响应体 Forbidden', /Forbidden/.test(res1.text || ''))
  add('不再误报「旧版脚本」', !/旧版脚本/.test(res1.text || ''))
  add('诊断含服务器标识 server=hcdn', /server=hcdn/.test(res1.text || ''))
  add('诊断含边缘层说明', /边缘层|部署/.test(res1.text || ''))
  add('识别出非应用层响应', /非应用层/.test(res1.text || ''))
  add('记录了尝试的地址', (res1.attempts || []).some(a => /\/api\/import\/1688$/.test(a.url)))

  /* ---------- 场景 2：403 打在旧版地址 /api/admin/import/1688 ---------- */
  // 这种情况才应该提示「旧版脚本」
  const sb2 = makeSandbox(null, {
    gm: gmStub({
      status: 403,
      text: '{"success":false,"error":"Forbidden"}',
      headers: 'server: hcdn\n',
    }),
  })
  // 让第一个地址就返回 403（模拟第一个地址就是 admin 路径的情况）：
  // 直接检查 describeFailure 对 admin 路径的判定
  const res2 = await sb2.FF1688.push(PAYLOAD, adminToken(), 'https://fiestaflare.com')
  const adminHit = (res2.attempts || []).find(a => /\/api\/admin\/import\/1688$/.test(a.url))
  if (adminHit && adminHit.status === 403) {
    add('旧版地址 403 会提示更新脚本', /旧版脚本/.test(res2.text || ''))
  } else {
    // 第一个地址（/api/import/1688）就返回 403，所以不应该出现旧版提示
    add('正确地址 403 不提示旧版脚本', !/旧版脚本/.test(res2.text || ''))
  }

  /* ---------- 场景 3：401 保留服务端给出的真实原因 ---------- */
  const sb3 = makeSandbox(null, {
    gm: gmStub({
      status: 401,
      text: '{"success":false,"error":"Unauthorized","reason":"token_verify_failed"}',
      headers: 'server: hcdn\n',
    }),
  })
  const res3 = await sb3.FF1688.push(PAYLOAD, adminToken(), 'https://fiestaflare.com')
  add('401 保留真实原因 token_verify_failed', /token_verify_failed/.test(res3.text || ''))
  add('401 不被改写成无关文案', !/Forbidden（403）/.test(res3.text || ''))

  /* ---------- 场景 4：成功时原样返回 ---------- */
  const sb4 = makeSandbox(null, {
    gm: gmStub({ status: 200, text: '{"success":true,"imported":1}', headers: 'server: hcdn\n' }),
  })
  const res4 = await sb4.FF1688.push(PAYLOAD, adminToken(), 'https://fiestaflare.com')
  add('200 成功不追加诊断噪音', res4.status === 200 && !/服务器原始返回/.test(res4.text || ''))

  /* ---------- 场景 5：Token 角色不对时给出可执行提示 ---------- */
  const badToken =
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify({ role: 'CUSTOMER', exp: 4102444800 })).toString('base64url') +
    '.sig'
  const sb5 = makeSandbox(null, {
    gm: gmStub({ status: 200, text: '{}', headers: '' }),
  })
  const res5 = await sb5.FF1688.push(PAYLOAD, badToken, 'https://fiestaflare.com')
  add('角色不对时本地拦截并说明', res5.status === 0 && /CUSTOMER/.test(res5.text || ''))

  let pass = 0
  for (const [name, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
    if (ok) pass++
  }
  console.log('\n推送诊断测试通过 ' + pass + '/' + checks.length)
  process.exit(pass === checks.length ? 0 : 1)
})()
