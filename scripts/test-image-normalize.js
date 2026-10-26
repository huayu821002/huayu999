/* 服务端图片归一化测试（lib/imageNormalize.ts）
 *
 * 真实实测（2026-10-26）：
 *   xxx.jpg_sum.jpg  →  80x80   1896 B
 *   xxx.jpg          → 800x800 87715 B
 */
const fs = require('fs')
const path = require('path')
const { transform } = require('sucrase')

const file = path.join(__dirname, '..', 'lib', 'imageNormalize.ts')
const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code

const mod = { exports: {} }
const fn = new Function('module', 'exports', 'require', code)
fn(mod, mod.exports, require)
const { normalizeAlibabaImage, normalizeAlibabaImageList, normalizeAlibabaImagesField } = mod.exports

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

const SUM = 'https://cbu01.alicdn.com/img/ibank/O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib.jpg_sum.jpg'
const ORIG = 'https://cbu01.alicdn.com/img/ibank/O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib.jpg'

console.log('\n[关键] _sum 缩略图 → 原图')
t('_sum.jpg → .jpg', normalizeAlibabaImage(SUM) === ORIG, normalizeAlibabaImage(SUM))
t('_sum 单独后缀也剥掉', normalizeAlibabaImage(ORIG + '_sum') === ORIG, normalizeAlibabaImage(ORIG + '_sum'))

console.log('\n[尺寸后缀]')
t('_100x100xz.jpg', normalizeAlibabaImage('https://cbu01.alicdn.com/img/ibank/a.jpg_100x100xz.jpg') === 'https://cbu01.alicdn.com/img/ibank/a.jpg')
t('_430x430.jpg', normalizeAlibabaImage('https://cbu01.alicdn.com/img/ibank/a.jpg_430x430.jpg') === 'https://cbu01.alicdn.com/img/ibank/a.jpg')
t('多层：_100x100xz.jpg_sum.jpg',
  normalizeAlibabaImage('https://cbu01.alicdn.com/img/ibank/a.jpg_100x100xz.jpg_sum.jpg') === 'https://cbu01.alicdn.com/img/ibank/a.jpg',
  normalizeAlibabaImage('https://cbu01.alicdn.com/img/ibank/a.jpg_100x100xz.jpg_sum.jpg'))

console.log('\n[query 参数] 阿里图床的 resize 参数要去掉')
t('?x-oss-process=image/resize 被去掉',
  normalizeAlibabaImage('https://cbu01.alicdn.com/img/ibank/a.jpg?x-oss-process=image/resize,w_200') === 'https://cbu01.alicdn.com/img/ibank/a.jpg',
  normalizeAlibabaImage('https://cbu01.alicdn.com/img/ibank/a.jpg?x-oss-process=image/resize,w_200'))

console.log('\n[不能弄坏的]')
t('原图 URL 不变', normalizeAlibabaImage(ORIG) === ORIG)
t('-rate 评价图不变',
  normalizeAlibabaImage('https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg')
    === 'https://img.alicdn.com/imgextra/i4/O1CN01FIszyXp3I1I37MRc_!!4611686018427386256-0-rate.jpg')
t('非阿里域名原样返回', normalizeAlibabaImage('https://i.ibb.co/FPBBvGL/c2ba97a1af00.webp') === 'https://i.ibb.co/FPBBvGL/c2ba97a1af00.webp')
t('站内 /uploads 原样返回', normalizeAlibabaImage('/uploads/abc.jpg') === '/uploads/abc.jpg')
t('空值返回空串', normalizeAlibabaImage('') === '')

console.log('\n[批量 / 字段]')
t('批量归一化', JSON.stringify(normalizeAlibabaImageList([SUM, ORIG])) === JSON.stringify([ORIG, ORIG]),
  JSON.stringify(normalizeAlibabaImageList([SUM, ORIG])))
t('JSON 字符串字段归一化',
  normalizeAlibabaImagesField(JSON.stringify([SUM])) === JSON.stringify([ORIG]),
  normalizeAlibabaImagesField(JSON.stringify([SUM])))
t('单张字段归一化', normalizeAlibabaImagesField(SUM) === ORIG, normalizeAlibabaImagesField(SUM))
t('null 保持 null', normalizeAlibabaImagesField(null) === null)

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
