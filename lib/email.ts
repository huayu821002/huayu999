/**
 * Email Service — SendGrid / Brevo compatible
 * Uses SENDGRID_API_KEY or BREVO_API_KEY env var
 */

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'
const BREVO_API_URL = 'https://api.brevo.com/v3'

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
  // Try SendGrid first
  const sendgridKey = process.env.SENDGRID_API_KEY
  const brevoKey = process.env.BREVO_API_KEY

  if (sendgridKey) {
    return sendViaSendGrid({ to, subject, htmlContent, sender, replyTo }, sendgridKey)
  }

  if (brevoKey) {
    return sendViaBrevo({ to, subject, htmlContent, sender, replyTo }, brevoKey)
  }

  // Dev mode — log and return success
  console.log('[Email] No API key configured. Email would be sent:')
  console.log('[Email] To:', to.map(t => t.email).join(', '))
  console.log('[Email] Subject:', subject)
  console.log('[Email] Content:', htmlContent.substring(0, 200) + '...')
  return { success: true, messageId: 'dev-mode-' + Date.now() }
}

// ---------- SendGrid ----------
async function sendViaSendGrid(
  { to, subject, htmlContent, sender, replyTo }: EmailPayload,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload = {
      personalizations: to.map(t => ({
        to: [{ email: t.email, name: t.name || undefined }],
        subject,
      })),
      from: { email: sender.email, name: sender.name },
      content: [{ type: 'text/html', value: htmlContent }],
      ...(replyTo ? { reply_to: { email: replyTo.email, name: replyTo.name } } : {}),
    }

    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    // SendGrid returns 202 on success, no JSON body
    if (response.status === 202) {
      const messageId = response.headers.get('X-Message-Id') || undefined
      return { success: true, messageId }
    }

    const text = await response.text()
    console.error('[SendGrid] Send error:', response.status, text)
    return { success: false, error: `SendGrid error: ${response.status}` }
  } catch (error) {
    console.error('[SendGrid] Network error:', error)
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
      console.error('[Brevo] Send error:', data)
      return { success: false, error: data.message || 'Failed to send email' }
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
