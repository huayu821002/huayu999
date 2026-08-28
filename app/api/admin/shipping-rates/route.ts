import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET all shipping rates (optionally filtered by methodId)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const methodId = searchParams.get('methodId')

    const where = methodId ? { methodId } : {}
    const rates = await prisma.shippingRate.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { method: { select: { name: true, code: true } }, warehouse: { select: { name: true } } }
    })
    return NextResponse.json({ success: true, data: rates.map((r: any) => ({ ...r, warehouseName: r.warehouse?.name })) })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create shipping rate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { countryCode, countryName, baseCost, costPerKg, freeThreshold, minWeight, maxWeight, estimatedDays, isActive, sortOrder, methodId, warehouseId } = body
    const rate = await prisma.shippingRate.create({
      data: {
        countryCode, countryName,
        baseCost: Number(baseCost) || 0,
        costPerKg: Number(costPerKg) || 0,
        freeThreshold: Number(freeThreshold) || 0,
        minWeight: Number(minWeight) || 0,
        maxWeight: Number(maxWeight) || 0,
        estimatedDays,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        methodId: methodId || null,
        warehouseId: warehouseId || null,
      }
    })
    return NextResponse.json({ success: true, data: rate })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
