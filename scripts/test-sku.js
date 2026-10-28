/* SKU 生成规则测试（2026-10-28）
 * 规则：FCY + MMDD + 1688 原货号；没有原货号 → 随机 5 位数
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const OUT = '/tmp/sku-test'
execSync(
  `npx tsc lib/sku.ts --outDir ${OUT} --module commonjs --target es2019 --esModuleInterop --skipLibCheck`,
  { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
)
execSync(
  `npx tsc lib/batchOps.ts --outDir ${OUT} --module commonjs --target es2019 --esModuleInterop --skipLibCheck`,
  { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
)
const S = require(path.join(OUT, 'sku.js'))

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

// 2026-09-10 12:00 Asia/Shanghai → MMDD = 0910
const sep10 = new Date('2026-09-10T04:00:00.000Z')   // UTC 12:00
// 2026-01-05 00:30 Asia/Shanghai → MMDD = 0105
const jan5 = new Date('2026-01-04T16:30:00.000Z')

console.log('\n[① 日期部分 MMDD]')
t('9月10号 → 0910', S.skuDatePart(sep10) === '0910', S.skuDatePart(sep10))
t('1月5号 → 0105', S.skuDatePart(jan5) === '0105', S.skuDatePart(jan5))
t('12月31号 → 1231', S.skuDatePart(new Date('2026-12-31T04:00:00Z')) === '1231', S.skuDatePart(new Date('2026-12-31T04:00:00Z')))
t('两位补零（3月7号 → 0307）', S.skuDatePart(new Date('2026-03-07T04:00:00Z')) === '0307', S.skuDatePart(new Date('2026-03-07T04:00:00Z')))

console.log('\n[② 有原货号 → FCY+日期+原货号]')
t('FCY0910ABC123', S.buildSku('ABC123', { date: sep10 }) === 'FCY0910ABC123', S.buildSku('ABC123', { date: sep10 }))
t('带横杠的货号保留', S.buildSku('AB-12_CD', { date: sep10 }) === 'FCY0910AB-12_CD', S.buildSku('AB-12_CD', { date: sep10 }))
t('原货号里的空格被去掉', S.buildSku('AB 12', { date: sep10 }) === 'FCY0910AB12', S.buildSku('AB 12', { date: sep10 }))
t('原货号里的中文被去掉', S.buildSku('原货号ABC', { date: sep10 }) === 'FCY0910ABC', S.buildSku('原货号ABC', { date: sep10 }))

console.log('\n[③ 无原货号 → 随机 5 位数]')
{
  const sku = S.buildSku(null, { date: sep10, rand: () => 0.12345 })
  t('格式 FCY0910 + 5 位', /^FCY0910\d{5}$/.test(sku), sku)
  t('长度 12（FCY3 + MMDD4 + 5位）', sku.length === 12, String(sku.length))
  const sku2 = S.buildSku('', { date: sep10, rand: () => 0.98765 })
  t('空字符串同样处理', /^FCY0910\d{5}$/.test(sku2), sku2)
  const sku3 = S.buildSku(undefined, { date: sep10, rand: () => 0.5 })
  t('undefined 同样处理', /^FCY0910\d{5}$/.test(sku3), sku3)
}

console.log('\n[④ 时区：UTC 凌晨也不能差一天]')
{
  // 2026-09-09 23:30 UTC = 2026-09-10 07:30 Asia/Shanghai → 必须是 0910
  const d = new Date('2026-09-09T23:30:00Z')
  t('UTC 9/9 23:30 → 上海 9/10', S.skuDatePart(d) === '0910', S.skuDatePart(d))
}

console.log('\n[⑤ 变体批量：必须互不重复]')
{
  const r = () => 0.5
  const list = S.buildUniqueSkus(['A1', 'A1', 'A1', null, null, 'B2'], { date: sep10, rand: r })
  console.log('  ', list.join(' | '))
  t('全部唯一', new Set(list).size === list.length, JSON.stringify(list))
  t('重复货号加后缀', /^FCY0910A1-2$/.test(list[1]), list[1])
  t('第三个重复再加后缀', /^FCY0910A1-3$/.test(list[2]), list[2])
  t('无货号的是随机 5 位', /^FCY0910\d{5}$/.test(list[3]), list[3])
  t('有货号的正常', list[5] === 'FCY0910B2', list[5])
}

console.log('\n[⑥ 发布时选 SKU：旧版自动预填值要被忽略]')
{
  const item = { sourceSkuId: '1083056771985', sourceId: '1083056771985' }
  t('不填 → 新规则生成', /^FCY\d{4}1083056771985$/.test(S.pickPublishSku(undefined, item)), S.pickPublishSku(undefined, item))
  t('空串 → 新规则生成', /^FCY\d{4}1083056771985$/.test(S.pickPublishSku('', item)), S.pickPublishSku('', item))
  t('预填 1688-{sourceId} → 忽略并重新生成',
    /^FCY\d{4}1083056771985$/.test(S.pickPublishSku('1688-1083056771985', item)),
    S.pickPublishSku('1688-1083056771985', item))
  t('预填 sourceSkuId 本身 → 忽略并重新生成',
    /^FCY\d{4}1083056771985$/.test(S.pickPublishSku('1083056771985', item)),
    S.pickPublishSku('1083056771985', item))
  t('用户手填的其它值 → 保留', S.pickPublishSku('MY-CUSTOM-SKU', item) === 'MY-CUSTOM-SKU', S.pickPublishSku('MY-CUSTOM-SKU', item))
  t('无原货号 → 随机 5 位',
    /^FCY\d{4}\d{5}$/.test(S.pickPublishSku('', { sourceSkuId: null, sourceId: '999' })),
    S.pickPublishSku('', { sourceSkuId: null, sourceId: '999' }))
}

console.log('\n[⑦ 批量重生成 SKU（batchSku）]')
{
  const { batchSku, parseVariants } = require(path.join(OUT, 'batchOps.js'))
  const product = {
    sku: '1688-1083056771985',
    sourceSkuId: '1083056771985',
    variants: JSON.stringify([
      { id: 'v1', name: 'Color', value: '红色', sku: null },
      { id: 'v2', name: 'Color', value: '蓝色', sku: null },
    ]),
  }
  const r = batchSku(product, { variants: true, date: sep10 }, { buildSku: S.buildSku, buildUniqueSkus: S.buildUniqueSkus })
  t('商品 SKU 按新规则', /^FCY0910\d+$/.test(r.sku), r.sku)
  t('用上了原货号', r.sku === 'FCY09101083056771985', r.sku)
  t('变体 SKU 也生成了', r.variantSkus.length === 2, JSON.stringify(r.variantSkus))
  t('变体 SKU 互不相同', new Set(r.variantSkus).size === 2, JSON.stringify(r.variantSkus))
  t('变体 SKU 格式对', r.variantSkus.every(x => /^FCY0910\d{5}$/.test(x)), JSON.stringify(r.variantSkus))
  t('changed = true', r.changed === true)

  // 无原货号 → 随机 5 位
  const r2 = batchSku({ sku: 'x', sourceSkuId: null, variants: null }, { variants: false, date: sep10 }, { buildSku: S.buildSku, buildUniqueSkus: S.buildUniqueSkus })
  t('无原货号 → 随机 5 位', /^FCY0910\d{5}$/.test(r2.sku), r2.sku)
  t('variants=false 不生成变体 SKU', r2.variantSkus.length === 0, JSON.stringify(r2.variantSkus))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
