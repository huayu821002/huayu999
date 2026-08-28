import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    
    const where = warehouseId ? { warehouseId } : {}
    const rates = await prisma.warehouseShippingRate.findMany({
      where,
      include: { warehouse: true },
      orderBy: { warehouseId: 'asc' },
    })
    return NextResponse.json({ success: true, data: rates })
  } catch (error) {
    console.error('Get warehouse shipping rates error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch rates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { warehouseId, countryCode, countryName, shippingCost, costPerKg, estimatedDays } = body

    const rate = await prisma.warehouseShippingRate.create({
      data: {
        warehouseId,
        countryCode,
        countryName,
        shippingCost: parseFloat(shippingCost) || 0,
        costPerKg: parseFloat(costPerKg) || 0,
        estimatedDays,
        isActive: true,
      },
    })
    return NextResponse.json({ success: true, data: rate })
  } catch (error) {
    console.error('Create warehouse shipping rate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create rate' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, countryCode, countryName, shippingCost, costPerKg, estimatedDays, isActive } = body

    const rate = await prisma.warehouseShippingRate.update({
      where: { id },
      data: { countryCode, countryName, shippingCost, costPerKg, estimatedDays, isActive },
    })
    return NextResponse.json({ success: true, data: rate })
  } catch (error) {
    console.error('Update warehouse shipping rate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update rate' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

    await prisma.warehouseShippingRate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete warehouse shipping rate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete rate' }, { status: 500 })
  }
}
