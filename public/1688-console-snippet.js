/**
 * Fiestaflare 1688 采集 —— 控制台版（无需安装任何浏览器扩展）
 *
 * 用法：
 *  1. 登录 1688，打开商品详情页 https://detail.1688.com/offer/xxxx.html
 *  2. 按 F12 打开控制台 → Console
 *  3. 粘贴本脚本全部内容 → 回车（Chrome 首次需先输入 allow pasting 回车）
 *  4. 输入 Fiestaflare 管理员 Token 回车
 *  5. 控制台会打印采集结果；到后台「采集品库」查看
 *
 * 也可以在控制台直接执行：copy(ffCollectorText) 复制本脚本
 */
(function () {
  'use strict'

  const API = 'https://fiestaflare.com'
  const clean = s => (s || '').replace(/\s+/g, ' ').trim()
  const num = s => {
    if (s === null || s === undefined) return null
    const m = String(s).replace(/,/g, '').match(/[\d.]+/)
    if (!m) return null
    const v = parseFloat(m[0])
    return Number.isFinite(v) ? v : null
  }

  function deepFind(root, keys, maxDepth = 8) {
    const want = keys.map(k => k.toLowerCase())
    let found = null
    const walk = (node, depth) => {
      if (found !== null || depth > maxDepth || node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        for (const item of node) walk(item, depth + 1)
        return
      }
      for (const key of Object.keys(node)) {
        if (found !== null) return
        if (want.includes(key.toLowerCase())) {
          const v = node[key]
          if (v !== null && v !== '' && typeof v !== 'object') {
            found = { key, value: v }
            return
          }
        }
      }
      for (const key of Object.keys(node)) {
        if (found !== null) return
        walk(node[key], depth + 1)
      }
    }
    walk(root, 0)
    return found ? found.value : null
  }

  function collectJsonGlobals() {
    const out = []
    const names = [
      '__INIT_DATA__', '__PAGE_DATA__', '__INITIAL_STATE__', '__DATA__',
      'offerData', '__OFFER_DATA__', 'detailData', 'iDetailData',
      '__GLOBAL_DATA__', '__NEXT_DATA__',
    ]
    for (const n of names) {
      try { if (window[n]) out.push(window[n]) } catch (e) {}
    }
    for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try { out.push(JSON.parse(s.textContent)) } catch (e) {}
    }
    return out
  }

  function pickImagesFrom(obj) {
    const imgs = [], seen = new Set()
    const push = u => {
      if (!u || typeof u !== 'string') return
      const url = u.replace(/^\/\//, 'https://').split('?')[0]
      if (/alicdn|1688/.test(url) && /\.(jpg|jpeg|png|webp)$/i.test(url) && !seen.has(url)) {
        seen.add(url); imgs.push(url)
      }
    }
    const walk = (node, depth) => {
      if (!node || depth > 6) return
      if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return }
      if (typeof node === 'string') { push(node); return }
      if (typeof node === 'object') {
        for (const k of Object.keys(node)) {
          const v = node[k]
          if (typeof v === 'string' && /image|img|pic|thumb/i.test(k)) push(v)
          else if (typeof v === 'object') walk(v, depth + 1)
        }
      }
    }
    walk(obj, 0)
    return imgs
  }

  function parseDetailPage() {
    const url = location.href
    const offerId = (url.match(/offer\/(\d+)/) || [])[1] || ''
    const globals = collectJsonGlobals()

    let title = '', description = '', supplierName = '', skuText = ''
    let priceMin = null, priceMax = null, moq = null, priceTiers = null
    let images = [], attributes = {}

    for (const g of globals) {
      const t = deepFind(g, ['title', 'offerTitle', 'subject', 'subjectName'])
      if (!title && typeof t === 'string') title = clean(t)
      const lo = deepFind(g, ['priceMin', 'lowPrice', 'minPrice', 'price', 'priceStart'])
      if (priceMin === null && lo !== null) priceMin = num(lo)
      const hi = deepFind(g, ['priceMax', 'highPrice', 'maxPrice'])
      if (priceMax === null && hi !== null) priceMax = num(hi)
      const m = deepFind(g, ['moq', 'beginAmount', 'minOrderQuantity', 'moqQuantity'])
      if (moq === null && m !== null) moq = num(m)
      const s = deepFind(g, ['companyName', 'sellerName', 'supplierName'])
      if (!supplierName && typeof s === 'string') supplierName = clean(s)
      const d = deepFind(g, ['description', 'offerDescription', 'detail', 'desc'])
      if (!description && typeof d === 'string' && d.length > 20) description = d
      const imgs = pickImagesFrom(g)
      if (imgs.length > images.length) images = imgs
      const skus = deepFind(g, ['skuMap', 'skuMapInfo', 'skuProps', 'skuList'])
      if (!skuText && skus) skuText = JSON.stringify(skus).slice(0, 8000)
      const attrs = deepFind(g, ['props', 'attributes', 'offerProps'])
      if (attrs && typeof attrs === 'object') attributes = attrs
      const tiers = deepFind(g, ['priceRange', 'priceTiers', 'stepPrice'])
      if (!priceTiers && tiers) priceTiers = tiers
    }

    const domTitle = document.querySelector('h1.d-title, .title-text, h1, .d-title')
    if (!title && domTitle) title = clean(domTitle.innerText || domTitle.textContent)
    const p = document.querySelector('.price-text, .price, [class*="price"]')
    if (priceMin === null && p) priceMin = num(p.innerText || p.textContent)
    const mo = document.querySelector('.moq, [class*="moq"], [class*="beginAmount"]')
    if (!moq && mo) moq = num(mo.innerText || mo.textContent)
    const dsc = document.querySelector('.desc-lazyload-container, .detail-content, #content')
    if (!description && dsc) description = (dsc.innerHTML || '').slice(0, 20000)
    const comp = document.querySelector('.company-name, [class*="company"]')
    if (!supplierName && comp) supplierName = clean(comp.innerText || comp.textContent)
    if (images.length === 0) {
      images = Array.from(document.querySelectorAll('.od-gallery img, .gallery img, img.detail-img, [class*="gallery"] img'))
        .map(i => i.getAttribute('src') || i.getAttribute('data-src') || '')
        .map(s => s.replace(/^\/\//, 'https://').split('?')[0])
        .filter(s => /alicdn/.test(s))
    }
    images = Array.from(new Set(images)).slice(0, 20)

    return {
      source: '1688',
      sourceId: offerId,
      sourceUrl: url,
      title: title || `1688 商品 ${offerId}`,
      description,
      images,
      priceMin,
      priceMax: priceMax ?? priceMin,
      moq,
      unit: '件',
      skuText: skuText || undefined,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      supplierName: supplierName || undefined,
      shippingText: '以 1688 页面实际为准',
      priceTiers: priceTiers || undefined,
      raw: { offerId, url, collectedAt: new Date().toISOString() },
    }
  }

  function parseSearchPage() {
    const items = [], seen = new Set()
    const links = Array.from(document.querySelectorAll('a[href*="detail.1688.com/offer/"], a[href*="/offer/"]'))
    for (const a of links) {
      const href = a.href || ''
      const m = href.match(/offer\/(\d+)/)
      if (!m) continue
      const id = m[1]
      if (seen.has(id)) continue
      seen.add(id)
      const card = a.closest('[class*="offer-card"], [class*="item"], li, div') || a
      const titleEl = card.querySelector('[class*="title"], [class*="subject"]') || a
      const priceEl = card.querySelector('[class*="price"]')
      const imgEl = card.querySelector('img')
      const moqEl = card.querySelector('[class*="moq"], [class*="begin"]')
      items.push({
        source: '1688',
        sourceId: id,
        sourceUrl: href.split('?')[0],
        title: clean((titleEl.innerText || titleEl.textContent || '').split('\n')[0]) || `1688 商品 ${id}`,
        priceMin: num(priceEl && (priceEl.innerText || priceEl.textContent)),
        moq: num(moqEl && (moqEl.innerText || moqEl.textContent)),
        images: imgEl ? [String(imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '').replace(/^\/\//, 'https://').split('?')[0]] : [],
        raw: { offerId: id, from: 'search-list', collectedAt: new Date().toISOString() },
      })
    }
    return items
  }

  async function push(payload, token) {
    const body = Array.isArray(payload) ? { items: payload } : { data: payload }
    const res = await fetch(API + '/api/import/1688', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch (e) {}
    return { status: res.status, json, text }
  }

  const token = (prompt('粘贴 Fiestaflare 管理员 Token（后台 → 采集品库 → 复制采集 Token）') || '').trim()
  if (!token) { console.warn('未提供 Token，已取消'); return }

  const isDetail = /\/offer\/\d+/.test(location.href)
  const payload = isDetail ? parseDetailPage() : parseSearchPage()
  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
    console.warn('没有解析到商品数据，请确认当前是商品详情页或搜索结果页')
    return
  }

  console.log('解析结果：', payload)
  push(payload, token)
    .then(r => {
      console.log('推送结果：', r.status, r.json || r.text)
      if (r.status === 200) console.log('✅ 采集成功，去后台「采集品库」查看')
      else if (r.status === 401) console.warn('❌ Token 无效或已过期，请重新复制')
      else console.warn('❌ 推送失败：', r.text)
    })
    .catch(e => console.error('推送异常：', e))
})()
