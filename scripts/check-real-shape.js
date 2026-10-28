/* 扫**所有**生产商品：统计维度结构 + 用真实数据跑一遍改名
 *
 * 目的：
 *  ① 找出多维度（颜色+尺码）商品，用真实数据验证多维度改名路径
 *  ② 验证单维度路径在真实数据上三处同步
 *
 * 只读 + 内存里改名，**不写库**。
 * 用法：JWT_SECRET=xxx API=https://fiestaflare.com npm run check:shape
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

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

;(async () => {
  token = await new SignJWT({ role: 'ADMIN', sub: 'shape-scan' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m')
    .sign(new TextEncoder().encode(SECRET))

  const listRes = await api('/api/admin/products?limit=100')
  const items = listRes.json?.data || []
  console.log('商品总数:', items.length)

  const stats = { single: 0, multi: 0, none: 0 }
  const multiSamples = []
  const singleSamples = []

  for (const it of items) {
    const d = await api('/api/admin/products/' + it.id)
    const p = d.json?.product || d.json?.data || d.json
    if (!p) continue
    const vs = B.parseVariants(p.variants)
    if (!vs.length) { stats.none++; continue }
    const specCounts = new Set(vs.map(v => (Array.isArray(v.specs) ? v.specs.length : 0)))
    const dims = B.parseDims(p.variantDims)
    const dimCount = dims.length || Math.max(...specCounts)
    const rec = { id: p.id, name: p.name, dimCount, specCounts: [...specCounts], dims, vs, product: p }
    if (dimCount >= 2) { stats.multi++; multiSamples.push(rec) } else { stats.single++; singleSamples.push(rec) }
  }

  console.log('维度结构分布:', JSON.stringify(stats))
  console.log('多维度商品:', multiSamples.map(s => `${s.name} (${s.dimCount}维)`).join(' | ') || '无')
  console.log('单维度商品数:', stats.single)

  // 逐个商品跑改名，检查不变量
  console.log('\n=== 逐商品跑改名（内存，不写库）===')
  let broken = 0
  for (const rec of [...singleSamples, ...multiSamples]) {
    const p = rec.product
    const r = B.batchRename(
      { id: p.id, name: p.name, price: p.price, inventory: p.inventory, variants: p.variants, variantDims: p.variantDims },
      { digits: 4 }
    )
    const nvs = B.parseVariants(r.product.variants)
    const ndim = B.parseDims(r.product.variantDims)

    const problems = []
    // 1) 变体数量不变
    if (nvs.length !== rec.vs.length) problems.push('变体数变了')
    // 2) 尺码等非颜色维度不能丢
    rec.vs.forEach((v, i) => {
      const before = (v.specs || []).filter(s => s && !/颜色|色|color/i.test(String(s.name || '')))
      const after = (nvs[i].specs || []).filter(s => s && !/颜色|色|color/i.test(String(s.name || '')))
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        problems.push(`变体${i} 非颜色维度被改: ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
      }
    })
    // 3) 变体 value 唯一
    if (new Set(nvs.map(v => v.value)).size !== nvs.length) problems.push('变体 value 不唯一')
    // 4) 单维度：value/specs/dims 三处一致
    if (rec.dimCount <= 1) {
      nvs.forEach((v, i) => {
        if (v.specs && v.specs.length && v.specs[0].value !== v.value) {
          problems.push(`变体${i} value≠specs`)
        }
      })
      const d0 = ndim[0]
      if (d0 && Array.isArray(d0.values)) {
        nvs.forEach((v, i) => {
          if (d0.values[i] !== v.value) problems.push(`变体${i} dims 不同步`)
        })
      }
    }
    // 5) 图片/价格/库存没丢
    rec.vs.forEach((v, i) => {
      if (nvs[i].image !== v.image) problems.push(`变体${i} 图片丢了`)
      if (nvs[i].price !== v.price) problems.push(`变体${i} 价格被改`)
      if (nvs[i].inventory !== v.inventory) problems.push(`变体${i} 库存被改`)
      if (nvs[i].id !== v.id) problems.push(`变体${i} id 变了`)
    })

    if (problems.length) {
      broken++
      console.log(`  ✗ ${p.name} [${rec.dimCount}维]`)
      problems.slice(0, 3).forEach(x => console.log('      -', x))
    }
  }
  t(`全部 ${singleSamples.length + multiSamples.length} 个商品改完后数据无损`, broken === 0, `${broken} 个有问题`)

  // 抽样展示一个多维度的结果
  if (multiSamples.length) {
    const rec = multiSamples[0]
    console.log('\n=== 多维度样例 ===')
    const r = B.batchRename(
      { id: rec.id, name: rec.name, price: rec.product.price, inventory: rec.product.inventory, variants: rec.product.variants, variantDims: rec.product.variantDims },
      { digits: 4 }
    )
    const nvs = B.parseVariants(r.product.variants)
    console.log('原:', rec.vs.slice(0, 3).map(v => v.value).join(' | '))
    console.log('新:', nvs.slice(0, 3).map(v => v.value).join(' | '))
    console.log('specs:', JSON.stringify(nvs[0].specs))
    console.log('dims:', JSON.stringify(B.parseDims(r.product.variantDims)))
  }

  console.log(`\n通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
