import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { requireAdminOrDev } from '@/lib/chatAuth'

export async function GET(request: NextRequest) {
  // Diagnostic endpoint: hidden from public in production
  const denied = await requireAdminOrDev(request)
  if (denied) return denied

  const logFile = '/tmp/chat_send_log.txt'
  try {
    const content = readFileSync(logFile, 'utf-8')
    return NextResponse.json({ success: true, log: content })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message })
  }
}
