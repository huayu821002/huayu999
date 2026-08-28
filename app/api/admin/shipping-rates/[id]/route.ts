import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rate = await prisma.shippingRate.findUnique({ where: { id: params.id } })
    if (!rate) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: rate })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { countryCode, countryName, baseCost, costPerKg, freeThreshold, minWeight, maxWeight, estimatedDays, isActive, sortOrder, methodId, warehouseId } = body
    const rate = await prisma.shippingRate.update({
      where: { id: params.id },
      data: {
        countryCode, countryName,
        baseCost: Number(baseCost) || 0,
        costPerKg: Number(costPerKg) || 0,
        freeThreshold: Number(freeThreshold) || 0,
        minWeight: Number(minWeight) || 0,
        maxWeight: Number(maxWeight) || 0,
        estimatedDays,
        isActive,
        sortOrder,
        methodId: methodId || null,
        warehouseId: warehouseId || null,
      }
    })
    return NextResponse.json({ success: true, data: rate })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.shippingRate.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
