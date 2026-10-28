/* 核对生产库里最新采集记录的真实变体价格
 * 用法：node scripts/check-prod-prices.js
 */
const https = require('https')

const KEY = '***REMOVED_1688_DEBUG_KEY***'
const API = 'https://fiestaflare.com'

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(API + path, { timeout: 30000 }, res => {
      let b = ''
      res.on('data', d => (b += d))
      res.on('end', () => { try { resolve(JSON.parse(b)) } catch (e) { reject(new Error('bad json: ' + b.slice(0, 200))) } })
    }).on('error', reject)
  })
}
const parse = (v) => {
  if (!v) return null
  if (typeof v === 'object') return v
  try { return JSON.parse(String(v)) } catch { return null }
}

;(async () => {
  const d = await get('/api/debug/1688-raw?key=' + KEY + '&limit=8')
  const rows = d.rows || []
  console.log('采集记录数:', rows.length, '\n')
  for (const r of rows) {
    const raw = parse(r.raw) || {}
    const vs = parse(r.variants) || []
    const dims = parse(r.variantDims) || []
    const prices = vs.map(v => v.price)
    const uniq = [...new Set(prices.filter(p => p != null))].sort((a, b) => a - b)
    console.log('── offer', r.sourceId, '| status', r.status)
    console.log('   标题:', (r.title || '').slice(0, 50))
    console.log('   采集时间:', raw.collectedAt || '(无)')
    console.log('   变体数:', vs.length, '| 不同价格数:', uniq.length, '| 价格:', JSON.stringify(uniq.slice(0, 12)))
    console.log('   维度:', dims.map(x => `${x.name}(${(x.values || []).length})`).join(' '))
    const srcs = vs.map(v => v.priceSource).filter(Boolean)
    const srcDist = {}
    srcs.forEach(s => (srcDist[s] = (srcDist[s] || 0) + 1))
    if (srcs.length) console.log('   价格来源分布:', JSON.stringify(srcDist))
    if (uniq.length > 1) {
      console.log('   逐个:')
      vs.slice(0, 12).forEach(v => {
        const sp = (v.specs || []).map(s => s.value).join('/')
        console.log('     ', sp.slice(0, 34).padEnd(34), '| price=', v.price, '| src=', v.priceSource || '-', '| text=', v.priceText || '-')
      })
    }
    if (raw.probePriceStat) {
      console.log('   probePriceStat:', JSON.stringify(raw.probePriceStat).slice(0, 300))
    }
    if (raw.probePrices) {
      const pp = raw.probePrices
      console.log('   probePrices:', JSON.stringify(pp).slice(0, 300))
    }
    console.log()
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
