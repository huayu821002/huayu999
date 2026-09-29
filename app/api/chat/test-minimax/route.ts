import { NextRequest, NextResponse } from 'next/server'

const MINIMAX_API = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''

export async function GET(request: NextRequest) {
  const hasKey = !!MINIMAX_API_KEY
  let apiResult = 'NO_KEY'
  let statusCode = 0

  if (hasKey) {
    try {
      const resp = await fetch(MINIMAX_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          tokens_to_generate: 50,
          temperature: 0.7,
          messages: [
            { role: 'system', content: 'Reply with only HI' },
            { role: 'user', content: 'hello' },
          ],
        }),
      })
      statusCode = resp.status
      const data = await resp.json()
      apiResult = JSON.stringify(data).substring(0, 500)
    } catch (err: any) {
      apiResult = 'ERROR: ' + err.message
    }
  }

  return NextResponse.json({
    hasKey,
    maskedKey: hasKey ? MINIMAX_API_KEY.substring(0, 10) + '...' : 'MISSING',
    statusCode,
    apiResult,
  })
}
