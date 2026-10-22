import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const KEY = process.env.DEBUG_1688_KEY || '***REMOVED_1688_DEBUG_KEY***'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const limit = Math.min(Number(url.searchParams.get('limit') || 5), 20)
  const rows = await prisma.supplierProduct.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({
    count: rows.length,
    rows: rows.map((r: any) => ({
      id: r.id,
      sourceId: r.sourceId,
      title: r.title,
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      moq: r.moq,
      imagesCount: (() => { try { return JSON.parse(r.images || '[]').length } catch { return -1 } })(),
      images: (() => { try { return JSON.parse(r.images || '[]') } catch { return r.images } })(),
      status: r.status,
      raw: r.raw,
    })),
  })
}
