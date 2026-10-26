/* 出口层归一化 + 绝对本地图不被套代理 测试 */
const fs = require('fs')
const path = require('path')
const { transform } = require('sucrase')

const ROOT = path.join(__dirname, '..')
let currentDir = ROOT
const req = id => {
  let file = null
  if (id.startsWith('@/')) {
    file = path.join(ROOT, id.slice(2))
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + '.ts')) file += '.ts'
      else if (fs.existsSync(file + '/index.ts')) file += '/index.ts'
    }
  } else if (id.startsWith('.')) {
    file = path.resolve(currentDir, id)
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + '.ts')) file += '.ts'
      else if (fs.existsSync(file + '/index.ts')) file += '/index.ts'
    }
    if (!fs.existsSync(file)) return require(path.resolve(currentDir, id))
  } else {
    return require(id)
  }
  const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code
  const m = { exports: {} }
  const prev = currentDir
  currentDir = path.dirname(file)
  try {
    new Function('module', 'exports', 'require', code)(m, m.exports, req)
  } finally {
    currentDir = prev
  }
  return m.exports
}

const proxy = req('@/lib/imgProxy')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

console.log('\n[绝对本地图不被套代理]')
t('绝对 /api/uploads 原样',
  proxy.proxyImage('https://fiestaflare.com/api/uploads/abc.jpg') === 'https://fiestaflare.com/api/uploads/abc.jpg',
  proxy.proxyImage('https://fiestaflare.com/api/uploads/abc.jpg'))
t('www 域名原样',
  proxy.proxyImage('https://www.fiestaflare.com/api/uploads/abc.jpg') === 'https://www.fiestaflare.com/api/uploads/abc.jpg',
  proxy.proxyImage('https://www.fiestaflare.com/api/uploads/abc.jpg'))
t('绝对 /uploads 原样',
  proxy.proxyImage('https://fiestaflare.com/uploads/abc.jpg') === 'https://fiestaflare.com/uploads/abc.jpg',
  proxy.proxyImage('https://fiestaflare.com/uploads/abc.jpg'))
t('相对 /api/uploads 原样',
  proxy.proxyImage('/api/uploads/abc.jpg') === '/api/uploads/abc.jpg',
  proxy.proxyImage('/api/uploads/abc.jpg'))
t('别的主域 /api/uploads 仍会被代理（不豁免陌生站）',
  proxy.proxyImage('https://evil.com/api/uploads/abc.jpg').startsWith('/api/img?u=') ||
  proxy.proxyImage('https://evil.com/api/uploads/abc.jpg') === 'https://evil.com/api/uploads/abc.jpg',
  proxy.proxyImage('https://evil.com/api/uploads/abc.jpg'))

console.log('\n[CDN 图仍走代理]')
t('alicdn 被代理',
  proxy.proxyImage('https://cbu01.alicdn.com/img/ibank/x.jpg').startsWith('/api/img?u='),
  proxy.proxyImage('https://cbu01.alicdn.com/img/ibank/x.jpg'))
t('已代理的不套娃',
  proxy.proxyImage('/api/img?u=https%3A%2F%2Fcbu01.alicdn.com%2Fa.jpg') === '/api/img?u=https%3A%2F%2Fcbu01.alicdn.com%2Fa.jpg')

console.log('\n[unproxy 不动本地图]')
t('绝对本地图 unproxy 后不变',
  proxy.unproxyImage('https://fiestaflare.com/api/uploads/abc.jpg') === 'https://fiestaflare.com/api/uploads/abc.jpg',
  proxy.unproxyImage('https://fiestaflare.com/api/uploads/abc.jpg'))
t('代理地址 unproxy 回原图',
  proxy.unproxyImage('/api/img?u=https%3A%2F%2Fcbu01.alicdn.com%2Fa.jpg') === 'https://cbu01.alicdn.com/a.jpg',
  proxy.unproxyImage('/api/img?u=https%3A%2F%2Fcbu01.alicdn.com%2Fa.jpg'))

console.log('\n[withProxiedImages 保持 JSON 字符串契约]')
const out = proxy.withProxiedImages({ images: JSON.stringify(['https://cbu01.alicdn.com/img/ibank/x.jpg', 'https://fiestaflare.com/api/uploads/y.jpg']) })
t('返回字符串', typeof out.images === 'string', typeof out.images)
const arr = JSON.parse(out.images)
t('CDN 图被代理', arr[0].startsWith('/api/img?u='), arr[0])
t('本地图原样', arr[1] === 'https://fiestaflare.com/api/uploads/y.jpg', arr[1])

console.log('\n[withProxiedVariantImages]')
const vout = proxy.withProxiedVariantImages([
  { id: '1', name: 'Color', value: 'P064 Dark Gray', image: 'https://fiestaflare.com/api/uploads/v1.jpg' },
  { id: '2', name: 'Color', value: 'P064 Light Gray', image: 'https://cbu01.alicdn.com/img/ibank/v2.jpg' },
])
t('本地图变体原样', vout[0].image === 'https://fiestaflare.com/api/uploads/v1.jpg', vout[0].image)
t('CDN 变体图被代理', vout[1].image.startsWith('/api/img?u='), vout[1].image)

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
