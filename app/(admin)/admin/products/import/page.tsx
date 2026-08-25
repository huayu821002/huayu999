'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Icons } from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'

interface ParsedProduct {
  url: string
  platform: string
  success: boolean
  data?: {
    name: string
    price: string
    currency: string
    images: string[]
    description: string
    sku: string
  }
  error?: string
}

export default function ImportProductsPage() {
  const router = useRouter()
  const [urls, setUrls] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [importResult, setImportResult] = useState<any>(null)
  const [error, setError] = useState('')

  // 解析URL
  const parseUrls = async () => {
    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean)
    if (urlList.length === 0) {
      setError('请输入至少一个URL')
      return
    }
    
    setIsParsing(true)
    setError('')
    setParsedProducts([])
    setImportResult(null)
    
    try {
      const res = await fetch('/api/admin/products/parse-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList })
      })
      const data = await res.json()
      
      if (data.success) {
        setParsedProducts(data.data.results)
      } else {
        setError(data.error || '解析失败')
      }
    } catch (err: any) {
      setError(err.message || '解析失败')
    } finally {
      setIsParsing(false)
    }
  }
  
  // 导入选中的商品
  const importProducts = async () => {
    const selectedProducts = parsedProducts.filter(p => p.success && p.data)
    if (selectedProducts.length === 0) {
      setError('没有可导入的商品')
      return
    }
    
    setIsImporting(true)
    setError('')
    
    try {
      const products = selectedProducts.map(p => ({
        name: p.data!.name,
        price: p.data!.price,
        currency: p.data!.currency,
        images: p.data!.images,
        description: p.data!.description,
        sku: p.data!.sku,
        originalUrl: p.url,
        platform: p.platform
      }))
      
      const res = await fetch('/api/admin/products/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      })
      const data = await res.json()
      
      if (data.success) {
        setImportResult(data.data)
        setParsedProducts([])
        setUrls('')
      } else {
        setError(data.error || '导入失败')
      }
    } catch (err: any) {
      setError(err.message || '导入失败')
    } finally {
      setIsImporting(false)
    }
  }
  
  const successCount = parsedProducts.filter(p => p.success).length
  const failedCount = parsedProducts.filter(p => !p.success).length

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.push('/admin/products')} className="p-2 hover:bg-gray-200 rounded-lg">
              <Icons.ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-joy-gray-900">批量导入商品</h1>
          </div>
          <p className="text-joy-gray-500 ml-11">从1688、速卖通等平台批量采集商品信息</p>
        </div>
        
        {/* URL Input */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-lg text-joy-gray-900 mb-4">输入商品URL</h2>
          <p className="text-sm text-joy-gray-500 mb-4">
            每行一个URL，支持 1688.com、aliexpress.com、alibaba.com
          </p>
          
          <textarea
            className="w-full h-48 px-4 py-3 border border-joy-gray-200 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
            placeholder={`https://www.1688.com/product/123456.html\nhttps://www.aliexpress.com/item/123456.html`}
            value={urls}
            onChange={e => setUrls(e.target.value)}
          />
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div className="mt-4 flex gap-3">
            <button
              onClick={parseUrls}
              disabled={isParsing || !urls.trim()}
              className="px-6 py-3 bg-joy-orange text-white rounded-xl font-semibold hover:bg-joy-orange/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isParsing ? (
                <>
                  <Icons.Loader size={18} className="animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Icons.Search size={18} />
                  解析URL
                </>
              )}
            </button>
            
            {parsedProducts.length > 0 && (
              <button
                onClick={() => { setParsedProducts([]); setUrls(''); setError(''); }}
                className="px-6 py-3 border border-joy-gray-300 text-joy-gray-600 rounded-xl font-semibold hover:bg-gray-50"
              >
                清空
              </button>
            )}
          </div>
        </div>
        
        {/* Parsed Results */}
        {parsedProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-joy-gray-900">解析结果</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 flex items-center gap-1">
                  <Icons.Check size={16} /> 成功 {successCount}
                </span>
                {failedCount > 0 && (
                  <span className="text-red-600 flex items-center gap-1">
                    <Icons.X size={16} /> 失败 {failedCount}
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {parsedProducts.map((product, idx) => (
                <div key={idx} className={`border rounded-xl p-4 ${product.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  {product.success ? (
                    <div className="flex gap-4">
                      {product.data!.images && product.data!.images[0] && (
                        <img src={product.data!.images[0]} alt="" className="w-20 h-20 object-cover rounded-lg" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-joy-gray-900">{product.data!.name}</div>
                        <div className="text-sm text-joy-gray-500 mt-1">
                          {product.platform} | SKU: {product.data!.sku}
                        </div>
                        <div className="text-lg font-bold text-joy-orange mt-1">
                          ${product.data!.price} {product.data!.currency}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <Icons.X size={16} />
                      <span className="text-sm">{product.url}</span>
                      <span className="text-sm">- {product.error}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {successCount > 0 && (
              <button
                onClick={importProducts}
                disabled={isImporting}
                className="mt-6 w-full py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Icons.Loader size={18} className="animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Icons.Plus size={18} />
                    导入 {successCount} 个商品到草稿
                  </>
                )}
              </button>
            )}
          </div>
        )}
        
        {/* Import Result */}
        {importResult && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <Icons.Check size={24} />
              <span className="text-lg font-semibold">导入成功！</span>
            </div>
            <div className="text-sm text-green-700">
              成功导入 {importResult.success} 个商品到草稿箱。
              {importResult.failed > 0 && ` ${importResult.failed} 个导入失败。`}
            </div>
            <button
              onClick={() => router.push('/admin/products?filter=draft')}
              className="mt-4 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
            >
              查看草稿商品
            </button>
          </div>
        )}
        
        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Icons.Lightbulb size={18} />
            使用提示
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 支持每行一个URL，最多50个URL同时解析</li>
            <li>• 解析后的商品会保存为草稿状态，需人工审核后上架</li>
            <li>• 部分商品可能因平台限制无法解析，可手动编辑</li>
            <li>• 建议先测试少量URL，确认正常工作后再批量导入</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
