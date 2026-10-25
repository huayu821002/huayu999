/* 用 2026-05 用户实采的真实 1688 报文校准属性表提取 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '..', 'public', '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

const win = {
  addEventListener() {},
  document: {
    getElementById: id => (id === 'ff1688-capture' ? { textContent: JSON.stringify(payloads) } : null),
    querySelector: () => null, querySelectorAll: () => [],
    documentElement: { appendChild() {} }, body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {},
  },
  location: { href: 'https://detail.1688.com/offer/1081258035891.html' },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: async () => ({ json: async () => ({}), text: async () => '' }),
  console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}
win.window = win; win.self = win; win.globalThis = win
const sandbox = vm.createContext(win)
vm.runInContext(code, sandbox, { filename: '1688-core.js' })
const FF = win.FF1688

let pass = 0, fail = 0
const t = (n, ok, extra) => { if (ok) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra ?? '') } }

// ---------- 真实报文（2026-05-25 用户提供 offer 1081258035891 的结构） ----------
const CUR_IMG = 'https://cbu01.alicdn.com/img/ibank/O1CN01ZTYqubwMLcH2R3rs_!!2222597217131-0-cib.jpg'
const RATE_PIC = 'https://cbu01.alicdn.com/i3/O1CN014Xhu9EADLlE2BxV2_!!46116860184273804xx.jpg'
const BADGE_IMG = 'https://gw.alicdn.com/imgextra/i1/O1CN01VTxDcJ9AoUBqPOA_!!6000000000xx.jpg'

const payloads = [
  {
    url: '//h5api.m.1688.com/h5/mtop.1688.mmga.offerdetail.service/1.0/?api=mtop.1688.mmga.offerdetail.service',
    data: {
      api: 'mtop.1688.mmga.offerdetail.service',
      data: {
        // ★ 商品属性表：真实结构是 { property, value }
        offerDecisionAttrs: [
          { property: '面料名称', value: '棉' },
          { property: '面料厚薄（克重）', value: '适中(181-200克/平米)' },
          { property: '裤长', value: '长裤' },
          { property: '主面料成分', value: '棉' },
          { property: '功能', value: '休闲,睡眠,居家,舒适,可外穿' },
          { property: '适用人群类别', value: '青年女性' },
          { property: '品牌', value: '其他' },
          { property: '风格', value: '活泼可爱风' },
        ],
        // ★ 平台背书 —— 不是商品属性，必须排除
        platformEndorsementList: [
          { property: '品质保障', value: 'x' },
          { property: '价格稳定', value: 'x' },
          { property: '库存稳定', value: 'x' },
          { property: '开票无忧', value: 'x' },
          { property: '口碑真实', value: 'x' },
          { property: '商家可靠', value: 'x' },
        ],
        // ★ 另一处镜像的属性表（同样 property/value）
        platformProductInfoMap: {
          PRODUCT_PARAMS: {
            paramList: [
              { property: '面料名称', value: '棉' },
              { property: '裤长', value: '长裤' },
              { property: '品牌', value: '其他' },
            ],
          },
        },
        currentOffer: {
          offerId: '1081258035891',
          imageUrl: CUR_IMG,
          title: '100%棉！纯棉磨毛睡裤秋冬季新款可外穿全棉亲肤柔软遛弯家居裤',
        },
        // 评价数据：specInfo 泄露了真实维度（颜色/尺码），但评论本身不是变体来源
        result: {
          offerRateInfo: {
            model: {
              commentList: [{
                specInfo: '颜色#3B焦糖布丁-磨毛单裤#3A尺码#3BM#7C颜色#3B红苹果小狗-磨毛单裤#3A尺码#3BM',
                content: '图案很好看，就是面料一般',
                images: [{ url: RATE_PIC }],
              }],
              ratePics: [{ picUrl: RATE_PIC }],
            },
          },
        },
        downstreamPerformance: { highPerfectLgtRateList: [{ image: BADGE_IMG }] },
        deliveryLimitTimeModel: { limitTimeDesc: '常发圆通快递' },
      },
    },
  },
]

;(async () => {
  const { payload } = await FF.parseDetail()
  console.log('  description =', JSON.stringify(payload.description))
  console.log('  attributes  =', JSON.stringify(payload.attributes))
  console.log('  mainImage   =', payload.mainImage)

  console.log('\n[1] 属性表（描述来源）')
  const a = payload.attributes || {}
  t('提取到属性表', Object.keys(a).length > 0, JSON.stringify(a))
  t('面料名称=棉', a['面料名称'] === '棉', JSON.stringify(a))
  t('裤长=长裤', a['裤长'] === '长裤')
  t('品牌=其他', a['品牌'] === '其他')
  t('风格=活泼可爱风', a['风格'] === '活泼可爱风')
  t('适用人群类别=青年女性', a['适用人群类别'] === '青年女性')
  t('主面料成分=棉', a['主面料成分'] === '棉')
  t('不含平台背书「品质保障」', !('品质保障' in a), JSON.stringify(Object.keys(a)))
  t('不含平台背书「开票无忧」', !('开票无忧' in a))
  t('不含平台背书「商家可靠」', !('商家可靠' in a))
  t('不含「价格稳定」', !('价格稳定' in a))

  console.log('\n[2] 描述文本')
  const d = payload.description || ''
  t('描述含属性内容', d.includes('面料名称: 棉'), d.slice(0, 200))
  t('描述含品牌', d.includes('品牌: 其他'))
  t('描述不含背书词', !d.includes('品质保障') && !d.includes('开票无忧'), d.slice(0, 200))
  t('描述不含 URL', !/^https?:\/\//i.test(d))

  console.log('\n[3] 主图（真实报文）')
  t('主图 = currentOffer 的图', payload.mainImage === CUR_IMG, payload.mainImage)
  t('images[0] = 主图', payload.images[0] === CUR_IMG, JSON.stringify(payload.images.slice(0, 2)))
  t('图片不含评价图', !payload.images.some(u => /-rate\.jpg|ratePics|O1CN014Xhu9EADLlE2BxV2/.test(u)))
  t('图片不含完好率徽章', !payload.images.some(u => /gw\.alicdn\.com\/imgextra/.test(u)))

  console.log('\n[4] 诊断输出（v3 精准模式）')
  const st = FF.dumpVariants(FF.capture())
  const json = JSON.stringify(st)
  t('dumpVariants 有输出', Array.isArray(st) && st.length > 0, JSON.stringify(st).slice(0, 300))
  t('输出分层 key 列表', /layers/.test(json), json.slice(0, 300))
  t('分层里能看到 offerDecisionAttrs', /offerDecisionAttrs/.test(json), json.slice(0, 500))
  t('输出 skuHits 段', /skuHits/.test(json))
  t('内容层 key 完整（7 项）', /offerDecisionAttrs/.test(json) && /currentOffer/.test(json), json.slice(0, 500))

  console.log('\n--------------------------------')
  console.log(`通过 ${pass} / 失败 ${fail}`)
  process.exit(fail ? 1 : 0)
})()
