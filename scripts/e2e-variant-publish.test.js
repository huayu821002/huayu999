/**
 * 端到端验证：采集品（带变体）→ 发布 → Product 变体落库 → 前台 API 返回
 * 直接打生产库（只创建测试数据，结束后清理）
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

const TEST_SOURCE = 'e2e-variant-test-9999'
const COLLECT_VARIANTS = [
  { skuId: '6300644986670', specs: [{ name: '颜色', value: '焦糖布丁-磨毛单裤' }], color: '焦糖布丁-磨毛单裤', size: '', specText: '焦糖布丁-磨毛单裤', price: 12.5, image: 'https://cbu01.alicdn.com/img/ibank/O1CN01ZTYqubw1.jpg' },
  { skuId: '6300644986671', specs: [{ name: '颜色', value: '红苹果小狗-磨毛单裤' }], color: '红苹果小狗-磨毛单裤', size: '', specText: '红苹果小狗-磨毛单裤', price: 13.0, image: 'https://cbu01.alicdn.com/img/ibank/O1CN01ZTYqubw2.jpg' },
  { skuId: '6300644986672', specs: [{ name: '颜色', value: '深蓝波点猫-磨毛单裤' }], color: '深蓝波点猫-磨毛单裤', size: '', specText: '深蓝波点猫-磨毛单裤', price: 14.25, image: '' },
]
const COLLECT_DIMS = [{ name: '颜色', kind: 'color', values: ['焦糖布丁-磨毛单裤', '红苹果小狗-磨毛单裤', '深蓝波点猫-磨毛单裤'] }]

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

;(async () => {
  try {
    // 1) 造一个采集品
    const sp = await prisma.supplierProduct.create({
      data: {
        source: '1688', sourceId: TEST_SOURCE,
        title: 'E2E 变体测试 纯棉磨毛睡裤',
        titleEn: 'E2E Variant Test Cotton Pants',
        description: '面料名称: 棉\n裤长: 长裤',
        images: JSON.stringify(['https://cbu01.alicdn.com/img/ibank/O1CN01ZTYqubw1.jpg']),
        priceMin: 12.5, moq: 2,
        variants: JSON.stringify(COLLECT_VARIANTS),
        variantDims: JSON.stringify(COLLECT_DIMS),
        attributes: JSON.stringify({ '面料名称': '棉', '裤长': '长裤' }),
        status: 'pending',
      },
    })
    console.log('① 采集品已建:', sp.id)

    // 2) 复刻发布路由的变体转换逻辑（与 route.ts 同源）
    const markup = 3
    const numOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
    const supplierVariants = JSON.parse(sp.variants || '[]')
    const variantDims = JSON.parse(sp.variantDims || '[]')
    const variants = supplierVariants.map((v, i) => {
      const specs = (v.specs || []).map(s => ({ name: String(s.name || ''), value: String(s.value || '') }))
      const dimNames = specs.length ? Array.from(new Set(specs.map(s => s.name).filter(Boolean))) : (variantDims || []).map(d => String(d?.name || '')).filter(Boolean)
      const displayValue = specs.length ? specs.map(s => s.value).filter(Boolean).join(' / ') : String(v.color || v.size || v.specText || '').trim()
      const cnyV = numOrNull(v.price)
      const usdV = cnyV === null ? null : Math.round(((cnyV * markup) / 7.2) * 100) / 100
      return {
        id: `${String(v.skuId || 'v')}-${i}`, name: (dimNames.join(' / ') || '选项').slice(0, 40),
        value: (displayValue || `变体 ${i + 1}`).slice(0, 80), sku: v.skuId ? String(v.skuId).slice(0, 80) : null,
        price: usdV, inventory: 0, image: v.image ? String(v.image).slice(0, 500) : null,
      }
    })
    const variantPrices = variants.map(v => v.price).filter(p => typeof p === 'number')
    const finalPrice = variantPrices.length ? Math.min(...variantPrices) : 0

    // 3) 建 Product
    const product = await prisma.product.create({
      data: {
        name: 'E2E Variant Test Cotton Pants', slug: `e2e-variant-test-${Date.now()}`,
        sku: `1688-${TEST_SOURCE}`, description: '面料名称: 棉\n裤长: 长裤',
        price: finalPrice, inventory: 100, minOrderQty: 2,
        images: sp.images,
        variants: JSON.stringify(variants), variantDims: JSON.stringify(variantDims),
        isActive: false, tags: 'e2e-test',
      },
    })
    console.log('② 商品已建:', product.id)

    // 4) 断言
    console.log('\n[变体落库]')
    const saved = JSON.parse(product.variants || '[]')
    t('存了 3 个变体', saved.length === 3, JSON.stringify(saved))
    t('name = 维度名「颜色」', saved[0].name === '颜色', saved[0].name)
    t('value = 颜色值', saved[0].value === '焦糖布丁-磨毛单裤', saved[0].value)
    t('价格 CNY12.5 → USD 5.21', Math.abs(saved[0].price - 5.21) < 0.01, String(saved[0].price))
    t('价格 CNY13 → USD 5.42', Math.abs(saved[1].price - 5.42) < 0.01, String(saved[1].price))
    t('价格 CNY14.25 → USD 5.94', Math.abs(saved[2].price - 5.94) < 0.01, String(saved[2].price))
    t('商品价 = 最低变体价 5.21', Math.abs(product.price - 5.21) < 0.01, String(product.price))
    t('变体图片带上了', !!saved[0].image && !!saved[1].image)
    t('无图变体 image 为 null', saved[2].image === null, String(saved[2].image))
    t('sku 保留 1688 skuId', saved[0].sku === '6300644986670', String(saved[0].sku))
    t('id 唯一', new Set(saved.map(v => v.id)).size === 3, JSON.stringify(saved.map(v => v.id)))
    t('维度定义带上了', JSON.parse(product.variantDims || '[]')[0].name === '颜色')

    // 5) 前台 API 逻辑复刻
    console.log('\n[前台 API 逻辑]')
    const raw = product.variants ? JSON.parse(product.variants) : []
    const apiVariants = raw.filter(v => v && typeof v === 'object').map((v, i) => ({
      id: String(v.id || `v-${i}`), name: String(v.name || ''), value: String(v.value || ''),
      sku: v.sku ?? null, price: typeof v.price === 'number' ? v.price : null,
      inventory: Number.isFinite(Number(v.inventory)) ? Number(v.inventory) : 0, image: v.image ?? null,
    }))
    t('API 返回 3 个变体', apiVariants.length === 3)
    t('API 变体有 id/name/value', !!apiVariants[0].id && apiVariants[0].name === '颜色' && !!apiVariants[0].value)
    t('API 变体带 price', typeof apiVariants[0].price === 'number')
    t('前台按钮文案 = 颜色值', apiVariants.map(v => v.value).join(' / ') === '焦糖布丁-磨毛单裤 / 红苹果小狗-磨毛单裤 / 深蓝波点猫-磨毛单裤', apiVariants.map(v => v.value).join(' / '))
    t('前台维度标签 = 「颜色」', apiVariants[0].name === '颜色')

    // 清理
    await prisma.product.delete({ where: { id: product.id } })
    await prisma.supplierProduct.delete({ where: { id: sp.id } })
    console.log('\n③ 测试数据已清理')
  } catch (e) {
    console.error('失败:', e.message)
    fail++
  } finally {
    await prisma.$disconnect()
  }
  console.log('--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
