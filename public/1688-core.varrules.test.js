/* 变体配图新规则测试
 *
 * 用户需求（2026-10-26 17:40）：
 *   「只要我点了 探测变体图，只要点的就采集出来。没有点的就不要出来。
 *     你之前的采集不准。」
 *
 * 核心断言：
 *   ① 没点过的变体 → 没有图（image='' , imageSource='none'）
 *   ② 序号对齐（A 方案）已彻底移除
 *   ③ 匹配必须准确：宁可匹配不上，也不能配错
 *   ④ 一张探测图只能配给一个变体（不能重复用）
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const CORE = path.join(__dirname, '1688-core.js')
const code = fs.readFileSync(CORE, 'utf8')

let pass = 0, fail = 0
const t = (n, ok, extra) => {
  if (ok) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra ?? '') }
}

function makeSandbox() {
  const el = () => ({
    tagName: 'DIV', className: '', innerText: '', textContent: '', children: [],
    getAttribute: () => '', querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, parentElement: null, previousElementSibling: null,
    getBoundingClientRect: () => ({ width: 10, height: 10 }),
  })
  const win = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: {
      body: el(), documentElement: el(),
      querySelectorAll: () => [], querySelector: () => null,
      addEventListener: () => {}, removeEventListener: () => {},
    },
    location: { href: 'https://detail.1688.com/offer/123.html' },
    navigator: { userAgent: 'test' },
    fetch: async () => ({ ok: false, text: async () => '' }),
    URL, URLSearchParams, TextEncoder, TextDecoder,
    MutationObserver: class { observe() {} disconnect() {} },
  }
  win.window = win
  const sandbox = vm.createContext(win)
  vm.runInContext(code, sandbox, { filename: '1688-core.js' })
  return sandbox.FF1688
}

const P = n => `https://cbu01.alicdn.com/img/ibank/O1CN01${n}!!1.jpg`

console.log('\n[① 没点过 → 不出图]')
{
  const FF = makeSandbox()
  const variants = [
    { color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' },
    { color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: '' },
    { color: '古巴砂', specs: [{ name: '颜色', value: '古巴砂' }], image: '' },
  ]
  const st = FF.assignVariantImages(variants, [P('A'), P('B'), P('C')])
  t('matched = 0', st.matched === 0, JSON.stringify(st))
  t('aligned = 0（序号对齐已移除）', st.aligned === 0, JSON.stringify(st))
  t('skipped = 3', st.skipped === 3, JSON.stringify(st))
  t('三个变体都无图', variants.every(v => !v.image), JSON.stringify(variants.map(v => v.image)))
  t('来源都是 none', variants.every(v => v.imageSource === 'none'), JSON.stringify(variants.map(v => v.imageSource)))
  t('图集没被消耗', variants[0].image !== P('A'))
}

console.log('\n[② 点过的才有图]')
{
  const FF = makeSandbox()
  FF.setVariantCapture({ '艾青绿': P('GREEN') }, { '艾青绿': '颜色' })
  const variants = [
    { color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' },
    { color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: '' },
  ]
  const st = FF.assignVariantImages(variants, [P('A'), P('B')])
  t('matched = 1', st.matched === 1, JSON.stringify(st))
  t('点过的那个配上了', variants[1].image === P('GREEN'), variants[1].image)
  t('来源 = probe', variants[1].imageSource === 'probe', variants[1].imageSource)
  t('没点过的无图', variants[0].image === '', variants[0].image)
  t('没点过的来源 = none', variants[0].imageSource === 'none', variants[0].imageSource)
}

console.log('\n[③ 宁可匹配不上，也不配错]')
{
  const FF = makeSandbox()
  // 探测记的是 "深灰"，变体有 "P064深灰" 和 "P064深灰蓝" 两个都包含它
  FF.setVariantCapture({ '深灰': P('DG') }, { '深灰': '颜色' })
  const variants = [
    { color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }], image: '' },
    { color: 'P064深灰蓝', specs: [{ name: '颜色', value: 'P064深灰蓝' }], image: '' },
  ]
  const st = FF.assignVariantImages(variants, [])
  t('两个都包含「深灰」→ 判为不确定', st.matched === 0, JSON.stringify(st))
  t('没有变体被错配', variants.every(v => !v.image), JSON.stringify(variants.map(v => v.image)))
}

console.log('\n[④ 包含匹配：唯一时仍能命中]')
{
  const FF = makeSandbox()
  FF.setVariantCapture({ 'BMZ160丁香紫': P('PURPLE') }, { 'BMZ160丁香紫': '颜色' })
  const variants = [{ color: '丁香紫', specs: [{ name: '颜色', value: '丁香紫' }], image: '' }]
  const st = FF.assignVariantImages(variants, [])
  t('包含关系命中', st.matched === 1, JSON.stringify(st))
  t('图正确', variants[0].image === P('PURPLE'), variants[0].image)
}

console.log('\n[⑤ 一张探测图只配一个变体]')
{
  const FF = makeSandbox()
  FF.setVariantCapture({ '艾青绿': P('GREEN') }, { '艾青绿': '颜色' })
  // 两个变体的值都能包含「艾青绿」
  const variants = [
    { color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: '' },
    { color: '艾青绿(加厚)', specs: [{ name: '颜色', value: '艾青绿(加厚)' }], image: '' },
  ]
  const st = FF.assignVariantImages(variants, [])
  t('只配了 1 个', st.matched === 1, JSON.stringify(st))
  const withImg = variants.filter(v => v.image)
  t('只有 1 个变体拿到图', withImg.length === 1, JSON.stringify(variants.map(v => v.image)))
  t('图是探测到的那张', withImg[0].image === P('GREEN'), withImg[0].image)
}

console.log('\n[⑥ 变体自带图仍然优先，不被覆盖]')
{
  const FF = makeSandbox()
  FF.setVariantCapture({ '艾青绿': P('GREEN') }, { '艾青绿': '颜色' })
  const variants = [{ color: '艾青绿', specs: [{ name: '颜色', value: '艾青绿' }], image: P('OWN') }]
  FF.assignVariantImages(variants, [])
  t('自带图保留', variants[0].image === P('OWN'), variants[0].image)
}

console.log('\n[⑦ 完全不探测 → 全部无图（不猜）]')
{
  const FF = makeSandbox()
  const variants = [
    { color: '红色', specs: [{ name: '颜色', value: '红色' }], image: '' },
    { color: '蓝色', specs: [{ name: '颜色', value: '蓝色' }], image: '' },
  ]
  const st = FF.assignVariantImages(variants, [P('A'), P('B')])
  t('matched = 0', st.matched === 0, JSON.stringify(st))
  t('都没图', variants.every(v => !v.image), JSON.stringify(variants.map(v => v.image)))
}

console.log('\n[⑧ 探测值多候选：色卡短文字也能对上规格表完整值]')
{
  const FF = makeSandbox()
  // 色卡上只写「深灰」，规格表里是「P064深灰」
  FF.setVariantCapture({ '深灰': P('DG') }, { '深灰': '颜色' })
  const variants = [{ color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }], image: '' }]
  const st = FF.assignVariantImages(variants, [])
  t('色卡「深灰」能匹配规格表「P064深灰」', st.matched === 1, JSON.stringify(st))
  t('图正确', variants[0].image === P('DG'), variants[0].image)
}

console.log('\n[⑨ 探测值带备注/前缀也能对上]')
{
  const FF = makeSandbox()
  FF.setVariantCapture({ 'P064深灰 已有1000件': P('A') }, { 'P064深灰 已有1000件': '颜色' })
  const v1 = [{ color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }], image: '' }]
  t('剥掉「已有1000件」后命中', FF.assignVariantImages(v1, []).matched === 1, JSON.stringify(v1))

  const FF2 = makeSandbox()
  FF2.setVariantCapture({ '颜色 深灰': P('B') }, { '颜色 深灰': '颜色' })
  const v2 = [{ color: '深灰', specs: [{ name: '颜色', value: '深灰' }], image: '' }]
  t('按空白切段后命中', FF2.assignVariantImages(v2, []).matched === 1, JSON.stringify(v2))
}

console.log('\n[⑩ 候选值机制不破坏「宁可配错也不配」]')
{
  const FF = makeSandbox()
  // 色卡「灰」会同时包含于「P064深灰」和「P064浅灰」→ 应判为不确定
  FF.setVariantCapture({ '灰': P('GREY') }, { '灰': '颜色' })
  const variants = [
    { color: 'P064深灰', specs: [{ name: '颜色', value: 'P064深灰' }], image: '' },
    { color: 'P064浅灰', specs: [{ name: '颜色', value: 'P064浅灰' }], image: '' },
  ]
  const st = FF.assignVariantImages(variants, [])
  t('两个变体都包含 → 不配', st.matched === 0, JSON.stringify(st))
  t('都没被错配', variants.every(v => !v.image), JSON.stringify(variants.map(v => v.image)))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail === 0 ? 0 : 1)
