// ==UserScript==
// @name         Fiestaflare 1688 采集器
// @namespace    fiestaflare
// @version      2.0.0
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
// @connect      fiestaflare.com
// @connect      www.fiestaflare.com
// ==/UserScript==

(function () {
  'use strict'

  const CORE_URL = 'https://fiestaflare.com/1688-core.js'
  const API = 'https://fiestaflare.com'
  const TOKEN_KEY = 'ff_token'

  // ---- 注入页面上下文内核（必须在页面自己的请求之前安装，才能截获接口数据）
  function injectCore(cb) {
    const s = document.createElement('script')
    s.src = CORE_URL + '?t=' + Date.now()
    s.onload = () => {
      try {
        window.FF1688.install()
      } catch (e) {}
      cb()
    }
    s.onerror = () => cb()
    ;(document.head || document.documentElement).appendChild(s)
  }

  const $ = sel => document.querySelector(sel)
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

  function createPanel() {
    if ($('#ff1688-panel')) return
    const token = GM_getValue(TOKEN_KEY, '')
    const panel = document.createElement('div')
    panel.id = 'ff1688-panel'
    panel.innerHTML = `
      <style>
        #ff1688-panel{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#222;border:1px solid #ddd;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.2);width:340px;overflow:hidden}
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
      <div class="hd"><span>Fiestaflare 采集器 v2</span><span class="tg">－</span></div>
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
    document.body.appendChild(panel)

    const st = $('#ff-st', panel)
    const kv = $('#ff-kv', panel)
    const say = m => { st.textContent = m }
    const isDetail = /\/offer\/\d+/.test(location.href)
    const isList = /selloffer|search/.test(location.href)
    if (!isDetail) $('#ff-push', panel).style.display = 'none'
    if (!isDetail) $('#ff-preview', panel).style.display = 'none'
    if (!isList) $('#ff-list', panel).style.display = 'none'

    $('#ff-token', panel).value = GM_getValue(TOKEN_KEY, '')
    $('#ff-save', panel).onclick = () => {
      GM_setValue(TOKEN_KEY, $('#ff-token', panel).value.trim())
      say('设置已保存')
    }
    $('.hd', panel).onclick = () => {
      panel.classList.toggle('collapsed')
      $('.tg', panel).textContent = panel.classList.contains('collapsed') ? '＋' : '－'
    }

    let lastPayload = null

    const preview = async () => {
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
        const payload = lastPayload || (await preview())
        say('推送中…')
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim())
        if (r.status === 200) say('✅ 已推送，后台「采集品库」查看')
        else if (r.status === 401) say('❌ Token 无效，请重新复制')
        else say('❌ 推送失败 ' + r.status + ' ' + (r.text || '').slice(0, 200))
      } catch (e) {
        say('异常: ' + e.message)
      }
    }

    $('#ff-list', panel).onclick = async () => {
      try {
        say('解析列表…')
        const { payload } = await window.FF1688.parseSearch()
        if (!payload.length) { say('本页没抓到商品'); return }
        say(`抓到 ${payload.length} 条，推送中…`)
        const r = await window.FF1688.push(payload, $('#ff-token', panel).value.trim())
        if (r.status === 200) say(`✅ 已推送 ${r.json.imported} 条`)
        else if (r.status === 401) say('❌ Token 无效，请重新复制')
        else say('❌ 推送失败 ' + r.status)
      } catch (e) {
        say('异常: ' + e.message)
      }
    }
  }

  function boot() {
    injectCore(() => {
      const tryPanel = () => {
        if (document.body) createPanel()
        else setTimeout(tryPanel, 300)
      }
      tryPanel()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
