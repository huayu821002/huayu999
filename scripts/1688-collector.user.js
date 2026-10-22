// ==UserScript==
// @name         Fiestaflare 1688 采集器
// @namespace    fiestaflare
// @version      2.1.0
// @description  在 1688 商品页/搜索页一键采集商品数据并推送到 Fiestaflare 独立站后台
// @author       Fiestaflare
// @match        *://detail.1688.com/offer/*
// @match        *://m.1688.com/offer/*
// @match        *://*.1688.com/offer/*
// @match        *://s.1688.com/selloffer/*
// @match        *://*.1688.com/selloffer/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      fiestaflare.com
// @connect      www.fiestaflare.com
// ==/UserScript==

/* ================= 内核（内联，不依赖外部加载，避免被页面 CSP 拦截） ================= */
/**
 * Fiestaflare 1688 采集内核 v3（纯前端，页面上下文运行）
 *
 * 暴露 window.FF1688 = { install, capture, replayResources, parseDetail, parseSearch, push, api }
 *
 * v3 相比 v2 的改动：
 *  - 字段选择从「第一个匹配」改为 **key 名加权 + 值合理性打分**
 *    （v1/v2 的坑：商品标题取到了供应商公司名，价格取到了 1）
 *  - 价格优先取「区间字符串」和 min/max 配对，并排除 数量/运费/折扣 等噪声 key
 *  - 图片：过滤站点 logo/SVG/占位图，`.jpg_.webp` 归一为 `.jpg` 原图，主图优先
 *  - MOQ 支持 "2件起批" 这类字符串
 *  - raw.candidates 回传每个字段的候选与得分，便于服务端事后校正
 */
