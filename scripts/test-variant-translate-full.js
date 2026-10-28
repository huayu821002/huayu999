/* 变体翻译必须**完整输出**，不截取、不省略
 *
 * 用户 2026-10-26 18:27：
 *   「一键翻译，变体规格名称 还是全部翻译，不要截取字节。整个都输出。
 *     前面是让你截取精简，我现在是让你不要省略，全部输出来」
 *
 * 验证点：
 *   ① 括号里的补充说明要保留（"均码【双面锦纶】" → 完整英文）
 *   ② 长文本不截断
 *   ③ 型号前缀保留（P064）
 *   ④ 维度名完整翻译
 *   ⑤ 首字母大写仍然生效（显示优化，不是截断）
 */
const fs = require('fs')
const path = require('path')
const { transform } = require('sucrase')

const ROOT = path.join(__dirname, '..')
let currentDir = ROOT
const req = id => {
  let file = null
  if (id.startsWith('@/')) {
    file = path.join(ROOT, id.slice(2))
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + '.ts')) file += '.ts'
      else if (fs.existsSync(file + '/index.ts')) file += '/index.ts'
    }
  } else if (id.startsWith('.')) {
    file = path.resolve(currentDir, id)
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + '.ts')) file += '.ts'
      else if (fs.existsSync(file + '/index.ts')) file += '/index.ts'
    }
    if (!fs.existsSync(file)) return require(path.resolve(currentDir, id))
  } else {
    return require(id)
  }
  const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code
  const m = { exports: {} }
  const prev = currentDir
  currentDir = path.dirname(file)
  try {
    new Function('module', 'exports', 'require', code)(m, m.exports, req)
  } finally {
    currentDir = prev
  }
  return m.exports
}

const VT = req('./lib/variantTranslate.ts')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

/* 假翻译器：不联网，映射固定 */
const MAP = {
  '均码【双面锦纶】': 'one size fits all [double-sided nylon]',
  '深灰': 'dark gray',
  '颜色': 'color',
  '尺码': 'size',
  '材质': 'material',
  '加大加厚防滑防摔运动健身跑步机家用椭圆机踏板': 'extra thick non-slip shock absorbing home fitness elliptical machine pedal',
}
const fake = async (s) => MAP[s] || ('[EN]' + s)

;(async () => {
  console.log('\n[① 括号里的补充说明要保留（不砍）]')
  {
    const out = await VT.translateVariantValue('均码【双面锦纶】', fake)
    console.log('  out =', JSON.stringify(out))
    t('★ 完整输出，没有砍括号', out === 'One Size Fits All [Double-Sided Nylon]', JSON.stringify(out))
    t('★ 长度没有被截到 24 以内', out.length > 24, String(out.length))
  }

  console.log('\n[② 型号前缀保留]')
  {
    const out = await VT.translateVariantValue('P064深灰', fake)
    console.log('  out =', JSON.stringify(out))
    t('★ P064 保留', out === 'P064 Dark Gray', JSON.stringify(out))
  }

  console.log('\n[③ 长文本不截断]')
  {
    const src = '加大加厚防滑防摔运动健身跑步机家用椭圆机踏板'
    const out = await VT.translateVariantValue(src, fake)
    console.log('  out =', JSON.stringify(out))
    t('★ 完整输出', out.indexOf('Elliptical Machine Pedal') > 0, JSON.stringify(out))
    t('★ 没有省略号', out.indexOf('…') < 0 && out.indexOf('...') < 0, JSON.stringify(out))
  }

  console.log('\n[④ 维度名完整翻译]')
  {
    const out = await VT.translateVariantName('颜色', fake)
    console.log('  out =', JSON.stringify(out))
    t('★ 颜色 → Color', out === 'Color', JSON.stringify(out))
    const out2 = await VT.translateVariantName('材质', fake)
    t('★ 材质 → Material', out2 === 'Material', JSON.stringify(out2))
  }

  console.log('\n[⑤ specs 整组翻译]')
  {
    const out = await VT.translateVariantSpecs([
      { name: '颜色', value: '深灰' },
      { name: '尺码', value: '均码【双面锦纶】' },
    ], fake)
    console.log('  out =', JSON.stringify(out))
    t('★ 维度名与值都翻译且完整',
      out[0].name === 'Color' && out[0].value === 'Dark Gray' &&
      out[1].name === 'Size' && out[1].value === 'One Size Fits All [Double-Sided Nylon]',
      JSON.stringify(out))
  }

  console.log('\n[⑥ 采集品变体 + 维度定义整体翻译]')
  {
    const variants = [
      { skuId: '1', specs: [{ name: '颜色', value: '深灰' }, { name: '尺码', value: '均码【双面锦纶】' }], color: '深灰', size: '均码【双面锦纶】', specText: '深灰 / 均码【双面锦纶】', price: 10 },
      { skuId: '2', specs: [{ name: '颜色', value: '红色' }], color: '红色', price: 11 },
    ]
    const dims = [{ name: '颜色', kind: 'color', values: ['深灰', '红色'] }]
    const r = await VT.translateSupplierVariants(variants, dims, fake)
    console.log('  variants =', JSON.stringify(r.variants.map(v => ({ name: v.name, value: v.value, color: v.color }))))
    console.log('  dims =', JSON.stringify(r.dims))
    t('★ 变体 name 是维度名', r.variants[0].name === 'Color / Size', JSON.stringify(r.variants[0].name))
    t('★ 变体 value 完整（不截断）',
      r.variants[0].value === 'Dark Gray / One Size Fits All [Double-Sided Nylon]', JSON.stringify(r.variants[0].value))
    t('★ 维度名翻译', r.dims[0].name === 'Color', JSON.stringify(r.dims[0].name))
    t('★ 维度值全部翻译', JSON.stringify(r.dims[0].values) === JSON.stringify(['Dark Gray', 'Red']), JSON.stringify(r.dims[0].values))
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  process.exit(fail === 0 ? 0 : 1)
})()
