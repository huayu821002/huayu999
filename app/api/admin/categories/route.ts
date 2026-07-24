import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Admin categories GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, slug, description, image, parentId } = body

    const category = await prisma.category.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        image,
        parentId,
      },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Admin categories POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 })
  }
}
