/** 控制台脚本 jsdom 冒烟测试 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const script = fs.readFileSync(
  path.join(__dirname, '..', 'public', '1688-console-snippet.js'),
  'utf8'
)

const dom = new JSDOM(
  `<!doctype html><html><head></head><body><h1>1688</h1></body></html>`,
  { runScripts: 'dangerously', url: 'https://detail.1688.com/offer/1022060080982.html' }
)
const win = dom.window
let promptValue = 'test-token'
win.prompt = () => promptValue
win.fetch = async () => ({ ok: true, status: 200, text: async () => '{}' })

const el = win.document.createElement('script')
el.textContent = script
win.document.body.appendChild(el)

setTimeout(() => {
  const ok = !!(win.FF1688 && typeof win.FF1688.parseDetail === 'function')
  console.log((ok ? '  ✅' : '  ❌') + ' 控制台脚本内联内核可用')
  console.log('  内核版本:', (win.FF1688 && win.FF1688.__v) || '无')
  process.exit(ok ? 0 : 1)
}, 500)
