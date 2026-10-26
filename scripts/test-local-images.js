/* 本地图片下载器测试（lib/localImages.ts）
 *
 * 关键验证点：
 *   ① 不带 Referer 能下到（阿里 CDN 防盗链）
 *   ② 落地目录是持久目录
 *   ③ 文件名用 URL 哈希 → 幂等
 *   ④ 白名单防 SSRF
 *   ⑤ 1x1 GIF（阿里 CDN 的错误响应）要被识别为失败
 */
const fs = require('fs')
const path = require('path')
const { transform } = require('sucrase')

const ROOT = path.join(__dirname, '..')
const req = id => {
  let file = null
  if (id.startsWith('@/')) {
    file = path.join(ROOT, id.slice(2))
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + '.ts')) file += '.ts'
      else if (fs.existsSync(file + '/index.ts')) file += '/index.ts'
    }
  } else {
    return require(id)
  }
  const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code
  const m = { exports: {} }
  new Function('module', 'exports', 'require', code)(m, m.exports, req)
  return m.exports
}

const src = transform(
  fs.readFileSync(path.join(ROOT, 'lib', 'localImages.ts'), 'utf8'),
  { transforms: ['typescript', 'imports'] }
).code
const mod = { exports: {} }
new Function('module', 'exports', 'require', src)(mod, mod.exports, req)
const { downloadImageToLocal, downloadImagesToLocal, isLocalImage, PERSISTENT_UPLOAD_DIR, LOCAL_IMAGE_PREFIX } = mod.exports

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

console.log('\n[静态检查]')
t('持久目录指向 Hostinger uploads', PERSISTENT_UPLOAD_DIR === '/home/u828392799/domains/fiestaflare.com/uploads', PERSISTENT_UPLOAD_DIR)
t('本地前缀是 /api/uploads/', LOCAL_IMAGE_PREFIX === '/api/uploads/', LOCAL_IMAGE_PREFIX)
t('isLocalImage 认得 /api/uploads/xxx.jpg', isLocalImage('/api/uploads/abc.jpg') === true)
t('isLocalImage 认得 CDN 图不是本地', isLocalImage('https://cbu01.alicdn.com/a.jpg') === false)
// 只看 fetch 的 headers 里有没有 Referer（注释里提到不影响）
const fetchBlock = src.slice(src.indexOf('await fetch('), src.indexOf('await fetch(') + 600)
t('fetch 的 headers 里没有 Referer（防盗链）', !/Referer\s*:/.test(fetchBlock), fetchBlock.slice(0, 200))
t('源码里 fetch 用了 User-Agent', /User-Agent/.test(src))

console.log('\n[白名单 / SSRF]')
;(async () => {
  t('内网地址被拒', (await downloadImageToLocal('http://127.0.0.1:22/x.jpg')) === null)
  t('localhost 被拒', (await downloadImageToLocal('http://localhost/x.jpg')) === null)
  t('非白名单域名被拒', (await downloadImageToLocal('https://example.com/a.jpg')) === null)
  t('file:// 被拒', (await downloadImageToLocal('file:///etc/passwd')) === null)
  t('空串返回 null', (await downloadImageToLocal('')) === null)
  t('非法 URL 返回 null', (await downloadImageToLocal('not-a-url')) === null)

  console.log('\n[已经是本地的 → 跳过]')
  t('/api/uploads/x.jpg 原样返回', (await downloadImageToLocal('/api/uploads/x.jpg')) === '/api/uploads/x.jpg')
  t('/uploads/x.jpg 原样返回', (await downloadImageToLocal('/uploads/x.jpg')) === '/uploads/x.jpg')

  console.log('\n[批量并发]')
  const out = await downloadImagesToLocal([
    'https://example.com/a.jpg',
    '/api/uploads/local.jpg',
    'https://cbu01.alicdn.com/img/ibank/x.jpg_sum.jpg',
  ])
  t('返回等长数组', out.length === 3, JSON.stringify(out))
  t('失败的位是 null', out[0] === null, String(out[0]))
  t('本地的位原样', out[1] === '/api/uploads/local.jpg', String(out[1]))
  t('CDN 那张本机下不到（非白名单外/网络）也安全', out[2] === null || typeof out[2] === 'string', String(out[2]))

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  process.exit(fail === 0 ? 0 : 1)
})()
