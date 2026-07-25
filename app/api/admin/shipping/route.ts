import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all shipping rates
export async function GET() {
  try {
    const rates = await prisma.shippingRate.findMany({
      orderBy: { countryName: 'asc' }
    })
    return NextResponse.json(rates)
  } catch (error) {
    console.error('Error fetching shipping rates:', error)
    return NextResponse.json({ error: 'Failed to fetch shipping rates' }, { status: 500 })
  }
}

// POST create/update shipping rate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { countryCode, countryName, baseCost, costPerKg, freeThreshold, estimatedDays, isActive } = body

    if (!countryCode || !countryName) {
      return NextResponse.json({ error: 'Country code and name are required' }, { status: 400 })
    }

    const rate = await prisma.shippingRate.upsert({
      where: { countryCode },
      update: {
        countryName,
        baseCost: baseCost || 0,
        costPerKg: costPerKg || 0,
        freeThreshold: freeThreshold || 0,
        estimatedDays,
        isActive: isActive !== false,
      },
      create: {
        countryCode,
        countryName,
        baseCost: baseCost || 0,
        costPerKg: costPerKg || 0,
        freeThreshold: freeThreshold || 0,
        estimatedDays,
        isActive: isActive !== false,
      }
    })

    return NextResponse.json(rate)
  } catch (error) {
    console.error('Error saving shipping rate:', error)
    return NextResponse.json({ error: 'Failed to save shipping rate' }, { status: 500 })
  }
}

// DELETE shipping rate
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('countryCode')

    if (!countryCode) {
      return NextResponse.json({ error: 'Country code is required' }, { status: 400 })
    }

    await prisma.shippingRate.delete({
      where: { countryCode }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shipping rate:', error)
    return NextResponse.json({ error: 'Failed to delete shipping rate' }, { status: 500 })
  }
}
