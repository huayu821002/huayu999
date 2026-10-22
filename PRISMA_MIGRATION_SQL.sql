-- Chat system tables (add to existing schema)
-- Run this in Supabase SQL Editor or pgAdmin

CREATE TABLE IF NOT EXISTS "ChatConversation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "visitorEmail" TEXT,
  "visitorName" TEXT,
  "status" TEXT DEFAULT 'OPEN',
  "lastMessage" TEXT,
  "lastMessageAt" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ChatConversation_status_lastMessageAt_idx" ON "ChatConversation"("status", "lastMessageAt");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT,
  "isRead" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- ============================================================
-- 采集品表（1688 等供应商商品采集） 2026-10-22
-- 运行时也会自愈式创建（lib/supplier.ts ensureSupplierProductTable）
-- ============================================================
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
