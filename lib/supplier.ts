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
  const sourceId = String(input.sourceId)

  // 仅包含本次实际提供的字段，避免二次采集覆盖掉已有数据
  const provided: any = {
    source,
    sourceId,
    sourceUrl: input.sourceUrl,
    title: input.title?.slice(0, 500),
    titleCn: input.titleCn,
    description: input.description,
    images: input.images !== undefined ? toJson(input.images) : undefined,
    videoUrl: input.videoUrl,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    moq: input.moq,
    unit: input.unit,
    skuText: input.skuText !== undefined ? toJson(input.skuText) : undefined,
    attributes: input.attributes !== undefined ? toJson(input.attributes) : undefined,
    supplierName: input.supplierName,
    supplierUrl: input.supplierUrl,
    shippingText: input.shippingText,
    raw: input.raw !== undefined ? toJson(input.raw) : undefined,
  }

  const updateData: any = {}
  for (const [k, v] of Object.entries(provided)) {
    if (v !== undefined) updateData[k] = v
  }
  updateData.updatedAt = new Date()

  const createData: any = { ...provided }
  for (const k of Object.keys(createData)) {
    if (createData[k] === undefined) createData[k] = null
  }
  createData.title = createData.title || '(untitled)'
  createData.status = 'pending'

  return prisma.supplierProduct.upsert({
    where: { source_sourceId: { source, sourceId } },
    create: createData,
    update: updateData,
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
