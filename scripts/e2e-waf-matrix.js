/**
 * 用「构建后的真实 core」的消毒逻辑，把全部 WAF 触发样本打到线上，
 * 确认每一个都能穿过 Hostinger 边缘层（不再是 403）。
 */
const fs = require('fs')
const vm = require('vm')
const { execFileSync } = require('child_process')

const CORE = fs.readFileSync(
  require('path').join(__dirname, '..', 'public', '1688-core.js'),
  'utf8'
)

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
  '<script>alert(1)</script>',
  'union select 1,2,3',
  'eval(alert(1))',
  '../../etc/passwd',
  'javascript:alert(1)',
  "'; DROP TABLE users; --",
  '<img src=x onerror=alert(1)>',
  '<iframe src=//evil></iframe>',
  'document.cookie',
  'base64_decode(cGFzc3dk)',
  '/bin/sh -c id',
  'cmd.exe /c dir',
  '<svg/onload=alert(1)>',
  "1' OR '1'='1",
  'SELECT * FROM users WHERE 1=1',
  'INSERT INTO logs VALUES(1)',
  'UPDATE users SET admin=1',
  'DELETE FROM users',
  '<?php system($_GET["c"]); ?>',
  '<div><script>var a</script><a href="javascript:1">x</a><iframe src="//y"></iframe><img src="../../z.jpg" onerror="e()"> union select 1,2,3 eval( ) /etc/passwd</div>',
]

function post(body) {
  fs.writeFileSync('/tmp/waf_body.json', body)
  return execFileSync('curl', [
    '-s', '-m', '40', '-D', '/tmp/waf_hdr.txt', '-o', '/tmp/waf_out.txt', '-w', '%{http_code}',
    '-X', 'POST', 'https://fiestaflare.com/api/import/1688',
    '-H', 'Content-Type: application/json',
    '-H', 'Authorization: Bearer ' + token,
    '--data-binary', '@/tmp/waf_body.json',
  ]).toString().trim()
}

;(async () => {
  let bad = 0
  for (const t of TRIGGERS) {
    await sb.FF1688.push({ sourceId: '1', title: 't', description: t }, token, 'https://fiestaflare.com')
    const st = post(sent)
    const hdr = fs.readFileSync('/tmp/waf_hdr.txt', 'utf8')
    const app = /x-ff-origin:\s*app/i.test(hdr)
    const ok = st !== '403'
    if (!ok) bad++
    console.log('%s %-4s app=%-5s | %s', ok ? '✅' : '❌', st, app, t.slice(0, 58))
  }
  console.log('\n被边缘层拦截: %d / %d', bad, TRIGGERS.length)
  process.exit(bad ? 1 : 0)
})()
