import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 解析CSV内容
function parseCSV(content: string): { headers: string[], rows: string[][] } {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV文件至少需要1行表头和1行数据')
  }
  
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(line => parseCSVLine(line))
  
  return { headers, rows }
}

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
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  
  return result
}

// POST - 导入CSV
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { csvContent } = body as { csvContent: string }
    
    if (!csvContent) {
      return NextResponse.json({ success: false, error: '请提供CSV内容' }, { status: 400 })
    }
    
    const { headers, rows } = parseCSV(csvContent)
    
    // 找到各列的索引（支持多种表头格式）
    const headerMap: Record<string, number> = {}
    const lowerHeaders = headers.map(h => h.toLowerCase())
    
    // 商品名称
    headerMap.name = lowerHeaders.findIndex(h => 
      h.includes('名称') || h.includes('name') || h.includes('标题') || h.includes('title') || h.includes('商品')
    )
    // 价格
    headerMap.price = lowerHeaders.findIndex(h => 
      h.includes('价格') || h.includes('price') || h.includes('价钱') || h.includes('售价')
    )
    // 图片
    headerMap.images = lowerHeaders.findIndex(h => 
      h.includes('图片') || h.includes('image') || h.includes('img') || h.includes('图片url') || h.includes('imageurl')
    )
    // 描述
    headerMap.description = lowerHeaders.findIndex(h => 
      h.includes('描述') || h.includes('description') || h.includes('详情') || h.includes('desc')
    )
    // SKU
    headerMap.sku = lowerHeaders.findIndex(h => 
      h.includes('sku') || h.includes('货号') || h.includes('编码') || h.includes('编号')
    )
    
    // 验证必需列
    if (headerMap.name === -1) {
      return NextResponse.json({ success: false, error: 'CSV中未找到"商品名称"列' }, { status: 400 })
    }
    if (headerMap.price === -1) {
      return NextResponse.json({ success: false, error: 'CSV中未找到"价格"列' }, { status: 400 })
    }
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      products: [] as any[]
    }
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const name = row[headerMap.name] || ''
        const price = row[headerMap.price] ? parseFloat(row[headerMap.price].replace(/[^0-9.]/g, '')) : 0
        
        if (!name) {
          results.failed++
          results.errors.push(`第${i + 2}行：商品名称为空`)
          continue
        }
        
        if (!price || price <= 0) {
          results.failed++
          results.errors.push(`第${i + 2}行：价格无效`)
          continue
        }
        
        // 处理图片（多个图片用逗号分隔）
        let images: string[] = []
        if (headerMap.images !== -1 && row[headerMap.images]) {
          images = row[headerMap.images].split(/[,，]/).map(s => s.trim()).filter(Boolean)
        }
        
        // 生成 slug
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '')
          + '-' + Date.now().toString(36)
        
        // 生成或使用SKU
        let sku = ''
        if (headerMap.sku !== -1 && row[headerMap.sku]) {
          sku = row[headerMap.sku]
        } else {
          const timestamp = Date.now().toString(36)
          const random = Math.random().toString(36).substring(2, 6)
          sku = `SKU-${timestamp}-${random}`.toUpperCase()
        }
        
        // 保存商品
        const created = await prisma.product.create({
          data: {
            name,
            slug,
            price,
            images: images.length > 0 ? JSON.stringify(images) : null,
            description: headerMap.description !== -1 ? row[headerMap.description] || '' : '',
            sku,
            isActive: false, // 草稿状态
            inventory: 0,
          }
        })
        
        results.products.push({
          id: created.id,
          name: created.name,
          sku: created.sku,
          price: created.price,
          status: 'draft'
        })
        results.success++
        
      } catch (err: any) {
        results.failed++
        results.errors.push(`第${i + 2}行：${err.message}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      data: results
    })
    
  } catch (error: any) {
    console.error('Import CSV error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
