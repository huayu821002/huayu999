import { NextRequest, NextResponse } from 'next/server'
import { buildSku, randomSkuDigits, pickPublishSku } from '@/lib/sku'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable, parseImagesField, parseJsonField } from '@/lib/supplier'
import { toProductVariants } from '@/lib/variants'
import { normalizeAlibabaImageList } from '@/lib/imageNormalize'
import { downloadImagesToLocal, isLocalImage } from '@/lib/localImages'

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

    // 图集上限 5 张（主图 1 + 图集共 5），主图置首
    // ★ 归一化成原图（剥掉 _sum 等缩略后缀，80x80 → 800x800）
    const parsedImages = normalizeAlibabaImageList(parseImagesField(item.images))
    const images = Array.from(new Set(parsedImages)).slice(0, 5)

    // ★ 把图片下载到本地空间，商品图片地址改用本地路径
    //   （不依赖 1688 CDN —— 对方防盗链 / 可能删图）
    //   下载失败的保留原 CDN 地址，不阻塞上架
    const localImages = await downloadImagesToLocal(images)
    const finalImages = images.map((u, i) => localImages[i] || u)
    // 英文标题优先（采集时已自动翻译），其次原标题
    const name = (body.name || item.titleEn || item.title || '').trim()
    if (!name) {
      return NextResponse.json({ success: false, error: 'Missing product name' }, { status: 400 })
    }

    const slug = await uniqueSlug(
      (body.slug || slugify(name)).slice(0, 80),
      item.sourceId
    )
    // ★ 2026-10-28 SKU 规则：FCY + MMDD + 1688 原货号；没有原货号 → 随机 5 位数
    //   例：FCY0910ABC123 / FCY0910XXXXX
    //   用户手填的 sku 优先（body.sku）
    //   用户手填的 sku 优先；但如果填的是**旧版自动预填的格式**
    //   （sourceSkuId 本身 或 1688-{sourceId}），视为「没填」→ 按新规则生成。
    const sku = await ensureUniqueSku(
      pickPublishSku(body.sku, { sourceSkuId: item.sourceSkuId, sourceId: item.sourceId }),
      item.sourceId
    )

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

    // ── 价格阶梯（用户需求：默认只生成「第一段」，第 2/3 段自己在后台加）
    // 采集到的阶梯价是 **CNY 且形状是 {spec,price,skuId}**（不是前台的 {minQty,maxQty,price}）
    // → 这里统一转成标准形状 + 转成 USD，并且**只取第一段**
    const tiers = body.tieredPricing
      ? null
      : extractTiers(item.priceLadder) || extractTiers(item.raw)
    const firstTierCny = tiers && tiers.length ? numOrNull(tiers[0]?.price) : null
    const firstTierUsd =
      firstTierCny !== null ? Math.round(((firstTierCny * markup) / 7.2) * 100) / 100 : null
    const tieredPricing = body.tieredPricing
      ? JSON.stringify(body.tieredPricing)
      : JSON.stringify({
          tiers: [
            {
              minQty: 1,
              maxQty: null,
              price: firstTierUsd ?? price,
            },
          ],
        })

    // 变体：从采集品带过来（每个变体有自己的价格和图片）
    // 采集变体的价格是 CNY → 沿用商品同样的加价/汇率换算
    const supplierVariants = parseJsonField<any[]>(item.variants) || []
    const variantDims = parseJsonField<any[]>(item.variantDims) || []
    // ★ 变体 SKU = 商品SKU-01/-02...（用户 2026-10-28 18:27 规则）
    //   → 必须等商品 sku 算出来之后再转变体
    const variants = toProductVariants(supplierVariants, variantDims, {
      markup, rate: 7.2, productSku: sku,
    })

    // ★ 变体图也下载到本地（每个变体一张）
    const variantImgIdx = variants.map((v: any, i: number) => (v.image ? i : -1)).filter((i: number) => i >= 0)
    if (variantImgIdx.length) {
      const urls = variantImgIdx.map(i => variants[i].image as string)
      const local = await downloadImagesToLocal(urls)
      variantImgIdx.forEach((vi, k) => {
        if (local[k]) variants[vi] = { ...variants[vi], image: local[k] }
      })
    }

    // 商品价：有变体时取最低变体价（前台显示的起价）
    const variantPrices = variants.map(v => v.price).filter((p): p is number => typeof p === 'number')
    const finalPrice = variantPrices.length ? Math.min(...variantPrices) : price

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        sku,
        // 来源网址：采集品自动带 1688 链接（用户 2026-10-28 需求）
        sourceUrl: body.sourceUrl || item.sourceUrl || null,
        // 1688 原货号 —— 批量重生成 SKU 时要用
        sourceSkuId: item.sourceSkuId || null,
        description,
        shortDesc: body.shortDesc || description.replace(/<[^>]+>/g, '').trim().slice(0, 160) || null,
        price: finalPrice,
        comparePrice: comparePrice ?? undefined,
        costPrice,
        wholesalePrice: numOrNull(body.wholesalePrice) ?? undefined,
        barcode: body.barcode || item.sourceSkuId || undefined,
        dimensions: body.dimensions || undefined,
        sizeChart: body.sizeChart || undefined,
        images: JSON.stringify(finalImages),
        minOrderQty: numOrNull(body.minOrderQty) ?? item.moq ?? 1,
        inventory: numOrNull(body.inventory) ?? 0,
        lowStockAlert: numOrNull(body.lowStockAlert) ?? 10,
        categoryId: body.categoryId || null,
        categoryIds: body.categoryIds ? JSON.stringify(body.categoryIds) : null,
        tieredPricing,
        variants: variants.length ? JSON.stringify(variants) : null,
        variantDims: variantDims.length ? JSON.stringify(variantDims) : null,
        // ★ tags 必须是 JSON 数组字符串 —— 前台 `JSON.parse(product.tags)`，
        //   之前这里存的是逗号串 → 前台直接抛异常 → "Application error"
        tags: (() => {
          if (body.tags) {
            const raw = String(body.tags).trim()
            if (raw.startsWith('[')) return raw
            return JSON.stringify(raw.split(',').map(s => s.trim()).filter(Boolean))
          }
          return JSON.stringify(['1688', '采集品', item.sourceId, item.firstSku].filter(Boolean))
        })(),
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

/**
 * 保证 SKU 唯一（Product.sku 是 @unique）。
 * 撞了就追加随机后缀重试。
 */
async function ensureUniqueSku(base: string, sourceId: string): Promise<string> {
  const clean = String(base || '').trim() || `FCY${randomSkuDigits(5)}`
  const exists = async (s: string) => {
    const hit = await prisma.product.findUnique({ where: { sku: s }, select: { id: true } })
    return !!hit
  }
  if (!(await exists(clean))) return clean
  for (let i = 0; i < 20; i++) {
    const cand = `${clean.slice(0, 70)}-${randomSkuDigits(4)}`
    if (!(await exists(cand))) return cand
  }
  return `${clean.slice(0, 60)}-${Date.now().toString(36)}`
}
