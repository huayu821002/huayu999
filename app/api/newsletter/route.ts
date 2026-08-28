import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 })
    }

    // Check if already subscribed
    const existing = await prisma.subscriber.findUnique({
      where: { email },
    })

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json({ success: true, message: 'Already subscribed' })
      }
      // Reactivate inactive subscription
      await prisma.subscriber.update({
        where: { email },
        data: { isActive: true },
      })
      return NextResponse.json({ success: true, message: 'Subscription reactivated' })
    }

    // Create new subscription
    await prisma.subscriber.create({
      data: { email },
    })

    return NextResponse.json({ success: true, message: 'Subscribed successfully' })
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 500 })
  }
}
