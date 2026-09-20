import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/site/tax-rate?country=DE
export async function GET(request: NextRequest) {
  try {
    const countryCode = request.nextUrl.searchParams.get('country')
    
    if (!countryCode) {
      return NextResponse.json({ success: false, error: 'Country code required' }, { status: 400 })
    }

    const taxRate = await prisma.taxRate.findUnique({
      where: { countryCode: countryCode.toUpperCase() }
    })

    if (!taxRate) {
      return NextResponse.json({ success: true, rate: 0, message: 'No tax rate configured' })
    }

    return NextResponse.json({ 
      success: true, 
      rate: taxRate.isActive ? taxRate.rate : 0,
      countryName: taxRate.countryName,
      region: taxRate.region
    })
  } catch (error) {
    console.error('Failed to fetch tax rate:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch tax rate' }, { status: 500 })
  }
}
