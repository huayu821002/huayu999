/**
 * 版本号比较的正确性。
 *
 * 背景（2026-10-24）：面板的「内核版本过旧」判断写成了 `v !== MIN_CORE`，
 * 结果从 core 3.6.0 起，页面上就一直在弹「内核版本过旧，请重装脚本」的假提示 ——
 * 用户用的是最新内核，却被告知内核太旧。
 *
 * 必须是**版本号比较**（4.0.0 > 3.5.0），而不是字符串不等。
 */
const fs = require('fs')
const path = require('path')

const TPL = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'collector-template.user.js'), 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

// 从模板里抽出 cmpVer 实现，保证测的就是线上那一份
const start = TPL.indexOf('const cmpVer = (a, b) => {')
t('模板里存在 cmpVer', start >= 0)
if (start < 0) { console.log(`\n通过 ${pass} / 失败 ${fail}`); process.exit(1) }
const end = TPL.indexOf('\n        }', start) + '\n        }'.length
const cmpVer = eval('(' + TPL.slice(start + 'const cmpVer = '.length, end).trim().replace(/;$/, '') + ')')

console.log('[1] 版本比较')
t('4.0.0 > 3.5.0', cmpVer('4.0.0', '3.5.0') > 0)
t('3.9.0 > 3.5.0', cmpVer('3.9.0', '3.5.0') > 0)
t('3.5.0 == 3.5.0', cmpVer('3.5.0', '3.5.0') === 0)
t('3.4.9 < 3.5.0', cmpVer('3.4.9', '3.5.0') < 0)
t('3.10.0 > 3.9.0', cmpVer('3.10.0', '3.9.0') > 0)
t('10.0.0 > 9.9.9', cmpVer('10.0.0', '9.9.9') > 0)
t('2.14.0 < 3.5.0', cmpVer('2.14.0', '3.5.0') < 0)
t('空版本不崩', cmpVer('', '3.5.0') < 0)

console.log('\n[2] 面板不再用 !== 判断')
// 只看代码行（排除注释里对这个写法的描述）
const codeLines = TPL.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
t('没有 `v !== MIN_CORE` 这种写法', !codeLines.some(l => /v\s*!==\s*MIN_CORE/.test(l)))
t('用了 cmpVer 判断', /cmpVer\(v, MIN_CORE\) < 0/.test(TPL))

console.log('\n[3] 内核重复注入守卫的版本号与 __v 一致')
const CORE_SRC = fs.readFileSync(path.join(__dirname, '..', 'scripts', '1688-core.src.js'), 'utf8')
const guard = CORE_SRC.match(/window\.FF1688\.__v === '([\d.]+)'/)
const ver = CORE_SRC.match(/__v:\s*'([\d.]+)'/)
t('守卫版本号存在', !!guard)
t('守卫版本号 == __v', guard && ver && guard[1] === ver[1], guard && ver && `${guard[1]} vs ${ver[1]}`)

console.log('\n--------------------------------')
console.log(`通过 ${pass} / 失败 ${fail}`)
