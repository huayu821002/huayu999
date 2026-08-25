import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 支持的平台
const SUPPORTED_PLATFORMS = {
  '1688.com': '1688',
  'aliexpress.com': 'aliexpress',
  'alibaba.com': 'alibaba',
}

// 解析单个URL获取商品信息
async function parseProductUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname
    
    // 判断平台
    let platform = 'unknown'
    for (const [key, value] of Object.entries(SUPPORTED_PLATFORMS)) {
      if (hostname.includes(key)) {
        platform = value
        break
      }
    }
    
    if (platform === 'unknown') {
      return { url, success: false, error: '不支持的平台，只支持1688、aliexpress、alibaba' }
    }
    
    // 获取页面内容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })
    
    if (!response.ok) {
      return { url, success: false, error: `HTTP ${response.status}` }
    }
    
    const html = await response.text()
    
    // 解析商品信息
    const product = parseHtml(html, url, platform)
    
    return {
      url,
      platform,
      success: true,
      data: product
    }
  } catch (error: any) {
    return { url, success: false, error: error?.message || '解析失败' }
  }
}

// 解析HTML获取商品数据
function parseHtml(html: string, url: string, platform: string) {
  const result: any = {
    name: '',
    price: '',
    currency: 'USD',
    images: [],
    description: '',
    sku: '',
    originalUrl: url,
    platform,
  }
  
  // 尝试从 JSON-LD 获取数据
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1])
      if (jsonLd.name) result.name = jsonLd.name
      if (jsonLd.description) result.description = jsonLd.description
      if (jsonLd.offers?.price) {
        result.price = jsonLd.offers.price
        result.currency = jsonLd.offers.priceCurrency || 'USD'
      }
      if (jsonLd.image) {
        result.images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
      }
    } catch {}
  }
  
  // 从 meta og: 标签获取
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (!result.name && ogTitleMatch) {
    result.name = decodeHtmlEntities(ogTitleMatch[1])
  }
  
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (!result.description && ogDescMatch) {
    result.description = decodeHtmlEntities(ogDescMatch[1])
  }
  
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (ogImageMatch) {
    result.images = [ogImageMatch[1]]
  }
  
  // 尝试从页面特定元素获取价格
  if (!result.price) {
    const priceMatch = html.match(/(?:price|amount)["\s:]+[^"$]*?([\d,]+\.?\d*)/i)
    if (priceMatch) {
      result.price = priceMatch[1].replace(/,/g, '')
    }
  }
  
  // 清理描述（移除HTML标签）
  if (result.description) {
    result.description = result.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  
  // 生成SKU
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  result.sku = `SKU-${platform.toUpperCase()}-${timestamp}-${random}`.toUpperCase()
  
  return result
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

// POST - 批量解析URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { urls } = body as { urls: string[] }
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: false, error: '请提供URL列表' }, { status: 400 })
    }
    
    if (urls.length > 50) {
      return NextResponse.json({ success: false, error: '每次最多导入50个URL' }, { status: 400 })
    }
    
    // 并行解析（最多5个同时）
    const results = []
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5)
      const batchResults = await Promise.all(batch.map(url => parseProductUrl(url)))
      results.push(...batchResults)
    }
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: urls.length,
          success: successCount,
          failed: failCount
        }
      }
    })
  } catch (error: any) {
    console.error('Parse URLs error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
