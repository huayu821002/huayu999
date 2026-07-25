import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Only show published pages publicly
    const page = await prisma.page.findFirst({
      where: { 
        slug: params.slug,
        status: 'PUBLISHED',
      },
    })
    if (!page) {
      return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Page API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch page' }, { status: 500 })
  }
}
