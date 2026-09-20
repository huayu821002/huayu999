import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/admin/tax-rates - 获取所有税率
export async function GET() {
  try {
    const rates = await prisma.taxRate.findMany({
      orderBy: [
        { region: 'asc' },
        { countryName: 'asc' }
      ]
    })
    return NextResponse.json({ success: true, data: rates })
  } catch (error) {
    console.error('Failed to fetch tax rates:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch tax rates' }, { status: 500 })
  }
}

// PUT /api/admin/tax-rates - 更新税率
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, countryCode, countryName, rate, region, isActive } = body

    if (!id || rate === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const updated = await prisma.taxRate.update({
      where: { id },
      data: {
        countryName: countryName || undefined,
        rate: parseFloat(rate),
        region: region || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Failed to update tax rate:', error)
    return NextResponse.json({ success: false, error: 'Failed to update tax rate' }, { status: 500 })
  }
}

// POST /api/admin/tax-rates - 批量更新地区税率
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rates } = body

    if (!Array.isArray(rates)) {
      return NextResponse.json({ success: false, error: 'Rates must be an array' }, { status: 400 })
    }

    const results = await Promise.all(
      rates.map(async (rate: any) => {
        if (rate.id) {
          return prisma.taxRate.update({
            where: { id: rate.id },
            data: {
              rate: parseFloat(rate.rate),
              isActive: rate.isActive !== undefined ? rate.isActive : true,
            }
          })
        } else if (rate.countryCode) {
          return prisma.taxRate.upsert({
            where: { countryCode: rate.countryCode },
            create: {
              countryCode: rate.countryCode,
              countryName: rate.countryName || rate.countryCode,
              rate: parseFloat(rate.rate),
              region: rate.region || 'OTHER',
              isActive: rate.isActive !== undefined ? rate.isActive : true,
            },
            update: {
              rate: parseFloat(rate.rate),
              region: rate.region || undefined,
              isActive: rate.isActive !== undefined ? rate.isActive : undefined,
            }
          })
        }
      })
    )

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Failed to batch update tax rates:', error)
    return NextResponse.json({ success: false, error: 'Failed to update tax rates' }, { status: 500 })
  }
}
