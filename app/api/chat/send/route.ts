import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Find or create conversation
    let conversation
    if (conversationId) {
      conversation = await prisma.chatConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      })
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

    // Call SiliconFlow API
    let botReply = ''
    try {
      if (MINIMAX_API_KEY) {
        const response = await fetch(MINIMAX_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'MiniMax-M2.7',
            tokens_to_generate: 300,
            temperature: 0.7,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...historyMessages,
              { role: 'user', content: userMessage },
            ],
          }),
        })

        const data = await response.json()
        console.log('SiliconFlow response:', JSON.stringify(data).substring(0, 300))
        if (data.choices?.[0]?.message?.content) {
          botReply = data.choices[0].message.content.trim()
        } else {
          console.log('SiliconFlow no reply, error:', data)
        }
      } else {
        // Fallback: keyword-based if no API key
        botReply = getSimpleResponse(userMessage)
      }
    } catch (err) {
      console.error('MiniMax API error:', err)
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
      data: {
        conversationId: conversation.id,
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
