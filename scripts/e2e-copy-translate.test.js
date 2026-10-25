/**
 * 端到端验证：后台「从采集品复制变体」+「一键转英文」
 * 直接打生产库（只创建测试数据，结束后清理）
 *
 * 验证：
 *   1) copy 路由：采集品变体 → 商品变体（specs 保留、CNY→USD、维度定义落库）
 *   2) translate 路由：颜色/尺码中→英（字典命中 + 尺码原样保留）
 *   3) normalizeVariant 不再剥掉 specs（这是之前 PUT 会清空维度明细的 bug）
 *   4) 翻译后的变体前台能正确拆成多行选择器
 */
const fs = require('fs')
const { PrismaClient } = require('/home/admin/Fiestaflare/node_modules/@prisma/client')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')

// 载入 lib/variants.ts
const vsrc = fs.readFileSync('/home/admin/Fiestaflare/lib/variants.ts', 'utf8')
const vjs = ts.transpileModule(vsrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const vmod = { exports: {} }
new Function('module', 'exports', 'require', vjs)(vmod, vmod.exports, require)
const { toProductVariants, buildVariantRows, matchVariant, inferVariantDims } = vmod.exports

// 载入 lib/variantI18n.ts
const isrc = fs.readFileSync('/home/admin/Fiestaflare/lib/variantI18n.ts', 'utf8')
const ijs = ts.transpileModule(isrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const imod = { exports: {} }
new Function('module', 'exports', 'require', ijs)(imod, imod.exports, require)
const { translateDimName, translateDimValue, isSizingValue, translateSpecs } = imod.exports

const url = fs.readFileSync('/home/admin/.openclaw/workspace/dburl_pool.txt', 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

const TEST_SOURCE = 'e2e-copy-translate-8888'
const COLLECT_VARIANTS = [
  { skuId: '9000001', specs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }], color: '红色', size: 'M', specText: '红色 M', price: 12.5, image: 'https://cbu01.alicdn.com/img/ibank/e2e1.jpg' },
  { skuId: '9000002', specs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'L' }], color: '蓝色', size: 'L', specText: '蓝色 L', price: 14.0, image: '' },
]
const COLLECT_DIMS = [
  { name: '颜色', kind: 'color', values: ['红色', '蓝色'] },
  { name: '尺码', kind: 'size', values: ['M', 'L'] },
]

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

// 假的翻译器（不联网）：模拟 Google 翻译对未知中文的处理
const fakeTranslate = async (s) => ({ '酒红': 'Burgundy', '均码': 'One Size', '深蓝波点猫-磨毛单裤': 'Deep Blue Polka Dot Cat' }[s] || s)

