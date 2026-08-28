import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - get inventory for a product
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    if (!productId) return NextResponse.json({ success: false, error: 'Missing productId' }, { status: 400 })

    const inventories = await prisma.productWarehouseInventory.findMany({
      where: { productId },
      include: { warehouse: true },
    })
    return NextResponse.json({ success: true, data: inventories })
  } catch (error) {
    console.error('Get product inventory error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch inventory' }, { status: 500 })
  }
}

// POST - update inventory (upsert)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productId, warehouseId, quantity, lowStockAlert } = body

    const inventory = await prisma.productWarehouseInventory.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      update: { quantity, lowStockAlert },
      create: { productId, warehouseId, quantity, lowStockAlert: lowStockAlert || 10 },
    })
    return NextResponse.json({ success: true, data: inventory })
  } catch (error) {
    console.error('Update product inventory error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update inventory' }, { status: 500 })
  }
}

// DELETE - remove warehouse inventory for a product
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

    await prisma.productWarehouseInventory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete product inventory error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete inventory' }, { status: 500 })
  }
}
