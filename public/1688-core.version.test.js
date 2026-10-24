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
// （用括号配平来截取，不依赖缩进）
const start = TPL.indexOf('const cmpVer = (a, b) => {')
t('模板里存在 cmpVer', start >= 0)
if (start < 0) { console.log(`\n通过 ${pass} / 失败 ${fail}`); process.exit(1) }
const bodyStart = TPL.indexOf('{', start)
let depth = 0, end = bodyStart
for (let i = bodyStart; i < TPL.length; i++) {
  if (TPL[i] === '{') depth++
  else if (TPL[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
}
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

console.log('\n[2b] MIN_CORE 由构建注入，不写死')
t('模板里是占位符', /const MIN_CORE = '__CORE_VERSION__'/.test(TPL))
// 构建产物里必须已经被替换成真实版本号
// （只有油猴脚本带面板版本检查；控制台脚本没有这个检查，故只测油猴脚本）
for (const f of ['public/1688-collector.user.js']) {
  const built = fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
  const mv = (built.match(/const MIN_CORE = '([^']*)'/) || [])[1]
  const cv = (built.match(/__v:\s*'([\d.]+)'/) || [])[1]
  t(`${f}：MIN_CORE 已注入且不为空`, !!mv && mv !== '__CORE_VERSION__', mv)
  t(`${f}：MIN_CORE == 内联内核 __v`, mv === cv, `${mv} vs ${cv}`)
  t(`${f}：不会误报（当前内核不比基准旧）`, !mv || !cv || cmpVer(cv, mv) >= 0)
}

console.log('\n[3] 内核重复注入守卫的版本号与 __v 一致')
const CORE_SRC = fs.readFileSync(path.join(__dirname, '..', 'scripts', '1688-core.src.js'), 'utf8')
const guard = CORE_SRC.match(/window\.FF1688\.__v === '([\d.]+)'/)
const ver = CORE_SRC.match(/__v:\s*'([\d.]+)'/)
t('守卫版本号存在', !!guard)
t('守卫版本号 == __v', guard && ver && guard[1] === ver[1], guard && ver && `${guard[1]} vs ${ver[1]}`)

console.log('\n[4] 构建脚本会拦住版本漂移')
const BUILD = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-collector.js'), 'utf8')
t('构建脚本校验 guard 与 __v 一致', /guardVer\s*!==\s*coreVer/.test(BUILD) && /内核版本不一致/.test(BUILD))
t('构建脚本注入 __CORE_VERSION__', /__CORE_VERSION__/.test(BUILD))
t('模板里确实有 __CORE_VERSION__ 占位', /__CORE_VERSION__/.test(TPL))

console.log('\n[5] 提示框可关闭、且热更新后会自动撤销')
t('提示框有固定 id（避免重复弹多个）', /const NAG_ID = 'ff-core-nag'/.test(TPL))
t('提示框可点击关闭', /addEventListener\('click'/.test(TPL))
t('热更新后调用 refreshCoreVersion', /refreshCoreVersion\(\)/.test(TPL))
t('版本号不再陈旧（可刷新）', /function refreshCoreVersion\(\)/.test(TPL))
// boot() 里应调 refreshCoreVersion()，而不是自己再读一遍 __v
const bootBody = TPL.slice(TPL.indexOf('function boot()'))
t('boot() 调 refreshCoreVersion', /refreshCoreVersion\(\)/.test(bootBody))
t('读 __v 的地方只有一处（refreshCoreVersion 内）',
  (TPL.match(/window\.FF1688 && window\.FF1688\.__v/g) || []).length === 1)

console.log('\n--------------------------------')
console.log(`通过 ${pass} / 失败 ${fail}`)
