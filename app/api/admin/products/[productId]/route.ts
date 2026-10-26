import { normalizeAlibabaImagesField } from '@/lib/imageNormalize'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withProxiedImages } from '@/lib/imgProxy'
import { unproxyImagesField } from '@/lib/imgProxy'

export async function GET(request: Request, { params }: { params: { productId: string } }) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: { category: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { productId: string } }) {
  try {
    const body = await request.json()
    const {
      name, slug, description, shortDesc,
      price, comparePrice, costPrice, wholesalePrice, vipPrice,
      weight, images, sku, barcode, inventory,
      categoryIds, isActive, isFeatured, isTrending,
      minOrderQty, lowStockAlert, tieredPricing
    } = body

    const product = await prisma.product.update({
      where: { id: params.productId },
      data: {
        name, slug, description,
        shortDesc: shortDesc || null,
        price: parseFloat(price) || 0,
        comparePrice: comparePrice ? parseFloat(comparePrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        vipPrice: vipPrice ? parseFloat(vipPrice) : null,
        weight: weight ? parseFloat(weight) : null,
        // 写入前还原代理 URL（DB 只存原始 CDN URL）
        images: (() => {
          const un = unproxyImagesField(images)
          // ★ 归一化成原图（剥掉 _sum 等缩略后缀，80x80 → 800x800）
          const norm = normalizeAlibabaImagesField(Array.isArray(un) ? un : String(un ?? ''))
          return norm ?? ''
        })(),
        sku, barcode,
        inventory: parseInt(inventory) || 0,
        categoryIds: categoryIds ? JSON.stringify(categoryIds) : null,
        isActive,
        isFeatured,
        isTrending,
        minOrderQty: parseInt(minOrderQty) || 1,
        lowStockAlert: parseInt(lowStockAlert) || 10,
        // 阶梯价（JSON 字符串）：前端传 null / '' 表示「只有第一段」→ 存 null
        tieredPricing: (() => {
          if (tieredPricing === null || tieredPricing === undefined || tieredPricing === '') return null
          const s = String(tieredPricing)
          try {
            const parsed = JSON.parse(s)
            // 只保留 {tiers:[...]} 结构，tiers 空数组等同于没有阶梯
            if (parsed && Array.isArray(parsed.tiers) && parsed.tiers.length) return JSON.stringify({ tiers: parsed.tiers })
            return null
          } catch { return null }
        })(),
      },
    })
    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { productId: string } }) {
  try {
    await prisma.product.delete({ where: { id: params.productId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 })
  }
}
