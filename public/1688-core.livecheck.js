/* 用线上下载回来的 user.js 做校验 */
const fs = require('fs')
const path = require('path')
const TPL = fs.readFileSync(process.argv[2] || '/tmp/live-usc.js', 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const codeLines = TPL.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
t('不再用 `v !== MIN_CORE`', !codeLines.some(l => /v\s*!==\s*MIN_CORE/.test(l)))
t('用了 cmpVer 版本比较', /cmpVer\(v, MIN_CORE\) < 0/.test(TPL))

const start = TPL.indexOf('const cmpVer = (a, b) => {')
const end = TPL.indexOf('\n        }', start) + '\n        }'.length
const cmpVer = eval('(' + TPL.slice(start + 'const cmpVer = '.length, end).trim().replace(/;$/, '') + ')')
console.log('\n  线上真实判定：')
for (const v of ['3.5.0', '3.9.0', '4.0.0', '3.4.0']) {
  const nag = v && cmpVer(v, '3.5.0') < 0
  console.log(`    内核 ${v} → ${nag ? '⚠ 弹「版本过旧」' : '✓ 不弹'}`)
  if (v === '3.9.0' || v === '4.0.0') t(`内核 ${v} 不应弹提示`, !nag)
}

const guard = TPL.match(/window\.FF1688\.__v === '([\d.]+)'/)
const ver = TPL.match(/__v:\s*'([\d.]+)'/)
t('内联内核是 4.0.0', ver && ver[1] === '4.0.0', ver && ver[1])
t('重复注入守卫与 __v 一致', guard && ver && guard[1] === ver[1], guard && `${guard[1]} vs ${ver && ver[1]}`)

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
