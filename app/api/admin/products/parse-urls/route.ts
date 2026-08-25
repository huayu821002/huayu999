import { NextRequest, NextResponse } from 'next/server'

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
    
    // 如果主要字段为空，尝试平台特定解析
    if (!product.name || !product.price) {
      const platformData = parsePlatformSpecific(html, url, platform)
      product.name = product.name || platformData.name
      product.price = product.price || platformData.price
      product.images = product.images.length > 0 ? product.images : platformData.images
      product.description = product.description || platformData.description
    }
    
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

// 解析HTML获取商品数据（通用）
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
  
  // 1. 尝试从 JSON-LD 获取数据（支持多个JSON-LD块）
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/i, '').replace(/<\/script>/i, '')
        const jsonLd = JSON.parse(jsonContent)
        
        // 查找 Product 类型
        if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'IndividualProduct') {
          if (jsonLd.name) result.name = jsonLd.name
          if (jsonLd.description) result.description = jsonLd.description
          if (jsonLd.offers) {
            const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
            if (offers.price) result.price = offers.price
            if (offers.priceCurrency) result.currency = offers.priceCurrency
          }
          if (jsonLd.image) {
            result.images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
          }
          if (jsonLd.sku) result.sku = jsonLd.sku
        }
        
        // 遍历 JSON-LD 查找有用字段
        const findInObject = (obj: any) => {
          if (!obj) return
          if (obj.name && !result.name) result.name = obj.name
          if (obj.description && !result.description) result.description = obj.description
          if (obj.price && !result.price) result.price = String(obj.price)
          if (obj.priceCurrency && !result.price) result.currency = obj.priceCurrency
          if (obj.image && result.images.length === 0) {
            result.images = Array.isArray(obj.image) ? obj.image : [obj.image]
          }
          if (obj.sku && !result.sku) result.sku = obj.sku
        }
        findInObject(jsonLd)
        
        // 如果是数组，遍历查找
        if (Array.isArray(jsonLd)) {
          for (const item of jsonLd) {
            findInObject(item)
          }
        }
      } catch {}
    }
  }
  
  // 2. 从 meta og: 标签获取
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (!result.name && ogTitleMatch) {
    result.name = decodeHtmlEntities(ogTitleMatch[1])
  }
  
  // 兼容 title 标签
  if (!result.name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      result.name = decodeHtmlEntities(titleMatch[1]).split('|')[0].split('-')[0].trim()
    }
  }
  
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (!result.description && ogDescMatch) {
    result.description = decodeHtmlEntities(ogDescMatch[1])
  }
  
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (ogImageMatch && result.images.length === 0) {
    result.images = [ogImageMatch[1]]
  }
  
  // 3. Twitter card
  const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
  if (twitterImageMatch && result.images.length === 0) {
    result.images = [twitterImageMatch[1]]
  }
  
  // 4. 商品ID/货号
  const skuMatch = html.match(/data-sku=["']([^"']+)["']/i) || 
                   html.match(/itemid=["']([^"']+)["']/i) ||
                   html.match(/productId\s*:\s*["'](\d+)["']/i)
  if (skuMatch) {
    result.sku = skuMatch[1]
  }
  
  // 5. 清理描述（移除HTML标签）
  if (result.description) {
    result.description = result.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  
  // 6. 生成SKU（如果没有）
  if (!result.sku) {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)
    result.sku = `SKU-${platform.toUpperCase()}-${timestamp}-${random}`.toUpperCase()
  }
  
  return result
}

// 平台特定解析
function parsePlatformSpecific(html: string, url: string, platform: string) {
  const result: any = {
    name: '',
    price: '',
    images: [],
    description: '',
  }
  
  if (platform === 'aliexpress') {
    // AliExpress 特定解析
    // 尝试从 script 标签中提取数据
    const dataMatch = html.match(/window\.\w+\s*=\s*(\{[^;]+\})/i)
    if (dataMatch) {
      try {
        // 提取标题
        const titleMatch = dataMatch[1].match(/subject\s*:\s*["']([^"']+)["']/i)
        if (titleMatch) result.name = titleMatch[1]
        
        // 提取价格
        const priceMatch = dataMatch[1].match(/price\s*:\s*["']?([\d.,]+)["']?/i)
        if (priceMatch) result.price = priceMatch[1].replace(/,/g, '')
      } catch {}
    }
    
    // 尝试从特定meta获取
    const subjectMatch = html.match(/<meta[^>]+name=["']subject["'][^>]+content=["']([^"']+)["']/i)
    if (subjectMatch) result.name = decodeHtmlEntities(subjectMatch[1])
    
    // AliExpress 图片
    const imageIdsMatch = html.match(/imageBigMapURLs\s*=\s*\[([^\]]+)\]/i)
    if (imageIdsMatch) {
      try {
        const ids = imageIdsMatch[1].split(',').map((s: string) => s.trim().replace(/['"]/g, ''))
        result.images = ids.map((id: string) => `https://ae01.alicdn.com/kf/${id}.jpg`)
      } catch {}
    }
  }
  
  if (platform === '1688') {
    // 1688 特定解析
    const titleMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)
    if (titleMatch) {
      const keywords = decodeHtmlEntities(titleMatch[1])
      result.name = keywords.split(',')[0]
    }
    
    // 1688 图片
    const imageMatch = html.match(/(https?:\/\/cbu01\.alicdn\.com\/[^"'\s]+)/i)
    if (imageMatch) {
      result.images = [imageMatch[1]]
    }
    
    // 价格
    const priceMatch = html.match(/(?:price|cost)\s*["\s:]+[^"$]*?([\d,]+\.?\d*)/i)
    if (priceMatch) {
      result.price = priceMatch[1].replace(/,/g, '')
    }
  }
  
  if (platform === 'alibaba') {
    // Alibaba 特定解析
    const titleMatch = html.match(/<meta[^>]+name=["']subject["'][^>]+content=["']([^"']+)["']/i)
    if (titleMatch) result.name = decodeHtmlEntities(titleMatch[1])
    
    const priceMatch = html.match(/<span[^>]+class=["'][^"']*price[^"']*["'][^>]*>([\d.,]+)/i)
    if (priceMatch) result.price = priceMatch[1].replace(/,/g, '')
  }
  
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
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/&hellip;/g, '...')
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
