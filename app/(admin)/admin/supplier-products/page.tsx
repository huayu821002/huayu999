'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { adminFetch } from '@/lib/adminFetch'

interface SupplierItem {
  id: string
  source: string
  sourceId: string
  sourceUrl: string | null
  title: string
  titleCn?: string | null
  titleEn?: string | null
  seoTitle?: string | null
  keywords?: string | null
  shortDescEn?: string | null
  descriptionEn?: string | null
  firstSku?: string | null
  sourceSkuId?: string | null
  wholesalePrice?: number | null
  priceLadder?: string | null
  priceMin: number | null
  priceMax: number | null
  moq: number | null
  unit: string | null
  supplierName: string | null
  images: string[]
  attributes: any
  skuText: any
  description: string | null
  status: string
  productId: string | null
  note: string | null
  raw?: string | null
  createdAt: string
}

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'published', label: '已上架' },
  { key: 'rejected', label: '已忽略' },
]

export default function SupplierProductsPage() {
  const router = useRouter()
  const [items, setItems] = useState<SupplierItem[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SupplierItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [catChecked, setCatChecked] = useState<Record<string, boolean>>({})

  const loadCategories = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/categories')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data.map((c: any) => ({ id: c.id, name: c.name })))
      }
    } catch {
      /* 分类拉取失败不影响主流程 */
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  /** 弹窗里取值 / 写值 */
  const getVal = (id: string) =>
    ((document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value || '').trim()
  const setVal = (id: string, v: string | null | undefined) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
    if (el) el.value = v == null ? '' : String(v)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ status, limit: '50' })
      if (search.trim()) q.set('search', search.trim())
      const res = await adminFetch(`/api/admin/supplier-products?${q.toString()}`)
      const data = await res.json()
      if (data.success) {
        setItems(data.data)
        setTotal(data.total)
      } else {
        setMsg(data.error || '加载失败')
      }
    } catch (e: any) {
      setMsg(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [status, search])

  useEffect(() => {
    load()
  }, [load])

  const patchItem = async (id: string, body: any) => {
    setSaving(true)
    try {
      const res = await adminFetch(`/api/admin/supplier-products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setMsg('已保存')
        load()
      } else {
        setMsg(data.error || '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  /** 读取弹窗里的编辑值 */
  const readForm = () => ({
    title: (document.getElementById('edit-title') as HTMLInputElement)?.value?.trim() || '',
    supplierName: (document.getElementById('edit-supplier') as HTMLInputElement)?.value?.trim() || '',
    priceMin: (document.getElementById('edit-price') as HTMLInputElement)?.value || '',
    moq: (document.getElementById('edit-moq') as HTMLInputElement)?.value || '',
    note: (document.getElementById('edit-note') as HTMLTextAreaElement)?.value || '',
    sale: (document.getElementById('edit-sale') as HTMLInputElement)?.value || '',
    cost: (document.getElementById('edit-cost') as HTMLInputElement)?.value || '',
    // 英文 / SEO
    titleEn: getVal('edit-title-en'),
    seoTitle: getVal('edit-seo-title'),
    keywords: getVal('edit-keywords'),
    shortDescEn: getVal('edit-short-desc-en'),
    descriptionEn: getVal('edit-desc-en'),
    // 采集字段（货号 / 规格 / 批发价 / 阶梯价）
    sourceSkuId: getVal('edit-sku-id'),
    firstSku: getVal('edit-first-sku'),
    wholesalePrice: getVal('edit-wholesale-price'),
    priceLadder: getVal('edit-price-ladder'),
    // 商品字段（与产品添加一致）
    productName: getVal('edit-p-name'),
    productSku: getVal('edit-p-sku'),
    comparePrice: getVal('edit-p-compare'),
    inventory: getVal('edit-p-inventory'),
    lowStockAlert: getVal('edit-p-lowstock'),
    weight: getVal('edit-p-weight'),
    shortDesc: getVal('edit-p-shortdesc'),
    description: getVal('edit-p-description'),
    tags: getVal('edit-p-tags'),
    compliance: getVal('edit-p-compliance'),
  })

  /** 一键翻译：中文 → 英文 + SEO 标题，并回填弹窗 */
  const translate = async (item: SupplierItem) => {
    setSaving(true)
    try {
      const res = await adminFetch(`/api/admin/supplier-products/${item.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await res.json()
      if (d.success) {
        setVal('edit-title-en', d.data.titleEn)
        setVal('edit-seo-title', d.data.seoTitle)
        setVal('edit-keywords', d.data.keywords)
        setVal('edit-short-desc-en', d.data.shortDescEn)
        setVal('edit-desc-en', d.data.descriptionEn)
        if (d.data.titleEn) setVal('edit-p-name', d.data.titleEn)
        if (d.data.shortDescEn) setVal('edit-p-shortdesc', d.data.shortDescEn)
        if (d.data.descriptionEn) setVal('edit-p-description', d.data.descriptionEn)
        setMsg('翻译完成，已填入英文与 SEO 字段')
      } else {
        setMsg(d.error || '翻译失败')
      }
    } catch (e: any) {
      setMsg(e?.message || '翻译失败')
    } finally {
      setSaving(false)
    }
  }

  /** 采集价(CNY) + 倍率 → 售价/成本价(USD) */
  const recalc = () => {
    const cny = parseFloat((document.getElementById('edit-price') as HTMLInputElement)?.value || '0') || 0
    const mult = parseFloat((document.getElementById('edit-markup') as HTMLInputElement)?.value || '3') || 3
    const rate = 7.2 // CNY → USD
    const sale = document.getElementById('edit-sale') as HTMLInputElement
    const cost = document.getElementById('edit-cost') as HTMLInputElement
    if (sale) sale.value = ((cny * mult) / rate).toFixed(2)
    if (cost) cost.value = (cny / rate).toFixed(2)
  }

  const publish = async (item: SupplierItem, isActive: boolean) => {
    setSaving(true)
    try {
      // 先把弹窗里编辑过的字段存回采集品，再发布
      const form = readForm()
      if (form.title || form.priceMin || form.moq) {
        await adminFetch(`/api/admin/supplier-products/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title || undefined,
            supplierName: form.supplierName || undefined,
            priceMin: form.priceMin || undefined,
            moq: form.moq || undefined,
            note: form.note || undefined,
            // 英文 / SEO / 货号 / 规格 / 批发价 / 阶梯价（新增，原有字段不动）
            titleEn: form.titleEn || undefined,
            seoTitle: form.seoTitle || undefined,
            keywords: form.keywords || undefined,
            shortDescEn: form.shortDescEn || undefined,
            descriptionEn: form.descriptionEn || undefined,
            sourceSkuId: form.sourceSkuId || undefined,
            firstSku: form.firstSku || undefined,
            wholesalePrice: form.wholesalePrice || undefined,
            priceLadder: form.priceLadder || undefined,
          }),
        })
      }
      // 阶梯价：弹窗里是 JSON 文本，发布时转成 { tiers: [...] }
      let tieredPricing: any = undefined
      const ladderRaw = form.priceLadder
      if (ladderRaw) {
        try {
          const parsed = JSON.parse(ladderRaw)
          tieredPricing = Array.isArray(parsed) ? { tiers: parsed } : parsed
        } catch {
          tieredPricing = undefined
        }
      }
      const res = await adminFetch(`/api/admin/supplier-products/${item.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive,
          name: form.productName || form.titleEn || form.title || undefined,
          sku: form.productSku || form.sourceSkuId || undefined,
          price: form.sale || undefined,
          costPrice: form.cost || undefined,
          comparePrice: form.comparePrice || undefined,
          wholesalePrice: form.wholesalePrice || undefined,
          minOrderQty: form.moq || undefined,
          inventory: form.inventory || undefined,
          lowStockAlert: form.lowStockAlert || undefined,
          weight: form.weight || undefined,
          shortDesc: form.shortDesc || undefined,
          description: form.description || undefined,
          tags: form.tags || undefined,
          compliance: form.compliance || undefined,
          tieredPricing,
          categoryIds: Object.keys(catChecked).filter(k => catChecked[k]),
          isFeatured: (document.getElementById('edit-p-featured') as HTMLInputElement)?.checked,
          isTrending: (document.getElementById('edit-p-trending') as HTMLInputElement)?.checked,
          isNew: (document.getElementById('edit-p-new') as HTMLInputElement)?.checked,
          isWholesale: (document.getElementById('edit-p-wholesale') as HTMLInputElement)?.checked,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg(isActive ? '已生成商品并上架' : '已生成商品（草稿）')
        setSelected(null)
        load()
      } else {
        setMsg(data.error || '生成失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const copyToken = async () => {
    const token = localStorage.getItem('token') || ''
    if (!token) {
      setMsg('未找到登录 Token，请先登录后台')
      return
    }
    try {
      await navigator.clipboard.writeText(token)
      setMsg('Token 已复制到剪贴板，粘贴到油猴脚本面板即可')
    } catch {
      setMsg('Token: ' + token)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">采集品库</h1>
            <p className="text-sm text-gray-500 mt-1">
              来自 1688 等供应商的采集数据 · 共 {total} 条
            </p>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            刷新
          </button>
        </div>

        {/* 手动粘贴导入（跨域被拦时的兜底） */}
        <details className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-gray-300">
          <summary className="font-semibold text-gray-900 cursor-pointer select-none">
            📋 手动粘贴导入（跨域被拦时用）
          </summary>
          <p className="text-sm text-gray-600 mt-2 mb-2">
            如果控制台采集推送失败（提示请求被拦截），把控制台打印的 JSON 复制到这里粘贴导入。
          </p>
          <textarea
            id="ff-manual-json"
            rows={6}
            placeholder='粘贴采集到的 JSON，例如 {"source":"1688","sourceId":"1022060080982","title":"..."}'
            className="w-full border border-gray-300 rounded-lg p-3 text-xs font-mono"
          />
          <button
            onClick={async () => {
              const ta = document.getElementById('ff-manual-json') as HTMLTextAreaElement
              const txt = (ta?.value || '').trim()
              if (!txt) { setMsg('请先粘贴 JSON'); return }
              try {
                const parsed = JSON.parse(txt)
                const body = Array.isArray(parsed) ? { items: parsed }
                  : parsed.items || parsed.data ? parsed
                  : { data: parsed }
                const res = await adminFetch('/api/import/1688', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                })
                const d = await res.json()
                setMsg(d.success ? `已导入 ${d.imported} 条` : d.error || '导入失败')
                if (d.success) { ta.value = ''; load() }
              } catch (e: any) {
                setMsg('JSON 解析失败：' + (e?.message || e))
              }
            }}
            className="mt-2 px-4 py-2 bg-joy-orange text-white rounded-lg text-sm"
          >
            导入这段 JSON
          </button>
        </details>

        {/* 采集助手 */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border-l-4 border-joy-orange">
          <h2 className="font-semibold text-gray-900 mb-2">🧩 采集助手（油猴脚本）</h2>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside mb-3">
            <li>
              安装脚本：打开{' '}
              <a
                href="/1688-collector"
                className="text-joy-orange underline"
                target="_blank"
                rel="noreferrer"
              >
                /1688-collector
              </a>{' '}
              安装引导页（含控制台一键采集方案，不用装扩展也能用）
            </li>
            <li>登录 1688（你自己的账号），打开任意商品页或搜索结果页</li>
            <li>右下角出现「Fiestaflare 采集器」面板 → 粘贴管理员 Token → 点「采集当前商品」/「采集本页列表」</li>
            <li>采集结果会进入下面的列表，审核后可一键生成商品</li>
          </ol>
          <div className="flex gap-2 flex-wrap">            <button
              onClick={copyToken}
              className="px-4 py-2 bg-joy-orange text-white rounded-lg text-sm hover:bg-joy-orange/90"
            >
              复制采集 Token
            </button>
            <button
              onClick={() => window.open('/1688-collector', '_blank')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              打开安装引导
            </button>
          </div>
          {msg && <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{msg}</div>}
        </div>

        {/* 筛选 */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === tab.key
                  ? 'bg-joy-orange text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="搜索标题 / offerId / 供应商"
            className="ml-auto px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm w-64"
          />
          <button onClick={load} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">
            搜索
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">加载中…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl">
            还没有采集数据。用右上角的采集助手在 1688 页面上采集一次。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-3">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {item.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.title}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        item.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'rejected'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <div>
                      价格 {item.priceMin ?? '-'} ~ {item.priceMax ?? '-'} · 起订 {item.moq ?? '-'}
                      {item.unit || '件'}
                    </div>
                    <div>offerId: {item.sourceId}</div>
                    {item.supplierName && <div>供应商: {item.supplierName}</div>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setSelected(item)}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      审核 / 编辑
                    </button>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        1688 原文
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 详情弹层 */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">审核采集品</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-gray-600">商品标题</span>
                <input
                  defaultValue={selected.title}
                  id="edit-title"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">供应商</span>
                <input
                  defaultValue={selected.supplierName || ''}
                  id="edit-supplier"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">采集价（CNY，1688 价）</span>
                <input
                  defaultValue={selected.priceMin ?? ''}
                  id="edit-price"
                  onChange={recalc}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">加价倍率（×）</span>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="3"
                  id="edit-markup"
                  onChange={recalc}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">售价（USD，按倍率自动算，可改）</span>
                <input
                  id="edit-sale"
                  defaultValue={selected.priceMin ? ((selected.priceMin * 3) / 7.2).toFixed(2) : ''}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">成本价（USD，自动换算，可改）</span>
                <input
                  id="edit-cost"
                  defaultValue={selected.priceMin ? (selected.priceMin / 7.2).toFixed(2) : ''}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">起订量 MOQ</span>
                <input
                  defaultValue={selected.moq ?? ''}
                  id="edit-moq"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>
            </div>

            <label className="block mt-4">
              <span className="text-sm text-gray-600">备注（内部）</span>
              <textarea
                defaultValue={selected.note || ''}
                id="edit-note"
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </label>

            {/* 英文与 SEO */}
            <div className="mt-5 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">英文与 SEO（自动翻译）</h3>
                <button
                  disabled={saving}
                  onClick={() => translate(selected)}
                  className="px-3 py-1.5 bg-joy-orange text-white rounded-lg text-xs disabled:opacity-50"
                >
                  一键翻译并填充
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-gray-600">英文标题</span>
                  <input
                    defaultValue={selected.titleEn || ''}
                    id="edit-title-en"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">SEO 标题</span>
                  <input
                    defaultValue={selected.seoTitle || ''}
                    id="edit-seo-title"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">SEO 关键词（逗号分隔）</span>
                  <input
                    defaultValue={selected.keywords || ''}
                    id="edit-keywords"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">英文短描述</span>
                  <textarea
                    defaultValue={selected.shortDescEn || ''}
                    id="edit-short-desc-en"
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">英文详情描述</span>
                  <textarea
                    defaultValue={selected.descriptionEn || ''}
                    id="edit-desc-en"
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
              </div>
            </div>

            {/* 采集字段 */}
            <div className="mt-5 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">采集字段（货号 / 规格 / 价格）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-gray-600">货号（供应商 SKU）</span>
                  <input
                    defaultValue={selected.sourceSkuId || ''}
                    id="edit-sku-id"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">首个规格 / 颜色</span>
                  <input
                    defaultValue={selected.firstSku || ''}
                    id="edit-first-sku"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">批发价（CNY，采集价）</span>
                  <input
                    defaultValue={selected.wholesalePrice ?? selected.priceMin ?? ''}
                    id="edit-wholesale-price"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">阶梯价（JSON）</span>
                  <input
                    defaultValue={selected.priceLadder || ''}
                    id="edit-price-ladder"
                    placeholder='[{"minQty":2,"price":1.2}]'
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
              </div>
            </div>

            {/* 商品字段（与产品添加一致） */}
            <div className="mt-5 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">商品字段（与产品添加一致）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-gray-600">商品名称（英文）</span>
                  <input
                    defaultValue={selected.titleEn || selected.title}
                    id="edit-p-name"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">SKU</span>
                  <input
                    defaultValue={selected.sourceSkuId || `1688-${selected.sourceId}`}
                    id="edit-p-sku"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">对比价（USD）</span>
                  <input
                    id="edit-p-compare"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">库存</span>
                  <input
                    defaultValue="0"
                    id="edit-p-inventory"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">低库存预警</span>
                  <input
                    defaultValue="10"
                    id="edit-p-lowstock"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">重量（kg）</span>
                  <input
                    id="edit-p-weight"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">短描述</span>
                  <textarea
                    defaultValue={selected.shortDescEn || ''}
                    id="edit-p-shortdesc"
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">商品详情</span>
                  <textarea
                    defaultValue={selected.descriptionEn || selected.description || ''}
                    id="edit-p-description"
                    rows={4}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">标签（逗号分隔）</span>
                  <input
                    defaultValue={['1688', '采集品', selected.sourceId].join(',')}
                    id="edit-p-tags"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm text-gray-600">合规信息（GPSR 等）</span>
                  <input
                    defaultValue="待补录：欧盟责任方/制造商信息（GPSR）"
                    id="edit-p-compliance"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
              </div>

              {categories.length > 0 && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-600 cursor-pointer select-none">
                    分类（可多选，共 {categories.length} 个）
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-1">
                    {categories.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!catChecked[c.id]}
                          onChange={e => setCatChecked({ ...catChecked, [c.id]: e.target.checked })}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </details>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" id="edit-p-featured" /> 精选
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" id="edit-p-trending" /> 热门
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" id="edit-p-new" defaultChecked /> 新品
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" id="edit-p-wholesale" /> 批发
                </label>
              </div>
            </div>

            <details className="mt-4">
              <summary className="text-sm text-gray-600 cursor-pointer select-none">
                原始数据 raw（用于排查采集字段，展开后可复制发给我）
              </summary>
              <textarea
                readOnly
                value={(selected as any).raw || ''}
                className="mt-2 w-full h-40 border border-gray-300 rounded-lg p-2 text-[10px] font-mono"
                onFocus={e => e.currentTarget.select()}
              />
            </details>

            {selected.images?.length > 0 && (
              <div className="mt-4">
                <span className="text-sm text-gray-600">图片（{selected.images.length}）</span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {selected.images.slice(0, 8).map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className="w-16 h-16 object-cover rounded border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6 flex-wrap">
              <button
                disabled={saving}
                onClick={() => {
                  const f = readForm()
                  patchItem(selected.id, {
                    title: f.title || undefined,
                    supplierName: f.supplierName || undefined,
                    priceMin: f.priceMin || undefined,
                    moq: f.moq || undefined,
                    note: f.note || undefined,
                    // 新增字段（原有字段行为不变）
                    titleEn: f.titleEn || undefined,
                    seoTitle: f.seoTitle || undefined,
                    keywords: f.keywords || undefined,
                    shortDescEn: f.shortDescEn || undefined,
                    descriptionEn: f.descriptionEn || undefined,
                    sourceSkuId: f.sourceSkuId || undefined,
                    firstSku: f.firstSku || undefined,
                    wholesalePrice: f.wholesalePrice || undefined,
                    priceLadder: f.priceLadder || undefined,
                  })
                }}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-50"
              >
                保存修改
              </button>
              <button
                disabled={saving}
                onClick={() => publish(selected, false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm disabled:opacity-50"
              >
                生成商品（草稿）
              </button>
              <button
                disabled={saving}
                onClick={() => publish(selected, true)}
                className="px-4 py-2 bg-joy-orange text-white rounded-lg text-sm disabled:opacity-50"
              >
                生成并上架
              </button>
              <button
                disabled={saving}
                onClick={() => patchItem(selected.id, { status: 'rejected' })}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                忽略
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
