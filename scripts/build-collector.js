/**
 * 构建 1688 采集脚本：把内核源码内联进两个分发文件
 *   scripts/1688-core.src.js  →  内联进  →
 *   scripts/1688-collector.user.js   （油猴）
 *   public/1688-console-snippet.js  （控制台）
 *   public/1688-collector.user.js   （站点下载）
 *   public/1688-core.js             （独立内核，供页面内注入/热更新）
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const write = (p, s) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true })
  fs.writeFileSync(path.join(root, p), s)
  console.log('  →', p, (s.length / 1024).toFixed(1) + 'KB')
}

const core = read('scripts/1688-core.src.js')
if (!core.includes('__FF1688_CORE__')) {
  // 给核心加个标记，热更新时好识别
  core.replace('(function () {', '(function () { /* __FF1688_CORE__ */')
}
const coreTagged = core.includes('__FF1688_CORE__')
  ? core
  : core.replace('(function () {', '(function () { /* __FF1688_CORE__ */')

// 内联内核自己的版本号（面板用它做「内核是否过旧」的基准）
const coreVer = (coreTagged.match(/__v:\s*'([\d.]+)'/) || [])[1] || '0.0.0'
// 内核重复注入守卫里的版本号，必须与 __v 一致，否则热更新会重复注入
const guardVer = (coreTagged.match(/window\.FF1688\.__v === '([\d.]+)'/) || [])[1]
if (guardVer && guardVer !== coreVer) {
  throw new Error(
    `内核版本不一致：__v=${coreVer} 但重复注入守卫写的是 ${guardVer}。` +
    '请同步 scripts/1688-core.src.js 里的两处版本号。'
  )
}

const build = (tplPath, outPath) => {
  const tpl = read(tplPath)
  if (!tpl.includes('/*__CORE__*/')) throw new Error('模板缺少 /*__CORE__*/ 占位: ' + tplPath)
  // 面板标题里的版本号自动取模板头部的 @version，避免「装了新版还显示 v2.1」
  const ver =
    (tpl.match(/@version\s+([\d.]+)/) || [])[1] ||
    (read('scripts/collector-template.user.js').match(/@version\s+([\d.]+)/) || [])[1] ||
    '0.0.0'
  const out = tpl
    .replace('/*__CORE__*/', coreTagged.trim())
    .replace(/__SCRIPT_VERSION__/g, ver)
    .replace(/__CORE_VERSION__/g, coreVer)
  write(outPath, out)
}

console.log('构建 1688 采集脚本：')
build('scripts/collector-template.user.js', 'scripts/1688-collector.user.js')
build('scripts/collector-template.user.js', 'public/1688-collector.user.js')
build('scripts/console-template.js', 'public/1688-console-snippet.js')
write('public/1688-core.js', coreTagged)
console.log('完成。')
