/* 面板布局 —— 无头 Chrome 实测（比字符串断言更可靠）
 *
 * 验证：
 *   ① 面板高度封顶，超长预览不撑高面板
 *   ② 展开下拉 + 滚动到底后，所有按钮仍可见（sticky 吸顶）
 *   ③ 长内容折叠在 <details> 下拉里
 *
 * 依赖：/usr/bin/google-chrome（用 --dump-dom + document.title 回传结果）
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome'
const COLLECTOR = path.join(__dirname, '..', 'public', '1688-collector.user.js')
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title></title>
<style>body{margin:0;height:3000px;font-family:sans-serif}</style></head>
<body><h1>fake 1688</h1><script src="inject.js"></script></body></html>`

function runCase(opts) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-panel-'))
  const htmlPath = path.join(profile, 'page.html')
  fs.writeFileSync(htmlPath, HTML)

  const collector = fs.readFileSync(COLLECTOR, 'utf8')
  const inject = `
(function(){
  var s = document.createElement('script');
  s.textContent = ${JSON.stringify(collector)};
  document.documentElement.appendChild(s);
  setTimeout(function(){
    try {
      var p = document.getElementById('ff1688-panel');
      if (!p) { document.title = 'NO_PANEL'; return; }
      var st = document.getElementById('ff-st');
      if (st) st.textContent = Array(${opts.repeat}).join('很长的采集内容ABCDEFG');
      var det = document.getElementById('ff-out');
      if (det && ${opts.open ? 'true' : 'false'}) det.open = true;
      var bd = p.querySelector('.bd');
      if (bd) bd.scrollTop = ${opts.scrollToBottom ? '99999' : '0'};
      setTimeout(function(){
        var r = p.getBoundingClientRect();
        var vh = window.innerHeight;
        var btns = Array.prototype.map.call(p.querySelectorAll('button'), function(b){
          var br = b.getBoundingClientRect();
          // display:none 的按钮（非 offer 页会隐藏推送/预览）不参与可见性统计
          var shown = b.offsetParent !== null || b.getClientRects().length > 0;
          return { t: b.textContent.trim(), top: Math.round(br.top), bottom: Math.round(br.bottom), shown: shown };
        });
        var shownBtns = btns.filter(function(b){ return b.shown; });
        var visible = shownBtns.filter(function(b){ return b.top >= 0 && b.bottom <= vh; }).length;
        document.title = JSON.stringify({
          vh: vh, panelH: Math.round(r.height), panelTop: Math.round(r.top),
          overflow: r.top < 0, btnTotal: btns.length, btnShown: shownBtns.length, btnVisible: visible,
          stLen: st ? st.textContent.length : 0,
          detailsOpen: det ? det.open : null
        });
      }, 300);
    } catch(e){ document.title = 'ERR:' + e.message; }
  }, 1500);
})();`
  fs.writeFileSync(path.join(profile, 'inject.js'), inject)

  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--allow-file-access-from-files',
    '--user-data-dir=' + profile,
    '--virtual-time-budget=8000',
  ]
  if (opts.windowSize) args.push('--window-size=' + opts.windowSize)
  args.push('--dump-dom', 'file://' + htmlPath)

  let dom = ''
  try {
    dom = execFileSync(CHROME, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    dom = (e.stdout || '') + '\n' + (e.stderr || '')
  }
  const m = dom.match(/<title>([\s\S]*?)<\/title>/)
  if (!m || !m[1].trim()) throw new Error('没拿到 title，DOM 前 600：\n' + dom.slice(0, 600))
  const raw = m[1].trim()
  try { return JSON.parse(raw) } catch (e) { throw new Error('title 不是 JSON: ' + raw.slice(0, 300)) }
}

let pass = 0, fail = 0
function t(name, ok, extra) {
  console.log((ok ? '  ✅' : '  ❌') + ' ' + name + (ok ? '' : '  ' + JSON.stringify(extra)))
  ok ? pass++ : fail++
}

if (!fs.existsSync(CHROME)) {
  console.log('⚠️ 找不到 Chrome（' + CHROME + '），跳过真实浏览器测试')
  process.exit(0)
}

console.log('\n[Chrome-1] 常规场景：超长预览内容（5000+ 字）')
{
  const d = runCase({ repeat: 400, open: false, scrollToBottom: false })
  console.log('  ', JSON.stringify(d))
  t('面板出现', d.btnTotal > 0, d)
  t('面板未超出视口', !d.overflow, d)
  t('面板高度 <= 视口', d.panelH <= d.vh, d)
  t('长内容 > 3000 字', d.stLen > 3000, d.stLen)
  t('长内容折进下拉且默认收起', d.hasDetails !== false && d.detailsOpen === false, d)
  t('所有按钮都在可视区', d.btnVisible === d.btnShown, d)
}

console.log('\n[Chrome-2] 极端场景：小视口(400px) + 展开下拉 + 滚到底')
{
  const d = runCase({ repeat: 900, open: true, scrollToBottom: true, windowSize: '500,400' })
  console.log('  ', JSON.stringify(d))
  t('下拉已展开', d.detailsOpen === true, d)
  t('内容超长（>7000 字）', d.stLen > 7000, d.stLen)
  t('面板未超出视口', !d.overflow, d)
  t('滚到底后按钮仍全部可见（sticky 吸顶）', d.btnVisible === d.btnShown, d)
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
