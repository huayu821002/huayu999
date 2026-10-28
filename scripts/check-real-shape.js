/* 核对：批量改名逻辑对**真实生产数据**的字段假设是否成立
 *
 * 我在单测里造的是简化结构。生产库的 variants / variantDims
 * 可能字段更多、层级不同 → 改名同步会失效（前台还显示旧名）。
 * 这个脚本拉真实商品逐字段核对。
 *
 * 用法：
 *   JWT_SECRET=xxx API=https://fiestaflare.com node scripts/check-real-shape.js
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const API = process.env.API || 'https://fiestaflare.com'
const SECRET = process.env.JWT_SECRET
if (!SECRET) { console.log('⚠️ 未设置 JWT_SECRET，跳过'); process.exit(0) }

const OUT = '/tmp/batchops-test'
execSync(
  `npx tsc lib/batchOps.ts --outDir ${OUT} --module commonjs --target es2019 --esModuleInterop --skipLibCheck`,
  { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
)
const B = require(path.join(OUT, 'batchOps.js'))
const { SignJWT } = require(path.join(__dirname, '..', 'node_modules', 'jose'))

let token = ''
async function api(p) {
  const res = await fetch(API + p, { headers: { Authorization: 'Bearer ' + token } })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, text } }
}

;(async () => {
  token = await new SignJWT({ role: 'ADMIN', sub: 'shape-check' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m')
    .sign(new TextEncoder().encode(SECRET))

  const listRes = await api('/api/admin/products?limit=50')
  const items = listRes.json?.data || []
  console.log('拿到商品数:', items.length)
  if (!items.length) { console.log(listRes.text?.slice(0, 300)); return }

  // 找一个有变体的商品
  let target = null
  for (const it of items) {
    const d = await api('/api/admin/products/' + it.id)
    const p = d.json?.product || d.json?.data || d.json
    if (p && p.variants && B.parseVariants(p.variants).length) { target = p; break }
  }
  if (!target) {
    console.log('这批商品详情里没拿到 variants —— 看看详情接口到底返回什么字段：')
    const d = await api('/api/admin/products/' + items[0].id)
    console.log('顶层 keys:', Object.keys(d.json || {}).join(','))
    const p = d.json?.product || d.json?.data || d.json
    console.log('商品 keys:', Object.keys(p || {}).join(','))
    return
  }

  console.log('\n=== 真实商品 ===')
  console.log('id:', target.id, '| name:', target.name)
  const vs = B.parseVariants(target.variants)
  console.log('变体数:', vs.length)
  console.log('变体字段:', Object.keys(vs[0] || {}).join(','))
  console.log('第一个变体:', JSON.stringify(vs[0], null, 1).slice(0, 700))

  console.log('\n=== variantDims 真实结构 ===')
  let dims = null
  try { dims = typeof target.variantDims === 'string' ? JSON.parse(target.variantDims) : target.variantDims } catch { }
  console.log(JSON.stringify(dims, null, 1).slice(0, 700))
  console.log('dims 顶层 keys:', Array.isArray(dims) ? '(数组)' : Object.keys(dims || {}).join(','))

  console.log('\n=== 套用批量改名（内存里，不写库）===')
  const r = B.batchRename(
    { id: target.id, name: target.name, price: target.price, inventory: target.inventory, variants: target.variants, variantDims: target.variantDims },
    { digits: 4 }
  )
  const nvs = B.parseVariants(r.product.variants)
  console.log('改名后变体:')
  nvs.slice(0, 4).forEach(v => console.log('  name=%s | value=%s | specs=%s', v.name, v.value, JSON.stringify(v.specs)))
  let ndims = null
  try { ndims = typeof r.product.variantDims === 'string' ? JSON.parse(r.product.variantDims) : r.product.variantDims } catch { }
  console.log('改名后 dims:', JSON.stringify(ndims).slice(0, 400))

  console.log('\n=== 核对三处同步 ===')
  const colorDim = (Array.isArray(ndims) ? ndims : []).find(d => d && /颜色|色|color/i.test(String(d.name)))
  if (!colorDim) {
    console.log('⚠️ 没有颜色维度 → 改名可能只改了 variants，dims 没动')
  } else {
    console.log('颜色维度:', colorDim.name, '| values:', JSON.stringify(colorDim.values))
    const v0 = nvs[0]
    console.log('变体0.value =', v0?.value)
    console.log('变体0.specs =', JSON.stringify(v0?.specs))
    console.log('★ dims 里能找到同名:', Array.isArray(colorDim.values) && colorDim.values.includes(v0?.value))
    console.log('★ specs 里能找到同名:', Array.isArray(v0?.specs) && v0.specs.some(s => s.value === v0?.value))
  }
})().catch(e => { console.error(e); process.exit(1) })
