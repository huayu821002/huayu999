import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all categories (flat list for admin UI)
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { products: true } } }
    })
    
    const formatted = categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId,
      image: c.image,
      productCount: c._count.products
    }))
    
    return NextResponse.json({ success: true, data: formatted })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create or update category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // If id is provided, update existing; otherwise create new
    if (body.id) {
      const updated = await prisma.category.update({
        where: { id: body.id },
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description || null,
          parentId: body.parentId || null,
          image: body.image || null
        }
      })
      return NextResponse.json({ success: true, data: updated })
    } else {
      // Create new category
      const created = await prisma.category.create({
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description || null,
          parentId: body.parentId || null,
          image: body.image || null
        }
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
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID required' }, { status: 400 })
    }
    
    // Delete category (products will be uncategorized due to optional relation)
    await prisma.category.delete({ where: { id } })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
