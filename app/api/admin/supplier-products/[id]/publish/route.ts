import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable, parseImagesField, parseJsonField } from '@/lib/supplier'

/**
 * POST /api/admin/supplier-products/[id]/publish
 * 把一条采集品生成成正式商品（默认草稿，可选立即上架）。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSupplierProductTable()

    const body = await request.json()
    const item = await prisma.supplierProduct.findUnique({ where: { id: params.id } })
    if (!item) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const images = parseImagesField(item.images)
    // 英文标题优先（采集时已自动翻译），其次原标题
    const name = (body.name || item.titleEn || item.title || '').trim()
    if (!name) {
      return NextResponse.json({ success: false, error: 'Missing product name' }, { status: 400 })
    }

    const slug = await uniqueSlug(
      (body.slug || slugify(name)).slice(0, 80),
      item.sourceId
    )
    // 货号优先用采集到的供应商货号
    const sku = body.sku || item.sourceSkuId || `1688-${item.sourceId}`

    // 采集价（CNY）→ 售价（USD）：默认加价 3 倍、汇率 7.2（与后台编辑器一致）
    const cny = numOrNull(body.cnyPrice) ?? numOrNull(item.wholesalePrice) ?? numOrNull(item.priceMin)
    const markup = numOrNull(body.markup) ?? 3
    const defaultUsd = cny !== null ? (cny * markup) / 7.2 : null
    const price = numOrNull(body.price) ?? defaultUsd ?? 0
    const comparePrice = numOrNull(body.comparePrice)
    const costPrice = numOrNull(body.costPrice) ?? (cny !== null ? cny / 7.2 : undefined)

    const description =
      body.description ||
      item.descriptionEn ||
      item.description ||
      ''

    // 价格阶梯：优先用采集到的阶梯价（priceLadder 新字段），否则回退到 raw 里的 priceTiers
    const tiers = body.tieredPricing
      ? null
      : extractTiers(item.priceLadder) || extractTiers(item.raw)
    const tieredPricing = body.tieredPricing
      ? JSON.stringify(body.tieredPricing)
      : tiers
        ? JSON.stringify({ tiers })
        : null

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        sku,
        description,
        shortDesc: body.shortDesc || description.replace(/<[^>]+>/g, '').trim().slice(0, 160) || null,
        price,
        comparePrice: comparePrice ?? undefined,
        costPrice,
        wholesalePrice: numOrNull(body.wholesalePrice) ?? undefined,
        barcode: body.barcode || item.sourceSkuId || undefined,
        dimensions: body.dimensions || undefined,
        sizeChart: body.sizeChart || undefined,
        images: JSON.stringify(images),
        minOrderQty: numOrNull(body.minOrderQty) ?? item.moq ?? 1,
        inventory: numOrNull(body.inventory) ?? 0,
        lowStockAlert: numOrNull(body.lowStockAlert) ?? 10,
        categoryId: body.categoryId || null,
        categoryIds: body.categoryIds ? JSON.stringify(body.categoryIds) : null,
        tieredPricing,
        tags: body.tags || ['1688', '采集品', item.sourceId, item.firstSku].filter(Boolean).join(','),
        compliance: body.compliance || '待补录：欧盟责任方/制造商信息（GPSR）',
        weight: numOrNull(body.weight) ?? undefined,
        isActive: body.isActive === true,
        isFeatured: body.isFeatured === true,
        isTrending: body.isTrending === true,
        isNew: body.isNew !== false,
        isWholesale: body.isWholesale === true,
      },
    })

    const updated = await prisma.supplierProduct.update({
      where: { id: params.id },
      data: {
        status: 'published',
        productId: product.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      product: { id: product.id, name: product.name, slug: product.slug, isActive: product.isActive },
      supplierProduct: { id: updated.id, status: updated.status },
    })
  } catch (error: any) {
    console.error('publish supplier product error:', error)
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}

function numOrNull(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  // 纯中文标题退化为拼音不可得时用 p- 前缀 + offerId，避免 URL 编码问题
  return ascii || 'item'
}

async function uniqueSlug(base: string, sourceId: string): Promise<string> {
  const candidate = `${base}-${sourceId}`
  const exists = await prisma.product.findUnique({ where: { slug: candidate } })
  if (!exists) return candidate
  const alt = `${candidate}-${Date.now().toString(36).slice(-4)}`
  return alt
}

/** 从采集原始数据里抽取阶梯价（兼容 priceLadder 新字段与 raw 里的 priceTiers） */
function extractTiers(raw: string | null): any[] | null {
  if (!raw) return null
  const parsed = parseJsonField<any>(raw)
  if (!parsed) return null
  if (Array.isArray(parsed)) return parsed.length ? parsed : null
  const tiers = parsed?.priceTiers || parsed?.tiers || parsed?.skuPrices
  if (Array.isArray(tiers) && tiers.length > 0) return tiers
  return null
}
