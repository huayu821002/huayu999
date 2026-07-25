import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET shipping rates for a country (from database with fallback to defaults)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const countryCode = searchParams.get('countryCode')

  if (!countryCode) {
    return NextResponse.json({ error: 'Country code is required' }, { status: 400 })
  }

  try {
    // Try to get from database first
    const dbRate = await prisma.shippingRate.findUnique({
      where: { countryCode }
    })

    if (dbRate && dbRate.isActive) {
      // Return database rate as a shipping method
      return NextResponse.json([{
        id: `shipping_${dbRate.countryCode}_0`,
        name: `Standard to ${dbRate.countryName}`,
        code: `${dbRate.countryCode}_0`,
        baseCost: dbRate.baseCost,
        costPerKg: dbRate.costPerKg,
        estimatedDays: dbRate.estimatedDays || '7-14 days',
        isActive: true,
        freeThreshold: dbRate.freeThreshold,
      }])
    }

    // Return null to indicate use defaults
    return NextResponse.json(null)
  } catch (error) {
    console.error('Error fetching shipping rate:', error)
    // Return null to fall back to defaults
    return NextResponse.json(null)
  }
}
