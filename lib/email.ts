/**
 * Email Service — Hostinger Mail API / Direct SMTP / SendGrid / Brevo / Resend
 * Set one of: HOSTINGER_MAIL_API_KEY + HOSTINGER_MAILBOX_ID | SMTP_HOST | SENDGRID_API_KEY | BREVO_API_KEY | RESEND_API_KEY
 */

import nodemailer from 'nodemailer'
import { HostingerMailApi, Configuration, V1SendRequest } from 'hostinger-mail-api-sdk'

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'
const BREVO_API_URL = 'https://api.brevo.com/v3'
const RESEND_API_URL = 'https://api.resend.com/emails'

interface EmailPayload {
  to: Array<{ email: string; name?: string }>
  subject: string
  htmlContent: string
  sender: { name: string; email: string }
  replyTo?: { name: string; email: string }
}

export async function sendEmail({
  to,
  subject,
  htmlContent,
  sender,
  replyTo,
}: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const hostingerApiKey = process.env.HOSTINGER_MAIL_API_KEY
  const hostingerMailboxId = process.env.HOSTINGER_MAILBOX_ID
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const brevoKey = process.env.BREVO_API_KEY
  const sendgridKey = process.env.SENDGRID_API_KEY
  const resendKey = process.env.RESEND_API_KEY

  // Priority: Hostinger Mail API > Direct SMTP > Brevo > Resend > SendGrid
  if (hostingerApiKey && hostingerMailboxId) {
    return sendViaHostingerMail({ to, subject, htmlContent, sender, replyTo }, { apiKey: hostingerApiKey, mailboxId: hostingerMailboxId })
  }
  if (smtpHost && smtpUser && smtpPass) {
    return sendViaSMTP({ to, subject, htmlContent, sender, replyTo }, { host: smtpHost, port: parseInt(smtpPort || '587'), user: smtpUser, pass: smtpPass })
  }
  if (brevoKey) return sendViaBrevo({ to, subject, htmlContent, sender, replyTo }, brevoKey)
  if (resendKey) return sendViaResend({ to, subject, htmlContent, sender, replyTo }, resendKey)
  if (sendgridKey) return sendViaSendGrid({ to, subject, htmlContent, sender, replyTo }, sendgridKey)

  // Dev mode
  console.log('[Email] No email service configured. Email would be sent:')
  console.log('[Email] To:', to.map(t => t.email).join(', '))
  console.log('[Email] Subject:', subject)
  console.log('[Email] HTML preview:', htmlContent.substring(0, 300) + '...')
  return { success: true, messageId: 'dev-mode-' + Date.now() }
}

// ---------- Hostinger Mail API ----------
async function sendViaHostingerMail(
  { to, subject, htmlContent, sender }: EmailPayload,
  config: { apiKey: string; mailboxId: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const configuration = new Configuration({ apiKey: config.apiKey })
    const api = new HostingerMailApi(configuration)

    const request: V1SendRequest = {
      to: to.map(t => t.name ? `"${t.name}" <${t.email}>` : t.email),
      displayName: sender.name,
      subject,
      text: '',
      html: htmlContent,
      cc: [],
      bcc: [],
      attachments: [],
    }

    await api.sendEmail(config.mailboxId, request)
    console.log('[Hostinger Mail] Email sent successfully')
    return { success: true }
  } catch (error: any) {
    console.error('[Hostinger Mail] Error:', error.message)
    return { success: false, error: error.message }
  }
}

// ---------- Direct SMTP ----------
async function sendViaSMTP(
  { to, subject, htmlContent, sender, replyTo }: EmailPayload,
  smtp: { host: string; port: number; user: string; pass: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    })

    const info = await transporter.sendMail({
      from: `${sender.name} <${sender.email}>`,
      to: to.map(t => t.name ? `"${t.name}" <${t.email}>` : t.email).join(', '),
      subject,
      html: htmlContent,
      ...(replyTo ? { replyTo: `${replyTo.name} <${replyTo.email}>` } : {}),
    })

    console.log('[SMTP] Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('[SMTP] Error:', error.message)
    return { success: false, error: error.message }
  }
}

// ---------- SendGrid ----------
async function sendViaSendGrid(
  { to, subject, htmlContent, sender, replyTo }: EmailPayload,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: to.map(t => ({ to: [{ email: t.email, name: t.name || undefined }], subject })),
        from: { email: sender.email, name: sender.name },
        content: [{ type: 'text/html', value: htmlContent }],
        ...(replyTo ? { reply_to: { email: replyTo.email, name: replyTo.name } } : {}),
      }),
    })

    if (response.status === 202) {
      return { success: true, messageId: response.headers.get('X-Message-Id') || undefined }
    }

    const text = await response.text()
    console.error('[SendGrid] Error:', response.status, text)
    return { success: false, error: `SendGrid error: ${response.status}` }
  } catch (error) {
    console.error('[SendGrid] Network error:', error)
    return { success: false, error: 'Network error while sending email' }
  }
}

// ---------- Resend ----------
async function sendViaResend(
  { to, subject, htmlContent, sender, replyTo }: EmailPayload,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${sender.name} <${sender.email}>`,
        to: to.map(t => ({ email: t.email, name: t.name })),
        subject,
        html: htmlContent,
        ...(replyTo ? { reply_to: `${replyTo.name} <${replyTo.email}>` } : {}),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Resend] Error:', data)
      return { success: false, error: data.message || 'Resend error' }
    }

    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('[Resend] Network error:', error)
    return { success: false, error: 'Network error while sending email' }
  }
}

// ---------- Brevo ----------
async function sendViaBrevo(
  { to, subject, htmlContent, sender, replyTo }: EmailPayload,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        to: to.map(t => ({ email: t.email, name: t.name })),
        subject,
        htmlContent,
        sender: { name: sender.name, email: sender.email },
        ...(replyTo ? { reply_to: { name: replyTo.name, email: replyTo.email } } : {}),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Brevo] Error:', data)
      return { success: false, error: data.message || 'Brevo error' }
    }

    return { success: true, messageId: data.messageId }
  } catch (error) {
    console.error('[Brevo] Network error:', error)
    return { success: false, error: 'Network error while sending email' }
  }
}

/**
 * Replace template variables like {{customer_name}} with actual values
 */
export function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

/**
 * Get email template from SiteSetting by key
 */
export async function getEmailTemplate(prisma: any, templateKey: string): Promise<{
  subject: string
  body: string
  enabled: boolean
} | null> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: `email_template_${templateKey}` },
  })

  if (!setting?.value) return null

  try {
    const parsed = JSON.parse(setting.value)
    return {
      subject: parsed.subject || '',
      body: parsed.body || '',
      enabled: parsed.enabled !== false,
    }
  } catch {
    return null
  }
}

/**
 * Save email template to SiteSetting
 */
export async function saveEmailTemplate(
  prisma: any,
  templateKey: string,
  data: { subject: string; body: string; enabled: boolean }
): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: `email_template_${templateKey}` },
    update: { value: JSON.stringify(data) },
    create: { key: `email_template_${templateKey}`, value: JSON.stringify(data) },
  })
}
