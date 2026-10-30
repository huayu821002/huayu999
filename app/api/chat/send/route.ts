import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { appendFileSync } from 'fs'
import { signVisitorToken, verifyVisitorToken, getVisitorToken } from '@/lib/chatAuth'
import { checkRateLimit, getClientKey } from '@/lib/rateLimit'

// MiniMax native API
const MINIMAX_API = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''

const SYSTEM_PROMPT = `You are Fiestaflare, a friendly B2B wholesale customer service assistant. Your website is fiestaflare.com.

About Fiestaflare:
- Sells party supplies, home decor, hair accessories, jewelry, and pet supplies
- Ships from China (Yiwu) to USA, Australia, New Zealand, Singapore, Malaysia, Indonesia, Japan, South Korea
- Minimum order: $50 mixed order
- Shipping: 10-20 business days
- Free shipping thresholds vary by country
- Accepts returns within 30 days (items must be unused, in original packaging)
- Has warehouse in China, ships worldwide
- Prices shown in USD by default, also supports AUD/KRW/JPY/IDR/MYR/SGD

Guidelines:
- Be helpful, friendly, and concise
- Answer questions about: orders, shipping, products, returns, payment methods
- If you don't know something, say you'll connect the customer to a human agent
- Never make up order numbers, tracking numbers, or specific product availability
- Respond in the same language as the customer (English recommended)
- If customer wants to contact a human, ask for their email to follow up`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  let convId: string | null = null
  let userMessage = ''
  try {
    const { message, conversationId, visitorEmail, visitorName } = await request.json()
    convId = conversationId
    userMessage = message || ''

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // ★ 2026-10-30 安全修复：访客聊天保持公开可用（不需登录），
    //   但必须限流 —— 否则任意人可无限刷，直接消耗 MiniMax 额度。
    //   两层：IP 维度（防换会话/刷量）+ 会话维度（防单个会话刷屏）。
    const ipLimit = checkRateLimit('chat:' + getClientKey(request), {
      maxAttempts: 20,
      windowMs: 60 * 1000,
    })
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many messages. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    if (conversationId) {
      const convLimit = checkRateLimit('chat-conv:' + conversationId, {
        maxAttempts: 10,
        windowMs: 60 * 1000,
      })
      if (!convLimit.allowed) {
        return NextResponse.json(
          { success: false, error: 'Too many messages. Please slow down.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(convLimit.retryAfterMs / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }
    }

    // Find or create conversation.
    // A conversation may only be continued by whoever holds its visitor token.
    let conversation
    if (conversationId) {
      const token = getVisitorToken(request)
      const ownsConversation = await verifyVisitorToken(token, conversationId)
      if (ownsConversation) {
        conversation = await prisma.chatConversation.findUnique({
          where: { id: conversationId },
          include: { messages: { orderBy: { createdAt: 'asc' } } }
        })
      } else {
        console.warn(`[chat] rejected continuation of conversation ${conversationId}: invalid visitor token`)
      }
    }

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.chatConversation.create({
        data: {
          visitorEmail: visitorEmail || null,
          visitorName: visitorName || null,
          lastMessage: message.substring(0, 100),
          lastMessageAt: new Date(),
          messages: {
            create: {
              content: message,
              senderType: 'USER',
            }
          }
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      })
    } else {
      // Add user message
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          content: message,
          senderType: 'USER',
        }
      })

      // Update conversation
      await prisma.chatConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: message.substring(0, 100),
          lastMessageAt: new Date(),
        }
      })
    }

    // Build conversation history for AI context
    const historyMessages: ChatMessage[] = conversation.messages.slice(-10).map((m: any) => ({
      role: m.senderType === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }))

    // If human has replied, disable AI and just save the message
    // Visitor token proving ownership of this conversation (sent back to the browser)
    const visitorToken = await signVisitorToken(conversation.id)

    if (conversation.aiDisabled) {
      return NextResponse.json({
        success: true,
        data: {
          conversationId: conversation.id,
          visitorToken,
          reply: '',
          visitorEmail: conversation.visitorEmail,
          visitorName: conversation.visitorName,
          aiDisabled: true,
        }
      })
    }

    // Call MiniMax native API
    let botReply = ''
    const logFile = '/tmp/chat_send_log.txt'
    const logEntry = (msg: string) => {
      const ts = new Date().toISOString()
      const line = `[${ts}] ${msg}\n`
      appendFileSync(logFile, line)
      console.log(msg)
    }
    
    try {
      if (MINIMAX_API_KEY) {
        const requestBody = {
          model: 'MiniMax-M2.7',
          tokens_to_generate: 300,
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...historyMessages,
            { role: 'user', content: userMessage },
          ],
        }
        logEntry(`MiniMax request: ${JSON.stringify(requestBody).substring(0, 500)}`)

        let data: any = null
        let status = 0

        // Retry up to 2 times: MiniMax commonly answers 529 (overloaded) under load
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const response = await fetch(MINIMAX_API, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MINIMAX_API_KEY}`,
              },
              body: JSON.stringify(requestBody),
            })

            status = response.status
            data = await response.json()
            logEntry(`MiniMax raw response status: ${status} (attempt ${attempt})`)
            logEntry(`MiniMax response: ${JSON.stringify(data).substring(0, 500)}`)

            botReply = data.choices?.[0]?.message?.content?.trim()
              || data.choices?.[0]?.text?.trim()
              || data.text?.trim()
              || ''

            if (botReply) break

            // Retryable errors (overload / rate limit / server error)
            if (status === 529 || status === 429 || status >= 500) {
              if (attempt < 3) {
                logEntry(`MiniMax retryable status ${status}, retrying in ${attempt * 2}s...`)
                await new Promise(r => setTimeout(r, attempt * 2000))
                continue
              }
            }
            break
          } catch (err: any) {
            logEntry(`MiniMax API error (attempt ${attempt}): ${err.message}`)
            if (attempt < 3) {
              await new Promise(r => setTimeout(r, attempt * 2000))
              continue
            }
            throw err
          }
        }

        if (!botReply) {
          // Never leave the customer hanging: fall back to canned answers
          logEntry(`MiniMax produced no reply (status ${status}) - using keyword fallback`)
          botReply = getSimpleResponse(userMessage)
        }
      } else {
        logEntry('No MINIMAX_API_KEY - using fallback')
        botReply = getSimpleResponse(userMessage)
      }
    } catch (err: any) {
      logEntry(`MiniMax API error: ${err.message}`)
      botReply = getSimpleResponse(message)
    }

    if (!botReply) {
      logEntry(`Final botReply is empty, using fallback. Conversation ID: ${conversation?.id}`)
      botReply = getSimpleResponse(message)
    }

    // Save bot reply
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        content: botReply,
        senderType: 'BOT',
      }
    })

    // Update conversation last message
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: botReply.substring(0, 100),
        lastMessageAt: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      debug_version: 'with-logging',
      data: {
        conversationId: conversation.id,
        visitorToken,
        reply: botReply,
        visitorEmail: conversation.visitorEmail,
        visitorName: conversation.visitorName,
      }
    })
  } catch (error: any) {
    console.error('Chat send error:', error)
    // Even if DB fails, return a reply so the frontend doesn't hang
    return NextResponse.json({
      success: true,
      data: {
        conversationId: convId || 'temp-' + Date.now(),
        reply: getSimpleResponse(userMessage || 'Hi'),
      }
    })
  }
}

function getSimpleResponse(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('shipping') || lower.includes('delivery') || lower.includes('delivery')) {
    return "We ship from China to worldwide! Standard shipping takes 10-20 business days. Express options are also available. You can see exact shipping costs at checkout based on your location and order weight."
  }
  if (lower.includes('return') || lower.includes('refund')) {
    return "We offer 30-day returns for unused items in original packaging. Please contact us with your order number and we'll assist you with the return process."
  }
  if (lower.includes('price') || lower.includes('cost') || lower.includes('wholesale')) {
    return "Our minimum order is $50 USD for mixed items. We offer wholesale pricing for larger orders. Feel free to browse our product catalog and add items to your cart to see the total!"
  }
  if (lower.includes('payment') || lower.includes('pay')) {
    return "We accept PayPal and major credit cards. All payments are processed securely through our checkout."
  }
  if (lower.includes('contact') || lower.includes('human') || lower.includes('person')) {
    return "I'd be happy to help! For specific order issues, please email us with your order number. You can also leave your email here and we'll get back to you within 24 hours."
  }
  return "Thanks for your message! I can help with questions about shipping, returns, products, and orders. For detailed assistance, please email us at support@fiestaflare.com with your order number."
}
