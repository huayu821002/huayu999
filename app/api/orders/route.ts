import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendEmail, getEmailTemplate, interpolateTemplate } from '@/lib/email'

// GET /api/orders — 需要登录，用户只能查看自己的订单，admin 可以查看所有
export async function GET(request: Request) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const requestedUserId = searchParams.get('userId')

    const where: Record<string, unknown> = {}

    // 非 admin 只能查看自己的订单
    if (user.role !== 'ADMIN') {
      where.userId = user.userId
    } else if (requestedUserId) {
      // admin 可以指定查看某个用户的订单
      where.userId = requestedUserId
    }

    if (status) {
      where.status = status
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: orders })
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

// POST /api/orders — 公开接口（用于创建批量订单，无需登录）
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userId, items, subtotal, shippingCost, tax, discount, total,
      currency, shippingAddress, billingAddress, paymentMethod,
      paypalOrderId, paypalStatus
    } = body

    // Generate order number
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderNumber = `JH-${timestamp}-${random}`

    // Safely parse numbers with defaults
    const parseNum = (val: any, defaultVal = 0): number => {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? defaultVal : parsed
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: userId || null,
        items: JSON.stringify(items || []),
        subtotal: parseNum(subtotal),
        shippingCost: parseNum(shippingCost),
        tax: parseNum(tax),
        discount: parseNum(discount),
        total: parseNum(total),
        currency: currency || 'USD',
        shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress || {}),
        billingAddress: billingAddress ? (typeof billingAddress === 'string' ? billingAddress : JSON.stringify(billingAddress)) : null,
        paymentMethod: paymentMethod || 'BATCH_ORDER',
        paymentId: paypalOrderId || null,
        status: paypalStatus === 'COMPLETED' ? 'PAID' : 'PENDING',
      },
    })

    // Send order confirmation email asynchronously (non-blocking)
    sendOrderConfirmationEmail(order, items, shippingAddress).catch(err => {
      console.error('[Orders] Failed to send confirmation email:', err)
    })

    return NextResponse.json({ success: true, data: order })
  } catch (error: any) {
    console.error('Create order error:', error)
    console.error('Create order full error:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { success: false, error: 'Failed to create order: ' + (error?.message || 'Unknown error'), details: error?.message, code: error?.code },
      { status: 500 }
    )
  }
}

// Send order confirmation email
async function sendOrderConfirmationEmail(
  order: any,
  items: any[],
  shippingAddress: any
) {
  try {
    // Get customer email from userId if available
    let customerEmail = ''
    let customerName = ''

    if (order.userId) {
      const customer = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { email: true, name: true },
      })
      if (customer) {
        customerEmail = customer.email
        customerName = customer.name || customer.email.split('@')[0]
      }
    }

    // Fallback: try to get email from shipping address
    if (!customerEmail && shippingAddress) {
      if (typeof shippingAddress === 'string') {
        try {
          const parsed = JSON.parse(shippingAddress)
          customerEmail = parsed.email || parsed.emailAddress || ''
          customerName = parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ''}`.trim() : ''
        } catch {}
      } else {
        customerEmail = shippingAddress.email || shippingAddress.emailAddress || ''
        customerName = shippingAddress.firstName ? `${shippingAddress.firstName} ${shippingAddress.lastName || ''}`.trim() : ''
      }
    }

    if (!customerEmail) {
      console.log('[Orders] No customer email found, skipping confirmation email')
      return
    }

    const template = await getEmailTemplate(prisma, 'order_confirm')
    if (!template || !template.enabled) return

    const storeName = process.env.NEXT_PUBLIC_APP_NAME || 'Fiestaflare'

    // Build order items HTML
    const orderItemsHtml = Array.isArray(items) && items.length > 0
      ? items.map((item: any) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.name || 'Product'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity || 1}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${(item.price || 0).toFixed(2)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3">Order details unavailable</td></tr>'

    const orderItemsTable = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Product</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:center;">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderItemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:8px;border:1px solid #ddd;text-align:right;"><strong>Subtotal:</strong></td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${order.subtotal?.toFixed(2) || '0.00'}</td>
          </tr>
          ${order.shippingCost > 0 ? `
          <tr>
            <td colspan="2" style="padding:8px;border:1px solid #ddd;text-align:right;">Shipping:</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${order.shippingCost?.toFixed(2) || '0.00'}</td>
          </tr>
          ` : ''}
          ${order.tax > 0 ? `
          <tr>
            <td colspan="2" style="padding:8px;border:1px solid #ddd;text-align:right;">Tax:</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${order.tax?.toFixed(2) || '0.00'}</td>
          </tr>
          ` : ''}
          <tr>
            <td colspan="2" style="padding:8px;border:1px solid #ddd;text-align:right;"><strong>Total:</strong></td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;"><strong>$${order.total?.toFixed(2) || '0.00'} ${order.currency || 'USD'}</strong></td>
          </tr>
        </tfoot>
      </table>
    `

    const subject = interpolateTemplate(template.subject, {
      store_name: storeName,
      order_number: order.orderNumber,
      customer_name: customerName,
    })

    const htmlContent = interpolateTemplate(template.body, {
      store_name: storeName,
      customer_name: customerName,
      order_number: order.orderNumber,
      order_date: new Date(order.createdAt).toLocaleDateString(),
      order_total: `$${order.total?.toFixed(2) || '0.00'} ${order.currency || 'USD'}`,
      order_items: orderItemsTable,
    })

    await sendEmail({
      to: [{ email: customerEmail, name: customerName }],
      subject,
      htmlContent,
      sender: { name: storeName, email: 'noreply@fiestaflare.com' },
    })

    console.log(`[Orders] Confirmation email sent for order ${order.orderNumber} to ${customerEmail}`)
  } catch (error) {
    console.error('[Orders] Failed to send order confirmation email:', error)
  }
}
