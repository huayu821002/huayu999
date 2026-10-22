/** 验证 push 走 GM_xmlhttpRequest（模拟油猴环境） */
const fs = require('fs')
const { JSDOM } = require('/home/admin/Fiestaflare/node_modules/jsdom')
const script = fs.readFileSync(
  '/home/admin/Fiestaflare/public/1688-collector.user.js',
  'utf8'
)

const dom = new JSDOM(
  `<!doctype html><html><head></head><body><h1>1688</h1></body></html>`,
  { runScripts: 'dangerously', url: 'https://detail.1688.com/offer/1022060080982.html' }
)
const win = dom.window
win.GM_getValue = (k, d) => d
win.GM_setValue = () => {}
let gmCalled = null
win.GM_xmlhttpRequest = opts => {
  gmCalled = opts
  setTimeout(() => opts.onload({ status: 200, responseText: '{"success":true,"imported":1}' }), 10)
}
// 页面级 fetch 应该完全不被调用
win.fetch = async () => {
  throw new Error('fetch 不应被调用')
}
const el = win.document.createElement('script')
el.textContent = script
win.document.body.appendChild(el)

setTimeout(async () => {
  const r = await win.FF1688.push({ source: '1688', sourceId: '1', title: 't' }, 'tok')
  const checks = [
    ['使用了 GM_xmlhttpRequest', !!gmCalled],
    ['GM 请求地址正确', !!gmCalled && gmCalled.url === 'https://fiestaflare.com/api/import/1688'],
    ['带 Authorization 头', !!gmCalled && /Bearer tok/.test(gmCalled.headers.Authorization)],
    ['返回 200', r.status === 200],
    ['解析出 json', !!r.json && r.json.success === true],
  ]
  let pass = 0
  for (const [n, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + n)
    if (ok) pass++
  }
  console.log('\n通过 ' + pass + '/' + checks.length)
  process.exit(pass === checks.length ? 0 : 1)
}, 300)
