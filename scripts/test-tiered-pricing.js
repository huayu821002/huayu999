/* 后台 Tiered Pricing 回归测试
 *
 * 用户反馈：「后台价格段不能填加，填加后还是原来段」
 *
 * 根因：app/api/admin/products/route.ts 的 POST 和 [productId]/route.ts 的 PUT
 *       **都没有接收/写入 tieredPricing 字段** → 前端写进了 form，
 *       保存时后端直接丢弃 → 再打开还是原来那一段。
 *
 * 这里做**静态 + 逻辑**双重检查：
 *   ① API 必须 destructuring tieredPricing
 *   ② API 必须写进 prisma data
 *   ③ 归一化逻辑：空 → null，有 tiers → 原样存
 *   ④ 前端「+ 添加一段」必须能生成第 2 段
 */
const fs = require('fs')
const path = require('path')
const { transform } = require('sucrase')

const ROOT = path.join(__dirname, '..')
let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

console.log('\n[① POST /api/admin/products]')
{
  const s = fs.readFileSync(path.join(ROOT, 'app/api/admin/products/route.ts'), 'utf8')
  t('解构里包含 tieredPricing', /minOrderQty,\s*lowStockAlert,\s*tieredPricing/.test(s))
  t('prisma data 里写入 tieredPricing', /tieredPricing:\s*\(\(\)\s*=>/.test(s))
  t('空值 → null', /tieredPricing === null \|\| tieredPricing === undefined \|\| tieredPricing === ''\) return null/.test(s))
  t('tiers 空数组 → null', /parsed\.tiers\.length\) return JSON\.stringify/.test(s))
}

console.log('\n[② PUT /api/admin/products/[id]]')
{
  const s = fs.readFileSync(path.join(ROOT, 'app/api/admin/products/[productId]/route.ts'), 'utf8')
  t('解构里包含 tieredPricing', /minOrderQty,\s*lowStockAlert,\s*tieredPricing/.test(s))
  t('prisma data 里写入 tieredPricing', /tieredPricing:\s*\(\(\)\s*=>/.test(s))
}

console.log('\n[③ 前端「+ 添加一段」]')
{
  const s = fs.readFileSync(path.join(ROOT, 'app/(admin)/admin/products/page.tsx'), 'utf8')
  t('有「+ 添加一段」按钮', s.includes('+ 添加一段'))
  t('添加时基于 last 段算 nextMin', /const last = tiers\[tiers\.length - 1\]/.test(s))
  t('添加时保留原有段（...tiers）', /\.\.\.tiers,/.test(s))
  t('writeTiers 写进 form.tieredPricing', /tieredPricing: JSON\.stringify\(\{ tiers: next \}\)/.test(s))
  t('编辑商品时回填 tieredPricing', /tieredPricing: product\.tieredPricing \|\| ''/.test(s))
  t('表单 state 里有 tieredPricing 字段', /tieredPricing: string;/.test(s))
}

console.log('\n[④ 归一化逻辑（模拟 API 里的 IIFE）]')
{
  // 把 API 里的归一化 IIFE 抽出来跑
  const apiSrc = fs.readFileSync(path.join(ROOT, 'app/api/admin/products/route.ts'), 'utf8')
  const m = apiSrc.match(/tieredPricing:\s*(\(\(\)\s*=>[\s\S]*?\)\(\)),/)
  t('能从 API 源码里抽出归一化逻辑', !!m)
  if (m) {
    const js = transform(
      'export const norm = (tieredPricing) => ' + m[1].replace(/^\(\(\)\s*=>/, '').replace(/\)\(\)\s*,?$/, ''),
      { transforms: ['typescript', 'imports'] }
    ).code
    const mod = { exports: {} }
    new Function('module', 'exports', 'require', js)(mod, mod.exports, require)
    const norm = mod.exports.norm

    t('null → null', norm(null) === null, String(norm(null)))
    t("'' → null", norm('') === null, String(norm('')))
    t('undefined → null', norm(undefined) === null, String(norm(undefined)))
    const two = JSON.stringify({ tiers: [{ minQty: 1, maxQty: 10, price: 5 }, { minQty: 11, maxQty: null, price: 4 }] })
    t('两段原样保留', norm(two) === two, norm(two))
    t('tiers 为空 → null', norm(JSON.stringify({ tiers: [] })) === null, norm(JSON.stringify({ tiers: [] })))
    t('坏 JSON → null', norm('{{{bad') === null, norm('{{{bad'))
    t('单段也保留', String(norm(JSON.stringify({ tiers: [{ minQty: 1, maxQty: null, price: 5 }] }))).includes('minQty'))
  }
}

console.log('\n[⑤ 前台能正确渲染多段]')
{
  const libSrc = fs.readFileSync(path.join(ROOT, 'lib/utils/index.ts'), 'utf8')
  t('utils 里有 getTieredPricing', /getTieredPricing/.test(libSrc))
  const shopSrc = fs.readFileSync(path.join(ROOT, 'app/(shop)/products/[slug]/page.tsx'), 'utf8')
  t('商品页渲染 tiers.map', /tiers\.map/.test(shopSrc))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
