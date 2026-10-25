import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'

/**
 * /api/admin/products/[productId]/variants
 *
 * GET    列出该商品的变体
 * POST   新增一个变体
 * PUT    批量替换变体（发布流程用）
 * DELETE ?id=xxx 删除一个变体（传 index 亦可）
 *
 * 变体存在 Product.variants（JSON 数组），每项：
 *   { id, name, value, sku, price, inventory, image }
 * 维度定义在 Product.variantDims：
 *   [{ name, kind: 'color'|'size'|'custom', values: [] }]
 */

type Variant = {
  id?: string
  name?: string
  value?: string
  sku?: string | null
  price?: number | string | null
  inventory?: number | string | null
  image?: string | null
  /** 维度明细（颜色/尺码…）—— 必须保留，否则前台多维度选择器会退化成单行 */
  specs?: Array<{ name?: string; value?: string }>
}

function parseVariants(raw: string | null | undefined): Variant[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** 规范化一个变体项：补 id、裁字段、限数值范围 */
function normalizeVariant(v: Variant, index: number): Variant {
  const name = String(v.name || '').trim().slice(0, 40)
  const value = String(v.value || '').trim().slice(0, 80)
  const rawPrice = v.price
  const price =
    rawPrice === null || rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice)
  const rawInv = v.inventory
  const inv =
    rawInv === null || rawInv === undefined || rawInv === '' ? null : Number(rawInv)
  // specs 一定要保留：前台靠它把「颜色 / 尺码」拆成多行选择器
  const specs = Array.isArray(v.specs)
    ? v.specs
        .filter((s) => s && (s.name || s.value))
        .map((s) => ({
          name: String(s.name || '').trim().slice(0, 40),
          value: String(s.value || '').trim().slice(0, 80),
        }))
        .filter((s) => s.name && s.value)
        .slice(0, 8)
    : []
  return {
    id: String(v.id || `v-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`),
    name,
    value,
    sku: v.sku ? String(v.sku).trim().slice(0, 80) : null,
    price: price !== null && Number.isFinite(price) && price > 0 ? price : null,
    inventory: inv !== null && Number.isFinite(inv) && inv >= 0 ? Math.floor(inv) : null,
    image: v.image ? String(v.image).slice(0, 500) : null,
    specs,
  }
}

export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, variants: true, variantDims: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    return NextResponse.json({
      success: true,
      data: parseVariants(product.variants),
      dims: (() => {
        try {
          const d = product.variantDims ? JSON.parse(product.variantDims) : []
          return Array.isArray(d) ? d : []
        } catch {
          return []
        }
      })(),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch variants' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { productId: string } }) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, variants: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })

    const list = parseVariants(product.variants)
    list.push(normalizeVariant(body, list.length))
    await prisma.product.update({
      where: { id: params.productId },
      data: { variants: JSON.stringify(list) },
    })
    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to add variant' }, { status: 500 })
  }
}

/** 批量替换（发布流程 / 外部同步用） */
export async function PUT(request: NextRequest, { params }: { params: { productId: string } }) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const incoming: Variant[] = Array.isArray(body?.variants) ? body.variants : []
    const list = incoming.map((v, i) => normalizeVariant(v, i))
    const dims = Array.isArray(body?.variantDims) ? body.variantDims : null
    await prisma.product.update({
      where: { id: params.productId },
      data: {
        variants: JSON.stringify(list),
        ...(dims ? { variantDims: JSON.stringify(dims) } : {}),
      },
    })
    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to replace variants' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { productId: string } }) {
  const denied = await requireAdminOrDev(request)
  if (denied) return denied
  try {
    const id = request.nextUrl.searchParams.get('id')
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, variants: true },
    })
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })

    const list = parseVariants(product.variants)
    const next = id ? list.filter(v => v.id !== id) : list.slice(0, -1)
    await prisma.product.update({
      where: { id: params.productId },
      data: { variants: JSON.stringify(next) },
    })
    return NextResponse.json({ success: true, data: next })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete variant' }, { status: 500 })
  }
}
