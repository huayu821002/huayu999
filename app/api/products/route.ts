import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withProxiedImages } from '@/lib/imgProxy'
import { unproxyImagesField } from '@/lib/imgProxy'
import { requireAdmin, isAuthError } from '@/lib/apiAuth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const trending = searchParams.get('trending')
    const featured = searchParams.get('featured')

    // Base query - only filter by active status at DB level
    const where: Record<string, unknown> = { isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (trending === 'true') {
      where.isTrending = true
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    // Fetch products without include
    let products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Fetch all categories for mapping
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]))

    // If category filter is set, filter products by categoryIds
    if (category) {
      const targetCat = categories.find(c => c.slug === category)
      if (targetCat) {
        const catIds = [targetCat.id, ...categories.filter(c => c.parentId === targetCat.id).map(c => c.id)]
        products = products.filter(p => {
          if (!p.categoryIds) return false
          const productCatIds = JSON.parse(p.categoryIds)
          return catIds.some(id => productCatIds.includes(id))
        })
      }
    }

    // Merge categories data
    const productsWithCategory = products.map((p: any) => {
      const catIds = p.categoryIds ? JSON.parse(p.categoryIds) : []
      const cats = catIds.map((id: string) => categoryMap.get(id)).filter(Boolean)
      // ★ sourceUrl 是**后台专用**字段（采集源链接），前台 API 不返回
      const { sourceUrl: _omit, ...pub } = p
      return withProxiedImages({ ...pub, categories: cats })
    })

    return NextResponse.json({ success: true, data: productsWithCategory })
  } catch (error: any) {
    console.error('Products API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // ★ 2026-10-30 安全修复：这个接口原来**完全公开**，
    // 未登录的任何人 POST 一个 JSON 就能往生产库塞商品（垃圾数据 / 钓鱼链接 / 压库）。
    // 现在写操作一律要求管理员 JWT。后台建商品请走 /api/admin/products。
    const admin = await requireAdmin(request)
    if (isAuthError(admin)) return admin

    const body = await request.json()
    const {
      name, slug, description, shortDesc, price, comparePrice, costPrice,
      wholesalePrice, vipPrice, minOrderQty, weight, dimensions, images,
      modelImage, sizeChart, sku, barcode, inventory, lowStockAlert,
      categoryIds, tags, isActive, isFeatured, isTrending, compliance
    } = body

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        shortDesc,
        price: parseFloat(price),
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        vipPrice: vipPrice ? parseFloat(vipPrice) : null,
        minOrderQty: parseInt(minOrderQty) || 1,
        weight: weight ? parseFloat(weight) : null,
        dimensions,
        // 写入前还原代理 URL（DB 只存原始 CDN URL）
        images: (() => {
          const un = unproxyImagesField(images)
          return typeof un === 'string' ? un : JSON.stringify(un)
        })(),
        modelImage,
        sizeChart,
        sku,
        barcode,
        inventory: parseInt(inventory) || 0,
        lowStockAlert: parseInt(lowStockAlert) || 10,
        categoryIds: categoryIds ? JSON.stringify(categoryIds) : null,
        tags,
        isActive: isActive !== false,
        isFeatured: isFeatured === true,
        isTrending: isTrending === true,
        compliance,
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 })
  }
}
