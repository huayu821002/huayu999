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

const build = (tplPath, outPath) => {
  const tpl = read(tplPath)
  if (!tpl.includes('/*__CORE__*/')) throw new Error('模板缺少 /*__CORE__*/ 占位: ' + tplPath)
  write(outPath, tpl.replace('/*__CORE__*/', coreTagged.trim()))
}

console.log('构建 1688 采集脚本：')
build('scripts/collector-template.user.js', 'scripts/1688-collector.user.js')
build('scripts/collector-template.user.js', 'public/1688-collector.user.js')
build('scripts/console-template.js', 'public/1688-console-snippet.js')
write('public/1688-core.js', coreTagged)
console.log('完成。')
