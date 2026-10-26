/* 把线上 DB 里存量的「相对本地图地址」转成完整网站地址
 *
 * 用户需求（2026-10-26 第 3 条）：「图片地址用网站地址」
 * 新上架的已经是 https://fiestaflare.com/api/uploads/xxx.jpg
 * 存量还是 /api/uploads/xxx.jpg → 统一
 *
 * 注意：只改**本地图**（/api/uploads/ 开头），CDN 图和 i.ibb.co 等外链不动。
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const dbUrl = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

const SITE = 'https://fiestaflare.com'
const LOCAL = '/api/uploads/'

/** 相对本地图 → 绝对 */
function toAbs(u) {
  const s = String(u || '').trim()
  if (!s) return u
  if (!s.startsWith(LOCAL)) return u
  return SITE + s
}

;(async () => {
  const ps = await prisma.product.findMany({
    select: { id: true, slug: true, images: true, variants: true, modelImage: true, sizeChart: true },
  })
  let changedProducts = 0
  let changedImages = 0
  let changedVariants = 0

  for (const p of ps) {
    const data = {}

    // images 字段
    if (p.images) {
      let arr = null
      try { arr = JSON.parse(p.images) } catch { /* 非 JSON */ }
      if (Array.isArray(arr)) {
        const next = arr.map((x) => toAbs(String(x || '')))
        if (next.join('|') !== arr.join('|')) {
          data.images = JSON.stringify(next)
          changedImages += next.filter((x, i) => x !== arr[i]).length
        }
      } else {
        const next = toAbs(String(p.images))
        if (next !== p.images) { data.images = next; changedImages++ }
      }
    }

    // variants 里的 image
    if (p.variants) {
      let vs = null
      try { vs = JSON.parse(p.variants) } catch { /* ignore */ }
      if (Array.isArray(vs)) {
        let dirty = false
        const next = vs.map((v) => {
          if (!v || typeof v !== 'object') return v
          const nv = { ...v }
          if (typeof nv.image === 'string' && nv.image) {
            const a = toAbs(nv.image)
            if (a !== nv.image) { nv.image = a; dirty = true; changedVariants++ }
          }
          if (Array.isArray(nv.images)) {
            const ni = nv.images.map((x) => toAbs(String(x || '')))
            if (ni.join('|') !== nv.images.join('|')) { nv.images = ni; dirty = true }
          }
          return nv
        })
        if (dirty) data.variants = JSON.stringify(next)
      }
    }

    // modelImage / sizeChart
    if (p.modelImage) {
      const n = toAbs(p.modelImage)
      if (n !== p.modelImage) { data.modelImage = n; changedImages++ }
    }
    if (p.sizeChart) {
      const n = toAbs(p.sizeChart)
      if (n !== p.sizeChart) { data.sizeChart = n; changedImages++ }
    }

    if (Object.keys(data).length) {
      await prisma.product.update({ where: { id: p.id }, data })
      changedProducts++
      console.log('  ✓', p.slug)
    }
  }

  console.log('\n商品数:', ps.length, '| 改动商品:', changedProducts, '| 图地址改动:', changedImages, '| 变体图改动:', changedVariants)
  await prisma.$disconnect()
})()
