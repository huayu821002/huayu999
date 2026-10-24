// ==UserScript==
// @name         Fiestaflare 1688 采集器
// @namespace    fiestaflare
// @version      2.13.0
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
      <div class="hd"><span>Fiestaflare 采集器 v__SCRIPT_VERSION__</span><span class="tg">－</span></div>
      <div class="bd">
        <div class="text-xs text-gray-500">脚本版本 v__SCRIPT_VERSION__ · 内核版本 <span id="ff-corever">加载中…</span></div>
        <div class="text-xs text-gray-500">API 地址</div>
        <input id="ff-api" value="${API}" />
        <div class="text-xs text-gray-500">管理员 Token</div>
        <input id="ff-token" type="password" placeholder="后台 → 采集品库 → 复制采集 Token" />
        <button id="ff-save" class="ghost">保存设置</button>
        <div style="margin-top:8px">
          <button id="ff-preview">预览解析</button>
        <button id="ff-diag" class="ghost">复制诊断</button>
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
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim(), $('#ff-api', panel).value)
        if (r.status === 200) {
          say('✅ 已推送 ' + ((r.json && r.json.imported) || '') + ' 条，后台「采集品库」查看')
          kv.style.display = 'block'
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
          kv.textContent = detail.join('\n')
          say('❌ 推送失败 ' + r.status + '（详情见下方）')
          console.log('[Fiestaflare] 推送失败详情：', r)
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
          captured: captured.slice(0, 10).map(p => ({
            url: String(p.url || '').slice(0, 300),
            data: JSON.stringify(p.data || {}).slice(0, 20000),
          })),
        }
        const txt = JSON.stringify(diag, null, 2)
        try {
          await navigator.clipboard.writeText(txt)
          say('✅ 诊断数据已复制，粘贴给开发者即可定位价格问题')
        } catch (e) {
          kv.style.display = 'block'
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
          kv.textContent = ['状态码: ' + r.status, '地址: ' + (r.url || '-'), '返回: ' + (r.text || '(空)').slice(0, 400)].join('\n')
          say('❌ 推送失败 ' + r.status + '（详情见下方）')
          console.log('[Fiestaflare] 推送失败详情：', r)
        }
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
        const v = (window.FF1688 && window.FF1688.__v) || ''
        console.log('[Fiestaflare] 采集器已启动，脚本版本 v__SCRIPT_VERSION__，内核版本：', v || '未加载')
        try {
          const cv = document.getElementById('ff-corever')
          if (cv) cv.textContent = v || '未加载'
        } catch (e) {}
        // 内核版本自检：过旧则提示更新脚本（新版才有货号 / 首个规格 / 阶梯价）
        const MIN_CORE = '3.5.0'
        if (v && v !== MIN_CORE) {
          const msg =
            '内核版本过旧（当前 ' + v + '，需要 ' + MIN_CORE + '）。' +
            '请在 Tampermonkey 里更新或重装本脚本，否则采集不到货号、首个规格与阶梯价。'
          console.warn('[Fiestaflare]', msg)
          try {
            const d = document.createElement('div')
            d.style.cssText =
              'position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:320px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:10px;padding:10px 12px;font:12px/1.5 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)'
            d.innerHTML = '<b>需要更新采集器</b><br>' + msg.replace(/</g, '&lt;')
            ;(document.documentElement || document.body).appendChild(d)
          } catch (e) {}
        }
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
