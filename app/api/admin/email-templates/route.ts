import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const EMAIL_TEMPLATE_KEYS = [
  'welcome',        // Welcome email when user registers
  'order_confirm',  // Order confirmation
  'order_shipped',  // Order shipped notification
  'order_delivered', // Order delivered
  'password_reset', // Password reset
]

// GET /api/admin/email-templates — List all templates
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

    // Fetch all email template settings
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
        // Default templates
        templates[key] = getDefaultTemplate(key)
      }
    }

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('Email templates GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/admin/email-templates — Save a template
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { key, subject, body: templateBody, enabled } = body

    if (!key || !EMAIL_TEMPLATE_KEYS.includes(key)) {
      return NextResponse.json({ success: false, error: 'Invalid template key' }, { status: 400 })
    }

    await prisma.siteSetting.upsert({
      where: { key: `email_template_${key}` },
      update: {
        value: JSON.stringify({
          subject: subject || '',
          body: templateBody || '',
          enabled: enabled !== false,
        }),
      },
      create: {
        key: `email_template_${key}`,
        value: JSON.stringify({
          subject: subject || '',
          body: templateBody || '',
          enabled: enabled !== false,
        }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email templates POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save template' }, { status: 500 })
  }
}

function getDefaultTemplate(key: string): any {
  const defaults: Record<string, { subject: string; body: string; enabled: boolean }> = {
    welcome: {
      subject: 'Welcome to {{store_name}}!',
      body: `<h1>Welcome, {{customer_name}}!</h1>
<p>Thank you for registering at <strong>{{store_name}}</strong>.</p>
<p>You can now:</p>
<ul>
  <li>Browse our product catalog</li>
  <li>Place wholesale orders</li>
  <li>Track your orders</li>
</ul>
<p><a href="{{login_url}}">Login to your account</a></p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    order_confirm: {
      subject: 'Order Confirmation - {{order_number}}',
      body: `<h1>Order Confirmed!</h1>
<p>Hi {{customer_name}},</p>
<p>Thank you for your order! Here are the details:</p>
<p><strong>Order Number:</strong> {{order_number}}</p>
<p><strong>Order Date:</strong> {{order_date}}</p>
<p><strong>Total:</strong> {{order_total}}</p>
<h2>Order Items</h2>
{{order_items}}
<p>We'll notify you when your order ships.</p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    order_shipped: {
      subject: 'Your Order {{order_number}} Has Shipped!',
      body: `<h1>Your Order is On Its Way!</h1>
<p>Hi {{customer_name}},</p>
<p>Great news! Your order <strong>{{order_number}}</strong> has been shipped.</p>
<p><strong>Tracking Number:</strong> {{tracking_number}}</p>
<p><strong>Carrier:</strong> {{carrier}}</p>
<p><a href="{{tracking_url}}">Track Your Package</a></p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    order_delivered: {
      subject: 'Your Order {{order_number}} Has Been Delivered',
      body: `<h1>Order Delivered!</h1>
<p>Hi {{customer_name}},</p>
<p>Your order <strong>{{order_number}}</strong> has been delivered!</p>
<p>We hope you love your purchase. If you have any questions, please don't hesitate to contact us.</p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
    password_reset: {
      subject: 'Reset Your Password - {{store_name}}',
      body: `<h1>Password Reset Request</h1>
<p>Hi {{customer_name}},</p>
<p>You requested a password reset. Click the link below to set a new password:</p>
<p><a href="{{reset_link}}">Reset Password</a></p>
<p>This link expires in 24 hours.</p>
<p>If you didn't request this, please ignore this email.</p>
<p>- The {{store_name}} Team</p>`,
      enabled: true,
    },
  }

  return defaults[key] || { subject: '', body: '', enabled: true }
}
