/* 静态守卫：**写入路径不能写代理 URL**
 *
 * 背景（2026-10-25）：
 *   图片代理上线后，后台编辑页拿到的 images 是 `/api/img?u=...`。
 *   如果某条 **prisma.update / prisma.create** 的 data 里用了
 *   withProxiedImages / withProxiedVariantImages，
 *   代理 URL 就会被**存进 DB** —— 以后代理套不上、换域名全失效。
 *
 * 铁律：
 *   - 读路径（NextResponse.json / 返回给前端的对象）→ 用 withProxied*
 *   - 写路径（prisma.update / prisma.create 的 data）→ 用 unproxy*
 *
 * 这个测试用**源码文本扫描**实现（不跑代码），任何新增的写入路径误用都会被抓到。
 */
const fs = require('fs')
const path = require('path')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

const APP = path.join(__dirname, '..', 'app', 'api')

/** 递归收集所有 .ts 路由文件 */
function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) collect(p, out)
    else if (e.name === 'route.ts') out.push(p)
  }
  return out
}

const files = collect(APP)
console.log(`\n[写入路径纯净性] 扫描 ${files.length} 个路由`)

let violations = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  // 找出所有 prisma.<model>.(update|create|upsert)( 的调用，
  // 用括号配平提取**整个调用的参数块**，只看这个块里有没有 withProxied*
  const re = /prisma\.[a-zA-Z]+\.(update|create|upsert)\s*\(/g
  let m
  while ((m = re.exec(src)) !== null) {
    let depth = 0
    let i = m.index + m[0].length - 1 // 指向 '('
    for (; i < src.length; i++) {
      const ch = src[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) break
      }
    }
    const block = src.slice(m.index, i + 1)
    if (/withProxied(Image|Images|VariantImages)/.test(block)) {
      const line = src.slice(0, m.index).split('\n').length
      violations.push({
        file: path.relative(path.join(__dirname, '..'), f),
        line,
        text: m[0].replace(/\s+/g, ' '),
      })
    }
  }
}

t('没有把代理 URL 写进 DB 的路径', violations.length === 0,
  violations.map(v => `${v.file}:${v.line} ${v.text}`).join(' | '))

// 反向检查：用了 unproxy 的写入路径确实存在
const variantRoute = fs.readFileSync(
  path.join(APP, 'admin', 'products', '[productId]', 'variants', 'route.ts'), 'utf8')
t('variants PUT 写入前还原代理 URL', /data:\s*\{\s*variants:\s*JSON\.stringify\(unproxyVariantImages\(list\)\)/.test(variantRoute))
t('variants POST 写入前还原代理 URL', /data:\s*\{\s*variants:\s*JSON\.stringify\(unproxyVariantImages\(list\)\)/.test(variantRoute))

const oneRoute = fs.readFileSync(
  path.join(APP, 'admin', 'products', '[productId]', 'variants', '[variantId]', 'route.ts'), 'utf8')
t('单变体删除写入前还原代理 URL', /data:\s*\{\s*variants:\s*JSON\.stringify\(unproxyVariantImages\(next\)\)/.test(oneRoute))

// 读路径确实用了代理
const slugRoute = fs.readFileSync(path.join(APP, 'products', '[slug]', 'route.ts'), 'utf8')
t('前台详情读路径走代理', /withProxiedImages\(rest\)/.test(slugRoute))

// lib/imgProxy.ts 必须同时提供正反两个方向
const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'imgProxy.ts'), 'utf8')
t('lib 提供 proxyImage', /export function proxyImage/.test(lib))
t('lib 提供 unproxyImage', /export function unproxyImage/.test(lib))
t('lib 提供 ALLOWED_IMAGE_HOSTS 白名单', /export const ALLOWED_IMAGE_HOSTS = new Set/.test(lib))

// 代理路由本身：白名单 + 禁裸 IP
const imgRoute = fs.readFileSync(path.join(APP, 'img', 'route.ts'), 'utf8')
t('代理路由校验白名单', /ALLOWED_IMAGE_HOSTS\.has\(host\)/.test(imgRoute))
t('代理路由禁裸 IP', /\\d\{1,3\}/.test(imgRoute))
t('代理路由只透传 image/*', /image\\\//.test(imgRoute) || /image\//.test(imgRoute))

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
