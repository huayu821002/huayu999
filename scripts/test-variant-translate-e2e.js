/* 端到端：用真实采集品跑变体翻译（打真实 DB + 真实翻译接口）
 * 用完把采集品还原（避免污染线上数据）
 */
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

const dbUrl = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

const { translateSupplierVariants } = req('@/lib/variantTranslate')
const { translateToEnglish } = req('@/lib/cn2en')

const cache = new Map()
async function cachedTranslate(s) {
  const k = String(s || '').trim()
  if (!k) return s
  if (cache.has(k)) return cache.get(k)
  try {
    const out = (await translateToEnglish(k) || k).trim() || k
    cache.set(k, out)
    return out
  } catch { return k }
}

;(async () => {
  const items = await prisma.supplierProduct.findMany({
    select: { id: true, title: true, variants: true, variantDims: true },
    take: 5,
  })
  for (const it of items) {
    const variants = JSON.parse(it.variants || '[]')
    const dims = JSON.parse(it.variantDims || '[]')
    if (!variants.length) { console.log('--- (无变体) ' + (it.title || '').slice(0, 30)); continue }
    console.log('\n=== ' + (it.title || '').slice(0, 40))
    console.log('  翻译前 specs[0]:', JSON.stringify(variants[0].specs))
    console.log('  翻译前 dims    :', JSON.stringify(dims).slice(0, 160))
    const r = await translateSupplierVariants(variants, dims, cachedTranslate)
    console.log('  翻译后 specs[0]:', JSON.stringify(r.variants[0].specs))
    console.log('  翻译后 value   :', JSON.stringify(r.variants[0].value))
    console.log('  翻译后 dims    :', JSON.stringify(r.dims).slice(0, 160))
    const cjk = /[\u4e00-\u9fa5]/
    console.log('  ✓ 无残留中文:', !cjk.test(JSON.stringify(r.variants)))
    const maxLen = Math.max(...r.variants.flatMap(v => (v.specs || []).map(s => String(s.value || '').length)))
    console.log('  ✓ 最长值长度:', maxLen, maxLen <= 24 ? '(≤24 ✓)' : '(超长 ✗)')
    console.log('  ✓ price 保留:', r.variants[0].price === variants[0].price)
  }
  await prisma.$disconnect()
})()
