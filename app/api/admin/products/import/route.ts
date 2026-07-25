import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all products for export
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })

    // Create CSV header
    const headers = [
      'name', 'slug', 'sku', 'description', 'shortDesc',
      'price', 'comparePrice', 'costPrice', 'wholesalePrice', 'vipPrice',
      'minOrderQty', 'inventory', 'weight', 'category',
      'images', 'isActive', 'isFeatured', 'isTrending'
    ]

    // Create CSV rows
    const rows = products.map(p => [
      p.name,
      p.slug,
      p.sku || '',
      (p.description || '').replace(/"/g, '""'),
      (p.shortDesc || '').replace(/"/g, '""'),
      p.price.toString(),
      p.comparePrice?.toString() || '',
      p.costPrice?.toString() || '',
      p.wholesalePrice?.toString() || '',
      p.vipPrice?.toString() || '',
      p.minOrderQty.toString(),
      p.inventory.toString(),
      p.weight?.toString() || '',
      p.category?.name || '',
      p.images || '',
      p.isActive ? 'TRUE' : 'FALSE',
      p.isFeatured ? 'TRUE' : 'FALSE',
      p.isTrending ? 'TRUE' : 'FALSE',
    ])

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`,
      },
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

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(line => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'File is empty or has no data rows' }, { status: 400 })
    }

    // Parse header row - remove quotes and filter empty columns
    const headerRaw = parseCSVLine(lines[0])
    // Filter out empty columns and trim
    const header = headerRaw.map(h => h.trim()).filter(h => h.length > 0)

    // Parse data rows
    const results = { success: 0, failed: 0, errors: [] as string[] }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines

      const values = parseCSVLine(line)
      
      // If column count doesn't match, be forgiving - pad or trim as needed
      if (values.length !== header.length) {
        if (values.length > header.length) {
          // Too many columns - trim extras
          values.length = header.length
        } else if (values.length < header.length) {
          // Fewer columns - pad with empty strings (graceful handling)
          while (values.length < header.length) values.push('')
        }
      }

      const row: Record<string, any> = {}
      header.forEach((h, idx) => {
        row[h] = values[idx] || ''
      })

      try {
        // Generate slug if not provided
        const slug = row.slug || row.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36) || `product-${i}-${Date.now()}`
        
        // Check if product with same SKU already exists (skip duplicates)
        if (row.sku) {
          const existing = await prisma.product.findFirst({ where: { sku: row.sku } })
          if (existing) {
            results.failed++
            results.errors.push(`Row ${i}: SKU "${row.sku}" already exists, skipping`)
            continue
          }
        }

        await prisma.product.create({
          data: {
            name: row.name || `Product ${i}`,
            slug: slug,
            sku: row.sku || null,
            description: row.description || null,
            shortDesc: row.shortDesc || null,
            price: parseFloat(row.price) || 0,
            comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : null,
            costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
            wholesalePrice: row.wholesalePrice ? parseFloat(row.wholesalePrice) : null,
            vipPrice: row.vipPrice ? parseFloat(row.vipPrice) : null,
            minOrderQty: parseInt(row.minOrderQty) || 1,
            inventory: parseInt(row.inventory) || 0,
            weight: row.weight ? parseFloat(row.weight) : null,
            images: row.images || null,
            isActive: row.isActive?.toUpperCase() === 'TRUE',
            isFeatured: row.isFeatured?.toUpperCase() === 'TRUE',
            isTrending: row.isTrending?.toUpperCase() === 'TRUE',
            categoryId: row.category || null,
          },
        })
        results.success++
      } catch (err: any) {
        results.failed++
        const errorMsg = err?.message || 'Unknown error'
        if (results.errors.length < 5) { // Only keep first 5 errors
          results.errors.push(`Row ${i}: ${errorMsg}`)
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ success: false, error: 'Failed to import products' }, { status: 500 })
  }
}

// Better CSV parser - handles various formats
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())

  // Clean up quoted values
  return result.map(v => {
    if (v.startsWith('"') && v.endsWith('"')) {
      return v.slice(1, -1).replace(/""/g, '"')
    }
    return v
  })
}
