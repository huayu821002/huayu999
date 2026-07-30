import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all shipping methods
export async function GET() {
  try {
    const methods = await prisma.shippingMethod.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { rates: true } } }
    })
    return NextResponse.json({ success: true, data: methods })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create shipping method
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code, description, isActive, sortOrder } = body
    const method = await prisma.shippingMethod.create({
      data: { name, code, description, isActive: isActive ?? true, sortOrder: parseInt(sortOrder) || 0 }
    })
    return NextResponse.json({ success: true, data: method })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
