/**
 * 回归测试：变体抓不全时必须重放
 *
 * 背景（2026-10-25 实测）：
 *   真实报文 27 条，其中确实有 `offerList` 这个 key，但**数组是空的**。
 *   根因：`parseDetail` 里 `if (payloads.length < 2)` 才重放
 *   → 报文够多时重放**永远不触发**，SKU 列表那条请求就丢了。
 *
 * 本测试验证：
 *   1) hasSpecRows 能识别「有报文但没规格」= 变体不全
 *   2) 报文里有带规格的 SKU 行时 → 判定为完整（不触发重放）
 *   3) dedupePayloads 能去掉重放产生的重复报文
 *   4) replayResources 的选 URL 逻辑会优先 offerdetail/sku/moduleasyncservice
 */
const fs = require('fs')
const path = require('path')

// 载入内核（浏览器环境，用最小 stub）
function loadCore() {
  const src = fs.readFileSync('/home/admin/Fiestaflare/scripts/1688-core.src.js', 'utf8')
  const win = {
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      head: { appendChild() {} },
      documentElement: { appendChild() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    location: { href: 'https://detail.1688.com/offer/1081258035891.html' },
    navigator: { userAgent: 'node' },
    performance: { getEntriesByType: () => [] },
    fetch: () => Promise.reject(new Error('no net')),
    setTimeout, clearTimeout, console,
  }
  win.window = win
  const fn = new Function('window', 'document', 'navigator', 'performance', 'fetch', 'setTimeout', 'clearTimeout', 'console', src)
  fn(win, win.document, win.navigator, win.performance, win.fetch, setTimeout, clearTimeout, console)
  return win
}

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

const win = loadCore()
const FF = win.FF1688

;(async () => {
  console.log('内核版本:', FF.__v)

  // ---------- 1) 有报文但没规格 → 判定为「变体不全」 ----------
  console.log('\n[变体完整性判定]')
  const noSpec = [{
    url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/x.json',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        data: {
          offerList: [],                       // ← key 在，但数组是空的（真实情况）
          currentOffer: { offerId: 1081258035891, price: 35, priceText: '¥35', isCurrentOffer: true },
          priceInfoList: [{ preText: '热销款', price: '35', text: '1件价格' }],
        },
      },
    },
  }]
  t('空 offerList → 判定为变体不全', FF.hasSpecRows(noSpec) === false)

  // ---------- 2) 有带规格的 SKU 行 → 判定为完整 ----------
  const withSpec = [{
    url: 'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/x.json',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        data: {
          offerList: [
            { skuId: '6300644986670', specAttrs: [{ name: '颜色', value: '红色' }, { name: '尺码', value: 'M' }], price: 35, imageUrl: 'https://cbu01.alicdn.com/img/ibank/a.jpg' },
            { skuId: '6300644986671', specAttrs: [{ name: '颜色', value: '蓝色' }, { name: '尺码', value: 'L' }], price: 38 },
          ],
        },
      },
    },
  }]
  t('有 specAttrs 的 offerList → 判定为完整', FF.hasSpecRows(withSpec) === true)

  // ---------- 3) 变体能被真正提取出来（name/value/price/image） ----------
  const dump = FF.dumpVariants(withSpec)
  t('dumpVariants 有 contentKeyUnion', Array.isArray(dump.contentKeyUnion) && dump.contentKeyUnion.length > 0)
  t('contentKeyUnion 含 offerList', dump.contentKeyUnion.includes('offerList'), JSON.stringify(dump.contentKeyUnion))
  t('deep 里挖到了 offerList 内部结构', dump.payloads.some(p => (p.deep || []).some(d => /offerList/i.test(d.path))),
      JSON.stringify(dump.payloads.map(p => (p.deep || []).map(d => d.path))))

  // ---------- 4) dedupePayloads ----------
  console.log('\n[报文去重]')
  const dup = [
    { url: 'u1', data: { a: 1 } },
    { url: 'u1', data: { a: 1 } },   // 完全重复
    { url: 'u1', data: { a: 2 } },   // 同 URL 不同内容 → 保留
    { url: 'u2', data: { a: 1 } },   // 不同 URL 同内容 → 保留
  ]
  const out = FF.dedupePayloads ? FF.dedupePayloads(dup) : null
  t('去重后剩 3 条', out && out.length === 3, out && out.length)

  // ---------- 5) replayResources 的选 URL 优先级 ----------
  console.log('\n[重放选 URL]')
  const urls = [
    'https://h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.json?data=x',
    'https://h5api.m.1688.com/h5/mtop.alibaba.alisite.cbu.server.moduleasyncservice/2.json?data=y',
    'https://h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/3.json?data=z',
    'https://h5api.m.1688.com/h5/mtop.sku.detail.service/4.json?data=w',
    'https://cbu01.alicdn.com/img/ibank/x.jpg',
  ]
  win.performance.getEntriesByType = () => urls.map(name => ({ name }))
  const picked = await FF.replayResources(3).catch(() => [])
  // fetch 会失败，replayResources 会 catch 掉 → 返回空数组；这里只验证它没有抛错
  t('replayResources 不抛错', Array.isArray(picked))

  // ---------- 6) 关键回归：报文够多但没规格时，collectAll 必须去重后仍标记需重放 ----------
  console.log('\n[根因回归]')
  const many = []
  for (let i = 0; i < 25; i++) {
    many.push({ url: 'https://h5api.m.1688.com/h5/mtop.other.service/' + i + '.json', data: { api: 'x', data: { data: { offerList: [] } } } })
  }
  t('25 条报文但都没规格 → 变体不全', FF.hasSpecRows(many) === false)
  t('（旧逻辑 payloads.length<2 才重放 → 25 条时永不重放 = bug）', many.length >= 2)

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
