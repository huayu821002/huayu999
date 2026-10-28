/* 前台变体价格回归测试（2026-10-28）
 *
 * 用户反馈：「变体价格前台失效。选择哪个变体价格都是一个样。」
 *
 * 根因（前台层）：
 *   app/(shop)/products/[slug]/page.tsx
 *     const displayPrice = currentVariant?.price || product.price
 *     const tiers = getTieredPricing(product.tieredPricing, displayPrice)
 *     const priceByQty = getPriceFromTieredPricing(tiers, quantity)
 *
 *   数据库里的 tieredPricing 是**商品级**阶梯价，例如：
 *     {"tiers":[{"minQty":1,"maxQty":null,"price":5.83}]}
 *   getTieredPricing 解析到已存在的 tiers 时**直接用库里的绝对价**，
 *   于是 priceByQty.price 恒等于 5.83 —— 变体价被完全盖掉。
 *
 * 根因（档位匹配层）：
 *   采集写入的阶梯价每档 maxQty 都是 null，
 *   老 find() 逻辑下 minQty:1 那档永远命中 → 量价折扣完全失效。
 *
 * 修复：
 *   getVariantAwareTiers()  —— 各档绝对价按变体价缩放
 *   getPriceFromTieredPricing() —— 优先命中区间明确的档，否则取 minQty<=qty 的最后一档
 *
 * 本测试直接跑 lib/utils/index.ts 的真实实现（用 sucrase 转译）。
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

// ── 载入 lib/utils/index.ts 的真实实现 ─────────────────────────────
// 该文件 import 了 @/types 和 clsx/tailwind-merge，这里用桩件替代。
const src = fs.readFileSync(path.join(ROOT, 'lib/utils/index.ts'), 'utf8')
const js = transform(src, { transforms: ['typescript', 'imports'], disableESTransforms: false }).code

const sandbox = {
  module: { exports: {} },
  exports: {},
  require: (id) => {
    if (id === 'clsx') return { clsx: (...a) => a.filter(Boolean).join(' ') }
    if (id === 'tailwind-merge') return { twMerge: (x) => x }
    if (id === '@/types') {
      return {
        CURRENCY_RATES: { USD: 1 },
        CURRENCY_SYMBOLS: { USD: '$' },
        CURRENCY_DECIMALS: { USD: 2 },
      }
    }
    throw new Error('unexpected require: ' + id)
  },
  console,
}
sandbox.exports = sandbox.module.exports
new Function('module', 'exports', 'require', js)(sandbox.module, sandbox.module.exports, sandbox.require)
const U = sandbox.module.exports

console.log('\n[① 单档阶梯价：完全跟随变体价]')
{
  // upf50 遮阳帽：22 个变体原本全是 5.83（数据侧问题），
  // 这里验证「若变体有不同价，前台会正确显示」。
  const tp = JSON.stringify({ tiers: [{ minQty: 1, maxQty: null, price: 5.83 }] })
  const tiers = U.getVariantAwareTiers(tp, 5.83, 7.2)
  t('变体价 7.2 → 第一档变成 7.2',
    tiers.length === 1 && Math.abs(tiers[0].price - 7.2) < 1e-9,
    JSON.stringify(tiers))
  const p = U.getPriceFromTieredPricing(tiers, 1)
  t('主价格 = 变体价 7.2', Math.abs(p.price - 7.2) < 1e-9, JSON.stringify(p))
}

console.log('\n[② 多档阶梯价：按比例缩放，保留量价折扣结构]')
{
  // stereoscopic 防晒口罩：tiers 1.5 / 1 / 0.9，变体价 1.4 / 1.53 / 1.56 / 2
  const tp = JSON.stringify({
    tiers: [
      { minQty: 1, maxQty: null, price: 1.5 },
      { minQty: 5, maxQty: null, price: 1 },
      { minQty: 10, maxQty: null, price: 0.9 },
    ],
  })
  const tiers = U.getVariantAwareTiers(tp, 1.5, 2)
  t('第一档 = 变体价 2', Math.abs(tiers[0].price - 2) < 1e-9, JSON.stringify(tiers))
  t('第二档按比例缩放（1/1.5*2 ≈ 1.33）',
    Math.abs(tiers[1].price - 1.33) < 0.011, JSON.stringify(tiers))
  t('第三档按比例缩放（0.9/1.5*2 = 1.2）',
    Math.abs(tiers[2].price - 1.2) < 0.011, JSON.stringify(tiers))
  t('折扣结构保留（高档仍比低档便宜）',
    tiers[0].price > tiers[1].price && tiers[1].price > tiers[2].price,
    JSON.stringify(tiers))
}

console.log('\n[③ 变体价变化 → 主价格跟着变]')
{
  const tp = JSON.stringify({ tiers: [{ minQty: 1, maxQty: null, price: 1.5 }] })
  const a = U.getPriceFromTieredPricing(U.getVariantAwareTiers(tp, 1.5, 1.4), 1)
  const b = U.getPriceFromTieredPricing(U.getVariantAwareTiers(tp, 1.5, 2), 1)
  t('两个不同变体得到不同主价格', a.price !== b.price, JSON.stringify([a.price, b.price]))
  t('主价格分别等于各自变体价',
    Math.abs(a.price - 1.4) < 1e-9 && Math.abs(b.price - 2) < 1e-9,
    JSON.stringify([a.price, b.price]))
}

console.log('\n[④ 档位匹配：maxQty 全为 null 时不再永远命中第一档]')
{
  const tiers = [
    { minQty: 1, maxQty: null, price: 1.5 },
    { minQty: 5, maxQty: null, price: 1 },
    { minQty: 10, maxQty: null, price: 0.9 },
  ]
  t('买 1 件 → 1.5', U.getPriceFromTieredPricing(tiers, 1).price === 1.5)
  t('买 3 件 → 1.5', U.getPriceFromTieredPricing(tiers, 3).price === 1.5)
  t('买 5 件 → 1.0（量价折扣生效）',
    U.getPriceFromTieredPricing(tiers, 5).price === 1,
    JSON.stringify(U.getPriceFromTieredPricing(tiers, 5)))
  t('买 9 件 → 1.0', U.getPriceFromTieredPricing(tiers, 9).price === 1)
  t('买 10 件 → 0.9', U.getPriceFromTieredPricing(tiers, 10).price === 0.9)
  t('买 100 件 → 0.9', U.getPriceFromTieredPricing(tiers, 100).price === 0.9)
}

console.log('\n[⑤ 区间明确的档位优先]')
{
  const tiers = [
    { minQty: 1, maxQty: 10, price: 1.5 },
    { minQty: 11, maxQty: 100, price: 1 },
    { minQty: 101, maxQty: null, price: 0.85 },
  ]
  t('买 5 件 → 1.5', U.getPriceFromTieredPricing(tiers, 5).price === 1.5)
  t('买 50 件 → 1.0', U.getPriceFromTieredPricing(tiers, 50).price === 1)
  t('买 200 件 → 0.85', U.getPriceFromTieredPricing(tiers, 200).price === 0.85)
}

console.log('\n[⑥ 无变体 / 无阶梯价：保持原行为]')
{
  const tiers = U.getVariantAwareTiers(null, 10, null)
  t('无阶梯价 → 默认三档', tiers.length === 3, JSON.stringify(tiers))
  t('默认第一档 = 商品价', tiers[0].price === 10, JSON.stringify(tiers))
  const t2 = U.getVariantAwareTiers(JSON.stringify({ tiers: [{ minQty: 1, maxQty: null, price: 10 }] }), 10, null)
  t('有阶梯价但无变体 → 仍是商品价', t2[0].price === 10, JSON.stringify(t2))
}

console.log('\n[⑦ 商品价为 0 的脏数据不炸]')
{
  const tp = JSON.stringify({
    tiers: [
      { minQty: 1, maxQty: null, price: 11.16 },
      { minQty: 5, maxQty: null, price: 10 },
    ],
  })
  const tiers = U.getVariantAwareTiers(tp, 0, 5)
  t('基准价 0 时第一档 = 变体价 5', Math.abs(tiers[0].price - 5) < 1e-9, JSON.stringify(tiers))
  t('其余档仍有值', tiers[1].price > 0, JSON.stringify(tiers))
}

console.log('\n[⑧ 前台商品页确实用了变体感知函数]')
{
  const s = fs.readFileSync(path.join(ROOT, 'app/(shop)/products/[slug]/page.tsx'), 'utf8')
  t('import 了 getVariantAwareTiers', /getVariantAwareTiers/.test(s))
  t('tiers 用 getVariantAwareTiers(product.tieredPricing, product.price, currentVariant?.price ?? null)',
    /getVariantAwareTiers\(product\.tieredPricing,\s*product\.price,\s*currentVariant\?\.price\s*\?\?\s*null\)/.test(s))
  // 去掉注释后再断言（注释里会提到旧写法做说明）
  const codeOnly = s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  t('不再用 getTieredPricing(product.tieredPricing, displayPrice)',
    !/getTieredPricing\(product\.tieredPricing,\s*displayPrice\)/.test(codeOnly))
}

console.log('\n[⑨ 购物车/结算用变体价]')
{
  const files = [
    'lib/store/index.ts',
    'components/shop/CartDrawer.tsx',
    'app/(shop)/cart/page.tsx',
    'app/(shop)/checkout/page.tsx',
  ]
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8')
    const hasVariantPrice = /item\.variant\?\.price\s*\?\?\s*item\.product\.price/.test(s)
    t(`${f} 用变体价`, hasVariantPrice)
  }
  // 结算提交的价格也必须带变体价（这是实际收款金额）
  const co = fs.readFileSync(path.join(ROOT, 'app/(shop)/checkout/page.tsx'), 'utf8')
  const orderPrices = co.match(/price:\s*item\.variant\?\.price\s*\?\?\s*item\.product\.price/g) || []
  t('下单 items 全部用变体价（4 处）', orderPrices.length === 4, String(orderPrices.length))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
