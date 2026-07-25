import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const pages = await prisma.page.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: pages })
  } catch (error) {
    console.error('Pages API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch pages' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, slug, excerpt, content, featuredImage, template, metaTitle, metaDesc, status, sortOrder } = body

    if (!title || !slug) {
      return NextResponse.json({ success: false, error: 'Title and slug are required' }, { status: 400 })
    }

    // Check if slug already exists
    const existing = await prisma.page.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'A page with this slug already exists' }, { status: 400 })
    }

    const isPublished = status === 'published'

    const page = await prisma.page.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        content: content || '',
        featuredImage: featuredImage || null,
        template: template || 'default',
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        status: status || 'draft',
        isActive: isPublished,
        sortOrder: parseInt(sortOrder) || 0,
      },
    })

    return NextResponse.json({ success: true, data: page })
  } catch (error: any) {
    console.error('Create page error:', error)
    // Return detailed error message
    const errorMessage = error?.message || 'Failed to create page'
    const errorCode = error?.code || ''
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      code: errorCode
    }, { status: 500 })
  }
}
