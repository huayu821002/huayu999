/**
 * 回归测试：前台 tags 容错解析 + Tiered Pricing 只保留第一段 + 兼容老格式
 *
 * 背景（2026-10-25）：
 *  - 前台 `JSON.parse(product.tags)` 遇到发布路由存的逗号串 → 抛异常 → 整页 "Application error"
 *  - 采集的阶梯价是 `{spec, price(CNY), skuId}`，不是前台要的 `{minQty,maxQty,price}` 且是人民币
 *  - 用户需求：发布时阶梯价**默认只生成第 1 段**，第 2/3 段自己在后台加；不加就一段
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')

const ROOT = '/home/admin/Fiestaflare'
let pass = 0
let fail = 0
const failures = []

function t(name, cond, extra = '') {
  if (cond) {
    console.log('  ✓', name)
    pass++
  } else {
    console.log('  ✗', name, extra ? '→ ' + extra : '')
    fail++
    failures.push(name)
  }
}

// ── 1. 抽出 lib/utils 的 parseTags / getTieredPricing 并实跑
const utilsSrc = fs.readFileSync(path.join(ROOT, 'lib/utils/index.ts'), 'utf8')
function extractFn(src, name) {
  const i = src.indexOf(`export function ${name}`)
  if (i < 0) return null
  let depth = 0
  let started = false
  for (let j = src.indexOf('{', i); j < src.length; j++) {
    if (src[j] === '{') {
      depth++
      started = true
    } else if (src[j] === '}') {
      depth--
      if (started && depth === 0) return src.slice(i, j + 1)
    }
  }
  return null
}
const parseTagsSrc = extractFn(utilsSrc, 'parseTags')
const getTieredSrc = extractFn(utilsSrc, 'getTieredPricing')
t('lib/utils 有 parseTags', !!parseTagsSrc)
t('lib/utils 有 getTieredPricing', !!getTieredSrc)

if (parseTagsSrc && getTieredSrc) {
  const js = ts.transpileModule(`${parseTagsSrc}\n${getTieredSrc}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  new Function('module', 'exports', js)(mod, mod.exports)
  const { parseTags, getTieredPricing } = mod.exports

  console.log('\n[tags 容错解析]')
  t('null → []', JSON.stringify(parseTags(null)) === '[]')
  t('undefined → []', JSON.stringify(parseTags(undefined)) === '[]')
  t('空串 → []', JSON.stringify(parseTags('')) === '[]')
  t('JSON 数组原样保留', parseTags('["1688","采集品","1059632648130"]').length === 3)
  t('逗号串（线上老数据）能拆且不抛', JSON.stringify(parseTags('1688,采集品,1059632648130')) === '["1688","采集品","1059632648130"]')
  t('单值 → 单元素数组', JSON.stringify(parseTags('1688')) === '["1688"]')
  t('对象数组取 name', parseTags('[{"name":"热卖"}]')[0] === '热卖')
  t('坏 JSON 不抛异常', Array.isArray(parseTags('[{"name":')))
  t('带空格的逗号串会 trim', JSON.stringify(parseTags('a, b ,c')) === '["a","b","c"]')

  console.log('\n[tieredPricing]')
  const base = 6.04
  t('null → 默认 3 段', getTieredPricing(null, base).length === 3)
  t(
    '老格式 {spec,price(CNY)} → 显示 basePrice 而非 CNY 原值',
    getTieredPricing(JSON.stringify({ tiers: [{ spec: '热销款', price: 14.49, skuId: '' }] }), base)[0].price === base,
    String(getTieredPricing(JSON.stringify({ tiers: [{ spec: '热销款', price: 14.49 }] }), base)[0].price)
  )
  const std = getTieredPricing(JSON.stringify({ tiers: [{ minQty: 1, maxQty: null, price: 6.04 }] }), base)
  t('标准一段式原样返回', std.length === 1 && std[0].minQty === 1 && std[0].price === 6.04)
  t('坏 JSON → 默认 3 段', getTieredPricing('{{{bad', base).length === 3)
  t('空 tiers → 默认 3 段', getTieredPricing(JSON.stringify({ tiers: [] }), base).length === 3)
}

// ── 2. 发布路由静态检查
console.log('\n[发布路由]')
const pr = fs.readFileSync(path.join(ROOT, 'app/api/admin/supplier-products/[id]/publish/route.ts'), 'utf8')
t('tieredPricing 只生成 1 段', (pr.match(/minQty: 1,/g) || []).length === 1, String((pr.match(/minQty: 1,/g) || []).length))
t('发布时把 CNY 转 USD', /firstTierCny \* markup\) \/ 7\.2/.test(pr))
t('tags 存成 JSON 数组', /JSON\.stringify\(\['1688'/.test(pr))
t('不再用逗号串 join', !/\.filter\(Boolean\)\.join\(','\)/.test(pr))

// ── 3. 前台商品页
console.log('\n[前台商品页]')
const shop = fs.readFileSync(path.join(ROOT, 'app/(shop)/products/[slug]/page.tsx'), 'utf8')
t('不再裸 JSON.parse(product.tags)', !shop.includes('JSON.parse(product.tags)'))
t('改用 parseTags', shop.includes('parseTags(product.tags)'))
t('内层 JSON.parse(tags) 也换掉', !shop.includes('JSON.parse(tags)'))
t('导入了 parseTags', /import \{[^}]*parseTags[^}]*\} from '@\/lib\/utils'/.test(shop))

// ── 4. 后台 Tiered Pricing UI
console.log('\n[后台 Tiered Pricing UI]')
const admin = fs.readFileSync(path.join(ROOT, 'app/(admin)/admin/products/page.tsx'), 'utf8')
t('默认只有 1 段', admin.includes('tiers = [{ minQty: 1, maxQty: null, price: basePrice }]'))
t('不再硬塞 3 段默认值', !admin.includes('basePrice * 0.9') && !admin.includes('basePrice * 0.85'))
t('有「+ 添加一段」按钮', admin.includes('添加一段'))
t('每段可删除', admin.includes('删除这一段'))
t('可编辑起始数量', admin.includes('起始数量'))
t('可编辑结束数量', admin.includes('结束数量'))

console.log(`\n通过 ${pass} / 失败 ${fail}`)
if (fail) {
  console.log('失败项：', failures.join(' | '))
  process.exit(1)
}
console.log('✅ 全部通过')
