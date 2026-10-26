/* 图片出口层归一化测试（lib/imgProxy.ts）
 *
 * 之前踩的坑：只改了「写入路径」（采集/发布/编辑），
 * 但 **读取出口**（withProxiedImages / withProxiedVariantImages）没归一化
 * → 前台拿到的变体图一直是 80x80 的 _sum。
 *
 * 所以出口层也必须归一化 —— 这是「读取时兜底」，历史数据不用重刷也生效。
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

const proxySrc = transform(
  fs.readFileSync(path.join(ROOT, 'lib', 'imgProxy.ts'), 'utf8'),
  { transforms: ['typescript', 'imports'] }
).code
const mod = { exports: {} }
new Function('module', 'exports', 'require', proxySrc)(mod, mod.exports, req)
const { withProxiedImages, withProxiedVariantImages } = mod.exports

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

const SUM = 'https://cbu01.alicdn.com/img/ibank/O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib.jpg_sum.jpg'
const ORIG = 'https://cbu01.alicdn.com/img/ibank/O1CN013HiT1U2Gvmd6BcB0m_!!2222432059078-0-cib.jpg'

console.log('\n[变体图出口] withProxiedVariantImages')
{
  const out = withProxiedVariantImages([{ id: 'v1', name: '颜色', value: '白', image: SUM }])
  const img = out[0].image
  t('不再含 _sum', !/_sum/.test(img), img)
  t('含原图文件名', img.includes('O1CN013HiT1U2Gvmd6BcB0m'), img)
  t('仍是代理 URL', img.startsWith('/api/img?u='), img)
  t('代理 URL 里解出来是原图', decodeURIComponent(img.split('u=')[1] || '') === ORIG, decodeURIComponent(img.split('u=')[1] || ''))
}

console.log('\n[商品图出口] withProxiedImages')
{
  const out = withProxiedImages({ images: JSON.stringify([SUM, ORIG]) })
  t('输出仍是 JSON 字符串（保持 API 契约）', typeof out.images === 'string', typeof out.images)
  const arr = JSON.parse(out.images)
  t('images 不含 _sum', !/_sum/.test(out.images), out.images)
  t('两张都归一化成原图代理', arr.length === 2 && arr.every(x => !/_sum/.test(x)), out.images)
  t('代理 URL 解出来是原图', decodeURIComponent((arr[0] || '').split('u=')[1] || '') === ORIG, arr[0])
}

console.log('\n[数组形态的 images]')
{
  const out = withProxiedImages({ images: [SUM] })
  t('数组形态也归一化', !/_sum/.test(JSON.stringify(out.images)), JSON.stringify(out.images))
  t('数组形态保持数组', Array.isArray(out.images), typeof out.images)
}

console.log('\n[不能弄坏的]')
{
  const out = withProxiedVariantImages([{ id: 'v1', image: '/uploads/local.jpg' }])
  t('站内图片保持不变', out[0].image === '/uploads/local.jpg', out[0].image)
  const out2 = withProxiedVariantImages([{ id: 'v1' }])
  t('没有 image 字段不报错', out2[0].image === undefined, out2[0].image)
  const out3 = withProxiedImages({ images: 'https://i.ibb.co/x/y.webp' })
  t('非阿里图床保持不变', out3.images === 'https://i.ibb.co/x/y.webp', out3.images)
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
