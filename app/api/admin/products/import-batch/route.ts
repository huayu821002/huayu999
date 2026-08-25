import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - 批量导入商品（作为草稿）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { products } = body as {
      products: Array<{
        name: string
        price: string
        currency?: string
        images?: string[]
        description?: string
        sku: string
        originalUrl?: string
        platform?: string
      }>
    }
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, error: '请提供商品列表' }, { status: 400 })
    }
    
    if (products.length > 50) {
      return NextResponse.json({ success: false, error: '每次最多导入50个商品' }, { status: 400 })
    }
    
    const results = {
      success: 0,
      failed: 0,
      products: [] as any[]
    }
    
    for (const product of products) {
      try {
        // 生成 slug
        const slug = product.name
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '')
          + '-' + Date.now().toString(36)
        
        // 保存为草稿商品
        const created = await prisma.product.create({
          data: {
            name: product.name || '未命名商品',
            slug,
            price: parseFloat(product.price) || 0,
            currency: product.currency || 'USD',
            images: product.images?.length > 0 ? JSON.stringify(product.images) : null,
            description: product.description || '',
            sku: product.sku || `SKU-${Date.now()}`,
            isActive: false, // 草稿状态，默认不显示
            inventory: 0,
          }
        })
        
        results.products.push({
          id: created.id,
          name: created.name,
          sku: created.sku,
          status: 'draft'
        })
        results.success++
      } catch (err: any) {
        console.error('Import product error:', err)
        results.failed++
      }
    }
    
    return NextResponse.json({
      success: true,
      data: results
    })
  } catch (error: any) {
    console.error('Import batch error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
