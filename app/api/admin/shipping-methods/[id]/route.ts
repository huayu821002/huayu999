import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const method = await prisma.shippingMethod.findUnique({
      where: { id: params.id },
      include: { rates: { orderBy: { sortOrder: 'asc' } } }
    })
    if (!method) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: method })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, code, description, isActive, sortOrder } = body
    const method = await prisma.shippingMethod.update({
      where: { id: params.id },
      data: { name, code, description, isActive, sortOrder: parseInt(sortOrder) || 0 }
    })
    return NextResponse.json({ success: true, data: method })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.shippingMethod.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
