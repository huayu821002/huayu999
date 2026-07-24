import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const methods = await prisma.shippingMethod.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ success: true, data: methods })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch shipping methods' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name, code, description, baseCost, costPerKg,
      freeThreshold, minWeight, maxWeight, estimatedDays, isActive, sortOrder
    } = body

    // Check if code already exists
    const existing = await prisma.shippingMethod.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Shipping method code already exists' }, { status: 400 })
    }

    const method = await prisma.shippingMethod.create({
      data: {
        name,
        code,
        description,
        baseCost: parseFloat(baseCost) || 0,
        costPerKg: parseFloat(costPerKg) || 0,
        freeThreshold: parseFloat(freeThreshold) || 0,
        minWeight: parseFloat(minWeight) || 0,
        maxWeight: parseFloat(maxWeight) || 0,
        estimatedDays,
        isActive: isActive !== false,
        sortOrder: parseInt(sortOrder) || 0,
      },
    })
    return NextResponse.json({ success: true, data: method })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to create shipping method' }, { status: 500 })
  }
}
