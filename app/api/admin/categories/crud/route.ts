import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET single category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (id) {
      const category = await prisma.category.findUnique({
        where: { id },
        include: { parent: true, children: true }
      })
      if (!category) {
        return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: category })
    }
    
    // Return all root categories (no parent)
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      include: {
        children: { orderBy: { name: 'asc' } },
        _count: { select: { products: true } }
      }
    })
    return NextResponse.json({ success: true, data: categories })
  } catch (error: any) {
    console.error('Category GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, description, image, bannerImage, parentId } = body
    
    if (!name || !slug) {
      return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 })
    }
    
    // Check if slug already exists
    const existing = await prisma.category.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Slug already exists' }, { status: 400 })
    }
    
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        image: image || null,
        bannerImage: bannerImage || null,
        parentId: parentId || null,
      }
    })
    
    return NextResponse.json({ success: true, data: category })
  } catch (error: any) {
    console.error('Category POST error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT update category
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, slug, description, image, bannerImage, parentId } = body
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 })
    }
    
    // Check if slug already exists for another category
    if (slug) {
      const existing = await prisma.category.findFirst({
        where: { slug, NOT: { id } }
      })
      if (existing) {
        return NextResponse.json({ success: false, error: 'Slug already exists' }, { status: 400 })
      }
    }
    
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
        ...(bannerImage !== undefined && { bannerImage }),
        ...(parentId !== undefined && { parentId }),
      }
    })
    
    return NextResponse.json({ success: true, data: category })
  } catch (error: any) {
    console.error('Category PUT error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE category
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 })
    }
    
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: id }
    })
    if (productCount > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot delete category with ${productCount} products. Please reassign products first.` 
      }, { status: 400 })
    }
    
    // Check if category has children
    const childCount = await prisma.category.count({
      where: { parentId: id }
    })
    if (childCount > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot delete category with ${childCount} sub-categories. Please delete sub-categories first.` 
      }, { status: 400 })
    }
    
    await prisma.category.delete({ where: { id } })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Category DELETE error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
