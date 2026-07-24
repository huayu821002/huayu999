import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const method = await prisma.shippingMethod.findUnique({ where: { id: params.id } })
    if (!method) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: method })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const {
      name, code, description, baseCost, costPerKg,
      freeThreshold, minWeight, maxWeight, estimatedDays, isActive, sortOrder
    } = body

    const method = await prisma.shippingMethod.update({
      where: { id: params.id },
      data: {
        name, code, description,
        baseCost: parseFloat(baseCost) || 0,
        costPerKg: parseFloat(costPerKg) || 0,
        freeThreshold: parseFloat(freeThreshold) || 0,
        minWeight: parseFloat(minWeight) || 0,
        maxWeight: parseFloat(maxWeight) || 0,
        estimatedDays,
        isActive,
        sortOrder: parseInt(sortOrder) || 0,
      },
    })
    return NextResponse.json({ success: true, data: method })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.shippingMethod.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
  }
}
