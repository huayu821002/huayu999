/**
 * 变体转换 + 多维度选择器 的单元测试
 * （不依赖数据库，纯函数）
 */
const path = require('path')
const fs = require('fs')
const ts = require('/home/admin/Fiestaflare/node_modules/typescript')

// 用项目自带的 TypeScript 编译器转译（而不是正则剥类型）
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'variants.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

const mod = { exports: {} }
// 支持 '@/xxx' 路径别名（Next.js 的 tsconfig paths）
// 注意：被引用的模块可能是 .ts → 用 sucrase 即时转译
const { transform } = require('/home/admin/Fiestaflare/node_modules/sucrase')
const req = id => {
  let file = null
  if (id.startsWith('@/')) {
    file = path.join(__dirname, '..', id.slice(2))
  } else {
    return require(id)
  }
  if (!fs.existsSync(file)) {
    if (fs.existsSync(file + '.ts')) file = file + '.ts'
    else if (fs.existsSync(file + '/index.ts')) file = file + '/index.ts'
  }
  if (file.endsWith('.ts')) {
    const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code
    const m2 = { exports: {} }
    new Function('module', 'exports', 'require', code)(m2, m2.exports, req)
    return m2.exports
  }
  return require(file)
}
new Function('module', 'exports', 'require', js)(mod, mod.exports, req)
const { toProductVariants, buildVariantRows, matchVariant, inferVariantDims } = mod.exports

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

console.log('--- 采集变体 → 商品变体 ---')
const supplier = [
  { skuId: '6300644986670', specs: [{ name: '颜色', value: '焦糖布丁' }], price: 12.5, image: 'https://img/a.jpg' },
  { skuId: '6300644986671', specs: [{ name: '颜色', value: '红苹果' }], price: 13, image: 'https://img/b.jpg' },
]
const pv = toProductVariants(supplier, [{ name: '颜色', kind: 'color', values: [] }])
t('2 个变体', pv.length === 2)
t('name = 维度名', pv[0].name === '颜色', pv[0].name)
t('value = 颜色值', pv[0].value === '焦糖布丁', pv[0].value)
t('CNY12.5 → USD 5.21', Math.abs(pv[0].price - 5.21) < 0.01, String(pv[0].price))
t('库存 null（未知）', pv[0].inventory === null, String(pv[0].inventory))
t('图片带上', pv[0].image === 'https://img/a.jpg')
t('specs 保留', pv[0].specs[0].name === '颜色' && pv[0].specs[0].value === '焦糖布丁')
t('id 唯一', pv[0].id !== pv[1].id, pv.map(v => v.id).join(' | '))

console.log('\n--- 单维度：维度行 ---')
const rows1 = buildVariantRows(pv)
t('1 行', rows1.length === 1, JSON.stringify(rows1))
t('行名 = 颜色', rows1[0].name === '颜色')
t('行值 = 2 个', rows1[0].values.length === 2, JSON.stringify(rows1[0].values))

console.log('\n--- 多维度：颜色 × 尺码 ---')
const multi = [
  { skuId: 's1', specs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }], price: 10 },
  { skuId: 's2', specs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'L' }], price: 11 },
  { skuId: 's3', specs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'M' }], price: 12 },
  { skuId: 's4', specs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'L' }], price: 13 },
]
const mv = toProductVariants(multi, [])
t('4 个变体', mv.length === 4)
t('value 用 “ / ” 连接', mv[0].value === '红色 / M', mv[0].value)
t('name = 两个维度名', mv[0].name === '颜色 / 尺码', mv[0].name)

const rows2 = buildVariantRows(mv)
t('2 行', rows2.length === 2, JSON.stringify(rows2))
t('第 1 行 颜色 2 值', rows2[0].name === '颜色' && rows2[0].values.length === 2)
t('第 2 行 尺码 2 值', rows2[1].name === '尺码' && rows2[1].values.length === 2)

console.log('\n--- 多维度匹配 ---')
t('红+M → 红色/M', matchVariant(mv, { 颜色: '红色', 尺码: 'M' })?.value === '红色 / M')
t('蓝+L → 蓝色/L', matchVariant(mv, { 颜色: '蓝色', 尺码: 'L' })?.value === '蓝色 / L')
t('只选颜色=蓝色 → 第一个蓝色', matchVariant(mv, { 颜色: '蓝色' })?.value === '蓝色 / M')
t('只选尺码=L → 第一个 L', matchVariant(mv, { 尺码: 'L' })?.value === '红色 / L')
t('空选择 → 第一个', matchVariant(mv, {}) === mv[0])
t('不存在的组合 → null', matchVariant(mv, { 颜色: '绿色' }) === null)
t('匹配到的变体价格正确', matchVariant(mv, { 颜色: '蓝色', 尺码: 'L' })?.price === Math.round((13 * 3 / 7.2) * 100) / 100)

console.log('\n--- 旧数据兼容（无 specs）---')
const legacy = [{ id: 'o1', name: 'Color', value: 'Red', price: 9, inventory: 5, image: null, specs: [] }]
const rows3 = buildVariantRows(legacy)
t('退化成 1 行', rows3.length === 1, JSON.stringify(rows3))
t('行名 = Color', rows3[0].name === 'Color')
t('行值 = Red', rows3[0].values[0] === 'Red')
t('能按 name/value 匹配', matchVariant(legacy, { Color: 'Red' })?.id === 'o1')
t('不匹配返回 null', matchVariant(legacy, { Color: 'Green' }) === null)

console.log('\n--- 维度反推 ---')
const dims = inferVariantDims(mv)
t('2 个维度', dims.length === 2, JSON.stringify(dims))
t('颜色 kind=color', dims[0].kind === 'color')
t('尺码 kind=size', dims[1].kind === 'size')
t('维度值去重', dims[0].values.length === 2)

console.log('\n--------------------------------')
console.log(`通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
