/**
 * 最终验证：直接用「线上下载的 core」跑一遍 WAF 触发矩阵，
 * 确认线上版本确实能穿过 Hostinger 边缘层。
 */
const fs = require('fs')
const vm = require('vm')
const { execFileSync } = require('child_process')

const CORE = execFileSync('curl', ['-s', '-m', '30', 'https://fiestaflare.com/1688-core.js']).toString()
console.log('线上 core 长度', CORE.length, ' 含消毒函数:', /sanitizeForWaf/.test(CORE))

const sb = {
  console, setTimeout, JSON, Math, Date, Number, parseFloat, parseInt,
  performance: { getEntriesByType: () => [] },
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  decodeURIComponent,
  document: {
    getElementById: () => null,
    createElement: () => ({ set textContent(v) {}, get textContent() { return '' } }),
    querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild: () => {} }, documentElement: { appendChild: () => {} }, body: { appendChild: () => {} },
  },
}
sb.window = sb
sb.location = { href: 'https://detail.1688.com/offer/1.html' }
sb.fetch = async () => { throw new Error('no') }
vm.createContext(sb)
vm.runInContext(CORE, sb)

let sent = ''
sb.GM_xmlhttpRequest = function (opts) {
  sent = opts.data
  const r = { status: 200, responseText: '{"success":true}', responseHeaders: '' }
  if (opts && typeof opts.onload === 'function') opts.onload(r)
}

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: 'ADMIN', exp: 4102444800 }) + '.sig'

const TRIGGERS = [
  '<script>alert(1)</script> union select 1,2,3 -- eval( ) ../../etc/passwd javascript:alert(1)',
  '<div><script>var a</script><a href="javascript:1">x</a><iframe src="//y"></iframe><img src="../../z.jpg" onerror="e()"> union select 1,2,3 eval( ) /etc/passwd</div>',
  "'; DROP TABLE users; --",
  'SELECT * FROM users WHERE 1=1',
  '<svg/onload=alert(1)>',
  'base64_decode(cGFzc3dk)',
]

;(async () => {
  let bad = 0
  for (const t of TRIGGERS) {
    await sb.FF1688.push({ sourceId: '1', title: 't', description: t }, token, 'https://fiestaflare.com')
    fs.writeFileSync('/tmp/live_body.json', sent)
    const st = execFileSync('curl', [
      '-s', '-m', '40', '-D', '/tmp/live_hdr.txt', '-o', '/tmp/live_out.txt', '-w', '%{http_code}',
      '-X', 'POST', 'https://fiestaflare.com/api/import/1688',
      '-H', 'Content-Type: application/json',
      '-H', 'Authorization: Bearer ' + token,
      '--data-binary', '@/tmp/live_body.json',
    ]).toString().trim()
    const hdr = fs.readFileSync('/tmp/live_hdr.txt', 'utf8')
    const app = /x-ff-origin:\s*app/i.test(hdr)
    if (st === '403') bad++
    console.log('%s %s app=%s | %s', st === '403' ? '❌' : '✅', st, app, t.slice(0, 50))
  }
  console.log('\n线上版本被边缘层拦截: %d / %d', bad, TRIGGERS.length)
  process.exit(bad ? 1 : 0)
})()
