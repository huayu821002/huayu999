/* 修线上存量数据的小图 → 原图
 *
 * 线上商品里 images / variants.image 存的是 80x80 的 `_sum` 缩略图。
 * 实测：xxx.jpg_sum.jpg = 80x80/1896B，xxx.jpg = 800x800/87715B（差 100 倍）
 *
 * 用法：node scripts/fix-big-images.js [--dry]
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

/** 与 lib/imageNormalize.ts 保持一致 */
const ALICDN_HOST_RE = /(alicdn|1688|taobao|cbu|timg)\./i
function normalize(u) {
  if (typeof u !== 'string') return u
  let url = u.trim()
  if (!url) return url
  if (!/^https?:\/\//i.test(url)) return url
  if (!ALICDN_HOST_RE.test(url)) return url
  url = url.split('?')[0]
  url = url.replace(/\.(jpg|jpeg|png|webp)_\.(webp|jpg|jpeg|png)$/i, '.$1')
  let prev = null, guard = 0
  while (url !== prev && guard++ < 10) {
    prev = url
    url = url.replace(/_\d+x\d+(xz)?\.(jpg|jpeg|png|webp)$/i, '')
    url = url.replace(/_\d+x\d+(xz)?_(webp|jpg|jpeg|png)$/i, '')
    url = url.replace(/_sum\.(jpg|jpeg|png|webp)$/i, '')
    url = url.replace(/_sum$/i, '')
    url = url.replace(/_(?:thumb|mini|small|reduced)\.(jpg|jpeg|png|webp)$/i, '')
    url = url.replace(/_(?:thumb|mini|small|reduced)$/i, '')
  }
  if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
    if (/[a-z0-9]$/i.test(url)) url += '.jpg'
  }
  return url
}

const DRY = process.argv.includes('--dry')

;(async () => {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, images: true, variants: true },
  })
  console.log(`共 ${products.length} 个商品`)

  let changed = 0
  for (const p of products) {
    const upd = {}

    // images
    if (typeof p.images === 'string' && p.images.trim().startsWith('[')) {
      let arr = null
      try { arr = JSON.parse(p.images) } catch { /* ignore */ }
      if (Array.isArray(arr)) {
        const next = []
        for (const x of arr) {
          const n = normalize(String(x || ''))
          if (n) next.push(n)
        }
        const uniq = Array.from(new Set(next))
        if (JSON.stringify(uniq) !== JSON.stringify(arr)) upd.images = JSON.stringify(uniq)
      }
    }

    // variants
    if (typeof p.variants === 'string' && p.variants.trim().startsWith('[')) {
      let varr = null
      try { varr = JSON.parse(p.variants) } catch { /* ignore */ }
      if (Array.isArray(varr)) {
        let dirty = false
        const nv = varr.map(v => {
          if (v && typeof v === 'object' && v.image) {
            const n = normalize(String(v.image))
            if (n !== v.image) { dirty = true; return { ...v, image: n } }
          }
          return v
        })
        if (dirty) upd.variants = JSON.stringify(nv)
      }
    }

    if (Object.keys(upd).length) {
      changed++
      console.log(`  ↻ ${p.slug}\n    ${(p.name || '').slice(0, 50)}`)
      if (upd.images) console.log(`    images → ${upd.images.slice(0, 200)}`)
      if (!DRY) await prisma.product.update({ where: { id: p.id }, data: upd })
    }
  }
  console.log(`\n共需修正 ${changed} 个商品${DRY ? '（dry-run，未写入）' : '（已写入）'}`)
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
