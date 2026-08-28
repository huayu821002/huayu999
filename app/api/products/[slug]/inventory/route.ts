import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    const inventories = await prisma.productWarehouseInventory.findMany({
      where: { productId: product.id },
      include: { warehouse: true },
    })

    // Also get default warehouse if exists
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { isDefault: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        inventories,
        defaultWarehouse,
        // Also return total inventory from old field for backwards compatibility
        legacyInventory: product.id, // We return inventories instead
      }
    })
  } catch (error) {
    console.error('Get product inventory error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch inventory' }, { status: 500 })
  }
}
