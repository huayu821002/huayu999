// ==UserScript==
// @name         Fiestaflare 1688 采集器
// @namespace    fiestaflare
// @version      2.45.1
// @description  在 1688 商品页/搜索页一键采集商品数据并推送到 Fiestaflare 独立站后台
// @author       JOHNFUNG
// @updateURL    https://fiestaflare.com/1688-collector.user.js
// @downloadURL  https://fiestaflare.com/1688-collector.user.js
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
/*__CORE__*/
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
        try {
          ;(0, eval)(txt)
          // 热更新可能把内核换成了更新的版本 → 刷新面板上的版本号，
          // 并撤掉「内核版本过旧」的提示（否则提示会一直赖着不走）
          try { refreshCoreVersion() } catch (e) {}
        } catch (e) {}
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
        #ff1688-panel{position:fixed!important;right:8px!important;bottom:8px!important;z-index:2147483647!important;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#222;border:1px solid #ddd;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.2);width:340px;overflow:hidden;max-height:calc(100vh - 16px);display:flex;flex-direction:column}
        #ff1688-panel .hd{background:#ff6b35;color:#fff;padding:9px 12px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer;flex:0 0 auto}
        #ff1688-panel .bd{padding:12px;overflow-y:auto;flex:1 1 auto;min-height:0}
        #ff1688-panel .btns{position:sticky;top:-12px;background:#fff;padding-top:12px;padding-bottom:4px;margin-top:-12px;z-index:3;box-shadow:0 6px 8px -6px rgba(0,0,0,.15)}
        #ff1688-panel .mini{font-size:12px;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 8px;margin-top:6px;max-height:44px;overflow:hidden;word-break:break-all}
        #ff1688-panel details.out{margin-top:8px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa}
        #ff1688-panel details.out>summary{cursor:pointer;padding:7px 10px;font-size:12px;color:#374151;font-weight:600;list-style:none;user-select:none}
        #ff1688-panel details.out>summary::-webkit-details-marker{display:none}
        #ff1688-panel details.out>summary:before{content:"▸ ";}
        #ff1688-panel details.out[open]>summary:before{content:"▾ ";}
        #ff1688-panel details.out>summary:hover{background:#f3f4f6}
        #ff1688-panel.collapsed .bd{display:none}
        #ff1688-panel input{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #ccc;border-radius:8px;margin:4px 0 8px}
        #ff1688-panel button{background:#ff6b35;color:#fff;border:0;border-radius:8px;padding:8px 11px;cursor:pointer;margin-right:6px;margin-bottom:6px}
        #ff1688-panel button.ghost{background:#f1f1f1;color:#333}
        #ff1688-panel button:disabled{opacity:.5;cursor:not-allowed}
        #ff1688-panel .st{font-size:12px;color:#555;white-space:pre-wrap;word-break:break-all;max-height:220px;overflow:auto;margin-top:0;background:#fafafa;border-radius:8px;padding:8px}
        #ff1688-panel .kv{max-height:220px;overflow:auto}
        #ff1688-panel .kv{font-size:12px;color:#333;background:#fafafa;border-radius:8px;padding:8px;margin-top:6px;white-space:pre-wrap;word-break:break-all}
      </style>
      <div class="hd"><span>Fiestaflare 采集器 v__SCRIPT_VERSION__</span><span class="tg">－</span></div>
      <div class="bd">
        <div class="text-xs text-gray-500">脚本版本 v__SCRIPT_VERSION__ · 内核版本 <span id="ff-corever">加载中…</span></div>
        <div class="text-xs text-gray-500">API 地址</div>
        <input id="ff-api" value="${API}" />
        <div class="text-xs text-gray-500">管理员 Token</div>
        <input id="ff-token" type="password" placeholder="后台 → 采集品库 → 复制采集 Token" />
        <div class="btns">
          <div>
            <button id="ff-save" class="ghost">保存设置</button>
            <button id="ff-preview">预览解析</button>
            <button id="ff-diag" class="ghost">复制诊断</button>
            <button id="ff-struct" class="ghost">复制结构</button>
            <button id="ff-vstruct" class="ghost">复制变体结构</button>
            <button id="ff-spec" class="ghost">复制规格表</button>
            <button id="ff-vcap" class="ghost">探测变体图</button>
            <button id="ff-vdiag" class="ghost">复制探测诊断</button>
            <button id="ff-push">采集并推送</button>
            <button id="ff-list" class="ghost">采集本页列表</button>
          </div>
          <div class="mini" id="ff-mini">就绪</div>
        </div>
        <details class="out" id="ff-out">
          <summary>采集内容预览 / 诊断输出</summary>
          <div class="kv" id="ff-kv" style="display:none"></div>
          <div class="st" id="ff-st">就绪。建议先点「预览解析」确认字段再推送。<br><b>抓变体小技巧</b>：先在页面上点一下颜色/尺码（会触发 SKU 列表接口），再点「复制变体结构」，变体才抓得全。</div>
        </details>
      </div>`
    const root = document.documentElement || document.body
    if (!root) return
    root.appendChild(panel)

    const st = $('#ff-st', panel)
    const kv = $('#ff-kv', panel)
    const mini = $('#ff-mini', panel)
    const out = $('#ff-out', panel)
    const say = m => {
      st.textContent = m
      const s = String(m)
      if (mini) mini.textContent = s.length > 60 ? s.slice(0, 60) + '…' : s
      // 内容长了就自动展开下拉（面板高度已封顶，展开不影响按钮可见）
      if (out && s.length > 120) out.open = true
    }
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
        `图片: ${payload.images.length} 张（主图 1 + 图集，上限 5）`,
        `主图: ${payload.mainImage ? '✓ 已锁定' : '❌ 缺失'}`,
        `变体: ${payload.variants ? payload.variants.length + ' 个' : '0 个'}`,
        `维度: ${payload.variantDims ? payload.variantDims.map(d => d.name + '(' + d.values.length + ')').join(' / ') : '-'}`,
        `供应商: ${payload.supplierName || '?'}`,
        `描述: ${payload.description ? payload.description.length + ' 字' : '无'}`,
        `截获接口: ${debug.captured} 条（重放 ${debug.replayed || 0}）`,
        `价格依据: ${(payload.raw && payload.raw.priceWhy) || '-'}`,
        `offerId: ${payload.sourceId}`,
      ]
      // 变体明细（带每个颜色的价格）
      if (payload.variants && payload.variants.length) {
        lines.push('--- 变体 ---')
        for (const v of payload.variants.slice(0, 20)) {
          const dims = (v.specs || []).map(s => s.name + ':' + s.value).join(' | ')
          const src = v.imageSource ? `{${v.imageSource}}` : ''
          // ★ 2026-10-28：标出价格来源，一眼看出是探测真价还是兜底价
          const psrc = v.priceSource ? `{价:${v.priceSource}}` : '{价:兜底}'
          lines.push(`  ${dims || v.specText} → ${v.price} ${psrc}${v.image ? ' [图' + src + ']' : ' [无图]'}`)
        }
        // 变体价格分布 —— 「全都是同一个价」时这里会直接显示 distinct=1
        const vp = (payload.variants || []).map(v => v.price).filter(p => typeof p === 'number')
        if (vp.length) {
          const uniq = [...new Set(vp)].sort((a, b) => a - b)
          lines.push(`变体价格: ${uniq.length} 个不同值 ${JSON.stringify(uniq.slice(0, 12))}`)
        }
        // 探测价命中情况（probe = 用户点色卡抓到的当前 SKU 真实价）
        const pp = payload.raw && payload.raw.probePrices
        if (pp && Object.keys(pp).length) {
          const kk = Object.keys(pp)
          lines.push(`探测价: ${kk.length} 个（${kk.slice(0, 6).map(k => k + '=' + pp[k]).join('，')}）`)
        } else {
          lines.push('探测价: 0 个 ⚠️ 没点过颜色就没有逐变体价')
        }
        const vs = payload.raw && payload.raw.variantImageStat
        if (vs) lines.push(`变体配图: 探测命中 ${vs.matched} 个 / 未配上 ${vs.skipped} 个`)
        // 变体过滤统计 —— 让用户一眼看到「没点过的变体」被剔掉了多少
        const fs = payload.raw && payload.raw.variantFilterStat
        if (fs && (fs.attrDropped || fs.probeFiltered)) {
          const parts = []
          if (fs.attrDropped) parts.push(`属性表剔除 ${fs.attrDropped} 个`)
          if (fs.probeFiltered) parts.push(`未点过剔除 ${fs.probeFiltered} 个`)
          lines.push(`变体过滤: ${fs.before} → ${fs.after} 个（${parts.join('，')}）`)
        }
      }
      // 属性（描述来源）
      if (payload.attributes && Object.keys(payload.attributes).length) {
        const ak = Object.keys(payload.attributes)
        lines.push('--- 属性(' + ak.length + ') --- ' + ak.slice(0, 8).join('/'))
      }
      kv.style.display = 'block'
      if (out) out.open = true
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
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim(), $('#ff-api', panel).value)
        if (r.status === 200) {
          say('✅ 已推送 ' + ((r.json && r.json.imported) || '') + ' 条，后台「采集品库」查看')
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = '推送成功：' + (r.text || '').slice(0, 300)
        } else {
          const detail = [
            '状态码: ' + r.status,
            '请求地址: ' + (r.url || '-'),
            '返回: ' + (r.text || '(空)').slice(0, 1200),
          ]
          if (r.attempts && r.attempts.length > 1) {
            detail.push('尝试记录: ' + r.attempts.map(a => a.url + ' → ' + a.status).join('；'))
          }
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = detail.join('\n')
          say('❌ 推送失败 ' + r.status + '（详情见下方）')
          console.log('[Fiestaflare] 推送失败详情：', r)
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    // 复制探测诊断：探测不到图时，把页面上真实的「选项块」和「大图」结构
    // 导出给开发者 —— 不靠猜 DOM，选择器用真实报文校准。
    $('#ff-vdiag', panel).onclick = async () => {
      try {
        ensureCore()
        if (!window.FF1688.dumpVariantDom) {
          say('❌ 内核太旧，没有诊断功能，请更新采集器')
          return
        }
        const d = window.FF1688.dumpVariantDom()
        const cands = d.candidates || d.options || []
        const txt = JSON.stringify(d, null, 1)
        try {
          await navigator.clipboard.writeText(txt)
          say(`✅ 探测诊断已复制（内核 ${window.FF1688.__v}）：${cands.length} 个候选 / ${(d.bigImages || []).length} 张图 / 已录 ${(d.capture && d.capture.hits) || 0} 张。把这段发给开发者`)
        } catch (e) {
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = txt.slice(0, 20000)
          if (out) out.open = true
          say('诊断数据如下')
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    // 变体图探测（方案 B）：开启后用户依次点页面上的颜色/款式，
    // 采集器盯着主图变化，记录「选项名 → 图片 URL」。
    // 配合内核的 A 方案（序号对齐），能拿到每个变体对应的图。
    $('#ff-vcap', panel).onclick = () => {
      try {
        ensureCore()
        if (!window.FF1688.getVariantCapture || !window.FF1688.startVariantCapture) {
          say('❌ 内核太旧，没有探测功能，请更新采集器')
          return
        }
        const cur = window.FF1688.getVariantCapture()
        const cv = window.FF1688.__v || '?'
        if (cur.active) {
          const r = window.FF1688.stopVariantCapture()
          const keys = Object.keys(r.map || {})
          say('✅ 探测已停止（内核 ' + cv + '）：录到 ' + (r.hits || 0) + ' 张（' + keys.slice(0, 8).join('、') + '）。现在点「预览解析」或「采集并推送」' + ((r.hits || 0) === 0 ? ' —— 如果是 0 张，请点「复制探测诊断」把数据发给开发者' : ''))
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = JSON.stringify({ map: r.map, dim: r.dim, log: r.log }, null, 1)
        } else {
          window.FF1688.startVariantCapture()
          say('🔍 探测已开启（内核 ' + cv + '）：请依次点页面上的每个颜色/款式（每个点一下停一下），再点本按钮结束')
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    // 复制规格价格表（DOM）—— 用来确认「哪一列是价格、哪些是重量/库存」
    document.getElementById('ff-spec')?.addEventListener('click', async () => {
      try {
        ensureCore()
        const tables = window.FF1688.dumpSpecTable ? window.FF1688.dumpSpecTable() : []
        const txt = JSON.stringify({ url: location.href, tables }, null, 1)
        try {
          await navigator.clipboard.writeText(txt)
          say('✅ 规格表已复制（表头 + 前几行）')
        } catch (e) {
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = txt.slice(0, 20000)
          say('规格表如下（复制上面的文本）')
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    })

    $('#ff-struct', panel).onclick = async () => {
      try {
        ensureCore()
        const captured = window.FF1688.capture ? window.FF1688.capture() : []
        const struct = window.FF1688.dumpStructure ? window.FF1688.dumpStructure(captured) : []
        const txt = JSON.stringify({ url: location.href, capturedCount: captured.length, structure: struct }, null, 2)
        try {
          await navigator.clipboard.writeText(txt)
          say('✅ 结构数据已复制，粘贴给开发者即可定位描述/图片字段')
        } catch (e) {
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = txt.slice(0, 20000)
          say('结构数据如下（复制上面的文本）')
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    $('#ff-vstruct', panel).onclick = async () => {
      try {
        ensureCore()
        say('正在采集 + 重放接口…')
        // collectAll：截获的 + 重放的 + 内联的（变体没抓全时会自动重放 1688 的接口）
        const collected = window.FF1688.collectAll
          ? await window.FF1688.collectAll()
          : { payloads: (window.FF1688.capture ? window.FF1688.capture() : []), sources: {} }
        const captured = collected.payloads || []
        const struct = window.FF1688.dumpVariants ? window.FF1688.dumpVariants(captured) : {}
        // ★ 直接把「解析出的变体」带上 —— 变体到底来自接口还是 DOM 规格表，一次看全
        let variants = []
        let variantDims = []
        let specTable = []
        let parseErr = ''
        try {
          const pd = await window.FF1688.parseDetail()
          variants = (pd && pd.payload && pd.payload.variants) || []
          variantDims = (pd && pd.payload && pd.payload.variantDims) || []
        } catch (e) { parseErr = String(e && e.message || e) }
        try {
          specTable = window.FF1688.dumpSpecTable ? window.FF1688.dumpSpecTable() : []
        } catch (e) { /* ignore */ }
        // 紧凑输出：报文多时用 indent:2 会大到难以粘贴
        const txt = JSON.stringify({
          url: location.href,
          capturedCount: captured.length,
          sources: collected.sources || {},
          // ★ 变体结论（最有用的一段）
          variantCount: variants.length,
          variantDims: variantDims,
          variants: variants.map(v => ({
            specs: (v.specs || []).map(s => s.name + ':' + s.value).join(' | '),
            color: v.color || '',
            size: v.size || '',
            price: v.price,
            imageSource: v.imageSource || '',
            image: v.image || '',
          })),
          specTableRows: (() => {
            // 规格表压成「行数组」，便于看列结构
            const out = []
            for (const t of (specTable || [])) {
              for (const tb of (t.tables || [])) {
                for (const r of (tb.rows || [])) out.push(r)
              }
            }
            return out.slice(0, 40)
          })(),
          parseErr,
          contentKeyUnion: struct.contentKeyUnion,
          variantKeyUnion: struct.variantKeyUnion,
          allKeyUnion: struct.allKeyUnion,
          payloads: struct.payloads,
        })
        try {
          await navigator.clipboard.writeText(txt)
          say('✅ 变体结构已复制（变体 ' + variants.length + ' 个）' + (variants.length ? '' : ' —— 接口里没有变体，说明走的是页面规格表'))
        } catch (e) {
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = txt.slice(0, 20000)
          say('变体结构如下（复制上面的文本）')
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    $('#ff-diag', panel).onclick = async () => {
      try {
        ensureCore()
        const payload = lastPayload || (await preview())
        const captured = window.FF1688.capture ? window.FF1688.capture() : []
        const diag = {
          url: location.href,
          priceMin: payload.priceMin,
          priceMax: payload.priceMax,
          wholesalePrice: payload.wholesalePrice,
          priceWhy: payload.raw && payload.raw.priceWhy,
          priceRangeOld: payload.raw && payload.raw.priceRangeOld,
          priceCandidates: payload.raw && payload.raw.priceCandidates,
          skuCandidates: payload.raw && payload.raw.skuCandidates,
          priceContainers: payload.raw && payload.raw.priceContainers,
          // 新增：数据来源 / 接口清单 / SKU 路径（直接定位真实 SKU 在哪个报文）
          sources: payload.raw && payload.raw.sources,
          apiList: payload.raw && payload.raw.apiList,
          payloadTopKeys: payload.raw && payload.raw.payloadTopKeys,
          skuLikePaths: payload.raw && payload.raw.skuLikePaths,
          skuPrices: payload.skuPrices,
          priceLadder: payload.priceLadder,
          firstSku: payload.firstSku,
          mainImage: payload.mainImage,
          images: (payload.images || []).slice(0, 3),
          capturedCount: captured.length,
          // 只带前 10 条，避免粘贴被截断（URL 截到 300，数据截到 20k）
          // 隐私：地址簿/个人信息类报文不包含在诊断里
          captured: captured
            .filter(p => !/receiveaddress|userinfo|memberinfo|myorder/i.test(String(p.url || '')))
            .slice(0, 10)
            .map(p => ({
              url: String(p.url || '').replace(/([?&](?:t|sign|timeout|appKey|jsv|data)=)[^&]*/gi, '$1[已脱敏]').slice(0, 300),
              data: JSON.stringify(p.data || {})
                .replace(/1[3-9]\d{9}/g, '1**********')
                .replace(/("(?:mobilePhone|fullName|address|phone|email|receiver|consignee|idCard)"\s*:\s*)"[^"]*"/gi, '$1"[已脱敏]"')
                .slice(0, 20000),
            })),
        }
        const txt = JSON.stringify(diag, null, 2)
        try {
          await navigator.clipboard.writeText(txt)
          say('✅ 诊断数据已复制，粘贴给开发者即可定位价格问题')
        } catch (e) {
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = txt.slice(0, 20000)
          say('诊断数据如下（复制上面的文本）')
        }
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
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim(), $('#ff-api', panel).value)
        if (r.status === 200) {
          say(`✅ 已推送 ${(r.json && r.json.imported) || ''} 条`)
        } else {
          kv.style.display = 'block'
          if (out) out.open = true
          kv.textContent = ['状态码: ' + r.status, '地址: ' + (r.url || '-'), '返回: ' + (r.text || '(空)').slice(0, 400)].join('\n')
          say('❌ 推送失败 ' + r.status + '（详情见下方）')
          console.log('[Fiestaflare] 推送失败详情：', r)
        }
      } catch (e) {
        say('异常: ' + e.message)
      }
    }
  }

  // 内核版本自检：加载的内核比**本脚本内联的那个**旧时，提示重装
  //
  // 关键：必须做**版本号比较**，不能写 `v !== MIN_CORE`。
  // 那样写的话，v='3.9.0' 也会被当成「过旧」——
  // 从 core 3.6.0 开始，页面上就一直在弹「内核版本过旧」的假提示，
  // 用户明明装的是最新内核，却被告知内核太旧。
  //
  // 基准版本由构建脚本注入（__CORE_VERSION__ → 内联内核的 __v），
  // 这样脚本与内核永远配套，不会各自漂移。
  const MIN_CORE = '__CORE_VERSION__'
  const cmpVer = (a, b) => {
    const pa = String(a || '0').split('.').map(x => parseInt(x, 10) || 0)
    const pb = String(b || '0').split('.').map(x => parseInt(x, 10) || 0)
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0)
      if (d) return d > 0 ? 1 : -1
    }
    return 0
  }
  const NAG_ID = 'ff-core-nag'

  // 刷新面板上的内核版本号，并按需显示/撤销「内核版本过旧」提示。
  // 热更新内核后也要调一次：提示一旦弹出就会赖在页面上不走。
  function refreshCoreVersion() {
    const v = (window.FF1688 && window.FF1688.__v) || ''
    try {
      const cv = document.getElementById('ff-corever')
      if (cv) cv.textContent = v || '未加载'
    } catch (e) {}

    const stale = !!(v && cmpVer(v, MIN_CORE) < 0)
    let nag = null
    try { nag = document.getElementById(NAG_ID) } catch (e) {}
    if (!stale) {
      // 不该提示了（比如刚热更新完）→ 把旧提示收掉
      try { if (nag && nag.parentNode) nag.parentNode.removeChild(nag) } catch (e) {}
      return v
    }
    if (nag) return v

    const msg =
      '内核版本过旧（当前 ' + v + '，需要 ' + MIN_CORE + '）。' +
      '请在 Tampermonkey 里更新或重装本脚本，否则采集不到货号、首个规格与阶梯价。'
    console.warn('[Fiestaflare]', msg)
    try {
      const d = document.createElement('div')
      d.id = NAG_ID
      d.style.cssText =
        'position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:320px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:10px;padding:10px 12px;font:12px/1.5 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer'
      d.innerHTML = '<b>需要更新采集器</b>（点此关闭）<br>' + msg.replace(/</g, '&lt;')
      d.addEventListener('click', () => { try { d.parentNode.removeChild(d) } catch (e) {} })
      ;(document.documentElement || document.body).appendChild(d)
    } catch (e) {}
    return v
  }

  function boot() {
    const tryPanel = () => {
      try {
        if (!document.documentElement) { setTimeout(tryPanel, 300); return }
        createPanel()
        const v = refreshCoreVersion()
        console.log('[Fiestaflare] 采集器已启动，脚本版本 v__SCRIPT_VERSION__，内核版本：', v || '未加载')
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
