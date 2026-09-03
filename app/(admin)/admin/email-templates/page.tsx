import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EmailTemplatesClient } from './EmailTemplatesClient'

const EMAIL_TEMPLATE_KEYS = ['welcome', 'order_confirm', 'order_shipped', 'order_delivered', 'password_reset']

async function getTemplates(token: string) {
  const user = await verifyToken(token)
  if (!user || user.role !== 'ADMIN') return null

  const templates: Record<string, any> = {}
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: `email_template_${key}` },
    })
    if (setting?.value) {
      try {
        templates[key] = { ...JSON.parse(setting.value), key }
      } catch {
        templates[key] = { key, subject: '', body: '', enabled: true }
      }
    } else {
      templates[key] = getDefaultTemplate(key)
    }
  }
  return templates
}

function getDefaultTemplate(key: string) {
  const defaults: Record<string, { subject: string; body: string; enabled: boolean }> = {
    welcome: {
      subject: 'Welcome to {{store_name}}!',
      body: `<h1>Welcome, {{customer_name}}!</h1>
<p>Thank you for registering at <strong>{{store_name}}</strong>.</p>
<p>You can now browse products and place orders.</p>
<p><a href="{{login_url}}">Login to your account</a></p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    order_confirm: {
      subject: 'Order Confirmation - {{order_number}}',
      body: `<h1>Order Confirmed!</h1>
<p>Hi {{customer_name}},</p>
<p>Thank you for your order!</p>
<p><strong>Order Number:</strong> {{order_number}}</p>
<p><strong>Total:</strong> {{order_total}}</p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    order_shipped: {
      subject: 'Your Order {{order_number}} Has Shipped!',
      body: `<h1>Your Order is On Its Way!</h1>
<p>Hi {{customer_name}},</p>
<p>Great news! Your order has been shipped.</p>
<p><strong>Tracking:</strong> {{tracking_number}}</p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    order_delivered: {
      subject: 'Your Order {{order_number}} Has Been Delivered',
      body: `<h1>Order Delivered!</h1>
<p>Hi {{customer_name}},</p>
<p>Your order {{order_number}} has been delivered!</p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    password_reset: {
      subject: 'Reset Your Password - {{store_name}}',
      body: `<h1>Password Reset</h1>
<p>Hi {{customer_name}},</p>
<p>Click below to reset your password:</p>
<p><a href="{{reset_link}}">Reset Password</a></p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
  }
  return defaults[key] || { subject: '', body: '', enabled: true }
}

export default async function EmailTemplatesPage() {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    redirect('/login')
  }

  const templates = await getTemplates(token)

  if (!templates) {
    redirect('/login')
  }

  return <EmailTemplatesClient initialTemplates={templates} />
}
