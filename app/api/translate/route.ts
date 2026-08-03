import { NextRequest, NextResponse } from 'next/server'
import { translate, translateProduct, getLocaleFromHost } from '@/lib/translation/translate'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get('text')
  const locale = searchParams.get('locale') as 'pt' | 'ru'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  
  // Detect locale from host if not provided
  const detectedLocale = locale || getLocaleFromHost(host)
  
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  
  if (!['pt', 'ru'].includes(detectedLocale)) {
    return NextResponse.json({ translated: text })
  }
  
  const result = await translate(text, detectedLocale)
  
  return NextResponse.json({
    translated: result?.translated ?? text,
    source: result?.source ?? 'none',
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { product, locale } = body as {
    product: { name?: string; description?: string; shortDesc?: string }
    locale: 'pt' | 'ru'
  }
  
  if (!product || !locale) {
    return NextResponse.json({ error: 'product and locale are required' }, { status: 400 })
  }
  
  const translated = await translateProduct(product, locale)
  
  return NextResponse.json({ success: true, data: translated })
}
