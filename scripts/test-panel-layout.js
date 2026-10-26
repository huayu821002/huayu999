/* 面板布局回归测试：
 *   ① 面板高度封顶（max-height）→ 预览再长也不会把按钮顶出屏幕
 *   ② 按钮区 sticky 吸顶
 *   ③ 长内容折叠进 <details> 下拉
 *   ④ 存在常驻的迷你状态条（不展开也能看到状态）
 */
const fs = require('fs')
const p = '/home/admin/Fiestaflare/scripts/collector-template.user.js'
const src = fs.readFileSync(p, 'utf8')

const tests = [
  ['面板高度封顶（max-height:calc(100vh - 16px)）',
    src.includes('max-height:calc(100vh - 16px)')],
  ['面板是 flex 纵向布局（内容区可滚动）',
    src.includes('display:flex;flex-direction:column')],
  ['内容区 .bd 内部滚动',
    src.includes('#ff1688-panel .bd{padding:12px;overflow-y:auto')],
  ['内容区 min-height:0（flex 子项才能真正收缩）',
    src.includes('min-height:0')],
  ['按钮区 sticky 吸顶',
    src.includes('#ff1688-panel .btns{position:sticky')],
  ['长内容折叠进 details 下拉',
    src.includes('<details class="out" id="ff-out">') && src.includes('采集内容预览')],
  ['有常驻迷你状态条 #ff-mini',
    src.includes('id="ff-mini"')],
  ['长内容自动展开下拉',
    src.includes('if (out && s.length > 120) out.open = true')],
  ['诊断输出也会展开下拉（多处）',
    (src.match(/if \(out\) out\.open = true/g) || []).length >= 5],
  ['状态条截断（不超过 60 字）',
    src.includes("s.slice(0, 60) + '…'")],
  ['旧的无上限 max-height:260px 已去掉',
    !src.includes('max-height:260px')],
]

let pass = 0
for (const [name, ok] of tests) {
  console.log((ok ? '  ✅' : '  ❌') + ' ' + name)
  if (ok) pass++
}
console.log('\n通过 ' + pass + '/' + tests.length)
process.exit(pass === tests.length ? 0 : 1)
