/* 统计线上采集品变体的 imageSource 分布
 * probe = 用户点过探测（可信）
 * align = 序号对齐硬配（用户没点过 → 不可信）
 * none  = 没配到
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const dbUrl = fs.readFileSync('/home/admin/.openclaw/workspace/dburl.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

;(async () => {
  const items = await prisma.supplierProduct.findMany({
    select: { id: true, title: true, variants: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })
  const stat = { probe: 0, align: 0, none: 0, empty: 0, other: 0 }
  for (const it of items) {
    let vs = []
    try { vs = JSON.parse(it.variants || '[]') } catch { /* ignore */ }
    if (!Array.isArray(vs) || !vs.length) continue
    const row = { probe: 0, align: 0, none: 0, empty: 0, other: 0 }
    for (const v of vs) {
      const src = String(v?.imageSource || (v?.image ? '(no-src)' : ''))
      if (v?.imageSource === 'probe') { row.probe++; stat.probe++ }
      else if (v?.imageSource === 'align') { row.align++; stat.align++ }
      else if (v?.imageSource === 'none') { row.none++; stat.none++ }
      else if (!v?.image) { row.empty++; stat.empty++ }
      else { row.other++; stat.other++ }
    }
    console.log((it.title || '').slice(0, 34).padEnd(36), JSON.stringify(row))
  }
  console.log('\n总计:', JSON.stringify(stat))
  await prisma.$disconnect()
})()