(function () { /* __FF1688_CORE__ */
  'use strict'
  if (window.FF1688 && window.FF1688.__v === '3.0.0') return

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
  const hasCJK = s => /[一-龥]/.test(String(s || ''))

  /* ---------------------------------------------------------- 截获接口返回 */
  const STORE = { payloads: [], installed: false }

  function pushCapture(url, data) {
    if (!data || typeof data !== 'object') return
    const u = (url || '').toLowerCase()
    if (!/offer|detail|mtop|item|search|product|seller|company|price/.test(u)) return
    STORE.payloads.push({ url: String(url).slice(0, 300), data })
    if (STORE.payloads.length > 40) STORE.payloads.shift()
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
            if (!txt || txt.length > 600000) return
            const c = txt.charCodeAt(0)
            if (c !== 123 && c !== 91) return
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
          if (!txt || txt.length > 600000) return
          const c = txt.charCodeAt(0)
          if (c !== 123 && c !== 91) return
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

  /** 页面已加载完（控制台方案）→ 用 performance 资源列表重放 1688 自己的接口请求 */
  async function replayResources(limit = 10) {
    const out = []
    let urls = []
    try {
      urls = performance
        .getEntriesByType('resource')
        .map(e => e.name)
        .filter(u => /mtop|offer|detail|search|price/i.test(u))
        .filter(u => /1688\.com|alicdn\.com|taobao\.com/.test(u))
        .filter(u => !/\.(png|jpg|jpeg|webp|svg|css|js|woff2?)(\?|$)/i.test(u))
    } catch (e) {}
    urls = Array.from(new Set(urls)).slice(-limit)
    await Promise.all(
      urls.map(async u => {
        try {
          const res = await fetch(u, { credentials: 'include' })
          if (!res.ok) return
          const txt = await res.text()
          if (!txt) return
          const c = txt.charCodeAt(0)
          if (c !== 123 && c !== 91) return
          out.push({ url: String(u).slice(0, 300), data: JSON.parse(txt) })
        } catch (e) {}
      })
    )
    return out
  }

  /* ------------------------------------------------------------- 深度搜索 */
  function walk(node, fn, depth = 0, seen = new Set()) {
    if (!node || depth > 14 || typeof node !== 'object') return
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

  /** 收集候选：{ key, value, parent, url } */
  function collect(payloads, filter) {
    const out = []
    for (const p of payloads) {
      walk(p.data, (k, v, parent) => {
        if (!filter(k, v)) return
        out.push({ key: String(k), value: v, parent, url: p.url })
      })
    }
    return out
  }

  /* ----------------------------------------------------------- key 权重表 */
  const K = {
    title: {
      strong: ['offerTitle', 'offerSubject', 'subject', 'title', 'productTitle', 'productName', 'offerName', 'itemTitle', 'detailTitle', 'offerTitleText'],
      weak: ['name', 'goodsName'],
      neg: ['company', 'seller', 'shop', 'member', 'buyer', 'user', 'store', 'supplier', 'factory', 'contact', 'nick', 'brand', 'enterprise', 'logo'],
    },
    price: {
      strong: ['priceRange', 'priceMin', 'minPrice', 'priceMax', 'maxPrice', 'priceDesc', 'priceText', 'priceInfo', 'priceRangeList', 'priceRanges', 'priceRangeInfo', 'minPriceDesc', 'maxPriceDesc', 'price', 'salePrice', 'showPrice', 'priceAmount', 'lowestPrice', 'highestPrice', 'priceDetail', 'priceStr'],
      weak: ['value', 'amount'],
      neg: ['count', 'qty', 'num', 'quantity', 'discount', 'freight', 'shipping', 'postage', 'tax', 'weight', 'stock', 'inventory', 'index', 'step', 'id', 'rate', 'ratio', 'coupon', 'reduction'],
    },
    moq: {
      strong: ['beginAmount', 'moq', 'minOrderQuantity', 'minOrderQty', 'beginCount', 'saleMinCount', 'minOrder', 'minPurchaseQuantity', 'begin'],
      weak: ['amount', 'count'],
      neg: ['price', 'discount', 'freight', 'weight', 'total', 'stock', 'inventory', 'id'],
    },
    supplier: {
      strong: ['companyName', 'supplierName', 'sellerName', 'companyTitle', 'memberName'],
      weak: ['sellerNick', 'loginName', 'nick', 'company'],
      neg: ['offer', 'product', 'title', 'subject', 'price', 'image', 'url'],
    },
    desc: {
      strong: ['description', 'offerDescription', 'detail', 'detailHtml', 'desc', 'introduction', 'content'],
      weak: ['remark', 'note'],
      neg: ['title', 'subject', 'price', 'image', 'id'],
    },
    images: {
      strong: ['offerImgList', 'mainImages', 'offerImages', 'imageList', 'images', 'imgList', 'imageUrlList', 'imagesArr', 'mainPic', 'gallery', 'offerImg', 'picList', 'imageUrl'],
      weak: ['img', 'pic', 'image', 'src', 'url', 'logo', 'icon', 'avatar'],
      neg: ['logo', 'icon', 'avatar', 'qrcode', 'placeholder', 'sprite'],
    },
  }

  const keyScore = (key, rule) => {
    const k = String(key).toLowerCase()
    let s = 0
    for (const w of rule.strong) if (k === w.toLowerCase()) { s += 5; break }
    if (!s) for (const w of rule.strong) if (k.includes(w.toLowerCase())) { s += 3; break }
    if (!s) for (const w of rule.weak) if (k.includes(w.toLowerCase())) { s += 1; break }
    for (const w of rule.neg) if (k.includes(w.toLowerCase())) s -= 6
    return s
  }

  /* ---------------------------------------------------------------- 标题 */
  const COMPANY_RE = /(有限公司|股份有限公司|有限责任公司|商行|贸易商行|工厂|饰品厂|服饰厂|电子商务有限|公司)$/

  function pickTitle(payloads) {
    const cands = collect(payloads, (k, v) => {
      if (typeof v !== 'string') return false
      const t = v.trim()
      return t.length >= 4 && t.length <= 200
    })
    const scored = cands.map(c => {
      const v = c.value.trim()
      let s = keyScore(c.key, K.title)
      if (hasCJK(v)) s += 3
      if (v.length >= 6 && v.length <= 60) s += 2
      if (COMPANY_RE.test(v)) s -= 10
      if (/^(义乌|广州|深圳|东莞|汕头|杭州|义乌市)/.test(v) && v.length <= 20) s -= 6
      if (/[，。！、]/.test(v)) s -= 3
      if (/offer|title|subject|detail/i.test(c.url)) s += 1
      return { key: c.key, v, s }
    }).filter(x => x.s > 0)
    if (!scored.length) return ''
    scored.sort((a, b) => b.s - a.s || b.v.length - a.v.length)
    return clean(scored[0].v)
  }

  /* ---------------------------------------------------------------- 价格 */
  function pickPrices(payloads) {
    const cands = collect(payloads, (k, v) => {
      const t = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
      if (!t) return false
      if (/[\d.]+\s*[-~～至]\s*[\d.]+/.test(t)) return true
      const n = num(t)
      return n !== null && n > 0.01 && n < 1000000
    })

    let best = { lo: null, hi: null, score: -99, why: '' }

    // 1) 区间字符串
    for (const c of cands) {
      const m = String(c.value).match(/([\d.]+)\s*[-~～至]\s*([\d.]+)/)
      if (!m) continue
      let s = keyScore(c.key, K.price)
      if (/priceRange|priceDesc|priceText|priceInfo/i.test(c.key)) s += 3
      const lo = parseFloat(m[1]); const hi = parseFloat(m[2])
      if (s > best.score) best = { lo: Math.min(lo, hi), hi: Math.max(lo, hi), score: s, why: 'range:' + c.key }
    }

    // 2) min/max 配对
    const lows = cands.filter(c => /min|low|begin|start|lowest|from/i.test(c.key) && !/max|high|end/i.test(c.key))
    const highs = cands.filter(c => /max|high|end|highest|to/i.test(c.key))
    if (lows.length && highs.length) {
      const bestLow = lows.map(c => ({ c, s: keyScore(c.key, K.price) })).sort((a, b) => b.s - a.s)[0]
      const bestHigh = highs.map(c => ({ c, s: keyScore(c.key, K.price) })).sort((a, b) => b.s - a.s)[0]
      const lo = num(bestLow.c.value); const hi = num(bestHigh.c.value)
      if (lo !== null && hi !== null) {
        const s = Math.min(bestLow.s, bestHigh.s) + 2
        if (s > best.score && lo > 0.01 && hi >= lo) {
          best = { lo, hi, score: s, why: 'minmax:' + bestLow.c.key + '/' + bestHigh.c.key }
        }
      }
    }

    // 3) 单值
    if (best.lo === null) {
      for (const c of cands) {
        if (/[\d.]+\s*[-~～至]\s*[\d.]+/.test(String(c.value))) continue
        const n = num(c.value)
        if (n === null || n <= 0.01) continue
        const s = keyScore(c.key, K.price)
        if (s > best.score) best = { lo: n, hi: n, score: s, why: 'single:' + c.key }
      }
    }

    // 4) 兜底：DOM
    if (best.lo === null) {
      const dom = domFallback()
      if (dom.priceMin) best = { lo: dom.priceMin, hi: dom.priceMax ?? dom.priceMin, score: 0, why: 'dom' }
    }
    return { lo: best.lo, hi: best.hi, why: best.why }
  }

  /* ---------------------------------------------------------------- MOQ */
  function pickMoq(payloads) {
    const cands = collect(payloads, (k, v) => {
      const n = num(v)
      if (n === null) return false
      return n > 0 && n < 100000
    })
    let best = null; let bestScore = -99
    for (const c of cands) {
      let s = keyScore(c.key, K.moq)
      const n = num(c.value)
      if (Number.isInteger(n) && n >= 1) s += 1
      if (s > bestScore) { bestScore = s; best = n }
    }
    if (best === null || bestScore <= 0) {
      const dom = domFallback()
      if (dom.moq) return dom.moq
    }
    return bestScore > 0 ? best : null
  }

  /* -------------------------------------------------------------- 供应商 */
  function pickSupplier(payloads) {
    const cands = collect(payloads, (k, v) => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 80)
    const scored = cands.map(c => {
      const v = c.value.trim()
      let s = keyScore(c.key, K.supplier)
      if (COMPANY_RE.test(v)) s += 4
      if (/公司|厂|商行|贸易|服饰|饰品/.test(v)) s += 2
      if (v.length >= 4 && v.length <= 40) s += 1
      return { key: c.key, v, s }
    }).filter(x => x.s > 0)
    if (!scored.length) return ''
    scored.sort((a, b) => b.s - a.s)
    return clean(scored[0].v)
  }

  /* -------------------------------------------------------------- 描述 */
  function pickDescription(payloads) {
    const cands = collect(payloads, (k, v) => typeof v === 'string' && v.length > 40)
    let best = ''
    let bestScore = -99
    for (const c of cands) {
      const s = keyScore(c.key, K.desc) + (c.value.length > 200 ? 2 : 0)
      if (s > bestScore) { bestScore = s; best = c.value }
    }
    if (!best) {
      const dom = domFallback()
      best = dom.description || ''
    }
    return best.slice(0, 40000)
  }

  /* -------------------------------------------------------------- 图片 */
  function normImage(u) {
    if (typeof u !== 'string') return null
    let url = u.trim()
    if (!url) return null
    if (url.startsWith('//')) url = 'https:' + url
    else if (url.startsWith('/')) return null
    if (!/^https?:\/\//i.test(url)) return null
    if (!/alicdn|1688|taobao|cbu/i.test(url)) return null
    url = url.split('?')[0]
    // .jpg_.webp → .jpg（原图）
    url = url.replace(/\.(jpg|jpeg|png|webp)_\.(webp|jpg|jpeg|png)$/i, '.$1')
    // 去掉小图后缀
    url = url.replace(/_\d+x\d+(xz)?\.(jpg|jpeg|png|webp)$/i, '.$1')
    return url
  }

  const isAsset = u => /\.svg($|\.)/i.test(u) || /-tps-|logo|icon|placeholder|qrcode|sprite|avatar/i.test(u)

  function pickImages(payloads) {
    const found = new Map() // url -> score

    // 1) 数组型图片字段
    const arrCands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length < 200)
    for (const c of arrCands) {
      const s = keyScore(c.key, K.images)
      if (s <= 0) continue
      for (const it of c.value) {
        let u = null
        if (typeof it === 'string') u = it
        else if (it && typeof it === 'object') {
          u = it.url || it.imgUrl || it.imageUrl || it.path || it.src || it.img ||
              it.originalUrl || it.bigPicUrl || it.mainPic || it.image || it.picUrl
          if (!u && it.info && typeof it.info === 'object') {
            u = it.info.url || it.info.imgUrl || it.info.path
          }
        }
        const n = normImage(u)
        if (!n) continue
        const score = s + (isAsset(n) ? -8 : 3)
        if (!found.has(n) || found.get(n) < score) found.set(n, score)
      }
    }

    // 2) 散落的图片字符串
    const strCands = collect(payloads, (k, v) => typeof v === 'string' && /\.(jpg|jpeg|png|webp)/i.test(v) && /alicdn|1688|cbu/i.test(v))
    for (const c of strCands) {
      const n = normImage(c.value)
      if (!n) continue
      const s = keyScore(c.key, K.images) + (isAsset(n) ? -8 : 0)
      if (!found.has(n) || found.get(n) < s) found.set(n, s)
    }

    let list = [...found.entries()]
      .filter(([u, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([u]) => u)

    // 3) 全是素材图时，宁可要素材图也不要空
    if (!list.length) list = [...found.keys()]

    // 4) DOM 兜底补充
    const dom = domFallback()
    for (const u of dom.images) {
      const n = normImage(u)
      if (n && !list.includes(n) && !isAsset(n)) list.push(n)
    }
    return list.slice(0, 20)
  }

  /* ------------------------------------------------------- SKU / 阶梯价 */
  function pickJsonField(payloads, keys) {
    const cands = collect(payloads, (k, v) => v && typeof v === 'object' && !Array.isArray(v))
    let best = null; let bestScore = -99
    for (const c of cands) {
      const k = c.key.toLowerCase()
      let s = -1
      for (const key of keys) if (k.includes(key.toLowerCase())) { s = keyScore(c.key, { strong: keys, weak: [], neg: [] }); break }
      if (s > bestScore) { bestScore = s; best = c.value }
    }
    if (!best) return undefined
    try { return JSON.stringify(best).slice(0, 12000) } catch (e) { return undefined }
  }

  function pickTiers(payloads) {
    const cands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length < 100)
    let best = null; let bestScore = -99
    for (const c of cands) {
      const k = c.key.toLowerCase()
      if (!/pricetier|steprice|price(range)?list|priceinfo|skuprice|multiprice|ladder|pricegroup/.test(k)) continue
      const s = keyScore(c.key, { strong: ['priceRangeList', 'priceTiers', 'stepPrice', 'priceList', 'skuPriceList', 'priceTierList'], weak: [], neg: ['id', 'name'] })
      if (s > bestScore) { bestScore = s; best = c.value }
    }
    if (!best) return undefined
    try { return JSON.stringify(best).slice(0, 8000) } catch (e) { return undefined }
  }

  function pickAttributes(payloads) {
    const cands = collect(payloads, (k, v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).length < 80)
    let best = null; let bestScore = -99
    for (const c of cands) {
      if (!/prop|attr|attribute|param|spec/.test(c.key.toLowerCase())) continue
      const s = keyScore(c.key, { strong: ['props', 'attributes', 'offerProps', 'productAttributes', 'propertyList', 'baseProps'], weak: [], neg: [] })
      if (s > bestScore) { bestScore = s; best = c.value }
    }
    if (!best) return undefined
    try {
      const flat = {}
      for (const k of Object.keys(best).slice(0, 60)) flat[k] = best[k]
      return flat
    } catch (e) { return undefined }
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
      }
    }
    const mo = document.querySelector('[class*="moq"], [class*="beginAmount"], [class*="min-order"]')
    if (mo) {
      const mm = String(mo.innerText || mo.textContent).match(/(\d+)/)
      if (mm) out.moq = parseInt(mm[1], 10)
    }
    const cp = document.querySelector('[class*="company-name"], [class*="companyName"]')
    if (cp) out.supplierName = clean(cp.innerText || cp.textContent)
    out.images = Array.from(document.querySelectorAll('img'))
      .map(i => i.getAttribute('src') || i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || '')
      .filter(u => /alicdn|1688|cbu/i.test(u))
      .slice(0, 40)
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
      const extra = await replayResources()
      replayed = extra.length
      payloads = payloads.concat(extra)
    }
    const dom = domFallback()

    const title = pickTitle(payloads) || dom.title
    const pr = pickPrices(payloads)
    const images = pickImages(payloads)
    const moq = pickMoq(payloads)
    const supplier = pickSupplier(payloads)

    const payload = {
      source: '1688',
      sourceId: offerId,
      sourceUrl: url.split('?')[0],
      title: title || `1688 商品 ${offerId}`,
      description: pickDescription(payloads) || dom.description || '',
      images,
      priceMin: pr.lo,
      priceMax: pr.hi,
      moq,
      unit: '件',
      skuText: pickJsonField(payloads, ['skuMap', 'skuProps', 'skuList', 'skuModel', 'saleProp', 'skuPropsList']),
      attributes: pickAttributes(payloads),
      supplierName: supplier || dom.supplierName || undefined,
      shippingText: '以 1688 页面实际为准',
      priceTiers: pickTiers(payloads),
      raw: {
        offerId,
        url: url.split('?')[0],
        collectedAt: new Date().toISOString(),
        capturedCount: payloads.length,
        replayed,
        priceWhy: pr.why,
        capturedUrls: payloads.slice(0, 25).map(p => p.url),
        snapshot: payloads.slice(0, 5).map(p => ({ url: p.url, data: p.data })),
      },
    }
    return {
      payload,
      debug: {
        captured: payloads.length,
        replayed,
        dom,
        images: images.slice(0, 5),
        urls: payloads.map(p => p.url),
      },
    }
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
      const priceTxt = priceEl ? (priceEl.innerText || priceEl.textContent || '') : ''
      const pr = priceTxt.match(/([\d.]+)\s*[-~至]\s*([\d.]+)/)
      items.push({
        source: '1688',
        sourceId: id,
        sourceUrl: href.split('?')[0],
        title: clean((titleEl.innerText || titleEl.textContent || '').split('\n')[0]) || `1688 商品 ${id}`,
        priceMin: pr ? parseFloat(pr[1]) : num(priceTxt),
        priceMax: pr ? parseFloat(pr[2]) : num(priceTxt),
        moq: num(moqEl && (moqEl.innerText || moqEl.textContent)),
        images: imgEl ? [normImage(imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '')].filter(Boolean) : [],
        raw: { offerId: id, from: 'search-list', collectedAt: new Date().toISOString() },
      })
    }

    if (!items.length) {
      const payloads = capture()
      const extra = payloads.length ? payloads : await replayResources()
      for (const p of extra) {
        walk(p.data, (k, v) => {
          if (typeof k !== 'string' || !/offerid/i.test(k)) return
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
    const body = JSON.stringify(Array.isArray(payload) ? { items: payload } : { data: payload })
    const url = base + '/api/import/1688'
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

    // 1) 优先用 GM_xmlhttpRequest：扩展后台发请求，不受页面 CSP / CORS 限制
    if (typeof GM_xmlhttpRequest === 'function') {
      const viaGM = await new Promise(resolve => {
        try {
          GM_xmlhttpRequest({
            method: 'POST',
            url,
            headers,
            data: body,
            timeout: 30000,
            onload: r => resolve({ status: r.status, json: safeJson(r.responseText), text: r.responseText }),
            onerror: e => resolve({ status: 0, json: null, text: 'GM 请求失败: ' + ((e && e.error) || '网络错误') }),
            ontimeout: () => resolve({ status: 0, json: null, text: 'GM 请求超时' }),
          })
        } catch (e) {
          resolve({ status: 0, json: null, text: 'GM 异常: ' + (e && e.message) })
        }
      })
      if (viaGM.status !== 0) return viaGM
      // GM 失败再试 fetch
    }

    // 2) fetch 兜底（控制台方案走这条；可能被页面 CSP 的 connect-src 拦）
    try {
      const res = await fetch(url, { method: 'POST', headers, body })
      const text = await res.text()
      return { status: res.status, json: safeJson(text), text }
    } catch (e) {
      return {
        status: 0,
        json: null,
        text: '请求被页面安全策略拦截（fetch: ' + (e && e.message) + '）。请改用油猴脚本，扩展请求不受此限制。',
      }
    }
  }

  function safeJson(t) {
    try { return JSON.parse(t) } catch (e) { return null }
  }

  window.FF1688 = {
    __v: '3.0.0',
    install,
    capture,
    replayResources,
    parseDetail,
    parseSearch,
    push,
    api: API,
  }
})();
/* ========================== 面板 UI ========================== */

;(function () {
  'use strict'
  if (window.__FF_PANEL_READY__) return
  window.__FF_PANEL_READY__ = true

  const API = 'https://fiestaflare.com'
  const CORE_URL = 'https://fiestaflare.com/1688-core.js'
  const TOKEN_KEY = 'ff_token'

  // ---- 极简存储：GM_* 不可用时自动降级到 localStorage ----
  const store = {
    get(k) {
      try { if (typeof GM_getValue === 'function') return GM_getValue(k, '') } catch (e) {}
      try { return localStorage.getItem(k) || '' } catch (e) { return '' }
    },
    set(k, v) {
      try { if (typeof GM_setValue === 'function') { GM_setValue(k, v); return } } catch (e) {}
      try { localStorage.setItem(k, v) } catch (e) {}
    },
  }

  // 最早安装钩子（document-start），才能截获页面自己的接口返回
  try { if (window.FF1688) window.FF1688.install() } catch (e) {}

  // ---- 出错时把错误直接显示出来（而不是默默失败）----
  const fatal = (msg) => {
    try {
      const d = document.createElement('div')
      d.style.cssText =
        'position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:320px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:10px;padding:10px 12px;font:12px/1.5 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)'
      d.innerHTML = '<b>Fiestaflare 采集器出错</b><br>' + String(msg).replace(/</g, '&lt;')
      ;(document.documentElement || document.body).appendChild(d)
    } catch (e) {}
  }
  window.addEventListener('error', e => {
    if (e && e.message && /FF1688|ff1688/.test(String(e.message) + String(e.filename || ''))) {
      fatal(e.message)
    }
  })

  // 尝试热更新内核（页面 CSP 允许时生效；失败则用内联版本）
  try {
    fetch(CORE_URL + '?t=' + Date.now())
      .then(r => (r.ok ? r.text() : ''))
      .then(txt => {
        if (!txt || txt.indexOf('__FF1688_CORE__') < 0) return
        try { ;(0, eval)(txt) } catch (e) {}
      })
      .catch(() => {})
  } catch (e) {}

  // 尝试热更新内核（若页面 CSP 允许）；失败也没关系，内联版本已经可用
  const $ = sel => document.querySelector(sel)

  function createPanel() {
    if ($('#ff1688-panel')) return
    const token = store.get(TOKEN_KEY)
    const panel = document.createElement('div')
    panel.id = 'ff1688-panel'
    panel.innerHTML = `
      <style>
        #ff1688-panel{position:fixed!important;right:8px!important;bottom:8px!important;z-index:2147483647!important;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#222;border:1px solid #ddd;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.2);width:340px;overflow:hidden}
        #ff1688-panel .hd{background:#ff6b35;color:#fff;padding:9px 12px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
        #ff1688-panel .bd{padding:12px}
        #ff1688-panel.collapsed .bd{display:none}
        #ff1688-panel input{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #ccc;border-radius:8px;margin:4px 0 8px}
        #ff1688-panel button{background:#ff6b35;color:#fff;border:0;border-radius:8px;padding:8px 11px;cursor:pointer;margin-right:6px;margin-bottom:6px}
        #ff1688-panel button.ghost{background:#f1f1f1;color:#333}
        #ff1688-panel button:disabled{opacity:.5;cursor:not-allowed}
        #ff1688-panel .st{font-size:12px;color:#555;white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto;margin-top:8px;background:#fafafa;border-radius:8px;padding:8px}
        #ff1688-panel .kv{font-size:12px;color:#333;background:#fafafa;border-radius:8px;padding:8px;margin-top:6px;white-space:pre-wrap;word-break:break-all}
      </style>
      <div class="hd"><span>Fiestaflare 采集器 v2.1</span><span class="tg">－</span></div>
      <div class="bd">
        <div class="text-xs text-gray-500">API 地址</div>
        <input id="ff-api" value="${API}" />
        <div class="text-xs text-gray-500">管理员 Token</div>
        <input id="ff-token" type="password" placeholder="后台 → 采集品库 → 复制采集 Token" />
        <button id="ff-save" class="ghost">保存设置</button>
        <div style="margin-top:8px">
          <button id="ff-preview">预览解析</button>
          <button id="ff-push">采集并推送</button>
          <button id="ff-list" class="ghost">采集本页列表</button>
        </div>
        <div class="kv" id="ff-kv" style="display:none"></div>
        <div class="st" id="ff-st">就绪。建议先点「预览解析」确认字段再推送。</div>
      </div>`
    const root = document.documentElement || document.body
    if (!root) return
    root.appendChild(panel)

    const st = $('#ff-st', panel)
    const kv = $('#ff-kv', panel)
    const say = m => { st.textContent = m }
    const isDetail = /\/offer\/\d+/.test(location.href)
    const isList = /selloffer|search/.test(location.href)
    if (!isDetail) $('#ff-push', panel).style.display = 'none'
    if (!isDetail) $('#ff-preview', panel).style.display = 'none'
    if (!isList) $('#ff-list', panel).style.display = 'none'

    $('#ff-token', panel).value = store.get(TOKEN_KEY)
    $('#ff-save', panel).onclick = () => {
      store.set(TOKEN_KEY, $('#ff-token', panel).value.trim())
      say('设置已保存')
    }
    $('.hd', panel).onclick = () => {
      panel.classList.toggle('collapsed')
      $('.tg', panel).textContent = panel.classList.contains('collapsed') ? '＋' : '－'
    }

    let lastPayload = null

    const ensureCore = () => {
      if (!window.FF1688) {
        say('❌ 内核未加载，请刷新页面重试')
        throw new Error('core not loaded')
      }
    }

    const preview = async () => {
      ensureCore()
      say('解析中…')
      const { payload, debug } = await window.FF1688.parseDetail()
      lastPayload = payload
      const lines = [
        `标题: ${payload.title}`,
        `价格: ${payload.priceMin ?? '?'} ~ ${payload.priceMax ?? '?'}`,
        `起订: ${payload.moq ?? '?'}`,
        `图片: ${payload.images.length} 张`,
        `供应商: ${payload.supplierName || '?'}`,
        `描述: ${payload.description ? payload.description.length + ' 字' : '无'}`,
        `截获接口: ${debug.captured} 条（重放 ${debug.replayed || 0}）`,
        `价格依据: ${(payload.raw && payload.raw.priceWhy) || '-'}`,
        `offerId: ${payload.sourceId}`,
      ]
      kv.style.display = 'block'
      kv.textContent = lines.join('\n')
      console.log('[Fiestaflare] 解析结果：', payload)
      console.log('[Fiestaflare] 调试信息：', debug)
      say('预览完成，确认无误后点「采集并推送」')
      return payload
    }

    $('#ff-preview', panel).onclick = () => preview().catch(e => say('解析异常: ' + e.message))

    $('#ff-push', panel).onclick = async () => {
      try {
        ensureCore()
        const payload = lastPayload || (await preview())
        say('推送中…')
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim())
        if (r.status === 200) say('✅ 已推送，后台「采集品库」查看')
        else if (r.status === 401) say('❌ Token 无效，请重新复制')
        else if (r.status === 0) say('❌ ' + (r.text || '请求失败'))
        else say('❌ 推送失败 ' + r.status + ' ' + (r.text || '').slice(0, 200))
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    $('#ff-list', panel).onclick = async () => {
      try {
        ensureCore()
        say('解析列表…')
        const { payload } = await window.FF1688.parseSearch()
        if (!payload.length) { say('本页没抓到商品'); return }
        say(`抓到 ${payload.length} 条，推送中…`)
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim())
        if (r.status === 200) say(`✅ 已推送 ${(r.json && r.json.imported) || ''} 条`)
        else if (r.status === 401) say('❌ Token 无效，请重新复制')
        else if (r.status === 0) say('❌ ' + (r.text || '请求失败'))
        else say('❌ 推送失败 ' + r.status)
      } catch (e) {
        say('异常: ' + e.message)
      }
    }
  }

  function boot() {
    const tryPanel = () => {
      try {
        if (!document.documentElement) { setTimeout(tryPanel, 300); return }
        createPanel()
        console.log('[Fiestaflare] 采集器已启动，内核版本：', (window.FF1688 && window.FF1688.__v) || '未加载')
      } catch (e) {
        fatal(e && (e.stack || e.message) || e)
      }
    }
    tryPanel()
    try { if (window.FF1688) window.FF1688.install() } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
