import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const pages = await prisma.customPage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
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
    const { title, slug, content, metaTitle, metaDesc, isActive, sortOrder } = body

    if (!title || !slug || !content) {
      return NextResponse.json({ success: false, error: 'Title, slug, and content are required' }, { status: 400 })
    }

    // Check if slug already exists
    const existing = await prisma.customPage.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'A page with this slug already exists' }, { status: 400 })
    }

    const page = await prisma.customPage.create({
      data: {
        title,
        slug,
        content,
        metaTitle,
        metaDesc,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Create page error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create page' }, { status: 500 })
  }
}
