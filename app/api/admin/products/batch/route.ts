import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/chatAuth'
import {
  batchInventory,
  batchPrice,
  batchRename,
  batchSku,
  parseVariants,
  type BatchProduct,
} from '@/lib/batchOps'
import { buildSku, buildUniqueSkus } from '@/lib/sku'

/**
 * POST /api/admin/products/batch
 *
 * 后台批量操作（2026-10-28）：
 *   op = 'inventory'  批量加库存
 *   op = 'price'      批量改价
 *   op = 'rename'     批量改名（颜色 + 随机数字）
 *
 * body:
 *   { ids: string[], op: 'inventory'|'price'|'rename', params: {...} }
 *
 * 只改这三个字段（inventory / price / variants / variantDims / name），
 * 不碰 images / description / sku 等其它数据。
 */

export async function POST(req: NextRequest) {
  // 与其它 admin 接口一致：返回 Response 表示拒绝，否则 null
  const denied = await requireAdminOrDev(req)
  if (denied) return denied

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter(Boolean).slice(0, 500) : []
  const op = String(body?.op || '')
  const params = body?.params || {}

  if (!ids.length) {
    return NextResponse.json({ error: '没有选中商品' }, { status: 400 })
  }
  if (!['inventory', 'price', 'rename', 'sku'].includes(op)) {
    return NextResponse.json({ error: '未知操作: ' + op }, { status: 400 })
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      price: true,
      comparePrice: true,
      inventory: true,
      variants: true,
      variantDims: true,
      sku: true,
      sourceSkuId: true,
    },
  })

  let updated = 0
  const failed: Array<{ id: string; name: string; reason: string }> = []
  const samples: Array<{ id: string; name: string; before: any; after: any }> = []

  for (const p of products) {
    try {
      const base: BatchProduct = {
        id: p.id,
        name: p.name,
        price: p.price,
        comparePrice: p.comparePrice,
        inventory: p.inventory,
        variants: p.variants,
        variantDims: p.variantDims,
        sku: p.sku,
        sourceSkuId: p.sourceSkuId,
      }

      let result: { product: BatchProduct; variantCount: number; changed: boolean }
      if (op === 'inventory') {
        result = batchInventory(base, {
          mode: params.mode === 'set' ? 'set' : 'add',
          value: Number(params.value) || 0,
          scope: params.scope || 'both',
        })
      } else if (op === 'price') {
        result = batchPrice(base, {
          mode: params.mode === 'set' ? 'set' : 'percent',
          value: Number(params.value) || 0,
          scope: params.scope || 'both',
          alsoCompare: !!params.alsoCompare,
        })
      } else if (op === 'rename') {
        result = batchRename(base, {
          digits: Number(params.digits) || 4,
          sep: params.sep === undefined ? ' ' : String(params.sep),
          prefix: params.prefix ? String(params.prefix) : '',
          scope: params.scope || 'variant',
        })
      } else {
        // op === 'sku'：按「FCY+日期+原货号」重新生成商品与变体 SKU
        const sk = batchSku(base, { variants: params.variants !== false }, { buildSku, buildUniqueSkus })
        result = {
          product: {
            ...sk.product,
            variants: params.variants !== false
              ? JSON.stringify(
                  (parseVariants(base.variants) || []).map((v: any, i: number) => ({ ...v, sku: sk.variantSkus[i] || v.sku }))
                )
              : base.variants,
          } as BatchProduct,
          variantCount: sk.variantSkus.length,
          changed: sk.changed,
        }
      }

      if (!result.changed) {
        continue
      }

      const data: Record<string, unknown> = {}
      if (result.product.inventory !== undefined) data.inventory = result.product.inventory
      if (result.product.price !== undefined) data.price = result.product.price
      if (result.product.comparePrice !== undefined) data.comparePrice = result.product.comparePrice
      if (result.product.name !== undefined) data.name = result.product.name
      if (result.product.variants !== undefined) data.variants = result.product.variants
      if ((result.product as any).sku !== undefined) data.sku = (result.product as any).sku
      if (result.product.variantDims !== undefined) data.variantDims = result.product.variantDims

      await prisma.product.update({
        where: { id: p.id },
        data: data as any,
      })

      updated++
      if (samples.length < 5) {
        samples.push({
          id: p.id,
          name: p.name,
          before: { price: p.price, inventory: p.inventory },
          after: { price: result.product.price, inventory: result.product.inventory },
        })
      }
    } catch (e: any) {
      failed.push({
        id: p.id,
        name: p.name,
        reason: e?.message || String(e),
      })
    }
  }

  // 传了但库里没找到的
  const foundIds = new Set(products.map(p => p.id))
  for (const id of ids) {
    if (!foundIds.has(id)) {
      failed.push({ id, name: id, reason: '商品不存在' })
    }
  }

  return NextResponse.json({
    ok: true,
    op,
    total: ids.length,
    updated,
    failedCount: failed.length,
    failed: failed.slice(0, 20),
    samples,
  })
}
