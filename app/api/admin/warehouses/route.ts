import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    })
    return NextResponse.json({ success: true, data: warehouses })
  } catch (error) {
    console.error('Get warehouses error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch warehouses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, code, country, isDefault, isActive, sortOrder } = body

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const warehouse = await prisma.warehouse.create({
      data: { name, code, country, isDefault: isDefault || false, isActive: isActive !== false, sortOrder: sortOrder || 0 },
    })
    return NextResponse.json({ success: true, data: warehouse })
  } catch (error) {
    console.error('Create warehouse error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create warehouse' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, code, country, isDefault, isActive, sortOrder } = body

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { name, code, country, isDefault, isActive, sortOrder },
    })
    return NextResponse.json({ success: true, data: warehouse })
  } catch (error) {
    console.error('Update warehouse error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update warehouse' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

    // Check if warehouse has inventory
    const inventory = await prisma.productWarehouseInventory.count({
      where: { warehouseId: id },
    })
    if (inventory > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete warehouse with inventory records' }, { status: 400 })
    }

    await prisma.warehouse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete warehouse error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete warehouse' }, { status: 500 })
  }
}
