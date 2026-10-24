/**
 * 用 jsdom 真实加载构建后的油猴脚本，验证：
 *  1) 面板能创建出来
 *  2) GM_* 缺失时也能降级工作
 *  3) 内核可用（window.FF1688 存在）
 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const script = fs.readFileSync(
  path.join(__dirname, '..', 'public', '1688-collector.user.js'),
  'utf8'
)

function run(withGM) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>
       <h1>模拟 1688 详情页</h1>
       <div class="offer-price">¥1.20-3.50</div>
     </body></html>`,
    { runScripts: 'dangerously', url: 'https://detail.1688.com/offer/1022060080982.html' }
  )
  const win = dom.window
  if (withGM) {
    win.GM_getValue = (k, d) => (win.localStorage.getItem(k) ?? d)
    win.GM_setValue = (k, v) => win.localStorage.setItem(k, v)
  }
  const el = win.document.createElement('script')
  el.textContent = script
  win.document.body.appendChild(el)

  return new Promise(resolve => {
    setTimeout(() => {
      const panel = win.document.getElementById('ff1688-panel')
      resolve({
        withGM,
        panelExists: !!panel,
        panelText: panel ? panel.textContent.slice(0, 60) : '',
        coreVersion: (win.FF1688 && win.FF1688.__v) || null,
        hasParseDetail: !!(win.FF1688 && typeof win.FF1688.parseDetail === 'function'),
        hasPush: !!(win.FF1688 && typeof win.FF1688.push === 'function'),
        errorBox: !!win.document.querySelector('div[style*="fee2e2"]'),
      })
    }, 400)
  })
}

;(async () => {
  const a = await run(true)
  const b = await run(false)
  const checks = [
    ['有 GM_* 时面板出现', a.panelExists],
    ['无 GM_* 时面板也出现', b.panelExists],
    ['内核已加载', /^\d+\.\d+\.\d+$/.test(a.coreVersion || '')],
    ['parseDetail 可用', a.hasParseDetail],
    ['push 可用', a.hasPush],
    ['无错误提示框', !a.errorBox && !b.errorBox],
  ]
  let pass = 0
  for (const [n, ok] of checks) {
    console.log((ok ? '  ✅' : '  ❌') + ' ' + n)
    if (ok) pass++
  }
  console.log('\n有 GM:', JSON.stringify(a))
  console.log('无 GM:', JSON.stringify(b))
  console.log('\n通过 ' + pass + '/' + checks.length)
  process.exit(pass === checks.length ? 0 : 1)
})()
