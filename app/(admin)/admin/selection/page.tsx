'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/adminFetch'

/**
 * 选品 Agent —— 后台页面
 *
 * 两步：
 *   1. 打分：从采集品库挑候选 → AI 看图 + 规则算利润 → 选品清单
 *   2. 添加资料：给选中的款生成英文标题/SEO/关键词/描述/短视频脚本
 */

type Scores = {
  demand: number
  competition: number
  supply: number
  profit: number
  bundle: number
  total: number
}

type Selected = {
  id: string
  title: string
  url?: string
  supplier?: string
  images?: string[]
  scores: Scores
  economics: any
  risks: string[]
  hardFail?: string
  reasons: string[]
  verdict: string
}

type Enriched = {
  id: string
  title: string
  error?: string
  titleEn?: string
  seoTitle?: string
  shortDescEn?: string
  descriptionEn?: string
  keywords?: string[]
  highlights?: string[]
  videoScript?: string
  bundleCopy?: string
}

export default function SelectionPage() {
  const router = useRouter()
  const [limit, setLimit] = useState(20)
  const [top, setTop] = useState(20)
  const [withVision, setWithVision] = useState(true)
  const [categoryHint, setCategoryHint] = useState('')
  const [scoring, setScoring] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [msg, setMsg] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [selected, setSelected] = useState<Selected[]>([])
  const [rejected, setRejected] = useState<Selected[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [enriched, setEnriched] = useState<Enriched[]>([])

  async function runScore() {
    setScoring(true)
    setMsg('正在跑选品打分…（每款要 AI 看图，约 3-5 秒，20 款大约 1-2 分钟）')
    setEnriched([])
    try {
      const res = await adminFetch('/api/admin/selection/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, top, withVision, categoryHint: categoryHint || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMsg('❌ ' + (data?.error || '打分失败'))
        return
      }
      setSummary(data.summary)
      setSelected(data.selected || [])
      setRejected(data.rejected || [])
      setPicked((data.selected || []).slice(0, 3).map((x: any) => x.id))
      setMsg(
        `✅ 完成：共评 ${data.summary.total} 款，通过 ${data.summary.passed}，否决 ${data.summary.rejected}。` +
          `已勾选前 ${Math.min(3, data.summary.selected)} 款待生成资料。`
      )
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || '请求失败'))
    } finally {
      setScoring(false)
    }
  }

  async function runEnrich(write: boolean) {
    if (!picked.length) {
      setMsg('⚠️ 先勾选要生成资料的款')
      return
    }
    setEnriching(true)
    setMsg(write ? '正在生成资料并写回数据库…' : '正在生成资料（预览，不写库）…')
    try {
      const res = await adminFetch('/api/admin/selection/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: picked, write }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMsg('❌ ' + (data?.error || '生成失败'))
        return
      }
      setEnriched(data.results || [])
      const ok = (data.results || []).filter((r: any) => !r.error).length
      setMsg(
        (write ? '✅ 已写回数据库：' : '✅ 生成完成：') +
          `${ok}/${data.results.length} 款` +
          (write ? '（标题/SEO/关键词/描述已更新到采集品）' : '（勾选后点「写回数据库」才生效）')
      )
    } catch (e: any) {
      setMsg('❌ ' + (e?.message || '请求失败'))
    } finally {
      setEnriching(false)
    }
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">🎯 选品 Agent</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          AI 看图打分（需求/竞争/供给/利润/套装）+ 自动生成上架资料
        </p>

        {/* 参数 */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">评候选数</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">选出前 N 款</label>
              <input
                type="number"
                value={top}
                onChange={(e) => setTop(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">品类（可选）</label>
              <input
                value={categoryHint}
                onChange={(e) => setCategoryHint(e.target.value)}
                placeholder="帽子 / 围巾 / 手套"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">AI 看图</label>
              <label className="flex items-center gap-2 text-sm py-2">
                <input
                  type="checkbox"
                  checked={withVision}
                  onChange={(e) => setWithVision(e.target.checked)}
                />
                <span className="text-gray-600">启用（强烈建议）</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={runScore}
              disabled={scoring}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {scoring ? '打分中…' : '① 开始选品打分'}
            </button>
            <button
              onClick={() => runEnrich(false)}
              disabled={enriching || !picked.length}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              ② 生成资料（预览）
            </button>
            <button
              onClick={() => runEnrich(true)}
              disabled={enriching || !picked.length}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              ② 生成并写回数据库
            </button>
          </div>
          {msg && <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{msg}</div>}
        </div>

        {/* 选品清单 */}
        {summary && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              📋 选品清单（{selected.length} 款通过 / {rejected.length} 款否决）
            </h2>
            <div className="space-y-3 mb-8">
              {selected.map((s) => (
                <div key={s.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={picked.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      className="mt-1"
                    />
                    {s.images?.[0] && (
                      <img
                        src={s.images[0]}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-gray-900">{s.scores.total.toFixed(1)}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            s.verdict === '强推'
                              ? 'bg-green-100 text-green-700'
                              : s.verdict === '可上'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {s.verdict}
                        </span>
                        <span className="text-sm text-gray-900 truncate">{s.title}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        <Badge label="需求" value={s.scores.demand} good="high" />
                        <Badge label="竞争" value={s.scores.competition} good="low" />
                        <Badge label="供给" value={s.scores.supply} good="high" />
                        <Badge label="利润" value={s.scores.profit} good="high" />
                        <Badge label="套装" value={s.scores.bundle} good="high" />
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          建议售价 ¥{s.economics?.sellPrice} · 净利 ¥{s.economics?.net}（
                          {s.economics?.margin}%）· {s.economics?.channel}
                        </span>
                      </div>
                      {s.reasons?.length > 0 && (
                        <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                          {s.reasons.map((r, i) => (
                            <li key={i}>✓ {r}</li>
                          ))}
                        </ul>
                      )}
                      {s.risks?.length > 0 && (
                        <ul className="mt-1 text-xs text-orange-600 space-y-0.5">
                          {s.risks.map((r, i) => (
                            <li key={i}>⚠ {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {rejected.length > 0 && (
              <details className="bg-white rounded-xl shadow-sm p-4 mb-8">
                <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
                  🚫 否决清单（{rejected.length} 款）— 展开查看原因
                </summary>
                <div className="mt-3 space-y-2">
                  {rejected.map((s) => (
                    <div key={s.id} className="text-sm flex items-center gap-3">
                      <span className="font-mono text-gray-500">{s.scores.total.toFixed(1)}</span>
                      <span className="text-gray-800 truncate">{s.title}</span>
                      <span className="text-red-600 text-xs">{s.hardFail}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        {/* 资料预览 */}
        {enriched.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">📝 生成的上架资料</h2>
            <div className="space-y-3 mb-8">
              {enriched.map((e) => (
                <div key={e.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                  {e.error ? (
                    <div className="text-sm text-red-600">❌ {e.title} → {e.error}</div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-xs text-gray-500">中文：</span>
                        <span className="text-gray-900">{e.title}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">英文标题：</span>
                        <span className="font-medium text-gray-900">{e.titleEn}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">SEO：</span>
                        <span className="text-gray-700">{e.seoTitle}</span>
                      </div>
                      {e.shortDescEn && (
                        <div>
                          <span className="text-xs text-gray-500">短描述：</span>
                          <span className="text-gray-700">{e.shortDescEn}</span>
                        </div>
                      )}
                      {e.keywords && e.keywords.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">关键词：</span>
                          <span className="text-gray-700">{e.keywords.join(' | ')}</span>
                        </div>
                      )}
                      {e.highlights && e.highlights.length > 0 && (
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          {e.highlights.map((h, i) => (
                            <li key={i}>• {h}</li>
                          ))}
                        </ul>
                      )}
                      {e.videoScript && (
                        <div className="text-xs text-gray-700 bg-gray-50 rounded p-2">
                          <span className="text-gray-500">🎬 短视频脚本：</span>
                          <br />
                          {e.videoScript}
                        </div>
                      )}
                      {e.bundleCopy && (
                        <div className="text-xs text-purple-700">🧩 套装文案：{e.bundleCopy}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Badge({ label, value, good }: { label: string; value: number; good: 'high' | 'low' }) {
  const ok = good === 'high' ? value >= 7 : value <= 5
  const mid = good === 'high' ? value >= 5 : value <= 7
  const cls = ok ? 'bg-green-100 text-green-700' : mid ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'
  return (
    <span className={`px-2 py-0.5 rounded ${cls}`}>
      {label} {value}
    </span>
  )
}
