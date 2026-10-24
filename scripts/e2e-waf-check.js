/**
 * 端到端验证：用「构建后的真实 core」里的消毒逻辑处理 payload，
 * 再打到线上 /api/import/1688，确认不再被 Hostinger 边缘层 WAF 拦成 403。
 *
 * 用法：node scripts/e2e-waf-check.js
 */
const fs = require('fs')
const vm = require('vm')
const { execFileSync } = require('child_process')

const CORE = fs.readFileSync(
  require('path').join(__dirname, '..', 'public', '1688-core.js'),
  'utf8'
)

const sb = {
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
sb.window = sb
sb.location = { href: 'https://detail.1688.com/offer/1053022605528.html' }
sb.fetch = async () => {
  throw new Error('不应走 fetch')
}
vm.createContext(sb)
vm.runInContext(CORE, sb)

let sent = ''
sb.GM_xmlhttpRequest = function (opts) {
  sent = opts.data
  const r = { status: 200, responseText: '{"success":true,"imported":1}', responseHeaders: 'server: hcdn\n' }
  if (opts && typeof opts.onload === 'function') opts.onload(r)
}

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: 'ADMIN', exp: 4102444800 }) + '.sig'

const nasty =
  '<div style="width:790px"><script type="text/javascript">var _u=[];</script>' +
  '<img src="https://cbu01.alicdn.com/img/ibank/O1CN01.jpg"/>' +
  '<a href="javascript:void(0)" onclick="doIt()">查看详情</a>' +
  '<iframe src="//ad"></iframe><img src="../../img/bg.jpg" onerror="retry()">' +
  ' union select 1,2,3 -- eval( ) /etc/passwd </div>'

const payload = {
  sourceId: '1053022605528',
  title: '欧美网纱头饰羽毛头花欧根纱礼帽头饰',
  description: nasty,
  images: ['https://cbu01.alicdn.com/img/ibank/O1CN014sgiPB1lqyNV9AuFC_!!2222492064871-0-cib.jpg'],
}

;(async () => {
  await sb.FF1688.push(payload, token, 'https://fiestaflare.com')
  fs.writeFileSync('/tmp/e2e_body.json', sent)
  console.log('已生成真实推送正文，长度', sent.length)

  const status = execFileSync('curl', [
    '-s', '-m', '40', '-D', '/tmp/e2e_hdr.txt', '-o', '/tmp/e2e_body.txt', '-w', '%{http_code}',
    '-X', 'POST', 'https://fiestaflare.com/api/import/1688',
    '-H', 'Content-Type: application/json',
    '-H', 'Authorization: Bearer ' + token,
    '--data-binary', '@/tmp/e2e_body.json',
  ]).toString().trim()

  const hdr = fs.readFileSync('/tmp/e2e_hdr.txt', 'utf8')
  const app = /x-ff-origin:\s*app/i.test(hdr)
  console.log('线上状态:', status, ' 应用层=', app)
  console.log('正文:', fs.readFileSync('/tmp/e2e_body.txt', 'utf8').slice(0, 160))
  if (status === '403') {
    console.log('\n❌ 仍被边缘层 WAF 拦截')
    process.exit(1)
  }
  console.log('\n✅ 通过边缘层，请求已到达应用（' + status + '）')
})()
