/* 真实下载测试：从 1688 CDN 下一张图到本地目录
 *
 * 验证：① 不带 Referer 能下到  ② 文件落地  ③ 尺寸是原图  ④ 幂等
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
const { downloadImageToLocal, resolveUploadDir, fallbackUploadDir } = mod.exports

/** 读 JPEG 宽高（读 SOF 标记，不装库） */
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue }
    const m = buf[i + 1]
    if (m === 0xc0 || m === 0xc1 || m === 0xc2 || m === 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
    const len = buf.readUInt16BE(i + 2)
    i += 2 + len
  }
  return null
}

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

;(async () => {
  const URL = 'https://cbu01.alicdn.com/img/ibank/O1CN01hFdePP2GvmcuAcz6P_!!2222432059078-0-cib.jpg'

  console.log('\n[真实下载]')
  const local = await downloadImageToLocal(URL)
  console.log('  返回:', local)
  t('下载成功', !!local && local.startsWith('/api/uploads/'), String(local))

  if (local) {
    const filename = local.replace('/api/uploads/', '')
    // 可能落在持久目录，也可能回退到 public/uploads（取决于权限）
    const candidates = [
      path.join(resolveUploadDir(), filename),
      path.join(fallbackUploadDir(), filename),
    ]
    const filepath = candidates.find(p => fs.existsSync(p)) || candidates[0]
    console.log('  落地位置:', filepath)
    t('文件已落地', fs.existsSync(filepath), candidates.join(' | '))
    if (fs.existsSync(filepath)) {
      const buf = fs.readFileSync(filepath)
      console.log('  文件大小:', buf.length, '字节')
      const size = jpegSize(buf)
      console.log('  尺寸:', size ? size.w + 'x' + size.h : '?')
      t('是有效 JPEG', !!size)
      t('尺寸 ≥ 400（不是缩略图）', !!size && size.w >= 400 && size.h >= 400, size ? size.w + 'x' + size.h : '?')
      t('文件 > 10KB', buf.length > 10000, buf.length)
    }

    console.log('\n[幂等] 再次下载 → 同一个文件名，不重复下')
    const again = await downloadImageToLocal(URL)
    t('文件名相同', again === local, `${again} vs ${local}`)
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
