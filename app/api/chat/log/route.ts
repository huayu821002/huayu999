import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'

export async function GET() {
  const logFile = '/tmp/chat_send_log.txt'
  try {
    const content = readFileSync(logFile, 'utf-8')
    return NextResponse.json({ success: true, log: content })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message })
  }
}