;(async () => {
  let sp = null, product = null
  try {
    // ---------- 1. 造采集品 + 商品 ----------
    sp = await prisma.supplierProduct.create({
      data: {
        source: '1688', sourceId: TEST_SOURCE,
        title: 'E2E 复制翻译测试 纯棉长裤',
        description: '面料名称: 棉',
        priceMin: 12.5, moq: 2,
        variants: JSON.stringify(COLLECT_VARIANTS),
        variantDims: JSON.stringify(COLLECT_DIMS),
        status: 'pending',
      },
    })
    product = await prisma.product.create({
      data: {
        name: 'E2E Copy Translate Test Pants',
        slug: 'e2e-copy-translate-test-' + Date.now().toString(36),
        description: 'test',
        price: 5.21, sku: 'E2E-CT-1',
        images: JSON.stringify([]),
        variants: JSON.stringify([]),
        variantDims: JSON.stringify([]),
      },
    })
    console.log('① 采集品:', sp.id, '| 商品:', product.id)

    // ---------- 2. 模拟 copy 路由的逻辑 ----------
    console.log('\n[从采集品复制]')
    const converted = toProductVariants(JSON.parse(sp.variants || '[]'), JSON.parse(sp.variantDims || '[]'), { markup: 3, rate: 7.2 })
    t('复制出 2 个变体', converted.length === 2, converted.length)
    t('name = 维度名（颜色 / 尺码）', converted[0].name === '颜色 / 尺码', converted[0].name)
    t('value = 展示值（红色 / M）', converted[0].value === '红色 / M', converted[0].value)
    t('specs 保留（关键！之前 PUT 会剥掉）', converted[0].specs.length === 2 && converted[0].specs[0].name === '颜色', JSON.stringify(converted[0].specs))
    t('价格 CNY12.5 → USD 5.21', converted[0].price === 5.21, converted[0].price)
    t('价格 CNY14 → USD 5.83', converted[1].price === 5.83, converted[1].price)
    t('库存 null（未知）', converted[0].inventory === null, converted[0].inventory)
    t('图片带上', converted[0].image && converted[0].image.includes('e2e1'))
    t('无图变体 image null', converted[1].image === null, converted[1].image)
    t('sku 保留 1688 skuId', converted[0].sku === '9000001', converted[0].sku)

    // 落库（模拟 PUT）
    await prisma.product.update({
      where: { id: product.id },
      data: { variants: JSON.stringify(converted), variantDims: JSON.stringify(COLLECT_DIMS) },
    })
    const reread = await prisma.product.findUnique({ where: { id: product.id } })
    const stored = JSON.parse(reread.variants || '[]')
    t('落库后 specs 还在', stored[0].specs && stored[0].specs.length === 2, JSON.stringify(stored[0]))
    t('落库后维度定义还在', JSON.parse(reread.variantDims || '[]').length === 2)

    // ---------- 3. 模拟 translate 路由 ----------
    console.log('\n[一键转英文]')
    t('维度名 颜色 → Color', translateDimName('颜色') === 'Color', translateDimName('颜色'))
    t('维度名 尺码 → Size', translateDimName('尺码') === 'Size', translateDimName('尺码'))
    t('值 红色 → Red', await translateDimValue('红色', fakeTranslate) === 'Red')
    t('值 蓝色 → Blue', await translateDimValue('蓝色', fakeTranslate) === 'Blue')
    t('尺码值 M 原样保留', (await translateDimValue('M', fakeTranslate)) === 'M')
    t('尺码值 XXL 原样保留', (await translateDimValue('XXL', fakeTranslate)) === 'XXL')
    t('尺码值 均码 原样保留', isSizingValue('均码'))
    t('数字尺码原样保留', isSizingValue('38'))
    t('带单位的尺码原样保留', isSizingValue('2XL'))

    const tspecs = await translateSpecs([{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }], fakeTranslate)
    t('specs 翻译后 name=Color', tspecs[0].name === 'Color', JSON.stringify(tspecs))
    t('specs 翻译后 value=Red', tspecs[0].value === 'Red')
    t('specs 翻译后尺码仍是 M', tspecs[1].value === 'M')

    // 完整翻译一个变体（模拟 translate 路由主流程）
    const translated = []
    for (const v of stored) {
      const ns = await translateSpecs(v.specs.map(s => ({ name: s.name, value: s.value })), fakeTranslate)
      translated.push({
        ...v,
        name: Array.from(new Set(ns.map(s => s.name))).join(' / '),
        value: ns.map(s => s.value).join(' / '),
        specs: ns,
      })
    }
    t('翻译后 value = Red / M', translated[0].value === 'Red / M', translated[0].value)
    t('翻译后 name = Color / Size', translated[0].name === 'Color / Size', translated[0].name)
    t('翻译后 price 不变', translated[0].price === 5.21, translated[0].price)
    t('翻译后 id 不变（前台选中态不丢）', translated[0].id === stored[0].id)

    // ---------- 4. 前台多维度选择器仍能工作 ----------
    console.log('\n[前台选择器]')
    const rows = buildVariantRows(translated)
    t('翻译后仍是 2 行维度', rows.length === 2, JSON.stringify(rows))
    t('第 1 行 Color (2 值)', rows[0].name === 'Color' && rows[0].values.length === 2, JSON.stringify(rows[0]))
    t('第 2 行 Size (2 值)', rows[1].name === 'Size' && rows[1].values.length === 2, JSON.stringify(rows[1]))
    const m = matchVariant(translated, { Color: 'Blue', Size: 'L' })
    t('选 Blue+L 匹配到变体', !!m && m.value === 'Blue / L', m && m.value)
    t('不存在的组合返回 null', matchVariant(translated, { Color: 'Green' }) === null)

    // ---------- 5. 维度反推（copy 路由 append 分支用） ----------
    const dims2 = inferVariantDims(translated)
    t('反推出 2 个维度', dims2.length === 2, JSON.stringify(dims2))
    t('Color 维度 kind 保留', dims2[0].name === 'Color')

    console.log('\n已清理测试数据')
  } catch (e) {
    console.error('ERROR:', e)
    fail++
  } finally {
    try { if (sp) await prisma.supplierProduct.delete({ where: { id: sp.id } }) } catch (e) { console.error('cleanup sp', e.message) }
    try { if (product) await prisma.product.delete({ where: { id: product.id } }) } catch (e) { console.error('cleanup product', e.message) }
  }
  console.log('--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
