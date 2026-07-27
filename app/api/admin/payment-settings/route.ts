import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET payment settings
export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'payment_settings' }
    })
    
    if (setting?.value) {
      return NextResponse.json({ success: true, data: JSON.parse(setting.value) })
    }
    
    // Return default payment settings
    return NextResponse.json({ success: true, data: getDefaultPaymentSettings() })
  } catch (error) {
    return NextResponse.json({ success: true, data: getDefaultPaymentSettings() })
  }
}

// POST save payment settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    await prisma.siteSetting.upsert({
      where: { key: 'payment_settings' },
      update: { value: JSON.stringify(body) },
      create: { key: 'payment_settings', value: JSON.stringify(body) }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function getDefaultPaymentSettings() {
  return {
    mode: 'sandbox', // 'sandbox' or 'production'
    paypal: {
      enabled: true,
      clientId: '',
      clientSecret: '',
      sandbox: {
        clientId: '',
        clientSecret: '',
      },
      production: {
        clientId: '',
        clientSecret: '',
      }
    },
    stripe: {
      enabled: true,
      publishableKey: '',
      secretKey: '',
      webhookSecret: '',
      sandbox: {
        publishableKey: '',
        secretKey: '',
        webhookSecret: '',
      },
      production: {
        publishableKey: '',
        secretKey: '',
        webhookSecret: '',
      }
    },
    bankTransfer: {
      enabled: true,
      bankName: 'Bank of America',
      accountName: 'Fiestaflare Inc.',
      accountNumber: 'XXXX XXXX XXXX 1234',
      swiftCode: 'BOFAUS3N',
      instructions: 'Please include your order number in the payment reference. Your order will be processed after payment is received (usually 2-5 business days).',
    },
    cod: {
      enabled: false,
      fee: 0,
    }
  }
}
