/* 图片代理 + 采集品库批量删除 的单元测试（不碰生产库的部分） */
const fs = require('fs')
const path = require('path')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

/** 把 TS 模块转译成 CJS 并执行 */
function loadTs(file, mocks = {}) {
  const src = fs.readFileSync(file, 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  const req = id => (id in mocks ? mocks[id] : require(id))
  new Function('module', 'exports', 'require', js)(mod, mod.exports, req)
  return mod.exports
}

console.log('\n[图片代理 proxyImage]')
{
  const { proxyImage, proxyImagesField, withProxiedImages, withProxiedVariantImages,
          unproxyImage, unproxyImagesField, unproxyVariantImages } = loadTs(
    '/home/admin/Fiestaflare/lib/imgProxy.ts'
  )

  const CDN = 'https://cbu01.alicdn.com/img/ibank/O1CN01hmBSSK2GvmdFHSmjf_!!2222432059078-0-cib.jpg'
  const out = proxyImage(CDN)
  t('1688 CDN 图 → 代理 URL', out.startsWith('/api/img?u=') && out.includes(encodeURIComponent(CDN)), out)
  t('代理 URL 不套娃', proxyImage(out) === out)

  t('站内 /uploads 图原样返回', proxyImage('/uploads/a.jpg') === '/uploads/a.jpg')
  t('外站图原样返回', proxyImage('https://example.com/a.jpg') === 'https://example.com/a.jpg')
  t('非 http 协议原样返回', proxyImage('javascript:alert(1)') === 'javascript:alert(1)')
  t('空值返回空', proxyImage('') === '' && proxyImage(null) === '')

  // images 字段：JSON 字符串
  const j = proxyImagesField(JSON.stringify([CDN, '/uploads/x.jpg']))
  t('images JSON 字符串 → 代理后仍是字符串', typeof j === 'string' && j.includes('/api/img?u=') && j.includes('/uploads/x.jpg'), j)

  // images 字段：数组
  const arr = proxyImagesField([CDN])
  t('images 数组 → 代理后仍是数组', Array.isArray(arr) && arr[0].startsWith('/api/img?u='))

  // 逗号分隔
  const csv = proxyImagesField(CDN + ',' + CDN)
  t('images 逗号分隔 → 代理', typeof csv === 'string' && csv.split(',').length === 2 && csv.includes('/api/img?u='))

  // 解析不了的原样返回
  t('非法 JSON 原样返回', proxyImagesField('[not json') === '[not json')

  // 产品对象
  const p = withProxiedImages({ id: '1', images: JSON.stringify([CDN]), modelImage: CDN, sizeChart: '/uploads/s.jpg' })
  t('产品 images 走代理', p.images.includes('/api/img?u='))
  t('产品 modelImage 走代理', p.modelImage.startsWith('/api/img?u='))
  t('产品 sizeChart 站内图不动', p.sizeChart === '/uploads/s.jpg')
  t('其它字段不受影响', p.id === '1')

  // 变体
  const vs = withProxiedVariantImages([{ id: 'v1', image: CDN }, { id: 'v2', image: '' }])
  t('变体图走代理', vs[0].image.startsWith('/api/img?u='))
  t('变体空图保持空', vs[1].image === '')
  t('变体其它字段保留', vs[0].id === 'v1')
}

console.log('\n[反向还原 unproxy —— DB 只存原始 URL]')
{
  const { proxyImage, unproxyImage, unproxyImagesField, unproxyVariantImages } = loadTs(
    '/home/admin/Fiestaflare/lib/imgProxy.ts'
  )
  const CDN = 'https://cbu01.alicdn.com/img/ibank/O1CN01hmBSSK2GvmdFHSmjf_!!2222432059078-0-cib.jpg'
  const proxied = proxyImage(CDN)

  t('unproxy 还原回原始 URL', unproxyImage(proxied) === CDN, unproxyImage(proxied))
  t('unproxy 对原始 URL 无影响', unproxyImage(CDN) === CDN)
  t('unproxy 对站内图无影响', unproxyImage('/uploads/a.jpg') === '/uploads/a.jpg')
  t('unproxy 空值', unproxyImage('') === '')

  // 往返一致
  t('proxy → unproxy 往返一致', unproxyImage(proxyImage(CDN)) === CDN)

  // images 字段（JSON 字符串）
  const j = unproxyImagesField(JSON.stringify([proxied, '/uploads/x.jpg']))
  t('unproxy images JSON 字符串', typeof j === 'string' && j.includes(CDN) && j.includes('/uploads/x.jpg'), j)
  t('unproxy 后不再有 /api/img', !String(j).includes('/api/img'))

  // 数组
  const arr = unproxyImagesField([proxied])
  t('unproxy images 数组', Array.isArray(arr) && arr[0] === CDN)

  // 变体
  const vs = unproxyVariantImages([{ id: 'v1', image: proxied }])
  t('unproxy 变体图', vs[0].image === CDN)
  t('unproxy 变体其它字段保留', vs[0].id === 'v1')
}

console.log('\n[图片代理路由白名单]')
{
  const { ALLOWED_IMAGE_HOSTS } = loadTs('/home/admin/Fiestaflare/lib/imgProxy.ts')
  t('白名单是 Set', ALLOWED_IMAGE_HOSTS instanceof Set)
  t('含 cbu01.alicdn.com', ALLOWED_IMAGE_HOSTS.has('cbu01.alicdn.com'))
  t('含 img.alicdn.com', ALLOWED_IMAGE_HOSTS.has('img.alicdn.com'))
  t('不含 localhost', !ALLOWED_IMAGE_HOSTS.has('localhost'))
  t('不含 127.0.0.1', !ALLOWED_IMAGE_HOSTS.has('127.0.0.1'))
  t('不含 example.com', !ALLOWED_IMAGE_HOSTS.has('example.com'))
  t('白名单不含裸 IP', ![...ALLOWED_IMAGE_HOSTS].some(h => /^\d{1,3}(\.\d{1,3}){3}$/.test(h)))
}

console.log('\n[采集品库批量删除路由]')
async function main() {
  const deleted = []
  const failedRows = []
  const prismaMock = {
    supplierProduct: {
      findMany: async ({ where }) => {
        const ids = where.id.in
        return ids
          .filter(id => !id.startsWith('bad'))
          .map(id => ({ id, title: `商品-${id}` }))
      },
      delete: async ({ where }) => {
        if (String(where.id).startsWith('bad')) {
          const e = new Error('Record to delete does not exist.')
          e.code = 'P2025'
          throw e
        }
        deleted.push(where.id)
        return { id: where.id }
      },
    },
  }
  const { NextResponse } = {
    NextResponse: {
      json: (body, init) => ({ body, status: init?.status ?? 200, async json() { return body } }),
    },
  }
  const mods = {
    '@/lib/prisma': { prisma: prismaMock },
    '@/lib/chatAuth': { requireAdminOrDev: async () => null },
    '@/lib/supplier': { ensureSupplierProductTable: async () => {} },
    'next/server': { NextResponse },
  }
  const route = loadTs('/home/admin/Fiestaflare/app/api/admin/supplier-products/batch-delete/route.ts', mods)
  const req = body => ({ json: async () => body })

  // 正常批量删
  let r = await route.POST(req({ ids: ['a', 'b', 'c'] }))
  t('批量删 3 个 → deleted=3', r.body.deleted === 3 && r.body.failedCount === 0, JSON.stringify(r.body))
  t('真的调了 3 次 delete', deleted.length === 3)

  // 不存在的 id → P2025
  r = await route.POST(req({ ids: ['bad1', 'bad2'] }))
  t('P2025 → failedCount=2', r.body.failedCount === 2, JSON.stringify(r.body))
  t('失败项带原因', r.body.failed[0].reason.includes('不存在'), JSON.stringify(r.body.failed[0]))

  // 混合
  deleted.length = 0
  r = await route.POST(req({ ids: ['x', 'bad1', 'y'] }))
  t('混合 → 成功 2 失败 1', r.body.deleted === 2 && r.body.failedCount === 1, JSON.stringify(r.body))

  // 空数组 → 400
  r = await route.POST(req({ ids: [] }))
  t('空数组 → 400', r.status === 400)

  // 重复 id 去重
  deleted.length = 0
  r = await route.POST(req({ ids: ['d', 'd', 'd'] }))
  t('重复 id 去重成 1 个', r.body.deleted === 1 && deleted.length === 1, JSON.stringify(r.body))

  // 非数组
  r = await route.POST(req({ ids: 'notarray' }))
  t('ids 非数组 → 400', r.status === 400)

  // 超过 500 截断
  deleted.length = 0
  const many = Array.from({ length: 600 }, (_, i) => 'i' + i)
  r = await route.POST(req({ ids: many }))
  t('超过 500 个被截断', r.body.total === 500, String(r.body.total))
}
main().then(() => {
  console.log(`\n通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
}).catch(e => { console.error(e); process.exit(1) })
