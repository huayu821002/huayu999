import { NextResponse } from 'next/server'
import { calculateShippingOptions } from '@/lib/shipping'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subtotal, weight, country, warehouseId } = body

    const subtotalNum = parseFloat(subtotal) || 0
    const weightNum = parseFloat(weight) || 0

    const options = await calculateShippingOptions(country, weightNum, subtotalNum, warehouseId)

    return NextResponse.json({ success: true, data: options })
  } catch (error: any) {
    console.error('[/api/shipping/calculate] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to calculate shipping' }, { status: 500 })
  }
}
