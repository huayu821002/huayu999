import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.MINIMAX_API_KEY || ''
  const hasKey = apiKey.length > 0
  const maskedKey = hasKey ? apiKey.substring(0, 8) + '...' : 'NOT SET'

  // Test MiniMax API directly
  let aiResult = 'not called'
  if (hasKey) {
    try {
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          tokens_to_generate: 30,
          messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        }),
      })
      const data = await response.json()
      if (data.choices?.[0]?.message?.content) {
        aiResult = 'SUCCESS: ' + data.choices[0].message.content
      } else {
        aiResult = 'FAILED: ' + JSON.stringify(data).substring(0, 200)
      }
    } catch (err: any) {
      aiResult = 'ERROR: ' + err.message
    }
  } else {
    aiResult = 'NO API KEY'
  }

  return NextResponse.json({
    apiKeyPresent: hasKey,
    maskedKey,
    aiResult,
  })
}
