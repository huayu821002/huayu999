import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierProductTable, parseImagesField, parseJsonField } from '@/lib/supplier'

// GET /api/admin/supplier-products/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSupplierProductTable()
    const item = await prisma.supplierProduct.findUnique({ where: { id: params.id } })
    if (!item) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        ...item,
        images: parseImagesField(item.images),
        attributes: parseJsonField(item.attributes),
        skuText: parseJsonField(item.skuText),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}

// PATCH /api/admin/supplier-products/[id]  审核 / 编辑
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSupplierProductTable()
    const body = await request.json()

    const allowed: any = {
      title: body.title,
      titleCn: body.titleCn,
      description: body.description,
      priceMin: body.priceMin,
      priceMax: body.priceMax,
      moq: body.moq,
      unit: body.unit,
      supplierName: body.supplierName,
      shippingText: body.shippingText,
      status: body.status,
      note: body.note,
      images: body.images ? JSON.stringify(body.images) : undefined,
    }

    const data: any = {}
    for (const [k, v] of Object.entries(allowed)) {
      if (v !== undefined) data[k] = v
    }
    data.updatedAt = new Date()

    const item = await prisma.supplierProduct.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: { ...item, images: parseImagesField(item.images) },
    })
  } catch (error: any) {
    console.error('supplier-product update error:', error)
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}

// DELETE /api/admin/supplier-products/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSupplierProductTable()
    await prisma.supplierProduct.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
