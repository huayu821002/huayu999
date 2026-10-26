/* 检查线上 DB 里还有多少 _sum 小图（images + variants） */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

;(async () => {
  const ps = await prisma.product.findMany({
    select: { id: true, slug: true, images: true, variants: true },
  })
  let sumImg = 0, sumVar = 0
  for (const p of ps) {
    let imgs = [], vars = []
    try { imgs = JSON.parse(p.images || '[]') } catch { /* ignore */ }
    try { vars = JSON.parse(p.variants || '[]') } catch { /* ignore */ }
    if (!Array.isArray(imgs)) imgs = []
    if (!Array.isArray(vars)) vars = []
    const i = imgs.filter(x => String(x).includes('_sum')).length
    const v = vars.filter(x => x && x.image && String(x.image).includes('_sum')).length
    if (i || v) console.log('  ', p.slug, 'images_sum=', i, 'variants_sum=', v)
    sumImg += i; sumVar += v
  }
  console.log('TOTAL images_sum=', sumImg, 'variants_sum=', sumVar, 'products=', ps.length)
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
