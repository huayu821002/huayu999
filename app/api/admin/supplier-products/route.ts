import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable, parseImagesField, parseJsonField } from '@/lib/supplier'

// GET /api/admin/supplier-products?status=pending&search=xxx&page=1&limit=30
export async function GET(request: NextRequest) {
  try {
    await ensureSupplierProductTable()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const search = (searchParams.get('search') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')))

    const where: any = {}
    if (status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { sourceId: { contains: search } },
        { supplierName: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.supplierProduct.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplierProduct.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      data: items.map((i: any) => ({
        ...i,
        raw: i.raw ? i.raw.slice(0, 20000) : null,
        images: parseImagesField(i.images),
        attributes: parseJsonField(i.attributes),
        skuText: parseJsonField(i.skuText),
      })),
    })
  } catch (error: any) {
    console.error('supplier-products list error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch supplier products' },
      { status: 500 }
    )
  }
}
