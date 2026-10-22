// ==UserScript==
// @name         Fiestaflare 1688 采集器
// @namespace    fiestaflare
// @version      1.0.0
// @description  在 1688 商品页/搜索页一键采集商品数据并推送到 Fiestaflare 独立站后台
// @author       Fiestaflare
// @match        *://detail.1688.com/offer/*
// @match        *://m.1688.com/offer/*
// @match        *://*.1688.com/offer/*
// @match        *://s.1688.com/selloffer/*
// @match        *://*.1688.com/selloffer/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      fiestaflare.com
// @connect      www.fiestaflare.com
// ==/UserScript==

(function () {
  'use strict'

  const API = GM_getValue('ff_api', 'https://fiestaflare.com')
  const TOKEN_KEY = 'ff_token'

  // ---------------------------------------------------------------- utils
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const num = (s) => {
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
      try {
        if (window[n]) out.push(window[n])
      } catch (e) {}
    }
    // 扫描所有 script 里的 JSON-LD
    for (const s of $$('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(s.textContent)
        out.push(parsed)
      } catch (e) {}
    }
    return out
  }

  function pickImagesFrom(obj) {
    const imgs = []
    const seen = new Set()
    const push = (u) => {
      if (!u || typeof u !== 'string') return
      const url = u
        .replace(/^\/\//, 'https://')
        .split('?')[0]
      if (/alicdn|1688/.test(url) && /\.(jpg|jpeg|png|webp)$/i.test(url)) {
        if (!seen.has(url)) {
          seen.add(url)
          imgs.push(url)
        }
      }
    }
    const walk = (node, depth) => {
      if (!node || depth > 6) return
      if (Array.isArray(node)) {
        node.forEach(n => walk(n, depth + 1))
        return
      }
      if (typeof node === 'string') {
        push(node)
        return
      }
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

  // ------------------------------------------------------------- parsers
  function parseDetailPage() {
    const url = location.href
    const offerId = (url.match(/offer\/(\d+)/) || [])[1] || ''
    const globals = collectJsonGlobals()

    let title = ''
    let priceMin = null
    let priceMax = null
    let moq = null
    let supplierName = ''
    let description = ''
    let images = []
    let skuText = ''
    let attributes = {}
    let priceTiers = null

    for (const g of globals) {
      const t = deepFind(g, ['title', 'offerTitle', 'subject', 'subjectName'])
      if (!title && typeof t === 'string') title = clean(t)

      const lo = deepFind(g, ['priceMin', 'lowPrice', 'minPrice', 'price', 'priceStart'])
      if (priceMin === null && lo !== null) priceMin = num(lo)

      const hi = deepFind(g, ['priceMax', 'highPrice', 'maxPrice'])
      if (priceMax === null && hi !== null) priceMax = num(hi)

      const m = deepFind(g, ['moq', 'beginAmount', 'minOrderQuantity', 'moqQuantity'])
      if (moq === null && m !== null) moq = num(m)

      const s = deepFind(g, ['companyName', 'sellerName', 'supplierName', 'memberId'])
      if (!supplierName && typeof s === 'string') supplierName = clean(s)

      const d = deepFind(g, ['description', 'offerDescription', 'detail', 'desc'])
      if (!description && typeof d === 'string' && d.length > 20) description = d

      const imgs = pickImagesFrom(g)
      if (imgs.length > images.length) images = imgs

      const skus = deepFind(g, ['skuMap', 'skuMapInfo', 'skuProps', 'skuList', 'skuModel'])
      if (!skuText && skus) skuText = JSON.stringify(skus).slice(0, 8000)

      const attrs = deepFind(g, ['props', 'attributes', 'offerProps', 'productAttributes'])
      if (attrs && typeof attrs === 'object') attributes = attrs

      const tiers = deepFind(g, ['priceRange', 'priceTiers', 'stepPrice', 'priceList'])
      if (!priceTiers && tiers) priceTiers = tiers
    }

    // ---- DOM 兜底
    if (!title) {
      const domTitle = $('h1.d-title') || $('.title-text') || $('h1') || $('.d-title')
      title = clean(domTitle && (domTitle.innerText || domTitle.textContent))
    }
    if (priceMin === null) {
      const p = $('.price-text') || $('.price') || $('[class*="price"]')
      priceMin = num(p && (p.innerText || p.textContent))
    }
    if (!moq) {
      const mo = $('.moq') || $('[class*="moq"]') || $('[class*="beginAmount"]')
      moq = num(mo && (mo.innerText || mo.textContent))
    }
    if (!description) {
      const d = $('.desc-lazyload-container') || $('.detail-content') || $('#content')
      description = d ? (d.innerHTML || '').slice(0, 20000) : ''
    }
    if (!supplierName) {
      const c = $('.company-name') || $('[class*="company"]')
      supplierName = clean(c && (c.innerText || c.textContent))
    }
    if (images.length === 0) {
      images = $$('.od-gallery img, .gallery img, img.detail-img, [class*="gallery"] img')
        .map(i => i.getAttribute('src') || i.getAttribute('data-src') || '')
        .map(s => s.replace(/^\/\//, 'https://').split('?')[0])
        .filter(s => /alicdn/.test(s))
    }
    images = Array.from(new Set(images)).slice(0, 20)

    // 价格阶梯
    let tiers = null
    const tierText = $('.price-records, [class*="price-item"], [class*="price-range"]')
    if (tierText) {
      const rows = Array.isArray(tierText) ? tierText : $$(tierText.selector || '.price-item')
      const parsed = rows.map(r => {
        const txt = (r.innerText || '').replace(/\s+/g, ' ')
        const p = num(txt)
        const q = num((txt.match(/(\d+)\s*(件|个|套|pcs|pieces)/i) || [])[1])
        if (p && q) return { minQty: q, maxQty: null, price: p }
        return null
      }).filter(Boolean)
      if (parsed.length) tiers = parsed
    }
    if (!tiers && priceTiers && typeof priceTiers === 'object') tiers = priceTiers

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
      priceTiers: tiers || undefined,
      raw: { offerId, url, collectedAt: new Date().toISOString() },
    }
  }

  function parseSearchPage() {
    const cards = $$('[class*="offer-card"], [class*="sm-offer"], .offer-list [class*="item"]')
    const items = []
    const seen = new Set()

    const links = $$('a[href*="detail.1688.com/offer/"], a[href*="/offer/"]')
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

  // ---------------------------------------------------------------- push
  function pushToSite(payload) {
    const token = GM_getValue(TOKEN_KEY, '')
    if (!token) {
      alert('请先在面板里填写 Fiestaflare 管理员 Token（后台 → 采集助手 页面可复制）')
      return Promise.resolve({ ok: false, error: 'no token' })
    }
    const body = Array.isArray(payload) ? { items: payload } : { data: payload }
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${API}/api/import/1688`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: JSON.stringify(body),
        onload: r => {
          let parsed = null
          try { parsed = JSON.parse(r.responseText) } catch (e) {}
          if (r.status >= 200 && r.status < 300) {
            resolve({ ok: true, data: parsed })
          } else {
            resolve({ ok: false, error: `HTTP ${r.status}`, detail: r.responseText && r.responseText.slice(0, 200) })
          }
        },
        onerror: () => resolve({ ok: false, error: 'network error' }),
      })
    })
  }

  // ----------------------------------------------------------------- UI
  function createPanel() {
    if ($('#ff1688-panel')) return
    const panel = document.createElement('div')
    panel.id = 'ff1688-panel'
    panel.innerHTML = `
      <style>
        #ff1688-panel{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#222;border:1px solid #ddd;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);width:300px;overflow:hidden}
        #ff1688-panel .hd{background:#ff6b35;color:#fff;padding:8px 10px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
        #ff1688-panel .bd{padding:10px;display:block}
        #ff1688-panel.collapsed .bd{display:none}
        #ff1688-panel input{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ccc;border-radius:6px;margin:4px 0 8px}
        #ff1688-panel button{background:#ff6b35;color:#fff;border:0;border-radius:6px;padding:7px 10px;cursor:pointer;margin-right:6px;margin-bottom:6px}
        #ff1688-panel button.ghost{background:#eee;color:#333}
        #ff1688-panel .st{font-size:12px;color:#666;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;margin-top:6px}
      </style>
      <div class="hd"><span>Fiestaflare 采集器</span><span class="tg">－</span></div>
      <div class="bd">
        <div>API 地址</div>
        <input id="ff-api" value="${API}" />
        <div>管理员 Token</div>
        <input id="ff-token" type="password" placeholder="后台采集助手页面复制" />
        <button id="ff-save" class="ghost">保存设置</button>
        <div style="margin-top:8px">
          <button id="ff-detail">采集当前商品</button>
          <button id="ff-list" class="ghost">采集本页列表</button>
        </div>
        <div class="st" id="ff-st">就绪</div>
      </div>`
    document.body.appendChild(panel)

    const st = $('#ff-st', panel)
    const say = m => { st.textContent = m }
    const isDetail = /detail\.1688\.com|m\.1688\.com|\/offer\/\d+/.test(location.href)
    const isList = /selloffer|search/.test(location.href)

    $('#ff-token', panel).value = GM_getValue(TOKEN_KEY, '')
    $('#ff-save', panel).onclick = () => {
      GM_setValue(TOKEN_KEY, $('#ff-token', panel).value.trim())
      GM_setValue('ff_api', $('#ff-api', panel).value.trim())
      say('已保存')
    }
    $('.hd', panel).onclick = () => {
      panel.classList.toggle('collapsed')
      $('.tg', panel).textContent = panel.classList.contains('collapsed') ? '＋' : '－'
    }

    const detailBtn = $('#ff-detail', panel)
    const listBtn = $('#ff-list', panel)
    if (!isDetail) detailBtn.style.display = 'none'
    if (!isList) listBtn.style.display = 'none'

    detailBtn.onclick = async () => {
      say('解析中…')
      const data = parseDetailPage()
      say(`标题: ${data.title}\n价格: ${data.priceMin}\n起订: ${data.moq}\n图片: ${data.images.length}\n推送中…`)
      const r = await pushToSite(data)
      say(r.ok ? `✅ 已导入 (${r.data && r.data.imported})\n${JSON.stringify(data).slice(0, 300)}` : `❌ ${r.error}\n${r.detail || ''}`)
    }

    listBtn.onclick = async () => {
      say('解析列表…')
      const items = parseSearchPage()
      if (!items.length) { say('本页没抓到商品链接'); return }
      say(`抓到 ${items.length} 条，推送中…`)
      const r = await pushToSite(items)
      say(r.ok ? `✅ 已导入 ${r.data && r.data.imported} 条` : `❌ ${r.error}\n${r.detail || ''}`)
    }
  }

  window.addEventListener('load', () => setTimeout(createPanel, 800))
  if (document.readyState === 'complete') setTimeout(createPanel, 800)
})()
