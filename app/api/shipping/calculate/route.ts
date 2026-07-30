import { NextResponse } from 'next/server'
import { calculateShippingOptions } from '@/lib/shipping'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subtotal, weight, country } = body

    console.log('[/api/shipping/calculate] body:', body)

    const subtotalNum = parseFloat(subtotal) || 0
    const weightNum = parseFloat(weight) || 0

    console.log('[/api/shipping/calculate] calling calculateShippingOptions:', { country, weightNum, subtotalNum })

    const options = await calculateShippingOptions(country, weightNum, subtotalNum)

    console.log('[/api/shipping/calculate] options:', options)

    return NextResponse.json({ success: true, data: options })
  } catch (error: any) {
    console.error('[/api/shipping/calculate] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to calculate shipping: ' + error.message }, { status: 500 })
  }
}
