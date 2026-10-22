import { prisma } from '@/lib/prisma'

/**
 * 采集品（1688 等供应商商品）的数据模型与工具。
 *
 * 说明：表结构通过 ensureSupplierProductTable() 自愈式创建，
 * 避免必须先在 Supabase 控制台手工执行 DDL。
 */

export type SupplierStatus = 'pending' | 'approved' | 'published' | 'rejected'

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "SupplierProduct" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT '1688',
  "sourceId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "title" TEXT NOT NULL,
  "titleCn" TEXT,
  "description" TEXT,
  "images" TEXT,
  "videoUrl" TEXT,
  "priceMin" DOUBLE PRECISION,
  "priceMax" DOUBLE PRECISION,
  "moq" INTEGER,
  "unit" TEXT,
  "skuText" TEXT,
  "attributes" TEXT,
  "supplierName" TEXT,
  "supplierUrl" TEXT,
  "shippingText" TEXT,
  "raw" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "productId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierProduct_source_sourceId_key" ON "SupplierProduct"("source", "sourceId");
CREATE INDEX IF NOT EXISTS "SupplierProduct_status_createdAt_idx" ON "SupplierProduct"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SupplierProduct_source_sourceId_idx" ON "SupplierProduct"("source", "sourceId");
`

let tableReady = false

/**
 * 确保采集品表存在。
 * 首次访问时若表缺失（P2021），自动执行 CREATE TABLE IF NOT EXISTS。
 */
export async function ensureSupplierProductTable(): Promise<void> {
  if (tableReady) return
  try {
    await prisma.supplierProduct.count()
    tableReady = true
    return
  } catch (err: any) {
    const code = err?.code || err?.meta?.code
    if (code !== 'P2021') throw err
  }

  const statements = CREATE_TABLE_SQL
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql)
  }
  tableReady = true
}

export interface SupplierProductInput {
  source?: string
  sourceId: string
  sourceUrl?: string
  title: string
  titleCn?: string
  description?: string
  images?: string[]
  videoUrl?: string
  priceMin?: number | null
  priceMax?: number | null
  moq?: number | null
  unit?: string
  skuText?: string
  attributes?: Record<string, any>
  supplierName?: string
  supplierUrl?: string
  shippingText?: string
  raw?: any
}

function toJson(v: any): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

/** 写入或更新一条采集品（按 source + sourceId 去重） */
export async function upsertSupplierProduct(input: SupplierProductInput) {
  await ensureSupplierProductTable()

  const source = input.source || '1688'
  const data = {
    source,
    sourceId: String(input.sourceId),
    sourceUrl: input.sourceUrl ?? null,
    title: input.title?.slice(0, 500) || '(untitled)',
    titleCn: input.titleCn ?? null,
    description: input.description ?? null,
    images: toJson(input.images ?? null),
    videoUrl: input.videoUrl ?? null,
    priceMin: input.priceMin ?? null,
    priceMax: input.priceMax ?? null,
    moq: input.moq ?? null,
    unit: input.unit ?? null,
    skuText: toJson(input.skuText ?? null),
    attributes: toJson(input.attributes ?? null),
    supplierName: input.supplierName ?? null,
    supplierUrl: input.supplierUrl ?? null,
    shippingText: input.shippingText ?? null,
    raw: toJson(input.raw ?? null),
    updatedAt: new Date(),
  }

  return prisma.supplierProduct.upsert({
    where: { source_sourceId: { source, sourceId: data.sourceId } },
    create: { ...data, status: 'pending' },
    update: data,
  })
}

export function parseImagesField(images: string | null): string[] {
  if (!images) return []
  try {
    const parsed = JSON.parse(images)
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    return images.split(',').map(s => s.trim()).filter(Boolean)
  }
}

export function parseJsonField<T = any>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}
