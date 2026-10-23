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
/*__CORE__*/
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
          '脚本版本: v__SCRIPT_VERSION__  内核版本: ' + (window.FF1688.__v || '?') + '\n' +
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
