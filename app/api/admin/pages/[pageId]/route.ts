import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const page = await prisma.page.findUnique({
      where: { id: params.pageId },
    })
    if (!page) {
      return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Get page error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch page' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const body = await request.json()
    const { title, slug, content, status, productId } = body

    // Check if new slug conflicts with another page
    if (slug) {
      const existing = await prisma.page.findFirst({
        where: { slug, NOT: { id: params.pageId } },
      })
      if (existing) {
        return NextResponse.json({ success: false, error: 'A page with this slug already exists' }, { status: 400 })
      }
    }

    const updateData: any = {
      title,
      slug,
      content,
      status,
    }

    if (productId) {
      updateData.productId = productId
    }

    const page = await prisma.page.update({
      where: { id: params.pageId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: page })
  } catch (error) {
    console.error('Update page error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update page' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    await prisma.page.delete({ where: { id: params.pageId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete page error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete page' }, { status: 500 })
  }
}
