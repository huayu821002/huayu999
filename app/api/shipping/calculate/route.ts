import { NextResponse } from 'next/server'
import { getShippingMethods, calculateShipping, calculateTotalWeight } from '@/lib/shipping'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subtotal, weight, country } = body

    const subtotalNum = parseFloat(subtotal) || 0
    const weightNum = parseFloat(weight) || 0

    // Get shipping methods for country
    const methods = getShippingMethods(country)

    const results = methods.map((method: any) => {
      // Check weight constraints
      if (method.minWeight && weightNum < method.minWeight) {
        return { id: method.id, name: method.name, code: method.code, available: false, reason: `Minimum weight ${method.minWeight}kg` }
      }
      if (method.maxWeight && weightNum > method.maxWeight) {
        return { id: method.id, name: method.name, code: method.code, available: false, reason: `Maximum weight ${method.maxWeight}kg` }
      }

      // Calculate cost
      let cost: number
      if (method.freeThreshold > 0 && subtotalNum >= method.freeThreshold) {
        cost = 0 // Free shipping
      } else {
        cost = method.baseCost + (weightNum * method.costPerKg)
      }

      return {
        id: method.id,
        name: method.name,
        code: method.code,
        description: method.estimatedDays,
        estimatedDays: method.estimatedDays,
        cost,
        freeShipping: cost === 0,
        available: true,
      }
    })

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to calculate shipping' }, { status: 500 })
  }
}
