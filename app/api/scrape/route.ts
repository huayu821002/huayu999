import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

interface ScrapedProduct {
  title: string
  description: string
  price: string
  currency: string
  images: string[]
  source: string
  originalUrl: string
}

export async function POST(request: Request) {
  try {
    // 验证用户身份 — 需要 admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 })
    }

    // Fetch the page
    let html: string
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      })
      
      if (!response.ok) {
        return NextResponse.json({ success: false, error: `Failed to fetch: ${response.status} ${response.statusText}` }, { status: 400 })
      }
      
      html = await response.text()
    } catch (fetchError: any) {
      return NextResponse.json({ success: false, error: `Fetch failed: ${fetchError?.message || 'Timeout or network error'}` }, { status: 400 })
    }

    const result = parseProductData(html, url)
    
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to scrape product' }, { status: 500 })
  }
}

function parseProductData(html: string, originalUrl: string): ScrapedProduct {
  const result: ScrapedProduct = {
    title: '',
    description: '',
    price: '',
    currency: 'USD',
    images: [],
    source: new URL(originalUrl).hostname,
    originalUrl,
  }

  // Extract Open Graph data (most e-commerce sites use these)
  result.title = extractMetaContent(html, ['og:title', 'product:product:title', 'twitter:title', 'title']) || ''
  result.description = extractMetaContent(html, ['og:description', 'description', 'twitter:description']) || ''
  
  // Extract price
  const priceData = extractPrice(html)
  result.price = priceData.price
  result.currency = priceData.currency

  // Extract images
  result.images = extractImages(html)

  // Clean up title if it's a URL
  if (result.title.startsWith('http')) {
    result.title = extractMetaContent(html, ['twitter:title', 'title']) || result.title
  }

  // Clean description (remove HTML tags)
  result.description = cleanHtml(result.description)

  // Try to extract specific product data from JSON-LD
  const jsonLd = extractJsonLd(html)
  if (jsonLd) {
    result.title = jsonLd.name || result.title
    result.description = jsonLd.description || result.description
    result.price = jsonLd.offers?.price || result.price
    if (jsonLd.image) {
      result.images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
    }
  }

  return result
}

function extractMetaContent(html: string, metaNames: string[]): string | null {
  for (const name of metaNames) {
    // Try property attribute (Open Graph)
    const ogMatch = html.match(new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    if (ogMatch) return decodeHtmlEntities(ogMatch[1])
    
    // Try reversed order
    const ogMatch2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'))
    if (ogMatch2) return decodeHtmlEntities(ogMatch2[1])
    
    // Try name attribute
    const nameMatch = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
    if (nameMatch) return decodeHtmlEntities(nameMatch[1])
    
    // Try reversed
    const nameMatch2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'))
    if (nameMatch2) return decodeHtmlEntities(nameMatch2[1])
  }
  
  // Try title tag as fallback
  if (metaNames.includes('title')) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) return decodeHtmlEntities(titleMatch[1].trim())
  }
  
  return null
}

function extractPrice(html: string): { price: string; currency: string } {
  // Try JSON-LD first
  const jsonLd = extractJsonLd(html)
  if (jsonLd?.offers?.price) {
    return {
      price: String(jsonLd.offers.price),
      currency: jsonLd.offers.priceCurrency || 'USD',
    }
  }

  // Common price patterns in meta tags
  const pricePatterns = [
    /product:price:amount["']\s*[:\s]+["']([^"']+)["']/i,
    /product:price:currency["']\s*[:\s]+["']([^"']+)["']/i,
    /"price"\s*:\s*"?([\d.,]+)"?/i,
    /"offers"\s*:\s*\{[^}]*"price"\s*:\s*"?([\d.,]+)"?/i,
  ]

  let price = ''
  let currency = 'USD'

  // Look for price in various places
  const priceMatch = html.match(/(?:product:price:amount|price|amount)["\s:]+([^"'$\d]+)?([\d,]+\.?\d*)/i)
  if (priceMatch) {
    price = priceMatch[2].replace(/,/g, '')
  }

  // Detect currency from content
  if (html.includes('"CNY"') || html.includes('currency:[\'"]CNY') || html.includes('¥')) {
    currency = 'CNY'
  } else if (html.includes('"USD"') || html.includes('USD')) {
    currency = 'USD'
  } else if (html.includes('"EUR"') || html.includes('€')) {
    currency = 'EUR'
  }

  return { price, currency }
}

function extractImages(html: string): string[] {
  const images: string[] = []

  // Try JSON-LD images first
  const jsonLd = extractJsonLd(html)
  if (jsonLd?.image) {
    const img = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
    images.push(...img.filter(Boolean))
  }

  // Open Graph images - try multiple patterns
  const ogPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
  ]
  ogPatterns.forEach(pattern => {
    const matches = html.match(pattern) || []
    matches.forEach(m => {
      const match = m.match(/content=["']([^"']+)["']/)
      if (match) images.push(match[1])
    })
  })

  // Twitter images
  const twitterImages = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi) || []
  twitterImages.forEach(m => {
    const match = m.match(/content=["']([^"']+)["']/)
    if (match) images.push(match[1])
  })

  // Look for image URLs in JavaScript variables like var images = [...] or data-src=
  const jsImagePatterns = [
    /images\s*:\s*\[(.*?)\]/gi,
    /photos\s*:\s*\[(.*?)\]/gi,
    /pictures\s*:\s*\[(.*?)\]/gi,
    /"images"\s*:\s*\[(.*?)\]/gi,
  ]
  jsImagePatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(html)) !== null) {
      const imgArray = match[1]
      const imgMatches = imgArray.match(/["'](https?:\/\/[^<>"'\s,}]+\.(?:jpg|jpeg|png|webp|gif))["']/gi) || []
      imgMatches.forEach((img: string) => {
        const clean = img.replace(/["']/g, '')
        if (clean.startsWith('http')) images.push(clean)
      })
    }
  })

  // Look for data-src or data-original attributes (common lazy loading pattern)
  const dataSrcMatches = html.match(/data-(?:src|original|image)\s*=\s*["']([^"']+)["']/gi) || []
  dataSrcMatches.forEach(m => {
    const match = m.match(/= ["']([^"']+)["']/)
    if (match && match[1].startsWith('http')) images.push(match[1])
  })

  // Deduplicate and filter - limit to 5 images for main product images
  const unique = Array.from(new Set(images)).filter(img => {
    return img.startsWith('http') && !img.includes('data:') && !img.includes('base64')
  })

  return unique.slice(0, 5) // Limit to 5 images as main product images
}

function extractJsonLd(html: string): any {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (!matches) return null

  for (const match of matches) {
    try {
      const jsonMatch = match.match(/>([\s\S]*?)<\/script>/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1])
        
        // Handle @graph array
        if (data['@graph']) {
          const product = data['@graph'].find((item: any) => 
            item['@type'] === 'Product' || 
            item['@type'] === 'IndividualProduct' ||
            item['@type'] === 'SomeProducts'
          )
          if (product) return product
        }
        
        // Direct Product type
        if (data['@type'] === 'Product' || data['@type'] === 'IndividualProduct') {
          return data
        }
        
        // Check offers
        if (data.offers) {
          return data
        }
      }
    } catch (e) {
      // Continue to next match
    }
  }
  
  return null
}

function cleanHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .substring(0, 2000) // Limit description length
}

function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .trim()
}
