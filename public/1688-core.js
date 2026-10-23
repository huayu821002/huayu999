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
  if (window.FF1688 && window.FF1688.__v === '3.1.0') return

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
    // 热更新后新内核也会 install；若旧内核已挂钩过 fetch/XHR，则不再重复挂钩
    if (window.__FF1688_INSTALLED__) { STORE.installed = true; return }
    window.__FF1688_INSTALLED__ = true
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
      // 注意：必须把时间戳类 key 排除，否则 1792659779466 会被当成价格
      neg: ['count', 'qty', 'num', 'quantity', 'discount', 'freight', 'shipping', 'postage', 'tax', 'weight', 'stock', 'inventory', 'index', 'step', 'id', 'rate', 'ratio', 'coupon', 'reduction', 'gmt', 'create', 'update', 'time', 'date', 'timestamp', 'seq', 'sort', 'version', 'hash', 'md5', 'score', 'rank', 'trace', 'spm', 'seq'],
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

    // 1) 区间字符串（key 必须像价格，否则时间戳等噪声会被误选）
    for (const c of cands) {
      const m = String(c.value).match(/([\d.]+)\s*[-~～至]\s*([\d.]+)/)
      if (!m) continue
      const s = keyScore(c.key, K.price)
      if (s <= 0) continue
      const lo = parseFloat(m[1]); const hi = parseFloat(m[2])
      if (lo <= 0.01 || hi < lo || hi > 1000000) continue
      const score = s + (/priceRange|priceDesc|priceText|priceInfo/i.test(c.key) ? 3 : 0)
      if (score > best.score) best = { lo: Math.min(lo, hi), hi: Math.max(lo, hi), score, why: 'range:' + c.key }
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
        if (s > best.score && lo > 0.01 && hi >= lo && hi < 1000000) {
          best = { lo, hi, score: s, why: 'minmax:' + bestLow.c.key + '/' + bestHigh.c.key }
        }
      }
    }

    // 3) 单值
    if (best.lo === null) {
      for (const c of cands) {
        if (/[\d.]+\s*[-~～至]\s*[\d.]+/.test(String(c.value))) continue
        const s = keyScore(c.key, K.price)
        if (s <= 0) continue
        const n = num(c.value)
        if (n === null || n <= 0.01 || n > 1000000) continue
        if (s > best.score) best = { lo: n, hi: n, score: s, why: 'single:' + c.key }
      }
    }

    // 4) 接口里没有价格（1688 价格是前端渲染的）→ 走 DOM
    if (best.lo === null) {
      const dom = domFallback()
      if (dom.priceMin) best = { lo: dom.priceMin, hi: dom.priceMax ?? dom.priceMin, score: 0, why: 'dom' }
    }
    return { lo: best.lo, hi: best.hi, why: best.why }
  }

  /* ------------------------------------------- 各规格价格（多 SKU 时） */
  /**
   * 找出「规格 → 价格」的对应关系：
   *   1) skuMap 的值对象里带 price
   *   2) key 像 sku/priceList 的数组或对象映射
   * 返回 [{ spec, price, skuId }]
   */
  function pickSkuPrices(payloads) {
    const out = []
    const seen = new Set()
    const push = (spec, price, skuId) => {
      if (price === null || price === undefined) return
      if (!(price > 0.01) || price > 1000000) return
      const key = String(spec || '') + '|' + price
      if (seen.has(key)) return
      seen.add(key)
      out.push({ spec: String(spec || '').trim(), price, skuId: skuId || '' })
    }

    // 1) skuMap 值对象里的价格
    const skuMap = pickSkuMap(payloads)
    if (skuMap) {
      for (const combo of Object.keys(skuMap)) {
        const val = skuMap[combo]
        if (!val || typeof val !== 'object' || Array.isArray(val)) continue
        const p = num(
          val.price ?? val.skuPrice ?? val.salePrice ?? val.tradePrice ?? val.priceValue ??
          val.discountPrice ?? val.minPrice
        )
        if (p === null) continue
        const spec = String(combo).split(/[;；]/)[0].replace(/^[^:：]*[:：]/, '') || String(combo)
        push(spec, p, val.skuId || val.id || '')
      }
    }

    // 2) key 像 sku/priceList 的数组：[{ spec/props..., price }]
    const arrCands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length <= 200)
    for (const c of arrCands) {
      if (!/sku|price.*list|list.*price|skumodel|skuprice|skuprices/i.test(c.key)) continue
      if (/tier|beginamount|quantity|阶梯/i.test(c.key)) continue // 阶梯价表不是规格价
      for (const it of c.value) {
        if (!it || typeof it !== 'object') continue
        if (/beginamount|quantity|moq|amount|step/i.test(Object.keys(it).join(','))) continue // 起批量类
        let price = null
        for (const kk of Object.keys(it)) {
          if (!/price/i.test(kk)) continue
          if (/discount|origin|market|old|max|range|desc|text/i.test(kk)) continue
          const n = num(it[kk])
          if (n !== null) { price = n; break }
        }
        if (price === null) continue
        let spec = ''
        for (const kk of Object.keys(it)) {
          if (/spec|prop|color|size|skuName|name|title/i.test(kk) && typeof it[kk] === 'string' && it[kk]) {
            spec = it[kk]
            break
          }
        }
        if (!spec) {
          for (const kk of Object.keys(it)) {
            if (/skuId|specId|id$/i.test(kk)) continue
            if (typeof it[kk] === 'string' && it[kk] && !/price|url|img|image/i.test(kk)) { spec = it[kk]; break }
          }
        }
        // 至少要有规格或 skuId，否则只是杂项价格
        const hasId = Object.keys(it).some(kk => /skuId|specId/i.test(kk))
        if (!spec && !hasId) continue
        push(spec, price, it.skuId || '')
      }
    }

    // 3) key 像 sku 的对象映射：{ "红色;M": 12.5 } 或 { "红色;M": { price } }
    const objCands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 1 && n <= 120
    })
    for (const c of objCands) {
      if (!/sku|price.*map|map.*price/i.test(c.key)) continue
      for (const kk of Object.keys(c.value)) {
        const val = c.value[kk]
        let price = null
        if (typeof val === 'number' || typeof val === 'string') price = num(val)
        else if (val && typeof val === 'object') {
          for (const p of Object.keys(val)) {
            if (!/price/i.test(p)) continue
            const n = num(val[p])
            if (n !== null) { price = n; break }
          }
        }
        if (price === null) continue
        const spec = String(kk).split(/[;；]/)[0].replace(/^[^:：]*[:：]/, '') || String(kk)
        push(spec, price, '')
      }
    }

    // 4) DOM 兜底：规格行里的价格
    if (!out.length) {
      const dom = domFallback()
      for (const s of dom.skuPrices || []) push(s.spec, s.price, s.skuId || '')
    }
    return out
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

  /* ------------------------------------------- 货号 / 首个规格 / 阶梯价 */
  /**
   * 找到 skuMap（形如 { "颜色分类:红色;尺码:M": { skuId: "..." } }）。
   * 判据：对象的 key 里有 "规格组合" 样式（含冒号/分号），或字段名带 sku/spec/prop。
   */
  function pickSkuMap(payloads) {
    const cands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 1 && n <= 120
    })
    let best = null
    let bestScore = -99
    for (const c of cands) {
      const keys = Object.keys(c.value)
      const combo = keys.filter(kk => /[:：;；]/.test(String(kk))).length
      const specWord = /sku|spec|prop|sale/i.test(c.key) ? 3 : 0
      if (combo === 0 && specWord === 0) continue
      const score = combo * 2 + specWord + Math.min(keys.length, 5)
      if (score > bestScore) { bestScore = score; best = c.value }
    }
    return best
  }

  /** 从 skuMap 里取：货号（skuId）、第一个规格/颜色 */
  function parseSkuMap(map) {
    const out = { sourceSkuId: '', firstSku: '', specNames: [], skuIds: [] }
    if (!map) return out
    for (const combo of Object.keys(map)) {
      const val = map[combo]
      const firstSeg = String(combo).split(/[;；]/)[0].trim()
      const idx = firstSeg.search(/[:：]/)
      let specName = idx >= 0 ? firstSeg.slice(0, idx).trim() : ''
      let specVal = idx >= 0 ? firstSeg.slice(idx + 1).trim() : ''
      if (Array.isArray(val)) {
        // 形如 { 颜色: ['红色','蓝色'] } → 取第一个值作为规格
        if (!specVal && val.length) {
          const v0 = val[0]
          specVal = typeof v0 === 'string' || typeof v0 === 'number' ? String(v0) : (v0 && (v0.name || v0.value)) ? String(v0.name || v0.value) : ''
        }
        if (!specName) specName = firstSeg
      }
      if (!out.firstSku) out.firstSku = specVal || firstSeg
      if (specName && !out.specNames.includes(specName)) out.specNames.push(specName)

      let id = ''
      if (typeof val === 'string' || typeof val === 'number') {
        id = String(val)
      } else if (val && typeof val === 'object') {
        id = String(val.skuId || val.skuID || val.skuCode || val.outerId || val.itemId || val.id || '')
      }
      if (id && !out.skuIds.includes(id)) out.skuIds.push(id)
    }
    if (!out.sourceSkuId && out.skuIds.length) out.sourceSkuId = out.skuIds[0]
    return out
  }

  /** 兜底：从 saleProp / skuProps 数组里取第一个规格 */
  function pickFirstSpec(payloads) {
    const cands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length < 60)
    let best = ''
    let bestScore = -99
    for (const c of cands) {
      if (!/saleprop|skuprops|skulist|props|spec/i.test(c.key)) continue
      const s = keyScore(c.key, { strong: ['saleProp', 'skuProps', 'skuList', 'skuModel'], weak: ['props', 'spec'], neg: [] })
      if (s <= bestScore) continue
      for (const it of c.value) {
        if (!it || typeof it !== 'object') continue
        const name = it.name || it.propName || it.attrName || ''
        const val = it.value || it.propValue || it.attrValue || it.valueName || ''
        if (!val) continue
        const text = name ? String(name) + ': ' + String(val) : String(val)
        best = text
        bestScore = s
        break
      }
    }
    return best
  }

  /** 把 1688 的阶梯价结构归一化成 [{ minQty, maxQty, price }] */
  function normalizeTiers(tiers) {
    const out = []
    const push = (minQty, price, maxQty) => {
      if (minQty === null || price === null) return
      if (minQty <= 0 || price <= 0) return
      out.push({ minQty: Math.round(minQty), maxQty: maxQty ? Math.round(maxQty) : null, price })
    }
    for (const t of tiers) {
      if (!t || typeof t !== 'object') continue
      const minQty = num(
        t.beginAmount ?? t.startQuantity ?? t.minQuantity ?? t.minQty ??
        t.begin ?? t.count ?? t.amount ?? t.num ?? t.quantity
      )
      const maxQty = num(t.endAmount ?? t.maxQuantity ?? t.end ?? t.maxQty ?? t.endCount)
      const price = num(
        t.price ?? t.priceValue ?? t.stepPrice ?? t.salePrice ?? t.tradePrice ??
        t.wholesalePrice ?? t.value ?? t.amount
      )
      push(minQty, price, maxQty)
    }
    return out
  }

  /** 阶梯价对象形态：{ "2": 12.5, "100": 10 } */
  function normalizeTierMap(map) {
    const out = []
    if (!map || typeof map !== 'object') return out
    for (const k of Object.keys(map)) {
      const minQty = num(k)
      const price = num(map[k])
      if (minQty !== null && price !== null) pushTier(out, minQty, price)
    }
    return out
  }

  function pushTier(out, minQty, price) {
    if (minQty <= 0 || price <= 0) return
    out.push({ minQty: Math.round(minQty), maxQty: null, price })
  }

  /** 阶梯价的“对象形态”：字段名像 tier，值是 { 起订量: 价格 } 映射 */
  function pickTierObject(payloads) {
    const cands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 1 && n <= 60
    })
    let best = null
    let bestScore = -99
    for (const c of cands) {
      if (!/tier|stepprice|ladder|pricegroup|rangeprice/i.test(c.key)) continue
      const vals = Object.values(c.value)
      const numeric = vals.filter(v => num(v) !== null).length
      if (numeric < 1) continue
      const score = numeric
      if (score > bestScore) { bestScore = score; best = c.value }
    }
    return best
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
    out.skuPrices = domSkuPrices()
    return out
  }

  /** 从 DOM 里找「规格 → 价格」（优先规格价格表，而不是起批量阶梯价表） */
  function domSkuPrices() {
    const out = []
    const add = (spec, price) => {
      if (price === null || price === undefined) return
      if (!(price > 0.01) || price > 1000000) return
      out.push({ spec: String(spec || '').trim().slice(0, 60), price, skuId: '' })
    }
    try {
      // 1) 表格：表头含规格/颜色/尺码 → 规格价格表；含起批量 → 阶梯价表（往后排）
      const tierRows = []
      const skuRows = []
      for (const table of Array.from(document.querySelectorAll('table'))) {
        const rows = Array.from(table.querySelectorAll('tr'))
        if (!rows.length) continue
        const head = clean(rows[0].innerText || '')
        const isTier = /起订|起批|数量|件数/.test(head)
        const isSku = /规格|颜色|尺码|款式|型号|属性/.test(head)
        if (!isTier && !isSku) continue
        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td,th')).map(c => clean(c.innerText || c.textContent || ''))
          if (cells.length < 2) continue
          const priceTxt = cells.slice(1).join(' ').match(/(\d+(?:\.\d+)?)/)
          const price = priceTxt ? parseFloat(priceTxt[1]) : null
          if (price === null) continue
          const item = { spec: cells[0], price }
          ;(isTier ? tierRows : skuRows).push(item)
        }
      }
      for (const it of skuRows.slice(0, 30)) add(it.spec, it.price)
      if (!out.length) for (const it of tierRows.slice(0, 30)) add(it.spec, it.price)
    } catch (e) {}
    try {
      // 2) 非表格：带 sku-price / price-item 的元素
      if (!out.length) {
        const els = Array.from(document.querySelectorAll('[class*="sku-price"], [class*="price-item"], [class*="skuPrice"], [class*="priceInfo"]'))
        for (const el of els.slice(0, 30)) {
          const txt = clean(el.innerText || el.textContent || '')
          const m = txt.match(/(\d+(?:\.\d+)?)/)
          if (!m) continue
          const spec = clean((el.closest('[class*="sku-item"], [class*="sku-row"], li, tr') || el).innerText || '')
            .replace(txt, '')
            .slice(0, 60)
          add(spec, parseFloat(m[1]))
        }
      }
    } catch (e) {}
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

    // 多 SKU 时，价格取「第一个规格的价格」（1688 各规格价格不同，区间价容易错）
    const skuPrices = pickSkuPrices(payloads)
    const priceRangeOld = { lo: pr.lo, hi: pr.hi, why: pr.why }
    if (skuPrices.length >= 2) {
      pr.lo = skuPrices[0].price
      pr.hi = skuPrices[0].price
      pr.why = 'sku:first(' + (skuPrices[0].spec || '第一个规格') + ') ← 原:' + (priceRangeOld.why || '-')
    }
    const images = pickImages(payloads)
    const moq = pickMoq(payloads)
    const supplier = pickSupplier(payloads)

    // 货号 / 首个规格 / 阶梯价 / 批发价（新增字段，不影响原有字段）
    const skuMap = pickSkuMap(payloads)
    const skuInfo = parseSkuMap(skuMap)
    const firstSpecFallback = skuInfo.firstSku ? '' : pickFirstSpec(payloads)
    const tiersRaw = pickTiers(payloads)
    let tiers = []
    let tierSource = ''
    if (tiersRaw) {
      try {
        const parsed = JSON.parse(tiersRaw)
        if (Array.isArray(parsed)) { tiers = normalizeTiers(parsed); tierSource = 'array' }
        else if (parsed && typeof parsed === 'object') { tiers = normalizeTierMap(parsed); tierSource = 'map' }
      } catch (e) {}
    }
    if (!tiers.length) {
      const tierObj = pickTierObject(payloads)
      if (tierObj) { tiers = normalizeTierMap(tierObj); tierSource = 'obj' }
    }
    const wholesalePrice = pr.lo !== null && pr.lo !== undefined ? pr.lo : undefined

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
      // ↓ 新增：货号 / 首个规格 / 阶梯价 / 批发价（CNY）
      sourceSkuId: skuInfo.sourceSkuId || undefined,
      firstSku: skuInfo.firstSku || firstSpecFallback || undefined,
      wholesalePrice,
      priceLadder: tiers.length ? JSON.stringify(tiers) : undefined,
      skuPrices: skuPrices.length ? skuPrices : undefined,
      skuSpecNames: skuInfo.specNames.length ? skuInfo.specNames : undefined,
      raw: {
        offerId,
        url: url.split('?')[0],
        collectedAt: new Date().toISOString(),
        capturedCount: payloads.length,
        replayed,
        priceWhy: pr.why,
        priceRangeOld,
        skuPrices: skuPrices.slice(0, 30),
        tierSource,
        skuCount: skuInfo.skuIds.length,
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
  function normalizeBase(base) {
    let b = String(base || API).trim()
    b = b.replace(/\/+$/, '')
    // 去掉用户可能误填的路径后缀（/api、/api/admin、/api/import/1688 等）
    b = b.replace(/\/(api(\/(admin|import))?(\/1688)?|\/admin)?$/i, '')
    b = b.replace(/\/+$/, '')
    return b || 'https://fiestaflare.com'
  }

  /** 本地解析 JWT 负载（不校验签名，只为看 role/exp，给出可执行的提示） */
  function decodeJwtPayload(token) {
    try {
      const parts = String(token || '').split('.')
      if (parts.length < 2) return null
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      while (b64.length % 4) b64 += '='
      const json = decodeURIComponent(
        atob(b64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(json)
    } catch (e) {
      return null
    }
  }

  async function push(payload, token, api) {
    const base = normalizeBase(api)
    const body = JSON.stringify(Array.isArray(payload) ? { items: payload } : { data: payload })
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

    // 本地先看 Token 里的角色：JWT 把 role 写死，库里改了角色旧 Token 也不会变
    if (!token) {
      return { status: 0, json: null, text: '没有填 Token：请到后台「采集品库」点「复制采集 Token」，粘贴到面板里。', attempts: [], url: base }
    }
    const claims = decodeJwtPayload(token)
    if (claims) {
      if (claims.role && claims.role !== 'ADMIN') {
        return {
          status: 0,
          json: null,
          text:
            'Token 里的角色是 ' + claims.role + '，不是 ADMIN。' +
            '（JWT 把角色写死在 Token 里，服务器改了角色，旧 Token 也不会更新）' +
            '请退出后台重新登录，再重新复制一次采集 Token。',
          attempts: [],
          url: base,
        }
      }
      if (claims.exp && claims.exp * 1000 < Date.now()) {
        return { status: 0, json: null, text: 'Token 已过期，请退出后台重新登录后重新复制采集 Token。', attempts: [], url: base }
      }
    }

    const paths = ['/api/import/1688', '/api/admin/import/1688']
    const attempts = []

    for (const p of paths) {
      const url = base + p
      const r = await requestOnce(url, headers, body)
      attempts.push({ url, status: r.status, text: (r.text || '').slice(0, 300) })
      // 成功就返回；401/403 也返回（说明已到达服务端，只是鉴权不过）
      if (r.status === 200 || r.status === 400 || r.status === 401 || r.status === 403) {
        return { ...r, attempts, url }
      }
    }
    const last = attempts[attempts.length - 1]
    const all = attempts.map(a => a.url + ' → ' + a.status).join('；')
    return {
      status: last ? last.status : 0,
      json: null,
      text: (last ? last.text : '无响应') + '\n尝试记录：' + all,
      attempts,
      url: base,
    }
  }

  /** 优先用 GM_xmlhttpRequest（不受页面 CSP 限制），否则 fetch */
  function requestOnce(url, headers, body) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(resolve => {
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
    }
    return fetch(url, { method: 'POST', headers, body })
      .then(async res => ({ status: res.status, json: safeJson(await res.text()), text: await res.text() }))
      .catch(e => ({
        status: 0,
        json: null,
        text: '请求被页面安全策略拦截（fetch: ' + (e && e.message) + '）。请改用油猴脚本，扩展请求不受此限制。',
      }))
  }

  function safeJson(t) {
    try { return JSON.parse(t) } catch (e) { return null }
  }

  window.FF1688 = {
    __v: '3.1.0',
    install,
    capture,
    replayResources,
    parseDetail,
    parseSearch,
    push,
    api: API,
  }
})();