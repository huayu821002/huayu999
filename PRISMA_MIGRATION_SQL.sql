-- Chat system tables (add to existing schema)
-- Run this in Supabase SQL Editor or pgAdmin

CREATE TABLE IF NOT EXISTS "ChatConversation" (
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
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
  "id" TEXT PRIMARY KEY DEFAULT cuid(),
  "conversationId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT,
  "isRead" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
