import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET /api/admin/email-status — Debug: check email config status
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const hostingerApiKey = process.env.HOSTINGER_MAIL_API_KEY
    const hostingerMailboxId = process.env.HOSTINGER_MAILBOX_ID
    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const resendKey = process.env.RESEND_API_KEY
    const sendgridKey = process.env.SENDGRID_API_KEY
    const brevoKey = process.env.BREVO_API_KEY

    // Get email templates status
    const keys = ['welcome', 'order_confirm', 'order_shipped', 'order_delivered', 'password_reset']
    const templateStatus: Record<string, any> = {}
    for (const key of keys) {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: `email_template_${key}` },
      })
      if (setting?.value) {
        try {
          const parsed = JSON.parse(setting.value)
          templateStatus[key] = { enabled: parsed.enabled, hasSubject: !!parsed.subject, hasBody: !!parsed.body }
        } catch {
          templateStatus[key] = { enabled: false, error: 'parse error' }
        }
      } else {
        templateStatus[key] = { enabled: true, isDefault: true }
      }
    }

    // Get sender settings
    const senderSetting = await prisma.siteSetting.findUnique({
      where: { key: 'email_sender_settings' },
    })

    return NextResponse.json({
      success: true,
      data: {
        apiKeysConfigured: {
          hostinger: !!(hostingerApiKey && hostingerMailboxId),
          smtp: !!(smtpHost && smtpUser),
          resend: !!resendKey,
          sendgrid: !!sendgridKey,
          brevo: !!brevoKey,
          activeProvider: hostingerApiKey && hostingerMailboxId ? 'hostinger' : smtpHost && smtpUser ? 'smtp' : brevoKey ? 'brevo' : resendKey ? 'resend' : sendgridKey ? 'sendgrid' : 'none',
        },
        debug: {
          hasHostingerKey: !!hostingerApiKey,
          hasHostingerMailbox: !!hostingerMailboxId,
          hostingerKeyPrefix: hostingerApiKey ? hostingerApiKey.substring(0, 8) + '...' : null,
          hostingerMailboxId: hostingerMailboxId || null,
        },
        templates: templateStatus,
        sender: senderSetting?.value ? JSON.parse(senderSetting.value) : null,
      },
    })
  } catch (error) {
    console.error('Email status error:', error)
    return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 })
  }
}
