/**
 * Fiestaflare 1688 采集内核（纯前端，页面上下文运行）
 *
 * 暴露 window.FF1688 = {
 *   install(): 在页面上下文挂钩 fetch / XMLHttpRequest，截获 1688 自己的接口返回
 *   capture(): 读取截获到的 JSON
 *   parseDetail(): 解析商品详情页
 *   parseSearch(): 解析搜索/列表页
 *   push(payload, token): 推送到 Fiestaflare
 * }
 *
 * 设计要点：
 *  1) 不猜 DOM 结构 —— 优先用页面自己请求到的接口数据（mtop/offer 相关 JSON）
 *  2) 每个字段都做「多候选 + 启发式打分」择优
 *  3) 把最有价值的原始数据一并回传，便于服务端事后校正字段映射
 */
(function () {
  'use strict'
  if (window.FF1688 && window.FF1688.__v) return

  const API = 'https://fiestaflare.com'
  const CAPTURE_ID = 'ff1688-capture'

  const clean = s => (s || '').replace(/\s+/g, ' ').trim()
  const num = s => {
    if (s === null || s === undefined) return null
    const m = String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/)
    if (!m) return null
    const v = parseFloat(m[0])
    return Number.isFinite(v) ? v : null
  }
  const isImageUrl = u =>
    typeof u === 'string' &&
    /\.(jpg|jpeg|png|webp)(\?|$)/i.test(u) &&
    /alicdn|1688|cbu/i.test(u)

  /* ---------------------------------------------------------- 截获接口返回 */
  const STORE = { payloads: [], installed: false }

  function pushCapture(url, data) {
    if (!data || typeof data !== 'object') return
    const u = (url || '').toLowerCase()
    if (!/offer|detail|mtop|item|search|product|seller|company/.test(u)) return
    STORE.payloads.push({ url: String(url).slice(0, 300), data })
    if (STORE.payloads.length > 30) STORE.payloads.shift()
    flush()
  }

  function flush() {
    try {
      const el = document.getElementById(CAPTURE_ID) || (() => {
        const d = document.createElement('script')
        d.type = 'application/json'
        d.id = CAPTURE_ID
        ;(document.head || document.documentElement).appendChild(d)
        return d
      })()
      el.textContent = JSON.stringify(STORE.payloads)
    } catch (e) {}
  }

  function install() {
    if (STORE.installed) return
    STORE.installed = true

    const origFetch = window.fetch
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args)
      try {
        p.then(res => {
          const url = (res && res.url) || (args[0] && args[0].url) || ''
          res.clone().text().then(txt => {
            if (!txt || txt.length > 400000) return
            if (txt.charCodeAt(0) !== 123 && txt.charCodeAt(0) !== 91) return
            try { pushCapture(url, JSON.parse(txt)) } catch (e) {}
          }).catch(() => {})
        }).catch(() => {})
      } catch (e) {}
      return p
    }

    const XHR = window.XMLHttpRequest
    const origOpen = XHR.prototype.open
    const origSend = XHR.prototype.send
    XHR.prototype.open = function (method, url, ...rest) {
      this.__ffUrl = url
      return origOpen.call(this, method, url, ...rest)
    }
    XHR.prototype.send = function (...args) {
      this.addEventListener('load', function () {
        try {
          const url = this.__ffUrl || this.responseURL || ''
          const txt = this.responseText
          if (!txt || txt.length > 400000) return
          if (txt.charCodeAt(0) !== 123 && txt.charCodeAt(0) !== 91) return
          pushCapture(url, JSON.parse(txt))
        } catch (e) {}
      })
      return origSend.apply(this, args)
    }
  }

  function capture() {
    const payloads = []
    try {
      const el = document.getElementById(CAPTURE_ID)
      if (el && el.textContent) {
        const arr = JSON.parse(el.textContent)
        if (Array.isArray(arr)) payloads.push(...arr)
      }
    } catch (e) {}
    if (!payloads.length) payloads.push(...STORE.payloads)
    return payloads
  }

  /**
   * 补抓：页面已加载完、hook 没赶上时，
   * 从 performance 资源列表里找出 1688 自己的接口 URL，重新请求一遍（同源带 cookie）。
   */
  async function replayResources(limit = 8) {
    const out = []
    let urls = []
    try {
      urls = performance
        .getEntriesByType('resource')
        .map(e => e.name)
        .filter(u => /mtop|offer|detail|search/i.test(u))
        .filter(u => /1688\.com|alicdn\.com/.test(u))
        .filter(u => !/\.(png|jpg|jpeg|webp|css|js)(\?|$)/i.test(u))
    } catch (e) {}
    urls = Array.from(new Set(urls)).slice(-limit)

    await Promise.all(
      urls.map(async u => {
        try {
          const res = await fetch(u, { credentials: 'include' })
          if (!res.ok) return
          const txt = await res.text()
          if (!txt || txt.charCodeAt(0) !== 123 && txt.charCodeAt(0) !== 91) return
          out.push({ url: String(u).slice(0, 300), data: JSON.parse(txt) })
        } catch (e) {}
      })
    )
    return out
  }

  /* ------------------------------------------------------------- 深度搜索 */
  function walk(node, fn, depth = 0, seen = new Set()) {
    if (!node || depth > 12 || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, fn, depth + 1, seen)
      return
    }
    for (const k of Object.keys(node)) {
      fn(k, node[k], node)
      walk(node[k], fn, depth + 1, seen)
    }
  }

  /** 收集所有 key 命中且值像目标的候选 */
  function candidates(payloads, keyList, validate) {
    const out = []
    const want = keyList.map(k => k.toLowerCase())
    for (const p of payloads) {
      walk(p.data, (k, v, parent) => {
        if (!want.includes(String(k).toLowerCase())) return
        if (validate && !validate(v, parent)) return
        out.push({ value: v, parent, url: p.url })
      })
    }
    return out
  }

  function pickTitle(payloads) {
    const c = candidates(payloads, ['offerTitle', 'offerSubject', 'subject', 'title', 'productTitle', 'productName', 'name', 'offerName'], v =>
      typeof v === 'string' && v.trim().length >= 4 && v.trim().length <= 200
    )
    if (!c.length) return ''
    const scored = c.map(x => {
      let s = 0
      const v = String(x.value)
      if (/[一-龥]/.test(v)) s += 3
      if (v.length >= 8 && v.length <= 80) s += 2
      if (/offer|subject|title/i.test(x.url)) s += 1
      if (/广告|批发|厂家直销|新款/.test(v)) s += 1
      return { v, s }
    })
    scored.sort((a, b) => b.s - a.s)
    return clean(scored[0].v)
  }

  function pickPrices(payloads) {
    let lo = null
    let hi = null

    // 1) 明确的 min/max 字段
    const mins = candidates(payloads, ['priceMin', 'minPrice', 'lowPrice', 'startPrice', 'minPriceWithoutTax', 'priceStart'], v => num(v) !== null)
    const maxs = candidates(payloads, ['priceMax', 'maxPrice', 'highPrice', 'endPrice', 'priceEnd'], v => num(v) !== null)
    if (mins.length) lo = Math.min(...mins.map(x => num(x.value)))
    if (maxs.length) hi = Math.max(...maxs.map(x => num(x.value)))

    // 2) 区间字符串 "1.20-3.50" / "¥1.20 ~ ¥3.50"
    if (lo === null || hi === null) {
      const ranges = candidates(payloads, ['priceRange', 'price', 'priceText', 'priceDesc', 'priceInfo', 'minPriceDesc'], v => typeof v === 'string' && /[\d.]+\s*[-~至]\s*[\d.]+/.test(v))
      for (const r of ranges) {
        const m = String(r.value).match(/([\d.]+)\s*[-~至]\s*([\d.]+)/)
        if (m) {
          const a = parseFloat(m[1]); const b = parseFloat(m[2])
          if (lo === null || a < lo) lo = a
          if (hi === null || b > hi) hi = b
        }
      }
    }

    // 3) 单值价格
    if (lo === null) {
      const singles = candidates(payloads, ['price', 'priceValue', 'salePrice', 'showPrice', 'priceAmount'], v => num(v) !== null)
      if (singles.length) {
        const vals = singles.map(x => num(x.value))
        lo = Math.min(...vals)
        hi = Math.max(...vals)
      }
    }
    return { lo, hi }
  }

  function pickImages(payloads) {
    const imgs = []
    const seen = new Set()
    const add = u => {
      if (!isImageUrl(u)) return
      const url = u.replace(/^\/\//, 'https://').split('?')[0]
      // 去掉 60x60 之类的小图后缀
      const big = url.replace(/_\d+x\d+(xz)?\.(jpg|jpeg|png|webp)$/i, '.$1')
      const final = big.replace(/(\.jpg|\.jpeg|\.png|\.webp)$/i, '$1')
      if (!seen.has(final)) {
        seen.add(final)
        imgs.push(final)
      }
    }

    // 优先专门的图片数组字段
    const lists = candidates(payloads, ['offerImgList', 'imageList', 'images', 'imgList', 'mainImages', 'offerImages', 'galleryImages', 'imageUrlList', 'imagesArr'], v => Array.isArray(v) && v.length)
    for (const l of lists) {
      const arr = l.value
      for (const it of arr) {
        if (typeof it === 'string') add(it)
        else if (it && typeof it === 'object') {
          const u = it.url || it.imgUrl || it.imageUrl || it.path || it.src || it.img || it.originalUrl
          if (u) add(u)
        }
      }
    }
    // 任意字符串里含图片地址的
    for (const p of payloads) {
      walk(p.data, (k, v) => {
        if (typeof v === 'string' && isImageUrl(v)) add(v)
      })
    }
    return imgs.slice(0, 30)
  }

  function pickMoq(payloads) {
    const c = candidates(payloads, ['beginAmount', 'moq', 'minOrderQuantity', 'minOrderQty', 'beginCount', 'saleMinCount', 'moqQuantity'], v => num(v) !== null)
    if (!c.length) return null
    const vals = c.map(x => num(x.value)).filter(v => v > 0 && v < 100000)
    return vals.length ? Math.min(...vals) : null
  }

  function pickSupplier(payloads) {
    const c = candidates(payloads, ['companyName', 'sellerName', 'supplierName', 'memberId', 'sellerNick', 'companyNick', 'loginName', 'supplierLogin'], v =>
      typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 80
    )
    if (!c.length) return ''
    const scored = c.map(x => {
      let s = 0
      const v = String(x.value)
      if (/公司|厂|有限|贸易|义乌/.test(v)) s += 3
      if (v.length >= 4 && v.length <= 40) s += 1
      if (/company|seller|member/i.test(x.url)) s += 1
      return { v, s }
    })
    scored.sort((a, b) => b.s - a.s)
    return clean(scored[0].v)
  }

  function pickDescription(payloads) {
    const c = candidates(payloads, ['description', 'offerDescription', 'detail', 'detailHtml', 'desc', 'introduction'], v =>
      typeof v === 'string' && v.length > 30
    )
    if (!c.length) return ''
    let best = ''
    for (const x of c) if (String(x.value).length > best.length) best = String(x.value)
    return best.slice(0, 40000)
  }

  function pickSku(payloads) {
    const c = candidates(payloads, ['skuMap', 'skuMapInfo', 'skuProps', 'skuList', 'skuModel', 'saleProp', 'skuPropsList'], v =>
      v && typeof v === 'object'
    )
    if (!c.length) return undefined
    try {
      return JSON.stringify(c[0].value).slice(0, 12000)
    } catch (e) {
      return undefined
    }
  }

  function pickAttributes(payloads) {
    const c = candidates(payloads, ['props', 'attributes', 'offerProps', 'productAttributes', 'propertyList', 'baseProps'], v =>
      v && typeof v === 'object' && !Array.isArray(v)
    )
    if (!c.length) return undefined
    try {
      const obj = c[0].value
      const flat = {}
      for (const k of Object.keys(obj).slice(0, 60)) flat[k] = obj[k]
      return flat
    } catch (e) {
      return undefined
    }
  }

  function pickPriceTiers(payloads) {
    const c = candidates(payloads, ['priceRangeList', 'priceTiers', 'stepPrice', 'priceList', 'skuPriceList', 'priceTierList'], v => Array.isArray(v) && v.length)
    if (!c.length) return undefined
    try {
      return JSON.stringify(c[0].value).slice(0, 8000)
    } catch (e) {
      return undefined
    }
  }

  /* ------------------------------------------------------------ DOM 兜底 */
  function domFallback() {
    const out = { title: '', priceMin: null, priceMax: null, moq: null, images: [], supplierName: '', description: '' }
    const t = document.querySelector('h1.d-title, .title-text, .offer-title, h1')
    if (t) out.title = clean(t.innerText || t.textContent)
    const ps = Array.from(document.querySelectorAll('[class*="price"]')).map(e => e.innerText || '').filter(Boolean)
    for (const txt of ps) {
      const m = txt.match(/([\d.]+)\s*[-~至]\s*([\d.]+)/)
      if (m) {
        out.priceMin = out.priceMin ?? parseFloat(m[1])
        out.priceMax = out.priceMax ?? parseFloat(m[2])
      } else {
        const n = num(txt)
        if (n !== null && out.priceMin === null) out.priceMin = n
      }
    }
    const mo = document.querySelector('[class*="moq"], [class*="beginAmount"], [class*="min-order"]')
    if (mo) out.moq = num(mo.innerText || mo.textContent)
    const cp = document.querySelector('[class*="company-name"], [class*="companyName"]')
    if (cp) out.supplierName = clean(cp.innerText || cp.textContent)
    out.images = Array.from(document.querySelectorAll('img'))
      .map(i => i.getAttribute('src') || i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || '')
      .filter(isImageUrl)
      .map(s => s.replace(/^\/\//, 'https://').split('?')[0])
      .slice(0, 30)
    const d = document.querySelector('.desc-lazyload-container, .detail-content, #content, [class*="detail-desc"]')
    if (d) out.description = (d.innerHTML || '').slice(0, 30000)
    return out
  }

  /* --------------------------------------------------------------- 解析 */
  async function parseDetail() {
    const url = location.href
    const offerId = (url.match(/offer\/(\d+)/) || [])[1] || ''
    let payloads = capture()
    let replayed = 0
    if (payloads.length < 2) {
      // hook 没赶上（控制台方案常见）→ 重放页面自己的接口请求
      const extra = await replayResources()
      replayed = extra.length
      payloads = payloads.concat(extra)
    }
    const dom = domFallback()

    const title = pickTitle(payloads) || dom.title
    const { lo, hi } = pickPrices(payloads)
    const images = pickImages(payloads)
    const domImages = dom.images
    const merged = Array.from(new Set([...(images.length ? images : domImages), ...domImages]))

    const payload = {
      source: '1688',
      sourceId: offerId,
      sourceUrl: url,
      title: title || `1688 商品 ${offerId}`,
      description: pickDescription(payloads) || dom.description || '',
      images: merged.slice(0, 30),
      priceMin: lo ?? dom.priceMin ?? null,
      priceMax: hi ?? dom.priceMax ?? dom.priceMin ?? null,
      moq: pickMoq(payloads) ?? dom.moq ?? null,
      unit: '件',
      skuText: pickSku(payloads),
      attributes: pickAttributes(payloads),
      supplierName: pickSupplier(payloads) || dom.supplierName || undefined,
      shippingText: '以 1688 页面实际为准',
      priceTiers: pickPriceTiers(payloads),
      raw: {
        offerId,
        url,
        collectedAt: new Date().toISOString(),
        capturedCount: payloads.length,
        replayed,
        capturedUrls: payloads.slice(0, 20).map(p => p.url),
        snapshot: payloads.slice(0, 3).map(p => ({ url: p.url, data: p.data })),
      },
    }
    return { payload, debug: { captured: payloads.length, replayed, dom } }
  }

  async function parseSearch() {
    const items = []
    const seen = new Set()
    const links = Array.from(document.querySelectorAll('a[href*="detail.1688.com/offer/"], a[href*="/offer/"]'))
    for (const a of links) {
      const href = a.href || ''
      const m = href.match(/offer\/(\d+)/)
      if (!m) continue
      const id = m[1]
      if (seen.has(id)) continue
      seen.add(id)
      const card = a.closest('[class*="offer-card"], [class*="offer-item"], [class*="sm-offer"], li') || a
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

    // DOM 没抓到 → 用接口数据重建
    if (!items.length) {
      const payloads = capture()
      const extra = payloads.length ? payloads : await replayResources()
      for (const p of extra) {
        walk(p.data, (k, v) => {
          if (typeof k !== 'string' || !/offerid|offerId|id/i.test(k)) return
          if (typeof v !== 'string' || !/^\d{8,}$/.test(v)) return
          if (seen.has(v)) return
          seen.add(v)
          items.push({
            source: '1688',
            sourceId: v,
            sourceUrl: `https://detail.1688.com/offer/${v}.html`,
            title: pickTitle([p]) || `1688 商品 ${v}`,
            priceMin: pickPrices([p]).lo,
            images: pickImages([p]).slice(0, 3),
            raw: { offerId: v, from: 'api', srcUrl: p.url, collectedAt: new Date().toISOString() },
          })
        })
      }
    }

    return { payload: items, debug: { count: items.length } }
  }

  /* --------------------------------------------------------------- 推送 */
  async function push(payload, token, api) {
    const base = api || API
    const body = Array.isArray(payload) ? { items: payload } : { data: payload }
    const res = await fetch(base + '/api/import/1688', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch (e) {}
    return { status: res.status, json, text }
  }

  window.FF1688 = {
    __v: '2.0.0',
    install,
    capture,
    replayResources,
    parseDetail,
    parseSearch,
    push,
    api: API,
  }
})()
