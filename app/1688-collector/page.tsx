'use client'

import { useEffect, useState } from 'react'

export default function CollectorInstallPage() {
  const [scriptText, setScriptText] = useState('')
  const [tmInstalled, setTmInstalled] = useState<boolean | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    // 复制脚本全文，方便手动粘贴安装
    fetch('/1688-collector.user.js')
      .then(r => r.text())
      .then(t => setScriptText(t))
      .catch(() => {})

    // 检测 Tampermonkey / 其他脚本管理器
    const hasGM =
      typeof window !== 'undefined' &&
      (!!(window as any).GM_info || !!(window as any).GM || !!(window as any).GM_getValue)
    setTmInstalled(!!hasGM)
  }, [])

  const copy = async (text: string, which: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('复制失败，请手动全选复制')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">🧩 1688 采集器安装</h1>
          <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
            <b>已更新到 v2.1（内核已内联）</b>：旧版本依赖外部加载内核，会被 1688 的 CSP 拦截并报
            <code>parseDetail undefined</code>。
            <b>请务必重新安装/更新一次</b>：点下方「一键安装（GitHub raw）」即可覆盖旧版。
          </div>
          <p className="text-sm text-gray-600 mt-2">
            采集器在**你自己的浏览器**里运行，用你已登录的 1688 账号抓数据，
            不需要代理池、不需要打码平台、不会封号。
          </p>

          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              tmInstalled
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}
          >
            {tmInstalled === null
              ? '正在检测浏览器扩展…'
              : tmInstalled
                ? '✅ 检测到脚本管理器（Tampermonkey / Greasemonkey），可以走「方案 A」'
                : '⚠️ 没检测到脚本管理器。推荐用「方案 B（控制台）」，30 秒搞定，不用装任何东西。'}
          </div>
        </div>

        {/* 方案 B：控制台 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-joy-orange">
          <h2 className="font-semibold text-gray-900 text-lg">方案 B：控制台采集（推荐，无需装扩展）</h2>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside mt-3">
            <li>
              登录 1688，打开商品详情页{' '}
              <code className="bg-gray-100 px-1 rounded">https://detail.1688.com/offer/xxxxx.html</code>
            </li>
            <li>按 <code className="bg-gray-100 px-1 rounded">F12</code> 打开开发者工具 → 切到 Console（控制台）</li>
            <li>
              点「复制控制台脚本」，粘贴到控制台回车
              <div className="mt-2">
                <button
                  onClick={() => copy(scriptText, 'console')}
                  className="px-3 py-1.5 bg-joy-orange text-white rounded-lg text-sm"
                >
                  {copied === 'console' ? '已复制 ✓' : '复制控制台脚本'}
                </button>
                <a
                  href="/1688-console-snippet.js"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-sm text-joy-orange underline"
                >
                  或直接打开脚本文件复制
                </a>
              </div>
            </li>
            <li>
              Chrome 首次会提示「禁止粘贴」→ 先在控制台手动输入{' '}
              <code className="bg-gray-100 px-1 rounded">allow pasting</code> 回车，再粘贴
            </li>
            <li>按提示粘贴 <b>Fiestaflare 管理员 Token</b>（后台 → 采集品库 → 复制采集 Token）</li>
            <li>控制台显示「✅ 采集成功」即完成，去后台「采集品库」查看</li>
          </ol>
        </div>

        {/* 方案 A：油猴 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-gray-300">
          <h2 className="font-semibold text-gray-900 text-lg">方案 A：油猴脚本（可长期使用）</h2>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside mt-3">
            <li>
              装 <a href="https://www.tampermonkey.net/" target="_blank" rel="noreferrer" className="text-joy-orange underline">
                Tampermonkey
              </a>{' '}
              扩展
            </li>
            <li>
              <b>必须先装扩展</b>，否则浏览器只会把脚本当普通文件下载（这就是之前「点了没反应」的原因）
            <li>
              点下面按钮安装脚本（如果浏览器仍然下载文件，说明扩展没装好，改用方案 B）：
              <div className="mt-2 flex gap-2 flex-wrap">
                <a
                  href="https://raw.githubusercontent.com/huayu821002/huayu999/master/scripts/1688-collector.user.js"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-joy-orange text-white rounded-lg text-sm"
                >
                  一键安装（GitHub raw）
                </a>
                <a
                  href="/1688-collector.user.js"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  下载 .user.js 文件
                </a>
                <button
                  onClick={() => copy(scriptText, 'script')}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  {copied === 'script' ? '已复制 ✓' : '复制脚本文本'}
                </button>
              </div>
            </li>
            <li>
              <b>手动安装（最稳）</b>：Tampermonkey → 新建脚本 → 全选删除默认内容 → 粘贴上面的脚本文本 → Ctrl+S 保存
            </li>
            <li>装好后，1688 页面右下角会出现「Fiestaflare 采集器」面板</li>
          </ol>
        </div>

        {/* 脚本文本 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-2">脚本全文（手动安装时复制这里）</h2>
          <textarea
            readOnly
            value={scriptText}
            className="w-full h-64 border border-gray-300 rounded-lg p-3 text-xs font-mono"
            onFocus={e => e.currentTarget.select()}
          />
          <p className="text-xs text-gray-500 mt-2">
            提示：脚本仅在你自己的浏览器、已登录的 1688 页面运行；采集到的数据会推送到你自己的站点后台。
          </p>
        </div>

        <div className="text-center">
          <a href="/admin/supplier-products" className="text-joy-orange underline text-sm">
            去后台「采集品库」查看采集结果 →
          </a>
        </div>
      </div>
    </div>
  )
}
