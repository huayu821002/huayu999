import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all shipping templates and rates
export async function GET() {
  try {
    const [templates, rates] = await Promise.all([
      prisma.shippingTemplate.findMany({
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.shippingRate.findMany({
        orderBy: { countryName: 'asc' }
      })
    ])
    return NextResponse.json({ templates, rates })
  } catch (error) {
    console.error('Error fetching shipping:', error)
    return NextResponse.json({ error: 'Failed to fetch shipping data' }, { status: 500 })
  }
}

// POST create/update template or rate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...data } = body

    if (type === 'template') {
      // Create/update shipping template
      const { name, baseCost, costPerKg, freeThreshold, estimatedDays, isActive, sortOrder } = data
      
      if (!name) {
        return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
      }

      const template = await prisma.shippingTemplate.upsert({
        where: { name },
        update: {
          baseCost: baseCost || 0,
          costPerKg: costPerKg || 0,
          freeThreshold: freeThreshold || 0,
          estimatedDays,
          isActive: isActive !== false,
          sortOrder: sortOrder || 0,
        },
        create: {
          name,
          baseCost: baseCost || 0,
          costPerKg: costPerKg || 0,
          freeThreshold: freeThreshold || 0,
          estimatedDays,
          isActive: isActive !== false,
          sortOrder: sortOrder || 0,
        }
      })
      return NextResponse.json(template)
    } else if (type === 'rate') {
      // Create/update shipping rate (country)
      const { countryCode, countryName, baseCost, costPerKg, freeThreshold, estimatedDays, isActive } = data
      
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
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error saving shipping:', error)
    return NextResponse.json({ error: 'Failed to save shipping data' }, { status: 500 })
  }
}

// DELETE template or rate
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')
    const countryCode = searchParams.get('countryCode')

    if (type === 'template' && id) {
      await prisma.shippingTemplate.delete({ where: { id } })
    } else if (type === 'rate' && countryCode) {
      await prisma.shippingRate.delete({ where: { countryCode } })
    } else {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
