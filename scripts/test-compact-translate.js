/* 精简截取 + 变体翻译 测试（lib/compact.ts + lib/variantTranslate.ts） */
const fs = require('fs')
const path = require('path')
const { transform } = require('sucrase')

const ROOT = path.join(__dirname, '..')
// 当前正在加载的模块目录（用于解析相对导入 './xxx'）
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
    // 相对路径 → 相对于当前模块目录
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
  const dir = path.dirname(file)
  const prevDir = currentDir
  currentDir = dir
  try {
    new Function('module', 'exports', 'require', code)(m, m.exports, req)
  } finally {
    currentDir = prevDir
  }
  return m.exports
}

const compact = req('@/lib/compact')
const vt = req('@/lib/variantTranslate')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

console.log('\n[stripBrackets 砍掉括号补充]')
t('方括号被砍', compact.stripBrackets('One size fits all [double-sided nylon]') === 'One size fits all', compact.stripBrackets('One size fits all [double-sided nylon]'))
t('中文方括号被砍', compact.stripBrackets('均码【双面锦纶】') === '均码', compact.stripBrackets('均码【双面锦纶】'))
t('圆括号被砍', compact.stripBrackets('Red (Bright)') === 'Red', compact.stripBrackets('Red (Bright)'))
t('没括号的不动', compact.stripBrackets('P064 Dark Gray') === 'P064 Dark Gray')

console.log('\n[titleCase 首字母大写]')
t('普通词大写', compact.titleCase('dark gray') === 'Dark Gray', compact.titleCase('dark gray'))
t('全大写缩写不变', compact.titleCase('PVC bag') === 'PVC Bag', compact.titleCase('PVC bag'))
t('编号段保持', compact.titleCase('P064 dark gray') === 'P064 Dark Gray', compact.titleCase('P064 dark gray'))
t('UV 不变', compact.titleCase('uv protection') === 'UV Protection', compact.titleCase('uv protection'))

console.log('\n[truncateWords 词边界截断]')
t('不超长不动', compact.truncateWords('Short Value', 24) === 'Short Value')
t('超长在词边界截', compact.truncateWords('One size fits all double sided nylon', 20) === 'One size fits all…', compact.truncateWords('One size fits all double sided nylon', 20))
t('不切半个单词', !compact.truncateWords('abcdefghij klmnop', 8).includes('fghij'), compact.truncateWords('abcdefghij klmnop', 8))

console.log('\n[compactVariantValue 变体值精简]')
t('长值被砍到 ≤24', compact.compactVariantValue('One size fits all [double-sided nylon]').length <= 24, compact.compactVariantValue('One size fits all [double-sided nylon]'))
t('砍后是 One Size Fits All', compact.compactVariantValue('One size fits all [double-sided nylon]') === 'One Size Fits All', compact.compactVariantValue('One size fits all [double-sided nylon]'))
t('短值只大写', compact.compactVariantValue('P064 dark gray') === 'P064 Dark Gray', compact.compactVariantValue('P064 dark gray'))
t('型号前缀不丢', compact.compactVariantValue('P064 dark gray').startsWith('P064'), compact.compactVariantValue('P064 dark gray'))
t('M 保留', compact.compactVariantValue('M') === 'M')
t('空值', compact.compactVariantValue('') === '')

console.log('\n[compactVariantName]')
t('颜色→Color', compact.compactVariantName('颜色') === '颜色', '字典在 variantI18n 里')
t('超长名被截', compact.compactVariantName('some very long specification name here').length <= 20)

console.log('\n[compactTitle / Desc]')
t('标题超长被截', compact.compactTitle('a'.repeat(200)).length <= 121, compact.compactTitle('a'.repeat(200)).length)
t('标题短不动', compact.compactTitle('Short Title') === 'Short Title')
t('短描述超长被截', compact.compactShortDesc('b'.repeat(300)).length <= 161)
t('描述按句截断', compact.compactDesc('Sentence one. Sentence two. ' + 'c'.repeat(3000)).length <= 2001)

console.log('\n[splitCodePrefix 拆型号前缀]')
t('P064深灰 → P064 + 深灰', JSON.stringify(vt.splitCodePrefix('P064深灰')) === JSON.stringify({ prefix: 'P064', rest: '深灰' }), JSON.stringify(vt.splitCodePrefix('P064深灰')))
t('纯中文不拆', vt.splitCodePrefix('深灰').prefix === '', JSON.stringify(vt.splitCodePrefix('深灰')))
t('纯英文不拆', vt.splitCodePrefix('Dark Gray').prefix === '', JSON.stringify(vt.splitCodePrefix('Dark Gray')))
t('M 不拆', vt.splitCodePrefix('M').prefix === '')

console.log('\n[translateVariantValue 翻译变体值]')
const fakeTr = async s => {
  const map = { '深灰': 'dark gray', '浅灰': 'light gray', '粉色': 'pink', '黑色': 'black', '均码【双面锦纶】': 'One size fits all [double-sided nylon]' }
  return map[s] || ('EN:' + s)
}
;(async () => {
  t('P064深灰 → P064 Dark Gray', (await vt.translateVariantValue('P064深灰', fakeTr)) === 'P064 Dark Gray', await vt.translateVariantValue('P064深灰', fakeTr))
  t('值长度 ≤24', (await vt.translateVariantValue('均码【双面锦纶】', fakeTr)).length <= 24, await vt.translateVariantValue('均码【双面锦纶】', fakeTr))
  t('无中文不翻译', (await vt.translateVariantValue('P064 Dark Gray', fakeTr)) === 'P064 Dark Gray')

  console.log('\n[translateSupplierVariants 整组翻译]')
  const variants = [
    { specs: [{ name: '颜色', value: 'P064深灰' }, { name: '规格', value: '均码【双面锦纶】' }], color: 'P064深灰', size: '均码【双面锦纶】', specText: 'P064深灰 / 均码【双面锦纶】', price: 3.59, image: 'https://x/a.jpg' },
  ]
  const dims = [{ name: '颜色', kind: 'color', values: ['P064深灰', 'P064浅灰'] }]
  const r = await vt.translateSupplierVariants(variants, dims, fakeTr)
  t('specs[0].name = Color', r.variants[0].specs[0].name === 'Color', r.variants[0].specs[0].name)
  t('specs[0].value = P064 Dark Gray', r.variants[0].specs[0].value === 'P064 Dark Gray', r.variants[0].specs[0].value)
  t('specs[1].value 被精简', r.variants[0].specs[1].value.length <= 24, r.variants[0].specs[1].value)
  t('dims[0].name = Color', r.dims[0].name === 'Color', r.dims[0].name)
  t('dims[0].values 已翻译', r.dims[0].values[0] === 'P064 Dark Gray', JSON.stringify(r.dims[0].values))
  t('price 保留', r.variants[0].price === 3.59)
  t('image 保留', r.variants[0].image === 'https://x/a.jpg')
  t('color 同步', r.variants[0].color === 'P064 Dark Gray', r.variants[0].color)
  t('specText 同步', typeof r.variants[0].specText === 'string' && !/[一-龥]/.test(r.variants[0].specText), r.variants[0].specText)
  t('没有残留中文', !/[一-龥]/.test(JSON.stringify(r.variants)), JSON.stringify(r.variants).slice(0, 200))

  console.log('\n通过 ' + pass + ' / 失败 ' + fail)
  process.exit(fail === 0 ? 0 : 1)
})()
