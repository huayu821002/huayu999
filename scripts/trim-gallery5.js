/* 把线上已发布商品的图集收敛到「主图 1 + 图集共 5 张」
 * 只截 images 字段，不动变体、不动价格。
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

const LIMIT = 5
const DRY = process.argv.includes('--dry')

;(async () => {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, images: true },
  })
  let changed = 0
  for (const p of products) {
    let imgs = []
    try { imgs = JSON.parse(p.images || '[]') } catch { continue }
    if (!Array.isArray(imgs) || imgs.length <= LIMIT) continue
    const keep = imgs.slice(0, LIMIT)
    console.log(`${p.slug}\n  ${imgs.length} → ${keep.length} 张`)
    changed++
    if (DRY) continue
    await prisma.product.update({ where: { id: p.id }, data: { images: JSON.stringify(keep) } })
  }
  console.log(`\n共 ${changed} 个商品${DRY ? '（dry-run，未写入）' : '已收敛到 5 张'}`)
  await prisma.$disconnect()
})()
