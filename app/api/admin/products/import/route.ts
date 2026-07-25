import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all products for export
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })

    // Create CSV header - only fields that exist in schema
    const headers = [
      'name', 'slug', 'sku', 'description', 'price', 'comparePrice', 'costPrice',
      'inventory', 'weight', 'category', 'images', 'status'
    ]

    // Create CSV rows
    const rows = products.map(p => [
      p.name,
      p.slug,
      p.sku || '',
      (p.description || '').replace(/"/g, '""'),
      p.price.toString(),
      p.comparePrice?.toString() || '',
      p.costPrice?.toString() || '',
      p.inventory.toString(),
      p.weight?.toString() || '',
      p.category?.name || '',
      p.images || '',
      p.status,
    ])

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { products } = body

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ success: false, error: 'Products array is required' }, { status: 400 })
    }

    const results = { imported: 0, skipped: 0, errors: [] as string[] }

    for (const row of products) {
      try {
        // Validate required fields
        if (!row.name || !row.sku || row.price === undefined) {
          results.skipped++
          continue
        }

        // Check if SKU already exists
        const existing = await prisma.product.findUnique({
          where: { sku: row.sku }
        })

        if (existing) {
          results.skipped++
          continue
        }

        // Find category if provided
        let categoryId = null
        if (row.category) {
          const category = await prisma.category.findFirst({
            where: { name: row.category }
          })
          categoryId = category?.id || null
        }

        // Parse images if provided
        let images = null
        if (row.images) {
          if (typeof row.images === 'string') {
            images = row.images
          } else if (Array.isArray(row.images)) {
            images = JSON.stringify(row.images)
          }
        }

        await prisma.product.create({
          data: {
            name: row.name,
            slug: row.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            sku: row.sku,
            description: row.description || null,
            price: parseFloat(row.price) || 0,
            comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : null,
            costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
            inventory: parseInt(row.inventory) || 0,
            weight: row.weight ? parseFloat(row.weight) : null,
            images,
            categoryId,
            status: row.status || 'ACTIVE',
          }
        })
        results.imported++
      } catch (err) {
        results.errors.push(`Failed to import ${row.name || row.sku}: ${err}`)
        results.skipped++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ success: false, error: 'Failed to import products' }, { status: 500 })
  }
}
