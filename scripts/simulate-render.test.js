/**
 * 用**线上真实 API 数据**跑一遍前台商品页的整条渲染数据流，
 * 找出会抛异常（→ "Application error: a client-side exception has occurred"）的点。
 *
 * 复刻 app/(shop)/products/[slug]/page.tsx 里所有对 product 数据的处理
 */
const fs = require('fs')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')
const ROOT = '/home/admin/Fiestaflare'

function loadTs(relPath, names) {
  const src = fs.readFileSync(`${ROOT}/${relPath}`, 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  const req = (id) => {
    if (id.includes('lib/utils')) return loadTs('lib/utils/index.ts', names)
    if (id.includes('lib/variants')) return loadTs('lib/variants.ts', names)
    if (id.includes('lib/imageUtils')) return loadTs('lib/imageUtils.ts', names)
    if (id.startsWith('@/')) {
      const p = `${ROOT}/${id.replace('@/', '')}`
      if (fs.existsSync(p + '.ts')) return loadTs(id.replace('@/', '') + '.ts', names)
      if (fs.existsSync(p + '.tsx')) return loadTs(id.replace('@/', '') + '.tsx', names)
      if (fs.existsSync(p + '/index.ts')) return loadTs(id.replace('@/', '') + '/index.ts', names)
      return {}
    }
    return require(id)
  }
  new Function('module', 'exports', 'require', js)(mod, mod.exports, req)
  return mod.exports
}

const utils = loadTs('lib/utils/index.ts')
const variants = loadTs('lib/variants.ts')
const imgUtils = loadTs('lib/imageUtils.ts')

const { parseTags, getTieredPricing, getPriceFromTieredPricing, formatCurrency } = utils
const { buildVariantRows, matchVariant } = variants
const { parseProductImages } = imgUtils

let pass = 0
let fail = 0
function t(name, cond, extra = '') {
  if (cond) { console.log('  ✓', name); pass++ }
  else { console.log('  ✗', name, extra ? '→ ' + extra : ''); fail++ }
}

const files = process.argv.slice(2)
if (!files.length) { console.error('用法: node simulate-render.js <api-json-file> ...'); process.exit(1) }

for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'))
  const product = raw.data || raw
  console.log('\n══════════════════════════════════════════')
  console.log('商品:', (product.name || '').slice(0, 50))
  console.log('slug:', product.slug)

  // ① 页面加载 → 渲染
  const step = (label, fn) => {
    try { const r = fn(); console.log('  ✓', label, r === undefined ? '' : '→ ' + String(r).slice(0, 60)); pass++; return r }
    catch (e) { console.log('  ✗', label, '→ 抛异常:', e.message); fail++; return null }
  }

  const images = step('parseProductImages(images)', () => parseProductImages(product.images).length)
  const rows = step('buildVariantRows(variants)', () => buildVariantRows(product.variants).length)
  const currentVariant = step('resolveCurrentVariant()', () => {
    const init = {}
    for (const r of buildVariantRows(product.variants)) if (r.values.length) init[r.name] = r.values[0]
    const m = matchVariant(product.variants, init)
    return m ? m.id : null
  })
  const displayPrice = step('displayPrice', () => (currentVariant?.price || product.price))
  const tiers = step('getTieredPricing', () => getTieredPricing(product.tieredPricing, displayPrice).length)
  const priceByQty = step('getPriceFromTieredPricing', () => {
    const r = getPriceFromTieredPricing(getTieredPricing(product.tieredPricing, displayPrice), product.minOrderQty || 1)
    return `${r.tier} ${r.price}`
  })
  const tags = step('parseTags(tags)', () => JSON.stringify(parseTags(product.tags)))
  step('tags.join(", ")', () => parseTags(product.tags).join(', '))

  // ② JSX 里直接用到的字段
  step('product.categories?.length', () => (product.categories?.length || 0))
  step('product.categories.map(name).join', () => (product.categories || []).map(c => c.name).join(', '))
  step('categories[0].name / slug', () => (product.categories?.[0] ? product.categories[0].name + '|' + product.categories[0].slug : 'none'))
  step('tiers.map → maxQty ? ... : ...', () => getTieredPricing(product.tieredPricing, displayPrice).map(t => (t.maxQty ? `${t.minQty}-${t.maxQty} pcs` : `${t.minQty}+ pcs`)).join(' | '))
  step('formatCurrency(tier.price) —— 单次换算', () => formatCurrency(getTieredPricing(product.tieredPricing, displayPrice)[0].price, 'USD'))
  step('minOrderQty', () => product.minOrderQty)
  step('inventory', () => product.inventory)
  step('barcode', () => product.barcode)
  step('soldCount || 0', () => product.soldCount || 0)
  step('variant.inventory != null && < 10', () => (product.variants || []).map(v => v.inventory != null && v.inventory < 10 ? ` (${v.inventory} left)` : '').join(''))
  step('shortDesc', () => (product.shortDesc || '').slice(0, 30))

  // ③ useEffect / 异步路径（catch 住的也要看有没有裸 parse）
  step('JSON.parse 不存在于 product 数据路径', () => {
    const bad = ['tags', 'tieredPricing', 'variants', 'variantDims', 'images', 'categoryIds']
    for (const f of bad) {
      const v = product[f]
      if (v == null) continue
      try { JSON.parse(String(v)) } catch (e) { throw new Error(`${f} 不是合法 JSON: ${String(v).slice(0, 60)}`) }
    }
    return '全部字段可 JSON.parse'
  })
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
