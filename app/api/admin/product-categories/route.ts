import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all categories as tree
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json({ success: true, data: categories })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create/update category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, slug, description, image, bannerImage, parentId } = body

    if (id) {
      // Update existing
      const updated = await prisma.category.update({
        where: { id },
        data: { name, slug, description, image, bannerImage, parentId: parentId || null }
      })
      return NextResponse.json({ success: true, data: updated })
    } else {
      // Create new
      const created = await prisma.category.create({
        data: { name, slug, description, image, bannerImage, parentId: parentId || null }
      })
      return NextResponse.json({ success: true, data: created })
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE category
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
