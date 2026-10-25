/* 回归：domVariants 不能把「重量/库存/销量」当成价格
 *
 * 真实 bug（2026-10-25，offer 1059632648130 遮阳帽）：
 *   商品真实价 ¥14.49，采集入库的 6 个变体价格全是 **132**
 *   根因：1688 规格价格表里没有「价格」表头 → 老代码从右往左找纯数字列
 *        → 抓到了「重量 132g」那一列
 *
 * 修复：① 跳过 数量/库存/重量/销量 等列
 *      ② 候选价必须落在已知价格区间内（±宽松倍数）
 *      ③ 都不满足 → 留空（用商品价兜底），不猜
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') }
}

/** 造一张规格表 */
function makeTable(headCells, rows) {
  const trs = []
  trs.push({
    querySelectorAll: sel => (sel === 'td,th' ? headCells.map(x => ({ innerText: x, textContent: x })) : []),
  })
  for (const r of rows) {
    trs.push({
      querySelectorAll: sel =>
        sel === 'td,th'
          ? r.map(x => ({ innerText: String(x ?? ''), textContent: String(x ?? '') }))
          : [],
    })
  }
  return { querySelectorAll: sel => (sel === 'tr' ? trs : []) }
}

/** 跑内核里的 domVariants(guard) */
function runDomVariants(tables, guard) {
  const sandbox = {
    document: {
      querySelectorAll: sel => (sel === 'table' ? tables : []),
      querySelector: () => null,
    },
    location: { href: 'https://detail.1688.com/offer/1059632648130.html' },
    console,
    setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {} },
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.FF1688.domVariants(guard)
}

/** 跑内核里的 dumpSpecTable() */
function sandboxDump(tables) {
  const sandbox = {
    document: {
      querySelectorAll: sel => (sel === 'table' ? tables : []),
      querySelector: () => null,
    },
    location: { href: 'https://detail.1688.com/offer/1059632648130.html' },
    console, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {} },
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.FF1688.dumpSpecTable()
}

console.log('\n[domVariants 价格列识别]')

// ① 老 bug 场景：表头只有 颜色/尺码/重量，最后一列是 132（重量）
{
  const tbl = makeTable(
    ['颜色', '尺码', '重量'],
    [
      ['BMZ160丁香紫', '成人女士均码', '132'],
      ['BMZ160艾青绿', '成人女士均码', '132'],
    ]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('重量列 132 不被当成价格', vs.length === 2 && vs.every(v => v.price === null),
    JSON.stringify(vs.map(v => v.price)))
  t('重量列的行仍被保留（规格不丢）', vs.length === 2 && vs[0].specs.length === 2)
}

// ② 表头有「价格」→ 正常取
{
  const tbl = makeTable(
    ['颜色', '尺码', '价格'],
    [
      ['红色', 'M', '13.2'],
      ['蓝色', 'L', '15.5'],
    ]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('表头「价格」列正常解析', vs.length === 2 && vs[0].price === 13.2 && vs[1].price === 15.5,
    JSON.stringify(vs.map(v => v.price)))
}

// ③ 表头「价格」但值超出区间（真·异常）→ 拒绝
{
  const tbl = makeTable(
    ['颜色', '价格'],
    [['红色', '99999']]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('超出区间的价格被拒绝', vs.length === 1 && vs[0].price === null,
    JSON.stringify(vs.map(v => v.price)))
}

// ④ 「库存」列在价格列右边 → 不能抢走
{
  const tbl = makeTable(
    ['颜色', '价格', '库存'],
    [
      ['红色', '13.2', '999'],
      ['蓝色', '15.5', '888'],
    ]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('库存列不抢价格', vs.length === 2 && vs[0].price === 13.2 && vs[1].price === 15.5,
    JSON.stringify(vs.map(v => v.price)))
}

// ⑤ 区间价 "13.2-15.5" → 取下界
{
  const tbl = makeTable(
    ['颜色', '价格'],
    [['红色', '13.2-15.5']]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('区间价取下界', vs.length === 1 && vs[0].price === 13.2, JSON.stringify(vs.map(v => v.price)))
}

// ⑥ 无 guard（区间未知）→ 仍不抓「重量」列
{
  const tbl = makeTable(
    ['颜色', '重量'],
    [['红色', '132']]
  )
  const vs = runDomVariants([tbl], null)
  t('无区间时也不抓重量列', vs.length === 1 && vs[0].price === null,
    JSON.stringify(vs.map(v => v.price)))
}

// ⑦ 无价格列、无 guard、但列名是「售价」→ 应该取
{
  const tbl = makeTable(
    ['颜色', '售价'],
    [['红色', '13.2']]
  )
  const vs = runDomVariants([tbl], null)
  t('「售价」列能取到价', vs.length === 1 && vs[0].price === 13.2, JSON.stringify(vs.map(v => v.price)))
}

// ⑧ 带 ¥/元/起 后缀的单元格（1688 常见）
{
  const tbl = makeTable(
    ['颜色', '价格'],
    [['红色', '¥13.50起'], ['蓝色', '13.50元']]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('「¥13.50起」取到 13.5', vs.length === 2 && vs[0].price === 13.5, JSON.stringify(vs.map(v => v.price)))
  t('「13.50元」取到 13.5', vs.length === 2 && vs[1].price === 13.5, JSON.stringify(vs.map(v => v.price)))
}

// ⑨ 单元格含「件/起批」→ 不是价格
{
  const tbl = makeTable(
    ['颜色', '价格'],
    [['红色', '2件起批'], ['蓝色', '已售132件']]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('「2件起批」「已售132件」都不当价格', vs.length === 2 && vs.every(v => v.price === null),
    JSON.stringify(vs.map(v => v.price)))
}

// ⑩ 区间上限 6 倍：80 接受、132 拒绝
{
  const tbl = makeTable(
    ['颜色', '价格'],
    [['红色', '80']]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('6 倍内的价（80）接受', vs.length === 1 && vs[0].price === 80, JSON.stringify(vs.map(v => v.price)))
}
{
  const tbl = makeTable(
    ['颜色', '价格'],
    [['红色', '132']]
  )
  const vs = runDomVariants([tbl], { lo: 14.49, hi: 14.49 })
  t('6 倍外的价（132）拒绝', vs.length === 1 && vs[0].price === null, JSON.stringify(vs.map(v => v.price)))
}

// ⑪ dumpSpecTable 能吐出表头
{
  const tbl = makeTable(
    ['颜色', '尺码', '重量', '价格'],
    [['红色', 'M', '132', '13.5']]
  )
  const dump = sandboxDump([tbl])
  t('dumpSpecTable 返回表头', Array.isArray(dump) && dump.length === 1 && dump[0].head.length === 4,
    JSON.stringify(dump))
}

console.log(`\n通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
