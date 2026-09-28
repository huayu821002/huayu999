import { NextRequest, NextResponse } from 'next/server'

// Translation API - only English is supported now (pt/ru removed 2026-09-28)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get('text')

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  // Only English - return text as-is
  return NextResponse.json({ translated: text, source: 'none' })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { product } = body

  if (!product) {
    return NextResponse.json({ error: 'product is required' }, { status: 400 })
  }

  // Only English - return product as-is
  return NextResponse.json({ success: true, data: product })
}
