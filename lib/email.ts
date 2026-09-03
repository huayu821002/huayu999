/**
 * Brevo (Sendinblue) Email Service
 * Docs: https://developers.brevo.com/
 */

const BREVO_API_URL = 'https://api.brevo.com/v3'

interface BrevoSmtpEmail {
  to: Array<{ email: string; name?: string }>
  subject: string
  htmlContent: string
  sender: { name: string; email: string }
  replyTo?: { name: string; email: string }
  templateId?: number
  params?: Record<string, any>
}

export async function sendEmail({
  to,
  subject,
  htmlContent,
  sender,
  replyTo,
}: BrevoSmtpEmail): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY

  // If no API key configured, log and return success for dev/testing
  if (!apiKey) {
    console.log('[Brevo] No API key configured. Email would be sent:')
    console.log('[Brevo] To:', to.map(t => t.email).join(', '))
    console.log('[Brevo] Subject:', subject)
    console.log('[Brevo] Content:', htmlContent.substring(0, 200) + '...')
    return { success: true, messageId: 'dev-mode-' + Date.now() }
  }

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
        replyTo: replyTo ? { name: replyTo.name, email: replyTo.email } : undefined,
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
