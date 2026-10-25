/**
 * Fiestaflare 1688 采集 —— 控制台版（无需安装任何浏览器扩展）v3
 *
 * 用法：
 *  1. 登录 1688，打开商品详情页 https://detail.1688.com/offer/xxxx.html
 *  2. F12 → Console → 粘贴本脚本 → 回车（Chrome 首次需先输入 allow pasting 回车）
 *  3. 粘贴 Fiestaflare 管理员 Token 回车
 *  4. 控制台会打印解析结果与推送结果
 */

/* ================= 内核（内联，避免页面 CSP 拦截外部脚本） ================= */
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
  // 同一版本重复注入时不重复安装（版本号变了吗？这里的常量要同步改）
  if (window.FF1688 && window.FF1688.__v === '4.1.3') return

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

  /**
   * 清洗 1688 的商品描述 HTML。
   *
   * 1688 的详情区是「图片描述」——大量 <img> 懒加载占位，
   * 里面还嵌了 <script>、懒加载属性、以及大量空白。
   * 直接存 innerHTML 会把脚本和垃圾一起入库。
   */
  function cleanDescriptionHtml(html) {
    let s = String(html || '')
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
    s = s.replace(/<!--[\s\S]*?-->/g, '')
    // 懒加载的真实图片地址
    s = s.replace(/<img[^>]*?(?:data-lazyload|data-lazy-src|data-ks-lazyload|data-src)="([^"]+)"[^>]*>/gi,
      (m, u) => `<img src="${u}" alt="">`)
    s = s.replace(/\son\w+="[^"]*"/gi, '')
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    return s.trim().slice(0, 30000)
  }

  /**
   * 把 HTML 描述转成纯文本（后台摘要用）。
   * 详情描述大多是图片，HTML 存进库既占地方又没法用。
   */
  function stripDescriptionHtml(html) {
    let s = String(html || '')
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
    s = s.replace(/<br\s*\/?>/gi, '\n')
    s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    s = s.replace(/<[^>]+>/g, ' ')
    s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    return s.trim().slice(0, 4000)
  }

  /* ---------------------------------------------------------- 截获接口返回 */
  const STORE = { payloads: [], requests: [], installed: false }

  function pushCapture(url, data) {
    if (!data || typeof data !== 'object') return
    const u = (url || '').toLowerCase()
    if (!/offer|detail|mtop|item|search|product|seller|company|price/.test(u)) return
    // 过滤失败/空的 mtop 响应（重放时 data 参数丢失会得到这种垃圾）
    if (isUselessPayload(data)) return
    // 隐私：个人地址簿/账号信息类报文直接丢弃，绝不采集
    if (isSensitivePayload({ url })) return
    // URL 不截断：mtop 的 data/sign 在 query 尾部，截断后重放就会 invalid param
    STORE.payloads.push({ url: String(url), data })
    if (STORE.payloads.length > 40) STORE.payloads.shift()
    flush()
  }

  /** mtop 失败/空响应判定：success=false、reason=invalid param、data 为空 */
  function isUselessPayload(data) {
    try {
      const d = data && data.data
      if (!d || typeof d !== 'object') return false
      if (d.success === false) return true
      if (typeof d.reason === 'string' && /invalid param|error|fail/i.test(d.reason)) return true
      const inner = d.data
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        if (inner.success === false) return true
        if (typeof inner.reason === 'string' && /invalid param|error|fail/i.test(inner.reason)) return true
        if (!Object.keys(inner).length) return true // data: {}
      }
      return false
    } catch (e) { return false }
  }

  /** 宽松解析：兼容 JSON / JSONP / 前后带杂音的文本 */
  function parseLoose(text) {
    if (!text) return null
    if (typeof text === 'object') return text
    const t = String(text)
    try { return JSON.parse(t) } catch (e) {}
    let i = t.indexOf('{'), j = t.lastIndexOf('}')
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)) } catch (e) {} }
    i = t.indexOf('['); j = t.lastIndexOf(']')
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)) } catch (e) {} }
    return null
  }

  /** 记录 mtop 请求的 method/body，供原样重放（GET 重放会丢签名参数 → invalid param） */
  function pushRequest(url, method, body) {
    const u = String(url || '')
    if (!/mtop|offer|detail|sku/i.test(u)) return
    STORE.requests.push({
      url: u.slice(0, 2000),
      method: String(method || 'GET').toUpperCase(),
      body: typeof body === 'string' ? body.slice(0, 4000) : '',
      at: Date.now(),
    })
    if (STORE.requests.length > 30) STORE.requests.shift()
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
    window.__FF1688_ORIG_FETCH__ = origFetch
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args)
      try {
        // 记录请求的 method/body，供原样重放（mtop 的 data 参数在 body 里，丢掉就会 invalid param）
        const raw = args[0]
        const init = args[1] || {}
        const reqUrl = (raw && raw.url) || (typeof raw === 'string' ? raw : '')
        pushRequest(reqUrl, init.method || (raw && raw.method) || 'GET', init.body)
        p.then(res => {
          const url = (res && res.url) || reqUrl || ''
          res.clone().text().then(txt => {
            if (!txt || txt.length > 600000) return
            const parsed = parseLoose(txt)
            if (!parsed || typeof parsed !== 'object') return
            pushCapture(url, parsed)
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
      this.__ffMethod = method
      return origOpen.call(this, method, url, ...rest)
    }
    XHR.prototype.send = function (...args) {
      try {
        const body = typeof args[0] === 'string' ? args[0] : ''
        pushRequest(this.__ffUrl || '', this.__ffMethod || 'GET', body)
      } catch (e) {}
      this.addEventListener('load', function () {
        try {
          const url = this.__ffUrl || this.responseURL || ''
          let txt = ''
          try { txt = this.responseText } catch (e) {}
          if (!txt && this.response && typeof this.response === 'object') {
            try { txt = JSON.stringify(this.response) } catch (e) {}
          }
          if (!txt || txt.length > 600000) return
          const parsed = parseLoose(txt)
          if (!parsed || typeof parsed !== 'object') return
          pushCapture(url, parsed)
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
   * 页面已加载完（控制台方案）→ 用 performance 资源列表重放 1688 自己的接口请求。
   * 关键：1688 的 mtop 接口是 **GET 但签名在 query**；我们用 performance 里的原始 URL 重放时，
   * 里面已经带了 t/sign/data，所以**必须用完整 URL，不能截断**（截断会丢 data → invalid param）。
   */
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
    // 用未挂钩的原始 fetch，避免重放响应又回流进 STORE 污染采集结果
    const rawFetch = window.__FF1688_ORIG_FETCH__ || window.fetch
    await Promise.all(
      urls.map(async u => {
        try {
          // 注意：不截断 URL，mtop 的 data/sign 在 query 里
          const res = await rawFetch(u, { credentials: 'include' })
          if (!res.ok) return
          const txt = await res.text()
          if (!txt) return
          const parsed = parseLoose(txt)
          if (!parsed || typeof parsed !== 'object') return
          if (isUselessPayload(parsed)) return
          out.push({ url: String(u), data: parsed, from: 'replay' })
        } catch (e) {}
      })
    )
    return out
  }

  /**
   * 重放我们自己截获到的 mtop 请求（带原始 method + body）。
   * 场景：页面已加载完、install() 晚于首屏请求 → 截获不到真实详情报文。
   */
  async function replayCapturedRequests(limit = 8) {
    const out = []
    const list = STORE.requests.filter(r => /mtop|offer|detail|sku/i.test(r.url)).slice(-limit)
    const rawFetch = window.__FF1688_ORIG_FETCH__ || window.fetch
    for (const r of list) {
      try {
        const init = { credentials: 'include', method: r.method || 'GET' }
        if (r.body && r.method !== 'GET') {
          init.body = r.body
          init.headers = { 'content-type': 'application/x-www-form-urlencoded' }
        }
        const res = await rawFetch(r.url, init)
        if (!res || !res.ok) continue
        const txt = await res.text()
        const parsed = parseLoose(txt)
        if (!parsed || typeof parsed !== 'object') continue
        out.push({ url: String(r.url).slice(0, 300), data: parsed, from: 'replay-body' })
      } catch (e) {}
    }
    return out
  }

  /**
   * 扫描页面内联脚本与 window 全局变量，寻找含 offerId 的真实详情 JSON。
   * 1688 首屏详情数据常挂在 __INIT_DATA__ / __NEXT_DATA__ / offerData 等全局上。
   */
  function scanInlineData() {
    const found = []
    const seen = new Set()
    const add = (url, obj) => {
      if (!obj || typeof obj !== 'object') return
      if (seen.has(obj)) return
      seen.add(obj)
      found.push({ url, data: obj, from: 'inline' })
    }
    // 1) window 全局常见命名
    const globalKeys = [
      '__INIT_DATA__', '__NEXT_DATA__', '__NUXT__', '__APOLLO_STATE__',
      '__PRELOADED_STATE__', 'offerData', 'detailData', '__OFFER_DATA__',
      '__GLOBAL_DATA__', 'window.__detailData', '__INITIAL_STATE__',
    ]
    for (const k of globalKeys) {
      try { add('global:' + k, window[k]) } catch (e) {}
    }
    // 2) window 上所有含 offerId 的浅层全局
    try {
      for (const k of Object.keys(window)) {
        if (k.length > 40) continue
        let v
        try { v = window[k] } catch (e) { continue }
        if (!v || typeof v !== 'object') continue
        if (Array.isArray(v) && v.length > 50) continue
        const s = (() => { try { return JSON.stringify(v).slice(0, 20000) } catch (e) { return '' } })()
        if (s && /"offerId"\s*:\s*"?\d{6,}/.test(s)) add('global-scan:' + k, v)
      }
    } catch (e) {}
    // 3) 内联 <script> 里的 JSON
    try {
      const scripts = document.querySelectorAll('script')
      for (const s of scripts) {
        const t = s.textContent || ''
        if (!t || t.length > 400000) continue
        if (!/offerId/i.test(t)) continue
        const m = t.match(/=\s*(\{[\s\S]*\})\s*[;\n]/)
        if (m) {
          const parsed = parseLoose(m[1])
          if (parsed && typeof parsed === 'object') add('inline-script', parsed)
        }
      }
    } catch (e) {}
    return found
  }

  /* ------------------------------------------------------------- 深度搜索 */
  function walk(node, fn, depth = 0, seen = new Set(), path = []) {
    if (!node || depth > 14 || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, fn, depth + 1, seen, path)
      return
    }
    for (const k of Object.keys(node)) {
      fn(k, node[k], node, path)
      walk(node[k], fn, depth + 1, seen, path.concat(k))
    }
  }

  /** 收集候选：{ key, value, parent, url, path } */
  function collect(payloads, filter) {
    const out = []
    for (const p of payloads) {
      walk(p.data, (k, v, parent, path) => {
        if (!filter(k, v, parent, path)) return
        out.push({ key: String(k), value: v, parent, path: path || [], url: p.url })
      })
    }
    return out
  }

  /* ------------------------------------------------------- 噪声容器识别 */
  /**
   * 1688 详情页里有大量「推荐位 / 同店其它商品」列表：
   *   offerList、majorRecommendOfferInfos、relationRecommendOfferInfos、itemList …
   * 里面的价格全是**别的商品**的价格。
   * 两种判定（任一命中即视为噪声）：
   *   ① 路径里出现 recommend/relation/major/similar/hot/offerList/itemList 等推荐位容器名
   *   ② 字段结构上就是「商品卡片」：带 offerId / offerUrl / isCurrentOffer / behaviorTag
   */
  const NOISE_KEY_RE = /(recommend|relation|major|similar|hot|shopcard|itemlist|offerlist)/i
  const isNoiseKey = k => NOISE_KEY_RE.test(String(k || ''))

  function isCardItem(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
    return !!obj.offerId || !!obj.offerUrl || obj.isCurrentOffer !== undefined || !!obj.behaviorTag
  }

  function isNoisePath(path) {
    if (!path || !path.length) return false
    return path.some(p => isNoiseKey(p))
  }

  /** 候选是否来自噪声容器 */
  function isNoiseCandidate(c) {
    if (isNoisePath(c.path)) return true
    if (c.parent && isCardItem(c.parent)) return true
    return false
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
      neg: ['count', 'qty', 'num', 'quantity', 'discount', 'freight', 'shipping', 'postage', 'tax', 'weight', 'stock', 'inventory', 'index', 'step', 'id', 'rate', 'ratio', 'coupon', 'reduction', 'gmt', 'create', 'update', 'time', 'date', 'timestamp', 'seq', 'sort', 'version', 'hash', 'md5', 'score', 'rank', 'trace', 'spm', 'total', 'cost', 'selected', 'expect', 'market'],
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

  /** 诊断：列出所有含价格项的容器（key / 形态 / 数量 / 首项字段），用于精确定位 1688 的价格结构 */
  function collectPriceContainers(payloads) {
    const out = []
    const seen = new Set()
    const push = (key, kind, items) => {
      const sig = key + '|' + kind
      if (seen.has(sig)) return
      seen.add(sig)
      const priced = items.filter(it => it && typeof it === 'object' && priceOfItem(it) !== null)
      if (!priced.length) return
      const it0 = priced[0]
      out.push({
        key,
        kind,
        n: priced.length,
        firstKeys: Object.keys(it0).slice(0, 12),
        price: priceOfItem(it0),
        priceText: it0.priceText || '',
        sample: priced.slice(0, 3).map(x => ({
          price: priceOfItem(x),
          priceText: x.priceText || '',
          skuId: x.skuId || '',
          name: specOfItem(x),
          keys: Object.keys(x).slice(0, 12),
        })),
      })
    }
    for (const p of payloads) {
      walk(p.data, (k, v) => {
        if (Array.isArray(v)) push(String(k), 'array', v.filter(x => x && typeof x === 'object'))
        else if (v && typeof v === 'object') push(String(k), 'object', Object.values(v).filter(x => x && typeof x === 'object'))
      })
    }
    return out.slice(0, 25)
  }

  /* ---------------------------------------------------------------- 价格 */

  /** 数组项里的单价（priceText 优先，其次 price/skuPrice/...） */
  function priceOfItem(it) {
    if (!it || typeof it !== 'object') return null
    if (it.priceText && /[\d.]/.test(it.priceText)) {
      const m = String(it.priceText).match(/(\d+(?:\.\d+)?)/)
      if (m) {
        const v = parseFloat(m[1])
        if (v > 0.01 && v < 1000000) return v
      }
    }
    for (const k of ['price', 'skuPrice', 'salePrice', 'tradePrice', 'unitPrice', 'priceValue', 'minPrice', 'maxPrice']) {
      const n = num(it[k])
      if (n !== null && n > 0.01 && n < 1000000) return n
    }
    return null
  }

  /**
   * 找出「规格 → 价格」的数组型 SKU 列表（1688 里每个规格一条 price/priceText）
   * 返回 [{ key, score, entries: [{ spec, price, skuId, priceText }] }]
   *
   * 关键修正（2026-10-24）：
   *   之前只靠 key 名（sku/model/spec/prop）或「有 priceText」判定，
   *   导致**同店其它商品推荐列表**（offerList / majorRecommendOfferInfos / …）
   *   被当成 SKU 列表 → 把别人家的价格当成了本商品价格。
   *   现在增加：① 推荐容器路径排除 ② 条目级商品卡片识别 ③ 规格字段证据要求。
   */
  function collectSkuEntries(payloads) {
    const out = []
    // 0.5) 对象映射形态：{ '红色': { price, priceText } }（key 像 sku/priceMap）
    const objCands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 1 && n <= 120
    })
    for (const c of objCands) {
      if (isNoiseCandidate(c)) continue
      const key = String(c.key)
      if (!/sku|model|spec|prop|price/i.test(key)) continue
      const entries = []
      for (const kk of Object.keys(c.value)) {
        const it = c.value[kk]
        if (!it || typeof it !== 'object') continue
        if (isCardItem(it)) continue
        const pr = priceOfItem(it)
        if (pr === null) continue
        const raw = String(kk)
        const spec = specOfItem(it) || (raw.split(/[;；]/)[0].replace(/^[^:：]*[:：]/, '') || raw)
        entries.push({ spec: String(spec).slice(0, 40), price: pr, skuId: String(it.skuId || ''), priceText: it.priceText || '' })
      }
      if (!entries.length) continue
      const score = (/sku/i.test(key) ? 3 : 0) + (/spec/i.test(key) ? 2 : 0) + (/map/i.test(key) ? 1 : 0)
      out.push({ key, score, entries })
    }
    const arrCands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length <= 200)
    for (const c of arrCands) {
      if (isNoiseCandidate(c)) continue
      let items = c.value.filter(it => it && typeof it === 'object' && !Array.isArray(it))
      // 条目级过滤：商品卡片（带 offerId/offerUrl/behaviorTag）不是规格行
      const cards = items.filter(isCardItem)
      if (cards.length) items = items.filter(it => !isCardItem(it))
      if (!items.length) continue
      const key = String(c.key)
      const isSkuKey = /sku|model|spec|prop|saleprop/i.test(key)
      const hasText = items.some(it => it.priceText && /[\d.]/.test(it.priceText))
      // 规格证据：必须有真正的规格字段（不能只靠 priceText 或标题）
      const hasSpec = items.some(it => it.skuId || it.skuName || it.spec || it.specName || it.propName || it.attrName || it.skuAttr || it.specValue || it.propValue)
      if (!isSkuKey && !hasSpec && !hasText) continue
      const entries = []
      for (const it of items) {
        const pr = priceOfItem(it)
        if (pr === null) continue
        entries.push({
          spec: skuSpecOfItem(it),
          price: pr,
          skuId: String(it.skuId || it.id || ''),
          priceText: it.priceText || '',
        })
      }
      if (!entries.length) continue
      // 数组形态优先（1688 最常见的 SKU 列表形态）
      const score = (/sku/i.test(key) ? 3 : 0) + (/spec/i.test(key) ? 2 : 0) + (/price/i.test(key) ? 1 : 0) + (hasText ? 1 : 0) + 2
      out.push({ key, score, entries })
    }
    out.sort((a, b) => b.score - a.score)
    return out
  }

  /** 条目里的规格名 */
  function specOfItem(it) {
    if (!it || typeof it !== 'object') return ''
    for (const k of ['skuName', 'specName', 'propName', 'attrName', 'skuAttr', 'spec', 'name', 'title']) {
      const v = it[k]
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 40)
    }
    return ''
  }

  /**
   * SKU 列表里的「规格名」：必须是短规格词（颜色/尺码/款式），
   * 不能是整段商品标题（那是商品卡片，不是规格行）。
   */
  function skuSpecOfItem(it) {
    if (!it || typeof it !== 'object') return ''
    for (const k of ['skuName', 'specName', 'propName', 'attrName', 'skuAttr', 'spec', 'specValue', 'propValue']) {
      const v = it[k]
      if (typeof v === 'string' && v.trim()) {
        const s = v.trim()
        if (s.length > 24) continue // 太长 → 是商品标题不是规格
        return s.slice(0, 40)
      }
    }
    // 退化情况：只有 name/title，但很长 → 视为无规格
    for (const k of ['name', 'title']) {
      const v = it[k]
      if (typeof v === 'string' && v.trim() && v.trim().length <= 24) return v.trim().slice(0, 40)
    }
    return ''
  }

  /**
   * 从「同店/推荐商品列表」里找**当前商品自己**的那一条。
   * 1688 的 offerList 里每条是另一个 offer（带 offerId/offerUrl），
   * 其中可能有一条 isCurrentOffer=true（或 offerId 与当前页一致）——那才是本商品的价格。
   * 返回 { price, offerId, title, priceText } 或 null。
   */
  function pickCurrentOfferCard(payloads, offerId) {
    const target = String(offerId || '')
    let found = null
    for (const p of payloads) {
      walk(p.data, (k, v, parent, path) => {
        if (found) return
        if (!Array.isArray(v)) return
        for (const it of v) {
          if (!it || typeof it !== 'object') continue
          if (!isCardItem(it)) continue
          const isCur = it.isCurrentOffer === true ||
            it.isCurrentOffer === 'true' ||
            (target && String(it.offerId || '') === target)
          if (!isCur) continue
          const pr = priceOfItem(it)
          if (pr === null) continue
          found = {
            price: pr,
            priceText: it.priceText || '',
            offerId: String(it.offerId || ''),
            title: String(it.title || it.name || '').slice(0, 60),
            container: (path || []).concat(String(k)).join('.'),
          }
          return
        }
      })
    }
    return found
  }

  function pickPrices(payloads, opts) {
    const currentOfferId = (opts && opts.offerId) || ''
    const cands = collect(payloads, (k, v, parent, path) => {
      const t = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
      if (!t) return false
      if (/[\d.]+\s*[-~～至]\s*[\d.]+/.test(t)) return true
      const n = num(t)
      return n !== null && n > 0.01 && n < 1000000
    }).filter(c => !isNoiseCandidate(c)) // 排除推荐位/商品卡片里的别人的价格

    let best = { lo: null, hi: null, score: -99, why: '' }
    const skuCandidates = []

    /* ---- A) SKU 列表：数组项里带价格 → 取「第一个规格的价格」 ---- */
    const arrCands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length <= 200)
    const skuArrays = collectSkuEntries(payloads)
    for (const s of skuArrays) {
      skuCandidates.push({ key: s.key, n: s.entries.length, price: s.entries[0].price, priceText: s.entries[0].priceText, spec: s.entries[0].spec })
    }
    if (skuArrays.length) {
      const s = skuArrays[0]
      const e0 = s.entries[0]
      best = { lo: e0.price, hi: e0.price, score: 99, why: 'sku:first(' + s.key + ' → ' + (e0.spec || e0.priceText || '第一个规格') + ')' }
    }

    /* ---- A2) 没有真实 SKU 列表 → 尝试「当前商品卡片」的价格 ---- */
    if (best.lo === null) {
      const cur = pickCurrentOfferCard(payloads, currentOfferId)
      if (cur) {
        best = { lo: cur.price, hi: cur.price, score: 88, why: 'current-offer(' + cur.container + ' → ' + (cur.title || cur.offerId) + ')' }
      }
    }

    /* ---- B) 阶梯价列表：第一个档位的价格（单 SKU 时的真实批发价） ---- */
    if (best.lo === null) {
      for (const c of arrCands) {
        if (isNoiseCandidate(c)) continue
        const key = String(c.key)
        if (!/pricetier|steprice|price.*tier|multiprice|ladder|priceRangeList|priceRanges|priceInfoList/i.test(key)) continue
        const items = c.value.filter(it => it && typeof it === 'object')
        const priced = items.map(it => ({ it, p: priceOfItem(it) })).filter(x => x.p !== null)
        if (!priced.length) continue
        const hasQty = items.some(it => /beginAmount|begin|quantity|qty|minCount/i.test(Object.keys(it).join(',')))
        if (!hasQty && !/priceInfoList/i.test(key)) continue
        best = { lo: priced[0].p, hi: priced[0].p, score: 90, why: 'tier:first(' + key + ')' }
        break
      }
    }

    /* ---- C) 区间字符串（priceRange: "1.20-3.50"） ---- */
    for (const c of cands) {
      if (best.lo !== null) break
      const m = String(c.value).match(/([\d.]+)\s*[-~～至]\s*([\d.]+)/)
      if (!m) continue
      const s = keyScore(c.key, K.price)
      if (s <= 0) continue
      const lo = parseFloat(m[1]); const hi = parseFloat(m[2])
      if (lo <= 0.01 || hi < lo || hi > 1000000) continue
      best = { lo: Math.min(lo, hi), hi: Math.max(lo, hi), score: s, why: 'range:' + c.key }
    }

    /* ---- D) min/max 配对（必须两个 key 都像价格，且不能是数量/总价） ---- */
    if (best.lo === null) {
      const lows = cands.filter(c => /(^|[^a-z])(min|lowest|low)([^a-z]|$)/i.test(c.key) && keyScore(c.key, K.price) > 0)
      const highs = cands.filter(c => /(^|[^a-z])(max|highest|high|upper)([^a-z]|$)/i.test(c.key) && keyScore(c.key, K.price) > 0)
      if (lows.length && highs.length) {
        const bestLow = lows.map(c => ({ c, s: keyScore(c.key, K.price) })).sort((a, b) => b.s - a.s)[0]
        const bestHigh = highs.map(c => ({ c, s: keyScore(c.key, K.price) })).sort((a, b) => b.s - a.s)[0]
        const lo = num(bestLow.c.value); const hi = num(bestHigh.c.value)
        if (lo !== null && hi !== null && lo > 0.01 && hi >= lo && hi < 1000000) {
          best = { lo, hi, score: Math.min(bestLow.s, bestHigh.s) + 2, why: 'minmax:' + bestLow.c.key + '/' + bestHigh.c.key }
        }
      }
    }

    /* ---- E) 单值 ---- */
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

    /* ---- F) 接口里没有价格（1688 价格是前端渲染的）→ 走 DOM ---- */
    if (best.lo === null) {
      const dom = domFallback()
      if (dom.priceMin) best = { lo: dom.priceMin, hi: dom.priceMax ?? dom.priceMin, score: 0, why: 'dom' }
    }

    // 5) 价格候选清单（诊断用）
    const candidates = cands
      .map(c => ({ key: c.key, value: String(c.value).slice(0, 60), score: keyScore(c.key, K.price) }))
      .filter(c => c.score > 0)
      .slice(0, 40)

    return { lo: best.lo, hi: best.hi, why: best.why, candidates, skuCandidates }
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
    // 0) 数组型 SKU 列表（最准：每个规格一条 price/priceText）
    for (const group of collectSkuEntries(payloads)) {
      for (const e of group.entries) {
        const key = e.spec + '|' + e.price
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ spec: e.spec, price: e.price, skuId: e.skuId })
      }
    }
    if (out.length) return out
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
      if (isNoiseCandidate(c)) continue
      if (!/sku|price.*list|list.*price|skumodel|skuprice|skuprices/i.test(c.key)) continue
      if (/tier|beginamount|quantity|阶梯/i.test(c.key)) continue // 阶梯价表不是规格价
      for (const it of c.value) {
        if (!it || typeof it !== 'object') continue
        if (isCardItem(it)) continue // 商品卡片（别人家的货）
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

  /* ------------------------------------------------- 变体（颜色 / 规格） */
  /**
   * 变体维度名归一：
   *   颜色类 → color（颜色 / 色 / 颜色分类 / color）
   *   尺码类 → size（尺码 / 尺寸 / 大小 / 规格 / size）
   *   其它   → custom（款式 / 材质 / 型号 … 原名保留）
   *
   * 注意：用户要的是「颜色和规格或自定义」，所以维度名必须能自由扩展，
   * 不能写死成只有颜色和尺码两种。
   */
  const COLOR_DIM_RE = /(颜色|色别|色系|colour|color)/i
  const SIZE_DIM_RE = /(尺码|尺寸|大小|规格|尺寸码|size)/i

  function dimKind(name) {
    const n = String(name || '').trim()
    if (!n) return 'custom'
    if (COLOR_DIM_RE.test(n)) return 'color'
    if (SIZE_DIM_RE.test(n)) return 'size'
    return 'custom'
  }

  /** 解析「颜色:红色;尺码:M」这种组合键 */
  function parseComboKey(key) {
    const out = []
    for (const seg of String(key || '').split(/[;；]/)) {
      const s = seg.trim()
      if (!s) continue
      const i = s.search(/[:：]/)
      if (i < 0) { out.push({ name: '', value: s }); continue }
      const name = s.slice(0, i).trim()
      const value = s.slice(i + 1).trim()
      if (!value) continue
      out.push({ name, value })
    }
    return out
  }

  const SKU_ID_KEYS = ['skuId', 'skuID', 'skuIdStr', 'sku_id', 'outerId', 'outerid', 'skuCode']
  const SPEC_ARR_KEYS = ['specAttrs', 'skuAttrs', 'skuAttr', 'props', 'attributes', 'attrList', 'saleProp', 'skuProps', 'specList', 'propList']

  function skuIdOf(it) {
    for (const k of SKU_ID_KEYS) {
      const v = it[k]
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim()
    }
    return ''
  }

  /** SKU 行里的价格：优先数字字段，priceText 必须是「纯数字」才采 */
  function priceOfSkuItem(it) {
    const PRI = ['skuPrice', 'salePrice', 'tradePrice', 'priceValue', 'priceAmount', 'discountPrice', 'price', 'minPrice', 'lowestPrice']
    for (const k of PRI) {
      const n = num(it[k])
      if (n !== null && n > 0.01 && n < 1000000) return { price: n, priceText: it.priceText || '' }
    }
    const pt = String(it.priceText || '').trim()
    // "2件起批" 不是价格 —— 含数量单位的一律不算
    if (pt && !/[件起批个双份¥￥元\s]/.test(pt)) {
      const n = num(pt)
      if (n !== null && n > 0.01 && n < 1000000) return { price: n, priceText: pt }
    }
    return null
  }

  /** SKU 行里的规格维度（数组型 + 扁平型两种） */
  function specsOfSkuItem(it) {
    const out = []
    const firstStr = o => {
      for (const k of ['name', 'propName', 'attrName', 'key', 'label', 'propertyName', 'specName']) {
        const v = o[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
      return ''
    }
    const firstVal = o => {
      for (const k of ['value', 'propValue', 'attrValue', 'val', 'text', 'valueName', 'specValue', 'label']) {
        const v = o[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
        if (typeof v === 'number') return String(v)
      }
      return ''
    }
    // 1) 数组型：[{name,value}] / [{propName,propValue}]
    for (const k of SPEC_ARR_KEYS) {
      const arr = it[k]
      if (!Array.isArray(arr) || !arr.length) continue
      for (const o of arr) {
        if (!o || typeof o !== 'object') continue
        const name = firstStr(o)
        const value = firstVal(o)
        if (!name || !value) continue
        if (isJunkSpec(value) || isJunkSpec(name)) continue
        out.push({ name: name.slice(0, 30), value: value.slice(0, 60) })
      }
      if (out.length) return out
    }
    // 2) 扁平型：colorName / sizeName / 规格 …
    const FLAT_DIM_RE = /(颜色|色|尺码|尺寸|大小|规格|款式|型号|材质|style|color|size|spec|material)/i
    for (const k of Object.keys(it)) {
      if (!FLAT_DIM_RE.test(k)) continue
      if (/id$/i.test(k)) continue
      const v = it[k]
      if (typeof v !== 'string' && typeof v !== 'number') continue
      const s = String(v).trim()
      if (!s || s.length > 40 || isJunkSpec(s)) continue
      const dim = k.replace(/(name|value|val|text|label)$/i, '').trim() || k
      out.push({ name: dim.slice(0, 30), value: s })
    }
    if (out.length) return out
    // 3) 退化：只有 skuName（"红色 M" 这种组合文案）
    const sn = it.skuName || it.specName || it.saleProp
    if (typeof sn === 'string' && sn.trim() && sn.trim().length <= 40 && !isJunkSpec(sn)) {
      out.push({ name: '规格', value: sn.trim() })
    }
    return out
  }

  /** 路径里出现这些词 = 推荐位/别人家的货，不是本商品的变体 */
  const VARIANT_PATH_REJECT_RE = /(recommend|relation|major|similar|hotsale|shopcard|itemlist|hotrecommend)/i

  /**
   * 提取变体（SKU 维度）。
   *
   * 1688 的变体数据在不同接口/版本里有好几种形态，所以多路并行提取再合并：
   *   A. 自带规格的 SKU 行数组（最准）：[{skuId, specAttrs:[{name,value}], price, imageUrl}]
   *   B. 「组合键 → skuId」映射：{ "颜色:红色;尺码:M": "500000" }
   *   C. skuMap 值是对象：{ "红色": {skuId, price, imageUrl} }
   *
   * 返回 { variants, dims, source, candidates }
   *   variants: [{ skuId, specs:[{name,value}], color, size, specText, price, priceText, image }]
   *   dims:     [{ name, kind:'color'|'size'|'custom', values:[...] }]  ← 维度定义，够后台渲染选择器
   */
  function pickVariants(payloads) {
    const rows = []
    const seenRow = new Set()

    // ---- A. 自带规格的 SKU 行
    for (const p of payloads) {
      if (IMG_API_REJECT_RE.test(apiNameOf(p.url))) continue
      walk(p.data, (k, v, parent, path) => {
        if (!Array.isArray(v) || !v.length || v.length > 200) return
        const pth = (path || []).concat(String(k)).join('.')
        if (VARIANT_PATH_REJECT_RE.test(pth)) return
        for (const it of v) {
          if (!it || typeof it !== 'object' || Array.isArray(it)) continue
          if (it.behaviorTag !== undefined) continue // 推荐位卡片
          const pr = priceOfSkuItem(it)
          if (!pr) continue
          const specs = specsOfSkuItem(it)
          const id = skuIdOf(it)
          if (!specs.length && !id) continue
          const key = id + '|' + pr.price + '|' + specs.map(s => s.name + '=' + s.value).join(';')
          if (seenRow.has(key)) continue
          seenRow.add(key)
          rows.push({
            skuId: id,
            specs,
            price: pr.price,
            priceText: String(pr.priceText || ''),
            image: (() => { const u = normImage(imageUrlOf(it)); return u && !isBadImage(u) ? u : '' })(),
            path: pth,
          })
        }
      })
    }

    // ---- B/C. 组合键映射
    const comboGroups = []

    // B-0. 「skuId → 价格」的价格表（独立对象，与 skuMap 平行）
    //     例：{ "6001": 8.8, "6002": 9.9 }  或  { "6001": {price: 8.8} }
    const priceBySku = new Map()
    const priceMapCands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 1 && n <= 200 && /price/i.test(String(k))
    })
    for (const c of priceMapCands) {
      const pth = (c.path || []).join('.')
      if (VARIANT_PATH_REJECT_RE.test(pth)) continue
      for (const kk of Object.keys(c.value)) {
        const vv = c.value[kk]
        let p = null
        if (typeof vv === 'number' && Number.isFinite(vv) && vv > 0.01) p = vv
        else if (typeof vv === 'string' && /^\d+(\.\d+)?$/.test(vv)) p = Number(vv)
        else if (vv && typeof vv === 'object') {
          const pr = priceOfSkuItem(vv)
          if (pr) p = pr.price
        }
        if (p !== null && !priceBySku.has(kk)) priceBySku.set(kk, p)
      }
    }

    const objCands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 1 && n <= 200
    })
    for (const c of objCands) {
      const pth = (c.path || []).join('.')
      if (VARIANT_PATH_REJECT_RE.test(pth)) continue
      const combos = []
      for (const kk of Object.keys(c.value)) {
        const parts = parseComboKey(kk).filter(p => p.name && p.value)
        if (!parts.length) continue
        const val = c.value[kk]
        let id = ''
        let extra = null
        if (typeof val === 'string' || typeof val === 'number') {
          id = String(val)
        } else if (val && typeof val === 'object') {
          id = skuIdOf(val)
          const pr = priceOfSkuItem(val)
          extra = {
            price: pr ? pr.price : null,
            priceText: pr ? String(pr.priceText || '') : '',
            image: normImage(imageUrlOf(val)) || '',
          }
        }
        combos.push({ specs: parts, skuId: id, extra })
      }
      if (!combos.length) continue
      const score = (/skumap/i.test(c.key) ? 4 : 0) + (/sku/i.test(c.key) ? 2 : 0) +
        (/map/i.test(c.key) ? 1 : 0) + (/model/i.test(c.key) ? 1 : 0)
      comboGroups.push({ key: c.key, path: pth, combos, score })
    }
    comboGroups.sort((a, b) => b.score - a.score)

    // ---- 合并
    const bySku = new Map()
    for (const r of rows) {
      if (!r.skuId) continue
      if (!bySku.has(r.skuId)) bySku.set(r.skuId, r)
    }

    const variants = []
    const usedKeys = new Set()
    const pushVariant = (v) => {
      const key = v.specs.map(s => s.name + '=' + s.value).join(';') + '|' + v.price
      if (usedKeys.has(key)) return
      usedKeys.add(key)
      variants.push(v)
    }

    // A 优先（自带规格 + 价格）
    for (const r of rows) {
      if (!r.specs.length) continue
      pushVariant({
        skuId: r.skuId,
        specs: r.specs,
        color: '',
        size: '',
        specText: r.specs.map(s => s.value).join(' / '),
        price: r.price,
        priceText: r.priceText,
        image: r.image,
      })
    }

    // B/C 补齐（组合键有维度但没在 A 里出现过）
    for (const g of comboGroups) {
      for (const cb of g.combos) {
        const matched = rows.find(r => r.skuId && cb.skuId && r.skuId === cb.skuId)
        const key = cb.specs.map(s => s.name + '=' + s.value).join(';')
        if (usedKeys.has(key + '|' + (matched ? matched.price : (cb.extra && cb.extra.price)))) continue
        const price = matched ? matched.price : (cb.extra ? cb.extra.price : null)
        // 价格可能来自平行的「skuId → 价格」表（如 skuPriceMap）
        const finalPrice = (price === null || price === undefined) && cb.skuId
          ? (priceBySku.get(cb.skuId) ?? null)
          : price
        if (finalPrice === null || finalPrice === undefined) continue
        pushVariant({
          skuId: cb.skuId || (matched ? matched.skuId : ''),
          specs: cb.specs,
          color: '',
          size: '',
          specText: cb.specs.map(s => s.value).join(' / '),
          price: finalPrice,
          priceText: matched ? matched.priceText : (cb.extra ? cb.extra.priceText : ''),
          image: (matched && matched.image) || (cb.extra ? cb.extra.image : ''),
        })
      }
    }

    // ---- 维度定义
    const dimMap = new Map()
    for (const v of variants) {
      for (const s of v.specs) {
        if (!dimMap.has(s.name)) dimMap.set(s.name, { name: s.name, kind: dimKind(s.name), values: [] })
        const d = dimMap.get(s.name)
        if (!d.values.includes(s.value)) d.values.push(s.value)
      }
    }
    const dims = Array.from(dimMap.values())

    // ---- 填 color / size
    for (const v of variants) {
      for (const s of v.specs) {
        const k = dimKind(s.name)
        if (k === 'color' && !v.color) v.color = s.value
        if (k === 'size' && !v.size) v.size = s.value
      }
    }

    const source = variants.length
      ? (rows.filter(r => r.specs.length).length ? 'sku-rows' : 'combo-map')
      : ''

    return {
      variants,
      dims,
      source,
      candidates: {
        skuRows: rows.length,
        comboGroups: comboGroups.length,
        comboGroupPaths: comboGroups.slice(0, 6).map(g => g.key + ' @ ' + g.path),
        sampleRow: rows[0] || null,
        sampleCombo: comboGroups[0] ? { key: comboGroups[0].key, path: comboGroups[0].path, first: comboGroups[0].combos[0] } : null,
      },
    }
  }

  /* ------------------------------------------------------- 属性（基本描述） */
  const firstStrOf = (o, keys) => {
    for (const k of keys) {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }

  /**
   * 商品基本属性表（1688 的「产品属性」）。
   * 用户要的「描述」就是这份属性表 —— 不是详情页那段图片 HTML。
   */
  function pickAttributeTable(payloads) {
    const flat = {}
    // SKU 维度容器（skuProps / skuMap / specAttrs …）是「规格」不是「属性」，
    // 混进属性表会把描述写成「颜色: 红色 / 尺码: M」这种无意义内容。
    const ATTR_REJECT_RE = /(sku|spec|saleprop|sale_prop|variation|option|model|price|stock|quantity|mount|delivery|freight|shipping|trade|order|coupon|company|seller|shop|member|service)/i
    // 1) 数组型：[{propName, value}] / [{name, value}]
    const arrCands = collect(payloads, (k, v) => Array.isArray(v) && v.length && v.length <= 80)
    const arrGroups = []
    for (const c of arrCands) {
      if (isNoiseCandidate(c)) continue
      const pth = (c.path || []).join('.')
      if (VARIANT_PATH_REJECT_RE.test(pth)) continue
      if (ATTR_REJECT_RE.test(c.key)) continue
      if (ATTR_REJECT_RE.test(pth)) continue
      const items = c.value.filter(it => it && typeof it === 'object' && !Array.isArray(it))
      if (!items.length) continue
      let hits = 0
      const tmp = {}
      for (const it of items) {
        // 真实 1688 结构是 { property, value }（2026-05 用户实采确认）
        const name = firstStrOf(it, ['property', 'propName', 'name', 'attrName', 'propertyName', 'key', 'label'])
        const value = firstStrOf(it, ['value', 'propValue', 'attrValue', 'val', 'text', 'valueName'])
        if (!name || !value) continue
        if (isJunkSpec(name) || isJunkSpec(value)) continue
        if (!tmp[name]) tmp[name] = value
        hits++
      }
      if (hits < 2) continue
      const score = keyScore(c.key, {
        strong: ['offerDecisionAttrs', 'offerProps', 'baseProps', 'productProps', 'productAttributes', 'offerAttributes', 'propertyList', 'attributeList'],
        weak: ['paramList', 'props', 'attributes', 'attrList', 'params'],
        neg: ['recommend', 'relation', 'shop', 'member', 'logistics', 'freight', 'comment', 'rate', 'endorsement', 'trackinfo', 'delivery'],
      })
      if (score <= 0) continue
      arrGroups.push({ key: c.key, path: pth, score, data: tmp })
    }
    arrGroups.sort((a, b) => b.score - a.score)
    for (const g of arrGroups) {
      for (const k of Object.keys(g.data)) if (!flat[k]) flat[k] = g.data[k]
    }

    // 2) 对象型：{ "品牌": "xx", "材质": "xx" }
    const objCands = collect(payloads, (k, v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false
      const n = Object.keys(v).length
      return n >= 2 && n < 80
    })
    for (const c of objCands) {
      if (isNoiseCandidate(c)) continue
      const pth = (c.path || []).join('.')
      if (VARIANT_PATH_REJECT_RE.test(pth)) continue
      if (ATTR_REJECT_RE.test(c.key)) continue
      if (ATTR_REJECT_RE.test(pth)) continue
      const score = keyScore(c.key, {
        strong: ['offerDecisionAttrs', 'offerProps', 'baseProps', 'productProps', 'productAttributes', 'propertyList'],
        weak: ['paramList', 'props', 'attributes', 'attr', 'params'],
        neg: ['recommend', 'relation', 'shop', 'member', 'comment', 'rate', 'freight', 'endorsement', 'trackinfo', 'delivery'],
      })
      if (score <= 0) continue
      for (const k of Object.keys(c.value).slice(0, 60)) {
        const v = c.value[k]
        if (typeof v === 'string' && v.trim() && !flat[k] && !isJunkSpec(k)) flat[k] = v.trim()
        else if (typeof v === 'number' && !flat[k]) flat[k] = String(v)
      }
    }

    if (!Object.keys(flat).length) return undefined
    // 属性值太长的不是「基本属性」，是描述正文
    const out = {}
    for (const k of Object.keys(flat)) {
      const v = String(flat[k])
      if (v.length > 120) continue
      out[k.slice(0, 40)] = v
    }
    return Object.keys(out).length ? out : undefined
  }

  /** 把属性表转成描述文本（后台/前台都能直接显示） */
  function attributeTableToText(attrs) {
    if (!attrs || typeof attrs !== 'object') return ''
    return Object.keys(attrs)
      .map(k => k + ': ' + attrs[k])
      .join('\n')
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

  /**
   * 描述字段的**路径**判定。
   *
   * 真实情况（2026-10-24，用「复制结构」拿到 1688 真实报文后确认）：
   * mtop.1688.mmga.offerdetail.service 的报文里**根本没有商品描述**。
   * 长得像描述的字段实际是：
   *   data.data.data.protectionInfoList.description → 「通过官方退货仓将全网售后包裹转寄1688商家…」
   *   data.data.data.operateButtonList...            → 操作按钮
   *   data.data.deliveryLimitTimeModel.limitTimeDesc → 「常发圆通快递」
   *   data.data.result.offerRateInfo...              → 评价信息
   * 之前 pickDescription 按 key 名打分（key='description' 就 +5），
   * 于是把「退货仓说明」当成了商品描述。
   *
   * 商品描述的真实来源：**DOM 里的 .desc-lazyload-container**
   * （1688 把详情 HTML 渲染在页面里，接口只给图集和属性）。
   */
  const DESC_PATH_REJECT_RE = new RegExp([
    'protectioninfo', 'operatebutton', 'deliverylimit', 'limitTimeDesc',
    'expectTimeDesc', 'rateinfo', 'commentlist', 'offerRateInfo', 'downstreamperformance',
    'tips', 'membertip', 'commtip', 'freight', 'logistics', 'coupon', 'banner',
    'recommend', 'related', 'shopcard', 'adinfo', 'promotion',
  ].join('|'), 'i')

  /** 描述的路径优先级 */
  function descPathScore(fullPath) {
    const p = String(fullPath)
    if (DESC_PATH_REJECT_RE.test(p)) return -100
    let s = 0
    if (/offerdescription|offerdetail|detailhtml|deschtml/i.test(p)) s += 60
    if (/modulecontent|detailcontent|detaildesc/i.test(p)) s += 45
    if (/description/i.test(p)) s += 30
    if (/(^|\.)desc$|\.desc\./i.test(p)) s += 25
    if (/richText|richtext/i.test(p)) s += 20
    if (/content/i.test(p)) s += 12
    if (/html/i.test(p)) s += 10
    return s
  }

  function pickDescription(payloads) {
    // 1) 接口：按**路径**判定，避开那些「长得像描述但其实不是」的字段
    //    注意：还要排掉 URL —— 老版本就是靠这条把**图片地址**当成了商品描述
    //    （老逻辑 key 不在 neg 列表就入选，score=0 也能拿第一）
    const cands = collect(payloads, (k, v) =>
      typeof v === 'string' && v.length >= 20 && !/^https?:\/\//i.test(v) && !/^data:/i.test(v))
    let best = ''
    let bestScore = -99
    for (const c of cands) {
      const full = (c.path || []).concat(c.key).join('.')
      const s = descPathScore(full)
      if (s <= 0) continue
      const score = s + (c.value.length > 200 ? 3 : 0)
      if (score > bestScore) { bestScore = score; best = c.value }
    }

    // 2) DOM 优先：1688 的真实商品描述在 .desc-lazyload-container 里
    const dom = domFallback()
    const domDesc = dom.description || ''
    if (domDesc && domDesc.length > 20) {
      // DOM 描述更可信，接口只做兵底
      return domDesc.slice(0, 40000)
    }
    return best.slice(0, 40000)
  }

  /**
   * 采集报文的**完整结构树**（诊断用）。
   *
   * 用途：描述和商品图到底藏在哪个字段，此前一直是猜的
   * （“哪个 key 像 description 就用哪个”“第一个不像 logo 的图就是主图”）。
   * 猜就会错 —— 实测就抓错过：评价图（-rate）、店铺装修图（/cms/upload/）、
   * 推荐位别的商品的图。
   *
   * 这个函数把每条报文的叶子路径 + 类型 + 短预览原样吐出来，
   * 粘给开发者就能直接看出 1688 把商品描述和商品图放在哪。
   */
  const STRUCT_KEY_RE = /(desc|detail|content|html|img|image|pic|photo|video|offer|sku|attr|prop|title|name|text|body)/i
  const STRUCT_HIT_RE = /(desc|html|img|image|pic|photo|video|sku|attr)/i
  const STRUCT_PRIO_RE = /(offerdetail|cupid|moduleasync|resource|detail|images|sku)/i

  /** 变体相关键名（诊断用） */
  const VSK_KEY_RE = /(sku|spec|prop|attr|variation|saleProp|model|combination|option|param)/i

  /**
   * 「复制变体结构」诊断（v3：精准模式）。
   *
   * v1 只吐叶子 → 被 property/value 刷屏，真 SKU 容器被 24 条上限挤掉。
   * v2 只吐容器 → 噪声仍多（model/param 全是假命中）。
   * v3（当前）：
   *   ① 优先：路径里含「sku」的容器，直接吐原始 JSON（这是要的关键信息）
   *   ② 附：每个报文 data.data 的**顶层 key 列表**（廉价、高信噪比，
   *      能看到 platformProductInfoMap 下还有哪些兄弟节点）
   *   ③ 已知无需再查的（属性表 offerDecisionAttrs）不再重复输出
   */
  /**
   * 「复制变体结构」诊断（v4：全量 + 容器内部）。
   *
   * v3 实测结果（2026-05 真实报文，25 个）：
   * - 25 个报文的 skuHits **全为空** → 真实 SKU 容器**名字里不含 "sku"**
   * - 报文是**分片返回**的：同一个 offerdetail 接口被调多次，每次只带一部分内容字段
   *   （有的带 platformProductInfoMap，有的带 priceInfoList …）
   * → 必须**看完所有 25 个报文的内容层 key 并集**，才能定位真正的变体容器
   *
   * v4 输出：
   *   layers  ：每个报文各层的 key（不硬编码深度）
   *   deep    ：名字像变体/价格的容器的**内部结构**（原样 JSON 截断）
   */
  /**
   * 「复制变体结构」诊断（v4：全量 + 容器内部 + key 并集）。
   *
   * v3 实测结果（2026-05 真实报文，25 个）：
   * - 25 个报文的 skuHits **全为空** → 真实 SKU 容器**名字里不含 "sku"**
   * - 报文是**分片返回**的：同一个 offerdetail 接口被调多次，每次只带一部分内容字段
   *   （有的带 platformProductInfoMap，有的带 priceInfoList …）
   * → 必须**看完所有报文的内容层 key 并集**，才能定位真正的变体容器
   *
   * v4 输出：
   *   contentKeyUnion : 所有报文「内容层 key」的并集（一眼看全貌，最重要）
   *   allKeyUnion     : 所有层出现过的 key 并集（含外层信封）
   *   payloads[]      : 每个报文的 api + 内容层 key + 可疑容器的内部结构
   */
  function dumpVariants(payloads) {
    // 可能装变体/价格的容器名（真实报文里没有 "sku" 字样，所以要放宽）
    const INTEREST = /(price|sku|spec|prop|model|item|sale|stock|attr|quantity|offer|template|config|map|list)/i
    const out = []
    const contentUnion = []
    const allUnion = []
    const addUnion = (arr, keys) => {
      for (const k of keys) if (!arr.includes(k)) arr.push(k)
    }

    for (const p of payloads) {
      const api = (String(p.url || '').match(/api=([\w.]+)/) || [])[1] || p.from || 'unknown'

      const deep = []
      let node = p.data
      let pathLabel = ''
      let contentKeys = []
      let depth = 0

      for (let guard = 0; guard < 6; guard++) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) break
        const ks = Object.keys(node)
        if (!ks.length) break
        addUnion(allUnion, ks)
        contentKeys = ks
        depth++

        // 这一层里名字可疑的容器 → 挖内部结构
        for (const k of ks) {
          if (!INTEREST.test(k)) continue
          const v = node[k]
          if (!v || typeof v !== 'object') continue
          const isArr = Array.isArray(v)
          const size = isArr ? v.length : Object.keys(v).length
          if (!size) continue
          if (deep.length >= 5) break
          let json = ''
          try {
            json = JSON.stringify(isArr ? v.slice(0, 2) : v)
          } catch (e) {
            json = '[unserializable]'
          }
          deep.push({
            path: (pathLabel ? pathLabel + '.' : '') + k,
            shape: (isArr ? 'array(' + size + ')' : 'object(' + size + ')'),
            json: json.slice(0, 700),
          })
        }

        // 继续下钻到 .data
        if (node.data && typeof node.data === 'object' && !Array.isArray(node.data)) {
          pathLabel = pathLabel ? pathLabel + '.data' : 'data'
          node = node.data
          continue
        }
        break
      }

      addUnion(contentUnion, contentKeys)
      out.push({ api: api, depth: depth, contentKeys: contentKeys, deep: deep })
    }

    return { contentKeyUnion: contentUnion, allKeyUnion: allUnion, payloads: out }
  }

  function dumpStructure(payloads) {
    const all = []
    for (const p of payloads) {
      const api = (String(p.url || '').match(/api=([\w.]+)/) || [])[1] || p.from || 'unknown'
      const leaves = []
      walk(p.data, (k, v, parent, path) => {
        const pth = (path || []).concat(String(k)).join('.')
        const keyStr = String(k)
        if (!STRUCT_KEY_RE.test(keyStr) && !STRUCT_KEY_RE.test(pth)) return
        if (leaves.length > 60) return
        let preview = ''
        const t = typeof v
        if (t === 'string') preview = v.slice(0, 70).replace(/\s+/g, ' ')
        else if (t === 'number' || t === 'boolean') preview = String(v)
        else if (Array.isArray(v)) preview = '[array n=' + v.length + ']'
        else if (v && typeof v === 'object') preview = '{' + Object.keys(v).slice(0, 8).join(',') + '}'
        leaves.push({ path: pth, type: t, preview: preview })
      })
      const hit = leaves.filter(l => STRUCT_HIT_RE.test(l.path))
      if (!hit.length) continue
      all.push({ api: api, url: scrubUrl(p.url), leaves: hit.slice(0, 36) })
    }
    // 详情类接口优先，只保留最相关的几条，避免粘贴被截断
    all.sort((a, b) => (STRUCT_PRIO_RE.test(b.api) ? 1 : 0) - (STRUCT_PRIO_RE.test(a.api) ? 1 : 0))
    return all.slice(0, 8)
  }

  /* -------------------------------------------------------------- 图片 */

  /**
   * 路径级的「这不是本商品的数据」判定。
   *
   * 真实情况（2026-10-24，用「复制结构」拿到 1688 真实报文后确认）：
   * 同一个 key 名 `imageUrl` 会在很多不同路径上出现：
   *   data.currentOffer.imageUrl  → **本商品**的图  ✅
   *   data.offerList.imageUrl     → **别的商品**的图（相关推荐）❌
   *   data.data.itemList.imageUrl → 别的商品（带 shopIconUrl = 店铺推荐）❌
   *   data.data.result.offerRateInfo...ratePics.picUrl → 评价图 ❌
   *   data.data.downstreamPerformance...image → “完好率”徽章 ❌
   *
   * 之前只按**叶子 key 名**打分（'imageUrl' 全部 +5 分），
   * 谁先被遍历到谁赢 —— 于是把推荐位的别的商品图当成了主图。
   * 必须按**完整路径**判断。
   */
  const IMG_PATH_REJECT_RE = new RegExp([
    'itemlist', 'recommend', 'related', 'similar', 'hotsale',
    'ratepics', 'commentlist', 'offerrateinfo', 'rateinfo', 'ratelist',
    'shopicon', 'shopinfo', 'posteruser', 'memberidentity', 'avatar',
    'downstreamperformance', 'operatebutton', 'protectioninfo',
    'deliverylimit', 'logistics', 'freight', 'coupon', 'banner',
    'cupid', 'resource', 'module', 'promotion', 'adinfo', 'shopcard',
  ].join('|'), 'i')

  /**
   * 评价/评论类接口 —— 里面的图全是买家秀，不是商品图。
   *
   * 注意：不能只靠 URL 后缀判。
   * 实测（2026-10-24）评价接口里有两种图：
   *   data.model.images.url      → ...-0-rate.jpg      （后缀能判）
   *   data.data.result.offerRateInfo.model.ratePics.picUrl
   *                             → cbu01.alicdn.com/i3/O1CN01...  （**没有** -rate 后缀）
   * 所以必须按**接口名**排掉。
   */
  const IMG_API_REJECT_RE = /rateservice|queryrated|dsrrate|comment|evaluate|review|rateinfo|cupid\.resource/i

  /** 图片的路径优先级：越大越像「本商品的图」 */
  function imgPathScore(fullPath) {
    const p = String(fullPath)
    if (IMG_PATH_REJECT_RE.test(p)) return -100
    let s = 0
    if (/currentoffer/i.test(p)) s += 60
    if (/offerimglist|offerimages|mainimages|mainpics|gallery|imageList|imgList|offerImg/i.test(p)) s += 50
    if (/skuimage|skuimg|skuimageurl/i.test(p)) s += 40
    // offerList = 本商品的 SKU 列表（每行含 priceTypeText/priceText），保留
    if (/offerlist/i.test(p)) s += 30
    if (/offer\.(images|imageList|imgList)|detailimage|descimage/i.test(p)) s += 45
    if (/imageurl|imageUrlList|mainpic|mainPic/i.test(p)) s += 20
    if (/image|img|pic|photo/i.test(p)) s += 8
    return s
  }

  /** 从接口 URL 里拿 api 名 */
  function apiNameOf(url) {
    const m = String(url || '').match(/api=([\w.]+)/)
    return m ? m[1] : ''
  }

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

  /**
   * 评价图（买家秀）/ 视频封面 —— 不是商品主图。
   *
   * 真实情况（2026-10-24）：商品 1050723330804 的采集结果里，
   * 唯一拿到的图片是 `img.alicdn.com/imgextra/i4/O1CN01...-0-rate.jpg`
   * —— `-rate` 后缀是 1688 的**买家评价晒图**，被当成了商品主图。
   * （商品图一般在 `cbu01.alicdn.com/img/ibank/...` 这种 CDN 上。）
   *
   * 这类图要从主图候选里剔掉，否则会盖住真正的商品图 / DOM 兜底图。
   */
  const isReviewImage = u => /-0?rate[._-]|-rate\.(jpg|jpeg|png|webp)|_rate\.(jpg|jpeg|png|webp)/i.test(String(u || ''))

  /**
   * 店铺装修图（banner / logo / 底图）—— 不是商品图。
   *
   * 真实情况（2026-10-24）：商品 1063529533354 的 images 里有
   *   https://cbu01.alicdn.com/cms/upload/2016/790/696/2696097_1254399316.png
   *   https://cbu01.alicdn.com/cms/upload/2015/797/334/2433797_1490276829.png
   * —— `/cms/upload/YYYY/MM/DD/` 是 1688 店铺装修资源（店招/横幅），
   * 与商品无关。商品图在 `/img/ibank/`、`/img/offer/` 这类路径下。
   */
  const isShopAsset = u => /\/cms\/(upload|icons?|banner|image)\//i.test(String(u || ''))

  /** 主图/图片列表一律不要评价图 */
  const isBadImage = u => isAsset(u) || isReviewImage(u) || isShopAsset(u)

  /** 从一个图片项里取出 URL */
  function imageUrlOf(it) {
    if (typeof it === 'string') return it
    if (!it || typeof it !== 'object') return null
    let u = it.url || it.imgUrl || it.imageUrl || it.path || it.src || it.img ||
        it.originalUrl || it.bigPicUrl || it.mainPic || it.image || it.picUrl
    if (!u && it.info && typeof it.info === 'object') {
      u = it.info.url || it.info.imgUrl || it.info.path
    }
    return u || null
  }

  function pickImages(payloads) {
    // 候选：url + 完整路径（路径决定它是不是「本商品的图」）
    const cands = []
    const pushCand = (url, path, key, extra) => {
      const n = normImage(url)
      if (!n) return
      const full = (path || []).concat(key).join('.')
      cands.push({ url: n, path: full, score: imgPathScore(full) + (extra || 0) })
    }

    // 遍历每条报文的叶子，拿到「值 + 完整路径」
    for (const p of payloads) {
      // 评价类接口的图全是买家秀，直接不参与
      if (IMG_API_REJECT_RE.test(apiNameOf(p.url))) continue
      walk(p.data, (k, v, parent, path) => {
        if (typeof v === 'string') {
          if (!/alicdn|1688|cbu|taobao/i.test(v)) return
          if (!/\.(jpg|jpeg|png|webp)/i.test(v) && !/alicdn\.com/i.test(v)) return
          pushCand(v, path, k)
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          const u = imageUrlOf(v)
          if (u) pushCand(u, path, k)
        }
      })
    }

    // 过滤掉「不是本商品数据」的路径
    const good = cands.filter(c => c.score > 0)

    // 主图：currentOffer 的图 > 图集数组的第一张 > 其他高分单图
    //      （必须跳过评价图/店铺图，否则会把买家秀当主图）
    let mainImage = ''
    let mainImageWhy = ''
    const curOffer = good.find(c => /currentoffer/i.test(c.path) && !isBadImage(c.url))
    if (curOffer) { mainImage = curOffer.url; mainImageWhy = 'currentOffer' }
    if (!mainImage) {
      const arrFirst = good.find(c =>
        /offerimglist|offerimages|mainimages|mainpics|gallery/i.test(c.path) && !isBadImage(c.url))
      if (arrFirst) { mainImage = arrFirst.url; mainImageWhy = 'gallery' }
    }
    if (!mainImage) {
      const best = good.slice().sort((a, b) => b.score - a.score).find(c => !isBadImage(c.url))
      if (best) { mainImage = best.url; mainImageWhy = 'score:' + best.path }
    }

    // 列表：主图置顶 → 其余按路径分数降序 → 同分按接口原顺序
    const seen = new Set()
    const list = []
    if (mainImage && !isBadImage(mainImage)) { list.push(mainImage); seen.add(mainImage) }
    const rest = good
      .filter(c => !isBadImage(c.url) && !seen.has(c.url))
      .sort((a, b) => b.score - a.score)
    for (const c of rest) {
      if (list.includes(c.url)) continue
      list.push(c.url)
      if (list.length >= 20) break
    }

    // DOM 兵底补充（图集区 → 详情区）
    const dom = domFallback()
    for (const u of dom.images) {
      const n = normImage(u)
      if (n && !list.includes(n) && !isBadImage(n)) list.push(n)
    }
    // 详情区图片也算商品图（1688 详情区常常就是一组商品图）
    for (const u of (dom.descImages || [])) {
      const n = normImage(u)
      if (n && !list.includes(n) && !isBadImage(n)) list.push(n)
    }
    if (!mainImage && dom.mainImage && !isBadImage(dom.mainImage)) {
      mainImage = dom.mainImage
      mainImageWhy = 'dom'
      // DOM 兵底的主图必须在列表首位（否则 images[0] 不是主图）
      const n = normImage(mainImage)
      if (n && !list.includes(n)) list.unshift(n)
    }

    // 全是素材图时，宁可要素材图也不要空
    if (!list.length) {
      const any = cands.map(c => c.url).filter(u => !isReviewImage(u))
      if (any.length) list.push(any[0])
    }
    return { list: list.slice(0, 20), main: mainImage, mainWhy: mainImageWhy }
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
  /** 规格名是否是无意义的技术字段（如 args / arg1 / spm / x-ssr） */
  function isJunkSpec(v) {
    const t = String(v || '').trim()
    if (!t) return true
    if (t.length > 40) return true
    return /^(args?|arg\d*|spm|x-ssr|detail|offer_id|offerId|itemId|id|none|null|undefined|true|false|detailRedirectUrl|x-fcc|skeleton)$/i.test(t)
  }

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
      if (!out.firstSku && !isJunkSpec(specVal) && !isJunkSpec(firstSeg)) out.firstSku = specVal || firstSeg
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
        if (isJunkSpec(val) || isJunkSpec(text)) continue
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
    const out = { title: '', priceMin: null, priceMax: null, moq: null, images: [], descImages: [], supplierName: '', description: '', attributes: undefined }
    const t = document.querySelector('h1.d-title, .title-text, .offer-title, h1')
    if (t) out.title = clean(t.innerText || t.textContent)
    // 主商品价格：限定在主价格区域，排除推荐位卡片里的别人的价格
    const RECO_RE = /recommend|similar|relative|hot|others|guess|recommends/i
    const isRecoEl = (el) => {
      let n = el
      for (let i = 0; i < 6 && n; i++) {
        const cn = String((n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || '')
        const id = String(n.id || '')
        if (RECO_RE.test(cn) || RECO_RE.test(id)) return true
        n = n.parentElement
      }
      return false
    }
    const depthOf = (el) => {
      let d = 0, n = el
      while (n && n.parentElement) { d++; n = n.parentElement }
      return d
    }
    const pEls = Array.from(document.querySelectorAll('[class*="price"]'))
      .filter(e => !isRecoEl(e))
      .map(e => ({ e, txt: String(e.innerText || e.textContent || '').trim(), depth: depthOf(e) }))
      .filter(x => x.txt && /[\d.]/.test(x.txt))
    // 区间优先（同一元素里）
    for (const x of pEls) {
      const m = x.txt.match(/([\d.]+)\s*[-~～至]\s*([\d.]+)/)
      if (m) {
        const lo = parseFloat(m[1]); const hi = parseFloat(m[2])
        if (lo > 0.01 && hi >= lo) { out.priceMin = lo; out.priceMax = hi; break }
      }
    }
    // 没有区间 → 取最浅层的单值（主价格区）
    if (out.priceMin === null) {
      const singles = pEls
        .map(x => ({ x, m: x.txt.match(/(?:¥|￥)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*元/) }))
        .filter(o => o.m)
        .sort((a, b) => a.x.depth - b.x.depth)
      if (singles.length) {
        const g = singles[0].m
        const v = parseFloat(g[1] || g[2])
        if (v > 0.01) { out.priceMin = v; out.priceMax = v }
      }
    }
    const mo = document.querySelector('[class*="moq"], [class*="beginAmount"], [class*="min-order"]')
    if (mo) {
      const mm = String(mo.innerText || mo.textContent).match(/(\d+)/)
      if (mm) out.moq = parseInt(mm[1], 10)
    }
    const cp = document.querySelector('[class*="company-name"], [class*="companyName"]')
    if (cp) out.supplierName = clean(cp.innerText || cp.textContent)
    const gallery = document.querySelector(
      '[class*="detail-gallery"] img, [class*="image-view"] img, [class*="main-image"] img, ' +
      '[class*="gallery"] img, .od-pic img, [class*="offer-pic"] img, [class*="preview"] img'
    )
    if (gallery) {
      const u = gallery.getAttribute('src') || gallery.getAttribute('data-src') || gallery.getAttribute('data-lazy-src') || ''
      if (u && !isBadImage(u)) out.mainImage = u
    }
    // DOM 图集：**只取商品图集区**，不能扫全页 img
    // （之前 document.querySelectorAll('img') 会把推荐位、评价图、
    //   店招全扫进来 —— 这正是「产品图片采集不正确」的原因之一）
    const galleryRoot = document.querySelector(
      '[class*="detail-gallery"] img, [class*="image-view"] img, [class*="main-image"] img, ' +
      '[class*="gallery"] img, .od-pic img, [class*="offer-pic"] img, [class*="preview"] img'
    )
    const galleryImgs = []
    if (galleryRoot) {
      const root = galleryRoot.closest(
        '[class*="detail-gallery"], [class*="image-view"], [class*="main-image"], ' +
        '[class*="gallery"], .od-pic, [class*="offer-pic"], [class*="preview"]'
      ) || galleryRoot.parentElement
      if (root) {
        for (const i of Array.from(root.querySelectorAll('img')).slice(0, 30)) {
          const u = i.getAttribute('src') || i.getAttribute('data-src') ||
            i.getAttribute('data-lazy-src') || i.getAttribute('data-ks-lazyload') || ''
          if (u && /alicdn|1688|cbu/i.test(u) && !isBadImage(u)) galleryImgs.push(u)
        }
      }
    }
    out.images = galleryImgs
    // 商品描述：1688 渲染在 .desc-lazyload-container
    const d = document.querySelector('.desc-lazyload-container, .detail-content, #content, [class*="detail-desc"]')
    if (d) {
      out.description = cleanDescriptionHtml(d.innerHTML || '')
      // 详情区里的图 = 商品详情图，也是商品图（1688 详情区常常全是图）
      out.descImages = Array.from(d.querySelectorAll('img'))
        .map(i => i.getAttribute('src') || i.getAttribute('data-lazyload') ||
          i.getAttribute('data-lazy-src') || i.getAttribute('data-src') || i.getAttribute('data-ks-lazyload') || '')
        .filter(u => /alicdn|1688|cbu/i.test(u) && !isBadImage(u))
        .slice(0, 30)
    }
    out.skuPrices = domSkuPrices()
    out.attributes = domAttributes()
    return out
  }

  /**
   * 从 DOM 抽「商品属性」表（1688 的「产品属性」区块）。
   *
   * 页面结构：<ul class="offer-attr"><li><span class="offer-attr-name">品牌</span>
   *          <span class="offer-attr-value">XX</span></li></ul>
   * 也有 <table> 形式：两列（属性名 / 属性值）。
   * 接口不一定给属性表，所以 DOM 是重要的兵底。
   */
  function domAttributes() {
    const out = {}
    const put = (k, v) => {
      const kk = clean(String(k || '')).replace(/[:：]\s*$/, '').slice(0, 40)
      const vv = clean(String(v || '')).slice(0, 120)
      if (!kk || !vv) return
      if (isJunkSpec(kk) || isJunkSpec(vv)) return
      if (out[kk]) return
      out[kk] = vv
    }
    try {
      // 1) li 列表：名字 + 值（两个 span）
      const lists = Array.from(document.querySelectorAll(
        '[class*="offer-attr"], [class*="product-attr"], [class*="detail-attr"], ' +
        '[class*="attributes"], [class*="props"], [class*="attr-list"]'
      ))
      for (const ul of lists.slice(0, 8)) {
        for (const li of Array.from(ul.querySelectorAll('li')).slice(0, 40)) {
          const spans = Array.from(li.querySelectorAll('span, td, th, div, dd, dt'))
            .map(s => clean(s.innerText || s.textContent || ''))
            .filter(Boolean)
          if (spans.length >= 2) put(spans[0], spans.slice(1).join(' '))
        }
      }
      // 2) dl/dt/dd 形式
      for (const dl of Array.from(document.querySelectorAll('dl')).slice(0, 8)) {
        const dts = Array.from(dl.querySelectorAll('dt'))
        const dds = Array.from(dl.querySelectorAll('dd'))
        for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
          put(clean(dts[i].innerText || dts[i].textContent || ''), clean(dds[i].innerText || dds[i].textContent || ''))
        }
      }
      // 3) 两列表格
      for (const table of Array.from(document.querySelectorAll('table')).slice(0, 6)) {
        const rows = Array.from(table.querySelectorAll('tr')).slice(0, 30)
        for (const tr of rows) {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => clean(c.innerText || c.textContent || ''))
          if (cells.length === 2) put(cells[0], cells[1])
        }
      }
    } catch (e) {}
    return Object.keys(out).length ? out : undefined
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

  /**
   * 从 DOM 抽「规格价格表」→ 结构化变体。
   *
   * 1688 的规格价格表长这样：
   *   | 颜色 | 尺码 | 价格 |
   *   | 红色 | M    | 12.5 |
   *   | 蓝色 | L    | 13.0 |
   * 表头就是维度名，数据行就是变体。
   *
   * 这是**接口拿不到 SKU 容器时的兵底**（2026-05 实采发现 offerdetail 报文里
   * 可能压根没有 SKU 容器，页面上反而渲染得清清楚楚）。
   */
  function domVariants() {
    const out = []
    try {
      for (const table of Array.from(document.querySelectorAll('table')).slice(0, 10)) {
        const rows = Array.from(table.querySelectorAll('tr'))
        if (rows.length < 2) continue
        const headCells = Array.from(rows[0].querySelectorAll('td,th')).map(c => clean(c.innerText || c.textContent || ''))
        if (headCells.length < 2) continue
        // 表头里必须有维度词，且有价格列
        const DIM_RE = /(颜色|色|尺码|尺寸|大小|规格|款式|型号|材质|包装|套餐|版本|style|color|size|spec)/i
        const dimIdx = []
        for (let i = 0; i < headCells.length; i++) {
          if (DIM_RE.test(headCells[i])) dimIdx.push(i)
        }
        if (!dimIdx.length) continue
        // 价格列：表头含“价”，或数据行里带 ¥ 且是数字
        let priceIdx = headCells.findIndex(h => /价|price|金额|单价/i.test(h))
        if (priceIdx < 0) priceIdx = -1
        const isTierTable = /起订|起批|数量|件数/.test(headCells.join(' '))
        if (isTierTable) continue // 阶梯价表不是变体表

        for (let r = 1; r < rows.length; r++) {
          const cells = Array.from(rows[r].querySelectorAll('td,th')).map(c => clean(c.innerText || c.textContent || ''))
          if (cells.length < 2) continue
          // 找这一行的价格
          let price = null
          let priceCol = priceIdx
          if (priceCol < 0 || !cells[priceCol]) {
            for (let i = cells.length - 1; i >= 0; i--) {
              const m = String(cells[i] || '').replace(/[,¥￥\s]/g, '').match(/^\d+(\.\d+)?$/)
              if (m) { price = parseFloat(m[0]); priceCol = i; break }
            }
          } else {
            const m = String(cells[priceCol] || '').replace(/[,¥￥\s]/g, '').match(/^\d+(\.\d+)?$/)
            if (m) price = parseFloat(m[0])
          }
          if (price === null || !(price > 0.01) || price > 1000000) continue

          const specs = []
          for (const i of dimIdx) {
            const v = cells[i]
            if (!v || isJunkSpec(v)) continue
            specs.push({ name: headCells[i].slice(0, 30), value: v.slice(0, 60) })
          }
          if (!specs.length) continue
          // 行首可能是颜色图（img）而不是文字
          let image = ''
          try {
            const imgs = Array.from(rows[r].querySelectorAll('img'))
            for (const im of imgs) {
              const u = im.getAttribute('src') || im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || ''
              if (u && /alicdn|1688|cbu/i.test(u) && !isBadImage(u)) { image = u; break }
            }
          } catch (e) {}
          out.push({ specs, price, image, priceText: String(cells[priceCol] || '') })
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
    const sources = { capture: payloads.length, replay: 0, replayBody: 0, inline: 0 }
    if (payloads.length < 2) {
      const extra = await replayResources()
      sources.replay = extra.length
      replayed = extra.length
      payloads = payloads.concat(extra)
    }
    // 页面已加载完才装内核时，首屏请求没被截到 → 用截获到的原始 method/body 重放
    if (payloads.length < 2) {
      const extra = await replayCapturedRequests()
      sources.replayBody = extra.length
      replayed += extra.length
      payloads = payloads.concat(extra)
    }
    // 首屏数据常挂在 window 全局或内联脚本里
    if (payloads.length < 2) {
      const extra = scanInlineData()
      sources.inline = extra.length
      payloads = payloads.concat(extra)
    }
    const dom = domFallback()

    const title = pickTitle(payloads) || dom.title
    const pr = pickPrices(payloads, { offerId })

    // 多 SKU 时，价格取「第一个规格的价格」（1688 各规格价格不同，区间价容易错）
    const skuPrices = pickSkuPrices(payloads)
    const priceRangeOld = { lo: pr.lo, hi: pr.hi, why: pr.why }
    if (skuPrices.length >= 2) {
      pr.lo = skuPrices[0].price
      pr.hi = skuPrices[0].price
      pr.why = 'sku:first(' + (skuPrices[0].spec || '第一个规格') + ') ← 原:' + (priceRangeOld.why || '-')
    }
    const imgRes = pickImages(payloads)
    const images = imgRes.list
    const mainImage = imgRes.main
    const moq = pickMoq(payloads)
    const supplier = pickSupplier(payloads)

    // 变体（颜色 / 规格 / 自定义维度），每个变体带自己的价格和图
    const variantRes = pickVariants(payloads)
    let variants = variantRes.variants
    let variantDims = variantRes.dims

    // 接口没给出变体时 → 用 DOM 的规格价格表兜底
    // （2026-05 实采发现：offerdetail 报文里可能压根没有 SKU 容器，
    //   而页面上渲染的规格表反而清清楚楚）
    if (!variants.length) {
      const domVars = domVariants()
      if (domVars.length) {
        const dimMap = new Map()
        for (const v of domVars) {
          for (const s of v.specs) {
            if (!dimMap.has(s.name)) dimMap.set(s.name, { name: s.name, kind: dimKind(s.name), values: [] })
            const d = dimMap.get(s.name)
            if (!d.values.includes(s.value)) d.values.push(s.value)
          }
        }
        variants = domVars.map((v, i) => {
          let color = '', size = ''
          for (const s of v.specs) {
            const k = dimKind(s.name)
            if (k === 'color' && !color) color = s.value
            if (k === 'size' && !size) size = s.value
          }
          return {
            skuId: '',
            specs: v.specs,
            color,
            size,
            specText: v.specs.map(s => s.value).join(' / '),
            price: v.price,
            priceText: v.priceText,
            image: v.image || '',
          }
        })
        variantDims = Array.from(dimMap.values())
      }
    }

    // 描述 = 商品基本属性表（不是详情页那段图片 HTML）
    const attributes = pickAttributeTable(payloads) || dom.attributes || undefined
    const descFromAttrs = attributeTableToText(attributes)

    // 货号 / 首个规格 / 阶梯价 / 批发价（新增字段，不影响原有字段）
    const skuMap = pickSkuMap(payloads)
    const skuInfo = parseSkuMap(skuMap)
    const skuGroups = collectSkuEntries(payloads)
    const skuFirstSpec = skuGroups.length ? (skuGroups[0].entries[0].spec || '') : ''
    const firstSpecFallback = skuInfo.firstSku ? '' : (skuFirstSpec || pickFirstSpec(payloads))
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
      // 描述：优先「基本属性表」（用户要的）；没有属性表才回退详情页描述
      description: descFromAttrs || pickDescription(payloads) || dom.description || '',
      images,
      mainImage: mainImage || undefined,
      // ↓ 变体：颜色 / 规格 / 自定义维度 + 每个变体的价格与图片
      variants: variants.length ? variants : undefined,
      variantDims: variantDims.length ? variantDims : undefined,
      priceMin: pr.lo,
      priceMax: pr.hi,
      moq,
      unit: '件',
      skuText: pickJsonField(payloads, ['skuMap', 'skuProps', 'skuList', 'skuModel', 'saleProp', 'skuPropsList']),
      attributes,
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
        sources,
        apiList: Array.from(new Set(payloads.map(p => {
          const m = String(p.url || '').match(/api=([\w.]+)/)
          return m ? m[1] : (p.from || 'unknown')
        }))).slice(0, 30),
        payloadTopKeys: payloads.slice(0, 12).map(p => ({
          url: scrubUrl(p.url),
          from: p.from || 'hook',
          topKeys: (p.data && typeof p.data === 'object') ? Object.keys(p.data).slice(0, 10) : [],
          dataKeys: (p.data && p.data && p.data.data && typeof p.data.data === 'object')
            ? Object.keys(p.data.data).slice(0, 12) : [],
        })),
        skuLikePaths: (() => {
          // 找出所有含 sku/price 的 key 路径，直接定位真实 SKU 在哪个报文里
          const out = []
          for (const p of payloads) {
            walk(p.data, (k, v, parent, path) => {
              if (!/sku|price/i.test(String(k))) return
              if (out.length > 60) return
              const pth = (path || []).concat(String(k)).join('.')
              if (out.some(x => x.path === pth)) return
              out.push({ path: pth, type: Array.isArray(v) ? 'array' : typeof v, url: scrubUrl(p.url) })
            })
          }
          return out
        })(),
        priceWhy: pr.why,
        priceCandidates: pr.candidates,
        skuCandidates: pr.skuCandidates,
        priceContainers: collectPriceContainers(payloads),
        priceRangeOld,
        skuPrices: skuPrices.slice(0, 30),
        tierSource,
        skuCount: skuInfo.skuIds.length,
        capturedUrls: scrubUrls(payloads.filter(p => !isSensitivePayload(p)).map(p => p.url)),
        snapshot: payloads.filter(p => !isSensitivePayload(p)).slice(0, 5).map(p => ({
          url: scrubUrl(p.url),
          data: redactPayloadNode(p.data, 0),
        })),
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
            images: pickImages([p]).list.slice(0, 3),
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
    // 先消毒再发：
    //   1) 隐私脱敏 —— 抹掉姓名/手机号/地址等个人信息
    //   2) WAF 消毒 —— 中和描述里的可疑片段
    // 顺序很重要：先脱敏（少一层字符串包裹），再 WAF 消毒。
    const safePayload = sanitizePayload(sanitizePayloadForPrivacy(payload))
    const body = JSON.stringify(Array.isArray(safePayload) ? { items: safePayload } : { data: safePayload })
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
      attempts.push({
        url,
        status: r.status,
        text: (r.text || '').slice(0, 300),
        server: r.server || '',
        via: r.via || '',
      })
      // 成功就返回；401/403 也返回（说明已到达服务端，只是鉴权不过）
      if (r.status === 200 || r.status === 400 || r.status === 401 || r.status === 403) {
        // 只有当「实际失败的地址」是 /api/admin/import/1688 时，才可能是旧版脚本。
        // 之前这里不看地址就一律改写成「旧版脚本」文案，把真实响应体盖掉了，
        // 导致线上 403 明明打在正确的 /api/import/1688 上，却被误报成「旧版脚本」。
        const isAdminPath = /\/api\/admin\/import\/1688\/?$/i.test(url)
        if (r.status === 403 && isAdminPath) {
          r.text =
            (r.text || '') +
            '\n提示：这次请求打到了旧版地址 ' + url +
            '，说明你装的是旧版脚本。请更新到最新版脚本：https://fiestaflare.com/1688-collector'
        }
        // 保留真实响应体，并附上服务器指纹，便于判断是应用层还是边缘层返回的 403
        r.text = describeFailure(r, url, attempts)
        return { ...r, attempts, url }
      }
    }
    const last = attempts[attempts.length - 1]
    const all = attempts.map(a => a.url + ' → ' + a.status).join('；')
    const allZero = attempts.every(a => !a.status)
    return {
      status: last ? last.status : 0,
      json: null,
      text:
        (last ? last.text : '无响应') +
        '\n尝试记录：' + all +
        (allZero
          ? '\n两次请求都没到服务器：可能是站点正在部署（稍等 1-2 分钟重试）、网络不通，或浏览器/扩展把请求拦了。'
          : ''),
      attempts,
      url: base,
    }
  }

  /**
   * 把真实响应整理成人能看懂的诊断文本。
   * 原则：绝不覆盖服务器原文，只在其后追加说明。
   */
  function describeFailure(r, url, attempts) {
    const body = (r.text || '(空)').slice(0, 600)
    if (r.status === 200) return body
    const lines = ['服务器原始返回：', body]
    if (r.server || r.via) {
      lines.push('服务器标识：' + [r.server && 'server=' + r.server, r.via && 'via=' + r.via].filter(Boolean).join('  '))
    }
    // 应用层会回 X-FF-Origin: app；没有这个头就说明响应不是我们的应用发出的
    lines.push('响应来源：' + (r.appLayer ? '应用层（服务端路由）' : '非应用层（Hostinger 边缘层 / CDN / 浏览器拦截）'))
    if (r.status === 403) {
      if (r.appLayer) {
        lines.push(
          '说明：403 由服务端返回。若地址是 /api/admin/import/1688，说明你装的是旧版脚本；' +
          '若地址是 /api/import/1688，则是服务端鉴权逻辑异常，请把这段诊断发给管理员。'
        )
      } else {
        lines.push(
          '说明：403 不是我们的应用返回的（响应里没有 X-FF-Origin: app 标记），' +
          '而是 Hostinger 边缘层（hcdn）的 WAF 拦下的。' +
          '常见于：商品描述里同时含 <script>/javascript:/eval(/../ 等可疑片段（已自动消毒），' +
          '或站点正在部署切换（约 1-2 分钟）、浏览器扩展/代理拦截。' +
          '请稍后重试；若持续出现，请把这段诊断发给管理员。'
        )
      }
    }
    if (attempts && attempts.length > 1) {
      lines.push('尝试记录：' + attempts.map(a => a.url + ' → ' + a.status).join('；'))
    }
    return lines.join('\n')
  }

  /** 优先用 GM_xmlhttpRequest（不受页面 CSP 限制），否则 fetch */
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  /** 普通 fetch 兜底（服务端已放开 CORS；被页面 CSP 拦截时会失败） */
  async function fetchPost(url, headers, body) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body, mode: 'cors' })
      const text = await res.text()
      let server = ''
      let via = ''
      let appLayer = false
      try {
        server = res.headers.get('server') || ''
        via = res.headers.get('x-hcdn-request-id') ? 'hcdn' : (res.headers.get('via') || '')
        appLayer = (res.headers.get('x-ff-origin') || '') === 'app'
      } catch (e) {
        /* 某些环境读 header 会抛错，忽略 */
      }
      return { status: res.status, json: safeJson(text), text, server, via, appLayer }
    } catch (e) {
      return {
        status: 0,
        json: null,
        text: '请求未到达服务器（fetch: ' + ((e && e.message) || '网络错误') + '）',
      }
    }
  }

  async function requestOnce(url, headers, body) {
    if (typeof GM_xmlhttpRequest === 'function') {
      const gmOnce = () =>
        new Promise(resolve => {
          try {
            GM_xmlhttpRequest({
              method: 'POST',
              url,
              headers,
              data: body,
              timeout: 60000,
              onload: r =>
                resolve({
                  status: r.status,
                  json: safeJson(r.responseText),
                  text: r.responseText,
                  server: parseHeader(r.responseHeaders, 'server'),
                  via: parseHeader(r.responseHeaders, 'x-hcdn-request-id') ? 'hcdn' : parseHeader(r.responseHeaders, 'via'),
                  appLayer: parseHeader(r.responseHeaders, 'x-ff-origin') === 'app',
                }),
              onerror: e => resolve({ status: 0, json: null, text: 'GM 请求失败: ' + ((e && e.error) || '网络错误') }),
              ontimeout: () => resolve({ status: 0, json: null, text: 'GM 请求超时' }),
            })
          } catch (e) {
            resolve({ status: 0, json: null, text: 'GM 异常: ' + (e && e.message) })
          }
        })
      let r = await gmOnce()
      // 第一次失败（超时/网络）→ 等 1.5s 重试一次
      if (r.status === 0) {
        await sleep(1500)
        r = await gmOnce()
      }
      // 还是失败 → 用普通 fetch 兜底（服务端 CORS 允许）
      if (r.status === 0) {
        const f = await fetchPost(url, headers, body)
        if (f.status) return f
        r.text = (r.text || '') + ' | fetch 兜底也失败: ' + (f.text || '')
      }
      return r
    }
    return fetchPost(url, headers, body)
  }

  /**
   * 消毒：把会触发 Hostinger 边缘层 WAF（ModSecurity 异常分）的可疑片段中和掉。
   *
   * 真实故障（2026-10-24）：采集到的 1688 商品描述是一大段从页面复制的 HTML，
   * 同时含有 <script>、javascript:、eval(、../、union select 等片段时，
   * Hostinger 边缘层直接返回 403 Forbidden（text/plain，无 X-FF-Origin 头），
   * 请求根本到不了我们的应用 —— 表现为「推送失败 403」。
   *
   * 注意：只中和可疑片段，正常商品文案/HTML 不受影响（已用真实文案回归验证）。
   */
  function sanitizeForWaf(text) {
    if (typeof text !== 'string') return text
    let s = text
    // 去掉 script 标签（含内容）
    s = s.replace(/<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    s = s.replace(/<\s*script\b[^>]*>/gi, '')
    // 伪协议
    s = s.replace(/javascript\s*:/gi, 'javascript&#58;')
    s = s.replace(/vbscript\s*:/gi, 'vbscript&#58;')
    // 代码执行
    s = s.replace(/\beval\s*\(/gi, 'eval&#40;')
    s = s.replace(/\bbase64_decode\s*\(/gi, 'base64_decode&#40;')
    s = s.replace(/document\.cookie/gi, 'document_cookie')
    // SQL 关键字组合：拆开词间距，让注入特征不再成立
    // （这些关键字在正常商品文案里不会出现）
    s = s.replace(/\bunion\s+(all\s+)?select\b/gi, 'union-select')
    // 只中和像 SQL 的 select…from（如 select * from / select id from），
    // 避免误伤 “select from our collection” 这类正常英文文案
    s = s.replace(/\bselect\s+(\*|[\w`"'\[\]]+)\s+from\b/gi, 'select $1 from')
    s = s.replace(/\binsert\s+into\b/gi, 'insert-into')
    s = s.replace(/\bdelete\s+from\b/gi, 'delete-from')
    s = s.replace(/\bdrop\s+(table|database)\b/gi, 'drop-table')
    s = s.replace(/\bupdate\s+\w+\s+set\b/gi, 'update-set')
    // 路径穿越 / 系统路径
    s = s.replace(/\.\.\/\.\.\//g, '')
    s = s.replace(/\.\.\//g, '')
    s = s.replace(/(\/etc\/passwd|\/bin\/sh|cmd\.exe)/gi, '')
    // 事件处理属性
    s = s.replace(/\bon(error|load|click|mouseover)\s*=/gi, 'on&#58;')
    return s
  }

  /** 递归消毒 payload 里的所有字符串字段 */
  function sanitizePayload(node, depth) {
    const d = depth || 0
    if (d > 12) return node
    if (typeof node === 'string') return sanitizeForWaf(node)
    if (Array.isArray(node)) return node.map(x => sanitizePayload(x, d + 1))
    if (node && typeof node === 'object') {
      const out = {}
      for (const k of Object.keys(node)) out[k] = sanitizePayload(node[k], d + 1)
      return out
    }
    return node
  }

  /**
   * 隐私脱敏：把采集报文里属于「用户本人」的敏感信息抹掉。
   *
   * 真实情况（2026-10-24）：1688 详情页会同时请求
   *   mtop.1688.trade.receiveaddress.queryReceiveAddresses
   *   （当前登录用户的收货地址、姓名、手机号）
   * 这类报文会被当成页面数据一起采集、推送并入库 ——
   * 等于把用户的真实住址和手机号存进了我们自己的数据库。
   * 必须在上报前抹掉。
   *
   * 策略：
   *   1) 命中敏感接口（地址簿/个人信息类）→ 直接丢弃整条报文；
   *   2) 其余报文里的敏感字段名 → 值替换成占位符；
   *   3) 自由文本里的手机号/身份证号 → 掩码。
   */
  const SENSITIVE_API_RE = /(receiveaddress|addresslist|address\.query|userinfo|userprofile|memberinfo|myorder|orderlist|buyerinfo|getusersimple|mtop\.user\.|logincenter|usercenter|passport)/i
  // 精确字段名（整段匹配才命中，避免误伤 addressCode / addressCount 这类无害字段）
  const SENSITIVE_EXACT_KEYS = new Set([
    'address', 'addressdetail', 'mobile', 'mobilephone', 'phone', 'phonenumber',
    'tel', 'telephone', 'fullname', 'realname', 'idcard', 'idnumber', 'identity',
    'bankcard', 'bankaccount', 'recipient', 'consignee', 'receiver', 'email',
    'password', 'passwd', 'weixin', 'wechat', 'qq',
    // 账号信息（1688 登录态）
    'nick', 'loginid', 'loginname', 'username', 'userid', 'membername', 'account',
    'user', 'member', 'buyer',
  ])
  // 包含即命中的字段名
  const SENSITIVE_KEY_RE = /(mobilePhone|phoneNumber|idCard|idNumber|bankCard|bankAccount|addressDetail|userAddress|addressCodeText|postalCode|realName|fullName)/i
  function isSensitiveKey(k) {
    const key = String(k || '')
    if (SENSITIVE_KEY_RE.test(key)) return true
    return SENSITIVE_EXACT_KEYS.has(key.toLowerCase())
  }

  /** 手机号 / 座机 / 身份证 掩码 */
  function maskPiiText(s) {
    if (typeof s !== 'string') return s
    return s
      .replace(/(?<!\d)(1[3-9]\d{9})(?!\d)/g, '1**********')
      .replace(/(?<!\d)(\d{3,4}-\d{7,8})(?!\d)/g, '***-********')
      .replace(/(?<!\d)(\d{17}[\dXx])(?!\d)/g, '******************')
  }

  /** 判断一条采集报文是否属于「用户个人信息」类接口 */
  function isSensitivePayload(p) {
    const url = String((p && p.url) || '')
    const api = (url.match(/api=([\w.]+)/) || [])[1] || ''
    return SENSITIVE_API_RE.test(api) || SENSITIVE_API_RE.test(url)
  }

  /** 递归抹掉报文里的敏感字段值 */
  function redactPayloadNode(node, depth) {
    const d = depth || 0
    if (d > 12) return node
    if (typeof node === 'string') {
      // 评价图（买家秀）不是商品图，不进采集品库
      if (isReviewImage(node)) return '[评价图已剔除]'
      return maskPiiText(node)
    }
    if (Array.isArray(node)) return node.map(x => redactPayloadNode(x, d + 1))
    if (node && typeof node === 'object') {
      const out = {}
      for (const k of Object.keys(node)) {
        const v = node[k]
        if (isSensitiveKey(k) && typeof v === 'string') {
          out[k] = '[已脱敏]'
        } else if (isSensitiveKey(k) && (Array.isArray(v) || (v && typeof v === 'object'))) {
          out[k] = '[已脱敏]'
        } else {
          out[k] = redactPayloadNode(v, d + 1)
        }
      }
      return out
    }
    return node
  }

  /**
   * 上报前的脱敏：丢掉个人信息类报文，其余报文脱敏。
   * 注意：这会改变 payload.raw.snapshot / capturedUrls 等诊断字段的内容，
   * 但那些字段只用于调试定位，不参与商品数据。
   */
  function sanitizePayloadForPrivacy(node, depth) {
    const d = depth || 0
    if (d > 12) return node
    if (typeof node === 'string') return maskPiiText(node)
    if (Array.isArray(node)) return node.map(x => sanitizePayloadForPrivacy(x, d + 1))
    if (node && typeof node === 'object') {
      const out = {}
      for (const k of Object.keys(node)) {
        const v = node[k]
        if (isSensitiveKey(k)) {
          out[k] = typeof v === 'string' && !v ? '' : '[已脱敏]'
        } else {
          out[k] = sanitizePayloadForPrivacy(v, d + 1)
        }
      }
      return out
    }
    return node
  }

  /**
   * URL 脱敏（防 Hostinger 边缘层 WAF）—— 这是 403 的真正原因。
   *
   * 实测（2026-10-24，对线上 /api/import/1688 逐项 bisect）：
   *   raw.capturedUrls 里放 6 个含完整 mtop 签名的 URL → 401（放行）
   *   放 7 个 → 403；放 9 个 → 又 401；放 10 个 → 403
   *   去掉 URL 里的 t= / sign= / timeout= 任意一个 → 立刻放行
   *   把 host 换掉但保留签名参数 → 依然 403
   *   → 结论：触发的是 **ModSecurity 异常分（anomaly scoring）**：
   *     mtop 的签名参数 t=<13位时间戳> / sign=<32位十六进制> / timeout=
   *     在整个 body 里大量重复出现，每次都加一分，总分越线才拦。
   *   所以「按关键词消毒」永远赢不了 —— 必须把签名参数本身去掉。
   *
   * 做法：只保留 host + path + api 名，丢掉所有签名/业务参数。
   * 诊断用途完全不受影响（api 名才是定位问题要看的），体积还小了很多。
   */
  const SIGN_PARAM_RE = /^(t|sign|timeout|appKey|jsv|data|v|type|dataType|token|auth|apiKey|secret|sessionId|sid)$/i

  /** 把 mtop URL 脱敏成「host + path + api=xxx」 */
  function scrubUrl(u) {
    const s = String(u || '')
    if (!s) return ''
    try {
      let host = '', path = ''
      if (s.startsWith('//')) {
        const rest = s.slice(2)
        const i = rest.indexOf('/')
        host = i < 0 ? rest : rest.slice(0, i)
        path = i < 0 ? '' : rest.slice(i)
      } else {
        const m = s.match(/^[a-z]+:\/\/([^/]+)(\/.*)?$/i)
        if (!m) return s.split('?')[0]
        host = m[1]
        path = m[2] || ''
      }
      const qIdx = path.indexOf('?')
      const base = qIdx < 0 ? path : path.slice(0, qIdx)
      const query = qIdx < 0 ? '' : path.slice(qIdx + 1)
      // 只保留 api 名（定位问题真正需要的），其余参数全丢
      let api = ''
      for (const kv of query.split('&')) {
        const k = kv.split('=')[0]
        if (/^api$/i.test(k)) {
          api = kv.slice(4)
          break
        }
      }
      return host + base + (api ? ' api=' + api : '')
    } catch (e) {
      return String(u).split('?')[0]
    }
  }

  /** 对一组 URL 做脱敏 */
  function scrubUrls(list) {
    return (list || []).map(scrubUrl)
  }

  function safeJson(t) {
    try { return JSON.parse(t) } catch (e) { return null }
  }

  /** 从 GM 的原始响应头字符串里取某个头（大小写不敏感） */
  function parseHeader(raw, name) {
    if (!raw) return ''
    const lines = String(raw).split(/\r?\n/)
    for (const line of lines) {
      const i = line.indexOf(':')
      if (i < 0) continue
      if (line.slice(0, i).trim().toLowerCase() === name.toLowerCase()) {
        return line.slice(i + 1).trim()
      }
    }
    return ''
  }

  /** 判断响应来自应用层还是边缘层（应用层会带 X-FF-Origin: app） */
  function isAppLayer(server, via, origin) {
    return origin === 'app' || /ff-?origin/i.test(String(origin || ''))
  }

  window.FF1688 = {
    __v: '4.1.3',
    install,
    capture,
    dumpStructure,
    dumpVariants,
    replayResources,
    replayCapturedRequests,
    scanInlineData,
    parseLoose,
    parseDetail,
    parseSearch,
    push,
    api: API,
  }
})();
/* ========================== 控制台流程 ========================== */

;(function () {
  'use strict'
  const API = 'https://fiestaflare.com'

  const token = (prompt('粘贴 Fiestaflare 管理员 Token（后台 → 采集品库 → 复制采集 Token）') || '').trim()
  if (!token) {
    console.warn('未提供 Token，已取消')
    return
  }
  if (!window.FF1688) {
    console.error('采集内核未加载，请刷新页面后重试')
    return
  }
  try { window.FF1688.install() } catch (e) {}

  const isDetail = /\/offer\/\d+/.test(location.href)
  const isList = /selloffer|search/.test(location.href)

  const go = async () => {
    if (isDetail) {
      const { payload, debug } = await window.FF1688.parseDetail()
      console.log('解析结果：', payload)
      console.log('调试信息：', debug)
      console.log(
        '字段速览：\n' +
          '脚本版本: v2.24.0  内核版本: ' + (window.FF1688.__v || '?') + '\n' +
          '标题: ' + payload.title + '\n' +
          '价格: ' + payload.priceMin + ' ~ ' + payload.priceMax + '\n' +
          '起订: ' + payload.moq + '\n' +
          '图片: ' + payload.images.length + ' 张\n' +
          '供应商: ' + (payload.supplierName || '无') + '\n' +
          '描述: ' + (payload.description ? payload.description.length + ' 字' : '无')
      )
      const r = await window.FF1688.push(payload, token)
      console.log('推送结果：', r.status, r.json || r.text)
      if (r.status === 200) console.log('✅ 采集成功，去后台「采集品库」查看')
      else if (r.status === 401) console.warn('❌ Token 无效或已过期')
      else if (r.status === 0) {
        console.warn('❌ ' + r.text)
        console.warn('⤵ 跨域被拦截的兜底：把下面这段 JSON 复制，粘到后台「采集品库 → 手动粘贴导入」：')
        console.log(JSON.stringify(payload))
      } else console.warn('❌ 推送失败：', r.text)
    } else if (isList) {
      const { payload } = await window.FF1688.parseSearch()
      console.log('列表解析：', payload.length, '条')
      if (!payload.length) {
        console.warn('没抓到商品，确认在搜索结果页')
        return
      }
      const r = await window.FF1688.push(payload, token)
      console.log('推送结果：', r.status, r.json || r.text)
    } else {
      console.warn('当前页面不是 1688 商品页或搜索页：' + location.href)
    }
  }
  go().catch(e => console.error('采集异常：', e))
})()
