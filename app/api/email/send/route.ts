import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, interpolateTemplate, getEmailTemplate } from '@/lib/email'

// POST /api/email/send — Send transactional email
// Body: { templateKey: string, to: { email, name? }, variables: Record<string, string> }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateKey, to, variables } = body

    if (!templateKey || !to?.email) {
      return NextResponse.json(
        { success: false, error: 'templateKey and to.email are required' },
        { status: 400 }
      )
    }

    // Get template from database
    const template = await getEmailTemplate(prisma, templateKey)

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    if (!template.enabled) {
      return NextResponse.json(
        { success: false, error: 'Template is disabled' },
        { status: 400 }
      )
    }

    // Interpolate variables into subject and body
    const storeName = process.env.NEXT_PUBLIC_APP_NAME || 'Fiestaflare'
    const defaultVars = {
      store_name: storeName,
      store_url: process.env.NEXT_PUBLIC_APP_URL || 'https://fiestaflare.com',
      ...variables,
    }

    const subject = interpolateTemplate(template.subject, defaultVars)
    const htmlContent = interpolateTemplate(template.body, defaultVars)

    // Get sender from settings or use defaults
    const senderSetting = await prisma.siteSetting.findUnique({
      where: { key: 'email_sender_settings' },
    })

    let sender = { name: storeName, email: 'noreply@fiestaflare.com' }
    if (senderSetting?.value) {
      try {
        const parsed = JSON.parse(senderSetting.value)
        sender = { name: parsed.name || storeName, email: parsed.email || 'noreply@fiestaflare.com' }
      } catch {}
    }

    // Send via Brevo
    const result = await sendEmail({
      to: [{ email: to.email, name: to.name || to.email }],
      subject,
      htmlContent,
      sender,
      replyTo: sender,
    })

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 })
  }
}
