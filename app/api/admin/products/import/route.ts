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
      'inventory', 'weight', 'category', 'images', 'isActive'
    ]

    // Create CSV rows
    const rows = products.map((p: any) => [
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
      p.isActive,
    ])

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(','))
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
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Parse CSV file
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV file is empty or invalid' }, { status: 400 })
    }

    // Parse header row
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim())

    // Expected headers: name, slug, sku, description, price, compareprice, costprice, inventory, weight, category, images, isactive
    const results = { imported: 0, skipped: 0, failed: 0, errors: [] as string[] }

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((header, idx) => {
          row[header] = (values[idx] || '').trim()
        })

        // Validate required fields
        if (!row.name || !row.sku || !row.price) {
          results.skipped++
          results.errors.push(`Row ${i + 1}: Missing required fields (name, sku, price)`)
          continue
        }

        // Check if SKU already exists
        const existing = await prisma.product.findUnique({
          where: { sku: row.sku }
        })

        if (existing) {
          results.skipped++
          results.errors.push(`Row ${i + 1}: SKU ${row.sku} already exists`)
          continue
        }

        // Find category if provided
        let categoryIds = null
        if (row.category) {
          const category = await prisma.category.findFirst({
            where: { name: row.category }
          })
          categoryIds = category ? JSON.stringify([category.id]) : null
        }

        // Parse images
        let images = null
        if (row.images) {
          images = row.images
        }

        await prisma.product.create({
          data: {
            name: row.name,
            slug: row.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36),
            sku: row.sku,
            description: row.description || null,
            price: parseFloat(row.price) || 0,
            comparePrice: row.compareprice ? parseFloat(row.compareprice) : null,
            costPrice: row.costprice ? parseFloat(row.costprice) : null,
            inventory: parseInt(row.inventory) || 0,
            weight: row.weight ? parseFloat(row.weight) : null,
            images,
            categoryIds,
            isActive: row.isactive === 'true' || row.isactive === '1' || !row.isactive,
          }
        })
        results.imported++
      } catch (err: any) {
        results.failed++
        results.errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`)
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ success: false, error: 'Failed to import products: ' + error?.message }, { status: 500 })
  }
}

// Simple CSV line parser (handles quoted fields with commas)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}
